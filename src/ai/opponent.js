// The AI opponent. It reads only what it is allowed to see (its own cards
// and public information) and returns an action for the engine to apply.
//
// On a Battle turn it lists every legal move it can pay for with Base Energy
// alone, scores each one and Pass too, and picks the best (ties at random).
// Most moves are scored by trying them on a copy
// of the game; draws and Searches are scored without trying them, so the
// AI never peeks at its own Draw Pile.

import {
  applyAction, legalActions, playablePokemon, summonSpaces, alertPokemon, legalTargets,
  usablePowers, powerTargets, playableStrategies, strategyTargets, opponentOf, maxStrengthOf, attackOf,
  playableSupporters, supporterTargets, giftMet, playableLocations, locationSpaces,
  openBagOptions, itemTargets, passEndsPhase, PASS_ENERGY, passSpends, summonCost, evolveOptions, isEvolution,
  breakfastEvolveOptions,
} from '../engine/game.js';
import { POKEMON_CARDS } from '../engine/cardData.js';
import { baseEnergyFor } from '../engine/energy.js';
import { cardAt } from '../engine/board.js';
import { keywordAmount, afterShell, keywordList } from '../engine/keywords.js';
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
  if (legal.includes('breakfastEvolve')) return breakfastEvolves(state, who);
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
  // Evolve: two ways to pay, as much Growth as it has, or as much Base Energy
  // (keeping Growth for Solar Beam); never Exert. Scoring picks.
  const seenEvolve = new Set();
  for (const opt of evolveOptions(state, who)) {
    const key = `${p.hand.find((c) => c.uid === opt.uid).id}:${opt.zone}:${opt.space}`;
    if (seenEvolve.has(key)) continue;
    seenEvolve.add(key);
    const leastGrowth = Math.max(opt.minGrowth, opt.cost - p.baseEnergy);
    for (const growth of new Set([opt.maxGrowth, leastGrowth])) {
      if (growth <= opt.maxGrowth && opt.cost - growth <= p.baseEnergy) moves.push({ type: 'evolve', who, uid: opt.uid, zone: opt.zone, space: opt.space, growth });
    }
  }
  for (const zone of usablePowers(state, who)) {
    if (p.zones[zone].trainer.power.cost > p.baseEnergy) continue;
    const targets = powerTargets(state, who, zone);
    if (targets.length) targets.forEach((target) => moves.push({ type: 'usePower', who, zone, target }));
    else moves.push({ type: 'usePower', who, zone });
  }
  // Strategy Cards: one try per legal target (each card says which side it targets).
  const seenStrategy = new Set();
  for (const card of playableStrategies(state, who)) {
    if (card.energyCost > p.baseEnergy || seenStrategy.has(card.id)) continue;
    seenStrategy.add(card.id);
    const targets = strategyTargets(state, who, card.uid);
    // A card that spends Growth (Solar Beam): all it has, up to its limit.
    const spend = card.spendsGrowth ? { growth: Math.min(card.spendsGrowth, p.growth ?? 0) } : {};
    if (targets.length) targets.forEach((target) => moves.push({ type: 'playStrategy', who, uid: card.uid, target, ...spend }));
    else if (!card.effects.some((e) => e.target?.mode === 'targeted' && !e.target.optional)) moves.push({ type: 'playStrategy', who, uid: card.uid });
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
  const after = applyAction({ ...state, log: [] }, move);
  // A Speed-Tier raise (Quick Claw) isn't in the stats: a little extra for it.
  const special = item.itemType === 'Held' && item.held.speedUp ? 6 : 0;
  return 6 + evaluate(state, after, who) + special - price;
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

// Each deck's plan, as weights on the general scoring (1 = as is):
//   trainers  enemy Trainer Strength lost (attacks, Overrun, effects)
//   strike    the bonus for attacking a Trainer directly
//   trades    attacks on enemy Pokémon (defeats, trades, chip damage)
//   burn / douse  Burn on the enemy / removed from its own cards
//   overrun, heal, board, keep, zone  Overrun gained, healing, stats gained,
//             its own Pokémon lost, summoning beside friendly Pokémon
//   growth    each Growth gained (spent counts against it)
//   status    Sleep and Leech Seed on the enemy (Sleep by the Attack it stops, a seed
//             by how long its Pokémon will last), and on its own cards worth curing
//   evolve, basics  the bonus for Evolving, and for summoning a Basic it can still evolve
//   beamAt    Solar Beam is held (it has Retain) until it spends this much Growth,
//             unless it brings an enemy Trainer to 0
//   Fire (Aggressive · Burn): push damage onto Trainers, spread Burn, use Overrun.
//   Water (Board-Based · Value-Midrange): build Zones, heal, Douse its own Burn,
//   grow and hold its board.
//   Grass (Combo · Engine): bank Growth, set up Basics early and keep them alive,
//   Evolve whenever it can, hold Solar Beam for a big hit, Sleep and Leech Seed.
const NO_PLAN = {
  trainers: 1, strike: 1, trades: 1, burn: 1, douse: 1, overrun: 0, heal: 1, board: 1, keep: 1, zone: 0,
  growth: 0.5, status: 1, evolve: 0, basics: 0, beamAt: 0,
};
const PLANS = {
  fire: { ...NO_PLAN, trainers: 1.5, burn: 1.5, overrun: 6 },
  water: { ...NO_PLAN, douse: 1.6, heal: 1.7, board: 1.3, keep: 1.4, zone: 3 },
  grass: { ...NO_PLAN, growth: 2, status: 1.5, evolve: 12, basics: 8, keep: 1.5, beamAt: 6 },
};
// Alternative plans, off unless chosen with usePlan() (for balance experiments).
//   fire 'pressure': Trainer damage worth double (trainers 1.5 → 3, and the
//   direct-attack bonus ×2), attacks on Pokémon worth half.
//   grass 'none': no Grass plan (the general weights), to see what the plan itself adds.
const PLAN_VARIANTS = {
  fire: { pressure: { ...PLANS.fire, trainers: 3, strike: 2, trades: 0.5 } },
  grass: { none: NO_PLAN },
};
let plans = { ...PLANS };
export function usePlan(deck, name = 'default') {
  const plan = name === 'default' ? PLANS[deck] : PLAN_VARIANTS[deck]?.[name];
  if (!plan) throw new Error(`Unknown AI plan: ${deck} ${name}`);
  plans = { ...plans, [deck]: plan };
}
const planOf = (s, who) => plans[s.players[who].deck] ?? NO_PLAN;

// Burn's change: on the enemy, worth having; on its own cards, worth removing (Douse).
function burnScore(before, after, who) {
  const plan = planOf(before, who);
  const foe = opponentOf(who);
  return plan.burn * (burnPressure(after, foe) - burnPressure(before, foe)) - plan.douse * (burnPressure(after, who) - burnPressure(before, who));
}

const value = (cards) => cards.reduce((sum, c) => sum + (c.energyCost ?? c.evolveCost ?? 0) + (c.attackValue ?? 0), 0);

// Sleep and Leech Seed on a side's Pokémon, in score points: a sleeping one by
// the Attack it can't use (the biggest threat most), a seeded one by how long
// it will keep draining (its Strength, up to 6).
function statusValue(s, side) {
  let sum = 0;
  for (const z of s.players[side].zones) {
    for (const c of z.pokemon) {
      if (!c) continue;
      if (c.status?.sleep) sum += 3 * attackOf(c);
      if (c.status?.leechSeed) sum += 3 + Math.min(6, c.currentStrength);
    }
  }
  return sum;
}
// Pokémon newly in the Released Pile (defeated), not other Released cards.
const newlyReleased = (before, after, who) => after.players[who].released.slice(before.players[who].released.length)
  .filter((c) => c.cardType === 'Pokémon');

// What a move changed, from `who`'s side, for moves scored by trying them:
// damage dealt and Pokémon defeated, Trainer Strength taken or healed,
// healing, stats and keywords gained, Pokémon readied, Burn pressure, cards
// gained in hand, PokéDollars and XP. (Attacks and summons add their own terms.)
function evaluate(before, after, who) {
  const foe = opponentOf(who);
  const arena = (s, side) => s.players[side].zones.flatMap((z) => z.pokemon).filter(Boolean);
  const trainerTotal = (s, side) => s.players[side].zones.reduce((sum, z) => sum + Math.max(0, z.trainer.strength), 0);
  const health = (s, side) => arena(s, side).reduce((sum, c) => sum + Math.max(0, c.currentStrength), 0);
  const stats = (s, side) => arena(s, side).reduce((sum, c) => sum + attackOf(c) + maxStrengthOf(c), 0);
  const keywords = (s, side) => arena(s, side).reduce((sum, c) => sum + keywordList(c).length, 0);
  const overruns = (s, side) => arena(s, side).filter((c) => keywordList(c).some((k) => k.key === 'Overrun')).length;
  const plan = planOf(before, who);
  const spent = (s, side) => arena(s, side).filter((c) => c.spent).length;
  const enemyLost = newlyReleased(before, after, foe);
  const ownLost = newlyReleased(before, after, who);
  const healOwn = Math.max(0, health(after, who) - health(before, who) - (stats(after, who) - stats(before, who)));
  let score = 0;
  score += enemyLost.length ? 50 + value(enemyLost) : 0;
  score -= ownLost.length ? plan.keep * (25 + value(ownLost)) : 0;
  score += 3 * plan.trainers * (trainerTotal(before, foe) - trainerTotal(after, foe));
  score += 3 * Math.max(0, trainerTotal(after, who) - trainerTotal(before, who));
  score += 2 * Math.max(0, health(before, foe) - health(after, foe));
  score += 1.5 * plan.heal * healOwn;
  score += 2 * plan.board * (stats(after, who) - stats(before, who));
  score += 4 * (keywords(after, who) - keywords(before, who));
  score += plan.overrun * (overruns(after, who) - overruns(before, who));
  score += 8 * Math.max(0, spent(before, who) - spent(after, who));
  score += burnScore(before, after, who);
  score += plan.status * (statusValue(after, foe) - statusValue(before, foe)) - (statusValue(after, who) - statusValue(before, who));
  score += 2 * plan.growth * ((after.players[who].growth ?? 0) - (before.players[who].growth ?? 0));
  score += 4 * Math.max(0, after.players[who].hand.length - before.players[who].hand.length);
  score += 2 * (after.players[who].dollars - before.players[who].dollars);
  score += 5 * (after.players[who].xp - before.players[who].xp);
  return score;
}

// What a card or Power costs to use, in score points: Energy spent now.
const energyCost = (n) => 1.5 * n;

// Higher is better. Roughly, from the top:
//   1000 wins the match · 100 per enemy Trainer brought to 0 ·
//   60+ defeats an enemy Pokémon without losing ours · 40+ hits the weakest
//   enemy Trainer · 20+ plays a Pokémon (pricier, with Passive bonuses, into
//   a Zone that helps it) · cards and Powers by what trying them changes ·
//   5+ other attacks · -20 trades that lose the attacker for nothing.
function scoreMove(state, who, move) {
  const trainer = move.type === 'usePower' ? state.players[who].zones[move.zone].trainer : null;
  const strategy = move.type === 'playStrategy' ? state.players[who].hand.find((c) => c.uid === move.uid) : null;
  // Searching and drawing are scored without trying them, so it never sees its own Draw Pile.
  if (strategy?.effects.some((e) => e.op === 'search' || e.op === 'draw')) return 16 - energyCost(strategy.energyCost);
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
  const plan = planOf(state, who);
  let score = 100 * removed + 5 * (after.players[who].xp - state.players[who].xp);   // quests completed
  // Burn: future damage on the enemy is worth having (on Trainers most), on its own cards worth removing.
  score += burnScore(state, after, who);
  // Enemy Trainer Strength lost other than by attacking the Trainer directly (Overrun, effects).
  if (move.target?.kind !== 'trainer' || move.type !== 'command') {
    const total = (s) => s.players[foe].zones.reduce((sum, z) => sum + Math.max(0, z.trainer.strength), 0);
    score += 3 * plan.trainers * (total(state) - total(after));
  }

  if (move.type === 'command') {
    if (move.target.kind === 'trainer') {
      const before = state.players[foe].zones[move.target.zone].trainer.strength;
      return score + plan.strike * (40 + (15 - before)) + plan.trainers * (before - after.players[foe].zones[move.target.zone].trainer.strength);
    }
    if (enemyLost.length && !ownLost.length) return score + plan.trades * (60 + value(enemyLost));
    if (ownLost.length && !enemyLost.length) return score - 20 * plan.keep;
    if (enemyLost.length) return score + plan.trades * (10 + value(enemyLost) - value(ownLost));
    // Chip damage: worth less on a target that will Regenerate it back (Shell is
    // already in the damage the try dealt).
    const hit = state.players[foe].zones[move.target.zone].pokemon[move.target.space];
    const left = after.players[foe].zones[move.target.zone].pokemon[move.target.space];
    const dealt = hit.currentStrength - left.currentStrength;
    return score + plan.trades * (5 + dealt - Math.min(dealt, keywordAmount(hit, 'Regenerate')));
  }

  if (move.type === 'playPokemon') return score + summonScore(state, after, who, move);
  if (move.type === 'evolve') return score + evolveScore(state, after, who, move);

  // Strategy Cards and Powers: what trying them changed, less the Energy spent.
  // (Burn, Trainer damage and XP are already in `score`; evaluate counts them too,
  // so leave them out of it here.)
  const cost = strategy ? strategy.energyCost : trainer.power.cost;
  // Solar Beam: held (Retain) until it can spend enough Growth, unless it takes an enemy Trainer to 0.
  const hold = strategy?.spendsGrowth && !removed && (move.growth ?? 0) < plan.beamAt ? 60 : 0;
  return 4 + score + evaluate(state, after, who) - burnAndTrainers(state, after, who) - energyCost(cost) - hold;
}

// The part of evaluate() that scoreMove has already counted (Burn pressure,
// enemy Trainer Strength lost, XP), so a move isn't scored twice for it.
function burnAndTrainers(before, after, who) {
  const foe = opponentOf(who);
  const total = (s) => s.players[foe].zones.reduce((sum, z) => sum + Math.max(0, z.trainer.strength), 0);
  return burnScore(before, after, who) + 3 * planOf(before, who).trainers * (total(before) - total(after))
    + 5 * (after.players[who].xp - before.players[who].xp);
}

// Locations: worth more for more XP, and a zone-tied quest more where it
// already has Pokémon to complete it.
function locationScore(state, who, { uid, zone }) {
  const p = state.players[who];
  const card = p.hand.find((c) => c.uid === uid);
  const here = p.zones[zone].pokemon.filter(Boolean).length;
  return 14 + 2 * card.xp + (card.quest.inZone ? 3 * here : 0);
}

// Breakfast Evolve (a rule experiment): every Evolve it can afford with Growth
// and Base Energy (never Exert), the biggest evolution first, as much Growth as it has.
// (Only the first each Round gets the Sun 6 discount, if that rule is on: later ones cost 1 more.)
function breakfastEvolves(state, who) {
  const p = state.players[who];
  let growth = p.growth ?? 0;
  let energy = p.baseEnergy;
  const options = breakfastEvolveOptions(state, who);
  const discounted = options.some((o) => o.cost < evolveCostPrinted(p, o.uid, o.zone, state));
  const size = (o) => { const c = p.hand.find((h) => h.uid === o.uid); return c.attackValue + c.strengthValue; };
  options.sort((a, b) => size(b) - size(a) || random() - 0.5);
  const picked = [];
  const cards = new Set();
  const spaces = new Set();
  for (const o of options) {
    if (cards.has(o.uid) || spaces.has(`${o.zone}:${o.space}`)) continue;
    const cost = o.cost + (picked.length && discounted ? 1 : 0);
    const g = Math.min(growth, cost);
    if (cost - g > energy) continue;
    growth -= g;
    energy -= cost - g;
    cards.add(o.uid);
    spaces.add(`${o.zone}:${o.space}`);
    picked.push({ uid: o.uid, zone: o.zone, space: o.space, growth: g });
  }
  return { type: 'breakfastEvolve', who, evolves: picked };
}
// Its Evolve cost without the first-Evolve Weather discount (Gardenia's still counts).
function evolveCostPrinted(p, uid, zone) {
  const card = p.hand.find((h) => h.uid === uid);
  const t = p.zones[zone].trainer;
  return Math.max(0, card.evolveCost - (t && t.strength > 0 ? t.passive?.evolveCost ?? 0 : 0));
}

// Breakfast XP: all of it on the cheapest Pokémon in hand it can afford this
// Round with Base Energy, each point Attack or Strength at random. With no
// affordable Pokémon it keeps the XP.
function spendXp(state, who) {
  const p = state.players[who];
  const affordable = p.hand.filter((c) => c.cardType === 'Pokémon' && !isEvolution(c) && c.energyCost <= p.baseEnergy);
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
  // Searching and drawing: scored without trying them (no peeking at its own Draw Pile).
  if ([...card.effects, ...(card.gift?.effects ?? [])].some((e) => e.op === 'search' || e.op === 'draw')) return 14 + (gift ? 5 : 0) - cost;
  const after = applyAction({ ...state, log: [] }, move);
  const danger = move.target?.kind === 'trainer' && state.players[who].zones[move.target.zone].trainer.strength <= 6 ? 15 : 0;
  return 6 + evaluate(state, after, who) + danger - cost;
}

// Playing a Pokémon: pricier is better; Passive bonuses and keywords help;
// arriving hurt is bad. Building a Zone: more for a quest there ("Have N in
// this Zone", "Summon N into this Zone") and, for the Water plan, for joining
// friendly Pokémon (Rally, Lapras, Chansey); and what its arrival did (On
// Summon damage, healing…).
function summonScore(before, after, who, { uid, zone, space }) {
  const card = before.players[who].hand.find((c) => c.uid === uid);
  const placed = after.players[who].zones[zone].pokemon[space];
  if (!placed) return -50;   // defeated as it arrived
  const bonus = Object.values(placed.aura).reduce((sum, b) => sum + b.attack + b.strength + 3 * (b.keywords?.length ?? 0), 0);
  const hurt = maxStrengthOf(placed) - placed.currentStrength;
  const side = before.players[who].zones[zone];
  const friends = side.pokemon.filter(Boolean).length;
  const quest = ['presence', 'summon'].includes(side.location?.quest?.on) && side.location.quest.inZone ? 6 : 0;
  const zoneBuild = planOf(before, who).zone * friends + quest;
  const arrival = evaluate(before, after, who) - 2 * (attackOf(placed) + maxStrengthOf(placed));   // its own stats aside
  // The Grass plan: a Basic it can evolve later is worth setting up early.
  const basics = EVOLVES_FROM.has(card.name) ? planOf(before, who).basics : 0;
  return 20 + 2 * card.energyCost + 3 * bonus - 8 * hurt + zoneBuild + Math.max(0, arrival) + basics;
}

// The names of Pokémon some evolution card evolves from (Bulbasaur, Oddish, Sunkern...).
const EVOLVES_FROM = new Set(POKEMON_CARDS.map((c) => c.evolvesFrom).filter(Boolean));

// Evolving: what trying it changed (stats gained, statuses cured, its On
// Evolve), like a summon of a bigger Pokémon, less the Energy and Growth spent.
// (Growth spent counts in evaluate, by the plan's growth weight.)
function evolveScore(before, after, who) {
  const energy = before.players[who].baseEnergy - after.players[who].baseEnergy;
  return 18 + planOf(before, who).evolve + evaluate(before, after, who) - burnAndTrainers(before, after, who) - energyCost(Math.max(0, energy));
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

// Choices mid-resolution: an ability's target is the one that does the most
// when tried (Retain: the card most worth keeping); Search, Return and free
// summons pick the strongest cards; a free summon is always taken, into the
// best-scoring zone.
function resolveChoice(state, who) {
  if (state.pending.kind === 'pick') return pickCards(state, who);
  if (state.pending.kind === 'target') {
    const options = state.pending.options;
    if (state.pending.op === 'retain') {
      const best = [...options].sort((a, b) => keepValue(state, who, cardAt(state, b)) - keepValue(state, who, cardAt(state, a)))[0];
      return { type: 'resolveChoice', who, target: best };
    }
    let best = null;
    for (const target of options) {
      const move = { type: 'resolveChoice', who, target };
      const score = evaluate(state, applyAction({ ...state, log: [] }, move), who) + random() * 0.01;
      if (!best || score > best.score) best = { move, score };
    }
    return best.move;
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
