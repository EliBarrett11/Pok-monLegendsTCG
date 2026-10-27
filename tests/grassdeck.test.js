// Checks the Grass deck's cards (docs/decks.md section 5), one by one, then
// whole seeded matches with Grass against every deck.
// (Its rules, Growth, Evolution, Sleep and Leech Seed, are in tests/grass.test.js.)
// Run with: node tests/grassdeck.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, PLAYERS, evolveOptions, evolveCost, attackOf, maxStrengthOf, itemTargets,
  attackPower, playableStrategies,
} from '../src/engine/game.js';
import { resolveEffects } from '../src/engine/effects.js';
import { hasKeyword, keywordAmount } from '../src/engine/keywords.js';
import { weatherCounts } from '../src/engine/board.js';
import { chooseAction } from '../src/ai/opponent.js';
import { ITEM_CARDS } from '../src/engine/cardData.js';
import {
  battle, give, act, play, place, nextRound, at, trainerAt, pref, tref, choose, logged,
} from './fixtures.js';

// A Grass match one Round in, hands emptied, plenty of Energy; Trainers in deck
// order: Erika (Zone 1), Gardenia (Zone 2), Ramos (Zone 3).
function grass(opts = {}) {
  let s = battle({ player: 'grass', ai: 'water', ...opts });
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
const growthOf = (s, who = 'player') => s.players[who].growth ?? 0;
const evolve = (s, id, zone, space, extra = {}) => act(s, 'player', { type: 'evolve', uid: give(s, 'player', id), zone, space, ...extra });
const strategy = (s, id, target, extra = {}) => act(s, 'player', { type: 'playStrategy', uid: give(s, 'player', id), target, ...extra });
const useItem = (s, id, target) => {
  const uid = give(s, 'player', id);
  s.players.player.dollars = 10;
  return act(s, 'player', { type: 'openBag', mode: 'buyHand', uid, then: 'use', target });
};
const statusOf = (c) => Object.keys(c?.status ?? {}).filter((k) => c.status[k]);
const cast = (s, who, effects, target) => resolveEffects(s, { who, source: { kind: 'test', owner: who, name: 'Test' }, label: 'Test', target }, effects);
// What the next Breakfast adds to the player's Growth.
function breakfastGrowth(s) {
  const before = growthOf(s);
  return growthOf(nextRound(s)) - before;
}

// --- Pokémon ------------------------------------------------------------------------------

// Bulbasaur: On Breakfast, gain 1 Growth.
{
  const s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  assert.equal(breakfastGrowth(s), 1);
}
// Ivysaur: On Evolve, Leech Seed an enemy Pokémon in its Zone; On Breakfast +1 Growth (both abilities).
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  place(s, 'ai', 0, 0, 'quagsire');
  place(s, 'ai', 1, 0, 'horsea');
  s = evolve(s, 'ivysaur', 0, 0);
  assert.equal(s.pending?.kind, 'target', 'On Evolve asks for its target');
  assert.deepEqual(s.pending.options, [pref('ai', 0, 0)], 'only enemies in its Zone');
  assert.ok(s.pending.label.endsWith("Ivysaur's On Evolve"), 'named by its own trigger word');
  s = choose(s, { target: pref('ai', 0, 0) });
  assert.deepEqual(statusOf(at(s, 'ai', 0, 0)), ['leechSeed']);
  assert.equal(breakfastGrowth(s), 2, 'On Breakfast +1, and the seed +1 at Supper');
}
// Venusaur: Shell 1, On Breakfast +2 Growth.
{
  const s = grass();
  place(s, 'player', 0, 0, 'venusaur');
  assert.equal(keywordAmount(at(s, 'player', 0, 0), 'Shell'), 1);
  assert.equal(breakfastGrowth(s), 2);
}
// Oddish: On Attack, gain 1 Growth.
{
  let s = grass();
  place(s, 'player', 0, 0, 'oddish');
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });
  const before = growthOf(s);
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 0, space: 0 } });
  assert.equal(growthOf(s), before + 1);
}
// Gloom: On Evolve, put an enemy Pokémon in its Zone to Sleep.
{
  let s = grass();
  place(s, 'player', 1, 0, 'oddish');
  place(s, 'ai', 1, 2, 'goldeen');
  s = evolve(s, 'gloom', 1, 0);
  s = choose(s, { target: pref('ai', 1, 2) });
  assert.deepEqual(statusOf(at(s, 'ai', 1, 2)), ['sleep']);
  assert.equal(at(s, 'ai', 1, 2).spent, true);
}
// Bellossom: On Evolve, each enemy Pokémon in its Zone falls Asleep; On Attack +1 Growth.
{
  let s = grass();
  place(s, 'player', 2, 0, 'gloom');
  place(s, 'ai', 2, 0, 'goldeen');
  place(s, 'ai', 2, 1, 'horsea');
  place(s, 'ai', 0, 0, 'chinchou');
  s = evolve(s, 'bellossom', 2, 0);
  assert.equal(s.pending, null, 'an area effect: no choice');
  assert.deepEqual([statusOf(at(s, 'ai', 2, 0)), statusOf(at(s, 'ai', 2, 1)), statusOf(at(s, 'ai', 0, 0))], [['sleep'], ['sleep'], []]);
  s = nextRound(s);   // (they wake, still Spent; Bellossom can attack)
  const before = growthOf(s);
  // (Chinchou is Special Defence: a Special attacker must target it.)
  s = act(s, 'player', { type: 'command', from: { zone: 2, space: 0 }, target: { kind: 'pokemon', zone: 0, space: 0 } });
  assert.equal(growthOf(s), before + 1);
}
// Sunkern and Sunflora: Sun tokens; Sunflora deals +2 with its attack while Sun is 4 or more,
// but not when it hits back in a trade (Elliott, G2 answers).
{
  let s = grass();
  place(s, 'player', 1, 0, 'sunkern');
  assert.equal(weatherCounts(s).Sun, 1);
  s.players.player.zones[1].pokemon[0] = null;
  place(s, 'player', 1, 0, 'sunflora');   // (Zone 2: no Passive bonuses)
  assert.equal(weatherCounts(s).Sun, 2);
  assert.equal(attackPower(s, at(s, 'player', 1, 0)), 5, 'Sun 2: printed Attack');
  place(s, 'player', 2, 1, 'sunkern');
  place(s, 'player', 2, 2, 'sunkern');
  assert.equal(weatherCounts(s).Sun, 4);
  assert.deepEqual([attackOf(at(s, 'player', 1, 0)), attackPower(s, at(s, 'player', 1, 0))], [5, 7], 'Sun 4: +2 on its attacks; its Attack stays 5');
  // Its attack: 7 damage.
  place(s, 'ai', 1, 1, 'quagsire', { spent: true });
  const t = act(structuredClone(s), 'player', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 1 } });
  assert.equal(t.events.find((e) => e.type === 'attack').amount, 7, '(before Crasher Wake\'s Shell 1)');
  // Hitting back in a trade (a Slow attacker, so Sunflora is Alert): 5, less the Shell 1.
  place(s, 'ai', 1, 2, 'quagsire');
  s = act(s, 'ai', { type: 'command', from: { zone: 1, space: 2 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.ok(logged(s, 'hit back for 4 (Shell: 5 → 4)'), 'no +2 when hitting back');
}
// Celebi: On Summon +3 Growth; your Pokémon can Evolve the Round they're summoned (not twice in one Round).
{
  let s = grass();
  s = play(s, 'player', 'bulbasaur', 1, 0);
  give(s, 'player', 'ivysaur');
  assert.deepEqual(evolveOptions(s, 'player'), [], 'without Celebi: next Round');
  const before = growthOf(s);
  s = play(s, 'player', 'celebi', 1, 1);
  assert.equal(growthOf(s), before + 3);
  assert.equal(evolveOptions(s, 'player').length, 1, 'with Celebi: this Round');
  s = act(s, 'player', { type: 'evolve', uid: s.players.player.hand.find((c) => c.id === 'ivysaur').uid, zone: 1, space: 0 });
  assert.equal(at(s, 'player', 1, 0).name, 'Ivysaur');
  give(s, 'player', 'venusaur');
  assert.deepEqual(evolveOptions(s, 'player'), [], 'evolved this Round: not again, even with Celebi');
}
// Sewaddle: On Defeated, its owner gains 2 Growth.
{
  const s = grass();
  place(s, 'player', 0, 0, 'sewaddle');
  const before = growthOf(s);
  cast(s, 'ai', [{ op: 'damage', amount: 9, target: { mode: 'targeted', side: 'opponent' } }], pref('player', 0, 0));
  assert.equal(at(s, 'player', 0, 0), null);
  assert.equal(growthOf(s), before + 2);
}
// Sudowoodo: a sturdy Defence guard.
{
  const s = grass();
  place(s, 'player', 1, 0, 'sudowoodo');   // (Zone 2: not Erika's +2)
  assert.deepEqual([at(s, 'player', 1, 0).strengthType, at(s, 'player', 1, 0).currentStrength], ['Defence', 9]);
}

// --- Strategy Cards ----------------------------------------------------------------------------

// Leech Seed and Sleep Powder.
{
  let s = grass();
  place(s, 'ai', 0, 0, 'quagsire');
  place(s, 'ai', 1, 0, 'lapras');
  s = strategy(s, 'leech-seed', pref('ai', 0, 0));
  assert.deepEqual(statusOf(at(s, 'ai', 0, 0)), ['leechSeed']);
  assert.equal(at(s, 'ai', 0, 0).status.leechSeed.by, 'player');
  s = strategy(s, 'sleep-powder', pref('ai', 1, 0));
  assert.deepEqual(statusOf(at(s, 'ai', 1, 0)), ['sleep']);
}
// Synthesis: 2 Growth (3 if Sun is 2 or more), and heal a friendly Pokémon 2.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  at(s, 'player', 0, 0).currentStrength = 2;
  let before = growthOf(s);
  s = strategy(s, 'synthesis', pref('player', 0, 0));
  assert.equal(growthOf(s), before + 2);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 4);
  place(s, 'player', 1, 0, 'sunflora');   // Sun 2
  before = growthOf(s);
  s = strategy(s, 'synthesis', pref('player', 0, 0));
  assert.equal(growthOf(s), before + 3, 'Sun 2: 3 Growth');
}
// With no friendly Pokémon to heal, Synthesis can still be played for the Growth (Elliott, G2 answers).
{
  let s = grass();
  const before = growthOf(s);
  const uid = give(s, 'player', 'synthesis');
  assert.ok(playableStrategies(s, 'player').some((c) => c.uid === uid));
  s = act(s, 'player', { type: 'playStrategy', uid });
  assert.equal(growthOf(s), before + 2);
  assert.equal(s.pending, null);
}
// Solar Beam: spend up to 8 Growth (the player's choice; all of it up to 8 by default); that much damage.
{
  let s = grass();
  place(s, 'ai', 0, 0, 'quagsire');
  s.players.player.growth = 5;
  assert.throws(() => strategy(s, 'solar-beam', tref('ai', 1), { growth: 6 }), /Spend between 1 and 5 Growth/);
  assert.throws(() => strategy(s, 'solar-beam', tref('ai', 1), { growth: 0 }), /Spend between 1 and 5 Growth/);
  s = strategy(s, 'solar-beam', tref('ai', 1), { growth: 3 });
  assert.equal(growthOf(s), 2);
  assert.equal(trainerAt(s, 'ai', 1).strength, trainerAt(s, 'ai', 1).maxStrength - 3);
  s.players.player.growth = 12;
  s = strategy(s, 'solar-beam', tref('ai', 2));
  assert.equal(growthOf(s), 4, 'by default all of it, up to 8');
  assert.equal(trainerAt(s, 'ai', 2).strength, trainerAt(s, 'ai', 2).maxStrength - 8);
  assert.ok(s.players.player.discard.some((c) => c.id === 'solar-beam'), 'played: to the Discard Pile');
  // It needs at least 1 Growth to be played (Elliott, G2 answers).
  s.players.player.growth = 0;
  const beam = give(s, 'player', 'solar-beam');
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === beam), 'no Growth: not playable');
  s.players.player.hand = s.players.player.hand.filter((c) => c.uid !== beam);
  assert.ok(give(s, 'player', 'solar-beam') && s.players.player.hand.at(-1).retain, 'Retain');
}

