// V6 — the v2 decks: legality of Fire, Water and Grass; each new mechanic (Nurture,
// Growth, On Evolve and "On Evolve or Summon", Rage, Agility, Retaliate, "can't be
// guarded", Burn and Douse on player characters, plus the keywords and triggers the decks
// use); a sample of key cards per deck; and seeded matches for every pairing.
// Run with: node v2/tests/decks.test.js
import assert from 'node:assert/strict';
import {
  actor, createGame, applyAction, legalActions, targetOptions, nurtureSpaces, nurtureCost, kwSum, summonCost, weatherTotals, PLAYERS,
} from '../src/engine/game.js';
import { cardAt, cardDef, deckProblems, DECKS, POOL_ITEMS, copiesOf, copyLimit } from '../src/engine/cards.js';
import { pokemonAt, seriesDef } from '../src/engine/series.js';
import { chooseAction } from '../src/ai/opponent.js';

const real = (a = 'fire', b = 'water', seed = 5) => createGame(seed, { decks: { player: DECKS[a].list, ai: DECKS[b].list }, itemPool: POOL_ITEMS, plans: { player: a, ai: b } });
function battle(round = 1, a = 'fire', b = 'water') {
  let s = applyAction(real(a, b), { type: 'flipCoin' });
  s.round = round;
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) Object.assign(s.players[who], { energy: 10, hand: [], growth: 0 });
  return s;
}
let n = 0;
const give = (s, who, id, level) => {
  const def = cardDef(id);
  const card = def.cardType === 'Pokémon' ? { ...pokemonAt(id, level ?? 1), cap: seriesDef(id).maxLevel } : def;
  s.players[who].hand.push({ ...card, uid: `${who}-g${n++}` });
  return s.players[who].hand.at(-1).uid;
};
function place(s, who, space, series, level = 1, extra = {}) {
  const card = { ...pokemonAt(series, level), cap: seriesDef(series).maxLevel, uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: false, buffs: [], ...extra };
  return s.players[who].row[space];
}
const trainer = (s, who, id, space, points = 6) => { const t = { ...cardDef(id), uid: `${who}-tr${n++}`, space, points, abilityRound: 0 }; s.players[who].trainers.push(t); return t; };
const act = (s, a) => applyAction(s, a);
const other = (w) => (w === 'player' ? 'ai' : 'player');
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: other(s.turn) });
const mon = (who, space) => ({ who, kind: 'pokemon', space });
const pc = (who) => ({ who, kind: 'player' });
const settle = (s) => { const t = structuredClone(s); t.turn = 'player'; return act(act(t, { type: 'pass', who: 'player' }), { type: 'pass', who: 'ai' }); };

// --- Deck legality ------------------------------------------------------------------------------------

{
  const shape = { Pokémon: 17, Strategy: 8, Supporter: 4, Trainer: 3, Location: 4, Item: 4 };
  for (const [name, deck] of Object.entries(DECKS)) {
    assert.deepEqual(deckProblems(deck.list), [], `${name}: legal`);
    const count = {};
    for (const e of deck.list) { const c = cardAt(e, 1); count[c.cardType] = (count[c.cardType] ?? 0) + 1; }
    assert.deepEqual(count, shape, `${name}: 17 / 8 / 4 / 3 / 4 / 4`);
    for (const [key, k] of Object.entries(copiesOf(deck.list))) assert.ok(k <= copyLimit(key), `${name}: ${key} within its copy limit`);
    assert.equal(deck.list.filter((e) => e.series && seriesDef(e.series).legendary).length, 1, `${name}: one Legendary`);
  }
  assert.equal(POOL_ITEMS.length, 12, '12 shared Items');
  // Copies as written.
  const copies = (deck, id) => copiesOf(DECKS[deck].list)[id];
  assert.deepEqual([copies('fire', 'f-growlithe'), copies('fire', 'f-ponyta'), copies('fire', 'f-ember'), copies('fire', 'f-mt-ember')], [3, 3, 3, 2]);
  assert.deepEqual([copies('water', 'w-squirtle'), copies('water', 'w-cerulean-cape'), copies('water', 'w-aqua-ring')], [3, 2, 2]);
  assert.deepEqual([copies('grass', 'g-bulbasaur'), copies('grass', 'g-oddish'), copies('grass', 'g-sunkern'), copies('grass', 'g-sewaddle'), copies('grass', 'g-solar-beam')], [3, 3, 3, 3, 2]);
  // Suggested caps are the deck defaults.
  assert.deepEqual(['f-ponyta', 'f-sneasel', 'f-entei', 'w-wooper', 'g-bonsly'].map((id) => DECKS[id[0] === 'f' ? 'fire' : id[0] === 'w' ? 'water' : 'grass'].list.find((e) => e.series === id).cap), [4, 5, undefined, 4, 4], 'a Legendary has no cap');
}

