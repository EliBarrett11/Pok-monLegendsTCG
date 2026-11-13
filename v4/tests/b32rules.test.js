// B3-2: the rules Batch 2 needs (the B3-2 prompt section B; design bible section 4 for On Command, On Supper and Aura),
// one focused test each, on built states, through the engine's own actions. Run: node v4/tests/b32rules.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, commandTargets, hasKw, damageOf, effectiveSpeed, passBlockers, syncBonuses, legalActions } from '../src/engine/game.js';
import { pokemonAt, cardAtRound } from '../src/engine/cards.js';
import { DECKS, DECK_IDS } from '../src/engine/decks.js';
import { chooseAction } from '../src/ai/ai.js';
import { actor } from '../src/engine/game.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
// Staged Pokémon: no trigger or keywords unless given (`real: true` keeps the card's own).
const mon = (id, level, extra = {}) => {
  const c = pokemonAt(id, level);
  const { real, ...x } = extra;
  return { ...c, ...(real ? {} : { keywords: {}, trigger: null }), uid: `m-${n++}`, currentStrength: c.strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x };
};
const T = (on, ...ops) => ({ on, ops });
const card = (id, round = 1, bonus = 0) => ({ ...cardAtRound(id, round, bonus), uid: `c-${n++}` });
const battle = (turn = 'player', { trainers = [] } = {}) => {
  const list = DECKS['mistys-tide'].list.filter((id) => !['misty', 'whitney'].includes(id));
  const deck = [...list, ...trainers, ...['ember', 'ember', 'surf'].slice(0, 40 - list.length - trainers.length)];
  let s = createGame(5, { decks: { player: deck, ai: deck } });
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.drawPile = Array.from({ length: 8 }, () => card('ponyta')); p.discard = []; p.row = p.row.map(() => null); p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; if (!trainers.length) p.trainers = []; p.recognition = 0; p.dollars = 10; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id, round = 1) => { const c = card(id, round); s.players[who].hand.push(c); return c.uid; };
const pass = (s) => { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; return applyAction(s, { type: 'pass', who: s.turn }); };
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') { s.players.player.hand = []; s.players.ai.hand = []; s = pass(s); } return s; };
const place = (s, who, id, start) => { s.players[who].hand.push(card(id)); s.turn = who; s.passesInARow = 0; const x = applyAction(s, { type: 'placeLocation', who, uid: s.players[who].hand.at(-1).uid, start }); x.turn = who; return x; };
const attack = (s, who, from, target) => { s.turn = who; s.passesInARow = 0; s.players[who].row[from].spent = false; return applyAction(s, { type: 'attack', who, from, target }); };
const settle = (s) => { while (s.reactWindow) s = applyAction(s, { type: 'decline', who: s.reactWindow.reactor }); return s; };
const cmd = (s, who, id, mode, target) => settle(applyAction(s, { type: 'command', who, uid: give(s, who, id), mode, target }));
const sup = (s, who, id, releaseId) => { const r = card(releaseId); s.players[who].hand.push(r); return applyAction(s, { type: 'supporter', who, uid: give(s, who, id), release: [r.uid] }); };
const choose = (s, target) => applyAction(s, { type: 'choose', who: s.choice.who, target });
const trace = (s, re) => s.log.filter((l) => re.test(l));

