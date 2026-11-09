// v4 F4 (Items and Trainers): focused rule tests, no match simulations. Run: node v4/tests/items.test.js
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, whyNot, playReason, buyReason } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, ITEMS, TRAINERS, DEMO_DECK, BAG_SIZE } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/ai.js';

let n = 0;
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id) => ({ ...cardAtRound(id, 1), uid: `c-${n++}` });
const battle = (turn = 'player', energy = 6, dollars = 10) => {
  let s = createGame(9);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = energy; p.exertMax = 0; p.exhaust = []; p.dollars = dollars; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id) => { const c = card(id); s.players[who].hand.push(c); return c.uid; };
const pass = (s) => applyAction(s, { type: 'pass', who: s.turn });
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') s = pass(s); return s; };
const martIds = (s) => [...s.mart.pool, ...s.mart.onSale.filter(Boolean)].map((c) => c.id).sort();
// Put an Item on sale in a PokéMart slot (from the pool).
const stock = (s, id, slot = 0) => {
  const at = s.mart.pool.findIndex((c) => c.id === id);
  const fromSale = s.mart.onSale.findIndex((c) => c?.id === id);
  if (fromSale === slot) return;
  const it = at >= 0 ? s.mart.pool.splice(at, 1)[0] : s.mart.onSale.splice(fromSale, 1, null)[0];
  if (s.mart.onSale[slot]) s.mart.pool.push(s.mart.onSale[slot]);
  s.mart.onSale[slot] = it;
};

// --- The cards ---------------------------------------------------------------------------------------------------------
{
  const V4 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(ITEMS.length, 6);
  assert.ok(ITEMS.filter((c) => c.itemType === 'Held').length >= 2 && ITEMS.filter((c) => c.itemType === 'Consumed').length >= 2);
  assert.equal(ITEMS.filter((c) => DEMO_DECK.includes(c.id)).length, 3, '3 Items in the deck; the others only in the PokéMart');
  for (const c of [...ITEMS, ...TRAINERS, ...TRAINERS.map((t) => t.partner)]) assert.ok(existsSync(join(V4, '..', 'assets/cards', `${c.art}.jpg`)), `${c.name}: art`);
  assert.equal(TRAINERS.filter((c) => DEMO_DECK.includes(c.id)).length, 2);
  assert.equal(BAG_SIZE, 6);
}

// --- PokéDollars: $1 each Breakfast (kept between Rounds); more for defeating an enemy Pokémon ---------------------------------------
{
  let s = createGame(4);
  assert.equal(s.players.player.dollars, 1, 'Round 1 Breakfast: $1');
  assert.equal(s.players.ai.dollars, 1);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { s.players[w].hand = []; s.players[w].row = s.players[w].row.map(() => null); }
  s = nextRound(s);
  assert.equal(s.players.player.dollars, 2, 'carried, +$1');
  // Defeat: its Energy cost at its Level (Wartortle Level 4 costs 2), at least 1 (Ponyta Level 1 costs 0).
  s = battle('player', 6, 0);
  s.players.player.row[0] = mon('growlithe', 7, { spent: false });
  s.players.ai.row[1] = mon('squirtle', 4, { currentStrength: 1 });
  s.players.ai.row[2] = mon('ponyta', 1, { currentStrength: 1 });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 1 } });
  assert.equal(s.players.player.dollars, 2);
  s.turn = 'player';
  s.players.player.row[0].spent = false;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 2 } });
  assert.equal(s.players.player.dollars, 3, 'at least $1');
}

