// G1: rules and economy (docs/v4-gameplay-update.md section 2). Run: node v4/tests/g1.test.js
// Pass (2.1), React (2.2), the cost curve (2.3), Recognition (2.4), PokéDollars (2.5), the one-Item
// PokéMart with Stock and Sold out (2.6), and the Objective point moment's beat (2.7).
import assert from 'node:assert/strict';
import { RULES, costFor } from '../src/rules.js';
import { createGame, applyAction, legalActions, passReason, passBlockers, passSpends } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, TRAINERS, ITEMS } from '../src/engine/cards.js';
import { EVENT_BEATS } from '../src/ui/vfx/library.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
// G2: board Pokémon are staged plain (no trigger or keywords): these tests check rules; tests/g2.test.js checks the Pokémon.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, keywords: {}, trigger: null, uid: `m-${n++}`, currentStrength: c.strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id, round = 1) => ({ ...cardAtRound(id, round), uid: `c-${n++}` });
const battle = (turn = 'player', energy = 6) => {
  let s = createGame(5);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = energy; p.exertMax = 0; p.exhaust = []; p.trainers = []; p.dollars = 0; p.recognition = 0; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id) => { const c = card(id); s.players[who].hand.push(c); return c.uid; };
const types = (s) => s.events.map((e) => e.type);

// --- A. Pass (2.1) --------------------------------------------------------------------------------------
{
  // Ponyta (Swift) against a Steady Magikarp: Ready, unmatched, with a target → no Pass.
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('magikarp', 3);
  ok(!legalActions(s, 'player').includes('pass'), 'Pass is illegal with an unmatched Ready Pokémon');
  assert.throws(() => applyAction(s, { type: 'pass', who: 'player' }), /cannot pass/);
  eq(passReason(s, 'player'), 'Ponyta is Ready and faster than anything the Opponent has: attack first', 'the reason names it');
  // Also the Pass that would end the Battle Phase (the loophole this closes).
  s.passesInARow = 1;
  ok(!legalActions(s, 'player').includes('pass'), 'not even when the Opponent has just passed');
  s.passesInARow = 0;
  // After it attacks it's Spent: Pass is legal again.
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  s.turn = 'player';
  ok(legalActions(s, 'player').includes('pass'), 'legal once it has attacked');
  // Matched Speeds (a Swift on both sides): legal, and nothing becomes Spent.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('ponyta', 2);
  ok(legalActions(s, 'player').includes('pass'), 'Pass is legal when the Speeds are matched');
  eq(passBlockers(s, 'player'), [], 'no blockers');
  s = applyAction(s, { type: 'pass', who: 'player' });
  ok(!s.players.player.row[0].spent, 'matched: it stays Active');
  // No legal target (staged: with today's guards a guard is always itself a target): Pass is allowed
  // and the unmatched Pokémon become Spent, as before.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('magikarp', 3);
  eq(passReason(s, 'player', () => []), null, 'no target: Pass allowed');
  eq(passSpends(s, 'player'), [0], 'and it becomes Spent');
  // The AI never passes illegally (it plays through legalActions; applyAction would throw).
  const { chooseAction } = await import('../src/ai/ai.js');
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('magikarp', 3);
  ok(chooseAction(s, 'player', { rng: () => 0.5 }).type !== 'pass', 'the AI attacks first');
}

