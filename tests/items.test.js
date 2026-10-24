// Checks PokéDollars, Item Cards, the Open Bag Action, the Bag, the PokéMart,
// Held and Consumed Items, and the AI's use of them.
// Run with: node tests/items.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, openBagOptions, itemTargets, isAlert, attackOf, maxStrengthOf,
  BAG_SIZE, PLAYERS,
} from '../src/engine/game.js';
import { ITEM_CARDS, PLACEHOLDER_DECKLIST } from '../src/engine/cardData.js';
import { cardDefinition } from '../src/engine/cards.js';
import { refreshAuras } from '../src/engine/effects.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Ash / Misty / Brock on both sides, empty hands, plenty of
// Base Energy, the player to act and to have initiative. Passives and
// abilities off, so numbers are the Items' own.
function match({ seed = 51 } = {}) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'player';
  s.turn = 'player';
  return s;
}

function give(s, who, id) {
  const p = s.players[who];
  for (const pile of [p.drawPile, p.discard]) {
    const i = pile.findIndex((c) => c.id === id);
    if (i >= 0) {
      const [card] = pile.splice(i, 1);
      p.hand.push(card);
      return card.uid;
    }
  }
  throw new Error(`no ${id} left for ${who}`);
}

const onTurn = (s, who) => { s.turn = who; s.passesInARow = 0; s.players[who].baseEnergy = 10; return s; };
const act = (s, who, action) => applyAction(onTurn(s, who), { who, ...action });
const play = (s, who, id, zone, space) => act(s, who, { type: 'playPokemon', uid: give(s, who, id), zone, space });
const bag = (s, who, action) => act(s, who, { type: 'openBag', ...action });
const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const href = (owner, uid) => ({ kind: 'hand', owner, uid });
const ready = (s, who, zone, space) => { at(s, who, zone, space).spent = false; };
const martIds = (s) => [...s.mart.deck, ...s.mart.onSale.filter(Boolean)].map((i) => i.id).sort();
const logged = (s, text) => s.log.some((l) => l.includes(text));

function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  for (const who of PLAYERS) if (s.xpStep && legalActions(s, who).includes('spendXp')) s = applyAction(s, { type: 'spendXp', who, spend: [] });
  return s;
}

// --- Data -------------------------------------------------------------------

