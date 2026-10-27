// Playing a friend online, on screen (rules section 10; Multiplayer M2 and M3).
//
// One player hosts (a room code and invite link), the other joins. Once
// connected, both choose decks in secret; then the match. The host's session
// holds the real game; each update from it, from either player's action, is
// queued and played through the normal presentation, one after another.
//
// Robustness (M3):
//   - The guest dropping or refreshing: the host keeps the match ("Your friend
//     disconnected — waiting for them to reconnect…") and stays usable. The
//     guest's browser keeps a reconnect token for the room; reopening the same
//     link (or a dropped connection retrying by itself) rejoins and carries on.
//   - The host refreshing: the host's browser saves the whole match after every
//     action; the start screen offers "Resume your match with your friend",
//     which re-opens the same room code, so the friend's link still works.
//   - Leave match, either side: the other is told and goes back to the start screen.
//   - After a match: Rematch, which both must accept; then decks again and a new coin flip.
//   - A connection indicator (green / amber / red), and plain words when a
//     connection can't be made.
//
// main.js gives: draw(), lock(on), toStart(notice), build, seed.

import { viewFor } from './engine/view.js';
import { HostSession, GuestSession, newToken } from './net/session.js';
import { HOST_SEAT, GUEST_SEAT, normalizeCode, inviteLink } from './net/protocol.js';
import { hostRoom, joinRoom } from './net/peer.js';
import { orient, toEngine, screenSeat } from './ui/seat.js';
import { present, resetFx, historyEntry } from './ui/present.js';
import { pushHistory, clearHistory, setCaption } from './ui/render.js';
import { renderDeckSelect } from './ui/deckSelect.js';
import { renderFriend, renderNetStatus } from './ui/lobby.js';
import { speedFactor } from './ui/settings.js';

// --- Saved in this browser (guarded: storage can be missing or blocked) --------------------

const HOST_KEY = 'plt-online-host';
const tokenKey = (code) => `plt-online-guest-${code}`;
const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved: playing still works, only resuming after a refresh doesn't.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};

// The match this browser was hosting, if it can be resumed by this version.
export function savedHostMatch(build) {
  const saved = store.get(HOST_KEY);
  if (!saved?.code || saved.session?.build !== build || saved.session?.state?.phase === 'gameOver') return null;
  return { code: saved.code, round: saved.session.state?.round ?? 0 };
}
export const forgetHostMatch = () => store.remove(HOST_KEY);

