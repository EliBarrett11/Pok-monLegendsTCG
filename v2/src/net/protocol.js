// v2's online messages and room codes (V9). The current game's protocol (src/net/protocol.js),
// reused for its room codes and invite links, with v2's own protocol version and room ids,
// so a v2 invite can never join a current-game room or the reverse:
//   - PROTOCOL is 'v2.1' (the current game's is 1): each side's hello carries it, and a
//     different one is treated as a version mismatch, so no match ever starts across games;
//   - peerId uses the prefix 'pokemon-legends-v2-' (the current game's is 'pokemon-legends-tcg-'),
//     so a v2 room code isn't even found by the current game, and the reverse.
//
// Messages (as in the current game):
//   both   hello   { build, token? }   on connecting; builds and protocols must match
//   guest  deck    { deck }            the guest's secret deck choice ('fire' | 'water' | 'grass')
//   guest  action  { id, action }      an action the guest wants to take
//   host   lobby   { friendLocked }    the guest learns the host has chosen (not what)
//   host   start   { seq, view, logFrom, log }   both decks locked: the match begins
//   host   update  { seq, who, view, logFrom, log }   after every action, from either player
//   host   sync    { phase, … }        the state of play, for a guest (re)connecting
//   host   reject  { id, message }     the guest's action was illegal; nothing changed
//   both   rematch {} · host again {} · both leave {} · host full {}
// `view` is always viewFor(state, guest seat) without its log; the log is sent as new lines.
export { CODE_LETTERS, CODE_LENGTH, roomCode, normalizeCode, inviteLink } from '../../../src/net/protocol.js';

export const PROTOCOL = 'v2.1';
export const HOST_SEAT = 'player';
export const GUEST_SEAT = 'ai';

export const encode = (t, body = {}) => JSON.stringify({ p: PROTOCOL, t, ...body });

// A message, or null if it isn't one at all. A different protocol (the current game's 1, or
// another v2 version) comes back as { t: 'hello', otherProtocol } so the version check catches it.
export function decode(text) {
  let m;
  try {
    m = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  if (m.p !== PROTOCOL) return { t: 'hello', build: m.build ?? null, otherProtocol: m.p ?? 'unknown' };
  return m;
}

// The id on the PeerJS server: v2's own prefix (never the current game's).
export const peerId = (code) => `pokemon-legends-v2-${code.toLowerCase()}`;
