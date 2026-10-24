// Checks passing with unmatched speed: a Pass by the only player with Active
// Pokémon at the top Speed-Tier makes those Pokémon Spent.
// Run with: node tests/unmatched.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS, opponentOf, isAlert, passSpends } from '../src/engine/game.js';
import { buildDeck } from '../src/engine/cards.js';
import { inPlay } from '../src/engine/board.js';
import { chooseAction } from '../src/ai/opponent.js';
import { passWarning } from '../src/ui/render.js';

function toRound1Battle(seed) {
  let s = createGame(seed);
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
    const def = buildDeck('t').find((c) => c.name === name);
    s.players[w].zones[zone].pokemon[space] = inPlay({ ...def, uid: `t-${n++}` }, { spent });
  }
  return s;
}
const at = (s, w, zone, space) => s.players[w].zones[zone].pokemon[space];
const gainedEnergy = (s, w) => s.events.some((e) => e.type === 'energyGained' && e.who === w && e.source === 'Pass');

// Example 1: my Active Swift Pidgey and Steady Goldeen; the opponent's best Active is Steady (Magmar).
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Pidgey'], [me, 1, 0, 'Goldeen'], [foe, 0, 0, 'Magmar']]);
  assert.deepEqual(passSpends(s, me).map((r) => r.name), ['Pidgey']);
  const before = s.players[me].baseEnergy;
  s = applyAction(s, { type: 'pass', who: me });
  assert.equal(at(s, me, 0, 0).spent, true, 'Pidgey becomes Spent');
  assert.equal(at(s, me, 1, 0).spent, false, 'Goldeen stays Active');
  assert.equal(s.players[me].baseEnergy, before + 1, 'the Pass still gains +1 Base Energy');
  assert.ok(gainedEnergy(s, me));
  assert.ok(s.events.some((e) => e.type === 'spentByPass' && e.who === me && e.targets.map((t) => t.name).join() === 'Pidgey'));
  // Alert is worked out afresh: the Steady Pokémon on both sides are now Alert.
  assert.equal(isAlert(s, at(s, me, 1, 0)), true, 'my Goldeen is now Alert');
  assert.equal(isAlert(s, at(s, foe, 0, 0)), true, "the opponent's Magmar is now Alert");
  assert.equal(isAlert(s, at(s, me, 0, 0)), false);
}

// Example 2: both of us have an Active Swift Pokémon: nothing is Spent.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const foe = opponentOf(me);
  board(s, [[me, 0, 0, 'Pidgey'], [foe, 0, 0, 'Shinx']]);
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
  board(s, [[me, 0, 0, 'Pidgey'], [me, 2, 1, 'Shinx'], [foe, 1, 0, 'Lairon', true]]);
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
  board(s, [[me, 0, 0, 'Shinx'], [foe, 0, 0, 'Geodude']]);
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
  board(s, [[me, 0, 0, 'Pidgey']]);
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
  board(s, [['player', 0, 0, 'Pidgey'], ['player', 1, 0, 'Absol'], ['ai', 0, 0, 'Magmar']]);
  s.passesInARow = 0;
  const w = passWarning(s);
  assert.ok(w, 'warning shown');
  assert.equal(w.text, "Passing now will make Pidgey and Absol Spent this Round, because the opponent can't match their speed.");
  assert.deepEqual(w.refs.map((r) => r.name), ['Pidgey', 'Absol']);
  // Not when the opponent matches the top tier, not on the phase-ending Pass, not on the opponent's turn.
  board(s, [['player', 0, 0, 'Pidgey'], ['ai', 0, 0, 'Shinx']]);
  assert.equal(passWarning(s), null, 'matched speed: no warning');
  board(s, [['player', 0, 0, 'Pidgey'], ['ai', 0, 0, 'Magmar']]);
  assert.ok(passWarning(s));
  assert.equal(passWarning({ ...s, passesInARow: 1 }), null, 'phase-ending Pass: no warning');
  assert.equal(passWarning({ ...s, turn: 'ai' }), null, "opponent's turn: no warning");
  board(s, [['ai', 0, 0, 'Magmar']]);
  assert.equal(passWarning(s), null, 'no Pokémon of mine at the top tier: no warning');
}

// The AI: alone at the top tier with a target, it attacks rather than passing them away.
{
  let s = toRound1Battle(4);
  if (s.turn !== 'ai') s = applyAction(s, { type: 'pass', who: s.turn });
  s.passesInARow = 0;
  board(s, [['ai', 0, 0, 'Shinx'], ['player', 0, 0, 'Geodude']]);
  s.players.ai.hand = [];
  s.players.ai.baseEnergy = 0;
  for (let i = 0; i < 20; i++) {
    const a = chooseAction(s, 'ai', { rng: () => i / 20 });
    assert.equal(a.type, 'command', 'the AI Commands its unmatched Pokémon before passing');
  }
}

console.log('All unmatched-speed tests passed.');
