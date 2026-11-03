// The v2 AI opponent (V1, basic). It plays only through the engine's own actions:
// it lists every legal move, tries each on a copy of the game (applyAction is pure),
// and takes the best-scoring one (ties at random). It never edits the game.
//
// Scoring, roughly:
//   1000 wins the match (reaches 60 Recognition)
//   attacks on the player character: 20 + 3 × the Recognition gained
//   defeating an enemy Pokémon without losing the attacker: 40 + its value
//   a trade that loses the attacker for nothing: −20; for a defeat: the difference
//   chip damage: 5 + the damage
//   summoning: 15 + 3 × cost (pricier first), into the lane facing the most
//   enemy pressure (a Pokémon opposite), else the middle
//   Pass: 0 (−6 if it would make its own Pokémon Spent by unmatched speed)
// Locations (V2):
//   every move also scores the objective progress it makes (its own, toward the
//   next milestone or completion, weighted by that reward) and the Recognition its
//   rewards bring
//   playing a Location: 20, + its rewards' worth, + its own Pokémon already in those
//   lanes for summon/attack/presence objectives (− the enemy's); not worth it when
//   the Championship would end it before it pays (it plays them from Round 9 only
//   when nothing else is useful)
//   summoning goes into a Location whose objective a Pokémon there helps
//   (summon/attack/presence), else as in V1
// Training (V3):
//   a summon scores by what it adds to its own board (Attack + Strength, Quick
//   Attack, Infiltrator, and any Pokémon an ability trains), not by its cost
//   waiting: a card that would be stronger in a Round or two (its cap is above its
//   Level) loses part of that difference, more if it has Retain (it stays in hand);
//   so it plays low-capped and fully trained cards first and saves the rest; from
//   the Championship on, nothing is worth saving
//   Empowered summon: tried as its own move, its bonus counted like any stats, less
//   1.5 per extra Energy
// Strategy Cards, Supporters and Items (V4): each move is tried on a copy of the game
// and scored by how much better the position is (evaluate()): Recognition, the
// board on both sides, cards in hand and in the Bag, Energy (so a higher breakpoint
// must be worth its extra Energy), statuses on both sides. It tries every
// affordable breakpoint, with each single target and the best pair; Supporters
// Release its least useful cards, or the cheapest set that meets the Favour; Items
// are used now, put in the Bag, or used from the Bag.
import {
  applyAction, legalActions, legalTargets, alertSpaces, playable, placeable, locationStarts, locationAt,
  passSpends, opponentOf, pokemonOf, pokemonIn, summonCost, targetOptions, breakpointsFor, playableStrategies,
  playableSupporters, playableItems, usableBagItems, itemUsable, bagFull, trainTop,
  playableTrainers, trainerSpaces, canMoveTrainer, usableAbilities, freeSpaces, tiersUnlocked, needsAssign,
  nurtureSpaces, championship,
} from '../engine/game.js';
import { FAVOURS } from '../engine/cardtypes.js';
import { LANES, CHAMPIONSHIP_ROUND } from '../engine/rules.js';
import { OBJECTIVES } from '../engine/locations.js';
import { pokemonAt } from '../engine/series.js';

const value = (card) => card.cost * 3 + card.attack;

