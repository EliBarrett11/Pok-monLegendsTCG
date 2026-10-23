// Checks Base Energy, Exert and Exhaust against the rulebook examples.
// Run with: node tests/energy.test.js
import assert from 'node:assert/strict';
import { newEnergy, refreshEnergy, payCost, canPay, availableExert } from '../src/engine/energy.js';

// Plays Breakfast for each Round from 1 to `to`, spending as listed: { round: cost }.
function playRounds(to, spends = {}) {
  const p = newEnergy();
  for (let round = 1; round <= to; round++) {
    refreshEnergy(p, round);
    if (spends[round]) {
      p.baseEnergy = 0; // spend from Exert alone, to hit the examples exactly
      payCost(p, spends[round], round);
    }
  }
  return p;
}
const recoveries = (p) => [...p.exhaust].sort((a, b) => a.position - b.position)
  .map((x) => [x.position, x.recoversRound]);

// Base Energy = Round number, max 10. Exert max = 1, 2, then 3.
{
  const p = newEnergy();
  const seen = [];
  for (let round = 1; round <= 12; round++) {
    refreshEnergy(p, round);
    seen.push([p.baseEnergy, p.exertMax]);
  }
  assert.deepEqual(seen.map((x) => x[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10]);
  assert.deepEqual(seen.map((x) => x[1]), [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
}

// Unspent Base Energy doesn't carry over; it resets to the Round number.
{
  const p = newEnergy();
  refreshEnergy(p, 3);
  payCost(p, 1, 3);
  assert.equal(p.baseEnergy, 2);
  refreshEnergy(p, 4);
  assert.equal(p.baseEnergy, 4);
}

// Base Energy first; Exert only covers the shortfall.
{
  const p = newEnergy();
  refreshEnergy(p, 2);                     // 2 Base, Exert 2/2
  assert.deepEqual(payCost(p, 2, 2), { fromBase: 2, fromExert: 0 });
  assert.equal(availableExert(p), 2, 'no Exert spent while Base Energy covers the cost');

  const q = newEnergy();
  refreshEnergy(q, 1); refreshEnergy(q, 2); refreshEnergy(q, 3);
  q.baseEnergy = 2;                        // 2 Base left, cost 3
  assert.deepEqual(payCost(q, 3, 3), { fromBase: 2, fromExert: 1 });
  assert.equal(q.baseEnergy, 0);
  assert.equal(availableExert(q), 2);
}

// Can't pay more than Base Energy + available Exert.
{
  const p = newEnergy();
  refreshEnergy(p, 2);                     // 2 Base + 2 Exert = 4
  assert.ok(canPay(p, 4));
  assert.ok(!canPay(p, 5));
  assert.throws(() => payCost(p, 5, 2));
  assert.equal(p.baseEnergy, 2, 'a refused payment changes nothing');
}

// Example: spend 1 in Round 1 → recovers Round 3.
{
  assert.deepEqual(recoveries(playRounds(1, { 1: 1 })), [[1, 3]]);
  assert.equal(availableExert(playRounds(2, { 1: 1 })), 1, 'Round 2: 1 of 2 still Exhausted');
  const p = playRounds(3, { 1: 1 });
  assert.equal(p.exhaust.length, 0, 'recovered at Round 3 Breakfast');
  assert.equal(availableExert(p), 3);
}

// Example: spend 2 in Round 2 → positions 1 and 2 → Rounds 4 and 5.
// Then 1 in Round 3 → position 3 → Round 7.
// Then 1 in Round 4 → position 1 (freed at Round 4 Breakfast) → Round 6.
{
  assert.deepEqual(recoveries(playRounds(2, { 2: 2 })), [[1, 4], [2, 5]]);
  assert.deepEqual(recoveries(playRounds(3, { 2: 2, 3: 1 })), [[1, 4], [2, 5], [3, 7]]);
  const p = playRounds(4, { 2: 2, 3: 1, 4: 1 });
  assert.deepEqual(recoveries(p), [[1, 6], [2, 5], [3, 7]]);
  assert.equal(availableExert(p), 0);
  // Points never move up: position 3 still recovers at Round 7 after 2 frees up.
  refreshEnergy(p, 5);
  assert.deepEqual(recoveries(p), [[1, 6], [3, 7]]);
  refreshEnergy(p, 6);
  assert.deepEqual(recoveries(p), [[3, 7]]);
  refreshEnergy(p, 7);
  assert.deepEqual(recoveries(p), []);
  assert.equal(availableExert(p), 3, 'Unspent Exert carries over; all 3 are back');
}

console.log('All Energy tests passed.');
