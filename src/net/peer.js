// The browser link for playing a friend: peer-to-peer WebRTC through PeerJS
// (vendored in src/vendor, loaded only when needed). The free PeerJS cloud
// server only introduces the two browsers; the match itself goes directly
// between them (or through TURN, if set up in ice.js).
//
// hostRoom() makes a room code (or re-opens one, to resume after a refresh)
// and hands over every connection that arrives; joinRoom(code) connects to
// it. Both hand back links for session.js, which decides who may play.
//
// For testing without the cloud server, ?peerserver=host:port uses a local
// PeerServer instead (e.g. `npx peer --port 9000`).

import { iceServers } from './ice.js';
import { roomCode, peerId } from './protocol.js';

const PEERJS = new URL('../vendor/peerjs-1.5.5.min.js', import.meta.url).href;
let loading = null;

function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEERJS;
    script.onload = () => resolve(window.Peer);
    script.onerror = () => { loading = null; reject(new Error('Could not load the connection library.')); };
    document.head.append(script);
  });
  return loading;
}

async function peerOptions() {
  const options = { config: { iceServers: await iceServers() }, debug: 1 };
  const local = new URLSearchParams(location.search).get('peerserver');
  if (local) {
    const [host, port] = local.split(':');
    Object.assign(options, { host, port: Number(port) || 9000, path: '/', secure: false });
  }
  return options;
}

// A PeerJS connection as a link for session.js: send(text), listen(handler),
// onClose(fn), close(); onHealth(fn) hears 'good', 'slow' or 'lost'.
// Made as soon as the connection exists, before it opens: the friend's first
// message can arrive before this side's 'open' event, and must not be lost.
// A heartbeat every few seconds tells each side the other is still there: a
// tab closed without saying goodbye is noticed after LOST_AFTER of silence.
const PING = '"ping"';
const BEAT = 3000;
const SLOW_AFTER = 7000;
const LOST_AFTER = 20000;
function linkFor(conn) {
  const inbox = [];
  let handler = null;
  let closed = false;
  let heard = Date.now();
  let health = 'good';
  const closers = [];
  const watchers = [];
  const setHealth = (h) => {
    if (h === health) return;
    health = h;
    for (const fn of watchers) fn(h);
  };
  const beat = setInterval(() => {
    if (!conn.open) return;
    const quiet = Date.now() - heard;
    if (quiet > LOST_AFTER) close();
    else {
      setHealth(quiet > SLOW_AFTER ? 'slow' : 'good');
      conn.send(PING);
    }
  }, BEAT);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(beat);
    setHealth('lost');
    for (const fn of closers) fn();
  };
  conn.on('open', () => { heard = Date.now(); });
  conn.on('data', (data) => {
    heard = Date.now();
    setHealth('good');
    const text = typeof data === 'string' ? data : String(data);
    if (text === PING) return;
    if (handler) handler(text);
    else inbox.push(text);
  });
  conn.on('close', close);
  conn.on('error', close);
  return {
    send(text) {
      if (!closed && conn.open) conn.send(text);
    },
    listen(fn) {
      handler = fn;
      for (const text of inbox.splice(0)) fn(text);
    },
    onClose(fn) {
      closers.push(fn);
    },
    onHealth(fn) {
      watchers.push(fn);
    },
    close() {
      close();
      conn.close();
    },
  };
}

// What went wrong, in plain words.
export const MESSAGES = {
  blocked: 'Couldn\'t connect. Some networks (offices, schools, some mobile hotspots) block direct connections. '
    + 'Try another network, or see "If your friend can\'t connect" in the README to add a free relay server.',
  server: 'The matchmaking server (PeerJS) isn\'t responding, so a match can\'t be set up right now. '
    + 'It\'s probably down for a while: try again later. (If other websites don\'t load either, check your internet connection.)',
  noRoom: 'No match is waiting with that code. Check the code, or ask your friend for a new link (their match may have ended).',
  taken: 'That room code is still in use. Wait a few seconds and try again.',
  browser: 'This browser can\'t play online (no WebRTC). Try an up-to-date Chrome, Edge, Firefox or Safari.',
};
const ERRORS = {
  'browser-incompatible': MESSAGES.browser,
  network: MESSAGES.server,
  'server-error': MESSAGES.server,
  'socket-error': MESSAGES.server,
  'socket-closed': MESSAGES.server,
  'peer-unavailable': MESSAGES.noRoom,
  'unavailable-id': MESSAGES.taken,
  webrtc: MESSAGES.blocked,
};
const explain = (err) => ERRORS[err?.type] ?? err?.message ?? 'Something went wrong with the connection.';

