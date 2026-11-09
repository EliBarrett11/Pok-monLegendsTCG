// The v4 engine (F1 of 5: the core). docs/v4-foundation-spec.md is the spec (section 16 first).
// Pure: no DOM. applyAction(state, action) returns a new state, with `events` saying what happened.
//
// The battlefield: 9 lanes; each lane has one space per player, facing each other. Lanes not
// covered by a placed Location are the Default Location. F2: Location Cards are placed (no Energy)
// over 2–4 adjacent free lanes on both sides for a set number of Rounds; each has a passive on the
// Pokémon in it and Weather counters of one type; Weather counts combine across placed Locations
// into brackets for both players; at Supper the player with more total Strength in a Location
// dominates it and earns Recognition.
// The Player Character sits outside the battlefield: no Health, no space; damage to it gives the
// attacker's player Recognition. 100 Recognition wins.
//
// A Round: Breakfast (Exhaust recovers, Base Energy = the Round (max 10), Exert maximum grows,
// Spent Pokémon become Active, cards off the battlefield follow the Round's Level, draw 7 less one
// per Retained card; Round 1: draw 7 then a mulligan, as in v1), Battle (alternating turns, one
// action each: Summon, Attack, Retain, Pass; two Passes in a row end it), Supper (the hand is
// discarded except Retained cards). Initiative switches each Round.
import { RULES, SPEEDS, levelFor } from '../rules.js?v=202611091145';
import { nextRandom, shuffle } from './random.js?v=202611091145';
import { newEnergy, refreshEnergy, canPay, payCost, availableExert } from './energy.js?v=202611091145';
import { DEMO_DECK, cardAtRound, pokemonAt, pathDef, locationDef, WEATHER_BRACKETS } from './cards.js?v=202611091145';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'The Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');
const POSS = { player: 'Your', ai: 'The Opponent\'s' };

// --- Setup ---------------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: DEMO_DECK, ai: DEMO_DECK } } = {}) {
  const s = {
    seed, rng: seed >>> 0, round: 1, phase: 'mulligan', turn: null, initiative: null, passesInARow: 0,
    players: {}, locations: [], winner: null, result: null, log: [], events: [],
  };
  for (const who of PLAYERS) {
    s.players[who] = {
      drawPile: shuffle(s, decks[who].map((id, i) => ({ ...cardAtRound(id, 1), uid: `${who}-${i}` }))),
      hand: [], discard: [], released: [], row: Array(RULES.lanes).fill(null),
      ...newEnergy(), recognition: 0, retainedNext: 0, mulliganed: false,
    };
  }
  s.initiative = nextRandom(s) < 0.5 ? 'player' : 'ai';
  for (const who of PLAYERS) {
    refreshEnergy(s.players[who], 1);
    draw(s, who, RULES.handDraw);
  }
  log(s, `Round 1 · Breakfast. Each player draws ${RULES.handDraw}; ${NAMES[s.initiative]} ${s.initiative === 'player' ? 'have' : 'has'} initiative. Mulligan: put any cards back and draw as many.`);
  return s;
}

// --- Reading the state -------------------------------------------------------------------------------

