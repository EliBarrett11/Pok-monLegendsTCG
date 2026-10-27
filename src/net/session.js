// Playing a friend online: the two ends of a match, over any link that can
// send text (PeerJS in the browser, an in-memory pair in the tests). Pure: no
// DOM, no network of its own.
//
// Host-authoritative: the host's browser runs the real game (createGame,
// applyAction) exactly as against the AI. The guest never runs the engine on
// the real state: it sends actions, the host checks them with applyAction (an
// illegal one is rejected and nothing changes), and after every action, from
// either player, the host sends the guest only viewFor(state, guest seat) and
// its redacted events. Each side's screen plays these through the normal
// presentation.
//
// A link is { send(text), listen(handler), close() }; listen gets every
// message received, including any that arrived before it was called.
//
// listener (all optional):
//   status(status)            'connecting' → 'decks' (connected) | 'mismatch'
//   friendLocked()            the other player has chosen a deck (not which)
//   start(game, decks)        both decks locked; game = the host's state / the guest's view
//   update(prev, next, who)   an action applied (who: the engine seat that took it)
//   rejected(message, id)     guest only: the host refused its action
//   again()                   back to choosing decks after a match

import { createGame, applyAction } from '../engine/game.js';
import { viewFor } from '../engine/view.js';
import { DECK_IDS } from '../engine/cardData.js';
import { encode, decode, HOST_SEAT, GUEST_SEAT, ONLINE_NAMES } from './protocol.js';

class Session {
  constructor(link, { build, listener = {} }) {
    this.link = link;
    this.build = build;
    this.on = listener;
    this.status = 'connecting';
    this.friendBuild = null;
    this.myDeck = null;
  }

  // Called once the subclass is set up: messages that arrived early are handled now.
  begin() {
    this.link.listen((text) => this.receive(text));
    this.send('hello', { build: this.build });
  }

  send(t, body) {
    this.link.send(encode(t, body));
  }

  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    this.on.status?.(status);
  }

  receive(text) {
    const m = decode(text);
    if (!m) return;
    if (m.t === 'hello') {
      // The first hello heard is answered with ours: a hello sent the instant
      // a connection opens can be lost if the friend's end wasn't ready yet.
      if (!this.greeted) {
        this.greeted = true;
        this.send('hello', { build: this.build });
      }
      this.friendBuild = m.build;
      // Both sides see the same check: a different build (or protocol) never starts a match.
      this.setStatus(m.build === this.build && !m.otherProtocol ? 'decks' : 'mismatch');
      return;
    }
    if (this.status === 'mismatch' || this.status === 'connecting') return;
    this.handle(m);
  }

  close() {
    this.link.close?.();
  }
}

export class HostSession extends Session {
  constructor(link, { seed = Date.now(), ...options }) {
    super(link, options);
    this.seed = seed;
    this.state = null;      // the real game: only ever on the host
    this.guestDeck = null;
    this.seq = 0;
    this.sentLog = 0;
    this.begin();
  }

  handle(m) {
    if (m.t === 'deck' && !this.state) {
      if (!DECK_IDS.includes(m.deck) || this.guestDeck) return;
      this.guestDeck = m.deck;
      this.on.friendLocked?.();
      this.maybeStart();
    } else if (m.t === 'action' && this.state) {
      this.apply(m.action, GUEST_SEAT, m.id);
    } else if (m.t === 'again' && this.state?.phase === 'gameOver') {
      this.again();
    }
  }

  // The host's own deck: the guest is told only that it has been chosen.
  chooseDeck(deck) {
    if (this.status !== 'decks' || this.myDeck || !DECK_IDS.includes(deck)) return;
    this.myDeck = deck;
    this.send('lobby', { friendLocked: true });
    this.maybeStart();
  }

  maybeStart() {
    if (!this.myDeck || !this.guestDeck || this.state) return;
    const decks = { [HOST_SEAT]: this.myDeck, [GUEST_SEAT]: this.guestDeck };
    this.state = createGame(this.seed, { decks, names: ONLINE_NAMES });
    this.seq = 0;
    this.sentLog = 0;
    this.send('start', { seq: 0, ...this.pack() });
    this.on.start?.(this.state, decks);
  }

