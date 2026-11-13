// v4 C4: current stats, the React window's outcomes, Bubble Beam's React and hidden Strats.
// Run: node v4/tests/c4.test.js
//   - effectiveStats against combat: over 300 random mid-match states (with Locations, Held Items,
//     until-Supper and kept effects added through the engine's own effects), the Attack shown equals the damage
//     the attack deals before Shell, and the Strength shown is the Strength damage is taken from and
//     dominance counts;
//   - the React window's previews: for each window, "let it happen" and every "if you React" option is played
//     for real on a copy, and the preview (badges, rewards) matches what resolves;
//   - Bubble Beam's React (Elliott, 11 November 2026): the attack deals 2 less damage (minimum 0);
//   - hidden Strats: the AI's choices are the same whichever card the player has sealed; the log names only
//     the Opponent's target.
import assert from 'node:assert/strict';
import { createGame, applyAction, actor, pokemonOf, applyItem, applyCommand, syncBonuses, legalTargets, strengthIn, commandTargets, reactOptions, damageOf } from '../src/engine/game.js';
import { ITEMS, COMMANDS, LOCATIONS, itemDef, commandDef, cardAtRound, pokemonAt } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/ai.js';
import { effectiveStats, statsIfPlaced, printedOf, statSumLines } from '../src/engine/stats.js';
import { reactOutcome, reactSummary } from '../src/engine/preview.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const seeded = (seed) => { let k = seed; return () => { k = (k * 9301 + 49297) % 233280; return k / 233280; }; };

