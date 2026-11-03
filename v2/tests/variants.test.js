// V7b — the balance-experiment flags (never the game's settings) and the diagnostics'
// cause tags: N3, N1, NR, GX, ER and CH9 change only what they say, nothing changes
// without them, and Growth and training events name their source.
// Run with: node v2/tests/variants.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, nurtureSpaces, nurtureCost, champRoundOf, targetOf, PLAYERS } from '../src/engine/game.js';
import { cardDef, DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { pokemonAt, seriesDef } from '../src/engine/series.js';
import { VARIANTS, variantOf, sourceName, runMatchup } from '../tools/roundrobin.js';
import { SETS } from '../tools/variants.js';

function battle(round = 2, variant = null) {
  let s = applyAction(createGame(5, { decks: { player: DECKS.grass.list, ai: DECKS.fire.list }, itemPool: POOL_ITEMS, plans: { player: 'grass', ai: 'fire' }, variant }), { type: 'flipCoin' });
  s.round = round;
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) Object.assign(s.players[who], { energy: 10, hand: [], growth: 0 });
  return s;
}
let n = 0;
function place(s, who, space, series, level = 1) {
  const card = { ...pokemonAt(series, level), cap: seriesDef(series).maxLevel, uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: false, buffs: [] };
  return s.players[who].row[space];
}
const trainer = (s, who, id, space, points = 6) => s.players[who].trainers.push({ ...cardDef(id), uid: `${who}-tr${n++}`, space, points, abilityRound: 0 });
const passBoth = (s) => applyAction(applyAction(s, { type: 'pass', who: 'player' }), { type: 'pass', who: 'ai' });

// The flags parse; unknown flags are refused.
assert.deepEqual(variantOf(['T90', 'N3', 'GX']), { target: 90, nurtureCost: 3, growthBulbasaurOnly: true });
assert.throws(() => variantOf(['N9']), /No variant N9/);
assert.equal(variantOf([]), null);
for (const f of ['N3', 'N1', 'NR', 'GX', 'ER', 'CH9']) assert.ok(VARIANTS[f], `${f} exists`);
assert.ok(SETS.v7b.every((c) => c[0] === 'T90') && SETS.v7b.length === 11, 'V7b: 11 configs, each on top of T90');

// T90 and CH9.
assert.deepEqual([targetOf(battle(2, variantOf(['T90']))), champRoundOf(battle(2, variantOf(['CH9'])))], [90, 9]);
assert.deepEqual([targetOf(battle()), champRoundOf(battle())], [60, 10], 'off by default');

// N3: Nurture costs 3 (Gardenia's lane: 2).
{
  let s = battle(2, variantOf(['N3']));
  place(s, 'player', 0, 'g-bulbasaur', 2);
  place(s, 'player', 3, 'g-oddish', 1);
  trainer(s, 'player', 'g-gardenia', 3, 2);
  s.players.player.growth = 2;
  assert.deepEqual([nurtureCost(s, 'player', 0), nurtureCost(s, 'player', 3), nurtureSpaces(s, 'player')], [3, 2, [3]]);
  s.players.player.growth = 3;
  s = applyAction(s, { type: 'nurture', who: 'player', space: 0 });
  assert.deepEqual([s.players.player.row[0].level, s.players.player.growth], [3, 0]);
}

// N1: once per Round in total. Without it: once per Pokémon.
{
  for (const [variant, after] of [[variantOf(['N1']), []], [null, [1]]]) {
    let s = battle(2, variant);
    place(s, 'player', 0, 'g-bulbasaur', 2);
    place(s, 'player', 1, 'g-bulbasaur', 2);
    s.players.player.growth = 9;
    s = applyAction(s, { type: 'nurture', who: 'player', space: 0 });
    s.turn = 'player';
    assert.deepEqual(nurtureSpaces(s, 'player'), after, variant ? 'N1: no second Nurture this Round' : 'default: the other Pokémon can');
    if (variant) {
      s = passBoth(s);   // the next Round: Nurture again
      s.turn = 'player';
      s.players.player.growth = 9;
      assert.ok(nurtureSpaces(s, 'player').length > 0, 'N1: once per Round, again next Round');
    }
  }
}

// NR: never above the Round number + 1 (Round 2: up to Level 3).
{
  const s = battle(2, variantOf(['NR']));
  place(s, 'player', 0, 'g-bulbasaur', 2);   // 2 → 3: allowed
  place(s, 'player', 1, 'g-bulbasaur', 3);   // 3 → 4: not in Round 2
  s.players.player.growth = 9;
  assert.deepEqual(nurtureSpaces(s, 'player'), [0]);
  const t = battle(2);
  place(t, 'player', 1, 'g-bulbasaur', 3);
  t.players.player.growth = 9;
  assert.deepEqual(nurtureSpaces(t, 'player'), [1], 'default: no Round cap');
}

// GX: only the Bulbasaur line makes Growth at Breakfast.
{
  for (const [variant, growth] of [[variantOf(['GX']), 1], [null, 3]]) {
    let s = battle(2, variant);
    place(s, 'player', 0, 'g-bulbasaur', 1);
    place(s, 'player', 1, 'g-oddish', 1);
    place(s, 'player', 2, 'g-sunkern', 1);
    s = passBoth(s);
    assert.equal(s.players.player.growth, growth, variant ? 'GX: Bulbasaur only' : 'default: Bulbasaur, Oddish and Sunkern');
  }
}

// ER: Erika's Passive is +1 Strength in her lane, with no training.
{
  for (const [variant, level, plus] of [[variantOf(['ER']), 2, 1], [null, 3, 0]]) {
    let s = battle(2, variant);
    const before = place(s, 'player', 1, 'g-bulbasaur', 2).strength;
    trainer(s, 'player', 'g-erika', 1, 2);
    s = passBoth(s);
    const c = s.players.player.row[1];
    assert.equal(c.level, level, variant ? 'ER: no training at Breakfast' : 'default: Erika trains 1');
    if (variant) assert.equal(c.strength, before + plus, 'ER: +1 Strength');
  }
}

// Cause tags: Growth and training events name their source (for the diagnostics only).
{
  let s = battle(2);
  place(s, 'player', 0, 'g-bulbasaur', 2);
  place(s, 'player', 1, 'g-oddish', 1);
  trainer(s, 'player', 'g-erika', 1, 2);
  s = passBoth(s);
  const growth = s.events.filter((e) => e.type === 'growth' && e.who === 'player').map((e) => sourceName(e.cause));
  assert.deepEqual(growth.sort(), ['Bulbasaur line', 'Oddish line']);
  const trained = s.events.find((e) => e.type === 'trained' && e.who === 'player');
  assert.equal(sourceName(trained.cause), 'Erika');
  s.turn = 'player';
  s.players.player.growth = 2;
  s = applyAction(s, { type: 'nurture', who: 'player', space: 0 });
  assert.equal(s.events.find((e) => e.type === 'trained').cause, 'nurture');
}

// The diagnostics: a short seeded run fills every new field.
{
  const r = runMatchup('grass', 'water', 2, variantOf(['T90']));
  const g = r.deck.grass;
  assert.ok(Object.keys(g.growth).length > 0 && g.nurtures > 0, 'Growth by source and Nurtures');
  assert.ok(Object.keys(g.board).length > 0 && Object.values(g.board).every((b) => b.n > 0 && b.level >= b.n), 'board Level at Supper');
  assert.ok(r.deck.water.guardsMet >= r.deck.water.guardsAsleep, 'Asleep guards counted');
}

console.log('variants.test: ok');
