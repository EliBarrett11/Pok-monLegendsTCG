// v2 Feedback B — information. Run with: node v2/tests/info.test.js
//   - the Codex has an entry for every card, keyword, trigger and status (and every glossary link
//     goes somewhere);
//   - "where its numbers come from" always sums to the Attack and Strength shown, over whole matches;
//   - a Strategy Card shows its highest affordable version and steps down when Energy drops;
//   - the prompt bar describes each kind of step;
//   - Tracey's revealed cards are seen only by their player, who chooses; the AI chooses for itself.
import assert from 'node:assert/strict';
import { createGame, applyAction, actor, statParts, legalActions, choiceCards } from '../src/engine/game.js';
import { viewFor, redactEvents } from '../src/engine/view.js';
import { DECKS, POOL_ITEMS, cardAt, cardDef, SERIES } from '../src/engine/cards.js';
import { pokemonAt } from '../src/engine/series.js';
import { chooseAction } from '../src/ai/opponent.js';
import { GLOSSARY, glossaryEntry, termsIn, searchGlossary } from '../src/engine/glossary.js';
import { strategyVersions, whyNot, attackNote, targetNote } from '../src/engine/explain.js';
import { codexEntry, keywordList } from '../src/ui/codex.js';
import { promptFor } from '../src/ui/prompt.js';
import { orient } from '../src/ui/seat.js';

const plainText = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const play = (s, steps) => { let x = s; for (let i = 0; i < steps && x.phase !== 'gameOver'; i++) x = applyAction(x, chooseAction(x, actor(x), { rng: () => 0.5 })); return x; };
const newGame = (seed, a = 'water', b = 'fire') => createGame(seed, { decks: { player: DECKS[a].list, ai: DECKS[b].list }, itemPool: POOL_ITEMS, plans: { player: a, ai: b } });

// --- The Codex: every card, keyword, trigger and status ----------------------------------------------
{
  const ids = new Set();
  for (const deck of Object.values(DECKS)) for (const e of deck.list) ids.add(e.series ?? e.location ?? e.card);
  for (const item of POOL_ITEMS) ids.add(item.id);
  const keywords = new Set();
  const triggers = new Set();
  for (const id of ids) {
    const e = codexEntry(null, `def:${id}`);
    assert.ok(e && e.title && e.html.length > 40, `a Codex entry for ${id}`);
    assert.ok(!e.html.includes('Nothing to show'), `${id}: its entry renders`);
    // Every Level of a series: its keywords and triggers.
    const line = SERIES.find((l) => l.id === id);
    if (line) {
      for (let lv = 1; lv <= line.maxLevel; lv++) {
        const c = pokemonAt(line, lv);
        for (const k of keywordList(c)) keywords.add(k.name);
        for (const key of Object.keys(c.ability ?? {})) if (/^on[A-Z]|^rally$/.test(key)) triggers.add(key);
      }
      // A card in hand, at a Level: its entry has the series ladder.
      const card = cardAt({ series: id, cap: line.maxLevel }, 3);
      if (!line.legendary) assert.ok(codexEntry(null, `def:${id}:${line.maxLevel}`).html.includes('v2-cladder'), `${id}: the series ladder`);
      assert.ok(card.name);
    }
    const def = cardDef(id);
    for (const k of [...(def.held?.keywords ?? []), ...(def.keywords ?? [])]) keywords.add(k.replace(/ \d+$/, ''));
  }
  // Keywords granted by cards (Chili's Overrun, items' Regenerate…).
  const walk = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n.keywords)) for (const k of n.keywords) keywords.add(k.replace(/ \d+$/, '')); if (n.keyword) keywords.add(n.keyword.replace(/ \d+$/, '')); for (const v of Object.values(n)) walk(v); };
  for (const id of ids) walk(cardDef(id));
  for (const k of keywords) {
    const g = glossaryEntry(k);
    assert.ok(g, `the keyword ${k} has a glossary entry`);
    assert.ok(codexEntry(null, `term:${g.id}`).html.includes(g.term), `the keyword ${k} has a Codex entry`);
  }
  const TRIGGER_NAMES = { onSummon: 'On Summon', onAttack: 'On Attack', onDefend: 'On Defend', onDefeated: 'On Defeated', onKnockout: 'On Knockout', onBreakfast: 'On Breakfast', onEvolve: 'On Evolve', onHeal: 'On Heal', rally: 'Rally' };
  for (const t of triggers) assert.ok(glossaryEntry(TRIGGER_NAMES[t] ?? t), `the trigger ${t} has a glossary entry`);
  for (const status of ['Burn', 'Sleep', 'Leech Seed', 'Asleep', 'Douse']) assert.ok(glossaryEntry(status), `the status ${status} has a glossary entry`);
  // Every explicit [[link]] in the glossary resolves; every entry is reachable from the rules index.
  for (const e of GLOSSARY) {
    for (const m of e.text.matchAll(/\[\[([^\]|]+)/g)) assert.ok(glossaryEntry(m[1]), `${e.id}: [[${m[1]}]] links to an entry`);
    assert.ok(codexEntry(null, 'rules').html.includes(`data-term="${e.id}"`), `${e.id} is in the rules index`);
  }
  assert.ok(new Set(GLOSSARY.map((e) => e.id)).size === GLOSSARY.length, 'glossary ids are unique');
  // Game terms in any text are linked; search finds rules by plain words.
  assert.deepEqual(termsIn('Overrun. Burn 2 the enemy player').filter((p) => p.id).map((p) => p.id), ['overrun', 'burn', 'player-character']);
  assert.equal(searchGlossary('guard')[0].id, 'lane-guard');
  assert.ok(searchGlossary('damage left over').some((e) => e.id === 'overrun'));
}

