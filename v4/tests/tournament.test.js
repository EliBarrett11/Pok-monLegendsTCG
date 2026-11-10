// v4 F5 (the Pokémon League Tournament, the final deck, winning): focused rule tests, no match
// simulations. Run: node v4/tests/tournament.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import {
  createGame, applyAction, legalActions, whyNot, locationStarts, locationOf, weatherTotals, activeBrackets, gainRecognition,
  tournamentDominant, damageOf, playReason, passBlockers } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, DEMO_DECK, PATHS, LOCATIONS, COMMANDS, SUPPORTERS, ITEMS, TRAINERS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/ai.js';

let n = 0;
// G2: board Pokémon are staged plain (no trigger or keywords): these tests check rules; tests/g2.test.js checks the Pokémon.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, keywords: {}, trigger: null, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id) => ({ ...cardAtRound(id, 1), uid: `c-${n++}` });
// UX1: Trainer Objectives are active from setup; these checks leave them out unless `trainers` is true.
const battle = (turn = 'player', { trainers = false } = {}) => {
  let s = createGame(21);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; if (!trainers) p.trainers = []; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id) => { const c = card(id); s.players[who].hand.push(c); return c.uid; };
// G1: a Ready Pokémon with unmatched Speed blocks Pass; these tests only move time on, so it's made Spent.
const pass = (s) => { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; return applyAction(s, { type: 'pass', who: s.turn }); };
// End the Round (two Passes) with empty hands, so nothing else happens.
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') { s.players.player.hand = []; s.players.ai.hand = []; s = pass(s); } return s; };
const place = (s, who, id, start) => { s.players[who].hand.push(card(id)); s.turn = who; s.passesInARow = 0; return applyAction(s, { type: 'placeLocation', who, uid: s.players[who].hand.at(-1).uid, start }); };

// --- The final foundation deck (section 9): 40 cards, the same for both players, every feature --------------------------------
{
  assert.equal(DEMO_DECK.length, 35, 'G2: the temporary deck (15 new Pokémon + the 20 other cards) until G3');
  const s = createGame(3);
  const ids = (w) => [...s.players[w].hand, ...s.players[w].drawPile].map((c) => c.id).sort();
  assert.deepEqual(ids('player'), [...DEMO_DECK].sort());
  assert.deepEqual(ids('ai'), [...DEMO_DECK].sort(), 'both players: exactly the same list');
  const has = (list) => list.filter((c) => DEMO_DECK.includes(c.id));
  for (const series of ['Light', 'Mid', 'Heavy']) assert.ok(has(PATHS).some((p) => p.series === series), `${series} development`);
  assert.ok(has(PATHS).some((p) => p.forms.length === 3), 'Pokémon with several evolution Levels');
  assert.equal(has(LOCATIONS).length, 4);
  assert.equal(new Set(has(LOCATIONS).map((l) => l.weather.type)).size, 2, 'both Weather types');
  assert.equal(has(COMMANDS).length, 4, 'Command Cards (Adapt, React, Strat)');
  assert.equal(has(SUPPORTERS).length, 3, 'Supporters with Favours');
  assert.equal(has(ITEMS).length, 3, 'Items in the deck (the others in the PokéMart)');
  assert.ok(has(ITEMS).some((i) => i.itemType === 'Held') && has(ITEMS).some((i) => i.itemType === 'Consumed'));
  assert.equal(has(TRAINERS).length, 2, 'Trainers (Objective or Command)');
}

// --- The trigger: Breakfast of Round 10 ---------------------------------------------------------------------------------------
{
  let s = battle();
  while (s.round < 9) s = nextRound(s);
  assert.equal(s.round, 9);
  assert.equal(s.tournament, null, 'not in Round 9');
  s = nextRound(s);
  assert.equal(s.round, 10);
  assert.deepEqual(s.tournament, { startedRound: 10, reason: `Round ${RULES.tournamentRound}` });
  assert.ok(s.events.some((e) => e.type === 'tournament'));
}

