// Checks the Grass G1 systems (docs/decks.md 2.7–2.11) with test-only cards:
// Growth, Evolution, Sleep, Leech Seed, On Evolve, the new quests and the new
// Full Heal. (The Weather rework, 2.12, is in tests/weather.test.js.)
// Run with: node tests/grass.test.js
import assert from 'node:assert/strict';
import { applyAction, legalActions, evolveOptions, evolvePayment, isEvolution, PLAYERS, maxStrengthOf } from '../src/engine/game.js';
import { resolveEffects, pileMatches } from '../src/engine/effects.js';
import { viewFor } from '../src/engine/view.js';
import { chooseAction } from '../src/ai/opponent.js';
import { cardDefinition } from '../src/engine/cards.js';
import { targetKeys, targetPrompt, cardMarkup } from '../src/ui/render.js';
import {
  battle, give, act, play, place, nextRound, at, trainerAt, pref, tref, stats, logged, choose, def,
} from './fixtures.js';

const cast = (s, who, effects, target) => resolveEffects(s, { who, source: { kind: 'test', owner: who, name: 'Test' }, label: 'Test', target }, effects);
const ENEMY = { mode: 'targeted', side: 'opponent', kinds: ['pokemon', 'trainer'] };
const FRIEND = { mode: 'targeted', side: 'friendly', kinds: ['pokemon', 'trainer'] };
const statusOf = (c) => Object.keys(c?.status ?? {}).filter((k) => c.status[k]);
const quest = (s, who, zone, q) => {
  s.players[who].zones[zone].location = { uid: `loc-${zone}`, id: 'test-loc', name: 'Test Grove', cardType: 'Location', weatherTokens: null,
    quest: { text: q.label, label: q.label, on: q.on, count: q.count }, xp: 1, effects: [], progress: 0, effectText: '' };
};
const progress = (s, who, zone) => s.players[who].zones[zone].location?.progress ?? 'done';
// A match one Round in (so Pokémon placed now have been there since before this Round).
function grass(opts = {}) {
  let s = battle({ testTrainers: true, passives: false, ...opts });
  s = nextRound(s);
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
  }
  s.turn = 'player';
  s.passesInARow = 0;
  return s;
}
const evolve = (s, who, id, zone, space, extra = {}) => act(s, who, { type: 'evolve', uid: give(s, who, id), zone, space, ...extra });

// --- The card data ----------------------------------------------------------------------

{
  assert.equal(def('test-sprout').stage ?? 'Basic', 'Basic');
  assert.deepEqual([def('test-bloom').stage, def('test-bloom').evolvesFrom, def('test-bloom').evolveCost, def('test-bloom').energyCost], ['Stage 1', 'Test Sprout', 2, null]);
  assert.equal(def('test-blossom').evolvesFrom, 'Test Bloom');
  assert.ok(isEvolution(def('test-bloom')) && !isEvolution(def('test-sprout')));
  assert.equal(cardDefinition('growlithe').stage, 'Basic', 'every real Pokémon is a Basic for now');
}

// --- Evolution cards can't be summoned on their own ------------------------------------------

