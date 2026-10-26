// Checks Strategy Cards: playing one (cost, turn, Discard Pile, targets),
// Agility, and each Fire and Water Strategy Card working as written.
// Run with: node tests/strategy.test.js
import assert from 'node:assert/strict';
import { applyAction, legalTargets, playableStrategies, strategyTargets, powerTargets, weatherCounts } from '../src/engine/game.js';
import { STRATEGY_CARDS } from '../src/engine/cardData.js';
import { statusCount } from '../src/engine/status.js';
import { keywordAmount, hasKeyword } from '../src/engine/keywords.js';
import { chooseAction } from '../src/ai/opponent.js';
import {
  battle, give, act, play, place, nextRound, at, trainerAt, pref, tref, stats, logged,
} from './fixtures.js';

// Trainer Passives and Powers off, so the numbers are the cards' own.
const fire = (extra) => battle({ passives: false, powers: false, ...extra });
const water = (extra) => battle({ player: 'water', ai: 'fire', passives: false, powers: false, ...extra });
const strategy = (s, who, uid, target) => act(s, who, { type: 'playStrategy', uid, target });
const burn = (c) => statusCount(c, 'burn');
const hurt = (s, ref, to) => { at(s, ref.owner, ref.zone, ref.space).currentStrength = to; return ref; };

// --- Card data ----------------------------------------------------------------

for (const c of STRATEGY_CARDS) {
  assert.equal(c.cardType, 'Strategy');
  for (const field of ['name', 'energyCost', 'effectText', 'rarity', 'effects']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
}

// --- Playing a Strategy Card -------------------------------------------------------

// Pays its Energy Cost, resolves, uses the turn, then goes to the Discard Pile.
{
  let s = fire();
  const uid = give(s, 'player', 'ember');
  s = strategy(s, 'player', uid, tref('ai', 0));
  const p = s.players.player;
  assert.equal(p.baseEnergy, 9);
  assert.equal(p.discard.at(-1).uid, uid, 'discarded after use');
  assert.equal(s.turn, 'ai');
  assert.ok(logged(s, 'You played Ember (Burn 2 to an enemy Pokémon or Trainer.) Paid 1 Base Energy.'));
}

// A targeted card needs a legal target; Agility Pokémon can't be targeted by
// Strategy Cards (Trainer Powers and attacks still can).
{
  let s = water();
  const uid = give(s, 'player', 'bubble-beam');
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === uid), 'no enemy Pokémon');
  place(s, 'ai', 1, 0, 'test-wing');                        // Agility
  assert.deepEqual(strategyTargets(s, 'player', uid), []);
  assert.throws(() => strategy(s, 'player', uid, pref('ai', 1, 0)), /cannot/);
  place(s, 'ai', 1, 1, 'test-flame');
  assert.deepEqual(strategyTargets(s, 'player', uid), [pref('ai', 1, 1)]);
  assert.throws(() => strategy(s, 'player', uid, pref('ai', 1, 0)), /legal target/);

  const t = battle({ player: 'water', ai: 'fire', passives: false, testTrainers: true });
  place(t, 'ai', 1, 0, 'test-wing');
  assert.deepEqual(powerTargets(t, 'player', 1), [pref('ai', 1, 0)], 'Trainer Powers can still target it');
  place(t, 'player', 0, 0, 'test-flame');
  assert.ok(legalTargets(t, 'player', { zone: 0, space: 0 }).some((r) => r.kind === 'pokemon' && r.zone === 1), 'attacks can still target it');
}

// --- Fire -----------------------------------------------------------------------

// Ember: Burn 2 to an enemy Pokémon or Trainer.
{
  let s = fire();
  place(s, 'ai', 0, 0, 'quagsire');
  s = strategy(s, 'player', give(s, 'player', 'ember'), pref('ai', 0, 0));
  assert.equal(burn(at(s, 'ai', 0, 0)), 2);
  s = strategy(s, 'player', give(s, 'player', 'ember'), tref('ai', 2));
  assert.equal(burn(trainerAt(s, 'ai', 2)), 2);
  s = strategy(s, 'player', give(s, 'player', 'ember'), tref('ai', 2));
  assert.equal(burn(trainerAt(s, 'ai', 2)), 4, 'Burn stacks');
  assert.throws(() => strategy(s, 'player', give(s, 'player', 'ember'), tref('player', 0)), /legal target/, 'enemy only');
}

