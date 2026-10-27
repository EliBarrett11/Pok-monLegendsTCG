// Checks Weather (docs/decks.md 2.12, the Grass G1 rework): brackets
// switching on and off, and each bracket's mechanic for Sun and Rain. No
// Weather changes a Pokémon's stats by Type any more.
// Run with: node tests/weather.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, attackOf, maxStrengthOf, weatherState, PLAYERS } from '../src/engine/game.js';
import { WEATHER } from '../src/engine/cardData.js';
import { refreshAuras, resolveEffects } from '../src/engine/effects.js';
import { inPlay } from '../src/engine/board.js';
import { trainerOrder, def, testCard, useTestTrainers } from './fixtures.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Test Ash / Test Misty / Test Brock on both sides, empty hands, the player
// to act and to have initiative. Passives off; abilities off unless asked.
function match({ abilities = false } = {}) {
  let s = useTestTrainers(createGame(41));
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: trainerOrder(s, 'player') });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: trainerOrder(s, 'ai') });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    if (!abilities) for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'player';
  s.turn = 'player';
  return s;
}

// Puts a Pokémon straight into the arena (Spent), taken from that player's deck.
function place(s, who, zone, space, id, extra = {}) {
  const p = s.players[who];
  const i = p.drawPile.findIndex((c) => c.id === id);
  const card = i >= 0 ? p.drawPile.splice(i, 1)[0] : { ...def(id), uid: `${who}-${id}-x` };
  p.zones[zone].pokemon[space] = { ...inPlay(card, { spent: true }), ...extra };
  refreshAuras(s);
  return p.zones[zone].pokemon[space];
}

// Sets the Weather counts with test Locations carrying the tokens.
function weather(s, { Rain = 0, Sun = 0 }) {
  const testLocation = (tokens) => ({ uid: `wx-${JSON.stringify(tokens)}`, name: 'Weather test', cardType: 'Location', weatherTokens: tokens, quest: null });
  s.players.player.zones[0].location = Rain ? testLocation({ Rain }) : null;
  s.players.player.zones[1].location = Sun ? testLocation({ Sun }) : null;
  refreshAuras(s);
}

// Resolves effects for `who` straight away (a test source).
const cast = (s, who, effects, target) => resolveEffects(s, { who, source: { kind: 'test', owner: who, name: 'Test' }, label: 'Test', target }, effects);
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const tref = (owner, zone) => ({ kind: 'trainer', owner, zone });
const burnOf = (c) => c?.status?.burn?.count ?? 0;
const ENEMY = { mode: 'targeted', side: 'opponent', kinds: ['pokemon', 'trainer'] };
const FRIEND = { mode: 'targeted', side: 'friendly', kinds: ['pokemon', 'trainer'] };

const stats = (c) => [attackOf(c), c.currentStrength, maxStrengthOf(c)];
const logged = (s, text) => s.log.some((l) => l.includes(text));
const logIndex = (s, text) => s.log.findIndex((l) => l.includes(text));

function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}

// --- Data -------------------------------------------------------------------

for (const [type, def] of Object.entries(WEATHER)) {
  assert.deepEqual(def.brackets.map((b) => b.at), [2, 4, 6, 8], type);
  for (const b of def.brackets) assert.ok(b.mode === 'also' && b.text, `${type} ${b.at}: every bracket adds to the ones below`);
  assert.ok(def.brackets.every((b) => !b.stats), `${type}: no Type-based stat changes`);
}
assert.deepEqual(WEATHER.Sun.brackets.map((b) => b.rule ?? 'timed'), ['burnPlus', 'timed', 'noSleep', 'drought']);
assert.deepEqual(WEATHER.Rain.brackets.map((b) => b.rule ?? 'timed'), ['healPlus', 'burnMinus', 'leechTwo', 'timed']);

// --- No Type-based Weather any more ----------------------------------------------

{
  const s = match();
  const pud = place(s, 'player', 2, 0, 'test-ripple');   // Water 2/6
  const ember = place(s, 'ai', 2, 1, 'test-flame');      // Fire 3/5
  for (const counts of [{ Rain: 8 }, { Sun: 8 }, { Rain: 8, Sun: 8 }]) {
    weather(s, counts);
    assert.deepEqual(stats(pud), [2, 6, 6], `${JSON.stringify(counts)}: Water unchanged`);
    assert.deepEqual(stats(ember), [3, 5, 5], `${JSON.stringify(counts)}: Fire unchanged`);
  }
  weather(s, { Rain: 0 });
  weather(s, { Rain: 2 });
  assert.ok(logged(s, 'Weather: ☔ Rain 2 is now active (Rain 2). Each heal is increased by 1.'));
  weather(s, { Rain: 4 });
  weather(s, { Rain: 3 });
  assert.ok(logged(s, 'Weather: ☔ Rain 4 has ended (Rain 3).'));
  weather(s, { Rain: 0 });
  assert.deepEqual(weatherState(s).Rain.active, []);
}