{
  let s = grass();
  const uid = give(s, 'player', 'test-bloom');
  assert.ok(!legalActions(s, 'player').includes('playPokemon'), 'not playable');
  assert.throws(() => act(s, 'player', { type: 'playPokemon', uid, zone: 0, space: 0 }), /cannot playPokemon/);
  const basic = give(s, 'player', 'test-sprout');
  assert.throws(() => act(s, 'player', { type: 'playPokemon', uid, zone: 0, space: 0 }), /can't be summoned on its own/, 'even when a Pokémon can be played');
  s.players.player.hand = s.players.player.hand.filter((c) => c.uid !== basic);
  assert.ok(!legalActions(s, 'player').includes('evolve'), 'and nothing to evolve');
  // A free summon can't pick it either.
  cast(s, 'player', [{ op: 'freeSummon', filter: { cardType: 'Pokémon' } }]);
  assert.equal(s.pending, null, 'no matching Pokémon in hand: nothing happens');
  // But it is a Pokémon card for Search, Return, Supporter costs and Gifts.
  assert.equal(pileMatches([def('test-bloom')], { cardType: 'Pokémon' }).length, 1);
  assert.equal(pileMatches([def('test-bloom')], { cardType: 'Pokémon', pokemonType: 'Grass' }).length, 1);
}

// --- Timing: in the arena since the start of this Round ----------------------------------------

{
  let s = grass();
  s = play(s, 'player', 'test-sprout', 0, 0);
  give(s, 'player', 'test-bloom');
  assert.deepEqual(evolveOptions(s, 'player'), [], 'summoned this Round: not yet');
  assert.throws(() => act(s, 'player', { type: 'evolve', uid: s.players.player.hand.at(-1).uid, zone: 0, space: 0 }), /cannot evolve/);
  // (With another Sprout that has been there longer, Evolve is legal, but not onto the new one.)
  const older = place(s, 'player', 2, 2, 'test-sprout');
  at(s, 'player', 2, 2).arrivedRound = s.round - 1;
  assert.throws(() => act(s, 'player', { type: 'evolve', uid: s.players.player.hand.at(-1).uid, zone: 0, space: 0 }), /arrived this Round: it can Evolve from next Round/);
  s.players.player.zones[2].pokemon[2] = null;
  assert.ok(older);
  s = nextRound(s);
  give(s, 'player', 'test-bloom');   // (hands are discarded at Supper)
  assert.equal(evolveOptions(s, 'player').length, 1, 'next Round: it can');
  s = act(s, 'player', { type: 'evolve', uid: s.players.player.hand.find((c) => c.id === 'test-bloom').uid, zone: 0, space: 0 });
  assert.equal(at(s, 'player', 0, 0).name, 'Test Bloom');
  give(s, 'player', 'test-blossom');
  assert.deepEqual(evolveOptions(s, 'player'), [], 'evolved this Round: not again until next Round');
  s = nextRound(s);
  s = evolve(s, 'player', 'test-blossom', 0, 0);
  assert.equal(at(s, 'player', 0, 0).name, 'Test Blossom', 'Stage 2');
  // The wrong Pokémon: Test Blossom evolves from Test Bloom, not Test Sprout.
  let t = grass();
  place(t, 'player', 1, 0, 'test-sprout');
  place(t, 'player', 1, 1, 'test-bloom');
  assert.throws(() => evolve(t, 'player', 'test-blossom', 1, 0), /evolves from Test Bloom: choose your Test Bloom/);
}

// --- Costs: Energy and/or Growth --------------------------------------------------------------

{
  const p = { growth: 1, baseEnergy: 3, exertMax: 1, exhaust: [] };
  assert.deepEqual(evolvePayment(p, 2), { minGrowth: 0, maxGrowth: 1 });
  assert.deepEqual(evolvePayment({ ...p, baseEnergy: 0, exertMax: 0 }, 2), null, 'can\'t pay');
  assert.deepEqual(evolvePayment({ ...p, growth: 5, baseEnergy: 0, exertMax: 0 }, 2), { minGrowth: 2, maxGrowth: 2 }, 'all Growth');

  // Default: as much Growth as possible.
  let s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  s.players.player.growth = 1;
  s = evolve(s, 'player', 'test-bloom', 0, 0);
  assert.equal(s.players.player.growth, 0 + 1, '1 Growth used (then On Evolve gave 1)');
  assert.equal(s.players.player.baseEnergy, 10 - 1, 'and 1 Energy');
  assert.ok(logged(s, 'paying 1 Base Energy + 1 Growth'));
  // Choosing: no Growth.
  s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  s.players.player.growth = 3;
  s = evolve(s, 'player', 'test-bloom', 0, 0, { growth: 0 });
  assert.deepEqual([s.players.player.growth, s.players.player.baseEnergy], [3 + 1, 8]);
  // Out of range.
  s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  s.players.player.growth = 1;
  assert.throws(() => evolve(s, 'player', 'test-bloom', 0, 0, { growth: 2 }), /between 0 and 1 Growth/);
  // Growth only, with no Energy left; Exert after Base Energy.
  s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  Object.assign(s.players.player, { growth: 2, baseEnergy: 0 });
  s = applyAction(s, { type: 'evolve', who: 'player', uid: give(s, 'player', 'test-bloom'), zone: 0, space: 0 });
  assert.ok(logged(s, 'paying 2 Growth'));
  s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  Object.assign(s.players.player, { growth: 0, baseEnergy: 1 });
  s = applyAction(s, { type: 'evolve', who: 'player', uid: give(s, 'player', 'test-bloom'), zone: 0, space: 0 });
  assert.ok(logged(s, 'paying 1 Base Energy + 1 Exert'));
  assert.equal(s.players.player.exhaust.length, 1);
}

// --- What changes, what stays, what's removed -----------------------------------------------------

{
  let s = grass();
  const ref = place(s, 'player', 1, 0, 'test-sprout', { spent: true, xp: { attack: 1, strength: 2 } });   // 2/5 + XP → 3/7
  const sprout = at(s, 'player', 1, 0);
  sprout.currentStrength = 4;                                                          // 3 damage
  cast(s, 'player', [{ op: 'buff', attack: 1, strength: 0, thisRound: true, target: FRIEND }], ref);
  sprout.heldItem = { ...cardDefinition('charcoal'), uid: 'mart-charcoal' };
  for (const st of ['burn', 'sleep', 'leechSeed']) cast(s, 'ai', [{ op: 'applyStatus', status: st, amount: 2, target: ENEMY }], ref);
  assert.deepEqual(statusOf(at(s, 'player', 1, 0)).sort(), ['burn', 'leechSeed', 'sleep']);
  s = evolve(s, 'player', 'test-bloom', 1, 0);
  const bloom = at(s, 'player', 1, 0);
  assert.equal(bloom.name, 'Test Bloom');
  assert.deepEqual([bloom.pokemonType, bloom.attackType, bloom.strengthType, bloom.speedTier], ['Grass', 'Special', 'Defence', 'Steady'], 'its Type, Attack, Strength and Speed');
  assert.equal(bloom.innatePower, 'Shell 1', 'its Innate Powers');
  assert.deepEqual(bloom.weatherTokens, { Rain: 1 }, 'its Weather Tokens');
  // Bloom 4/8 + XP (+1/+2) + this Round +1 Attack + Charcoal +1 Attack: 7/10, less the 3 damage.
  assert.deepEqual(stats(bloom), [4 + 1 + 1 + 1, 10 - 3, 10], 'damage carries over; XP, the Held Item and "this Round" effects stay');
  assert.equal(bloom.heldItem?.name, 'Charcoal', 'its Held Item stays');
  assert.equal(bloom.spent, true, 'Spent stays Spent (evolving doesn\'t change it)');
  assert.deepEqual(statusOf(bloom), [], 'all statuses cured');
  assert.equal(s.events.filter((e) => e.type === 'statusCleared').length, 3);
  assert.deepEqual(bloom.stack.map((c) => c.name), ['Test Sprout'], 'the card underneath stays under it');
  assert.equal(bloom.stack[0].currentStrength, undefined, 'as a plain card');
  // An Active Pokémon stays Active.
  let t = grass();
  place(t, 'player', 0, 0, 'test-sprout', { spent: false });
  t = evolve(t, 'player', 'test-bloom', 0, 0);
  assert.equal(at(t, 'player', 0, 0).spent, false);
}

// --- Evolving never defeats: at or below its damage, it stays at 1 Strength (Elliott, G1 answers) ----------

for (const lower of [3, 4]) {
  const s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  at(s, 'player', 0, 0).currentStrength = 1;   // 4 damage taken
  const uid = give(s, 'player', 'test-bloom');
  const card = s.players.player.hand.find((c) => c.uid === uid);
  card.strengthValue = lower;   // (a test evolution weaker than its damage: max 3, or exactly 4)
  card.effects = [];
  const after = act(s, 'player', { type: 'evolve', uid, zone: 0, space: 0 });
  const bloom = at(after, 'player', 0, 0);
  assert.equal(bloom?.name, 'Test Bloom', 'still in the arena');
  assert.equal(bloom.currentStrength, 1, `max ${lower}, 4 damage: Strength 1`);
  assert.equal(maxStrengthOf(bloom), lower);
  assert.equal(after.players.player.released.length, 0, 'nothing Released');
}

// --- Not a summon: no On Summon, summon Passives or summon quests; On Evolve fires ------------------------

{
  let s = grass({ passives: true });           // Test Brock (Zone 3): opponent Pokémon summoned there take 1 damage
  place(s, 'ai', 2, 0, 'test-sprout');
  quest(s, 'ai', 2, { label: 'Summon 2 Pokémon', on: 'summon', count: 2 });
  s.players.ai.growth = 0;
  s = evolve(s, 'ai', 'test-bloom', 2, 0);
  const bloom = at(s, 'ai', 2, 0);
  assert.equal(bloom.currentStrength, maxStrengthOf(bloom), "Brock's summon Passive didn't fire");
  assert.equal(progress(s, 'ai', 2), 0, "a summon quest doesn't count it");
  assert.ok(!s.events.some((e) => e.type === 'summoned'), 'no summon');
  assert.ok(s.events.some((e) => e.type === 'abilityTriggered' && e.word === 'On Evolve'), 'On Evolve fired');
  assert.equal(s.players.ai.growth, 1, "Test Bloom's On Evolve: gain 1 Growth");
  assert.ok(s.events.some((e) => e.type === 'evolved' && e.from.name === 'Test Sprout' && e.name === 'Test Bloom'));
}

// --- The stack: Released together, PokéDollars for each card -------------------------------------------

{
  let s = grass();
  place(s, 'ai', 0, 0, 'test-sprout');
  s = evolve(s, 'ai', 'test-bloom', 0, 0);
  s = nextRound(s);
  s = evolve(s, 'ai', 'test-blossom', 0, 0);
  assert.deepEqual(at(s, 'ai', 0, 0).stack.map((c) => c.name), ['Test Sprout', 'Test Bloom']);
  const dollars = s.players.player.dollars;
  cast(s, 'player', [{ op: 'damage', amount: 99, target: ENEMY }], pref('ai', 0, 0));
  assert.equal(at(s, 'ai', 0, 0), null, 'defeated');
  assert.deepEqual(s.players.ai.released.slice(-3).map((c) => c.name), ['Test Sprout', 'Test Bloom', 'Test Blossom'], 'the whole stack goes to the Released Pile');
  assert.equal(s.players.player.dollars - dollars, 2 + 2 + 3, "PokéDollars: the Basic's Energy Cost + each Evolve cost");
  assert.ok(s.players.ai.released.every((c) => !c.stack), 'each card on its own');
}

// --- Sleep --------------------------------------------------------------------------------------

{
  let s = grass();
  const foe = place(s, 'ai', 0, 0, 'test-mud', { spent: false });
  quest(s, 'player', 1, { label: 'Put to Sleep or Leech Seed 3 times', on: 'sleepSeed', count: 3 });
  s = play(s, 'player', 'test-dozer', 0, 0);
  s = choose(s, { target: foe });
  assert.ok(at(s, 'ai', 0, 0).status.sleep, 'Asleep');
  assert.equal(at(s, 'ai', 0, 0).spent, true, 'and Spent at once');
  assert.equal(progress(s, 'player', 1), 1, 'the quest counts it');
  // Doesn't stack: applying it again does nothing (and doesn't count).
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], foe);
  assert.equal(progress(s, 'player', 1), 1);
  // Can't be readied while Asleep.
  cast(s, 'ai', [{ op: 'ready', target: FRIEND }], foe);
  assert.equal(at(s, 'ai', 0, 0).spent, true, 'stays Spent');
  // Pokémon only.
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], tref('ai', 0));
  assert.equal(trainerAt(s, 'ai', 0).status?.sleep, undefined, 'not on a Trainer');
  // Breakfast: stays Spent, then wakes. So it misses a Round.
  s = nextRound(s);
  assert.equal(at(s, 'ai', 0, 0).spent, true, 'still Spent this Round');
  assert.equal(at(s, 'ai', 0, 0).status?.sleep, undefined, 'awake');
  s = nextRound(s);
  assert.equal(at(s, 'ai', 0, 0).spent, false, 'Active the Round after');
}