// --- On Command: after a Move as Adapt resolves, or as Strat when sealed; never for a React --------------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('abra', 2, { real: true });   // On Command: 1 damage to an enemy Pokémon
  s.players.ai.row[4] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s.players.ai.row[5] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = cmd(s, 'player', 'calm-mind', 'adapt', { who: 'player', space: 0 });
  ok(s.choice?.who === 'player' && s.choice.kind === 'trigger' && trace(s, /Abra: On Command/).length === 1, 'Adapt: On Command fires after it resolves (and asks for its target)');
  ok(s.players.player.row[0].attack === pokemonAt('abra', 2).attack + 1, 'the Move resolved first');
  s = choose(s, { who: 'ai', space: 5 });
  eq([s.players.ai.row[4].currentStrength, s.players.ai.row[5].currentStrength, s.turn], [20, 19, 'ai'], '1 damage to the enemy chosen; then the turn ends');
  // A Strat: when it's sealed, before it resolves.
  s = battle();
  s.players.player.row[0] = mon('abra', 2, { real: true });
  s.players.ai.row[4] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'calm-mind'), mode: 'strat', target: { who: 'player', space: 0 } });
  ok(s.strats.length === 1 && s.choice?.kind === 'trigger', 'Strat: On Command fires when it is sealed');
  s = choose(s, { who: 'ai', space: 4 });
  eq([s.players.ai.row[4].currentStrength, s.players.player.row[0].attack], [19, pokemonAt('abra', 2).attack], 'its damage now; the Strat itself still waits');
  // Never for a React.
  s = battle('ai');
  s.players.player.row[0] = mon('abra', 2, { real: true, strength: 20, currentStrength: 20 });
  s.players.ai.row[0] = mon('growlithe', 4);
  s.players.player.hand = [card('calm-mind')];
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 0 });
  s = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 0 } });
  ok(!trace(s, /On Command/).length && !s.choice, 'a React: no On Command');
}

// --- On Supper: after Strats, before dominance, in lane order, the player with initiative first ---------------------------------
{
  let s = battle();
  const tag = (name) => T('supper', { op: 'draw', amount: 1 });
  s.players.player.row[3] = mon('slowpoke', 3, { name: 'P3', trigger: tag() });
  s.players.player.row[1] = mon('slowpoke', 3, { name: 'P1', trigger: tag() });
  s.players.ai.row[0] = mon('slowpoke', 3, { name: 'A0', trigger: tag() });
  s.players.ai.row[1] = mon('slowpoke', 3, { name: 'A1', trigger: tag(), strength: 20, currentStrength: 20 });
  s.initiative = 'ai';
  s = place(s, 'player', 'cerulean-cape', 7);
  s.players.player.row[7] = mon('wooper', 7);
  s.strats.push({ uid: 'st1', owner: 'player', card: card('ember'), target: { who: 'ai', space: 1, uid: s.players.ai.row[1].uid }, targetName: 'A1', playedRound: 1 });
  s = nextRound(s);
  const order = s.log.filter((l) => /: On Supper/.test(l)).map((l) => l.match(/(P\d|A\d)/)[1]);
  eq(order, ['A0', 'A1', 'P1', 'P3'], 'initiative first, each in lane order');
  const at = (re) => s.log.findIndex((l) => re.test(l));
  ok(at(/Ember \(Strat\)/) < at(/On Supper/) && at(/On Supper/) < at(/dominating Cerulean Cape/), 'after Strats, before dominance');
  // Slowpoke (its own trigger): heal 2 to each of yours in its Location.
  let t = battle();
  t.players.player.row[4] = mon('slowpoke', 3, { real: true });
  t.players.player.row[5] = mon('wooper', 7, { currentStrength: 2 });
  t = place(t, 'player', 'cerulean-cape', 4);
  t = nextRound(t);
  eq(t.players.player.row[5].currentStrength, 2 + 1 + 2, 'Slowpoke: heal 2 in its Location (after Cerulean Cape\'s +1)');
}

// --- Aura: constant while in play; stacks across different Pokémon, not with a copy of itself -----------------------------------
{
  let s = battle();
  s = place(s, 'player', 'mt-ember', 0);   // lanes 1–3 (+1 Attack to all there)
  s.players.player.row[1] = mon('wooper', 7);
  syncBonuses(s);
  const base = damageOf(s, s.players.player.row[1]);
  s.players.player.row[0] = mon('riolu', 2, { real: true });   // Aura: your other Pokémon in its Location have +1 Attack
  s.players.ai.row[2] = mon('wooper', 7);
  syncBonuses(s);
  eq(damageOf(s, s.players.player.row[1]), base + 1, 'Riolu\'s Aura: +1 Attack to your other Pokémon in its Location');
  eq(damageOf(s, s.players.player.row[0]), pokemonAt('riolu', 2).attack + 1, 'not itself (only Mt. Ember\'s +1)');
  eq(damageOf(s, s.players.ai.row[2]), pokemonAt('wooper', 7).attack + 1, 'not the enemy\'s');
  s.players.player.row[2] = mon('riolu', 3, { real: true });   // a second Riolu: the same Aura
  syncBonuses(s);
  eq(damageOf(s, s.players.player.row[1]), base + 1, 'two copies of the same Aura count once');
  s.players.player.row[2] = mon('riolu', 5, { real: true });   // Lucario: a different Aura (+1 Attack and +1 Strength)
  syncBonuses(s);
  eq([damageOf(s, s.players.player.row[1]), s.players.player.row[1].strength], [base + 2, pokemonAt('wooper', 7).strength + 1], 'different Auras stack');
  s.players.player.row[0] = null;
  s.players.player.row[2] = null;
  syncBonuses(s);
  eq(damageOf(s, s.players.player.row[1]), base, 'gone with them');
}