// --- Stages, stats, weights and abilities by Level (a sample) ---------------------------------------------

{
  const names = (id) => Array.from({ length: seriesDef(id).maxLevel }, (_, i) => pokemonAt(id, i + 1).name);
  assert.deepEqual(names('f-magby'), ['Magby', 'Magby', 'Magmar', 'Magmar', 'Magmortar', 'Magmortar']);
  assert.deepEqual(names('w-happiny'), ['Happiny', 'Happiny', 'Chansey', 'Chansey', 'Blissey', 'Blissey']);
  assert.deepEqual(names('g-bonsly'), ['Bonsly', 'Bonsly', 'Bonsly', 'Sudowoodo', 'Sudowoodo', 'Sudowoodo']);
  assert.deepEqual([1, 4, 6].map((l) => [pokemonAt('f-growlithe', l).attack, pokemonAt('f-growlithe', l).strength]), [[3, 3], [5, 6], [7, 7]]);
  assert.deepEqual(pokemonAt('f-growlithe', 4).keywords, ['Scorch 1', 'Infiltrator', 'Overrun']);
  assert.deepEqual([pokemonAt('f-charmander', 4).speed, pokemonAt('f-charmander', 5).speed], ['Steady', 'Swift'], 'Charizard is Swift');
  assert.deepEqual([pokemonAt('w-eevee', 3).type, pokemonAt('w-eevee', 4).type, pokemonAt('w-eevee', 4).strengthType], ['Normal', 'Water', 'Special Defence'], 'Vaporeon: Water, Special Defence guard');
  assert.deepEqual([pokemonAt('g-bulbasaur', 1).strengthType, pokemonAt('g-bulbasaur', 3).strengthType], ['Special Defence', 'Hitpoints'], 'guard on Bulbasaur only');
  assert.deepEqual([pokemonAt('g-sewaddle', 3).strengthType, pokemonAt('g-sewaddle', 5).speed], ['Defence', 'Swift'], 'Swadloon guards; Leavanny is Swift');
  // Legendaries (V7a): single cards with a fixed cost and stats, no Levels, never trained.
  const legend = (id) => { const c = pokemonAt(id, 1); return [c.cost, c.attack, c.strength, seriesDef(id).maxLevel]; };
  assert.deepEqual([legend('f-entei'), legend('w-kyogre'), legend('g-celebi')], [[6, 9, 9, 1], [7, 10, 12, 1], [3, 4, 6, 1]]);
  assert.throws(() => pokemonAt('f-entei', 2), /no Level 2/);
  assert.deepEqual([1, 6, 11].map((r) => cardAt({ series: 'w-kyogre' }, r).cost), [7, 7, 7], 'the same card in every Round');
  assert.deepEqual([pokemonAt('f-ponyta', 1).cost, pokemonAt('f-magby', 1).cost], [0, 2], 'light −1 (min 0), heavy +1');
  assert.equal(pokemonAt('w-dratini', 1).art, 'dragonite', 'missing art falls back to the line base');
  assert.equal(pokemonAt('g-eevee', 4).art, 'eevee', 'Leafeon shares the Eevee art for now');
}

// --- Growth and Nurture ---------------------------------------------------------------------------------

