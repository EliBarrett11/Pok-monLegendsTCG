// Checks Step 24 (docs/vfx.md section 6, items 3, 6 and 7), without the DOM:
// Weather on the board grows with the Rain and Sun counts (0, 2, 4, 6, 8); foil
// is only on Epic and Legendary cards; and the end screen's numbers are right
// for a whole match played out.
// Run with: node tests/finale.test.js
import assert from 'node:assert/strict';
import { weatherLevel, weatherLevels, RAIN_LEVELS, SUN_LEVELS } from '../src/ui/weather.js';
import { cardMarkup, foilOf } from '../src/ui/render.js';
import { matchStats } from '../src/ui/resources.js';
import { TIMELINES, BUDGETS, endingAnimation, timelineDuration, MAX_SCALE, EMITTERS } from '../src/ui/vfx/library.js';
import { createGame, applyAction, PLAYERS, weatherState, legalActions } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';
import { battle, place } from './fixtures.js';

// --- Weather intensity from the counts ---------------------------------------------------

assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 11].map(weatherLevel), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], 'a level per bracket: 2, 4, 6, 8');
assert.equal(weatherLevel(undefined), 0);
for (const levels of [RAIN_LEVELS, SUN_LEVELS]) {
  assert.equal(levels.length, 5);
  assert.equal(levels[0], null, 'nothing below 2');
}
for (let lv = 2; lv <= 4; lv++) {
  assert.ok(RAIN_LEVELS[lv].drops > RAIN_LEVELS[lv - 1].drops && RAIN_LEVELS[lv].alpha > RAIN_LEVELS[lv - 1].alpha, `Rain ${lv * 2} is stronger`);
  assert.ok(RAIN_LEVELS[lv].ripples > RAIN_LEVELS[lv - 1].ripples, `Rain ${lv * 2}: more splash ripples`);
  assert.ok(SUN_LEVELS[lv].shafts >= SUN_LEVELS[lv - 1].shafts && SUN_LEVELS[lv].haze > SUN_LEVELS[lv - 1].haze, `Sun ${lv * 2} is stronger`);
}
assert.deepEqual(RAIN_LEVELS.slice(1).map((l) => l.name), ['Light drizzle', 'Steady rain', 'Heavy rain', 'Downpour']);
assert.deepEqual(RAIN_LEVELS.slice(1).map((l) => Boolean(l.lightning)), [false, false, false, true], 'lightning only in a downpour');
assert.ok(SUN_LEVELS[4].glare === Math.max(...SUN_LEVELS.slice(1).map((l) => l.glare)), 'Sun 8: the strongest glare');
// From a game: both types at once, each at its own level.
{
  const s = battle({ passives: false });
  place(s, 'player', 0, 1, 'growlithe', { weatherTokens: { Rain: 6, Sun: 2 } });
  const counts = weatherState(s);
  assert.deepEqual(weatherLevels(counts), { rain: weatherLevel(counts.Rain.count), sun: weatherLevel(counts.Sun.count) });
  assert.ok(weatherLevels(counts).rain >= 3 && weatherLevels(counts).sun >= 1, 'both show, each at its own level');
  assert.deepEqual(weatherLevels(null), { rain: 0, sun: 0 });
}

// --- Foil only on Epic and Legendary -----------------------------------------------------------

{
  const byRarity = { Common: 'growlithe', Rare: 'arcanine', Epic: 'houndoom', Legendary: 'blaziken' };
  for (const [rarity, id] of Object.entries(byRarity)) {
    const c = { ...cardDefinition(id), uid: `f-${id}`, currentStrength: 5 };
    assert.equal(c.rarity, rarity, id);
    const html = cardMarkup(c, 'board');
    const foil = foilOf(c);
    if (rarity === 'Epic' || rarity === 'Legendary') {
      assert.equal(foil, rarity.toLowerCase());
      assert.ok(html.includes(`data-foil="${foil}"`) && html.includes('class="foil"'), `${rarity}: foil`);
    } else {
      assert.equal(foil, null);
      assert.ok(!html.includes('data-foil') && !html.includes('class="foil"'), `${rarity}: no foil`);
    }
  }
  // Every size gets it (the hand, the board, thumbnails), Strategy Cards too.
  const epic = { ...cardDefinition('houndoom'), uid: 'f-h', currentStrength: 7 };
  for (const size of ['hand', 'board', 'mini', 'full']) assert.ok(cardMarkup(epic, size).includes('data-foil="epic"'), size);
  assert.equal(foilOf(cardDefinition('fire-blast')), 'epic', 'an Epic Strategy Card');
}

