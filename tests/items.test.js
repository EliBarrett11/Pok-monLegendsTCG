// Checks PokéDollars, Item Cards, the Open Bag Action, the Bag, the PokéMart,
// Held and Consumed Items, each Fire and Water Item working as written, and
// the AI's use of them.
// Run with: node tests/items.test.js
import assert from 'node:assert/strict';
import { applyAction, legalActions, openBagOptions, itemTargets, isAlert, attackOf, maxStrengthOf, BAG_SIZE } from '../src/engine/game.js';
import { ITEM_CARDS } from '../src/engine/cardData.js';
import { cardDefinition } from '../src/engine/cards.js';
import { refreshAuras } from '../src/engine/effects.js';
import { statusCount } from '../src/engine/status.js';
import { keywordAmount } from '../src/engine/keywords.js';
import { chooseAction } from '../src/ai/opponent.js';
import { battle, give, act, onTurn, play, place, nextRound, at, trainerAt, pref, tref, href, stats, logged } from './fixtures.js';

// Trainer Passives and Powers off, so the numbers are the Items' own.
// PokéDollars start at 0 (not the Breakfast one): these tests count them.
const fire = () => battle({ seed: 51, passives: false, powers: false });
const water = () => battle({ seed: 51, player: 'water', ai: 'fire', passives: false, powers: false });
const bag = (s, who, action) => act(s, who, { type: 'openBag', ...action });
const buyUse = (s, who, uid, target) => { s.players[who].dollars += 10; return bag(s, who, { mode: 'buyHand', uid, then: 'use', target }); };
const martIds = (s) => [...s.mart.deck, ...s.mart.onSale.filter(Boolean)].map((i) => i.id).sort();
const hurt = (s, ref, to) => { at(s, ref.owner, ref.zone, ref.space).currentStrength = to; return ref; };
const burn = (c) => statusCount(c, 'burn');

// --- Data -------------------------------------------------------------------

for (const c of ITEM_CARDS) {
  assert.equal(c.cardType, 'Item');
  assert.ok(['Held', 'Consumed'].includes(c.itemType));
  for (const field of ['name', 'cost', 'effectText', 'rarity', 'effects']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
}
{
  const s = fire();
  assert.deepEqual(martIds(s), ITEM_CARDS.map((c) => c.id).sort(), 'PokéMart: one of each Item');
  assert.deepEqual(s.players.player.bag, []);
}

// --- PokéDollars ----------------------------------------------------------------

// Earned for every opponent Pokémon defeated, by any cause: its printed Energy Cost.
{
  // My attack.
  let s = fire();
  place(s, 'player', 0, 0, 'mankey');                        // Attack 4
  hurt(s, place(s, 'ai', 1, 0, 'goldeen', { spent: true, attackBonus: 5 }), 1);   // cost 2; buffed still pays its printed cost
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.equal(s.players.player.dollars, 2);
  assert.ok(logged(s, 'You earn 2 PokéDollars for defeating Goldeen (now 2).'));

  // Effects (a Strategy Card) and Burn at Supper.
  let u = fire();
  hurt(u, place(u, 'ai', 1, 0, 'lapras'), 2);                // cost 4
  u = act(u, 'player', { type: 'playStrategy', uid: give(u, 'player', 'ember'), target: pref('ai', 1, 0) });
  u = nextRound(u);
  assert.equal(at(u, 'ai', 1, 0), null, 'Burn 2 defeated it at Supper');
  assert.equal(u.players.player.dollars, 4 + 1, '4 for Lapras, 1 at Breakfast');
}

// --- Items in hand ----------------------------------------------------------------

// Unusable until bought; discarded at Supper like any other card.
{
  let s = fire();
  place(s, 'player', 0, 0, 'growlithe');
  const item = give(s, 'player', 'charcoal');
  s.mart.onSale = [null, null, null];
  onTurn(s, 'player');
  assert.ok(!legalActions(s, 'player').includes('openBag'), 'no PokéDollars: nothing to do with it');
  const martBefore = martIds(s);
  s = nextRound(s);
  assert.ok(s.players.player.discard.some((c) => c.uid === item), 'discarded at Supper to my own Discard Pile');
  assert.deepEqual(martIds(s), martBefore, 'not to the PokéMart');
}

// Buy from hand, then use it now...
{
  let s = water();
  hurt(s, place(s, 'player', 0, 0, 'quagsire'), 2);
  const heal = give(s, 'player', 'full-heal');
  s.players.player.dollars = 5;
  const martBefore = s.mart.deck.length;
  s = bag(s, 'player', { mode: 'buyHand', uid: heal, then: 'use', target: pref('player', 0, 0) });
  assert.equal(s.players.player.dollars, 4);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 4);
  assert.ok(!s.players.player.hand.some((c) => c.uid === heal));
  assert.equal(s.mart.deck.length, martBefore + 1, 'a used Consumed Item goes to the PokéMart');
  assert.ok(s.mart.deck.some((c) => c.uid === heal));
  assert.equal(s.turn, 'ai', 'one Action');
}

