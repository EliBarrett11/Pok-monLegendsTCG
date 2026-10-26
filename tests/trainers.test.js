// Checks Trainers: each Fire and Water Trainer's Passive and Power working as
// written, Powers once per Round, Trainer removal, fallen zones, and the AI's
// choices with them.
// Run with: node tests/trainers.test.js
import assert from 'node:assert/strict';
import {
  applyAction, legalActions, legalTargets, canUsePower, powerTargets, summonSpaces, summonCost, attackOf,
} from '../src/engine/game.js';
import { TRAINER_CARDS } from '../src/engine/cardData.js';
import { statusCount } from '../src/engine/status.js';
import { hasKeyword, keywordAmount } from '../src/engine/keywords.js';
import { chooseAction } from '../src/ai/opponent.js';
import {
  battle, give, act, onTurn, play, place, nextRound, choose, at, trainerAt, pref, tref, stats, logged,
} from './fixtures.js';

// Fire: Blaine (Zone 1), Flannery (Zone 2), Kabu (Zone 3).
// Water: Misty (Zone 1), Crasher Wake (Zone 2), Wallace (Zone 3).
const fire = () => battle({ seed: 1 });
const water = () => battle({ seed: 1, player: 'water', ai: 'fire' });
const power = (s, who, zone, target) => act(s, who, { type: 'usePower', zone, target });
const strategy = (s, who, id, target) => act(s, who, { type: 'playStrategy', uid: give(s, who, id), target });
const command = (s, who, from, target) => act(s, who, { type: 'command', from, target });
const burn = (c) => statusCount(c, 'burn');
const hurt = (s, ref, to) => { at(s, ref.owner, ref.zone, ref.space).currentStrength = to; return ref; };

// --- Data -------------------------------------------------------------------

for (const t of TRAINER_CARDS) {
  assert.equal(t.cardType, 'Trainer');
  assert.ok(t.name && t.strength > 0 && t.power.text && t.power.effects.length && t.passive.text, t.id);
}
{
  const s = fire();
  assert.deepEqual(s.players.player.zones.map((z) => z.trainer.name), ['Blaine', 'Flannery', 'Kabu']);
  assert.deepEqual(s.players.ai.zones.map((z) => z.trainer.name), ['Misty', 'Crasher Wake', 'Wallace']);
}

// --- Blaine -------------------------------------------------------------------

// Power (1): Burn 1 to an enemy Pokémon or Trainer.
{
  let s = fire();
  place(s, 'ai', 2, 0, 'horsea');
  assert.ok(powerTargets(s, 'player', 0).some((r) => r.kind === 'pokemon' && r.zone === 2), 'any Zone');
  s = power(s, 'player', 0, tref('ai', 1));
  assert.equal(burn(trainerAt(s, 'ai', 1)), 1, 'his own Power is not increased by his Passive');
  assert.equal(s.players.player.baseEnergy, 9);
}

// Passive: Burn applied by friendly Pokémon in Blaine's Zone is increased by 1:
// Scorch (Charcoal's too) and a Pokémon's own ability. Not Strategy Cards, and
// not Pokémon in other Zones.
{
  let s = fire();
  place(s, 'player', 0, 0, 'growlithe');                      // Scorch 1, in Blaine's Zone
  place(s, 'player', 1, 0, 'growlithe');                      // Flannery's Zone
  place(s, 'ai', 2, 0, 'test-dragon', { spent: true });
  place(s, 'ai', 2, 1, 'test-dragon', { spent: true });
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 2, space: 0 });
  s = command(s, 'player', { zone: 1, space: 0 }, { kind: 'pokemon', zone: 2, space: 1 });
  assert.deepEqual([burn(at(s, 'ai', 2, 0)), burn(at(s, 'ai', 2, 1))], [2, 1]);
  s = play(s, 'player', 'charmander', 0, 1);                  // On Summon: Burn 1 (+1)
  s = choose(s, { target: tref('ai', 0) });
  assert.equal(burn(trainerAt(s, 'ai', 0)), 2);
  s = strategy(s, 'player', 'ember', tref('ai', 1));
  assert.equal(burn(trainerAt(s, 'ai', 1)), 2, 'Ember is not a Pokémon: no bonus');
  // Charcoal's Scorch counts too.
  let t = fire();
  place(t, 'player', 0, 0, 'magmar');                          // Scorch 2
  t.players.player.dollars = 2;
  t = act(t, 'player', { type: 'openBag', mode: 'buyHand', uid: give(t, 'player', 'charcoal'), then: 'use', target: pref('player', 0, 0) });
  t = command(t, 'player', { zone: 0, space: 0 }, { kind: 'trainer', zone: 2 });
  assert.equal(burn(trainerAt(t, 'ai', 2)), 2 + 1 + 1, 'Scorch 2 + Charcoal 1 + Blaine 1');
}

