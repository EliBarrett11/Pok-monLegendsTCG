// G2 browser check: node v4/tools/g2check.mjs [out-dir] (a server must serve the repository root at
// http://localhost:8123/). In Chromium (Playwright), at Normal speed (beats stretched by ?timescale so a
// software renderer can be screenshotted mid-beat):
//   - a hand showing several new Pokémon (keyword chips, trigger lines);
//   - a chosen-target On Summon by the player: the targeting prompt and preview, then the click;
//   - an On Knockout chain (Luxio defeats Magby: On Knockout, then Magby's On Defeated hits back);
//   - Retaliate defeating an attacker (keyword callouts);
//   - the Electric Physical attack (Luxray);
// and no page errors.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { realInput } from './realinput.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.argv[2] ?? 'g2-shots';
const BASE = process.env.V4_URL ?? 'http://localhost:8123/v4/';
const TS = Number(process.env.TIMESCALE ?? 3);
mkdirSync(OUT, { recursive: true });
const results = [];
const report = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` · ${info}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}?debug&seed=7&speed=normal&timescale=${TS}`);
await page.waitForFunction(() => window.__v4 && window.__v4.webgl !== undefined, null, { timeout: 20000 });
const sfxSeen = (name) => page.waitForFunction((n) => window.__v4.played.some((x) => x.name === n), name, { timeout: 90000 });
const input = realInput(page);
const idle = () => page.waitForFunction(() => !window.__v4.isPresenting(), null, { timeout: 90000 });

// A staged board: rows as given, empty hands for the Opponent (no React), the player's turn.
async function stage(src) {
  await page.evaluate(async (code) => {
    const C = await import('/v4/src/engine/cards.js');
    window.__v4.fastForward(3);
    window.__v4.set((s) => {
      const mon = (id, level, extra = {}) => ({ ...C.pokemonAt(id, level), uid: `g2-${id}-${Math.random().toString(36).slice(2, 6)}`, currentStrength: C.pokemonAt(id, level).strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra });
      const hand = (id, level) => ({ ...C.pokemonAt(id, level), uid: `h-${id}-${level}` });
      for (const w of ['player', 'ai']) s.players[w].row = Array(9).fill(null);
      s.players.ai.hand = [];
      s.strats = [];
      s.locations = [];
      s.tournament = null;
      s.reactWindow = null;
      s.choice = null;
      s.turn = 'player';
      s.passesInARow = 0;
      s.players.player.baseEnergy = 8;
      // eslint-disable-next-line no-new-func
      new Function('s', 'mon', 'hand', 'C', code)(s, mon, hand, C);
    });
    window.__v4.played.length = 0;
  }, src);
  await page.waitForTimeout(300);
}

// 1. A hand showing several new Pokémon.
await stage("s.players.player.hand = [hand('shinx', 1), hand('shinx', 4), hand('horsea', 5), hand('wooper', 3), hand('wooper', 6), hand('magby', 3), hand('magby', 8), hand('squirtle', 5), hand('ponyta', 5)]; s.players.ai.row[3] = mon('growlithe', 4, { spent: true });");
await page.screenshot({ path: `${OUT}/1-hand-new-pokemon.png` });
// C1: Mini cards show one trigger tag each; the Full card on hover shows the keywords and the trigger line.
const chips = await page.evaluate(() => document.querySelectorAll('.v4-hand .cd-chip').length);
const hb = await (await page.$('.v4-hand .v4-hcard[data-uid="h-magby-8"]')).boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + 40, { steps: 2 });
await page.waitForTimeout(200);
const zoom = await page.evaluate(() => ({ kw: document.querySelector('.v4-zoom .cd-kw')?.textContent ?? '', rules: document.querySelector('.v4-zoom .cd-rules')?.textContent ?? '' }));
report('a hand of new Pokémon shows trigger tags; hover shows keywords and the trigger line', chips >= 8 && /On Attack/.test(zoom.rules), `${chips} tags; zoom: "${zoom.kw}" "${zoom.rules.slice(0, 60)}"`);
await page.mouse.move(960, 20);

