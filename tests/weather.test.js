// Checks Weather effects: brackets switching on and off, "instead" vs
// "also", continuous stat modifiers, and timed effects at Breakfast / Supper.
// Run with: node tests/weather.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, attackOf, maxStrengthOf, weatherState, PLAYERS } from '../src/engine/game.js';
import { WEATHER } from '../src/engine/cardData.js';
import { refreshAuras } from '../src/engine/effects.js';
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
  for (const b of def.brackets) assert.ok(['also', 'instead'].includes(b.mode) && b.text);
}

// --- Rain brackets ------------------------------------------------------------

{
  const s = match();
  const pud = place(s, 'player', 2, 0, 'test-ripple');   // Water 2/6
  const ember = place(s, 'player', 2, 1, 'test-flame'); // Fire 3/5
  weather(s, { Rain: 1 });
  assert.deepEqual(stats(pud), [2, 6, 6], 'below 2: nothing');
  weather(s, { Rain: 2 });
  assert.deepEqual(stats(pud), [3, 6, 6], 'Rain 2: Water +1 Attack');
  assert.ok(logged(s, 'Weather: ☔ Rain 2 is now active (Rain 2). Water Pokémon gain +1 Attack.'));
  weather(s, { Rain: 4 });
  assert.deepEqual(stats(pud), [3, 7, 7], 'Rain 4: +1/+1 instead, not +2 Attack');
  assert.deepEqual(stats(ember), [3, 5, 5]);
  weather(s, { Rain: 6 });
  assert.deepEqual(stats(ember), [2, 5, 5], 'Rain 6: also Fire −1 Attack');
  assert.deepEqual(stats(pud), [3, 7, 7], 'the Rain 4 effect stays');
  weather(s, { Rain: 3 });
  assert.deepEqual(stats(pud), [3, 6, 6], 'back to Rain 2');
  assert.deepEqual(stats(ember), [3, 5, 5]);
  assert.ok(logged(s, 'Weather: ☔ Rain 4 has ended (Rain 3).'));
  assert.ok(logged(s, 'Weather: ☔ Rain 6 has ended (Rain 3).'));
  weather(s, { Rain: 0 });
  assert.deepEqual(stats(pud), [2, 6, 6]);
  assert.deepEqual(weatherState(s).Rain.active, []);
}

// --- Sun brackets, Attack floor -----------------------------------------------

{
  const s = match();
  const ember = place(s, 'player', 0, 0, 'test-flame'); // Fire 3/5
  const pud = place(s, 'ai', 1, 0, 'test-ripple');        // Water 2/6, opponent's side
  const weak = place(s, 'ai', 1, 1, 'test-fin', { attackValue: 0 });   // Water with 0 Attack
  weather(s, { Sun: 2 });
  assert.equal(attackOf(ember), 4, 'Sun 2: Fire +1 Attack');
  weather(s, { Sun: 4 });
  assert.equal(attackOf(ember), 5, 'Sun 4: +2 instead, not +3');
  weather(s, { Sun: 6 });
  assert.equal(attackOf(ember), 5);
  assert.equal(attackOf(pud), 1, 'Sun 6: Water −1 Attack, on the opponent\'s side too');
  assert.equal(attackOf(weak), 0, 'Attack can\'t go below 0');
  weather(s, { Sun: 5 });
  assert.equal(attackOf(pud), 2);
}

// --- Rain and Sun together, both sides ------------------------------------------

{
  const s = match();
  const mine = place(s, 'player', 0, 0, 'test-ripple');
  const theirs = place(s, 'ai', 0, 0, 'test-ripple');
  const ember = place(s, 'ai', 0, 1, 'test-flame');
  weather(s, { Rain: 6, Sun: 6 });
  // Water: Rain 4 (+1/+1) and Sun 6 (−1 Attack). Fire: Sun 4 (+2) and Rain 6 (−1).
  assert.deepEqual(stats(mine), [2, 7, 7]);
  assert.deepEqual(stats(theirs), [2, 7, 7], 'Weather affects both sides');
  assert.equal(attackOf(ember), 4);
  const w = weatherState(s);
  assert.deepEqual(w.Rain.effective.map((b) => b.at), [4, 6]);
  assert.deepEqual(w.Sun.effective.map((b) => b.at), [4, 6]);
}