// --- Flannery -----------------------------------------------------------------

// Power (1): a friendly Pokémon in Flannery's Zone gains +2 Attack this Round.
{
  let s = fire();
  place(s, 'player', 1, 0, 'mankey');
  place(s, 'player', 0, 0, 'growlithe');
  assert.deepEqual(powerTargets(s, 'player', 1), [pref('player', 1, 0)], 'her Zone only');
  s = power(s, 'player', 1, pref('player', 1, 0));
  assert.equal(attackOf(at(s, 'player', 1, 0)), 6);
  s = nextRound(s);
  assert.equal(attackOf(at(s, 'player', 1, 0)), 4);
}

// Passive: friendly Fire Pokémon in Flannery's Zone gain Overrun.
{
  let s = fire();
  place(s, 'player', 1, 0, 'magmar');
  place(s, 'player', 1, 1, 'sneasel', { spent: true });       // Dark
  place(s, 'player', 0, 0, 'growlithe', { spent: true });     // another Zone
  assert.ok(hasKeyword(at(s, 'player', 1, 0), 'Overrun'));
  assert.ok(!hasKeyword(at(s, 'player', 1, 1), 'Overrun'), 'not Fire');
  assert.ok(!hasKeyword(at(s, 'player', 0, 0), 'Overrun'), 'not in her Zone');
  hurt(s, place(s, 'ai', 1, 0, 'horsea', { spent: true }), 1);
  s = command(s, 'player', { zone: 1, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(trainerAt(s, 'ai', 1).strength, 17 - 2, 'Magmar 4 − Shell 1 (from Wake) = 3, 1 needed: 2 to Crasher Wake');
}

// --- Kabu ---------------------------------------------------------------------

// Power (2): a friendly Spent Pokémon in Kabu's Zone becomes Active.
// Passive: friendly Pokémon in Kabu's Zone gain +2 Strength.
{
  let s = fire();
  s = play(s, 'player', 'mankey', 2, 0);                      // Fighting 4/5: +2 Strength
  assert.deepEqual(stats(at(s, 'player', 2, 0)), [4, 7, 7]);
  place(s, 'player', 0, 0, 'growlithe', { spent: true });
  assert.deepEqual(powerTargets(s, 'player', 2), [pref('player', 2, 0)], 'Spent, in his Zone');
  s = power(s, 'player', 2, pref('player', 2, 0));
  assert.equal(at(s, 'player', 2, 0).spent, false);
  assert.equal(s.players.player.baseEnergy, 8, 'costs 2');
  place(s, 'ai', 2, 0, 'horsea');
  assert.deepEqual(stats(at(s, 'ai', 2, 0)), [3, 4, 4], 'friendly only');
}

// --- Misty --------------------------------------------------------------------

// Power (1): heal a damaged friendly Pokémon in Misty's Zone 3.
// Passive: friendly Water Pokémon in Misty's Zone gain +2 Strength.
{
  let s = water();
  place(s, 'player', 0, 0, 'quagsire');                       // Water 4/7 → 4/9
  place(s, 'player', 0, 1, 'chinchou');                       // Electric: no bonus
  place(s, 'player', 1, 0, 'horsea');                         // another Zone
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [4, 9, 9]);
  assert.deepEqual(stats(at(s, 'player', 0, 1)), [3, 5, 5]);
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [3, 4, 4]);
  assert.ok(!canUsePower(s, 'player', 0), 'nothing damaged in her Zone');
  hurt(s, pref('player', 1, 0), 1);
  assert.ok(!canUsePower(s, 'player', 0), 'another Zone');
  hurt(s, pref('player', 0, 0), 2);
  s = power(s, 'player', 0, pref('player', 0, 0));
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5);
}