// Every move it could make now.
export function moves(state, who) {
  const legal = legalActions(state, who);
  const out = [];
  if (legal.includes('flipCoin')) return [{ type: 'flipCoin' }];
  if (legal.includes('assignPoints')) return [{ type: 'assignPoints', who, points: assignPlan(state, who) }];
  // A waiting Partner arrives first (it isn't a Battle Action).
  if (legal.includes('placePartner')) {
    const card = state.players[who].waiting[0];
    return [{ type: 'placePartner', who, uid: card.uid, space: bestSpace(state, who) }];
  }
  if (legal.includes('playTrainer')) {
    const seen = new Set();
    for (const card of playableTrainers(state, who)) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      out.push({ type: 'playTrainer', who, uid: card.uid, space: bestTrainerSpace(state, who, card) });
    }
  }
  if (legal.includes('moveTrainer')) {
    for (const t of state.players[who].trainers) {
      if (tiersUnlocked(t) < 1) continue;
      const space = bestTrainerSpace(state, who, t);
      if (space !== t.space && trainerSpaceValue(state, who, t, space) - trainerSpaceValue(state, who, t, t.space) >= 2) {
        out.push({ type: 'moveTrainer', who, uid: t.uid, space });
      }
    }
  }
  // Nurture (V6): train 1 one of its Pokémon for Growth.
  if (legal.includes('nurture')) for (const space of nurtureSpaces(state, who)) out.push({ type: 'nurture', who, space });
  if (legal.includes('useAbility')) {
    for (const t of usableAbilities(state, who)) {
      const ab = t.tiers[1].ability;
      for (const targets of targetSets(state, who, ab.target, (x) => ({ type: 'useAbility', who, uid: t.uid, targets: x }), { space: t.space, lane: t.space })) {
        out.push({ type: 'useAbility', who, uid: t.uid, ...(targets ? { targets } : {}) });
      }
    }
  }
  if (legal.includes('attack')) {
    for (const from of alertSpaces(state, who)) for (const target of legalTargets(state, who, from)) out.push({ type: 'attack', who, from, target });
  }
  if (legal.includes('summon')) {
    const best = bestSpace(state, who);
    const seen = new Set();
    const energy = state.players[who].energy;
    for (const card of playable(state, who)) {
      const key = `${card.series}-${card.level}-${card.cap}`;
      if (seen.has(key)) continue;   // copies are the same move
      seen.add(key);
      // Affordable only with Wallace's discount: into his lane.
      const space = summonCost(card, false, state, who, best) <= energy ? best
        : freeSpaces(state, who).find((i) => summonCost(card, false, state, who, i) <= energy);
      if (space === undefined) continue;
      for (const targets of summonTargets(state, who, card, space)) {
        out.push({ type: 'summon', who, uid: card.uid, space, ...(targets ? { targets } : {}) });
        if (card.empower && summonCost(card, true, state, who, space) <= energy) out.push({ type: 'summon', who, uid: card.uid, space, empowered: true, ...(targets ? { targets } : {}) });
      }
    }
  }
  if (legal.includes('playStrategy')) {
    const seen = new Set();
    for (const card of playableStrategies(state, who)) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      for (const bp of breakpointsFor(state, who, card)) {
        for (const targets of targetSets(state, who, bp.target, (t) => ({ type: 'playStrategy', who, uid: card.uid, pay: bp.cost, targets: t }))) {
          out.push({ type: 'playStrategy', who, uid: card.uid, pay: bp.cost, ...(targets ? { targets } : {}) });
        }
      }
    }
  }
  if (legal.includes('playSupporter')) {
    for (const card of playableSupporters(state, who)) {
      for (const release of releaseSets(state, who, card)) {
        // The Favour may bring its own target (Mallow, Nurse Joy, Brock).
        const paid = release.map((u) => state.players[who].hand.find((c) => c.uid === u));
        const met = card.favour && paid.some((c) => FAVOURS[card.favour.condition].test(c));
        const spec = met && 'target' in card.favour ? card.favour.target : card.target;
        if (spec && spec.count !== 'all' && !spec.optional && !targetOptions(state, who, spec).length) continue;
        for (const targets of targetSets(state, who, spec, (t) => ({ type: 'playSupporter', who, uid: card.uid, release, targets: t }))) {
          out.push({ type: 'playSupporter', who, uid: card.uid, release, ...(targets ? { targets } : {}) });
        }
      }
    }
  }
  if (legal.includes('playItem')) {
    for (const card of playableItems(state, who)) {
      if (!bagFull(state, who)) out.push({ type: 'playItem', who, uid: card.uid, mode: 'bag' });
      if (itemUsable(state, who, card)) {
        for (const targets of targetSets(state, who, card.target, (t) => ({ type: 'playItem', who, uid: card.uid, mode: 'use', targets: t }))) {
          out.push({ type: 'playItem', who, uid: card.uid, mode: 'use', ...(targets ? { targets } : {}) });
        }
      }
    }
  }
  if (legal.includes('useItem')) {
    const seen = new Set();
    for (const card of usableBagItems(state, who)) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      for (const targets of targetSets(state, who, card.target, (t) => ({ type: 'useItem', who, uid: card.uid, targets: t }))) {
        out.push({ type: 'useItem', who, uid: card.uid, ...(targets ? { targets } : {}) });
      }
    }
  }
  if (legal.includes('playLocation')) {
    const seen = new Set();
    for (const card of placeable(state, who)) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      out.push({ type: 'playLocation', who, uid: card.uid, start: bestStart(state, who, card) });
    }
  }
  if (legal.includes('pass')) out.push({ type: 'pass', who });
  return out;
}

