// v4 F3 (Command Cards and Supporters): focused rule tests, no match simulations.
// Run: node v4/tests/commands.test.js
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, actor, whyNot, playReason, passBlockers } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, COMMANDS, SUPPORTERS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/ai.js';

let n = 0;
// G2: board Pokémon are staged plain (no trigger or keywords): these tests check rules; tests/g2.test.js checks the Pokémon.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, keywords: {}, trigger: null, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id, round = 1) => ({ ...cardAtRound(id, round), uid: `c-${n++}` });
// A Battle Phase with empty hands and rows, the given player's turn, plenty of Energy.
const battle = (turn = 'player', energy = 6) => {
  let s = createGame(5);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = energy; p.exertMax = 0; p.exhaust = []; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id) => { const c = card(id); s.players[who].hand.push(c); return c.uid; };
const types = (s) => s.events.map((e) => e.type);

// --- The cards ------------------------------------------------------------------------------------------------------------
// B3-1: the cards come from docs/base-game/cards.json (tests/cardsdata.test.js checks them); here only what the rules need.
{
  const V4 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(COMMANDS.length, 12, 'B3-1: the twelve Batch 1 Moves');
  for (const c of COMMANDS) {
    assert.ok(Object.keys(c.modes).length >= 2, `${c.name}: two or three modes`);
    if (c.hasArt) assert.ok(existsSync(join(V4, '..', 'assets/cards', `${c.art}.jpg`)), `${c.name}: art`);
  }
  assert.equal(SUPPORTERS.length, 15, 'B3-1: the fifteen Batch 1 Supporters');
  for (const c of SUPPORTERS) {
    assert.ok(c.release >= 1 && c.favour, `${c.name}: a Release cost and a Favour`);
    if (c.hasArt) assert.ok(existsSync(join(V4, '..', 'assets/cards', `${c.art}.jpg`)), `${c.name}: art`);
  }
}

// --- Adapt: standard cost and effect, at once (no React possible) ----------------------------------------------------------
{
  let s = battle();
  s.players.ai.row[2] = mon('squirtle', 4);
  const str = s.players.ai.row[2].currentStrength;
  const uid = give(s, 'player', 'ember');
  s = applyAction(s, { type: 'command', who: 'player', uid, mode: 'adapt', target: { who: 'ai', space: 2 } });
  assert.equal(s.reactWindow, null, 'the Opponent has no React: no window');
  assert.equal(s.players.ai.row[2].currentStrength, str - 3, 'Ember Adapt: 3 damage');
  assert.equal(s.players.player.baseEnergy, 6 - 2, 'Adapt costs 2');
  assert.ok(s.players.player.discard.some((c) => c.id === 'ember'), 'then discarded');
  assert.equal(s.turn, 'ai', 'it is the turn\'s action');
  // Flame Charge React (B3-1): your Pokémon being attacked gets +1 Attack and +1 Strength until Supper.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2, { strength: 20, currentStrength: 20 });
  s.players.ai.row[5] = mon('squirtle', 4, { spent: false });
  give(s, 'player', 'flame-charge');
  s.turn = 'ai';
  const atk = s.players.player.row[0].attack;
  s = applyAction(s, { type: 'attack', who: 'ai', from: 5, target: { kind: 'pokemon', space: 0 } });
  s = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 0 } });
  assert.equal(s.players.player.row[0].attack, atk + 1);
  while (s.round === 1) { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; s = applyAction(s, { type: 'pass', who: s.turn }); }
  assert.equal(s.players.player.row[0].attack, atk, 'gone at Supper');
  // Surf (B3-1; Rock Slide before it): pick a Location, or a lane with no Location: 3 damage to each enemy Pokémon there.
  // No Locations here, so only lane 5's Pokémon is hit.
  s = battle();
  for (const i of [0, 4, 8]) s.players.ai.row[i] = mon('squirtle', 4);
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'surf'), mode: 'adapt', target: { who: 'ai', space: 4, lane: true } });
  for (const i of [0, 8]) assert.equal(s.players.ai.row[i].currentStrength, s.players.ai.row[i].strength);
  assert.equal(s.players.ai.row[4].currentStrength, s.players.ai.row[4].strength - 3);
}

