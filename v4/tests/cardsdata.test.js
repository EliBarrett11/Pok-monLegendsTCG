// B3-1: the cards come from data. Run: node v4/tests/cardsdata.test.js
//   - Every Batch 1 entry of docs/base-game/cards.json (the source of truth) is in the game, with its numbers.
//   - The wording round-trip: every text the game shows is generated from the structured ops (src/engine/wording.js)
//     and equals cards.json word for word: Pokémon trigger text, Move text and cardText, Supporter text and Favour
//     text, Item text, Location passives, Trainer Commands, Objectives and Partners.
//   - The generator is stable: tools/buildcards.mjs --check finds src/data/cards.js up to date (a re-run gives an
//     identical file).
//   - The cost rules: a Pokémon costs ceil(Level / 2); a Legendary costs 5 and is Level 8 from the start (it doesn't grow).
//   - validateDeck on the four decks (legal) and on broken ones (41 cards, 3 copies, 2 of a Legendary, 4 Trainers).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PATHS, COMMANDS, SUPPORTERS, ITEMS, LOCATIONS, TRAINERS, pathDef, pokemonAt, cardAtRound, keywordList, TRIGGER_NAMES, MODE_NAMES,
  FAVOURS, effectText, effectOps,
} from '../src/engine/cards.js';
import { shortModeText, favourText, objectiveText, FAVOUR_RELEASE } from '../src/engine/wording.js';
import { SERIES_RANGE, levelFor } from '../src/rules.js';
import { DECKS, DECK_IDS, DECK_RULES, validateDeck } from '../src/engine/decks.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const J = JSON.parse(readFileSync(`${ROOT}docs/base-game/cards.json`, 'utf8'));
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const b1 = (list) => list.filter((x) => x.batch === 1);

// --- Every Batch 1 entry is present ---------------------------------------------------------------------------------
eq(PATHS.map((p) => p.id).sort(), b1(J.pokemon).map((p) => p.id).sort(), 'every Batch 1 Pokémon series');
eq(COMMANDS.map((c) => c.id).sort(), b1(J.moves).map((c) => c.id).sort(), 'every Batch 1 Move');
eq(SUPPORTERS.map((c) => c.id).sort(), b1(J.supporters).map((c) => c.id).sort(), 'every Batch 1 Supporter');
eq(ITEMS.map((c) => c.id).sort(), b1(J.items).map((c) => c.id).sort(), 'every Batch 1 Item');
eq(LOCATIONS.map((c) => c.id).sort(), b1(J.locations).map((c) => c.id).sort(), 'every Batch 1 Location');
eq(TRAINERS.map((c) => c.id).sort(), b1(J.trainers).map((c) => c.id).sort(), 'every Batch 1 Trainer');
const total = [J.pokemon, J.moves, J.supporters, J.items, J.locations, J.trainers].reduce((n, l) => n + b1(l).length, 0);
eq(total, 79, 'the 79 Batch 1 entries');

// --- Pokémon: forms, stats by Level, speed per form, guard, keywords per form, trigger wording ----------------------------
for (const jp of b1(J.pokemon)) {
  const p = pathDef(jp.id);
  eq([p.name ?? jp.name, p.type, p.series, !!p.legendary, p.attackType, p.guard ?? null], [jp.name, jp.type, jp.series, !!jp.legendary, jp.attackType, jp.guard ?? null], `${jp.name}: kind`);
  eq(SERIES_RANGE[jp.series], [jp.forms[0].from, jp.forms.at(-1).to], `${jp.name}: its Levels`);
  if (jp.legendary) eq(String(jp.cost), '5', `${jp.name}: cards.json prints cost 5`);
  for (const [lv, st] of Object.entries(jp.stats)) {
    const c = pokemonAt(jp.id, Number(lv));
    const f = jp.forms.find((x) => Number(lv) >= x.from && Number(lv) <= x.to);
    eq([c.level, c.name, c.attack, c.strength, c.speed, c.art, c.hasArt], [Number(lv), f.name, st.attack, st.strength, f.speed, f.art, f.hasArt], `${f.name} Level ${lv}: stats, speed, art`);
    eq(c.strengthType, jp.guard ?? 'Hitpoints', `${f.name}: guard`);
    eq(keywordList(c.keywords), f.keywords, `${f.name}: keywords, word for word`);
    eq(TRIGGER_NAMES[c.trigger.on], f.trigger, `${f.name}: trigger`);
    eq(effectText(c.trigger.effect), f.text, `${f.name}: trigger text, word for word`);
    eq(c.cost, jp.legendary ? 5 : Math.ceil(Number(lv) / 2), `${f.name} Level ${lv}: cost`);
  }
}
// The cost rules and Legendaries.
for (const p of PATHS) {
  const [lo, hi] = SERIES_RANGE[p.series];
  for (let lv = lo; lv <= hi; lv++) eq(pokemonAt(p.id, lv).cost, p.legendary ? 5 : Math.ceil(lv / 2), `${p.id} Level ${lv}: cost`);
  if (p.legendary) {
    for (const round of [1, 4, 12]) eq([levelFor(p.series, round), cardAtRound(p.id, round).level, cardAtRound(p.id, round).cost], [8, 8, 5], `${p.id}: Level 8 and cost 5 from Round 1 (Round ${round})`);
    eq(cardAtRound(p.id, 1, 2).level, 8, `${p.id}: gained Levels never take it past 8`);
  }
}
ok(PATHS.filter((p) => p.legendary).length === 4, 'four Batch 1 Legendaries');

