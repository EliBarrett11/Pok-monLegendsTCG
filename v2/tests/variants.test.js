// V7b — the balance-experiment flags (never the game's settings) and the diagnostics'
// cause tags: N3, N1, NR, GX, ER and CH9 change only what they say, nothing changes
// without them, and Growth and training events name their source.
// Run with: node v2/tests/variants.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, nurtureSpaces, nurtureCost, champRoundOf, targetOf, legalTargets, summonCost, playable, targetOptions, PLAYERS } from '../src/engine/game.js';
import { cardDef, DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { pokemonAt, seriesDef } from '../src/engine/series.js';
import { VARIANTS, variantOf, sourceName, runMatchup, deckList } from '../tools/roundrobin.js';
import { deckProblems, copiesOf } from '../src/engine/cards.js';
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

// F1: Fire Pokémon +1 Strength (W1's mirror); Water and Grass unchanged.
{
  const s = battle(2, variantOf(['F1']));
  s.turn = 'ai';
  s.players.ai.hand.push({ ...pokemonAt('f-growlithe', 2), cap: 6, uid: 'ai-f1' });
  const t = applyAction(s, { type: 'summon', who: 'ai', uid: 'ai-f1', space: 0 });
  assert.equal(t.players.ai.row[0].strength, pokemonAt('f-growlithe', 2).strength + 1);
}

// LG (V7c): lane guards. Every enemy Pokémon can be attacked; the enemy player is guarded
// only by a matching guard across from the attacker. Without LG: any matching guard.
{
  const setup = (variant) => {
    const s = battle(3, variant);
    place(s, 'ai', 0, 'g-bulbasaur', 1);   // Ivysaur's line at L1: Special Defence
    place(s, 'ai', 4, 'g-geodude', 1);     // Defence
    place(s, 'ai', 6, 'g-oddish', 1);      // Hitpoints
    place(s, 'player', 4, 'f-growlithe', 1);   // Physical, across from Geodude
    place(s, 'player', 6, 'f-ponyta', 1);      // Physical, across from Oddish
    return s;
  };
  const key = (ts) => ts.map((t) => (t.kind === 'player' ? 'P' : t.space)).sort().join();
  const lg = setup(variantOf(['LG']));
  assert.equal(lg.players.ai.row[4].strengthType, 'Defence');
  assert.equal(key(legalTargets(lg, 'player', 4)), '0,4,6', 'LG: a Defence guard across blocks the player only');
  assert.equal(key(legalTargets(lg, 'player', 6)), '0,4,6,P', 'LG: no guard across: the player too');
  const plain = setup(null);
  assert.equal(key(legalTargets(plain, 'player', 6)), '4', 'default: the Defence guard anywhere');
}

// FG (V7c): Growlithe → Arcanine has Defence (same numbers); 2 Duskull for 1 Mankey.
{
  const fire = deckList('fire', variantOf(['FG']));
  assert.deepEqual(deckProblems(fire), [], 'FG: still a legal deck');
  assert.deepEqual([copiesOf(fire)['f-duskull'], copiesOf(fire)['f-mankey'], fire.length], [2, 1, 40]);
  assert.equal(deckList('fire', null), DECKS.fire.list, 'default: the deck as written');
  for (const level of [2, 5]) {
    const s = battle(level, variantOf(['FG']));
    s.turn = 'ai';
    s.players.ai.hand.push({ ...pokemonAt('f-growlithe', level), cap: 6, uid: `ai-fg${level}` });
    const t = applyAction(s, { type: 'summon', who: 'ai', uid: `ai-fg${level}`, space: 0 });
    const c = t.players.ai.row[0];
    assert.deepEqual([c.strengthType, c.strength], ['Defence', pokemonAt('f-growlithe', level).strength]);
  }
}

// C1 (V7d): no Pokémon costs less than 1; without it, light Pokémon can be free.
{
  const oddish = { ...pokemonAt('g-oddish', 1), cap: 6, uid: 'player-c1' };
  assert.equal(oddish.cost, 0, 'Oddish L1 is free as written');
  const c1 = battle(1, variantOf(['C1']));
  const plain = battle(1);
  assert.deepEqual([summonCost(oddish, false, c1, 'player', 0), summonCost(oddish, false, plain, 'player', 0)], [1, 0]);
  for (const s of [c1, plain]) { s.players.player.energy = 0; s.players.player.hand = [oddish]; }
  assert.deepEqual([playable(c1, 'player').length, playable(plain, 'player').length], [0, 1], 'C1: not playable with 0 Energy');
  assert.throws(() => applyAction(c1, { type: 'summon', who: 'player', uid: 'player-c1', space: 0 }));
}

// GS (V7d): Grass-deck Pokémon −1 Strength at every Level; other decks unchanged.
{
  for (const [series, who, minus] of [['g-bulbasaur', 'player', 1], ['f-growlithe', 'ai', 0]]) {
    const s = battle(4, variantOf(['GS']));
    s.turn = who;
    s.players[who].hand.push({ ...pokemonAt(series, 4), cap: 6, uid: `${who}-gs` });
    const t = applyAction(s, { type: 'summon', who, uid: `${who}-gs`, space: 0 });
    assert.equal(t.players[who].row[0].strength, pokemonAt(series, 4).strength - minus, series);
  }
}

// SL (V7d): Sleep Powder costs 3; Gloom's On Evolve Sleep reaches only a lower Level.
{
  const powderOf = (variant) => createGame(5, { decks: { player: DECKS.grass.list, ai: DECKS.fire.list }, variant })
    .players.player.drawPile.find((c) => c.id === 'g-sleep-powder').breakpoints.map((b) => b.cost);
  assert.deepEqual([powderOf(variantOf(['SL'])), powderOf(null)], [[3], [2]]);
  for (const [variant, slept] of [[variantOf(['SL']), [false, true]], [null, [true, true]]]) {
    let t = battle(2, variant);
    place(t, 'player', 0, 'g-oddish', 2);   // Nurtured to Gloom, Level 3
    place(t, 'ai', 0, 'f-growlithe', 4);    // Level 4: not lower than Gloom's 3
    t.players.player.growth = 2;
    t = applyAction(t, { type: 'nurture', who: 'player', space: 0 });
    if (t.choices.length) t = applyAction(t, { type: 'chooseTarget', who: 'player', targets: [{ who: 'ai', kind: 'pokemon', space: 0 }] });
    const first = !!t.players.ai.row[0].asleep;
    let u = battle(2, variant);
    place(u, 'player', 0, 'g-oddish', 2);
    place(u, 'ai', 0, 'f-growlithe', 2);    // Level 2: lower
    u.players.player.growth = 2;
    u = applyAction(u, { type: 'nurture', who: 'player', space: 0 });
    assert.deepEqual([first, !!u.players.ai.row[0].asleep], slept, variant ? 'SL: only a lower Level' : 'default: any Level');
  }
}

// F½ and WA (V7e): Fire +1 Strength from Level 3 only; Water +1 Attack.
{
  for (const [series, who, level, flag, field, plus] of [['f-growlithe', 'ai', 2, 'F½', 'strength', 0], ['f-growlithe', 'ai', 4, 'F½', 'strength', 1],
    ['w-squirtle', 'ai', 2, 'WA', 'attack', 1], ['g-bulbasaur', 'player', 2, 'WA', 'attack', 0]]) {
    const s = battle(level, variantOf([flag]));
    s.turn = who;
    s.players[who].hand.push({ ...pokemonAt(series, level), cap: 6, uid: `${who}-x` });
    const t = applyAction(s, { type: 'summon', who, uid: `${who}-x`, space: 0 });
    assert.equal(t.players[who].row[0][field], pokemonAt(series, level)[field] + plus, `${flag} ${series} L${level}`);
  }
  assert.equal(SETS.v7e.length, 24, 'V7e: the 24-config grid');
}

// WA½, S2 and S2c (V7f): Water +1 Attack from Level 3; a second Surf for Dive; Surf's 3 costs 2.
{
  for (const [level, plus] of [[2, 0], [4, 1]]) {
    const s = battle(level, variantOf(['WA½']));
    s.turn = 'ai';
    s.players.ai.hand.push({ ...pokemonAt('w-squirtle', level), cap: 6, uid: 'ai-wah' });
    const t = applyAction(s, { type: 'summon', who: 'ai', uid: 'ai-wah', space: 0 });
    assert.equal(t.players.ai.row[0].attack, pokemonAt('w-squirtle', level).attack + plus, `WA½ L${level}`);
  }
  for (const flag of ['S2', 'S2c']) {
    const water = deckList('water', variantOf([flag]));
    assert.deepEqual([deckProblems(water), copiesOf(water)['w-surf'], copiesOf(water)['w-dive'] ?? 0, water.length], [[], 2, 0, 40], flag);
  }
  const surfCosts = (flags) => createGame(5, { decks: { player: deckList('water', variantOf(flags)), ai: DECKS.fire.list }, variant: variantOf(flags) })
    .players.player.drawPile.filter((c) => c.id === 'w-surf').map((c) => c.breakpoints.map((b) => b.cost).join('/'));
  assert.deepEqual([surfCosts(['S2']), surfCosts(['S2c'])], [['3/5', '3/5'], ['2/5', '2/5']]);
  assert.deepEqual([SETS['v7f-confirm'].length, SETS.v7f.length], [3, 18]);
}

// The flags parse; unknown flags are refused.
assert.deepEqual(variantOf(['T90', 'N3', 'GX']), { target: 90, nurtureCost: 3, growthBulbasaurOnly: true });
assert.throws(() => variantOf(['N9']), /No variant N9/);
assert.equal(variantOf([]), null);
for (const f of ['N3', 'N1', 'NR', 'GX', 'ER', 'CH9', 'F1', 'LG', 'FG', 'C1', 'GS', 'SL', 'F½', 'WA', 'WA½', 'S2', 'S2c']) assert.ok(VARIANTS[f], `${f} exists`);
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
  assert.ok(g.atPlayer > 0 && g.atPlayer + g.ownLane <= g.attacks, 'attacks on the player and in its own lane');
}

console.log('variants.test: ok');