// --- React: a window opens only with an affordable React; it resolves before the committed action ---------------------------
{
  // The player attacks; the Opponent holds Recover (React 1) and has Energy: a window opens.
  let s = battle();
  s.players.player.row[1] = mon('growlithe', 4, { spent: false });
  s.players.ai.row[3] = mon('squirtle', 4, { strength: 10, currentStrength: 10 });   // (B3-1: sturdier than its new stats)
  const target = s.players.ai.row[3];
  target.currentStrength = target.strength - 1;
  give(s, 'ai', 'recover');
  s = applyAction(s, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 3 } });
  assert.equal(s.reactWindow?.reactor, 'ai');
  assert.equal(s.reactWindow.pending.type, 'attack');
  assert.ok(s.reactWindow.pending.text.includes('Growlithe'), 'the committed action is described');
  assert.equal(actor(s), 'ai', 'the Opponent decides');
  assert.deepEqual(legalActions(s, 'player'), [], 'the attacker waits');
  assert.deepEqual(legalActions(s, 'ai').sort(), ['decline', 'react']);
  assert.equal(s.players.ai.row[3].currentStrength, target.strength - 1, 'the attack hasn\'t happened yet');
  // React: heal 2 first (up to its Strength), then the attack (4 damage).
  const uid = s.players.ai.hand[0].uid;
  const r = applyAction(s, { type: 'react', who: 'ai', uid, target: { who: 'ai', space: 3 } });
  assert.equal(r.players.ai.row[3].currentStrength, target.strength - 4);
  assert.ok(types(r).indexOf('commandResolved') < types(r).indexOf('attack'), 'React resolved before the attack');
  assert.equal(r.players.ai.baseEnergy, 6 - 1, 'React costs 1');
  assert.equal(r.turn, 'ai', 'the React used no turn: it is now the Opponent\'s turn, after the player\'s attack');
  assert.equal(r.reactWindow, null);
  // Let it happen.
  const d = applyAction(s, { type: 'decline', who: 'ai' });
  assert.equal(d.players.ai.row[3].currentStrength, target.strength - 1 - 4);
  assert.equal(d.players.ai.hand.length, 1);
  // No Energy for a React: no window.
  s.reactWindow = null;
  const s2 = battle();
  s2.players.player.row[1] = mon('growlithe', 4, { spent: false });
  s2.players.ai.row[3] = mon('squirtle', 4);
  s2.players.ai.baseEnergy = 0;
  give(s2, 'ai', 'recover');
  const n2 = applyAction(s2, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 3 } });
  assert.equal(n2.reactWindow, null, 'unaffordable React: no window');
  assert.equal(n2.players.ai.row[3].currentStrength, n2.players.ai.row[3].strength - 4);
  // Not eligible: Pass, Retain, Place Location and Strat don't open a window.
  // (B3-1: Recover's React now heals your Pokémon being attacked, so it answers only attacks; Ember's React answers
  // anything.)
  let s3 = battle();
  s3.players.ai.row[3] = mon('squirtle', 4, { strength: 10, currentStrength: 10 });
  s3.players.player.row[0] = mon('wooper', 4);
  give(s3, 'ai', 'ember');
  s3 = applyAction(s3, { type: 'command', who: 'player', uid: give(s3, 'player', 'ember'), mode: 'strat', target: { who: 'ai', space: 3 } });
  assert.equal(s3.reactWindow, null, 'a Strat is not reacted to');
  s3.turn = 'player';
  s3 = applyAction(s3, { type: 'placeLocation', who: 'player', uid: give(s3, 'player', 'mt-ember'), start: 0 });
  assert.equal(s3.reactWindow, null);
  s3 = applyAction(s3, { type: 'pass', who: 'ai' });
  // G1: the Strat resolving at the start of the player's turn can be Reacted to.
  assert.equal(s3.reactWindow?.pending.type, 'strat', 'a resolving Strat opens a React window');
  s3 = applyAction(s3, { type: 'decline', who: 'ai' });
  s3.turn = 'player';
  s3.players.player.baseEnergy = Math.max(1, s3.players.player.baseEnergy);
  s3 = applyAction(s3, { type: 'retain', who: 'player', uid: give(s3, 'player', 'ponyta') });
  assert.equal(s3.reactWindow, null);
}

