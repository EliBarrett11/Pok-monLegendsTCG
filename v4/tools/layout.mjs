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
  // UX3: any element holding text whose content overflows its own box (where it doesn't scroll).
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || el.closest('svg')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.display === 'contents' || scrolls(el, 'x') || scrolls(el, 'y')) continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) out.push(`${name(el)}'s text overflows its box (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`);
  }
  return [...new Set(out)];
}


// --- The scenarios -------------------------------------------------------------------------

const settle = (p, ms = 400) => p.waitForTimeout(ms);
const v4 = (p, fn, arg) => p.evaluate(fn, arg);
const to = (p, round) => v4(p, (r) => window.__v4.fastForward(r), round);
// G1: an Objective point moment, caught mid-beat: a defeat that gives Misty's Objective its next point
// (or its final one), played at Normal speed, then the check runs while the moment is on screen.
async function objectiveMoment(p, progress, final = false) {
  await v4(p, async ({ progress }) => {
    const C = await import('/v4/src/engine/cards.js');
    window.__v4.set((s) => {
      const mon = (id, level, extra) => ({ ...C.pokemonAt(id, level), uid: `om-${id}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
      for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
      s.players.player.row[2] = mon('growlithe', 6);
      s.players.ai.row[2] = mon('ponyta', 2, { currentStrength: 1, spent: true });
      s.players.ai.hand = [];
      const t = s.players.player.trainers.find((x) => x.objective.kind === 'defeat');
      t.progress = progress;
      t.complete = false;
      s.reactWindow = null;
      s.turn = 'player';
    });
    window.__v4.setSpeed('normal');
    window.__v4.show({ type: 'attack', who: 'player', from: 2, target: { kind: 'pokemon', space: 2 } });
  }, { progress });
  await p.waitForSelector('.v4-objpanel', { timeout: 30000 });
  await p.waitForTimeout(final ? 4800 : 1800);   // mid-beat at timescale 4 (the final point plays longer)
}
const centerOf = (p, sel) => p.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
// UX3: move the pointer over an element (previews follow the pointer), or drag between two.
async function hover(p, sel) { const c = await centerOf(p, sel); await p.mouse.move(c.x - 20, c.y - 20); await p.mouse.move(c.x, c.y, { steps: 3 }); await settle(p, 150); }
async function drag(p, from, toSel, release = true) {
  const a = await centerOf(p, from);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(a.x + 20, a.y - 30, { steps: 3 });
  const b = await centerOf(p, toSel);
  await p.mouse.move(b.x, b.y, { steps: 6 });
  if (release) await p.mouse.up();
  await settle(p, 150);
}
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
  // G1: the PokéMart card (its last Stock pip pulsing), Sold out, End turn blocked with its reason, an
  // Objective point moment mid-beat (and the final point's version), and a React window on a resolving Strat.
  'mart-card': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s) => { s.players.player.dollars = 4; const c = s.mart.onSale[0] ?? s.mart.pool[0]; s.mart.onSale = [c]; s.mart.stock = Math.min(c.stock, 5); s.mart.soldOut = null; }));
  },
  'mart-long': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s) => {
      s.players.player.dollars = 1;
      const all = [...s.mart.pool, ...s.mart.onSale.filter(Boolean)];
      const c = all.find((x) => x.id === 'choice-band');
      s.mart.pool = all.filter((x) => x !== c);
      s.mart.onSale = [c];
      s.mart.stock = c.stock;
      s.mart.soldOut = null;
    }));
  },
  'mart-sold-out': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s) => { if (s.mart.onSale[0]) s.mart.pool.push(s.mart.onSale[0]); s.mart.onSale = [null]; s.mart.stock = 0; s.mart.soldOut = { by: 'ai', armed: true }; }));
  },
  'pass-blocked': async (p) => {
    await to(p, 4);
    await v4(p, async () => {
      const C = await import('/v4/src/engine/cards.js');
      window.__v4.set((s) => {
        const mon = (id, level, extra) => ({ ...C.pokemonAt(id, level), uid: `pb-${id}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
        for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
        s.players.player.row[3] = mon('charmander', 7);
        s.players.ai.row[5] = mon('magikarp', 4, { spent: true });
        s.reactWindow = null;
        s.turn = 'player';
      });
    });
  },
  'objective-moment': async (p) => {
    await to(p, 4);
    await objectiveMoment(p, 3);
  },
  'objective-final': async (p) => {
    await to(p, 4);
    await objectiveMoment(p, 7, true);
  },
  'react-strat': async (p) => {
    await to(p, 4);
    await v4(p, async () => {
      const C = await import('/v4/src/engine/cards.js');
      window.__v4.set((s) => {
        const mon = (id, level, extra) => ({ ...C.pokemonAt(id, level), uid: `rs-${id}`, currentStrength: C.pokemonAt(id, level).strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
        for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
        s.players.player.row[2] = mon('squirtle', 6);
        s.players.ai.row[6] = mon('growlithe', 5);
        s.players.player.hand = [...s.players.player.hand.slice(0, 5), { ...C.cardAtRound('recover', s.round), uid: 'rs-recover' }, { ...C.cardAtRound('ember', s.round), uid: 'rs-ember' }];
        s.players.player.baseEnergy = 6;
        s.strats = [{ uid: 'strat-rs', owner: 'ai', card: { ...C.commandDef('ember'), uid: 'rs-card' }, target: { who: 'player', space: 2, uid: 'rs-squirtle' }, targetName: 'Blastoise', playedRound: s.round }];
        s.reactWindow = null;
        s.turn = 'player';
        s.passesInARow = 0;
      });
      window.__v4.apply({ type: 'pass', who: 'player' });
    });
  },
  'log-drawer': async (p) => {
    await to(p, 6);
    await v4(p, () => window.__v4.set((s, ui) => { ui.drawer = 'log'; }));
  },
  // UX3: an attack preview with a hit-back (hovering a Ready target), a Command drag over a target, the
  // mode picker, a Location placement preview, the key list and a confirmation.
  'attack-preview': async (p) => {
    await to(p, 4);
    await v4(p, () => window.__v4.set((s, ui) => {
      for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
      s.locations = [];
      const mk = (id, name, at, sp, a, st) => ({ id, cardType: 'Pokémon', name, art: id, series: 'Mid', type: 'Fire', attackType: at, speed: sp, strengthType: 'Hitpoints', level: 6, cost: 3, attack: a, strength: st, currentStrength: st, spent: false, uid: `x${name}`, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, text: '' });
      s.players.player.row[2] = mk('charizard', 'Charizard', 'Special', 'Swift', 8, 9);
      s.players.ai.row[4] = mk('gyarados', 'Gyarados', 'Physical', 'Swift', 9, 7);
      ui.select = { kind: 'attack', from: 2 };
    }));
    await hover(p, '.v4-row.opponent .v4-space[data-space="4"]');
  },
  'command-drag': async (p) => {
    await to(p, 4);
    await v4(p, () => { const L = window.__v4; L.set((s) => { s.players.player.baseEnergy = 9; if (!s.players.ai.row.some(Boolean)) s.players.ai.row[4] = { ...s.players.player.row.find(Boolean), uid: 'enemy' }; }); L.giveCard('ember'); });
    const uid = await v4(p, () => window.__v4.state.players.player.hand.at(-1).uid);
    const enemy = await v4(p, () => window.__v4.state.players.ai.row.findIndex(Boolean));
    await drag(p, `.v4-hand [data-uid="${uid}"]`, `.v4-row.opponent .v4-space[data-space="${enemy}"]`, false);
  },
  'mode-picker': async (p) => {
    await to(p, 4);
    await v4(p, () => { const L = window.__v4; L.set((s) => { s.players.player.baseEnergy = 9; if (!s.players.ai.row.some(Boolean)) s.players.ai.row[4] = { ...s.players.player.row.find(Boolean), uid: 'enemy' }; }); const uid = L.giveCard('ember'); L.set((s, ui) => { const sp = s.players.ai.row.findIndex(Boolean); ui.select = { kind: 'hand', uid }; ui.picker = { uid, target: { who: 'ai', space: sp }, modes: ['adapt', 'strat'], x: 700 + sp * 60, y: 300 }; }); });
  },
  'place-preview': async (p) => {
    await to(p, 3);
    await v4(p, () => { const L = window.__v4; L.set((s) => { s.locations = []; }); const uid = L.giveCard('mt-ember'); L.set((s, ui) => { ui.select = { kind: 'hand', uid }; }); });
    await hover(p, '.v4-row.player .v4-space[data-space="3"]');
  },
  keys: async (p) => { await to(p, 3); await v4(p, () => window.__v4.set((s, ui) => { ui.keys = true; })); },
  confirm: async (p) => { await to(p, 3); await v4(p, () => window.__v4.set((s, ui) => { ui.confirm = { kind: 'pass', text: 'End turn with 3 Energy unused?', action: { type: 'pass', who: 'player' }, dontAsk: false }; })); },
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
        await page.goto(`${BASE}?debug&seed=7&speed=instant&timescale=4`);   // (timescale: G1's mid-beat scenarios)
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