// --- ☀ Sun 2: each Burn applied is increased by 1 -----------------------------------

{
  const s = match();
  const foe = place(s, 'ai', 0, 0, 'test-mud');
  weather(s, { Sun: 1 });
  cast(s, 'player', [{ op: 'burn', amount: 1, target: ENEMY }], pref('ai', 0, 0));
  assert.equal(burnOf(foe), 1, 'below 2: Burn 1');
  weather(s, { Sun: 2 });
  cast(s, 'player', [{ op: 'burn', amount: 1, target: ENEMY }], pref('ai', 0, 0));
  assert.equal(burnOf(foe), 1 + 2, 'Sun 2: Burn 1 becomes Burn 2');
  cast(s, 'player', [{ op: 'burn', amount: 2, target: ENEMY }], tref('ai', 1));
  assert.equal(burnOf(s.players.ai.zones[1].trainer), 3, 'on Trainers too');
  assert.ok(logged(s, 'Weather (☀ Sun 2): Burn +1.'));
}

// --- ☀ Sun 4: at Breakfast, each player gains +1 Growth ------------------------------

{
  let s = match({ abilities: true });
  place(s, 'player', 0, 1, 'test-fin');   // On Breakfast ability
  weather(s, { Sun: 4 });
  assert.deepEqual(PLAYERS.map((w) => s.players[w].growth), [0, 0]);
  s = nextRound(s);
  assert.deepEqual(PLAYERS.map((w) => s.players[w].growth), [1, 1], 'both players');
  const sun = logIndex(s, 'You gain 1 Growth from Weather (☀ Sun 4)');
  assert.ok(sun > logIndex(s, 'You drew 7 cards'), 'after cards are drawn');
  assert.ok(sun < logIndex(s, "Your Test Fin's On Breakfast"), 'before same-moment abilities');
  s = nextRound(s);
  assert.deepEqual(PLAYERS.map((w) => s.players[w].growth), [2, 2], 'Growth carries over and builds');
}

// --- ☀ Sun 6: Sleep can't be applied ----------------------------------------------------

{
  const s = match();
  const foe = place(s, 'ai', 0, 0, 'test-mud', { spent: false });
  weather(s, { Sun: 6 });
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], pref('ai', 0, 0));
  assert.equal(foe.status?.sleep, undefined, 'not Asleep');
  assert.equal(foe.spent, false, 'and not Spent');
  assert.ok(logged(s, "can't be put to Sleep (☀ Sun 6)"));
  weather(s, { Sun: 5 });
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], pref('ai', 0, 0));
  assert.ok(foe.status.sleep && foe.spent, 'below 6 it works');
}

// --- ☀ Sun 8 (Drought): no healing of any kind -------------------------------------------

{
  let s = match();
  const mine = place(s, 'player', 0, 0, 'test-mud', { innatePower: 'Regenerate 2' });
  mine.currentStrength = 2;
  const seeded = place(s, 'ai', 1, 0, 'test-mud');
  weather(s, { Sun: 8 });
  cast(s, 'player', [{ op: 'heal', amount: 3, target: FRIEND }], pref('player', 0, 0));
  assert.equal(mine.currentStrength, 2, 'an effect heals nothing');
  assert.ok(logged(s, "Drought (☀ Sun 8): your Test Mud (Zone 1, Space 1) can't be healed."));
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], pref('ai', 1, 0));
  s = nextRound(s);
  const after = s.players.player.zones[0].pokemon[0];
  assert.equal(after.currentStrength, 2, 'Regenerate and Leech Seed heal nothing');
  assert.equal(s.players.ai.zones[1].pokemon[0].currentStrength, seeded.currentStrength - 1, 'Leech Seed still drains');
  assert.equal(s.players.player.growth, 1 + 1, 'and still gives Growth (plus Sun 4)');
}

// --- ☔ Rain 2: each heal is increased by 1 -------------------------------------------------

{
  let s = match();
  const mine = place(s, 'player', 0, 0, 'test-mud', { innatePower: 'Regenerate 1' });   // 4/8
  mine.currentStrength = 1;
  weather(s, { Rain: 2 });
  cast(s, 'player', [{ op: 'heal', amount: 2, target: FRIEND }], pref('player', 0, 0));
  assert.equal(mine.currentStrength, 1 + 3, 'heal 2 heals 3');
  s.players.player.zones[1].trainer.strength = 5;
  cast(s, 'player', [{ op: 'heal', amount: 1, target: FRIEND }], tref('player', 1));
  assert.equal(s.players.player.zones[1].trainer.strength, 7, 'Trainers too');
  s = nextRound(s);
  assert.equal(s.players.player.zones[0].pokemon[0].currentStrength, 4 + 2, 'Regenerate 1 heals 2');
  mine.currentStrength = 8;
  cast(s, 'player', [{ op: 'heal', amount: 2, target: FRIEND }], pref('player', 0, 0));
  assert.equal(s.players.player.zones[0].pokemon[0].currentStrength, 8, 'never above maximum');
}

