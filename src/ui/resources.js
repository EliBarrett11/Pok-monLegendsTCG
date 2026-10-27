// What the resource displays show, worked out from a player's numbers.
// Pure functions (no DOM), so tests can check them; render.js draws them.

import { baseEnergyFor, EXERT_LIMIT } from '../engine/energy.js';
import { BAG_SIZE } from '../engine/game.js';

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

// --- The resource panels (Feedback batch 2) ---------------------------------------------
//
// What a player's resource panel shows, section by section: Energy, Exert,
// XP, PokéDollars, Growth (Grass G1) and the Bag. Both panels (mine along the bottom, the
// opponent's compact along the top) draw from this.

export function panelView(state, who) {
  const p = state.players[who];
  const round = state.round ?? 0;
  const max = baseEnergyFor(round);
  const pips = exertSlots(p).map((x, i) => (x.kind === 'free' ? { state: 'ready' }
    : x.kind === 'stone' ? { state: 'exhausted', breakfasts: Math.max(1, x.recoversRound - round), recoversRound: x.recoversRound }
      : { state: 'locked', unlocksRound: i + 1 }));
  const ready = pips.filter((x) => x.state === 'ready').length;
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const item = p.bag[i];
    return item ? { uid: item.uid, name: item.name, item, inDelivery: Boolean(item.inDelivery) } : null;
  });
  const delivery = slots.filter((s) => s?.inDelivery).length;
  return {
    energy: {
      value: p.baseEnergy, max,
      tip: `Base Energy: ${p.baseEnergy} left of this Round's ${max}. Spent first on costs; it resets every Breakfast.`,
    },
    exert: {
      ready, max: p.exertMax, pips,
      tip: 'Exert: extra Energy, used only once Base Energy runs out; each point used is Exhausted for a few Breakfasts.',
    },
    xp: { value: p.xp, tip: `XP: ${p.xp}. Spent in the XP step at Breakfast to raise a Pokémon's stats.` },
    dollars: { value: p.dollars, tip: `PokéDollars: $${p.dollars}. Buy Items from your hand or the PokéMart with Open Bag.` },
    growth: { value: p.growth ?? 0, tip: `Growth: ${p.growth ?? 0}. Gained from card effects (and ☀ Sun 4); 1 Growth pays for 1 Energy of an Evolve cost. Kept between Rounds.` },
    bag: {
      count: p.bag.length, size: BAG_SIZE, full: p.bag.length >= BAG_SIZE, slots,
      tip: `Bag: ${p.bag.length} of ${BAG_SIZE} Items${delivery ? `, ${delivery} In Delivery (arriving next Round)` : ''}. Use one with Open Bag.`,
    },
  };
}

// What one Exert pip says when hovered.
export function pipTip(pip) {
  if (pip.state === 'ready') return 'Ready to use';
  if (pip.state === 'exhausted') return `Exhausted: recovers in ${pip.breakfasts} Breakfast${pip.breakfasts === 1 ? '' : 's'} (Round ${pip.recoversRound})`;
  return `Locked until Round ${pip.unlocksRound}`;
}

// --- The PokéMart ---------------------------------------------------------------------------
//
// The three Items on sale, and for each whether this player can buy it now
// and, if not, why. Buying there is the Open Bag Action, so only on your own
// turn in the Battle Phase; the Item arrives In Delivery at the next Breakfast.

export function martView(state, who = 'player') {
  const p = state.players[who];
  const mart = state.mart ?? { deck: [], onSale: [null, null, null] };
  const open = (state.round ?? 0) >= 1;
  const myTurn = state.phase === 'battle' && state.turn === who && !state.pending;
  const full = p.bag.length >= BAG_SIZE;
  const slots = mart.onSale.map((item, slot) => {
    if (!item) return { slot, item: null, sold: open, label: open ? 'Sold' : 'Opens in Round 1' };
    let reason = null;
    if (!myTurn) reason = 'Only on your turn in the Battle Phase';
    else if (full) reason = 'Bag full';
    else if (item.cost > p.dollars) reason = `Need $${item.cost}: you have $${p.dollars}`;
    return { slot, item, sold: false, price: item.cost, canBuy: !reason, reason, note: reason ?? 'Goes to your Bag, In Delivery' };
  });
  return {
    open,
    onSale: mart.onSale.filter(Boolean).length,
    inStock: mart.deck.length,
    slots,
    dollars: p.dollars,
    bagCount: p.bag.length,
    bagSize: BAG_SIZE,
    canBuyAny: slots.some((s) => s.canBuy),
  };
}

// --- The end of the match -----------------------------------------------------------------
//
// The end screen's numbers, from the finished match: who won, Rounds played,
// and for each side the damage dealt to enemy Trainers, the enemy Pokémon it
// defeated (and its own it lost), and the cards it played.
export function matchStats(state) {
  const s = state.stats ?? {};
  const side = (who) => {
    const foe = who === 'player' ? 'ai' : 'player';
    return {
      trainerDamage: s[who]?.trainerDamage ?? 0,
      defeated: s[foe]?.pokemonLost ?? 0,
      lost: s[who]?.pokemonLost ?? 0,
      cardsPlayed: s[who]?.cardsPlayed ?? 0,
    };
  };
  return {
    winner: state.winner ?? null,
    result: state.winner === 'player' ? 'victory' : state.winner === 'ai' ? 'defeat' : 'draw',
    rounds: state.round,
    deck: { player: state.players.player.deck, ai: state.players.ai.deck },
    player: side('player'),
    ai: side('ai'),
  };
}
