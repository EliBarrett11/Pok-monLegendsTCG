// C1: the card sheet: the same six Full cards as the mockup's top row (Charizard, Thunderbolt, Nurse
// Joy, Rocky Helmet, Misty, Mt. Ember), then a hand of Mini cards and a row of board tokens, for a
// side-by-side comparison with docs/design/v4-cards-mockup.jpg.
// node v4/tools/cardsheet.mjs [out.png]   (serves the repository itself)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.argv[2] ?? 'cardsheet.png';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&family=Cinzel:wght@600;700;800&display=swap">
<link rel="stylesheet" href="/v4/src/ui/style.css"><style>body{margin:0;width:1920px;height:1080px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#2a2119 0%,#130f0b 60%,#080605 100%)}
.lab{position:absolute;font-family:Cinzel,serif;font-weight:600;font-size:12px;letter-spacing:.22em;color:#9c8862;text-transform:uppercase}.at{position:absolute}</style>
</head><body><div id="app"></div></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__sheet.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const path = normalize(decodeURIComponent(url.pathname));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(join(ROOT, path)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
await page.goto(`http://127.0.0.1:${server.address().port}/__sheet.html`);
await page.evaluate(async () => {
  await document.fonts.ready;
  const C = await import('/v4/src/engine/cards.js');
  const R = await import('/v4/src/ui/card.js');
  const at = (x, y, html, scale = 1, extra = '') => `<div class="at" style="left:${x}px;top:${y}px;transform:scale(${scale});transform-origin:0 0;${extra}">${html}</div>`;
  const misty = C.TRAINERS.find((t) => t.id === 'misty');
  const full = [
    R.cardHTML(C.pokemonAt('charmander', 7), { size: 'full' }),
    R.cardHTML(C.commandDef('thunderbolt'), { size: 'full', state: { modes: [{ mode: 'adapt', cost: 3 }, { mode: 'strat', cost: 4 }] } }),
    R.cardHTML(C.supporterDef('nurse-joy'), { size: 'full' }),
    R.cardHTML(C.itemDef('rocky-helmet'), { size: 'full', state: { stock: 3 } }),
    R.cardHTML(misty, { size: 'full', state: { progress: 3 } }),
    R.cardHTML(C.locationDef('mt-ember'), { size: 'full' }),
  ];
  let h = `${R.CARD_DEFS}<div class="lab" style="left:40px;top:22px">Full cards · 340 × 476 (shown at 290, as in the mockup)</div>`;
  full.forEach((c, k) => { h += at(40 + k * 314, 54, c, 290 / 340); });
  h += '<div class="lab" style="left:40px;top:500px">Hand · 200 px wide</div>';
  const hand = [C.pokemonAt('growlithe', 3), C.pokemonAt('shinx', 2), C.commandDef('ember'), C.supporterDef('professor-oak'), C.itemDef('potion')];
  hand.forEach((c, k) => { h += at(40 + k * 150, 536 + Math.abs(k - 2) * 6, R.cardHTML(c, { size: 'mini', state: c.cardType === 'Command' ? { modes: [{ mode: 'adapt', cost: 2 }, { mode: 'strat', cost: 3 }] } : {} }), 1, `rotate:${(k - 2) * 2.2}deg`); });
  h += '<div class="lab" style="left:900px;top:500px">On the board · 164 px wide</div>';
  const charcoal = C.itemDef('charcoal');
  const toks = [
    [{ ...C.pokemonAt('charmander', 7), held: charcoal }, { ready: true }],
    [{ ...C.pokemonAt('squirtle', 6), currentStrength: 4 }, {}],
    [C.pokemonAt('chinchou', 4), { spent: true }],
    [C.TRAINERS.find((t) => t.id === 'blaine').partner, {}],
    [C.pokemonAt('shinx', 6), {}],
  ];
  toks.forEach(([c, st], k) => { h += at(915 + k * 190, 556, R.cardHTML(c, { size: 'token', state: st })); });
  document.getElementById('app').innerHTML = h;
  await new Promise((r) => setTimeout(r, 600));
});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT });
await browser.close();
server.close();
console.log(`card sheet: ${OUT}`);