// --- Supporters ------------------------------------------------------------------------------------

const supporter = (s, id, pay, target) => {
  const uid = give(s, 'player', id);
  const cost = s.players.player.hand.find((c) => c.uid === uid).cardCost;
  const uids = pay.map((pid) => give(s, 'player', pid));
  return act(s, 'player', { type: 'playSupporter', uid, discard: uids.slice(0, cost.discard), release: uids.slice(cost.discard), target });
};
// Mallow: 2 Growth; Gift (a Grass Pokémon): 3 Growth and heal a friendly Pokémon 2 (chosen as it resolves).
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  at(s, 'player', 0, 0).currentStrength = 1;
  let before = growthOf(s);
  s = supporter(s, 'mallow', ['leech-seed']);
  assert.equal(growthOf(s), before + 2);
  s = nextRound(s);
  s.players.player.hand = [];
  at(s, 'player', 0, 0).currentStrength = 1;
  before = growthOf(s);
  s = supporter(s, 'mallow', ['oddish']);
  assert.equal(growthOf(s), before + 3);
  assert.equal(s.pending?.kind, 'target', 'the heal asks for its target');
  s = choose(s, { target: pref('player', 0, 0) });
  assert.equal(at(s, 'player', 0, 0).currentStrength, 3);
}
// Pokémon Breeder: Search for a Pokémon that evolves from one in your arena (it gains Retain); Gift: two.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  s = supporter(s, 'pokemon-breeder', ['leech-seed']);
  const ivysaurs = s.players.player.drawPile.filter((c) => c.id === 'ivysaur').map((c) => c.uid);
  assert.deepEqual([...s.pending.options].sort(), ivysaurs.sort(), 'only Ivysaur: Bulbasaur is in the arena, Oddish and Sunkern aren\'t');
  s = choose(s, { uids: [ivysaurs[0]] });
  assert.ok(s.players.player.hand.find((c) => c.uid === ivysaurs[0]).retainGranted);
  s = nextRound(s);
  s.players.player.hand = [];
  place(s, 'player', 1, 0, 'oddish');
  s = supporter(s, 'pokemon-breeder', ['gloom']);   // released: an evolution card
  assert.equal(s.pending.max, 2, 'Gift: two');
}
// Professor Oak: draw 3; Gift (a Pokémon card): draw 4.
{
  let s = grass();
  let before = s.players.player.hand.length;
  s = supporter(s, 'professor-oak', ['leech-seed', 'synthesis']);
  assert.equal(s.players.player.hand.length, before + 3, 'Oak and its 2 paid cards left, 3 drawn');
  s = nextRound(s);
  s.players.player.hand = [];
  before = 0;
  s = supporter(s, 'professor-oak', ['oddish', 'synthesis']);
  assert.equal(s.players.player.hand.length, 4);
}

