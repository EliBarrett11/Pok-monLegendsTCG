// Checks the Pass Action's Base Energy: +1 for every Pass except the one that
// ends the Battle Phase. Run with: node tests/pass.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS, opponentOf, passEndsPhase, PASS_ENERGY } from '../src/engine/game.js';
import { buildDeck } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';

// Setup with both sides keeping their hands, ending at Round 1 Battle.
function toRound1Battle(seed) {
  let s = createGame(seed);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  return s;
}

// A card from a fresh deck, given to a player's hand (so a test can take a
// non-Pass Action: a Location costs no Energy).
let extra = 0;
function give(s, who, test) {
  const card = { ...buildDeck('t').find(test), uid: `t-${extra++}` };
  s.players[who].hand.push(card);
  return card.uid;
}
const isLocation = (c) => c.cardType === 'Location';

assert.equal(PASS_ENERGY, 1);

// --- A Pass that isn't the second in a row: +1 Base Energy; repeated Passes stack ---
{
  let s = toRound1Battle(3);
  const me = s.turn;
  const foe = opponentOf(me);
  const start = s.players[me].baseEnergy;
  assert.equal(passEndsPhase(s), false);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(s.players[me].baseEnergy, start + 1, 'first Pass: +1');
  assert.ok(s.events.some((e) => e.type === 'energyGained' && e.who === me && e.amount === 1 && e.source === 'Pass'));
  assert.ok(s.events.some((e) => e.type === 'pass' && e.gain === 1 && !e.endsPhase));
  assert.equal(s.players[foe].baseEnergy, 1, 'the other player gains nothing');

  // The opponent takes an Action (not a Pass), so my next Pass isn't consecutive.
  const loc = give(s, foe, isLocation);
  s = applyAction(s, { type: 'playLocation', who: foe, uid: loc, zone: 0 });
  assert.equal(passEndsPhase(s), false);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(s.players[me].baseEnergy, start + 2, 'second, non-consecutive Pass stacks: +2 in total');

  // --- The Pass that ends the phase gains nothing ---
  assert.equal(passEndsPhase(s), true);
  const ending = applyAction(s, { type: 'pass', who: foe });
  const passEvent = ending.events.find((e) => e.type === 'pass');
  assert.equal(passEvent.endsPhase, true);
  assert.equal(passEvent.gain, 0);
  assert.ok(!ending.events.some((e) => e.type === 'energyGained' && e.source === 'Pass'), 'no gain for the consecutive Pass');
  assert.equal(ending.round, 2, 'the Battle Phase (and the Round) ended');

  // --- The bonus resets at the next Breakfast ---
  for (const who of PLAYERS) assert.equal(ending.players[who].baseEnergy, 2, 'Round 2 Breakfast: Base Energy is the Round number again');
}

// --- I pass (+1), the opponent passes: the phase ends and the opponent gains nothing ---
{
  let s = toRound1Battle(8);
  const me = s.turn;
  const foe = opponentOf(me);
  s = applyAction(s, { type: 'pass', who: me });
  const gains = (st) => st.events.filter((e) => e.type === 'energyGained' && e.source === 'Pass').map((e) => e.who);
  assert.deepEqual(gains(s), [me]);
  s = applyAction(s, { type: 'pass', who: foe });
  assert.deepEqual(gains(s), [], 'the second Pass in a row gains nothing');
  assert.equal(s.round, 2);
}

// --- The bonus is Base Energy: spent before Exert ---
{
  let s = toRound1Battle(5);
  const me = s.turn;
  const foe = opponentOf(me);
  const p = s.players[me];
  p.baseEnergy = 0;
  assert.equal(p.exertMax - p.exhaust.length, 1, 'Round 1: 1 Exert available');
  const cheap = give(s, me, (c) => c.cardType === 'Pokémon' && c.energyCost === 1);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(s.players[me].baseEnergy, 1);
  s = applyAction(s, { type: 'playLocation', who: foe, uid: give(s, foe, isLocation), zone: 1 });
  s = applyAction(s, { type: 'playPokemon', who: me, uid: cheap, zone: 0, space: 0 });
  assert.equal(s.players[me].baseEnergy, 0, 'the passed Energy paid the cost');
  assert.equal(s.players[me].exhaust.length, 0, 'no Exert spent');
}

// --- It can go above the limit of 10 ---
{
  let s = toRound1Battle(6);
  const me = s.turn;
  s.players[me].baseEnergy = 10;
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(s.players[me].baseEnergy, 11, 'Base Energy from passing can go above 10');
}

// --- The AI passes for Energy when one more would let it play a card ---
{
  let s = toRound1Battle(2);
  const ai = s.turn;
  const foe = opponentOf(ai);
  const p = s.players[ai];
  // Only one card in hand: a 2-cost Pokémon, with 1 Base Energy. Nothing else to do.
  p.hand = [];
  give(s, ai, (c) => c.cardType === 'Pokémon' && c.energyCost === 2);
  p.baseEnergy = 1;
  assert.equal(chooseAction(s, ai, { rng: () => 0.5 }).type, 'pass');
  // After the Pass and an opponent's Action, it can afford it and plays it.
  s = applyAction(s, { type: 'pass', who: ai });
  s = applyAction(s, { type: 'playLocation', who: foe, uid: give(s, foe, isLocation), zone: 2 });
  assert.equal(chooseAction(s, ai, { rng: () => 0.5 }).type, 'playPokemon');
}

console.log('All Pass tests passed.');
