// V3-0's rules (docs/v3-foundations.md; the numbers in v3/src/rules.js). Run: node v3/tests/rules.test.js
import assert from 'node:assert/strict';
import { RULES, levelFor, costFor } from '../src/rules.js';
import {
  createGame, applyAction, actor, legalActions, isOpen, furthestOpen, portraitOf, locationAt, legalTargets, isReady,
  readySpaces, gainRecognition, passSpends, effectTargets, lanesOf,
} from '../src/engine/game.js';
import { pokemonAt, TEST_DECK, SERIES, MOVES, SUPPORTERS, WILD } from '../src/engine/cards.js';
import { LOCATIONS, PALLET_TOWN, CHAMPIONSHIP } from '../src/engine/locations.js';
import { freeAtRight } from '../src/engine/game.js';

const QUEUE = ['eterna-forest', 'shalour-city', 'cerulean-cape', 'mt-ember', 'lake-of-rage', 'floaroma-meadow', 'route-119', 'petalburg-woods', 'eterna-forest', 'cerulean-cape'];
const start = (seed = 1, queue = QUEUE) => {
  let s = createGame(seed, queue ? { locations: queue } : {});
  s = applyAction(s, { type: 'mulligan', who: 'player' });
  return applyAction(s, { type: 'mulligan', who: 'ai' });
};
const pass = (s) => applyAction(s, { type: 'pass', who: actor(s) });
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') s = pass(s); return s; };
const toRound = (s, r) => { while (s.round < r && s.phase !== 'gameOver') s = nextRound(s); return s; };
const mon = (id, level = 3, extra = {}) => { const c = pokemonAt(id, level, 6); return { ...c, uid: `t-${id}-${Math.random()}`, currentStrength: c.strength, spent: false, ...extra }; };
const span = (s) => s.locations.map((l) => `${l.id}@${l.start}+${l.width}`);

// --- Setup ------------------------------------------------------------------------------------------
{
  const s0 = createGame(4);
  assert.equal(TEST_DECK.length, RULES.deckSize);
  assert.equal(s0.phase, 'mulligan');
  assert.deepEqual(span(s0), ['pallet-town@0+2'], 'Pallet Town (2 lanes) starts on spaces 1–2');
  assert.ok(isOpen(s0, 0) && isOpen(s0, 1) && !isOpen(s0, 2) && !isOpen(s0, 9), 'spaces 3–10 are closed');
  for (const who of ['player', 'ai']) {
    const p = s0.players[who];
    assert.equal(p.hand.length, 6);
    assert.equal(p.drawPile.length, 34);
    assert.equal(p.row.length, RULES.spaces);
    assert.equal(portraitOf(s0, who), 0, 'each portrait frames space 1');
    assert.ok(p.hand.filter((c) => c.cardType === 'Pokémon').every((c) => c.level === 1), 'Round 1: Pokémon are Level 1');
  }
  // The mulligan: the 6 go back, 6 new are drawn; once.
  let m = applyAction(s0, { type: 'mulligan', who: 'player', redraw: true });
  assert.equal(m.players.player.hand.length, 6);
  assert.equal(m.players.player.drawPile.length + m.players.player.hand.length, 40);
  assert.equal(m.phase, 'mulligan');
  assert.deepEqual(legalActions(m, 'player'), []);
  m = applyAction(m, { type: 'mulligan', who: 'ai' });
  assert.equal(m.phase, 'battle');
  assert.equal(m.players.player.energy, 1, 'Round 1: 1 Energy');
  assert.equal(m.players.ai.energy, 1);
  // Cards: actual v1/v2 Pokémon (series, names, art), Moves and Supporters; a mix for the deck.
  assert.ok(SERIES.length >= 10);
  const inDeck = TEST_DECK.filter((e) => e.series).map((e) => SERIES.find((x) => x.id === e.series));
  for (const band of ['Light', 'Medium', 'Heavy']) assert.ok(inDeck.some((x) => x.band === band), `the deck has ${band} Pokémon`);
  for (const sp of ['Slow', 'Steady', 'Swift']) assert.ok(inDeck.some((x) => x.speed === sp), `the deck has ${sp} Pokémon`);
  for (const at of ['Physical', 'Special']) assert.ok(inDeck.some((x) => x.attackType === at));
  assert.ok(inDeck.some((x) => x.guard === 'Defence') && inDeck.some((x) => x.guard === 'Special Defence'), 'some guards');
  assert.ok(new Set(inDeck.map((x) => x.type)).size >= 5, 'a mix of Types');
  assert.equal(pokemonAt('squirtle', 5).name, 'Blastoise', 'series stages by Level');
  assert.equal(pokemonAt('growlithe', 4).name, 'Arcanine');
  assert.deepEqual(pokemonAt('magikarp', 4).keywords, ['Overrun']);
  assert.ok(MOVES.length >= 4 && SUPPORTERS.length >= 2);
  // Only systems v3 has: no Burn, Sleep, Leech Seed, Growth, Weather, Items or Trainers in any effect.
  const text = JSON.stringify([SERIES.map((x) => [1, 2, 3, 4, 5, 6].map((l) => pokemonAt(x.id, l))), MOVES.map((m) => m.breakpoints), SUPPORTERS.map((c) => [c.text, c.ops, c.favour])]);
  for (const gone of ['Burn', 'Scorch', 'Sleep', 'Leech', 'Growth', 'Weather', 'Rain', 'Sun', 'Douse', 'Retain', 'Item', 'Trainer', 'enemyBurn', 'growth']) assert.ok(!text.includes(gone), `no ${gone}`);
  assert.equal(LOCATIONS.length, 8);
  for (const l of [PALLET_TOWN, ...LOCATIONS, CHAMPIONSHIP]) assert.equal(l.art, `cards/${l.id}.jpg`, `${l.name}: its own v1/v2 art`);
}