// --- Crasher Wake ---------------------------------------------------------------

// Power (2): 2 damage to an enemy Pokémon in Wake's Zone.
// Passive: friendly Pokémon in Wake's Zone gain Shell 1.
{
  let s = water();
  place(s, 'ai', 1, 0, 'magmar');
  place(s, 'ai', 0, 0, 'growlithe', { spent: true });        // another Zone
  assert.deepEqual(powerTargets(s, 'player', 1), [pref('ai', 1, 0)]);
  s = power(s, 'player', 1, pref('ai', 1, 0));
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 7 - 2);
  assert.equal(s.players.player.baseEnergy, 8, 'costs 2');
  place(s, 'player', 1, 0, 'horsea', { spent: true });
  place(s, 'player', 0, 0, 'horsea', { spent: true });
  assert.equal(keywordAmount(at(s, 'player', 1, 0), 'Shell'), 1);
  assert.equal(keywordAmount(at(s, 'player', 0, 0), 'Shell'), 0);
  assert.equal(keywordAmount(at(s, 'ai', 1, 0), 'Shell'), 0, 'friendly only');
  at(s, 'ai', 1, 0).spent = false;
  s = command(s, 'ai', { zone: 1, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
  assert.equal(at(s, 'player', 1, 0).currentStrength, 4 - 3, 'Magmar 4 − Shell 1');
}

// --- Wallace ------------------------------------------------------------------

// Power (1): Return a Pokémon from your Discard Pile to your hand.
{
  let s = water();
  assert.ok(!canUsePower(s, 'player', 2), 'nothing to Return');
  const p = s.players.player;
  const mon = p.drawPile.find((c) => c.id === 'gyarados');
  p.drawPile.splice(p.drawPile.indexOf(mon), 1);
  p.discard.push(mon);
  s = power(s, 'player', 2);
  s = choose(s, { uids: [mon.uid] });
  assert.ok(s.players.player.hand.some((c) => c.uid === mon.uid));
}

// Passive: the first Pokémon you summon into Wallace's Zone each Round costs 1 less.
{
  let s = water();
  const lapras = give(s, 'player', 'lapras');
  const card = s.players.player.hand.find((c) => c.uid === lapras);
  assert.deepEqual([summonCost(s, 'player', card, 2), summonCost(s, 'player', card, 0)], [3, 4]);
  s = act(s, 'player', { type: 'playPokemon', uid: lapras, zone: 2, space: 0 });
  assert.equal(s.players.player.baseEnergy, 10 - 3);
  const quag = s.players.player.hand.length;
  give(s, 'player', 'quagsire');
  assert.equal(summonCost(s, 'player', s.players.player.hand[quag], 2), 3, 'the second one pays full');
  s = nextRound(s);
  assert.equal(summonCost(s, 'player', card, 2), 3, 'a new Round: the discount is back');
  const horsea = give(s, 'player', 'horsea');
  s.players.player.baseEnergy = 0;
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: horsea, zone: 2, space: 1 });
  assert.equal(at(s, 'player', 2, 1).id, 'horsea', 'a 1-cost Pokémon is free there');
}

// --- Powers -------------------------------------------------------------------

// Each Power once per Round; usable again next Round. Paid with Exert if needed.
{
  let s = fire();
  s = power(s, 'player', 0, tref('ai', 0));
  assert.equal(canUsePower(s, 'player', 0), false, 'used this Round');
  s.turn = 'player';
  assert.throws(() => power(s, 'player', 0, tref('ai', 0)), /cannot/);
  s = nextRound(s);
  assert.equal(canUsePower(s, 'player', 0), true);
  s.turn = 'player';
  s.passesInARow = 0;
  s.players.player.baseEnergy = 0;                           // Round 2: 2 Exert available
  s = applyAction(s, { type: 'usePower', who: 'player', zone: 0, target: tref('ai', 0) });
  assert.equal(s.players.player.exhaust.length, 1, 'paid with Exert');
}

// --- Trainer removal ----------------------------------------------------------

