// UX4: motion and effects. Run: node v4/tests/ux4.test.js
// Checks the presenter's data and plan (pure, headless): every event type the engine emits in 30
// fixed-seed AI-vs-AI matches has a beat; every attack combination, Command card and mode, Supporter,
// Item and Trainer Command maps to an animation; timelines and moments stay within the vfx.md budgets
// at Normal; and a seeded match ends in the same state whether it is planned at Instant or Normal.
import assert from 'node:assert/strict';
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { PATHS, COMMANDS, MODES, SUPPORTERS, ITEMS, TRAINERS, pokemonAt } from '../src/engine/cards.js';
import {
  EVENT_BEATS, BUDGETS, V4_TIMELINES, MOMENTS, SFX, attackFor, attackDef, counterFor, commandDef, commandMs, MODE_STYLE,
  SUPPORTER_ANIMS, ITEM_ANIMS, TRAINER_COMMAND_ANIMS, ATTACK_NAMES, defOf, timelineDuration, TIMELINES, SPEEDS,
} from '../src/ui/vfx/library.js';
import { plan } from '../src/ui/plan.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const within = (ms, budget, what) => ok(budget && ms <= budget.max + 1e-6, `${what}: ${Math.round(ms)} ms is over its budget (${budget?.max})`);

function match(seed, onStep) {
  let s = createGame(seed);
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let n = 0; n < 4000 && s.phase !== 'gameOver'; n++) {
    const prev = s;
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    onStep?.(prev, s);
  }
  return s;
}

// 1. Every event type emitted in 30 matches has a beat, and every action's plan is within budgets.
const seen = new Map();
const beatsSeen = new Set();
for (let seed = 1; seed <= 30; seed++) {
  match(seed, (prev, next) => {
    for (const e of next.events) seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
    const p = plan(prev, next, 1);
    for (const st of p.steps) {
      beatsSeen.add(st.beat);
      const budget = BUDGETS[EVENT_BEATS[st.e.type]?.budget] ?? BUDGETS[MOMENTS[st.beat === 'supperHand' ? 'supperHand' : st.beat === 'turn' ? 'banner' : st.beat]?.budget];
      if (st.beat === 'command' || st.beat === 'react') within(st.ms, BUDGETS[MODE_STYLE[st.beat === 'react' ? 'react' : st.e.mode].budget], `${st.e.id} ${st.e.mode}`);
      else within(st.ms, budget, `beat ${st.beat} (${st.e.type})`);
    }
  });
}
for (const type of seen.keys()) ok(EVENT_BEATS[type], `the engine emitted ${type}, which has no EVENT_BEATS entry`);
for (const [type, entry] of Object.entries(EVENT_BEATS)) {
  ok(['before', 'after', 'banner', 'quiet'].includes(entry.when), `${type}: when`);
  ok(entry.sfx === null || SFX.includes(entry.sfx) || entry.sfx === 'attack-<type>', `${type}: sfx ${entry.sfx}`);
}
console.log(`  ${seen.size} event types seen in 30 matches, all with beats; ${beatsSeen.size} beats played`);
for (const must of ['attack', 'defeat', 'recognition', 'summon', 'breakfast', 'supper', 'dominance', 'partner', 'tournament', 'champion', 'react', 'supporter', 'itemUsed', 'locationPlaced']) {
  ok(beatsSeen.has(must), `the beat ${must} never played in 30 matches`);
}

