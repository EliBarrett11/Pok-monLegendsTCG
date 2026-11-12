// v4 C3: the Codex, its glossary and its explanations. Run: node v4/tests/c3.test.js
//   - Coverage: every kind of thing the Codex inspects has an entry, from seeded mid-match states (the
//     Tournament included): cards in the hand, on the board, in the PokéMart, the Bag, the Discard and Released
//     Piles, the React window and the log; Locations, Objective trackers, Recognition rings, the Energy tile,
//     the Weather chip, the PokéMart, the piles, a log line, the Tournament, every glossary term and Rules.
//   - Links: every glossary term and alias links to its own entry; every link in every entry (and in the
//     prompt bar, the log and the cards' wording) goes somewhere; no text says Light, Mid or Heavy.
//   - Numbers: every Pokémon's "where its numbers come from" sums equal the stats it shows, over 200 random
//     mid-match states (Attack, damage with Sun 2, current Strength, cost, Speed).
//   - Forms: the forms row and the "next Round" line are right for every line at every Level and Round.
import assert from 'node:assert/strict';
import { createGame, applyAction, actor, damageOf, effectiveSpeed, pokemonOf } from '../src/engine/game.js';
import { PATHS, pokemonAt, cardAtRound, COMMANDS, SUPPORTERS, ITEMS, TRAINERS, LOCATIONS, cardText, modeText, effectText, MODES } from '../src/engine/cards.js';
import { SERIES_RANGE, levelFor, costFor } from '../src/rules.js';
import { chooseAction } from '../src/ai/ai.js';
import { GLOSSARY, glossaryEntry, termsIn, searchGlossary } from '../src/engine/glossary.js';
import { statSums, statLines, formsRow, nextRound, levelGrowth, recognitionHistory } from '../src/engine/explain.js';
import { codexEntry, entryHTML, fullText, rulesHTML } from '../src/ui/codex.js';
import { promptFor } from '../src/ui/board.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const LMH = /\b(Light|Mid|Heavy)\b/;
const plain = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/\s+/g, ' ');

// A seeded match, played by the AI for both sides for `steps` actions (or to the given Round).
function play(seed, { steps = 9999, round = 99, until = null } = {}) {
  let s = createGame(seed);
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let i = 0; i < steps && s.phase !== 'gameOver'; i++) {
    if ((s.round >= round || until?.(s)) && s.phase === 'battle' && s.turn === 'player' && !s.reactWindow && !s.choice) break;
    const who = actor(s);
    if (!who) break;
    s = applyAction(s, chooseAction(s, who, { rng }));
  }
  return s;
}