// --- The trigger: the first Breakfast where either player has 70+ Recognition (whichever comes first) ------------------------------------
{
  let s = battle();
  s.players.ai.recognition = 69;
  s = nextRound(s);
  assert.equal(s.tournament, null, '69 is not enough');
  s.players.ai.recognition = 70;
  assert.equal(s.tournament, null, 'not mid-Round: only at Breakfast');
  s = nextRound(s);
  assert.equal(s.tournament?.startedRound, 3);
  assert.equal(s.tournament.reason, `${RULES.tournamentRecognition}+ Recognition`);
}

// --- The transition: Locations removed (cards to their owners' Discard Piles); Pokémon stay; passives and Weather end; no new Locations ----------
{
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[5] = mon('squirtle', 4);
  s = place(s, 'player', 'cerulean-cape', 0);   // +1 Strength, 1 Rain
  s = place(s, 'player', 'mt-ember', 2);        // 2 Sun: Physical +1 damage
  s = place(s, 'ai', 'route-119', 5);          // 2 Rain → Rain 3: Rain 2 bracket (heal 1 at Breakfast)
  assert.equal(weatherTotals(s).Rain, 3);
  assert.ok(activeBrackets(s).length >= 2);
  const base = pokemonAt('ponyta', 2);
  assert.equal(s.players.player.row[0].strength, base.strength + 1);
  assert.equal(damageOf(s, s.players.player.row[0]), s.players.player.row[0].attack + 1, 'Sun 2: +1 Physical damage');
  s.players.player.recognition = 70;
  s.players.ai.row[5].currentStrength = 1;
  s = nextRound(s);
  assert.ok(s.tournament);
  assert.deepEqual(s.locations, [], 'every placed Location is removed');
  assert.ok(s.players.player.discard.some((c) => c.id === 'cerulean-cape') && s.players.player.discard.some((c) => c.id === 'mt-ember'), 'to their owners\' Discard Piles');
  assert.ok(s.players.ai.discard.some((c) => c.id === 'route-119'));
  assert.equal(s.players.player.row[0].name, 'Ponyta', 'Pokémon stay where they are');
  assert.equal(s.players.ai.row[5].name, 'Wartortle');
  assert.equal(s.players.player.row[0].strength, base.strength, 'the Location passive no longer applies');
  assert.deepEqual(weatherTotals(s), { Rain: 0, Sun: 0 });
  assert.equal(activeBrackets(s).length, 0, 'Weather no longer applies');
  assert.equal(s.players.ai.row[5].currentStrength, 1, 'no Rain heal at this Breakfast (the Tournament came first)');
  assert.equal(damageOf(s, s.players.player.row[0]), s.players.player.row[0].attack);
  for (let i = 0; i < 9; i++) assert.equal(locationOf(s, i), 'tournament', 'the Tournament covers all 9 lanes');
  // No new Locations.
  s.players.player.hand = [card('lake-of-rage')];
  s.turn = 'player';
  s.passesInARow = 0;
  assert.deepEqual(locationStarts(s, s.players.player.hand[0]), []);
  assert.equal(whyNot(s, 'player', 'summon', s.players.player.hand[0]), 'No Locations during the Pokémon League Tournament');
  assert.equal(playReason(s, 'player', s.players.player.hand[0]), 'No Locations during the Pokémon League Tournament');
  assert.ok(!legalActions(s, 'player').includes('placeLocation'));
  assert.throws(() => applyAction(s, { type: 'placeLocation', who: 'player', uid: s.players.player.hand[0].uid, start: 0 }));
  // Still the Tournament later (it lasts until the match ends).
  s = nextRound(nextRound(s));
  assert.ok(s.tournament);
}

// --- The passive: all Recognition earned is increased by half, rounded up -----------------------------------------------------------
{
  let s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  gainRecognition(s, 'player', 3, 'test');
  assert.equal(s.players.player.recognition, 5, '3 → 5');
  gainRecognition(s, 'player', 1, 'test');
  assert.equal(s.players.player.recognition, 7, '1 → 2');
  gainRecognition(s, 'player', 4, 'test');
  assert.equal(s.players.player.recognition, 13, '4 → 6');
  // Every source: damage to the Player Character (4 → 6), a defeat (2 → 3).
  s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('growlithe', 4, { spent: false });   // Attack 4
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition, 6);
  s.turn = 'player';
  s.players.player.row[0].spent = false;
  s.players.ai.row[3] = mon('ponyta', 1, { currentStrength: 1 });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 3 } });
  assert.equal(s.players.player.recognition, 6 + 3);
  // Before the Tournament: unchanged.
  s = battle();
  gainRecognition(s, 'player', 3, 'test');
  assert.equal(s.players.player.recognition, 3);
}

