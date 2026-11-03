// V4 — card types: Strategy Cards with breakpoints, Supporters (Release, self-Release,
// Favour, no limit), Items (the Bag, Location rewards, use, Held and Consumed, deck
// cards), statuses (Burn on Pokémon and player characters, Sleep, Leech Seed, Douse,
// Full Heal), Weather brackets, and the AI playing them (with a report).
// Run with: node v2/tests/cardtypes.test.js
import assert from 'node:assert/strict';
import {
  actor, createGame, applyAction, legalActions, breakpointsFor, targetOptions, favourMet, bracket, PLAYERS,
} from '../src/engine/game.js';
import { cardDef, TEST_DECK, deckProblems } from '../src/engine/cards.js';
import { STRATEGIES, SUPPORTERS, ITEMS, BAG_SIZE, costRange } from '../src/engine/cardtypes.js';
import { pokemonAt } from '../src/engine/series.js';
import { RECOGNITION_TARGET, HAND_SIZE } from '../src/engine/rules.js';
import { chooseAction } from '../src/ai/opponent.js';

function battle(round = 1, seed = 5) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'flipCoin' });
  s.round = round;
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) Object.assign(s.players[who], { energy: 10, hand: [] });
  return s;
}
let n = 0;
const give = (s, who, id) => { const card = { ...cardDef(id), uid: `${who}-g${n++}` }; s.players[who].hand.push(card); return card.uid; };
function place(s, who, space, series, level = 3, extra = {}) {
  const card = { ...pokemonAt(series, level), cap: 6, uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: false, ...extra };
  return s.players[who].row[space];
}
const act = (s, a) => applyAction(s, a);
const other = (who) => (who === 'player' ? 'ai' : 'player');
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: other(s.turn) });
const mon = (who, space) => ({ who, kind: 'pokemon', space });
const pc = (who) => ({ who, kind: 'player' });
// A Location with Weather in play (for the brackets): Rain or Sun at `count`.
function weather(s, kind, count) {
  s.locations.push({ uid: `w-${n++}`, id: 'test', name: 'Weather', lanes: [], roundsLeft: 9, weather: { [kind]: count }, objective: { kind: 'summon', count: 9 }, milestones: [], completion: {}, progress: { player: 0, ai: 0 }, reached: { player: [], ai: [] }, completed: { player: false, ai: false } });
}

// --- Strategy Cards: breakpoints -------------------------------------------------------------------

