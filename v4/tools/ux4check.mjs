// UX4 browser check: node v4/tools/ux4check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/, e.g. python3 -m http.server 8123). Checks, in Chromium (Playwright):
//   - a seeded autoplay match at Normal for 3 Rounds: no page errors; frame times (average, worst);
//   - click-to-skip; Instant draws at once; low motion removes shake and ambient Weather;
//   - the forced WebGL-off fallback (?nowebgl) still plays numbers and banners;
//   - screenshots mid-beat at 1920×1080: a Fire Special attack with a hit-back, a defeat with
//     Recognition flying, a Strat resolving, a Partner arrival, Supper dominance, the Breakfast strip,
//     the Tournament sweep, and an AI action with its arrow and the prompt bar naming it.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'ux4-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const TS = Number(process.env.TIMESCALE ?? 3);   // the set pieces play TS× slower, so screenshots land mid-beat
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}?debug&${query}`);
  await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 15000 });
  return { page, errors };
}
// Frame times while fn runs (requestAnimationFrame deltas).
async function frames(page, fn) {
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = (t) => { if (!window.__ft) return; window.__ft.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await fn();
  const ft = await page.evaluate(() => { const d = window.__ft.slice(2); window.__ft = null; return d; });
  return { avg: ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length), worst: Math.max(0, ...ft), n: ft.length };
}
const sfxSeen = (page, name) => page.waitForFunction((n) => window.__v4.played.some((x) => x.name === n), name, { timeout: 90000 });
const clearSfx = (page) => page.evaluate(() => { window.__v4.played.length = 0; });

// A board for the set-piece beats: Pokémon on both sides, Ready; the Opponent's hand emptied (no React).
async function stage(page, setup) {
  await page.evaluate(async (src) => {
    const C = await import('/v4/src/engine/cards.js');
    window.__v4.fastForward(2);
    window.__v4.set((s) => {
      const mon = (id, level, extra = {}) => ({ ...C.pokemonAt(id, level), uid: `t-${id}-${Math.random().toString(36).slice(2, 6)}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
      for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null);
      s.players.ai.hand = [];
      s.strats = [];
      s.locations = [];
      s.tournament = null;
      s.reactWindow = null;
      s.turn = 'player';
      s.passesInARow = 0;
      // eslint-disable-next-line no-new-func
      new Function('s', 'mon', 'C', src)(s, mon, C);
    });
  }, setup);
  await page.waitForTimeout(300);
}

// --- 1. A seeded match at Normal for 3 Rounds (autoplay, both sides) ---
{
  const { page, errors } = await open('seed=7&autoplay&speed=normal');
  const t0 = Date.now();
  const f = await frames(page, () => page.waitForFunction((r) => window.__v4.state.round > r || window.__v4.state.phase === 'gameOver', ROUNDS, { timeout: 15 * 60 * 1000 }));
  report(`seeded match at Normal for ${ROUNDS} Rounds`, errors.length === 0, `${((Date.now() - t0) / 1000).toFixed(0)} s, ${errors.length} page errors${errors.length ? `: ${errors[0]}` : ''}`);
  report('frame times during the match', true, `average ${f.avg.toFixed(1)} ms, worst ${f.worst.toFixed(0)} ms over ${f.n} frames · WebGL ${await page.evaluate(() => window.__v4.webgl)}`);
  await page.close();
}

const { page, errors } = await open(`seed=7&speed=normal&timescale=${TS}`);

// --- 2. Screenshots mid-beat, and the big beats' frame times ---
// A Fire Special attack with a hit-back (Charmeleon into a Ready Wartortle).
await stage(page, "s.players.player.row[3] = mon('charmander', 5); s.players.ai.row[3] = mon('squirtle', 4);");
await clearSfx(page);
let big = await frames(page, async () => {
  await page.evaluate(() => { window.__v4.show({ type: 'attack', who: 'player', from: 3, target: { kind: 'pokemon', space: 3 } }); });
  await sfxSeen(page, 'attack-fire-special');
  await page.waitForTimeout(720 * TS);
  await page.screenshot({ path: `${OUT}/1-fire-special-hit-back.png` });
  await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
});
report('Fire Special attack with a hit-back', true, `frames avg ${big.avg.toFixed(1)} ms, worst ${big.worst.toFixed(0)} ms`);

