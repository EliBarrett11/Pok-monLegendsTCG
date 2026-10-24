// Checks Strategy Cards (Quickdraw, Hypervoice, Recover) and the Innate
// Powers Quick Attack and Agility.
// Run with: node tests/strategy.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, legalTargets, playableStrategies, strategyTargets, powerTargets,
  isAlert, maxStrengthOf, PLAYERS,
} from '../src/engine/game.js';
import { STRATEGY_CARDS, POKEMON_CARDS, PLACEHOLDER_DECKLIST } from '../src/engine/cardData.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Trainers Ash / Misty / Brock in zones 1–3 on both sides,
// empty hands, plenty of Base Energy, the player to act. Passives off
// unless asked for, so damage numbers are the cards' own.
function match({ passives = false } = {}) {
  let s = createGame(5);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    if (!passives) p.trainers.forEach((t) => { t.passive = { text: '' }; });
  }
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

function play(s, who, id, zone, space) {
  s.turn = who;
  s.passesInARow = 0;
  s.players[who].baseEnergy = 10;
  return applyAction(s, { type: 'playPokemon', who, uid: give(s, who, id), zone, space });
}

function strategy(s, who, uid, target) {
  s.turn = who;
  return applyAction(s, { type: 'playStrategy', who, uid, target });
}

const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const tref = (owner, zone) => ({ kind: 'trainer', owner, zone });
const ids = (cards) => cards.map((c) => c.id);

// --- Card data ----------------------------------------------------------------

for (const c of STRATEGY_CARDS) {
  assert.equal(c.cardType, 'Strategy');
  for (const field of ['name', 'energyCost', 'effectText', 'rarity']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
}
assert.deepEqual(STRATEGY_CARDS.map((c) => [c.name, c.energyCost]), [['Quickdraw', 1], ['Hypervoice', 3], ['Recover', 3]]);
assert.equal(PLACEHOLDER_DECKLIST.quickdraw, 3);
assert.equal(PLACEHOLDER_DECKLIST.hypervoice, 3);
assert.equal(PLACEHOLDER_DECKLIST.recover, 2);
{
  const deck = createGame(1).players.player.drawPile;
  assert.equal(deck.length, 40);
  assert.equal(deck.filter((c) => c.cardType === 'Strategy').length, 8);
  assert.equal(deck.filter((c) => c.id === 'quickdraw').length, 3);
}
assert.ok(POKEMON_CARDS.filter((c) => c.innatePower === 'Quick Attack').length >= 2);
assert.ok(POKEMON_CARDS.filter((c) => c.innatePower === 'Agility').length >= 2);

// --- Quickdraw ----------------------------------------------------------------

// Draws 2, costs 1, uses the turn, then goes to the Discard Pile.
{
  let s = match();
  const uid = give(s, 'player', 'quickdraw');
  const top = ids(s.players.player.drawPile.slice(0, 2));
  s = strategy(s, 'player', uid);
  const p = s.players.player;
  assert.deepEqual(ids(p.hand), top);
  assert.equal(p.baseEnergy, 9);
  assert.equal(p.discard.at(-1).uid, uid, 'discarded after use');
  assert.equal(s.turn, 'ai');
  assert.ok(s.log.some((l) => l.startsWith('You played Quickdraw (Draw 2 cards.) Paid 1 Base Energy.')));
  assert.ok(s.log.some((l) => l.startsWith('Your Quickdraw: You drew 2 cards')));
}

// Drawn cards can be played this Round, and are discarded at Supper as normal.
{
  let s = match();
  const p = s.players.player;
  p.drawPile.unshift(...p.drawPile.splice(p.drawPile.findIndex((c) => c.id === 'emberkit'), 1));
  s = strategy(s, 'player', give(s, 'player', 'quickdraw'));
  s = applyAction(s, { type: 'pass', who: 'ai' });
  const ember = s.players.player.hand.find((c) => c.id === 'emberkit');
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: ember.uid, zone: 0, space: 0 });
  assert.equal(at(s, 'player', 0, 0).name, 'Emberkit');
  const left = s.players.player.hand.map((c) => c.uid);
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  assert.ok(left.every((u) => s.players.player.discard.some((c) => c.uid === u)), 'Supper discards the drawn card');
}

// Reshuffles the Discard Pile when the Draw Pile runs out; never draws itself.
{
  let s = match();
  const p = s.players.player;
  const uid = give(s, 'player', 'quickdraw');
  p.discard.push(...p.drawPile.splice(1));           // 1 card left in the Draw Pile, the rest discarded
  s = strategy(s, 'player', uid);
  const q = s.players.player;
  assert.equal(q.hand.length, 2);
  assert.ok(s.log.some((l) => l.startsWith('You shuffled your Discard Pile')));
  assert.ok(!q.hand.some((c) => c.uid === uid), 'Quickdraw was not in the Discard Pile while drawing');
  assert.deepEqual(q.discard.map((c) => c.uid), [uid]);
}