// --- Tournament dominance at Supper: more total Strength on the battlefield: +3 (5 with the passive); ties give nothing -------------------------
{
  let s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('squirtle', 4);   // 6
  s.players.player.row[8] = mon('ponyta', 1);     // 2
  s.players.ai.row[4] = mon('squirtle', 5);       // 7
  assert.equal(tournamentDominant(s), 'player', 'across the whole battlefield: 8 against 7');
  s = nextRound(s);
  assert.equal(s.players.player.recognition, RULES.perTournamentDominance + Math.ceil(RULES.perTournamentDominance / 2));
  assert.equal(s.players.player.recognition, 8, 'G1: +5, ×1.5 → 8');
  assert.equal(s.players.ai.recognition, 0);
  // A tie: nothing.
  s.players.ai.row[5] = mon('ponyta', 1);   // 7 + 2 = 9 against 6 + 2 + heals
  s.players.player.row[0].currentStrength = 6;
  s.players.player.row[8].currentStrength = 2;
  s.players.player.row[1] = mon('ponyta', 1, { currentStrength: 1 });
  assert.equal(tournamentDominant(s), null);
  const before = [s.players.player.recognition, s.players.ai.recognition];
  s = nextRound(s);
  assert.deepEqual([s.players.player.recognition, s.players.ai.recognition], before);
  // It also counts as dominating a Location for Blaine's Objective.
  s = battle('player', { trainers: true });
  s.players.player.trainers.find((t) => t.name === 'Blaine').progress = 4;   // UX2: 5 needed; 1 short
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('squirtle', 4);
  s = nextRound(s);
  assert.ok(s.players.player.trainers.find((t) => t.name === 'Blaine').complete);
  assert.ok(s.players.player.row.some((c) => c?.name === 'Ninetales'));
}

// --- Winning at 100 Recognition during the Tournament (the only victory condition) ------------------------------------------------------
{
  let s = battle();
  s.tournament = { startedRound: 10, reason: 'test' };
  s.players.player.recognition = 96;
  s.players.player.row[0] = mon('ponyta', 2, { spent: false });   // Attack 3 → 5 with the passive
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition, 101);
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 'player');
  assert.deepEqual(legalActions(s, 'player'), []);
  assert.deepEqual(legalActions(s, 'ai'), []);
  // The Opponent can win too, e.g. through Tournament dominance at Supper.
  s = battle();
  s.tournament = { startedRound: 10, reason: 'test' };
  s.players.ai.recognition = 95;
  s.players.ai.row[0] = mon('squirtle', 4);
  s = nextRound(s);
  assert.equal(s.winner, 'ai');
  assert.equal(s.players.ai.recognition, 95 + 8, 'G1: Tournament dominance +5, ×1.5 → 8');
  // 99 is not a win.
  s = battle();
  s.players.player.recognition = 98;
  gainRecognition(s, 'player', 1, 'test');
  assert.notEqual(s.phase, 'gameOver');
}

// --- The AI plays on in the Tournament (no Location to place; it still attacks, summons…) ------------------------------------------------------
{
  const s = battle('ai');
  s.tournament = { startedRound: 10, reason: 'test' };
  s.players.ai.hand = [card('mt-ember'), { ...cardAtRound('squirtle', 3), uid: 'q' }];
  const a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.notEqual(a.type, 'placeLocation');
  assert.equal(a.type, 'summon', 'it summons to win the Tournament\'s dominance');
}

console.log('v4 tournament: the final deck, the trigger (Round 10, 70 Recognition), Locations removed, Pokémon stay, passives and Weather end, no Locations, Recognition +50%, Tournament dominance, ties, winning at 100, AI — ok');
