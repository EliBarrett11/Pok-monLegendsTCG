// The v2 engine (V1 core + V2 Locations): the board, the match flow, Energy with
// storing, summoning, attacks with the guard rules, Recognition, Locations with
// their objectives, the Championship and the end of the match. No DOM code.
//
// applyAction(state, action) never changes `state`: it returns a new state,
// with `events` saying what just happened (for the screen and the AI).
//
// The board (docs/v2-design.md 1.1): each player has one row of 9 spaces; the
// two rows face each other, so space i on both sides makes lane i. A lane is
// Home until a Location covers it (see the Locations section below).
//
// The match flow, as in v1: a coin flip for Round 1's initiative, then each Round
//   Breakfast  Spent Pokémon become Active; draw 7 (on top of any kept Retain
//              cards: Elliott's ruling, as in v1); Energy = the Round
//              number (up to 10) + any stored Energy
//   Battle     alternating Actions, the player with initiative first: summon a
//              Pokémon, attack with an Alert one, or Pass
//   Supper     the hand is discarded except Retain cards; up to 1 unspent Energy
//              is stored for the next Round
// and initiative switches each Round.
//
// The player character (1.3): each player is a target with no health. Damage
// to the enemy player character gains the attacker's player that much
// Recognition. Reaching 60 Recognition wins at once, at any time.
//
// The end of the match (7a): 12 Rounds. The Championship arrives at the start of
// Round 10 (a Location over all 9 lanes; every other Location ends, milestones
// already earned are kept). After Round 12's Supper the highest Recognition wins;
// a tie goes to the most Championship progress, then one sudden-death Round
// (Round 13); a tie after that is a draw (Claude's placeholder, open question).

import { nextRandom, shuffle } from '../../../src/engine/random.js';
import {
  LANES, RECOGNITION_TARGET, HAND_SIZE, STORE_LIMIT, PASS_ENERGY, ROUND_LIMIT, CHAMPIONSHIP_ROUND, MAX_LEVEL, baseEnergyFor, levelFor,
} from './rules.js';
import { TEST_DECK, cardAt, SPEEDS } from './cards.js';
import { pokemonAt } from './series.js';
import { ITEMS, BAG_SIZE, FAVOURS } from './cardtypes.js';
import { OBJECTIVES, CHAMPIONSHIP, rewardText } from './locations.js';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');

// --- Setup ---------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: TEST_DECK, ai: TEST_DECK } } = {}) {
  const state = {
    seed, rng: seed >>> 0, round: 0, phase: 'initiative', turn: null, initiative: null, passesInARow: 0,
    winner: null, result: null, suddenDeath: false, locations: [], nextLocation: 0, players: {}, log: [], events: [],
    itemPool: [], nextItem: 0,
  };
  for (const who of PLAYERS) {
    state.players[who] = {
      name: NAMES[who],
      drawPile: shuffle(state, buildDeck(who, decks[who])),
      hand: [], discard: [], released: [],
      row: Array(LANES).fill(null),
      energy: 0, roundEnergy: 0, stored: 0, bonusNext: 0, bonus: 0, recognition: 0,
      bag: [], burn: 0,
    };
  }
  // The shared Item pool (V4): one copy of each test Item, shuffled.
  state.itemPool = shuffle(state, ITEMS.map((c) => ({ ...c, uid: `pool-${state.nextItem++}` })));
  log(state, 'Flip a coin to decide who has initiative in Round 1.');
  return state;
}

// A deck (a list of { series, cap } and { location } cards) as cards, each with its own uid.
export function buildDeck(who, list) {
  return list.map((entry, n) => ({ ...cardAt(entry, 1), uid: `${who}-${n}` }));
}

// --- Training (V3) ------------------------------------------------------------------------------
//
// A Pokémon card's Level is the Round number, up to its cap, wherever it is
// (hand, draw pile, discard). Once played it stays at that Level (frozen), unless an
// effect trains it.

// The card at a Level of its series, keeping who it is (uid, cap).
const atLevel = (card, level) => ({ ...pokemonAt(card.series, level), cap: card.cap, uid: card.uid });

// Breakfast: every Pokémon card off the board follows the Round. A card in hand that
// reaches a new stage says so (a 'levelUp' event, for the flourish).
function followRound(s, who) {
  const p = s.players[who];
  for (const pile of ['hand', 'drawPile', 'discard']) {
    p[pile] = p[pile].map((card) => {
      if (card.cardType !== 'Pokémon') return card;
      const level = levelFor(s.round, card.cap);
      if (level === card.level) return card;
      const next = atLevel(card, level);
      if (pile === 'hand' && next.stage !== card.stage) emit(s, 'levelUp', { who, uid: card.uid, from: card.name, to: next.name, level });
      return next;
    });
  }
}

// The highest Level training can reach: the cap, and never Level 7 (Legendaries
// reach it only by the Round).
export const trainTop = (card) => Math.min(card.cap ?? MAX_LEVEL, MAX_LEVEL);

// Train a played Pokémon by n Levels, up to its cap: the new Level's stats, name and
// ability. Damage carries over and never defeats it (at least 1 Strength is left), as
// with Evolution in the current game. An Empowered bonus stays.
export function train(s, who, space, n) {
  const card = s.players[who].row[space];
  if (!card) return false;
  const to = Math.min(card.level + n, trainTop(card));
  if (to <= card.level) return false;
  const damage = card.strength - card.currentStrength;
  const next = {
    ...atLevel(card, to), spent: card.spent, arrivedRound: card.arrivedRound, empowered: card.empowered,
    burn: card.burn, asleep: card.asleep, seededBy: card.seededBy,
  };
  if (card.empowered) applyEmpower(next);
  if (card.held) applyHeld(next, card.held);
  next.currentStrength = Math.max(1, next.strength - damage);
  // Evolving (a new stage) cures Sleep and Leech Seed, as in the current game.
  if (next.stage !== card.stage) { next.asleep = false; next.seededBy = null; }
  s.players[who].row[space] = next;
  emit(s, 'trained', { who, space, from: card.level, to, fromName: card.name, name: next.name });
  log(s, `${NAMES[who] === 'You' ? 'Your' : "The Opponent's"} ${card.name} trained to Level ${to}${next.name !== card.name ? `: it evolved into ${next.name}` : ''}.`);
  return true;
}