// --- Coverage -------------------------------------------------------------------------------------------
const allHTML = [];
const entryOf = (s, ref, why) => {
  const e = codexEntry(s, ref);
  ok(e && e.title && e.sections.length, `${why}: an entry for ${ref}`);
  const html = entryHTML(e);
  ok(!/Nothing to show/.test(html), `${why}: ${ref} renders`);
  allHTML.push({ s, ref, html });
  return e;
};
const kinds = new Set();
const cover = (s, label) => {
  const me = s.players.player;
  for (const c of me.hand) { entryOf(s, `card:${c.uid}`, `${label} hand`); kinds.add('hand'); }
  for (const who of ['player', 'ai']) {
    const p = s.players[who];
    for (const { space } of pokemonOf(s, who)) { entryOf(s, `mon:${who}:${space}`, `${label} board`); entryOf(s, `card:${p.row[space].uid}`, `${label} board card`); kinds.add('board'); }
    for (const c of p.discard) { entryOf(s, `card:${c.uid}`, `${label} discard`); kinds.add('discard'); }
    for (const c of p.released) { entryOf(s, `card:${c.uid}`, `${label} released`); kinds.add('released'); }
    for (const c of p.bag) { entryOf(s, `card:${c.uid}`, `${label} bag`); kinds.add('bag-card'); }
    for (const t of p.trainers) { entryOf(s, `trainer:${who}:${t.uid}`, `${label} tracker`); kinds.add('tracker'); }
    for (const r of ['rec', 'energy', 'bag']) { entryOf(s, `${r}:${who}`, label); kinds.add(r); }
    for (const pile of ['draw', 'discard', 'released']) { entryOf(s, `pile:${who}:${pile}`, label); kinds.add(`pile-${pile}`); }
    // Never the Opponent's hand, nor either Draw Pile's cards.
    for (const c of s.players.ai.hand) ok(!codexEntry(s, `card:${c.uid}`), `${label}: the Opponent's hand stays hidden`);
    for (const c of p.drawPile.slice(0, 3)) ok(!codexEntry(s, `card:${c.uid}`), `${label}: the Draw Pile's cards stay hidden`);
  }
  for (const l of s.locations) { entryOf(s, `loc:${l.uid}`, label); kinds.add('location'); }
  for (const x of s.strats) { entryOf(s, `card:${x.uid}`, `${label} strat`); kinds.add('strat'); }
  if (s.mart.onSale[0]) { entryOf(s, `card:${s.mart.onSale[0].uid}`, `${label} mart card`); kinds.add('mart-card'); }
  entryOf(s, 'mart', label); kinds.add('mart');
  entryOf(s, 'weather', label); kinds.add('weather');
  entryOf(s, 'tournament', label); kinds.add('tournament');
  entryOf(s, `log:${s.log.length - 1}`, label); kinds.add('log');
  if (s.reactWindow?.pending?.card) { entryOf(s, `card:${s.reactWindow.pending.card.uid}`, `${label} react`); kinds.add('react'); }
};
for (const seed of [3, 7, 11, 19, 23]) cover(play(seed, { round: 4 }), `seed ${seed} Round 4`);
// The Tournament: play on until it begins.
{
  let found = null;
  for (let seed = 1; seed < 80 && !found; seed++) { const s = play(seed, { until: (x) => !!x.tournament }); if (s.tournament && s.phase === 'battle') found = s; }
  ok(found, 'a seeded match reaches the Tournament');
  cover(found, 'Tournament');
  const e = codexEntry(found, 'tournament');
  ok(/began at Round/.test(plain(entryHTML(e))), 'the Tournament entry says when it began');
}
// A staged mid-match state with what seeded play may not show at once: a Bag Item, a React window, Weather.
{
  let s = play(9, { round: 3 });
  const p = s.players.player;
  p.bag.push({ ...cardAtRound('potion', 1), uid: 'c3-bag' });
  s.mart.onSale = [s.mart.onSale[0] ?? { ...cardAtRound('charcoal', 1), uid: 'mart-charcoal' }];
  cover(s, 'staged');
  // A React window: an attack by the Opponent, with a Command in your hand to React with.
  s = play(9, { steps: 400 });
  for (let seed = 1; seed < 60 && !kinds.has('react'); seed++) {
    let x = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let i = 0; i < 600 && x.phase !== 'gameOver'; i++) {
      if (x.reactWindow?.reactor === 'player' && x.reactWindow.pending.card) { cover(x, `react seed ${seed}`); break; }
      x = applyAction(x, chooseAction(x, actor(x), { rng }));
    }
  }
}
for (const g of GLOSSARY) entryOf(null, `term:${g.id}`, 'glossary');
entryOf(null, 'rules', 'rules');
entryOf(null, 'rules:react', 'rules search');
for (const c of [...COMMANDS, ...SUPPORTERS, ...ITEMS, ...TRAINERS, ...LOCATIONS]) entryOf(null, `def:${c.id}`, 'every card');
for (const t of TRAINERS) entryOf(null, `def:${t.partner.id}`, 'Partners');
for (const p of PATHS) for (let lv = SERIES_RANGE[p.series][0]; lv <= SERIES_RANGE[p.series][1]; lv++) entryOf(null, `def:${p.id}:${lv}`, 'every form');
for (const k of ['hand', 'board', 'discard', 'released', 'bag-card', 'tracker', 'rec', 'energy', 'bag', 'pile-draw', 'pile-discard', 'pile-released', 'location', 'mart', 'mart-card', 'weather', 'tournament', 'log', 'react']) ok(kinds.has(k), `coverage: ${k}`);
// Card first: a Pokémon's sections in the required order; a card entry shows the Full card.
{
  const s = play(7, { round: 4 });
  const { space } = pokemonOf(s, 'player')[0] ?? pokemonOf(s, 'ai')[0];
  const who = pokemonOf(s, 'player').length ? 'player' : 'ai';
  const e = codexEntry(s, `mon:${who}:${space}`);
  const titles = e.sections.map(([t]) => t);
  ok(JSON.stringify(titles.slice(0, 4)) === JSON.stringify(['What it does now', 'Where its numbers come from', 'Keywords and triggers', 'Forms by Level']), `Pokémon sections in order: ${titles}`);
  ok(entryHTML(e).includes('cd-full'), 'the Full card on the left');
  const hand = s.players.player.hand.find((c) => c.cardType === 'Pokémon');
  if (hand) ok(/next Round|Stays Level/.test(plain(entryHTML(codexEntry(s, `card:${hand.uid}`)))), 'a Pokémon in hand: what it becomes next Round');
}
// The Recognition history adds up to the ring, by source, with the Round of each.
for (const seed of [2, 4, 6, 8]) {
  const s = play(seed, { steps: 900 });
  for (const who of ['player', 'ai']) {
    const total = recognitionHistory(s, who).reduce((n, g) => n + g.total, 0);
    ok(total === s.players[who].recognition, `seed ${seed} ${who}: the history adds up (${total} = ${s.players[who].recognition})`);
  }
}