// --- Trainers (V5) ---------------------------------------------------------------------------------

// Assign Trainer Points one at a time to the Trainer closest to its next tier, so a
// tier is finished before points are spread (ties: the Trainer played first).
function assignPlan(state, who) {
  const p = state.players[who];
  const plan = {};
  const pts = Object.fromEntries(p.trainers.map((t) => [t.uid, t.points]));
  for (let i = 0; i < p.trainerPoints; i++) {
    const open = p.trainers.filter((t) => pts[t.uid] < t.tiers[2].cost);
    if (!open.length) break;
    const toNext = (t) => t.tiers.find((tier) => tier.cost > pts[t.uid]).cost - pts[t.uid];
    const t = open.sort((a, b) => toNext(a) - toNext(b))[0];
    pts[t.uid] += 1;
    plan[t.uid] = (plan[t.uid] ?? 0) + 1;
  }
  return plan;
}

// What a Trainer's Passive is worth at a space: Misty beside a Water Pokémon, Brock
// behind a strong one, Erika where a Pokémon can still train; a little for the middle.
function trainerSpaceValue(state, who, t, space) {
  const card = state.players[who].row[space];
  const pv = t.tiers[0].passive;
  let v = -Math.abs(space - (LANES - 1) / 2) * 0.1;
  if (pv.kind === 'laneStrength') v += card ? (!pv.type || card.type === pv.type ? 4 : 0) : 1;
  else if (pv.kind === 'spaceShell') v += card ? (card.attack + card.strength) / 3 : 0.5;
  else if (pv.kind === 'laneTrain') v += card ? (card.level < trainTop(card) ? 4 : 0) : 1;
  return v;
}
function bestTrainerSpace(state, who, t) {
  const spaces = trainerSpaces(state, who);
  if (t.space !== undefined) spaces.push(t.space);
  return spaces.sort((a, b) => trainerSpaceValue(state, who, t, b) - trainerSpaceValue(state, who, t, a))[0];
}

// The target choices worth trying: none (no spec, or 'all'); each single target;
// for 2, also the best two singles together (by what each does alone).
function targetSets(state, who, spec, moveFor, ctx) {
  if (!spec || spec.count === 'all' || spec.special) return [null];
  const options = targetOptions(state, who, spec, ctx);
  if (!options.length) return spec.optional ? [null] : [];
  const singles = options.map((t) => [t]);
  if (spec.count === 1 || options.length < 2) return singles;
  const scored = singles.map((t) => {
    try { return { t, v: evaluate(applyAction(state, moveFor(t)), who) }; } catch { return { t, v: -Infinity }; }
  }).sort((a, b) => b.v - a.v);
  return [...singles, [scored[0].t[0], scored[1].t[0]]];
}

// An On summon ability's targets: your Pokémon that can still train, the new one included.
function summonTargets(state, who, card, space) {
  const spec = card.ability?.onSummon?.target;
  if (!spec || spec.count === 'all' || spec.special) return [null];
  const options = targetOptions(state, who, spec, { space });
  // The new Pokémon itself, for a train target (Chansey may train itself).
  if (spec.side === 'friendly' && spec.filter === 'canTrain' && card.level < Math.min(card.cap ?? 6, 6)) options.push({ who, kind: 'pokemon', space });
  return options.length ? options.map((t) => [t]) : [null];
}

