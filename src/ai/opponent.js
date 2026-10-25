// The AI opponent. It reads only what it is allowed to see (its own cards
// and public information) and returns an action for the engine to apply.
//
// On a Battle turn it lists every legal move it can pay for with Base Energy
// alone, scores each one and Pass too, and picks the best (ties at random).
// Most moves are scored by trying them on a copy
// of the game; draws (Ash, Quickdraw) are scored without trying them, so the
// AI never peeks at its own Draw Pile.

import {
  applyAction, legalActions, playablePokemon, summonSpaces, alertPokemon, legalTargets,
  usablePowers, powerTargets, playableStrategies, strategyTargets, opponentOf, maxStrengthOf, attackOf,
  playableSupporters, supporterTargets, giftMet, playableLocations, locationSpaces,
  openBagOptions, itemTargets, passEndsPhase, PASS_ENERGY, passSpends, summonCost,
} from '../engine/game.js';
import { baseEnergyFor } from '../engine/energy.js';
import { cardAt } from '../engine/board.js';
import { keywordAmount, afterShell } from '../engine/keywords.js';
import { statusCount } from '../engine/status.js';

// Where the AI's random choices come from. Tests pass a seeded generator
// so AI-vs-AI matches replay exactly.
let random = Math.random;

export function chooseAction(state, who = 'ai', { rng = Math.random } = {}) {
  random = rng;
  const legal = legalActions(state, who);
  if (legal.includes('assignTrainers')) return assignTrainers(state, who);
  if (legal.includes('mulligan')) return mulligan(state, who);
  if (legal.includes('spendXp')) return spendXp(state, who);
  if (legal.includes('resolveChoice')) return resolveChoice(state, who);
  if (legal.includes('pass')) return bestMove(state, who);
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
    for (const { zone, space } of summonSpaces(state, who)) {
      const key = `${card.id}:${zone}`;
      if (seen.has(key) || summonCost(state, who, card, zone) > p.baseEnergy) continue;
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
  // Strategy Cards. Recover only on its own damaged cards; Hypervoice is only
  // playable when the opponent has Pokémon.
  const seenStrategy = new Set();
  for (const card of playableStrategies(state, who)) {
    if (card.energyCost > p.baseEnergy || seenStrategy.has(card.id)) continue;
    seenStrategy.add(card.id);
    const targets = strategyTargets(state, who, card.uid).filter((t) => card.id !== 'recover' || t.owner === who);
    if (targets.length) targets.forEach((target) => moves.push({ type: 'playStrategy', who, uid: card.uid, target }));
    else if (!card.effects.some((e) => e.target?.mode === 'targeted')) moves.push({ type: 'playStrategy', who, uid: card.uid });
  }
  // Supporters: one payment each (random cards, but meeting the Gift when it can).
  const seenSupporter = new Set();
  for (const card of playableSupporters(state, who)) {
    if (seenSupporter.has(card.id)) continue;
    seenSupporter.add(card.id);
    const payment = choosePayment(state, who, card);
    const targets = supporterTargets(state, who, card.uid);
    const move = { type: 'playSupporter', who, uid: card.uid, ...payment };
    if (targets.length) targets.forEach((target) => moves.push({ ...move, target }));
    else if (!card.effects.some((e) => e.target?.mode === 'targeted')) moves.push(move);
  }
  moves.push(...bagMoves(state, who));
  // Locations: only into empty Location spaces; it never replaces one.
  const seenLocation = new Set();
  for (const card of playableLocations(state, who)) {
    if (seenLocation.has(card.id)) continue;
    seenLocation.add(card.id);
    for (const zone of locationSpaces(state, who)) {
      if (!p.zones[zone].location) moves.push({ type: 'playLocation', who, uid: card.uid, zone });
    }
  }
  return moves;
}

// Open Bag. Bought from hand: used straight away if it has a target, else
// stored. The PokéMart: only sometimes, when there is room. Held Items go on
// a random Pokémon of its own in the arena, preferring one without an Item.
function bagMoves(state, who) {
  const p = state.players[who];
  const moves = [];
  const itemOf = (opt) => (opt.mode === 'buyHand' ? p.hand : p.bag).find((i) => i.uid === opt.uid);
  const targetFor = (item) => {
    const options = itemTargets(state, who, item).filter((r) => r.kind !== 'hand');
    if (item.itemType !== 'Held') return options;
    const bare = options.filter((r) => !state.players[who].zones[r.zone].pokemon[r.space].heldItem);
    const pool = bare.length ? bare : options;
    return pool.length ? [pool[Math.floor(random() * pool.length)]] : [];
  };
  const opts = openBagOptions(state, who);
  for (const opt of opts) {
    if (opt.mode === 'buyMart') {
      if (random() < 0.3) moves.push({ type: 'openBag', who, ...opt });
      continue;
    }
    const item = itemOf(opt);
    if (opt.then === 'store') {
      // Store only what it can't use straight away.
      if (!opts.some((o) => o.uid === opt.uid && o.then === 'use') || !targetFor(item).length) moves.push({ type: 'openBag', who, ...opt });
      continue;
    }
    const needsTarget = item.effects.some((e) => e.target?.mode === 'targeted');
    if (!needsTarget) { moves.push({ type: 'openBag', who, ...opt }); continue; }
    for (const target of targetFor(item)) moves.push({ type: 'openBag', who, ...opt, target });
  }
  return moves;
}

// Open Bag scores: what using the Item gains, a little for storing or buying ahead.
function bagScore(state, who, move) {
  const p = state.players[who];
  if (move.mode === 'buyMart') return 4;
  if (move.then === 'store') return 5;
  const item = (move.mode === 'buyHand' ? p.hand : p.bag).find((i) => i.uid === move.uid);
  const price = move.mode === 'buyHand' ? item.cost / 2 : 0;
  if (item.id === 'miracle-seed') {
    const wants = p.hand.some((c) => (c.cardType === 'Pokémon' || c.cardType === 'Strategy')
      && c.energyCost > p.baseEnergy && c.energyCost <= p.baseEnergy + 2);
    return (wants ? 14 : 3) - price;
  }
  const after = applyAction({ ...state, log: [] }, move);
  const mine = (s) => s.players[who].zones.flatMap((z) => z.pokemon).filter(Boolean);
  const stats = (s) => mine(s).reduce((sum, c) => sum + attackOf(c) + maxStrengthOf(c) + c.currentStrength, 0);
  const gained = stats(after) - stats(state);
  const readied = mine(state).filter((c) => c.spent).length - mine(after).filter((c) => c.spent).length;
  const special = item.itemType === 'Held' && !item.held.attack && !item.held.strength ? 6 : 0;   // Oran Berry, Amulet Coin
  return 6 + 2 * gained + 8 * readied + special - price;
}

// Random cards from hand (not the Supporter), with one that meets the Gift
// Challenge first if there is one; it fills a Discard slot before a Release slot.
function choosePayment(state, who, card) {
  const others = state.players[who].hand.filter((c) => c.uid !== card.uid);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const gifted = others.findIndex((c) => giftMet(card, [c]));
  if (gifted > 0) others.unshift(...others.splice(gifted, 1));
  const { discard, release } = card.cardCost;
  const uids = others.map((c) => c.uid);
  return discard
    ? { discard: uids.slice(0, discard), release: uids.slice(discard, discard + release) }
    : { discard: [], release: uids.slice(0, release) };
}

function bestMove(state, who) {
  let best = { move: { type: 'pass', who }, score: passScore(state, who) + random() * 0.01 };
  for (const move of candidateMoves(state, who)) {
    const score = scoreMove(state, who, move) + random() * 0.01;
    if (score > best.score) best = { move, score };
  }
  return best.move;
}

// Passing. The Pass that ends the phase gains nothing, so (as before the
// Pass gave Energy) it is only a last resort, when no other move is legal:
// any move, even a losing trade, keeps a stalemate from going on forever.
// Any other Pass gains +1 Base Energy: a little for that,
// plus the best move the extra Energy would make affordable (scored the same
// way as every move), weighed by the chance the opponent passes straight
// back and ends the phase before it can be used.
function passScore(state, who) {
  if (passEndsPhase(state)) return -Infinity;
  const p = state.players[who];
  const richer = { ...state, players: { ...state.players, [who]: { ...p, baseEnergy: p.baseEnergy + PASS_ENERGY } } };
  const now = new Set(candidateMoves(state, who).map((m) => JSON.stringify(m)));
  let enabled = 0;
  for (const move of candidateMoves(richer, who)) {
    if (!now.has(JSON.stringify(move))) enabled = Math.max(enabled, scoreMove(richer, who, move));
  }
  return 2 + (1 - passBackRisk(state, who)) * enabled - spentCost(state, who);
}

// Unmatched speed: a Pass would make these Pokémon Spent, so it gives up the
// best attack each could have made this Round (scored like any attack).
function spentCost(state, who) {
  let lost = 0;
  for (const ref of passSpends(state, who)) {
    const from = { zone: ref.zone, space: ref.space };
    const scores = legalTargets(state, who, from).map((target) => scoreMove(state, who, { type: 'command', who, from, target }));
    if (scores.length) lost += Math.max(0, ...scores);
  }
  return lost;
}

// How likely the opponent is to pass straight back, from what it can see:
// unlikely with an Alert Pokémon to attack with, likelier with only cards
// and Energy, very likely with neither.
function passBackRisk(state, who) {
  const foe = opponentOf(who);
  const f = state.players[foe];
  if (alertPokemon(state, foe).length) return 0.25;
  if (f.hand.length && f.baseEnergy + f.exertMax - f.exhaust.length > 0) return 0.5;
  return 0.9;
}

// Damage Burn will still deal over the coming Suppers (Burn 3: 3 + 2 + 1),
// each hit reduced by Shell, up to what the card has left.
function burnAhead(card) {
  let total = 0;
  for (let b = statusCount(card, 'burn'); b > 0; b--) total += afterShell(card, b);
  const left = card.cardType === 'Trainer' ? card.strength : card.currentStrength;
  return Math.min(total, Math.max(0, left));
}

// Burn pressure on a side: future Burn damage, Trainers counting 3× (it goes
// straight towards winning), Pokémon 1×.
function burnPressure(s, side) {
  let sum = 0;
  for (const z of s.players[side].zones) {
    if (z.trainer?.strength > 0) sum += 3 * burnAhead(z.trainer);
    for (const c of z.pokemon) if (c) sum += burnAhead(c);
  }
  return sum;
}

const value = (cards) => cards.reduce((sum, c) => sum + (c.energyCost ?? 0) + (c.attackValue ?? 0), 0);
// Pokémon newly in the Released Pile (defeated), not other Released cards.
const newlyReleased = (before, after, who) => after.players[who].released.slice(before.players[who].released.length)
  .filter((c) => c.cardType === 'Pokémon');

// Higher is better. Roughly, from the top:
//   1000 wins the match · 100 per enemy Trainer brought to 0 ·
//   60+ defeats an enemy Pokémon without losing ours · 40+ hits the weakest
//   enemy Trainer · 20+ plays a Pokémon (pricier, with Passive bonuses, away
//   from enemy Brock damage) · 12–25 Brock buff / Ash draw / Misty chip ·
//   5+ other attacks · -20 trades that lose the attacker for nothing.
function scoreMove(state, who, move) {
  const trainer = move.type === 'usePower' ? state.players[who].zones[move.zone].trainer : null;
  if (trainer?.id === 'ash') return 12;
  const strategy = move.type === 'playStrategy' ? state.players[who].hand.find((c) => c.uid === move.uid) : null;
  if (strategy?.id === 'quickdraw') return 16;
  // Search is like a draw: scored without trying it, so it never sees its own Draw Pile.
  if (strategy?.effects.some((e) => e.op === 'search')) return 16;
  // Retain on a card in hand: worth what keeping that card is worth.
  if (strategy && move.target?.kind === 'hand' && strategy.effects.some((e) => e.op === 'retain')) {
    return 6 + keepValue(state, who, state.players[who].hand.find((c) => c.uid === move.target.uid));
  }
  const supporter = move.type === 'playSupporter' ? state.players[who].hand.find((c) => c.uid === move.uid) : null;
  if (supporter) return supporterScore(state, who, move, supporter);
  if (move.type === 'playLocation') return locationScore(state, who, move);
  if (move.type === 'openBag') return bagScore(state, who, move);

  const after = applyAction({ ...state, log: [] }, move);
  if (after.winner === who) return 1000;
  const foe = opponentOf(who);
  const enemyTrainers = (s) => s.players[foe].zones.map((z) => z.trainer.strength);
  const removed = enemyTrainers(state).filter((str, i) => str > 0 && enemyTrainers(after)[i] === 0).length;
  const enemyLost = newlyReleased(state, after, foe);
  const ownLost = newlyReleased(state, after, who);
  let score = 100 * removed + 5 * (after.players[who].xp - state.players[who].xp);   // quests completed
  // Burn: future damage on the enemy is worth having (on Trainers most), on its own cards worth removing.
  score += (burnPressure(after, foe) - burnPressure(state, foe)) - (burnPressure(after, who) - burnPressure(state, who));
  // Enemy Trainer Strength lost other than by attacking the Trainer directly (Overrun, effects).
  if (move.target?.kind !== 'trainer' || move.type !== 'command') {
    const total = (s) => s.players[foe].zones.reduce((sum, z) => sum + Math.max(0, z.trainer.strength), 0);
    score += 3 * (total(state) - total(after));
  }

  if (move.type === 'command') {
    if (move.target.kind === 'trainer') {
      const before = state.players[foe].zones[move.target.zone].trainer.strength;
      return score + 40 + (15 - before) + (before - after.players[foe].zones[move.target.zone].trainer.strength);
    }
    if (enemyLost.length && !ownLost.length) return score + 60 + value(enemyLost);
    if (ownLost.length && !enemyLost.length) return score - 20;
    if (enemyLost.length) return score + 10 + value(enemyLost) - value(ownLost);
    // Chip damage: worth less on a target that will Regenerate it back (Shell is
    // already in the damage the try dealt).
    const hit = state.players[foe].zones[move.target.zone].pokemon[move.target.space];
    const left = after.players[foe].zones[move.target.zone].pokemon[move.target.space];
    const dealt = hit.currentStrength - left.currentStrength;
    return score + 5 + dealt - Math.min(dealt, keywordAmount(hit, 'Regenerate'));
  }

  if (move.type === 'playPokemon') return score + summonScore(state, after, who, move);

  if (strategy?.id === 'hypervoice') {
    // Damage actually dealt: Strength lost by each enemy Pokémon (all of it if defeated).
    let dealt = 0;
    state.players[foe].zones.forEach((z, zone) => z.pokemon.forEach((c, space) => {
      if (c) dealt += c.currentStrength - Math.max(0, after.players[foe].zones[zone].pokemon[space]?.currentStrength ?? 0);
    }));
    return score + 10 + 4 * dealt + (enemyLost.length ? 30 + value(enemyLost) : 0);
  }
  if (strategy?.id === 'recover') {
    const strengthAt = (s) => {
      const z = s.players[who].zones[move.target.zone];
      return move.target.kind === 'trainer' ? z.trainer.strength : z.pokemon[move.target.space].currentStrength;
    };
    const healed = strengthAt(after) - strengthAt(state);
    const trainerInDanger = move.target.kind === 'trainer' && strengthAt(state) <= 6 ? 15 : 0;
    return score + 8 + 3 * healed + trainerInDanger;
  }

  // Powers.
  if (enemyLost.length) return score + 60 + value(enemyLost);
  if (trainer?.id === 'brock') {
    const target = state.players[who].zones[move.target.zone].pokemon[move.target.space];
    return score + 15 + maxStrengthOf(target);
  }
  return score + 15;
}

// Locations: worth more for more XP, and a zone-tied quest more where it
// already has Pokémon to complete it.
function locationScore(state, who, { uid, zone }) {
  const p = state.players[who];
  const card = p.hand.find((c) => c.uid === uid);
  const here = p.zones[zone].pokemon.filter(Boolean).length;
  return 14 + 2 * card.xp + (card.quest.inZone ? 3 * here : 0);
}

// Breakfast XP: all of it on the cheapest Pokémon in hand it can afford this
// Round with Base Energy, each point Attack or Strength at random. With no
// affordable Pokémon it keeps the XP.
function spendXp(state, who) {
  const p = state.players[who];
  const affordable = p.hand.filter((c) => c.cardType === 'Pokémon' && c.energyCost <= p.baseEnergy);
  if (!affordable.length) return { type: 'spendXp', who, spend: [] };
  const cheapest = Math.min(...affordable.map((c) => c.energyCost));
  const options = affordable.filter((c) => c.energyCost === cheapest);
  const card = options[Math.floor(random() * options.length)];
  const spend = Array.from({ length: p.xp }, () => ({ uid: card.uid, stat: random() < 0.5 ? 'attack' : 'strength' }));
  return { type: 'spendXp', who, spend };
}

// Supporters cost cards: each paid card counts against it (a released one more).
function supporterScore(state, who, move, card) {
  const paid = state.players[who].hand.filter((c) => [...move.discard, ...move.release].includes(c.uid));
  const cost = 2 * move.discard.length + 4 * move.release.length;
  const gift = giftMet(card, paid);
  if (card.id === 'tracey') return 14 + (gift ? 5 : 0) - cost;   // a draw: not tried, no peeking
  if ([...card.effects, ...(card.gift?.effects ?? [])].some((e) => e.op === 'search')) return 14 + (gift ? 5 : 0) - cost;
  const after = applyAction({ ...state, log: [] }, move);
  const mine = (s) => s.players[who].zones.flatMap((z) => z.pokemon).filter(Boolean);
  const stats = (s) => mine(s).reduce((sum, c) => sum + attackOf(c) + maxStrengthOf(c) + c.currentStrength, 0);
  const trainers = (s) => s.players[who].zones.reduce((sum, z) => sum + z.trainer.strength, 0);
  const gained = (stats(after) - stats(state)) + (trainers(after) - trainers(state));
  const danger = move.target?.kind === 'trainer' && state.players[who].zones[move.target.zone].trainer.strength <= 6 ? 15 : 0;
  return 6 + 2 * gained + danger - cost;
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

// How much a card is worth keeping in hand for next Round: most for a
// Pokémon (or Strategy Card) it can't afford now but can next Round, the
// pricier the better; then anything it could afford next Round.
function keepValue(state, who, card) {
  if (!card) return 0;
  const p = state.players[who];
  const cost = card.energyCost ?? 0;
  const next = baseEnergyFor(state.round + 1);
  if (card.cardType !== 'Pokémon' && card.cardType !== 'Strategy') return 1;
  if (cost > next) return 2;
  return (cost > p.baseEnergy ? 10 : 4) + cost;
}

// Search and Return: the strongest card it could afford next Round (a
// pricier Pokémon first, then Attack + Strength); if none, the cheapest.
function pickValue(state, card) {
  const next = baseEnergyFor(state.round + 1);
  const cost = card.energyCost ?? 0;
  const body = (card.attackValue ?? 0) + (card.strengthValue ?? 0);
  return cost <= next ? 100 + 10 * cost + body : -cost;
}

function pickCards(state, who) {
  const { options, max, from } = state.pending;
  const p = state.players[who];
  const pile = from === 'draw' ? p.drawPile : from === 'discard' ? p.discard : p.hand;
  const cards = options.map((uid) => pile.find((c) => c.uid === uid));
  // A free summon: the strongest Pokémon that fits (highest printed cost, then stats).
  const value = from === 'hand' ? (c) => 10 * c.energyCost + c.attackValue + c.strengthValue : (c) => pickValue(state, c);
  cards.sort((a, b) => value(b) - value(a) || random() - 0.5);
  return { type: 'resolveChoice', who, uids: cards.slice(0, max).map((c) => c.uid) };
}

// Choices mid-resolution: an ability's target is a random legal one (Retain:
// the card most worth keeping); Search, Return and free summons pick the
// strongest cards; a free summon is always taken, into the best-scoring zone.
function resolveChoice(state, who) {
  if (state.pending.kind === 'pick') return pickCards(state, who);
  if (state.pending.kind === 'target') {
    const options = state.pending.options;
    if (state.pending.op === 'retain') {
      const best = [...options].sort((a, b) => keepValue(state, who, cardAt(state, b)) - keepValue(state, who, cardAt(state, a)))[0];
      return { type: 'resolveChoice', who, target: best };
    }
    return { type: 'resolveChoice', who, target: options[Math.floor(random() * options.length)] };
  }
  let best = null;
  const seen = new Set();
  for (const { zone, space } of summonSpaces(state, who)) {
    if (seen.has(zone)) continue;
    seen.add(zone);
    const move = { type: 'resolveChoice', who, zone, space };
    const after = applyAction({ ...state, log: [] }, move);
    const score = summonScore(state, after, who, { uid: state.pending.uid, zone, space }) + random() * 0.01;
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? { type: 'resolveChoice', who };
}

// --- Setup ---------------------------------------------------------------------

// Trainer placement is random for now.
function assignTrainers(state, who) {
  const order = state.players[who].trainers.map((t) => t.uid);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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