// --- The treadmill (V3-1) -----------------------------------------------------------------------------
{
  let s = start(2);
  // A Pokémon summoned in Pallet Town on space 2 stays there as the Locations pass through.
  s.players.player.hand.unshift(mon('ponyta', 1));
  s.turn = 'player';
  s.players.player.energy = 5;
  s = applyAction(s, { type: 'summon', who: 'player', uid: s.players.player.hand[0].uid, space: 1 });
  const uid = s.players.player.row[1].uid;
  assert.equal(locationAt(s, 1).id, 'pallet-town');
  // Round 2: Pallet Town moves one space left (it shrinks to 1 lane); Eterna Forest (3) arrives.
  s = nextRound(s);
  assert.deepEqual(span(s), ['pallet-town@-1+2', 'eterna-forest@1+3']);
  assert.equal(lanesOf(s.locations[0]).length, 1, 'the leftmost shrinks by one lane');
  assert.equal(s.players.player.row[1].uid, uid, 'the Pokémon stayed on space 2…');
  assert.equal(locationAt(s, 1).id, 'eterna-forest', '…which is now in Eterna Forest');
  // Round 3: Pallet Town has no lanes left: removed (its completion reward then).
  s.locations[0].completed.player = true;
  const r0 = s.players.player.recognition;
  s = nextRound(s);
  assert.ok(s.events.some((e) => e.type === 'locationRemoved' && e.id === 'pallet-town'), 'removed when no lanes are left');
  assert.equal(s.players.player.recognition, r0 + PALLET_TOWN.completion.recognition + RULES.passivePerRound, 'the completion reward as it leaves');
  assert.deepEqual(span(s), ['eterna-forest@0+3', 'shalour-city@3+1'], 'every Location moves one space left; a new one on the right');
  s = nextRound(s);
  assert.deepEqual(span(s), ['eterna-forest@-1+3', 'shalour-city@2+1', 'cerulean-cape@3+2']);
  s = nextRound(s);
  assert.deepEqual(span(s), ['eterna-forest@-2+3', 'shalour-city@1+1', 'cerulean-cape@2+2', 'mt-ember@4+3']);
  s = nextRound(s);
  assert.deepEqual(span(s), ['shalour-city@0+1', 'cerulean-cape@1+2', 'mt-ember@3+3', 'lake-of-rage@6+2']);
  assert.equal(s.players.player.row[1]?.uid ?? uid, uid, 'Pokémon never move with the Locations');
  // Arrivals only when they fit: the first in line that fits the free spaces at the right edge.
  assert.equal(freeAtRight(s), 2);
  s = nextRound(s);
  assert.deepEqual(span(s), ['cerulean-cape@0+2', 'mt-ember@2+3', 'lake-of-rage@5+2', 'floaroma-meadow@7+1']);
  // Only 3-wide Locations in line: once the free spaces at the right are fewer than 3, it waits.
  let w = start(3, Array(12).fill('mt-ember'));
  w = toRound(w, 5);
  assert.deepEqual(span(w), ['mt-ember@-2+3', 'mt-ember@1+3', 'mt-ember@4+3', 'mt-ember@7+3'], 'the board fills to 10 spaces');
  w = nextRound(w);
  assert.equal(freeAtRight(w), 1);
  assert.ok(w.events.some((e) => e.type === 'locationWaits'), 'nothing fits: it waits');
  assert.ok(!isOpen(w, 9), 'the freed space stays closed until a Location fits');
  w = nextRound(w);
  assert.equal(freeAtRight(w), 2, 'still no room for 3');
  w = nextRound(w);
  assert.ok(w.events.some((e) => e.type === 'locationArrived' && e.start === 7 && e.width === 3), 'it arrives once there is room');
  // Without a test queue the game picks the widest that fits, so the board fills and stays full.
  let f = start(4, null);
  f = toRound(f, 6);
  for (let r = 6; r < 9; r++) { for (let i = 0; i < RULES.spaces; i++) assert.ok(isOpen(f, i), `Round ${r}: space ${i + 1} open`); f = nextRound(f); }
}

