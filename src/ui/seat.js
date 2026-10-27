// Drawing the board from either seat (Multiplayer M1). No DOM.
//
// The screen always shows the viewer's side at the bottom, and its code calls
// the bottom side 'player' and the top side 'ai'. The engine's seats stay as
// they are: when the viewer sits in the engine's 'ai' seat, orient() swaps
// the two seat ids throughout the view before it is drawn, and toEngine()
// swaps them back in the actions the screen sends. Seat 'player' needs no
// swap, so a match against the AI is drawn exactly as before.
//
// The view comes from viewFor (engine/view.js), so it already holds only what
// the viewer may see, with the log and labels written for them.

import { PLAYERS } from '../engine/board.js';

// Fields that name a seat ('player' or 'ai'), anywhere in a view or action.
const SEAT_FIELDS = new Set(['who', 'owner', 'turn', 'initiative', 'winner', 'by', 'viewer']);
const swapSeat = (w) => (w === 'player' ? 'ai' : w === 'ai' ? 'player' : w);

function swapDeep(node) {
  if (Array.isArray(node)) return node.map(swapDeep);
  if (!node || typeof node !== 'object') return node;
  const keyed = PLAYERS.every((w) => w in node);   // { player: …, ai: … } (players, stats, names)
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    const k = keyed ? swapSeat(key) : key;
    out[k] = SEAT_FIELDS.has(key) && typeof value === 'string' ? swapSeat(value) : swapDeep(value);
  }
  return out;
}

// The view with the viewer as 'player' (bottom). view.seat keeps the viewer's engine seat.
export function orient(view) {
  if (!view) return view;
  const seat = view.seat ?? view.viewer ?? 'player';
  const out = seat === 'ai' ? swapDeep(view) : { ...view };
  out.viewer = 'player';
  out.seat = seat;
  return out;
}

// An action from the screen (who: 'player', targets owned 'player'/'ai') in the engine's seats.
export function toEngine(action, seat) {
  return seat === 'ai' ? swapDeep(action) : action;
}

// An engine seat as the screen names it ('player' = the viewer, at the bottom).
export const screenSeat = (who, seat) => (seat === 'ai' ? swapSeat(who) : who);
