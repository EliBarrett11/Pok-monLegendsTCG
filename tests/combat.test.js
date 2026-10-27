// Checks Alert, the "Command an Alert Pokémon" Action, defeat, the Released
// Pile, the win and the draw, then plays full AI-vs-AI matches to the end.
// Run with: node tests/combat.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, isAlert, alertPokemon, legalTargets, PLAYERS, opponentOf,
} from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';
import { def } from './fixtures.js';
import { ITEM_CARDS } from '../src/engine/cardData.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle with the player to act and an empty arena.
function battle(seed = 1) {
  let s = createGame(seed);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  s.turn = 'player';
  // Plain Trainers, so these tests check combat alone (Trainers have their own test).
  for (const who of PLAYERS) for (const t of s.players[who].trainers) { t.power = null; t.passive = null; }
  return s;
}

let nextUid = 0;
// Puts a Pokémon straight into the arena. Active unless spent: true.
function place(s, who, zone, space, id, { spent = false, strength } = {}) {
  const base = def(id);
  // No ability, so these tests check combat alone (abilities have their own test).
  const card = { ...base, ability: null, uid: `test-${nextUid++}`, currentStrength: strength ?? base.strengthValue, spent };
  s.players[who].zones[zone].pokemon[space] = card;
  return card;
}
const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const command = (s, who, from, target) => applyAction(s, { type: 'command', who, from, target });
const pk = (zone, space) => ({ kind: 'pokemon', zone, space });
const tr = (zone) => ({ kind: 'trainer', zone });
const key = (t) => (t.kind === 'trainer' ? `T${t.zone}` : `P${t.zone}${t.space}`);
const targetKeys = (s, who, from) => legalTargets(s, who, from).map(key).sort();

// --- Alert ------------------------------------------------------------------

// Swift beats Steady across both sides; once the Swift ones are Spent, Steady is Alert.
{
  const s = battle();
  const mine = place(s, 'player', 0, 0, 'test-flame');        // Swift
  const theirs = place(s, 'ai', 0, 0, 'test-blaze');           // Steady
  const slow = place(s, 'ai', 0, 1, 'test-rock');             // Slow
  assert.ok(isAlert(s, mine));
  assert.ok(!isAlert(s, theirs), 'Steady is not Alert while a Swift Pokémon is Active');
  assert.deepEqual(alertPokemon(s, 'ai'), []);
  mine.spent = true;
  assert.ok(!isAlert(s, mine), 'Spent Pokémon are never Alert');
  assert.ok(isAlert(s, theirs), 'with the Swift one Spent, Steady becomes Alert');
  assert.ok(!isAlert(s, slow));
  theirs.spent = true;
  assert.ok(isAlert(s, slow), 'and then Slow');
}

// Alert is recalculated after an Action: attacking makes the attacker Spent.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-flame');                     // Swift
  place(s, 'ai', 1, 1, 'test-blaze');                           // Steady
  s = command(s, 'player', { zone: 0, space: 0 }, pk(1, 1));
  assert.equal(at(s, 'player', 0, 0).spent, true);
  assert.equal(alertPokemon(s, 'ai').length, 1, 'Test Blaze is Alert after the Swift attacker is Spent');
  assert.ok(legalActions(s, 'ai').includes('command'));
}

// --- Targeting --------------------------------------------------------------

{
  const s = battle();
  place(s, 'player', 0, 0, 'test-flame');                     // Physical
  place(s, 'player', 0, 1, 'test-spark');                       // Special
  place(s, 'ai', 0, 0, 'test-rock');                          // Defence
  place(s, 'ai', 1, 0, 'test-ripple');                          // Hitpoints
  place(s, 'ai', 2, 2, 'test-cocoon', { spent: true });       // Special Defence, Spent
  assert.deepEqual(targetKeys(s, 'player', { zone: 0, space: 0 }), ['P00'], 'Physical must hit the Defence Pokémon');
  assert.deepEqual(targetKeys(s, 'player', { zone: 0, space: 1 }), ['P22'], 'Special must hit the Special Defence one, even when Spent');
  assert.throws(() => command(s, 'player', { zone: 0, space: 0 }, pk(1, 0)), /legal target/);
  assert.throws(() => command(s, 'player', { zone: 0, space: 0 }, tr(0)), /legal target/);
}

// No guards: any enemy Pokémon or any Trainer above 0 Strength.
{
  const s = battle();
  place(s, 'player', 0, 0, 'test-flame');
  place(s, 'ai', 1, 0, 'test-ripple');                           // Hitpoints
  place(s, 'ai', 2, 0, 'test-spark');                            // Special Defence: no effect on a Physical attacker
  assert.deepEqual(targetKeys(s, 'player', { zone: 0, space: 0 }), ['P10', 'P20', 'T0', 'T1', 'T2']);
  s.players.ai.zones[1].trainer.strength = 0;
  assert.deepEqual(targetKeys(s, 'player', { zone: 0, space: 0 }), ['P10', 'P20', 'T0', 'T2'], 'a Trainer at 0 cannot be targeted');
}

