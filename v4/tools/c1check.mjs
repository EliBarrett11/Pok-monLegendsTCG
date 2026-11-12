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
import { realInput } from './realinput.mjs';
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
const input = realInput(page, { onOpen: (k) => opened.add(k) });
const clickIf = async (sel) => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(40); return true; };
let failure = null;
let moves = 0;
for (let i = 0; i < 1500; i++) {
  await idle();
  const s = await state();
  if (s.phase === 'gameOver') break;
  // A player acknowledges the Tournament banner before anything else (it's a modal).
  if (await page.$('[data-action="tournament-ok"]')) { await page.click('[data-action="tournament-ok"]'); await page.waitForTimeout(60); }
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
  // Every move through real input (C2: no debug hook). The first Command with both modes open goes
  // through the mode picker (dropped straight on its target); the others through the prompt's mode buttons.
  const picker = a.type === 'command' && !opened.has('mode picker') && (await page.evaluate((u) => window.__eng.commandModesFor(window.__v4.state, 'player', u).filter((m) => !m.reason).length > 1, a.uid));
  const before = JSON.stringify([s.log.length, s.turn, s.round, s.reactWindow, s.choice, s.phase]);
  try { await (picker ? input.playViaPicker(a) : input.play(a)); } catch (e) { failure = `${JSON.stringify(a)}: ${e.message}`; break; }
  await idle();
  const after = await state();
  if (JSON.stringify([after.log.length, after.turn, after.round, after.reactWindow, after.choice, after.phase]) === before) { failure = `${JSON.stringify(a)}: the clicks were made but nothing happened`; break; }
  moves += 1;
}
const end = await state();
report('a full match played by hand to the end, every move through real input', end.phase === 'gameOver' && !failure, failure ?? `${moves} moves, all clicks; winner ${end.winner}, Round ${end.round}`);
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
await page.waitForFunction(() => document.querySelectorAll('.v4-rtray .v4-rcard .cd-mini').length >= 2, null, { timeout: 30000 }).catch(async () => {
  console.log('React window not shown:', await page.evaluate(() => JSON.stringify({ rw: window.__v4.state.reactWindow?.reactor, turn: window.__v4.state.turn, phase: window.__v4.state.phase, log: window.__v4.state.log.slice(-3) })));
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/5-react-window.png` });
// C4: the React window's cards are Mini cards in the tray over the hand (their Full card shows on hover).
report('the React window shows the React cards (Mini, in the tray)', (await page.$$('.v4-rtray .v4-rcard .cd-mini')).length >= 2, `${(await page.$$('.v4-rtray .v4-rcard .cd-mini')).length} cards`);
report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nc1check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