// --- Purchase Item: from hand or the PokéMart; use now or store; the Bag limit; play from the Bag -------------------------------------
{
  // From hand, used now: Potion heals 3; $2 paid; then it goes to the PokéMart's pool.
  let s = battle();
  s.players.player.row[0] = mon('squirtle', 4, { currentStrength: 1 });
  const potion = give(s, 'player', 'potion');
  const poolBefore = s.mart.pool.length;
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: potion, then: 'use', target: { space: 0 } });
  assert.equal(s.players.player.row[0].currentStrength, 4);
  assert.equal(s.players.player.dollars, 8);
  assert.equal(s.players.player.hand.length, 0);
  assert.equal(s.mart.pool.length, poolBefore + 1, 'a used Item returns to the pool');
  assert.equal(s.turn, 'ai', 'a Battle Phase action');
  // From hand, stored.
  s = battle();
  const ch = give(s, 'player', 'charcoal');
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: ch, then: 'store' });
  assert.deepEqual(s.players.player.bag.map((c) => c.id), ['charcoal']);
  assert.equal(s.players.player.dollars, 8);
  // From the PokéMart, stored, then used from the Bag (Play Inventory Item).
  s = battle();
  s.players.player.row[3] = mon('ponyta', 2);
  stock(s, 'mystic-water', 1);
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 1, then: 'store' });
  assert.equal(s.mart.onSale[1], null, 'sold: the slot is empty until Breakfast');
  assert.equal(s.players.player.bag[0].id, 'mystic-water');
  s.turn = 'player';
  const str = s.players.player.row[3].strength;
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[0].uid, target: { space: 3 } });
  assert.equal(s.players.player.bag.length, 0);
  assert.equal(s.players.player.row[3].strength, str + 2, 'Held: +2 Strength');
  assert.equal(s.players.player.row[3].held.id, 'mystic-water');
  // From the PokéMart, used now.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2, { currentStrength: 1 });
  stock(s, 'oran-berry', 0);
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 0, then: 'use', target: { space: 0 } });
  assert.equal(s.players.player.row[0].currentStrength, 3);
  assert.equal(s.players.player.dollars, 9);
  // The Bag holds 6: a 7th can't be stored (it can still be used now).
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.player.bag = Array.from({ length: 6 }, () => card('potion'));
  const p7 = give(s, 'player', 'potion');
  assert.equal(buyReason(s, 'player', s.players.player.hand[0], 'store'), 'Your Bag is full (6)');
  assert.throws(() => applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: p7, then: 'store' }), /Bag is full/);
  assert.equal(buyReason(s, 'player', s.players.player.hand[0], 'use'), null);
  // An Item in hand that isn't bought is discarded at Supper like any card.
  s = battle();
  s.players.player.drawPile = Array.from({ length: 10 }, () => card('ponyta'));
  const unbought = give(s, 'player', 'potion');
  s = nextRound(s);
  assert.ok(s.players.player.discard.some((c) => c.uid === unbought), 'discarded at Supper');
}

// --- The PokéMart: 3 on sale, refreshed each Breakfast; unsold, used and lost Items go back to the pool --------------------------------------
{
  let s = createGame(11);
  assert.equal(s.mart.onSale.length, 3);
  assert.deepEqual(martIds(s), ITEMS.map((c) => c.id).sort(), 'one copy of each Item');
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { s.players[w].hand = []; s.players[w].drawPile = []; s.players[w].discard = []; s.players[w].row = s.players[w].row.map(() => null); s.players[w].dollars = 10; }
  s.players.player.row[0] = mon('ponyta', 2);
  s.turn = 'player';
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 2, then: 'store' });
  const bought = s.players.player.bag[0].id;
  assert.equal(s.mart.onSale.filter(Boolean).length, 2);
  const seen = new Set();
  for (let r = 0; r < 6; r++) {
    s = nextRound(s);
    assert.equal(s.mart.onSale.length, 3, 'each Breakfast: 3 on sale');
    assert.ok(s.mart.onSale.every(Boolean));
    assert.ok(!s.mart.onSale.some((c) => c.id === bought), 'a bought Item is not in the PokéMart');
    assert.equal(martIds(s).length, 5, 'unsold Items went back to the pool');
    for (const c of s.mart.onSale) seen.add(c.id);
  }
  assert.ok(seen.size > 3, 'random refreshes');
  // A used Consumed Item and a lost Held Item return to the pool.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2, { currentStrength: 1 });
  s.players.player.bag = [card('choice-band'), card('leftovers')];
  const before = martIds(s).length;
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[1].uid, target: { space: 0 } });
  assert.equal(martIds(s).length, before, 'a Held Item stays on its Pokémon');
  s.turn = 'player';
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[0].uid, target: { space: 0 } });
  assert.equal(martIds(s).length, before + 1, 'a used Consumed Item returns');
  s.players.ai.row[0] = mon('growlithe', 7, { spent: false });
  s.turn = 'ai';
  s = applyAction(s, { type: 'attack', who: 'ai', from: 0, target: { kind: 'pokemon', space: 0 } });
  assert.equal(s.players.player.row[0], null);
  assert.equal(martIds(s).length, before + 2, 'a lost Held Item returns');
  assert.ok(s.mart.pool.some((c) => c.id === 'leftovers'));
}

