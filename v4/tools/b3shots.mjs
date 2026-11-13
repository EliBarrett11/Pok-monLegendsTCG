// B3-1 screenshots at 1920×1080: node v4/tools/b3shots.mjs [outdir]
//   1. Blaine's Blitz against Erika's Garden in Round 4 (AI-played to there);
//   2. a hand card that gained Levels (zoomed);
//   3. a Location on the board (passive, lanes, Rounds and dominance only);
//   4. an Art Pending card in play (zoomed);
//   5. the Codex on Pickup.
// It fails on any page error.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.argv[2] ?? 'b3-shots';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${server.address().port}/v4/`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?debug&seed=11&speed=instant&deck=blaine&aideck=erika`);
await page.waitForFunction(() => window.__v4?.state);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.__v4.fastForward(4));
await page.waitForTimeout(800);
const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`${OUT}/${name}.png`); };
const info = await page.evaluate(() => ({ round: window.__v4.state.round, decks: window.__v4.state.decks }));
console.log('state', JSON.stringify(info));
await shot('b3-1-blaine-v-erika-round4');

// 2. A hand card that gained Levels: Charmander +2 (as Fisherman would give it), zoomed.
await page.evaluate(async () => {
  const C = await import('/v4/src/engine/cards.js');
  window.__v4.set((s) => { s.players.player.hand.unshift({ ...C.cardAtRound('charmander', s.round, 2), uid: 'b3-lv' }); });
});
await page.waitForTimeout(300);
const hc = await page.$('[data-uid="b3-lv"], [data-hand="b3-lv"], .v4-hand .v4-card:first-child, .v4-hand [data-codex="card:b3-lv"]');
if (hc) { await hc.hover(); await page.waitForTimeout(500); }
await shot('b3-2-hand-card-gained-levels');

// 3. A Location (Cerulean Cape) on the board.
await page.mouse.move(960, 20);
await page.evaluate(async () => {
  const C = await import('/v4/src/engine/cards.js');
  const G = await import('/v4/src/engine/game.js');
  window.__v4.set((s) => {
    s.locations = s.locations.filter((l) => l.start > 3 || l.start + l.width <= 0);
    const free = [0, 1, 2, 3].every((lane) => !s.locations.some((l) => lane >= l.start && lane < l.start + l.width));
    if (free) { const l = C.locationDef('cerulean-cape'); s.locations.push({ uid: 'b3-loc', owner: 'player', card: l, id: l.id, name: l.name, art: l.art, color: l.color, start: 1, width: l.width, roundsLeft: 2, passive: l.passive, placedRound: s.round }); }
    G.syncBonuses(s);
  });
});
await shot('b3-3-location-on-the-board');

// 4. An Art Pending card in play (Pichu has no art yet), zoomed.
await page.evaluate(async () => {
  const C = await import('/v4/src/engine/cards.js');
  window.__v4.set((s) => {
    const c = C.pokemonAt('pichu', 2);
    const sp = s.players.player.row.findIndex((x) => !x);
    s.players.player.row[sp] = { ...c, uid: 'b3-ap', currentStrength: c.strength, spent: false, summonedRound: s.round, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
  });
});
await page.waitForTimeout(300);
const ap = await page.$('[data-codex$=":b3-ap"], .v4-row.player .cd-artpending');
if (ap) { await ap.hover(); await page.waitForTimeout(600); }
await shot('b3-4-art-pending-in-play');

// 5. The Codex on Pickup.
await page.mouse.move(960, 20);
await page.evaluate(() => window.__v4.set((s, ui) => { ui.codex = { stack: ['term:pickup'], q: '' }; }));
await shot('b3-5-codex-pickup');

await browser.close();
server.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log('b3shots: no page errors');
