// Checks Trainer Passives and Powers (Ash, Misty, Brock), Trainer removal,
// fallen zones, and the AI's choices with them.
// Run with: node tests/trainers.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, legalTargets, canUsePower, powerTargets, summonSpaces,
  attackOf, maxStrengthOf, PLAYERS,
} from '../src/engine/game.js';
import { TRAINER_CARDS } from '../src/engine/cardData.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle with Trainers in a fixed order (zones 1, 2, 3), empty
// hands, plenty of Base Energy, and the player to act.
function match({ player = ['ash', 'misty', 'brock'], ai = ['ash', 'misty', 'brock'], seed = 1 } = {}) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: player.map((id) => `player-trainer-${id}`) });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ai.map((id) => `ai-trainer-${id}`) });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    for (const c of p.drawPile) c.ability = null;   // abilities have their own test
  }
  s.turn = 'player';
  return s;
}

// Moves a card from the piles into the hand; returns its uid.
function give(s, who, id) {
  const p = s.players[who];
  for (const pile of [p.drawPile, p.discard, p.hand]) {
    const i = pile.findIndex((c) => c.id === id);
    if (i >= 0) {
      const [card] = pile.splice(i, 1);
      p.hand.push(card);
      return card.uid;
    }
  }
  throw new Error(`no ${id} left for ${who}`);
}

// Plays a Pokémon on `who`'s turn (setting the turn first).
function play(s, who, id, zone, space) {
  s.turn = who;
  s.passesInARow = 0;
  s.players[who].baseEnergy = 10;
  const uid = give(s, who, id);
  return applyAction(s, { type: 'playPokemon', who, uid, zone, space });
}

// Puts a card on top of the Draw Pile (for Ash's draw).
function stackTop(s, who, id) {
  const p = s.players[who];
  const i = p.drawPile.findIndex((c) => c.id === id);
  p.drawPile.unshift(...p.drawPile.splice(i, 1));
}

const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const trainer = (s, who, zone) => s.players[who].zones[zone].trainer;
const power = (s, who, zone, target) => { s.turn = who; return applyAction(s, { type: 'usePower', who, zone, target }); };
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const stats = (c) => [attackOf(c), c.currentStrength, maxStrengthOf(c)];

// --- Data -------------------------------------------------------------------

assert.deepEqual(TRAINER_CARDS.map((t) => [t.name, t.strength, t.power.cost]), [['Ash', 15, 1], ['Misty', 15, 1], ['Brock', 15, 1]]);
{
  const s = createGame(1);
  for (const who of PLAYERS) assert.deepEqual(s.players[who].trainers.map((t) => t.name), ['Ash', 'Misty', 'Brock']);
}

// --- Passives ---------------------------------------------------------------

// Ash: friendly Pokémon in Ash's Zone gain +1/+1, and only friendly ones.
{
  let s = match();                                   // both sides: Ash in Zone 1
  s = play(s, 'player', 'growlithe', 0, 0);           // Growlithe 3/5
  s = play(s, 'ai', 'growlithe', 0, 1);
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [4, 6, 6], 'one +1/+1 from your own Ash');
  assert.deepEqual(stats(at(s, 'ai', 0, 1)), [4, 6, 6], 'one +1/+1 from their own Ash, none from yours');
  s = play(s, 'player', 'shinx', 1, 0);             // Misty's Zone: Ash's bonus does not reach
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [3, 4, 4]);
  assert.ok(s.log.some((l) => l.includes("Your Ash's Passive: your Growlithe (Zone 1, Space 1) gains +1/+1.")));
}

// The bonus counts in combat: a buffed Growlithe hits for 3.
{
  let s = match();
  s = play(s, 'player', 'growlithe', 0, 0);
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });   // to Round 2: Growlithe Active
  s.turn = 'player';
  const before = trainer(s, 'ai', 2).strength;
  s = applyAction(s, { type: 'command', who: 'player', from: { zone: 0, space: 0 }, target: { kind: 'trainer', zone: 2 } });
  assert.equal(before - trainer(s, 'ai', 2).strength, 4);
}

// Misty: friendly Water Pokémon in Misty's Zone gain +3 Strength.
{
  let s = match();
  s = play(s, 'player', 'horsea', 1, 0);            // Water 2/6
  s = play(s, 'player', 'growlithe', 1, 1);           // Fire
  s = play(s, 'player', 'goldeen', 0, 0);           // Water, but in Ash's Zone: +1/+1 only
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [2, 9, 9]);
  assert.deepEqual(stats(at(s, 'player', 1, 1)), [3, 5, 5]);
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [5, 8, 8]);
}

