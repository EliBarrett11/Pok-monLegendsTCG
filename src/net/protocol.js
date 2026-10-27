// Playing a friend online (rules section 10): the messages between the two
// browsers, and room codes. Pure: no DOM, no network (session.js and peer.js
// use these).
//
// Every message is a small JSON object with the protocol version `p` and a
// type `t`:
//   both   hello   { build }           on connecting; builds must match
//   guest  deck    { deck }            the guest's secret deck choice
//   guest  action  { id, action }      an action the guest wants to take
//   guest  again   {}                  back to deck choice after a match
//   host   lobby   { friendLocked }    the guest learns the host has chosen (not what)
//   host   start   { seq, view, log }  both decks locked: the match begins
//   host   update  { seq, who, view, logFrom, log }   after every action, from either player
//   host   reject  { id, message }     the guest's action was illegal; nothing changed
//   host   again   {}                  back to deck choice after a match
// `view` is always viewFor(state, guest seat) without its log; the log is
// sent as the lines added since the last message.

export const PROTOCOL = 1;

// The host plays the engine's 'player' seat and the guest its 'ai' seat; each
// sees itself as "You" and the other as "Your friend".
export const HOST_SEAT = 'player';
export const GUEST_SEAT = 'ai';
export const ONLINE_NAMES = { player: 'Your friend', ai: 'Your friend' };

export const encode = (t, body = {}) => JSON.stringify({ p: PROTOCOL, t, ...body });

// A message, or null if it isn't one of ours. A different protocol version
// comes back as { t: 'hello', otherProtocol } so the version check catches it.
export function decode(text) {
  let m;
  try {
    m = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  if (m.p !== PROTOCOL) return { t: 'hello', build: m.build ?? null, otherProtocol: m.p ?? null };
  return m;
}

// Room codes: 5 letters, e.g. "HMQXT". No look-alikes (I/L, O, U/V, B, S, Z)
// and no vowels or C, F, K, so a code never spells a word (or a rude one).
// 13 letters: 371,293 codes (a code already in use is swapped for another).
export const CODE_LETTERS = 'DGHJMNPQRTWXY';
export const CODE_LENGTH = 5;
export function roomCode(random = Math.random) {
  return Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('');
}

// What someone typed (or the ?join= value) as a code, or null.
export function normalizeCode(text) {
  const code = String(text ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

// The id on the PeerJS server: prefixed, so codes can't clash with other apps' ids.
export const peerId = (code) => `pokemon-legends-tcg-${code.toLowerCase()}`;

// The invite link for a code, from the current page's address.
export function inviteLink(href, code) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.toString();
}