// A defeat with Recognition flying, which completes Misty's Objective: the Partner arrives.
await stage(page, "s.players.player.row[2] = mon('growlithe', 5); s.players.ai.row[2] = mon('ponyta', 2, { currentStrength: 1, spent: true }); const t = s.players.player.trainers.find((x) => x.objective.kind === 'defeat'); t.progress = t.objective.need - 1;");
await clearSfx(page);
big = await frames(page, async () => {
  await page.evaluate(() => { window.__v4.show({ type: 'attack', who: 'player', from: 2, target: { kind: 'pokemon', space: 2 } }); });
  await sfxSeen(page, 'recognition');
  await page.waitForTimeout(260 * TS);
  await page.screenshot({ path: `${OUT}/2-defeat-recognition.png` });
  await sfxSeen(page, 'partner');
  await page.waitForTimeout(620 * TS);
  await page.screenshot({ path: `${OUT}/3-partner-arrival.png` });
  await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
});
report('defeat → Recognition → Partner arrival', true, `frames avg ${big.avg.toFixed(1)} ms, worst ${big.worst.toFixed(0)} ms`);

// A Strat resolving (the Opponent's Ember, sealed, resolves when its turn starts after your Pass).
await stage(page, "s.players.player.row[4] = mon('magikarp', 4); s.players.ai.row[4] = mon('ponyta', 3); const card = { ...C.commandDef('ember'), uid: 'strat-card' }; s.strats.push({ uid: 'strat-strat-card', owner: 'ai', card, target: { who: 'player', space: 4, uid: s.players.player.row[4].uid }, targetName: s.players.player.row[4].name, playedRound: s.round }); s.players.ai.hand = [{ ...C.pokemonAt('growlithe', 2), uid: 'ai-hand-1' }]; s.players.ai.baseEnergy = 6;");
await page.screenshot({ path: `${OUT}/4a-strat-sealed.png` });
await clearSfx(page);
await page.evaluate(() => { window.__v4.show({ type: 'pass', who: 'player' }); });
await sfxSeen(page, 'command-strat');
await page.waitForTimeout(1250 * TS);
await page.screenshot({ path: `${OUT}/4-strat-resolving.png` });
await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
// The AI then takes its turn: its arrow and the prompt bar naming the action.
const aimed = await page.waitForFunction(() => window.__v4.ui.aim && window.__v4.ui.aiNote, null, { timeout: 90000 }).then(() => true, () => false);
if (aimed) await page.screenshot({ path: `${OUT}/8-ai-arrow-prompt.png` });
const note = await page.evaluate(() => document.querySelector('.v4-prompt').innerText.replace(/\s+/g, ' '));
report('AI action: thinking, named, arrow', aimed, note.slice(0, 90));
await page.waitForFunction(() => window.__v4.state.turn === 'player' && !window.__v4.isPresenting() && !window.__v4.ui.locked, null, { timeout: 60000 }).catch(() => {});

// Supper dominance, the Breakfast strip and the Tournament sweep: one Pass that ends the Battle Phase.
await stage(page, "s.players.player.row[2] = mon('charmander', 6); s.players.player.row[3] = mon('growlithe', 4); s.players.ai.row[3] = mon('ponyta', 2); s.passesInARow = 1; s.players.player.recognition = 72;");
await page.evaluate(() => { window.__v4.place('player', 'mt-ember', 2); window.__v4.set((s) => { s.turn = 'player'; s.passesInARow = 1; }); });
await clearSfx(page);
big = await frames(page, async () => {
  await page.evaluate(() => { window.__v4.show({ type: 'pass', who: 'player' }); });
  await page.waitForSelector('.v4-domglow', { timeout: 90000 });
  await page.waitForTimeout(150 * TS);
  await page.screenshot({ path: `${OUT}/5-supper-dominance.png` });
  await page.waitForSelector('.v4-strip', { timeout: 90000 });
  await page.waitForTimeout(250 * TS);
  await page.screenshot({ path: `${OUT}/6-breakfast-strip.png` });
  await page.waitForSelector('.v4-stadium', { timeout: 90000 });
  await page.waitForTimeout(500 * TS);
  await page.screenshot({ path: `${OUT}/7-tournament-sweep.png` });
  await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
});
report('Supper → Breakfast → the Tournament', true, `frames avg ${big.avg.toFixed(1)} ms, worst ${big.worst.toFixed(0)} ms (the big beat)`);
await page.screenshot({ path: `${OUT}/7b-tournament-banner.png` });