// The Location of a lane: a placed Location, or the Default Location (one Location, F1).
export const locationOf = (s, lane) => s.locations.find((l) => lane >= l.start && lane < l.start + l.width)?.uid ?? 'default';
export const locationAt = (s, lane) => s.locations.find((l) => lane >= l.start && lane < l.start + l.width) ?? null;
export const lanesOf = (l) => Array.from({ length: l.width }, (_, i) => l.start + i);
// The lanes a Location of this width could start at: every lane it covers is free (adapted from
// v2's locationStarts).
export function locationStarts(s, card) {
  const out = [];
  for (let start = 0; start + card.width <= RULES.lanes; start++) {
    if (lanesOf({ start, width: card.width }).every((lane) => !locationAt(s, lane))) out.push(start);
  }
  return out;
}
export const placeable = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Location' && locationStarts(s, c).length);
// Weather: the combined counts per type, and the brackets reached.
export function weatherTotals(s) {
  const t = { Rain: 0, Sun: 0 };
  for (const l of s.locations) t[l.weather.type] += l.weather.count;
  return t;
}
export const activeBrackets = (s) => { const t = weatherTotals(s); return WEATHER_BRACKETS.filter((b) => t[b.type] >= b.at); };
// Dominance: the player with the greater total current Strength in a Location (null on a tie).
export function strengthIn(s, l, who) { return lanesOf(l).reduce((n, i) => n + (s.players[who].row[i]?.currentStrength ?? 0), 0); }
export function dominantOf(s, l) {
  const a = strengthIn(s, l, 'player');
  const b = strengthIn(s, l, 'ai');
  return a > b ? 'player' : b > a ? 'ai' : null;
}
// The cost to summon a card into a space (Route 119's discount).
export function summonCost(s, card, space) {
  const l = space === undefined ? null : locationAt(s, space);
  return Math.max(0, card.cost - (l?.passive.kind === 'discount' ? l.passive.amount : 0));
}
const cheapest = (s, who, card) => Math.min(...emptySpaces(s, who).map((i) => summonCost(s, card, i)));

export const pokemonOf = (s, who) => s.players[who].row.map((card, space) => (card ? { card, space } : null)).filter(Boolean);
const allPokemon = (s) => PLAYERS.flatMap((who) => pokemonOf(s, who).map((p) => ({ ...p, who })));
const speedRank = (card) => SPEEDS.indexOf(card.speed);

// Ready (as in v3): Active, and of the highest Speed among all Active Pokémon on both sides.
export const topSpeed = (s) => Math.max(-1, ...allPokemon(s).filter(({ card }) => !card.spent).map(({ card }) => speedRank(card)));
export const isReady = (s, card) => !!card && !card.spent && speedRank(card) === topSpeed(s);
export const readySpaces = (s, who) => pokemonOf(s, who).filter(({ card }) => isReady(s, card)).map(({ space }) => space);

// Guards (section 16): a Defence Pokémon protects the other Pokémon of its side in the same
// Location (the Default Location counts as one) from Physical attacks, wherever the attacker is:
// a Physical attack on a protected Pokémon must target the guard instead. Special Defence does the
// same against Special attacks. A guard also protects its Player Character from attacks (of the
// matching kind) by Pokémon in the guard's own Location.
const guardFor = (attackType) => (attackType === 'Physical' ? 'Defence' : 'Special Defence');
export function guardOf(s, foe, space, attackType) {
  const kind = guardFor(attackType);
  if (s.players[foe].row[space]?.strengthType === kind) return null;
  const loc = locationOf(s, space);
  const g = pokemonOf(s, foe).find(({ card, space: i }) => i !== space && card.strengthType === kind && locationOf(s, i) === loc);
  return g ?? null;
}
export function playerGuard(s, who, from, foe) {
  const a = s.players[who].row[from];
  const loc = locationOf(s, from);
  return pokemonOf(s, foe).find(({ card, space }) => card.strengthType === guardFor(a.attackType) && locationOf(s, space) === loc) ?? null;
}
export function legalTargets(s, who, from) {
  const a = s.players[who].row[from];
  if (!a) return [];
  const foe = opponentOf(who);
  const out = pokemonOf(s, foe).filter(({ space }) => !guardOf(s, foe, space, a.attackType)).map(({ space }) => ({ kind: 'pokemon', space }));
  if (!playerGuard(s, who, from, foe)) out.push({ kind: 'player' });
  return out;
}
export const attackers = (s, who) => readySpaces(s, who).filter((sp) => legalTargets(s, who, sp).length);

export const emptySpaces = (s, who) => s.players[who].row.map((c, i) => (c ? null : i)).filter((i) => i !== null);
export const summonable = (s, who) => (emptySpaces(s, who).length ? s.players[who].hand.filter((c) => c.cardType === 'Pokémon' && canPay(s.players[who], cheapest(s, who, c))) : []);
export const retainable = (s, who) => (canPay(s.players[who], RULES.retainCost) ? s.players[who].hand.filter((c) => !c.retained) : []);
export const energyLeft = (p) => p.baseEnergy + availableExert(p);

