// Checks the effects layer's wiring (docs/vfx.md section 7): visual quality
// can't be unit-tested, so these check that every card resolves to an
// animation, timelines stay within their budgets, skipping and Instant speed
// finish every timeline, hit-stop holds the clock, Burn visual levels map from
// the Burn count, and the game falls back to 2D without WebGL. No DOM.
// Run with: node tests/vfx.test.js
import assert from 'node:assert/strict';
import {
  TIMELINES, EMITTERS, RIBBONS, BUDGETS, ATTACKS, STATUS_VISUALS, TEXTURES, BUILT_IN,
  attackAnimation, counterAnimation, timelineDuration, statusLevel, impactScale, MAX_SCALE, tintOf,
} from '../src/ui/vfx/library.js';
import { Timeline } from '../src/ui/vfx/timeline.js';
import { MOTION_NAMES } from '../src/ui/vfx/engine.js';
import { createRenderer } from '../src/ui/vfx/gl.js';
import { cardMarkup } from '../src/ui/render.js';
import { DECKS, POKEMON_CARDS } from '../src/engine/cardData.js';
import { cardDefinition } from '../src/engine/cards.js';

// --- Every Pokémon in both decks resolves to an attack animation ----------------------------

const deckPokemon = Object.values(DECKS).flatMap((d) => Object.keys(d.list)).map(cardDefinition).filter((c) => c.cardType === 'Pokémon');
assert.equal(deckPokemon.length, 20);
for (const c of deckPokemon) {
  const id = attackAnimation(c);
  assert.ok(TIMELINES[id], `${c.name}: ${id}`);
  assert.equal(TIMELINES[id].budget, 'attack', `${c.name}: an attack timeline`);
  assert.ok(TIMELINES[counterAnimation(c)], `${c.name}: a counter for trades`);
  assert.ok(tintOf(c.pokemonType).length === 2, `${c.name}: a Type tint`);
}
// Fire is built in full; the rest use the generic Physical / Special one (Step 21 adds theirs).
const byId = (id) => attackAnimation(cardDefinition(id));
for (const id of ['growlithe', 'ponyta', 'arcanine', 'blaziken']) assert.equal(byId(id), 'fire-physical', id);
for (const id of ['charmander', 'magmar', 'houndoom']) assert.equal(byId(id), 'fire-special', id);
assert.equal(byId('mankey'), 'generic-physical', 'Fighting Physical: generic until Step 21');
assert.equal(byId('chinchou'), 'generic-special', 'Electric Special: generic until Step 21');
assert.equal(counterAnimation(cardDefinition('magmar')), 'fire-counter');
assert.equal(counterAnimation(cardDefinition('horsea')), 'generic-counter');
for (const id of Object.values(ATTACKS)) assert.ok(TIMELINES[id], id);
assert.ok(POKEMON_CARDS.every((c) => TIMELINES[attackAnimation(c)]));

// --- Every timeline is well formed and within its budget -------------------------------------

const textures = new Set([...TEXTURES, ...BUILT_IN]);
for (const [id, def] of Object.entries(TIMELINES)) {
  const budget = BUDGETS[def.budget];
  assert.ok(budget, `${id}: a budget`);
  for (const scale of [impactScale(1), MAX_SCALE]) {
    const ms = timelineDuration(def, scale);
    assert.ok(ms >= budget.min && ms <= budget.max, `${id}: ${ms} ms at scale ${scale} is outside ${budget.min}–${budget.max} ms`);
  }
  for (const b of def.beats) {
    assert.ok(b.at >= 0 && b.at <= def.duration, `${id}: a beat at ${b.at} ms is inside the timeline`);
    if (b.end !== undefined) assert.ok(b.end > b.at && b.end <= def.duration, `${id}: a beat ending at ${b.end} ms`);
    if (b.emit) assert.ok(EMITTERS[b.emit], `${id}: emitter ${b.emit}`);
    if (b.ribbon) assert.ok(RIBBONS[b.ribbon], `${id}: ribbon ${b.ribbon}`);
    if (b.track) assert.ok(MOTION_NAMES.includes(b.motion), `${id}: motion ${b.motion}`);
  }
}
for (const [name, e] of Object.entries(EMITTERS)) {
  assert.ok(textures.has(e.tex), `${name}: texture ${e.tex}`);
  assert.ok(e.count || e.rate, `${name}: a burst count or a stream rate`);
}
for (const [name, r] of Object.entries(RIBBONS)) assert.ok(textures.has(r.tex), `${name}: texture ${r.tex}`);
// The docs/vfx.md budget: an attack about 1–1.5 s.
assert.deepEqual([BUDGETS.attack.min <= 1000, BUDGETS.attack.max], [true, 1500]);

// --- Playing a timeline -----------------------------------------------------------------------

// Plays a timeline with handlers that record what happened.
function record(id, scale = 1) {
  const log = { start: [], update: [], end: [], fire: [], skipped: [], done: 0 };
  const tl = new Timeline(TIMELINES[id], {
    scale,
    handlers: {
      start: (b) => log.start.push(b),
      update: (b, k) => log.update.push([b, k]),
      end: (b) => log.end.push(b),
      fire: (b, { skipped }) => (skipped ? log.skipped : log.fire).push(b),
      done: () => { log.done += 1; },
    },
  });
  return { tl, log };
}
const withEnd = (id) => TIMELINES[id].beats.filter((b) => b.end !== undefined);
const instant = (id) => TIMELINES[id].beats.filter((b) => b.end === undefined);

