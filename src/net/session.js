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
// A session outlives its connection (Multiplayer M3). When the link drops,
// the host keeps the match and waits; the guest comes back on a new link with
// the reconnect token it chose the first time, and the host sends it the
// current view ('sync'). The host's whole session can be saved after every
// action and restored after a refresh (save() / HostSession.restore). A
// message still arriving on a link that has been replaced is ignored.
//
// A link is { send(text), listen(handler), onClose(fn), close() }; listen
// gets every message received, including any that arrived before it was called.
//
// listener (all optional):
//   status(status)            per connection: 'connecting' → 'ready' | 'mismatch'
//   friendGone()              the link dropped (the session carries on)
//   friendLocked()            the other player has chosen a deck (not which)
//   start(game, decks)        both decks locked; game = the host's state / the guest's view
//   update(prev, next, who)   an action applied (who: the engine seat that took it)
//   sync(info)                guest: the host's state of play on (re)connecting:
//                             { phase: 'decks', friendLocked, yourDeck } or { phase: 'match', view, decks }
//   back()                    host: the guest has come back (reconnected)
//   rejected(message, id)     guest: the host refused its action
//   full()                    guest: the room already has another player
//   rematchAsked()            the other player wants a rematch
//   again()                   both accepted a rematch: back to choosing decks
//   left()                    the other player left the match

import { createGame, applyAction, restoreState } from '../engine/game.js';
import { viewFor } from '../engine/view.js';
import { DECK_IDS } from '../engine/cardData.js';
import { encode, decode, HOST_SEAT, GUEST_SEAT, ONLINE_NAMES, PROTOCOL } from './protocol.js';

class Session {
  constructor({ build, listener = {} }) {
    this.link = null;
    this.build = build;
    this.on = listener;
    this.status = 'connecting';
    this.friendBuild = null;
    this.myDeck = null;
    this.wantRematch = false;     // this side has asked
    this.friendRematch = false;   // the other side has asked
    this.ended = false;           // left (by either player): nothing more is sent or taken
  }

  // A new connection. Only messages from the current link are taken.
  attach(link) {
    if (this.ended) return;
    if (this.link && this.link !== link) this.link.close?.();
    this.link = link;
    this.status = 'connecting';
    this.greeted = false;
    link.onClose?.(() => this.detach(link));
    link.listen((text) => { if (this.link === link && !this.ended) this.receive(text); });
    this.hello();
  }

  // The link dropped: the session (and the match) carries on without it.
  detach(link = this.link) {
    if (!link || this.link !== link) return;
    this.link = null;
    this.status = 'connecting';
    if (!this.ended) this.on.friendGone?.();
  }

  hello() {
    this.send('hello', { build: this.build });
  }

  send(t, body) {
    if (this.link && !this.ended) this.link.send(encode(t, body));
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
        this.hello();
      }
      this.friendBuild = m.build;
      // Both sides see the same check: a different build (or protocol) never starts a match.
      if (m.build !== this.build || m.otherProtocol) this.setStatus('mismatch');
      else if (this.status !== 'ready') this.welcome(m);   // (once per connection: hellos can cross)
      return;
    }
    if (m.t === 'full') {   // (comes instead of a hello: the room has its two players)
      this.ended = true;
      this.on.full?.();
      return;
    }
    if (this.status !== 'ready') return;
    if (m.t === 'leave') this.end(false);
    else this.handle(m);
  }

  // Leave the match (either player): the other side is told, and that's the end.
  leave() {
    this.send('leave');
    this.end(true);
  }

  end(mine) {
    if (this.ended) return;
    this.ended = true;
    const link = this.link;
    this.link = null;
    setTimeout(() => link?.close?.(), 200);   // a moment for the goodbye to go out
    if (!mine) this.on.left?.();
  }

  close() {
    this.ended = true;
    this.link?.close?.();
    this.link = null;
  }
}

export class HostSession extends Session {
  constructor(link, { seed = Date.now(), ...options }) {
    super(options);
    this.seed = seed;
    this.state = null;      // the real game: only ever on the host
    this.guestDeck = null;
    this.guestToken = null; // the guest's reconnect token: only that guest may come back
    this.seq = 0;
    this.sentLog = 0;
    if (link) this.attach(link);
  }