// 2. Every attack combination maps to an animation, and the named ones are the ones asked for.
const mons = [...PATHS.flatMap((p) => p.forms.map((f) => pokemonAt(p.id, f.level ?? f.from ?? 1))), ...TRAINERS.map((t) => t.partner)];
for (const m of mons) {
  const id = attackFor(m);
  ok(defOf(id), `${m.name} (${m.type} ${m.attackType}) has no attack timeline`);
  ok(TIMELINES[counterFor(m)], `${m.name}: no counter`);
  within(timelineDuration(attackDef(m, { trade: true })), BUDGETS.attack, `${m.name}'s attack`);
}
const expect = { 'Fire Physical': 'Flame Wheel', 'Fire Special': 'Flamethrower', 'Water Physical': 'Waterfall', 'Water Special': 'Hydro Pump', 'Electric Special': 'forked lightning' };
for (const [combo, name] of Object.entries(expect)) {
  const [type, attackType] = combo.split(' ');
  const id = attackFor({ type, attackType });
  ok(ATTACK_NAMES[id.replace('v4-electric-forked', 'electric-special')] === name, `${combo} should be ${name}, got ${id}`);
}
for (const [name, combo] of [['Ponyta', 'Fire Physical'], ['Charizard', 'Fire Special'], ['Gyarados', 'Water Physical'], ['Blastoise', 'Water Special'], ['Lanturn', 'Electric Special'], ['Starmie', 'Water Special'], ['Ninetales', 'Fire Special']]) {
  const m = mons.find((x) => x.name === name);
  ok(m && `${m.type} ${m.attackType}` === combo, `${name} is ${combo}`);
}

// 3. Every Command card and mode, Supporter, Item and Trainer Command maps to a beat.
for (const c of COMMANDS) {
  for (const m of MODES) {
    const def = commandDef(c.id, m);
    ok(def?.beats?.length, `${c.name} ${m}: no timeline`);
    within(commandMs(c.id, m), BUDGETS[MODE_STYLE[m].budget], `${c.name} ${m}`);
  }
  ok(commandMs(c.id, 'react') < commandMs(c.id, 'adapt') && commandMs(c.id, 'adapt') < commandMs(c.id, 'strat'), `${c.name}: React quick, Adapt standard, Strat big`);
}
for (const c of SUPPORTERS) ok(defOf(SUPPORTER_ANIMS[c.id]), `${c.name}: no Supporter effect`);
for (const c of ITEMS) ok(defOf(ITEM_ANIMS[c.op]), `${c.name}: no Item effect`);
for (const t of TRAINERS) for (const o of t.command.ops) ok(defOf(TRAINER_COMMAND_ANIMS[o.op]), `${t.name}'s Trainer Command: no effect for ${o.op}`);

// 4. v4's own timelines and moments within their budgets at Normal.
for (const [id, def] of Object.entries(V4_TIMELINES)) within(timelineDuration(def), BUDGETS[def.budget], id);
for (const [id, m] of Object.entries(MOMENTS)) within(m.ms, BUDGETS[m.budget], `moment ${id}`);
ok(MOMENTS.banner.ms <= 800, 'banners never block more than ~0.8 s');
ok(MOMENTS.partner.ms >= 1600 && MOMENTS.partner.ms <= 2600, 'a Partner arrives in about 2 s');

// 5. The same final state at Instant and at Normal (the presenter only plans; it never changes the state).
const runAt = (factor) => {
  let total = 0;
  const end = match(7, (prev, next) => { total += plan(prev, next, factor).total; });
  return { end, total };
};
const instant = runAt(SPEEDS.instant);
const normal = runAt(SPEEDS.normal);
ok(JSON.stringify(instant.end) === JSON.stringify(normal.end), 'the same final state at Instant and Normal');
ok(instant.total === 0 && normal.total > 0, 'Instant plans no time; Normal does');
ok(Math.abs(runAt(SPEEDS.fast).total - normal.total * 0.5) < 1 && Math.abs(runAt(SPEEDS.slow).total - normal.total * 1.5) < 1, 'Fast is ×0.5, Slow ×1.5');

// 6. The engine's added data fields (data only): hits on effects, sources on Recognition and $.
let hitsChecked = 0;
let fromChecked = 0;
match(3, (prev, next) => {
  for (const e of next.events) {
    if (['commandResolved', 'supporter', 'trainerCommand'].includes(e.type) || (e.type === 'itemUsed' && e.itemType === 'Consumed')) { ok(Array.isArray(e.hits), `${e.type} has hits`); hitsChecked += 1; }
    if (e.type === 'recognition' || e.type === 'dollars') { ok(e.from && e.from.kind, `${e.type} (${e.source}) has a source`); fromChecked += 1; }
  }
});
ok(hitsChecked > 0 && fromChecked > 0, 'the data fields were exercised');

console.log(`ux4: ${checks} checks passed`);
