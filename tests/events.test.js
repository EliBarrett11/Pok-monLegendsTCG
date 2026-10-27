// Checks the structured events every Action produces alongside the log
// (the UI plays them back one after another).
// Run with: node tests/events.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, ACTION_TYPES, PLAYERS, legalActions } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';

// AI-vs-AI matches; every Action taken must produce at least one event.
const seen = {};
const eventTypes = new Set();
for (let seed = 1; seed <= 30; seed++) {
  let s = createGame(seed);
  const box = { rng: seed * 7919 };
  const rng = () => nextRandom(box);   // the AI's choices replay exactly too
  for (let i = 0; i < 4000 && s.phase !== 'gameOver' && s.round <= 60; i++) {
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    const action = chooseAction(s, who, { rng }) ?? { type: 'flipCoin' };
    s = applyAction(s, action);
    assert.ok(s.events.length > 0, `${action.type} produced no events (seed ${seed})`);
    for (const e of s.events) {
      assert.equal(typeof e.type, 'string');
      eventTypes.add(e.type);
    }
    seen[action.type] = (seen[action.type] ?? 0) + 1;
  }
}

// Events are fresh for each action, not carried over.
let s = createGame(5);
s = applyAction(s, chooseAction(s, 'player'));
assert.deepEqual(s.events.map((e) => e.type), ['trainersLocked']);
s = applyAction(s, chooseAction(s, 'ai'));
assert.equal(s.events[0].type, 'trainersLocked');
assert.ok(s.events.some((e) => e.type === 'trainersRevealed' && e.who === 'ai' && e.trainers.length === 3));

// Every Action type was taken at least once above. (Not Evolve yet: no Fire or
// Water card evolves; tests/grass.test.js checks it with test-only cards.)
for (const type of ACTION_TYPES.filter((t) => t !== 'evolve')) assert.ok(seen[type], `no match used ${type}`);

// Key events name the cards and places involved.
for (const type of ['cardPlayed', 'attack', 'damage', 'defeated', 'powerUsed', 'pass', 'phaseChanged', 'cardMoved', 'buff', 'questProgress', 'weatherChanged']) {
  assert.ok(eventTypes.has(type), `no ${type} event seen`);
}

console.log(`events tests passed (${Object.entries(seen).map(([t, n]) => `${t} ${n}`).join(', ')})`);