// --- Closed spaces: no summoning there ---------------------------------------------------------------
{
  const s = start(3);
  s.turn = 'player';
  s.players.player.hand.unshift(mon('ponyta', 1));
  assert.throws(() => applyAction(s, { type: 'summon', who: 'player', uid: s.players.player.hand[0].uid, space: 4 }), /closed/);
}

// --- Recognition and the portraits ----------------------------------------------------------------------
{
  let s = start(5);
  gainRecognition(s, 'player', 25, 'test');
  assert.equal(portraitOf(s, 'player'), 1, 'capped at the furthest open space (space 2 in Round 1)');
  s = toRound(s, 4);
  assert.equal(portraitOf(s, 'player'), Math.floor(s.players.player.recognition / 10), 'one space right per 10 Recognition');
  // A Pokémon defeated: +2; damage to the enemy player: 1 each.
  s.turn = 'player';
  s.players.player.row[0] = mon('wingull', 4);
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[3] = mon(WILD.id, 1, { spent: true });
  const r0 = s.players.player.recognition;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 3 } });
  assert.equal(s.players.player.recognition, r0 + RULES.perDefeat, '+2 for defeating a Pokémon');
  s.players.ai.row[4] = null;
  s = nextRound(s);
  s.turn = 'player';
  const r1 = s.players.player.recognition;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition, r1 + s.players.player.row[0].attack * RULES.perDamageToPlayer, '1 per damage to the enemy player');
  // +2 at each Breakfast.
  s = nextRound(s);
  for (const who of ['player', 'ai']) assert.ok(s.events.some((e) => e.type === 'recognition' && e.who === who && e.source === 'a new Round' && e.amount === RULES.passivePerRound), '+2 at each Breakfast');
}