for (const c of ITEM_CARDS) {
  assert.equal(c.cardType, 'Item');
  assert.ok(['Held', 'Consumed'].includes(c.itemType));
  for (const field of ['name', 'cost', 'effectText', 'rarity', 'effects']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
}
assert.deepEqual(ITEM_CARDS.map((c) => [c.name, c.itemType, c.cost]), [
  ['Power Band', 'Held', 3], ['Iron Shell', 'Held', 3], ['Swift Feather', 'Held', 4], ['Lucky Coin', 'Held', 2],
  ['Potion', 'Consumed', 2], ['Wake-Up Tonic', 'Consumed', 3], ['Energy Drink', 'Consumed', 4],
]);
{
  const s = createGame(1);
  const items = s.players.player.drawPile.filter((c) => c.cardType === 'Item').map((c) => c.id).sort();
  assert.deepEqual(items, ['energy-drink', 'iron-shell', 'iron-shell', 'lucky-coin', 'potion', 'power-band', 'power-band', 'swift-feather']);
  assert.equal(PLACEHOLDER_DECKLIST['wake-up-tonic'], undefined, 'Wake-Up Tonic: PokéMart only');
  assert.deepEqual(martIds(s), ITEM_CARDS.map((c) => c.id).sort(), 'PokéMart: one of each Item');
  assert.equal(s.players.player.dollars, 0);
  assert.deepEqual(s.players.player.bag, []);
}

// --- PokéDollars ----------------------------------------------------------------

// Earned for every opponent Pokémon defeated, by any cause: its printed Energy Cost.
{
  // My attack.
  let s = match();
  s = play(s, 'player', 'duskfang', 0, 0);           // Quick Attack: Active
  s = play(s, 'ai', 'pebblet', 1, 0);                // cost 2
  at(s, 'ai', 1, 0).currentStrength = 1;
  at(s, 'ai', 1, 0).attackBonus = 5;                 // a buffed card still pays its printed cost
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.equal(s.players.player.dollars, 2);
  assert.ok(logged(s, 'You earn 2 PokéDollars for defeating Pebblet (now 2).'));

  // Damage traded back by my Pokémon.
  let t = match();
  t = play(t, 'player', 'gustling', 0, 0);           // Swift
  t = play(t, 'ai', 'zappip', 1, 0);                 // Swift, Quick Attack, cost 1
  ready(t, 'player', 0, 0);
  at(t, 'ai', 1, 0).currentStrength = 9;             // survives
  at(t, 'ai', 1, 0).spent = false;
  at(t, 'player', 0, 0).currentStrength = 9;
  t.players.ai.zones[1].pokemon[0].attackValue = 0;
  at(t, 'player', 0, 0).attackValue = 9;
  t = act(t, 'ai', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'pokemon', zone: 0, space: 0 } });
  assert.equal(t.players.ai.zones[1].pokemon[0], null, 'defeated by the damage Gustling traded back');
  assert.equal(t.players.player.dollars, 1);

  // Effects (Misty's Power) and Weather (Sun 8).
  let u = match();
  u = play(u, 'ai', 'mothdust', 1, 0);               // cost 2
  at(u, 'ai', 1, 0).currentStrength = 1;
  u = act(u, 'player', { type: 'usePower', zone: 1, target: pref('ai', 1, 0) });
  assert.equal(u.players.player.dollars, 2);
  u = play(u, 'player', 'puddlop', 2, 0);            // cost 1, mine
  at(u, 'player', 2, 0).currentStrength = 1;
  u.players.ai.zones[2].location = { uid: 'sun', name: 'Sun test', cardType: 'Location', weatherTokens: { Sun: 8 }, quest: null };
  refreshAuras(u);
  u = nextRound(u);
  assert.equal(u.players.player.zones[2].pokemon[0], null, 'my Puddlop defeated by Weather');
  assert.equal(u.players.ai.dollars, 1, 'the opponent earns');
}

// --- Items in hand ----------------------------------------------------------------

// Unusable until bought; discarded at Supper like any other card.
{
  let s = match();
  s = play(s, 'player', 'emberkit', 0, 0);
  at(s, 'player', 0, 0).currentStrength = 1;
  const potion = give(s, 'player', 'potion');
  onTurn(s, 'player');
  assert.ok(!legalActions(s, 'player').includes('openBag'), 'no PokéDollars: nothing to do with it');
  const martBefore = martIds(s);
  s = nextRound(s);
  assert.ok(s.players.player.discard.some((c) => c.uid === potion), 'discarded at Supper to my own Discard Pile');
  assert.deepEqual(martIds(s), martBefore, 'not to the PokéMart');
}

// Buy from hand, then use it now...
{
  let s = match();
  s = play(s, 'player', 'ironhorn', 0, 0);
  at(s, 'player', 0, 0).currentStrength = 2;
  const potion = give(s, 'player', 'potion');
  s.players.player.dollars = 5;
  const martBefore = s.mart.deck.length;
  s = bag(s, 'player', { mode: 'buyHand', uid: potion, then: 'use', target: pref('player', 0, 0) });
  assert.equal(s.players.player.dollars, 3);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 6, 'Potion heals 4');
  assert.ok(!s.players.player.hand.some((c) => c.uid === potion));
  assert.equal(s.mart.deck.length, martBefore + 1, 'a used Consumed Item goes to the PokéMart');
  assert.ok(s.mart.deck.some((c) => c.uid === potion));
  assert.equal(s.turn, 'ai', 'one Action');
}

// ...or store it, and use it from the Bag on a later turn.
{
  let s = match();
  const band = give(s, 'player', 'power-band');
  s.players.player.dollars = 3;
  s = bag(s, 'player', { mode: 'buyHand', uid: band, then: 'store' });
  assert.deepEqual(s.players.player.bag.map((i) => [i.uid, i.inDelivery]), [[band, false]]);
  s = play(s, 'player', 'emberkit', 0, 0);
  s = bag(s, 'player', { mode: 'useBag', uid: band, target: pref('player', 0, 0) });
  assert.equal(s.players.player.bag.length, 0);
  assert.equal(at(s, 'player', 0, 0).heldItem.name, 'Power Band');
  assert.equal(attackOf(at(s, 'player', 0, 0)), 4, '+2 Attack');
}

