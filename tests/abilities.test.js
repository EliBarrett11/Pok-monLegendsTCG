// Checks Pokémon abilities (Effect Trigger Words), the trigger order rule,
// and the placeholder abilities.
// Run with: node tests/abilities.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, PLAYERS } from '../src/engine/game.js';
import { POKEMON_CARDS, TRIGGER_WORDS } from '../src/engine/cardData.js';
import { chooseAction } from '../src/ai/opponent.js';
import { trainerOrder, testCard, def, useTestTrainers } from './fixtures.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Trainers Test Ash / Test Misty / Test Brock in zones 1–3 on both sides,
// empty hands, plenty of Base Energy, the player to act and to have
// initiative. Passives off unless asked for, so numbers are the abilities' own.
function match({ passives = false, initiative = 'player' } = {}) {
  let s = useTestTrainers(createGame(11));
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: trainerOrder(s, 'player') });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: trainerOrder(s, 'ai') });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    if (!passives) p.trainers.forEach((t) => { t.passive = { text: '' }; });
  }
  s.initiative = initiative;
  s.turn = 'player';
  return s;
}

function give(s, who, id) {
  const p = s.players[who];
  for (const pile of [p.drawPile, p.discard]) {
    const i = pile.findIndex((c) => c.id === id);
    if (i >= 0) {
      const [card] = pile.splice(i, 1);
      p.hand.push(card);
      return card;
    }
  }
  const card = testCard(id);
  p.hand.push(card);
  return card;
}

// Plays a Pokémon on `who`'s turn. An On Summon choice is left pending.
function play(s, who, id, zone, space, extra = {}) {
  s.turn = who;
  s.passesInARow = 0;
  s.players[who].baseEnergy = 10;
  const card = give(s, who, id);
  Object.assign(card, extra);
  return applyAction(s, { type: 'playPokemon', who, uid: card.uid, zone, space });
}

// Both pass: Supper, then the next Round's Breakfast, to its Battle Phase.
function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}

const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const trainer = (s, who, zone) => s.players[who].zones[zone].trainer;
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const command = (s, who, from, target) => { s.turn = who; return applyAction(s, { type: 'command', who, from, target }); };
const logIndex = (s, text) => s.log.findIndex((l) => l.includes(text));
const ready = (s, who, zone, space) => { at(s, who, zone, space).spent = false; };
const abilityOf = (id) => def(id).ability;

// --- Card data ----------------------------------------------------------------

{
  const byWord = {};
  for (const c of POKEMON_CARDS) {
    if (!c.ability) continue;
    assert.ok(c.effectText);
    // Several abilities (Ivysaur, Bellossom, Celebi): each with its own Trigger Word.
    for (const a of [c.ability].flat()) {
      const word = a.word ?? c.effectTrigger;
      assert.ok(word in TRIGGER_WORDS, c.name);
      assert.equal(a.on, TRIGGER_WORDS[word]);
      (byWord[word] ??= []).push(c.name);
    }
  }
  assert.ok(byWord['On Summon'].length >= 2, 'On Summon is common in both decks');
  assert.ok(POKEMON_CARDS.some((c) => !c.ability), 'some have no ability');
}

// --- On Summon ----------------------------------------------------------------

// I choose the target among opponent Pokémon in this Pokémon's Zone; the turn
// waits for the choice.
{
  let s = match();
  s = play(s, 'ai', 'test-rock', 0, 0);
  s = play(s, 'ai', 'test-cocoon', 0, 1);
  s = play(s, 'ai', 'test-mud', 1, 0);                // other zone: not a target
  s = play(s, 'player', 'test-flame', 0, 2);
  assert.equal(s.pending.kind, 'target');
  assert.deepEqual(s.pending.options.map((r) => [r.zone, r.space]), [[0, 0], [0, 1]]);
  assert.deepEqual(legalActions(s, 'player'), ['resolveChoice']);
  assert.equal(s.turn, 'player', 'the turn waits for the choice');
  assert.throws(() => applyAction(s, { type: 'resolveChoice', who: 'player', target: pref('ai', 1, 0) }), /legal target/);
  assert.throws(() => applyAction(s, { type: 'resolveChoice', who: 'player' }), /legal target/, 'must pick one');
  s = applyAction(s, { type: 'resolveChoice', who: 'player', target: pref('ai', 0, 1) });
  assert.equal(at(s, 'ai', 0, 1).currentStrength, 5);
  assert.equal(s.turn, 'ai');
  assert.ok(s.log.some((l) => l.includes("Your Test Flame's On Summon: 1 damage to AI Opponent's Test Cocoon")));
}

