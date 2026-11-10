// C2: the art framing review tool (docs/v4-card-overhaul.md 3).
//   node v4/tools/artframe.mjs <out-dir>     (serves the repository itself)
// Renders every piece of art the game uses, with its focal point from assets/cards/focus.json, at all four
// sizes (Full 340, Mini 200, Token 164, Chips 40 / 32 / 24, plus a large 96-px chip to judge the face
// crop), onto one contact sheet per card type: pokemon (every form and the Partners), commands,
// supporters, items, trainers, locations (with each Location's tile crop across 2, 3 and 4 lanes) and the
// card back. Non-Pokémon have no board token: their Token column shows the Mini card at 164 px.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.argv[2] ?? 'artframe-sheets';
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><base href="/v4/">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;700;800&family=Cinzel:wght@600;700;800&display=swap">
<link rel="stylesheet" href="/v4/src/ui/style.css"><style>
html,body{height:auto!important;overflow:visible!important}body{margin:0;background:#130f0b;color:#e6cf9a;font-family:'Alegreya Sans',sans-serif;width:1920px}
h1{font-family:Cinzel,serif;font-size:22px;letter-spacing:.2em;margin:18px 24px 6px;text-transform:uppercase}
p.note{margin:0 24px 12px;color:#b8a57e;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;padding:0 24px 24px}
.row{display:flex;align-items:flex-start;gap:14px;padding:10px;border:1px solid #4a3a22;border-radius:6px;background:#1b140e}
.row h2{writing-mode:vertical-rl;transform:rotate(180deg);margin:0;font:700 15px Cinzel,serif;letter-spacing:.12em}
.col{display:flex;flex-direction:column;gap:6px;align-items:center;font-size:12px;color:#9c8862}
.chips{display:flex;flex-direction:column;gap:10px;align-items:center}
.tiles{display:flex;gap:10px;align-items:flex-start;padding:0 0 0 6px}
.tile{height:283px;border:2px solid #6e5530;border-radius:7px;background-size:cover;background-repeat:no-repeat}
.scale164{width:164px;height:230px;overflow:hidden}.scale164>.cd{transform:scale(.82);transform-origin:0 0}
</style></head><body><div id="app"></div></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__artframe.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const path = normalize(decodeURIComponent(url.pathname));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(join(ROOT, path)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${server.address().port}/__artframe.html`);
await page.evaluate(() => document.fonts.ready);
const SHEETS = ['pokemon', 'commands', 'supporters', 'items', 'trainers', 'locations', 'card-back'];
for (const sheet of SHEETS) {
  await page.evaluate(async (which) => {
    const C = await import('/v4/src/engine/cards.js');
    const R = await import('/v4/src/ui/card.js');
    await R.loadArtFocus('/assets/cards/focus.json');
    const cards = {
      pokemon: [...C.PATHS.flatMap((p) => p.forms.map((f) => C.pokemonAt(p.id, f.from))), ...C.TRAINERS.map((t) => t.partner)],
      commands: C.COMMANDS, supporters: C.SUPPORTERS, items: C.ITEMS, trainers: C.TRAINERS, locations: C.LOCATIONS, 'card-back': [],
    }[which];
    const f = (c) => R.artFocus(c.art);
    const tok = (c) => (c.cardType === 'Pokémon' ? R.cardHTML(c, { size: 'token' }) : `<div class="scale164">${R.cardHTML(c, { size: 'mini' })}</div>`);
    const chips = (c) => `<div class="chips">${R.cardHTML(c, { size: 'chip', px: 96 })}${[40, 32, 24].map((px) => R.cardHTML(c, { size: 'chip', px })).join('')}<span>face ${f(c).face?.x ?? f(c).x}, ${f(c).face?.y ?? f(c).y} · zoom ${f(c).zoom ?? 1.6}</span></div>`;
    const tiles = (c) => (c.cardType === 'Location' ? `<div class="tiles">${[2, 3, 4].map((n) => `<div class="col">${n} lanes<div class="tile" style="width:${Math.round((n * 172.4 - 6) / 2)}px;background-image:url('/assets/cards/${c.art}.jpg');background-position:${f(c).tile?.x ?? 50}% ${f(c).tile?.y ?? 50}%"></div></div>`).join('')}</div>` : '');
    const row = (c) => `<div class="row"${c.cardType === 'Location' ? ' style="grid-column:1/3"' : ''}><h2>${c.name}</h2><div class="col">Full 340${R.cardHTML(c, { size: 'full' })}</div><div class="col">Mini 200${R.cardHTML(c, { size: 'mini' })}</div><div class="col">Token 164${tok(c)}</div><div class="col">Chips${chips(c)}</div>${tiles(c)}</div>`;
    const back = `<div class="row"><h2>Card back</h2><div class="col">Full 340<div style="width:340px;height:476px;border-radius:12px;background:url('/assets/ui/card-back.jpg') center/cover"></div></div><div class="col">Chips<div class="chips">${[96, 40, 32, 24].map((px) => `<span class="cd-chipart" style="width:${px}px;height:${px}px;background-image:url('/assets/ui/card-back.jpg');${R.chipCrop('card-back', px)}"></span>`).join('')}</div></div></div>`;
    document.getElementById('app').innerHTML = `${R.CARD_DEFS}<h1>Art framing · ${which}</h1><p class="note">Focal points from assets/cards/focus.json. Full, Mini and Token show the whole picture (the art is 5:7, like the card); chips are centred on the face at their zoom${which === 'locations' ? '; the tiles show each Location as it sits across 2, 3 and 4 lanes (half size)' : ''}.</p><div class="grid">${which === 'card-back' ? back : cards.map(row).join('')}</div>`;
  }, sheet);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/artframe-${sheet}.png`, fullPage: true });
  console.log(`${OUT}/artframe-${sheet}.png`);
}
await browser.close();
server.close();
