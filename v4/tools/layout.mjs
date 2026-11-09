// Copied from v3/tools/layout.mjs (the nothing-clipped check), with v4's screens.
// The "nothing clipped" check for v4 (F1): every piece of information and every action is
// visible and usable without scrolling at 1920×1080, 1366×768 and 1280×720. Copied from
// v2/tools/layout.mjs (the same check, with v4's class names and screens). Run after every v4 step:
//
//   node v4/tools/layout.mjs [--shots=dir] [--only=scenario,…] [--sizes=1920x1080,…]
//
// It serves the repository itself, opens v4 in Chromium (Playwright, pre-installed) with ?debug,
// and goes through: the mulligan, Round 1, a mid-match board, a full hand, choosing a space,
// choosing an attack target, a Move's breakpoints and its targets (two, or a Location), a Supporter's Release, an
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
const BASE = `http://127.0.0.1:${server.address().port}/v4/`;

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
  const modal = [...document.querySelectorAll('.v4-ask, [role="dialog"]')].filter(visible).at(-1);
  const scope = modal ?? stage;
  const ACTIONS = 'button, input, select, a[href], [data-action], [data-rel], [data-pay], .v4-mon.can-attack, .v4-hand [data-uid]';
  const ITEMS = `${ACTIONS}, .v4-card, p, h1, h2, h3, h4, li, label, .v4-label, .v4-medal`;
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
      const need = el.closest('.v4-hand') ? 0.2 : 0.5;
      if (total && hit / total < need) out.push(`${name(el)} is covered by ${cover ? name(cover) : 'something'} (${hit}/${total} points clickable)`);
    }
  }
  // Containers that cut off their own content (no scrollbar of their own).
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || el.matches('.v4-art, .v4-loc-art, .v4-mat, i, img, svg, svg *')) continue;
    if (!el.textContent.trim() && !el.querySelector('button, input, select, .v4-card')) continue;
    if (cuts(el, 'y') && el.scrollHeight > el.clientHeight + 2) out.push(`${name(el)} cuts off its content (${el.scrollHeight}px in ${el.clientHeight}px)`);
    else if (cuts(el, 'x') && el.scrollWidth > el.clientWidth + 2) out.push(`${name(el)} cuts off its content sideways (${el.scrollWidth}px in ${el.clientWidth}px)`);
    else if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} is cut short with "…"`);
  }
  return [...new Set(out)];
}


// --- The scenarios -------------------------------------------------------------------------

const settle = (p, ms = 400) => p.waitForTimeout(ms);
const v4 = (p, fn, arg) => p.evaluate(fn, arg);
const to = (p, round) => v4(p, (r) => window.__v4.fastForward(r), round);
const SCENARIOS = {
  mulligan: async () => {},
  round1: async (p) => { await to(p, 1); },
  board: async (p) => { await to(p, 5); },
  'hand-selected': async (p) => { await to(p, 3); await v4(p, () => window.__v4.set((s, ui) => { ui.select = { kind: 'hand', uid: s.players.player.hand[0].uid }; })); },
  attack: async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s, ui) => {
      const sp = s.players.player.row.findIndex((c) => c);
      if (sp >= 0) { for (const c of [...s.players.player.row, ...s.players.ai.row]) if (c) c.spent = true; s.players.player.row[sp].spent = false; ui.select = { kind: 'attack', from: sp }; }
    }));
  },
  // F2: placed Locations (bold tiles, panels, Weather) and choosing where to place one.
  locations: async (p) => {
    await to(p, 4);
    await v4(p, () => { const L = window.__v4; L.set((s) => { s.locations = []; }); L.place('player', 'cerulean-cape', 0); L.place('ai', 'mt-ember', 2); L.place('player', 'route-119', 5); });
  },
  'place-location': async (p) => {
    await to(p, 3);
    await v4(p, () => { const L = window.__v4; L.set((s) => { s.locations = []; }); L.place('ai', 'lake-of-rage', 3); const uid = L.giveLocation('mt-ember'); L.set((s, ui) => { ui.select = { kind: 'hand', uid }; }); });
  },
  // F3: the Command mode chooser, a React window, pending Strats, the Supporter Release screen.
  command: async (p) => {
    await to(p, 4);
    await v4(p, () => { const L = window.__v4; const uid = L.giveCard('rock-slide'); L.set((s, ui) => { ui.select = { kind: 'hand', uid }; }); });
  },
  react: async (p) => {
    await to(p, 4);
    await v4(p, () => {
      const L = window.__v4;
      L.giveCard('recover');
      L.giveCard('ember');
      L.set((s) => {
        s.reactWindow = null;
        s.players.player.baseEnergy = 5;
        const from = s.players.ai.row.findIndex((c) => c);
        const to = s.players.player.row.findIndex((c) => c);
        if (from >= 0 && to >= 0) {
          s.reactWindow = { reactor: 'player', pending: { type: 'attack', who: 'ai', from, target: { kind: 'pokemon', space: to }, attackerUid: s.players.ai.row[from].uid, targetUid: s.players.player.row[to].uid, text: `The Opponent's ${s.players.ai.row[from].name} is attacking your ${s.players.player.row[to].name}` } };
        }
      });
    });
  },
  strats: async (p) => {
    await to(p, 5);
    await v4(p, () => {
      const L = window.__v4;
      L.set((s) => {
        const ai = s.players.ai.row.findIndex((c) => c);
        const me = s.players.player.row.findIndex((c) => c);
        const mk = (id) => ({ id, name: id === 'ember' ? 'Ember' : 'Recover', cardType: 'Command', art: id, target: id === 'ember' ? 'enemy' : 'own', modes: { adapt: { cost: 2, op: id === 'ember' ? 'damage' : 'heal', amount: 3 }, react: { cost: 1, op: 'damage', amount: 2 }, strat: { cost: 3, op: id === 'ember' ? 'damage' : 'heal', amount: 5 } } });
        if (ai >= 0) s.strats.push({ uid: 's1', owner: 'player', card: mk('ember'), target: { who: 'ai', space: ai, uid: s.players.ai.row[ai].uid }, targetName: s.players.ai.row[ai].name, playedRound: s.round });
        if (me >= 0) s.strats.push({ uid: 's2', owner: 'ai', card: mk('ember'), target: { who: 'player', space: me, uid: s.players.player.row[me].uid }, targetName: s.players.player.row[me].name, playedRound: s.round });
      });
    });
  },
  supporter: async (p) => {
    await to(p, 3);
    await v4(p, () => { const L = window.__v4; const uid = L.giveCard('brock'); L.set((s, ui) => { ui.select = { kind: 'supporter', uid, release: [s.players.player.hand[0].uid] }; }); });
  },
  // F4: Items, the PokéMart and Bags, Trainer areas, a Partner, the buy and Trainer choosers.
  items: async (p) => {
    await to(p, 5);
    await v4(p, () => {
      const L = window.__v4;
      L.giveCard('potion');
      L.giveCard('misty');
      L.set((s) => {
        const mk = (id, name, price, itemType, text) => ({ id, name, cardType: 'Item', art: id, price, itemType, op: 'heal', amount: 1, text, uid: `bag-${id}-${Math.random()}` });
        s.players.player.bag = [mk('leftovers', 'Leftovers', 3, 'Held', 'Held: heal 1 at each Breakfast'), mk('oran-berry', 'Oran Berry', 1, 'Consumed', 'Heal 2'), mk('charcoal', 'Charcoal', 2, 'Held', 'Held: +1 Attack')];
        s.players.ai.bag = [mk('potion', 'Potion', 2, 'Consumed', 'Heal 3'), mk('mystic-water', 'Mystic Water', 2, 'Held', 'Held: +2 Strength')];
        s.players.player.dollars = 4;
        const tr = (who, id, name, partner, text, need, progress, complete = false) => ({ uid: `tr-${id}`, name, complete, card: { id, name, art: id, partner: { name: partner, art: partner.toLowerCase(), type: 'Water', attackType: 'Special', speed: 'Swift', strengthType: 'Hitpoints', level: 8, attack: 8, strength: 10, text: '' } }, objective: { kind: 'defeat', need, text, short: text }, progress });
        s.players.player.trainers = [tr('player', 'misty', 'Misty', 'Starmie', 'Defeat 8 Pokémon', 8, 3), tr('player', 'blaine', 'Blaine', 'Ninetales', 'Dominate 5 times', 5, 1)];
        s.players.ai.trainers = [tr('ai', 'misty', 'Misty', 'Starmie', 'Defeat 8 Pokémon', 8, 8, true), tr('ai', 'blaine', 'Blaine', 'Ninetales', 'Dominate 5 times', 5, 2)];
        s.players.ai.waiting = [{ name: 'Starmie', trainer: 'Misty' }];
        const sp = s.players.player.row.findIndex((c) => c);
        if (sp >= 0) Object.assign(s.players.player.row[sp], { partner: true, trainer: 'Misty', held: { name: 'Charcoal', text: 'Held: +1 Attack' } });
      });
    });
  },
  'buy-item': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s, ui) => { s.players.player.dollars = 9; ui.select = { kind: 'buy', from: 'mart', slot: 0 }; }));
  },
  trainer: async (p) => {
    await to(p, 4);
    await v4(p, () => { const L = window.__v4; const uid = L.giveCard('blaine'); L.set((s, ui) => { ui.select = { kind: 'hand', uid }; }); });
  },
  // F5: the Tournament's banner, then the board with the Tournament across all 9 lanes.
  tournament: async (p) => {
    await to(p, 3);
    await v4(p, () => window.__v4.set((s) => { s.round = 9; }));
    await to(p, 10);
  },
  'tournament-board': async (p) => {
    await to(p, 3);
    await v4(p, () => window.__v4.set((s) => { s.round = 9; }));
    await to(p, 10);
    await v4(p, () => window.__v4.set((s, ui) => { ui.seenTournament = s.tournament?.startedRound; const uid = s.players.player.hand.find((c) => c.cardType === 'Location')?.uid; if (uid) ui.select = { kind: 'hand', uid }; }));
  },
  // UX2: the PokéMart drawer and the log drawer.
  'mart-drawer': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s, ui) => { s.players.player.dollars = 4; ui.drawer = 'mart'; }));
  },
  'log-drawer': async (p) => {
    await to(p, 6);
    await v4(p, () => window.__v4.set((s, ui) => { ui.drawer = 'log'; }));
  },
  'big-hand': async (p) => { await to(p, 6); await v4(p, () => { for (let i = 0; i < 6; i++) window.__v4.give('charmander', 7); }); },
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
