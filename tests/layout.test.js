// Checks the one-screen layout rules that don't need a browser: the stage
// size, and that my hand's fanned arc always fits its area.
// Run with: node tests/layout.test.js
import assert from 'node:assert/strict';
import { STAGE, HAND_AREA, HAND_AREA_H, HAND_CARD, HAND_CARD_H, LIFT, arcLayout } from '../src/ui/render.js';

assert.deepEqual(STAGE, { width: 1920, height: 1080 });

for (let n = 1; n <= 12; n++) {
  const spots = arcLayout(n);
  assert.equal(spots.length, n);
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    // Inside the hand area, left to right.
    assert.ok(s.left >= 0 && s.left + HAND_CARD <= HAND_AREA, `hand of ${n}: card ${i} stays in its area`);
    if (i) assert.ok(s.left > spots[i - 1].left, `hand of ${n}: cards in order, each partly visible`);
    // At rest, every card shows at least its top half above the bottom edge.
    assert.ok(s.top + HAND_CARD_H / 2 <= HAND_AREA_H, `hand of ${n}: card ${i} shows its top half`);
    // An arc: rotating out from the middle, edges lower than the centre.
    assert.ok(Math.abs(s.rot) < 15, 'only a slight rotation');
    assert.ok(Math.sign(s.rot) === Math.sign(i - (n - 1) / 2) || s.rot === 0, 'cards lean outwards');
  }
  if (n >= 3) assert.ok(spots[0].top > spots[Math.floor(n / 2)].top, `hand of ${n}: the edges sit lower than the middle`);
}

// Up to about 10 cards the fan tightens rather than growing past its area.
const ten = arcLayout(10);
assert.ok(ten[9].left - ten[0].left + HAND_CARD <= HAND_AREA);

// Hover: that card lifts, unrotated, fully above the bottom edge; its neighbours spread apart.
const rest = arcLayout(7);
const hover = arcLayout(7, 3);
assert.equal(hover[3].rot, 0);
assert.equal(hover[3].top, LIFT.top);
assert.ok(LIFT.top + HAND_CARD_H <= HAND_AREA_H, 'a lifted card is fully on screen');
assert.ok(hover[2].left < rest[2].left && hover[4].left > rest[4].left, 'neighbours move apart');

console.log('layout tests passed');