// --- effectiveStats against combat -------------------------------------------------------------------------
const HELD = ITEMS.filter((c) => c.itemType === 'Held');
function enrich(s, rng) {
  // Locations (every passive) over free lanes, as the engine stores them.
  if (!s.tournament && rng() < 0.7) {
    s.locations = [];
    let start = 0;
    for (const def of [...LOCATIONS].sort(() => rng() - 0.5)) {
      if (start + def.width > 9 || rng() < 0.3) continue;
      s.locations.push({ uid: `t-${def.id}`, owner: rng() < 0.5 ? 'player' : 'ai', card: def, id: def.id, name: def.name, art: def.art, color: def.color, start, width: def.width, roundsLeft: 2, passive: def.passive, placedRound: s.round });
      start += def.width;
    }
  }
  // Held Items, X Attack (until Supper), Flame Charge (until Supper and kept), through the engine's own effects.
  for (const who of ['player', 'ai']) {
    for (const { card, space } of pokemonOf(s, who)) {
      const r = rng();
      if (r < 0.35 && !card.held) applyItem(s, who, structuredClone(HELD[Math.floor(rng() * HELD.length)]), { who, space });
      else if (r < 0.5) applyItem(s, who, structuredClone(itemDef('x-attack')), { who, space });
      else if (r < 0.65) applyCommand(s, who, structuredClone(commandDef('flame-charge')), rng() < 0.5 ? 'adapt' : 'strat', { who, space, uid: card.uid });
    }
  }
  syncBonuses(s);
  return s;
}
let states = 0;
let compared = 0;
for (let seed = 1; states < 300; seed++) {
  const rng = seeded(seed);
  let s = createGame(seed);
  const stops = new Set([30 + (seed % 40), 120 + (seed % 60), 220 + (seed % 70)]);
  for (let i = 0; i < 320 && s.phase !== 'gameOver' && states < 300; i++) {
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    if (!stops.has(i) || s.reactWindow || s.choice || s.phase !== 'battle') continue;
    const x = enrich(structuredClone(s), rng);
    if (x.phase === 'gameOver') continue;
    states++;
    for (const who of ['player', 'ai']) {
      const foe = who === 'player' ? 'ai' : 'player';
      for (const { card, space } of pokemonOf(x, who)) {
        const st = effectiveStats(x, who, space);
        ok(st.attackParts.reduce((n, p) => n + p.n, 0) === st.attack && st.strengthParts.reduce((n, p) => n + p.n, 0) === st.strength, `${card.name}: the parts add up`);
        ok(st.strength === card.currentStrength && st.strengthMax === card.strength, `${card.name}: Strength shown is the Strength used`);
        // Attack it: make it the only Active Pokémon (Ready), on its owner's turn, and read the damage dealt
        // before Shell from the engine's own attack.
        const a = structuredClone(x);
        for (const w of ['player', 'ai']) for (const { card: c } of pokemonOf(a, w)) c.spent = true;
        a.players[who].row[space].spent = false;
        a.turn = who;
        a.passesInARow = 0;
        a.players[foe].hand = [];   // no React window
        const targets = legalTargets(a, who, space);
        if (!targets.length) continue;
        const t = targets.find((q) => q.kind === 'pokemon') ?? targets[0];
        const before = t.kind === 'pokemon' ? a.players[foe].row[t.space].currentStrength : null;
        const shownTarget = t.kind === 'pokemon' ? effectiveStats(a, foe, t.space).strength : null;
        const after = applyAction(a, { type: 'attack', who, from: space, target: t });
        const ev = after.events.find((e) => e.type === 'attack' && e.who === who);
        ok(ev && (t.kind === 'pokemon' ? ev.raw : ev.amount) === st.attack, `${card.name}: Attack shown ${st.attack} = damage before Shell ${ev?.raw ?? ev?.amount}`);
        if (t.kind === 'pokemon') ok(shownTarget === before, 'the target\'s Strength shown is the Strength the hit comes off');
        compared++;
      }
    }
    // Dominance counts the Strength shown.
    for (const l of x.locations) ok(['player', 'ai'].every((w) => strengthIn(x, l, w) === pokemonOf(x, w).filter(({ space }) => space >= l.start && space < l.start + l.width).reduce((n, { space }) => n + effectiveStats(x, w, space).strength, 0)), 'dominance counts the Strength shown');
  }
}
ok(compared > 300, `effectiveStats against combat: ${states} states, ${compared} attacks`);
// The trends: raised (a Location bonus), damaged, unchanged; the one-line sum.
{
  let s = createGame(4);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null);
  const ember = LOCATIONS.find((l) => l.id === 'mt-ember');
  s.locations = [{ uid: 'loc-e', owner: 'player', card: ember, id: ember.id, name: ember.name, start: 2, width: 3, roundsLeft: 2, passive: ember.passive, placedRound: 1 }];
  const mon = (id, lv, x = {}) => ({ ...pokemonAt(id, lv), uid: `m-${id}`, currentStrength: pokemonAt(id, lv).strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x });
  s.players.player.row[3] = mon('charmander', 8);
  s.players.player.row[6] = mon('squirtle', 7, { currentStrength: 4 });
  syncBonuses(s);
  const z = effectiveStats(s, 'player', 3);
  ok(z.attack === 9 && z.attackTrend === 'up' && statSumLines(z).attack === 'Attack 9 = 8 + 1 Mt. Ember', `on Mt. Ember: ${statSumLines(z).attack}`);
  const q = effectiveStats(s, 'player', 6);
  ok(q.strength === 4 && q.strengthMax === pokemonAt('squirtle', 7).strength && q.strengthTrend === 'down' && q.attackTrend === '', 'damaged: Strength down, Attack unchanged');
  // A card in hand keeps its printed values; summoned onto Mt. Ember it would show +1 Attack.
  const hand = { ...cardAtRound('magby', s.round), uid: 'h-g' };
  s.players.player.hand.push(hand);
  const there = statsIfPlaced(s, 'player', hand, 2);
  ok(there.attack === printedOf(hand).attack + 1 && there.attackTrend === 'up', 'statsIfPlaced: +1 Attack on Mt. Ember');
  ok(statsIfPlaced(s, 'player', hand, 0).attack === printedOf(hand).attack, 'statsIfPlaced: printed elsewhere');
}