{
  let s = battle(2, 'grass', 'fire');
  place(s, 'player', 0, 'g-bulbasaur', 2);   // L2, cap 6
  s.players.player.growth = 3;
  assert.deepEqual([nurtureSpaces(s, 'player'), nurtureCost(s, 'player', 0)], [[0], 2]);
  s = act(s, { type: 'nurture', who: 'player', space: 0 });
  const iv = s.players.player.row[0];
  assert.deepEqual([iv.level, iv.name, s.players.player.growth, s.turn], [3, 'Ivysaur', 1, 'ai'], 'Nurture: 2 Growth, train 1, a Battle Action');
  s.turn = 'player';
  s.players.player.growth = 9;
  assert.deepEqual(nurtureSpaces(s, 'player'), [], 'once per Pokémon per Round');
  // On Evolve: Ivysaur Leech Seeds an enemy Pokémon in its Location (at Home: its own lane).
  s = battle(2, 'grass', 'fire');
  place(s, 'player', 0, 'g-bulbasaur', 2);
  place(s, 'ai', 0, 'f-growlithe', 3);
  place(s, 'ai', 4, 'f-growlithe', 3);
  s.players.player.growth = 2;
  s = act(s, { type: 'nurture', who: 'player', space: 0 });
  assert.deepEqual([s.players.ai.row[0].seededBy, s.players.ai.row[4].seededBy ?? null], ['player', null], 'On Evolve fired, in its own lane only');
  // Elliott's V6 ruling: the player chooses an On Evolve target (with more than one option).
  s = battle(2, 'grass', 'fire');
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'g-eterna-forest'), start: 0 });   // lanes 1–3
  s.turn = 'player';
  place(s, 'player', 1, 'g-bulbasaur', 2);
  place(s, 'ai', 0, 'f-growlithe', 3);
  place(s, 'ai', 2, 'f-ponyta', 3);
  s.players.player.growth = 2;
  s = act(s, { type: 'nurture', who: 'player', space: 1 });
  assert.deepEqual([s.choices.length, legalActions(s, 'player'), legalActions(s, 'ai')], [1, ['chooseTarget'], []], 'it waits for the player');
  s = act(s, { type: 'chooseTarget', who: 'player', targets: [mon('ai', 2)] });
  assert.deepEqual([s.players.ai.row[2].seededBy, s.players.ai.row[0].seededBy ?? null, s.choices.length], ['player', null, 0]);
  // Gardenia: Nurturing in her lane costs 1 less.
  s = battle(2, 'grass', 'fire');
  place(s, 'player', 3, 'g-oddish', 1);
  trainer(s, 'player', 'g-gardenia', 3, 2);
  assert.equal(nurtureCost(s, 'player', 3), 1);
  // Growth: On Breakfast abilities, and Sun 4 gives each player +1 at Breakfast.
  s = battle(2, 'grass', 'fire');
  place(s, 'player', 0, 'g-bulbasaur', 1);
  place(s, 'player', 1, 'g-sunkern', 1);   // 1 Sun
  place(s, 'player', 2, 'g-sunkern', 4);   // Sunflora: 2 Sun
  place(s, 'ai', 0, 'g-sunkern', 1);       // 1 Sun (either side counts)
  assert.equal(weatherTotals(s).Sun, 4, 'Weather Tokens on Pokémon count');
  s = passBoth(s);
  assert.equal(s.players.player.growth, 1 + 1 + 1, 'Bulbasaur 1 + Sunkern 1 + Sun 4');
  assert.equal(s.players.ai.growth, 1 + 1, 'Sun 4 is for everyone');
  // Sunflora: +2 damage with its attack while Sun is 4+.
  s.turn = 'player';
  s.players.player.row[2].spent = false;
  for (const sp of [0, 1]) s.players.player.row[sp].spent = true;
  s.players.ai.row[0].spent = true;
  const before = s.players.player.recognition;
  s = act(s, { type: 'attack', who: 'player', from: 2, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition - before, 5 + 2);
}

// --- Solar Beam, "can't be guarded", Douse your player character --------------------------------------------