// Brock: opponent Pokémon summoned to Brock's Zone take 1 damage; friendly ones don't.
{
  let s = match();                                   // your Brock in Zone 3
  s = play(s, 'ai', 'growlithe', 2, 0);
  assert.deepEqual(stats(at(s, 'ai', 2, 0)), [3, 4, 5]);
  assert.ok(s.log.some((l) => l.includes("Your Brock's Passive: 1 damage to AI Opponent's Growlithe")));
  s = play(s, 'player', 'growlithe', 2, 0);           // its own Brock's Zone, but their Brock is in Zone 3 too
  assert.deepEqual(stats(at(s, 'player', 2, 0)), [3, 4, 5], "your Pokémon takes their Brock's damage");
  s = play(s, 'ai', 'horsea', 1, 0);                // not Brock's Zone
  assert.deepEqual(stats(at(s, 'ai', 1, 0)), [2, 9, 9]);
}

// Passive bonuses apply first, then Brock's damage.
{
  let s = match({ ai: ['brock', 'misty', 'ash'] });  // their Ash shares Zone 3 with your Brock
  s = play(s, 'ai', 'growlithe', 2, 0);
  assert.deepEqual(stats(at(s, 'ai', 2, 0)), [4, 5, 6], '+1/+1 to 6 Strength, then 1 damage');
}

// --- Powers -----------------------------------------------------------------

// Ash: draw 1; a 1-cost Pokémon may be summoned for free (arrives Spent, Passives apply).
{
  let s = match();
  stackTop(s, 'player', 'horsea');
  s = power(s, 'player', 0);
  assert.equal(s.pending.kind, 'freeSummon');
  assert.deepEqual(legalActions(s, 'player'), ['resolveChoice'], 'the choice must be made first');
  assert.deepEqual(legalActions(s, 'ai'), []);
  assert.equal(s.turn, 'player');
  assert.equal(s.players.player.baseEnergy, 9, 'paid 1');
  s = applyAction(s, { type: 'resolveChoice', who: 'player', zone: 1, space: 2 });
  const horsea = at(s, 'player', 1, 2);
  assert.equal(horsea.name, 'Horsea');
  assert.equal(horsea.spent, true);
  assert.deepEqual(stats(horsea), [2, 9, 9], "Misty's Passive applies");
  assert.equal(s.players.player.baseEnergy, 9, 'the summon itself is free');
  assert.equal(s.turn, 'ai', 'the Power used the turn');
  assert.ok(s.log.some((l) => l.includes('Horsea was summoned for free')));
}

// Ash: keep the card instead; a drawn card that isn't a 1-cost Pokémon just stays in hand.
{
  let s = match();
  stackTop(s, 'player', 'shinx');
  s = power(s, 'player', 0);
  s = applyAction(s, { type: 'resolveChoice', who: 'player' });
  assert.ok(s.players.player.hand.some((c) => c.id === 'shinx'));
  assert.equal(s.turn, 'ai');

  let t = match();
  stackTop(t, 'player', 'magmar');                  // cost 3
  t = power(t, 'player', 0);
  assert.equal(t.pending, null);
  assert.ok(t.players.player.hand.some((c) => c.id === 'magmar'));
  assert.equal(t.turn, 'ai');
}

// Ash: with no empty space it can use, the 1-cost Pokémon stays in hand.
{
  let s = match();
  const fill = ['geodude', 'metapod', 'magmar', 'lairon', 'pidgey', 'dusclops', 'absol', 'sylveon', 'dragonite'];
  fill.forEach((id, i) => { s = play(s, 'player', id, Math.floor(i / 3), i % 3); });
  assert.equal(summonSpaces(s, 'player').length, 0);
  stackTop(s, 'player', 'sewaddle');
  s = power(s, 'player', 0);
  assert.equal(s.pending, null);
  assert.ok(s.players.player.hand.some((c) => c.id === 'sewaddle'));
  assert.ok(s.log.some((l) => l.includes('no empty space, so it stays in hand')));
  assert.equal(s.turn, 'ai');
}

