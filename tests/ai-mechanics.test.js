// Checks that the AI weighs the new mechanics: Burn on Trainers as damage
// over time, Overrun making defeats worth more, and Regenerate making a target
// tougher. Test-only cards. Run with: node tests/ai-mechanics.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { refreshAuras } from '../src/engine/effects.js';
import { inPlay } from '../src/engine/board.js';
import { chooseAction } from '../src/ai/opponent.js';

function match() {
  let s = createGame(41);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.trainers.forEach((t) => { t.passive = { text: '' }; t.powerUsedRound = s.round; });   // no Powers to muddy it
    for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'ai';
  s.turn = 'ai';
  return s;
}

let made = 0;
const mon = (base, extras = {}) => ({ ...cardDefinition(base), effectTrigger: null, effectText: null, ability: null, innatePower: null, uid: `test-${base}-${made++}`, ...extras });
function place(s, who, zone, space, card, { spent = true } = {}) {
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
}
const choose = (s) => chooseAction(s, 'ai', { rng: () => 0.5 });

// Overrun: of two equal 1-Strength Pokémon, it defeats the one whose Trainer
// can take the leftover damage.
{
  const s = match();
  place(s, 'ai', 0, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 8 }), { spent: false });
  place(s, 'player', 0, 0, mon('horsea'));
  place(s, 'player', 1, 0, mon('horsea'));
  s.players.player.zones[0].pokemon[0].currentStrength = 1;
  s.players.player.zones[1].pokemon[0].currentStrength = 1;
  s.players.player.zones[0].trainer.strength = 0;   // nothing behind the first one
  const move = choose(s);
  assert.equal(move.type, 'command');
  assert.deepEqual([move.target.kind, move.target.zone], ['pokemon', 1], 'the one with a Trainer behind it');
}

// Regenerate: of two equal Pokémon it can't defeat, it hits the one that won't
// heal it back. (Both have Defence, so its Physical attack must pick one of them.)
{
  const s = match();
  place(s, 'ai', 0, 0, mon('growlithe', { attackValue: 2 }), { spent: false });
  place(s, 'player', 0, 0, mon('lairon', { innatePower: 'Regenerate 2' }));
  place(s, 'player', 1, 0, mon('lairon'));
  const move = choose(s);
  assert.equal(move.type, 'command');
  assert.deepEqual([move.target.kind, move.target.zone], ['pokemon', 1], 'not the Regenerate one');
}

// Burn on Trainers: a "Burn 3 to an enemy Pokémon or Trainer" card goes on a Trainer, not a Pokémon.
{
  const s = match();
  place(s, 'player', 0, 0, mon('dragonite'));
  s.players.ai.hand.push({
    id: 'test-ember', name: 'Test Ember', cardType: 'Strategy', energyCost: 1, image: null, rarity: 'Common', uid: 'test-ember-1',
    effectText: 'Burn 3 to an enemy Pokémon or Trainer.',
    effects: [{ op: 'burn', amount: 3, target: { mode: 'targeted', side: 'opponent', kinds: ['pokemon', 'trainer'] } }],
  });
  const move = choose(s);
  assert.equal(move.type, 'playStrategy');
  assert.equal(move.target.kind, 'trainer');
}

console.log('All AI mechanics tests passed.');