// --- Held and Consumed ------------------------------------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  const atk = s.players.player.row[0].attack;
  s.players.player.bag = [card('charcoal'), card('mystic-water'), card('choice-band')];
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[0].uid, target: { space: 0 } });
  assert.equal(s.players.player.row[0].attack, atk + 1, 'Charcoal: +1 Attack while held');
  s.turn = 'player';
  assert.equal(whyNot(s, 'player', 'useItem', s.players.player.bag[0]), 'No Pokémon of yours without a Held Item', 'one Held Item each');
  assert.throws(() => applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[0].uid, target: { space: 0 } }));
  // Consumed Choice Band: +2 Attack until Supper (on top of the Held Item).
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[1].uid, target: { space: 0 } });
  assert.equal(s.players.player.row[0].attack, atk + 3);
  s = nextRound(s);
  assert.equal(s.players.player.row[0].attack, atk + 1, 'the Choice Band ends at Supper; the Charcoal stays');
  // Leftovers: heal 1 at Breakfast.
  s = battle();
  s.players.player.row[0] = mon('squirtle', 4, { currentStrength: 2 });
  s.players.player.bag = [card('leftovers')];
  s = applyAction(s, { type: 'useItem', who: 'player', uid: s.players.player.bag[0].uid, target: { space: 0 } });
  s = nextRound(s);
  assert.equal(s.players.player.row[0].currentStrength, 3);
}

// --- Trainer Objective: progress, completion, the Partner (and waiting for a space), Recognition ------------------------------------------
{
  // Misty: Defeat 2 enemy Pokémon.
  let s = battle();
  s.players.player.row[0] = mon('growlithe', 7, { spent: false });
  s.players.player.drawPile = Array.from({ length: 5 }, () => card('ponyta'));
  const misty = give(s, 'player', 'misty');
  s = applyAction(s, { type: 'trainerObjective', who: 'player', uid: misty });
  assert.equal(s.players.player.baseEnergy, 5, 'Objective costs 1 Energy');
  assert.equal(s.players.player.trainers[0].name, 'Misty');
  assert.equal(s.players.player.trainers[0].progress, 0);
  s = nextRound(s);
  assert.equal(s.players.player.trainers.length, 1, 'it stays through Supper');
  assert.ok(!s.players.player.discard.some((c) => c.id === 'misty'));
  for (const w of ['player', 'ai']) s.players[w].hand = [];
  s.players.ai.row[4] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.row[5] = mon('ponyta', 1, { currentStrength: 1 });
  s.turn = 'player';
  s.passesInARow = 0;
  s.players.player.row[0].spent = false;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 4 } });
  assert.equal(s.players.player.trainers[0].progress, 1, 'progress: 1 of 2');
  s.turn = 'player';
  s.players.player.row[0].spent = false;
  s.players.player.drawPile = Array.from({ length: 4 }, () => card('ponyta'));
  const rec = s.players.player.recognition;
  const hand = s.players.player.hand.length;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 5 } });
  assert.equal(s.players.player.trainers.length, 0, 'complete');
  assert.equal(s.players.player.row[1].name, 'Starmie', 'the Partner arrives in the first empty space');
  assert.ok(s.players.player.row[1].spent, 'Spent, like a summon');
  assert.equal(s.players.player.hand.length, hand + 2, 'its On Summon: draw 2');
  assert.equal(s.players.player.recognition, rec + RULES.perDefeat + RULES.perObjective, '+Recognition for the Objective');
  assert.ok(s.players.player.discard.some((c) => c.id === 'misty'), 'the Trainer goes to the Discard Pile');
  assert.equal(RULES.perObjective, 2);

  // Waiting for a free space: every space is taken when Blaine's Objective completes at Supper.
  s = battle();
  for (let i = 0; i < 9; i++) s.players.player.row[i] = mon('squirtle', 4);
  s.players.ai.row[0] = mon('ponyta', 1);
  s = applyAction(s, { type: 'placeLocation', who: 'player', uid: give(s, 'player', 'cerulean-cape'), start: 0 });
  s.turn = 'player';
  s = applyAction(s, { type: 'trainerObjective', who: 'player', uid: give(s, 'player', 'blaine') });
  s = nextRound(s);
  assert.equal(s.players.player.trainers.length, 0, 'Blaine: dominated a Location at Supper');
  assert.equal(s.players.player.waiting[0].name, 'Ninetales', 'no free space: it waits');
  // A space frees: it arrives (after that action), and its On Summon resolves.
  s.players.ai.row[1] = mon('growlithe', 7, { spent: false });
  s.players.player.row[8].currentStrength = 1;
  s.turn = 'ai';
  const aiStr = s.players.ai.row[0].currentStrength;
  s = applyAction(s, { type: 'attack', who: 'ai', from: 1, target: { kind: 'pokemon', space: 8 } });
  assert.equal(s.players.player.waiting.length, 0);
  assert.equal(s.players.player.row[8].name, 'Ninetales');
  assert.equal(s.players.ai.row[0].currentStrength, aiStr - 1, 'On Summon: 1 damage to each enemy Pokémon');
}