// The Empowered summon's bonus, on the card.
function applyEmpower(card) {
  const e = card.empower;
  card.attack += e.attack ?? 0;
  card.strength += e.strength ?? 0;
  card.keywords = [...new Set([...card.keywords, ...(e.keywords ?? [])])];
}


// What a summon costs: the card's cost, plus the Empowered extra if chosen.
export const summonCost = (card, empowered) => card.cost + (empowered && card.empower ? card.empower.cost : 0);

// --- Reading the state ---------------------------------------------------------------------------

const speedOf = (card) => SPEEDS.indexOf(card.speed);
const hasKeyword = (card, key) => (card.keywords ?? []).includes(key);
export const pokemonOf = (state, who) => state.players[who].row.map((card, space) => (card ? { space, card } : null)).filter(Boolean);
const allPokemon = (state) => PLAYERS.flatMap((who) => pokemonOf(state, who).map((p) => ({ ...p, who })));

// The highest Speed among all Active Pokémon on the board (both sides), or -1.
function alertTier(state) {
  return Math.max(-1, ...allPokemon(state).filter(({ card }) => !card.spent).map(({ card }) => speedOf(card)));
}
// Alert: Active, and of the highest Speed among all Active Pokémon. Only Alert Pokémon attack.
export const isAlert = (state, card) => !card.spent && speedOf(card) === alertTier(state);
export const alertSpaces = (state, who) => pokemonOf(state, who).filter(({ card }) => isAlert(state, card)).map(({ space }) => space);

// Where the Pokémon in `from` (a space in its own row) may attack: any enemy
// Pokémon or the enemy player character, except that a Physical attacker must
// attack a Defence Pokémon if the enemy has one, and a Special attacker a Special
// Defence one. Infiltrator ignores both. As { kind: 'pokemon', space } or { kind: 'player' }.
export function legalTargets(state, who, from) {
  const attacker = state.players[who].row[from];
  if (!attacker) return [];
  const enemy = pokemonOf(state, opponentOf(who));
  const all = [...enemy.map(({ space }) => ({ kind: 'pokemon', space })), { kind: 'player' }];
  if (hasKeyword(attacker, 'Infiltrator')) return all;
  const guardType = { Physical: 'Defence', Special: 'Special Defence' }[attacker.attackType];
  const guards = enemy.filter(({ card }) => card.strengthType === guardType).map(({ space }) => ({ kind: 'pokemon', space }));
  return guards.length ? guards : all;
}

// The Pokémon in hand this player can summon now: affordable, with an empty space.
export function playable(state, who) {
  const p = state.players[who];
  if (!p.row.includes(null)) return [];
  return p.hand.filter((c) => c.cardType === 'Pokémon' && c.cost <= p.energy);
}

// Whether a Pass now ends the Battle Phase (the second Pass in a row): it gains nothing.
export const passEndsPhase = (state) => state.passesInARow >= 1;

// The Pokémon a Pass would make Spent: the passer's Active Pokémon at the top
// Speed when the opponent has none Active at that Speed (unmatched speed, as in v1).
export function passSpends(state, who) {
  if (state.phase !== 'battle' || passEndsPhase(state)) return [];
  const top = alertTier(state);
  if (top < 0) return [];
  const atTop = allPokemon(state).filter(({ card }) => !card.spent && speedOf(card) === top);
  if (atTop.some((p) => p.who !== who)) return [];
  return atTop.map(({ space }) => space);
}

// --- Locations (V2) -----------------------------------------------------------------------
//
// state.locations: [{ uid, id, name, owner, lanes: [lane indexes], roundsLeft, weather,
//   objective, milestones, completion, progress: { player, ai }, reached: { player: [at…],
//   ai: [at…] }, completed: { player, ai }, championship? }]
// A Location covers its lanes on both sides of the board. roundsLeft counts the
// current Round: it ticks down at Supper and the Location ends at 0.

export const locationAt = (state, lane) => state.locations.find((l) => l.lanes.includes(lane)) ?? null;
export const isHome = (state, lane) => !locationAt(state, lane);

// The lanes a Location of this width could start at: every lane it would cover is Home.
export function locationStarts(state, card) {
  const out = [];
  for (let start = 0; start + card.lanes <= LANES; start++) {
    if (Array.from({ length: card.lanes }, (_, i) => start + i).every((lane) => isHome(state, lane))) out.push(start);
  }
  return out;
}

// The Location cards in hand this player can play now (cost 0; they need free lanes).
export function placeable(state, who) {
  return state.players[who].hand.filter((c) => c.cardType === 'Location' && locationStarts(state, c).length);
}

// The Weather Tokens on the board: the sum over every Location in play.
export function weatherTotals(state) {
  const totals = { Rain: 0, Sun: 0 };
  for (const l of state.locations) for (const [kind, n] of Object.entries(l.weather ?? {})) totals[kind] = (totals[kind] ?? 0) + n;
  return totals;
}

// The Pokémon `who` has in a Location's lanes.
export const pokemonIn = (state, who, loc) => loc.lanes.filter((lane) => state.players[who].row[lane]).length;

export const championship = (state) => state.locations.find((l) => l.championship) ?? null;

// --- Effects, statuses and Weather (V4) ------------------------------------------------------------
//
// Target refs: { who, kind: 'pokemon', space } (a Pokémon in `who`'s row) or
// { who, kind: 'player' } (that player character). Specs and ops: cardtypes.js.

// Weather brackets (docs/decks.md 2.12, without Growth and Evolve until V6): a
// bracket is on while the combined count is at or above it.
export const bracket = (state, kind, n) => (weatherTotals(state)[kind] ?? 0) >= n;