// --- A bracket switching off never defeats a Pokémon -----------------------------

{
  const s = match();
  const hurt = place(s, 'player', 0, 0, 'test-ripple');
  const full = place(s, 'player', 0, 1, 'test-mud');  // Water 4/8
  weather(s, { Rain: 4 });
  assert.deepEqual(stats(full), [5, 9, 9], 'gaining Strength raises current and maximum');
  hurt.currentStrength = 1;
  weather(s, { Rain: 0 });
  assert.deepEqual(stats(hurt), [2, 1, 6], 'current only drops if above the new maximum');
  assert.deepEqual(stats(full), [4, 8, 8]);
  assert.ok(s.players.player.zones[0].pokemon[0], 'not defeated');
}

// --- Sun 8 at Breakfast ---------------------------------------------------------

// Each non-Fire Pokémon takes 1 damage, both sides, after the draw, before
// On Breakfast abilities; a defeated one triggers On Defeated as normal.
{
  let s = match({ abilities: true });
  place(s, 'player', 0, 0, 'test-flame');              // Fire: untouched
  const frost = place(s, 'player', 0, 1, 'test-fin');   // Water, On Breakfast
  const pud = place(s, 'ai', 1, 0, 'test-ripple');          // Water, On Defeated: heal Trainer in its zone 3
  pud.currentStrength = 1;
  s.players.ai.zones[1].trainer.strength = 10;
  weather(s, { Sun: 8 });
  s = nextRound(s);
  const p = s.players.player;
  assert.equal(p.zones[0].pokemon[0].currentStrength, 5, 'Fire untouched');
  assert.equal(p.zones[0].pokemon[1].currentStrength, frost.currentStrength - 1);
  assert.equal(s.players.ai.zones[1].pokemon[0], null, 'defeated by Weather');
  assert.equal(s.players.ai.released.at(-1).name, 'Test Ripple');
  assert.equal(s.players.ai.zones[1].trainer.strength, 13, 'On Defeated fired');
  const drew = logIndex(s, 'You drew 7 cards');
  const sun = logIndex(s, 'Weather (☀ Sun 8): 1 damage to your Test Fin');
  const ability = logIndex(s, "Your Test Fin's On Breakfast");
  assert.ok(drew >= 0 && sun > drew, 'after cards are drawn');
  assert.ok(ability > sun, 'Weather resolves before same-moment abilities');
}

// --- Rain 8 at Supper -----------------------------------------------------------

// Each Water Pokémon heals 2 (capped), before On Supper abilities and before
// hands are discarded.
{
  let s = match();
  const pud = place(s, 'player', 0, 0, 'test-ripple', {
    effectTrigger: 'On Supper', effectText: 'Draw 1.', ability: { on: 'supper', match: { self: true }, effects: [{ op: 'draw', amount: 1 }] },
  });
  const theirs = place(s, 'ai', 0, 0, 'test-mud');
  const ember = place(s, 'player', 0, 1, 'test-flame');
  weather(s, { Rain: 8 });                           // Water at Rain 4+: +1/+1
  pud.currentStrength = 1;                           // 1/7
  theirs.currentStrength = 8;                        // 8/9: capped at 9
  ember.currentStrength = 1;
  s = nextRound(s);
  assert.equal(s.players.player.zones[0].pokemon[0].currentStrength, 3);
  assert.equal(s.players.ai.zones[0].pokemon[0].currentStrength, 9, 'capped, opponent\'s side too');
  assert.equal(s.players.player.zones[0].pokemon[1].currentStrength, 1, 'not Water');
  const rain = logIndex(s, 'Weather (☔ Rain 8): healed your Test Ripple');
  assert.ok(rain >= 0);
  assert.ok(rain < logIndex(s, "Your Test Ripple's On Supper"), 'before same-moment abilities');
  assert.ok(rain < logIndex(s, 'You discarded'), 'before hands are discarded');
}

// --- Through play: real Locations and summons ----------------------------------

// Weather from played Locations; a Pokémon summoned into active Weather gets it.
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
  assert.deepEqual(stats(s.players.player.zones[1].pokemon[0]), [5, 8, 8], 'summoned into Rain 4');
}

console.log('All Weather tests passed.');