// --- Locations -----------------------------------------------------------------------------------------

const locate = (s, id, zone) => act(s, 'player', { type: 'playLocation', uid: give(s, 'player', id), zone });
// Floaroma Meadow: gain 6 Growth → friendly Pokémon in this Zone +2 Strength.
{
  let s = grass();
  place(s, 'player', 1, 0, 'bulbasaur');
  s = locate(s, 'floaroma-meadow', 1);
  assert.equal(weatherCounts(s).Sun, 2);
  cast(s, 'player', [{ op: 'gainGrowth', amount: 6 }]);
  assert.equal(maxStrengthOf(at(s, 'player', 1, 0)), 5 + 2 + 0);
  assert.equal(s.players.player.zones[1].location, null, 'completed and Released');
}
// Eterna Forest: Evolve 2 → Search for an evolution card (Retain).
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  place(s, 'player', 2, 0, 'oddish');
  s = locate(s, 'eterna-forest', 1);
  s = evolve(s, 'ivysaur', 0, 0);
  if (s.pending) s = choose(s, { target: s.pending.options[0] });
  s = evolve(s, 'gloom', 2, 0);
  if (s.pending?.kind === 'target') s = choose(s, { target: s.pending.options[0] });
  assert.equal(s.pending?.kind, 'pick');
  const cards = s.pending.options.map((uid) => s.players.player.drawPile.find((c) => c.uid === uid));
  assert.ok(cards.length && cards.every((c) => c.stage !== 'Basic'), 'only evolution cards');
}
// Petalburg Woods: 3 Sleep or Leech Seed → Leech Seed each enemy Pokémon in this Zone.
{
  let s = grass();
  place(s, 'ai', 0, 0, 'quagsire');
  place(s, 'ai', 2, 0, 'horsea');
  place(s, 'ai', 2, 1, 'goldeen');
  s = locate(s, 'petalburg-woods', 2);
  s = strategy(s, 'leech-seed', pref('ai', 0, 0));
  s = strategy(s, 'sleep-powder', pref('ai', 2, 0));
  s = strategy(s, 'sleep-powder', pref('ai', 2, 1));
  assert.deepEqual([statusOf(at(s, 'ai', 2, 0)), statusOf(at(s, 'ai', 2, 1))], [['sleep', 'leechSeed'], ['sleep', 'leechSeed']]);
}

