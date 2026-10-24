// Checks the one-screen layout rules that don't need a browser: the stage
// size, and that a hand of any size fans out inside the hand area.
// Run with: node tests/layout.test.js
import assert from 'node:assert/strict';
import { STAGE, HAND_AREA, HAND_CARD, fanPositions } from '../src/ui/render.js';

assert.deepEqual(STAGE, { width: 1920, height: 1080 });

// Small hands sit side by side, centred, without overlapping.
const three = fanPositions(3);
assert.equal(three.length, 3);
for (let i = 1; i < 3; i++) assert.ok(three[i] - three[i - 1] >= HAND_CARD, 'small hands do not overlap');
assert.ok(Math.abs(three[0] - (HAND_AREA - (three[2] + HAND_CARD))) <= 1, 'small hands are centred');

// Any hand size stays inside the hand area, overlapping more as it grows, in order.
for (let n = 1; n <= 40; n++) {
  const left = fanPositions(n);
  assert.ok(left[0] >= 0, `hand of ${n} starts inside the area`);
  assert.ok(left[n - 1] + HAND_CARD <= HAND_AREA, `hand of ${n} ends inside the area`);
  for (let i = 1; i < n; i++) assert.ok(left[i] > left[i - 1], `hand of ${n} keeps every card visible`);
}

console.log('layout tests passed');