// --- Hand control: random discards (seeded; a short hand gives what there is); a chosen discard; a random steal -------------------
{
  let s = battle();
  s.players.ai.hand = [card('ember')];
  s = sup(s, 'player', 'team-rocket-grunt', 'ponyta');   // the opponent discards 2 random cards, and you gain $1
  eq([s.players.ai.hand.length, s.players.ai.discard.map((c) => c.id), s.players.player.dollars], [0, ['ember'], 11], 'Team Rocket Grunt with 1 card in the opponent\'s hand: takes what there is');
  s = battle();
  s.players.ai.hand = [card('ember'), card('surf'), card('dive')];
  const a = cmd(structuredClone(s), 'player', 'thief', 'adapt', { who: 'player', space: null, all: true });
  const b = cmd(structuredClone(s), 'player', 'thief', 'adapt', { who: 'player', space: null, all: true });
  eq([a.players.ai.hand.length, a.players.ai.discard.length], [2, 1], 'Thief Adapt: one random card');
  eq(a.players.ai.discard[0].id, b.players.ai.discard[0].id, 'the seeded random choice: the same state gives the same card');
  // Sabrina: the chooser picks from the opponent's hand.
  s = battle('player', { trainers: ['sabrina'] });
  s.players.ai.hand = [card('ember'), card('surf')];
  s.players.player.drawPile = [card('ponyta')];
  s = applyAction(s, { type: 'trainerCommand', who: 'player', uid: give(s, 'player', 'sabrina') });
  ok(s.choice?.pick === 'card' && s.choice.from === 'opponentHand' && s.choice.targets.length === 2, 'Sabrina: a pick from the opponent\'s hand');
  const surf = s.players.ai.hand.find((c) => c.id === 'surf');
  s = choose(s, { uid: surf.uid });
  eq([s.players.ai.hand.map((c) => c.id), s.players.ai.discard.map((c) => c.id), s.players.player.hand.length, s.turn], [['ember'], ['surf'], 1, 'ai'], 'the card chosen is discarded; draw 1; the turn ends');
  // A stolen Pokémon card keeps its hand Level bonus.
  s = battle();
  const big = card('charmander', 1, 2);
  s.players.ai.hand = [big];
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'thief'), mode: 'strat', target: { who: 'player', space: null, all: true } });
  s = settle(applyAction(s, { type: 'pass', who: 'ai' }));
  const got = s.players.player.hand.find((c) => c.uid === big.uid);
  eq([got?.level, got?.levelBonus, s.players.ai.hand.length], [5, 2, 0], 'Thief Strat: the stolen Charmander keeps its +2 Levels');
}