// --- Items ----------------------------------------------------------------------------------------------

assert.equal(ITEM_CARDS.length, 11, 'the PokéMart holds 11 Items');
// Miracle Seed: +1 Attack; a Grass holder also gains Regenerate 1.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  place(s, 'player', 0, 1, 'sewaddle');
  s = useItem(s, 'miracle-seed', pref('player', 0, 0));
  s = useItem(s, 'miracle-seed', pref('player', 0, 1));
  assert.deepEqual([attackOf(at(s, 'player', 0, 0)), keywordAmount(at(s, 'player', 0, 0), 'Regenerate')], [2, 1]);
  assert.deepEqual([attackOf(at(s, 'player', 0, 1)), hasKeyword(at(s, 'player', 0, 1), 'Regenerate')], [3, false], 'Bug: no Regenerate');
}
// Oran Berry: heal 3; a Grass Pokémon also gives 1 Growth.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  at(s, 'player', 0, 0).currentStrength = 1;
  place(s, 'player', 1, 0, 'sewaddle');
  at(s, 'player', 1, 0).currentStrength = 1;
  let before = growthOf(s);
  s = useItem(s, 'oran-berry', pref('player', 0, 0));
  assert.deepEqual([at(s, 'player', 0, 0).currentStrength, growthOf(s)], [4, before + 1]);
  before = growthOf(s);
  s = useItem(s, 'oran-berry', pref('player', 1, 0));
  assert.deepEqual([at(s, 'player', 1, 0).currentStrength, growthOf(s)], [4, before], 'Bug: no Growth');
}
// Rare Candy: this Round a Basic may Evolve straight into its Stage 2, even if summoned this Round.
{
  let s = grass();
  s = play(s, 'player', 'bulbasaur', 0, 0);
  give(s, 'player', 'venusaur');
  assert.deepEqual(evolveOptions(s, 'player'), []);
  s = useItem(s, 'rare-candy', pref('player', 0, 0));
  const [opt] = evolveOptions(s, 'player');
  assert.deepEqual([opt.zone, opt.space, opt.cost], [0, 0, 3], 'only the Stage 2\'s Evolve cost');
  s = act(s, 'player', { type: 'evolve', uid: opt.uid, zone: 0, space: 0 });
  const v = at(s, 'player', 0, 0);
  assert.equal(v.name, 'Venusaur');
  assert.deepEqual(v.stack.map((c) => c.name), ['Bulbasaur']);
  // Only a Basic with a Stage 2 can be chosen: Oddish, not Sunkern (Sunflora has no Stage 2) or Sewaddle.
  place(s, 'player', 1, 0, 'sunkern');
  place(s, 'player', 1, 1, 'oddish');
  place(s, 'player', 1, 2, 'sewaddle');
  const candyUid = give(s, 'player', 'rare-candy');
  const candy = s.players.player.hand.find((c) => c.uid === candyUid);
  assert.deepEqual(itemTargets(s, 'player', candy), [pref('player', 1, 1)]);
}
// Big Root: healing the holder receives +1; your Leech Seeds heal the holder first.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  at(s, 'player', 0, 0).currentStrength = 1;
  place(s, 'player', 1, 0, 'sudowoodo');
  at(s, 'player', 1, 0).currentStrength = 2;
  s = useItem(s, 'big-root', pref('player', 0, 0));
  cast(s, 'player', [{ op: 'heal', amount: 1, target: { mode: 'targeted', side: 'friendly' } }], pref('player', 0, 0));
  assert.equal(at(s, 'player', 0, 0).currentStrength, 3, 'heal 1 + 1');
  place(s, 'ai', 1, 0, 'quagsire');   // (not Ramos's Zone: a drain of 1)
  s = strategy(s, 'leech-seed', pref('ai', 1, 0));
  s = nextRound(s);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5, 'the seed heals the holder (1 + 1), not the more-damaged Sudowoodo');
  assert.equal(at(s, 'player', 1, 0).currentStrength, 2);
}