// --- 3. Click-to-skip ---
await stage(page, "s.players.player.row[3] = mon('charmander', 5); s.players.ai.row[3] = mon('squirtle', 4);");
await clearSfx(page);
await page.evaluate(() => { window.__v4.show({ type: 'attack', who: 'player', from: 3, target: { kind: 'pokemon', space: 3 } }); });
await sfxSeen(page, 'attack-fire-special');
const tSkip = Date.now();
await page.mouse.click(900, 500);
const skipped = await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 2000 }).then(() => true, () => false);
const after = await page.evaluate(() => window.__v4.state.events.some((e) => e.type === 'attack'));
report('click-to-skip jumps to the end of the action', skipped && after, `${Date.now() - tSkip} ms to the new state`);

// --- 4. Instant draws at once ---
await page.evaluate(() => window.__v4.setSpeed('instant'));
await stage(page, "s.players.player.row[3] = mon('charmander', 5); s.players.ai.row[3] = mon('squirtle', 4);");
const instant = await page.evaluate(() => { const before = window.__v4.state; window.__v4.show({ type: 'attack', who: 'player', from: 3, target: { kind: 'pokemon', space: 3 } }); return window.__v4.state !== before && !window.__v4.isPresenting(); });
report('Instant draws at once', instant);
await page.evaluate(() => window.__v4.setSpeed('normal'));

// --- 5. Low motion: no shake, no ambient Weather ---
await stage(page, "s.players.player.row[3] = mon('charmander', 7); s.players.ai.row[3] = mon('squirtle', 6);");
await page.evaluate(() => { window.__v4.place('ai', 'route-119', 0); window.__v4.set((s) => { s.turn = 'player'; }); });
const ambientOn = await page.evaluate(() => { const el = document.querySelector('.v4-ambient'); return el ? getComputedStyle(el).display !== 'none' : false; });
await page.evaluate(() => window.__v4.setLowMotion(true));
const ambientOff = await page.evaluate(() => { const el = document.querySelector('.v4-ambient'); return !el || getComputedStyle(el).display === 'none'; });
await clearSfx(page);
await page.evaluate(() => { window.__shook = false; const b = () => document.querySelector('#app .v4-board'); const watch = () => { if (b()?.style.translate) window.__shook = true; if (window.__v4.isPresenting()) requestAnimationFrame(watch); }; requestAnimationFrame(watch); window.__v4.show({ type: 'attack', who: 'player', from: 3, target: { kind: 'pokemon', space: 3 } }); requestAnimationFrame(watch); });
await page.waitForFunction(() => window.__v4.played.some((x) => x.name === 'hit'), null, { timeout: 90000 });
await page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
const shook = await page.evaluate(() => window.__shook);
report('low motion removes shake and ambient Weather', ambientOn && ambientOff && !shook, `ambient shown before ${ambientOn}, hidden after ${ambientOff}, shake ${shook}`);
await page.evaluate(() => window.__v4.setLowMotion(false));
report('no page errors in the set pieces', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.close();

// --- 6. The forced WebGL-off fallback ---
{
  const { page: p2, errors: e2 } = await open('seed=7&speed=normal&nowebgl');
  await stage(p2, "s.players.player.row[3] = mon('charmander', 5); s.players.ai.row[3] = mon('squirtle', 4);");
  await p2.evaluate(() => { window.__floats = 0; new MutationObserver((m) => { for (const r of m) for (const n of r.addedNodes) if (n.classList?.contains('v4-float')) window.__floats += 1; }).observe(document.querySelector('.v4-anim'), { childList: true }); });
  await p2.evaluate(() => { window.__v4.show({ type: 'attack', who: 'player', from: 3, target: { kind: 'pokemon', space: 3 } }); });
  await p2.waitForTimeout(250);
  await p2.screenshot({ path: `${OUT}/9-nowebgl-fallback.png` });
  await p2.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });
  const r = await p2.evaluate(() => ({ webgl: window.__v4.webgl, floats: window.__floats, hidden: document.getElementById('vfx').hidden }));
  report('WebGL off: the 2D fallback still plays', !r.webgl && r.hidden && r.floats >= 2 && e2.length === 0, `webgl ${r.webgl}, numbers ${r.floats}, errors ${e2.length}`);
  await p2.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nux4check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