// --- The Discard Pile: free summons (Mr. Fuji, Revive) and returns to hand (Duskull, Shadow Ball, Morty) ------------------------------
{
  let s = battle('player', { trainers: ['morty'] });
  const absol = card('absol');   // Level 2 in Round 1; On Summon: 1 damage to each enemy Pokémon in its Location
  const big = card('magikarp', 4);   // Level 6 in Round 4, but Level 3 now (this Round's Level for its series)
  const tooBig = card('wooper', 1); tooBig.level = 7;   // (its stored Level is ignored: Round 1 makes it Level 2)
  s.players.player.discard = [absol, big, tooBig];
  s.players.ai.row[6] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = sup(s, 'player', 'mr-fuji', 'ponyta');
  ok(s.choice?.pick === 'card' && s.choice.from === 'discard', 'Mr. Fuji: pick a Pokémon from your Discard Pile');
  eq(s.choice.targets.map((t) => t.uid).sort(), [absol.uid, big.uid, tooBig.uid].sort(), 'Level 3 or less at this Round\'s Level');
  s = choose(s, { uid: absol.uid });
  ok(s.choice?.pick === 'space', 'then an empty space');
  s = choose(s, { who: 'player', space: 6 });
  eq([s.players.player.row[6]?.name, s.players.player.row[6]?.level, s.players.ai.row[6].currentStrength], ['Absol', 2, 19], 'summoned for free at this Round\'s Level; its On Summon fires');
  eq(s.players.player.trainers.find((t) => t.name === 'Morty').progress, 1, 'Morty: a card left your Discard Pile');
  // Its Favour (a Ghost Pokémon): Level 5 or less; Revive: Level 4 or less.
  s = battle();
  s.round = 4;
  s.players.player.discard = [card('magikarp', 4)];   // Level 6 in Round 4
  const r = sup(structuredClone(s), 'player', 'mr-fuji', 'gastly');
  ok(!r.choice && r.log.some((l) => /fizzled/.test(l)), 'Level 6: nothing to summon, even with the Favour');
  s.players.player.discard = [card('ponyta', 4)];   // Level 4 in Round 4
  const rv = give(s, 'player', 'revive');
  const v = applyAction(structuredClone(s), { type: 'buyItem', who: 'player', from: 'hand', uid: rv, then: 'use', target: { space: null } });
  ok(v.choice?.pick === 'space', 'Revive: its one card is taken without a pick; then a space');
  const vv = choose(v, { who: 'player', space: 3 });
  eq([vv.players.player.row[3]?.id, vv.players.player.row[3]?.level], ['ponyta', 4], 'Revive: Level 4 or less, summoned at this Round\'s Level');
  // Return from the Discard Pile: a pick when there are more cards than it takes; Morty counts each.
  s = battle('player', { trainers: ['morty'] });
  s.players.player.discard = [card('ponyta'), card('squirtle'), card('ember')];
  const dusk = { ...pokemonAt('duskull', 3), uid: 'dk' };   // On Summon: return a Pokémon card from your Discard Pile to your hand
  s.players.player.hand = [dusk];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'dk', space: 0 });
  ok(s.choice?.pick === 'card' && s.choice.targets.length === 2, 'Duskull: pick one of the 2 Pokémon cards (not the Move)');
  s = choose(s, { uid: s.choice.targets.find((t) => t.name === 'Squirtle').uid });
  eq([s.players.player.hand.map((c) => c.id), s.players.player.discard.map((c) => c.id)], [['squirtle'], ['ponyta', 'ember']], 'back to your hand');
  eq(s.players.player.trainers.find((t) => t.name === 'Morty').progress, 1, 'Morty counts it');
  s = battle();
  s.players.player.discard = [card('ponyta')];
  s.players.ai.row[0] = mon('wooper', 7);
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'shadow-ball'), mode: 'strat', target: { who: 'ai', space: 0 } });
  s = settle(applyAction(s, { type: 'pass', who: 'ai' }));
  ok(s.players.player.hand.some((c) => c.id === 'ponyta') && !s.choice, 'Shadow Ball Strat: with only one card, no pick needed');
}

// --- Bill: any 2 cards from your Draw Pile, picked from a list by name; then it's shuffled -------------------------------------------
{
  let s = battle();
  s.players.player.drawPile = ['surf', 'ember', 'dive', 'ponyta', 'abra'].map((id) => card(id));
  s = sup(s, 'player', 'bill', 'squirtle');
  eq(s.choice.targets.map((t) => t.name), ['Abra', 'Dive', 'Ember', 'Ponyta', 'Surf'], 'the list is sorted by name, never in pile order');
  s = choose(s, { uid: s.choice.targets[0].uid });
  ok(s.choice?.count === 1, 'then 1 more');
  s = choose(s, { uid: s.choice.targets.find((t) => t.name === 'Surf').uid });
  eq([s.players.player.hand.map((c) => c.id).sort(), s.players.player.drawPile.length], [['abra', 'surf'], 3], 'both into your hand; 3 left, shuffled');
}