export function targetOptions(state, who, spec) {
  if (!spec) return [];
  const side = spec.side === 'enemy' ? opponentOf(who) : who;
  const out = [];
  if (spec.kinds.includes('pokemon')) {
    for (const { space, card } of pokemonOf(state, side)) {
      if (spec.filter === 'canTrain' && card.level >= trainTop(card)) continue;
      if (spec.filter === 'damaged' && card.currentStrength >= card.strength) continue;
      out.push({ who: side, kind: 'pokemon', space });
    }
  }
  if (spec.kinds.includes('player')) out.push({ who: side, kind: 'player' });
  return out;
}
const refKey = (t) => `${t.who}:${t.kind}:${t.space ?? ''}`;
// Whether a card with this target spec has something to work on.
export const canTarget = (state, who, spec) => !spec || targetOptions(state, who, spec).length > 0;

// The targets an effect works on: every option for 'all'; otherwise the chosen
// ones (1 up to the count, all different, all legal).
function chooseTargets(s, who, spec, targets) {
  if (!spec) return [];
  const options = targetOptions(s, who, spec);
  if (spec.count === 'all') return options;
  if (!options.length) throw new Error('There is no legal target');
  const list = targets ?? [];
  if (list.length < 1 || list.length > spec.count) throw new Error(spec.count === 1 ? 'Choose a target' : `Choose 1 to ${spec.count} targets`);
  if (new Set(list.map(refKey)).size !== list.length) throw new Error('Choose different targets');
  return list.map((t) => {
    const found = options.find((o) => refKey(o) === refKey(t));
    if (!found) throw new Error('That is not a legal target');
    return found;
  });
}

// Strategy Cards: the breakpoints this player can pay now (affordable, with a target).
export const breakpointsFor = (state, who, card) => (card.breakpoints ?? [])
  .filter((b) => b.cost <= state.players[who].energy && canTarget(state, who, b.target));
export const playableStrategies = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Strategy' && breakpointsFor(state, who, c).length);
// Supporters: enough other cards in hand to Release, and a target.
export const supporterPlayable = (state, who, card) => state.players[who].hand.length - 1 >= card.release && canTarget(state, who, card.target);
export const playableSupporters = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Supporter' && supporterPlayable(state, who, c));
// Items: usable now (a target), and from hand affordable (used now, or into the Bag if it has room).
export const itemUsable = (state, who, item) => canTarget(state, who, item.target);
export const bagFull = (state, who) => state.players[who].bag.length >= BAG_SIZE;
export const playableItems = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Item' && c.cost <= state.players[who].energy
  && (itemUsable(state, who, c) || !bagFull(state, who)));
export const usableBagItems = (state, who) => state.players[who].bag.filter((c) => itemUsable(state, who, c));
// The Favour: met if a Released card meets the Supporter's condition.
export const favourMet = (card, released) => !!card.favour && released.some((c) => FAVOURS[card.favour.condition].test(c));

export function legalActions(state, who) {
  if (state.phase === 'initiative') return ['flipCoin'];
  if (state.phase !== 'battle' || state.turn !== who) return [];
  return [
    'pass',
    ...(playable(state, who).length ? ['summon'] : []),
    ...(placeable(state, who).length ? ['playLocation'] : []),
    ...(playableStrategies(state, who).length ? ['playStrategy'] : []),
    ...(playableSupporters(state, who).length ? ['playSupporter'] : []),
    ...(playableItems(state, who).length ? ['playItem'] : []),
    ...(usableBagItems(state, who).length ? ['useItem'] : []),
    ...(alertSpaces(state, who).some((s) => legalTargets(state, who, s).length) ? ['attack'] : []),
  ];
}

// --- Actions ---------------------------------------------------------------------------------------

export function applyAction(state, action) {
  const s = structuredClone(state);
  s.events = [];
  if (!legalActions(s, action.who ?? s.turn).includes(action.type) && action.type !== 'flipCoin') {
    throw new Error(`${action.who} cannot ${action.type} now`);
  }
  if (action.type === 'flipCoin' && s.phase !== 'initiative') throw new Error('The coin has been flipped');
  ACTIONS[action.type](s, action);
  return s;
}

