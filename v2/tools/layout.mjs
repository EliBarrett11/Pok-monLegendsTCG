// The "nothing clipped" check (v2 Feedback A; docs/v2-design.md 7b): every piece of
// information and every action is visible and usable in full screen without scrolling at
// 1920×1080, 1366×768 and 1280×720. Run after every v2 step:
//
//   node v2/tools/layout.mjs [--shots=dir] [--only=scenario,…] [--sizes=1920x1080,…]
//
// It serves the repository itself (no other server needed), opens v2 in Chromium (Playwright,
// pre-installed) with ?debug, and for each window size goes through: the setup screen, the
// deck builder, a mid-match board (and one with a full hand and every panel busy), every
// dialog type (Empowered summon, the Growth amount, card picks, the space picker, the Release
// payment, an Item, a Trainer, the Trainer Point step, Tracey's revealed cards), a Strategy Card
// and a Pokémon with their ▲ previews, choosing targets, the Codex (a Pokémon, the rules), the end screen,
// the hot-seat deck pick and pass screen, and the online lobby screens. It fails if:
//   - the page itself scrolls;
//   - a button, input, select, card or text block is outside the visible stage;
//   - one is clipped by a container that cuts it off (overflow hidden, no scrollbar of its
//     own), or a container cuts off its own content (scrollHeight > clientHeight without a
//     scrollbar);
//   - an action is covered by another element (most of it can't be clicked).
// Lists that can grow scroll inside their own frame (the deck builder's list, the log): what
// they hold may be scrolled out of view, but the frame itself must be visible.
// Exit code 1 on any failure (each listed), 0 when clean.
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
const BASE = `http://127.0.0.1:${server.address().port}/v2/`;

// --- The check, in the page ------------------------------------------------------------------

