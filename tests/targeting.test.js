// Checks choosing targets on screen (Feedback batch 1): the legal targets,
// the prompt bar's words, hand cards as targets (Pelipper's On Summon Retain),
// and why an enemy Trainer can't be chosen (guarded). No DOM.
// Run with: node tests/targeting.test.js
import assert from 'node:assert/strict';
import { battle, give, play, place, choose, href, trainerAt, logged } from './fixtures.js';
import { targetKeys, targetPrompt, describeTargets, trainerShield, cardMarkup } from '../src/ui/render.js';
import { attackBlock } from '../src/engine/game.js';
import { viewFor } from '../src/engine/view.js';

// --- Pelipper's On Summon: a card in your hand gains Retain -------------------------------

{
  let s = battle({ player: 'water', ai: 'fire', passives: false });
  const surf = give(s, 'player', 'surf');
  const dive = give(s, 'player', 'dive');
  s = play(s, 'player', 'pelipper', 0, 0);
  assert.equal(s.pending?.kind, 'target', 'Pelipper asks for a target');
  assert.equal(s.pending.op, 'retain');
  // The options are exactly the cards in hand.
  assert.deepEqual(s.pending.options.map((r) => [r.kind, r.uid]).sort(), [['hand', dive], ['hand', surf]].sort());
  assert.deepEqual([...targetKeys(s, {}).keys].sort(), [`player:H${dive}`, `player:H${surf}`].sort(), 'the hand cards light up');
  const prompt = targetPrompt(viewFor(s, 'player'), {});   // the screen is given the player's view
  assert.equal(prompt.text, "Your Pelipper's On Summon: choose a card in your hand");
  assert.equal(prompt.cancel, false, 'an effect already resolving can not be cancelled');
  assert.equal(trainerShield(s, 0, {}), null, 'no shields on enemy Trainers when choosing a card in hand');
  // Choosing one gives it Retain, and play goes on.
  s = choose(s, { target: href('player', surf) });
  assert.equal(s.pending, null);
  assert.ok(s.players.player.hand.find((c) => c.uid === surf).retainGranted, 'the chosen card has Retain');
  assert.ok(!s.players.player.hand.find((c) => c.uid === dive).retainGranted, 'the other does not');
  assert.equal(s.turn, 'ai', "then it is the opponent's turn");
}
{
  // An empty hand: nothing happens and play continues.
  let s = battle({ player: 'water', ai: 'fire', passives: false });
  s = play(s, 'player', 'pelipper', 0, 0);
  assert.equal(s.pending, null);
  assert.equal(targetPrompt(s, {}), null, 'no prompt bar');
  assert.ok(logged(s, 'nothing happens'));
  assert.equal(s.turn, 'ai');
}

// --- Strategy Cards and attacks: the prompt says exactly what to pick -----------------------

{
  const s = battle();
  place(s, 'ai', 1, 0, 'horsea');
  const ember = give(s, 'player', 'ember');
  const sel = { strategy: ember };
  const prompt = targetPrompt(s, sel);
  assert.equal(prompt.text, 'Ember: choose an enemy Pokémon or Trainer');
  assert.equal(prompt.cancel, true, 'your own selection can be cancelled');
  const keys = targetKeys(s, sel).keys;
  assert.ok(keys.has('ai:P10') && keys.has('ai:T0'));
  assert.equal(targetPrompt(s, {}), null, 'nothing chosen: no prompt bar');
}
assert.equal(describeTargets([{ kind: 'pokemon', owner: 'player' }, { kind: 'trainer', owner: 'player' }]), 'one of your Pokémon or Trainers');
assert.equal(describeTargets([{ kind: 'zone', owner: 'player' }]), 'one of your Zones');
assert.equal(describeTargets([{ kind: 'pokemon', owner: 'ai' }, { kind: 'hand', owner: 'player' }]), 'an enemy Pokémon, or a card in your hand');

// --- A guarded Trainer: a shield and the reason, not a defeated look ------------------------

{
  const s = battle();
  place(s, 'player', 0, 0, 'growlithe');                // Physical
  place(s, 'ai', 1, 0, 'quagsire');                     // Defence: guards against Physical attacks
  const sel = { attacker: { zone: 0, space: 0 } };
  assert.equal(targetPrompt(s, sel).text, 'Growlithe attacks: choose an enemy Pokémon');
  assert.deepEqual([...targetKeys(s, sel).keys], ['ai:P10']);
  assert.deepEqual(attackBlock(s, 'player', sel.attacker, { kind: 'trainer', zone: 0 }), { defeated: false, guards: ['Quagsire'] });
  assert.equal(trainerShield(s, 0, sel), 'Guarded by Quagsire');
  assert.equal(attackBlock(s, 'player', sel.attacker, { kind: 'pokemon', zone: 1, space: 0 }), null, 'the guard itself can be hit');
  assert.equal(trainerShield(s, 0, {}), null, 'no shields when nothing is being chosen');
  // A defeated Trainer gets no shield: it is out, and drawn as defeated.
  trainerAt(s, 'ai', 0).strength = 0;
  assert.equal(trainerShield(s, 0, sel), null);
  assert.equal(attackBlock(s, 'player', sel.attacker, { kind: 'trainer', zone: 0 }).defeated, true);
}
{
  // A choice that can only reach Pokémon says so for the Trainers.
  const s = battle();
  place(s, 'ai', 1, 0, 'horsea');
  const sel = { attacker: null, power: null };
  s.pending = { who: 'player', kind: 'target', label: 'Test', options: [{ kind: 'pokemon', owner: 'ai', zone: 1, space: 0 }] };
  assert.match(trainerShield(s, 0, sel), /^Test can't target /);
}

// A defeated Trainer shows Strength 0, however far below 0 the damage went.
{
  const s = battle();
  const t = trainerAt(s, 'ai', 0);
  const html = cardMarkup({ ...t, strength: -3 }, 'board');
  assert.ok(html.includes('Defeated: Strength 0'));
  assert.ok(!html.includes('>-3<'));
}

console.log('All targeting tests passed.');