// --- Bubble Beam's React ---------------------------------------------------------------------------------------
{
  const bb = commandDef('bubble-beam');
  ok(bb.modes.react.ops[0].op === 'reduce' && bb.modes.react.ops[0].amount === 2 && bb.modes.react.cost === 1, 'Bubble Beam React: cost 1, the attack deals 2 less');
  ok(['adapt', 'strat'].every((m) => bb.modes[m].ops.map((o) => o.op).join() === 'damage,spend'), 'Adapt and Strat: damage, and it becomes Spent');
}

// --- The React window's previews against what resolves -----------------------------------------------------------
let windows = 0;
let options = 0;
let kinds = new Set();
for (let seed = 1; seed < 400 && windows < 120; seed++) {
  const rng = seeded(seed * 7);
  let s = createGame(seed);
  for (let i = 0; i < 500 && s.phase !== 'gameOver'; i++) {
    if (s.reactWindow) {
      const w = s.reactWindow;
      const opts = [null];
      for (const c of reactOptions(s, w.reactor)) for (const t of commandTargets(s, w.reactor, c, 'react')) opts.push({ uid: c.uid, target: t, card: c });
      if (opts.length > 1) {
        windows++;
        kinds.add(w.pending.type);
        for (const o of opts) {
          const prev = reactOutcome(s, o);
          const real = o ? applyAction(s, { type: 'react', who: w.reactor, uid: o.uid, target: o.target }) : applyAction(s, { type: 'decline', who: w.reactor });
          // The preview is the engine's own action on a copy: the same board, rewards and Recognition.
          for (const who of ['player', 'ai']) {
            ok(JSON.stringify(prev.sim.players[who].row) === JSON.stringify(real.players[who].row), 'the preview\'s board is the real result');
            ok(prev.sim.players[who].recognition === real.players[who].recognition && prev.sim.players[who].dollars === real.players[who].dollars, 'the same rewards');
          }
          // Each badge's "Strength a → b" is the Strength there afterwards (0 if defeated).
          for (const b of prev.badges) {
            const all = [...b.lines.join(' ').matchAll(/Strength (\d+) → (\d+)/g)];
            if (!all.length) continue;
            const m = [null, all[0][1], all.at(-1)[2]];
            const before = s.players[b.who].row[b.space];
            const now = real.players[b.who].row[b.space];
            const after = Math.max(0, now?.uid === before.uid ? now.currentStrength : real.players[b.who].released.find((c) => c.uid === before.uid)?.currentStrength ?? 0);
            ok(Number(m[1]) === before.currentStrength && Number(m[2]) === after, `badge ${b.lines[0]} vs ${before.currentStrength} → ${after}`);
            ok(/Defeated/.test(b.lines.join(' ')) === (now?.uid !== before.uid && !real.players[b.who].hand.some((c) => c.uid === before.uid)), 'Defeated shown when it is defeated');
          }
          if (o) {
            const line = reactSummary(s, o.card, prev);
            ok(typeof line === 'string' && line.length > 3, `a tray line: ${line}`);
            if (o.card.modes.react.op === 'dive' && prev.fizzled) ok(/returns to your hand · the attack fizzles/.test(line), `Dive: ${line}`);
            if (o.card.modes.react.op === 'reduce') {
              const p = w.pending;
              const d = damageOf(s, s.players[p.who].row[p.from]);
              ok(prev.raw === Math.max(0, d - 2) && line.includes(`deals 2 less: ${d} → ${Math.max(0, d - 2)}`), `Bubble Beam: ${line}`);
              kinds.add('reduce');
            }
            if (o.card.modes.react.op === 'dive') kinds.add('dive');
          }
          options++;
        }
      }
    }
    if (actor(s) === null) break;
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
  }
}
ok(windows >= 60 && options > windows, `React previews: ${windows} windows, ${options} options (${[...kinds].join(', ')})`);
ok(kinds.has('attack') && kinds.has('command'), 'windows on attacks and Adapts');