// --- Links -----------------------------------------------------------------------------------------------
// Every term and alias links to its own entry (or to a longer term it is part of, e.g. "On Summon").
for (const g of GLOSSARY) {
  for (const t of [g.term, ...(g.aliases ?? [])]) {
    const parts = termsIn(t);
    const own = glossaryEntry(t);
    ok(parts.length === 1 && parts[0].id === own.id, `the term "${t}" links to ${own?.id} (got ${JSON.stringify(parts)})`);
  }
  ok(!LMH.test(g.text) && !LMH.test(g.term), `glossary ${g.id}: no Light, Mid or Heavy`);
}
// Card names are never split into terms (Lake of Rage isn't Rage; Pokémon Breeder isn't Pokémon).
for (const name of ['Lake of Rage', 'Pokémon Breeder', 'Rocky Helmet', 'Mt. Ember', 'Choice Band', 'Quick Claw']) ok(termsIn(name).every((p) => !p.id), `"${name}" stays a name`);
ok(termsIn('Dive').some((p) => p.id === 'dive') && termsIn('the Pokémon League Tournament')[1]?.id === 'tournament', 'a name that is a term still links');
// No dead links: every term link and every Codex ref in every entry goes somewhere.
let links = 0;
for (const { s, ref, html } of allHTML) {
  for (const m of html.matchAll(/data-term="([^"]+)"/g)) { ok(!!glossaryEntry(m[1]) && GLOSSARY.some((g) => g.id === m[1]), `${ref}: the term link ${m[1]}`); links++; }
  for (const m of html.matchAll(/data-codex-ref="([^"]+)"/g)) { ok(!!codexEntry(s, m[1]), `${ref}: the Codex link ${m[1]}`); links++; }
  ok(!LMH.test(plain(html)), `${ref}: no Light, Mid or Heavy`);
}
ok(links > 1000, `links checked: ${links}`);
// The texts terms appear in: card wording, the prompt bar and the log. Every term found links to an entry.
const texts = [];
for (const p of PATHS) for (let lv = SERIES_RANGE[p.series][0]; lv <= SERIES_RANGE[p.series][1]; lv++) { const c = pokemonAt(p.id, lv); texts.push(cardText(c), ...fullText(c)); }
for (const c of COMMANDS) texts.push(...MODES.map((m) => modeText(c, m)), ...fullText(c));
for (const c of SUPPORTERS) texts.push(effectText(c.effect), effectText(c.favour), ...fullText(c));
for (const c of [...ITEMS, ...TRAINERS, ...LOCATIONS]) texts.push(...fullText(c));
for (const seed of [1, 2, 3]) {
  const s = play(seed, { steps: 500 });
  texts.push(...s.log);
  texts.push(promptFor(s, { select: null }).text);
}
for (const t of texts.filter(Boolean)) {
  for (const part of termsIn(t)) if (part.id) ok(GLOSSARY.some((g) => g.id === part.id), `"${t}": ${part.id}`);
  ok(!LMH.test(t), `no Light, Mid or Heavy: "${t}"`);
}
ok(texts.reduce((n, t) => n + termsIn(t).filter((p) => p.id).length, 0) > 500, 'terms are linked in the texts');
// The Rules page: every entry once; search narrows it.
ok(GLOSSARY.every((g) => rulesHTML('').includes(`data-term="${g.id}"`)), 'the Rules page lists every term');
ok(searchGlossary('react')[0].id === 'react' && rulesHTML('stock').includes('data-term="stock"') && !rulesHTML('stock').includes('data-term="rage"'), 'Rules search');

