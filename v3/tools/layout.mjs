// The "nothing clipped" check for v3 (V3-0): every piece of information and every action is
// visible and usable without scrolling at 1920×1080, 1366×768 and 1280×720. Copied from
// v2/tools/layout.mjs (the same check, with v3's class names and screens). Run after every v3 step:
//
//   node v3/tools/layout.mjs [--shots=dir] [--only=scenario,…] [--sizes=1920x1080,…]
//
// It serves the repository itself, opens v3 in Chromium (Playwright, pre-installed) with ?debug,
// and goes through: the mulligan, Round 1, a mid-match board, a full hand, choosing a space,
// choosing an attack target, a Move's breakpoints and its target, a Supporter's Release, an
// Overexerted Energy display, the Regional Championship and the end screen. It fails if the page
// scrolls, or if a button, card or text block is outside the window, clipped by its container
// (with no scrollbar of its own) or covered by another element. Exit code 1 on any failure.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const SIZES = (opt('sizes') ?? '1920x1080,1366x768,1280x720').split(',').map((s) => s.split('x').map(Number));
const ONLY = opt('only')?.split(',');
const SHOTS = opt('shots');

// --- A static server for the repository --------------------------------------------------------

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${server.address().port}/v3/`;

// --- The check, in the page ------------------------------------------------------------------

function check() {
  const out = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const doc = document.scrollingElement;
  if (doc.scrollHeight > vh + 1 || doc.scrollWidth > vw + 1) out.push(`the page scrolls (${doc.scrollWidth}×${doc.scrollHeight} in ${vw}×${vh})`);
  const stage = document.getElementById('stage');
  const SKIP = 'canvas, [aria-hidden="true"]';
  const visible = (el) => {
    if (el.closest(SKIP)) return false;
    for (let a = el; a && a !== stage; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const name = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const text = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  const scrolls = (el, axis) => {
    const cs = getComputedStyle(el);
    const o = axis === 'y' ? cs.overflowY : cs.overflowX;
    return (o === 'auto' || o === 'scroll');
  };
  const cuts = (el, axis) => {
    const cs = getComputedStyle(el);
    const o = axis === 'y' ? cs.overflowY : cs.overflowX;
    return o === 'hidden' || o === 'clip';
  };
  // A modal open: only it (and what's in it) is checked; the board behind is covered on purpose.
  const modal = [...document.querySelectorAll('.v3-ask, [role="dialog"]')].filter(visible).at(-1);
  const scope = modal ?? stage;
  const ACTIONS = 'button, input, select, a[href], [data-action], [data-rel], [data-pay], .v3-mon.can-attack, .v3-hand [data-uid]';
  const ITEMS = `${ACTIONS}, .v3-card, p, h1, h2, h3, h4, li, label, .v3-label, .v3-medal`;
  for (const el of scope.querySelectorAll(ITEMS)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // Inside a scrolling frame: usable by scrolling that frame (checked as the frame itself).
    let framed = false;
    for (let a = el.parentElement; a && a !== stage; a = a.parentElement) {
      const ar = a.getBoundingClientRect();
      const outY = r.top < ar.top - 1 || r.bottom > ar.bottom + 1;
      const outX = r.left < ar.left - 1 || r.right > ar.right + 1;
      if ((outY && scrolls(a, 'y')) || (outX && scrolls(a, 'x'))) { framed = true; break; }
      if ((outY && cuts(a, 'y')) || (outX && cuts(a, 'x'))) {
        const shown = Math.max(0, Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top)) * Math.max(0, Math.min(r.right, ar.right) - Math.max(r.left, ar.left));
        // Hand cards fan and overlap by design; a card is fine while most of it shows.
        if (shown < r.width * r.height * 0.6) out.push(`${name(el)} is clipped by ${name(a)}`);
        framed = true;
        break;
      }
    }
    if (!framed && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)) out.push(`${name(el)} is outside the window (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
    // An action must be mostly clickable: sample a 5×3 grid of points.
    if (el.matches(ACTIONS) && !framed) {
      let hit = 0;
      let total = 0;
      let cover = null;
      for (let i = 1; i <= 5; i++) {
        for (let j = 1; j <= 3; j++) {
          const x = r.left + (r.width * i) / 6;
          const y = r.top + (r.height * j) / 4;
          if (x < 0 || y < 0 || x > vw || y > vh) continue;
          total += 1;
          const at = document.elementFromPoint(x, y);
          if (at && (at === el || el.contains(at) || at.contains(el))) hit += 1;
          else cover ??= at;
        }
      }
      const need = el.closest('.v3-hand') ? 0.2 : 0.5;
      if (total && hit / total < need) out.push(`${name(el)} is covered by ${cover ? name(cover) : 'something'} (${hit}/${total} points clickable)`);
    }
  }
  // Containers that cut off their own content (no scrollbar of their own).
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || el.matches('.v3-art, .v3-loc-art, .v3-mat, i, img, svg, svg *')) continue;
    if (!el.textContent.trim() && !el.querySelector('button, input, select, .v3-card')) continue;
    if (cuts(el, 'y') && el.scrollHeight > el.clientHeight + 2) out.push(`${name(el)} cuts off its content (${el.scrollHeight}px in ${el.clientHeight}px)`);
    else if (cuts(el, 'x') && el.scrollWidth > el.clientWidth + 2) out.push(`${name(el)} cuts off its content sideways (${el.scrollWidth}px in ${el.clientWidth}px)`);
    else if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} is cut short with "…"`);
  }
  return [...new Set(out)];
}


// --- The scenarios -------------------------------------------------------------------------

const settle = (p, ms = 400) => p.waitForTimeout(ms);
const v3 = (p, fn, arg) => p.evaluate(fn, arg);
const to = (p, round) => v3(p, (r) => window.__v3.fastForward(r), round);
const SCENARIOS = {
  mulligan: async () => {},
  round1: async (p) => { await to(p, 1); },
  board: async (p) => { await to(p, 6); },
  'full-hand': async (p) => {
    await to(p, 7);
    await v3(p, () => { const v = window.__v3; for (const id of ['quick-strike', 'study', 'show-off', 'professor', 'rival', 'iron-brute', 'storm-wing', 'mist-warden', 'sprout', 'patch-up']) if (v.state.players.player.hand.length < 10) v.give(id, 5); });
  },
  summon: async (p) => {
    await to(p, 4);
    await v3(p, () => { const v = window.__v3; const uid = v.give('swift-striker', 2); v.set((s, ui) => { s.players.player.energy = 9; ui.select = { kind: 'summon', uid }; }); });
  },
  attack: async (p) => {
    await to(p, 5);
    await v3(p, () => window.__v3.set((s, ui) => {
      const sp = s.players.player.row.findIndex((c) => c);
      if (sp >= 0) { for (const c of [...s.players.player.row, ...s.players.ai.row]) if (c) c.spent = true; s.players.player.row[sp].spent = false; ui.select = { kind: 'attack', from: sp }; }
    }));
  },
  breakpoints: async (p) => { await to(p, 5); await v3(p, () => { const v = window.__v3; const uid = v.give('quick-strike'); v.set((s, ui) => { s.players.player.energy = 4; ui.ask = { kind: 'move', uid }; }); }); },
  'move-target': async (p) => {
    await to(p, 5);
    await v3(p, () => { const v = window.__v3; const uid = v.give('quick-strike'); v.set((s, ui) => { const c = s.players.player.hand.find((x) => x.uid === uid); ui.select = { kind: 'target', spec: c.breakpoints[1].target, tag: 'Quick Strike · 3 Energy', text: c.breakpoints[1].text, action: { type: 'playMove', who: 'player', uid, pay: 3 } }; }); });
  },
  release: async (p) => { await to(p, 5); await v3(p, () => { const v = window.__v3; const uid = v.give('rival'); v.set((s, ui) => { ui.ask = { kind: 'release', uid, chosen: [] }; }); }); },
  overexerted: async (p) => { await to(p, 3); await p.click('[data-over="2"]'); },
  championship: async (p) => { await to(p, 10); },
  'game-over': async (p) => { await to(p, 30); },
};

// --- Run ------------------------------------------------------------------------------------

const browser = await chromium.launch();
let failures = 0;
for (const [w, h] of SIZES) {
  for (const [id, setup] of Object.entries(SCENARIOS)) {
    if (ONLY && !ONLY.includes(id)) continue;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${BASE}?debug&seed=7`);
    await settle(page, 600);
    try {
      await setup(page);
      await settle(page, 500);
      const found = [...errors.map((m) => `page error: ${m}`), ...await page.evaluate(check)];
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/layout-${id}-${w}x${h}.png` });
      if (found.length) {
        failures += found.length;
        console.log(`✗ ${id} at ${w}×${h}:`);
        for (const f of found) console.log(`    ${f}`);
      } else console.log(`✓ ${id} at ${w}×${h}`);
    } catch (err) {
      failures += 1;
      console.log(`✗ ${id} at ${w}×${h}: ${err.message.split('\n')[0]}`);
    }
    await page.close();
  }
}
await browser.close();
server.close();
console.log(failures ? `layout: ${failures} problem${failures === 1 ? '' : 's'}` : 'layout: ok (nothing clipped, covered or off-screen)');
process.exit(failures ? 1 : 0);