// What a card in hand is worth keeping (for Supporter Release choices).
function keepValue(state, who, c) {
  if (c.cardType === 'Pokémon') return c.attack + c.strength;
  if (c.cardType === 'Location') return locationStarts(state, c).length && state.round < CHAMPIONSHIP_ROUND - 1 ? 5 : 1;
  return 5;
}
// Release choices: its least useful cards; and the cheapest set that meets the Favour.
function releaseSets(state, who, card) {
  const others = state.players[who].hand.filter((c) => c.uid !== card.uid)
    .sort((a, b) => keepValue(state, who, a) - keepValue(state, who, b));
  const sets = [others.slice(0, card.release).map((c) => c.uid)];
  const meets = others.find((c) => FAVOURS[card.favour?.condition]?.test(c));
  if (meets && !sets[0].includes(meets.uid)) {
    sets.push([meets.uid, ...others.filter((c) => c !== meets).slice(0, card.release - 1).map((c) => c.uid)]);
  }
  return sets;
}

// How good a position is for `who` (higher is better). Used for V4's card types.
export function evaluate(state, who) {
  const foe = opponentOf(who);
  const me = state.players[who];
  const them = state.players[foe];
  const statusWorth = (side) => pokemonOf(state, side).reduce((v, { card }) => v + (card.burn ?? 0) * 1.5
    + (card.asleep ? card.attack + 2 : 0) + (card.seededBy ? 3 : 0), 0) + (state.players[side].burn ?? 0) * 2.5;
  if (state.winner === who) return 1e6;
  if (state.winner === foe) return -1e6;
  const w = PLAN_WEIGHTS[me.plan] ?? PLAN_WEIGHTS.default;
  return w.recognition * me.recognition - 3 * them.recognition + w.board * boardWorth(state, who) - boardWorth(state, foe)
    + 2 * me.hand.length + 3 * me.bag.length + 1.2 * me.energy + 1.5 * me.bonusNext
    + statusWorth(foe) + w.enemyBurn * (them.burn ?? 0) - statusWorth(who) + w.growth * (me.growth ?? 0)
    + (w.lateBoard && state.round >= CHAMPIONSHIP_ROUND - 2 ? w.lateBoard * pokemonOf(state, who).length : 0);
}

// The deck plans (V6): what each deck's AI values more than the default.
//   Fire: races Recognition and Burns the enemy player (Burn on the player strips
//         their Recognition every Supper).
//   Water: holds the board and Locations, building toward the Championship (a board
//         still standing late is worth more; Location progress counts for more).
//   Grass: builds Growth, Nurtures (training is board worth) and keeps Growth for a
//         big Solar Beam.
const PLAN_WEIGHTS = {
  default: { recognition: 3, board: 1, enemyBurn: 0, growth: 0.8, lateBoard: 0, progress: 1, locationBonus: 0 },
  fire: { recognition: 4, board: 0.9, enemyBurn: 2.5, growth: 0.5, lateBoard: 0, progress: 1, locationBonus: 0 },
  water: { recognition: 3, board: 1.3, enemyBurn: 0, growth: 0.5, lateBoard: 3, progress: 1.6, locationBonus: 6 },
  grass: { recognition: 3, board: 1.1, enemyBurn: 0, growth: 2, lateBoard: 0, progress: 1, locationBonus: 0 },
};
const planOf = (state, who) => PLAN_WEIGHTS[state.players[who].plan] ?? PLAN_WEIGHTS.default;

// What a reward is worth, in points of score.
const rewardWorth = (r = {}) => 3 * (r.recognition ?? 0) + 6 * (r.energy ?? 0) + 5 * (r.draw ?? 0) + 6 * (r.item ?? 0);
// Locations whose objective a Pokémon standing (or arriving) in them helps.
const wantsPokemon = (loc, who) => OBJECTIVES[loc.objective.kind].inLocation && !loc.completed[who];