// --- Numbers: 200 random mid-match states ------------------------------------------------------------------
const sum = (parts) => parts.reduce((n, p) => n + p.n, 0);
let states = 0;
let mons = 0;
for (let seed = 100; states < 200; seed++) {
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  let s = createGame(seed);
  const stops = new Set([20 + (seed % 37), 80 + (seed % 53), 160 + (seed % 71), 260 + (seed % 89)]);
  for (let i = 0; i < 400 && s.phase !== 'gameOver' && states < 200; i++) {
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    if (!stops.has(i)) continue;
    states++;
    for (const who of ['player', 'ai']) {
      for (const { card, space } of pokemonOf(s, who)) {
        const sums = statSums(s, card, { who, space });
        // C4: the Attack shown is the damage its attack deals now (damageOf: Sun 2 included for Physical).
        ok(sum(sums.attack.parts) === damageOf(s, card) && sums.attack.total === damageOf(s, card), `Attack sums: ${card.name} ${JSON.stringify(sums.attack)} vs ${damageOf(s, card)}`);
        ok(sum(sums.strength.parts) === card.currentStrength && sums.strength.total === card.currentStrength, `Strength sums: ${card.name} ${JSON.stringify(sums.strength)} vs ${card.currentStrength}`);
        ok(sums.cost.total === (card.partner ? 0 : costFor(card.level)), `cost: ${card.name}`);
        ok(sums.speed.total === effectiveSpeed(card), `Speed: ${card.name}`);
        ok(statLines(sums).every((l) => !LMH.test(l)), 'the lines never say Light, Mid or Heavy');
        mons++;
      }
    }
    for (const card of s.players.player.hand.filter((c) => c.cardType === 'Pokémon')) {
      const sums = statSums(s, card, null);
      ok(sum(sums.attack.parts) === card.attack && sum(sums.strength.parts) === card.strength && sums.cost.total === card.cost, `a hand card's numbers: ${card.name}`);
    }
  }
}
ok(states === 200 && mons > 400, `numbers over ${states} states, ${mons} Pokémon`);

// --- Forms ---------------------------------------------------------------------------------------------------
for (const p of PATHS) {
  const [lo, hi] = SERIES_RANGE[p.series];
  for (let lv = lo; lv <= hi; lv++) {
    const row = formsRow(p.id, lv);
    ok(row.length === p.forms.length, `${p.id}: one Mini per form`);
    ok(row[0].from === lo && row.at(-1).to === hi && row.every((f, i) => i === 0 || f.from === row[i - 1].to + 1), `${p.id}: the forms cover Levels ${lo}–${hi}`);
    const cur = row.filter((f) => f.current);
    ok(cur.length === 1 && cur[0].name === pokemonAt(p.id, lv).name, `${p.id} Level ${lv}: the current form is ${pokemonAt(p.id, lv).name}`);
  }
  for (let round = 1; round <= 12; round++) {
    const now = levelFor(p.series, round);
    const card = pokemonAt(p.id, now);
    const nx = nextRound(card, round);
    const lv = levelFor(p.series, round + 1);
    if (lv === now) ok(nx.same && nx.text === `Stays Level ${now} next Round (its maximum).`, `${p.id} Round ${round}: at its maximum`);
    else {
      const next = pokemonAt(p.id, lv);
      const arrow = (a, b) => (b > a ? '▲' : b < a ? '▼' : '');
      ok(nx.level === lv && nx.attack === next.attack && nx.strength === next.strength && nx.cost === next.cost, `${p.id} Round ${round}: next Round's numbers`);
      ok(nx.text.startsWith(`Lv ${lv} next Round`) && nx.text.includes(`Attack ${next.attack}${arrow(card.attack, next.attack)}`) && nx.text.includes(`Strength ${next.strength}${arrow(card.strength, next.strength)}`), `${p.id} Round ${round}: "${nx.text}"`);
      ok(nx.evolves === (next.name !== card.name) && (!nx.evolves || nx.text.includes(`(${next.name})`)), `${p.id} Round ${round}: the form it becomes`);
    }
    ok(!LMH.test(levelGrowth(card, round)) && levelGrowth(card, round).includes(`Level ${now} now`), `${p.id} Round ${round}: its Level growth in words`);
  }
}
// Partners have no forms row.
for (const t of TRAINERS) ok(formsRow(t.partner.id, 8).length === 0, `${t.partner.name}: no forms row`);

console.log(`v4 C3: the Codex (every kind of thing, the Tournament included), ${GLOSSARY.length} glossary terms with no dead links, number sums over 200 states, forms and next Round for every line — ${checks} checks passed`);