{
  // Damage wakes it; it stays Spent this Round and is Active at the next Breakfast.
  let s = grass();
  const foe = place(s, 'ai', 0, 0, 'test-mud', { spent: false });
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], foe);
  cast(s, 'player', [{ op: 'damage', amount: 1, target: ENEMY }], foe);
  assert.equal(at(s, 'ai', 0, 0).status?.sleep, undefined, 'woken by damage');
  assert.equal(at(s, 'ai', 0, 0).spent, true, 'still Spent');
  assert.ok(logged(s, 'wakes up (it stays Spent this Round)'));
  s = nextRound(s);
  assert.equal(at(s, 'ai', 0, 0).spent, false, 'Active at the next Breakfast');
}

{
  // An Asleep (Spent) Pokémon can't hit back in a trade.
  let s = grass();
  const swift = place(s, 'ai', 0, 0, 'test-flame', { spent: false });   // Swift 3/5: Alert
  place(s, 'player', 0, 0, 'test-blaze', { spent: false });             // 5/7, Steady... make it Swift
  at(s, 'player', 0, 0).speedTier = 'Swift';
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], swift);
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 0, space: 0 } });
  assert.equal(at(s, 'player', 0, 0).currentStrength, 7, 'no hit back');
  assert.ok(!logged(s, 'hit back'));
}