// No opponent Pokémon in the zone: nothing happens, and the turn ends.
{
  let s = match();
  s = play(s, 'ai', 'test-rock', 1, 0);
  s = play(s, 'player', 'test-flame', 0, 0);
  assert.equal(s.pending, null);
  assert.equal(s.turn, 'ai');
  assert.ok(s.log.some((l) => l.includes("Your Test Flame's On Summon: no legal target")));
}

// Fires for a free summon too (Test Ash's Power).
{
  let s = match();
  s = play(s, 'ai', 'test-rock', 2, 0);
  const p = s.players.player;
  const flame = testCard('test-flame');
  p.drawPile.unshift(flame);
  s.turn = 'player';
  s = applyAction(s, { type: 'usePower', who: 'player', zone: 0 });
  s = applyAction(s, { type: 'resolveChoice', who: 'player', uids: [flame.uid] });
  s = applyAction(s, { type: 'resolveChoice', who: 'player', zone: 2, space: 2 });
  assert.equal(s.pending.kind, 'target', 'On Summon asks next');
  s = applyAction(s, { type: 'resolveChoice', who: 'player', target: pref('ai', 2, 0) });
  assert.equal(at(s, 'ai', 2, 0).currentStrength, 6);
  assert.equal(s.turn, 'ai');
}

// Fires for a Quick Attack Pokémon, which arrives Active.
{
  let s = match();
  s = play(s, 'ai', 'test-rock', 0, 0);
  s = play(s, 'player', 'test-spark', 0, 1, { effectTrigger: 'On Summon', ability: abilityOf('test-flame') });
  assert.equal(at(s, 'player', 0, 1).spent, false);
  s = applyAction(s, { type: 'resolveChoice', who: 'player', target: pref('ai', 0, 0) });
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 6);
}

// The AI picks a random legal target.
{
  let s = match();
  s = play(s, 'player', 'test-rock', 0, 0);
  s = play(s, 'player', 'test-cocoon', 0, 1);
  s = play(s, 'ai', 'test-flame', 0, 2);
  assert.equal(s.pending.who, 'ai');
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const choice = chooseAction(s, 'ai');
    assert.equal(choice.type, 'resolveChoice');
    seen.add(choice.target.space);
    applyAction(s, choice);
  }
  assert.deepEqual([...seen].sort(), [0, 1]);
}

// --- On Attack and On Defend ----------------------------------------------------

// On Attack: Test Wing draws 1 only when it attacked a Trainer.
{
  let s = match();
  s = play(s, 'player', 'test-wing', 0, 0);
  ready(s, 'player', 0, 0);
  const hand = s.players.player.hand.length;
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'trainer', zone: 1 });
  assert.equal(s.players.player.hand.length, hand + 1);
  assert.ok(s.log.some((l) => l.startsWith("Your Test Wing's On Attack: You drew 1 card")));

  let t = match();
  t = play(t, 'player', 'test-wing', 0, 0);
  t = play(t, 'ai', 'test-dragon', 1, 0);
  ready(t, 'player', 0, 0);
  const hand2 = t.players.player.hand.length;
  t = command(t, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(t.players.player.hand.length, hand2, 'not a Trainer: no draw');
}

// On Defend: the attacker takes 1. It doesn't fire for effect damage.
{
  let s = match();
  s = play(s, 'ai', 'test-steel', 1, 0);               // Defence 10, Slow
  s = play(s, 'player', 'test-flame', 0, 0);           // Swift, 3/5
  ready(s, 'player', 0, 0);
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 7);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 4, 'Test Steel was not Alert, but On Defend still hits back for 1');
  assert.ok(s.log.some((l) => l.includes("AI Opponent's Test Steel's On Defend: 1 damage to your Test Flame")));

  let t = match();
  t = play(t, 'ai', 'test-steel', 1, 0);
  t.turn = 'player';
  t = applyAction(t, { type: 'usePower', who: 'player', zone: 1, target: pref('ai', 1, 0) });   // Misty: 1 damage
  t = play(t, 'player', 'test-spark', 2, 0);
  give(t, 'player', 'test-hypervoice');
  t.turn = 'player';
  t.players.player.baseEnergy = 10;
  t = applyAction(t, { type: 'playStrategy', who: 'player', uid: t.players.player.hand.at(-1).uid });
  assert.equal(at(t, 'ai', 1, 0).currentStrength, 7);
  assert.ok(!t.log.some((l) => l.includes('On Defend')), 'effect damage never triggers On Defend');
}

