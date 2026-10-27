// The browser link for playing a friend: peer-to-peer WebRTC through PeerJS
// (vendored in src/vendor, loaded only when needed). The free PeerJS cloud
// server only introduces the two browsers; the match itself goes directly
// between them (or through TURN, if set up in ice.js).
//
// hostRoom() makes a room code and waits for one friend; joinRoom(code)
// connects to it. Both hand back a link for session.js.
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

// A PeerJS connection as a link: send(text), listen(handler), close(); onClose(fn) for drops.
// Made as soon as the connection exists, before it opens: the friend's first
// message can arrive before this side's 'open' event, and must not be lost.
// A heartbeat every few seconds tells each side the other is still there: a
// tab closed without saying goodbye is noticed after LOST_AFTER of silence.
const PING = '"ping"';
const BEAT = 5000;
const LOST_AFTER = 20000;
function linkFor(conn, peer) {
  const inbox = [];
  let handler = null;
  let closed = false;
  let heard = Date.now();
  const closers = [];
  const beat = setInterval(() => {
    if (!conn.open) return;
    if (Date.now() - heard > LOST_AFTER) close();
    else conn.send(PING);
  }, BEAT);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(beat);
    for (const fn of closers) fn();
  };
  conn.on('open', () => { heard = Date.now(); });
  conn.on('data', (data) => {
    heard = Date.now();
    const text = typeof data === 'string' ? data : String(data);
    if (text === PING) return;
    if (handler) handler(text);
    else inbox.push(text);
  });
  conn.on('close', close);
  conn.on('error', close);
  peer.on('disconnected', () => {
    // Lost the matchmaking server: the direct connection to the friend can live on.
    if (!peer.destroyed) peer.reconnect();
  });
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
    close() {
      close();
      conn.close();
      peer.destroy();
    },
  };
}

const ERRORS = {
  'browser-incompatible': 'This browser can\'t play online (no WebRTC). Try an up-to-date Chrome, Edge, Firefox or Safari.',
  network: 'Couldn\'t reach the matchmaking server. Check your internet connection and try again.',
  'server-error': 'The matchmaking server isn\'t answering right now. Try again in a minute.',
  'socket-error': 'Lost the connection to the matchmaking server. Try again.',
  'socket-closed': 'Lost the connection to the matchmaking server. Try again.',
  'peer-unavailable': 'No match is waiting with that code. Check the code, or ask your friend for a new link.',
  'webrtc': 'Couldn\'t connect to your friend directly. One of your networks may be blocking it (see "If your friend can\'t connect" in the README).',
};
const explain = (err) => ERRORS[err?.type] ?? err?.message ?? 'Something went wrong with the connection.';

// Hosts a room. on: code(code), connected(link), error(message). Returns { cancel }.
export async function hostRoom(on, { tries = 5 } = {}) {
  const Peer = await loadPeerJs();
  const options = await peerOptions();
  let peer = null;
  let cancelled = false;
  let guest = null;
  const open = (left) => {
    const code = roomCode();
    peer = new Peer(peerId(code), options);
    peer.on('open', () => { if (!cancelled) on.code(code); });
    peer.on('connection', (conn) => {
      // Two players only: anyone after the first is turned away.
      if (guest || cancelled) { conn.on('open', () => conn.close()); return; }
      guest = conn;
      const link = linkFor(conn, peer);
      conn.on('open', () => on.connected(link));
    });
    peer.on('error', (err) => {
      if (cancelled) return;
      if (err.type === 'unavailable-id' && left > 1) {   // that code is taken: another
        peer.destroy();
        open(left - 1);
      } else if (!guest || err.type !== 'peer-unavailable') on.error(explain(err));
    });
  };
  open(tries);
  return { cancel() { cancelled = true; peer?.destroy(); } };
}

// Joins the room with this code. on: connected(link), error(message). Returns { cancel }.
export async function joinRoom(code, on) {
  const Peer = await loadPeerJs();
  const peer = new Peer(await peerOptions());
  let cancelled = false;
  let connected = false;
  peer.on('open', () => {
    if (cancelled) return;
    const conn = peer.connect(peerId(code), { reliable: true });
    const link = linkFor(conn, peer);
    conn.on('open', () => {
      connected = true;
      if (!cancelled) on.connected(link);
    });
  });
  peer.on('error', (err) => { if (!cancelled && !connected) on.error(explain(err)); });
  return { cancel() { cancelled = true; peer.destroy(); } };
}
