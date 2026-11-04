// V3-0's rules (docs/v3-foundations.md; the numbers in v3/src/rules.js). Run: node v3/tests/rules.test.js
import assert from 'node:assert/strict';
import { RULES, levelFor, costFor } from '../src/rules.js';
import {
  createGame, applyAction, actor, legalActions, isOpen, furthestOpen, portraitOf, locationAt, legalTargets, isReady,
  readySpaces, gainRecognition, passSpends, effectTargets, lanesOf,
} from '../src/engine/game.js';
import { pokemonAt, TEST_DECK, SERIES, MOVES, SUPPORTERS } from '../src/engine/cards.js';
import { LOCATIONS } from '../src/engine/locations.js';

const QUEUE = ['viridian-forest', 'pokemon-center', 'cerulean-cape', 'mt-ember', 'lake-of-rage', 'floaroma-meadow', 'viridian-forest', 'cerulean-cape', 'mt-ember'];
const start = (seed = 1, queue = QUEUE) => {
  let s = createGame(seed, { locations: queue });
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
  // Cards: about 10 series, Light/Medium/Heavy, every Speed-Tier, Physical and Special, guards; 4 Moves; 2 Supporters.
  assert.equal(SERIES.length, 10);
  for (const band of ['Light', 'Medium', 'Heavy']) assert.ok(SERIES.some((x) => x.band === band));
  for (const sp of ['Slow', 'Steady', 'Swift']) assert.ok(SERIES.some((x) => x.speed === sp));
  assert.ok(SERIES.some((x) => x.guard === 'Defence') && SERIES.some((x) => x.guard === 'Special Defence'));
  assert.equal(MOVES.length, 4);
  assert.equal(SUPPORTERS.length, 2);
  // Each higher breakpoint gives more value per Energy.
  for (const mv of MOVES) {
    // ("every one of your Pokémon" counted as two)
    const value = (b) => b.ops.reduce((n, o) => n + o.amount * (o.op === 'healAll' ? 2 : 1), 0) / b.cost;
    for (let i = 1; i < mv.breakpoints.length; i++) assert.ok(value(mv.breakpoints[i]) > value(mv.breakpoints[i - 1]), `${mv.name}: breakpoint ${i + 1} is better value`);
  }
  assert.equal(LOCATIONS.length, 6);
}

