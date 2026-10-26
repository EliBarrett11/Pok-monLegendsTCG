// Checks the animation speeds (Feedback batch 1): Slow, Normal (the default),
// Fast (the old Normal) and Instant; an old saved choice carries over; and
// banners with words stay up long enough to read at every speed but Instant.
// Run with: node tests/settings.test.js
import assert from 'node:assert/strict';
import { SPEEDS, DEFAULT_SPEED, migrateSpeed, readableMs, MIN_TEXT_MS, getSpeed, setSpeed, speedFactor } from '../src/ui/settings.js';

// The four speeds and their factors (a multiple of Fast, where the effects were tuned).
assert.deepEqual(Object.keys(SPEEDS), ['slow', 'normal', 'fast', 'instant']);
assert.deepEqual(Object.values(SPEEDS).map((s) => s.factor), [2, 1.5, 1, 0]);
assert.equal(DEFAULT_SPEED, 'normal');

// Without storage (as in Node) the game starts at Normal, and a choice still sticks.
assert.equal(getSpeed(), 'normal');
assert.equal(speedFactor(), 1.5);
setSpeed('slow');
assert.equal(speedFactor(), 2);
setSpeed('turbo');
assert.equal(getSpeed(), 'slow', 'an unknown speed is ignored');
setSpeed('normal');

// An old saved choice: the old Normal is today's Fast; the old Fast is gone, so Fast too.
assert.equal(migrateSpeed('normal'), 'fast');
assert.equal(migrateSpeed('fast'), 'fast');
assert.equal(migrateSpeed('instant'), 'instant');
assert.equal(migrateSpeed(null), null);
assert.equal(migrateSpeed('weird'), null);

// Banners with words: at least 1.2 s at Normal, scaled by the speed, none at Instant.
assert.equal(MIN_TEXT_MS, 1200);
assert.equal(readableMs(300, 1.5), 1200);
assert.equal(readableMs(300, 1), 800);
assert.equal(readableMs(300, 2), 1600);
assert.equal(readableMs(300, 0), 0);
assert.equal(readableMs(2500, 1.5), 2500, 'a longer banner keeps its own length');
assert.equal(readableMs(300), 1200, 'uses the current speed');

console.log('All settings tests passed.');