// ...or store it, and use it from the Bag on a later turn.
{
  let s = fire();
  const coal = give(s, 'player', 'charcoal');
  s.players.player.dollars = 2;
  s = bag(s, 'player', { mode: 'buyHand', uid: coal, then: 'store' });
  assert.deepEqual(s.players.player.bag.map((i) => [i.uid, i.inDelivery]), [[coal, false]]);
  s = play(s, 'player', 'growlithe', 0, 0);
  s = bag(s, 'player', { mode: 'useBag', uid: coal, target: pref('player', 0, 0) });
  assert.equal(s.players.player.bag.length, 0);
  assert.equal(at(s, 'player', 0, 0).heldItem.name, 'Charcoal');
}

// No legal target: can't be used, but can still be bought and stored.
{
  const s = fire();
  const x = give(s, 'player', 'x-attack');                   // needs a friendly Pokémon in the arena
  s.players.player.dollars = 2;
  s.mart.onSale = [null, null, null];
  assert.deepEqual(openBagOptions(s, 'player').filter((o) => o.uid === x), [{ mode: 'buyHand', uid: x, then: 'store' }]);
  assert.throws(() => bag(s, 'player', { mode: 'buyHand', uid: x, then: 'use' }), /no legal target/);
  const t = bag(s, 'player', { mode: 'buyHand', uid: x, then: 'store' });
  assert.deepEqual(t.players.player.bag.map((i) => i.uid), [x], 'bought and stored');
  assert.equal(t.players.player.dollars, 0);
}

// --- The PokéMart -----------------------------------------------------------------

// 3 on sale; buying puts it In Delivery until the next Breakfast; its slot stays empty.
{
  let s = fire();
  assert.equal(s.mart.onSale.filter(Boolean).length, 3);
  assert.equal(s.mart.deck.length, 4);
  const slot = 0;
  const item = s.mart.onSale[slot];
  s.players.player.dollars = 10;
  s = bag(s, 'player', { mode: 'buyMart', slot });
  assert.equal(s.players.player.dollars, 10 - item.cost);
  assert.equal(s.mart.onSale[slot], null, 'stays empty until the next Breakfast');
  assert.deepEqual(s.players.player.bag.map((i) => [i.name, i.inDelivery]), [[item.name, true]]);
  onTurn(s, 'player');
  assert.ok(!openBagOptions(s, 'player').some((o) => o.mode === 'useBag'), 'In Delivery: not usable');
  assert.throws(() => bag(s, 'player', { mode: 'useBag', uid: item.uid }), /In Delivery/);
  // Next Breakfast: unsold stock goes back and is reshuffled; 3 new on sale; it arrives.
  s = nextRound(s);
  assert.equal(s.players.player.bag[0].inDelivery, false);
  assert.ok(logged(s, `You: ${item.name} arrived in the Bag.`));
  assert.equal(s.mart.onSale.filter(Boolean).length, 3);
  assert.equal(s.mart.deck.length + 3, 6, 'all 6 unsold Items are back in circulation');
  assert.ok(logged(s, 'PokéMart restocked:'));
}

// If the deck has fewer than 3, it shows what there is.
{
  let s = fire();
  s.mart.deck = [];
  s.mart.onSale = [s.mart.onSale[0], null, null];
  s = nextRound(s);
  assert.equal(s.mart.onSale.filter(Boolean).length, 1);
}