// --- Return another of your Pokémon to your hand with +N Levels (Kirlia) ---------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[2] = mon('charmander', 3);
  const uid = s.players.player.row[2].uid;
  s.players.player.hand = [{ ...pokemonAt('ralts', 4), uid: 'kir' }];   // Kirlia
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'kir', space: 0 });
  ok(s.choice?.targets.every((t) => t.space !== 0), 'another of yours: not itself');
  s = choose(s, { who: 'player', space: 2 });
  const back = s.players.player.hand.find((c) => c.uid === uid);
  eq([back?.level, back?.levelBonus], [3 + 1, 1], 'Kirlia: back to your hand with +1 Level');
}

// --- On Defeated: return it to your hand (Gastly): still a defeat; its Held Item goes back to the PokéMart -------------------------------------
{
  let s = battle('player', { trainers: ['misty'] });
  s.players.ai.row[0] = mon('gastly', 2, { real: true, held: card('charcoal'), currentStrength: 1 });
  const g = s.players.ai.row[0].uid;
  s.players.player.row[0] = mon('growlithe', 6);
  const pool = s.mart.pool.length;
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq([s.players.player.recognition, s.players.player.dollars], [RULES.perDefeat, 10 + RULES.dollarsPerDefeat], 'it counts as defeated: Recognition and $');
  eq(s.players.player.trainers.find((t) => t.name === 'Misty').progress, 1, 'and for Objectives');
  ok(s.players.ai.hand.some((c) => c.uid === g) && !s.players.ai.released.some((c) => c.uid === g), 'the card goes to its owner\'s hand, not the Released Pile');
  ok(s.mart.pool.length === pool + 1 && s.mart.pool.some((c) => c.id === 'charcoal'), 'its Held Item returns to the PokéMart');
}

// --- "The Pokémon that defeated it" (Mankey): an attack's; none for a Move or an effect ---------------------------------------------
{
  let s = battle();
  s.players.ai.row[0] = mon('mankey', 1, { real: true, currentStrength: 1 });   // On Defeated: 2 damage to the Pokémon that defeated it
  s.players.player.row[0] = mon('wooper', 7);
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.row[0].currentStrength, pokemonAt('wooper', 7).strength - 2, 'Mankey: 2 damage to its attacker');
  s = battle();
  s.players.ai.row[0] = mon('mankey', 1, { real: true, currentStrength: 1 });
  s.players.player.row[0] = mon('wooper', 7);
  s = cmd(s, 'player', 'ember', 'adapt', { who: 'ai', space: 0 });
  ok(!s.players.ai.row[0] && s.players.player.row[0].currentStrength === s.players.player.row[0].strength, 'defeated by a Move: there is no such Pokémon, nothing happens');
}

// --- Destiny Bond: React (the attacker falls too, rewards to you); Adapt (a temporary On Defeated) ----------------------------------------
{
  let s = battle('ai');
  s.players.player.row[3] = mon('wooper', 2, { currentStrength: 1 });
  s.players.ai.row[0] = mon('growlithe', 6);
  s.players.player.hand = [card('destiny-bond')];
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 3 });
  s = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 3 } });
  ok(!s.players.player.row[3] && !s.players.ai.row[0], 'Destiny Bond React: both are defeated');
  eq([s.players.player.recognition, s.players.player.dollars], [RULES.perDefeat, 10 + RULES.dollarsPerDefeat], 'you get the normal defeat rewards for the attacker');
  s = battle();
  s.players.player.row[3] = mon('wooper', 2, { currentStrength: 1 });
  s = cmd(s, 'player', 'destiny-bond', 'adapt', { who: 'player', space: 3 });
  ok(s.players.player.row[3].tempTrigger?.on === 'defeated', 'Destiny Bond Adapt: until Supper, it has On Defeated');
  s.players.ai.row[0] = mon('growlithe', 6);
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 3 });
  eq(s.players.ai.row[0].currentStrength, pokemonAt('growlithe', 6).strength - 3, '3 damage to the Pokémon that defeated it');
  s = battle();
  s.players.player.row[3] = mon('wooper', 2);
  s = cmd(s, 'player', 'destiny-bond', 'adapt', { who: 'player', space: 3 });
  s = nextRound(s);
  ok(!s.players.player.row[3].tempTrigger, 'gone at Supper');
}