{
  let s = battle(3, 'grass', 'fire');
  const uid = give(s, 'player', 'g-solar-beam');
  assert.equal(legalActions(s, 'player').includes('playStrategy'), false, 'needs at least 1 Growth');
  s.players.player.growth = 7;
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [pc('ai')], x: 6 }), /Spend 1 to 5/);
  let t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [pc('ai')], x: 4 });
  assert.deepEqual([t.players.player.recognition, t.players.player.growth], [4, 3], '4 Growth: 4 damage to the enemy player');
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 4, targets: [pc('ai')] });
  assert.deepEqual([t.players.player.recognition, t.players.player.growth], [7, 0], 'up to 10: all 7 by default');
  assert.ok(!cardDef('g-solar-beam').breakpoints[1].target.unguarded && !/guarded/.test(cardDef('g-solar-beam').breakpoints[1].text), '4: no "can\u2019t be guarded" (Elliott\'s V6 ruling)');
  assert.ok(cardDef('g-solar-beam').retain);
  // Synthesis 1: Douse your player character.
  s = battle(3, 'grass', 'fire');
  s.players.player.burn = 3;
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'g-synthesis'), pay: 1, targets: [pc('player')] });
  assert.deepEqual([s.players.player.burn, s.players.player.growth], [0, 2]);
}

// --- Keywords: Scorch, Overrun, Rage, Agility, Retaliate, Shell, Infiltrator, Quick Attack ----------------------

{
  // Scorch: its attack burns the target (and the enemy player).
  let s = battle(3);
  place(s, 'player', 0, 'f-growlithe', 1);   // Scorch 1, 3 Attack
  place(s, 'ai', 0, 'w-squirtle', 6, { spent: true });   // 6/10 Defence guard
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.ai.row[0].burn, 1);
  s = battle(3);
  place(s, 'player', 0, 'f-growlithe', 1);
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.deepEqual([s.players.player.recognition, s.players.ai.burn], [3, 1], 'Scorch on the player character');
  // Overrun: the damage left over goes to the enemy player (Recognition).
  s = battle(3);
  place(s, 'player', 0, 'f-growlithe', 6);   // Arcanine 7, Overrun
  place(s, 'ai', 0, 'w-wingull', 1, { spent: true });   // 2/3
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.deepEqual([s.players.ai.row[0], s.players.player.recognition], [null, 7 - 3]);
  // Rage: +1 Attack (permanent) each time it survives damage.
  s = battle(4);
  const pri = place(s, 'player', 0, 'f-mankey', 4);   // Primeape 5/4, Rage
  place(s, 'ai', 0, 'w-wingull', 1);   // Swift 2/3: hits back
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].currentStrength], [pri.attack + 1, 2]);
  // Agility: no Strategy Card can choose it; "every" effects still reach it.
  s = battle(5, 'fire', 'grass');
  place(s, 'ai', 0, 'g-caterpie', 5);   // Butterfree, Agility
  place(s, 'ai', 1, 'g-oddish', 1);
  const fb = cardDef('f-fire-blast').breakpoints[0].target;
  assert.deepEqual(targetOptions(s, 'player', fb).map((t) => t.space ?? 'player'), [1, 'player']);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'f-heat-wave'), pay: 3 });
  assert.equal(s.players.ai.row[0].burn, 1, 'Heat Wave (every enemy) still burns it');
  // Retaliate (Rocky Helmet): the attacker takes 2, even if the holder is defeated.
  s = battle(3, 'fire', 'water');
  place(s, 'ai', 0, 'w-wingull', 1, { spent: true, keywords: ['Retaliate 2'] });
  place(s, 'player', 0, 'f-growlithe', 6);   // 7/7
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.deepEqual([s.players.ai.row[0], s.players.player.row[0].currentStrength], [null, 5]);
  // Shell (Blastoise Shell 2): each damage 2 less, minimum 1.
  s = battle(5, 'fire', 'water');
  place(s, 'ai', 0, 'w-squirtle', 5, { spent: true });   // 5/9 Shell 2
  place(s, 'player', 0, 'f-growlithe', 1);
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.ai.row[0].currentStrength, 9 - 1);
  // Quick Attack: Ponyta arrives Active.
  s = battle(1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'f-ponyta'), space: 0 });
  assert.equal(s.players.player.row[0].spent, false);
}

// --- Triggers: On Summon, On Attack, On Defend, On Knockout, On Defeated, On Breakfast, Rally, On Heal ---------