// The empty space to summon into: inside a Location that wants Pokémon (summon,
// attack, presence) if there is one, else opposite an enemy Pokémon if one stands
// across an empty space of ours, otherwise the empty space nearest the middle.
function bestSpace(state, who) {
  const row = state.players[who].row;
  const enemy = state.players[opponentOf(who)].row;
  const empty = row.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  const middle = (LANES - 1) / 2;
  const near = (list) => list.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0];
  const inLocation = empty.filter((i) => { const loc = locationAt(state, i); return loc && wantsPokemon(loc, who); });
  if (inLocation.length) {
    // The Location closest to a reward first.
    const worth = (i) => { const loc = locationAt(state, i); return loc.progress[who] / loc.objective.count + (loc.championship ? 0 : 0.5); };
    return inLocation.sort((a, b) => worth(b) - worth(a) || Math.abs(a - middle) - Math.abs(b - middle))[0];
  }
  const opposite = empty.filter((i) => enemy[i]);
  return near(opposite.length ? opposite : empty);
}

// Where to put a Location: over the most of its own Pokémon (for objectives that
// count Pokémon in it) and the fewest enemy ones, or with the most empty spaces of
// its own to summon into; then nearest the middle.
function bestStart(state, who, card) {
  const middle = (LANES - card.lanes) / 2;
  const kind = OBJECTIVES[card.objective.kind];
  const score = (start) => {
    const lanes = Array.from({ length: card.lanes }, (_, i) => start + i);
    const own = lanes.filter((l) => state.players[who].row[l]).length;
    const foe = lanes.filter((l) => state.players[opponentOf(who)].row[l]).length;
    if (!kind.inLocation) return -Math.abs(start - middle) * 0.1;
    if (card.objective.kind === 'summon') return (card.lanes - own) * 2 - foe - Math.abs(start - middle) * 0.1;
    return own * 3 - foe * 2 + (card.lanes - own) - Math.abs(start - middle) * 0.1;
  };
  return locationStarts(state, card).sort((a, b) => score(b) - score(a))[0];
}

// Progress worth: for each Location, its progress toward the next milestone or
// completion, weighted by that reward.
function progressWorth(state, who) {
  let worth = 0;
  for (const loc of state.locations) {
    const goals = [...loc.milestones.map((m) => ({ at: m.at, r: m.reward })), { at: loc.objective.count, r: loc.completion }];
    for (const g of goals) worth += Math.min(loc.progress[who], g.at) / g.at * rewardWorth(g.r) * 0.5;
  }
  return worth;
}

// What its Pokémon on the board are worth: Attack + Strength left, and keywords.
function boardWorth(state, who) {
  return pokemonOf(state, who).reduce((sum, { card }) => sum + card.attack + card.currentStrength
    + (card.keywords.includes('Infiltrator') ? 2 : 0) + (card.keywords.includes('Quick Attack') && !card.spent ? 3 : 0), 0);
}

// What playing this card now gives up: the stats it would gain by waiting a Round
// or two (up to its cap). Retain cards wait for free; nothing waits past Round 9.
function waitValue(state, card) {
  if (card.level >= card.cap || state.round >= CHAMPIONSHIP_ROUND) return 0;
  const later = pokemonAt(card.series, Math.min(card.cap, card.level + 2));
  const gain = later.attack + later.strength - card.attack - card.strength;
  return gain * (card.retain ? 1.2 : 0.6);
}

