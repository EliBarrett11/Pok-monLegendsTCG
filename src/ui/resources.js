// What the resource displays show, worked out from a player's numbers.
// Pure functions (no DOM), so tests can check them; render.js draws them.

import { baseEnergyFor, EXERT_LIMIT } from '../engine/energy.js';

// Base Energy: one socket per point of this Round's Base Energy (up to 10),
// lit while unspent. Energy above that (from passing or abilities) is extra.
export function energySlots(round, baseEnergy) {
  const sockets = baseEnergyFor(round);
  return { sockets, lit: Math.min(baseEnergy, sockets), bonus: Math.max(0, baseEnergy - sockets) };
}

// Exert, socket by socket: free gems first, then Exhausted stones (soonest
// to recover first), then sockets locked above this Round's Exert maximum.
// Spending a gem turns the last free one to stone in the same socket, and the
// soonest stone is the next one to glow back.
export function exertSlots(p) {
  const free = p.exertMax - p.exhaust.length;
  const stones = [...p.exhaust].sort((a, b) => a.recoversRound - b.recoversRound || a.position - b.position);
  return [
    ...Array.from({ length: free }, () => ({ kind: 'free' })),
    ...stones.map((x) => ({ kind: 'stone', recoversRound: x.recoversRound, position: x.position })),
    ...Array.from({ length: EXERT_LIMIT - p.exertMax }, () => ({ kind: 'locked' })),
  ];
}

export const PILE_DEPTH = 9;   // most edge layers drawn under a pile's top card

// How tall a pile's stack is drawn: one edge layer per 3 cards, up to a limit.
export function pileDepth(count) {
  return count ? Math.min(PILE_DEPTH, Math.ceil(count / 3)) : 0;
}
