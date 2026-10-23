// Plays the setup sequence with the AI on both sides and checks the rules hold.
// Run with: node tests/setup.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';

function playSetup(seed) {
  let s = createGame(seed);
  for (const who of PLAYERS) {
    assert.equal(s.players[who].drawPile.length, 40, 'deck is 40 cards');
    assert.equal(s.players[who].zones.length, 3);
    assert.ok(s.players[who].zones.every((z) => z.pokemon.length === 3), '3 Pokémon Spaces per zone');
  }

  // Trainers: first chooser's pick stays hidden until both have chosen.
  s = applyAction(s, chooseAction(s, 'player'));
  assert.equal(s.phase, 'trainers');
  assert.ok(s.players.player.zones.every((z) => z.trainer === null), 'not revealed before both choose');
  s = applyAction(s, chooseAction(s, 'ai'));
  assert.equal(s.phase, 'initiative');
  for (const who of PLAYERS) {
    const placed = s.players[who].zones.map((z) => z.trainer.uid);
    assert.equal(new Set(placed).size, 3, 'each zone has a different Trainer');
  }

  // Coin flip -> Round 1 Breakfast, 7 cards each.
  s = applyAction(s, { type: 'flipCoin' });
  assert.equal(s.round, 1);
  assert.equal(s.phase, 'breakfast');
  assert.ok(PLAYERS.includes(s.initiative));
  for (const who of PLAYERS) {
    assert.equal(s.players[who].hand.length, 7);
    assert.equal(s.players[who].drawPile.length, 33);
  }

  // Mulligan 3 for the player, AI decides for itself.
  const toss = s.players.player.hand.slice(0, 3).map((c) => c.uid);
  s = applyAction(s, { type: 'mulligan', who: 'player', cardUids: toss });
  assert.equal(s.players.player.hand.length, 7, 'hidden until both choose');
  s = applyAction(s, chooseAction(s, 'ai'));
  assert.equal(s.phase, 'battle');
  assert.equal(s.players.player.hand.length, 7);
  assert.equal(s.players.player.discard.length, 3);
  assert.equal(s.players.player.drawPile.length, 30);
  assert.ok(toss.every((u) => !s.players.player.hand.some((c) => c.uid === u)), 'tossed cards left the hand');
  for (const who of PLAYERS) {
    const p = s.players[who];
    assert.equal(p.hand.length + p.drawPile.length + p.discard.length, 40, 'no cards lost or duplicated');
  }
  return s;
}

// Illegal actions are refused.
let s = createGame(1);
assert.throws(() => applyAction(s, { type: 'mulligan', who: 'player', cardUids: [] }));
assert.throws(() => applyAction(s, { type: 'assignTrainers', who: 'player', order: ['x', 'y', 'z'] }));

// Same seed gives the same match; coin flips go both ways across seeds.
assert.deepEqual(createGame(42).players.player.drawPile, createGame(42).players.player.drawPile);
const winners = new Set();
for (let seed = 1; seed <= 50; seed++) winners.add(playSetup(seed).initiative);
assert.equal(winners.size, 2, 'both players can win the coin flip');

console.log('All setup tests passed (50 seeded matches).');
