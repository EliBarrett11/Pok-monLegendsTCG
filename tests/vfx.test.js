// Checks the effects layer's wiring (docs/vfx.md section 7): visual quality
// can't be unit-tested, so these check that every card resolves to an
// animation, timelines stay within their budgets, skipping and Instant speed
// finish every timeline, hit-stop holds the clock, Burn visual levels map from
// the Burn count, and the game falls back to 2D without WebGL. No DOM.
// Run with: node tests/vfx.test.js
import assert from 'node:assert/strict';
import {
  TIMELINES, EMITTERS, RIBBONS, BEAMS, BUDGETS, ATTACKS, COUNTERS, FALLBACKS, STATUS_VISUALS, TEXTURES, BUILT_IN,
  attackAnimation, counterAnimation, timelineDuration, statusLevel, impactScale, MAX_SCALE, tintOf,
  composeAttack, composeCounter, effectAnimation, BURN_CAST,
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
// Step 21: every Pokémon in both decks has its own Type + Attack-Type
// animation (docs/vfx.md section 3), never the generic fallback.
const byId = (id) => attackAnimation(cardDefinition(id));
const expected = {
  'fire-physical': ['growlithe', 'ponyta', 'arcanine', 'blaziken'],
  'fire-special': ['charmander', 'magmar', 'houndoom'],
  'water-physical': ['goldeen', 'quagsire', 'gyarados'],
  'water-special': ['horsea', 'wartortle', 'lapras', 'pelipper', 'vaporeon', 'kyogre'],
  'electric-special': ['chinchou'],
  'fighting-physical': ['mankey'],
  'dark-physical': ['sneasel'],
  'normal-physical': ['chansey'],
};
for (const [anim, ids] of Object.entries(expected)) for (const id of ids) assert.equal(byId(id), anim, id);
assert.equal(Object.values(expected).flat().length, 20, 'all 20 Pokémon listed');
for (const c of deckPokemon) {
  assert.ok(!FALLBACKS.includes(attackAnimation(c)), `${c.name}: a specific animation, not the fallback`);
  assert.ok(!counterAnimation(c).startsWith('generic'), `${c.name}: its own counter`);
}
// Types no deck uses yet keep the generic one, tinted by Type.
assert.equal(attackAnimation({ pokemonType: 'Grass', attackType: 'Physical' }), 'generic-physical');
assert.equal(attackAnimation({ pokemonType: 'Psychic', attackType: 'Special' }), 'generic-special');
assert.equal(counterAnimation({ pokemonType: 'Grass', attackType: 'Special' }), 'generic-counter');
assert.equal(counterAnimation(cardDefinition('magmar')), 'fire-counter');
assert.equal(counterAnimation(cardDefinition('horsea')), 'water-counter');
for (const id of Object.values(COUNTERS)) assert.equal(TIMELINES[id].budget, 'counter', id);
// Effect damage from a card reuses an attack animation: a Pokémon's own, Crasher Wake's Power as Water Special.
assert.equal(effectAnimation({ name: 'Gyarados', ...cardDefinition('gyarados') }), 'water-physical');
assert.equal(effectAnimation({ name: 'Crasher Wake' }), 'water-special');
assert.equal(effectAnimation({ name: 'Misty' }), null, 'other Trainers keep the plain hit');
assert.ok(TIMELINES[BURN_CAST].beats.some((b) => b.cue === 'scorch'), 'On Summon Burn uses the Scorch ember swirl');
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
    if (b.beam) assert.ok(BEAMS[b.beam] && textures.has(BEAMS[b.beam].tex), `${id}: beam ${b.beam}`);
  }
}

// --- Keyword touches: each adds its own beat to an attack's timeline ------------------------