const ACTIONS = {
  flipCoin(s) {
    const winner = nextRandom(s) < 0.5 ? 'player' : 'ai';
    s.initiative = winner;
    emit(s, 'coinFlip', { winner });
    log(s, `Coin flip: ${NAMES[winner]} ${winner === 'player' ? 'have' : 'has'} initiative in Round 1.`);
    startRound(s, 1);
  },

  // Summon a Pokémon from hand into an empty space of your row, paying its cost.
  // It arrives Spent (Quick Attack: Active).
  // Empowered (only on Pokémon that have it): pay the extra Energy for its bonus.
  // It stays at the Level it is played at (frozen).
  summon(s, { who, uid, space, empowered = false, targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!(space >= 0 && space < LANES) || p.row[space]) throw new Error('Choose an empty space in your row');
    if (empowered && !card.empower) throw new Error(`${card.name} has no Empowered summon`);
    const cost = summonCost(card, empowered);
    if (cost > p.energy) throw new Error(`Not enough Energy for ${card.name}${empowered ? ' (Empowered)' : ''}`);
    p.energy -= cost;
    p.hand = p.hand.filter((c) => c !== card);
    const played = { ...card, empowered: !!empowered, arrivedRound: s.round };
    if (empowered) applyEmpower(played);
    played.currentStrength = played.strength;
    played.spent = !hasKeyword(played, 'Quick Attack');
    p.row[space] = played;
    emit(s, 'summoned', { who, uid, name: card.name, space, cost, level: card.level, stage: card.stage, series: card.series, empowered: !!empowered });
    log(s, `${p.name} summoned ${card.name} (Level ${card.level}) into space ${space + 1} (${cost} Energy${empowered ? `, Empowered: ${card.empower.text}` : ''}).`);
    // An On summon ability (Chansey's train): its player chooses the target.
    // With no possible target, nothing happens.
    const onSummon = card.ability?.onSummon;
    if (onSummon && canTarget(s, who, onSummon.target)) runEffect(s, who, onSummon.target, onSummon.ops, targets);
    if (over(s)) return;
    progressAt(s, who, 'summon', space);
    endTurn(s, who, false);
  },

  // Play a Location (cost 0) over free Home lanes, from `start` to the right. It
  // covers those lanes on both sides; Pokémon already there are now in it.
  playLocation(s, { who, uid, start }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Location') throw new Error('Choose a Location from your hand');
    if (!locationStarts(s, card).includes(start)) throw new Error(`${card.name} needs ${card.lanes} free Home lane${card.lanes > 1 ? 's' : ''} there`);
    p.hand = p.hand.filter((c) => c !== card);
    const loc = enterLocation(s, card, who, Array.from({ length: card.lanes }, (_, i) => start + i));
    emit(s, 'locationPlaced', { who, uid: loc.uid, name: card.name, lanes: loc.lanes });
    log(s, `${p.name} placed ${card.name} over lane${loc.lanes.length > 1 ? 's' : ''} ${loc.lanes.map((l) => l + 1).join('–')} (${card.rounds} Rounds): ${card.objective.text}.`);
    endTurn(s, who, false);
  },

  // Play a Strategy Card, paying one of its breakpoint amounts (pay): that
  // breakpoint's effect, on the chosen targets. It goes to the discard pile.
  playStrategy(s, { who, uid, pay, targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Strategy') throw new Error('Choose a Strategy Card from your hand');
    const bp = card.breakpoints.find((b) => b.cost === pay);
    if (!bp) throw new Error(`${card.name} can only be paid ${card.breakpoints.map((b) => b.cost).join(', ')}`);
    if (pay > p.energy) throw new Error(`Not enough Energy for ${card.name} at ${pay}`);
    chooseTargets(s, who, bp.target, targets);   // checked before paying
    p.energy -= pay;
    p.hand = p.hand.filter((c) => c !== card);
    p.discard.push(card);
    emit(s, 'strategy', { who, uid, name: card.name, pay, level: card.breakpoints.indexOf(bp), levels: card.breakpoints.length, text: bp.text });
    log(s, `${p.name} played ${card.name} for ${pay} Energy: ${bp.text}.`);
    runEffect(s, who, bp.target, bp.ops, targets);
    endTurn(s, who, false);
  },

  // Play a Supporter: Release the chosen cards from hand (exactly its Release cost),
  // then the effect (improved if a Released card meets the Favour), then the
  // Supporter itself is Released. No once-per-Round limit.
  playSupporter(s, { who, uid, release = [], targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Supporter') throw new Error('Choose a Supporter from your hand');
    if (release.length !== card.release || new Set(release).size !== release.length) throw new Error(`${card.name}: Release exactly ${card.release} card${card.release === 1 ? '' : 's'}`);
    const paid = release.map((r) => p.hand.find((c) => c.uid === r && c !== card));
    if (paid.some((c) => !c)) throw new Error('Release cards from your hand (not the Supporter itself)');
    const favour = favourMet(card, paid);
    const ops = favour ? card.favour.ops : card.ops;
    chooseTargets(s, who, card.target, targets);
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c));
    p.released.push(...paid.map(plainCard));
    emit(s, 'supporter', { who, uid, name: card.name, released: paid.map((c) => c.name), favour });
    log(s, `${p.name} played ${card.name}, Releasing ${paid.map((c) => c.name).join(' and ')}${favour ? ` (Favour: ${FAVOURS[card.favour.condition].text}: ${card.favour.text})` : ''}.`);
    runEffect(s, who, card.target, ops, targets);
    p.released.push(card);
    emit(s, 'released', { who, uid, name: card.name });
    endTurn(s, who, false);
  },

  // Play an Item from hand, paying its Energy cost: use it now (mode 'use') or put
  // it into the Bag (mode 'bag').
  playItem(s, { who, uid, mode = 'use', targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Item') throw new Error('Choose an Item from your hand');
    if (card.cost > p.energy) throw new Error(`Not enough Energy for ${card.name}`);
    if (mode === 'bag' && bagFull(s, who)) throw new Error('Your Bag is full');
    if (mode === 'use') chooseTargets(s, who, card.target, targets);
    p.energy -= card.cost;
    p.hand = p.hand.filter((c) => c !== card);
    if (mode === 'bag') {
      p.bag.push(card);
      emit(s, 'bagged', { who, uid, name: card.name });
      log(s, `${p.name} put ${card.name} into the Bag (${card.cost} Energy).`);
    } else {
      log(s, `${p.name} played ${card.name} (${card.cost} Energy).`);
      useItemCard(s, who, card, targets);
    }
    endTurn(s, who, false);
  },

  // Use an Item from the Bag (cost 0).
  useItem(s, { who, uid, targets }) {
    const p = s.players[who];
    const card = p.bag.find((c) => c.uid === uid);
    if (!card) throw new Error('Choose an Item in your Bag');
    chooseTargets(s, who, card.target, targets);
    p.bag = p.bag.filter((c) => c !== card);
    useItemCard(s, who, card, targets);
    endTurn(s, who, false);
  },

  // Attack with an Alert Pokémon (from: its space). A Pokémon target that is also
  // Alert hits back (a trade); both become Spent. Damage to the enemy player
  // character becomes the attacker's Recognition.
  attack(s, { who, from, target }) {
    const p = s.players[who];
    const foe = opponentOf(who);
    const attacker = p.row[from];
    if (!attacker || !isAlert(s, attacker)) throw new Error('Choose one of your Alert Pokémon');
    if (!legalTargets(s, who, from).some((t) => t.kind === target?.kind && t.space === target.space)) throw new Error('That is not a legal target');
    if (target.kind === 'player') {
      const amount = attacker.attack;
      attacker.spent = true;
      p.recognition += amount;
      emit(s, 'attack', { who, from, target: { kind: 'player', who: foe }, amount, attacker: attacker.name });
      emit(s, 'recognition', { who, amount, total: p.recognition });
      log(s, `${p.name === 'You' ? 'Your' : "The Opponent's"} ${attacker.name} attacked ${who === 'player' ? 'the Opponent' : 'you'} directly for ${amount}: +${amount} Recognition (now ${p.recognition}).`);
      if (p.recognition >= RECOGNITION_TARGET) return win(s, who);
      progressAt(s, who, 'attack', from);
      progressAt(s, who, 'damage', from, amount);
      return endTurn(s, who, false);
    }
    const defender = s.players[foe].row[target.space];
    const trades = isAlert(s, defender);   // decided before anyone becomes Spent
    defender.currentStrength -= attacker.attack;
    defender.asleep = false;   // damage wakes a sleeping Pokémon (it stays Spent)
    if (trades) attacker.currentStrength -= defender.attack;
    attacker.spent = true;
    if (trades) defender.spent = true;
    emit(s, 'attack', { who, from, target: { kind: 'pokemon', who: foe, space: target.space }, amount: attacker.attack, attacker: attacker.name, defender: defender.name, trades, back: trades ? defender.attack : 0 });
    log(s, `${p.name === 'You' ? 'Your' : "The Opponent's"} ${attacker.name} attacked ${defender.name} for ${attacker.attack}${trades ? `; ${defender.name} was Alert and hit back for ${defender.attack}` : ''}.`);
    progressAt(s, who, 'attack', from);
    defeat(s, foe, target.space, who, from);
    defeat(s, who, from, foe, target.space);
    endTurn(s, who, false);
  },

  // Pass: +1 Energy, unless it is the second Pass in a row (that ends the Battle
  // Phase). Unmatched speed: the passer's top-Speed Active Pokémon become Spent.
  pass(s, { who }) {
    const p = s.players[who];
    const ends = passEndsPhase(s);
    const spends = passSpends(s, who);
    if (!ends) {
      p.energy += PASS_ENERGY;
      for (const space of spends) p.row[space].spent = true;
    }
    emit(s, 'pass', { who, endsPhase: ends, gain: ends ? 0 : PASS_ENERGY, spends });
    log(s, ends ? `${p.name} passed: no Energy (the other player passed last). The Battle Phase ends.` : `${p.name} passed: +${PASS_ENERGY} Energy.`);
    endTurn(s, who, true);
  },
};

// A Pokémon at 0 Strength or below is defeated: it goes to the Released Pile.
// The defeat counts for `by` (the attacker, or the Alert defender that hit back),
// in the Location over `byLane` (where that Pokémon stands).
function defeat(s, who, space, by, byLane) {
  const card = s.players[who].row[space];
  if (!card || card.currentStrength > 0) return;
  s.players[who].row[space] = null;
  if (card.held) returnToPool(s, card.held);
  s.players[who].released.push(plainCard(card));
  emit(s, 'defeated', { who, space, name: card.name });
  log(s, `${NAMES[who] === 'You' ? 'Your' : "The Opponent's"} ${card.name} was defeated.`);
  if (by) progressAt(s, by, 'defeat', byLane);
}

// Reaching 60 Recognition wins at once (the first to get there; later gains in the
// same action don't change it).
function win(s, who) {
  if (s.phase === 'gameOver') return;
  endMatch(s, who, 'target', `${NAMES[who]} reached ${RECOGNITION_TARGET} Recognition and ${who === 'player' ? 'win' : 'wins'}!`);
}

// result.reason: 'target' (60 Recognition), 'recognition' (the most after Round 12),
// 'championship' (a tie broken by Championship progress), 'suddenDeath', 'draw'.
function endMatch(s, winner, reason, line) {
  s.phase = 'gameOver';
  s.winner = winner;
  s.turn = null;
  s.result = { winner, reason, round: s.round, recognition: { player: s.players.player.recognition, ai: s.players.ai.recognition } };
  emit(s, 'gameOver', { winner, reason, recognition: winner ? s.players[winner].recognition : null });
  log(s, line);
}

const over = (s) => s.phase === 'gameOver';

// --- Objectives ---------------------------------------------------------------------------------

function enterLocation(s, card, owner, lanes) {
  const loc = {
    uid: `loc-${s.nextLocation++}`, id: card.id, name: card.name, owner, card, lanes,
    roundsLeft: card.rounds, weather: { ...card.weather }, color: card.color, image: card.image ?? `assets/cards/${card.id}.jpg`,
    objective: card.objective, milestones: card.milestones, completion: card.completion,
    championship: !!card.championship, placedRound: s.round,
    progress: { player: 0, ai: 0 }, reached: { player: [], ai: [] }, completed: { player: false, ai: false },
  };
  s.locations.push(loc);
  return loc;
}

// Progress on an objective in the Location over `lane` (where the Pokémon doing it stands).
function progressAt(s, who, kind, lane, amount = 1) {
  const loc = locationAt(s, lane);
  if (loc && loc.objective.kind === kind && !over(s)) advance(s, who, loc, loc.progress[who] + amount);
}

// Set a player's progress (capped at the objective's count) and pay any milestone
// or completion reached. Each is paid once per player.
function advance(s, who, loc, value) {
  if (over(s) || loc.completed[who]) return;
  const before = loc.progress[who];
  loc.progress[who] = Math.min(loc.objective.count, Math.max(before, value));
  if (loc.progress[who] === before) return;
  emit(s, 'progress', { who, location: loc.uid, name: loc.name, progress: loc.progress[who], count: loc.objective.count });
  for (const m of loc.milestones) {
    if (loc.progress[who] >= m.at && !loc.reached[who].includes(m.at) && !over(s)) {
      loc.reached[who].push(m.at);
      emit(s, 'milestone', { who, location: loc.uid, name: loc.name, at: m.at, count: loc.objective.count, reward: m.reward, championship: loc.championship });
      log(s, `${NAMES[who]} reached a milestone at ${loc.name} (${m.at}/${loc.objective.count}): ${rewardText(m.reward)}.`);
      reward(s, who, m.reward);
    }
  }
  if (loc.progress[who] >= loc.objective.count && !over(s)) {
    loc.completed[who] = true;
    emit(s, 'completed', { who, location: loc.uid, name: loc.name, reward: loc.completion, championship: loc.championship });
    log(s, `${NAMES[who]} completed ${loc.name}: ${rewardText(loc.completion)}.`);
    reward(s, who, loc.completion);
  }
}

// A reward: +Recognition now (60 still wins at once), +Energy at the next Breakfast,
// or cards drawn now.
function reward(s, who, r = {}) {
  const p = s.players[who];
  if (r.energy) p.bonusNext += r.energy;
  if (r.draw) draw(s, who, r.draw);
  for (let i = 0; i < (r.item ?? 0); i++) findItem(s, who);
  if (r.recognition) {
    p.recognition += r.recognition;
    emit(s, 'recognition', { who, amount: r.recognition, total: p.recognition, reward: true });
    if (p.recognition >= RECOGNITION_TARGET) win(s, who);
  }
}

// A Location ends: removed from the board, its lanes become Home again, and its
// card goes to its owner's discard pile (the Championship belongs to no one).
function endLocation(s, loc, why) {
  s.locations = s.locations.filter((l) => l !== loc);
  if (loc.owner) s.players[loc.owner].discard.push(loc.card);
  emit(s, 'locationEnded', { uid: loc.uid, name: loc.name, lanes: loc.lanes, why });
  log(s, why === 'championship' ? `${loc.name} ends: the Championship has arrived.` : `${loc.name}'s time is up: its lanes are Home again.`);
}

// The Championship arrives (start of Round 10): every other Location ends
// (milestones already earned are kept), and it covers all 9 lanes.
function arriveChampionship(s) {
  for (const loc of [...s.locations]) endLocation(s, loc, 'championship');
  const loc = enterLocation(s, CHAMPIONSHIP, null, Array.from({ length: LANES }, (_, i) => i));
  loc.roundsLeft = ROUND_LIMIT - s.round + 1;
  emit(s, 'championship', { uid: loc.uid, round: s.round });
  log(s, `The Championship arrives! ${CHAMPIONSHIP.objective.text}. It runs to the end of Round ${ROUND_LIMIT}.`);
}

function endTurn(s, who, passed) {
  if (over(s)) return;
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
  emit(s, 'turnChanged', { who: s.turn });
}

// --- Phases --------------------------------------------------------------------------------------

// Breakfast: the Championship arrives in Round 10; Spent Pokémon become Active;
// each player draws 7 (on top of kept Retain cards); and Energy is the Round
// number (up to 10) plus what was stored plus any milestone Energy. Then the Battle Phase.
function startRound(s, round) {
  s.round = round;
  emit(s, 'phaseChanged', { phase: 'breakfast', round });
  log(s, `Round ${round}${s.suddenDeath ? ' (sudden death)' : ''} · Breakfast.`);
  if (round === CHAMPIONSHIP_ROUND && !championship(s)) arriveChampionship(s);
  for (const who of PLAYERS) {
    const p = s.players[who];
    // An Asleep Pokémon stays Spent this Breakfast, then wakes.
    for (const card of p.row) if (card) { card.spent = !!card.asleep; card.asleep = false; }
    followRound(s, who);
    draw(s, who, HAND_SIZE);
    p.roundEnergy = baseEnergyFor(round);
    p.bonus = p.bonusNext;
    p.bonusNext = 0;
    p.energy = p.roundEnergy + p.stored + p.bonus;
    log(s, `${p.name}: ${p.roundEnergy} Energy${p.stored ? ` + ${p.stored} stored` : ''}${p.bonus ? ` + ${p.bonus} from milestones` : ''}.`);
    // Regenerate N (a Held Item's keyword): heals N at Breakfast.
    for (const { space, card } of pokemonOf(s, who)) {
      const n = regenerateOf(card);
      if (n) healPokemon(s, who, space, n);
    }
  }
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  emit(s, 'phaseChanged', { phase: 'battle', round, turn: s.turn });
}

function draw(s, who, n) {
  const p = s.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) break;
      p.drawPile = shuffle(s, p.discard);
      p.discard = [];
      emit(s, 'shuffled', { who });
    }
    p.hand.push(p.drawPile.shift());
  }
}

