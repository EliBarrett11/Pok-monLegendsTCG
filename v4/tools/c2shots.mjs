// C2 screenshots and the finish's frame times: node v4/tools/c2shots.mjs [out-dir] (a server must serve the
// repository root at http://localhost:8123/). At 1920×1080:
//   1. a 9-card hand; 2. an 11-card hand; 3. a hovered final-form card mid-tilt (its Full card in the zoom);
//   4. a Partner token on the board; 5. the board with Locations in play (the four need 11 lanes and the
//   board has 9: Cerulean Cape, Mt. Ember and Route 119 fill all 9, and a second shot has Lake of Rage);
//   6. the panel under the Round (B3-1: the decks) and the log ticker with long entries.
// Then frame times with five holo cards on screen: at idle, and with the pointer moving over a holo card.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'c2-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?debug&seed=7&speed=instant${process.env.NOWEBGL ? "&nowebgl" : ""}`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
await page.evaluate(() => window.__v4.fastForward(5));
await page.waitForTimeout(600);
await page.evaluate(() => document.fonts.ready);

const stage = (code) => page.evaluate(async (src) => {
  const C = await import('/v4/src/engine/cards.js');
  window.__v4.set((s) => {
    const mon = (id, level, extra = {}) => ({ ...C.pokemonAt(id, level), uid: `c2-${id}-${level}-${Math.random().toString(36).slice(2, 5)}`, currentStrength: C.pokemonAt(id, level).strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
    const card = (id, k) => ({ ...C.cardAtRound(id, s.round), uid: `c2h-${id}-${k}` });
    const loc = (id, start, owner = 'player') => { const l = C.locationDef(id); return { uid: `loc-${id}`, owner, card: l, id, name: l.name, art: l.art, color: l.color, start, width: l.width, roundsLeft: l.rounds, passive: l.passive, placedRound: s.round }; };
    s.turn = 'player'; s.reactWindow = null; s.choice = null;
    // eslint-disable-next-line no-new-func
    new Function('s', 'mon', 'card', 'loc', 'C', src)(s, mon, card, loc, C);
  });
}, code);
const settle = async () => { await page.mouse.move(960, 20); await page.waitForTimeout(500); };
const HAND = ['squirtle', 'pokemon-breeder', 'magby', 'thunderbolt', 'rocky-helmet', 'growlithe', 'cerulean-cape', 'professor-oak', 'flame-charge', 'misty', 'charmander'];
const board = "for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null); s.players.player.row[1] = mon('charmander', 8, { spent: false, held: C.itemDef('charcoal') }); s.players.player.row[3] = { ...C.TRAINERS[0].partner, uid: 'c2-partner', currentStrength: 10, spent: false, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, trainer: 'Misty' }; s.players.player.row[5] = mon('squirtle', 7, { currentStrength: 5 }); s.players.ai.row[2] = mon('magby', 8); s.players.ai.row[4] = { ...C.TRAINERS[1].partner, uid: 'c2-p2', currentStrength: 9, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, trainer: 'Blaine' }; s.players.ai.row[7] = mon('shinx', 7);";

// 1, 2. Hands of 9 and 11.
for (const n of [9, 11]) {
  await stage(`${board} s.players.player.hand = ${JSON.stringify(HAND.slice(0, n))}.map(card);`);
  await settle();
  await page.screenshot({ path: `${OUT}/${n === 9 ? '1' : '2'}-hand-${n}.png` });
}
// 3. A final form (Charizard) hovered in hand: its Full card in the zoom, tilted by the pointer near a corner.
await stage(`${board} s.players.player.hand = ['charmander', 'magby', 'thunderbolt', 'misty', 'squirtle'].map((id, k) => (id === 'charmander' ? { ...C.pokemonAt('charmander', 8), uid: 'c2-zard' } : card(id, k)));`);
await settle();
const hb = await (await page.$('.v4-hand .v4-hcard[data-uid="c2-zard"]')).boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + 60);
await page.mouse.move(hb.x + hb.width - 14, hb.y + 30, { steps: 8 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/3-final-form-tilt.png` });
const tilt = await page.evaluate(() => { const z = document.querySelector('.v4-zoom .cd-full'); return z ? `rotateX ${z.style.getPropertyValue('--rx')}, rotateY ${z.style.getPropertyValue('--ry')}, sheen at ${z.style.getPropertyValue('--mx')}` : 'none'; });
console.log(`tilt: ${tilt}`);
// 4. A Partner token on the board (Starmie, the rich holo), hovered.
await settle();
await page.screenshot({ path: `${OUT}/4-partner-token.png` });
// 5. Locations: Cerulean Cape (2), Mt. Ember (3) and Route 119 (4) fill all 9 lanes; then Lake of Rage.
await stage(`${board} s.tournament = null; s.locations = [loc('cerulean-cape', 0), loc('mt-ember', 2, 'ai'), loc('route-119', 5)];`);
await settle();
await page.screenshot({ path: `${OUT}/5-locations-9-lanes.png` });
await stage(`${board} s.tournament = null; s.locations = [loc('lake-of-rage', 0), loc('mt-ember', 2, 'ai'), loc('route-119', 5)];`);
await settle();
await page.screenshot({ path: `${OUT}/5b-locations-lake-of-rage.png` });
// 6. The panel under the Round and the ticker with a long entry.
await stage(`${board} s.tournament = null; s.locations = [loc('cerulean-cape', 0), loc('mt-ember', 2, 'ai'), loc('route-119', 5)]; s.log.push("The Opponent's Magmortar: On Attack: 1 damage to each other enemy Pokémon in the target's Location.");`);
await settle();
await page.screenshot({ path: `${OUT}/6-panel-and-ticker.png` });
await page.screenshot({ path: `${OUT}/6-panel-and-ticker-crop.png`, clip: { x: 1600, y: 140, width: 320, height: 700 } });

// Frame times with five holo cards on screen: Charizard, Blastoise and Misty in hand, Starmie and Ninetales
// tokens on the board.
await stage(`${board} s.players.player.row[5] = mon('squirtle', 7); s.players.player.hand = ['charmander', 'squirtle', 'misty', 'ember', 'potion'].map((id, k) => (id === 'charmander' ? { ...C.pokemonAt('charmander', 8), uid: 'c2-zard' } : id === 'squirtle' ? { ...C.pokemonAt('squirtle', 7), uid: 'c2-blast' } : card(id, k)));`);
await settle();
const holos = await page.evaluate(() => document.querySelectorAll('.cd-holo').length);
const measure = () => page.evaluate(() => new Promise((res) => {
  const t = [];
  let prev = performance.now();
  const end = prev + 3000;
  const tick = (now) => { t.push(now - prev); prev = now; if (now < end) requestAnimationFrame(tick); else { t.sort((a, b) => a - b); res({ frames: t.length, mean: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)], max: t.at(-1) }); } };
  requestAnimationFrame(tick);
}));
const idle = await measure();
const zb = await (await page.$('.v4-hand .v4-hcard[data-uid="c2-zard"]')).boundingBox();
const moving = page.evaluate(() => 0);
const [moveStats] = await Promise.all([measure(), (async () => { for (let i = 0; i < 60; i++) { await page.mouse.move(zb.x + 20 + (i % 20) * 8, zb.y + 40 + (i % 7) * 10); await page.waitForTimeout(40); } })()]);
void moving;
// The same, with the holo layers removed (the baseline: what the finish itself costs).
await page.mouse.move(960, 20);
await page.evaluate(() => { const st = document.createElement('style'); st.id = 'noholo'; st.textContent = '.cd-holo{display:none!important}.cd-full{transform:none!important}'; document.head.append(st); });
await page.waitForTimeout(300);
const base = await measure();
await page.evaluate(() => document.getElementById('noholo').remove());
const fmt = (m) => `${m.frames} frames in 3 s · mean ${m.mean.toFixed(1)} ms · p95 ${m.p95.toFixed(1)} ms · max ${m.max.toFixed(1)} ms`;
console.log(`holo cards on screen: ${holos}`);
console.log(`baseline, holo removed: ${fmt(base)}`);
console.log(`idle: ${fmt(idle)}`);
console.log(`pointer moving over a holo card (tilt and sheen): ${fmt(moveStats)}`);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