// --- Moves: each mode's text and card line, word for word; its cost and Type ------------------------------------------
for (const jm of b1(J.moves)) {
  const c = COMMANDS.find((x) => x.id === jm.id);
  eq([c.name, c.type, c.art, c.hasArt], [jm.name, jm.type, jm.art, jm.hasArt], `${jm.name}: name, Type, art`);
  eq(Object.keys(c.modes).sort(), jm.modes.map((m) => m.mode.toLowerCase()).sort(), `${jm.name}: its modes`);
  for (const jmode of jm.modes) {
    const m = c.modes[jmode.mode.toLowerCase()];
    eq(MODE_NAMES[jmode.mode.toLowerCase()], jmode.mode);
    eq(m.cost, jmode.cost, `${jm.name} ${jmode.mode}: cost`);
    eq(effectText(m.effect), jmode.text, `${jm.name} ${jmode.mode}: text, word for word`);
    eq(shortModeText(m.effect), jmode.cardText, `${jm.name} ${jmode.mode}: cardText, word for word`);
    eq(m.short, jmode.cardText);
    ok(effectOps(m.effect).length > 0, `${jm.name} ${jmode.mode}: structured ops`);
  }
}

// --- Supporters: Release, text, Favour condition, Favour text and Recognition ---------------------------------------------------
for (const js of b1(J.supporters)) {
  const c = SUPPORTERS.find((x) => x.id === js.id);
  eq([c.name, c.release, c.art, c.hasArt], [js.name, js.release, js.art, js.hasArt], `${js.name}: name, Release, art`);
  eq(effectText(c.effect), js.text, `${js.name}: text, word for word`);
  eq(c.text, js.text);
  eq(FAVOUR_RELEASE[c.favour.condition], js.favour.release, `${js.name}: Favour condition, word for word`);
  eq(FAVOURS[c.favour.condition].text, js.favour.release);
  eq(favourText(c), js.favour.text, `${js.name}: Favour text, word for word`);
  eq(c.favour.text, js.favour.text);
  eq(c.favour.recognition, js.favour.recognition, `${js.name}: Favour Recognition`);
}

