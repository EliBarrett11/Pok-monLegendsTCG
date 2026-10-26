// Checks what the resource panels and the PokéMart show (Feedback batch 2),
// from the game state alone: the five panel sections (Energy, Exert pips with
// their recovery counts, XP, PokéDollars, Bag slots with In Delivery), and
// for each Item on sale whether it can be bought now, or why not. No DOM.
// Run with: node tests/panels.test.js
import assert from 'node:assert/strict';
import { panelView, pipTip, martView } from '../src/ui/resources.js';
import { applyAction, openBagOptions, BAG_SIZE } from '../src/engine/game.js';
import { payCost } from '../src/engine/energy.js';
import { cardDefinition } from '../src/engine/cards.js';
import { battle, onTurn } from './fixtures.js';

let n = 0;
const item = (id, extras = {}) => ({ ...cardDefinition(id), uid: `t-item-${n++}`, ...extras });

// --- The panel ---------------------------------------------------------------------------

{
  const s = battle();
  const p = s.players.player;
  s.round = 4;
  Object.assign(p, { baseEnergy: 3, exertMax: 3, exhaust: [], xp: 4, dollars: 3 });
  p.bag = [item('full-heal'), item('x-attack', { inDelivery: true })];
  payCost(p, 5, 4);   // 3 Base, then 2 Exert: positions 1 and 2, recovering in Rounds 6 and 7
  const v = panelView(s, 'player');
  assert.deepEqual([v.energy.value, v.energy.max], [0, 4], 'Energy: current / this Round\'s Base Energy');
  assert.deepEqual([v.exert.ready, v.exert.max], [1, 3], 'Exert: 1 ready of 3');
  assert.deepEqual(v.exert.pips, [
    { state: 'ready' },
    { state: 'exhausted', breakfasts: 2, recoversRound: 6 },
    { state: 'exhausted', breakfasts: 3, recoversRound: 7 },
  ], 'Exhausted pips count the Breakfasts until they recover, soonest first');
  assert.equal(pipTip(v.exert.pips[1]), 'Exhausted: recovers in 2 Breakfasts (Round 6)');
  assert.equal(v.xp.value, 4);
  assert.equal(v.dollars.value, 3);
  assert.deepEqual([v.bag.count, v.bag.size, v.bag.full], [2, 6, false]);
  assert.equal(v.bag.slots.length, BAG_SIZE, 'six slots');
  assert.deepEqual(v.bag.slots.slice(0, 2).map((x) => [x.name, x.inDelivery]), [['Full Heal', false], ['X Attack', true]]);
  assert.ok(v.bag.slots.slice(2).every((x) => x === null), 'the rest are empty');
  for (const k of ['energy', 'exert', 'xp', 'dollars', 'bag']) assert.ok(v[k].tip.length > 20, `${k} has a one-line tooltip`);
  assert.match(v.bag.tip, /1 In Delivery/);
}
{
  // Round 1: one Exert point, the other two locked until Rounds 2 and 3.
  const s = battle();
  const v = panelView(s, 'ai');
  assert.deepEqual(v.exert.pips.map((x) => x.state), ['ready', 'locked', 'locked']);
  assert.deepEqual(v.exert.pips.slice(1).map((x) => x.unlocksRound), [2, 3]);
  assert.equal(pipTip(v.exert.pips[2]), 'Locked until Round 3');
  assert.equal(v.energy.max, 1);
}

// --- The PokéMart ------------------------------------------------------------------------------

{
  const s = onTurn(battle(), 'player');
  const p = s.players.player;
  s.mart.onSale = [item('full-heal'), item('x-attack'), null];
  p.dollars = 1;
  const v = martView(s);
  assert.equal(v.onSale, 2);
  assert.equal(v.inStock, s.mart.deck.length);
  assert.deepEqual([v.slots[0].canBuy, v.slots[0].note], [true, 'Goes to your Bag, In Delivery']);
  assert.deepEqual([v.slots[1].canBuy, v.slots[1].reason], [false, 'Need $2: you have $1']);
  assert.deepEqual([v.slots[2].sold, v.slots[2].label], [true, 'Sold'], 'an empty slot is Sold until Breakfast');
  // Buy enabled exactly when the engine offers that purchase.
  const offered = openBagOptions(s, 'player').filter((o) => o.mode === 'buyMart').map((o) => o.slot);
  assert.deepEqual(v.slots.filter((x) => x.canBuy).map((x) => x.slot), offered);
  // A full Bag.
  p.dollars = 9;
  p.bag = Array.from({ length: BAG_SIZE }, () => item('full-heal'));
  assert.deepEqual(martView(s).slots.slice(0, 2).map((x) => x.reason), ['Bag full', 'Bag full']);
  // Not my turn.
  p.bag = [];
  s.turn = 'ai';
  assert.equal(martView(s).slots[0].reason, 'Only on your turn in the Battle Phase');
  assert.equal(martView(s).canBuyAny, false);
  // The AI's view of the same PokéMart: its own money and turn.
  s.players.ai.dollars = 2;
  assert.equal(martView(s, 'ai').slots[1].canBuy, true);
}
{
  // Buying (the same Open Bag action as before) empties the slot: Sold, and In Delivery in the Bag.
  let s = onTurn(battle(), 'player');
  s.mart.onSale = [item('full-heal'), null, null];
  s.players.player.dollars = 3;
  s = applyAction(s, { type: 'openBag', who: 'player', mode: 'buyMart', slot: 0 });
  assert.equal(martView(s).slots[0].sold, true);
  const bag = panelView(s, 'player').bag;
  assert.deepEqual([bag.count, bag.slots[0].name, bag.slots[0].inDelivery], [1, 'Full Heal', true]);
  assert.equal(panelView(s, 'player').dollars.value, 2);
}
{
  // Before Round 1 the PokéMart isn't open.
  const s = battle();
  s.round = 0;
  s.mart.onSale = [null, null, null];
  assert.deepEqual(martView(s).slots.map((x) => x.label), ['Opens in Round 1', 'Opens in Round 1', 'Opens in Round 1']);
}

console.log('All resource panel and PokéMart tests passed.');
