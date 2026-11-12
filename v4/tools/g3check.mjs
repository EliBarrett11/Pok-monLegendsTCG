// G3 browser check: node v4/tools/g3check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/). In Chromium (Playwright), at Normal speed (beats stretched by ?timescale so a
// software renderer can be screenshotted mid-beat), it plays every new card at least once:
//   - a hand with the new cards (Commands with their three short mode lines, Supporters, Items);
//   - Thunderbolt, Heat Wave, Surf (a lane), Bubble Beam, Flame Charge, Rock Slide, Ember, Dive as Adapt;
//   - Dive as a React in the React window (the player clicks it; the attack fizzles);
//   - Flannery, and Pokémon Breeder through the Release dialog's Discard picker;
//   - the PokéMart showing a new Item; Choice Band, Quick Claw, Rocky Helmet, X Attack, Amulet Coin used;
// and no page errors. Screenshots at 1920×1080.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { realInput } from './realinput.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'g3-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
const TS = Number(process.env.TIMESCALE ?? 3);
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}?debug&seed=7&speed=normal&timescale=${TS}`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
const idle = () => page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 120000 });
const state = () => page.evaluate(() => window.__v4.state);

// A staged board (the player's turn; the Opponent's hand empty, so no React unless a test gives one).
async function stage(src) {
  await page.evaluate(async (code) => {
    const C = await import('/v4/src/engine/cards.js');
    window.__v4.fastForward(3);
    window.__v4.set((s) => {
      const mon = (id, level, extra = {}) => ({ ...C.pokemonAt(id, level), uid: `g3-${id}-${Math.random().toString(36).slice(2, 6)}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, keywords: {}, trigger: null, ...extra });
      const card = (id) => ({ ...C.cardAtRound(id, s.round), uid: `h-${id}` });
      for (const w of ['player', 'ai']) { s.players[w].row = Array(9).fill(null); s.players[w].bag = []; }
      s.players.ai.hand = [];
      s.strats = [];
      s.locations = [];
      s.tournament = null;
      s.reactWindow = null;
      s.choice = null;
      s.turn = 'player';
      s.passesInARow = 0;
      s.players.player.baseEnergy = 9;
      s.players.player.dollars = 12;
      // eslint-disable-next-line no-new-func
      new Function('s', 'mon', 'card', 'C', code)(s, mon, card, C);
    });
    window.__v4.played.length = 0;
  }, src);
  await page.waitForTimeout(300);
}
// Play the player's action through real input (C2: clicks, no debug hook); screenshot partway through
// its beat if asked.
const input = realInput(page);
async function show(action, shot = null, at = 600) {
  await idle();
  await input.play(action);
  if (shot) { await page.waitForTimeout(at * TS); await page.screenshot({ path: `${OUT}/${shot}` }); }
  await idle();
}

// 1. A hand with the new cards.
await stage("s.players.player.hand = ['thunderbolt', 'heat-wave', 'surf', 'bubble-beam', 'flame-charge', 'dive', 'flannery', 'pokemon-breeder', 'quick-claw', 'x-attack'].map(card); s.players.player.row[4] = mon('squirtle', 4); s.players.ai.row[4] = mon('growlithe', 4, { spent: true });");
await page.screenshot({ path: `${OUT}/1-hand-new-cards.png` });
const handText = await page.evaluate(() => [...document.querySelectorAll('.v4-hand .cd-t')].map((e) => e.textContent).join(' ').replace(/\s+/g, ' '));   // C2: names hidden in a narrow strip still count (their text is there)
// C1: Mini cards show the name and one tag (the Command's mode chips, the Supporter's Release, the Item's kind).
report('the hand shows the new cards (Mini: names and mode chips)', /Thunderbolt/.test(handText) && /ADAPT 3/i.test(handText) && /Dive/.test(handText) && /Flannery/.test(handText) && /Release 1/i.test(handText) && /Quick Claw/.test(handText),
  handText.slice(0, 160));

