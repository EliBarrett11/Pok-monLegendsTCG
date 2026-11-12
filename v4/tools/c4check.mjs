// C4 browser check: node v4/tools/c4check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/). In Chromium at 1920×1080, with real input only (tools/realinput.mjs and pointer moves):
//   - a token on Mt. Ember shows a green ▲ Attack, and hovering it shows its one-line sum;
//   - a damaged token shows red Strength;
//   - in a React window, the target's real Strength is visible on the board (not covered);
//   - hovering each React card changes the board's badge to that card's outcome;
//   - clicking Let it happen removes the window before the next animation frame (no bar, tray, badge or arrow
//     left after the click, while the beat is still to play); the same for a React with a target;
//   - Bubble Beam's React makes the attack deal 2 less;
//   - the Opponent's sealed Strat shows only a card back and its target, then flips face up when it resolves;
//   - no page errors.
// Screenshots: a board with buffed and damaged Pokémon; a React window on an attack that would defeat your
// Pokémon (its badge); the same with Dive hovered; the frame straight after Let it happen; mid-animation after.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { realInput } from './realinput.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'c4-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}?debug&seed=7&speed=instant&timescale=3`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
const io = realInput(page);
const state = () => page.evaluate(() => window.__v4.state);
const idle = () => page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 60000 });
// Records, on the next animation frame after a click, whether any part of the React window is still there.
await page.evaluate(() => {
  window.__afterClick = [];
  document.addEventListener('click', () => {
    const at = performance.now();
    requestAnimationFrame(() => window.__afterClick.push({ at, left: [...document.querySelectorAll('.v4-rtray, .v4-rbadge, .v4-board .v4-arrow, .v4-prompt.react, .v4-ropt')].length, presenting: window.__v4.isPresenting() }));
  }, true);
});

// The staged board (setup only): Round 5; Mt. Ember (the Opponent's) over lanes 3–5, Cerulean Cape and Route 119;
// your Charizard (Level 8, Charcoal, damaged) in Mt. Ember; a damaged Blastoise; a Quagsire with two-digit Strength
// in Route 119 (+2 Rain → Rain 3... Rain 4 with the Cape); the Opponent's Gyarados facing Charizard.
async function stage(extra = '', hand = ['dive', 'surf', 'bubble-beam']) {
  await page.evaluate(async ({ code, hand }) => {
    const C = await import('/v4/src/engine/cards.js');
    const G = await import('/v4/src/engine/game.js');
    window.__v4.setSpeed('instant');
    window.__v4.fastForward(5);
    window.__v4.set((s) => {
      const mon = (id, level, x = {}) => ({ ...C.pokemonAt(id, level), uid: `c4-${id}-${level}`, currentStrength: C.pokemonAt(id, level).strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x });
      const loc = (id, start, owner = 'player') => { const l = C.locationDef(id); return { uid: `loc-${id}`, owner, card: l, id, name: l.name, art: l.art, color: l.color, start, width: l.width, roundsLeft: 2, weather: l.weather, passive: l.passive, placedRound: s.round }; };
      s.tournament = null; s.strats = []; s.reactWindow = null; s.choice = null; s.passesInARow = 0;
      s.locations = [loc('cerulean-cape', 0), loc('mt-ember', 2, 'ai'), loc('route-119', 5)];
      for (const w of ['player', 'ai']) { s.players[w].row = Array(9).fill(null); s.players[w].hand = []; }
      s.players.player.row[3] = mon('charmander', 8, { held: C.itemDef('charcoal'), currentStrength: 4 });
      s.players.player.row[0] = mon('squirtle', 7, { currentStrength: 6 });
      s.players.player.row[6] = mon('wooper', 7);
      s.players.ai.row[3] = mon('magikarp', 8, { spent: false });
      s.players.ai.row[7] = mon('magby', 8);
      s.players.player.hand = hand.map((id) => ({ ...C.cardAtRound(id, s.round), uid: `h-${id}` }));
      s.players.player.baseEnergy = 6;
      s.turn = 'player';
      G.syncBonuses(s);
      // eslint-disable-next-line no-new-func
      new Function('s', 'mon', 'loc', 'C', code)(s, mon, loc, C);
      G.syncBonuses(s);
    });
  }, { code: extra, hand });
  await page.mouse.move(960, 1060);
  await page.waitForTimeout(250);
}
// The Opponent's Gyarados attacks your Charizard (setup: the engine's own attack action for the Opponent).
async function opponentAttacks(space = 3) {
  await page.evaluate((sp) => { window.__v4.set((s) => { s.turn = 'ai'; }); window.__v4.apply({ type: 'attack', who: 'ai', from: 3, target: { kind: 'pokemon', space: sp } }); }, space);
  await page.waitForSelector('.v4-rtray', { timeout: 10000 });
  await page.mouse.move(960, 1060);
  await page.waitForTimeout(200);
}
const tab = (who, sp, which) => `.v4-row.${who === 'ai' ? 'opponent' : 'player'} .v4-space[data-space="${sp}"] .cd-tab.${which}`;