// --- The end screen's numbers from a whole match --------------------------------------------------

function playOut(seed) {
  let s = createGame(seed, { decks: { player: 'fire', ai: 'water' } });
  const seen = { player: { trainerDamage: 0, pokemonLost: 0, cardsPlayed: 0 }, ai: { trainerDamage: 0, pokemonLost: 0, cardsPlayed: 0 } };
  let guard = 0;
  let n = 0;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  while (s.phase !== 'gameOver' && guard++ < 5000) {
    // As the balance tool plays a match: whoever has something to do, acts.
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
    for (const e of s.events) {
      if (e.type === 'damage' && e.target.kind === 'trainer') seen[e.target.owner === 'player' ? 'ai' : 'player'].trainerDamage += e.amount;
      if (e.type === 'defeated') seen[e.target.owner].pokemonLost += 1;
      if (e.type === 'cardPlayed') seen[e.who].cardsPlayed += 1;
    }
  }
  return { s, seen };
}
{
  let finished = 0;
  for (const seed of [3, 11, 27]) {
    const { s, seen } = playOut(seed);
    if (s.phase !== 'gameOver') continue;
    finished += 1;
    const m = matchStats(s);
    assert.equal(m.rounds, s.round, 'Rounds played');
    assert.equal(m.result, s.winner === 'player' ? 'victory' : s.winner === 'ai' ? 'defeat' : 'draw');
    for (const who of PLAYERS) {
      const foe = who === 'player' ? 'ai' : 'player';
      assert.equal(m[who].trainerDamage, seen[who].trainerDamage, `${seed} ${who}: damage to Trainers`);
      assert.equal(m[who].defeated, seen[foe].pokemonLost, `${seed} ${who}: Pokémon defeated`);
      assert.equal(m[who].lost, seen[who].pokemonLost, `${seed} ${who}: Pokémon lost`);
      assert.equal(m[who].cardsPlayed, seen[who].cardsPlayed, `${seed} ${who}: cards played`);
      assert.ok(m[who].cardsPlayed > 0);
    }
    // The winner dealt at least the 3 Trainers' Strength between them.
    if (s.winner) assert.ok(m[s.winner].trainerDamage > 0);
    assert.deepEqual(m.deck, { player: 'fire', ai: 'water' });
  }
  assert.ok(finished >= 2, 'matches played to the end');
}

// --- The end-of-match animation ---------------------------------------------------------------------

{
  const base = { deck: { player: 'fire', ai: 'water' } };
  assert.deepEqual(endingAnimation({ ...base, result: 'victory' }), { id: 'ending-victory', style: 'fire' }, 'Victory: embers for a Fire win');
  assert.deepEqual(endingAnimation({ deck: { player: 'water', ai: 'fire' }, result: 'victory' }), { id: 'ending-victory', style: 'water' }, 'droplets for a Water win');
  assert.deepEqual(endingAnimation({ ...base, result: 'defeat' }), { id: 'ending-defeat', style: 'fire' }, 'Defeat: ash');
  assert.equal(endingAnimation({ deck: { player: 'water', ai: 'fire' }, result: 'defeat' }).style, 'water', 'or rain');
  const v = TIMELINES['ending-victory'];
  const d = TIMELINES['ending-defeat'];
  assert.ok(v.beats.some((b) => b.when === 'fire' && EMITTERS[b.emit].tex === 'embers') && v.beats.some((b) => b.when === 'water' && EMITTERS[b.emit].tex === 'droplets'));
  assert.ok(v.beats.some((b) => EMITTERS[b.emit]?.tex === 'sparkle'), 'gold sparkle');
  assert.ok(d.beats.some((b) => b.when === 'fire' && b.emit === 'ashFall') && d.beats.some((b) => b.when === 'water' && b.emit === 'rainFall'));
  for (const t of [v, d]) {
    const ms = timelineDuration(t, MAX_SCALE);
    assert.ok(ms >= BUDGETS.ending.min && ms <= BUDGETS.ending.max);
  }
}

console.log('All Weather, foil and end-of-match tests passed.');
