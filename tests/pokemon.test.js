// Checks the Pokémon card format and the "Play a Pokémon Card" Battle Action.
// Run with: node tests/pokemon.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, playablePokemon, costPreview, emptySpaces, PLAYERS, opponentOf } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { WEATHER_TYPES, POKEMON_CARDS, POKEMON_TYPES, ATTACK_TYPES, STRENGTH_TYPES, SPEED_TIERS, RARITIES } from '../src/engine/cardData.js';

// --- Card format ------------------------------------------------------------

assert.equal(POKEMON_CARDS.length, 16);
assert.equal(new Set(POKEMON_CARDS.map((c) => c.id)).size, 16, 'unique ids');
for (const c of POKEMON_CARDS) {
  assert.equal(c.cardType, 'Pokémon');
  assert.ok(typeof c.name === 'string' && c.name);
  assert.ok(POKEMON_TYPES.includes(c.pokemonType), c.name);
  assert.ok(ATTACK_TYPES.includes(c.attackType), c.name);
  assert.ok(STRENGTH_TYPES.includes(c.strengthType), c.name);
  assert.ok(SPEED_TIERS.includes(c.speedTier), c.name);
  assert.ok(c.rarity in RARITIES, c.name);
  assert.ok(c.energyCost >= 1 && c.energyCost <= 6, `${c.name} cost`);
  assert.ok(c.attackValue >= 2 && c.attackValue <= 7, `${c.name} attack`);
  assert.ok(c.strengthValue >= 4 && c.strengthValue <= 12, `${c.name} strength`);
  assert.ok('image' in c);
  for (const field of ['effectTrigger', 'effectText', 'innatePower']) {
    assert.ok(c[field] === null || typeof c[field] === 'string', `${c.name} ${field}`);
  }
  assert.ok(c.weatherTokens === null
    || Object.entries(c.weatherTokens).every(([type, n]) => WEATHER_TYPES.includes(type) && n >= 1), `${c.name} weather`);
  assert.equal(c.effectTrigger === null, c.effectText === null, 'trigger word and effect text go together');
}
assert.equal(POKEMON_TYPES.length, 18);
assert.deepEqual(new Set(POKEMON_CARDS.map((c) => c.rarity)), new Set(Object.keys(RARITIES)), 'every rarity used');
assert.deepEqual(new Set(POKEMON_CARDS.map((c) => c.energyCost)), new Set([1, 2, 3, 4, 5, 6]), 'costs 1 to 6');

// Each deck holds one of each placeholder Pokémon; both players use the same list.
{
  const s = createGame(1);
  for (const who of PLAYERS) {
    const ids = s.players[who].drawPile.filter((c) => c.cardType === 'Pokémon').map((c) => c.id).sort();
    assert.deepEqual(ids, POKEMON_CARDS.map((c) => c.id).sort());
    assert.equal(s.players[who].drawPile.length, 40);
  }
}

// --- Helpers ----------------------------------------------------------------

function toRound1Battle(seed) {
  let s = createGame(seed);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  // Plain Trainers and no abilities, so these tests check playing Pokémon alone
  // (Trainers and abilities have their own tests).
  for (const who of PLAYERS) for (const t of s.players[who].trainers) { t.power = null; t.passive = null; }
  for (const who of PLAYERS) for (const c of [...s.players[who].drawPile, ...s.players[who].hand, ...s.players[who].discard]) c.ability = null;
  return s;
}

// Replaces a player's hand with the listed card ids, taken from their piles.
function setHand(s, who, ids) {
  const p = s.players[who];
  p.drawPile.push(...p.hand);
  p.hand = ids.map((id) => {
    const i = p.drawPile.findIndex((c) => c.id === id);
    return p.drawPile.splice(i, 1)[0];
  });
  return p.hand.map((c) => c.uid);
}

const play = (s, who, uid, zone, space) => applyAction(s, { type: 'playPokemon', who, uid, zone, space });
const pass = (s) => applyAction(s, { type: 'pass', who: s.turn });

// --- Playing a Pokémon --------------------------------------------------------

// Paid with Base Energy; arrives Spent with its own current Strength; uses the turn.
{
  let s = toRound1Battle(2);
  const me = s.turn;
  const [ember] = setHand(s, me, ['growlithe', 'black-belt']);
  assert.deepEqual(legalActions(s, me), ['pass', 'playPokemon']);
  assert.deepEqual(costPreview(s, me, ember), { fromBase: 1, fromExert: 0 });
  s = play(s, me, ember, 1, 2);
  const placed = s.players[me].zones[1].pokemon[2];
  assert.equal(placed.name, 'Growlithe');
  assert.equal(placed.spent, true, 'arrives Spent');
  assert.equal(placed.currentStrength, 5);
  assert.equal(placed.strengthValue, 5, 'printed value kept separately');
  assert.equal(s.players[me].baseEnergy, 0);
  assert.equal(s.players[me].exhaust.length, 0);
  assert.ok(!s.players[me].hand.some((c) => c.uid === ember), 'left the hand');
  assert.equal(s.turn, opponentOf(me), 'the play used the turn');
  assert.ok(s.log.at(-1).includes('played Growlithe into Zone 2, Space 3, paying 1 Base Energy'));
}