// --- Trainers -----------------------------------------------------------------------------------------

{
  const s0 = grass();
  assert.deepEqual(s0.players.player.zones.map((z) => z.trainer.id), ['erika', 'gardenia', 'ramos']);
  assert.equal(s0.players.player.zones.reduce((n, z) => n + z.trainer.strength, 0), 46);
}
// Erika: (2) put an enemy Pokémon in her Zone to Sleep; friendly Pokémon in her Zone +2 Strength.
{
  let s = grass();
  place(s, 'player', 0, 0, 'bulbasaur');
  assert.equal(maxStrengthOf(at(s, 'player', 0, 0)), 7);
  place(s, 'ai', 0, 1, 'goldeen');
  place(s, 'ai', 1, 1, 'horsea');
  s = act(s, 'player', { type: 'usePower', zone: 0, target: pref('ai', 0, 1) });
  assert.deepEqual(statusOf(at(s, 'ai', 0, 1)), ['sleep']);
  assert.throws(() => act(s, 'player', { type: 'usePower', zone: 0, target: pref('ai', 1, 1) }));
}
// Gardenia: (1) gain 1 Growth; Evolving in her Zone costs 1 less.
{
  let s = grass();
  const before = growthOf(s);
  s = act(s, 'player', { type: 'usePower', zone: 1 });
  assert.equal(growthOf(s), before + 1);
  place(s, 'player', 1, 0, 'bulbasaur');
  place(s, 'player', 2, 0, 'bulbasaur');
  const ivyUid = give(s, 'player', 'ivysaur');
  const card = s.players.player.hand.find((c) => c.uid === ivyUid);
  assert.deepEqual([evolveCost(s, 'player', card, 1), evolveCost(s, 'player', card, 2)], [1, 2]);
  s.players.player.growth = 0;
  const energy = s.players.player.baseEnergy = 10;
  s = act(s, 'player', { type: 'evolve', uid: card.uid, zone: 1, space: 0 });
  assert.equal(s.players.player.baseEnergy, energy - 1, 'paid 1');
}
// Ramos: (1) Leech Seed an enemy Pokémon in his Zone; those seeds drain 1 more.
{
  let s = grass();
  place(s, 'ai', 2, 0, 'quagsire');
  place(s, 'ai', 0, 0, 'lapras');
  place(s, 'player', 0, 1, 'bulbasaur');
  at(s, 'player', 0, 1).currentStrength = 1;
  s = act(s, 'player', { type: 'usePower', zone: 2, target: pref('ai', 2, 0) });
  s = strategy(s, 'leech-seed', pref('ai', 0, 0));
  const q = at(s, 'ai', 2, 0).currentStrength;
  const l = at(s, 'ai', 0, 0).currentStrength;
  s = nextRound(s);
  assert.equal(q - at(s, 'ai', 2, 0).currentStrength, 2 - 2, 'Quagsire Regenerates 2 at Breakfast');
  assert.ok(logged(s, "Ramos's Passive: +1"));
  assert.equal(l - at(s, 'ai', 0, 0).currentStrength, 1, 'outside his Zone: 1');
}

// --- Whole matches: Grass against every deck, seeded, to the end ------------------------------------------

function playOut(seed, decks) {
  let s = createGame(seed, { decks });
  let n = seed;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  let evolves = 0;
  for (let guard = 0; guard < 20000 && s.phase !== 'gameOver' && s.round < 100; guard++) {
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    const action = chooseAction(s, who, { rng }) ?? { type: 'flipCoin' };
    if (action.type === 'evolve') evolves += 1;
    s = applyAction(s, action);
  }
  return { s, evolves };
}
for (const decks of [{ player: 'grass', ai: 'fire' }, { player: 'water', ai: 'grass' }, { player: 'grass', ai: 'grass' }]) {
  for (const seed of [3, 8]) {
    const { s, evolves } = playOut(seed, decks);
    assert.equal(s.phase, 'gameOver', `${decks.player} vs ${decks.ai}, seed ${seed}: finished`);
    if (decks.player === decks.ai) assert.ok(evolves > 0, 'a Grass mirror has Evolves');
  }
}

console.log('All Grass deck tests passed.');