// --- React makes the committed action fizzle; its cost stays paid -------------------------------------------------------------
{
  // The Opponent Reacts with Ember (2) on the attacker (2 Strength): the attack fizzles.
  let s = battle();
  s.players.player.row[1] = mon('ponyta', 1, { spent: false });
  s.players.ai.row[3] = mon('squirtle', 4);
  give(s, 'ai', 'ember');
  s = applyAction(s, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 3 } });
  s = applyAction(s, { type: 'react', who: 'ai', uid: s.players.ai.hand[0].uid, target: { who: 'player', space: 1 } });
  assert.equal(s.players.player.row[1], null, 'the attacker was defeated by the React');
  assert.equal(s.players.ai.row[3].currentStrength, s.players.ai.row[3].strength, 'the attack fizzled');
  assert.ok(types(s).includes('fizzled'));
  assert.equal(s.turn, 'ai', 'the player\'s turn was still used');
  // An Adapt fizzles when the React removes its target: Recover on your Ponyta, the Opponent's Ember defeats it.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1);
  s.players.player.row[0].currentStrength = 1;
  s.players.ai.row[5] = mon('squirtle', 4);
  give(s, 'ai', 'ember');
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'recover'), mode: 'adapt', target: { who: 'player', space: 0 } });
  assert.equal(s.reactWindow.pending.type, 'command', 'an Adapt can be reacted to');
  s = applyAction(s, { type: 'react', who: 'ai', uid: s.players.ai.hand[0].uid, target: { who: 'player', space: 0 } });
  assert.equal(s.players.player.row[0], null);
  assert.ok(types(s).includes('fizzled'), 'Recover fizzled');
  assert.equal(s.players.player.baseEnergy, 6 - 2, 'its cost is still paid');
  assert.ok(s.players.player.discard.some((c) => c.id === 'recover'));
  // G1: a summon can't be reacted to: the Pokémon arrives at once.
  s = battle();
  s.players.player.row[0] = mon('squirtle', 4);
  give(s, 'ai', 'ember');
  const p = give(s, 'player', 'ponyta');
  s = applyAction(s, { type: 'summon', who: 'player', uid: p, space: 6 });
  assert.equal(s.reactWindow, null, 'no React window for a summon');
  assert.equal(s.players.player.row[6].name, 'Ponyta', 'it arrives at once');
  assert.ok(types(s).indexOf('commandResolved') < types(s).indexOf('summoned'));
}

// --- No stack: a React can't be reacted to ------------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[1] = mon('growlithe', 4, { spent: false });
  s.players.ai.row[3] = mon('squirtle', 4);
  give(s, 'ai', 'ember');
  give(s, 'player', 'recover');   // the player could afford a React, but gets no window
  s = applyAction(s, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 3 } });
  s = applyAction(s, { type: 'react', who: 'ai', uid: s.players.ai.hand[0].uid, target: { who: 'player', space: 1 } });
  assert.equal(s.reactWindow, null);
  assert.ok(!types(s).includes('reactWindow'), 'no window for the player');
  assert.ok(types(s).includes('attack'), 'the attack resolved straight after');
  assert.equal(s.players.player.hand.length, 1);
}

