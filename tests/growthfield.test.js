// Growth on the field (Grass G3, docs/decks.md 2.7): the view-model in
// src/ui/resources.js. While a player has Growth, a Growth card shows in one
// of their empty Pokémon Spaces (the board margin if none is empty), its image
// chosen by the amount; at 0 it's gone. It stays put until its space is taken.
// Run with: node tests/growthfield.test.js

import assert from 'node:assert/strict';
import { growthStage, growthImage, growthSpot, emptySpaces, panelView } from '../src/ui/resources.js';
import { createGame } from '../src/engine/game.js';

// The image from the amount: 1–2, 3–4, 5–7, 8+.
const stages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(growthStage);
assert.deepEqual(stages, [0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4]);
assert.equal(growthImage(0), null);
assert.equal(growthImage(2), 'assets/ui/growth-1.jpg');
assert.equal(growthImage(4), 'assets/ui/growth-2.jpg');
assert.equal(growthImage(7), 'assets/ui/growth-3.jpg');
assert.equal(growthImage(8), 'assets/ui/growth-4.jpg');

// A player with 3 Zones of 3 spaces; fill(list of [zone, space]) puts a Pokémon there.
function player(growth, filled = []) {
  const p = { growth, zones: Array.from({ length: 3 }, () => ({ pokemon: [null, null, null] })) };
  for (const [z, s] of filled) p.zones[z].pokemon[s] = { uid: `p${z}${s}`, name: 'Test' };
  return p;
}
const isEmpty = (p, spot) => !p.zones[spot.zone].pokemon[spot.space];

// Hidden at 0 (and with no Growth at all).
assert.equal(growthSpot(player(0), null), null);
assert.equal(growthSpot({ ...player(0), growth: undefined }, null), null);
assert.equal(growthSpot(player(0), { amount: 3, stage: 2, zone: 1, space: 1 }), null, 'withers at 0');

// The space chosen is empty; the image and amount come with it.
for (let seed = 0; seed < 40; seed++) {
  const p = player(5, [[0, 0], [0, 1], [1, 2], [2, 0]]);
  const spot = growthSpot(p, null, `s${seed}`);
  assert.ok(isEmpty(p, spot), `seed ${seed}: an empty space`);
  assert.deepEqual([spot.amount, spot.stage, spot.image, spot.margin], [5, 3, 'assets/ui/growth-3.jpg', undefined]);
}
// It's chosen at random (by seed): different seeds use more than one space.
const picks = new Set(Array.from({ length: 30 }, (_, i) => {
  const s = growthSpot(player(1), null, `r${i}`);
  return `${s.zone}${s.space}`;
}));
assert.ok(picks.size > 3, 'spread over the spaces');
// The same seed gives the same space (both players' screens agree).
assert.deepEqual(growthSpot(player(2), null, 'same'), growthSpot(player(2), null, 'same'));

// It stays where it is while that space is empty, whatever the amount.
{
  let p = player(2);
  const first = growthSpot(p, null, 'a');
  p = player(6, [[(first.zone + 1) % 3, 0]]);
  const again = growthSpot(p, first, 'b');
  assert.deepEqual([again.zone, again.space, again.stage], [first.zone, first.space, 3], 'stays put; grows');
}

// It relocates when its space is taken: to another empty space.
{
  const first = growthSpot(player(2), null, 'c');
  const p = player(2, [[first.zone, first.space]]);
  const moved = growthSpot(p, first, 'c');
  assert.ok(isEmpty(p, moved), 'moved to an empty space');
  assert.notDeepEqual([moved.zone, moved.space], [first.zone, first.space]);
}

// With no empty space, it sits in the board margin; it comes back when one frees up.
{
  const all = [0, 1, 2].flatMap((z) => [0, 1, 2].map((s) => [z, s]));
  const full = player(4, all);
  assert.deepEqual(emptySpaces(full), []);
  const margin = growthSpot(full, { amount: 4, stage: 2, zone: 0, space: 0 }, 'd');
  assert.deepEqual([margin.margin, margin.zone, margin.amount], [true, undefined, 4]);
  const back = growthSpot(player(4, all.slice(1)), margin, 'd');
  assert.deepEqual([back.zone, back.space, back.margin], [0, 0, undefined], 'back into the one empty space');
}

// Growth is no longer in the resource panel.
{
  const s = createGame(1, { decks: { player: 'grass', ai: 'fire' } });
  assert.equal('growth' in panelView(s, 'player'), false);
}

console.log('Growth on the field tests passed.');