// Flame Charge: +2 Attack this Round; a Fire Pokémon also gains Scorch 1 this Round.
{
  let s = fire();
  place(s, 'player', 0, 0, 'growlithe');                    // Scorch 1 printed
  place(s, 'player', 1, 0, 'mankey');                       // Fighting
  s = strategy(s, 'player', give(s, 'player', 'flame-charge'), pref('player', 0, 0));
  assert.equal(stats(at(s, 'player', 0, 0))[0], 4);
  assert.equal(keywordAmount(at(s, 'player', 0, 0), 'Scorch'), 2, 'Scorch 1 + Scorch 1');
  s = strategy(s, 'player', give(s, 'player', 'flame-charge'), pref('player', 1, 0));
  assert.equal(stats(at(s, 'player', 1, 0))[0], 6);
  assert.ok(!hasKeyword(at(s, 'player', 1, 0), 'Scorch'), 'not a Fire Pokémon: no Scorch');
  // Its Scorch works on this Round's attack.
  place(s, 'ai', 2, 0, 'test-dragon', { spent: true });
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 2, space: 0 } });
  assert.deepEqual([at(s, 'ai', 2, 0).currentStrength, burn(at(s, 'ai', 2, 0))], [11 - 4, 2]);
  s = nextRound(s);
  assert.equal(stats(at(s, 'player', 0, 0))[0], 2, 'expired at Supper');
  assert.equal(keywordAmount(at(s, 'player', 0, 0), 'Scorch'), 1);
}

// Heat Wave: Burn 1 to every enemy Pokémon and every enemy Trainer.
{
  let s = fire();
  place(s, 'ai', 0, 0, 'quagsire');
  place(s, 'ai', 2, 1, 'horsea');
  place(s, 'player', 0, 0, 'growlithe');
  s = strategy(s, 'player', give(s, 'player', 'heat-wave'));
  assert.deepEqual([burn(at(s, 'ai', 0, 0)), burn(at(s, 'ai', 2, 1))], [1, 1]);
  assert.deepEqual(s.players.ai.zones.map((z) => burn(z.trainer)), [1, 1, 1]);
  assert.equal(burn(at(s, 'player', 0, 0)), 0, 'enemies only');
  assert.ok(s.players.player.zones.every((z) => burn(z.trainer) === 0));
}

// Fire Blast: 4 damage, then Burn 2 if the target is still in play.
{
  let s = fire();
  place(s, 'ai', 0, 0, 'quagsire');                         // Strength 7
  s = strategy(s, 'player', give(s, 'player', 'fire-blast'), pref('ai', 0, 0));
  assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, burn(at(s, 'ai', 0, 0))], [3, 2]);
  s = strategy(s, 'player', give(s, 'player', 'fire-blast'), tref('ai', 1));
  assert.deepEqual([trainerAt(s, 'ai', 1).strength, burn(trainerAt(s, 'ai', 1))], [17 - 4, 2]);
  hurt(s, place(s, 'ai', 2, 0, 'horsea'), 2);
  s = strategy(s, 'player', give(s, 'player', 'fire-blast'), pref('ai', 2, 0));
  assert.equal(at(s, 'ai', 2, 0), null, 'defeated: nothing left to Burn');
  assert.ok(s.players.ai.released.some((c) => c.id === 'horsea' && !c.status));
}

// --- Water ----------------------------------------------------------------------

// Aqua Ring: heal a friendly Pokémon 3 and Douse it. Retain: kept in hand at Supper.
{
  let s = water();
  hurt(s, place(s, 'player', 0, 0, 'quagsire'), 2);
  at(s, 'player', 0, 0).status = { burn: { count: 3, by: 'ai' } };
  assert.equal(burn(at(s, 'player', 0, 0)), 3);
  s = strategy(s, 'player', give(s, 'player', 'aqua-ring'), pref('player', 0, 0));
  assert.deepEqual([at(s, 'player', 0, 0).currentStrength, burn(at(s, 'player', 0, 0))], [5, 0]);
  // Any friendly Pokémon: a burned one at full Strength can still be Doused.
  place(s, 'player', 1, 0, 'horsea');
  at(s, 'player', 1, 0).status = { burn: { count: 1, by: 'ai' } };
  const uid = give(s, 'player', 'aqua-ring');
  assert.ok(strategyTargets(s, 'player', uid).some((r) => r.zone === 1), 'undamaged Pokémon can be targeted');
  assert.ok(!strategyTargets(s, 'player', uid).some((r) => r.owner === 'ai'), 'friendly only');
  s = nextRound(s);
  assert.ok(s.players.player.hand.some((c) => c.uid === uid), 'Retain: stays in hand');
}

