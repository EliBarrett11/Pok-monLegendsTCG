// The v2 engine core (V1): the board, the match flow, Energy with storing,
// summoning, attacks with the guard rules, and Recognition. No DOM code.
//
// applyAction(state, action) never changes `state`: it returns a new state,
// with `events` saying what just happened (for the screen and the AI).
//
// The board (docs/v2-design.md 1.1): each player has one row of 9 spaces; the
// two rows face each other, so space i on both sides makes lane i. Every lane is
// Home in V1 (Locations come in V2).
//
// The match flow, as in v1: a coin flip for Round 1's initiative, then each Round
//   Breakfast  Spent Pokémon become Active; draw up to 7; Energy = the Round
//              number (up to 10) + any stored Energy
//   Battle     alternating Actions, the player with initiative first: summon a
//              Pokémon, attack with an Alert one, or Pass
//   Supper     the hand is discarded except Retain cards; up to 1 unspent Energy
//              is stored for the next Round
// and initiative switches each Round.
//
// The player character (1.3): each player is a target with no health. Damage
// to the enemy player character gains the attacker's player that much
// Recognition. The first to 60 Recognition wins at once.

import { nextRandom, shuffle } from '../../../src/engine/random.js';
import {
  LANES, RECOGNITION_TARGET, HAND_SIZE, STORE_LIMIT, PASS_ENERGY, baseEnergyFor,
} from './rules.js';
import { TEST_DECK, cardDef, SPEEDS } from './cards.js';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');

// --- Setup ---------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: TEST_DECK, ai: TEST_DECK } } = {}) {
  const state = {
    seed, rng: seed >>> 0, round: 0, phase: 'initiative', turn: null, initiative: null, passesInARow: 0,
    winner: null, players: {}, log: [], events: [],
  };
  for (const who of PLAYERS) {
    state.players[who] = {
      name: NAMES[who],
      drawPile: shuffle(state, buildDeck(who, decks[who])),
      hand: [], discard: [], released: [],
      row: Array(LANES).fill(null),
      energy: 0, roundEnergy: 0, stored: 0, recognition: 0,
    };
  }
  log(state, 'Flip a coin to decide who has initiative in Round 1.');
  return state;
}

// A deck list (id → copies) as cards, each with its own uid.
export function buildDeck(who, list) {
  let n = 0;
  return Object.entries(list).flatMap(([id, copies]) => Array.from({ length: copies }, () => ({ ...cardDef(id), uid: `${who}-${n++}` })));
}

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

export function legalActions(state, who) {
  if (state.phase === 'initiative') return ['flipCoin'];
  if (state.phase !== 'battle' || state.turn !== who) return [];
  return [
    'pass',
    ...(playable(state, who).length ? ['summon'] : []),
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
  summon(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!(space >= 0 && space < LANES) || p.row[space]) throw new Error('Choose an empty space in your row');
    if (card.cost > p.energy) throw new Error(`Not enough Energy for ${card.name}`);
    p.energy -= card.cost;
    p.hand = p.hand.filter((c) => c !== card);
    p.row[space] = { ...card, currentStrength: card.strength, spent: !hasKeyword(card, 'Quick Attack'), arrivedRound: s.round };
    emit(s, 'summoned', { who, uid, name: card.name, space, cost: card.cost });
    log(s, `${p.name} summoned ${card.name} into space ${space + 1} (${card.cost} Energy).`);
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
      return endTurn(s, who, false);
    }
    const defender = s.players[foe].row[target.space];
    const trades = isAlert(s, defender);   // decided before anyone becomes Spent
    defender.currentStrength -= attacker.attack;
    if (trades) attacker.currentStrength -= defender.attack;
    attacker.spent = true;
    if (trades) defender.spent = true;
    emit(s, 'attack', { who, from, target: { kind: 'pokemon', who: foe, space: target.space }, amount: attacker.attack, attacker: attacker.name, defender: defender.name, trades, back: trades ? defender.attack : 0 });
    log(s, `${p.name === 'You' ? 'Your' : "The Opponent's"} ${attacker.name} attacked ${defender.name} for ${attacker.attack}${trades ? `; ${defender.name} was Alert and hit back for ${defender.attack}` : ''}.`);
    defeat(s, foe, target.space);
    defeat(s, who, from);
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
function defeat(s, who, space) {
  const card = s.players[who].row[space];
  if (!card || card.currentStrength > 0) return;
  s.players[who].row[space] = null;
  const { currentStrength, spent, arrivedRound, ...plain } = card;
  s.players[who].released.push(plain);
  emit(s, 'defeated', { who, space, name: card.name });
  log(s, `${NAMES[who] === 'You' ? 'Your' : "The Opponent's"} ${card.name} was defeated.`);
}

function win(s, who) {
  s.phase = 'gameOver';
  s.winner = who;
  s.turn = null;
  emit(s, 'gameOver', { winner: who, recognition: s.players[who].recognition });
  log(s, `${NAMES[who]} reached ${RECOGNITION_TARGET} Recognition and ${who === 'player' ? 'win' : 'wins'}!`);
}

function endTurn(s, who, passed) {
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
  emit(s, 'turnChanged', { who: s.turn });
}

// --- Phases --------------------------------------------------------------------------------------

// Breakfast: Spent Pokémon become Active, each player draws up to 7, and Energy
// is the Round number (up to 10) plus what was stored. Then the Battle Phase.
function startRound(s, round) {
  s.round = round;
  emit(s, 'phaseChanged', { phase: 'breakfast', round });
  log(s, `Round ${round} · Breakfast.`);
  for (const who of PLAYERS) {
    const p = s.players[who];
    for (const card of p.row) if (card) card.spent = false;
    draw(s, who, HAND_SIZE - p.hand.length);
    p.roundEnergy = baseEnergyFor(round);
    p.energy = p.roundEnergy + p.stored;
    log(s, `${p.name}: ${p.roundEnergy} Energy${p.stored ? ` + ${p.stored} stored` : ''}.`);
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
// is stored. Initiative switches, and the next Round begins.
function supper(s) {
  emit(s, 'phaseChanged', { phase: 'supper', round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.discard.push(...p.hand.filter((c) => !c.retain));
    p.hand = p.hand.filter((c) => c.retain);
    p.stored = Math.min(STORE_LIMIT, p.energy);
    if (p.stored) log(s, `${p.name} stored ${p.stored} Energy for the next Round.`);
  }
  s.initiative = opponentOf(s.initiative);
  startRound(s, s.round + 1);
}

function emit(s, type, data = {}) {
  s.events.push({ type, ...data });
}
function log(s, line) {
  s.log.push(line);
}