// --- Close Combat; Sucker Punch; Detect -----------------------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[1] = mon('machop', 3, { strength: 9, currentStrength: 9 });
  s.players.player.row[2] = mon('machop', 3);   // nothing across from it
  s.players.ai.row[1] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  eq(commandTargets(s, 'player', card('close-combat'), 'adapt'), [{ who: 'player', space: 1 }], 'Close Combat: only a Pokémon of yours with an enemy across from it');
  s = cmd(s, 'player', 'close-combat', 'adapt', { who: 'player', space: 1 });
  eq([s.players.ai.row[1].currentStrength, s.players.player.row[1].currentStrength], [16, 8], '4 damage across, and yours takes 1');
  // Its 1 damage defeating your own Pokémon: a defeat (On Defeated, Gastly back to hand) but no rewards for anyone.
  s = battle();
  s.players.player.row[1] = mon('gastly', 2, { real: true, currentStrength: 1 });
  s.players.ai.row[1] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = cmd(s, 'player', 'close-combat', 'adapt', { who: 'player', space: 1 });
  eq([s.players.player.row[1], s.players.player.hand.some((c) => c.id === 'gastly'), s.players.player.recognition, s.players.ai.recognition, s.players.player.dollars, s.players.ai.dollars], [null, true, 0, 0, 10, 10], 'your own Pokémon defeated by your own Close Combat: no rewards; Gastly still returns');
  s = battle();
  s.players.player.row[1] = mon('machop', 3);
  ok(!commandTargets(s, 'player', card('close-combat'), 'adapt').length && !legalActions(s, 'player').includes('command'), 'nothing across: it can\'t be played');
  s = battle();
  s.players.ai.row[0] = mon('wooper', 7, { spent: true });
  s.players.ai.row[1] = mon('wooper', 7, { spent: false });
  eq(commandTargets(s, 'player', card('sucker-punch'), 'adapt').map((t) => t.space), [1], 'Sucker Punch Adapt: only an Active enemy');
  s = battle();
  s.players.player.row[0] = mon('wooper', 7);
  s = cmd(s, 'player', 'detect', 'adapt', { who: 'player', space: 0 });
  ok(hasKw(s.players.player.row[0], 'retaliate') && s.players.player.row[0].tempKw?.retaliate === 2, 'Detect Adapt: Retaliate 2 until Supper');
  s = nextRound(s);
  ok(!hasKw(s.players.player.row[0], 'retaliate'), 'gone at Supper');
}

// --- Choice Specs (Agility while held); X Speed; Ether ------------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 4, { spent: true });
  const use = (st, id, space = 0) => applyAction(st, { type: 'buyItem', who: 'player', from: 'hand', uid: give(st, 'player', id), then: 'use', target: { space } });
  const a = use(structuredClone(s), 'choice-specs');
  ok(hasKw(a.players.player.row[0], 'agility') && a.players.player.row[0].attack === pokemonAt('wooper', 4).attack + 2, 'Choice Specs: +2 Attack and Agility while held');
  let x = use(structuredClone(s), 'x-speed');
  eq([x.players.player.row[0].spent, effectiveSpeed(x.players.player.row[0])], [false, 'Steady'], 'X Speed: Active, and Speed one step higher');
  x = nextRound(x);
  eq(effectiveSpeed(x.players.player.row[0]), 'Slow', 'until Supper');
  const et = give(s, 'player', 'ether');
  const e = applyAction(structuredClone(s), { type: 'buyItem', who: 'player', from: 'hand', uid: et, then: 'use', target: { space: null } });
  eq(e.players.player.baseEnergy, 9 + 2, 'Ether: +2 Energy this Round');
}

// --- Officer Jenny's Favour; Lavender Town --------------------------------------------------------------------------------------------------
{
  let s = battle();
  s = place(s, 'player', 'cerulean-cape', 0);
  for (const sp of [0, 1, 5]) s.players.ai.row[sp] = mon('wooper', 7, { spent: false });
  s.turn = 'player';
  s = sup(s, 'player', 'officer-jenny', 'ember');   // the Favour: a Move Released
  s = choose(s, { who: 'ai', space: 0, lane: true });
  eq([0, 1, 5].map((sp) => [s.players.ai.row[sp].spent, s.players.ai.row[sp].strength - s.players.ai.row[sp].currentStrength]), [[true, 1], [true, 1], [false, 0]], 'each enemy there becomes Spent, and each of them takes 1');
  s = battle();
  s = place(s, 'ai', 'lavender-town', 2);
  s.players.ai.row[2] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.drawPile = [card('ember')];
  s.players.player.row[2] = mon('growlithe', 6);
  s = attack(s, 'player', 2, { kind: 'pokemon', space: 2 });
  eq(s.players.ai.hand.map((c) => c.id), ['ember'], 'Lavender Town: its owner draws 1 when a Pokémon there is defeated');
}

