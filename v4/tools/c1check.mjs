// C1 browser check: node v4/tools/c1check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/). In Chromium at 1920×1080:
//   - the mulligan (screenshot), then a full match played by hand: each of the player's moves is chosen by
//     the AI's own chooser and then made through the interface (clicks on hand cards, spaces, buttons,
//     the mode picker, the Release choice); a move with no click path falls back to the debug hook and
//     is counted;
//   - on the way: hovering each kind of card in hand, a board token and the PokéMart card shows the
//     Full card; the mode picker, the Release choice and the Discard viewer open;
//   - a staged React window (Full cards);
//   - screenshots: a mid-match board, the hand with a hovered card, a hovered token, the React window,
//     the PokéMart card hovered, the mulligan;
//   - no page errors.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'c1-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}?debug&seed=11&speed=instant`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(async () => { window.__ai = await import('/v4/src/ai/ai.js'); window.__eng = await import('/v4/src/engine/game.js'); });
await page.waitForTimeout(500);
const idle = () => page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 60000 });
const state = () => page.evaluate(() => window.__v4.state);

// 7. The mulligan.
await page.waitForSelector('[data-mull]');
await page.screenshot({ path: `${OUT}/7-mulligan.png` });
report('the mulligan shows Mini cards', (await page.$$('.v4-cardrow.mull .cd-mini')).length === 7);
await page.click('[data-action="mull-done"]');

const zoomShown = () => page.evaluate(() => { const z = document.querySelector('.v4-zoom'); return !!z && z.style.display === 'block' && !!z.querySelector('.cd-full'); });
async function hoverEl(sel) {
  const el = await page.$(sel);
  if (!el) return false;
  const b = await el.boundingBox();
  if (!b) return false;
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(60, b.height / 2), { steps: 2 });
  await page.waitForTimeout(120);
  return zoomShown();
}
const hovered = new Set();
const opened = new Set();
let shotsTaken = { board: false, hand: false, token: false, mart: false };
let viaHook = 0;
const hookTypes = {};
let viaUi = 0;
const clickIf = async (sel) => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(40); return true; };
const confirm = async () => { await page.waitForTimeout(40); if (await page.$('[data-action="confirm-yes"]')) await page.click('[data-action="confirm-yes"]'); };
const spaceSel = (who, sp) => `.v4-row.${who === 'ai' ? 'opponent' : 'player'} .v4-space[data-space="${sp}"]`;