// Passing while your fastest Active Pokémon are faster than all of the opponent's makes them Spent.
export const passEndsPhase = (s) => s.passesInARow >= 1;
export function passSpends(s, who) {
  if (s.phase !== 'battle' || passEndsPhase(s)) return [];
  const top = topSpeed(s);
  if (top < 0) return [];
  const atTop = allPokemon(s).filter(({ card }) => !card.spent && speedRank(card) === top);
  if (atTop.some((p) => p.who !== who)) return [];
  return atTop.map(({ space }) => space);
}

// Why an action can't be taken now (null when it can). For the interface.
export function whyNot(s, who, action, card) {
  const p = s.players[who];
  if (s.phase !== 'battle' || s.turn !== who) return 'Not your turn';
  switch (action) {
    case 'summon':
      if (card.cardType === 'Location') return locationStarts(s, card).length ? null : `No room: needs ${card.width} adjacent free lanes`;
      if (!emptySpaces(s, who).length) return 'No empty space on your side';
      return canPay(p, cheapest(s, who, card)) ? null : `Needs ${cheapest(s, who, card)} Energy · you have ${energyLeft(p)}`;
    case 'retain':
      if (card?.retained) return 'Already Retained';
      return canPay(p, RULES.retainCost) ? null : `Needs ${RULES.retainCost} Energy · you have 0`;
    case 'attack':
      if (!pokemonOf(s, who).length) return 'No Pokémon in play';
      if (!readySpaces(s, who).length) return 'None of your Pokémon is Ready (only the fastest Active Pokémon on the battlefield are)';
      return attackers(s, who).length ? null : 'No legal target';
    default: return null;
  }
}

export function legalActions(s, who) {
  if (s.phase === 'gameOver') return [];
  if (s.phase === 'mulligan') return s.players[who].mulliganed ? [] : ['mulligan'];
  if (s.phase !== 'battle' || s.turn !== who) return [];
  return ['pass', ...(summonable(s, who).length ? ['summon'] : []), ...(placeable(s, who).length ? ['placeLocation'] : []), ...(attackers(s, who).length ? ['attack'] : []), ...(retainable(s, who).length ? ['retain'] : [])];
}
export function actor(s) {
  if (s.phase === 'mulligan') return PLAYERS.find((w) => !s.players[w].mulliganed) ?? null;
  return s.phase === 'battle' ? s.turn : null;
}

// --- Actions -----------------------------------------------------------------------------------------

export function applyAction(state, action) {
  const s = structuredClone(state);
  s.events = [];
  if (!legalActions(s, action.who).includes(action.type)) throw new Error(`${action.who} cannot ${action.type} now`);
  ACTIONS[action.type](s, action);
  syncBonuses(s);
  return s;
}