// Played through in frames: every beat runs once, in time, and it finishes.
for (const id of Object.keys(TIMELINES)) {
  const { tl, log } = record(id);
  let guard = 0;
  while (!tl.done && guard++ < 1000) tl.advance(16);
  assert.ok(tl.done, `${id} finishes`);
  assert.equal(log.done, 1);
  assert.equal(log.fire.length, instant(id).length, `${id}: every burst and cue once`);
  assert.equal(log.end.length, withEnd(id).length, `${id}: every motion and stream ends`);
  assert.ok(log.update.every(([, k]) => k >= 0 && k <= 1));
  assert.ok(guard * 16 <= timelineDuration(TIMELINES[id], 1) + 32, `${id}: no longer than its duration plus hit-stop`);
}

// Skipping (click-to-skip) completes a timeline at any point: everything not
// yet done finishes at once, cues still fire (flagged as skipped).
for (const id of Object.keys(TIMELINES)) {
  for (const at of [0, 120, TIMELINES[id].duration / 2]) {
    const { tl, log } = record(id);
    tl.advance(at);
    const firedBefore = log.fire.length;
    tl.skip();
    assert.ok(tl.done, `${id} skipped at ${at} ms is done`);
    assert.equal(log.done, 1);
    assert.equal(firedBefore + log.skipped.length, instant(id).length, `${id}: every cue either fired or was skipped`);
    assert.equal(log.end.length, withEnd(id).length, `${id}: every motion ends (cards go home)`);
    tl.skip();
    tl.advance(1000);
    assert.equal(log.done, 1, 'skipping again changes nothing');
  }
}

// Instant speed: one huge step finishes everything too.
for (const id of Object.keys(TIMELINES)) {
  const { tl, log } = record(id);
  tl.advance(1e9);
  if (!tl.done) tl.advance(1e9);   // a hit-stop takes one more step
  assert.ok(tl.done, `${id}: Instant finishes it`);
  assert.equal(log.fire.length, instant(id).length);
}

// Hit-stop holds the clock: a few frames where nothing moves, longer for bigger hits.
{
  const impact = TIMELINES['fire-physical'].beats.find((b) => b.cue === 'impact');
  for (const scale of [impactScale(1), impactScale(7)]) {
    const { tl } = record('fire-physical', scale);
    tl.advance(impact.at);
    assert.ok(tl.holding, 'held at the impact');
    const t = tl.t;
    tl.advance(impact.hitstop * scale - 1);
    assert.equal(tl.t, t, 'nothing moves during hit-stop');
    tl.advance(10);
    assert.ok(tl.t > t, 'then it carries on');
  }
  assert.ok(impactScale(7) > impactScale(1), 'bigger hits, bigger effects');
}

// --- Burn visual levels from the Burn count -------------------------------------------------------

assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map((n) => statusLevel('burn', n)), [0, 1, 2, 3, 4, 4, 4]);
assert.equal(statusLevel('burn', undefined), 0);
assert.equal(statusLevel('poison', 3), 0, 'a status with no visual yet');
{
  const burn = STATUS_VISUALS.burn;
  assert.equal(burn.maxLevel, 4);
  for (let lv = 1; lv <= 4; lv++) {
    for (const part of Object.keys(burn.ambient)) assert.ok(burn.levels[lv][part] !== undefined, `level ${lv} ${part}`);
    if (lv > 1) for (const k of ['overlay', 'flames', 'embers']) assert.ok(burn.levels[lv][k] > burn.levels[lv - 1][k], `level ${lv} burns harder (${k})`);
  }
  for (const id of Object.values(burn.ambient)) assert.ok(EMITTERS[id], id);
  for (const beat of [burn.tick, burn.applied, burn.cleared]) assert.ok(TIMELINES[beat], beat);
}
// The card markup carries the level (and Type + Attack-Type) for the effects layer and the CSS char edge.
// (Trainers get the same attribute from the same code; their faces need a live game to draw.)
{
  const markup = (burn) => cardMarkup({ ...cardDefinition('magmar'), uid: 'x', currentStrength: 7, status: burn ? { burn: { count: burn, by: 'ai' } } : undefined }, 'board');
  assert.ok(markup(0).includes('data-ptype="Fire"') && markup(0).includes('data-atype="Special"'));
  assert.ok(!markup(0).includes('data-status-burn'));
  assert.ok(markup(2).includes('data-status-burn="2"'));
  assert.ok(markup(6).includes('data-status-burn="4"'));
}

// --- Fallback --------------------------------------------------------------------------------------

// Without WebGL the renderer is null, so the game keeps its 2D effects.
assert.equal(createRenderer({ getContext: () => null }), null);
assert.equal(createRenderer({ getContext: () => { throw new Error('no WebGL'); } }), null);

console.log('All VFX tests passed.');