// --- Strat: paid and targeted now; resolves after the opponent's next turn, or at Supper; fizzles ------------------------------------
{
  let s = battle();
  s.players.ai.row[4] = mon('squirtle', 6, { strength: 9, currentStrength: 9 });   // Strength 9
  s.players.player.row[0] = mon('wooper', 4);
  give(s, 'ai', 'ember');   // (B3-1: Ember's React answers a Strat; Recover's now answers only attacks)
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'ember'), mode: 'strat', target: { who: 'ai', space: 4 } });
  assert.equal(s.players.player.baseEnergy, 6 - 3, 'Strat costs 3, paid now');
  assert.equal(s.strats.length, 1);
  assert.equal(s.strats[0].targetName, 'Blastoise');
  assert.equal(s.players.ai.row[4].currentStrength, 9, 'not yet');
  assert.equal(s.turn, 'ai');
  s = applyAction(s, { type: 'pass', who: 'ai' });   // the opponent's next turn
  assert.equal(s.turn, 'player');
  // G1: as it resolves, the Opponent (who holds Ember) may React; it lets it happen.
  assert.equal(s.reactWindow?.pending.type, 'strat', 'a React window on the resolving Strat');
  assert.equal(s.players.ai.row[4].currentStrength, 9, 'not until the window closes');
  s = applyAction(s, { type: 'decline', who: 'ai' });
  assert.equal(s.strats.length, 0);
  assert.equal(s.players.ai.row[4].currentStrength, 9 - 5, 'resolved at the start of the player\'s next turn: 5 damage');
  assert.ok(s.players.player.discard.some((c) => c.id === 'ember'));
  // At Supper, if the Battle Phase ends first (here the player had passed before; the Opponent's Pass ends it).
  s = battle();
  s.players.ai.row[4] = mon('squirtle', 6, { strength: 9, currentStrength: 9 });
  s.strats.push({ uid: 'x', owner: 'player', card: card('ember'), target: { who: 'ai', space: 4, uid: s.players.ai.row[4].uid }, targetName: 'Blastoise', playedRound: 1 });
  s.turn = 'ai';
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'ai' });
  assert.equal(s.round, 2, 'the Battle Phase ended');
  assert.equal(s.strats.length, 0);
  assert.equal(s.players.ai.row[4].currentStrength, 9 - 5, 'resolved at Supper');
  // Fizzles if its target is gone (the cost stays paid).
  s = battle();
  s.players.ai.row[4] = mon('ponyta', 1);
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'ember'), mode: 'strat', target: { who: 'ai', space: 4 } });
  s.players.ai.row[4] = null;
  s.players.ai.row[4] = mon('ponyta', 1);   // a different Pokémon in the same space
  s = applyAction(s, { type: 'pass', who: 'ai' });
  assert.ok(types(s).includes('fizzled'));
  assert.equal(s.players.ai.row[4].currentStrength, s.players.ai.row[4].strength, 'the new Pokémon is untouched');
  assert.equal(s.players.player.baseEnergy, 6 - 3 + 0, 'still paid');
}

// --- Supporters: Release (permanent), self-Release, Favour and its Recognition, no Energy ---------------------------------------------
{
  // Nurse Joy, no Favour: Release a Ponyta (Fire): heal 3 and draw 1 (B3-1).
  let s = battle();
  s.players.player.row[0] = mon('squirtle', 4, { strength: 10, currentStrength: 1 });
  const joy = give(s, 'player', 'nurse-joy');
  const pon = give(s, 'player', 'ponyta');
  s = applyAction(s, { type: 'supporter', who: 'player', uid: joy, release: [pon] });
  assert.equal(s.players.player.row[0].currentStrength, 4, 'heal 3');
  assert.deepEqual(s.players.player.released.map((c) => c.id), ['ponyta', 'nurse-joy'], 'the Released card, then the Supporter itself');
  assert.equal(s.players.player.hand.length, 1, 'and draw 1');
  assert.equal(s.players.player.recognition, 0, 'no Favour, no Recognition');
  assert.equal(s.players.player.baseEnergy, 6, 'no Energy');
  // With the Favour (a Water Pokémon): heal 5 and +3 Recognition.
  s = battle();
  s.players.player.row[0] = mon('squirtle', 4, { strength: 10, currentStrength: 1 });
  const joy2 = give(s, 'player', 'nurse-joy');
  const sq = give(s, 'player', 'squirtle');
  s = applyAction(s, { type: 'supporter', who: 'player', uid: joy2, release: [sq] });
  assert.equal(s.players.player.row[0].currentStrength, 6, 'Favour: heal 5');
  assert.equal(s.players.player.recognition, RULES.perFavour, 'Favour: Recognition');
  assert.equal(RULES.perFavour, 3, 'G1: a Favour is +3');
  // Released cards never come back: the Discard Pile reshuffles, the Released Pile doesn't.
  const p = s.players.player;
  p.drawPile = [];
  p.discard = [card('ponyta')];
  s.turn = 'player';
  while (s.round === 1) { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; s = applyAction(s, { type: 'pass', who: s.turn }); }
  const all = [...s.players.player.hand, ...s.players.player.drawPile, ...s.players.player.discard].map((c) => c.id);
  assert.ok(!all.includes('nurse-joy') && !all.includes('squirtle'), 'never reshuffled');
  assert.equal(s.players.player.released.length, 2);
  // Professor Oak (B3-1): search for 2 Pokémon (Favour, a Location: 3).
  s = battle();
  s.players.player.drawPile = [card('ember'), card('ponyta'), card('recover'), card('squirtle'), card('growlithe')];
  const oak = give(s, 'player', 'professor-oak');
  const loc = give(s, 'player', 'mt-ember');
  s = applyAction(s, { type: 'supporter', who: 'player', uid: oak, release: [loc] });
  assert.deepEqual(s.players.player.hand.map((c) => c.id), ['ponyta', 'squirtle', 'growlithe'], 'Favour: 3 Pokémon');
  assert.equal(s.players.player.drawPile.length, 2);
  // Brock (B3-1): Release 1; +1 Strength (kept) and heal 2 (Favour, a Pokémon of Level 4+: +2 Strength).
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1);
  const base = s.players.player.row[0].strength;
  const brock = give(s, 'player', 'brock');
  s.players.player.hand.push({ ...pokemonAt('growlithe', 4), uid: 'g4' });
  s = applyAction(s, { type: 'supporter', who: 'player', uid: brock, release: ['g4'] });
  assert.equal(s.players.player.row[0].strength, base + 2);
  assert.equal(s.players.player.recognition, RULES.perFavour);
  // Wrong Release counts and the Supporter itself are refused (Crasher Wake Releases 2).
  s = battle();
  const b2 = give(s, 'player', 'crasher-wake');
  const x = give(s, 'player', 'ember');
  assert.equal(whyNot(s, 'player', 'supporter', s.players.player.hand[0]), 'Needs 2 other cards in hand to Release');
  assert.ok(!legalActions(s, 'player').includes('supporter'));
  give(s, 'player', 'recover');
  assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: b2, release: [x] }), /Release exactly 2/);
  assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: b2, release: [x, b2] }), /not the Supporter itself/);
}

