// C3 browser check: node v4/tools/c3check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/). In Chromium (Playwright) at 1920×1080, with real input only (tools/realinput.mjs:
// right-click, hover and C, clicks, typing, Esc):
//   - the Codex opens on each kind of thing, by right-click and by C: a hand card, Pokémon on both sides, the
//     PokéMart, a Bag Item, an Objective tracker, both Recognition rings, both Energy readouts, the Weather chip,
//     the Draw, Discard and Released Piles, a Location, the Tournament, the log ticker, a log line, the Round box,
//     a card in the Discard viewer (and its ⓘ), the React window (and its ⓘ), the mode picker (C and its ⓘ);
//   - the React window's countdown waits while the Codex is open;
//   - three glossary links followed, then Back three times to where it started;
//   - Rules searched (the ? overlay's Rules page, and the Codex's own search);
//   - right-click still cancels a choice in progress;
//   - no page errors.
// Screenshots: the Codex on Charizard in play, on a Command in hand, on Mt. Ember, on a Recognition ring, on
// the glossary entry for React; the Rules page.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { realInput } from './realinput.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'c3-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}?debug&seed=7&speed=instant`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
const io = realInput(page);
const state = () => page.evaluate(() => window.__v4.state);
const ui = () => page.evaluate(() => ({ select: window.__v4.ui.select, picker: window.__v4.ui.picker, codex: window.__v4.codex() }));