// --- B. React (2.2) -------------------------------------------------------------------------------------
{
  // An attack opens a window (the Opponent holds Ember).
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('magikarp', 3, { spent: true });
  give(s, 'ai', 'ember');
  let t = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(t.reactWindow?.pending.type, 'attack', 'an attack opens a React window');
  // An Adapt opens one.
  t = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'ember'), mode: 'adapt', target: { who: 'ai', space: 0 } });
  eq(t.reactWindow?.pending.type, 'command', 'an Adapt opens a React window when played');
  // A summon doesn't.
  s = battle();
  give(s, 'ai', 'ember');
  s.players.ai.row[0] = mon('magikarp', 3, { spent: true });
  t = applyAction(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'ponyta'), space: 2 });
  eq(t.reactWindow, null, 'no window for a summon');
  ok(t.players.player.row[2]?.name === 'Ponyta', 'it arrives at once');
  // A Trainer Command doesn't.
  s = battle();
  give(s, 'ai', 'ember');
  s.players.ai.row[0] = mon('magikarp', 3, { spent: true });
  const misty = card('misty');
  s.players.player.hand.push(misty);
  t = applyAction(s, { type: 'trainerCommand', who: 'player', uid: misty.uid });
  eq(t.reactWindow, null, 'no window for a Trainer Command');
  // A Strat being played doesn't; resolving at the start of its owner's next turn does.
  s = battle();
  s.players.ai.row[4] = mon('squirtle', 6, { spent: true, strength: 9, currentStrength: 9 });   // Strength 9
  s.players.player.row[0] = mon('wooper', 4, { spent: true });
  give(s, 'ai', 'ember');   // (B3-1: Recover's React now answers only attacks; Ember's answers a Strat)
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'ember'), mode: 'strat', target: { who: 'ai', space: 4 } });
  eq(s.reactWindow, null, 'no window when a Strat is played face-down');
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq(s.reactWindow?.pending.type, 'strat', 'a window when it resolves at the start of the owner\'s turn');
  eq(s.reactWindow.reactor, 'ai');
  eq(s.players.ai.row[4].currentStrength, 9, 'not resolved yet');
}
{
  // The Opponent Reacts with Ember (React: 2 damage) on the player's Wooper; then the Strat resolves (5 damage).
  // (B3-1: Recover's React now heals only a Pokémon being attacked.)
  let s = battle();
  s.players.ai.row[4] = mon('squirtle', 6, { spent: true, strength: 9, currentStrength: 9 });
  s.players.player.row[0] = mon('wooper', 4, { spent: true });
  const woo = s.players.player.row[0].currentStrength;
  give(s, 'ai', 'ember');
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'ember'), mode: 'strat', target: { who: 'ai', space: 4 } });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'react', who: 'ai', uid: s.players.ai.hand[0].uid, target: { who: 'player', space: 0 } });
  eq(s.players.player.row[0].currentStrength, woo - 2, 'the React resolves first');
  eq(s.players.ai.row[4].currentStrength, 9 - 5, 'then the Strat');
  eq(s.turn, 'player', 'the owner\'s turn goes on');
  // A React that removes the Strat's target makes it fizzle.
  s = battle();
  s.players.player.row[1] = mon('ponyta', 1, { spent: true, currentStrength: 1 });
  give(s, 'ai', 'ember');
  // (B3-1: Recover's Strat now heals each of your Pokémon; Flame Charge's has one target.)
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'flame-charge'), mode: 'strat', target: { who: 'player', space: 1 } });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq(s.reactWindow?.pending.type, 'strat');
  s = applyAction(s, { type: 'react', who: 'ai', uid: s.players.ai.hand[0].uid, target: { who: 'player', space: 1 } });
  eq(s.players.player.row[1], null, 'the React defeated its target');
  ok(types(s).includes('fizzled'), 'the Strat fizzles');
}
{
  // At Supper: the window opens before dominance, and Supper goes on once it closes.
  let s = battle();
  s.players.player.row[0] = mon('squirtle', 5, { spent: true });
  s.players.ai.row[4] = mon('squirtle', 6, { spent: true, strength: 9, currentStrength: 9 });
  const loc = card('mt-ember');
  s.players.player.hand.push(loc);
  s = applyAction(s, { type: 'placeLocation', who: 'player', uid: loc.uid, start: 0 });
  s.players.ai.hand = [card('ember')];
  s.strats.push({ uid: 'strat-x', owner: 'player', card: card('ember'), target: { who: 'ai', space: 4, uid: s.players.ai.row[4].uid }, targetName: 'Blastoise', playedRound: s.round });
  s.turn = 'ai';
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq(s.reactWindow?.pending.type, 'strat', 'a window at Supper');
  eq(s.reactWindow.pending.at, 'supper');
  ok(types(s).includes('supper') && !types(s).includes('dominance'), 'before dominance');
  eq(s.round, 1, 'Supper waits');
  ok(legalActions(s, 'ai').includes('decline') && !legalActions(s, 'player').length, 'only the reactor acts');
  s = applyAction(s, { type: 'decline', who: 'ai' });
  eq(s.players.ai.row[4].currentStrength, 9 - 5, 'the Strat resolved');
  ok(types(s).includes('dominance'), 'then dominance');
  eq(s.round, 2, 'then the next Round');
}