{
  const ember = cardDef('ember');
  assert.deepEqual(ember.breakpoints.map((b) => b.cost), [2, 4, 6]);
  assert.equal(costRange(ember), '2–6');
  // Only affordable breakpoints (with a target) can be paid.
  let s = battle();
  s.players.player.energy = 4;
  assert.deepEqual(breakpointsFor(s, 'player', ember).map((b) => b.cost), [2, 4]);
  let uid = give(s, 'player', 'ember');
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 3, targets: [pc('ai')] }), /can only be paid 2, 4, 6/, 'only a breakpoint amount');
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 6 }), /Not enough Energy/);
  // 2: Burn 2 one target (an enemy Pokémon or the enemy player).
  place(s, 'ai', 3, 'horsea');
  let t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [mon('ai', 3)] });
  assert.deepEqual([t.players.ai.row[3].burn, t.players.player.energy, t.turn], [2, 2, 'ai']);
  assert.ok(t.players.player.discard.some((c) => c.id === 'ember'), 'to the discard pile');
  assert.ok(t.events.some((e) => e.type === 'strategy' && e.pay === 2 && e.level === 0));
  // 4: two targets, and the enemy player loses 1 Recognition.
  s.players.ai.recognition = 5;
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [mon('ai', 3), pc('ai')] }), /Choose a target/, 'one target at 2');
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 4, targets: [mon('ai', 3), pc('ai')] });
  assert.deepEqual([t.players.ai.row[3].burn, t.players.ai.burn, t.players.ai.recognition], [2, 2, 4]);
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 4, targets: [pc('ai'), pc('ai')] }), /different targets/);
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [mon('player', 0)] }), /not a legal target/, 'enemies only');
  // 6: every enemy (no choice).
  place(s, 'ai', 5, 'growlithe');
  s.players.player.energy = 6;
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 6 });
  assert.deepEqual([t.players.ai.row[3].burn, t.players.ai.row[5].burn, t.players.ai.burn, t.players.ai.recognition, t.players.player.energy], [2, 2, 2, 3, 0], '6: every enemy, and −2 Recognition');
  s.players.ai.recognition = 1;
  assert.equal(act(s, { type: 'playStrategy', who: 'player', uid, pay: 6 }).players.ai.recognition, 0, 'never below 0');
  // Damage scaling: Thunderbolt 1: 2 · 3: 7 · 5: 7 to two.
  s = battle();
  place(s, 'ai', 0, 'sudowoodo', 6);   // 4/10
  place(s, 'ai', 1, 'horsea', 6);      // 7/9
  uid = give(s, 'player', 'thunderbolt');
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 1, targets: [mon('ai', 0)] });
  assert.equal(t.players.ai.row[0].currentStrength, 8);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 3, targets: [mon('ai', 0)] });
  assert.equal(t.players.ai.row[0].currentStrength, 3);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 5, targets: [mon('ai', 0), mon('ai', 1)] });
  assert.deepEqual([t.players.ai.row[0].currentStrength, t.players.ai.row[1].currentStrength], [3, 2]);
  // Effect damage defeats.
  place(s, 'ai', 2, 'sneasel', 1);   // 2/3
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 1, targets: [mon('ai', 2)] });
  assert.equal(t.players.ai.row[2].currentStrength, 1);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 3, targets: [mon('ai', 2)] });
  assert.equal(t.players.ai.row[2], null);
  // Heal scaling: Recover 1: heal 2 · 3: heal 4 + Douse two · 5: heal 6 all + Douse all + draw 1.
  s = battle();
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 2, burn: 3 });   // 6/8
  place(s, 'player', 1, 'horsea', 5, { currentStrength: 7 });
  s.players.player.burn = 2;
  uid = give(s, 'player', 'recover');
  assert.deepEqual(targetOptions(s, 'player', cardDef('recover').breakpoints[0].target).map((x) => x.space), [0, 1], 'damaged friendly Pokémon');
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 1, targets: [mon('player', 0)] });
  assert.deepEqual([t.players.player.row[0].currentStrength, t.players.player.row[0].burn], [4, 3]);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 3, targets: [mon('player', 0), mon('player', 1)] });
  assert.deepEqual([t.players.player.row[0].currentStrength, t.players.player.row[0].burn, t.players.player.row[1].currentStrength], [6, 0, 8], 'heal 4, Douse; never above its Strength');
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 5 });
  assert.deepEqual([t.players.player.row[0].currentStrength, t.players.player.burn, t.players.player.hand.length], [8, 0, 1], 'heal 6 all; Douse your player character too; draw 1');
  // Draw scaling: Quickdraw 1: draw 1 · 3: draw 3 and +1 Energy · 5: draw 5 and +2 Energy.
  s = battle();
  uid = give(s, 'player', 'quickdraw');
  assert.equal(act(s, { type: 'playStrategy', who: 'player', uid, pay: 1 }).players.player.hand.length, 1);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 3 });
  assert.deepEqual([t.players.player.hand.length, t.players.player.bonusNext], [3, 1]);
  t = act(s, { type: 'playStrategy', who: 'player', uid, pay: 5 });
  assert.deepEqual([t.players.player.hand.length, t.players.player.bonusNext], [5, 2]);
  // Elliott's rule: every higher breakpoint gives more value per Energy than the one
  // below. One scale: 1 per damage, heal, Burn counter or Recognition point; 2 per card
  // drawn; 1.5 per Energy next Round; "every" counted as two Pokémon (and the player).
  const value = {
    thunderbolt: [2, 7, 7 * 2],
    ember: [2, 2 * 2 + 1, 2 * 3 + 2],
    recover: [2, 4 * 2, 6 * 2 + 2],
    quickdraw: [2, 3 * 2 + 1.5, 5 * 2 + 2 * 1.5],
  };
  for (const [id, values] of Object.entries(value)) {
    const per = cardDef(id).breakpoints.map((b, i) => values[i] / b.cost);
    assert.ok(per.every((v, i) => i === 0 || v > per[i - 1]), `${id}: value per Energy rises (${per.map((v) => v.toFixed(2)).join(' < ')})`);
  }
  // A card without a target can't be played (Thunderbolt with no enemy Pokémon).
  s = battle();
  give(s, 'player', 'thunderbolt');
  assert.equal(legalActions(s, 'player').includes('playStrategy'), false);
}