// The staged mid-match board (setup only; every check below is real input). Round 5, the player's turn:
// Charizard (Level 8, +1 Attack kept, holding Charcoal, damaged) in Mt. Ember; Cerulean Cape and Route 119
// placed too; a hand with a Command; a Potion in the Bag.
async function stage(extra = '') {
  await page.evaluate(async (code) => {
    const C = await import('/v4/src/engine/cards.js');
    const G = await import('/v4/src/engine/game.js');
    window.__v4.fastForward(5);
    window.__v4.set((s) => {
      const mon = (id, level, x = {}) => ({ ...C.pokemonAt(id, level), uid: `c3-${id}-${level}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x });
      const loc = (id, start, owner = 'player') => { const l = C.locationDef(id); return { uid: `loc-${id}`, owner, card: l, id, name: l.name, art: l.art, color: l.color, start, width: l.width, roundsLeft: l.rounds - 1, weather: l.weather, passive: l.passive, placedRound: s.round - 1 }; };
      const card = (id, uid) => ({ ...C.cardAtRound(id, s.round), uid });
      s.tournament = null;
      s.reactWindow = null;
      s.choice = null;
      s.strats = [];
      s.turn = 'player';
      s.passesInARow = 0;
      s.locations = [loc('cerulean-cape', 0), loc('mt-ember', 2, 'ai'), loc('route-119', 5)];
      for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null);
      // Charizard's Attack: 8 printed + 1 kept, then the engine's own Location and Held bonuses (synced below).
      s.players.player.row[3] = mon('charmander', 8, { attack: 9, held: C.itemDef('charcoal'), currentStrength: 6 });
      s.players.player.row[6] = mon('squirtle', 6, { spent: true });
      s.players.ai.row[3] = mon('magby', 8, { spent: true });
      s.players.ai.row[7] = mon('magikarp', 8, { spent: true });
      s.players.player.hand = [card('ember', 'c3-cmd'), card('charmander', 'c3-mon'), card('brock', 'c3-sup'), card('potion', 'c3-item'), card('thunderbolt', 'c3-cmd2')];
      s.players.player.bag = [card('oran-berry', 'c3-bag')];
      s.players.player.baseEnergy = 6;
      G.syncBonuses(s);
      // eslint-disable-next-line no-new-func
      new Function('s', 'mon', 'loc', 'card', 'C', code)(s, mon, loc, card, C);
    });
  }, extra);
  await page.mouse.move(960, 20);
  await page.waitForTimeout(250);
}
await stage();
const s0 = await state();
const zard = s0.players.player.row[3];
report('staged: Charizard in Mt. Ember with Charcoal and +1 kept', zard.name === 'Charizard' && zard.attack === 11, `Attack ${zard.attack}`);

// --- 1. Each kind of thing, by right-click and by C ---------------------------------------------------------
const KINDS = [
  ['a hand card', '.v4-hand .v4-hcard[data-uid="c3-cmd"]', 'card:c3-cmd', { x: 18, y: 120 }],
  ['your Pokémon', '.v4-row.player .v4-space[data-space="3"] .v4-mon', 'mon:player:3'],
  ['an enemy Pokémon', '.v4-row.opponent .v4-space[data-space="3"] .v4-mon', 'mon:ai:3'],
  ['your Recognition ring', '.v4-ring.player', 'rec:player'],
  ['the Opponent\'s Recognition ring', '.v4-ring.ai', 'rec:ai'],
  ['a Bag Item', '.v4-hud.you [data-bag="c3-bag"]', 'card:c3-bag'],
  ['an Objective tracker', '.v4-hud.you .v4-tr', /^trainer:player:/],
  ['the Opponent\'s Energy', '.v4-oen', 'energy:ai'],
  ['a Location', '[data-plate="loc-mt-ember"] .v4-plate', 'loc:loc-mt-ember'],
  ['the Draw Pile', '[data-pile="player-draw"]', 'pile:player:draw'],
  ['the Discard Pile', '[data-pile="player-disc"]', 'pile:player:discard'],
  ['the Released Pile', '.v4-relline [data-view="player-rel"]', 'pile:player:released'],
  ['the Opponent\'s Discard Pile', '[data-pile="ai-disc"]', 'pile:ai:discard'],
  // The right-hand column (the Codex sits over it once open, so each is opened with the Codex closed).
  ['the Energy tile', '.v4-energy', 'energy:player'],
  ['the Weather chip', '.v4-wx', 'weather'],
  ['the PokéMart', '.v4-martslot', 'mart'],
  ['the Round box', '.v4-round', 'term:round'],
  ['End turn', '.v4-pass', 'term:pass'],
  ['the log ticker', '.v4-ticker p', /^log:\d+$/],
];
for (const [name, sel, want, pos] of KINDS) {
  for (const how of ['right', 'c']) {
    await io.closeCodex();
    let got = null;
    try { got = await io.inspect(sel, how, pos); } catch (e) { got = `error: ${e.message.split('\n')[0].slice(0, 90)}`; }
    const ok = typeof want === 'string' ? got === want : want.test(got ?? '');
    report(`${how === 'right' ? 'right-click' : 'C'} on ${name}`, ok, String(got));
  }
}
// The Codex on Charizard: its sums and forms row (screenshot 1).
await io.closeCodex();
await io.inspect('.v4-row.player .v4-space[data-space="3"] .v4-mon', 'right');
await page.mouse.move(1240, 300, { steps: 4 });   // over the Codex's Full card: its tilt and sheen
await page.waitForTimeout(250);
const sums = await page.evaluate(() => [...document.querySelectorAll('.v4-codex .v4-csums p')].map((p) => p.textContent));
const forms = await page.evaluate(() => [...document.querySelectorAll('.v4-codex .v4-cform .lv')].map((p) => p.textContent));
report('Charizard: "Attack 11 = 8 base + 1 kept + 1 Mt. Ember + 1 Charcoal"', sums[0] === 'Attack 11 = 8 base + 1 kept + 1 Mt. Ember + 1 Charcoal', sums[0]);
report('Charizard: Strength sum with the damage', sums[1] === 'Strength 6 = 9 base − 3 damage (of 9)', sums[1]);
report('Charizard: the forms row (Charmander 3–4, Charmeleon 5–6, Charizard 7–8, the current one marked)', forms.join(' | ') === 'Lv 3–4 | Lv 5–6 | Lv 7–8 · now', forms.join(' | '));
await page.screenshot({ path: `${OUT}/c3-1-codex-charizard.png` });
// A Command in hand (screenshot 2).
await io.closeCodex();
await io.inspect('.v4-hand .v4-hcard[data-uid="c3-cmd2"]', 'right', { x: 18, y: 120 });
await page.mouse.move(960, 20);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/c3-2-codex-command.png` });
// Mt. Ember (screenshot 3).
await io.closeCodex();
await io.inspect('[data-plate="loc-mt-ember"] .v4-plate', 'right');
await page.mouse.move(960, 20);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/c3-3-codex-mt-ember.png` });
// A Recognition ring (screenshot 4).
await io.closeCodex();
await io.inspect('.v4-ring.player', 'right');
const rec = await page.evaluate(() => document.querySelector('.v4-codex .v4-crec') !== null);
report('the ring: its history by source, with the Round of each', rec);
await page.mouse.move(960, 20);
await page.screenshot({ path: `${OUT}/c3-4-codex-recognition.png` });

// --- 2. Three glossary links, and Back ---------------------------------------------------------------------
await io.closeCodex();
const start = await io.inspect('.v4-row.player .v4-space[data-space="3"] .v4-mon', 'right');
const hops = [];
for (let i = 0; i < 3; i++) {
  const sel = i === 0 ? '.v4-codex .v4-csums .v4-term' : '.v4-codex .v4-cright .v4-term';
  hops.push(await io.codexLink(sel));
}
report('three glossary links followed', hops.every((h) => h.ref === `term:${h.id}`), hops.map((h) => h.ref).join(' → '));
const crumbs = await page.evaluate(() => document.querySelectorAll('.v4-codex-crumbs a, .v4-codex-crumbs b').length);
report('breadcrumbs show the path', crumbs === 4, `${crumbs} crumbs`);
const backs = [];
for (let i = 0; i < 3; i++) backs.push(await io.codexBack());
report('Back three times returns to where it started', backs.at(-1) === start && backs[0] === hops[1].ref && backs[1] === hops[0].ref, backs.join(' ← '));

// --- 3. Rules searched -------------------------------------------------------------------------------------
// The Codex's own search: "React", then the React entry (screenshot 5).
await page.locator('.v4-codex-search').click();
await page.keyboard.type('React');
await page.waitForTimeout(150);
const hits = await page.evaluate(() => document.querySelectorAll('.v4-codex .v4-cmean').length);
report('the Codex search finds React', hits > 0 && (await page.$('.v4-codex .v4-cmean [data-term="react"]')) !== null, `${hits} entries`);
await page.locator('.v4-codex .v4-cmean [data-term="react"]').first().click();
await page.waitForTimeout(100);
report('the glossary entry for React', (await io.codexRef()) === 'term:react');
await page.mouse.move(960, 20);
await page.screenshot({ path: `${OUT}/c3-5-codex-react.png` });
await io.closeCodex();
// The ? overlay's Rules page: search, then a term into the Codex (screenshot 6 before searching).
await page.mouse.move(960, 20);
await page.keyboard.press('?');
await page.locator('[data-keytab="rules"]').click();
await page.waitForTimeout(150);
const all = await page.evaluate(() => document.querySelectorAll('.v4-rulesbody .v4-cmean').length);
await page.screenshot({ path: `${OUT}/c3-6-rules-page.png` });
await page.locator('.v4-rulesearch').click();
await page.keyboard.type('stock');
await page.waitForTimeout(150);
const some = await page.evaluate(() => document.querySelectorAll('.v4-rulesbody .v4-cmean').length);
report('the Rules page searches', all > 80 && some > 0 && some < all && (await page.$('.v4-rulesbody [data-term="stock"]')) !== null, `${all} → ${some}`);
await page.locator('.v4-rulesbody [data-term="sold-out"]').first().click();
await page.waitForTimeout(100);
report('a term on the Rules page opens the Codex', (await io.codexRef()) === 'term:sold-out');
await io.closeCodex();
await page.keyboard.press('Escape');   // out of the search box: closes the Rules page
await page.waitForTimeout(100);
report('Esc closes the Rules page', !(await page.$('.v4-rulespage')));

// --- 4. Full cards: the Discard viewer, the React window, the mode picker -----------------------------------
await page.locator('[data-pile="player-disc"]').click();
await page.waitForTimeout(150);
const firstDisc = await page.evaluate(() => document.querySelector('.v4-pilegrid .v4-fullwrap')?.dataset.codex);
report('right-click on a card in the Discard viewer', (await io.inspect('.v4-pilegrid .v4-fullwrap', 'right')) === firstDisc, firstDisc);
await io.closeCodex();
report('the ⓘ on a card in the Discard viewer', (await io.inspect('.v4-pilegrid .v4-fullwrap', 'info')) === firstDisc);
await io.closeCodex();
await page.keyboard.press('Escape');   // closes the viewer
// The React window: the Opponent's Magby attacks Squirtle; you hold Ember and Thunderbolt.
await stage("s.players.ai.row[3].spent = false; s.players.player.row[3] = null; s.players.player.row[6].spent = true; s.turn = 'ai';");
await page.evaluate(() => window.__v4.apply({ type: 'attack', who: 'ai', from: 3, target: { kind: 'pokemon', space: 6 } }));
await page.waitForSelector('.v4-ropt', { timeout: 10000 });
const ropt = await page.evaluate(() => document.querySelector('.v4-ropt')?.dataset.codex);
report('right-click on a card in the React window', (await io.inspect('.v4-ropt', 'right')) === ropt, ropt);
// The countdown waits while the Codex is open (5 s by default): still open after 6.5 s.
await page.waitForTimeout(6500);
report('the React countdown waits while the Codex is open', await page.evaluate(() => !!window.__v4.state.reactWindow && !!document.querySelector('.v4-rtimer.paused')));
await io.closeCodex();
report('the ⓘ on a card in the React window', (await io.inspect('.v4-ropt', 'info')) === ropt);
await io.closeCodex();
await page.locator('[data-action="decline"]').click();
await page.waitForFunction(() => !window.__v4.state.reactWindow, null, { timeout: 10000 });
// The mode picker: Ember dropped on a target from the hand (Adapt and Strat both playable); C on its card.
await stage('s.players.player.baseEnergy = 9;');
await page.locator('.v4-hand .v4-hcard[data-uid="c3-cmd"]').click({ position: { x: 18, y: 120 } });
await page.locator('.v4-row.opponent .v4-space[data-space="3"].target').click();
await page.waitForSelector('.v4-picker', { timeout: 4000 }).catch(() => null);
const picker = !!(await page.$('.v4-picker'));
report('the mode picker is open', picker);
if (picker) {
  report('C on the mode picker\'s card', (await io.inspect('.v4-picker .v4-fullwrap', 'c')) === 'card:c3-cmd');
  await io.closeCodex();
  report('the ⓘ on the mode picker\'s card', (await io.inspect('.v4-picker .v4-fullwrap', 'info')) === 'card:c3-cmd');
  await io.closeCodex();
  // --- 5. Right-click still cancels a choice in progress (the picker, then a selected hand card). ---
  await page.locator('.v4-picker .v4-fullwrap').click({ button: 'right' });
  await page.waitForTimeout(80);
  const u1 = await ui();
  report('right-click cancels the mode picker (no Codex)', !u1.picker && !u1.codex);
}
await page.locator('.v4-hand .v4-hcard[data-uid="c3-mon"]').click({ position: { x: 18, y: 120 } });
const selected = (await ui()).select?.uid === 'c3-mon';
await page.locator('.v4-row.player .v4-space[data-space="5"]').click({ button: 'right' });
await page.waitForTimeout(80);
const u2 = await ui();
report('right-click cancels a selected hand card (no Codex)', selected && !u2.select && !u2.codex);
// A log line in the drawer.
await page.keyboard.press('l');
await page.waitForTimeout(100);
report('right-click on a log line', /^log:\d+$/.test(await io.inspect('.v4-loglist p', 'right') ?? ''));
await io.closeCodex();
await page.keyboard.press('l');
// The Tournament.
await stage('s.locations = []; s.tournament = { startedRound: s.round, reason: "staged" };');
await page.evaluate(() => window.__v4.set((s, u) => { u.seenTournament = s.tournament.startedRound; }));
report('right-click on the Tournament', (await io.inspect('.v4-lplate.tournament .v4-plate', 'right')) === 'tournament');
await io.closeCodex();
report('C on the Tournament', (await io.inspect('.v4-lplate.tournament .v4-plate', 'c')) === 'tournament');
await io.closeCodex();

report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\nc3check: ${results.length - failed.length}/${results.length} ok`);
await browser.close();
process.exit(failed.length ? 1 : 0);
