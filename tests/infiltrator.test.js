// Checks the Innate Power Infiltrator: its attacks ignore the Defence and
// Special Defence targeting restrictions, but still only reach Trainers above
// 0 Strength, and an Alert target still hits back. Also: it can be granted,
// it doesn't stack, it is on the right Fire cards, and the AI uses it.
// Run with: node tests/infiltrator.test.js
import assert from 'node:assert/strict';
import { legalTargets, guardsBypassed } from '../src/engine/game.js';
import { resolveEffects } from '../src/engine/effects.js';
import { keywordList, hasKeyword } from '../src/engine/keywords.js';
import { POKEMON_CARDS, INNATE_POWERS } from '../src/engine/cardData.js';
import { chooseAction } from '../src/ai/opponent.js';
import { battle, act, place, onTurn, at, trainerAt, pref, logged } from './fixtures.js';

// Player Fire, AI Water; Trainer Passives and Powers off, so the numbers are the cards' own.
const fire = () => battle({ passives: false, powers: false });
const targets = (s, zone, space) => legalTargets(s, 'player', { zone, space });
const trainers = (list) => list.filter((t) => t.kind === 'trainer').map((t) => t.zone);
const has = (list, zone, space) => list.some((t) => t.kind === 'pokemon' && t.zone === zone && t.space === space);

// --- Card data ----------------------------------------------------------------

assert.ok(INNATE_POWERS.Infiltrator, 'it has rule text for the cards and the inspect view');
assert.deepEqual(POKEMON_CARDS.filter((c) => hasKeyword(c, 'Infiltrator')).map((c) => c.id), ['ponyta', 'mankey', 'sneasel', 'arcanine']);

// --- Targeting ------------------------------------------------------------------

// With a Defence guard (Quagsire) on the other side: an Infiltrator Physical
// attacker may target any Trainer and the non-guard Pokémon; a Physical
// attacker without it must target the guard.
{
  const s = fire();
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });          // Defence: guards against Physical attacks
  place(s, 'ai', 2, 1, 'horsea', { spent: true });            // Hitpoints
  place(s, 'player', 1, 0, 'ponyta');                         // Physical, Infiltrator
  place(s, 'player', 1, 1, 'growlithe');                      // Physical, no Infiltrator
  const raider = targets(s, 1, 0);
  assert.deepEqual(trainers(raider), [0, 1, 2], 'every Trainer');
  assert.ok(has(raider, 2, 1), 'the non-guard Pokémon');
  assert.ok(has(raider, 0, 0), 'and the guard too');
  assert.deepEqual(targets(s, 1, 1), [{ kind: 'pokemon', zone: 0, space: 0 }], 'without Infiltrator: the guard only');

  // The same against a Special Defence guard for Special attackers: Infiltrator granted.
  const t = fire();
  place(t, 'ai', 0, 0, 'chinchou', { spent: true });          // Special Defence
  place(t, 'ai', 1, 0, 'horsea', { spent: true });
  place(t, 'player', 0, 0, 'magmar');                         // Special, no Infiltrator
  assert.deepEqual(targets(t, 0, 0), [{ kind: 'pokemon', zone: 0, space: 0 }]);
  resolveEffects(t, { who: 'player', source: { kind: 'strategy', owner: 'player', uid: 'x', name: 'Test' }, label: 'Test', target: pref('player', 0, 0) },
    [{ op: 'grant', keyword: 'Infiltrator', target: { mode: 'targeted', side: 'friendly' } }]);
  assert.ok(hasKeyword(at(t, 'player', 0, 0), 'Infiltrator'), 'effects can grant it');
  assert.deepEqual(trainers(targets(t, 0, 0)), [0, 1, 2]);
  assert.ok(has(targets(t, 0, 0), 1, 0));
}

// It doesn't stack: granted on top of the printed one, it's still one Infiltrator.
{
  const s = fire();
  place(s, 'player', 0, 0, 'arcanine', { granted: [{ key: 'Infiltrator' }] });
  assert.equal(keywordList(at(s, 'player', 0, 0)).filter((k) => k.key === 'Infiltrator').length, 2, 'printed and granted');
  assert.equal(hasKeyword(at(s, 'player', 0, 0), 'Infiltrator'), true, 'the same as having it once');
}

