// Checks the effect system itself, using the reference cards from
// docs/rules.md written as data. These cards aren't playable yet; this test
// shows the engine already handles them.
// Run with: node tests/effects.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, maxStrengthOf, PLAYERS } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { resolveEffects, candidates, canResolve, summon, settle, run } from '../src/engine/effects.js';
import { inPlay, damage } from '../src/engine/board.js';

// Reference Strategy Cards, as they will appear in cardData.js.
const QUICKDRAW = { cost: 1, effects: [{ op: 'draw', amount: 2 }] };
const HYPERVOICE = { cost: 3, effects: [{ op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent' } }] };
const RECOVER = { cost: 3, effects: [{ op: 'heal', amount: 5, target: { mode: 'targeted', side: 'any', kinds: ['pokemon', 'trainer'] } }] };

function battle() {
  let s = createGame(3);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) for (const t of s.players[who].trainers) t.passive = null;  // effects alone
  return s;
}
let n = 0;
function place(s, who, zone, space, id, extra = {}) {
  const card = { ...inPlay({ ...cardDefinition(id), ability: null, uid: `t${n++}` }, { spent: true }), ...extra };
  s.players[who].zones[zone].pokemon[space] = card;
  return card;
}
const strategyCtx = (who, target) => ({ who, source: { kind: 'strategy', owner: who, name: 'Test' }, label: 'Test', target });
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
const tref = (owner, zone) => ({ kind: 'trainer', owner, zone });

// Quickdraw: draw 2.
{
  const s = battle();
  const hand = s.players.player.hand.length;
  resolveEffects(s, strategyCtx('player'), QUICKDRAW.effects);
  assert.equal(s.players.player.hand.length, hand + 2);
}

// Hypervoice: 2 damage to every opponent Pokémon, Agility ones included; defeats release.
{
  const s = battle();
  place(s, 'ai', 0, 0, 'growlithe');                        // 3 → 1
  place(s, 'ai', 1, 1, 'shinx', { innatePower: 'Agility' }); // 2 → 0: defeated
  place(s, 'player', 0, 0, 'growlithe');                    // friendly: untouched
  resolveEffects(s, strategyCtx('player'), HYPERVOICE.effects);
  assert.equal(s.players.ai.zones[0].pokemon[0].currentStrength, 1);
  assert.equal(s.players.ai.zones[1].pokemon[1], null, 'area effects still hit Agility');
  assert.equal(s.players.ai.released.at(-1).name, 'Shinx');
  assert.equal(s.players.player.zones[0].pokemon[0].currentStrength, 3);
}

// Recover: any Pokémon or Trainer, never above maximum; Agility can't be chosen by a Strategy Card.
{
  const s = battle();
  const hurt = place(s, 'player', 0, 0, 'lairon');       // 8
  hurt.currentStrength = 2;
  place(s, 'ai', 0, 0, 'horsea', { innatePower: 'Agility' });
  s.players.player.zones[1].trainer.strength = 12;
  s.players.ai.zones[2].trainer.strength = 0;              // removed: can't be chosen
  const options = candidates(s, strategyCtx('player'), RECOVER.effects[0].target);
  assert.ok(options.some((r) => r.kind === 'pokemon' && r.owner === 'player'));
  assert.ok(!options.some((r) => r.kind === 'pokemon' && r.owner === 'ai'), 'Agility');
  assert.ok(options.some((r) => r.kind === 'trainer' && r.owner === 'ai' && r.zone === 0));
  assert.ok(!options.some((r) => r.kind === 'trainer' && r.owner === 'ai' && r.zone === 2), 'removed Trainer');
  resolveEffects(s, strategyCtx('player', pref('player', 0, 0)), RECOVER.effects);
  assert.equal(hurt.currentStrength, 7);
  resolveEffects(s, strategyCtx('player', pref('player', 0, 0)), RECOVER.effects);
  assert.equal(hurt.currentStrength, 8, 'capped at maximum Strength');
  resolveEffects(s, strategyCtx('player', tref('player', 1)), RECOVER.effects);
  assert.equal(s.players.player.zones[1].trainer.strength, 15, "capped at the Trainer's starting Strength");
  assert.throws(() => resolveEffects(s, strategyCtx('player', pref('ai', 0, 0)), RECOVER.effects), /legal target/);
}

// Healing respects buffed maximum Strength.
{
  const s = battle();
  const c = place(s, 'player', 0, 0, 'geodude', { strengthBonus: 2 });   // 5 + 2 = 7
  c.currentStrength = 1;
  resolveEffects(s, strategyCtx('player', pref('player', 0, 0)), [{ op: 'heal', amount: 10, target: RECOVER.effects[0].target }]);
  assert.equal(c.currentStrength, 7);
  assert.equal(maxStrengthOf(c), 7);
}

// Strength-Type buffs: targeted ones only fit that Strength-Type; area ones skip others.
{
  const s = battle();
  const hp = place(s, 'player', 0, 0, 'growlithe');         // Hitpoints
  const def = place(s, 'player', 0, 1, 'geodude');         // Defence
  const buffDef = { op: 'buff', strength: 2, strengthType: 'Defence', target: { mode: 'targeted', side: 'friendly' } };
  assert.deepEqual(candidates(s, strategyCtx('player'), buffDef.target, buffDef), [pref('player', 0, 1)]);
  resolveEffects(s, strategyCtx('player'), [{ ...buffDef, target: { mode: 'area', side: 'friendly' } }]);
  assert.equal(maxStrengthOf(def), 7);
  assert.equal(maxStrengthOf(hp), 3, 'area version skips other Strength-Types');
  assert.equal(def.currentStrength, 7, 'a Strength buff raises current Strength too');
}

// A targeted effect with no legal target can't be used.
{
  const s = battle();
  assert.equal(canResolve(s, strategyCtx('player'), RECOVER.effects), true, 'Trainers count');
  for (const who of PLAYERS) for (const t of s.players[who].trainers) t.strength = 0;
  assert.equal(canResolve(s, strategyCtx('player'), RECOVER.effects), false);
}

// Quick Attack: summoned Active instead of Spent.
{
  const s = battle();
  const quick = { ...cardDefinition('growlithe'), uid: 'qa', innatePower: 'Quick Attack' };
  const slow = { ...cardDefinition('growlithe'), uid: 'sl' };
  s.players.player.hand.push(quick, slow);
  summon(s, 'player', quick, 0, 0);
  summon(s, 'player', slow, 0, 1);
  assert.equal(s.players.player.zones[0].pokemon[0].spent, false);
  assert.equal(s.players.player.zones[0].pokemon[1].spent, true);
}

// Pokémon abilities: triggers with { self: true } fire every time.
{
  const s = battle();
  place(s, 'player', 0, 0, 'growlithe', {
    ability: { on: 'defeated', match: { self: true }, effects: [{ op: 'draw', amount: 1 }] },
  });
  const hand = s.players.player.hand.length;
  damage(s, pref('player', 0, 0), 10);
  settle(s);   // queues On Defeated
  run(s);
  assert.equal(s.players.player.hand.length, hand + 1, 'On Defeated fired after it left the arena');

  let t = battle();
  t.turn = 'player';
  place(t, 'player', 0, 0, 'growlithe', {
    spent: false,
    ability: { on: 'attack', match: { self: true }, effects: [{ op: 'damage', amount: 1, target: { mode: 'area', side: 'opponent' } }] },
  });
  place(t, 'ai', 1, 0, 'lairon');
  t = applyAction(t, { type: 'command', who: 'player', from: { zone: 0, space: 0 }, target: { kind: 'pokemon', zone: 1, space: 0 } });
  assert.equal(t.players.ai.zones[1].pokemon[0].currentStrength, 8 - 2 - 1, 'attack damage plus On Attack');
}

console.log('All effect tests passed.');