// 2. Every new Command as Adapt (Surf on a lane: the wave over its Location).
const cmds = [
  ['thunderbolt', { who: 'ai', space: 2 }, null],
  ['heat-wave', { who: 'ai', space: null, all: true }, null],
  ['surf', { who: 'ai', space: 1, lane: true }, '3-surf.png'],
  ['bubble-beam', { who: 'ai', space: 2 }, null],
  ['flame-charge', { who: 'player', space: 4 }, null],
  ['rock-slide', { who: 'ai', space: 2, lane: true }, null],
  ['ember', { who: 'ai', space: 2 }, null],
  ['dive', { who: 'player', space: 4 }, null],
];
for (const [id, target, shot] of cmds) {
  await stage(`s.players.player.hand = [card('${id}')]; s.players.player.row[4] = mon('squirtle', 4, { currentStrength: 3 }); for (const sp of [0, 1, 2]) s.players.ai.row[sp] = mon('wooper', 7, { spent: sp !== 2 }); s.players.ai.row[6] = mon('growlithe', 4, { spent: true }); const loc = C.cardAtRound('cerulean-cape', 1); s.locations = [{ uid: 'loc-g3', owner: 'player', card: loc, id: loc.id, name: loc.name, art: loc.art, color: loc.color, start: 0, width: 3, roundsLeft: 2, weather: loc.weather, passive: loc.passive, placedRound: s.round }];`);
  const before = await state();
  await show({ type: 'command', who: 'player', uid: `h-${id}`, mode: 'adapt', target }, shot, 700);
  const after = await state();
  // The damage each Pokémon took, from the Command's own event (the Location's passive syncs in the same action).
  const res = after.events.find((e) => e.type === 'commandResolved');
  const hit = (w, sp) => res?.hits?.filter((h) => h.who === w && h.space === sp).reduce((n, h) => n + h.before - h.after, 0) ?? 0;
  const okFx = {
    thunderbolt: () => hit('ai', 2) === 4,
    'heat-wave': () => [0, 1, 2, 6].every((sp) => hit('ai', sp) === 1),
    surf: () => [0, 1, 2].every((sp) => hit('ai', sp) === 2) && hit('ai', 6) === 0,
    'bubble-beam': () => hit('ai', 2) === 2 && after.players.ai.row[2].spent,
    'flame-charge': () => after.players.player.row[4].attack === before.players.player.row[4].attack + 1,
    'rock-slide': () => [0, 1, 2].every((sp) => hit('ai', sp) === 1),
    ember: () => hit('ai', 2) === 3,
    dive: () => !after.players.player.row[4] && after.players.player.hand.some((c) => c.uid === before.players.player.row[4].uid),
  }[id]();
  report(`${id} (Adapt) plays and resolves`, okFx);
}

if (process.env.ONLY_CMDS) { console.log(errors.slice(0, 2).join('\n')); process.exit(0); }
// 3. Dive as a React in the React window: the Opponent attacks the player's hurt Charmeleon; the player clicks Dive.
await stage("s.players.player.hand = [card('dive')]; s.players.player.row[3] = mon('charmander', 5, { currentStrength: 2, spent: true }); s.players.ai.row[3] = mon('growlithe', 6);");
await page.evaluate(() => { window.__v4.set((s) => { s.turn = 'ai'; }); window.__v4.show({ type: 'attack', who: 'ai', from: 3, target: { kind: 'pokemon', space: 3 } }); });
await page.waitForSelector('.v4-ropts [data-react]', { timeout: 120000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/2-react-window-dive.png` });
const reactText = await page.evaluate(() => `${document.querySelector('.v4-prompt').innerText} | ${document.querySelector('.v4-ropts').innerText}`.replace(/\s+/g, ' '));
const charm = (await state()).players.player.row[3].uid;
await page.click('.v4-ropts [data-react]');
await page.waitForFunction(() => !window.__v4.state.reactWindow, null, { timeout: 60000 });
await idle();
const afterDive = await state();
report('Dive as a React: the window names the attacked Pokémon; clicking it saves it and the attack fizzles',
  /(return the attacked Pokémon to your hand|returns to your hand · the attack fizzles)/i.test(reactText) && /Charmeleon/.test(reactText) && afterDive.players.player.hand.some((c) => c.uid === charm) && afterDive.events.some((e) => e.type === 'fizzled'),
  reactText.slice(0, 200));

// 4. Supporters: Flannery (Favour: a Fire Pokémon) and Pokémon Breeder through the Release dialog's Discard picker.
await stage("s.players.player.hand = [card('flannery'), card('ponyta')]; s.players.player.row[2] = mon('squirtle', 4); s.players.player.row[5] = mon('growlithe', 4);");
const atk0 = (await state()).players.player.row[2].attack;
await show({ type: 'supporter', who: 'player', uid: 'h-flannery', release: ['h-ponyta'] }, null);
const fl = await state();
report('Flannery with its Favour: +2 Attack to each of yours, +3 Recognition', fl.players.player.row[2].attack === atk0 + 2 && fl.events.some((e) => e.type === 'recognition' && /Favour/.test(e.source)));
await stage("s.players.player.hand = [card('pokemon-breeder'), card('potion'), card('ember')]; s.players.player.discard = [{ ...C.cardAtRound('magikarp', s.round), uid: 'd-magikarp' }, { ...C.cardAtRound('charmander', s.round), uid: 'd-charmander' }, { ...C.cardAtRound('ponyta', s.round), uid: 'd-ponyta' }, { ...C.cardAtRound('surf', s.round), uid: 'd-surf' }];");
await page.click('.v4-hand .v4-card[data-uid="h-pokemon-breeder"]');
await page.click('[data-action="play-supporter"]');
await page.click('[data-rel="h-potion"]');
await page.click('[data-pickd="d-charmander"]');
await page.click('[data-pickd="d-magikarp"]');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/4-supporter-discard-picker.png` });
const pickerText = await page.evaluate(() => document.querySelector('.v4-release')?.innerText.replace(/\s+/g, ' ') ?? '');
await page.click('[data-action="sup-done"]');
if (await page.$('[data-action="confirm-yes"]')) await page.click('[data-action="confirm-yes"]');
await page.waitForFunction(() => window.__v4.state.players.player.hand.some((c) => c.uid === 'd-charmander'), null, { timeout: 60000 });
await idle();
const br = await state();
report('Pokémon Breeder: the Discard picker (2 with the Item Favour) puts the chosen cards in hand',
  /Discard Pile/.test(pickerText) && ['d-charmander', 'd-magikarp'].every((u) => br.players.player.hand.some((c) => c.uid === u)) && !br.players.player.hand.some((c) => c.uid === 'd-ponyta'), pickerText.slice(0, 140));