// --- Where its numbers come from: always sums to the shown stats ------------------------------------
{
  let checked = 0;
  for (const [seed, a, b] of [[3, 'water', 'fire'], [8, 'grass', 'water'], [21, 'fire', 'grass'], [34, 'water', 'water']]) {
    let s = newGame(seed, a, b);
    for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
      s = applyAction(s, chooseAction(s, actor(s), { rng: () => 0.5 }));
      for (const who of ['player', 'ai']) {
        s.players[who].row.forEach((card, space) => {
          if (!card) return;
          const parts = statParts(s, who, space);
          const sum = (stat) => parts.parts[stat].reduce((n, x) => n + x.amount, 0);
          assert.equal(sum('attack'), card.attack, `${card.name}: the Attack parts sum to ${card.attack}`);
          assert.equal(sum('strength'), card.strength, `${card.name}: the Strength parts sum to ${card.strength}`);
          // Every part has a named source (nothing left over as "other effects" for a series card).
          if (card.series) assert.ok(!parts.parts.attack.concat(parts.parts.strength).some((x) => x.label === 'other effects'), `${card.name}: every part named (${JSON.stringify(parts.parts)})`);
          // The Codex shows it from the viewer's side.
          if (checked % 50 === 0) {
            const e = codexEntry(viewFor(s, 'player'), `mon:${who}:${space}`);
            assert.ok(plainText(e.html).includes('Where its numbers come from'));
          }
          checked += 1;
        });
      }
    }
  }
  assert.ok(checked > 500, `checked ${checked} Pokémon in play`);
}

// --- Strategy Cards: the highest affordable version, stepping down as Energy drops -------------------
{
  let s = play(newGame(5, 'fire', 'water'), 1);
  while (!(s.phase === 'battle' && s.turn === 'player')) s = applyAction(s, chooseAction(s, actor(s), { rng: () => 0.5 }));
  const ember = { ...cardDef('f-ember'), uid: 'test-ember' };
  s.players.player.hand.push(ember);
  const shown = (energy, selected) => { s.players.player.energy = energy; const sv = strategyVersions(s, 'player', ember, selected); return { cost: sv.versions[sv.shown].cost, can: sv.can, versions: sv.versions }; };
  assert.deepEqual(ember.breakpoints.map((b) => b.cost), [2, 4, 6]);
  assert.equal(shown(6).cost, 6, '6 Energy: the 6 version');
  assert.equal(shown(5).cost, 4, '5 Energy: steps down to 4');
  assert.equal(shown(3).cost, 2, '3 Energy: steps down to 2');
  assert.equal(shown(6, 2).cost, 2, 'a lower affordable version can be selected');
  assert.equal(shown(1, 2).can, false, '1 Energy: none affordable (dimmed)');
  assert.equal(shown(1).versions[0].why, 'Needs 2');
  assert.equal(shown(4).versions[2].why, 'Needs 6', 'a higher version says what it needs');
  s.players.player.energy = 1;
  assert.equal(whyNot(s, 'player', ember), 'Needs 2 Energy · you have 1');
  // Unplayable reasons for the other kinds.
  s.players.player.energy = 0;
  const kyogre = { ...cardAt({ series: 'w-kyogre' }, 6), uid: 'test-kyogre' };
  assert.match(whyNot(s, 'player', kyogre), /^Needs 7 Energy · you have 0$/);
  const full = structuredClone(s);
  full.players.player.row = full.players.player.row.map(() => ({ ...cardAt({ series: 'w-horsea', cap: 6 }, 1), currentStrength: 4, spent: true }));
  full.players.player.energy = 9;
  assert.equal(whyNot(full, 'player', kyogre), 'No empty space');
}

