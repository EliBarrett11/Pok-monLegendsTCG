// Checks that the AI weighs the new mechanics: Burn on Trainers as damage
// over time, Overrun making defeats worth more, and Regenerate making a target
// tougher. Test-only cards. Run with: node tests/ai-mechanics.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { refreshAuras, resolveEffects } from '../src/engine/effects.js';
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

// Search and Return: the strongest card it could afford next Round.
{
  const s = match();
  s.round = 3;   // next Round: 4 Base Energy
  const p = s.players.ai;
  const big = mon('dragonite');   // cost 6: not next Round
  const good = mon('lairon');     // cost 4: the best it can afford next Round
  const small = mon('shinx');     // cost 1
  p.discard.push(big, good, small);
  resolveEffects(s, { who: 'ai', source: { kind: 'strategy', owner: 'ai', uid: 'x', name: 'Dive' }, label: 'Dive' }, [{ op: 'return', filter: { cardType: 'Pokémon' } }]);
  assert.deepEqual(choose(s).uids, [good.uid]);
}
// Retain: a card it can't afford now but can next Round.
{
  const s = match();
  s.round = 3;
  const p = s.players.ai;
  p.baseEnergy = 2;
  const now = mon('shinx');       // cost 1: affordable now
  const later = mon('lairon');    // cost 4: not now, but next Round
  const never = mon('dragonite'); // cost 6
  p.hand.push(now, later, never);
  resolveEffects(s, { who: 'ai', source: { kind: 'pokemon', owner: 'ai', zone: 0, space: 0, uid: 'x', name: 'Pelipper' }, label: 'Pelipper' },
    [{ op: 'retain', target: { mode: 'targeted', side: 'friendly', kinds: ['handCard'] } }]);
  assert.equal(choose(s).target.uid, later.uid);
}
// Free summon: the strongest Pokémon that fits.
{
  const s = match();
  const p = s.players.ai;
  const a = mon('shinx');
  const b = mon('pidgey');   // cost 2
  p.hand.push(a, b);
  resolveEffects(s, { who: 'ai', source: { kind: 'supporter', owner: 'ai', uid: 'x', name: 'Swimmer' }, label: 'Swimmer' }, [{ op: 'freeSummon', filter: { energyCost: { max: 2 } } }]);
  assert.deepEqual(choose(s).uids, [b.uid]);
}

console.log('All AI mechanics tests passed.');
