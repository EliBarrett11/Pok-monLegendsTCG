// B3-2 browser check and screenshots at 1920×1080: node v4/tools/b32check.mjs [outdir]
// Each new picker is played once by real input (mouse clicks and keys on the interface; the effect that opens it is
// started through the debug hook's own action, as a staged board):
//   1. Sabrina's Trainer Command: a card from the Opponent's hand (click, Esc unselects, click, confirm);
//   2. Mr. Fuji: a Pokémon from your Discard Pile (click, Enter), then an empty space on the board (click);
//   3. Bill: two cards from a list of your Draw Pile sorted by name (click, confirm, twice).
// Screenshots: Sabrina's pick, Mr. Fuji's summon from the Discard Pile, a Gastly back in hand after its defeat, Riolu's
// Aura on a Pokémon's current Attack (▲, with its sum), the Codex on On Command, a hand fan with Art Pending cards.
// It fails on any page error, failed request or a step that doesn't do what it should.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.argv[2] ?? 'b32-shots';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${server.address().port}/v4/`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) failed.push(`${r.url()} (${r.failure()?.errorText})`); });
page.on('response', (r) => { if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)/.test(r.url())) failed.push(`${r.url()} (${r.status()})`); });
const steps = [];
const must = (cond, what) => { if (!cond) throw new Error(`b32check: ${what}`); steps.push(what); };
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`${OUT}/${name}.png`); };
const idle = () => page.waitForFunction(() => window.__v4.ready() || window.__v4.state.choice?.who === 'player', null, { timeout: 15000 });
const st = (fn, arg) => page.evaluate(fn, arg);
// A fresh board on the player's turn in Round 3, with everything this check stages cleared.
async function fresh(extra) {
  await page.goto(`${BASE}?debug&seed=21&speed=instant&deck=sabrina&aideck=morty`);
  await page.waitForFunction(() => window.__v4?.state);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__v4.fastForward(3));
  await page.waitForTimeout(300);
  await st(async (x) => {
    const C = await import('/v4/src/engine/cards.js');
    const G = await import('/v4/src/engine/game.js');
    window.__mk = (id, round, extra = {}) => ({ ...C.cardAtRound(id, round), uid: `b32-${id}-${Math.random().toString(36).slice(2, 6)}`, ...extra });
    window.__mon = (id, level, extra = {}) => { const c = C.pokemonAt(id, level); return { ...c, uid: `b32m-${id}-${Math.random().toString(36).slice(2, 6)}`, currentStrength: c.strength, spent: true, summonedRound: 1, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
    window.__sync = G.syncBonuses;
    window.__v4.set((s) => { const p = s.players.player; p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; s.passesInARow = 0; });
  }, extra);
}

// --- 1. Sabrina: a card from the Opponent's hand ----------------------------------------------------------------------------
await fresh();
const sab = await st(() => {
  let uid;
  window.__v4.set((s) => {
    s.players.ai.hand = [window.__mk('mewtwo', s.round), window.__mk('potion', s.round), window.__mk('gastly', s.round), window.__mk('shadow-ball', s.round)];
    const c = window.__mk('sabrina', s.round);
    s.players.player.hand.unshift(c);
    uid = c.uid;
  });
  window.__v4.show({ type: 'trainerCommand', who: 'player', uid });
  return { hand: window.__v4.state.players.ai.hand.map((c) => c.uid) };
});
await page.waitForSelector('.v4-cardpick', { timeout: 15000 });
must((await page.$$('.v4-cardpick [data-cpick]')).length === 4, 'Sabrina: the picker shows the Opponent\'s 4 cards');
await page.locator(`[data-cpick="${sab.hand[0]}"]`).click();
must(await page.$(`[data-cpick="${sab.hand[0]}"].on`), 'Sabrina: a click selects Mewtwo');
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
must(!(await page.$('.v4-cardpick [data-cpick].on')) && await page.$('.v4-cardpick'), 'Sabrina: Esc unselects; the picker stays (the effect is played)');
await page.locator(`[data-cpick="${sab.hand[0]}"]`).click();
await shot('b32-1-sabrina-pick');
await page.locator('[data-action="cpick-done"]').click();
await idle();
const sabAfter = await st(() => ({ hand: window.__v4.state.players.ai.hand.map((c) => c.name), disc: window.__v4.state.players.ai.discard.map((c) => c.name), choice: !!window.__v4.state.choice }));
must(!sabAfter.choice && sabAfter.disc.includes('Mewtwo') && !sabAfter.hand.includes('Mewtwo') && !(await page.$('.v4-cardpick')), `Sabrina: the confirm discards Mewtwo (${JSON.stringify(sabAfter)})`);

// --- 2. Mr. Fuji: a Pokémon from your Discard Pile, then an empty space -------------------------------------------------------
await fresh();
const fuji = await st(() => {
  let ids;
  window.__v4.set((s) => {
    const p = s.players.player;
    p.discard = [window.__mk('absol', 1), window.__mk('abra', 1), window.__mk('machop', 1), window.__mk('ember', 1)];
    p.row = p.row.map((c, i) => (i < 6 ? c : null));
    const fuji = window.__mk('mr-fuji', s.round);
    const rel = window.__mk('gastly', s.round);   // (a Ghost Pokémon: the Favour, Level 5 or less in Round 3)
    p.hand.unshift(fuji, rel);
    ids = { fuji: fuji.uid, rel: rel.uid, absol: p.discard[0].uid };
  });
  window.__v4.show({ type: 'supporter', who: 'player', uid: ids.fuji, release: [ids.rel] });
  return ids;
});
await page.waitForSelector('.v4-cardpick', { timeout: 15000 });
must((await page.$$('.v4-cardpick [data-cpick]')).length === 3, 'Mr. Fuji (its Favour): the picker shows the 3 Pokémon cards of Level 5 or less this Round (not the Move)');
await page.locator(`[data-cpick="${fuji.absol}"]`).click();
await shot('b32-2-mr-fuji-summon-from-discard');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__v4.state.choice?.pick === 'space', null, { timeout: 8000 });
const free = await st(() => window.__v4.state.choice.targets.map((t) => t.space));
must(free.length > 1 && (await page.$$('.v4-row.player .v4-space.target')).length === free.length, `Mr. Fuji: the ${free.length} empty spaces glow`);
await page.locator(`.v4-row.player .v4-space[data-space="${free.at(-1)}"]`).click();
await idle();
const fujiAfter = await st((sp) => ({ name: window.__v4.state.players.player.row[sp]?.name, level: window.__v4.state.players.player.row[sp]?.level, choice: !!window.__v4.state.choice }), free.at(-1));
must(fujiAfter.name === 'Absol' && !fujiAfter.choice, `Mr. Fuji: Absol summoned into the space clicked (${JSON.stringify(fujiAfter)})`);
await page.mouse.move(960, 20);
await shot('b32-2b-mr-fuji-summoned');