// Only your own Alert Pokémon can be Commanded, only on your turn, for no Energy.
{
  const s = battle();
  place(s, 'player', 0, 0, 'test-flame');                     // Swift
  place(s, 'player', 0, 1, 'test-blaze');                       // Steady: Active but not Alert
  place(s, 'player', 0, 2, 'test-wing', { spent: true });     // Swift but Spent
  place(s, 'ai', 0, 0, 'test-ripple');
  assert.throws(() => command(s, 'player', { zone: 0, space: 1 }, tr(0)), /Alert/);
  assert.throws(() => command(s, 'player', { zone: 0, space: 2 }, tr(0)), /Alert/);
  assert.throws(() => command(s, 'ai', { zone: 0, space: 0 }, tr(0)), /cannot/);
  const after = command(s, 'player', { zone: 0, space: 0 }, tr(0));
  assert.equal(after.players.player.baseEnergy, s.players.player.baseEnergy, 'no Energy spent');
  assert.equal(after.players.player.exhaust.length, 0);
  assert.equal(after.turn, 'ai', 'the Command used the turn');
  assert.equal(after.passesInARow, 0);
}

// --- Damage -----------------------------------------------------------------

// Alert vs Alert: both deal damage at once, both become Spent; excess is lost.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-shadow');                      // Swift, Physical 6, HP 9
  place(s, 'ai', 1, 2, 'test-wing');                          // Swift, Physical 4, HP 5
  s = command(s, 'player', { zone: 0, space: 0 }, pk(1, 2));
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5, 'took 4 back');
  assert.equal(at(s, 'player', 0, 0).spent, true);
  assert.equal(at(s, 'ai', 1, 2), null, 'Test Wing defeated');
  assert.equal(s.players.ai.released.length, 1);
  assert.equal(s.players.ai.released[0].name, 'Test Wing');
  assert.ok(!s.players.ai.discard.some((c) => c.name === 'Test Wing'), 'not the Discard Pile');
  assert.ok(s.log.some((l) => l.includes('Test Wing was Alert and hit back for 4')));
  assert.ok(s.log.some((l) => l.includes('Test Wing was defeated')));
}

// Non-Alert target (Active but slower, or Spent): no damage back; it stays as it was.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-flame');                      // Swift, Physical 3
  place(s, 'ai', 0, 0, 'test-blaze');                           // Steady: Active, not Alert
  place(s, 'ai', 0, 1, 'test-shadow', { spent: true });         // Swift but Spent
  s = command(s, 'player', { zone: 0, space: 0 }, pk(0, 0));
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 4);
  assert.equal(at(s, 'ai', 0, 0).spent, false, 'only the attacker becomes Spent');
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5, 'no damage back');

  let t = battle();
  place(t, 'player', 0, 0, 'test-flame');
  place(t, 'ai', 0, 1, 'test-shadow', { spent: true });
  t = command(t, 'player', { zone: 0, space: 0 }, pk(0, 1));
  assert.equal(at(t, 'ai', 0, 1).currentStrength, 6);
  assert.equal(at(t, 'player', 0, 0).currentStrength, 5, 'a Spent target never hits back');
}

// Double defeat in one trade.
{
  let s = battle();
  place(s, 'player', 2, 1, 'test-flame', { strength: 2 });   // Swift, Physical 3
  place(s, 'ai', 0, 0, 'test-flame', { strength: 1 });
  s = command(s, 'player', { zone: 2, space: 1 }, pk(0, 0));
  assert.equal(at(s, 'player', 2, 1), null);
  assert.equal(at(s, 'ai', 0, 0), null);
  assert.equal(s.players.player.released.length, 1);
  assert.equal(s.players.ai.released.length, 1);
}

// Damage stays between Rounds.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-flame');
  place(s, 'ai', 0, 0, 'test-steel');                          // Defence 10, Slow
  s = command(s, 'player', { zone: 0, space: 0 }, pk(0, 0));
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: s.turn });
  assert.equal(s.round, 2);
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 7);
}

// The Released Pile is never shuffled back into the Draw Pile.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-flame', { strength: 1 });
  place(s, 'ai', 0, 0, 'test-shadow');
  s = command(s, 'player', { zone: 0, space: 0 }, pk(0, 0));  // Test Flame is defeated in the trade
  const p = s.players.player;
  assert.equal(p.released.length, 1);
  p.discard.push(...p.drawPile.splice(0), ...p.hand.splice(0));  // force a reshuffle at Breakfast
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  assert.equal(s.round, 2);
  const q = s.players.player;
  assert.ok(s.log.some((l) => l.startsWith('You shuffled your Discard Pile')));
  assert.equal(q.released.length, 1);
  const releasedUid = q.released[0].uid;
  assert.ok(![...q.hand, ...q.drawPile, ...q.discard].some((c) => c.uid === releasedUid));
}

// --- Win and draw -----------------------------------------------------------