// --- The treadmill ----------------------------------------------------------------------------------
{
  let s = start(2);
  // A Pokémon summoned in Pallet Town on space 2 stays there as the Locations pass through.
  s.players.player.hand.unshift(mon('sprout', 1));
  s.turn = 'player';
  s.players.player.energy = 5;
  s = applyAction(s, { type: 'summon', who: 'player', uid: s.players.player.hand[0].uid, space: 1 });
  const uid = s.players.player.row[1].uid;
  assert.equal(locationAt(s, 1).id, 'pallet-town');
  s = nextRound(s);
  assert.deepEqual(span(s), ['pallet-town@0+2', 'viridian-forest@2+3'], 'Round 2: a new Location on the right; the board grows');
  assert.ok(isOpen(s, 4) && !isOpen(s, 5));
  s = nextRound(s);
  assert.deepEqual(span(s), ['pallet-town@0+2', 'viridian-forest@2+3', 'pokemon-center@5+1'], 'widths 1–3');
  s = nextRound(s);
  assert.deepEqual(span(s), ['pallet-town@0+2', 'viridian-forest@2+3', 'pokemon-center@5+1', 'cerulean-cape@6+2']);
  assert.equal(furthestOpen(s), 7);
  // Round 5: Mt. Ember (3) doesn't fit: the board is full after it and shifts 1 left.
  s.players.player.recognition = 0;
  s = nextRound(s);
  assert.deepEqual(span(s), ['pallet-town@-1+2', 'viridian-forest@1+3', 'pokemon-center@4+1', 'cerulean-cape@5+2', 'mt-ember@7+3'], 'it fills the 10 spaces, shifting by what overflows');
  assert.equal(furthestOpen(s), 9);
  assert.equal(lanesOf(s.locations[0]).length, 1, 'Pallet Town has 1 lane left');
  assert.equal(s.players.player.row[1].uid, uid, 'the Pokémon stayed on space 2');
  assert.equal(locationAt(s, 1).id, 'viridian-forest', '…which now belongs to Viridian Forest');
  // Round 6: the board is full, so Lake of Rage (2) shifts everything 2 left: Pallet Town falls off.
  const pallet = s.locations.find((l) => l.id === 'pallet-town');
  pallet.completed.player = true;   // its completion reward comes as it leaves
  const before = s.players.player.recognition;
  s = nextRound(s);
  assert.deepEqual(span(s), ['viridian-forest@-1+3', 'pokemon-center@2+1', 'cerulean-cape@3+2', 'mt-ember@5+3', 'lake-of-rage@8+2']);
  assert.ok(s.events.some((e) => e.type === 'locationRemoved' && e.id === 'pallet-town'), 'Locations falling off the left are removed');
  assert.equal(s.players.player.recognition, before + 3 + RULES.passivePerRound, 'the completion reward is given when it leaves');
  assert.equal(s.players.player.row[1].uid, uid, 'Pokémon never move with the Locations');
  for (let i = 0; i < RULES.spaces; i++) assert.ok(isOpen(s, i), 'once full, the board stays full');
  // Round 7: Floaroma Meadow (1) shifts 1.
  s = nextRound(s);
  assert.deepEqual(span(s), ['viridian-forest@-2+3', 'pokemon-center@1+1', 'cerulean-cape@2+2', 'mt-ember@4+3', 'lake-of-rage@7+2', 'floaroma-meadow@9+1']);
}

// --- Closed spaces: no summoning there ---------------------------------------------------------------
{
  const s = start(3);
  s.turn = 'player';
  s.players.player.hand.unshift(mon('sprout', 1));
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
  s.players.player.row[0] = mon('rock-hound', 6);
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[3] = mon('sprout', 1, { spent: true });
  const r0 = s.players.player.recognition;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 3 } });
  assert.equal(s.players.player.recognition, r0 + RULES.perDefeat, '+2 for defeating a Pokémon');
  assert.equal(s.players.ai.released.at(-1).name, 'Sprout', 'defeated Pokémon go to the Released Pile');
  s = nextRound(s);
  s.turn = 'player';
  const r1 = s.players.player.recognition;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition, r1 + s.players.player.row[0].attack * RULES.perDamageToPlayer, '1 per damage to the enemy player');
  // +2 at each Breakfast.
  const r2 = { player: s.players.player.recognition, ai: s.players.ai.recognition };
  s = nextRound(s);
  assert.equal(s.players.player.recognition - r2.player, RULES.passivePerRound);
}

