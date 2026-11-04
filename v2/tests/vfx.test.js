// V8 — presentation wiring (docs/vfx.md 7: visual quality can't be unit-tested, so these
// check the wiring): every card in the three decks maps to its animations; every engine
// event type has a beat; durations stay within budget (and a bigger Strategy breakpoint
// plays bigger); skip and Instant finish every timeline; the fallback works without WebGL.
// Run with: node v2/tests/vfx.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DECKS, cardAt, cardDef, POOL_ITEMS } from '../src/engine/cards.js';
import { DECK_TRAINERS, DECK_LOCATIONS } from '../src/engine/decks.js';
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import {
  animationsOf, defOf, attackFor, counterFor, strategyFor, strategyDef, summonFor, summonDef, LEGENDARIES, V2_TIMELINES,
  EVENT_BEATS, BUDGETS, timelineDuration, composeAttack, composeCounter, breakpointScale, defeatFor, STATUS_APPLIED, TIMELINES,
} from '../src/ui/vfx/library.js';
import { Timeline } from '../../src/ui/vfx/timeline.js';
import { initVfx, vfxReady, playTimeline } from '../src/ui/vfx/engine.js';
import { setSpeed } from '../../src/ui/settings.js';

// --- Every card in the three decks maps to its animations ------------------------------------------

const seen = new Set();
for (const [name, deck] of Object.entries(DECKS)) {
  for (const entry of deck.list) {
    const levels = entry.series && !entry.cap ? [1] : entry.series ? [1, 2, 3, 4, 5, 6].filter((l) => l <= entry.cap) : [1];
    for (const level of levels) {
      const card = cardAt(entry, level);
      for (const id of animationsOf(card)) {
        assert.ok(defOf(id), `${name}: ${card.name} (${card.cardType}) → ${id} exists`);
        seen.add(id);
      }
    }
    const card = cardAt(entry, 1);
    // Every Strategy Card has its own animation (none falls back to the generic one).
    if (card.cardType === 'Strategy') assert.notEqual(strategyFor(card), 'strategy-generic', `${card.name}: its own animation`);
  }
}
// Attacks: every Type + Attack-Type the decks use has its own animation, or the tinted generic one.
for (const [name, deck] of Object.entries(DECKS)) {
  for (const entry of deck.list.filter((e) => e.series)) {
    const card = cardAt(entry, entry.cap ?? 1);
    assert.ok(TIMELINES[attackFor(card)] && TIMELINES[counterFor(card)], `${name}: ${card.name} attacks and counters`);
  }
}
assert.equal(attackFor({ type: 'Fire', attackType: 'Physical' }), 'fire-physical');
assert.equal(attackFor({ type: 'Grass', attackType: 'Special' }), 'grass-special');
assert.equal(attackFor({ type: 'Normal', attackType: 'Special' }), 'generic-special', 'a combination without its own: the generic one, tinted');
// Legendaries: Kyogre, Entei and Celebi each get their cinematic.
for (const [series, id] of Object.entries(LEGENDARIES)) {
  assert.equal(summonFor({ rarity: 'Legendary', series }), id);
  assert.equal(TIMELINES[id].budget, 'cinematic', `${series}: a cinematic`);
}
assert.deepEqual(['Common', 'Rare', 'Epic'].map((rarity) => summonFor({ rarity })), ['summon-common', 'summon-rare', 'summon-epic']);
// Partners, Trainers, Items and Locations.
for (const t of DECK_TRAINERS) {
  const p = t.tiers[2].partner;
  assert.ok(TIMELINES[attackFor(p)], `${p.name}: attacks`);
  for (const id of animationsOf(t)) assert.ok(defOf(id), `${t.name} → ${id}`);
}
for (const item of POOL_ITEMS) for (const id of animationsOf(item)) assert.ok(defOf(id), `${item.name} → ${id}`);
for (const loc of DECK_LOCATIONS) for (const id of animationsOf({ ...loc, cardType: 'Location' })) assert.ok(defOf(id), `${loc.name} → ${id}`);
// Defeats by cause; statuses.
assert.deepEqual(['Fire', 'Water', 'Grass', 'burn', 'leechSeed', 'Dark'].map(defeatFor), ['defeat-ash', 'defeat-wash', 'defeat-wilt', 'defeat-ash', 'defeat-wilt', 'defeat-shatter']);
for (const id of Object.values(STATUS_APPLIED)) assert.ok(TIMELINES[id], id);

// --- Every event type has a beat ------------------------------------------------------------------------

// The event types the engine can emit (from its source) and those seen in real matches.
const source = readFileSync(new URL('../src/engine/game.js', import.meta.url), 'utf8');
const emitted = new Set([...source.matchAll(/emit\(s, '([a-zA-Z]+)'/g)].map((m) => m[1]));
for (const [a, b] of [['fire', 'water'], ['grass', 'fire'], ['water', 'grass']]) {
  let s = createGame(77, { decks: { player: DECKS[a].list, ai: DECKS[b].list }, itemPool: POOL_ITEMS, plans: { player: a, ai: b } });
  let k = 77;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    for (const e of s.events) emitted.add(e.type);
  }
}
const { BEATS } = await import('../src/ui/present.js');
for (const type of emitted) {
  assert.ok(EVENT_BEATS[type], `${type}: described in EVENT_BEATS`);
  assert.ok(BEATS[type], `${type}: the presenter has a handler`);
}
for (const type of Object.keys(EVENT_BEATS)) assert.ok(emitted.has(type), `${type}: an event the engine emits`);
assert.ok(emitted.size >= 50, `${emitted.size} event types`);

// --- Durations stay within budget ------------------------------------------------------------------------

