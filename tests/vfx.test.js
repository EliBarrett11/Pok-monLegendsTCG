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
  STRATEGIES, STRATEGY_FALLBACK, STRATEGY_OPENING, SWEEPS, strategyAnimation, composeStrategy, strategyTint, DIVE_RISE,
  SUMMONS, LEGENDARY_SUMMONS, summonAnimation, composeSummon, DEFEATS, defeatStyle,
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
  // A Strategy Card's budget covers its whole timeline: the shared opening plus its effect.
  const whole = def.budget === 'strategy' ? composeStrategy(id) : def;
  for (const scale of [impactScale(1), MAX_SCALE]) {
    const ms = timelineDuration(whole, scale);
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

// --- Strategy Cards (Step 22, docs/vfx.md section 4) ----------------------------------------

const deckStrategies = Object.values(DECKS).flatMap((d) => Object.keys(d.list)).map(cardDefinition).filter((c) => c.cardType === 'Strategy');
assert.equal(deckStrategies.length, 8, 'both decks: 8 Strategy Cards');
for (const c of deckStrategies) {
  const id = strategyAnimation(c);
  assert.notEqual(id, STRATEGY_FALLBACK, `${c.name}: its own animation, not the fallback`);
  assert.equal(id, `strategy-${c.id}`, `${c.name}: its own timeline`);
  assert.ok(TIMELINES[id], `${c.name}: ${id} exists`);
  assert.ok(strategyTint(c)[0] === tintOf('Fire')[0] || strategyTint(c)[0] === tintOf('Water')[0], `${c.name}: flares in its Type's colour`);
  // Every one opens the same way: flare, its name, then it dissolves into the effect.
  const def = composeStrategy(id);
  for (const cue of ['flare', 'banner', 'dissolve']) assert.ok(def.beats.some((b) => b.cue === cue), `${c.name}: the opening's ${cue}`);
  assert.ok(def.beats.filter((b) => !STRATEGY_OPENING.beats.includes(b)).every((b) => b.at >= STRATEGY_OPENING.length), `${c.name}: its effect starts after the opening`);
  // "About 2–2.5 s" with the ~300 ms rise to centre stage.
  const ms = timelineDuration(def, MAX_SCALE) + 300;
  assert.ok(ms >= 1800 && ms <= 2600, `${c.name}: ${ms} ms in total`);
}
assert.equal(Object.keys(STRATEGIES).length, 8);
assert.equal(strategyAnimation({ id: 'some-new-card' }), STRATEGY_FALLBACK, 'a card without its own animation yet gets the generic one');
// What each one is made of (docs/vfx.md section 4).
const uses = (id, pred) => TIMELINES[id].beats.some(pred);
assert.ok(uses('strategy-ember', (b) => b.projectile === 'coal') && uses('strategy-ember', (b) => b.cue === 'catch'), 'Ember: a coal arcs over and catches');
assert.ok(uses('strategy-flame-charge', (b) => b.emit === 'spiralFlames') && uses('strategy-flame-charge', (b) => b.cue === 'aura'), 'Flame Charge: fire spirals up');
assert.ok(uses('strategy-heat-wave', (b) => b.sweep === 'heatWall') && SWEEPS.heatWall.distort === 'heat', 'Heat Wave: a wall of heat with shimmer');
assert.ok(uses('strategy-fire-blast', (b) => b.emit === 'daiFlames' && EMITTERS[b.emit].at === 'dai' && EMITTERS[b.emit].tex === 'flame'), 'Fire Blast: the 大 from flame sprites');
assert.ok(uses('strategy-fire-blast', (b) => b.cue === 'impact' && b.hitstop) && uses('strategy-fire-blast', (b) => b.cue === 'scorchCatch'), 'Fire Blast: hit-stop, then Burn');
assert.ok(uses('strategy-aqua-ring', (b) => EMITTERS[b.emit]?.tex === 'ripple') && uses('strategy-aqua-ring', (b) => b.when === 'douse' && b.emit === 'steam'), 'Aqua Ring: water rings, steam when it Douses');
assert.ok(uses('strategy-aqua-ring', (b) => EMITTERS[b.emit]?.tex === 'sparkle'), 'Aqua Ring: glistens as it heals');
assert.ok(uses('strategy-bubble-beam', (b) => EMITTERS[b.emit]?.tex === 'bubble' && b.fuller), 'Bubble Beam: bubbles, fuller in Rain');
assert.ok(uses('strategy-dive', (b) => b.on === 'pile' && EMITTERS[b.emit]?.tex === 'ripple') && TIMELINES[DIVE_RISE].beats.some((b) => b.cue === 'rise'), 'Dive: a water surface, then the Pokémon rises');
assert.ok(uses('strategy-surf', (b) => b.sweep === 'surfWave') && SWEEPS.surfWave.sprite === 'wave' && SWEEPS.surfWave.hit.friend.length, 'Surf: the wave crashes over enemies and glints on friends');
for (const [name, sw] of Object.entries(SWEEPS)) {
  for (const e of [...sw.line, ...sw.hit.enemy, ...sw.hit.friend]) assert.ok(EMITTERS[e], `${name}: emitter ${e}`);
  if (sw.sprite) assert.ok(textures.has(sw.sprite), `${name}: texture ${sw.sprite}`);
}
for (const tex of ['wave', 'ripple', 'sparkle', 'cracks']) assert.ok(TEXTURES.includes(tex), `the kit's ${tex} is loaded`);

// --- Summons, defeats, healing, Trainers, Supporters (Step 23, docs/vfx.md section 6) ---------

// Every rarity has an entrance; Kyogre and Blaziken have their own Legendary cinematics.
for (const rarity of ['Common', 'Rare', 'Epic', 'Legendary']) assert.ok(TIMELINES[SUMMONS[rarity]], `${rarity}: an entrance`);
for (const c of deckPokemon) {
  const id = summonAnimation(c);
  assert.ok(TIMELINES[id], `${c.name}: ${id}`);
  assert.ok(TIMELINES[id].beats.some((b) => b.cue === 'land'), `${c.name}: it lands`);
}
assert.equal(summonAnimation(cardDefinition('kyogre')), 'summon-kyogre');
assert.equal(summonAnimation(cardDefinition('blaziken')), 'summon-blaziken');
assert.equal(summonAnimation({ id: 'mew', rarity: 'Legendary' }), 'summon-legendary', 'other Legendaries: the general cinematic');
assert.equal(summonAnimation(cardDefinition('horsea')), 'summon-common');
{
  const has = (id, pred) => TIMELINES[id].beats.some(pred);
  assert.ok(has('summon-common', (b) => b.emit === 'landRing') && has('summon-common', (b) => EMITTERS[b.emit]?.tex === 'smoke'), 'Common: a dust ring');
  assert.ok(has('summon-rare', (b) => b.emit === 'typeFlare') && !has('summon-common', (b) => b.emit === 'typeFlare'), 'Rare adds a Type flare');
  assert.ok(has('summon-epic', (b) => b.emit === 'epicFlare') && has('summon-epic', (b) => b.emit === 'lightShaft'), 'Epic: a larger flare and a light shaft');
  for (const id of ['summon-legendary', ...Object.values(LEGENDARY_SUMMONS)]) {
    assert.equal(TIMELINES[id].budget, 'cinematic', id);
    for (const m of ['descend', 'shrinkHome']) assert.ok(has(id, (b) => b.motion === m), `${id}: ${m}`);
    assert.ok(has(id, (b) => b.cue === 'dim') && has(id, (b) => b.cue === 'undim'), `${id}: the board dims, then comes back`);
  }
  assert.ok(has('summon-kyogre', (b) => EMITTERS[b.emit]?.tex === 'wave') && has('summon-kyogre', (b) => b.emit === 'rainBurst'), 'Kyogre: a wave and rain');
  assert.ok(has('summon-blaziken', (b) => b.emit === 'eruption' && b.on === 'ground'), 'Blaziken: an eruption from its space');
  // Quick Attack: lands Active, with a speed streak.
  const quick = composeSummon('summon-common', { quick: true });
  assert.ok(quick.beats.some((b) => b.ribbon === 'speedStreak') && quick.beats.some((b) => b.cue === 'active'), 'Quick Attack: a speed streak');
  assert.equal(composeSummon('summon-common').beats.length, TIMELINES['summon-common'].beats.length);
  assert.ok(timelineDuration(composeSummon('summon-kyogre', { quick: true }), MAX_SCALE) <= BUDGETS.cinematic.max);
  for (const r of ['Common', 'Rare', 'Epic']) assert.ok(timelineDuration(composeSummon(SUMMONS[r], { quick: true }), MAX_SCALE) <= BUDGETS.summon.max);
}
// A defeat's dissolve follows its cause.
assert.equal(defeatStyle({ cause: 'burn' }), 'ash', 'Burn: burnt to ash');
assert.equal(defeatStyle({ cause: 'damage', hitBy: { kind: 'pokemon', type: 'Fire' } }), 'ash', 'a Fire attack: burnt to ash');
assert.equal(defeatStyle({ cause: 'damage', hitBy: { kind: 'pokemon', type: 'Water' } }), 'wash', 'Water: washed away');
assert.equal(defeatStyle({ cause: 'damage', hitBy: { kind: 'strategy', id: 'fire-blast' } }), 'ash', 'Fire Blast: ash');
assert.equal(defeatStyle({ cause: 'damage', hitBy: { kind: 'strategy', id: 'surf' } }), 'wash', 'Surf: washed away');
assert.equal(defeatStyle({ cause: 'damage', hitBy: { kind: 'pokemon', type: 'Fighting' } }), 'shatter', 'anything else: shattered');
assert.equal(defeatStyle({ cause: 'damage', hitBy: null }), 'shatter');
for (const [style, id] of Object.entries(DEFEATS)) {
  assert.equal(TIMELINES[id].budget, 'defeat', id);
  assert.ok(TIMELINES[id].beats.some((b) => b.cue === 'gone'), `${style}: the pieces go to the Released Pile`);
}
assert.ok(TIMELINES['defeat-ash'].beats.some((b) => b.emit === 'risingEmbers') && TIMELINES['defeat-ash'].beats.some((b) => b.motion === 'char'), 'ash: chars and embers rise');
assert.ok(TIMELINES['defeat-wash'].beats.some((b) => b.emit === 'dripDroplets'), 'wash: drips away');
assert.ok(TIMELINES['defeat-shatter'].beats.some((b) => b.emit === 'cardShards'), 'shatter: shards');
// Through the engine: the defeated event says what dealt the last hit.
{
  const { battle, act, place, onTurn } = await import('./fixtures.js');
  const { applyAction } = await import('../src/engine/game.js');
  const knockout = (attacker, deckA, deckB) => {
    let s = battle({ player: deckA, ai: deckB, passives: false });
    place(s, 'player', 1, 0, attacker);
    place(s, 'ai', 1, 0, 'horsea', { spent: true });
    s.players.ai.zones[1].pokemon[0].currentStrength = 1;
    s = act(s, 'player', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
    return s.events.find((e) => e.type === 'defeated');
  };
  assert.equal(defeatStyle(knockout('growlithe', 'fire', 'water')), 'ash', 'Growlithe (Fire) burns it to ash');
  assert.equal(defeatStyle(knockout('mankey', 'fire', 'water')), 'shatter', 'Mankey (Fighting) shatters it');
  assert.equal(defeatStyle(knockout('goldeen', 'water', 'water')), 'wash', 'Goldeen (Water) washes it away');
}
// Healing, Regenerate, Trainers and Supporters each have their beat.
const cueOf = (id, cue) => TIMELINES[id]?.beats.some((b) => b.cue === cue);
assert.ok(cueOf('heal-glow', 'heal') && TIMELINES['heal-glow'].beats.some((b) => EMITTERS[b.emit]?.tex === 'sparkle'), 'heal: a glow with sparkle glints');
assert.ok(cueOf('regenerate-glow', 'heal'), 'Regenerate: a softer one');
assert.ok(EMITTERS.regenRise.count < EMITTERS.healRise.count && EMITTERS.regenRise.alpha[0] < EMITTERS.healRise.alpha[0], 'Regenerate is softer');
assert.ok(cueOf('trainer-hit', 'flinch') && TIMELINES['trainer-hit'].beats.some((b) => b.motion === 'knockBack'), 'a Trainer hit: flinch and knock-back');
assert.ok(cueOf('trainer-fall', 'crack') && cueOf('trainer-fall', 'fall') && cueOf('trainer-fall', 'dimZone'), 'a Trainer falling: cracks, falls, the Zone dims');
assert.ok(TIMELINES['trainer-fall'].beats.some((b) => EMITTERS[b.emit]?.tex === 'cracks'), 'with the cracks texture');
assert.ok(cueOf('supporter-moment', 'portrait') && cueOf('supporter-moment', 'paid') && TIMELINES['supporter-moment'].beats.some((b) => b.cue === 'gift' && b.when === 'gift'), 'a Supporter: portrait, paid cards, Gift flourish when met');

// Every library timeline, plus every attack with all its keyword touches.
const FULL = Object.fromEntries([
  ...Object.keys(TIMELINES).map((id) => [id, TIMELINES[id]]),
  ...ALL_ATTACKS.map((id) => [`${id}+all`, composeAttack(id, { trade: true, shell: true, infiltrator: true, overrun: true })]),
  ...[...Object.values(STRATEGIES), STRATEGY_FALLBACK].map((id) => [`${id}+opening`, composeStrategy(id)]),
  ...[...Object.values(SUMMONS), ...Object.values(LEGENDARY_SUMMONS)].map((id) => [`${id}+quick`, composeSummon(id, { quick: true })]),
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

// --- Flame Charge's aura: a "this Round" Attack buff, gone after Supper --------------------------

{
  const { battle, give, act, onTurn, place, at } = await import('./fixtures.js');
  const { applyAction } = await import('../src/engine/game.js');
  let s = battle({ passives: false });
  place(s, 'player', 0, 0, 'growlithe');
  const uid = give(s, 'player', 'flame-charge');
  s = act(s, 'player', { type: 'playStrategy', uid, target: { kind: 'pokemon', owner: 'player', zone: 0, space: 0 } });
  const charged = at(s, 'player', 0, 0);
  assert.ok(STATUS_VISUALS.charged.levelOf(charged), 'a this-Round Attack buff');
  assert.ok(cardMarkup(charged, 'board').includes('data-status-charged="1"'), 'the card shows the aura');
  assert.ok(!cardMarkup(at(s, 'ai', 0, 0) ?? { ...cardDefinition('horsea'), uid: 'h', currentStrength: 4 }, 'board').includes('data-status-charged'));
  for (const part of Object.values(STATUS_VISUALS.charged.ambient)) assert.ok(EMITTERS[part], part);
  // Both players pass: the Battle Phase ends, Supper ends the Round's buffs.
  let guard = 0;
  while (s.round === 1 && guard++ < 10) s = applyAction(s, { type: 'pass', who: s.turn });
  assert.equal(s.round, 2, 'the next Round');
  assert.ok(!STATUS_VISUALS.charged.levelOf(at(s, 'player', 0, 0)), 'the buff has ended');
  assert.ok(!cardMarkup(at(s, 'player', 0, 0), 'board').includes('data-status-charged'), 'and the aura is gone after Supper');
  // An Attack buff that lasts (not "this Round") gets no aura.
  assert.equal(STATUS_VISUALS.charged.levelOf({ attackBonus: 2 }), 0);
}

console.log('All VFX tests passed.');