// The Bag: 6 spaces, In Delivery included. Full: no storing or PokéMart, but
// buying from hand and using it straight away still works.
{
  let s = fire();
  s.players.player.bag = ITEM_CARDS.slice(0, 5).map((d, i) => ({ ...d, uid: `b${i}`, inDelivery: false }));
  s.players.player.dollars = 20;
  s = bag(s, 'player', { mode: 'buyMart', slot: s.mart.onSale.findIndex(Boolean) });
  assert.equal(s.players.player.bag.length, BAG_SIZE);
  s = play(s, 'player', 'growlithe', 0, 0);
  const coal = give(s, 'player', 'charcoal');
  onTurn(s, 'player');
  const opts = openBagOptions(s, 'player');
  assert.ok(!opts.some((o) => o.mode === 'buyMart'), 'full: no PokéMart');
  assert.ok(!opts.some((o) => o.then === 'store'), 'full: no storing');
  assert.throws(() => bag(s, 'player', { mode: 'buyHand', uid: coal, then: 'store' }), /full/);
  s = bag(s, 'player', { mode: 'buyHand', uid: coal, then: 'use', target: pref('player', 0, 0) });
  assert.equal(at(s, 'player', 0, 0).heldItem.name, 'Charcoal');
  assert.equal(s.players.player.bag.length, BAG_SIZE, 'Bag contents kept');
  s = nextRound(s);
  assert.equal(s.players.player.bag.length, BAG_SIZE, 'never discarded at Supper');
}

// --- Held Items ---------------------------------------------------------------------

// On a Pokémon in hand: it follows the card through the Discard Pile, and
// applies once it is in the arena.
{
  let s = water();
  const mw = give(s, 'player', 'mystic-water');
  const mon = give(s, 'player', 'quagsire');
  assert.ok(itemTargets(s, 'player', s.players.player.hand.find((c) => c.uid === mw)).some((r) => r.kind === 'hand'));
  s = buyUse(s, 'player', mw, href('player', mon));
  assert.equal(s.players.player.hand.find((c) => c.uid === mon).heldItem.name, 'Mystic Water');
  s = nextRound(s);                                          // Supper: discarded, Held Item and all
  const p = s.players.player;
  const card = [...p.hand, ...p.discard, ...p.drawPile].find((c) => c.uid === mon);
  assert.equal(card.heldItem.name, 'Mystic Water');
  for (const pile of [p.hand, p.discard, p.drawPile]) { const i = pile.indexOf(card); if (i >= 0) pile.splice(i, 1); }
  p.hand.push(card);
  s = act(s, 'player', { type: 'playPokemon', uid: mon, zone: 1, space: 0 });
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [5, 8, 8], 'Quagsire 4/7 + Mystic Water (Water: +1/+1)');
}

// Lost only when its Pokémon is Released: defeated, or paid as a Released Supporter cost.
{
  let s = fire();
  place(s, 'ai', 1, 0, 'horsea');
  const mw = give(s, 'ai', 'mystic-water');
  s = buyUse(s, 'ai', mw, pref('ai', 1, 0));
  hurt(s, pref('ai', 1, 0), 1);
  s = act(s, 'player', { type: 'playStrategy', uid: give(s, 'player', 'fire-blast'), target: pref('ai', 1, 0) });
  assert.equal(s.players.ai.released.at(-1).heldItem, undefined);
  assert.ok(s.mart.deck.some((c) => c.uid === mw), 'to the PokéMart');
  assert.ok(logged(s, "Mystic Water was held by AI Opponent's Horsea, which was Released: it is lost, and goes to the PokéMart."));

  let t = fire();
  const coal = give(t, 'player', 'charcoal');
  const mon = give(t, 'player', 'ponyta');
  t = buyUse(t, 'player', coal, href('player', mon));
  place(t, 'player', 0, 0, 'growlithe');
  t = act(t, 'player', { type: 'playSupporter', uid: give(t, 'player', 'chili'), release: [mon], target: { kind: 'zone', owner: 'player', zone: 0 } });
  assert.ok(t.mart.deck.some((c) => c.uid === coal), 'Released as a Supporter payment: lost');
}

// One Held Item per Pokémon: a new one sends the old one to the PokéMart.
{
  let s = water();
  place(s, 'player', 0, 0, 'quagsire');                      // 4/7
  s = buyUse(s, 'player', give(s, 'player', 'mystic-water'), pref('player', 0, 0));
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [5, 8, 8]);
  const first = at(s, 'player', 0, 0).heldItem.uid;
  s = buyUse(s, 'player', give(s, 'player', 'leftovers'), pref('player', 0, 0));
  const q = at(s, 'player', 0, 0);
  assert.equal(q.heldItem.name, 'Leftovers');
  assert.deepEqual(stats(q), [4, 7, 7], 'Mystic Water gone: like losing a Passive');
  assert.ok(s.mart.deck.some((c) => c.uid === first));
  assert.ok(logged(s, 'Mystic Water was replaced on your Quagsire'));
}