const ACTIONS = {
  // Round 1 (v1): put any number of cards from your hand into your Discard Pile, then draw as many.
  mulligan(s, { who, cards = [] }) {
    const p = s.players[who];
    const back = p.hand.filter((c) => cards.includes(c.uid));
    p.hand = p.hand.filter((c) => !back.includes(c));
    p.discard.push(...back);
    draw(s, who, back.length);
    p.mulliganed = true;
    if (back.length) log(s, `${NAMES[who]} mulliganed ${back.length} card${back.length === 1 ? '' : 's'}.`);
    if (PLAYERS.every((w) => s.players[w].mulliganed)) beginBattle(s);
  },

  // Summon a Pokémon from hand into an empty space on your side, paying its cost at its Level now.
  // It's a snapshot: on the battlefield its Level, form and stats stay as they were. Arrives Spent.
  summon(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!(space >= 0 && space < RULES.lanes) || p.row[space]) throw new Error('Choose an empty space on your side');
    const cost = summonCost(s, card, space);
    if (!canPay(p, cost)) throw new Error(`${card.name} costs ${cost} Energy`);
    const paid = payCost(p, cost, s.round);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...snap } = card;
    p.row[space] = { ...snap, currentStrength: card.strength, spent: true, summonedRound: s.round, bonusAttack: 0, bonusStrength: 0 };
    emit(s, 'summoned', { who, space, name: card.name, level: card.level, cost, exert: paid.fromExert });
    log(s, `${NAMES[who]} summoned ${card.name} (Level ${card.level}) into lane ${space + 1} for ${cost} Energy${paid.fromExert ? ` (${paid.fromExert} Exert)` : ''}.`);
    if (card.onSummon) runOps(s, who, card.onSummon);
    endTurn(s, who, false);
  },

  // Place Location (no Energy, as in v2): over 2–4 adjacent free lanes on both sides, from `start`
  // to the right. Pokémon already there are now in it.
  placeLocation(s, { who, uid, start }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Location') throw new Error('Choose a Location from your hand');
    if (!locationStarts(s, card).includes(start)) throw new Error(`${card.name} needs ${card.width} adjacent free lanes there`);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...plain } = card;
    s.locations.push({ uid: `loc-${uid}`, owner: who, card: plain, id: card.id, name: card.name, art: card.art, color: card.color, start, width: card.width,
      roundsLeft: card.rounds, weather: card.weather, passive: card.passive, placedRound: s.round });
    emit(s, 'locationPlaced', { who, id: card.id, start, width: card.width });
    log(s, `${NAMES[who]} placed ${card.name} over lanes ${start + 1}–${start + card.width} (${card.rounds} Rounds; ${card.weather.count} ${card.weather.type}).`);
    endTurn(s, who, false);
  },

  // Attack ("Command a Pokémon"): a Ready Pokémon attacks an enemy Pokémon or the enemy Player
  // Character, subject to guards. A Ready target hits back (a trade); both become Spent.
  attack(s, { who, from, target }) {
    const p = s.players[who];
    const foe = opponentOf(who);
    const a = p.row[from];
    if (!a || !isReady(s, a)) throw new Error('Choose one of your Ready Pokémon');
    if (!legalTargets(s, who, from).some((t) => t.kind === target?.kind && t.space === target.space)) throw new Error('That target is guarded or not there');
    const hit = damageOf(s, a);
    if (target.kind === 'player') {
      a.spent = true;
      emit(s, 'attack', { who, from, target, amount: hit });
      log(s, `${POSS[who]} ${a.name} attacked ${who === 'player' ? 'the Opponent' : 'you'} for ${hit}.`);
      gainRecognition(s, who, hit * RULES.perDamageToPlayer, `${a.name}'s attack`);
      return endTurn(s, who, false);
    }
    const d = s.players[foe].row[target.space];
    const trades = isReady(s, d);
    const back = trades ? damageOf(s, d) : 0;
    d.currentStrength -= hit;
    if (trades) a.currentStrength -= back;
    a.spent = true;
    if (trades) d.spent = true;
    emit(s, 'attack', { who, from, target, amount: hit, back });
    log(s, `${POSS[who]} ${a.name} attacked ${d.name} for ${hit}${trades ? `; ${d.name} was Ready and hit back for ${back}` : ''}.`);
    if (d.currentStrength <= 0) defeat(s, foe, target.space, who);
    if (a.currentStrength <= 0) defeat(s, who, from, foe);
    endTurn(s, who, false);
  },

  // Retain: pay 1 Energy to keep a card in hand through Supper; draw one fewer next Breakfast.
  retain(s, { who, uid }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.retained) throw new Error('Choose a card in your hand that isn\'t Retained yet');
    payCost(p, RULES.retainCost, s.round);
    card.retained = true;
    emit(s, 'retained', { who, uid });
    log(s, `${NAMES[who]} Retained a card (1 Energy): one fewer card next Breakfast.`);
    endTurn(s, who, false);
  },

  // Pass (v1): +1 Base Energy, unless it is the second of two Passes in a row (that ends the Battle
  // Phase). Passing with unmatched Speed makes your fastest Active Pokémon Spent (v3).
  pass(s, { who }) {
    const p = s.players[who];
    const ends = passEndsPhase(s);
    const spends = passSpends(s, who);
    if (!ends) {
      p.baseEnergy += RULES.passEnergy;
      for (const space of spends) p.row[space].spent = true;
    }
    emit(s, 'pass', { who, endsPhase: ends, spends });
    log(s, ends ? `${NAMES[who]} passed: the Battle Phase ends.` : `${NAMES[who]} passed: +${RULES.passEnergy} Base Energy${spends.length ? ` (${spends.length} became Spent: unmatched Speed)` : ''}.`);
    endTurn(s, who, true);
  },
};