// Bubble Beam: 2 damage to an enemy Pokémon, or 3 if Rain is 2 or more.
{
  let s = water();
  place(s, 'ai', 0, 0, 'test-dragon');
  s = strategy(s, 'player', give(s, 'player', 'bubble-beam'), pref('ai', 0, 0));
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 9);
  s = act(s, 'player', { type: 'playLocation', uid: give(s, 'player', 'cerulean-cape'), zone: 2 });
  assert.equal(weatherCounts(s).Rain, 2);
  s = strategy(s, 'player', give(s, 'player', 'bubble-beam'), pref('ai', 0, 0));
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 6, 'Rain 2: 3 damage');
  assert.throws(() => strategy(s, 'player', give(s, 'player', 'bubble-beam'), tref('ai', 0)), /legal target/, 'Pokémon only');
}

// Dive: Return a Pokémon from the Discard Pile to your hand; it gains Retain.
{
  let s = water();
  const uid = give(s, 'player', 'dive');
  assert.ok(!playableStrategies(s, 'player').some((c) => c.uid === uid), 'no Pokémon in the Discard Pile');
  const p = s.players.player;
  const mon = p.drawPile.find((c) => c.id === 'lapras');
  p.drawPile.splice(p.drawPile.indexOf(mon), 1);
  p.discard.push(mon);
  s = strategy(s, 'player', uid);
  assert.deepEqual(s.pending.options, [mon.uid]);
  s = applyAction(s, { type: 'resolveChoice', who: 'player', uids: [mon.uid] });
  const back = s.players.player.hand.find((c) => c.uid === mon.uid);
  assert.ok(back?.retainGranted, 'in hand, with Retain');
  s = nextRound(s);
  assert.ok(s.players.player.hand.some((c) => c.uid === mon.uid), 'kept at Supper');
}

// Surf: 2 damage to each enemy Pokémon, and heal each friendly Pokémon 1.
{
  let s = water();
  place(s, 'ai', 0, 0, 'test-dragon');
  place(s, 'ai', 2, 2, 'test-shadow');
  hurt(s, place(s, 'player', 0, 0, 'quagsire'), 4);
  hurt(s, place(s, 'player', 1, 0, 'horsea'), 1);
  place(s, 'player', 2, 0, 'chinchou');
  s = strategy(s, 'player', give(s, 'player', 'surf'));
  assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, at(s, 'ai', 2, 2).currentStrength], [9, 7]);
  assert.deepEqual([at(s, 'player', 0, 0).currentStrength, at(s, 'player', 1, 0).currentStrength, at(s, 'player', 2, 0).currentStrength], [5, 2, 5]);
  assert.equal(trainerAt(s, 'ai', 0).strength, 14, 'Trainers untouched');

  // Playable while either part has something to affect.
  const t = water();
  const uid = give(t, 'player', 'surf');
  assert.ok(!playableStrategies(t, 'player').some((c) => c.uid === uid), 'nothing to damage or heal');
  hurt(t, place(t, 'player', 0, 0, 'horsea'), 1);
  assert.ok(playableStrategies(t, 'player').some((c) => c.uid === uid), 'no enemy Pokémon, but a friendly one to heal');
}

// --- AI -----------------------------------------------------------------------

// Water: Aqua Ring only on its own damaged cards.
{
  let s = battle({ player: 'fire', ai: 'water', passives: false, powers: false });
  place(s, 'player', 0, 0, 'magmar');
  hurt(s, pref('player', 0, 0), 1);                         // only YOUR card is damaged
  place(s, 'ai', 1, 0, 'quagsire');
  s.turn = 'ai';
  s.players.ai.baseEnergy = 2;
  s.players.ai.dollars = 0;
  const uid = give(s, 'ai', 'aqua-ring');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });
  hurt(s, pref('ai', 1, 0), 2);
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'playStrategy', who: 'ai', uid, target: pref('ai', 1, 0) });
}

// Fire: Ember goes at a Trainer.
{
  const s = battle({ player: 'water', ai: 'fire', passives: false, powers: false });
  s.turn = 'ai';
  s.players.ai.baseEnergy = 1;
  s.players.ai.dollars = 0;
  give(s, 'ai', 'ember');
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'playStrategy');
  assert.equal(move.target.kind, 'trainer');
}

console.log('All Strategy Card tests passed.');