// --- Single-cost cards ---------------------------------------------------------------------------------

{
  for (const id of ['sleep-powder', 'leech-seed']) {
    assert.equal(cardDef(id).breakpoints.length, 1);
    assert.equal(costRange(cardDef(id)), '2');
  }
  let s = battle();
  place(s, 'ai', 0, 'growlithe', 3);
  const uid = give(s, 'player', 'sleep-powder');
  assert.throws(() => act(s, { type: 'playStrategy', who: 'player', uid, pay: 3, targets: [mon('ai', 0)] }), /can only be paid 2/);
  s = act(s, { type: 'playStrategy', who: 'player', uid, pay: 2, targets: [mon('ai', 0)] });
  assert.deepEqual([s.players.ai.row[0].asleep, s.players.ai.row[0].spent], [true, true]);
}

// --- Statuses: Sleep, Leech Seed, Burn (Pokémon and player characters), Douse, Full Heal ------------

{
  // Sleep: stays Spent at the next Breakfast, then wakes; damage wakes it at once.
  let s = battle();
  place(s, 'ai', 0, 'growlithe', 3);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'sleep-powder'), pay: 2, targets: [mon('ai', 0)] });
  s.turn = 'player';
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].spent, s.players.ai.row[0].asleep], [true, false], 'misses one Round');
  s = passBoth(s);
  assert.equal(s.players.ai.row[0].spent, false, 'Active again the Breakfast after');
  s = battle();
  place(s, 'ai', 0, 'sudowoodo', 4, { asleep: true, spent: true });
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'thunderbolt'), pay: 1, targets: [mon('ai', 0)] });
  assert.deepEqual([s.players.ai.row[0].asleep, s.players.ai.row[0].spent], [false, true], 'damage wakes it; it stays Spent this Round');
  // Leech Seed: 1 damage at Supper, healing the seeder's most-damaged Pokémon 1; one seed each.
  s = battle();
  place(s, 'ai', 0, 'sudowoodo', 4);
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 5 });
  place(s, 'player', 1, 'horsea', 5, { currentStrength: 7 });
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'leech-seed'), pay: 2, targets: [mon('ai', 0)] });
  assert.equal(s.players.ai.row[0].seededBy, 'player');
  s.turn = 'player';
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].currentStrength, s.players.player.row[0].currentStrength, s.players.player.row[1].currentStrength], [7, 6, 7]);
  // Burn on a Pokémon: damage at Supper, then 1 less.
  s = battle();
  place(s, 'ai', 0, 'sudowoodo', 4, { burn: 3 });
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].currentStrength, s.players.ai.row[0].burn], [5, 2]);
  // Burn on a player character removes that much Recognition at Supper, never below 0.
  s = battle();
  s.players.ai.recognition = 10;
  s.players.player.recognition = 1;
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'ember'), pay: 2, targets: [pc('ai')] });
  s.players.player.burn = 3;
  s.turn = 'player';
  s = passBoth(s);
  assert.deepEqual([s.players.ai.recognition, s.players.ai.burn, s.players.player.recognition, s.players.player.burn], [8, 1, 0, 2], '10 − 2; 1 − 3 stops at 0');
  assert.ok(s.events.some((e) => e.type === 'burnRecognition' && e.who === 'ai' && e.amount === 2));
  s = passBoth(s);
  assert.deepEqual([s.players.ai.recognition, s.players.ai.burn], [7, 0]);
  // Full Heal (an Item): cures all statuses and heals 2.
  s = battle();
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 3, burn: 2, asleep: true, spent: true, seededBy: 'ai' });
  s = act(s, { type: 'playItem', who: 'player', uid: give(s, 'player', 'full-heal'), mode: 'use', targets: [mon('player', 0)] });
  const h = s.players.player.row[0];
  assert.deepEqual([h.burn, h.asleep, h.seededBy, h.currentStrength], [0, false, null, 5]);
}

