// Checks Status Effects (Burn, Douse), the Supper order, "this Round"
// effects and the Breakfast PokéDollar, with test-only cards.
// Run with: node tests/status.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, attackOf, maxStrengthOf, PLAYERS, BREAKFAST_DOLLARS } from '../src/engine/game.js';
import { ability } from '../src/engine/cardData.js';
import { refreshAuras, resolveEffects } from '../src/engine/effects.js';
import { inPlay } from '../src/engine/board.js';
import { statusCount, STATUSES } from '../src/engine/status.js';
import { hasKeyword } from '../src/engine/keywords.js';
import { trainerOrder, def, useTestTrainers } from './fixtures.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, empty hands, the player to act with initiative; Trainer
// Passives and printed abilities off.
function match() {
  let s = useTestTrainers(createGame(41));
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: trainerOrder(s, 'player') });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: trainerOrder(s, 'ai') });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'player';
  s.turn = 'player';
  return s;
}

// A test-only Pokémon: a placeholder's stats, no printed ability or keyword, plus extras.
let made = 0;
function mon(base, extras = {}) {
  return { ...def(base), effectTrigger: null, effectText: null, ability: null, innatePower: null, uid: `test-${base}-${made++}`, ...extras };
}

function place(s, who, zone, space, card, { spent = true } = {}) {
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
  return { kind: 'pokemon', owner: who, zone, space };
}

const trainerRef = (who, zone) => ({ kind: 'trainer', owner: who, zone });
const at = (s, ref) => (ref.kind === 'trainer' ? s.players[ref.owner].zones[ref.zone].trainer : s.players[ref.owner].zones[ref.zone].pokemon[ref.space]);

// Effects from a test card (a Strategy Card of `who`).
function cast(s, who, effects, target) {
  resolveEffects(s, { who, source: { kind: 'strategy', owner: who, uid: 'test-card', name: 'Test card' }, label: 'Test card', target }, effects);
}
const burn = (s, who, ref, amount) => cast(s, who, [{ op: 'burn', amount, target: { mode: 'targeted', side: 'any', kinds: ['pokemon', 'trainer'] } }], ref);

// Ends the Battle Phase: Supper, then the next Round's Breakfast.
function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}

const logIndex = (s, text) => s.log.findIndex((l) => l.includes(text));
const triggered = (s, word) => s.events.filter((e) => e.type === 'abilityTriggered' && e.word === word);

// --- The status system --------------------------------------------------------

assert.deepEqual(Object.keys(STATUSES), ['burn'], 'only Burn exists for now');
{
  const s = match();
  assert.throws(() => cast(s, 'player', [{ op: 'applyStatus', status: 'sleep', amount: 1, target: { mode: 'area', side: 'opponent', kinds: ['trainer'] } }]), /Unknown status/);
}

// --- Burn: stacking and decay ---------------------------------------------------

// Burn X adds X counters; more stacks. At each Supper: damage equal to the
// Burn, then 1 less (Burn 3 deals 3, 2, 1). Trainers can be burned.
{
  let s = match();
  const misty = trainerRef('ai', 1);
  burn(s, 'player', misty, 2);
  burn(s, 'player', misty, 1);
  assert.equal(statusCount(at(s, misty), 'burn'), 3, 'Burn stacks');
  assert.equal(at(s, misty).status.burn.by, 'player', 'it remembers who applied it');
  const strength = [];
  for (let i = 0; i < 4; i++) {
    s = nextRound(s);
    strength.push(at(s, misty).strength);
  }
  assert.deepEqual(strength, [12, 10, 9, 9], '3, then 2, then 1, then nothing');
  assert.equal(statusCount(at(s, misty), 'burn'), 0);
  assert.equal(at(s, misty).status?.burn, undefined, 'gone once it reaches 0');
}

// A burned Pokémon: same, and healing doesn't remove Burn.
{
  let s = match();
  const pud = place(s, 'ai', 0, 0, mon('test-dragon'));   // 7/11
  burn(s, 'player', pud, 2);
  cast(s, 'ai', [{ op: 'heal', amount: 5, target: { mode: 'targeted', side: 'friendly' } }], pud);
  assert.equal(statusCount(at(s, pud), 'burn'), 2, 'healing does not remove Burn');
  s = nextRound(s);
  assert.equal(at(s, pud).currentStrength, 9);
  assert.equal(statusCount(at(s, pud), 'burn'), 1);
  assert.ok(s.events.some((e) => e.type === 'damage' && e.cause === 'burn' && e.target.uid === at(s, pud).uid));
}