function locationScore(state, who, move) {
  const card = state.players[who].hand.find((c) => c.uid === move.uid);
  const endsAt = state.round + card.rounds - 1;
  // The Championship ends it in Round 10: from Round 9 a Location has one Round to pay.
  if (state.round >= CHAMPIONSHIP_ROUND - 1) return -2;
  const lanes = Array.from({ length: card.lanes }, (_, i) => move.start + i);
  const own = lanes.filter((l) => state.players[who].row[l]).length;
  const foe = lanes.filter((l) => state.players[opponentOf(who)].row[l]).length;
  let score = 20 + 0.4 * (rewardWorth(card.completion) + card.milestones.reduce((n, m) => n + rewardWorth(m.reward), 0));
  if (OBJECTIVES[card.objective.kind].inLocation) score += 4 * own - 3 * foe;
  if (endsAt >= CHAMPIONSHIP_ROUND) score -= 3 * (endsAt - CHAMPIONSHIP_ROUND + 1);
  return score + planOf(state, who).locationBonus;
}

export function scoreMove(state, who, move) {
  if (move.type === 'flipCoin' || move.type === 'assignPoints' || move.type === 'placePartner') return 0;
  if (move.type === 'pass') return passSpends(state, who).length ? -6 : 0;
  const after = applyAction(state, move);
  if (after.winner === who) return 1000;
  // Objective progress and reward Recognition this move brings (on top of its own worth).
  const gained = after.players[who].recognition - state.players[who].recognition;
  const objective = (progressWorth(after, who) - progressWorth(state, who)) * planOf(state, who).progress;
  return baseScore(state, after, who, move, gained) + objective;
}

function baseScore(state, after, who, move, gained) {
  if (move.type === 'playLocation') return locationScore(state, who, move);
  if (move.type === 'playTrainer') {
    // Early Trainers have time to earn points; from the Championship on, little.
    const card = state.players[who].hand.find((c) => c.uid === move.uid);
    return (state.round >= CHAMPIONSHIP_ROUND ? 2 : 20 - state.round) + trainerSpaceValue(state, who, card, move.space) - card.cost;
  }
  if (move.type === 'moveTrainer') {
    const t = state.players[who].trainers.find((x) => x.uid === move.uid);
    return 3 * (trainerSpaceValue(state, who, t, move.space) - trainerSpaceValue(state, who, t, t.space)) - 2;
  }
  if (move.type === 'useAbility' || move.type === 'nurture') return 6 + evaluate(after, who) - evaluate(state, who);
  if (['playStrategy', 'playSupporter', 'playItem', 'useItem'].includes(move.type)) {
    let score = 6 + evaluate(after, who) - evaluate(state, who);
    // Grass keeps its Growth for a big Solar Beam (5+), unless it's late or it wins.
    const spent = state.players[who].growth - after.players[who].growth;
    if (move.type === 'playStrategy' && state.players[who].plan === 'grass' && spent > 0 && spent < 5 && state.round < CHAMPIONSHIP_ROUND - 1) score -= 8;
    return score;
  }
  if (move.type === 'summon') {
    const card = state.players[who].hand.find((c) => c.uid === move.uid);
    const extra = move.empowered ? card.empower.cost : 0;
    return 14 + 1.5 * (boardWorth(after, who) - boardWorth(state, who)) - waitValue(state, card) - 1.5 * extra + 3 * gained;
  }
  // An attack.
  const foe = opponentOf(who);
  if (move.target.kind === 'player') return 20 + 3 * gained;
  const defender = state.players[foe].row[move.target.space];
  const attacker = state.players[who].row[move.from];
  const killed = !after.players[foe].row[move.target.space];
  const lost = !after.players[who].row[move.from];
  const bonus = 3 * gained;
  if (killed && !lost) return 40 + value(defender) + bonus;
  if (lost && !killed) return -20 + bonus;
  if (killed && lost) return 10 + value(defender) - value(attacker) + bonus;
  return 5 + (defender.currentStrength - after.players[foe].row[move.target.space].currentStrength) + bonus;
}

export function chooseAction(state, who, { rng = Math.random } = {}) {
  const options = moves(state, who);
  if (!options.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const move of options) {
    const score = scoreMove(state, who, move) + rng() * 0.01;
    if (score > bestScore) { best = move; bestScore = score; }
  }
  return best;
}

export { pokemonOf, pokemonIn };