// In a trade both fire: the attacker's On Attack and the target's On Defend,
// initiative player first.
{
  for (const initiative of ['player', 'ai']) {
    let s = match({ initiative });
    s = play(s, 'ai', 'test-steel', 1, 0);             // Slow, Physical 4, Defence 10, On Defend
    const onAttackDraw = { on: 'attack', match: { self: true }, effects: [{ op: 'draw', amount: 1 }] };
    s = play(s, 'player', 'test-inferno', 0, 0, { effectTrigger: 'On Attack', ability: onAttackDraw, effectText: 'Draw 1.' });
    if (s.pending) s = applyAction(s, { type: 'resolveChoice', who: 'player', target: s.pending.options[0] });
    ready(s, 'player', 0, 0);
    ready(s, 'ai', 1, 0);                            // both Slow and Active: both Alert
    const hand = s.players.player.hand.length;
    s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
    assert.equal(at(s, 'ai', 1, 0).currentStrength, 10 - 7, 'took 7');
    assert.equal(at(s, 'player', 0, 0).currentStrength, 12 - 4 - 1, 'hit back for 4, then On Defend for 1');
    assert.equal(s.players.player.hand.length, hand + 1, 'On Attack drew');
    const attackAt = logIndex(s, "Your Test Inferno's On Attack");
    const defendAt = logIndex(s, "AI Opponent's Test Steel's On Defend");
    assert.ok(attackAt >= 0 && defendAt >= 0);
    assert.equal(attackAt < defendAt, initiative === 'player', `initiative ${initiative} resolves first`);
  }
}

// A Pokémon defeated in the trade fires neither.
{
  let s = match();
  s = play(s, 'ai', 'test-rock', 1, 0);                // Defence 7, On Defend
  s = play(s, 'player', 'test-inferno', 0, 0);           // 6 damage: Test Rock is defeated
  if (s.pending) s = applyAction(s, { type: 'resolveChoice', who: 'player', target: s.pending.options[0] });
  ready(s, 'player', 0, 0);
  at(s, 'ai', 1, 0).currentStrength = 5;
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(at(s, 'ai', 1, 0), null);
  assert.ok(!s.log.some((l) => l.includes('On Defend')));
}

// --- On Defeated --------------------------------------------------------------

