// V7 — the balance Elliott chose after the V7a–V7f experiments, as the game's own rules and
// cards: target 90, the Championship in Round 9, lane guards, Grass-deck Pokémon −1 Strength,
// Fire-Type Pokémon +1 Strength and Water-Type Pokémon +1 Attack (V7.1: by Type, Partners
// and Legendaries included), and Water's Surf ×2 (no Dive) with its first breakpoint at 2.
// The deck docs match the cards.
// Run with: node v2/tests/balance.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, applyAction, legalTargets, targetOf, champRoundOf, PLAYERS } from '../src/engine/game.js';
import { RECOGNITION_TARGET, CHAMPIONSHIP_ROUND, ROUND_LIMIT } from '../src/engine/rules.js';
import { DECKS, POOL_ITEMS, copiesOf, deckProblems, cardDef } from '../src/engine/cards.js';
import { DECK_SERIES, DECK_TRAINERS } from '../src/engine/decks.js';
import { pokemonAt, seriesDef } from '../src/engine/series.js';

const ROOT = new URL('../../', import.meta.url);

// The end of the match.
assert.deepEqual([RECOGNITION_TARGET, CHAMPIONSHIP_ROUND, ROUND_LIMIT], [90, 9, 12]);
const fresh = createGame(1, { decks: { player: DECKS.fire.list, ai: DECKS.water.list } });
assert.deepEqual([targetOf(fresh), champRoundOf(fresh)], [90, 9]);

// Lane guards: only the guard across stops an attack on the player; Pokémon are always targets.
{
  let s = applyAction(createGame(5, { decks: { player: DECKS.fire.list, ai: DECKS.grass.list }, itemPool: POOL_ITEMS }), { type: 'flipCoin' });
  s.round = 3;
  for (const who of PLAYERS) Object.assign(s.players[who], { hand: [] });
  let n = 0;
  const place = (who, space, series, level = 1) => {
    const c = { ...pokemonAt(series, level), cap: seriesDef(series).maxLevel, uid: `${who}-b${n++}` };
    s.players[who].row[space] = { ...c, currentStrength: c.strength, spent: false, buffs: [] };
  };
  place('ai', 2, 'g-geodude');       // Defence
  place('ai', 5, 'g-bulbasaur');     // Special Defence
  place('player', 2, 'f-growlithe'); // Physical, across from Geodude
  place('player', 5, 'f-ponyta');    // Physical, across from Bulbasaur (a Special guard: no effect)
  place('player', 7, 'f-sneasel');   // Infiltrator
  const key = (from) => legalTargets(s, 'player', from).map((t) => (t.kind === 'player' ? 'P' : t.space)).join();
  assert.equal(key(2), '2,5', 'a matching guard across: Pokémon only');
  assert.equal(key(5), '2,5,P', 'a guard of the other kind across: the player too');
  place('ai', 7, 'g-geodude');
  assert.equal(key(7), '2,5,7,P', 'Infiltrator ignores guards');
}