// --- 1. Current stats on the board --------------------------------------------------------------------------
await stage();
const s1 = await state();
const zard = s1.players.player.row[3];
const zAtk = await page.evaluate((q) => { const e = document.querySelector(q); return e && { up: e.classList.contains('cd-up'), n: e.childNodes[0]?.nodeValue, tri: !!e.querySelector('.cd-tri'), color: getComputedStyle(e).color }; }, tab('player', 3, 'atk'));
report('a token on Mt. Ember shows a green ▲ Attack', zAtk?.up && zAtk.tri && zAtk.n === '10' && /139, 227, 138/.test(zAtk.color), JSON.stringify(zAtk));
const zStr = await page.evaluate((q) => { const e = document.querySelector(q); return e && { down: e.classList.contains('cd-down'), n: e.childNodes[0]?.nodeValue, bar: !!e.querySelector('.cd-sbar'), color: getComputedStyle(e).color }; }, tab('player', 3, 'str'));
report('a damaged token shows red Strength (and its maximum as a bar)', zStr?.down && zStr.n === String(zard.currentStrength) && zStr.bar && /255, 122, 102/.test(zStr.color), JSON.stringify(zStr));
const quag = await page.evaluate((q) => document.querySelector(q)?.childNodes[0]?.nodeValue, tab('player', 6, 'str'));
report('a two-digit raised Strength (Quagsire in Rain)', Number(quag) >= 10, quag);
// Hover Charizard's Attack number: its one-line sum under the zoom card.
await page.hover(tab('player', 3, 'atk'));
await page.waitForTimeout(250);
const sum = await page.evaluate(() => document.querySelector('.v4-zoom .v4-zoomsum')?.textContent);
report('hovering a raised stat shows its one-line sum', sum === 'Attack 10 = 8 + 1 Mt. Ember + 1 Charcoal', sum);
await page.mouse.move(960, 1060);
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/c4-1-board-buffed-damaged.png` });

// --- 2. The React window: the board stays readable; badges; hovering each card -------------------------------------
await opponentAttacks();
const s2 = await state();
const target = s2.players.player.row[3];
const visible = await page.evaluate((q) => {
  const e = document.querySelector(q);
  const r = e.getBoundingClientRect();
  const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { n: e.childNodes[0]?.nodeValue, visible: !!at && (e.contains(at) || at === e) };
}, tab('player', 3, 'str'));
report('in a React window, the target\'s real Strength is visible on the board', visible.visible && visible.n === String(target.currentStrength), JSON.stringify(visible));
const letBadge = await page.evaluate(() => [...document.querySelectorAll('.v4-rbadge.on')].map((b) => `${b.dataset.opt}: ${b.innerText.replace(/\s+/g, ' ')}`));
report('the board badge shows "if you let it happen"', letBadge.some((t) => /^none: .*Strength 4 → 0 · Defeated/.test(t)), letBadge.join(' | '));
await page.screenshot({ path: `${OUT}/c4-2-react-window.png` });
const seen = new Set();
for (const uid of ['h-dive', 'h-surf', 'h-bubble-beam']) {
  await page.hover(`.v4-rtray .v4-ropt[data-opt="${uid}"] .v4-rcard`);
  await page.waitForTimeout(150);
  const on = await page.evaluate(() => [...document.querySelectorAll('.v4-rbadge.on')].map((b) => ({ opt: b.dataset.opt, text: b.innerText.replace(/\s+/g, ' ') })));
  const mine = on.length && on.every((b) => b.opt === uid);
  seen.add(on.map((b) => b.text).join('|'));
  report(`hovering ${uid.slice(2)} switches the badge`, mine, on.map((b) => b.text).join(' | '));
  if (uid === 'h-dive') await page.screenshot({ path: `${OUT}/c4-3-react-dive-hovered.png` });
}
report('each React card has its own outcome on the board', seen.size === 3);

// --- 3. Let it happen: the window is gone before the next frame; the beat plays on a clear board --------------------
await page.evaluate(() => window.__v4.setSpeed('normal'));
await page.mouse.move(960, 1060);
await page.evaluate(() => { window.__afterClick = []; });
await io.play({ type: 'decline', who: 'player' });
await page.screenshot({ path: `${OUT}/c4-4-after-let-it-happen.png` });
const after1 = await page.evaluate(() => window.__afterClick.at(-1));
report('Let it happen: nothing of the window left on the next frame, before the beat', after1 && after1.left === 0 && after1.presenting, JSON.stringify(after1));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/c4-5-mid-animation.png` });
report('the beat plays after it', await page.evaluate(() => window.__v4.isPresenting()));
await idle();