// Draws what it can; can't be played with nothing to draw.
{
  let s = match();
  const uid = give(s, 'player', 'quickdraw');
  const p = s.players.player;
  p.drawPile = p.drawPile.slice(0, 1);
  p.discard = [];
  s = strategy(s, 'player', uid);
  assert.equal(s.players.player.hand.length, 1);

  const t = match();
  const uid2 = give(t, 'player', 'quickdraw');
  t.players.player.drawPile = [];
  t.players.player.discard = [];
  assert.ok(!playableStrategies(t, 'player').some((c) => c.uid === uid2));
  assert.throws(() => strategy(t, 'player', uid2), /cannot/);
}

// --- Hypervoice ---------------------------------------------------------------

// 2 damage to every opponent Pokémon, Agility included; friendly ones untouched.
{
  let s = match();
  s = play(s, 'ai', 'pebblet', 0, 0);                // 5 → 3
  s = play(s, 'ai', 'gustling', 1, 1);               // Agility, 3 → 1
  s = play(s, 'ai', 'zappip', 2, 2);                 // 2 → defeated
  s = play(s, 'player', 'emberkit', 0, 0);
  const trainers = s.players.ai.zones.map((z) => z.trainer.strength);
  s.players.player.baseEnergy = 3;
  s = strategy(s, 'player', give(s, 'player', 'hypervoice'));
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 3);
  assert.equal(at(s, 'ai', 1, 1).currentStrength, 1, 'area effects still hit Agility');
  assert.equal(at(s, 'ai', 2, 2), null);
  assert.equal(s.players.ai.released.at(-1).name, 'Zappip');
  assert.equal(at(s, 'player', 0, 0).currentStrength, 3);
  assert.deepEqual(s.players.ai.zones.map((z) => z.trainer.strength), trainers, 'Trainers are not Pokémon');
  assert.equal(s.players.player.baseEnergy, 0);
  assert.ok(s.log.some((l) => l.includes("Your Hypervoice: 2 damage to AI Opponent's Gustling")));
}

// Needs at least one opponent Pokémon.
{
  let s = match();
  s = play(s, 'player', 'emberkit', 0, 0);
  s.turn = 'player';
  const uid = give(s, 'player', 'hypervoice');
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === uid));
  assert.ok(!legalActions(s, 'player').includes('playStrategy'));
}

// --- Recover ------------------------------------------------------------------

// Heals 5, capped at maximum Strength; any damaged Pokémon or Trainer, either side.
{
  let s = match();
  s = play(s, 'player', 'ironhorn', 0, 0);           // 8
  s = play(s, 'ai', 'pebblet', 1, 0);                // 5
  s = play(s, 'player', 'emberkit', 0, 1);           // undamaged
  at(s, 'player', 0, 0).currentStrength = 1;
  at(s, 'ai', 1, 0).currentStrength = 4;
  s.players.player.zones[2].trainer.strength = 13;
  s.players.ai.zones[0].trainer.strength = 2;
  const uid = give(s, 'player', 'recover');
  const keys = strategyTargets(s, 'player', uid).map((r) => `${r.owner}${r.kind[0]}${r.zone}${r.space ?? ''}`).sort();
  assert.deepEqual(keys, ['aip10', 'ait0', 'playerp00', 'playert2'], 'damaged cards only, both sides, Trainers too');
  s = strategy(s, 'player', uid, pref('player', 0, 0));
  assert.equal(at(s, 'player', 0, 0).currentStrength, 6);
  assert.equal(s.players.player.discard.at(-1).uid, uid);

  const second = give(s, 'player', 'recover');
  s = strategy(s, 'player', second, pref('player', 0, 0));
  assert.equal(at(s, 'player', 0, 0).currentStrength, 8, 'capped at maximum');

  let t = match();
  t.players.player.zones[2].trainer.strength = 13;
  t = strategy(t, 'player', give(t, 'player', 'recover'), tref('player', 2));
  assert.equal(t.players.player.zones[2].trainer.strength, 15, "capped at the Trainer's starting Strength");

  let u = match();
  u = play(u, 'ai', 'pebblet', 1, 0);
  at(u, 'ai', 1, 0).currentStrength = 1;
  u = strategy(u, 'player', give(u, 'player', 'recover'), pref('ai', 1, 0));
  assert.equal(at(u, 'ai', 1, 0).currentStrength, 5, "can heal the opponent's Pokémon");
}

