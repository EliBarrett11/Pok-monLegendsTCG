// V3-0: the AI plays only through the engine's actions, and AI-vs-AI matches finish.
// Run: node v3/tests/ai.test.js (prints the average Rounds per match and how matches end).
import assert from 'node:assert/strict';
import { createGame, applyAction, actor, legalActions } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { report } from '../tools/matches.js';

// Every AI move is a legal engine action (applyAction checks it), for both seats.
{
  let s = createGame(42);
  for (let i = 0; i < 3000 && s.phase !== 'gameOver'; i++) {
    const who = actor(s);
    const a = chooseAction(s, who, { rng: () => 0.5 });
    assert.equal(a.who, who);
    assert.ok(legalActions(s, who).includes(a.type), `${a.type} is legal`);
    s = applyAction(s, a);
  }
  assert.equal(s.phase, 'gameOver');
}

const N = 40;
const r = report(N, 2000);
assert.equal(r.unfinished, 0, 'every match finishes');
const done = N - r.unfinished;
assert.ok(r.rounds / done >= 4 && r.rounds / done <= 14, 'matches last a sensible number of Rounds');
console.log(`ai: ${N} AI-vs-AI matches finished · average ${(r.rounds / done).toFixed(2)} Rounds · ends: Trophy before the Championship ${r.ends.trophyBefore}, Trophy during it ${r.ends.trophyInChampionship}, crowned at its end ${r.ends.champion}, draws ${r.ends.draw} — ok`);