// --- Fire Items -----------------------------------------------------------------------

// Charcoal: +1 Attack; a Fire holder also gains Scorch 1 (adding to its own).
{
  let s = fire();
  place(s, 'player', 0, 0, 'growlithe');                     // Scorch 1
  place(s, 'player', 0, 1, 'mankey');                        // Fighting
  s = buyUse(s, 'player', give(s, 'player', 'charcoal'), pref('player', 0, 0));
  s = buyUse(s, 'player', give(s, 'player', 'charcoal'), pref('player', 0, 1));
  assert.deepEqual([attackOf(at(s, 'player', 0, 0)), keywordAmount(at(s, 'player', 0, 0), 'Scorch')], [3, 2]);
  assert.deepEqual([attackOf(at(s, 'player', 0, 1)), keywordAmount(at(s, 'player', 0, 1), 'Scorch')], [5, 0]);
  place(s, 'ai', 2, 0, 'gyarados', { spent: true });
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 2, space: 0 } });
  assert.deepEqual([at(s, 'ai', 2, 0).currentStrength, burn(at(s, 'ai', 2, 0))], [3, 2]);
}

// X Attack: a friendly Pokémon in the arena gains +2 Attack this Round. Retain.
{
  let s = fire();
  place(s, 'player', 0, 0, 'magmar');
  s = buyUse(s, 'player', give(s, 'player', 'x-attack'), pref('player', 0, 0));
  assert.equal(attackOf(at(s, 'player', 0, 0)), 6);
  const kept = give(s, 'player', 'x-attack');
  s = nextRound(s);
  assert.equal(attackOf(at(s, 'player', 0, 0)), 4, 'this Round only');
  assert.ok(s.players.player.hand.some((c) => c.uid === kept), 'Retain: an unbought X Attack stays in hand at Supper');
  assert.ok(s.mart.deck.some((c) => c.id === 'x-attack') || s.mart.onSale.some((c) => c?.id === 'x-attack'), 'a used one goes to the PokéMart');
}

// Quick Claw: one Speed-Tier higher (Slow → Steady → Swift), changing who is Alert.
{
  let s = fire();
  place(s, 'player', 0, 0, 'magmar');                        // Steady
  place(s, 'ai', 0, 0, 'pelipper');                          // Swift
  assert.ok(!isAlert(s, at(s, 'player', 0, 0)));
  s = buyUse(s, 'player', give(s, 'player', 'quick-claw'), pref('player', 0, 0));
  assert.ok(isAlert(s, at(s, 'player', 0, 0)), 'Steady → Swift: Alert alongside Pelipper');
  assert.ok(isAlert(s, at(s, 'ai', 0, 0)));
  let t = water();
  place(t, 'player', 0, 0, 'quagsire');                      // Slow
  place(t, 'ai', 0, 0, 'magmar');                            // Steady
  t = buyUse(t, 'player', give(t, 'player', 'quick-claw'), pref('player', 0, 0));
  assert.ok(isAlert(t, at(t, 'player', 0, 0)) && isAlert(t, at(t, 'ai', 0, 0)), 'Slow → Steady');
}

// Choice Band: +3 Attack and −2 Strength, current and maximum, never below 1:
// it never defeats its holder.
{
  let s = fire();
  place(s, 'player', 0, 0, 'magmar');                        // 4/7
  s = buyUse(s, 'player', give(s, 'player', 'choice-band'), pref('player', 0, 0));
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [7, 5, 5]);
  hurt(s, place(s, 'player', 1, 0, 'growlithe'), 1);         // 2/5, at 1
  s = buyUse(s, 'player', give(s, 'player', 'choice-band'), pref('player', 1, 0));
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [5, 1, 3], 'current Strength stays at 1');
  place(s, 'player', 1, 1, 'test-spark', { strengthValue: 2 }); // a test Pokémon with Strength 2
  s = buyUse(s, 'player', give(s, 'player', 'choice-band'), pref('player', 1, 1));
  assert.deepEqual(stats(at(s, 'player', 1, 1)), [6, 1, 1], 'maximum Strength stops at 1: still in play');
  // On a card in hand, it applies as the Pokémon arrives.
  const mon = give(s, 'player', 'ponyta');                   // 3/5
  s = buyUse(s, 'player', give(s, 'player', 'choice-band'), href('player', mon));
  s = act(s, 'player', { type: 'playPokemon', uid: mon, zone: 2, space: 0 });
  assert.deepEqual(stats(at(s, 'player', 2, 0)), [6, 3, 3]);
}