// Heals the friendly Trainer in its Zone 3, for a combat defeat and an effect defeat.
{
  let s = match();
  s = play(s, 'ai', 'test-ripple', 1, 0);                // On Defeated; AI's Misty is in Zone 2
  trainer(s, 'ai', 1).strength = 10;
  s = play(s, 'player', 'test-shadow', 1, 1);           // Quick Attack: Active now
  s = command(s, 'player', { zone: 1, space: 1 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(at(s, 'ai', 1, 0), null);
  assert.equal(trainer(s, 'ai', 1).strength, 13);
  assert.ok(logIndex(s, 'Test Ripple was defeated') < logIndex(s, "AI Opponent's Test Ripple's On Defeated: healed AI Opponent's Test Misty"));

  let t = match();
  t = play(t, 'ai', 'test-cocoon', 0, 0);               // On Defeated; AI's Ash in Zone 1
  t = play(t, 'player', 'test-flame', 2, 0);
  trainer(t, 'ai', 0).strength = 14;
  at(t, 'ai', 0, 0).currentStrength = 2;
  give(t, 'player', 'test-hypervoice');
  t.turn = 'player';
  t.players.player.baseEnergy = 10;
  t = applyAction(t, { type: 'playStrategy', who: 'player', uid: t.players.player.hand.at(-1).uid });
  assert.equal(at(t, 'ai', 0, 0), null);
  assert.equal(trainer(t, 'ai', 0).strength, 15, 'effect defeat; heal capped at 15');
}

// Nothing happens if that Trainer has been removed.
{
  let s = match();
  s = play(s, 'ai', 'test-ripple', 1, 0);
  trainer(s, 'ai', 1).strength = 0;
  const others = [0, 2].map((z) => { trainer(s, 'ai', z).strength = 9; return 9; });
  s = play(s, 'player', 'test-shadow', 1, 1);
  s = command(s, 'player', { zone: 1, space: 1 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(at(s, 'ai', 1, 0), null);
  assert.equal(trainer(s, 'ai', 1).strength, 0);
  assert.deepEqual([0, 2].map((z) => trainer(s, 'ai', z).strength), others, 'no other Trainer is healed');
}

// --- On Breakfast and On Supper -------------------------------------------------

// +1 Base Energy, above 10; it doesn't carry over.
{
  let s = match();
  s = play(s, 'player', 'test-fin', 0, 0);
  s.round = 9;
  s = nextRound(s);                                  // Round 10
  assert.equal(s.round, 10);
  assert.equal(s.players.player.baseEnergy, 11, 'above the limit of 10');
  assert.equal(s.players.ai.baseEnergy, 10);
  assert.ok(logIndex(s, 'You drew 7 cards') < logIndex(s, "Your Test Fin's On Breakfast"), 'after the draw');
  s = nextRound(s);                                  // unspent 11 doesn't carry over
  assert.equal(s.players.player.baseEnergy, 11);
  s.players.player.zones[0].pokemon[0] = null;
  s = nextRound(s);
  assert.equal(s.players.player.baseEnergy, 10, 'gone from the arena: no bonus');
}

// On Supper fires before hands are discarded.
{
  let s = match();
  const onSupper = { on: 'supper', match: { self: true }, effects: [{ op: 'draw', amount: 1 }] };
  s = play(s, 'player', 'test-spark', 0, 0, { effectTrigger: 'On Supper', ability: onSupper, effectText: 'Draw 1.' });
  s = nextRound(s);
  const fired = logIndex(s, "Your Test Spark's On Supper: You drew 1 card");
  assert.ok(fired >= 0);
  assert.ok(fired < logIndex(s, 'You discarded'), 'before hands are discarded');
}

// --- Order rule ---------------------------------------------------------------

// Same moment: initiative player first, then zone 1 → 3, then left to right.
{
  let s = match({ initiative: 'ai' });
  s = play(s, 'player', 'test-fin', 2, 0);
  s = play(s, 'player', 'test-fairy', 0, 1);
  s = play(s, 'ai', 'test-fin', 1, 2);
  s = play(s, 'ai', 'test-fairy', 1, 0);
  s = nextRound(s);                                  // Round 2: initiative switches to you
  const order = ["Your Test Fairy's", "Your Test Fin's", "AI Opponent's Test Fairy's", "AI Opponent's Test Fin's"]
    .map((who) => logIndex(s, `${who} On Breakfast`));
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'you (initiative) first; zone order; left to right');
  s = nextRound(s);                                  // Round 3: AI has initiative
  const from = s.log.findIndex((l) => l.startsWith('— Round 3'));
  const later = (text) => s.log.findIndex((l, i) => i > from && l.includes(text));
  assert.ok(later("AI Opponent's Test Fairy's On Breakfast") < later("Your Test Fairy's On Breakfast"));
}

// Chains resolve immediately: an On Summon defeats a Pokémon whose On Defeated
// resolves before Brock's Passive, which was waiting for the same summon.
{
  let s = match({ passives: true });
  s = play(s, 'ai', 'test-ripple', 2, 0);                // AI's Brock's Zone; On Defeated heals AI's Brock
  at(s, 'ai', 2, 0).currentStrength = 1;
  trainer(s, 'ai', 2).strength = 10;
  s = play(s, 'player', 'test-flame', 2, 1);           // On Summon (yours, initiative) then their Brock's Passive
  s = applyAction(s, { type: 'resolveChoice', who: 'player', target: pref('ai', 2, 0) });
  const strike = logIndex(s, "Your Test Flame's On Summon");
  const heal = logIndex(s, "AI Opponent's Test Ripple's On Defeated");
  const brock = logIndex(s, "AI Opponent's Test Brock's Passive: 1 damage to your Test Flame");
  assert.ok(strike >= 0 && heal >= 0 && brock >= 0);
  assert.ok(strike < heal && heal < brock, 'On Defeated jumps ahead of the waiting Passive');
  assert.equal(trainer(s, 'ai', 2).strength, 13);
  assert.equal(at(s, 'player', 2, 1).currentStrength, 4);
}

// A win ends everything at once.
{
  let s = match();
  s = play(s, 'player', 'test-wing', 0, 0);
  ready(s, 'player', 0, 0);
  s.players.ai.zones.forEach((z) => { z.trainer.strength = 0; });
  trainer(s, 'ai', 2).strength = 1;
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'trainer', zone: 2 });
  assert.equal(s.phase, 'gameOver');
  assert.ok(!s.log.some((l) => l.includes("Test Wing's On Attack")), 'the match ended before On Attack');
  assert.equal(s.log.at(-1), 'You win! All 3 enemy Trainers are at 0 Strength.');
}

console.log('All ability tests passed.');