// An attack's damage: its Attack, +1 for a Physical attack in Sun 2.
export const damageOf = (s, card) => card.attack + (card.attackType === 'Physical' ? activeBrackets(s).filter((b) => b.kind === 'physical').reduce((n, b) => n + b.amount, 0) : 0);

// Location passives and Weather brackets that change stats (+Attack, +Strength), kept in step with
// the board after every action (adapted from v2's syncPassives). Losing a Strength bonus never
// defeats a Pokémon (at least 1 Strength is left).
export function wantedBonus(s, space) {
  const l = locationAt(s, space);
  const br = activeBrackets(s);
  const sum = (kind) => (l?.passive.kind === kind ? l.passive.amount : 0) + br.filter((b) => b.kind === kind).reduce((n, b) => n + b.amount, 0);
  return { attack: sum('attack'), strength: sum('strength') };
}
export function syncBonuses(s) {
  for (const who of PLAYERS) {
    for (const { card, space } of pokemonOf(s, who)) {
      const want = wantedBonus(s, space);
      card.attack += want.attack - (card.bonusAttack ?? 0);
      card.bonusAttack = want.attack;
      const d = want.strength - (card.bonusStrength ?? 0);
      if (d) {
        card.strength += d;
        card.currentStrength = d > 0 ? card.currentStrength + d : Math.max(1, Math.min(card.currentStrength, card.strength));
        card.bonusStrength = want.strength;
      }
    }
  }
}

function heal(card, n) { card.currentStrength = Math.min(card.strength, card.currentStrength + n); }

function runOps(s, who, ops) {
  const foe = opponentOf(who);
  for (const o of ops) {
    if (s.phase === 'gameOver') return;
    if (o.op === 'draw') draw(s, who, o.amount);
    else if (o.op === 'damageAll') {
      for (const { card, space } of pokemonOf(s, foe)) {
        card.currentStrength -= o.amount;
        if (card.currentStrength <= 0) defeat(s, foe, space, who);
      }
    } else throw new Error(`Unknown op ${o.op}`);
  }
}

// A Pokémon at 0 Strength or less is defeated: it goes to its owner's Released Pile.
function defeat(s, who, space, by) {
  const card = s.players[who].row[space];
  if (!card) return;
  s.players[who].row[space] = null;
  s.players[who].released.push(card);
  emit(s, 'defeated', { who, space, name: card.name, by });
  log(s, `${POSS[who]} ${card.name} was defeated.`);
  gainRecognition(s, by, RULES.perDefeat, `defeating ${card.name}`);
}

function endTurn(s, who, passed) {
  if (s.phase === 'gameOver') return;
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
}

// --- Recognition and winning ------------------------------------------------------------------------

export function gainRecognition(s, who, amount, source) {
  if (amount <= 0 || s.phase === 'gameOver') return;
  const p = s.players[who];
  p.recognition += amount;
  emit(s, 'recognition', { who, amount, total: p.recognition, source });
  log(s, `${NAMES[who]}: +${amount} Recognition (${source}), now ${p.recognition}.`);
  if (p.recognition >= RULES.win) {
    s.phase = 'gameOver';
    s.winner = who;
    s.turn = null;
    s.result = { winner: who, round: s.round };
    emit(s, 'gameOver', { winner: who });
    log(s, `${NAMES[who]} reached ${RULES.win} Recognition: Pokémon League Champion!`);
  }
}