// Supper: the hand is discarded except Retain cards, and up to 1 unspent Energy
// is stored. Then "at Supper" objectives count (cards a reward draws now are kept
// into the next Round), Location timers tick down, and after Round 12 the match
// ends. Otherwise initiative switches, and the next Round begins.
function supper(s) {
  emit(s, 'phaseChanged', { phase: 'supper', round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  statusesAtSupper(s);
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.discard.push(...p.hand.filter((c) => !c.retain));
    p.hand = p.hand.filter((c) => c.retain);
    p.stored = Math.min(STORE_LIMIT, p.energy);
    if (p.stored) log(s, `${p.name} stored ${p.stored} Energy for the next Round.`);
  }
  for (const loc of [...s.locations]) {
    if (!OBJECTIVES[loc.objective.kind].atSupper) continue;
    for (const who of PLAYERS) advance(s, who, loc, pokemonIn(s, who, loc));
  }
  if (over(s)) return;
  for (const loc of [...s.locations]) {
    loc.roundsLeft -= 1;
    // The Championship stays on the board for the final score (and sudden death).
    if (loc.roundsLeft <= 0 && !(loc.championship && s.round >= ROUND_LIMIT)) endLocation(s, loc, 'timer');
  }
  if (s.round >= ROUND_LIMIT && finalScore(s)) return;
  s.initiative = opponentOf(s.initiative);
  startRound(s, s.round + 1);
}

// After Round 12's Supper: the highest Recognition wins; a tie goes to the most
// Championship progress; then one sudden-death Round (the Championship stays for
// it); still tied after that, a draw. Returns whether the match ended.
function finalScore(s) {
  const r = { player: s.players.player.recognition, ai: s.players.ai.recognition };
  const champ = championship(s)?.progress ?? { player: 0, ai: 0 };
  const name = (w) => `${NAMES[w]} ${w === 'player' ? 'win' : 'wins'}`;
  if (r.player !== r.ai) {
    const w = r.player > r.ai ? 'player' : 'ai';
    endMatch(s, w, s.suddenDeath ? 'suddenDeath' : 'recognition', `${s.suddenDeath ? 'Sudden death is over' : `Round ${ROUND_LIMIT} is over`}: ${name(w)} with ${r[w]} Recognition to ${r[opponentOf(w)]}.`);
    return true;
  }
  if (!s.suddenDeath && champ.player !== champ.ai) {
    const w = champ.player > champ.ai ? 'player' : 'ai';
    endMatch(s, w, 'championship', `Round ${ROUND_LIMIT} is over, tied on ${r.player} Recognition: ${name(w)} on Championship progress (${champ[w]} to ${champ[opponentOf(w)]}).`);
    return true;
  }
  if (s.suddenDeath) {
    endMatch(s, null, 'draw', `Sudden death is over, still tied on ${r.player} Recognition: the match is a draw.`);
    return true;
  }
  s.suddenDeath = true;
  if (championship(s)) championship(s).roundsLeft = 1;
  emit(s, 'suddenDeath', {});
  log(s, `Round ${ROUND_LIMIT} is over, tied on Recognition and Championship progress: one sudden-death Round!`);
  return false;
}

// --- Effects at work (V4) ------------------------------------------------------------------------

const NO_TARGET = new Set(['draw', 'energy', 'energyNext', 'recognition', 'findItem']);
const owner = (who) => (NAMES[who] === 'You' ? 'Your' : "The Opponent's");

// Run an effect: each op on each target (or on its player when it has none).
function runEffect(s, who, spec, ops = [], targets) {
  const chosen = chooseTargets(s, who, spec, targets);
  for (const op of ops) {
    if (over(s)) return;
    if (NO_TARGET.has(op.op)) { selfOp(s, who, op); continue; }
    for (const t of chosen) targetOp(s, who, op, t);
  }
}

function selfOp(s, who, op) {
  const p = s.players[who];
  if (op.op === 'draw') { draw(s, who, op.amount); log(s, `${p.name} drew ${op.amount}.`); }
  else if (op.op === 'energy') { p.energy += op.amount; log(s, `${p.name}: +${op.amount} Energy.`); }
  else if (op.op === 'energyNext') p.bonusNext += op.amount;
  else if (op.op === 'recognition') {
    p.recognition += op.amount;
    emit(s, 'recognition', { who, amount: op.amount, total: p.recognition, effect: true });
    log(s, `${p.name}: +${op.amount} Recognition (now ${p.recognition}).`);
    if (p.recognition >= RECOGNITION_TARGET) win(s, who);
  } else if (op.op === 'findItem') findItem(s, who);
  else throw new Error(`Unknown effect op: ${op.op}`);
}

function targetOp(s, who, op, t) {
  const p = s.players[t.who];
  const card = t.kind === 'pokemon' ? p.row[t.space] : null;
  if (t.kind === 'pokemon' && !card) return;   // gone (defeated by an earlier op)
  switch (op.op) {
    case 'damage': if (card) effectDamage(s, t.who, t.space, op.amount); break;
    case 'burn': applyBurn(s, t, op.amount, who); break;
    case 'heal': if (card) healPokemon(s, t.who, t.space, op.amount); break;
    case 'douse': (card ?? p).burn = 0; break;
    case 'cure':
      (card ?? p).burn = 0;
      if (card) { card.asleep = false; card.seededBy = null; }
      emit(s, 'cured', { who: t.who, kind: t.kind, space: t.space });
      break;
    case 'sleep':
      if (card && !card.asleep) {
        card.spent = true;
        card.asleep = true;
        emit(s, 'asleep', { who: t.who, space: t.space, name: card.name });
        log(s, `${owner(t.who)} ${card.name} fell Asleep.`);
      }
      break;
    case 'leechSeed':
      if (card && !card.seededBy) {
        card.seededBy = who;
        emit(s, 'seeded', { who: t.who, space: t.space, by: who, name: card.name });
        log(s, `${owner(t.who)} ${card.name} was Leech Seeded.`);
      }
      break;
    case 'train': if (card) train(s, t.who, t.space, op.amount); break;
    default: throw new Error(`Unknown effect op: ${op.op}`);
  }
}

// Burn X adds X Burn counters (Sun 2: +1 each time Burn is applied). On a player
// character it removes Recognition at Supper (V4).
function applyBurn(s, t, amount, by) {
  const n = amount + (bracket(s, 'Sun', 2) ? 1 : 0);
  const target = t.kind === 'pokemon' ? s.players[t.who].row[t.space] : s.players[t.who];
  target.burn = (target.burn ?? 0) + n;
  emit(s, 'burned', { who: t.who, kind: t.kind, space: t.space, amount: n, total: target.burn, by });
  log(s, `${t.kind === 'player' ? (t.who === 'player' ? 'You' : 'The Opponent') : `${owner(t.who)} ${target.name}`} ${t.kind === 'player' && t.who === 'player' ? 'are' : 'is'} Burned ${n} (Burn ${target.burn}).`);
}

// Effect damage (Strategy Cards, Burn, Leech Seed): it wakes a sleeping Pokémon and
// can defeat it. It has no attacking Pokémon, so it counts for no Location objective.
function effectDamage(s, who, space, amount) {
  const card = s.players[who].row[space];
  if (!card || amount <= 0) return;
  card.currentStrength -= amount;
  card.asleep = false;
  emit(s, 'effectDamage', { who, space, amount, name: card.name });
  log(s, `${owner(who)} ${card.name} took ${amount} damage.`);
  defeat(s, who, space);
}

// Heal: Rain 2 heals 1 more; Drought (Sun 8) stops all healing. Never above its Strength.
function healPokemon(s, who, space, amount) {
  const card = s.players[who].row[space];
  if (!card || bracket(s, 'Sun', 8)) return 0;
  const n = Math.min(card.strength - card.currentStrength, amount + (bracket(s, 'Rain', 2) ? 1 : 0));
  if (n <= 0) return 0;
  card.currentStrength += n;
  emit(s, 'healed', { who, space, amount: n, name: card.name });
  return n;
}

const regenerateOf = (card) => card.keywords.reduce((n, k) => n + (Number(/^Regenerate (\d+)$/.exec(k)?.[1]) || 0), 0);

// At Supper, before hands are discarded: Downpour (Rain 8) removes all Burn; then
// Burn (Pokémon take damage; a player character loses that much Recognition, never
// below 0; Rain 4: 1 less), each Burn then losing 1; then Leech Seed (1 damage, or 2
// at Rain 6, healing the seeder's most-damaged Pokémon as much).
function statusesAtSupper(s) {
  const burnable = PLAYERS.flatMap((who) => [s.players[who], ...pokemonOf(s, who).map(({ card }) => card)]);
  if (bracket(s, 'Rain', 8) && burnable.some((c) => c.burn)) {
    for (const c of burnable) c.burn = 0;
    log(s, 'Downpour: all Burn is washed away.');
  }
  const less = bracket(s, 'Rain', 4) ? 1 : 0;
  for (const who of PLAYERS) {
    const p = s.players[who];
    if (p.burn) {
      const loss = Math.min(p.recognition, Math.max(0, p.burn - less));
      p.recognition -= loss;
      p.burn -= 1;
      emit(s, 'burnRecognition', { who, amount: loss, total: p.recognition, burn: p.burn });
      log(s, `Burn: ${who === 'player' ? 'you lose' : 'the Opponent loses'} ${loss} Recognition (now ${p.recognition}).`);
    }
    for (const { space, card } of pokemonOf(s, who)) {
      if (!card.burn) continue;
      const dmg = Math.max(0, card.burn - less);
      card.burn -= 1;
      effectDamage(s, who, space, dmg);
    }
  }
  const drain = bracket(s, 'Rain', 6) ? 2 : 1;
  for (const who of PLAYERS) {
    for (const { space, card } of pokemonOf(s, who)) {
      if (!card.seededBy) continue;
      const seeder = card.seededBy;
      effectDamage(s, who, space, drain);
      const hurt = pokemonOf(s, seeder).filter(({ card: c }) => c.currentStrength < c.strength)
        .sort((a, b) => (b.card.strength - b.card.currentStrength) - (a.card.strength - a.card.currentStrength) || a.space - b.space)[0];
      if (hurt) healPokemon(s, seeder, hurt.space, drain);
    }
  }
}

// --- Items (V4) ---------------------------------------------------------------------------------

// Find an Item: the next one from the shared pool into your Bag (if it has room).
function findItem(s, who) {
  const p = s.players[who];
  if (!s.itemPool.length) { log(s, 'The Item pool is empty: nothing found.'); return; }
  if (p.bag.length >= BAG_SIZE) { log(s, `${p.name}: the Bag is full, so the Item stays where it is.`); return; }
  const card = s.itemPool.shift();
  p.bag.push(card);
  emit(s, 'itemFound', { who, uid: card.uid, name: card.name });
  log(s, `${p.name} found ${card.name} (into the Bag).`);
}

// A used or lost Item goes back into the shared pool (shuffled in).
function returnToPool(s, card) {
  s.itemPool.push({ ...card });
  s.itemPool = shuffle(s, s.itemPool);
}

// Use an Item: a Held Item attaches to the chosen friendly Pokémon (one each; an
// old one goes to the pool); a Consumed Item resolves, then goes to the pool.
function useItemCard(s, who, card, targets) {
  emit(s, 'itemUsed', { who, uid: card.uid, name: card.name, kind: card.kind });
  if (card.kind === 'Held') {
    const [t] = chooseTargets(s, who, card.target, targets);
    const holder = s.players[t.who].row[t.space];
    if (holder.held) { removeHeld(holder); returnToPool(s, holder.held); }
    holder.held = { ...card };
    applyHeld(holder, card, true);
    log(s, `${owner(t.who)} ${holder.name} now holds ${card.name} (${card.text.replace(/^Held: /, '')}).`);
    return;
  }
  log(s, `${NAMES[who]} used ${card.name}: ${card.text}`);
  runEffect(s, who, card.target, card.ops, targets);
  returnToPool(s, card);
}

function applyHeld(card, item, fresh = false) {
  const h = item.held ?? {};
  card.attack += h.attack ?? 0;
  card.strength += h.strength ?? 0;
  if (fresh) card.currentStrength += h.strength ?? 0;
  card.keywords = [...new Set([...card.keywords, ...(h.keywords ?? [])])];
}
function removeHeld(card) {
  const h = card.held.held ?? {};
  card.attack -= h.attack ?? 0;
  card.strength -= h.strength ?? 0;
  card.currentStrength = Math.max(1, Math.min(card.currentStrength, card.strength));
  card.keywords = card.keywords.filter((k) => !(h.keywords ?? []).includes(k));
}

// A card leaving play keeps none of its play-only state.
function plainCard(card) {
  const { currentStrength, spent, arrivedRound, burn, asleep, seededBy, held, ...plain } = card;
  return plain;
}

function emit(s, type, data = {}) {
  s.events.push({ type, ...data });
}
function log(s, line) {
  s.log.push(line);
}