// Make one of the player's moves through the interface; false when there's no click path.
async function viaInterface(a) {
  const s = await state();
  if (a.type === 'pass') { if (!(await clickIf('[data-action="pass"]:not([disabled])'))) return false; await confirm(); return true; }
  if (a.type === 'decline') return clickIf('[data-action="decline"]');
  if (a.type === 'choose') return clickIf(`${spaceSel(a.target.who, a.target.space)}.target`);
  if (a.type === 'react') {
    if (!(await clickIf(`[data-react="${a.uid}"]`))) return false;
    if (await page.evaluate(() => !!window.__v4.state.reactWindow)) await clickIf(`${spaceSel(a.target.who, a.target.space ?? 0)}.target`);
    return true;
  }
  if (a.type === 'attack') {
    if (!(await clickIf(`.v4-row.player .v4-mon.can-attack[data-space="${a.from}"]`))) return false;
    return a.target.kind === 'player' ? clickIf('.v4-ring.ai.target') : clickIf(`${spaceSel('ai', a.target.space)}.target`);
  }
  if (a.type === 'useItem') { if (a.target.space === null || !(await clickIf(`[data-bag="${a.uid}"].usable`))) return false; return clickIf(`${spaceSel('player', a.target.space)}.target`); }
  if (a.type === 'buyItem' && a.from === 'mart') {
    if (!(await clickIf('[data-buy="0"]:not([disabled])'))) return false;
    if (a.then === 'store') return clickIf('[data-action="buy-store"]');
    if (a.target.space === null || !(await clickIf('[data-action="buy-use"]'))) return false;
    return clickIf(`${spaceSel('player', a.target.space)}.target`);
  }
  // Hand cards: select, then the target or a prompt button.
  if (!a.uid || !(await clickIf(`.v4-hand .v4-hcard[data-uid="${a.uid}"]`))) return false;
  if (a.type === 'summon') return clickIf(`${spaceSel('player', a.space)}.target`);
  if (a.type === 'placeLocation') return clickIf(`${spaceSel('player', a.start)}.target`);
  if (a.type === 'trainerCommand') return clickIf('[data-action="tr-command"]');
  if (a.type === 'retain') { if (!(await clickIf('[data-action="retain"]'))) return false; await confirm(); return true; }
  if (a.type === 'buyItem') {
    if (a.then === 'store') return clickIf('[data-action="buy-store"]');
    if (a.target.space === null || !(await clickIf('[data-action="buy-use"]'))) return false;
    return clickIf(`${spaceSel('player', a.target.space)}.target`);
  }
  if (a.type === 'command') {
    // A click on the target from the hand: the mode picker when both modes are playable.
    const t = a.target;
    const sp = t.all ? s.players[t.who].row.findIndex(Boolean) : t.space;
    if (!(await clickIf(`${spaceSel(t.who, sp)}.target`))) return false;
    if (await page.$('.v4-picker')) {
      opened.add('mode picker');
      if ((await page.$$('.v4-picker .cd-full')).length !== 1) report('the mode picker shows the Full card', false);
      return clickIf(`[data-pick="${a.mode}"]`);
    }
    return true;
  }
  if (a.type === 'supporter') {
    if (!(await clickIf('[data-action="play-supporter"]'))) return false;
    if (await page.$('.v4-release .v4-cardrow.full .cd-full')) opened.add('Release choice');
    for (const u of a.release) await clickIf(`[data-rel="${u}"]`);
    for (const u of a.pick ?? []) await clickIf(`[data-pickd="${u}"]`);
    if (!(await clickIf('[data-action="sup-done"]:not([disabled])'))) return false;
    await confirm();
    return true;
  }
  return false;
}