// --- Burn defeats and removals ------------------------------------------------------

// Burn can defeat a Pokémon: Released Pile, PokéDollars as normal (to the
// burner's side), On Defeated fires; the defeat remembers who applied it.
{
  let s = match();
  const victim = place(s, 'ai', 2, 0, mon('test-cocoon', ability('On Defeated', 'Gain 1 extra Base Energy this Round.', [{ op: 'gainEnergy', amount: 1 }])));
  at(s, victim).currentStrength = 2;
  burn(s, 'player', victim, 3);
  const dollars = s.players.player.dollars;
  s = nextRound(s);
  assert.equal(at(s, victim), null, 'defeated by Burn');
  assert.equal(s.players.ai.released.at(-1).name, 'Test Cocoon');
  assert.equal(s.players.ai.released.at(-1).status, undefined, 'it keeps no Burn in the Released Pile');
  assert.equal(s.players.player.dollars, dollars + 2 + BREAKFAST_DOLLARS, 'its Energy Cost (2), plus the Breakfast PokéDollar');
  assert.equal(triggered(s, 'On Defeated').length, 1, 'On Defeated fires');
  const defeat = s.events.find((e) => e.type === 'defeated');
  assert.deepEqual([defeat.cause, defeat.by], ['burn', 'player'], 'counts as the burner\'s for quests');
}

// Burn can reduce a Trainer to 0: it's removed (zone falls) and its Burn is cleared.
{
  let s = match();
  const brock = trainerRef('ai', 2);
  at(s, brock).strength = 2;
  burn(s, 'player', brock, 3);
  s = nextRound(s);
  assert.equal(at(s, brock).strength, 0, 'Trainer Strength stops at 0');
  assert.equal(at(s, brock).status, undefined, 'a removed Trainer keeps no Burn');
  assert.ok(s.events.some((e) => e.type === 'trainerRemoved' && e.target.uid === at(s, brock).uid));
}

// Burn damage is effect damage: no On Defend.
{
  let s = match();
  const wall = place(s, 'ai', 0, 0, mon('test-steel', ability('On Defend', 'Deal 1 damage to the attacker.', [
    { op: 'damage', amount: 1, target: { mode: 'event', role: 'attacker' } },
  ])));
  burn(s, 'player', wall, 2);
  s = nextRound(s);
  assert.equal(at(s, wall).currentStrength, 10 - 2);
  assert.equal(triggered(s, 'On Defend').length, 0, 'Burn never triggers On Defend');
}