// --- 4. A React with a target: Thunderbolt (2 damage to an enemy Pokémon: two to choose from) ----------------------
await stage('s.players.ai.row[7].spent = true;', ['thunderbolt', 'dive']);
await page.evaluate(() => window.__v4.setSpeed('normal'));
await opponentAttacks(6);
await page.evaluate(() => { window.__afterClick = []; });
await page.locator('.v4-rtray [data-react="h-thunderbolt"]').click();
await page.waitForTimeout(60);
const trayStays = await page.evaluate(() => !!document.querySelector('.v4-rtray') && document.querySelectorAll('.v4-space.target').length >= 2);
report('a React with a target: picking it highlights the targets (the tray stays until one is clicked)', trayStays);
await page.locator('.v4-row.opponent .v4-space[data-space="7"].target').click();
const after2 = await page.evaluate(() => window.__afterClick.at(-1));
report('…clicking a target removes the window before the next frame', after2 && after2.left === 0 && after2.presenting, JSON.stringify(after2));
await idle();

// --- 5. Bubble Beam's React: the attack deals 2 less ---------------------------------------------------------------
await stage('', ['bubble-beam']);
await opponentAttacks(6);
const before5 = (await state()).players.player.row[6].currentStrength;
const dmg = await page.evaluate(async () => { const G = await import('/v4/src/engine/game.js'); const s = window.__v4.state; return G.damageOf(s, s.players.ai.row[3]); });
await io.play({ type: 'react', who: 'player', uid: 'h-bubble-beam', target: { who: 'ai', space: 3 } });
await idle();
const after5 = (await state()).players.player.row[6];
const shell = 0;
report('Bubble Beam\'s React: the attack deals 2 less', after5 && before5 - after5.currentStrength === Math.max(0, dmg - 2) - shell, `${before5} − (${dmg} − 2) → ${after5?.currentStrength}`);

// --- 6. The Opponent's sealed Strat: a card back and its target, then face up when it resolves ----------------------
await stage(`s.players.ai.row[3].spent = true;
  s.strats = [{ uid: 'strat-x', owner: 'ai', card: { ...C.cardAtRound('ember', s.round), uid: 'x' }, target: { who: 'player', space: 0, uid: s.players.player.row[0].uid }, targetName: s.players.player.row[0].name, playedRound: s.round }];
  for (const c of s.players.player.row) if (c) c.spent = true;`, ['thunderbolt']);
const sealedInfo = await page.evaluate(() => {
  const e = document.querySelector('.v4-sealed.ai');
  const chip = document.querySelector('.v4-row.player .v4-space[data-space="0"] .cd-chip.strat')?.textContent;
  return e && { hidden: e.classList.contains('hidden'), title: e.title, bg: getComputedStyle(e).backgroundImage, chip };
});
report('the Opponent\'s sealed Strat: a card back, its target, never its name', sealedInfo?.hidden && /card-back/.test(sealedInfo.bg) && !/Ember/.test(`${sealedInfo.title} ${sealedInfo.chip}`) && /Blastoise/.test(sealedInfo.title) && /Sealed Strat/.test(sealedInfo.chip), JSON.stringify(sealedInfo));
await page.hover('.v4-sealed.ai');
await page.waitForTimeout(150);
report('hovering it shows the arrow to its target', await page.evaluate(() => !!document.querySelector('.v4-sarrow.on')));
await page.mouse.click(1240, 1030, { button: 'right' });   // nothing: just move on
const codex = await io.inspect('.v4-sealed.ai', 'c');
const codexText = await page.evaluate(() => document.querySelector('.v4-codex')?.innerText ?? '');
report('its Codex entry says only "a sealed Strat" and its target', codex === 'card:strat-x' && /A sealed Strat/.test(codexText) && !/Ember/.test(codexText), codex);
await io.closeCodex();
// End your turn: the Opponent's Strat resolves at the start of their turn: it flips face up, with your React window.
await io.play({ type: 'pass', who: 'player' });
await page.waitForSelector('.v4-sealed.ai.resolving', { timeout: 20000 });
const flip = await page.evaluate(() => { const e = document.querySelector('.v4-sealed.ai.resolving'); return { open: e.classList.contains('open'), bg: getComputedStyle(e).backgroundImage, tray: document.querySelector('.v4-ropt.theirs')?.innerText ?? '', bar: document.querySelector('.v4-prompt')?.innerText ?? '' }; });
report('…it flips face up as it resolves, revealed in the React window', flip.open && /ember/.test(flip.bg) && /revealed/.test(flip.tray) && /Ember/.test(flip.bar), JSON.stringify(flip).slice(0, 200));
await io.play({ type: 'decline', who: 'player' });
await idle();

report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\nc4check: ${results.length - failed.length}/${results.length} ok`);
await browser.close();
process.exit(failed.length ? 1 : 0);