// --- Phases -----------------------------------------------------------------------------------------

function beginBattle(s) {
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  emit(s, 'battle', { round: s.round });
}

// Draw n (v1): if the Draw Pile is empty, shuffle the Discard Pile into it; if both are empty, stop.
function draw(s, who, n) {
  const p = s.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) return;
      p.drawPile = shuffle(s, p.discard.map((c) => ({ ...cardAtRound(c.id, s.round), uid: c.uid })));
      p.discard = [];
      emit(s, 'reshuffled', { who });
      log(s, `${NAMES[who]} shuffled the Discard Pile into a new Draw Pile.`);
    }
    p.hand.push(p.drawPile.shift());
  }
}

// Supper: the hand goes to the Discard Pile, except Retained cards.
function supper(s) {
  emit(s, 'supper', { round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  // Dominance: for each placed Location, the player with more total Strength there earns Recognition.
  for (const l of [...s.locations]) {
    const d = dominantOf(s, l);
    if (d) {
      emit(s, 'dominance', { who: d, uid: l.uid });
      gainRecognition(s, d, RULES.perDominance, `dominating ${l.name}`);
      if (s.phase === 'gameOver') return;
    }
  }
  // Durations: each placed Location counts down; at 0 it's removed (its lanes are Default again,
  // its card goes to its owner's Discard Pile; Pokémon there stay where they are).
  for (const l of [...s.locations]) {
    l.roundsLeft -= 1;
    if (l.roundsLeft > 0) continue;
    s.locations = s.locations.filter((x) => x !== l);
    s.players[l.owner].discard.push(l.card);
    emit(s, 'locationRemoved', { uid: l.uid, id: l.id });
    log(s, `${l.name} leaves: its lanes are the Default Location again.`);
  }
  syncBonuses(s);
  for (const who of PLAYERS) {
    const p = s.players[who];
    const kept = p.hand.filter((c) => c.retained);
    p.discard.push(...p.hand.filter((c) => !c.retained));
    p.hand = kept;
    p.retainedNext = kept.length;
  }
  startRound(s, s.round + 1);
}

// Breakfast: Exhaust recovers, Base Energy and the Exert maximum are set (v1); Spent Pokémon become
// Active; Pokémon cards off the battlefield (hand, Draw and Discard Piles) gain their Level for this
// Round; each player draws 7, less one per card Retained.
function startRound(s, round) {
  s.round = round;
  s.initiative = opponentOf(s.initiative);
  emit(s, 'breakfast', { round });
  log(s, `Round ${round} · Breakfast.`);
  for (const who of PLAYERS) {
    const p = s.players[who];
    const recovered = refreshEnergy(p, round);
    if (recovered.length) log(s, `${NAMES[who]}: ${recovered.length} Exhaust recovered into Exert.`);
    for (const { card } of pokemonOf(s, who)) card.spent = false;
    // Breakfast heals: Lake of Rage's passive, Rain 2.
    const rain = activeBrackets(s).filter((b) => b.kind === 'healAll').reduce((n, b) => n + b.amount, 0);
    for (const { card, space } of pokemonOf(s, who)) {
      const l = locationAt(s, space);
      const n = rain + (l?.passive.kind === 'heal' ? l.passive.amount : 0);
      if (n) heal(card, n);
    }
    for (const pile of ['hand', 'drawPile', 'discard']) p[pile] = p[pile].map((c) => (c.cardType === 'Pokémon' ? { ...cardAtRound(c.id, round), uid: c.uid, ...(c.retained ? { retained: false } : {}) } : c));
    for (const c of p.hand) c.retained = false;
    draw(s, who, Math.max(0, RULES.handDraw - p.retainedNext));
    p.retainedNext = 0;
  }
  syncBonuses(s);
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
}

function emit(s, type, data = {}) { s.events.push({ type, ...data }); }
function log(s, line) { s.log.push(line); }

export { levelFor, pokemonAt, pathDef, availableExert };
