// Plays whole Rounds and checks Breakfast, Battle turns, Supper and initiative.
// Run with: node tests/round.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, winner, PLAYERS, opponentOf } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';

const total = (p) => p.hand.length + p.drawPile.length + p.discard.length;

// Setup with both sides keeping their hands, ending at Round 1 Battle.
function toRound1Battle(seed) {
  let s = createGame(seed);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  return s;
}

function bothPass(s) {
  s = applyAction(s, { type: 'pass', who: s.turn });
  return applyAction(s, { type: 'pass', who: s.turn });
}

for (let seed = 1; seed <= 20; seed++) {
  let s = toRound1Battle(seed);
  const first = s.initiative;
  assert.equal(s.phase, 'battle');
  assert.equal(s.turn, first, 'initiative acts first');

  // Only the player whose turn it is may act, and only one Action per turn.
  assert.throws(() => applyAction(s, { type: 'pass', who: opponentOf(first) }));
  s = applyAction(s, { type: 'pass', who: first });
  assert.equal(s.phase, 'battle', 'one pass does not end Battle');
  assert.equal(s.turn, opponentOf(first));
  assert.throws(() => applyAction(s, { type: 'pass', who: first }));

  // Second consecutive pass → Supper → Round 2 Breakfast → Round 2 Battle.
  const handsBefore = PLAYERS.map((w) => s.players[w].hand.map((c) => c.uid));
  s = applyAction(s, { type: 'pass', who: s.turn });
  assert.equal(s.round, 2);
  assert.equal(s.phase, 'battle');
  assert.equal(s.initiative, opponentOf(first), 'initiative switches each Round');
  assert.equal(s.turn, s.initiative);
  PLAYERS.forEach((w, i) => {
    const p = s.players[w];
    assert.ok(handsBefore[i].every((u) => p.discard.some((c) => c.uid === u)), 'Supper discards the whole hand');
    assert.equal(p.hand.length, 7, 'Breakfast draws 7');
    assert.equal(p.baseEnergy, 2);
    assert.equal(p.exertMax, 2);
    assert.equal(total(p), 40);
  });
  assert.throws(() => applyAction(s, { type: 'mulligan', who: 'player', cardUids: [] }), 'no mulligan after Round 1');

  // Keep playing: 40 cards / 7 per Round empties the Draw Pile in Round 6,
  // so the Discard Pile is reshuffled mid-draw. Every hand is still 7.
  for (let round = 3; round <= 12; round++) {
    s = bothPass(s);
    assert.equal(s.round, round);
    assert.equal(s.initiative, round % 2 === 1 ? first : opponentOf(first));
    for (const w of PLAYERS) {
      const p = s.players[w];
      assert.equal(p.hand.length, 7);
      assert.equal(total(p), 40, 'no cards lost or duplicated');
      assert.equal(p.baseEnergy, Math.min(round, 10));
      assert.equal(p.exertMax, 3);
    }
  }
  assert.ok(s.log.some((l) => l.includes('shuffled') && l.includes('Discard Pile')), 'reshuffle was logged');
  assert.ok(s.log.includes('Supper Phase ends.'));
  assert.ok(s.log.includes('Breakfast Phase ends.'));
  assert.ok(s.log.includes('Both players passed in a row. Battle Phase ends.'));
}

// The AI passes on its turn.
{
  const s = toRound1Battle(3);
  assert.deepEqual(chooseAction(s, s.turn), { type: 'pass', who: s.turn });
  assert.equal(chooseAction(s, opponentOf(s.turn)), null);
}

// Drawing stops if both Draw Pile and Discard Pile are empty.
{
  let s = toRound1Battle(6);
  const p = s.players.player;
  p.drawPile = p.drawPile.slice(0, 2);
  p.discard = [];
  p.hand = [];
  s = bothPass(s);                     // nothing to discard at Supper, 2 to draw
  assert.equal(s.players.player.hand.length, 2, 'draws what it can, then stops');
  assert.equal(s.players.player.drawPile.length, 0);
  assert.equal(s.phase, 'battle', 'the Round carries on');
}

// Trainers start at placeholder Strength 15; win check needs all 3 at 0.
{
  let s = toRound1Battle(7);
  for (const w of PLAYERS) assert.ok(s.players[w].trainers.every((t) => t.strength === 15));
  assert.equal(winner(s), null);
  s.players.ai.trainers[0].strength = 0;
  s.players.ai.trainers[1].strength = 0;
  assert.equal(winner(s), null, 'two Trainers down is not a win');
  s.players.ai.trainers[2].strength = 0;
  assert.equal(winner(s), 'player');
  s = applyAction(s, { type: 'pass', who: s.turn });
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 'player');
}

console.log('All Round tests passed (20 seeded matches, 12 Rounds each).');