// --- Leech Seed -----------------------------------------------------------------------------------

{
  let s = grass();
  const foe = place(s, 'ai', 0, 0, 'test-mud');                       // 8
  const hurtMost = place(s, 'player', 1, 0, 'test-mud');
  const hurtLess = place(s, 'player', 2, 0, 'test-mud');
  at(s, 'player', 1, 0).currentStrength = 3;
  at(s, 'player', 2, 0).currentStrength = 6;
  quest(s, 'player', 0, { label: 'Gain 3 Growth', on: 'growth', count: 3 });
  s = play(s, 'player', 'test-seeder', 0, 1);
  s = choose(s, { target: foe });
  assert.ok(at(s, 'ai', 0, 0).status.leechSeed);
  assert.equal(at(s, 'ai', 0, 0).status.leechSeed.by, 'player', 'it belongs to whoever applied it');
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], foe);
  assert.ok(logged(s, 'is seeded with Leech Seed') && s.log.filter((l) => l.includes('is seeded with Leech Seed')).length === 1, 'one seed per Pokémon');
  s = nextRound(s);
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 8 - 1, '1 damage at Supper');
  assert.equal(at(s, 'player', 1, 0).currentStrength, 3 + 1, "heals the seeder's most-damaged Pokémon by 1");
  assert.equal(at(s, 'player', 2, 0).currentStrength, 6, 'not the less-damaged one');
  assert.equal(s.players.player.growth, 1, '+1 Growth');
  assert.equal(progress(s, 'player', 0), 1, '"Gain N Growth" counts it');
  assert.ok(at(s, 'ai', 0, 0).status.leechSeed, 'it stays');
  assert.ok(hurtMost && hurtLess);
}