const ALL_ATTACKS = [...Object.values(ATTACKS), ...FALLBACKS];
const KEYS = ['trade', 'shell', 'infiltrator', 'overrun'];
const combos = [{}];
for (const k of KEYS) for (const c of [...combos]) combos.push({ ...c, [k]: true });
assert.equal(combos.length, 16);
for (const id of ALL_ATTACKS) {
  const plain = composeAttack(id, {});
  assert.equal(plain.beats.length, TIMELINES[id].beats.length, `${id}: no keywords, no extra beats`);
  assert.deepEqual(plain.keywords, []);
  const impact = TIMELINES[id].beats.find((b) => b.cue === 'impact');
  assert.ok(impact, `${id}: has an impact`);
  const tagged = (def, kw) => def.beats.filter((b) => b.keyword === kw);
  const tr = composeAttack(id, { trade: true });
  assert.ok(tagged(tr, 'trade').some((b) => b.cue === 'trade' && b.at === impact.at), `${id}: the trade answer starts at the impact`);
  const sh = composeAttack(id, { shell: true });
  assert.ok(tagged(sh, 'Shell').some((b) => b.cue === 'shell' && b.emit === 'shellShimmer'), `${id}: a Shell shimmer`);
  const inf = composeAttack(id, { infiltrator: true });
  assert.ok(tagged(inf, 'Infiltrator').some((b) => b.cue === 'infiltrate' && b.on === 'guard'), `${id}: Infiltrator over a guard`);
  assert.ok(tagged(inf, 'Infiltrator').every((b) => b.at < impact.at), `${id}: Infiltrator happens before the hit`);
  const ov = composeAttack(id, { overrun: true });
  const ovBeats = tagged(ov, 'Overrun');
  assert.ok(ovBeats.some((b) => b.projectile === 'overrun') && ovBeats.some((b) => b.cue === 'overrunHit' && b.on === 'trainer'), `${id}: Overrun carries on into the Trainer`);
  assert.ok(ovBeats.every((b) => b.at > impact.at), `${id}: Overrun follows the hit`);
  assert.ok(ovBeats.every((b) => !b.emit || EMITTERS[b.emit]), `${id}: Overrun in the attack's own style`);
  // Every combination stays a well-formed timeline within the attack budget.
  for (const opts of combos) {
    const def = composeAttack(id, opts);
    const ms = timelineDuration(def, MAX_SCALE);
    assert.ok(ms >= BUDGETS.attack.min && ms <= BUDGETS.attack.max, `${id} ${JSON.stringify(opts)}: ${ms} ms is outside the attack budget`);
    for (const b of def.beats) {
      assert.ok(b.at >= 0 && (b.end ?? b.at) <= def.duration, `${id}: a beat inside the timeline`);
      if (b.emit) assert.ok(EMITTERS[b.emit], `${id}: emitter ${b.emit}`);
    }
  }
}
for (const id of Object.values(COUNTERS)) {
  const def = composeCounter(id, { shell: true });
  assert.ok(def.beats.some((b) => b.cue === 'shell' && b.keyword === 'Shell'), `${id}: Shell on the counter`);
  const ms = timelineDuration(def, MAX_SCALE);
  assert.ok(ms <= BUDGETS.counter.max, `${id}: within the counter budget`);
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
  const tl = new Timeline(FULL[id] ?? TIMELINES[id], {
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
const withEnd = (id) => (FULL[id] ?? TIMELINES[id]).beats.filter((b) => b.end !== undefined);
const instant = (id) => (FULL[id] ?? TIMELINES[id]).beats.filter((b) => b.end === undefined);

// Every library timeline, plus every attack with all its keyword touches.
const FULL = Object.fromEntries([
  ...Object.keys(TIMELINES).map((id) => [id, TIMELINES[id]]),
  ...ALL_ATTACKS.map((id) => [`${id}+all`, composeAttack(id, { trade: true, shell: true, infiltrator: true, overrun: true })]),
]);

// Played through in frames: every beat runs once, in time, and it finishes.
for (const id of Object.keys(FULL)) {
  const { tl, log } = record(id);
  let guard = 0;
  while (!tl.done && guard++ < 1000) tl.advance(16);
  assert.ok(tl.done, `${id} finishes`);
  assert.equal(log.done, 1);
  assert.equal(log.fire.length, instant(id).length, `${id}: every burst and cue once`);
  assert.equal(log.end.length, withEnd(id).length, `${id}: every motion and stream ends`);
  assert.ok(log.update.every(([, k]) => k >= 0 && k <= 1));
  assert.ok(guard * 16 <= timelineDuration(FULL[id], 1) + 32, `${id}: no longer than its duration plus hit-stop`);
}

// Skipping (click-to-skip) completes a timeline at any point: everything not
// yet done finishes at once, cues still fire (flagged as skipped).
for (const id of Object.keys(FULL)) {
  for (const at of [0, 120, FULL[id].duration / 2]) {
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
for (const id of Object.keys(FULL)) {
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