// --- Weather brackets (docs/decks.md 2.12, without Growth and Evolve) --------------------------------

{
  // Sun 2: each Burn applied +1.
  let s = battle();
  weather(s, 'Sun', 2);
  place(s, 'ai', 0, 'sudowoodo', 4);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'ember'), pay: 2, targets: [mon('ai', 0)] });
  assert.equal(s.players.ai.row[0].burn, 3);
  // Sun 8, Drought: no healing (Rain 2 can't help).
  s = battle();
  weather(s, 'Sun', 8);
  weather(s, 'Rain', 2);
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 3 });
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'recover'), pay: 1, targets: [mon('player', 0)] });
  assert.equal(s.players.player.row[0].currentStrength, 3);
  // Rain 2: each heal +1.
  s = battle();
  weather(s, 'Rain', 2);
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 3 });
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'recover'), pay: 1, targets: [mon('player', 0)] });
  assert.equal(s.players.player.row[0].currentStrength, 6);
  // Rain 4: Burn deals 1 less at Supper (Recognition too).
  s = battle();
  weather(s, 'Rain', 4);
  place(s, 'ai', 0, 'sudowoodo', 4, { burn: 3 });
  s.players.ai.recognition = 10;
  s.players.ai.burn = 3;
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].currentStrength, s.players.ai.recognition], [6, 8]);
  // Rain 6: Leech Seed drains 2 (and heals 2, +1 at Rain 2).
  s = battle();
  weather(s, 'Rain', 6);
  place(s, 'ai', 0, 'sudowoodo', 4, { seededBy: 'player' });
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 2 });
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].currentStrength, s.players.player.row[0].currentStrength], [6, 5]);
  // Rain 8, Downpour: all Burn is removed before it deals damage.
  s = battle();
  weather(s, 'Rain', 8);
  place(s, 'ai', 0, 'sudowoodo', 4, { burn: 3 });
  s.players.ai.recognition = 10;
  s.players.ai.burn = 2;
  s = passBoth(s);
  assert.deepEqual([s.players.ai.row[0].currentStrength, s.players.ai.row[0].burn, s.players.ai.recognition], [8, 0, 10]);
  assert.equal(bracket(s, 'Rain', 8), true);
}

// --- Supporters: Release costs, self-Release, Favour, no limit -----------------------------------------