// 2. A chosen-target On Summon by the player (Horsea: 1 damage to an enemy Pokémon).
await stage("s.players.player.hand = [hand('horsea', 2)]; s.players.ai.row[2] = mon('ponyta', 2, { spent: true }); s.players.ai.row[6] = mon('wooper', 3, { spent: true });");
await input.play({ type: 'summon', who: 'player', uid: 'h-horsea-2', space: 4 });
await page.waitForFunction(() => window.__v4.state.choice?.who === 'player' && !window.__v4.isPresenting(), null, { timeout: 90000 });
await page.waitForTimeout(300);
const promptText = await page.evaluate(() => document.querySelector('.v4-prompt').innerText.replace(/\s+/g, ' '));
const glowing = await page.evaluate(() => document.querySelectorAll('.v4-row.opponent .v4-space.target').length);
const tgt = page.locator('.v4-row.opponent .v4-space[data-space="2"]');
await tgt.hover();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/2-on-summon-target-choice.png` });
const preview = await page.evaluate(() => document.querySelector('.v4-preview')?.innerText.replace(/\s+/g, ' ') ?? '');
await tgt.click();
await page.waitForFunction(() => !window.__v4.state.choice, null, { timeout: 30000 });
await idle();
const ponyta = await page.evaluate(() => window.__v4.state.players.ai.row[2]);
report('chosen-target On Summon: prompt, glowing targets, preview, click', /choose a glowing target/.test(promptText) && glowing === 2 && /Ponyta/.test(preview) && ponyta.currentStrength === ponyta.strength - 1,
  `prompt "${promptText.slice(0, 70)}", ${glowing} targets, preview "${preview.slice(0, 60)}", Ponyta ${ponyta.currentStrength}/${ponyta.strength}`);

// 3. An On Knockout chain: Luxio (Infiltrator; On Knockout: draw 1) defeats Magby (On Defeated: 1 damage to
// each enemy Pokémon in its Location: here its lane, Luxio isn't in it; a Growlithe is placed beside to be hit).
await stage("s.players.player.row[4] = mon('shinx', 4); s.players.ai.row[4] = mon('magby', 3, { currentStrength: 1, spent: true }); s.players.ai.row[0] = mon('wooper', 2, { spent: true }); const loc = { ...C.cardAtRound('route-119', 1) }; s.locations = [{ uid: 'loc-x', owner: 'ai', card: loc, id: loc.id, name: loc.name, art: loc.art, color: loc.color, start: 3, width: 4, roundsLeft: 2, passive: loc.passive, placedRound: s.round }];");
const hand0 = await page.evaluate(() => window.__v4.state.players.player.hand.length);
await input.play({ type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 4 } });
await sfxSeen('trigger');
await page.waitForTimeout(250 * TS);
await page.screenshot({ path: `${OUT}/3-trigger-beat-on-knockout.png` });
await idle();
const chain = await page.evaluate(() => window.__v4.state.events.filter((e) => e.type === 'trigger').map((e) => `${e.name} ${e.on}`));
const luxio = await page.evaluate(() => window.__v4.state.players.player.row[4]);
const hand1 = await page.evaluate(() => window.__v4.state.players.player.hand.length);
report('On Knockout chain: Luxio draws, Magby\'s On Defeated hits back in its Location', chain.join(',') === 'Luxio knockout,Magby defeated' && hand1 === hand0 + 1 && luxio.currentStrength === luxio.strength - 1,
  `${chain.join(' → ')}; hand ${hand0} → ${hand1}; Luxio ${luxio.currentStrength}/${luxio.strength}`);

// 4. Retaliate defeating an attacker: Ponyta (2/2, Strength 1 left) attacks Seadra (Retaliate 1).
await stage("s.players.player.row[1] = mon('ponyta', 1, { currentStrength: 1 }); s.players.ai.row[1] = mon('horsea', 4, { spent: true });");
await input.play({ type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 1 } });
await sfxSeen('keyword');
await page.waitForTimeout(120 * TS);
await page.screenshot({ path: `${OUT}/4-keyword-callouts-retaliate.png` });
await idle();
const ret = await page.evaluate(() => ({ attacker: window.__v4.state.players.player.row[1], kws: window.__v4.played.filter((x) => x.name === 'keyword').map((x) => x.kw) }));
report('Retaliate defeats the attacker (callout shown)', !ret.attacker && ret.kws.includes('Retaliate'), `keywords: ${ret.kws.join(', ')}`);

// 5. Keyword callouts: Shell and Rage (Quagsire with Rage hit by Arcanine; Wartortle's Shell).
await stage("s.players.player.row[2] = mon('growlithe', 6); s.players.ai.row[2] = mon('wooper', 6, { spent: true });");
await input.play({ type: 'attack', who: 'player', from: 2, target: { kind: 'pokemon', space: 2 } });
await sfxSeen('keyword');
await page.waitForTimeout(150 * TS);
await page.screenshot({ path: `${OUT}/5-keyword-callout-rage.png` });
await idle();

// 6. The Electric Physical attack (Luxray).
await stage("s.players.player.row[5] = mon('shinx', 6); s.players.ai.row[5] = mon('magikarp', 8, { spent: true });");
await input.play({ type: 'attack', who: 'player', from: 5, target: { kind: 'pokemon', space: 5 } });
await sfxSeen('attack-electric-physical');
await page.waitForTimeout(330 * TS);
await page.screenshot({ path: `${OUT}/6-electric-physical-luxray.png` });
await idle();
report('Electric Physical attack plays (spark rush)', await page.evaluate(() => window.__v4.played.some((x) => x.name === 'attack-electric-physical')));

report('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\ng2check: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