  // A new connection to the room. With no guest connected it is taken; while
  // one is, the newcomer must first prove it's that guest (back after a
  // refresh, before the old link has timed out), or it's told the room is full.
  offer(link) {
    if (!this.link || this.status !== 'ready') {
      this.attach(link);
      return;
    }
    link.listen((text) => {
      const m = decode(text);
      if (m?.t !== 'hello') return;
      if (this.guestToken && m.token === this.guestToken && !this.ended) {
        this.attach(link);
        this.receive(text);
      } else {
        link.send(encode('full'));
        setTimeout(() => link.close?.(), 200);
      }
    });
  }

  welcome(m) {
    // Two players only: once a guest has joined, only that guest (its token) may come back.
    if (this.guestToken && m.token !== this.guestToken) {
      this.send('full');
      const link = this.link;
      this.link = null;
      setTimeout(() => link?.close?.(), 200);
      return;
    }
    const back = Boolean(this.guestToken);
    this.guestToken ??= m.token ?? null;
    this.setStatus('ready');
    this.sync();
    if (back) this.on.back?.();
  }

  // Where things stand, for a guest (re)connecting.
  sync() {
    if (this.state) {
      this.sentLog = 0;
      this.send('sync', { phase: 'match', seq: this.seq, ...this.pack(), rematch: this.wantRematch });
    } else {
      this.send('sync', { phase: 'decks', friendLocked: Boolean(this.myDeck), yourDeck: this.guestDeck });
    }
  }

  handle(m) {
    if (m.t === 'deck' && !this.state) {
      if (!DECK_IDS.includes(m.deck) || this.guestDeck) return;
      this.guestDeck = m.deck;
      this.on.friendLocked?.();
      this.maybeStart();
    } else if (m.t === 'action' && this.state) {
      this.apply(m.action, GUEST_SEAT, m.id);
    } else if (m.t === 'rematch' && this.state?.phase === 'gameOver') {
      this.friendRematch = true;
      this.on.rematchAsked?.();
      this.maybeRematch();
    }
  }

  // The host's own deck: the guest is told only that it has been chosen.
  chooseDeck(deck) {
    if (this.status !== 'ready' || this.myDeck || this.state || !DECK_IDS.includes(deck)) return;
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
      if (this.ended) throw new Error('The match has ended');
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
    // While the guest is away nothing is sent: it gets the current view when it comes back.
    if (this.link && this.status === 'ready') this.send('update', { seq: this.seq, who, ...this.pack() });
    this.on.update?.(prev, next, who);
  }

  // What the guest may see, with only the new log lines.
  pack() {
    const { log, ...view } = viewFor(this.state, GUEST_SEAT);
    const from = this.sentLog;
    this.sentLog = log.length;
    return { view, logFrom: from, log: log.slice(from) };
  }

  // After a match: a rematch once both have asked.
  requestRematch() {
    if (this.state?.phase !== 'gameOver' || this.wantRematch) return;
    this.wantRematch = true;
    this.send('rematch');
    this.maybeRematch();
  }

  maybeRematch() {
    if (this.wantRematch && this.friendRematch) this.again();
  }

  // Both choose decks again (same connection); the new match gets a new seed, so a new coin flip.
  again() {
    this.state = null;
    this.myDeck = null;
    this.guestDeck = null;
    this.wantRematch = false;
    this.friendRematch = false;
    this.seed = nextSeed(this.seed);
    this.seq = 0;
    this.send('again');
    this.on.again?.();
  }

  // Everything needed to carry on after a refresh (JSON-safe).
  save() {
    return {
      v: PROTOCOL, build: this.build, seed: this.seed, state: this.state, seq: this.seq,
      myDeck: this.myDeck, guestDeck: this.guestDeck, guestToken: this.guestToken,
      wantRematch: this.wantRematch, friendRematch: this.friendRematch,
    };
  }