// Ash: can't be used with nothing to draw.
{
  const s = match();
  s.players.player.drawPile = [];
  s.players.player.discard = [];
  assert.equal(canUsePower(s, 'player', 0), false);
  assert.throws(() => power(s, 'player', 0), /cannot/);
}

// Brock's Passive also fires on Ash's free summon.
{
  let s = match({ ai: ['brock', 'misty', 'ash'] });  // their Ash in Zone 3, your Brock in Zone 3
  stackTop(s, 'ai', 'growlithe');
  s = power(s, 'ai', 2);
  s = applyAction(s, { type: 'resolveChoice', who: 'ai', zone: 2, space: 1 });
  assert.deepEqual(stats(at(s, 'ai', 2, 1)), [4, 5, 6]);
  assert.ok(s.log.some((l) => l.includes("Your Brock's Passive: 1 damage to AI Opponent's Growlithe")));
}

// Misty: 1 damage to an opponent Pokémon in Misty's Zone only.
{
  let s = match();
  s = play(s, 'ai', 'horsea', 1, 0);                // Misty's Zone (Zone 2): 2/9 with their Misty
  s = play(s, 'ai', 'shinx', 0, 0);                 // not Misty's Zone
  assert.deepEqual(powerTargets(s, 'player', 1), [pref('ai', 1, 0)]);
  assert.throws(() => power(s, 'player', 1, pref('ai', 0, 0)), /legal target/);
  s = power(s, 'player', 1, pref('ai', 1, 0));
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 8);
  assert.equal(s.turn, 'ai');
}

// Misty: no opponent Pokémon in her Zone → can't be used. Her damage can defeat.
{
  let s = match();
  assert.equal(canUsePower(s, 'player', 1), false);
  s = play(s, 'ai', 'shinx', 1, 0);                 // 3/4
  at(s, 'ai', 1, 0).currentStrength = 1;
  s = power(s, 'player', 1, pref('ai', 1, 0));
  assert.equal(at(s, 'ai', 1, 0), null);
  assert.equal(s.players.ai.released.at(-1).name, 'Shinx');
}

// Brock: +2 Defence, only to a friendly Defence Pokémon; current and maximum go up; permanent.
{
  let s = match();
  assert.equal(canUsePower(s, 'player', 2), false, 'no Defence Pokémon yet');
  s = play(s, 'player', 'growlithe', 1, 0);           // Hitpoints
  s = play(s, 'ai', 'lairon', 1, 0);               // enemy Defence: not friendly
  assert.equal(canUsePower(s, 'player', 2), false);
  s = play(s, 'player', 'geodude', 1, 1);            // Defence 3/7
  assert.deepEqual(powerTargets(s, 'player', 2), [pref('player', 1, 1)]);
  assert.throws(() => power(s, 'player', 2, pref('player', 1, 0)), /legal target/);
  at(s, 'player', 1, 1).currentStrength = 3;
  s = power(s, 'player', 2, pref('player', 1, 1));
  assert.deepEqual(stats(at(s, 'player', 1, 1)), [3, 5, 9]);
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  assert.equal(s.round, 2);
  assert.deepEqual(stats(at(s, 'player', 1, 1)), [3, 5, 9], 'the buff lasts');
}

// Each Power once per Round; usable again next Round. Paid with Exert if needed.
{
  let s = match();
  s = play(s, 'ai', 'horsea', 1, 0);
  s = power(s, 'player', 1, pref('ai', 1, 0));
  assert.equal(canUsePower(s, 'player', 1), false, 'used this Round');
  s.turn = 'player';
  assert.throws(() => power(s, 'player', 1, pref('ai', 1, 0)), /cannot/);
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  assert.equal(s.round, 2);
  assert.equal(canUsePower(s, 'player', 1), true);
  s.players.player.baseEnergy = 0;                   // Round 2: 2 Exert available
  s = power(s, 'player', 1, pref('ai', 1, 0));
  assert.equal(s.players.player.exhaust.length, 1, 'paid with Exert');
}

// --- Trainer removal ----------------------------------------------------------