// --- The four Objective counters ----------------------------------------------------------------------------------------------------------
{
  // Sabrina: Moves played as Adapt or Strat (not a React).
  let s = battle('player', { trainers: ['sabrina'] });
  s.players.player.row[0] = mon('wooper', 7);
  s.players.ai.row[0] = mon('wooper', 7);
  const prog = (st, name) => st.players.player.trainers.find((t) => t.name === name).progress;
  s = cmd(s, 'player', 'calm-mind', 'adapt', { who: 'player', space: 0 });
  s.turn = 'player';
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'calm-mind'), mode: 'strat', target: { who: 'player', space: 0 } });
  eq(prog(s, 'Sabrina'), 2, 'Sabrina: an Adapt and a Strat');
  s.players.player.hand = [card('calm-mind')];
  s.players.ai.row[0].spent = false;
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 0 });
  if (s.reactWindow) s = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 0 } });
  eq(prog(s, 'Sabrina'), 2, 'a React doesn\'t count');
  // Bruno: enemy attacks on your Pokémon that don't defeat it.
  s = battle('ai', { trainers: ['bruno'] });
  s.players.player.row[0] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s.players.player.row[1] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.row[0] = mon('growlithe', 4, { keywords: { infiltrator: true } });
  s.players.ai.row[1] = mon('growlithe', 4, { keywords: { infiltrator: true } });
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 0 });
  s = attack(s, 'ai', 1, { kind: 'pokemon', space: 1 });
  eq(prog(s, 'Bruno'), 1, 'Bruno: one survived, one defeated');
  // Morty: cards leaving your Discard Pile through your effects (here Pokémon Breeder).
  s = battle('player', { trainers: ['morty'] });
  s.players.player.discard = [card('ponyta'), card('squirtle')];
  const pick = s.players.player.discard.map((c) => c.uid);
  s.players.player.hand.push(card('ember'));
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'pokemon-breeder'), release: [s.players.player.hand[0].uid], pick });
  eq(prog(s, 'Morty'), 2, 'Morty: 2 cards returned');
  // Karen: times your effects or attacks damage the enemy Player Character.
  s = battle('player', { trainers: ['karen'] });
  s.players.ai.hand = [card('ember')];
  s = applyAction(s, { type: 'trainerCommand', who: 'player', uid: give(s, 'player', 'karen') });
  eq([prog(s, 'Karen'), s.players.ai.hand.length, s.players.player.recognition], [1, 0, 2], 'Karen\'s Command: 2 damage to the enemy Player Character (1 time), and a random discard');
  s.players.player.row[0] = mon('ponyta', 3);
  s = attack(s, 'player', 0, { kind: 'player' });
  eq(prog(s, 'Karen'), 2, 'an attack on the Player Character counts too');
}