// Respects a buffed maximum.
{
  let s = match({ passives: true });
  s = play(s, 'player', 'puddlop', 1, 0);            // Misty: 4 + 3 = 7
  at(s, 'player', 1, 0).currentStrength = 1;
  s = strategy(s, 'player', give(s, 'player', 'recover'), pref('player', 1, 0));
  assert.equal(at(s, 'player', 1, 0).currentStrength, 6);
  assert.equal(maxStrengthOf(at(s, 'player', 1, 0)), 7);
}

// Unplayable with no legal target: nothing damaged, or only Agility Pokémon damaged.
{
  let s = match();
  s = play(s, 'player', 'gustling', 0, 0);           // Agility
  s = play(s, 'player', 'emberkit', 0, 1);
  s.turn = 'player';
  const uid = give(s, 'player', 'recover');
  assert.deepEqual(strategyTargets(s, 'player', uid), []);
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === uid), 'nothing damaged');
  at(s, 'player', 0, 0).currentStrength = 1;
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === uid), 'Agility cannot be targeted by Strategy Cards');
  assert.throws(() => strategy(s, 'player', uid, pref('player', 0, 0)), /cannot/);
  at(s, 'player', 0, 1).currentStrength = 1;
  assert.deepEqual(strategyTargets(s, 'player', uid), [pref('player', 0, 1)]);
  assert.throws(() => strategy(s, 'player', uid, pref('player', 0, 0)), /legal target/);
}

// --- Agility vs Trainer Powers and attacks ------------------------------------

{
  let s = match();
  s = play(s, 'ai', 'gustling', 1, 0);               // Agility, in Misty's Zone
  assert.deepEqual(powerTargets(s, 'player', 1), [pref('ai', 1, 0)], 'Trainer Powers can still target it');
  s = play(s, 'player', 'emberkit', 0, 0);
  at(s, 'player', 0, 0).spent = false;
  s.turn = 'player';
  assert.ok(legalTargets(s, 'player', { zone: 0, space: 0 }).some((t) => t.kind === 'pokemon' && t.zone === 1), 'attacks can still target it');
}

// --- Quick Attack ---------------------------------------------------------------

// Arrives Active, and is Alert by the normal rules.
{
  let s = match();
  s = play(s, 'player', 'zappip', 0, 0);             // Swift, Quick Attack
  const zap = at(s, 'player', 0, 0);
  assert.equal(zap.spent, false, 'Active, not Spent');
  assert.ok(isAlert(s, zap), 'the only Active Pokémon: Alert');
  s = play(s, 'player', 'emberkit', 0, 1);           // no Quick Attack
  assert.equal(at(s, 'player', 0, 1).spent, true);

  s = play(s, 'ai', 'brawlix', 1, 0);                // Steady, Quick Attack
  const brawlix = at(s, 'ai', 1, 0);
  assert.equal(brawlix.spent, false);
  assert.ok(!isAlert(s, brawlix), 'Active but not Alert: a Swift Pokémon is Active');
  s = applyAction(s, { type: 'command', who: 'player', from: { zone: 0, space: 0 }, target: { kind: 'trainer', zone: 2 } });
  assert.ok(isAlert(s, at(s, 'ai', 1, 0)), 'Alert once the Swift one is Spent');
  assert.ok(legalActions(s, 'ai').includes('command'), 'can be Commanded the Round it arrived');
}

// Quick Attack also applies to Ash's free summon (every summon uses the same rules).
{
  let s = match();
  const p = s.players.player;
  p.drawPile.unshift(...p.drawPile.splice(p.drawPile.findIndex((c) => c.id === 'zappip'), 1));
  s = applyAction(s, { type: 'usePower', who: 'player', zone: 0 });
  s = applyAction(s, { type: 'resolveChoice', who: 'player', zone: 1, space: 1 });
  assert.equal(at(s, 'player', 1, 1).spent, false);
}

// --- AI -----------------------------------------------------------------------

// Recover only on its own damaged cards.
{
  let s = match();
  s = play(s, 'player', 'ironhorn', 0, 0);
  at(s, 'player', 0, 0).currentStrength = 1;         // only YOUR card is damaged
  s.turn = 'ai';
  s.players.ai.baseEnergy = 3;
  s.players.ai.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  give(s, 'ai', 'recover');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });
  s.players.ai.zones[1].trainer.strength = 4;
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'playStrategy', who: 'ai', uid: s.players.ai.hand[0].uid, target: tref('ai', 1) });
}

// Hypervoice only when you have Pokémon; it takes a good Hypervoice.
{
  let s = match();
  s.turn = 'ai';
  s.players.ai.baseEnergy = 3;
  s.players.ai.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  give(s, 'ai', 'hypervoice');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });
  s = play(s, 'player', 'zappip', 0, 0);
  s = play(s, 'player', 'emberkit', 0, 1);
  s.turn = 'ai';
  s.players.ai.baseEnergy = 3;
  assert.equal(chooseAction(s, 'ai').type, 'playStrategy');
}

console.log('All Strategy Card tests passed.');