function check() {
  const out = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const doc = document.scrollingElement;
  if (doc.scrollHeight > vh + 1 || doc.scrollWidth > vw + 1) out.push(`the page scrolls (${doc.scrollWidth}×${doc.scrollHeight} in ${vw}×${vh})`);
  const stage = document.getElementById('stage');
  const SKIP = '.v2-fx, .v2-toasts, canvas, .weather-layer, .v2-net, [aria-hidden="true"]';
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
  const modal = [...document.querySelectorAll('.v2-ask, .v2-over, .v2-builder, .v2-db, [role="dialog"]')].filter(visible).at(-1);
  const scope = modal ?? stage;
  const ACTIONS = 'button, input, select, a[href], [data-action], [data-deck], [data-pick], [data-rel], [data-setup-deck], [data-setup-mode], [data-trainer], .v2-card.selectable, .v2-hand [data-uid]';
  const ITEMS = `${ACTIONS}, .v2-card, p, h1, h2, h3, h4, li, label, .v2-name, .v2-hint, .v2-label, .v2-score, .v2-big`;
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
      const need = el.closest('.v2-hand') ? 0.2 : 0.5;
      if (total && hit / total < need) out.push(`${name(el)} is covered by ${cover ? name(cover) : 'something'} (${hit}/${total} points clickable)`);
    }
  }
  // Containers that cut off their own content (no scrollbar of their own).
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || el.matches('.v2-art, .v2-loc-art, .v2-mat, i, img, svg, svg *')) continue;
    if (!el.textContent.trim() && !el.querySelector('button, input, select, .v2-card')) continue;
    if (cuts(el, 'y') && el.scrollHeight > el.clientHeight + 2) out.push(`${name(el)} cuts off its content (${el.scrollHeight}px in ${el.clientHeight}px)`);
    else if (cuts(el, 'x') && el.scrollWidth > el.clientWidth + 2) out.push(`${name(el)} cuts off its content sideways (${el.scrollWidth}px in ${el.clientWidth}px)`);
    else if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} is cut short with "…"`);
  }
  return [...new Set(out)];
}

// --- The scenarios -------------------------------------------------------------------------

const settle = (p, ms = 400) => p.waitForTimeout(ms);
const v2 = (p, fn, arg) => p.evaluate(fn, arg);
async function match(p, round = 5) {
  await v2(p, () => window.__v2.startAiMatch());
  await settle(p, 200);
  await v2(p, (r) => window.__v2.fastForward(r), round);
  await settle(p);
}
const SCENARIOS = {
  setup: async () => {},
  deckbuilder: async (p) => { await p.click('[data-setup="deck"]'); },
  board: async (p) => { await match(p, 5); },
  'board-busy': async (p) => {
    await match(p, 7);
    await v2(p, () => {
      const v = window.__v2;
      for (const id of ['f-growlithe', 'f-ember', 'f-fire-blast', 'f-chili', 'p-potion', 'f-blaine', 'f-mt-ember', 'f-magby', 'f-heat-wave', 'f-firebreather']) v.give(id);
      v.set((s) => { s.players.player.recognition = 88; s.players.ai.recognition = 88; s.players.player.burn = 6; s.players.player.bag = ['p-potion', 'p-revive', 'p-ether', 'p-x-attack', 'p-escape-rope', 'p-exp-share'].map((id) => v.make(id)); });
    });
  },
  empower: async (p) => {
    await match(p, 5);
    await v2(p, () => { const v = window.__v2; const uid = v.give('f-growlithe'); v.set((s, ui) => { s.players.player.energy = 10; ui.empowerAsk = { uid, space: s.players.player.row.indexOf(null) }; }); });
  },
  // Feedback B: a Strategy Card selected with its ▲ preview; a Pokémon's ▲ preview; choosing
  // targets (C) with a numbered badge; the Codex on a Pokémon and on the searchable rules;
  // Tracey's revealed cards.
  strategy: async (p) => {
    await match(p, 5);
    await v2(p, () => { const v = window.__v2; const uid = v.give('w-hydro-pump'); v.set((s, ui) => { s.players.player.energy = 4; ui.strategy = uid; ui.preview = { uid, offset: 1 }; }); });
  },
  preview: async (p) => {
    await match(p, 3);
    await v2(p, () => { const v = window.__v2; const uid = v.give('w-horsea'); v.set((s, ui) => { s.players.player.energy = 9; ui.summon = uid; ui.preview = { uid, offset: 2 }; }); });
  },
  choose: async (p) => {
    await match(p, 6);
    await v2(p, () => {
      const v = window.__v2;
      const uid = v.give('f-ember');
      v.set((s, ui) => {
        s.players.player.energy = 4;
        const card = s.players.player.hand.find((c) => c.uid === uid);
        const bp = card.breakpoints[1];
        const first = s.players.ai.row.findIndex(Boolean);
        ui.pending = { action: { type: 'playStrategy', who: 'player', uid, pay: bp.cost }, spec: bp.target, label: `Ember (4): ${bp.text}`, chosen: first >= 0 ? [{ who: 'ai', kind: 'pokemon', space: first }] : [], extra: [], ops: bp.ops, ctx: {}, tag: 'Ember · 4 Energy' };
      });
    });
    await p.hover('.v2-row.opponent .v2-space.effect-target:not(.chosen) .v2-card').catch(() => {});
  },
  codex: async (p) => { await match(p, 6); await p.click('.v2-row .v2-card', { button: 'right' }); },
  'codex-rules': async (p) => { await match(p, 6); await p.click('[data-codex-open="rules"]'); await p.fill('.v2-codex-search', 'burn'); },
  tracey: async (p) => {
    await match(p, 5);
    await v2(p, () => window.__v2.set((s) => { s.choices.push({ who: 'player', kind: 'pick', name: 'Tracey', op: { op: 'lookTop', n: 4, take: 2 }, take: 2, uids: s.players.player.drawPile.slice(0, 4).map((c) => c.uid), text: '' }); }));
  },
  amount: async (p) => { await match(p, 5); await v2(p, () => { const v = window.__v2; const uid = v.give('g-solar-beam'); v.set((s, ui) => { ui.ask = { kind: 'amount', uid, pay: 4, x: 7, max: 10, label: 'Solar Beam' }; }); }); },
  pick: async (p) => {
    await match(p, 5);
    await v2(p, () => {
      const v = window.__v2;
      for (const id of ['f-growlithe', 'f-ponyta', 'f-mankey', 'f-houndour', 'f-magby', 'f-sneasel', 'f-charmander', 'f-duskull', 'f-absol', 'f-growlithe', 'f-ponyta', 'f-mankey']) v.give(id, 'discard');
      v.set((s, ui) => { ui.ask = { kind: 'pick', action: { type: 'pass', who: 'player' }, op: { op: 'returnFromDiscard', filter: 'pokemon' }, n: 2, chosen: [], label: 'Return two Pokémon from your Discard Pile' }; });
    });
  },
  space: async (p) => { await match(p, 5); await v2(p, () => window.__v2.set((s, ui) => { s.players.player.row = s.players.player.row.map(() => null); ui.ask = { kind: 'space', label: 'Escape Rope' }; })); },
  release: async (p) => {
    await match(p, 5);
    await v2(p, () => {
      const v = window.__v2;
      const uid = v.give('f-chili');
      for (const id of ['f-growlithe', 'f-ember', 'f-fire-blast', 'p-potion', 'f-blaine', 'f-mt-ember', 'f-magby', 'f-heat-wave', 'f-firebreather', 'f-ponyta']) v.give(id);
      v.set((s, ui) => { ui.ask = { kind: 'release', uid, chosen: [] }; });
    });
  },
  item: async (p) => { await match(p, 5); await v2(p, () => { const v = window.__v2; const uid = v.give('p-potion'); v.set((s, ui) => { ui.ask = { kind: 'item', uid }; }); }); },
  trainer: async (p) => {
    await match(p, 5);
    await v2(p, () => { const v = window.__v2; v.set((s, ui) => { const t = { ...v.make('f-blaine'), space: 2, points: 4, abilityRound: 0 }; s.players.player.trainers.push(t); ui.ask = { kind: 'trainer', uid: t.uid }; }); });
  },
  assign: async (p) => {
    await match(p, 5);
    await v2(p, () => {
      const v = window.__v2;
      v.set((s) => {
        s.players.player.trainers = ['f-blaine', 'f-kabu', 'f-flannery'].map((id, i) => ({ ...v.make(id), space: i * 3, points: i * 2, abilityRound: 0 }));
        s.players.player.trainerPoints = 3;
        s.phase = 'assign';
        s.assign = { player: null, ai: null };
      });
    });
  },
  'end-victory': async (p) => { await match(p, 5); await v2(p, () => window.__v2.set((s) => { s.phase = 'gameOver'; s.winner = 'player'; s.turn = null; s.result = { winner: 'player', reason: 'target', round: s.round, recognition: { player: 90, ai: 41 } }; })); },
  'hotseat-pick': async (p) => { await p.goto(`${BASE}?hotseat&debug`); await settle(p); },
  'hotseat-pass': async (p) => { await p.goto(`${BASE}?hotseat&debug`); await settle(p); await p.click('[data-deck="fire"]'); },
  'online-waiting': async (p) => { await v2(p, () => window.__v2.lobby({ kind: 'waiting', code: 'HMQXT', link: 'https://elibarrett11.github.io/Pok-monLegendsTCG/v2/?join=HMQXT' })); },
  'online-decks': async (p) => { await v2(p, () => window.__v2.lobby({ kind: 'decks', friendLocked: true })); },
  'online-error': async (p) => { await v2(p, () => window.__v2.lobby({ kind: 'error', message: 'Could not reach the connection server. Check your internet connection and try again.', retry: 'host', canJoin: true })); },
  'online-mismatch': async (p) => { await v2(p, () => window.__v2.lobby({ kind: 'mismatch', mine: 'V9 — hot-seat and online', theirs: 'V8 — presentation' })); },
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
    await page.addInitScript(() => { try { localStorage.setItem('plt-speed-v2', 'instant'); } catch { /* fine */ } });
    await page.goto(`${BASE}?debug&seed=7&novfx`);
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