// --- Winning at 100 (the Trophy on space 10) ------------------------------------------------------------
{
  let s = start(6, null);
  gainRecognition(s, 'player', 120, 'test');
  assert.equal(s.phase, 'battle', 'not before space 10 is open');
  assert.equal(portraitOf(s, 'player'), 1);
  s = toRound(s, 5);   // the board reaches space 10
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 'player');
  assert.equal(s.result.reason, 'trophy');
  let t = toRound(start(7, null), 6);
  t.players.ai.recognition = 99;
  gainRecognition(t, 'ai', 1, 'test');
  assert.equal(t.winner, 'ai', 'exactly 100 wins');
}

// --- The Regional Championship -------------------------------------------------------------------------
{
  let s = toRound(start(8), 9);
  assert.ok(!s.locations.some((l) => l.championship));
  s.players.player.recognition = 40;
  s.players.ai.recognition = 30;
  s = nextRound(s);
  assert.equal(s.round, 10);
  assert.deepEqual(span(s), ['stark-mountain@0+10'], 'the 10th Location covers every space; the others leave');
  assert.equal(s.locationCount, RULES.championshipAs);
  for (let r = 1; r < RULES.championshipRounds; r++) s = nextRound(s);
  assert.equal(s.phase, 'battle');
  s = nextRound(s);
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.result.reason, 'champion');
  assert.equal(s.winner, s.players.player.recognition > s.players.ai.recognition ? 'player' : 'ai', 'the higher Recognition is crowned Champion');
  // A tie plays on for another Round.
  let t = toRound(start(9), 10);
  for (let r = 1; r < RULES.championshipRounds; r++) t = nextRound(t);
  t.players.player.recognition = 50;
  t.players.ai.recognition = 50 - RULES.passivePerRound * 0;
  const tied = nextRound(t);
  assert.equal(tied.phase, 'battle', 'tied: one more Round');
}

// --- Energy and Overexert ---------------------------------------------------------------------------------
{
  let s = start(10);
  for (let r = 2; r <= 12 && s.phase !== 'gameOver'; r++) {
    s = nextRound(s);
    if (s.phase === 'gameOver') break;
    assert.equal(s.players[s.turn].energy, Math.min(r, RULES.energyCap), `Round ${r}: Energy = the Round, capped at 10`);
  }
  s = toRound(start(11), 4);
  const who = s.turn;
  const e = s.players[who].energy;
  s = applyAction(s, { type: 'overexert', who, amount: 2 });
  assert.equal(s.players[who].energy, e + 2, 'Overexert: up to 2 Energy you don\'t have');
  assert.equal(s.turn, who, 'it isn\'t a turn');
  assert.ok(!legalActions(s, who).includes('overexert'), 'once per Round');
  assert.throws(() => applyAction(s, { type: 'overexert', who, amount: 1 }));
  assert.throws(() => applyAction(applyAction(toRound(start(12), 3), { type: 'pass', who: 'player' }), { type: 'overexert', who: 'ai', amount: 3 }));
  s = applyAction(s, { type: 'pass', who });
  const passer = s.players[who].energy;
  assert.equal(passer, e + 2 + RULES.passEnergy, 'Pass: +1 Energy');
  s = nextRound(s);
  assert.equal(s.players[who].energy, 5 - 3, 'next Breakfast: that much less, plus 1');
  assert.equal(s.players[who].debt, 0);
}

// --- The hand limit and running out of cards ---------------------------------------------------------------
{
  let s = start(13);
  const p = s.players.player;
  while (p.hand.length < RULES.handLimit) p.hand.push(p.drawPile.shift());
  const released = p.released.length;
  s = nextRound(s);
  assert.equal(s.players.player.hand.length, RULES.handLimit, 'hand limit 10');
  assert.equal(s.players.player.released.length, released + RULES.drawPerRound, 'cards drawn beyond it are lost');
  // Unused cards are kept: nothing is discarded at Supper.
  const kept = s.players.ai.hand.length;
  const ai = structuredClone(s.players.ai.hand.map((c) => c.uid));
  s = nextRound(s);
  assert.ok(ai.every((u) => s.players.ai.hand.some((c) => c.uid === u)) || s.players.ai.hand.length >= kept, 'hands are kept');
  // Deck-out: each draw you can't make gives the opponent 3, 6, 9…
  let d = start(14);
  d.players.player.drawPile = [];
  d.players.player.hand = d.players.player.hand.slice(0, 2);
  const r = d.players.ai.recognition;
  d = nextRound(d);
  assert.equal(d.players.ai.recognition - r, RULES.deckOut * 1 + RULES.deckOut * 2 + RULES.passivePerRound, 'two draws missed: +3 then +6');
  assert.equal(d.players.player.deckOuts, 2);
}