  // An action by the host's player. Returns true if it was legal (else throws, like applyAction).
  act(action) {
    return this.apply(action, HOST_SEAT);
  }

  // Checks and applies an action for one seat; a seat only ever acts for itself.
  apply(action, seat, id) {
    let next;
    try {
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') throw new Error('Not an action');
      next = applyAction(this.state, { ...action, who: seat });
    } catch (err) {
      if (seat === GUEST_SEAT) {
        this.send('reject', { id, message: err.message });
        return false;
      }
      throw err;
    }
    this.commit(next, seat);
    // The coin flip for initiative needs no one's choice: the host flips it.
    while (this.state.phase === 'initiative') this.commit(applyAction(this.state, { type: 'flipCoin' }), HOST_SEAT);
    return true;
  }

  commit(next, who) {
    const prev = this.state;
    this.state = next;
    this.seq += 1;
    this.send('update', { seq: this.seq, who, ...this.pack() });
    this.on.update?.(prev, next, who);
  }

  // What the guest may see, with only the new log lines.
  pack() {
    const { log, ...view } = viewFor(this.state, GUEST_SEAT);
    const from = this.sentLog;
    this.sentLog = log.length;
    return { view, logFrom: from, log: log.slice(from) };
  }

  // After a match: both choose decks again (same connection).
  again() {
    this.state = null;
    this.myDeck = null;
    this.guestDeck = null;
    this.seed = Date.now();
    this.send('again');
    this.on.again?.();
  }
}

export class GuestSession extends Session {
  constructor(link, options) {
    super(link, options);
    this.view = null;   // the latest view the host sent (seat 'ai'); never the real state
    this.seq = 0;
    this.nextId = 0;
    this.friendLocked = false;
    this.begin();
  }

  handle(m) {
    switch (m.t) {
      case 'lobby':
        this.friendLocked = Boolean(m.friendLocked);
        if (this.friendLocked) this.on.friendLocked?.();
        break;
      case 'start':
        this.seq = m.seq;
        this.view = { ...m.view, log: m.log };
        this.on.start?.(this.view, { [HOST_SEAT]: this.view.players[HOST_SEAT].deck, [GUEST_SEAT]: this.view.players[GUEST_SEAT].deck });
        break;
      case 'update': {
        if (!this.view || m.seq !== this.seq + 1) return;   // out of order: ignored (the link is reliable and ordered)
        const prev = this.view;
        this.seq = m.seq;
        this.view = { ...m.view, log: [...prev.log.slice(0, m.logFrom), ...m.log] };
        this.on.update?.(prev, this.view, m.who);
        break;
      }
      case 'reject':
        this.on.rejected?.(m.message, m.id);
        break;
      case 'again':
        this.view = null;
        this.myDeck = null;
        this.friendLocked = false;
        this.on.again?.();
        break;
      default:
    }
  }

  chooseDeck(deck) {
    if (this.status !== 'decks' || this.myDeck || !DECK_IDS.includes(deck)) return;
    this.myDeck = deck;
    this.send('deck', { deck });
  }

  // Asks the host to take an action (in the engine's seats). Returns its id.
  act(action) {
    this.nextId += 1;
    this.send('action', { id: this.nextId, action });
    return this.nextId;
  }

  again() {
    if (this.view?.phase === 'gameOver') this.send('again');
  }
}

// Two links joined in memory (for tests). Messages arrive asynchronously, in order.
export function linkPair() {
  const make = () => ({ inbox: [], handler: null, other: null, closed: false });
  const a = make();
  const b = make();
  a.other = b;
  b.other = a;
  const link = (end) => ({
    sent: [],
    received: [],
    send(text) {
      if (end.closed) return;
      this.sent.push(text);
      const to = end.other;
      queueMicrotask(() => {
        if (to.closed) return;
        to.link.received.push(text);
        if (to.handler) to.handler(text);
        else to.inbox.push(text);
      });
    },
    listen(handler) {
      end.handler = handler;
      for (const text of end.inbox.splice(0)) handler(text);
    },
    close() {
      end.closed = true;
    },
  });
  a.link = link(a);
  b.link = link(b);
  return [a.link, b.link];
}