// --- Unaffordable or unavailable options are refused, with a reason -----------------------------------------------------------------
{
  let s = battle('player', 1);
  s.players.ai.row[0] = mon('ponyta', 1);
  const uid = give(s, 'player', 'ember');
  const c = s.players.player.hand[0];
  assert.equal(whyNot(s, 'player', 'command', c, 'adapt'), 'Adapt needs 2 Energy · you have 1');
  assert.equal(whyNot(s, 'player', 'command', c, 'strat'), 'Strat needs 3 Energy · you have 1');
  assert.equal(playReason(s, 'player', c), 'Adapt needs 2 Energy · you have 1');
  assert.ok(!legalActions(s, 'player').includes('command'));
  assert.throws(() => applyAction(s, { type: 'command', who: 'player', uid, mode: 'adapt', target: { who: 'ai', space: 0 } }));
  assert.throws(() => applyAction(s, { type: 'react', who: 'player', uid, target: { who: 'ai', space: 0 } }), /cannot react/);
  assert.match(whyNot(s, 'player', 'react', c), /only in response/);
  s.players.player.baseEnergy = 5;
  s.players.ai.row[0] = null;
  assert.equal(whyNot(s, 'player', 'command', c, 'adapt'), 'No target: no enemy Pokémon');
  assert.throws(() => applyAction(s, { type: 'command', who: 'player', uid, mode: 'react', target: { who: 'ai', space: 0 } }));
}

// --- The AI uses all three modes (through applyAction) -------------------------------------------------------------------------------
{
  // React: the player's Ponyta (2 Strength) attacks; the AI Reacts with Ember on it.
  let s = battle();
  s.players.player.row[1] = mon('ponyta', 1, { spent: false });
  s.players.ai.row[3] = mon('squirtle', 4);
  give(s, 'ai', 'ember');
  s = applyAction(s, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 3 } });
  const r = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(r.type, 'react');
  assert.deepEqual(r.target, { who: 'player', space: 1 });
  // Adapt: Ember (3) defeats a 3-Strength Pokémon now.
  s = battle('ai', 2);
  s.players.player.row[2] = mon('growlithe', 3, { currentStrength: 3 });
  s.players.player.row[2].currentStrength = 3;
  give(s, 'ai', 'ember');
  const a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'command');
  assert.equal(a.mode, 'adapt');
  // Strat: only the Strat (5) can defeat a 5-Strength Pokémon.
  s = battle('ai', 3);
  s.players.player.row[2] = mon('growlithe', 5, { currentStrength: 5 });
  give(s, 'ai', 'ember');
  const st = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(st.type, 'command');
  assert.equal(st.mode, 'strat');
}

console.log('v4 commands: Adapt, React (window, before, fizzles, no turn, no stack), Strat (timing, Supper, fizzle), Supporters (Release, Favour), refusals, AI — ok');