// --- Winning at 100 (the Trophy on space 10) ------------------------------------------------------------
{
  let s = start(6);
  gainRecognition(s, 'player', 120, 'test');
  assert.equal(s.phase, 'battle', 'not before space 10 is open');
  assert.equal(portraitOf(s, 'player'), 1);
  s = toRound(s, 5);   // Mt. Ember opens space 10
  assert.equal(s.phase, 'gameOver');
  assert.equal(s.winner, 'player');
  assert.equal(s.result.reason, 'trophy');
  let t = toRound(start(7), 6);
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
  assert.deepEqual(span(s), ['regional-championship@0+10'], 'the 10th Location covers every space; the others leave');
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
  assert.equal(pokemonAt('iron-brute', 4).cost, 5);
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
  s.players.player.row[4] = mon('rock-hound', 4);           // Swift, Physical
  s.players.player.row[5] = mon('sprout', 4);               // Slow
  s.players.ai.row[4] = mon('mist-warden', 4);              // Steady
  assert.deepEqual(readySpaces(s, 'player'), [4], 'only the highest Speed among all Active Pokémon is Ready');
  assert.ok(!isReady(s, s.players.ai.row[4]));
  s.players.player.row[4].spent = true;
  assert.ok(isReady(s, s.players.ai.row[4]), 'with the Swift one Spent, Steady is the top');
  s.players.player.row[4].spent = false;
  // Guards: in the enemy's Location, a Defence guard protects the others from Physical attackers.
  const l = locationAt(s, 7);
  const lanes = lanesOf(l);
  assert.ok(lanes.length >= 2, 'a wide Location for the guard test');
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[lanes[0]] = mon('shell-guard', 4);       // Defence guard
  s.players.ai.row[lanes[1]] = mon('river-runner', 4);
  let t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space);
  assert.deepEqual(t, [lanes[0]], 'a Physical attacker must target the Defence guard there');
  s.players.player.row[4] = mon('storm-wing', 4);           // Swift, Special
  t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space).sort();
  assert.deepEqual(t, [lanes[0], lanes[1]].sort(), 'a Defence guard doesn\'t stop a Special attacker');
  s.players.ai.row[lanes[0]] = mon('mist-warden', 4);       // Special Defence guard
  t = legalTargets(s, 'player', 4).filter((x) => x.kind === 'pokemon').map((x) => x.space);
  assert.deepEqual(t, [lanes[0]], 'a Special Defence guard stops a Special attacker');
  // Portrait protection: only a Pokémon on the enemy portrait's space, whatever its Strength-Type.
  const ps = portraitOf(s, 'ai');
  s.players.ai.row = s.players.ai.row.map(() => null);
  assert.ok(legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'unprotected: the player can be attacked');
  s.players.ai.row[ps] = mon('sprout', 1);                  // a plain (Hitpoints) Pokémon
  assert.ok(!legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'protected by the Pokémon on its portrait\'s space');
  assert.ok(!effectTargets(s, 'player', { side: 'enemy', kinds: ['pokemon', 'player'] }).some((x) => x.kind === 'player'), 'Moves too');
  s.players.ai.row[ps] = null;
  s.players.ai.row[(ps + 1) % 10] = mon('shell-guard', 4);
  assert.ok(legalTargets(s, 'player', 4).some((x) => x.kind === 'player'), 'a guard elsewhere doesn\'t protect the player');
  // Trading: a Ready target hits back; both become Spent.
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[6] = mon('swift-striker', 4);
  s.players.player.row[4] = mon('rock-hound', 4);
  const back = s.players.ai.row[6].attack;
  const after = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 6 } });
  assert.equal(after.players.player.row[4].currentStrength, s.players.player.row[4].strength - back, 'the Ready target hit back');
  assert.ok(after.players.player.row[4].spent);
  // Passing with an unmatched Speed makes your fastest Active Pokémon Spent.
  s.players.ai.row = s.players.ai.row.map(() => null);
  s.players.ai.row[1] = mon('sprout', 2);
  assert.deepEqual(passSpends(s, 'player'), [4]);
  const passed = applyAction(s, { type: 'pass', who: 'player' });
  assert.ok(passed.players.player.row[4].spent);
}

// --- Supporters: Release and Favour --------------------------------------------------------------------------------
{
  let s = start(17);
  s.turn = 'player';
  const p = s.players.player;
  p.hand = [{ ...SUPPORTERS[0], uid: 'sup' }, mon('iron-brute', 4, { uid: 'big' }), mon('sprout', 1, { uid: 'small' })];
  p.hand.forEach((c) => { delete c.currentStrength; delete c.spent; });
  const r = p.recognition;
  s = applyAction(s, { type: 'playSupporter', who: 'player', uid: 'sup', release: ['big'] });
  assert.equal(s.players.player.recognition, r + 3, 'the Favour (a Level 4+ Pokémon) adds +3 Recognition');
  assert.equal(s.players.player.released.length, 2, 'the paid card and the Supporter are Released');
}

console.log('v3 rules: setup, treadmill, Recognition, Trophy, Championship, Energy, Overexert, hand, deck-out, Levels, Ready, guards, portraits — ok');