const within = (def, label) => {
  const b = BUDGETS[def.budget];
  assert.ok(b, `${label}: has a budget (${def.budget})`);
  const ms = timelineDuration(def);
  assert.ok(ms >= b.min && ms <= b.max, `${label}: ${ms} ms within ${def.budget} ${b.min}–${b.max}`);
};
for (const [id, def] of Object.entries(V2_TIMELINES)) within(def, id);
const allDecks = Object.values(DECKS).flatMap((d) => d.list);
for (const entry of allDecks.filter((e) => e.card)) {
  const card = cardAt(entry, 1);
  if (card.cardType !== 'Strategy') continue;
  card.breakpoints.forEach((_, level) => within(strategyDef(card, level), `${card.name} breakpoint ${level + 1}`));
}
for (const entry of allDecks.filter((e) => e.series)) within(summonDef(cardAt(entry, entry.cap ?? 1)), `${entry.series} summon`);
for (const id of ['fire-physical', 'water-special', 'grass-special', 'dark-physical']) {
  within(composeAttack(id, { trade: true, shell: true, infiltrator: true, overrun: true }), `${id} with every keyword`);
}
within(composeCounter('grass-counter', { shell: true }), 'grass counter');
// A bigger breakpoint plays a bigger version: more particles, more beats.
{
  const solar = cardDef('g-solar-beam');
  const total = (def) => def.beats.reduce((n, b) => n + (b.emit ? (b.countScale ?? 1) : 0), 0);
  const [small, big] = [strategyDef(solar, 0), strategyDef(solar, 1)];
  assert.ok(total(big) > total(small) * 1.3 && big.beats.length > small.beats.length, 'Solar Beam 4 is bigger than Solar Beam 2');
  assert.ok(breakpointScale(2) > breakpointScale(1) && breakpointScale(1) > breakpointScale(0));
  const ember = cardDef('f-ember');
  assert.ok(strategyDef(ember, 2).beats.some((b) => b.cue === 'breakpoint'), 'the top breakpoint adds a shockwave moment');
}
// The Championship is a big moment, readable at Normal speed (Normal = 1.5 × these timings).
assert.ok(timelineDuration(V2_TIMELINES['v2-championship']) * 1.5 >= 3500, 'the Championship lasts long enough to read at Normal');

// --- Skip and Instant finish every timeline --------------------------------------------------------------

const everyDef = [
  ...Object.values(V2_TIMELINES), ...Object.entries(TIMELINES).map(([id, d]) => ({ ...d, id })),
  ...allDecks.filter((e) => e.card && cardAt(e, 1).cardType === 'Strategy').flatMap((e) => cardAt(e, 1).breakpoints.map((_, l) => strategyDef(cardAt(e, 1), l))),
];
for (const def of everyDef) {
  const fired = [];
  const tl = new Timeline(def, { handlers: { fire: (b, { skipped }) => fired.push(skipped) } });
  tl.advance(30);
  tl.skip();
  assert.ok(tl.done && tl.state.every((x) => x === 'finished'), `${def.id}: skip finishes it`);
  assert.equal(fired.length, def.beats.filter((b) => b.end === undefined).length, `${def.id}: every cue still fires (numbers still land)`);
  // At any speed it ends on its own too (a long step, then hit-stops).
  const run = new Timeline(def);
  for (let i = 0; i < 50 && !run.done; i++) run.advance(1000);
  assert.ok(run.done, `${def.id}: ends on its own`);
}
// Instant: the presenter draws the new state at once and shows nothing.
{
  globalThis.document = globalThis.document ?? {};
  setSpeed('instant');
  const { present } = await import('../src/ui/present.js');
  let draws = 0;
  const s0 = createGame(3, { decks: { player: DECKS.fire.list, ai: DECKS.grass.list } });
  const s1 = applyAction(s0, { type: 'flipCoin' });
  const t0 = Date.now();
  await present(null, s0, s1, 'ai', () => { draws += 1; });
  assert.equal(draws, 1, 'Instant: drawn once');
  assert.ok(Date.now() - t0 < 50, 'Instant: at once');
  setSpeed('normal');
}

// --- The fallback without WebGL ---------------------------------------------------------------------------

{
  const canvas = { getContext: () => null, hidden: true };
  assert.equal(await initVfx(canvas), false, 'no WebGL: the layer stays off');
  assert.equal(vfxReady(), false);
  assert.equal(canvas.hidden, true, 'and its canvas stays hidden');
  const t0 = Date.now();
  await playTimeline('fire-physical', { rate: 1 });
  await playTimeline(V2_TIMELINES['v2-championship'], { rate: 1 });
  assert.ok(Date.now() - t0 < 50, 'timelines resolve at once without WebGL (the page shows its 2D effects instead)');
}
// The engine copy (v2/src/ui/vfx/engine.js) differs from the current game's only where noted.
{
  const root = readFileSync(new URL('../../src/ui/vfx/engine.js', import.meta.url), 'utf8');
  const mine = readFileSync(new URL('../src/ui/vfx/engine.js', import.meta.url), 'utf8');
  assert.ok(mine.includes("loadTextures('../assets/vfx/')") && mine.includes('.v2-board .v2-card[data-status-'), 'v2 changes: texture path, board selector');
  const body = (s) => s.slice(s.indexOf('const MAX_PARTICLES'));
  const norm = (s) => body(s).replace("loadTextures('../assets/vfx/')", 'loadTextures()')
    .replace("root.querySelectorAll(`.v2-board .v2-card[data-status-${id}]`)) {", "root.querySelectorAll(`.table .card[data-status-${id}]`)) {\n      if (el.closest('.hand') || el.closest('#fx')) continue;");
  assert.equal(norm(mine), body(root), 'otherwise identical to the current game\'s engine');
}

console.log(`vfx.test: ok (${emitted.size} event types, ${everyDef.length} timelines, ${seen.size} card animations)`);