  // A saved session, waiting for its guest to come back (attach a link when one arrives).
  static restore(saved, options) {
    if (!saved || saved.v !== PROTOCOL || saved.build !== options.build) return null;
    const host = new HostSession(null, { ...options, seed: saved.seed });
    Object.assign(host, {
      state: saved.state ? restoreState(saved.state) : null, seq: saved.seq ?? 0, myDeck: saved.myDeck ?? null, guestDeck: saved.guestDeck ?? null,
      guestToken: saved.guestToken ?? null, wantRematch: Boolean(saved.wantRematch), friendRematch: Boolean(saved.friendRematch),
    });
    return host;
  }
}

// A different seed for each new match on the same connection.
const nextSeed = (seed) => ((seed * 1103515245 + 12345) >>> 0) || 1;

export class GuestSession extends Session {
  constructor(link, { token, ...options }) {
    super(options);
    this.token = token ?? newToken();
    this.view = null;   // the latest view the host sent (seat 'ai'); never the real state
    this.seq = 0;
    this.nextId = 0;
    this.friendLocked = false;
    if (link) this.attach(link);
  }

  hello() {
    this.send('hello', { build: this.build, token: this.token });
  }

  welcome() {
    this.setStatus('ready');
  }

  handle(m) {
    switch (m.t) {
      case 'sync':
        if (m.phase === 'match') {
          this.seq = m.seq;
          this.view = { ...m.view, log: m.log };
          this.friendRematch = Boolean(m.rematch);
          this.on.sync?.({ phase: 'match', view: this.view, decks: decksOf(this.view) });
        } else {
          this.view = null;
          this.friendLocked = Boolean(m.friendLocked);
          this.myDeck = m.yourDeck ?? null;
          this.on.sync?.({ phase: 'decks', friendLocked: this.friendLocked, yourDeck: this.myDeck });
        }
        break;
      case 'lobby':
        this.friendLocked = Boolean(m.friendLocked);
        if (this.friendLocked) this.on.friendLocked?.();
        break;
      case 'start':
        this.seq = m.seq;
        this.view = { ...m.view, log: m.log };
        this.on.start?.(this.view, decksOf(this.view));
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
      case 'rematch':
        this.friendRematch = true;
        this.on.rematchAsked?.();
        break;
      case 'again':
        this.view = null;
        this.myDeck = null;
        this.friendLocked = false;
        this.wantRematch = false;
        this.friendRematch = false;
        this.on.again?.();
        break;
      default:
    }
  }

  chooseDeck(deck) {
    if (this.status !== 'ready' || this.myDeck || this.view || !DECK_IDS.includes(deck)) return;
    this.myDeck = deck;
    this.send('deck', { deck });
  }

  // Asks the host to take an action (in the engine's seats). Returns its id, or null if not connected.
  act(action) {
    if (!this.link || this.status !== 'ready') return null;
    this.nextId += 1;
    this.send('action', { id: this.nextId, action });
    return this.nextId;
  }

  requestRematch() {
    if (this.view?.phase !== 'gameOver' || this.wantRematch) return;
    this.wantRematch = true;
    this.send('rematch');
  }
}

const decksOf = (view) => ({ [HOST_SEAT]: view.players[HOST_SEAT].deck, [GUEST_SEAT]: view.players[GUEST_SEAT].deck });

// A reconnect token: random, kept in the guest's browser for this room.
export function newToken(random = Math.random) {
  return Array.from({ length: 4 }, () => Math.floor(random() * 2 ** 32).toString(36)).join('');
}

// Two links joined in memory (for tests). Messages arrive asynchronously, in
// order. drop() cuts the connection as a network failure would: both ends'
// onClose fires, and anything still in flight is lost.
export function linkPair() {
  const make = () => ({ inbox: [], handler: null, other: null, closed: false, closers: [] });
  const a = make();
  const b = make();
  a.other = b;
  b.other = a;
  const cut = () => {
    for (const end of [a, b]) {
      if (end.closed) continue;
      end.closed = true;
      for (const fn of end.closers) fn();
    }
  };
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
    onClose(fn) {
      end.closers.push(fn);
    },
    // A message from the far end, delivered even after a cut (a late packet).
    inject(text) {
      end.handler?.(text);
    },
    close: cut,
    drop: cut,
  });
  a.link = link(a);
  b.link = link(b);
  return [a.link, b.link];
}