{
  let s = fire();
  place(s, 'ai', 2, 0, 'horsea');
  place(s, 'ai', 0, 0, 'quagsire');                           // Misty's Zone: 4/9
  place(s, 'ai', 0, 1, 'horsea');                             // 3/6
  hurt(s, pref('ai', 0, 1), 1);
  place(s, 'player', 1, 0, 'ponyta');
  trainerAt(s, 'ai', 0).strength = 2;
  s = strategy(s, 'player', 'fire-blast', tref('ai', 0));
  assert.equal(trainerAt(s, 'ai', 0).strength, 0);
  assert.ok(logged(s, "AI Opponent's Misty was removed. Zone 1 has fallen on AI Opponent's side."));
  // Its Passive stops: maximum drops; current only if above it. Never defeated by the loss.
  assert.deepEqual(stats(at(s, 'ai', 0, 0)), [4, 7, 7]);
  assert.deepEqual(stats(at(s, 'ai', 0, 1)), [3, 1, 4], 'the damaged one keeps its 1 Strength');
  assert.ok(logged(s, "loses the bonus from Misty's Passive"));
  // Its Power stops, and it can't be targeted.
  s.turn = 'ai';
  assert.equal(canUsePower(s, 'ai', 0), false);
  assert.ok(!legalTargets(s, 'player', { zone: 1, space: 0 }).some((t) => t.kind === 'trainer' && t.zone === 0));
  // Fallen zone: no new Pokémon on that side; the other side is unaffected.
  assert.ok(!summonSpaces(s, 'ai').some((x) => x.zone === 0));
  const uid = give(s, 'ai', 'chinchou');
  onTurn(s, 'ai');
  assert.throws(() => applyAction(s, { type: 'playPokemon', who: 'ai', uid, zone: 0, space: 2 }), /fallen/);
  s = play(s, 'player', 'growlithe', 0, 0);
  assert.equal(at(s, 'player', 0, 0).name, 'Growlithe', 'your side of Zone 1 is fine');
  // Pokémon already in the fallen zone keep fighting.
  for (const ref of [pref('player', 1, 0), pref('ai', 2, 0), pref('ai', 0, 1)]) at(s, ref.owner, ref.zone, ref.space).spent = true;
  at(s, 'ai', 0, 0).spent = false;
  onTurn(s, 'ai');
  assert.ok(legalActions(s, 'ai').includes('command'));
}

// --- AI -----------------------------------------------------------------------

// Takes a winning attack over everything else.
{
  const s = battle({ seed: 1, player: 'water', ai: 'fire' });
  place(s, 'ai', 1, 0, 'arcanine');
  give(s, 'ai', 'houndoom');
  s.players.player.zones.forEach((z, i) => { z.trainer.strength = i === 2 ? 3 : 0; });
  onTurn(s, 'ai');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'command', who: 'ai', from: { zone: 1, space: 0 }, target: { kind: 'trainer', zone: 2 } });
}

// Water: uses Misty's Power to heal its own damaged Pokémon; never uses Exert for it.
{
  const s = battle({ seed: 1, player: 'fire', ai: 'water' });
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });
  hurt(s, pref('ai', 0, 0), 2);
  s.players.ai.trainers.forEach((t) => { if (t.id !== 'misty') t.power = { ...t.power, cost: 99 }; });
  s.players.ai.dollars = 0;
  onTurn(s, 'ai');
  s.players.ai.baseEnergy = 1;
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'usePower', who: 'ai', zone: 0, target: pref('ai', 0, 0) });
  s.players.ai.baseEnergy = 0;
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' }, 'Exert only: the AI won\'t');
}

// Plays the most expensive Pokémon it can afford, into a Zone with a bonus for it
// (Misty's +2 Strength or Wake's Shell 1), not Wallace's.
{
  const s = battle({ seed: 1, player: 'fire', ai: 'water' });
  s.players.ai.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  s.players.ai.dollars = 0;
  onTurn(s, 'ai');
  s.players.ai.baseEnergy = 3;
  give(s, 'ai', 'horsea');
  give(s, 'ai', 'quagsire');                                   // cost 3
  s.players.ai.zones[2].trainer.passive = { text: '' };      // no discount to weigh
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'playPokemon');
  assert.equal(s.players.ai.hand.find((c) => c.uid === move.uid).id, 'quagsire');
  assert.ok([0, 1].includes(move.zone), `Zone ${move.zone + 1}`);
}

console.log('All Trainer tests passed.');