{
  // Shell applies, minimum 1. A defeat by Leech Seed is the seeder's.
  let s = grass();
  const shelled = place(s, 'ai', 0, 0, 'test-mud', { innatePower: 'Shell 2' });
  const weak = place(s, 'ai', 1, 0, 'test-ripple');
  at(s, 'ai', 1, 0).currentStrength = 1;
  for (const r of [shelled, weak]) cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], r);
  quest(s, 'player', 2, { label: 'Defeat 1 enemy Pokémon', on: 'defeat', count: 1 });
  const dollars = s.players.player.dollars;
  s = nextRound(s);
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 8 - 1, 'Shell 2: still 1 (minimum 1)');
  assert.equal(at(s, 'ai', 1, 0), null, 'defeated by Leech Seed');
  assert.ok(s.players.player.dollars >= dollars + 1 + 1, 'the seeder earns its PokéDollars (plus the Breakfast 1)');
  assert.equal(progress(s, 'player', 2), 'done', "and it's the seeder's defeat for quests");
  assert.equal(s.players.player.growth, 2, 'a Growth for each seed');
}

{
  // Removed when it Evolves, by Full Heal, or when the Pokémon leaves play.
  let s = grass();
  const mine = place(s, 'player', 0, 0, 'test-sprout');
  cast(s, 'ai', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], mine);
  s = evolve(s, 'player', 'test-bloom', 0, 0);
  assert.equal(at(s, 'player', 0, 0).status?.leechSeed, undefined, 'Evolving removes it');
  const other = place(s, 'player', 1, 0, 'test-mud');
  cast(s, 'ai', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], other);
  cast(s, 'ai', [{ op: 'burn', amount: 2, target: ENEMY }], other);
  cast(s, 'ai', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], other);
  at(s, 'player', 1, 0).currentStrength = 3;
  s.players.player.dollars = 5;
  s = act(s, 'player', { type: 'openBag', mode: 'buyHand', uid: give(s, 'player', 'full-heal'), then: 'use', target: other });
  assert.deepEqual(statusOf(at(s, 'player', 1, 0)), [], 'Full Heal cures every status');
  assert.equal(at(s, 'player', 1, 0).currentStrength, 3 + 2, 'and heals 2');
  assert.equal(cardDefinition('full-heal').effectText, 'Cure a friendly Pokémon or Trainer of all statuses and heal it 2. Retain.');
  // Douse still removes Burn only.
  const third = place(s, 'player', 2, 0, 'test-mud');
  cast(s, 'ai', [{ op: 'burn', amount: 1, target: ENEMY }], third);
  cast(s, 'ai', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], third);
  cast(s, 'player', [{ op: 'douse', target: FRIEND }], third);
  assert.deepEqual(statusOf(at(s, 'player', 2, 0)), ['leechSeed'], 'Douse: Burn only');
}