// --- C. Costs (2.3) --------------------------------------------------------------------------------------
eq([1, 2, 3, 4, 5, 6, 7, 8].map((l) => costFor(l)), [1, 1, 2, 2, 3, 3, 4, 4], 'cost = half the Level, rounded up');
eq(costFor(8, true), 5, 'B3-1: a Legendary costs 5');
for (const t of TRAINERS) eq(t.partner.cost, 4, `${t.partner.name} stays cost 4`);
eq(pokemonAt('ponyta', 1).cost, 1, 'nothing is free');

// --- D, E. Recognition and PokéDollars (2.4, 2.5) -----------------------------------------------------------
eq([RULES.perDominance, RULES.perFavour, RULES.perTournamentDominance, RULES.perDamageToPlayer, RULES.perDefeat, RULES.perObjective], [3, 3, 5, 1, 2, 2]);
{
  // Dominating a Location: +3 at Supper.
  let s = battle();
  s.players.player.row[0] = mon('squirtle', 5, { spent: true });
  const loc = card('mt-ember');
  s.players.player.hand.push(loc);
  s = applyAction(s, { type: 'placeLocation', who: 'player', uid: loc.uid, start: 0 });
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq(s.players.player.recognition, 3, 'dominating a Location: +3');
  // A Favour: +3.
  s = battle();
  s.players.player.row[0] = mon('squirtle', 4, { spent: true });
  const joy = give(s, 'player', 'nurse-joy');
  const sq = give(s, 'player', 'squirtle');
  s = applyAction(s, { type: 'supporter', who: 'player', uid: joy, release: [sq] });
  eq(s.players.player.recognition, 3, 'a Favour: +3');
  // The Tournament: +5, ×1.5 → 8.
  s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('squirtle', 5, { spent: true });
  s.passesInARow = 1;
  s.turn = 'ai';
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq(s.players.player.recognition, 8, 'Tournament dominance: +5 → 8 with its passive');
  // A defeat: +$1 flat (a Level 7 Charizard too), a Partner too; +2 Recognition as before.
  s = battle();
  s.players.player.row[0] = mon('growlithe', 7);
  s.players.ai.row[0] = mon('charmander', 7, { currentStrength: 1, spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.dollars, 1, 'a defeat: +$1 (not its cost of 4)');
  eq(s.players.player.recognition, RULES.perDefeat);
  s = battle();
  const nine = TRAINERS.find((t) => t.partner.name === 'Ninetales').partner;
  s.players.player.row[0] = mon('growlithe', 7);
  s.players.ai.row[0] = { ...structuredClone(nine), uid: 'p9', currentStrength: 1, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, trainer: 'Blaine' };
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.dollars, 1, 'a defeated Partner: +$1');
  // Breakfast: +$1, unchanged.
  eq(RULES.dollarsPerRound, 1);
}