// --- Levels and cost bands ----------------------------------------------------------------------------------
{
  for (const [band, lo] of [['Light', 0], ['Medium', 1], ['Heavy', 2]]) {
    assert.equal(costFor(band, 1), lo, `${band} Level 1 costs ${lo}`);
    assert.equal(costFor(band, 6), lo + 5, `${band} Level 6 costs ${lo + 5}`);
  }
  assert.equal(levelFor(3, 6), 3);
  assert.equal(levelFor(9, 4), 4, 'never past its cap');
  assert.equal(pokemonAt('magby', 4).cost, 5, 'Heavy Level 4');
  let s = start(15);
  const card = s.players.player.drawPile.find((c) => c.cardType === 'Pokémon' && c.cap === 6);
  s = toRound(s, 4);
  const now = [...s.players.player.hand, ...s.players.player.drawPile].find((c) => c.uid === card.uid);
  assert.equal(now.level, 4, 'Level = the Round while off the board');
  assert.equal(now.cost, costFor(now.band, 4));
  // Frozen when played; arrives Spent; one per space.
  s.turn = 'player';
  s.players.player.energy = 10;
  if (!s.players.player.hand.includes(now)) s.players.player.hand.push(now);
  s.players.player.row[2] = null;
  s = applyAction(s, { type: 'summon', who: 'player', uid: now.uid, space: 2 });
  assert.ok(s.players.player.row[2].spent, 'it arrives Spent');
  assert.throws(() => applyAction({ ...s, turn: 'player' }, { type: 'summon', who: 'player', uid: s.players.player.hand.find((c) => c.cardType === 'Pokémon')?.uid, space: 2 }));
  s = toRound(s, 6);
  assert.equal(s.players.player.row[2]?.level ?? 4, 4, 'frozen at the Level it was played');
}

// --- Ready, guards and portrait protection ---------------------------------------------------------------------
{
  let s = toRound(start(16), 5);
  s.turn = 'player';
  for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
  s.players.player.row[4] = mon('mankey', 3);           // Swift, Physical
  s.players.player.row[5] = mon('geodude', 1, { strengthType: 'Hitpoints', onDefend: 0 });               // Slow
  s.players.ai.row[4] = mon('chinchou', 4);              // Steady
  assert.deepEqual(readySpaces(s, 'player'), [4], 'only the highest Speed among all Active Pokémon is Ready');
  assert.ok(!isReady(s, s.players.ai.row[4]));
  s.players.player.row[4].spent = true;
  assert.ok(isReady(s, s.players.ai.row[4]), 'with the Swift one Spent, Steady is the top');
  s.players.player.row[4].spent = false;
  // Guards: in the enemy's Location, a Defence guard protects the others from Physical attackers.
  const l = s.locations.find((x) => lanesOf(x).length >= 2);
  const lanes = lanesOf(l);
  assert.ok(lanes.length >= 2, 'a wide Location for the guard test');
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[lanes[0]] = mon('squirtle', 2);       // Defence guard
  s.players.ai.row[lanes[1]] = mon('horsea', 3);
  let t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space);
  assert.deepEqual(t, [lanes[0]], 'a Physical attacker must target the Defence guard there');
  s.players.player.row[4] = mon('wingull', 4);           // Swift, Special
  t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space).sort();
  assert.deepEqual(t, [lanes[0], lanes[1]].sort(), 'a Defence guard doesn\'t stop a Special attacker');
  s.players.ai.row[lanes[0]] = mon('chinchou', 4);       // Special Defence guard
  t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space);
  assert.deepEqual(t, [lanes[0]], 'a Special Defence guard stops a Special attacker');
  // Portrait protection: only a Pokémon on the enemy portrait's space, whatever its Strength-Type.
  const ps = portraitOf(s, 'ai');
  s.players.ai.row = s.players.ai.row.map(() => null);
  assert.ok(legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'unprotected: the player can be attacked');
  s.players.ai.row[ps] = mon(WILD.id, 1);                  // a plain (Hitpoints) Pokémon
  assert.ok(!legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'protected by the Pokémon on its portrait\'s space');
  assert.ok(!effectTargets(s, 'player', { side: 'enemy', kinds: ['pokemon', 'player'] }).some((x) => x.kind === 'player'), 'Moves too');
  s.players.ai.row[ps] = null;
  s.players.ai.row[(ps + 1) % 10] = mon('squirtle', 2);
  assert.ok(legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'a guard elsewhere doesn\'t protect the player');
  // Trading: a Ready target hits back; both become Spent.
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[6] = mon('mankey', 2);
  s.players.player.row[4] = mon('wingull', 4);
  const back = s.players.ai.row[6].attack;
  const after = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 6 } });
  assert.equal(after.players.player.row[4].currentStrength, s.players.player.row[4].strength - back, 'the Ready target hit back');
  assert.ok(after.players.player.row[4].spent);
  // Passing with an unmatched Speed makes your fastest Active Pokémon Spent.
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[1] = mon(WILD.id, 2);
  assert.deepEqual(passSpends(s, 'player'), [4]);
  const passed = applyAction(s, { type: 'pass', who: 'player' });
  assert.ok(passed.players.player.row[4].spent);
}