// --- ☔ Rain 4: Burn deals 1 less damage at Supper (minimum 0) --------------------------------

{
  let s = match();
  const two = place(s, 'ai', 0, 0, 'test-mud');   // 8
  const one = place(s, 'ai', 0, 1, 'test-mud');
  cast(s, 'player', [{ op: 'burn', amount: 2, target: ENEMY }], pref('ai', 0, 0));
  cast(s, 'player', [{ op: 'burn', amount: 1, target: ENEMY }], pref('ai', 0, 1));
  weather(s, { Rain: 4 });
  s = nextRound(s);
  const [a, b] = s.players.ai.zones[0].pokemon;
  assert.equal(a.currentStrength, two.currentStrength - 1, 'Burn 2 deals 1');
  assert.equal(b.currentStrength, one.currentStrength, 'Burn 1 deals 0');
  assert.deepEqual([burnOf(a), burnOf(b)], [1, 0], 'Burn still fades by 1');
  assert.ok(logged(s, 'Burn 1: no damage to'));
}

// --- ☔ Rain 6: Leech Seed drains 2 instead of 1 ----------------------------------------------

{
  let s = match();
  const foe = place(s, 'ai', 0, 0, 'test-mud');                 // 8
  const hurt = place(s, 'player', 1, 0, 'test-mud');
  hurt.currentStrength = 2;
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], pref('ai', 0, 0));
  weather(s, { Rain: 6 });
  s = nextRound(s);
  assert.equal(s.players.ai.zones[0].pokemon[0].currentStrength, foe.currentStrength - 2, '2 damage');
  // (Rain 6 is also Rain 2: each heal +1, so the drain heals 3.)
  assert.equal(s.players.player.zones[1].pokemon[0].currentStrength, 2 + 2 + 1, 'heals 2, +1 for Rain 2');
  assert.equal(s.players.player.growth, 1, 'still +1 Growth');
  assert.ok(logged(s, 'Leech Seed (☔ Rain 6: drains 2)'));
}

// --- ☔ Rain 8 (Downpour): at Supper, before Burn, all Burn is removed ----------------------------

{
  let s = match();
  const foe = place(s, 'ai', 0, 0, 'test-mud');
  const mine = place(s, 'player', 0, 0, 'test-mud', {
    effectTrigger: 'On Supper', effectText: 'Draw 1.', ability: { on: 'supper', match: { self: true }, effects: [{ op: 'draw', amount: 1 }] },
  });
  cast(s, 'player', [{ op: 'burn', amount: 3, target: ENEMY }], pref('ai', 0, 0));
  cast(s, 'ai', [{ op: 'burn', amount: 2, target: ENEMY }], pref('player', 0, 0));
  cast(s, 'ai', [{ op: 'burn', amount: 2, target: ENEMY }], tref('player', 2));
  weather(s, { Rain: 8 });
  const trainer = s.players.player.zones[2].trainer.strength;
  s = nextRound(s);
  assert.equal(s.players.ai.zones[0].pokemon[0].currentStrength, foe.currentStrength, 'no Burn damage');
  assert.equal(s.players.player.zones[0].pokemon[0].currentStrength, mine.currentStrength, 'either side');
  assert.equal(s.players.player.zones[2].trainer.strength, trainer, 'Trainers too');
  assert.deepEqual([burnOf(s.players.ai.zones[0].pokemon[0]), burnOf(s.players.player.zones[2].trainer)], [0, 0], 'all Burn removed');
  const rain = logIndex(s, 'Weather (☔ Rain 8): Douse');
  assert.ok(rain >= 0);
  assert.ok(rain < logIndex(s, "Your Test Mud's On Supper"), 'before same-moment abilities');
}

// --- Through play: real Locations and summons ----------------------------------

{
  let s = match();
  const give = (who, id) => {
    const p = s.players[who];
    const i = p.drawPile.findIndex((c) => c.id === id);
    p.hand.push(i >= 0 ? p.drawPile.splice(i, 1)[0] : testCard(id));
    return p.hand.at(-1).uid;
  };
  const act = (who, action) => { s.turn = who; s.passesInARow = 0; s.players[who].baseEnergy = 10; s = applyAction(s, { who, ...action }); };
  act('player', { type: 'playLocation', uid: give('player', 'cerulean-cape'), zone: 0 });
  act('ai', { type: 'playLocation', uid: give('ai', 'cerulean-cape'), zone: 0 });
  assert.equal(weatherState(s).Rain.count, 4);
  act('player', { type: 'playPokemon', uid: give('player', 'test-fin'), zone: 1, space: 0 });
  assert.deepEqual(stats(s.players.player.zones[1].pokemon[0]), [4, 7, 7], 'summoned into Rain 4: unchanged (no Type bonus)');
}

console.log('All Weather tests passed.');