// --- Mewtwo: cost 5, Level 8; On Command: 2 damage to each enemy Pokémon in a Location you choose ------------------------------------------
{
  let s = battle();
  const m = card('mewtwo');
  eq([m.level, m.cost, m.legendary], [8, 5, true], 'Mewtwo: Level 8, cost 5');
  s.players.player.row[0] = { ...m, currentStrength: m.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
  s = place(s, 'player', 'cerulean-cape', 4);
  for (const sp of [4, 5, 8]) s.players.ai.row[sp] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s.players.player.row[1] = mon('wooper', 2);
  s = cmd(s, 'player', 'calm-mind', 'adapt', { who: 'player', space: 1 });
  ok(s.choice?.targets.every((t) => t.lane), 'On Command: choose a Location');
  s = choose(s, { who: 'ai', space: 4, lane: true });
  eq([4, 5, 8].map((sp) => s.players.ai.row[sp].strength - s.players.ai.row[sp].currentStrength), [2, 2, 0], '2 damage to each enemy Pokémon in it');
}

// --- Hidden information (the B3-2 prompt E): the AI's choices are the same whatever is in the player's hand and Draw
// Pile (the same number of cards, the same uids); the one exception is inside Sabrina's pick from that hand. ---------------
{
  const seeded = (k) => { let x = k; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  const swap = (x, ids) => { const y = structuredClone(x); const p = y.players.player; p.hand = p.hand.map((c, i) => ({ ...cardAtRound(ids[i % ids.length], y.round), uid: c.uid })); p.drawPile = p.drawPile.map((c, i) => ({ ...cardAtRound(ids[(i + 3) % ids.length], y.round), uid: c.uid })); return y; };
  let tested = 0;
  for (let seed = 1; seed < 400 && tested < 40; seed++) {
    const rng = seeded(seed);
    let s = createGame(seed, { decks: { player: DECK_IDS[seed % 8], ai: DECK_IDS[(seed * 5 + 3) % 8] } });
    for (let i = 0; i < 40 + (seed % 120) && s.phase !== 'gameOver'; i++) s = applyAction(s, chooseAction(s, actor(s), { rng }));
    if (s.phase === 'gameOver' || actor(s) !== 'ai' || (s.choice?.from === 'opponentHand')) continue;
    const picks = [['ember', 'mewtwo', 'bill', 'ether'], ['gastly', 'thief', 'potion', 'sabrina'], ['abra', 'abra', 'surf', 'close-combat']]
      .map((ids) => JSON.stringify(chooseAction(swap(s, ids), 'ai', { rng: seeded(7) })));
    ok(picks.every((x) => x === picks[0]), `seed ${seed}: the same choice whatever the player holds and will draw (${picks[0].slice(0, 90)})`);
    tested += 1;
  }
  ok(tested >= 30, `hidden information: ${tested} AI decisions compared`);
  // Inside Sabrina's pick the AI does read the player's hand: it discards the Pokémon card, not the Item, wherever it is.
  const sab = (handIds) => {
    let s = battle('ai', { trainers: ['sabrina'] });
    s.players.player.hand = handIds.map((id, i) => ({ ...card(id, 3), uid: `ph-${i}` }));
    s = applyAction(s, { type: 'trainerCommand', who: 'ai', uid: give(s, 'ai', 'sabrina') });
    ok(s.choice?.who === 'ai' && s.choice.from === 'opponentHand', 'the AI picks from the player\'s hand');
    return chooseAction(s, 'ai', { rng: seeded(3) }).target.uid;
  };
  eq([sab(['potion', 'mewtwo']), sab(['mewtwo', 'potion'])], ['ph-1', 'ph-0'], 'Sabrina: the AI reads the hand for this pick only (it takes Mewtwo wherever it is)');
}

// --- The AI never re-summons a card that came back to its hand this Round (two Ralts in Route 119 could swap forever) ----
{
  let s = battle('ai');
  s = place(s, 'ai', 'route-119', 0);
  s.turn = 'ai';
  s.players.ai.baseEnergy = 0;
  s.players.ai.row[1] = { ...pokemonAt('ralts', 2), uid: 'r-a', currentStrength: 3, spent: true, summonedRound: 1, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
  s.players.ai.hand = [{ ...cardAtRound('ralts', 1), uid: 'r-b' }];
  s.players.ai.dollars = 0;
  let a = { type: 'summon', who: 'ai', uid: 'r-b', space: 2 };
  ok(legalActions(s, 'ai').includes('summon'), 'a free Ralts (Route 119): it can be summoned for 0 Energy');
  s = applyAction(s, a);
  if (s.choice) s = applyAction(s, chooseAction(s, 'ai', { rng: () => 0.5 }));
  const back = s.players.ai.hand.find((c) => c.uid === 'r-a');
  ok(back?.backRound === s.round, 'the other Ralts is back in hand, marked with this Round');
  s.turn = 'ai'; s.passesInARow = 0;
  a = chooseAction(s, 'ai', { rng: () => 0.5 });
  ok(!(a.type === 'summon' && a.uid === 'r-a'), `then it doesn't summon it again this Round (${a.type})`);
}

console.log(`b32rules: ${checks} checks passed`);