// --- Hover notes: what clicking will do, or why not ------------------------------------------------
{
  const g = newGame(13, 'fire', 'water');
  g.phase = 'battle';
  g.turn = 'player';
  const attacker = { ...cardAt({ series: 'f-growlithe', cap: 6 }, 2), spent: false };
  attacker.currentStrength = attacker.strength;
  const guard = { ...cardAt({ series: 'w-squirtle', cap: 6 }, 2), spent: true };
  guard.currentStrength = guard.strength;
  assert.equal(attacker.attackType, 'Physical');
  assert.equal(guard.strengthType, 'Defence');
  g.players.player.row[2] = attacker;
  g.players.ai.row[2] = guard;
  assert.equal(attackNote(g, 'player', 2, { kind: 'player' }), `The Opponent · Guarded by ${guard.name}, across from this Pokémon`);
  assert.match(attackNote(g, 'player', 2, { kind: 'pokemon', space: 2 }), new RegExp(`^${guard.name} · click to attack: \\d+ damage`));
  g.players.ai.row[2] = null;
  assert.match(attackNote(g, 'player', 2, { kind: 'player' }), /^The Opponent · click to attack: \+\d+ Recognition$/);
  const t = { side: 'enemy', kinds: ['pokemon', 'player'], count: 1 };
  const v = newGame(2);
  v.players.ai.row[3] = { ...cardAt({ series: 'f-magby', cap: 6 }, 3), currentStrength: 6, keywords: ['Scorch 1'] };
  assert.equal(targetNote(v, 'player', t, { who: 'ai', kind: 'pokemon', space: 3 }, [{ op: 'burn', amount: 2 }]), `${v.players.ai.row[3].name} · click to Burn 2 · it has Scorch 1`);
  assert.equal(targetNote(v, 'player', { ...t, side: 'friendly' }, { who: 'ai', kind: 'pokemon', space: 3 }, []), `${v.players.ai.row[3].name} · Choose one of yours`);
}

// --- The prompt bar: each kind of step ----------------------------------------------------------------
{
  const P = (s, ui = {}, ctx = {}) => { const p = promptFor(orient(viewFor(s, 'player')), { attacker: null, ...ui }, ctx); return { ...p, plain: plainText(p.text) }; };
  let s = newGame(17, 'fire', 'water');
  assert.match(P(s).plain, /Flip the coin/);
  assert.equal(P(s).buttons[0].action, 'flip');
  s = applyAction(s, { type: 'flipCoin' });
  while (!(s.phase === 'battle' && s.turn === 'player')) s = applyAction(s, chooseAction(s, actor(s), { rng: () => 0.5 }));
  let p = P(s);
  assert.equal(p.tag, 'Your turn');
  assert.match(p.plain, /Pass for \+1 Energy/);
  assert.ok(!p.gold);
  // Only Pass: says so, and why.
  const empty = structuredClone(s);
  empty.players.player.hand = [];
  empty.players.player.bag = [];
  empty.players.player.row = empty.players.player.row.map(() => null);
  empty.players.player.trainers = [];
  empty.players.player.growth = 0;
  p = P(empty);
  assert.match(p.plain, /^Only Pass for \+1 Energy: your hand is empty, and you have no Pokémon in play\.$/);
  // Selecting, choosing: gold, with Cancel.
  const hand = s.players.player.hand;
  const pokemon = hand.find((c) => c.cardType === 'Pokémon');
  if (pokemon) { p = P(s, { summon: pokemon.uid }); assert.ok(p.gold); assert.match(p.plain, /Choose an empty space/); assert.ok(p.buttons.some((b) => b.action === 'cancel')); }
  const ember = { ...cardDef('f-ember'), uid: 'p-ember' };
  const s2 = structuredClone(s);
  s2.players.player.hand.push(ember);
  s2.players.player.energy = 4;
  p = P(s2, { strategy: 'p-ember', version: {} });
  assert.equal(p.tag, 'Ember · 4 Energy');
  assert.ok(p.buttons.some((b) => b.action === 'play-strategy'));
  const bp = ember.breakpoints[1];
  p = P(s2, { pending: { action: { type: 'playStrategy', who: 'player', uid: 'p-ember', pay: 4 }, spec: bp.target, label: `Ember (4): ${bp.text}`, chosen: [{ who: 'ai', kind: 'player' }], ops: bp.ops, tag: 'Ember · 4 Energy' } });
  assert.equal(p.tag, 'Ember · 4 Energy');
  assert.match(p.plain, /^Choose target 2 of 2 ?: Burn 2 to two targets/);
  assert.deepEqual(p.buttons.map((b) => b.action), ['targets-done', 'cancel']);
  p = P(s2, { ask: { kind: 'release', uid: 'p-ember' } });
  assert.ok(p.gold);
  p = P(s2, { ask: { kind: 'item', uid: 'p-ember' } });
  assert.match(p.plain, /Bag/);
  // The opponent's turn; the assign step; the end.
  const theirs = structuredClone(s);
  theirs.turn = 'ai';
  assert.match(P(theirs).plain, /The Opponent is choosing/);
  const assign = structuredClone(s);
  assign.phase = 'assign';
  assign.turn = null;
  assign.assign = { player: null, ai: null };
  assign.players.player.trainerPoints = 2;
  assign.players.player.trainers = [{ ...cardDef('f-blaine'), uid: 't1', space: 0, points: 0, abilityRound: 0 }];
  assert.match(P(assign).plain, /Assign your 2 Trainer Points/);
  const over = structuredClone(s);
  over.phase = 'gameOver';
  over.winner = 'player';
  assert.equal(P(over, {}, { resultLine: 'You won.' }).tag, 'Victory');
}