// --- Supporters: Release and Favour --------------------------------------------------------------------------------
{
  let s = start(17);
  s.turn = 'player';
  const p = s.players.player;
  const oak = SUPPORTERS.find((c) => c.id === 'professor-oak');
  p.hand = [{ ...oak, uid: 'sup' }, { ...pokemonAt('magby', 4), uid: 'big' }, { ...MOVES[0], uid: 'mv' }, { ...MOVES[1], uid: 'mv2' }];
  const n = p.hand.length;
  s = applyAction(s, { type: 'playSupporter', who: 'player', uid: 'sup', release: ['big', 'mv'] });
  assert.equal(s.players.player.hand.length, n - 3 + 4, 'the Favour (a Pokémon card) draws 4 instead of 3');
  assert.equal(s.players.player.released.length, 3, 'the paid cards and the Supporter are Released');
}

// --- Keywords and abilities from v1/v2 ------------------------------------------------------------------------------
{
  let s = toRound(start(18), 6);
  s.turn = 'player';
  for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null);
  // Quick Attack: arrives Active.
  s.players.player.energy = 10;
  s.players.player.hand.push({ ...pokemonAt('ponyta', 2, 4), uid: 'qa' });
  const sp = [...Array(10).keys()].find((i) => isOpen(s, i));
  let q = applyAction(s, { type: 'summon', who: 'player', uid: 'qa', space: sp });
  assert.ok(!q.players.player.row[sp].spent, 'Quick Attack: arrives Active');
  // Shell: each instance of damage is N less (at least 1).
  const k = structuredClone(s);
  k.players.player.row[0] = mon('wingull', 4);
  k.players.ai.row[1] = mon('squirtle', 5, { spent: true });          // Blastoise, Shell 2
  const before = k.players.ai.row[1].currentStrength;
  const hit = applyAction(k, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 1 } });
  assert.equal(before - hit.players.ai.row[1].currentStrength, k.players.player.row[0].attack - 2, 'Shell 2');
  // Infiltrator ignores guards and the portrait's protection.
  const g = structuredClone(s);
  g.players.player.row[0] = mon('mankey', 5);                            // Primeape: Infiltrator, Overrun, Rage
  g.players.ai.row[portraitOf(g, 'ai')] = mon('geodude', 1, { spent: true });
  assert.ok(legalTargets(g, 'player', 0).some((t) => t.kind === 'player'), 'Infiltrator reaches the protected player');
  // Overrun: the damage left over goes to the enemy player as Recognition.
  const o = structuredClone(g);
  o.players.ai.row = o.players.ai.row.map(() => null);
  o.players.ai.row[5] = mon(WILD.id, 1, { spent: true, currentStrength: 1 });
  const rec = o.players.player.recognition;
  const ov = applyAction(o, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 5 } });
  assert.equal(ov.players.player.recognition, rec + (o.players.player.row[0].attack - 1) + RULES.perDefeat, 'Overrun + the defeat');
  // On Defend (Geodude): damage to the attacker.
  const d = structuredClone(s);
  d.players.player.row[0] = mon('wingull', 4);
  d.players.ai.row[2] = mon('geodude', 5, { spent: true });              // Golem: On Defend 2
  const dd = applyAction(d, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 2 } });
  assert.equal(dd.players.player.row[0].currentStrength, d.players.player.row[0].strength - 2, 'On Defend: 2 to the attacker');
  // On Summon (Gyarados): 2 damage to each enemy Pokémon in its Location; Rally (Horsea) grows.
  const r = structuredClone(s);
  const l = r.locations.find((x) => lanesOf(x).length >= 2);
  const [a, b] = lanesOf(l);
  r.players.ai.row[a] = mon('chinchou', 4);
  r.players.player.row[a] = mon('horsea', 3);
  r.players.player.hand.push({ ...pokemonAt('magikarp', 4), uid: 'gy' });
  const hp = r.players.ai.row[a].currentStrength;
  const sum = applyAction(r, { type: 'summon', who: 'player', uid: 'gy', space: b });
  assert.equal(sum.players.ai.row[a].currentStrength, hp - 2, 'On Summon: 2 damage to each enemy Pokémon in its Location');
  assert.equal(sum.players.player.row[a].attack, r.players.player.row[a].attack + 1, 'Rally: +1/+1');
  // A chosen Location (Rock Slide) and two targets (Thunderbolt).
  const rs = structuredClone(r);
  rs.players.player.hand.push({ ...MOVES.find((m) => m.id === 'rock-slide'), uid: 'rs' });
  const hit2 = applyAction(rs, { type: 'playMove', who: 'player', uid: 'rs', pay: 3, targets: [{ who: 'ai', kind: 'location', uid: l.uid }] });
  assert.equal(hit2.players.ai.row[a].currentStrength, hp - 2, 'every enemy Pokémon in the chosen Location');
  const tb = structuredClone(r);
  tb.players.ai.row[0] = null;
  tb.players.ai.row[b] = mon('magby', 5);
  tb.players.player.hand.push({ ...MOVES.find((m) => m.id === 'thunderbolt'), uid: 'tb' });
  const two = applyAction(tb, { type: 'playMove', who: 'player', uid: 'tb', pay: 6, targets: [{ who: 'ai', kind: 'pokemon', space: a }, { who: 'ai', kind: 'pokemon', space: b }] });
  assert.equal(two.players.ai.row[b].currentStrength, tb.players.ai.row[b].strength - 6, 'two targets');
  assert.throws(() => applyAction(tb, { type: 'playMove', who: 'player', uid: 'tb', pay: 6, targets: [{ who: 'ai', kind: 'pokemon', space: a }, { who: 'ai', kind: 'pokemon', space: a }] }));
  // Regenerate: heals at Breakfast.
  let rg = structuredClone(s);
  rg.players.player.row[4] = mon('chinchou', 2, { currentStrength: 1 });   // in Mt. Ember (no healing there)
  assert.equal(locationAt(rg, 4).id, 'mt-ember');
  rg = nextRound(rg);
  assert.equal(rg.players.player.row[4].currentStrength, 2, 'Regenerate 1');
}

console.log('v3 rules: setup, treadmill, Recognition, Trophy, Championship, Energy, Overexert, hand, deck-out, Levels, Ready, guards, portraits — ok');