// A Trainer at 0 Strength still can't be targeted, even by an Infiltrator.
{
  const s = fire();
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });
  place(s, 'player', 0, 0, 'mankey');
  trainerAt(s, 'ai', 1).strength = 0;
  assert.deepEqual(trainers(targets(s, 0, 0)), [0, 2]);
}

// The attack itself: it hits the Trainer past the guard.
{
  let s = fire();
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });
  place(s, 'player', 0, 0, 'sneasel');                        // Attack 4
  s = act(s, 'player', { type: 'command', from: { zone: 0, space: 0 }, target: { kind: 'trainer', zone: 2 } });
  assert.equal(trainerAt(s, 'ai', 2).strength, 15 - 4);
}

// Trading damage still happens: an Alert target hits back.
{
  let s = fire();
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });
  place(s, 'ai', 1, 0, 'pelipper', { currentStrength: 9, strengthValue: 9 });   // Swift and Active: Alert; Attack 5 (Weather no longer adds by Type)
  place(s, 'player', 1, 0, 'arcanine');                       // Swift, Infiltrator, 5/6
  s = act(s, 'player', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 9 - 5, 'Arcanine hit Pelipper');
  assert.ok(logged(s, 'Pelipper was Alert and hit back for 5'));
  assert.equal(at(s, 'player', 1, 0).currentStrength, 6 - 5, "and Pelipper's 5 back hit Arcanine (Strength 6)");
}

// --- AI -----------------------------------------------------------------------

// The AI attacks past guards with an Infiltrator: a winning attack on the last Trainer.
{
  const s = battle({ player: 'water', ai: 'fire', passives: false, powers: false });
  place(s, 'player', 0, 0, 'quagsire', { spent: true });      // a Defence guard
  place(s, 'ai', 1, 0, 'mankey');                             // Physical, Infiltrator
  s.players.player.zones.forEach((z, i) => { z.trainer.strength = i === 2 ? 3 : 0; });
  onTurn(s, 'ai');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'command', who: 'ai', from: { zone: 1, space: 0 }, target: { kind: 'trainer', zone: 2 } });
}

// --- For the animation (Step 21): the attack says which guards it went over -----------

{
  const s = fire();
  place(s, 'ai', 0, 0, 'quagsire', { spent: true });          // Defence guard
  place(s, 'ai', 2, 1, 'horsea', { spent: true });
  place(s, 'player', 1, 0, 'ponyta');                         // Physical, Infiltrator
  place(s, 'player', 1, 1, 'growlithe');                      // Physical, no Infiltrator
  assert.deepEqual(guardsBypassed(s, 'player', { zone: 1, space: 0 }, { kind: 'trainer', zone: 1 }).map((g) => g.name), ['Quagsire'], 'over the guard to a Trainer');
  assert.deepEqual(guardsBypassed(s, 'player', { zone: 1, space: 0 }, { kind: 'pokemon', zone: 0, space: 0 }), [], 'hitting the guard itself goes over nothing');
  assert.deepEqual(guardsBypassed(s, 'player', { zone: 1, space: 1 }, { kind: 'pokemon', zone: 0, space: 0 }), [], 'no Infiltrator, nothing bypassed');
  const after = act(s, 'player', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'trainer', zone: 1 } });
  const attack = after.events.find((e) => e.type === 'attack');
  assert.deepEqual(attack.infiltrated.map((g) => g.uid), [at(s, 'ai', 0, 0).uid], 'the attack event names the guard');
  // No guards on the board: an Infiltrator attack goes over nothing.
  const t = fire();
  place(t, 'ai', 2, 1, 'horsea', { spent: true });
  place(t, 'player', 1, 0, 'ponyta');
  const plain = act(t, 'player', { type: 'command', from: { zone: 1, space: 0 }, target: { kind: 'trainer', zone: 1 } });
  assert.equal(plain.events.find((e) => e.type === 'attack').infiltrated, undefined);
}

console.log('All Infiltrator tests passed.');