// How long to wait for the matchmaking server, and for a direct connection.
const SERVER_TIMEOUT = 15000;
const CONNECT_TIMEOUT = 20000;

// Hosts a room: a new code, or `code` to re-open the same room after a refresh
// (the server may still hold it for a few seconds: it's tried again).
// on: code(code), connected(link) for every connection, error(message). Returns { cancel }.
export async function hostRoom(on, { code: reuse = null, tries = 6 } = {}) {
  const Peer = await loadPeerJs();
  const options = await peerOptions();
  let peer = null;
  let cancelled = false;
  let opened = false;
  const timer = setTimeout(() => { if (!opened && !cancelled) on.error(MESSAGES.server); }, SERVER_TIMEOUT);
  const open = (left) => {
    const code = reuse ?? roomCode();
    peer = new Peer(peerId(code), options);
    peer.on('open', () => {
      opened = true;
      clearTimeout(timer);
      if (!cancelled) on.code(code);
    });
    peer.on('connection', (conn) => {
      if (cancelled) return;
      const link = linkFor(conn);
      conn.on('open', () => on.connected(link));
    });
    peer.on('disconnected', () => {
      // Lost the matchmaking server: connections to the friend live on; keep the room open for comebacks.
      if (!cancelled && !peer.destroyed) setTimeout(() => { if (!cancelled && !peer.destroyed) peer.reconnect(); }, 2000);
    });
    peer.on('error', (err) => {
      if (cancelled) return;
      if (err.type === 'unavailable-id' && left > 1) {
        // A new room: that code is taken, try another. A resumed room: the server hasn't let go of it yet.
        peer.destroy();
        setTimeout(() => { if (!cancelled) open(left - 1); }, reuse ? 2500 : 0);
      } else if (err.type !== 'peer-unavailable') {
        clearTimeout(timer);
        on.error(explain(err));
      }
    });
  };
  open(tries);
  return { cancel() { cancelled = true; clearTimeout(timer); peer?.destroy(); } };
}

// Joins the room with this code. on: connected(link), error(message). Returns { cancel }.
export async function joinRoom(code, on) {
  const Peer = await loadPeerJs();
  const peer = new Peer(await peerOptions());
  let cancelled = false;
  let connected = false;
  let failed = false;
  const fail = (message) => {
    if (cancelled || connected || failed) return;
    failed = true;
    clearTimeout(serverTimer);
    clearTimeout(connectTimer);
    peer.destroy();
    on.error(message);
  };
  let connectTimer = null;
  const serverTimer = setTimeout(() => fail(MESSAGES.server), SERVER_TIMEOUT);
  peer.on('open', () => {
    clearTimeout(serverTimer);
    if (cancelled) return;
    const conn = peer.connect(peerId(code), { reliable: true });
    const link = linkFor(conn);
    // The server knows the room, but no direct connection opens: a network is blocking it.
    connectTimer = setTimeout(() => fail(MESSAGES.blocked), CONNECT_TIMEOUT);
    conn.on('open', () => {
      clearTimeout(connectTimer);
      connected = true;
      if (!cancelled) on.connected(link);
    });
    link.onClose(() => { if (connected) peer.destroy(); });
  });
  peer.on('error', (err) => fail(explain(err)));
  return { cancel() { cancelled = true; clearTimeout(serverTimer); clearTimeout(connectTimer); peer.destroy(); } };
}