// The Fire and Water changes go by Type (V7.1, Elliott's correction): the Fire deck's
// Mankey (Fighting), Sneasel and Absol (Dark) and Duskull (Ghost), and the Water deck's
// Chinchou (Electric), Happiny (Normal), Dratini (Dragon) and Eevee (Normal until it is
// Vaporeon at Level 4) keep their original numbers. Grass goes by deck: Sewaddle (Bug) too.
const at = (id, l = 1) => [pokemonAt(id, l).attack, pokemonAt(id, l).strength];
assert.deepEqual([at('f-growlithe'), at('f-entei')], [[3, 4], [9, 10]], 'Fire-Type +1 Strength');
assert.deepEqual([at('f-mankey'), at('f-sneasel'), at('f-duskull'), at('f-absol')], [[3, 2], [3, 2], [1, 5], [3, 3]], 'non-Fire: unchanged');
assert.deepEqual([at('w-squirtle'), at('w-kyogre'), at('w-eevee', 4)], [[3, 4], [11, 12], [6, 7]], 'Water-Type +1 Attack (Vaporeon too)');
assert.deepEqual([at('w-chinchou'), at('w-happiny'), at('w-dratini'), at('w-eevee', 3)], [[2, 4], [0, 5], [2, 4], [3, 5]], 'non-Water: unchanged');
// The rule itself, for every deck Pokémon at every Level: against the V6 numbers.
const V6 = {
  'f-mankey': [[3, 2], [4, 2], [4, 3], [5, 4], [6, 4], [7, 5]], 'f-growlithe': [[3, 3], [3, 4], [4, 4], [5, 6], [6, 6], [7, 7]],
  'w-eevee': [[2, 4], [3, 4], [3, 5], [5, 7], [5, 8], [6, 9]], 'w-squirtle': [[2, 4], [2, 5], [3, 6], [4, 7], [5, 9], [6, 10]],
  'g-bulbasaur': [[2, 5], [2, 6], [3, 7], [4, 7], [5, 10], [6, 12]], 'g-eevee': [[2, 4], [3, 4], [3, 5], [5, 6], [6, 6], [7, 7]],
};
for (const [id, rows] of Object.entries(V6)) {
  const line = DECK_SERIES.find((l) => l.id === id);
  rows.forEach(([a, st], i) => {
    const c = pokemonAt(id, i + 1);
    const want = [a + (c.type === 'Water' ? 1 : 0), st + (c.type === 'Fire' ? 1 : 0) - (line.deck === 'grass' ? 1 : 0)];
    assert.deepEqual([c.attack, c.strength], want, `${id} L${i + 1} (${c.type})`);
  });
}
assert.deepEqual([at('g-bulbasaur'), at('g-sewaddle'), at('g-celebi')], [[2, 4], [3, 3], [4, 5]], 'Grass deck −1 Strength');
for (const line of DECK_SERIES.filter((l) => l.deck === 'grass')) {
  for (let l = 1; l <= line.maxLevel; l++) assert.ok(pokemonAt(line.id, l).strength >= 1, `${line.id} L${l}: at least 1 Strength`);
}
// Partners too (all of their deck's Type).
const partnerOf = (id) => cardDef(id).tiers[2].partner;
assert.deepEqual(['f-blaine', 'w-misty', 'g-ramos'].map((id) => [partnerOf(id).name, partnerOf(id).attack, partnerOf(id).strength]),
  [['Ninetales', 6, 7], ['Starmie', 7, 7], ['Gogoat', 6, 7]]);

// Water: Surf ×2, no Dive; Surf's breakpoints 2 and 5.
assert.deepEqual(deckProblems(DECKS.water.list), []);
assert.deepEqual([copiesOf(DECKS.water.list)['w-surf'], copiesOf(DECKS.water.list)['w-dive'] ?? 0], [2, 0]);
assert.deepEqual(cardDef('w-surf').breakpoints.map((b) => [b.cost, b.text]), [
  [2, '2 damage to each enemy Pokémon'],
  [5, '3 damage to each enemy Pokémon, and heal each friendly Pokémon 2'],
]);

// The deck docs match the cards: every Pokémon's stats L1 → L6, each Legendary, each Partner.
for (const deck of ['fire', 'water', 'grass']) {
  const doc = readFileSync(new URL(`docs/v2-${deck}.md`, ROOT), 'utf8');
  const lines = DECK_SERIES.filter((l) => l.deck === deck);
  for (const line of lines) {
    const first = line.stages[0].name;
    const row = doc.split('\n').find((r) => r.startsWith(`| **${first}**`));
    assert.ok(row, `${deck}: a doc row for ${first}`);
    if (line.legendary) {
      const c = pokemonAt(line.id, 1);
      assert.ok(row.includes(`Cost ${line.cost} · ${c.attack}/${c.strength}`), `${first}: Cost ${line.cost} · ${c.attack}/${c.strength} in the doc`);
      continue;
    }
    const want = Array.from({ length: 6 }, (_, i) => { const c = pokemonAt(line.id, i + 1); return `${c.attack}/${c.strength}`; }).join(' · ');
    assert.ok(row.includes(want), `${first}: ${want} in the doc`);
  }
  for (const t of DECK_TRAINERS.filter((x) => x.deck === deck)) {
    const p = t.tiers[2].partner;
    assert.ok(new RegExp(`\\*\\*${p.name}\\*\\* L5: [^|]*· ${p.attack}/${p.strength}`).test(doc), `${p.name} ${p.attack}/${p.strength} in the doc`);
  }
}

console.log('balance.test: ok');