export function createOnline({ build, seed, draw, lock, toStart, stage }) {
  let net = null;          // the online match in progress (see begin)
  let shownView = null;    // the view on screen (the last one presented)
  const views = new WeakMap();

  // The view to draw, from the host's state or the guest's view (the same object each time, for redraws).
  function toScreen(game) {
    if (!views.has(game)) views.set(game, net.role === 'host' ? orient(viewFor(game, HOST_SEAT)) : orient(game));
    return views.get(game);
  }

  function begin(role, screen) {
    net?.room?.cancel();
    net = {
      role, seat: role === 'host' ? HOST_SEAT : GUEST_SEAT, screen, code: null, session: null, room: null,
      friendLocked: false, inMatch: false, queue: [], running: false, awaiting: false,
      health: 'reconnecting', banner: null, rematch: 'ask', everConnected: false, retry: null,
    };
    shownView = null;
    clearHistory();
    setCaption('');
    lock(false);
  }

  function update() {
    draw();
  }

  function status() {
    if (!net) return null;
    return { health: net.health, banner: net.banner };
  }

  // A short piece of news over the board ("Host reconnected").
  function toast(text) {
    renderNetStatus(stage, { ...status(), toast: text });
  }

  function watch(link) {
    link.onHealth?.((h) => {
      if (!net || net.session?.link !== link) return;
      net.health = h === 'lost' ? 'lost' : h;
      renderNetStatus(stage, status());
    });
  }

  // --- Hosting ---------------------------------------------------------------------------

  function hostNew() {
    begin('host', { kind: 'hosting' });
    net.session = new HostSession(null, { build, seed: seed() || Date.now(), listener: hostListener() });
    openRoom(null);
    update();
  }

  // After a refresh: the saved match, the same room code.
  function hostResume() {
    const saved = store.get(HOST_KEY);
    begin('host', { kind: 'hosting' });
    const session = saved && HostSession.restore(saved.session, { build, listener: hostListener() });
    if (!session) {
      forgetHostMatch();
      toStart('That match can\'t be resumed (the game has been updated since). Start a new one.');
      return;
    }
    net.session = session;
    net.code = saved.code;
    net.everConnected = true;
    if (session.state) {
      net.screen = { kind: 'match' };
      enterMatch(session.state);
      net.banner = 'Waiting for your friend to reconnect…';
    } else net.screen = { kind: 'waiting', code: saved.code, link: inviteLink(location.href, saved.code), gone: true };
    openRoom(saved.code);
    update();
  }

  function openRoom(code) {
    const me = net;
    hostRoom({
      code: (opened) => {
        if (net !== me) return;
        me.code = opened;
        save();
        if (me.screen.kind === 'hosting') me.screen = { kind: 'waiting', code: opened, link: inviteLink(location.href, opened) };
        if (me.screen.kind === 'waiting') me.screen.link = inviteLink(location.href, opened);
        if (me.inMatch) me.banner = `Waiting for your friend to reconnect… (room ${opened})`;
        update();
      },
      connected: (link) => {
        if (net !== me) return link.close();
        watch(link);
        me.session.offer(link);
        return undefined;
      },
      error: (message) => {
        if (net !== me) return;
        if (me.inMatch) {
          me.health = 'lost';
          me.banner = message;
        } else me.screen = { kind: 'error', message, retry: 'host' };
        update();
      },
    }, { code }).then((room) => {
      if (net === me) me.room = room;
      else room.cancel();
    }).catch((err) => {
      me.screen = { kind: 'error', message: err.message, retry: 'host' };
      update();
    });
  }

  function save() {
    if (net?.role === 'host' && net.code && !net.session.ended) store.set(HOST_KEY, { code: net.code, session: net.session.save(), savedAt: Date.now() });
  }

  function hostListener() {
    return {
      status: (s) => {
        const me = net;
        if (s === 'mismatch') me.screen = { kind: 'mismatch' };
        else if (s === 'ready') {
          me.health = 'good';
          me.everConnected = true;
          if (!me.inMatch && !me.session.state) me.screen = me.session.myDeck ? { kind: 'waitingDeck', deck: me.session.myDeck } : { kind: 'decks' };
          me.friendLocked = Boolean(me.session.guestDeck);
        }
        queueMicrotask(update);
      },
      friendGone: () => {
        const me = net;
        me.health = 'lost';
        if (me.inMatch) me.banner = 'Your friend disconnected — waiting for them to reconnect…';
        else me.screen = { kind: 'waiting', code: me.code, link: inviteLink(location.href, me.code), gone: true };
        update();
      },
      back: () => {
        net.banner = null;
        net.health = 'good';
        toast('Your friend reconnected');
        update();
      },
      friendLocked: () => {
        net.friendLocked = true;
        save();
        if (!net.inMatch) update();
      },
      start: (game, decks) => reveal(game, decks),
      update: (prev, next, who) => {
        save();
        queueUpdate(prev, next, who);
      },
      rematchAsked: () => {
        net.rematch = net.session.wantRematch ? net.rematch : 'accept';
        save();
        update();
      },
      again: () => backToDecks(),
      left: () => friendLeft(),
    };
  }

  // --- Joining -------------------------------------------------------------------------

  function join(typed) {
    const code = normalizeCode(typed);
    begin('guest', { kind: 'joining', code: code ?? typed });
    if (!code) {
      net.screen = { kind: 'error', message: `"${typed}" isn't a room code: it's 5 letters, like HMQXT.`, canJoin: true };
      update();
      return;
    }
    net.code = code;
    // The reconnect token for this room, kept in this browser: reopening the link carries on the match.
    let token = store.get(tokenKey(code));
    if (!token) {
      token = newToken();
      store.set(tokenKey(code), token);
    }
    net.session = new GuestSession(null, { build, token, listener: guestListener() });
    connectGuest();
    update();
  }

  function connectGuest() {
    const me = net;
    if (me.connecting || me.session.ended) return;
    me.connecting = true;
    joinRoom(me.code, {
      connected: (link) => {
        me.connecting = false;
        if (net !== me) return link.close();
        watch(link);
        me.session.attach(link);
        return undefined;
      },
      error: (message) => {
        me.connecting = false;
        if (net !== me || me.session.ended) return;
        if (me.everConnected) {
          // Once connected, keep trying quietly: the host may be refreshing, or a network blinking.
          clearTimeout(me.retry);
          me.retry = setTimeout(connectGuest, 3000);
        } else {
          me.screen = { kind: 'error', message, canJoin: true, retry: me.code };
          update();
        }
      },
    }).then((room) => {
      if (net === me) me.room = room;
      else room.cancel();
    }).catch((err) => {
      me.connecting = false;
      me.screen = { kind: 'error', message: err.message, retry: me.code };
      update();
    });
  }

  function guestListener() {
    return {
      status: (s) => {
        const me = net;
        if (s === 'mismatch') me.screen = { kind: 'mismatch' };
        else if (s === 'ready') {
          me.health = 'good';
          me.everConnected = true;
          clearTimeout(me.retry);
        }
        queueMicrotask(update);
      },
      sync: (info) => {
        const me = net;
        const wasAway = me.banner !== null;
        me.banner = null;
        me.awaiting = false;
        if (info.phase === 'match') {
          me.rematch = me.session.friendRematch ? 'accept' : 'ask';
          if (!me.inMatch) {
            me.screen = { kind: 'match' };
            enterMatch(info.view);
          } else {
            // Back after a drop: straight to where the match is now.
            me.queue = [];
            shownView = toScreen(info.view);
            lock(me.running);
            update();
          }
          if (wasAway) toast('Host reconnected');
        } else {
          me.inMatch = false;
          shownView = null;
          me.friendLocked = info.friendLocked;
          me.screen = info.yourDeck ? { kind: 'waitingDeck', deck: info.yourDeck } : { kind: 'decks' };
          if (wasAway) toast('Host reconnected');
          update();
        }
      },
      friendGone: () => {
        const me = net;
        me.health = 'reconnecting';
        me.banner = 'Your friend disconnected — trying to reconnect…';
        if (!me.inMatch) me.screen = { kind: 'reconnecting' };
        update();
        clearTimeout(me.retry);
        me.retry = setTimeout(connectGuest, 1500);
      },
      friendLocked: () => {
        net.friendLocked = true;
        if (!net.inMatch) update();
      },
      start: (view, decks) => reveal(view, decks),
      update: (prev, next, who) => {
        if (who === net.seat) net.awaiting = false;
        queueUpdate(prev, next, who);
      },
      rejected: (message) => {
        net.awaiting = false;
        if (!net.running) lock(false);
        alert(message);
        update();
      },
      full: () => {
        store.remove(tokenKey(net.code));
        net.screen = { kind: 'full' };
        net.inMatch = false;
        shownView = null;
        update();
      },
      rematchAsked: () => {
        net.rematch = net.session.wantRematch ? net.rematch : 'accept';
        update();
      },
      again: () => backToDecks(),
      left: () => friendLeft(),
    };
  }

  // --- The match ------------------------------------------------------------------------------

  // Both decks locked: "Fire vs Water", then the match.
  function reveal(game, decks) {
    const me = net;
    me.screen = { kind: 'reveal', mine: decks[me.seat], theirs: decks[me.seat === HOST_SEAT ? GUEST_SEAT : HOST_SEAT] };
    save();
    update();
    setTimeout(() => { if (net === me && me.screen.kind === 'reveal') enterMatch(game); }, 2600 * Math.max(0.5, speedFactor()));
  }

  function enterMatch(game) {
    const me = net;
    me.inMatch = true;
    me.screen = { kind: 'match' };
    shownView = toScreen(game);
    resetFx();
    clearHistory();
    setCaption('');
    update();
    runQueue();
    waitingCaption();
  }

  function queueUpdate(prev, next, who) {
    net.queue.push({ prev, next, who });
    runQueue();
  }

  // Each update in turn, with the same animations, banners and captions as the AI's actions.
  async function runQueue() {
    const me = net;
    if (!me || me.running || !me.inMatch) return;
    me.running = true;
    lock(true);
    while (me.queue.length && net === me && me.inMatch) {
      const { prev, next, who } = me.queue.shift();
      const before = toScreen(prev);
      const after = toScreen(next);
      const actor = screenSeat(who, me.seat);
      pushHistory(historyEntry(before, after, actor));
      shownView = after;
      // eslint-disable-next-line no-await-in-loop
      await present(stage.querySelector('#app'), before, after, actor, draw);
    }
    me.running = false;
    if (net !== me || !me.inMatch) return;
    lock(Boolean(me.awaiting));
    update();
    waitingCaption();
  }

  // "Opponent is choosing…" while it's the friend's move (their turn, their choice, or their half of a simultaneous step).
  function waitingCaption() {
    const v = shownView;
    if (!v || v.phase === 'gameOver') return;
    const theirs = v.pending ? v.pending.who === 'ai'
      : v.phase === 'battle' ? v.turn === 'ai'
        : v.phase === 'trainers' ? !v.players.ai.pending
          : v.phase === 'breakfast' && (v.xpStep ? !v.players.ai.xpChoice : v.round === 1 && !v.players.ai.pending);
    if (theirs) setCaption('Opponent is choosing…');
  }

  // An action from the screen: the host applies it (checked like any action);
  // the guest sends it and waits for the host's answer.
  function dispatch(action) {
    const me = net;
    if (!me?.session || !me.inMatch) return;
    if (me.role === 'host') {
      try {
        me.session.act(toEngine(action, HOST_SEAT));
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    if (me.session.act(toEngine(action, GUEST_SEAT)) === null) {
      alert('Not connected to your friend right now: wait for them to reconnect.');
      return;
    }
    me.awaiting = true;
    lock(true);
  }

  function chooseDeck(deck) {
    if (!net?.session) return;
    net.screen = { kind: 'waitingDeck', deck };
    update();
    net.session.chooseDeck(deck);   // (if the friend has already chosen, the match starts right here)
    save();
  }

  // After a match: ask for a rematch (or accept the friend's).
  function rematch() {
    if (!net?.session || shownView?.phase !== 'gameOver') return;
    net.rematch = 'waiting';
    net.session.requestRematch();
    save();
    update();
  }

  function backToDecks() {
    const me = net;
    Object.assign(me, { screen: { kind: 'decks' }, friendLocked: false, inMatch: false, queue: [], awaiting: false, rematch: 'ask' });
    shownView = null;
    resetFx();
    clearHistory();
    setCaption('');
    lock(false);
    save();
    update();
  }

  // Leave match (or leave the lobby): the friend is told; back to the start screen.
  function leave() {
    const me = net;
    if (!me) return;
    if (me.inMatch && shownView?.phase !== 'gameOver' && !confirm('Leave this match? Your friend will be told you left.')) return;
    me.session?.leave();
    end(me);
    toStart();
  }

  function friendLeft() {
    const me = net;
    end(me);
    toStart('Your friend left the match.');
  }

  function end(me) {
    clearTimeout(me.retry);
    me.room?.cancel();
    if (me.role === 'host') forgetHostMatch();
    else if (me.code) store.remove(tokenKey(me.code));
    net = null;
    shownView = null;
    lock(false);
    setCaption('');
    renderNetStatus(stage, null);
  }

  // The lobby screens (before and between matches).
  function drawScreen(root) {
    const me = net;
    if (me.screen.kind === 'decks') {
      renderDeckSelect(root, { build, online: true, friendLocked: me.friendLocked, choose: chooseDeck, back: leave });
    } else {
      const screen = me.screen.kind === 'mismatch' ? { ...me.screen, mine: build, theirs: me.session?.friendBuild } : me.screen;
      renderFriend(root, screen, {
        back: leave,
        join: (code) => { me.session?.close(); end(me); join(code); },
        retry: me.screen.retry ? () => (me.screen.retry === 'host' ? hostNew() : join(me.screen.retry)) : null,
        copy: async () => {
          try {
            await navigator.clipboard.writeText(me.screen.link);
          } catch {
            root.querySelector('.invite-link')?.select();
            document.execCommand?.('copy');
          }
          me.screen = { ...me.screen, copied: true };
          update();
        },
      });
    }
  }

  return {
    hostNew,
    hostResume,
    join,
    dispatch,
    rematch,
    leave,
    drawScreen,
    active: () => Boolean(net),
    view: () => (net?.inMatch ? shownView : null),
    endButtons: () => ({ rematch: net?.rematch ?? 'ask' }),
    // The indicator, banner and toast, after each draw.
    decorate: () => renderNetStatus(stage, net?.everConnected || net?.inMatch ? status() : null),
    // Closing the tab says goodbye (the host's match stays saved for a resume).
    goodbye: () => net?.session?.link?.close(),
  };
}