{
  // Houndour On Summon: the enemy player gains Burn 1 (Houndoom 2).
  let s = battle(1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'f-houndour', 1), space: 0 });
  assert.equal(s.players.ai.burn, 1);
  s = battle(4);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'f-houndour', 4), space: 0 });
  assert.equal(s.players.ai.burn, 2);
  // Charizard On Summon: Burn 1 to every enemy Pokémon; Empower +3: the enemy player Burn 2.
  s = battle(5);
  place(s, 'ai', 0, 'w-wingull', 1);
  place(s, 'ai', 1, 'w-wooper', 1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'f-charmander', 5), space: 4, empowered: true });
  assert.deepEqual([s.players.ai.row[0].burn, s.players.ai.row[1].burn, s.players.ai.burn], [1, 1, 2]);
  // Duskull On Defend: Burn 1 to the attacker.
  s = battle(2, 'water', 'fire');
  place(s, 'ai', 0, 'f-duskull', 1, { spent: true });   // Special Defence guard
  place(s, 'player', 0, 'w-chinchou', 1);   // Special: must attack the guard
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.player.row[0].burn, 1);
  // Geodude On Defend: 1 damage to the attacker.
  s = battle(2, 'fire', 'grass');
  place(s, 'ai', 0, 'g-geodude', 1, { spent: true });
  place(s, 'player', 0, 'f-growlithe', 1);
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.player.row[0].currentStrength, 3 - 1);
  // Weavile On Knockout: becomes Active (once per Round).
  s = battle(4);
  place(s, 'player', 0, 'f-sneasel', 4);   // Weavile 5/4
  place(s, 'ai', 0, 'w-wingull', 1, { spent: true });
  place(s, 'ai', 1, 'w-wingull', 1, { spent: true });
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.player.row[0].spent, false, 'Active again');
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 1) });
  assert.equal(s.players.player.row[0].spent, true, 'only once per Round');
  // Sewaddle On Defeated: gain 2 Growth.
  s = battle(2, 'fire', 'grass');
  place(s, 'ai', 0, 'g-sewaddle', 1, { spent: true });
  place(s, 'player', 0, 'f-growlithe', 6);
  s = act(s, { type: 'attack', who: 'player', from: 0, target: mon('ai', 0) });
  assert.equal(s.players.ai.growth, 2);
  // Magikarp: Splash draws 1. Gyarados On Summon: 2 damage to each enemy Pokémon in its Location.
  s = battle(4, 'water', 'fire');
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'w-magikarp', 1), space: 0 });
  assert.equal(s.players.player.hand.length, 1);
  s = battle(4, 'water', 'fire');
  place(s, 'ai', 2, 'f-growlithe', 4);
  place(s, 'ai', 7, 'f-growlithe', 4);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'w-magikarp', 4), space: 7 });
  assert.deepEqual([s.players.ai.row[7].currentStrength, s.players.ai.row[2].currentStrength], [6 - 2, 6], 'at Home, its Location is its own lane (Elliott\'s V6 ruling)');
  // Rally: Horsea +1/+1 when another friendly Pokémon is summoned into its Location.
  s = battle(2, 'water', 'fire');
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'w-cerulean-cape'), start: 0 });   // lanes 1–2
  s.turn = 'player';
  place(s, 'player', 0, 'w-horsea', 1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'w-wingull'), space: 1 });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].strength], [3, 5]);
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'w-wingull'), space: 5 });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].strength], [3, 5], 'not from outside its Location');
  // Vaporeon On Heal: +1 Attack; Happiny On Breakfast heals.
  s = battle(4, 'water', 'fire');
  place(s, 'player', 0, 'w-eevee', 4, { currentStrength: 3 });   // Vaporeon 5/7
  place(s, 'player', 1, 'w-happiny', 3);   // Chansey: heal each in its Location 2
  s = passBoth(s);
  const v = s.players.player.row[0];
  assert.ok(v.currentStrength > 3 && v.attack >= 6, 'healed (Regenerate 2, Chansey) and gained Attack');
  // Bellossom: On Evolve or Summon: each enemy Pokémon in its Location falls Asleep.
  s = battle(5, 'grass', 'fire');
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'g-eterna-forest'), start: 0 });   // lanes 1–3
  s.turn = 'player';
  place(s, 'ai', 0, 'f-growlithe', 1);
  place(s, 'ai', 2, 'f-ponyta', 1);
  place(s, 'ai', 5, 'f-ponyta', 1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'g-oddish', 5), space: 1 });
  assert.deepEqual([s.players.ai.row[0].asleep, s.players.ai.row[2].asleep, s.players.ai.row[5].asleep ?? false], [true, true, false]);
  // Gloom: On Summon: an enemy Pokémon in its Location falls Asleep (the player's choice).
  s = battle(3, 'grass', 'fire');
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'g-eterna-forest'), start: 0 });
  s.turn = 'player';
  place(s, 'ai', 0, 'f-growlithe', 1);
  place(s, 'ai', 1, 'f-ponyta', 1);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'g-oddish', 3), space: 2, targets: [mon('ai', 1)] });
  assert.deepEqual([s.players.ai.row[0].asleep ?? false, s.players.ai.row[1].asleep], [false, true]);
}