// Exert covers only the shortfall, and becomes Exhaust.
{
  let s = toRound1Battle(3);
  const me = s.turn;
  const [geodude] = setHand(s, me, ['geodude']);  // cost 2; Round 1 has 1 Base + 1 Exert
  assert.deepEqual(costPreview(s, me, geodude), { fromBase: 1, fromExert: 1 });
  s = play(s, me, geodude, 0, 0);
  const p = s.players[me];
  assert.equal(p.baseEnergy, 0);
  assert.deepEqual(p.exhaust.map((x) => [x.position, x.recoversRound]), [[1, 3]]);
  assert.ok(s.log.at(-1).endsWith('paying 1 Base Energy + 1 Exert.'));
}

// Refused: unaffordable, occupied space, not a Pokémon, not in hand, not your turn.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const [goldeen, growlithe, item] = setHand(s, me, ['goldeen', 'growlithe', 'potion']);
  assert.ok(!playablePokemon(s, me).some((c) => c.uid === goldeen), 'cost 3 > 1 Base + 1 Exert');
  assert.throws(() => play(s, me, goldeen, 0, 0), /Not enough Energy/);
  assert.throws(() => play(s, me, item, 0, 0), /Pokémon/);
  assert.throws(() => play(s, me, 'nope', 0, 0), /Pokémon/);
  assert.throws(() => play(s, me, growlithe, 3, 0), /empty/);
  assert.throws(() => play(s, opponentOf(me), growlithe, 0, 0), /cannot/);
  s.players[me].zones[0].pokemon[0] = { name: 'Blocker' };
  assert.throws(() => play(s, me, growlithe, 0, 0), /empty/);
}

// A full arena can't take another Pokémon.
{
  const s = toRound1Battle(5);
  const me = s.turn;
  setHand(s, me, ['growlithe']);
  s.players[me].zones.forEach((z) => { z.pokemon = z.pokemon.map(() => ({ name: 'Blocker', spent: true })); });
  assert.equal(emptySpaces(s, me).length, 0);
  assert.deepEqual(legalActions(s, me), ['pass']);
}

// Playing resets the pass count: a player who passed gets another turn.
// Spent Pokémon become Active at the next Breakfast, keeping current Strength.
{
  let s = toRound1Battle(6);
  const first = s.turn;
  const second = opponentOf(first);
  const [sprout] = setHand(s, second, ['sewaddle']);
  s = pass(s);
  s = play(s, second, sprout, 2, 1);
  assert.equal(s.phase, 'battle');
  assert.equal(s.turn, first, 'the passer gets another turn');
  s = pass(s);
  assert.equal(s.phase, 'battle', 'one pass after a play does not end Battle');
  s.players[second].zones[2].pokemon[1].currentStrength = 1;
  s = pass(s);
  assert.equal(s.round, 2);
  const sewaddle = s.players[second].zones[2].pokemon[1];
  assert.equal(sewaddle.spent, false, 'Active again at Breakfast');
  assert.equal(sewaddle.currentStrength, 1, 'current Strength carries over');
  assert.ok(s.log.some((l) => l.includes('Spent Pokémon became Active: Sewaddle')));
}

// --- AI ---------------------------------------------------------------------

// Plays something it can pay for with Base Energy alone, never using Exert.
for (let seed = 1; seed <= 20; seed++) {
  let s = toRound1Battle(seed);
  s.turn = 'ai';
  setHand(s, 'ai', ['growlithe', 'horsea', 'geodude', 'black-belt']);
  const action = chooseAction(s, 'ai');
  assert.equal(action.type, 'playPokemon');
  s = applyAction(s, action);
  const placed = s.players.ai.zones.flatMap((z) => z.pokemon).filter(Boolean);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].energyCost, 1, 'Geodude would need Exert');
  assert.equal(s.players.ai.exhaust.length, 0);
}

// Passes when only Exert could pay, or with no Pokémon.
{
  const s = toRound1Battle(7);
  s.turn = 'ai';
  setHand(s, 'ai', ['geodude', 'black-belt']);
  assert.ok(playablePokemon(s, 'ai').length, 'Geodude is affordable with Exert...');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' }, '...but the AI will not use Exert');
  setHand(s, 'ai', ['black-belt']);
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });
  assert.equal(chooseAction(s, 'player'), null, 'nothing to do off-turn');
}

console.log('All Pokémon tests passed.');