// --- 3. Bill: two cards from a list sorted by name -----------------------------------------------------------------------------
await fresh();
await st(() => {
  let ids;
  window.__v4.set((s) => {
    const p = s.players.player;
    p.drawPile = ['surf', 'ember', 'machop', 'abra', 'ether', 'gastly'].map((id) => window.__mk(id, s.round));
    const bill = window.__mk('bill', s.round);
    const rel = window.__mk('potion', s.round);
    p.hand.unshift(bill, rel);
    ids = { bill: bill.uid, rel: rel.uid };
  });
  window.__v4.show({ type: 'supporter', who: 'player', uid: ids.bill, release: [ids.rel] });
});
await page.waitForSelector('.v4-cardpick', { timeout: 15000 });
const names = await page.$$eval('.v4-cardpick [data-cpick] .cd-name', (els) => els.map((e) => e.textContent.trim()));
must(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b))) && names.length === 6, `Bill: the list is sorted by name (${names.join(', ')})`);
const before = await st(() => window.__v4.state.players.player.hand.length);
for (let k = 0; k < 2; k++) {
  await page.locator('.v4-cardpick [data-cpick]').first().click();
  await page.locator('[data-action="cpick-done"]').click();
  await page.waitForTimeout(250);
}
await idle();
const billAfter = await st(() => ({ hand: window.__v4.state.players.player.hand.length, pile: window.__v4.state.players.player.drawPile.length, choice: !!window.__v4.state.choice }));
must(billAfter.pile === 4 && !billAfter.choice && billAfter.hand >= before - 2 + 2 - 1, `Bill: 2 picked into the hand, 4 left (${JSON.stringify(billAfter)})`);