{
  let s = battle();
  const oak = give(s, 'player', 'professor-oak');   // Release 1: draw 3 · Favour (a Location): draw 4
  const horsea = give(s, 'player', 'horsea');
  const cape = give(s, 'player', 'cerulean-cape');
  assert.throws(() => act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [] }), /Release exactly 1 card/);
  assert.throws(() => act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [horsea, cape] }), /Release exactly 1 card/);
  assert.throws(() => act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [oak] }), /not the Supporter itself/);
  let t = act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [horsea] });
  const p = t.players.player;
  assert.deepEqual([p.hand.length, p.released.map((c) => c.id).sort(), p.energy], [1 + 3, ['horsea', 'professor-oak'], 10], 'Released Horsea and itself; drew 3; no Energy');
  assert.ok(t.events.some((e) => e.type === 'supporter' && !e.favour));
  t = act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [cape] });
  assert.deepEqual([t.players.player.hand.length, t.events.find((e) => e.type === 'supporter').favour], [1 + 4, true], 'Favour: a Location Released: draw 4');
  // Ash: Release 2: +3 Recognition · Favour (a Pokémon of Level 4+): +6, and 60 still wins.
  s = battle(5);
  const ash = give(s, 'player', 'ash');
  const a = give(s, 'player', 'horsea');   // cardDef: Level 1
  const b = give(s, 'player', 'oddish');
  const big = s.players.player.hand.length;
  s.players.player.hand.push({ ...pokemonAt('growlithe', 5), cap: 6, uid: 'big' });
  assert.equal(act(s, { type: 'playSupporter', who: 'player', uid: ash, release: [a, b] }).players.player.recognition, 3);
  assert.equal(act(s, { type: 'playSupporter', who: 'player', uid: ash, release: [a, 'big'] }).players.player.recognition, 6);
  assert.ok(big > 0 && favourMet(cardDef('ash'), [pokemonAt('growlithe', 5)]));
  s.players.player.recognition = RECOGNITION_TARGET - 3;
  assert.equal(act(s, { type: 'playSupporter', who: 'player', uid: ash, release: [a, b] }).winner, 'player');
  // Not enough other cards to Release: can't be played.
  s = battle();
  give(s, 'player', 'ash');
  give(s, 'player', 'horsea');
  assert.equal(legalActions(s, 'player').includes('playSupporter'), false);
  // Pokémon Breeder (board): train 1 a chosen Pokémon and heal it 2; Favour (a Grass Pokémon): train 2, heal 3.
  s = battle();
  place(s, 'player', 0, 'horsea', 2, { currentStrength: 2 });
  const breeder = give(s, 'player', 'pokemon-breeder');
  const grass = give(s, 'player', 'oddish');
  t = act(s, { type: 'playSupporter', who: 'player', uid: breeder, release: [grass], targets: [mon('player', 0)] });
  assert.deepEqual([t.players.player.row[0].level, t.players.player.row[0].name, t.players.player.row[0].currentStrength], [4, 'Seadra', 7 - 3 + 3], 'Favour: train 2 (damage carries over), heal 3');
  // No once-per-Round limit: two Supporters in one Round.
  s = battle();
  const o1 = give(s, 'player', 'professor-oak');
  const o2 = give(s, 'player', 'professor-oak');
  const x1 = give(s, 'player', 'horsea');
  const x2 = give(s, 'player', 'horsea');
  s = act(s, { type: 'playSupporter', who: 'player', uid: o1, release: [x1] });
  s.turn = 'player';
  s = act(s, { type: 'playSupporter', who: 'player', uid: o2, release: [x2] });
  assert.equal(s.players.player.released.filter((c) => c.id === 'professor-oak').length, 2);
}

// --- Items: the Bag, rewards, use, Held and Consumed, deck cards ------------------------------------------