let moves = 0;
for (let i = 0; i < 1500; i++) {
  await idle();
  const s = await state();
  if (s.phase === 'gameOver') break;
  const who = await page.evaluate(() => window.__eng.actor(window.__v4.state));
  if (who !== 'player') { await page.waitForTimeout(60); continue; }
  // Hover each kind of card in hand, a board token and the PokéMart card (the Full card shows).
  for (const c of s.players.player.hand) {
    const kind = c.cardType;
    if (hovered.has(kind) || s.reactWindow || s.choice) continue;
    if (await hoverEl(`.v4-hand .v4-hcard[data-uid="${c.uid}"]`)) {
      hovered.add(kind);
      if (!shotsTaken.hand && s.players.player.hand.length >= 5) { await page.screenshot({ path: `${OUT}/3-hand-hovered.png` }); shotsTaken.hand = true; }
    }
  }
  if (!hovered.has('token') && !s.reactWindow && (await hoverEl('.v4-row.player .v4-mon'))) {
    hovered.add('token');
  }
  if (!hovered.has('mart') && !s.reactWindow && (await hoverEl('.v4-martslot'))) {
    hovered.add('mart');
    if (!shotsTaken.mart) { await page.screenshot({ path: `${OUT}/6-pokemart-hovered.png` }); shotsTaken.mart = true; }
  }
  const mons = s.players.player.row.filter(Boolean).length + s.players.ai.row.filter(Boolean).length;
  if (!shotsTaken.board && mons >= 6 && !s.reactWindow && !s.choice) {
    await page.mouse.move(960, 20);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/2-mid-match-board.png` });
    shotsTaken.board = true;
    if (await hoverEl('.v4-row.player .v4-mon')) { await page.screenshot({ path: `${OUT}/4-token-hovered.png` }); shotsTaken.token = true; }
    // The Discard viewer.
    if (await clickIf('[data-view="player-disc"]')) {
      if ((await page.$$('.v4-drawer.pileview .cd-full')).length === s.players.player.discard.length) opened.add('Discard viewer');
      await clickIf('[data-action="close-drawer"]');
    }
  }
  await page.mouse.move(960, 20);
  const a = await page.evaluate(() => window.__ai.chooseAction(window.__v4.state, 'player', { rng: () => 0.5 }));
  const before = JSON.stringify([s.log.length, s.turn, s.round, s.reactWindow, s.choice, s.phase]);
  let ok = false;
  try { ok = await viaInterface(a); } catch { ok = false; }
  await idle();
  const after = await state();
  const moved = JSON.stringify([after.log.length, after.turn, after.round, after.reactWindow, after.choice, after.phase]) !== before;
  if (ok && moved) viaUi += 1;
  else {
    // No click path (or the click didn't take): clear any choice in progress and use the debug hook.
    await page.keyboard.press('Escape');
    await page.evaluate((x) => { window.__v4.set((st, ui) => { ui.select = null; ui.picker = null; ui.confirm = null; ui.drawer = null; }); window.__v4.show(x); }, a);
    viaHook += 1;
    const k = `${a.type}${a.mode ? `/${a.mode}` : ''}${a.target?.kind === 'player' ? '/player' : ''}`;
    hookTypes[k] = (hookTypes[k] ?? 0) + 1;
  }
  moves += 1;
}
const end = await state();
report('a full match played by hand to the end', end.phase === 'gameOver', `${moves} moves: ${viaUi} through the interface, ${viaHook} through the debug hook (${Object.entries(hookTypes).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}); winner ${end.winner}, Round ${end.round}`);
for (const k of ['Pokémon', 'Command', 'Supporter', 'Item', 'Trainer', 'Location', 'token', 'mart']) report(`hover shows the Full card: ${k}`, hovered.has(k));
for (const k of ['mode picker', 'Release choice', 'Discard viewer']) report(`opened: ${k} (Full cards)`, opened.has(k));

// 5. A staged React window (a fresh match): the Opponent attacks; the player holds Commands that can React.
await page.goto(`${BASE}?debug&seed=7&speed=instant`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(() => window.__v4.fastForward(4));
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const C = await import('/v4/src/engine/cards.js');
  window.__v4.set((s) => {
    s.turn = 'ai'; s.reactWindow = null; s.choice = null; s.strats = [];
    const mon = (id, level, extra = {}) => ({ ...C.pokemonAt(id, level), uid: `r-${id}`, currentStrength: C.pokemonAt(id, level).strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
    for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null);
    s.players.player.row[3] = mon('charmander', 6, { currentStrength: 3 });
    s.players.ai.row[3] = mon('growlithe', 7, { spent: false });
    s.players.player.hand = ['dive', 'ember', 'recover'].map((id) => ({ ...C.cardAtRound(id, s.round), uid: `h-${id}` }));
    s.players.player.baseEnergy = 6;
    s.players.ai.recognition = Math.min(s.players.ai.recognition, 60);
    s.players.player.recognition = Math.min(s.players.player.recognition, 60);
  });
  window.__v4.show({ type: 'attack', who: 'ai', from: 3, target: { kind: 'pokemon', space: 3 } });
});
await page.waitForFunction(() => document.querySelectorAll('.v4-ropts .cd-full').length >= 2, null, { timeout: 30000 }).catch(async () => {
  console.log('React window not shown:', await page.evaluate(() => JSON.stringify({ rw: window.__v4.state.reactWindow?.reactor, turn: window.__v4.state.turn, phase: window.__v4.state.phase, log: window.__v4.state.log.slice(-3) })));
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/5-react-window.png` });
report('the React window shows Full cards', (await page.$$('.v4-ropts .cd-full')).length >= 2, `${(await page.$$('.v4-ropts .cd-full')).length} cards`);
report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nc1check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
