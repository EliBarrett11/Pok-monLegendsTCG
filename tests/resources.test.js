// Checks what the resource displays show: Energy crystals and sockets, extra
// crystals above the Round's Base Energy, Exert gems / Exhaust stones / locked
// sockets, and pile heights. Run with: node tests/resources.test.js
import assert from 'node:assert/strict';
import { energySlots, exertSlots, pileDepth, PILE_DEPTH } from '../src/ui/resources.js';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { refreshEnergy, payCost } from '../src/engine/energy.js';

// --- Energy crystals ------------------------------------------------------------

assert.deepEqual(energySlots(0, 0), { sockets: 0, lit: 0, bonus: 0 }, 'setup: no sockets yet');
assert.deepEqual(energySlots(1, 1), { sockets: 1, lit: 1, bonus: 0 }, 'Round 1: one lit crystal');
assert.deepEqual(energySlots(6, 4), { sockets: 6, lit: 4, bonus: 0 }, 'two spent: dim sockets');
assert.deepEqual(energySlots(14, 10), { sockets: 10, lit: 10, bonus: 0 }, 'never more than 10 sockets');
assert.deepEqual(energySlots(12, 12), { sockets: 10, lit: 10, bonus: 2 }, 'above 10: extra crystals');
assert.deepEqual(energySlots(3, 4), { sockets: 3, lit: 3, bonus: 1 }, 'a Pass above this Round\'s Base Energy');

// Through play: a Pass that gains Energy shows one more lit (or extra) crystal.
{
  let s = createGame(41);
  const box = () => s.players.player;
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  s.turn = 'player';
  s.passesInARow = 0;
  const before = energySlots(s.round, box().baseEnergy);
  s = applyAction(s, { type: 'pass', who: 'player' });
  const after = energySlots(s.round, box().baseEnergy);
  assert.equal(after.lit + after.bonus, before.lit + before.bonus + 1);
}

// --- Exert gems and Exhaust stones ------------------------------------------------

{
  const p = { baseEnergy: 0, exertMax: 0, exhaust: [] };
  refreshEnergy(p, 1);
  assert.deepEqual(exertSlots(p).map((x) => x.kind), ['free', 'locked', 'locked'], 'Round 1: two sockets locked');
  refreshEnergy(p, 2);
  assert.deepEqual(exertSlots(p).map((x) => x.kind), ['free', 'free', 'locked'], 'Round 2: one locked');
  refreshEnergy(p, 4);
  assert.deepEqual(exertSlots(p).map((x) => x.kind), ['free', 'free', 'free']);
  payCost(p, 6, 4);   // 4 Base, 2 Exert: positions 1 and 2, recovering in Rounds 6 and 7
  const slots = exertSlots(p);
  assert.deepEqual(slots.map((x) => x.kind), ['free', 'stone', 'stone'], 'the spent gems turn to stone');
  assert.deepEqual(slots.filter((x) => x.recoversRound).map((x) => x.recoversRound), [6, 7], 'soonest recovery first');
  refreshEnergy(p, 6);
  assert.deepEqual(exertSlots(p).map((x) => x.kind), ['free', 'free', 'stone'], 'at Breakfast the soonest stone glows back');
  assert.equal(exertSlots(p)[2].recoversRound, 7);
}

// --- Pile heights -------------------------------------------------------------------

assert.equal(pileDepth(0), 0);
assert.equal(pileDepth(1), 1);
assert.ok(pileDepth(12) > pileDepth(4), 'taller with more cards');
assert.equal(pileDepth(200), PILE_DEPTH, 'up to a limit');

console.log('All resource display tests passed.');