// --- Water Items ----------------------------------------------------------------------

// Mystic Water: +1 Attack; a Water holder also gains +1 Strength.
{
  let s = water();
  place(s, 'player', 0, 0, 'horsea');                        // Water 3/4
  place(s, 'player', 0, 1, 'chinchou');                      // Electric 3/5
  s = buyUse(s, 'player', give(s, 'player', 'mystic-water'), pref('player', 0, 0));
  s = buyUse(s, 'player', give(s, 'player', 'mystic-water'), pref('player', 0, 1));
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [4, 5, 5]);
  assert.deepEqual(stats(at(s, 'player', 0, 1)), [4, 5, 5], 'not Water: Attack only');
}

// Leftovers: the holder gains Regenerate 1 (adding to its own).
{
  let s = water();
  hurt(s, place(s, 'player', 0, 0, 'horsea'), 1);
  hurt(s, place(s, 'player', 1, 0, 'quagsire'), 1);           // Regenerate 2
  s = buyUse(s, 'player', give(s, 'player', 'leftovers'), pref('player', 0, 0));
  s = buyUse(s, 'player', give(s, 'player', 'leftovers'), pref('player', 1, 0));
  assert.equal(keywordAmount(at(s, 'player', 1, 0), 'Regenerate'), 3);
  s = nextRound(s);
  assert.deepEqual([at(s, 'player', 0, 0).currentStrength, at(s, 'player', 1, 0).currentStrength], [2, 4]);
}

// Full Heal: Douse a friendly Pokémon or Trainer and heal it 2. Retain.
{
  let s = water();
  trainerAt(s, 'player', 0).strength = 10;
  trainerAt(s, 'player', 0).status = { burn: { count: 3, by: 'ai' } };
  s = buyUse(s, 'player', give(s, 'player', 'full-heal'), tref('player', 0));
  assert.deepEqual([trainerAt(s, 'player', 0).strength, burn(trainerAt(s, 'player', 0))], [12, 0]);
  // Any friendly card: a burned Pokémon at full Strength can still be Doused.
  place(s, 'player', 1, 0, 'quagsire');
  at(s, 'player', 1, 0).status = { burn: { count: 1, by: 'ai' } };
  const heal = give(s, 'player', 'full-heal');
  const targets = itemTargets(s, 'player', s.players.player.hand.find((c) => c.uid === heal));
  assert.ok(targets.some((r) => r.kind === 'pokemon' && r.zone === 1));
  assert.ok(targets.every((r) => r.owner !== 'ai'), 'friendly only');
  s = nextRound(s);
  assert.ok(s.players.player.hand.some((c) => c.uid === heal), 'Retain: stays in hand at Supper');
}

// --- AI -----------------------------------------------------------------------

// Buys from hand and uses straight away when it has a target; stores otherwise.
{
  let s = battle({ seed: 51, passives: false, powers: false });
  place(s, 'ai', 0, 0, 'horsea', { spent: true });
  place(s, 'ai', 0, 1, 'quagsire', { spent: true });
  const mw = give(s, 'ai', 'mystic-water');
  s.players.ai.dollars = 2;
  s.mart.onSale = [null, null, null];
  onTurn(s, 'ai');
  s.players.ai.baseEnergy = 0;
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'openBag');
  assert.deepEqual([move.mode, move.uid, move.then], ['buyHand', mw, 'use']);
  assert.equal(move.target.kind, 'pokemon', 'on a Pokémon in the arena');

  // Prefers a Pokémon without a Held Item.
  at(s, 'ai', 0, 0).heldItem = { ...cardDefinition('leftovers'), uid: 'x' };
  refreshAuras(s);
  for (let i = 0; i < 10; i++) assert.deepEqual(chooseAction(s, 'ai').target, pref('ai', 0, 1));

  // With no target (no Pokémon in the arena), it stores the Item.
  const t = battle({ seed: 51, passives: false, powers: false });
  const lo = give(t, 'ai', 'leftovers');
  t.players.ai.dollars = 3;
  t.mart.onSale = [null, null, null];
  onTurn(t, 'ai');
  t.players.ai.baseEnergy = 0;
  assert.deepEqual(chooseAction(t, 'ai'), { type: 'openBag', who: 'ai', mode: 'buyHand', uid: lo, then: 'store' });
}

console.log('All Item, Bag and PokéMart tests passed.');