// 5. The PokéMart showing a new Item; the new Items used.
await stage("s.players.player.row[2] = mon('squirtle', 4); s.players.player.row[6] = mon('wooper', 4); s.players.player.row[7] = mon('horsea', 4); s.players.player.row[8] = mon('ponyta', 4); const i = s.mart.pool.findIndex((c) => c.id === 'choice-band'); const cb = i >= 0 ? s.mart.pool.splice(i, 1)[0] : C.itemDef('choice-band'); if (s.mart.onSale[0]) s.mart.pool.push(s.mart.onSale[0]); s.mart.onSale = [cb]; s.mart.stock = cb.stock; s.mart.soldOut = null; s.players.player.hand = ['quick-claw', 'x-attack', 'rocky-helmet', 'amulet-coin'].map(card);");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/5-pokemart-new-item.png` });
const martText = await page.evaluate(() => document.querySelector('.v4-martcard')?.closest('section, .v4-panel')?.innerText.replace(/\s+/g, ' ') ?? document.querySelector('.v4-martcard')?.innerText ?? '');
report('the PokéMart shows Choice Band', /Choice Band/.test(martText) || /Choice Band/.test(await page.evaluate(() => document.querySelector('.v4-martcard')?.getAttribute('title') ?? '')), martText.slice(0, 120));
const p0 = await state();
await show({ type: 'buyItem', who: 'player', from: 'mart', slot: 0, then: 'use', target: { space: 2 } });
for (const [uid, space] of [['h-quick-claw', 6], ['h-x-attack', 7], ['h-rocky-helmet', 8]]) {
  await page.evaluate(() => { window.__v4.set((s) => { s.turn = 'player'; s.players.player.dollars = 12; }); });
  await show({ type: 'buyItem', who: 'player', from: 'hand', uid, then: 'use', target: { space } });
}
await page.evaluate(() => { window.__v4.set((s) => { s.turn = 'player'; s.players.player.dollars = 12; }); });
await show({ type: 'buyItem', who: 'player', from: 'hand', uid: 'h-amulet-coin', then: 'use', target: { space: null } });
const p1 = await state();
const row = p1.players.player.row;
report('Choice Band, Quick Claw, X Attack, Rocky Helmet and Amulet Coin used',
  row[2].held?.id === 'choice-band' && row[2].attack === p0.players.player.row[2].attack + 3 && row[6].held?.id === 'quick-claw' && row[7].tempAttack === 2 && row[8].held?.id === 'rocky-helmet' && p1.players.player.recognition === p0.players.player.recognition + 3,
  `Recognition ${p0.players.player.recognition} → ${p1.players.player.recognition}`);
// C1: the token shows the higher Speed as its chevrons (Quagsire is Slow: one; with Quick Claw, Steady: two).
const chev = await page.evaluate(() => document.querySelector('.v4-row.player .v4-space[data-space="6"] .cd-chev')?.textContent ?? '');
report('Quick Claw: the card shows the higher Speed', chev === '››', `chevrons "${chev}"`);

report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\ng3check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