// Trainer Strength stops at 0; the win triggers on the third Trainer reaching 0.
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-blaze');                       // Physical 5
  const enemyTrainers = s.players.ai.zones.map((z) => z.trainer);
  enemyTrainers[0].strength = 0;
  enemyTrainers[1].strength = 3;
  enemyTrainers[2].strength = 0;
  s = command(s, 'player', { zone: 0, space: 0 }, tr(1));
  assert.equal(s.players.ai.zones[1].trainer.strength, 0, 'not below 0');
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 'player');
  assert.equal(s.turn, null);
  assert.deepEqual(legalActions(s, 'ai'), []);
  assert.ok(s.log.at(-1).startsWith('You win!'));
}
{
  let s = battle();
  place(s, 'player', 0, 0, 'test-blaze');
  s.players.ai.zones[0].trainer.strength = 0;
  const before = s.players.ai.zones[1].trainer.strength;
  s = command(s, 'player', { zone: 0, space: 0 }, tr(1));
  assert.equal(s.players.ai.zones[1].trainer.strength, before - 5);
  assert.equal(s.phase, 'battle', 'two Trainers still standing');
}

// Draw: no Pokémon left anywhere for either player.
{
  let s = battle();
  for (const who of PLAYERS) {
    const p = s.players[who];
    for (const pile of ['hand', 'drawPile', 'discard']) p[pile] = p[pile].filter((c) => c.cardType !== 'Pokémon');
  }
  place(s, 'player', 0, 0, 'test-flame', { strength: 2 });
  place(s, 'ai', 0, 0, 'test-flame', { strength: 2 });
  s = command(s, 'player', { zone: 0, space: 0 }, pk(0, 0));
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, null);
  assert.ok(s.log.at(-1).startsWith('Draw!'));
}

// --- AI ---------------------------------------------------------------------

// The AI's attack respects targeting restrictions. (Its scoring is tested in trainers.test.js.)
{
  const s = battle();
  s.turn = 'ai';
  s.players.ai.hand = [];
  place(s, 'ai', 0, 0, 'test-flame');
  place(s, 'player', 1, 1, 'test-rock');                       // Defence: the only legal target
  const action = chooseAction(s, 'ai');
  assert.equal(action.type, 'command');
  assert.deepEqual(action.target, pk(1, 1));
  applyAction(s, action);
}

// Full AI-vs-AI matches, Fire vs Water in both seat orders. Healing can
// outpace the only damage left, and no rule ends such a match yet (an open
// question in docs/rules.md), so a match still going at Round 100 is stopped
// and counted as stalled. (Each AI turn tries its moves on a copy of the
// game: the slow part of the run.)
const MATCHES = 30;   // per seat order
// Every card in the match: both players' cards (Items move to Bags, onto
// Pokémon as Held Items, and to the PokéMart) plus the PokéMart's own 11
// (an evolved Pokémon's cards under it count too).
function cardsInGame(s) {
  // A card still resolving (e.g. a Supporter waiting on a Search choice) is on the stack.
  let n = s.mart.deck.length + s.mart.onSale.filter(Boolean).length + (s.stack ?? []).filter((j) => j.card || j.item).length;
  for (const w of PLAYERS) {
    const p = s.players[w];
    const cards = [...p.hand, ...p.drawPile, ...p.discard, ...p.released, ...p.bag,
      ...p.zones.flatMap((z) => [...z.pokemon, z.location]).filter(Boolean)];
    n += cards.length + cards.filter((c) => c.heldItem).length + cards.reduce((k, c) => k + (c.stack?.length ?? 0), 0);
  }
  return n;
}
const STALL_ROUND = 100;
function seededRandom(seed) {
  const box = { rng: seed * 7919 };
  return () => nextRandom(box);
}
for (const decks of [{ player: 'fire', ai: 'water' }, { player: 'water', ai: 'fire' }]) {
  const results = { player: 0, ai: 0, draw: 0, stalled: 0 };
  let longest = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    let s = createGame(seed, { decks });
    assert.deepEqual([s.players.player.deck, s.players.ai.deck], [decks.player, decks.ai]);
    const rng = seededRandom(seed);   // the AI's choices replay exactly too
    let stepsThisRound = 0;
    let round = s.round;
    while (s.phase !== 'gameOver' && s.round < STALL_ROUND) {
      stepsThisRound = s.round === round ? stepsThisRound + 1 : 0;
      round = s.round;
      assert.ok(stepsThisRound < 500, `seed ${seed}: a Round never ended`);
      const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
      s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
      assert.equal(cardsInGame(s), 2 * 40 + ITEM_CARDS.length, 'no cards lost');
    }
    if (s.phase === 'gameOver') {
      results[s.winner ?? 'draw'] += 1;
      longest = Math.max(longest, s.round);
    } else {
      results.stalled += 1;
    }
  }
  assert.ok(results.player > 0 && results.ai > 0, `${decks.player} vs ${decks.ai}: both decks can win`);
  assert.ok(results.stalled <= MATCHES / 10, `too many stalled matches: ${results.stalled}`);
  console.log(`${MATCHES} AI-vs-AI matches, you ${decks.player} vs AI ${decks.ai}: ${results.player} / ${results.ai} wins, ${results.draw} draws, `
    + `${results.stalled} stalled at Round ${STALL_ROUND}; longest finished match ${longest} Rounds.`);
}

console.log('All combat tests passed.');