// --- Trainer Command -----------------------------------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.drawPile = Array.from({ length: 4 }, () => card('ponyta'));
  s = applyAction(s, { type: 'trainerCommand', who: 'player', uid: give(s, 'player', 'misty') });
  assert.equal(s.players.player.hand.length, 2, 'Misty: draw 2');
  assert.equal(s.players.player.baseEnergy, 5);
  assert.ok(s.players.player.discard.some((c) => c.id === 'misty'), 'then discarded');
  assert.equal(s.players.player.trainers.length, 0);
  s = battle();
  s.players.ai.row[2] = mon('squirtle', 4);
  s = applyAction(s, { type: 'trainerCommand', who: 'player', uid: give(s, 'player', 'blaine') });
  assert.equal(s.players.ai.row[2].currentStrength, s.players.ai.row[2].strength - 1);
  assert.equal(s.players.player.baseEnergy, 4, 'Blaine\'s Command costs 2');
}

// --- Unaffordable or unavailable: refused with a reason ---------------------------------------------------------------------------------
{
  let s = battle('player', 0, 0);
  s.players.player.row[0] = mon('ponyta', 2);
  const potion = give(s, 'player', 'potion');
  assert.equal(playReason(s, 'player', s.players.player.hand[0]), 'Costs $2 · you have $0');
  assert.throws(() => applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: potion, then: 'use', target: { space: 0 } }));
  stock(s, 'leftovers', 0);
  assert.equal(buyReason(s, 'player', s.mart.onSale[0], 'store'), 'Costs $3 · you have $0');
  assert.ok(!legalActions(s, 'player').includes('buyItem'));
  const misty = give(s, 'player', 'misty');
  assert.equal(whyNot(s, 'player', 'trainerObjective', s.players.player.hand.at(-1)), 'Objective needs 1 Energy · you have 0');
  assert.equal(whyNot(s, 'player', 'trainerCommand', s.players.player.hand.at(-1)), 'Trainer Command needs 1 Energy · you have 0');
  assert.throws(() => applyAction(s, { type: 'trainerObjective', who: 'player', uid: misty }));
  s.players.player.baseEnergy = 5;
  give(s, 'player', 'blaine');
  assert.equal(whyNot(s, 'player', 'trainerCommand', s.players.player.hand.at(-1)), 'No enemy Pokémon');
  s.players.player.row[0] = null;
  s.players.player.dollars = 5;
  assert.equal(buyReason(s, 'player', s.players.player.hand[0], 'use'), 'No Pokémon of yours to use it on');
  s.players.player.bag = [card('charcoal')];
  assert.ok(!legalActions(s, 'player').includes('useItem'));
  assert.equal(whyNot(s, 'player', 'useItem', s.players.player.bag[0]), 'No Pokémon of yours without a Held Item');
}

// --- The AI buys and uses Items and plays Trainers both ways (through applyAction) --------------------------------------------------------
{
  // Buy and use: its hurt Pokémon, a Potion in the PokéMart.
  let s = battle('ai', 0, 2);
  s.players.ai.row[0] = mon('squirtle', 6, { currentStrength: 2 });
  stock(s, 'potion', 0);
  s.mart.onSale[1] = null;
  s.mart.onSale[2] = null;
  let a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'buyItem');
  assert.equal(a.then, 'use');
  // Use from the Bag.
  s = battle('ai', 0, 0);
  s.players.ai.row[0] = mon('squirtle', 6, { currentStrength: 2 });
  s.players.ai.bag = [card('potion')];
  a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'useItem');
  // Buy and store, with nothing to use it on.
  s = battle('ai', 0, 3);
  s.mart.onSale = [null, null, null];
  give(s, 'ai', 'charcoal');
  a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.deepEqual([a.type, a.then], ['buyItem', 'store']);
  // A Trainer as an Objective.
  s = battle('ai', 1, 0);
  give(s, 'ai', 'misty');
  a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'trainerObjective');
  // A Trainer Command: Blaine's 1 damage defeats two enemy Pokémon.
  s = battle('ai', 2, 0);
  s.players.player.row[0] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.player.row[1] = mon('ponyta', 1, { currentStrength: 1 });
  give(s, 'ai', 'blaine');
  a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'trainerCommand');
}

console.log('v4 items: PokéDollars, buying (hand, PokéMart; use or store), the Bag, the PokéMart refresh, Held and Consumed, Trainer Objectives and Partners, Trainer Commands, refusals, AI — ok');