// No legal target: can't be used, but can still be bought and stored.
{
  const s = match();
  const potion = give(s, 'player', 'potion');
  s.players.player.dollars = 2;
  assert.deepEqual(openBagOptions(s, 'player').filter((o) => o.uid === potion), [{ mode: 'buyHand', uid: potion, then: 'store' }]);
  assert.throws(() => bag(s, 'player', { mode: 'buyHand', uid: potion, then: 'use' }), /no legal target/);
  const t = bag(s, 'player', { mode: 'buyHand', uid: potion, then: 'store' });
  assert.deepEqual(t.players.player.bag.map((i) => i.uid), [potion], 'bought and stored');
  assert.equal(t.players.player.dollars, 0);
}

// --- The PokéMart -----------------------------------------------------------------

// 3 on sale; buying puts it In Delivery until the next Breakfast; its slot stays empty.
{
  let s = match();
  assert.equal(s.mart.onSale.filter(Boolean).length, 3);
  assert.equal(s.mart.deck.length, 4);
  const slot = s.mart.onSale.findIndex((i) => i.id !== 'energy-drink');
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
  let s = match();
  s.mart.deck = [];
  s.mart.onSale = [s.mart.onSale[0], null, null];
  s = nextRound(s);
  assert.equal(s.mart.onSale.filter(Boolean).length, 1);
}

// The Bag: 6 spaces, In Delivery included. Full: no storing or PokéMart, but
// buying from hand and using it straight away still works.
{
  let s = match();
  s.players.player.bag = ITEM_CARDS.slice(0, 5).map((def, i) => ({ ...def, uid: `b${i}`, inDelivery: false }));
  s.players.player.dollars = 20;
  const slot = s.mart.onSale.findIndex(Boolean);
  s = bag(s, 'player', { mode: 'buyMart', slot });
  assert.equal(s.players.player.bag.length, BAG_SIZE);
  s = play(s, 'player', 'emberkit', 0, 0);
  const band = give(s, 'player', 'power-band');
  onTurn(s, 'player');
  const opts = openBagOptions(s, 'player');
  assert.ok(!opts.some((o) => o.mode === 'buyMart'), 'full: no PokéMart');
  assert.ok(!opts.some((o) => o.then === 'store'), 'full: no storing');
  assert.throws(() => bag(s, 'player', { mode: 'buyHand', uid: band, then: 'store' }), /full/);
  s = bag(s, 'player', { mode: 'buyHand', uid: band, then: 'use', target: pref('player', 0, 0) });
  assert.equal(at(s, 'player', 0, 0).heldItem.name, 'Power Band');
  assert.equal(s.players.player.bag.length, BAG_SIZE, 'Bag contents kept');
  s = nextRound(s);
  assert.equal(s.players.player.bag.length, BAG_SIZE, 'never discarded at Supper');
}

// --- Held Items ---------------------------------------------------------------------