// --- Items, Locations, Trainers -----------------------------------------------------------------------------------------
for (const ji of b1(J.items)) {
  const c = ITEMS.find((x) => x.id === ji.id);
  eq([c.name, c.price, c.itemType, c.stock, c.art, c.hasArt], [ji.name, ji.price, ji.kind, ji.stock, ji.art, ji.hasArt], `${ji.name}: price, kind, Stock, art`);
  eq(effectText(c.effect), ji.text, `${ji.name}: text, word for word`);
}
for (const jl of b1(J.locations)) {
  const c = LOCATIONS.find((x) => x.id === jl.id);
  eq([c.name, c.width, c.rounds, c.art, c.hasArt], [jl.name, jl.lanes, jl.rounds, jl.art, jl.hasArt], `${jl.name}: lanes, Rounds, art`);
  eq(effectText(c.passive.effect), jl.passive, `${jl.name}: passive, word for word`);
  ok(!Object.keys(c).some((k) => /^w[e]ather$/i.test(k)), `${jl.name}: only its passive, lanes and Rounds`);
}
for (const jt of b1(J.trainers)) {
  const c = TRAINERS.find((x) => x.id === jt.id);
  eq([c.name, c.type, c.art, c.hasArt, c.command.cost], [jt.name, jt.type, jt.art, jt.hasArt, jt.command.cost], `${jt.name}: Type, art, Command cost`);
  eq(effectText(c.command.effect), jt.command.text, `${jt.name}: Command text, word for word`);
  eq(objectiveText(c.objective), jt.objective.text, `${jt.name}: Objective text, word for word`);
  eq(c.objective.need, jt.objective.need, `${jt.name}: Objective need`);
  const p = c.partner;
  const jp = jt.partner;
  eq([p.id, p.name, p.level, p.cost, p.speed, p.attackType, p.attack, p.strength, p.art, p.hasArt], [jp.id, jp.name, jp.level, jp.cost, jp.speed, jp.attackType, jp.attack, jp.strength, jp.art, jp.hasArt], `${jp.name}: the Partner`);
  eq(keywordList(p.keywords), jp.keywords, `${jp.name}: keywords`);
  eq(TRIGGER_NAMES[p.trigger.on], jp.trigger);
  eq(effectText(p.trigger.effect), jp.text, `${jp.name}: trigger text, word for word`);
}
// Re-tuned Trainers (B3-1): Misty's Command costs 2, Blaine's 1; Starmie and Ninetales as in cards.json.
eq([TRAINERS.find((t) => t.id === 'misty').command.cost, TRAINERS.find((t) => t.id === 'blaine').command.cost], [2, 1], 'Misty 2, Blaine 1');

// --- The generator is stable ------------------------------------------------------------------------------------------------
const out = execFileSync(process.execPath, [`${ROOT}v4/tools/buildcards.mjs`, '--check'], { encoding: 'utf8' });
ok(/up to date/.test(out), `buildcards --check: ${out.trim()}`);
const data = readFileSync(`${ROOT}v4/src/data/cards.js`, 'utf8');
ok(/^\/\/ /.test(data) && data.includes('ops'), 'the data module documents its vocabulary at the top');

// --- validateDeck -------------------------------------------------------------------------------------------------------------
eq(DECK_RULES, { size: 40, copies: 2, legendaryCopies: 1, maxTrainers: 3 });
for (const id of DECK_IDS) eq(validateDeck(DECKS[id].list), [], `${DECKS[id].name}: legal`);
const base = DECKS['blaines-blitz'].list;
const has = (reasons, re) => reasons.some((r) => re.test(r));
let r = validateDeck([...base, 'ponyta']);
ok(r.length && has(r, /41 cards: it needs exactly 40/), `41 cards: ${r}`);
ok(has(r, /Ponyta: at most 2 copies \(the deck has 3\)/), `3 copies: ${r}`);
r = validateDeck([...base.filter((x) => x !== 'ember'), 'ponyta', 'ponyta']);
ok(has(r, /Ponyta: at most 2 copies/) && !has(r, /cards: it needs/), `3 copies, 40 cards: ${r}`);
r = validateDeck([...base.filter((x, i) => i !== base.indexOf('ember')), 'entei']);
ok(has(r, /Entei is a Legendary: at most 1 copy \(the deck has 2\)/), `2 of a Legendary: ${r}`);
r = validateDeck([...base.filter((x, i) => i !== base.indexOf('ember') && i !== base.indexOf('ember') + 1), 'misty', 'erika']);   // (Blaine's Blitz has 2)
ok(has(r, /4 Trainers: at most 3/), `4 Trainers: ${r}`);
ok(validateDeck([...base.slice(0, 39), 'not-a-card']).some((x) => /isn't a card/.test(x)), 'an unknown id');
// Any number of Locations, and of different Legendaries.
const locs = LOCATIONS.slice(0, 9).flatMap((l) => [l.id]);
ok(!has(validateDeck([...locs, ...base.slice(0, 31)]), /Location/), 'any number of Locations');
ok(!has(validateDeck(['entei', 'kyogre', 'celebi', 'zapdos', ...base.filter((x) => !['entei', 'zapdos'].includes(x)).slice(0, 36)]), /Legendary/), 'different Legendaries');

console.log(`cardsdata: ${checks} checks passed`);