// A Bubble Beam React for real: the attack deals 2 less, minimum 0.
{
  let s = createGame(9);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { s.players[w].row = Array(9).fill(null); s.players[w].hand = []; s.players[w].trainers = []; s.players[w].baseEnergy = 9; }
  s.locations = [];
  const mon = (id, lv, x = {}) => ({ ...pokemonAt(id, lv), keywords: {}, trigger: null, uid: `b-${id}-${lv}`, currentStrength: pokemonAt(id, lv).strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x });
  for (const [atk, want] of [[7, 5], [1, 0]]) {
    let x = structuredClone(s);
    x.players.player.row[4] = mon('wooper', 7);
    x.players.ai.row[4] = mon('growlithe', 4, { spent: false, attack: atk });
    x.players.player.hand = [{ ...cardAtRound('bubble-beam', 1), uid: 'bb' }];
    x.turn = 'ai';
    x = applyAction(x, { type: 'attack', who: 'ai', from: 4, target: { kind: 'pokemon', space: 4 } });
    ok(x.reactWindow?.reactor === 'player', 'a React window opens');
    const pv = reactOutcome(x, { uid: 'bb', target: { who: 'ai', space: 4 } });
    const r = applyAction(x, { type: 'react', who: 'player', uid: 'bb', target: { who: 'ai', space: 4 } });
    const ev = r.events.find((e) => e.type === 'attack');
    ok(ev.raw === want && pv.raw === want, `Bubble Beam React: Attack ${atk} deals ${want}`);
  }
}

// --- Hidden Strats ----------------------------------------------------------------------------------------------
// The AI's choices are identical whichever Command the player has sealed (same target, same cost paid).
{
  let tested = 0;
  for (let seed = 1; seed < 120 && tested < 25; seed++) {
    const rng = seeded(seed);
    let s = createGame(seed);
    for (let i = 0; i < 60 + (seed % 50) && s.phase !== 'gameOver'; i++) s = applyAction(s, chooseAction(s, actor(s), { rng }));
    if (s.phase !== 'battle' || s.reactWindow || s.choice || actor(s) !== 'ai') continue;
    const enemy = pokemonOf(s, 'ai')[0];
    if (!enemy) continue;
    const pick = (x, id) => {
      const y = structuredClone(x);
      const card = { ...cardAtRound(id, y.round), uid: 'sealed-1' };
      y.strats = [...y.strats.filter((q) => q.owner !== 'player'), { uid: 'strat-sealed-1', owner: 'player', card, target: { who: 'ai', space: enemy.space, uid: enemy.card.uid }, targetName: enemy.card.name, playedRound: y.round }];
      return chooseAction(y, 'ai', { rng: seeded(99) });
    };
    const ids = ['ember', 'thunderbolt', 'bubble-beam'];
    const choices = ids.map((id) => JSON.stringify(pick(s, id)));
    ok(choices.every((c) => c === choices[0]), `seed ${seed}: the AI chooses the same whichever card is sealed (${choices[0].slice(0, 80)})`);
    tested++;
  }
  ok(tested >= 10, `hidden Strats: ${tested} AI decisions compared`);
}
// The log names the Opponent's sealed Strat only by its target; your own by name.
{
  for (let seed = 1; seed < 200; seed++) {
    const s = (() => { const rng = seeded(seed); let x = createGame(seed); for (let i = 0; i < 400 && x.phase !== 'gameOver'; i++) x = applyAction(x, chooseAction(x, actor(x), { rng })); return x; })();
    const sealed = s.log.filter((l) => /sealed a Strat/.test(l));
    if (!sealed.length) continue;
    ok(sealed.every((l) => !COMMANDS.some((c) => l.includes(c.name))), `the Opponent's sealed Strat is never named when played: ${sealed[0]}`);
    break;
  }
}

console.log(`v4 C4: effectiveStats against combat (${states} states, ${compared} attacks), React previews (${windows} windows, ${options} options), Bubble Beam's React, hidden Strats — ${checks} checks passed`);