// On a Pokémon in hand: it follows the card through the Discard Pile and a
// reshuffle, back into the hand, and applies once it is in the arena.
{
  let s = match();
  const shell = give(s, 'player', 'iron-shell');
  const iron = give(s, 'player', 'ironhorn');
  s.players.player.dollars = 3;
  assert.ok(itemTargets(s, 'player', s.players.player.hand.find((c) => c.uid === shell)).some((r) => r.kind === 'hand'));
  s = bag(s, 'player', { mode: 'buyHand', uid: shell, then: 'use', target: href('player', iron) });
  assert.equal(s.players.player.hand.find((c) => c.uid === iron).heldItem.name, 'Iron Shell');
  s = nextRound(s);                                  // Supper: discarded, Held Item and all
  const p = s.players.player;
  const where = () => [...p.hand, ...p.discard, ...p.drawPile].find((c) => c.uid === iron);
  assert.equal(where().heldItem.name, 'Iron Shell');
  // Force a reshuffle of the Discard Pile into the Draw Pile, and draw it back.
  const ironCard = [...p.hand, ...p.drawPile].find((c) => c.uid === iron) ?? where();
  [p.hand, p.drawPile, p.discard].forEach((pile) => { const i = pile.indexOf(ironCard); if (i >= 0) pile.splice(i, 1); });
  p.discard.push(...p.drawPile.splice(0), ...p.hand.splice(0), ironCard);
  s = nextRound(s);
  const back = s.players.player.hand.find((c) => c.uid === iron)
    ?? s.players.player.drawPile.find((c) => c.uid === iron);
  assert.ok(logged(s, 'You shuffled your Discard Pile'));
  assert.equal(back.heldItem.name, 'Iron Shell', 'still held after the reshuffle');
  if (!s.players.player.hand.includes(back)) {
    s.players.player.drawPile.splice(s.players.player.drawPile.indexOf(back), 1);
    s.players.player.hand.push(back);
  }
  s = act(s, 'player', { type: 'playPokemon', uid: iron, zone: 1, space: 0 });
  const placed = at(s, 'player', 1, 0);
  assert.deepEqual([placed.currentStrength, maxStrengthOf(placed)], [11, 11], 'Ironhorn 8 + 3, current and maximum');
}

// Lost only when its Pokémon is Released: defeated, or paid as a Released Supporter cost.
{
  let s = match();
  s = play(s, 'ai', 'emberkit', 1, 0);
  const lucky = give(s, 'ai', 'lucky-coin');
  s.players.ai.dollars = 2;
  s = bag(s, 'ai', { mode: 'buyHand', uid: lucky, then: 'use', target: pref('ai', 1, 0) });
  at(s, 'ai', 1, 0).currentStrength = 1;
  s = act(s, 'player', { type: 'usePower', zone: 1, target: pref('ai', 1, 0) });
  assert.equal(s.players.ai.released.at(-1).heldItem, undefined);
  assert.ok(s.mart.deck.some((c) => c.uid === lucky), 'to the PokéMart');
  assert.ok(logged(s, 'Lucky Coin was held by AI Opponent\'s Emberkit, which was Released: it is lost, and goes to the PokéMart.'));
  assert.ok(![...s.players.ai.drawPile, ...s.players.ai.discard, ...s.players.ai.hand].some((c) => c.uid === lucky), 'never back to the deck');

  let t = match();
  const band = give(t, 'player', 'power-band');
  const zap = give(t, 'player', 'zappip');
  t.players.player.dollars = 3;
  t = bag(t, 'player', { mode: 'buyHand', uid: band, then: 'use', target: href('player', zap) });
  const coach = give(t, 'player', 'veteran-coach');
  t = play(t, 'player', 'emberkit', 0, 0);
  t = act(t, 'player', { type: 'playSupporter', uid: coach, release: [zap], target: { kind: 'zone', owner: 'player', zone: 0 } });
  assert.ok(t.mart.deck.some((c) => c.uid === band), 'Released as a Supporter payment: lost');
}

// One Held Item per Pokémon: a new one sends the old one to the PokéMart.
{
  let s = match();
  s = play(s, 'player', 'pebblet', 0, 0);            // 2/5
  at(s, 'player', 0, 0).currentStrength = 7;
  const shell = give(s, 'player', 'iron-shell');
  s.players.player.dollars = 10;
  at(s, 'player', 0, 0).currentStrength = 5;
  s = bag(s, 'player', { mode: 'buyHand', uid: shell, then: 'use', target: pref('player', 0, 0) });
  assert.deepEqual([at(s, 'player', 0, 0).currentStrength, maxStrengthOf(at(s, 'player', 0, 0))], [8, 8]);
  const band = give(s, 'player', 'power-band');
  s = bag(s, 'player', { mode: 'buyHand', uid: band, then: 'use', target: pref('player', 0, 0) });
  const pebblet = at(s, 'player', 0, 0);
  assert.equal(pebblet.heldItem.name, 'Power Band');
  assert.equal(attackOf(pebblet), 4);
  assert.deepEqual([pebblet.currentStrength, maxStrengthOf(pebblet)], [5, 5], 'Iron Shell gone: like losing a Passive');
  assert.ok(s.mart.deck.some((c) => c.uid === shell));
  assert.ok(logged(s, 'Iron Shell was replaced on your Pebblet'));
}

