// Checks passing with unmatched speed: a Pass by the only player with Active
// Pokémon at the top Speed-Tier makes those Pokémon Spent.
// Run with: node tests/unmatched.test.js
import assert from 'node:assert/strict';
import { useTestTrainers, TEST_POKEMON } from './fixtures.js';
import { createGame, applyAction, PLAYERS, opponentOf, isAlert, passSpends } from '../src/engine/game.js';
import { inPlay } from '../src/engine/board.js';
import { chooseAction } from '../src/ai/opponent.js';
import { passWarning } from '../src/ui/render.js';

function toRound1Battle(seed) {
  let s = useTestTrainers(createGame(seed));
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  return s;
}
// An empty board, then Pokémon placed by name: [who, zone, space, name, spent?]
let n = 0;
function board(s, placements) {
  for (const w of PLAYERS) for (const z of s.players[w].zones) z.pokemon = [null, null, null];
  for (const [w, zone, space, name, spent = false] of placements) {
    const def = Object.values(TEST_POKEMON).find((c) => c.name === name);
    s.players[w].zones[zone].pokemon[space] = inPlay({ ...def, uid: `t-${n++}` }, { spent });
  }
  return s;
}
const at = (s, w, zone, space) => s.players[w].zones[zone].pokemon[space];
const gainedEnergy = (s, w) => s.events.some((e) => e.type === 'energyGained' && e.who === w && e.source === 'Pass');

// Example 1: my Active Swift Test Wing and Steady Test Fin; the opponent's best Active is Steady (Test Blaze).
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Test Wing'], [me, 1, 0, 'Test Fin'], [foe, 0, 0, 'Test Blaze']]);
  assert.deepEqual(passSpends(s, me).map((r) => r.name), ['Test Wing']);
  const before = s.players[me].baseEnergy;
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(at(s, me, 0, 0).spent, true, 'Test Wing becomes Spent');
  assert.equal(at(s, me, 1, 0).spent, false, 'Test Fin stays Active');
  assert.equal(s.players[me].baseEnergy, before + 1, 'the Pass still gains +1 Base Energy');
  assert.ok(gainedEnergy(s, me));
  assert.ok(s.events.some((e) => e.type === 'spentByPass' && e.who === me && e.targets.map((t) => t.name).join() === 'Test Wing'));
  // Alert is worked out afresh: the Steady Pokémon on both sides are now Alert.
  assert.equal(isAlert(s, at(s, me, 1, 0)), true, 'my Test Fin is now Alert');
  assert.equal(isAlert(s, at(s, foe, 0, 0)), true, "the opponent's Test Blaze is now Alert");
  assert.equal(isAlert(s, at(s, me, 0, 0)), false);
}

// Example 2: both of us have an Active Swift Pokémon: nothing is Spent.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Test Wing'], [foe, 0, 0, 'Test Spark']]);
  assert.deepEqual(passSpends(s, me), []);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(at(s, me, 0, 0).spent, false);
  assert.equal(at(s, foe, 0, 0).spent, false);
  assert.ok(!s.events.some((e) => e.type === 'spentByPass'));
  assert.ok(gainedEnergy(s, me));
}

// Example 3: my only Active Pokémon are Swift; the opponent has no Active Pokémon.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Test Wing'], [me, 2, 1, 'Test Spark'], [foe, 1, 0, 'Test Steel', true]]);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(at(s, me, 0, 0).spent, true);
  assert.equal(at(s, me, 2, 1).spent, true, 'all of them at that tier');
  assert.ok(gainedEnergy(s, me));
}

// Lower tiers are untouched, and the opponent's Slow Pokémon becomes Alert once nothing faster is Active.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Test Spark'], [foe, 0, 0, 'Test Rock']]);
  assert.equal(isAlert(s, at(s, foe, 0, 0)), false);
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(at(s, me, 0, 0).spent, true);
  assert.equal(isAlert(s, at(s, foe, 0, 0)), true, 'the next tier down becomes Alert, on either side');
}

// The phase-ending Pass: the rule doesn't apply.
{
  let s = toRound1Battle(4);
  const first = s.turn;
  const me = opponentOf(first);
  board(s, [[me, 0, 0, 'Test Wing']]);
  s = applyAction(s, { type: 'pass', who: first });   // the opponent passes first (they have nothing at the top tier)
  assert.deepEqual(passSpends(s, me), [], 'a Pass that would end the phase spends nothing');
  s = applyAction(s, { type: 'pass', who: me });
  assert.ok(s.events.some((e) => e.type === 'phaseChanged' && e.phase === 'supper'), 'the Battle Phase ended');
  assert.ok(!s.events.some((e) => e.type === 'spentByPass'), 'nobody was made Spent');
}

// The warning for the player: only when the rule would trigger.
{
  let s = toRound1Battle(4);
  if (s.turn !== 'player') s = applyAction(s, { type: 'pass', who: s.turn });   // now it's my turn (and my Pass would end the phase)
  board(s, [['player', 0, 0, 'Test Wing'], ['player', 1, 0, 'Test Shadow'], ['ai', 0, 0, 'Test Blaze']]);
  s.passesInARow = 0;
  const w = passWarning(s);
  assert.ok(w, 'warning shown');
  assert.equal(w.text, "Passing now will make Test Wing and Test Shadow Spent this Round, because the opponent can't match their speed.");
  assert.deepEqual(w.refs.map((r) => r.name), ['Test Wing', 'Test Shadow']);
  // Not when the opponent matches the top tier, not on the phase-ending Pass, not on the opponent's turn.
  board(s, [['player', 0, 0, 'Test Wing'], ['ai', 0, 0, 'Test Spark']]);
  assert.equal(passWarning(s), null, 'matched speed: no warning');
  board(s, [['player', 0, 0, 'Test Wing'], ['ai', 0, 0, 'Test Blaze']]);
  assert.ok(passWarning(s));
  assert.equal(passWarning({ ...s, passesInARow: 1 }), null, 'phase-ending Pass: no warning');
  assert.equal(passWarning({ ...s, turn: 'ai' }), null, "opponent's turn: no warning");
  board(s, [['ai', 0, 0, 'Test Blaze']]);
  assert.equal(passWarning(s), null, 'no Pokémon of mine at the top tier: no warning');
}

// The AI: alone at the top tier with a target, it attacks rather than passing them away.
{
  let s = toRound1Battle(4);
  if (s.turn !== 'ai') s = applyAction(s, { type: 'pass', who: s.turn });
  s.passesInARow = 0;
  board(s, [['ai', 0, 0, 'Test Spark'], ['player', 0, 0, 'Test Rock']]);
  s.players.ai.hand = [];
  s.players.ai.baseEnergy = 0;
  for (let i = 0; i < 20; i++) {
    const a = chooseAction(s, 'ai', { rng: () => i / 20 });
    assert.equal(a.type, 'command', 'the AI Commands its unmatched Pokémon before passing');
  }
}

console.log('All unmatched-speed tests passed.');
