// C1: neat text, guaranteed (docs/v4-card-overhaul.md 2.2a). Renders every card in the game at every
// size in Chromium (Playwright): every Pokémon line at every Level (with and without a Held Item and a
// keyword), the Partners, every Command in every mode state, every Supporter, every Item (with and
// without Stock), every Trainer (at several points of its Objective) and every Location. It fails when
// any text element:
//   - overflows its box (scrollWidth / scrollHeight);
//   - overlaps another text element, a stat tab, the cost well or the crest (bounding boxes of the text
//     itself, from its client rects);
//   - extends outside the card's frame;
//   - renders below 10 px on screen at its size.
// Run: node v4/tests/cardtext.test.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&family=Cinzel:wght@600;700;800&display=swap">
<link rel="stylesheet" href="/v4/src/ui/style.css"><style>body{margin:0;background:#120d09;overflow:auto}#grid{display:flex;flex-wrap:wrap;gap:24px;padding:24px;align-items:flex-start}</style>
</head><body><div id="grid"></div></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__cardtest.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1900, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/__cardtest.html`);
await page.evaluate(() => document.fonts.ready);

const result = await page.evaluate(async () => {
  const C = await import('/v4/src/engine/cards.js');
  const R = await import('/v4/src/ui/card.js');
  const { SERIES_RANGE } = await import('/v4/src/rules.js');
  const cases = [];
  const add = (label, card, size, state = {}) => cases.push({ label, card, size, state });
  // Every Pokémon line at every Level, with and without a Held Item and keyword; Partners.
  const charcoal = { ...C.itemDef('charcoal') };
  for (const p of C.PATHS) {
    const [lo, hi] = SERIES_RANGE[p.series];
    for (let lv = lo; lv <= hi; lv++) {
      const c = C.pokemonAt(p.id, lv);
      for (const size of ['full', 'mini', 'token']) {
        add(`${c.name} L${lv}`, c, size);
        add(`${c.name} L${lv} plain`, { ...c, keywords: {}, trigger: null }, size);
        add(`${c.name} L${lv} held+kw`, { ...c, held: charcoal, keywords: { ...c.keywords, retaliate: 2 }, currentStrength: 1, attack: c.attack + 10 }, size);
      }
    }
  }
  for (const t of C.TRAINERS) for (const size of ['full', 'mini', 'token']) add(`${t.partner.name} (Partner)`, { ...t.partner, held: charcoal }, size);
  // Every Command in every mode state.
  // (B3-1: a Move has two or three modes.)
  const stateSets = (c) => {
    const m = (k, reason) => (c.modes[k] ? [{ mode: k, cost: c.modes[k].cost, ...(reason ? { reason } : {}) }] : []);
    return [undefined, [...m('adapt'), ...m('strat')], [...m('adapt'), ...m('strat', 'Needs more Energy')], m('react'), [...m('adapt', 'x'), ...m('strat', 'x')]].filter((x) => x === undefined || x.length);
  };
  for (const c of C.COMMANDS) for (const modes of stateSets(c)) for (const size of ['full', 'mini']) add(`${c.name} ${modes ? modes.map((m) => m.mode + (m.reason ? '-off' : '')).join('+') : 'all'}`, c, size, modes ? { modes } : {});
  for (const c of C.SUPPORTERS) for (const size of ['full', 'mini']) { add(c.name, c, size); add(`${c.name} retained`, c, size, { retained: true }); }
  for (const c of C.ITEMS) for (const size of ['full', 'mini']) { add(c.name, c, size); add(`${c.name} stock 1`, c, size, { stock: 1 }); add(`${c.name} sold out`, c, size, { soldOut: true }); }
  for (const c of C.TRAINERS) for (const size of ['full', 'mini']) for (const progress of [0, 3, c.objective.need]) add(`${c.name} ${progress}`, c, size, { progress });
  for (const c of C.LOCATIONS) for (const size of ['full', 'mini']) add(c.name, c, size);
  // B3-1: every Batch 1 card with the Art Pending panel (as the cards whose art hasn't arrived show it), and a
  // hand card that gained Levels.
  for (const c of [...C.PATHS.flatMap((p) => p.forms.map((f) => C.pokemonAt(p.id, f.from))), ...C.TRAINERS.map((t) => t.partner)]) for (const size of ['full', 'mini', 'token']) add(`${c.name} art pending`, { ...c, hasArt: false }, size);
  for (const c of [...C.COMMANDS, ...C.SUPPORTERS, ...C.ITEMS, ...C.TRAINERS, ...C.LOCATIONS]) for (const size of ['full', 'mini']) add(`${c.name} art pending`, { ...c, hasArt: false }, size);
  for (const [id, round, bonus] of [['charmander', 1, 2], ['bulbasaur', 3, 1], ['magikarp', 4, 2]]) for (const size of ['full', 'mini']) add(`${id} +${bonus} Levels in hand`, C.cardAtRound(id, round, bonus), size);
  // C4: current stats on the stat tabs (board tokens and their hover Full card): raised ▲, lowered ▼, damaged
  // (current over its maximum), two-digit values.
  const st = (attack, aT, strength, max, sT) => ({ stats: { attack, attackTrend: aT, strength, strengthMax: max, strengthTrend: sT, sumAttack: `Attack ${attack} = …`, sumStrength: `Strength ${strength} = …` } });
  for (const [id, lv] of [['charmander', 8], ['squirtle', 7], ['magikarp', 8], ['ponyta', 1]]) {
    const c = C.pokemonAt(id, lv);
    for (const size of ['token', 'full']) {
      add(`${c.name} raised`, c, size, st(c.attack + 3, 'up', c.strength + 2, c.strength + 2, 'up'));
      add(`${c.name} two-digit raised`, c, size, st(12, 'up', 14, 14, 'up'));
      add(`${c.name} damaged`, c, size, st(c.attack, '', 5, 9, 'down'));
      add(`${c.name} two-digit damaged`, c, size, st(11, 'up', 10, 12, 'down'));
      add(`${c.name} lowered`, c, size, st(Math.max(0, c.attack - 1), 'down', 1, 10, 'down'));
      add(`${c.name} 0 attack`, c, size, st(0, 'down', 12, 12, 'up'));
    }
  }
  // Hand cards Retained, at Mini size.
  add('Charizard retained', C.pokemonAt('charmander', 8), 'mini', { retained: true });

  const grid = document.getElementById('grid');
  document.body.insertAdjacentHTML('afterbegin', R.CARD_DEFS);
  grid.innerHTML = cases.map((x, i) => `<div data-case="${i}">${R.cardHTML(x.card, { size: x.size, state: x.state })}</div>`).join('');
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const textRect = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rs = [...range.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
    if (!rs.length) return null;
    return { l: Math.min(...rs.map((q) => q.left)), t: Math.min(...rs.map((q) => q.top)), r: Math.max(...rs.map((q) => q.right)), b: Math.max(...rs.map((q) => q.bottom)) };
  };
  const box = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  const hit = (a, b, pad = 0.5) => a && b && a.l < b.r - pad && b.l < a.r - pad && a.t < b.b - pad && b.t < a.b - pad;
  const problems = [];
  let texts = 0;
  for (const holder of grid.children) {
    const x = cases[Number(holder.dataset.case)];
    const label = `${x.label} [${x.size}]`;
    const cardEl = holder.firstElementChild;
    const k = cardEl.getBoundingClientRect().width / 340;
    const inner = cardEl.getBoundingClientRect();
    const frameBox = { l: inner.left + 7 * k, t: inner.top + 7 * k, r: inner.right - 7 * k, b: inner.bottom - 7 * k };
    const zones = [...cardEl.querySelectorAll('.cd-t')];
    const rects = zones.map((z) => ({ z, r: textRect(z) }));
    const obstacles = [
      ...[...cardEl.querySelectorAll('.cd-crest')].map((e) => ({ name: 'crest', r: box(e) })),
      ...[...cardEl.querySelectorAll('.cd-fr circle[r="21"]')].map((e) => ({ name: 'cost well', r: box(e), own: 'cd-cost' })),
      ...[...cardEl.querySelectorAll('.cd-fr path[fill="rgba(10,7,5,.92)"]')].map((e) => ({ name: 'stat tab', r: box(e), own: 'cd-tab' })),
      ...[...cardEl.querySelectorAll('.cd-held, .cd-portrait')].map((e) => ({ name: 'inset', r: box(e) })),
    ];
    for (const { z, r } of rects) {
      if (!r) continue;
      texts += 1;
      const zn = z.className.replace('cd-t ', '');
      if (z.scrollWidth > z.clientWidth + 1 || z.scrollHeight > z.clientHeight + 1) problems.push(`${label}: "${z.textContent.trim().slice(0, 40)}" (${zn}) overflows its box (${z.scrollWidth}×${z.scrollHeight} in ${z.clientWidth}×${z.clientHeight})`);
      // The text itself must lie inside its zone too (flex centring can push it out without scrollWidth).
      const zb = box(z);
      if (r.l < zb.l - 1 || r.r > zb.r + 1 || r.t < zb.t - 1 || r.b > zb.b + 1) problems.push(`${label}: "${z.textContent.trim().slice(0, 40)}" (${zn}) spills out of its zone`);
      if (r.l < frameBox.l - 0.5 || r.r > frameBox.r + 0.5 || r.t < frameBox.t - 0.5 || r.b > frameBox.b + 0.5) problems.push(`${label}: "${z.textContent.trim().slice(0, 40)}" extends outside the frame`);
      for (const o of obstacles) if (!(o.own && z.classList.contains(o.own)) && hit(r, o.r)) problems.push(`${label}: "${z.textContent.trim().slice(0, 40)}" (${zn}) overlaps the ${o.name}`);
      for (const el of [z, ...z.querySelectorAll('*')]) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const px = parseFloat(getComputedStyle(el).fontSize) * k;
        if (px < 10 - 0.01) problems.push(`${label}: "${el.textContent.trim().slice(0, 40)}" renders at ${px.toFixed(1)} px`);
      }
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      if (hit(rects[i].r, rects[j].r)) problems.push(`${label}: "${rects[i].z.textContent.trim().slice(0, 30)}" overlaps "${rects[j].z.textContent.trim().slice(0, 30)}"`);
    }
  }
  return { cards: cases.length, texts, problems };
});
// --- C2: the fanned hand. Hands of 5, 7, 9 and 11 cards (long names, every kind) in the game itself: no
// visible text element may be partly covered by another card (sampled with elementFromPoint).
await page.goto(`${BASE}/v4/?debug&seed=7&speed=instant`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(() => window.__v4.fastForward(3));
await page.waitForTimeout(400);
await page.evaluate(() => document.fonts.ready);
const handProblems = [];
let handTexts = 0;
for (const n of [5, 7, 9, 11]) {
  await page.evaluate(async (count) => {
    const C = await import('/v4/src/engine/cards.js');
    const ids = ['squirtle', 'pokemon-breeder', 'magby', 'thunderbolt', 'rocky-helmet', 'growlithe', 'cerulean-cape', 'professor-oak', 'flame-charge', 'misty', 'charmander', 'bubble-beam'];
    window.__v4.set((s) => { s.players.player.hand = ids.slice(0, count).map((id, k) => ({ ...C.cardAtRound(id, 6), uid: `hh-${k}`, ...(k === 2 ? { retained: true } : {}) })); });
  }, n);
  await page.mouse.move(960, 20);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const out = [];
    let count = 0;
    const slots = [...document.querySelectorAll('.v4-hand .v4-slot')];
    for (const slot of slots) {
      for (const el of slot.querySelectorAll('.cd-t, .cd-chip')) {
        if (![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()) && !el.matches('.cd-chip')) continue;
        if (getComputedStyle(el).visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const rs = [...range.getClientRects()].filter((q) => q.width > 0.5);
        if (!rs.length) continue;
        count += 1;
        const box = { l: Math.min(...rs.map((q) => q.left)), t: Math.min(...rs.map((q) => q.top)), r: Math.max(...rs.map((q) => q.right)), b: Math.max(...rs.map((q) => q.bottom)) };
        let covered = 0;
        for (let i = 0; i <= 6; i++) for (let j = 1; j <= 3; j++) {
          const x = box.l + ((box.r - box.l) * i) / 6 + (i === 0 ? 0.5 : i === 6 ? -0.5 : 0);
          const y = box.t + ((box.b - box.t) * j) / 4;
          const at = document.elementFromPoint(x, y);
          if (at && !slot.contains(at)) covered += 1;
        }
        if (covered) out.push(`"${el.textContent.trim().slice(0, 24)}" in card ${slots.indexOf(slot) + 1} is partly covered (${covered} points)`);
      }
    }
    return { out, count };
  });
  handTexts += r.count;
  for (const p of r.out) handProblems.push(`${n}-card hand: ${p}`);
}
await browser.close();
server.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
if (handProblems.length) {
  console.error(`cardtext: ${handProblems.length} hand problems:`);
  for (const p of handProblems.slice(0, 60)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`v4 cardtext: hands of 5, 7, 9 and 11 cards: ${handTexts} visible text elements, none partly covered — ok`);
if (result.problems.length) {
  console.error(`cardtext: ${result.problems.length} problems in ${result.cards} card renders:`);
  for (const p of result.problems.slice(0, 80)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`v4 cardtext: ${result.cards} card renders (every card, every size), ${result.texts} text elements — no overflow, overlap, text outside the frame or text under 10 px — ok`);