// Swift Feather: one Speed-Tier higher, changing who is Alert.
{
  let s = match();
  s = play(s, 'player', 'mothdust', 0, 0);           // Steady
  s = play(s, 'ai', 'emberkit', 0, 0);               // Swift
  ready(s, 'player', 0, 0);
  ready(s, 'ai', 0, 0);
  assert.ok(!isAlert(s, at(s, 'player', 0, 0)));
  const feather = give(s, 'player', 'swift-feather');
  s.players.player.dollars = 4;
  s = bag(s, 'player', { mode: 'buyHand', uid: feather, then: 'use', target: pref('player', 0, 0) });
  assert.ok(isAlert(s, at(s, 'player', 0, 0)), 'Steady → Swift: Alert alongside Emberkit');
  assert.ok(isAlert(s, at(s, 'ai', 0, 0)));

  let t = match();
  t = play(t, 'player', 'zappip', 0, 0);             // Swift already
  const f2 = give(t, 'player', 'swift-feather');
  t.players.player.dollars = 4;
  t = bag(t, 'player', { mode: 'buyHand', uid: f2, then: 'use', target: pref('player', 0, 0) });
  assert.ok(isAlert(t, at(t, 'player', 0, 0)), 'no effect on Swift, but no harm');
}

// Lucky Coin: +2 when the holder's combat damage defeats an opponent Pokémon, in a trade too.
{
  let s = match();
  s = play(s, 'player', 'duskfang', 0, 0);           // Swift, Quick Attack: Active
  const coin = give(s, 'player', 'lucky-coin');
  s.players.player.dollars = 2;
  s = bag(s, 'player', { mode: 'buyHand', uid: coin, then: 'use', target: pref('player', 0, 0) });
  s = play(s, 'ai', 'pebblet', 1, 0);
  at(s, 'ai', 1, 0).currentStrength = 1;
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.equal(s.players.player.dollars, 2 + 2, 'cost 2 + Lucky Coin 2');
  assert.ok(logged(s, "You earn 2 PokéDollars from Duskfang's Lucky Coin"));

  // In a trade: the holder is attacked while Alert and its hit back defeats the attacker.
  let t = match();
  t = play(t, 'player', 'gustling', 0, 0);           // Swift
  const c2 = give(t, 'player', 'lucky-coin');
  t.players.player.dollars = 2;
  t = bag(t, 'player', { mode: 'buyHand', uid: c2, then: 'use', target: pref('player', 0, 0) });
  ready(t, 'player', 0, 0);
  t = play(t, 'ai', 'zappip', 1, 0);                 // Swift, Quick Attack, cost 1, Strength 2
  at(t, 'player', 0, 0).currentStrength = 9;
  t = act(t, 'ai', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'pokemon', zone: 0, space: 0 } });
  assert.equal(t.players.ai.zones[1].pokemon[0], null);
  assert.equal(t.players.player.dollars, 1 + 2);

  // Effect damage doesn't count.
  let u = match();
  u = play(u, 'player', 'pebblet', 1, 0);
  const c3 = give(u, 'player', 'lucky-coin');
  u.players.player.dollars = 2;
  u = bag(u, 'player', { mode: 'buyHand', uid: c3, then: 'use', target: pref('player', 1, 0) });
  u = play(u, 'ai', 'zappip', 1, 0);
  at(u, 'ai', 1, 0).currentStrength = 1;
  u = act(u, 'player', { type: 'usePower', zone: 1, target: pref('ai', 1, 0) });
  assert.equal(u.players.player.dollars, 1, 'Misty defeated it, not the holder');
}

// --- Consumed Items -----------------------------------------------------------------