{
  assert.equal(ITEMS.length, 6);
  assert.deepEqual(ITEMS.map((i) => i.kind).sort(), ['Consumed', 'Consumed', 'Consumed', 'Consumed', 'Held', 'Held']);
  let s = battle();
  assert.deepEqual([s.players.player.bag, s.itemPool.length, BAG_SIZE], [[], 6, 6], 'an empty Bag; one of each Item in the pool');
  // A Location reward finds an Item: from the pool into the Bag.
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'eterna-forest'), start: 0 });
  place(s, 'player', 1, 'growlithe', 5);
  for (let i = 0; i < 2; i++) {
    s.turn = 'player';
    s.players.player.row[1].spent = false;
    s = act(s, { type: 'attack', who: 'player', from: 1, target: pc('ai') });
  }
  assert.deepEqual([s.players.player.bag.length, s.itemPool.length], [1, 5]);
  assert.ok(s.events.some((e) => e.type === 'itemFound'));
  // A full Bag finds nothing.
  s.players.player.bag = Array.from({ length: BAG_SIZE }, (_, i) => ({ ...cardDef('oran-berry'), uid: `b${i}` }));
  const pool = s.itemPool.length;
  s.locations[0].reached.player = [];
  s.locations[0].progress.player = 0;
  for (let i = 0; i < 2; i++) {
    s.turn = 'player';
    s.players.player.row[1].spent = false;
    s = act(s, { type: 'attack', who: 'player', from: 1, target: pc('ai') });
  }
  assert.deepEqual([s.players.player.bag.length, s.itemPool.length], [BAG_SIZE, pool]);
  // Using an Item from the Bag: a Battle Action, cost 0; a Consumed Item goes back to the pool.
  s = battle();
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 3 });
  s.players.player.bag = [{ ...cardDef('oran-berry'), uid: 'b1' }];
  s.players.player.energy = 0;
  s = act(s, { type: 'useItem', who: 'player', uid: 'b1', targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.row[0].currentStrength, s.players.player.bag.length, s.turn], [6, 0, 'ai']);
  assert.ok(s.itemPool.some((c) => c.id === 'oran-berry'), 'back into the shared pool');
  // Held: attaches; one per Pokémon (the old one goes to the pool); lost with its Pokémon.
  s = battle();
  place(s, 'player', 0, 'horsea', 5);   // 6/8
  s.players.player.bag = [{ ...cardDef('choice-band'), uid: 'h1' }, { ...cardDef('leftovers'), uid: 'h2' }];
  s = act(s, { type: 'useItem', who: 'player', uid: 'h1', targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].held.id], [8, 'choice-band'], 'Held: +2 Attack');
  s.turn = 'player';
  s = act(s, { type: 'useItem', who: 'player', uid: 'h2', targets: [mon('player', 0)] });
  const holder = s.players.player.row[0];
  assert.deepEqual([holder.attack, holder.held.id, holder.keywords.includes('Regenerate 1')], [6, 'leftovers', true], 'replaced: the old bonus is gone');
  assert.ok(s.itemPool.some((c) => c.id === 'choice-band'));
  // Regenerate 1 heals at Breakfast.
  holder.currentStrength = 5;
  s = passBoth(s);
  assert.equal(s.players.player.row[0].currentStrength, 6);
  // A trained Pokémon keeps its Held Item's bonus.
  s = battle();
  place(s, 'player', 0, 'horsea', 2);
  s.players.player.bag = [{ ...cardDef('choice-band'), uid: 'h3' }];
  s = act(s, { type: 'useItem', who: 'player', uid: 'h3', targets: [mon('player', 0)] });
  s.turn = 'player';
  s = act(s, { type: 'playSupporter', who: 'player', uid: give(s, 'player', 'pokemon-breeder'), release: [give(s, 'player', 'horsea')], targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.row[0].name, s.players.player.row[0].attack], ['Seadra', 4 + 2]);
  // Lost when its Pokémon is defeated: to the pool.
  s = battle();
  place(s, 'ai', 0, 'sneasel', 1, { held: { ...cardDef('choice-band') } });
  const poolBefore = s.itemPool.length;
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'thunderbolt'), pay: 3, targets: [mon('ai', 0)] });
  assert.equal(s.itemPool.length, poolBefore + 1);
  // Energy Item (+1 now) and draw Item (draw 2).
  s = battle();
  s.players.player.bag = [{ ...cardDef('amulet-coin'), uid: 'e1' }, { ...cardDef('field-notes'), uid: 'd1' }];
  s.players.player.energy = 0;
  assert.equal(act(s, { type: 'useItem', who: 'player', uid: 'e1' }).players.player.energy, 1);
  assert.equal(act(s, { type: 'useItem', who: 'player', uid: 'd1' }).players.player.hand.length, 2);
}
{
  // Item deck cards: an Energy cost; used at once, or into the Bag.
  let s = battle();
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 3 });
  const berry = give(s, 'player', 'oran-berry');   // cost 1
  s.players.player.energy = 0;
  assert.throws(() => act(s, { type: 'playItem', who: 'player', uid: berry, mode: 'use', targets: [mon('player', 0)] }), /cannot playItem|Not enough Energy/);
  s.players.player.energy = 2;
  let t = act(s, { type: 'playItem', who: 'player', uid: berry, mode: 'use', targets: [mon('player', 0)] });
  assert.deepEqual([t.players.player.row[0].currentStrength, t.players.player.energy, t.players.player.hand.length], [6, 1, 0]);
  t = act(s, { type: 'playItem', who: 'player', uid: berry, mode: 'bag' });
  assert.deepEqual([t.players.player.bag.map((c) => c.id), t.players.player.energy], [['oran-berry'], 1]);
  s.players.player.bag = Array.from({ length: BAG_SIZE }, (_, i) => ({ ...cardDef('field-notes'), uid: `f${i}` }));
  assert.throws(() => act(s, { type: 'playItem', who: 'player', uid: berry, mode: 'bag' }), /Bag is full/);
  // Full Heal has Retain: kept in hand at Supper.
  s = battle();
  const kept = give(s, 'player', 'full-heal');
  s = passBoth(s);
  assert.ok(s.players.player.hand.some((c) => c.uid === kept), 'kept');
  assert.equal(s.players.player.hand.length, 1 + HAND_SIZE);
  // The premade deck has every card type.
  assert.deepEqual(deckProblems(TEST_DECK), []);
  const types = new Set(TEST_DECK.map((e) => cardDef(e.card ?? e.location ?? e.series).cardType));
  assert.deepEqual([...types].sort(), ['Item', 'Location', 'Pokémon', 'Strategy', 'Supporter', 'Trainer']);
}