// --- Tracey: shown only to its player, who chooses; the AI chooses for itself -----------------------
{
  let s = newGame(29, 'water', 'water');
  s = applyAction(s, { type: 'flipCoin' });
  while (!(s.phase === 'battle' && s.turn === 'player')) s = applyAction(s, chooseAction(s, actor(s), { rng: () => 0.5 }));
  const tracey = { ...cardDef('w-tracey'), uid: 'player-tracey' };
  s.players.player.hand = [tracey, ...s.players.player.hand.filter((c) => c.cardType !== 'Pokémon')];
  const pay = s.players.player.hand.find((c) => c !== tracey);
  const top = s.players.player.drawPile.slice(0, 4);
  s = applyAction(s, { type: 'playSupporter', who: 'player', uid: tracey.uid, release: [pay.uid] });
  assert.equal(s.choices[0]?.kind, 'pick', 'Tracey waits for its player to choose');
  assert.deepEqual(legalActions(s, 'player'), ['choosePick']);
  assert.deepEqual(legalActions(s, 'ai'), [], 'the opponent waits');
  const mine = viewFor(s, 'player');
  const theirs = viewFor(s, 'ai');
  assert.deepEqual(mine.choices[0].cards.map((c) => c.name), top.map((c) => c.name), 'its player sees the 4 cards');
  assert.ok(!('cards' in theirs.choices[0]), 'the opponent sees no cards');
  for (const c of top) assert.ok(!JSON.stringify(theirs).includes(`"name":"${c.name}","cardType"`) || [...theirs.players.ai.hand, ...theirs.players.ai.discard, ...theirs.players.player.discard, ...theirs.players.player.released, ...theirs.players.ai.row, ...theirs.players.player.row].some((x) => x?.name === c.name), `${c.name} isn't shown to the opponent`);
  assert.throws(() => applyAction(s, { type: 'choosePick', who: 'player', picks: [top[0].uid] }), /Choose 2/);
  const before = s.players.player.hand.length;
  const after = applyAction(s, { type: 'choosePick', who: 'player', picks: [top[1].uid, top[3].uid] });
  assert.equal(after.players.player.hand.length, before + 2);
  assert.deepEqual(after.players.player.hand.slice(-2).map((c) => c.uid), [top[1].uid, top[3].uid]);
  assert.deepEqual(after.players.player.drawPile.slice(-2).map((c) => c.uid), [top[0].uid, top[2].uid], 'the rest go to the bottom');
  assert.ok(!redactEvents(after.events, 'ai').some((e) => e.type === 'picked' && 'cards' in e), 'the opponent never learns which');
  assert.ok(redactEvents(after.events, 'player').some((e) => e.type === 'picked' && e.cards.length === 2));
  // The AI, holding Tracey, chooses for itself (the best two), through the same action.
  const ai = structuredClone(s);
  ai.choices[0].who = 'ai';
  ai.choices[0].uids = ai.players.ai.drawPile.slice(0, 4).map((c) => c.uid);
  const move = chooseAction(ai, 'ai', { rng: () => 0.5 });
  assert.equal(move.type, 'choosePick');
  assert.equal(move.picks.length, 2);
  assert.equal(choiceCards(ai, ai.choices[0]).length, 4);
}

console.log('info: the Codex, numbers, Strategy versions, the prompt bar and Tracey — ok');