// --- The new quests ---------------------------------------------------------------------------------

{
  let s = grass();
  quest(s, 'player', 0, { label: 'Evolve 2 Pokémon', on: 'evolve', count: 2 });
  quest(s, 'player', 1, { label: 'Gain 3 Growth', on: 'growth', count: 3 });
  quest(s, 'player', 2, { label: 'Put to Sleep or Leech Seed 2 times', on: 'sleepSeed', count: 2 });
  place(s, 'player', 0, 0, 'test-sprout');
  place(s, 'player', 0, 1, 'test-sprout');
  s = evolve(s, 'player', 'test-bloom', 0, 0);
  assert.equal(progress(s, 'player', 0), 1, 'each Evolve');
  assert.equal(progress(s, 'player', 1), 1, 'Growth from On Evolve counts');
  cast(s, 'player', [{ op: 'gainGrowth', amount: 2 }]);
  assert.equal(progress(s, 'player', 1), 'done', 'all Growth gained, from any source');
  s = evolve(s, 'player', 'test-bloom', 0, 1);
  assert.equal(progress(s, 'player', 0), 'done');
  const foe = place(s, 'ai', 0, 0, 'test-mud');
  const own = place(s, 'player', 1, 1, 'test-mud');
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: { mode: 'targeted', side: 'any' } }], own);
  assert.equal(progress(s, 'player', 2), 0, 'only on an enemy Pokémon');
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], foe);
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], foe);
  assert.equal(progress(s, 'player', 2), 'done', 'Sleep and Leech Seed both count');
}

// --- Growth and statuses are public in viewFor --------------------------------------------------------

{
  let s = grass();
  s.players.player.growth = 3;
  s.players.ai.growth = 2;
  const foe = place(s, 'ai', 0, 0, 'test-mud');
  cast(s, 'player', [{ op: 'applyStatus', status: 'leechSeed', target: ENEMY }], foe);
  cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', target: ENEMY }], foe);
  for (const seat of PLAYERS) {
    const v = viewFor(s, seat);
    assert.deepEqual([v.players.player.growth, v.players.ai.growth], [3, 2], `${seat} sees both Growth pools`);
    assert.deepEqual(Object.keys(v.players.ai.zones[0].pokemon[0].status).sort(), ['leechSeed', 'sleep'], `${seat} sees the statuses`);
  }
}

// --- The AI Evolves, scored like other moves ----------------------------------------------------------

{
  let s = grass();
  place(s, 'ai', 0, 0, 'test-sprout', { spent: true });   // nothing to attack with
  give(s, 'ai', 'test-bloom');
  s.turn = 'ai';
  s.players.ai.baseEnergy = 2;
  s.players.ai.growth = 1;
  let n = 5;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const move = chooseAction(s, 'ai', { rng });
  assert.equal(move.type, 'evolve', `the AI evolves (chose ${move.type})`);
  s = applyAction(s, move);
  assert.equal(at(s, 'ai', 0, 0).name, 'Test Bloom');
  assert.equal(s.players.ai.growth, 0 + 1, 'using its Growth first (then On Evolve)');
}

// --- On screen: the Pokémon an evolution card can go onto glow ------------------------------

{
  const s = grass();
  place(s, 'player', 0, 0, 'test-sprout');
  place(s, 'player', 1, 1, 'test-sprout');
  place(s, 'player', 2, 0, 'test-bloom');
  const bloom = give(s, 'player', 'test-bloom');
  const t = targetKeys(s, { evolve: bloom });
  assert.deepEqual([...t.keys].sort(), ['player:P00', 'player:P11'], 'only its Test Sprouts glow');
  assert.equal(t.cls, ' power-target');
  assert.equal(targetPrompt(viewFor(s, 'player'), { evolve: bloom }).text, 'Test Bloom (Evolve): choose one of your Pokémon');
  // Choosing how much Growth: nothing glows behind the question.
  assert.equal(targetKeys(s, { evolve: bloom, growthAsk: { zone: 0, space: 0 } }).keys.size, 0);
  // The card shows its Evolve cost in the corner, not an Energy Cost.
  const html = cardMarkup(s.players.player.hand.find((c) => c.uid === bloom), 'hand');
  assert.ok(html.includes('Evolve cost 2'), 'Evolve cost on the card');
}

console.log('All Grass G1 tests passed (Growth, Evolution, Sleep, Leech Seed, quests, Full Heal).');