// --- The AI: breakpoints, Supporters with Favour, Items; AI-vs-AI matches finish ------------------------

{
  // It pays the breakpoint that's worth it: Ember 6 on three enemies, rather than 2.
  let s = battle();
  s.turn = 'ai';
  place(s, 'player', 0, 'horsea', 3);
  place(s, 'player', 1, 'growlithe', 3);
  s.players.ai.energy = 6;
  give(s, 'ai', 'ember');
  let m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.pay], ['playStrategy', 6]);
  // A Supporter with Favour: Professor Oak Releasing the Location (no room for it).
  s = battle(9);
  s.turn = 'ai';
  s.players.ai.energy = 0;
  give(s, 'ai', 'professor-oak');
  give(s, 'ai', 'kyogre');
  const loc = give(s, 'ai', 'route-119');
  m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.release], ['playSupporter', [loc]]);
  // An Item from the Bag: Oran Berry on its damaged Pokémon.
  s = battle();
  s.turn = 'ai';
  s.players.ai.energy = 0;
  place(s, 'ai', 0, 'horsea', 5, { currentStrength: 2, spent: true });
  s.players.ai.bag = [{ ...cardDef('oran-berry'), uid: 'b1' }];
  m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.uid], ['useItem', 'b1']);
}
{
  const N = 40;
  const levels = {};
  let supporters = 0;
  let favours = 0;
  let found = 0;
  let used = 0;
  let bagged = 0;
  const ends = {};
  for (let seed = 1; seed <= N; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 6000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      assert.ok(legalActions(s, who).includes(action.type), action.type);
      s = applyAction(s, action);
      for (const e of s.events) {
        if (e.type === 'strategy') {
          const key = `${e.name} ${e.pay}`;
          levels[key] = (levels[key] ?? 0) + 1;
        }
        if (e.type === 'supporter') { supporters += 1; if (e.favour) favours += 1; }
        if (e.type === 'itemFound') found += 1;
        if (e.type === 'itemUsed') used += 1;
        if (e.type === 'bagged') bagged += 1;
      }
    }
    assert.equal(s.phase, 'gameOver', `seed ${seed} finishes`);
    const why = s.result.reason === 'target' ? (s.round < 10 ? '60 early' : '60 in the Championship') : s.result.reason;
    ends[why] = (ends[why] ?? 0) + 1;
  }
  assert.ok(supporters > 0 && used > 0 && found > 0, 'the AI plays Supporters and uses Items');
  const byCard = {};
  for (const [key, x] of Object.entries(levels)) {
    const [name, pay] = [key.slice(0, key.lastIndexOf(' ')), key.slice(key.lastIndexOf(' ') + 1)];
    (byCard[name] ??= []).push(`${pay}: ${x}`);
  }
  console.log(`${N} AI-vs-AI matches. Breakpoints chosen: ${Object.entries(byCard).map(([name, list]) => `${name} (${list.sort().join(', ')})`).join('; ')}.`);
  console.log(`Supporters per match ${(supporters / N).toFixed(2)} (${Math.round((100 * favours) / Math.max(1, supporters))}% with Favour); Items found ${(found / N).toFixed(2)}, put in the Bag from hand ${(bagged / N).toFixed(2)}, used ${(used / N).toFixed(2)} per match.`);
  console.log(`Match ends: ${Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
}

console.log('All v2 card type tests passed.');