// --- Strategy Cards, Supporters, Trainers, Items (a sample per deck) ---------------------------------------

{
  // Fire: Ember 4 (two targets, −1 Recognition); Fire Blast 5 on the player; Firebreather Favour; Chili; Burglar.
  let s = battle(5);
  s.players.ai.recognition = 10;
  place(s, 'ai', 0, 'w-squirtle', 3);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'f-fire-blast'), pay: 5, targets: [pc('ai')] });
  assert.deepEqual([s.players.player.recognition, s.players.ai.burn], [6, 2], 'Fire Blast: 6 damage, then Burn 2');
  s = battle(3);
  place(s, 'ai', 0, 'w-squirtle', 3);
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'f-firebreather'), release: [give(s, 'player', 'f-growlithe')] });
  assert.deepEqual([s.players.ai.burn, s.players.ai.row[0].burn], [3, 1], 'Favour (a Fire Pokémon): Burn 3, and 1 to every enemy Pokémon');
  // Chili on a single Home lane (Elliott's V6 ruling: a real Location or one Home lane).
  s = battle(3);
  place(s, 'player', 0, 'f-mankey', 1, { spent: true });
  place(s, 'player', 1, 'f-ponyta', 1, { spent: true });
  assert.ok(targetOptions(s, 'player', cardDef('f-chili').target).some((t) => t.id === 'home-4'), 'each Home lane can be chosen');
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'f-chili'), release: [give(s, 'player', 'f-ponyta')], targets: [{ who: 'player', kind: 'location', id: 'home-0' }] });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].spent, s.players.player.row[0].keywords.filter((k) => k === 'Overrun').length, s.players.player.row[1].spent], [5, false, 2, true], 'Chili Favour (Swift): +2, Overrun, Active; only that lane');
  s = passBoth(s);
  assert.equal(s.players.player.row[0].attack, 3, '"this Round" ends at Supper');
  s = battle(3);
  s.players.ai.bag = [{ ...cardDef('p-amulet-coin'), uid: 'x1' }];
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'f-burglar'), release: [give(s, 'player', 'f-ember'), give(s, 'player', 'f-ember')], picks: ['x1'] });
  assert.deepEqual([s.players.player.bag.map((c) => c.id), s.players.ai.bag.length], [['p-amulet-coin'], 0]);
  // Fire Trainers: Blaine (lane Burn +1), Flannery (lane Overrun for Fire), Kabu (+2 Strength).
  s = battle(3);
  trainer(s, 'player', 'f-blaine', 0, 2);
  trainer(s, 'player', 'f-kabu', 1, 2);
  place(s, 'player', 0, 'f-growlithe', 1);
  place(s, 'player', 1, 'f-ponyta', 1);
  s = settle(s);
  assert.equal(s.players.player.row[1].strength, 2 + 2);
  s.turn = 'player';
  s.players.player.row[0].spent = false;
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.ai.burn, 1 + 1, 'Scorch 1 +1 from Blaine in its lane');
  // Water: Bubble Beam with Rain; Dive Returns; Fisherman Searches; Tracey; Swimmer free summons; Wallace.
  s = battle(3, 'water', 'fire');
  place(s, 'player', 0, 'w-wingull', 4);   // 2 Rain
  place(s, 'ai', 0, 'f-growlithe', 6);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'w-bubble-beam'), pay: 2, targets: [mon('ai', 0)] });
  assert.equal(s.players.ai.row[0].currentStrength, 7 - 3, '3 if Rain is 2+');
  s = battle(3, 'water', 'fire');
  assert.equal(legalActions(s, 'player').includes('playStrategy'), false, 'Dive: no Pokémon in the Discard Pile');
  s.players.player.discard.push({ ...pokemonAt('w-squirtle', 3), cap: 6, uid: 'd1' });
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'w-dive'), pay: 2, picks: ['d1'] });
  assert.deepEqual([s.players.player.hand.at(-1).uid, s.players.player.hand.at(-1).retain], ['d1', true]);
  s = battle(3, 'water', 'fire');
  const water = s.players.player.drawPile.find((c) => c.type === 'Water' && c.cardType === 'Pokémon');
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'w-fisherman'), release: [give(s, 'player', 'w-wingull')], picks: [water.uid] });
  assert.ok(s.players.player.hand.some((c) => c.uid === water.uid && c.retain), 'Fisherman: the chosen Water Pokémon, with Retain');
  s = battle(3, 'water', 'fire');
  const top = s.players.player.drawPile.slice(0, 4).map((c) => c.uid);
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'w-tracey'), release: [give(s, 'player', 'w-dive')], picks: [top[1], top[3]] });
  assert.deepEqual(s.players.player.hand.map((c) => c.uid).sort(), [top[1], top[3]].sort());
  assert.deepEqual(s.players.player.drawPile.slice(-2).map((c) => c.uid), [top[0], top[2]], 'the rest on the bottom');
  s = battle(3, 'water', 'fire');
  const low = give(s, 'player', 'w-squirtle', 2);
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'w-swimmer'), release: [give(s, 'player', 'w-wingull')], picks: [low] });
  assert.deepEqual([s.players.player.row[0]?.name, s.players.player.row[0]?.spent, s.players.player.energy], ['Squirtle', false, 10], 'Swimmer Favour (Water): free, and Active');
  s = battle(3, 'water', 'fire');
  trainer(s, 'player', 'w-wallace', 2, 2);
  const sq = give(s, 'player', 'w-squirtle', 3);   // cost 2
  assert.equal(summonCost(s.players.player.hand[0], false, s, 'player', 2), 1);
  s = act(s, { type: 'summon', who: 'player', uid: sq, space: 2 });
  assert.equal(s.players.player.energy, 9, 'Wallace: the first in his lane each Round costs 1 less');
  // Water Trainers: Misty +1/+1 for Water in her lane; Crasher Wake Shell 1.
  s = battle(3, 'water', 'fire');
  trainer(s, 'player', 'w-misty', 0, 2);
  place(s, 'player', 0, 'w-squirtle', 1);
  s = settle(s);
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].strength], [3, 5]);
  // Grass: Leech Seed (Ramos +1), Rock Slide, Mallow Favour, Pokémon Breeder, Brock until Breakfast; Big Root.
  s = battle(3, 'grass', 'fire');
  trainer(s, 'player', 'g-ramos', 4, 2);
  place(s, 'ai', 4, 'f-growlithe', 6);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'g-leech-seed'), pay: 1, targets: [mon('ai', 4)] });
  s = passBoth(s);
  assert.equal(s.players.ai.row[4].currentStrength, 7 - 2, 'Ramos: drains 1 more in his lane');
  s = battle(3, 'grass', 'fire');
  place(s, 'player', 0, 'g-bulbasaur', 1);
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'g-mallow'), release: [give(s, 'player', 'g-oddish')], targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.growth, s.players.player.row[0].level], [3, 2], 'Mallow Favour (Grass): +3 Growth and train 1');
  s = battle(3, 'grass', 'fire');
  place(s, 'player', 0, 'g-sunkern', 1);
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'g-brock'), release: [give(s, 'player', 'g-geodude')], targets: undefined });
  assert.deepEqual([s.players.player.row[0].strength, kwSum(s.players.player.row[0], 'Shell')], [8, 1], 'Brock Favour (Rock): every Location');
  s = passBoth(s);
  assert.deepEqual([s.players.player.row[0].strength, kwSum(s.players.player.row[0], 'Shell')], [6, 0], 'until the next Breakfast');
  // Items: Choice Band (−2 Strength, minimum 1), Quick Claw (Speed), Charcoal (typed), Escape Rope, Exp. Share.
  s = battle(3);
  place(s, 'player', 0, 'f-ponyta', 1);   // 3/2
  s.players.player.bag = [{ ...cardDef('f-choice-band'), uid: 'b1' }];
  s = act(s, { type: 'useItem', who: 'player', uid: 'b1', targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].strength], [6, 1]);
  s = battle(3);
  place(s, 'player', 0, 'f-magby', 1);   // Steady
  s.players.player.bag = [{ ...cardDef('f-quick-claw'), uid: 'q1' }, { ...cardDef('f-charcoal'), uid: 'c1' }];
  s = act(s, { type: 'useItem', who: 'player', uid: 'q1', targets: [mon('player', 0)] });
  assert.equal(s.players.player.row[0].speedUp, 1);
  // Quick Claw on a Swift holder gives Quick Attack instead (Elliott's V6 ruling).
  s.turn = 'player';
  place(s, 'player', 5, 'f-absol', 1);   // Swift
  s.players.player.bag.push({ ...cardDef('p-quick-claw'), uid: 'q2' });
  s = act(s, { type: 'useItem', who: 'player', uid: 'q2', targets: [mon('player', 5)] });
  assert.deepEqual([s.players.player.row[5].speedUp ?? 0, s.players.player.row[5].keywords.includes('Quick Attack')], [0, true]);
  s.turn = 'player';
  place(s, 'player', 1, 'f-mankey', 1);
  s = act(s, { type: 'useItem', who: 'player', uid: 'c1', targets: [mon('player', 1)] });
  assert.equal(kwSum(s.players.player.row[1], 'Scorch'), 0, 'Charcoal: Scorch only on a Fire Pokémon');
  s = battle(3);
  place(s, 'player', 0, 'f-mankey', 1);
  s.players.player.bag = [{ ...cardDef('p-escape-rope'), uid: 'e1' }, { ...cardDef('p-exp-share'), uid: 'x1' }];
  s = act(s, { type: 'useItem', who: 'player', uid: 'e1', targets: [mon('player', 0)], picks: { space: 6 } });
  assert.deepEqual([s.players.player.row[0], s.players.player.row[6]?.name], [null, 'Mankey']);
  s.turn = 'player';
  s = act(s, { type: 'useItem', who: 'player', uid: 'x1' });
  assert.equal(s.players.player.trainerPoints, 1);
  // Partners: printed stats and abilities (Ninetales burns the enemy player on arrival).
  s = battle(3);
  const blaine = trainer(s, 'player', 'f-blaine', 4, 4);
  s.players.player.trainerPoints = 2;
  s = passBoth(s);
  s = act(s, { type: 'assignPoints', who: 'player', points: { [blaine.uid]: 2 } });
  const nine = s.players.player.row[4];
  assert.deepEqual([nine.name, nine.level, nine.attack, nine.strength, nine.speed, s.players.ai.burn > 0], ['Ninetales', 5, 6, 6, 'Swift', true]);
}

// --- Seeded matches: every pairing to the end --------------------------------------------------------------

{
  const pairs = [['fire', 'water'], ['fire', 'grass'], ['water', 'grass'], ['fire', 'fire'], ['water', 'water'], ['grass', 'grass']];
  for (const [a, b] of pairs) {
    for (let seed = 1; seed <= 3; seed++) {
      let s = real(a, b, seed);
      let k = seed;
      const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
      for (let guard = 0; guard < 6000 && s.phase !== 'gameOver'; guard++) {
        const who = actor(s);
        const action = chooseAction(s, who, { rng });
        assert.ok(legalActions(s, who).includes(action.type), `${a}–${b}: ${action.type} legal`);
        s = applyAction(s, action);
      }
      assert.equal(s.phase, 'gameOver', `${a}–${b} seed ${seed} runs to the end`);
    }
  }
}

console.log('All v2 deck tests passed.');
