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
  LANES, RECOGNITION_TARGET, HAND_SIZE, STORE_LIMIT, PASS_ENERGY, ROUND_LIMIT, CHAMPIONSHIP_ROUND, baseEnergyFor,
} from './rules.js';
import { TEST_DECK, cardDef, SPEEDS } from './cards.js';
import { OBJECTIVES, CHAMPIONSHIP, rewardText } from './locations.js';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');

// --- Setup ---------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: TEST_DECK, ai: TEST_DECK } } = {}) {
  const state = {
    seed, rng: seed >>> 0, round: 0, phase: 'initiative', turn: null, initiative: null, passesInARow: 0,
    winner: null, result: null, suddenDeath: false, locations: [], nextLocation: 0, players: {}, log: [], events: [],
  };
  for (const who of PLAYERS) {
    state.players[who] = {
      name: NAMES[who],
      drawPile: shuffle(state, buildDeck(who, decks[who])),
      hand: [], discard: [], released: [],
      row: Array(LANES).fill(null),
      energy: 0, roundEnergy: 0, stored: 0, bonusNext: 0, bonus: 0, recognition: 0,
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

export function legalActions(state, who) {
  if (state.phase === 'initiative') return ['flipCoin'];
  if (state.phase !== 'battle' || state.turn !== who) return [];
  return [
    'pass',
    ...(playable(state, who).length ? ['summon'] : []),
    ...(placeable(state, who).length ? ['playLocation'] : []),
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
      progressAll(s, who, 'damage', amount);
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
    progressAt(s, who, 'attack', from);
    defeat(s, foe, target.space, who);
    defeat(s, who, from, foe);
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
// The defeat counts for `by` (the attacker, or the Alert defender that hit back).
function defeat(s, who, space, by) {
  const card = s.players[who].row[space];
  if (!card || card.currentStrength > 0) return;
  s.players[who].row[space] = null;
  const { currentStrength, spent, arrivedRound, ...plain } = card;
  s.players[who].released.push(plain);
  emit(s, 'defeated', { who, space, name: card.name });
  log(s, `${NAMES[who] === 'You' ? 'Your' : "The Opponent's"} ${card.name} was defeated.`);
  if (by) progressAll(s, by, 'defeat', 1);
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

// Progress on objectives that count in a Location's lanes (summon, attack): the Location over `lane`.
function progressAt(s, who, kind, lane) {
  const loc = locationAt(s, lane);
  if (loc && loc.objective.kind === kind) advance(s, who, loc, loc.progress[who] + 1);
}
// Progress on objectives that count anywhere (damage, defeat): every such Location in play.
function progressAll(s, who, kind, amount) {
  for (const loc of [...s.locations]) if (loc.objective.kind === kind && !over(s)) advance(s, who, loc, loc.progress[who] + amount);
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
    for (const card of p.row) if (card) card.spent = false;
    draw(s, who, HAND_SIZE);
    p.roundEnergy = baseEnergyFor(round);
    p.bonus = p.bonusNext;
    p.bonusNext = 0;
    p.energy = p.roundEnergy + p.stored + p.bonus;
    log(s, `${p.name}: ${p.roundEnergy} Energy${p.stored ? ` + ${p.stored} stored` : ''}${p.bonus ? ` + ${p.bonus} from milestones` : ''}.`);
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

function emit(s, type, data = {}) {
  s.events.push({ type, ...data });
}
function log(s, line) {
  s.log.push(line);
}