// Potion: damaged friendly Pokémon in the arena only; capped at maximum.
{
  let s = match();
  s = play(s, 'player', 'emberkit', 0, 0);
  s = play(s, 'player', 'ironhorn', 0, 1);
  s = play(s, 'ai', 'pebblet', 0, 0);
  at(s, 'player', 0, 0).currentStrength = 2;
  at(s, 'ai', 0, 0).currentStrength = 1;
  const potion = give(s, 'player', 'potion');
  s.players.player.dollars = 2;
  assert.deepEqual(itemTargets(s, 'player', s.players.player.hand.find((c) => c.uid === potion)), [pref('player', 0, 0)]);
  s = bag(s, 'player', { mode: 'buyHand', uid: potion, then: 'use', target: pref('player', 0, 0) });
  assert.equal(at(s, 'player', 0, 0).currentStrength, 3, 'capped at 3');
}

// Wake-Up Tonic (from the PokéMart): a Spent Pokémon becomes Active, and can be Alert.
{
  let s = match();
  s = play(s, 'player', 'emberkit', 0, 0);           // Spent
  s = play(s, 'ai', 'mothdust', 0, 0);
  ready(s, 'ai', 0, 0);
  assert.ok(isAlert(s, at(s, 'ai', 0, 0)), 'Mothdust is Alert while Emberkit is Spent');
  const tonic = { ...cardDefinition('wake-up-tonic'), uid: 'tonic', inDelivery: false };
  s.players.player.bag.push(tonic);
  s = bag(s, 'player', { mode: 'useBag', uid: 'tonic', target: pref('player', 0, 0) });
  assert.equal(at(s, 'player', 0, 0).spent, false);
  assert.ok(isAlert(s, at(s, 'player', 0, 0)));
  assert.ok(!isAlert(s, at(s, 'ai', 0, 0)), 'Alert recalculated: Swift beats Steady');
  assert.ok(s.mart.deck.some((c) => c.uid === 'tonic'));
}

// Energy Drink: +2 Base Energy this Round, past 10, not carried over.
{
  let s = match();
  const drink = give(s, 'player', 'energy-drink');
  s.players.player.dollars = 4;
  onTurn(s, 'player');
  s = applyAction(s, { type: 'openBag', who: 'player', mode: 'buyHand', uid: drink, then: 'use' });
  assert.equal(s.players.player.baseEnergy, 12);
  s = nextRound(s);
  assert.equal(s.players.player.baseEnergy, 2, 'Round 2: back to 2');
}

// --- AI -----------------------------------------------------------------------

// Buys from hand and uses straight away when it has a target; stores otherwise.
{
  let s = match();
  s = play(s, 'ai', 'emberkit', 0, 0);
  s = play(s, 'ai', 'pebblet', 0, 1);
  const band = give(s, 'ai', 'power-band');
  s.players.ai.dollars = 3;
  s.mart.onSale = [null, null, null];
  onTurn(s, 'ai');
  s.players.ai.baseEnergy = 0;
  s.players.ai.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'openBag');
  assert.deepEqual([move.mode, move.uid, move.then], ['buyHand', band, 'use']);
  assert.equal(move.target.kind, 'pokemon', 'on a Pokémon in the arena');

  // Prefers a Pokémon without a Held Item.
  at(s, 'ai', 0, 0).heldItem = { ...cardDefinition('iron-shell'), uid: 'x' };
  for (let i = 0; i < 10; i++) assert.deepEqual(chooseAction(s, 'ai').target, pref('ai', 0, 1));

  // With no target (no Pokémon in the arena), it stores the Item.
  let t = match();
  const shell = give(t, 'ai', 'iron-shell');
  t.players.ai.dollars = 3;
  t.mart.onSale = [null, null, null];
  onTurn(t, 'ai');
  t.players.ai.baseEnergy = 0;
  t.players.ai.trainers.forEach((tr) => { tr.power = { ...tr.power, cost: 99 }; });
  assert.deepEqual(chooseAction(t, 'ai'), { type: 'openBag', who: 'ai', mode: 'buyHand', uid: shell, then: 'store' });
}

console.log('All Item, Bag and PokéMart tests passed.');