// --- F. The PokéMart (2.6) -------------------------------------------------------------------------------
// B3-1: the prices come from cards.json; Stock follows the price ($1 → 8, $2 → 6, $3 → 4, $4 → 3).
for (const c of ITEMS) eq(c.stock, { 1: 8, 2: 6, 3: 4, 4: 3 }[c.price], `${c.name}: Stock by its price`);
{
  // Stock counts down one per turn (either player), React decisions aren't turns; replaced at 0.
  let s = battle();
  const first = s.mart.onSale[0];
  eq(s.mart.onSale.length, 1, 'one slot');
  const full = first.stock;
  eq(s.mart.stock, full);
  s = applyAction(s, { type: 'retain', who: 'player', uid: give(s, 'player', 'ponyta') });
  eq(s.mart.stock, full - 1, 'a turn uses 1 Stock');
  // A React decision isn't a turn: an attack Reacted to (or let happen) uses 1 Stock in all.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('magikarp', 3, { spent: true });
  give(s, 'ai', 'ember');
  const before = s.mart.stock;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.mart.stock, before, 'the window is open: nothing yet');
  s = applyAction(s, { type: 'decline', who: 'ai' });
  eq(s.mart.stock, before - 1, 'one turn, one Stock');
  // At 0 the Item goes back to the pool and a different random Item replaces it, with full Stock.
  s = battle();
  const was = s.mart.onSale[0];
  s.mart.stock = 1;
  s = applyAction(s, { type: 'retain', who: 'player', uid: give(s, 'player', 'ponyta') });
  ok(s.mart.onSale[0] && s.mart.onSale[0].id !== was.id, 'replaced by a different Item');
  eq(s.mart.stock, s.mart.onSale[0].stock, 'with its full Stock');
  ok(s.mart.pool.some((c) => c.id === was.id), 'the old one is back in the pool');
  eq(s.mart.pool.length + 1, ITEMS.length, 'one copy of each Item in all');
  ok(types(s).includes('martRefreshed'), 'an event for the new Item');
  // Stock carries across Breakfast (no refresh): the Pass that ends the Battle Phase uses 1.
  s = battle();
  const kept = s.mart.onSale[0].id;
  s.mart.stock = 3;
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq(s.round, 2, 'a new Round');
  eq([s.mart.onSale[0].id, s.mart.stock], [kept, 2], 'the same Item with its Stock carried over');
  // Sold out until the buyer has finished their next turn; nothing counts down meanwhile.
  s = battle();
  s.players.player.dollars = 5;
  s.players.player.row[0] = mon('ponyta', 2, { spent: true });
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 0, then: 'store' });
  eq(s.mart.onSale[0], null, 'Sold out');
  eq(s.mart.soldOut?.by, 'player');
  s = applyAction(s, { type: 'retain', who: 'ai', uid: give(s, 'ai', 'ponyta') });
  eq(s.mart.onSale[0], null, 'still Sold out after the Opponent\'s turn');
  s = applyAction(s, { type: 'retain', who: 'player', uid: give(s, 'player', 'ponyta') });
  ok(s.mart.onSale[0], 'restocked once the buyer\'s next turn ended');
  eq(s.mart.stock, s.mart.onSale[0].stock, 'with full Stock');
  // Across a Supper: Sold out lasts until the buyer's next turn, even into the next Round.
  s = battle();
  s.players.player.dollars = 5;
  s.players.player.row[0] = mon('ponyta', 2, { spent: true });
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 0, then: 'store' });
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'ai' });
  eq([s.round, s.mart.onSale[0]], [2, null], 'still Sold out in the next Round');
  s.turn = 'player';
  s = applyAction(s, { type: 'retain', who: 'player', uid: give(s, 'player', 'ponyta') });
  ok(s.mart.onSale[0], 'restocked after the buyer\'s next turn');
}

// --- G. The Objective point moment ----------------------------------------------------------------------
eq(EVENT_BEATS.objectiveProgress?.beat, 'objective', 'objectiveProgress has its own beat');

console.log(`g1: ${checks} checks passed`);