// Douse removes all Burn; nothing to Douse does nothing.
{
  const s = match();
  const misty = trainerRef('player', 1);
  burn(s, 'ai', misty, 4);
  cast(s, 'player', [{ op: 'douse', target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'] } }], misty);
  assert.equal(statusCount(at(s, misty), 'burn'), 0);
  assert.ok(s.events.some((e) => e.type === 'statusCleared' && e.status === 'burn' && e.before === 4));
  const n = s.events.length;
  cast(s, 'player', [{ op: 'douse', target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'] } }], misty);
  assert.equal(s.events.length, n, 'no Burn: nothing happens');
}

// Burn on both sides resolves at the same moment: if it takes both players'
// last Trainers to 0, the match is a draw. One side only: a win.
{
  let s = match();
  for (const who of PLAYERS) {
    s.players[who].zones[0].trainer.strength = 0;
    s.players[who].zones[1].trainer.strength = 0;
    s.players[who].zones[2].trainer.strength = 2;
  }
  burn(s, 'player', trainerRef('ai', 2), 2);
  burn(s, 'ai', trainerRef('player', 2), 3);
  s = nextRound(s);
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, null, 'a draw');
  assert.ok(s.log.some((l) => l.includes('Draw!')));

  let t = match();
  t.players.ai.zones.forEach((z, i) => { z.trainer.strength = i === 2 ? 2 : 0; });
  burn(t, 'player', trainerRef('ai', 2), 2);
  t = nextRound(t);
  assert.equal(t.winner, 'player', 'Burn can win the match');
}

// --- The Supper order ---------------------------------------------------------------

// Weather timed effects → Burn → On Supper → "this Round" effects expire → hands discarded.
{
  let s = match();
  const pud = place(s, 'player', 0, 0, mon('test-ripple', ability('On Supper', 'Gain 1 extra Base Energy this Round.', [{ op: 'gainEnergy', amount: 1 }])));
  at(s, pud).currentStrength = 2;
  s.players.player.zones[1].location = { uid: 'wx', name: 'Weather test', cardType: 'Location', weatherTokens: { Rain: 8 }, quest: null };
  refreshAuras(s);
  burn(s, 'ai', pud, 3);
  cast(s, 'player', [{ op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', side: 'friendly' } }], pud);
  s.players.player.hand.push(s.players.player.drawPile.shift());
  s = nextRound(s);
  const order = ['(☔ Rain 8): healed', 'Burn 3:', "Test Ripple's On Supper", '"This Round" effects end', 'You discarded'].map((t) => logIndex(s, t));
  assert.ok(order.every((i) => i >= 0), `all logged: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in that order');
  // 2, +1 when Rain 4's +1/+1 switched on → 3; Rain 8 heals 2 → 5; then Burn 3 → 2.
  assert.equal(at(s, pud).currentStrength, 2);
}

// A Pokémon defeated by Burn doesn't fire its On Supper.
{
  let s = match();
  const goner = place(s, 'player', 0, 0, mon('test-ripple', ability('On Supper', 'Gain 1 extra Base Energy this Round.', [{ op: 'gainEnergy', amount: 1 }])));
  at(s, goner).currentStrength = 1;
  burn(s, 'ai', goner, 1);
  s = nextRound(s);
  assert.equal(at(s, goner), null);
  assert.equal(triggered(s, 'On Supper').length, 0);
}

// --- "This Round" -----------------------------------------------------------------

// A "this Round" buff or keyword expires at Supper. Losing Strength follows
// the Passive rule: the maximum drops, current only if above it; never a defeat.
{
  let s = match();
  const a = place(s, 'player', 0, 0, mon('test-dragon'));   // 7/11
  const b = place(s, 'player', 0, 1, mon('test-blaze'));      // 5/7
  const buff = (ref) => cast(s, 'player', [{ op: 'buff', attack: 2, strength: 3, thisRound: true, target: { mode: 'targeted', side: 'friendly' } }], ref);
  buff(a);
  buff(b);
  cast(s, 'player', [{ op: 'grant', keyword: 'Overrun', thisRound: true, target: { mode: 'targeted', side: 'friendly' } }], a);
  cast(s, 'player', [{ op: 'grant', keyword: 'Shell', amount: 1, target: { mode: 'targeted', side: 'friendly' } }], a);
  assert.deepEqual([attackOf(at(s, a)), at(s, a).currentStrength, maxStrengthOf(at(s, a))], [9, 14, 14]);
  assert.ok(hasKeyword(at(s, a), 'Overrun'));
  at(s, b).currentStrength = 2;   // badly hurt: 2/10
  s = nextRound(s);
  assert.deepEqual([attackOf(at(s, a)), at(s, a).currentStrength, maxStrengthOf(at(s, a))], [7, 11, 11], 'back to normal');
  assert.ok(!hasKeyword(at(s, a), 'Overrun'), 'the "this Round" keyword is gone');
  assert.ok(hasKeyword(at(s, a), 'Shell'), 'a permanent grant stays');
  assert.deepEqual([at(s, b).currentStrength, maxStrengthOf(at(s, b))], [2, 7], 'current only drops if above the new maximum');
  // A permanent buff stays.
  cast(s, 'player', [{ op: 'buff', attack: 1, strength: 1, target: { mode: 'targeted', side: 'friendly' } }], b);
  s = nextRound(s);
  assert.equal(attackOf(at(s, b)), 6);
}

// --- Economy: +1 PokéDollar at each Breakfast ------------------------------------

{
  let s = match();
  assert.deepEqual(PLAYERS.map((w) => s.players[w].dollars), [1, 1], 'Round 1 included');
  s = nextRound(s);
  assert.deepEqual(PLAYERS.map((w) => s.players[w].dollars), [2, 2]);
  assert.ok(s.events.some((e) => e.type === 'dollarsEarned' && e.amount === 1));
}

console.log('All Status Effect, Supper order, "this Round" and Breakfast PokéDollar tests passed.');