{
  let s = match();
  s = play(s, 'ai', 'growlithe', 0, 0);               // 4/6/6 with their Ash
  s = play(s, 'ai', 'pidgey', 0, 1);               // 5/6/6
  at(s, 'ai', 0, 1).currentStrength = 1;             // damaged: 1/6
  s = play(s, 'player', 'absol', 1, 0);
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });   // Round 2: everything Active
  s.turn = 'player';
  trainer(s, 'ai', 0).strength = 2;
  const swift = { zone: 1, space: 0 };               // Absol is Swift and Alert
  s = applyAction(s, { type: 'command', who: 'player', from: swift, target: { kind: 'trainer', zone: 0 } });
  assert.equal(trainer(s, 'ai', 0).strength, 0);
  assert.ok(s.log.some((l) => l.includes("AI Opponent's Ash was removed. Zone 1 has fallen on AI Opponent's side.")));
  // Its Passive stops: maximum drops; current only if above it. Never defeated by the loss.
  assert.deepEqual(stats(at(s, 'ai', 0, 0)), [3, 5, 5]);
  assert.deepEqual(stats(at(s, 'ai', 0, 1)), [4, 1, 5], 'the damaged one keeps its 1 Strength');
  assert.ok(s.log.some((l) => l.includes("loses the bonus from Ash's Passive")));
  // Its Power stops, and it can't be targeted.
  s.turn = 'ai';
  assert.equal(canUsePower(s, 'ai', 0), false);
  assert.ok(!legalTargets(s, 'player', swift).some((t) => t.kind === 'trainer' && t.zone === 0));
  // Fallen zone: no new Pokémon on that side; the other side is unaffected.
  assert.ok(!summonSpaces(s, 'ai').some((x) => x.zone === 0));
  const uid = give(s, 'ai', 'sewaddle');
  assert.throws(() => applyAction(s, { type: 'playPokemon', who: 'ai', uid, zone: 0, space: 2 }), /fallen/);
  s = play(s, 'player', 'sewaddle', 0, 0);
  assert.equal(at(s, 'player', 0, 0).name, 'Sewaddle', 'your side of Zone 1 is fine');
  // Pokémon already in the fallen zone keep fighting.
  assert.ok(legalActions(s, 'ai').includes('command'));
}

// A removed Brock's Passive stops.
{
  let s = match();
  trainer(s, 'player', 2).strength = 0;
  s = play(s, 'ai', 'growlithe', 2, 0);
  assert.deepEqual(stats(at(s, 'ai', 2, 0)), [3, 5, 5], 'no damage from a removed Brock');
}

// --- AI ---------------------------------------------------------------------

// Takes a winning attack over everything else.
{
  let s = match();
  s.turn = 'ai';
  s = play(s, 'ai', 'pidgey', 1, 0);
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s.turn = 'ai';
  give(s, 'ai', 'dragonite');
  s.players.player.zones.forEach((z, i) => { z.trainer.strength = i === 2 ? 3 : 0; });
  const move = chooseAction(s, 'ai');
  assert.deepEqual(move, { type: 'command', who: 'ai', from: { zone: 1, space: 0 }, target: { kind: 'trainer', zone: 2 } });
}

// Uses Misty to finish off a Pokémon; never uses Exert; always takes Ash's free summon.
{
  let s = match();
  s = play(s, 'player', 'shinx', 1, 0);
  at(s, 'player', 1, 0).currentStrength = 1;
  s.turn = 'ai';
  s.players.ai.baseEnergy = 1;
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'usePower', who: 'ai', zone: 1, target: pref('player', 1, 0) });
  s.players.ai.baseEnergy = 0;                       // Exert only: the AI won't
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });

  let t = match();
  t.players.ai.baseEnergy = 1;
  stackTop(t, 'ai', 'growlithe');
  t = power(t, 'ai', 0);
  const choice = chooseAction(t, 'ai');
  assert.equal(choice.type, 'resolveChoice');
  assert.notEqual(choice.zone, undefined, 'takes the free summon');
  assert.notEqual(choice.zone, 2, "avoids your Brock's Zone");
  applyAction(t, choice);
}

// Plays the most expensive Pokémon it can afford, preferring a zone with its own bonus.
{
  const s = match();
  s.turn = 'ai';
  s.players.ai.baseEnergy = 3;
  give(s, 'ai', 'growlithe');
  give(s, 'ai', 'quagsire');                          // cost 3, Water: Misty's Zone gives +3
  s.players.ai.trainers.forEach((t) => { if (t.id !== 'misty') t.power = null; });
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'playPokemon');
  assert.equal(s.players.ai.hand.find((c) => c.uid === move.uid).id, 'quagsire');
  assert.equal(move.zone, 1);
}

console.log('All Trainer tests passed.');
