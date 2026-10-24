// The AI opponent. It reads only what it is allowed to see (its own cards
// and public information) and returns an action for the engine to apply.
//
// On a Battle turn it lists every legal move it can pay for with Base Energy
// alone, scores each one and picks the best (ties at random). It passes only
// when nothing else is legal. Most moves are scored by trying them on a copy
// of the game; Ash's draw is scored without trying it, so the AI never peeks
// at its own Draw Pile.

import {
  applyAction, legalActions, playablePokemon, summonSpaces, alertPokemon, legalTargets,
  usablePowers, powerTargets, opponentOf, maxStrengthOf,
} from '../engine/game.js';

export function chooseAction(state, who = 'ai') {
  const legal = legalActions(state, who);
  if (legal.includes('assignTrainers')) return assignTrainers(state, who);
  if (legal.includes('mulligan')) return mulligan(state, who);
  if (legal.includes('resolveChoice')) return resolveChoice(state, who);
  if (legal.includes('pass')) return bestMove(state, who) ?? { type: 'pass', who };
  return null;
}

// --- Battle turns ----------------------------------------------------------------

function candidateMoves(state, who) {
  const p = state.players[who];
  const moves = [];
  for (const { zone, space } of alertPokemon(state, who)) {
    for (const target of legalTargets(state, who, { zone, space })) {
      moves.push({ type: 'command', who, from: { zone, space }, target });
    }
  }
  // One move per distinct card and zone: spaces within a zone play the same.
  const seen = new Set();
  for (const card of playablePokemon(state, who)) {
    if (card.energyCost > p.baseEnergy) continue;
    for (const { zone, space } of summonSpaces(state, who)) {
      const key = `${card.id}:${zone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push({ type: 'playPokemon', who, uid: card.uid, zone, space });
    }
  }
  for (const zone of usablePowers(state, who)) {
    if (p.zones[zone].trainer.power.cost > p.baseEnergy) continue;
    const targets = powerTargets(state, who, zone);
    if (targets.length) targets.forEach((target) => moves.push({ type: 'usePower', who, zone, target }));
    else moves.push({ type: 'usePower', who, zone });
  }
  return moves;
}

function bestMove(state, who) {
  let best = null;
  for (const move of candidateMoves(state, who)) {
    const score = scoreMove(state, who, move) + Math.random() * 0.01;
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? null;
}

const value = (cards) => cards.reduce((sum, c) => sum + c.energyCost + c.attackValue, 0);
const newlyReleased = (before, after, who) => after.players[who].released.slice(before.players[who].released.length);

// Higher is better. Roughly, from the top:
//   1000 wins the match · 100 per enemy Trainer brought to 0 ·
//   60+ defeats an enemy Pokémon without losing ours · 40+ hits the weakest
//   enemy Trainer · 20+ plays a Pokémon (pricier, with Passive bonuses, away
//   from enemy Brock damage) · 12–25 Brock buff / Ash draw / Misty chip ·
//   5+ other attacks · -20 trades that lose the attacker for nothing.
function scoreMove(state, who, move) {
  const trainer = move.type === 'usePower' ? state.players[who].zones[move.zone].trainer : null;
  if (trainer?.id === 'ash') return 12;

  const after = applyAction({ ...state, log: [] }, move);
  if (after.winner === who) return 1000;
  const foe = opponentOf(who);
  const enemyTrainers = (s) => s.players[foe].zones.map((z) => z.trainer.strength);
  const removed = enemyTrainers(state).filter((str, i) => str > 0 && enemyTrainers(after)[i] === 0).length;
  const enemyLost = newlyReleased(state, after, foe);
  const ownLost = newlyReleased(state, after, who);
  let score = 100 * removed;

  if (move.type === 'command') {
    if (move.target.kind === 'trainer') {
      const before = state.players[foe].zones[move.target.zone].trainer.strength;
      return score + 40 + (15 - before) + (before - after.players[foe].zones[move.target.zone].trainer.strength);
    }
    if (enemyLost.length && !ownLost.length) return score + 60 + value(enemyLost);
    if (ownLost.length && !enemyLost.length) return score - 20;
    if (enemyLost.length) return score + 10 + value(enemyLost) - value(ownLost);
    const hit = state.players[foe].zones[move.target.zone].pokemon[move.target.space];
    const left = after.players[foe].zones[move.target.zone].pokemon[move.target.space];
    return score + 5 + (hit.currentStrength - left.currentStrength);
  }

  if (move.type === 'playPokemon') return score + summonScore(state, after, who, move);

  // Powers.
  if (enemyLost.length) return score + 60 + value(enemyLost);
  if (trainer.id === 'brock') {
    const target = state.players[who].zones[move.target.zone].pokemon[move.target.space];
    return score + 15 + maxStrengthOf(target);
  }
  return score + 15;
}

// Playing a Pokémon: pricier is better; Passive bonuses help; Brock damage hurts.
function summonScore(before, after, who, { uid, zone, space }) {
  const card = before.players[who].hand.find((c) => c.uid === uid);
  const placed = after.players[who].zones[zone].pokemon[space];
  if (!placed) return -50;   // defeated as it arrived
  const bonus = Object.values(placed.aura).reduce((sum, b) => sum + b.attack + b.strength, 0);
  const hurt = maxStrengthOf(placed) - placed.currentStrength;
  return 20 + 2 * card.energyCost + 3 * bonus - 8 * hurt;
}

// Ash's free summon: always take it, into the best-scoring zone.
function resolveChoice(state, who) {
  let best = null;
  const seen = new Set();
  for (const { zone, space } of summonSpaces(state, who)) {
    if (seen.has(zone)) continue;
    seen.add(zone);
    const move = { type: 'resolveChoice', who, zone, space };
    const after = applyAction({ ...state, log: [] }, move);
    const score = summonScore(state, after, who, { uid: state.pending.uid, zone, space }) + Math.random() * 0.01;
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? { type: 'resolveChoice', who };
}

// --- Setup ---------------------------------------------------------------------

// Trainer placement is random for now.
function assignTrainers(state, who) {
  const order = state.players[who].trainers.map((t) => t.uid);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { type: 'assignTrainers', who, order };
}

// Placeholder judgement: wants at least 3 Pokémon in hand. If short, it
// throws back extra copies of non-Pokémon types, keeping one of each.
function mulligan(state, who) {
  const hand = state.players[who].hand;
  const pokemon = hand.filter((c) => c.cardType === 'Pokémon').length;
  if (pokemon >= 3) return { type: 'mulligan', who, cardUids: [] };
  const seen = new Set();
  const toss = [];
  for (const card of hand) {
    if (card.cardType === 'Pokémon') continue;
    if (seen.has(card.cardType)) toss.push(card.uid);
    else seen.add(card.cardType);
  }
  return { type: 'mulligan', who, cardUids: toss };
}