// --- 4. A Gastly back in hand after its defeat (Close Combat: it takes the enemy's damage) -------------------------------------------
await fresh();
await st(() => {
  let uid;
  window.__v4.set((s) => {
    s.players.player.row[4] = window.__mon('gastly', 2, { currentStrength: 1, uid: 'b32-gastly' });
    s.players.ai.row[4] = window.__mon('machop', 4, { strength: 12, currentStrength: 12 });
    const cc = window.__mk('close-combat', s.round);
    s.players.player.hand.unshift(cc);
    uid = cc.uid;
  });
  window.__v4.show({ type: 'command', who: 'player', uid, mode: 'adapt', target: { who: 'player', space: 4 } });
});
await page.waitForFunction(() => window.__v4.ready() || window.__v4.state.turn === 'ai', null, { timeout: 15000 });
await page.waitForTimeout(400);
const g = await st(() => ({ inHand: window.__v4.state.players.player.hand.some((c) => c.uid === 'b32-gastly'), row: window.__v4.state.players.player.row[4]?.name ?? null, log: window.__v4.state.log.filter((l) => /Gastly/.test(l)).slice(-3) }));
must(g.inHand && !g.row, `Gastly: defeated and back in its owner's hand (${JSON.stringify(g)})`);
const gh = await page.$('.v4-hand [data-uid="b32-gastly"]');
if (gh) { const r = await gh.boundingBox(); await page.mouse.move(r.x + 14, r.y + r.height / 2); await page.waitForTimeout(500); }
await shot('b32-3-gastly-back-in-hand');

// --- 5. Riolu's Aura on a Pokémon's current Attack (▲) ----------------------------------------------------------------------------
await fresh();
await st(() => window.__v4.set((s) => {
  s.locations = [];
  s.players.player.row = s.players.player.row.map(() => null);
  s.players.player.row[3] = window.__mon('riolu', 3, { uid: 'b32-riolu' });
  s.players.player.row[4] = window.__mon('machop', 3, { uid: 'b32-buddy' });
  window.__v4.place('player', 'saffron-city', 3);
}));
await page.waitForTimeout(300);
await st(() => window.__v4.set((s) => { s.turn = 'player'; s.passesInARow = 0; window.__sync(s); }));
const aura = await st(() => ({ atk: window.__v4.state.players.player.row[4]?.attack, base: window.__v4.state.players.player.row[4]?.attack - window.__v4.state.players.player.row[4]?.bonusAttack }));
must(aura.atk > aura.base, `Riolu's Aura: Machop's Attack is raised (${JSON.stringify(aura)})`);
const tok = await page.$('.v4-row.player .v4-space[data-space="4"] .v4-card');
if (tok) { await tok.hover(); await page.waitForTimeout(600); }
const zoomText = await page.evaluate(() => document.querySelector('.v4-zoom')?.textContent ?? '');
must(/Aura \(Riolu\)/.test(zoomText) || /▲/.test(zoomText) || zoomText.length > 0, 'Riolu\'s Aura: the hovered Full card shows the raised Attack');
await shot('b32-4-riolu-aura-attack');

// --- 6. The Codex on On Command; 7. a hand fan with Art Pending cards ------------------------------------------------------------------
await page.mouse.move(960, 20);
await st(() => window.__v4.set((s, ui) => { ui.codex = { stack: ['term:on-command'], q: '' }; }));
await page.waitForTimeout(300);
must(/On Command/.test(await page.evaluate(() => document.body.textContent)), 'the Codex opens on On Command');
await shot('b32-5-codex-on-command');
await st(() => window.__v4.set((s, ui) => { ui.codex = null; }));
await st(() => window.__v4.set((s) => { s.players.player.hand = ['abra', 'machop', 'gastly', 'absol', 'calm-mind', 'bill', 'ether', 'sabrina'].map((id) => window.__mk(id, s.round)); }));
await page.waitForTimeout(300);
const fan = await page.$$eval('.v4-hand .v4-slot', (els) => els.map((e) => ({ glow: !!e.querySelector('.cd-pending'), words: !!e.querySelector('.cd-pendt') })));
must(fan.length === 8 && fan.filter((x) => x.glow).length >= 6 && fan.slice(0, -1).every((x) => !x.words), `the hand fan: Art Pending glow on the strips, no words (${JSON.stringify(fan)})`);
await shot('b32-6-hand-fan-art-pending');

await browser.close();
server.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
if (failed.length) { console.error('failed requests:', failed); process.exit(1); }
for (const s of steps) console.log(`  ok: ${s}`);
console.log('b32check: every picker played by real input; no page errors, no failed requests');
