// V1 — the v2 core: setup, Energy and storing, summoning, targeting with the guard
// rules (and Infiltrator), trades, Recognition from damage to the player character,
// the win at 60, passing, Supper's Retain (Breakfast draws 7 on top), and the AI playing whole matches.
// Run with: node v2/tests/core.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, legalTargets, isAlert, playable, passSpends, PLAYERS,
} from '../src/engine/game.js';
import { cardDef, TEST_DECK, deckProblems } from '../src/engine/cards.js';
import { LANES, RECOGNITION_TARGET, HAND_SIZE } from '../src/engine/rules.js';
import { chooseAction } from '../src/ai/opponent.js';

// A Round 1 Battle Phase, the player to act, with plenty of Energy and empty rows.
function battle(seed = 5) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'flipCoin' });
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) s.players[who].energy = 10;
  return s;
}
// A Pokémon straight into a space (Active unless spent: true).
let n = 0;
// A card by species, or species@Level (e.g. 'arcanine@5').
const def = (key) => { const [id, level] = key.split('@'); return cardDef(id, level ? Number(level) : undefined); };
function place(s, who, space, id, { spent = false, ...extra } = {}) {
  const card = { ...def(id), uid: `${who}-t${n++}`, ...extra };
  s.players[who].row[space] = { ...card, currentStrength: extra.currentStrength ?? card.strength, spent };
  return card;
}
const give = (s, who, id) => { const card = { ...def(id), uid: `${who}-g${n++}` }; s.players[who].hand.push(card); return card.uid; };
const act = (s, action) => applyAction(s, action);
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: s.turn === 'player' ? 'ai' : 'player' });

// --- Setup ----------------------------------------------------------------------------------

{
  const s = createGame(3);
  assert.deepEqual([s.phase, s.round, legalActions(s, 'player')], ['initiative', 0, ['flipCoin']]);
  for (const who of PLAYERS) {
    const p = s.players[who];
    assert.equal(p.drawPile.length, 40, '40-card deck');
    assert.deepEqual([p.row.length, p.row.every((c) => c === null)], [LANES, true], 'an empty row of 9');
    assert.deepEqual([p.recognition, p.energy, p.hand.length], [0, 0, 0]);
    assert.equal('dollars' in p || 'xp' in p || 'exhaust' in p, false, 'no PokéDollars, XP or Exert');
  }
  const t = applyAction(s, { type: 'flipCoin' });
  assert.equal(t.phase, 'battle');
  assert.equal(t.round, 1);
  assert.equal(t.turn, t.initiative, 'initiative acts first');
  for (const who of PLAYERS) assert.deepEqual([t.players[who].hand.length, t.players[who].energy], [HAND_SIZE, 1], 'Breakfast: 7 cards, 1 Energy');
  assert.throws(() => applyAction(t, { type: 'flipCoin' }));
  // The same seed, the same match.
  assert.deepEqual(applyAction(createGame(3), { type: 'flipCoin' }).players.player.hand.map((c) => c.id), t.players.player.hand.map((c) => c.id));
  assert.deepEqual([TEST_DECK.length, deckProblems(TEST_DECK)], [40, []]);
  assert.ok(t.players.player.hand.every((c) => c.cardType !== 'Pokémon' || c.level === 1), 'Round 1: every Pokémon is Level 1');
}

// --- Energy: the Round number (up to 10), and up to 1 stored ------------------------------------

{
  let s = battle();
  s.players.player.energy = 3;
  s.players.ai.energy = 0;
  s = passBoth(s);   // Supper: store up to 1; Round 2 Breakfast
  assert.equal(s.round, 2);
  assert.deepEqual([s.players.player.stored, s.players.player.roundEnergy, s.players.player.energy], [1, 2, 3], '2 + 1 stored');
  assert.deepEqual([s.players.ai.stored, s.players.ai.energy], [0, 2], 'nothing left: nothing stored');
  assert.equal(s.initiative, 'ai', 'initiative switches each Round');
  // Spending it all leaves nothing to store.
  s.players.player.energy = 0;
  s = passBoth(s);
  assert.deepEqual([s.players.player.stored, s.players.player.energy], [0, 3]);
  // Up to 10.
  s.round = 11;
  s = passBoth(s);
  assert.equal(s.players.player.roundEnergy, 10, 'Base Energy stops at 10');
}

// --- Summoning ------------------------------------------------------------------------------------

{
  let s = battle();
  const uid = give(s, 'player', 'magmar@4');   // cost 3
  s.players.player.energy = 2;
  assert.ok(!playable(s, 'player').some((c) => c.uid === uid), 'too expensive');
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid, space: 0 }), /Not enough Energy/);
  s.players.player.energy = 4;
  s = act(s, { type: 'summon', who: 'player', uid, space: 4 });
  const m = s.players.player.row[4];
  assert.deepEqual([m.name, m.spent, s.players.player.energy, s.turn], ['Magmar', true, 1, 'ai'], 'paid, arrives Spent, turn passes');
  assert.ok(!s.players.player.hand.some((c) => c.uid === uid));
  // Only into an empty space of your own row.
  s.turn = 'player';
  s.players.player.energy = 9;
  const uid2 = give(s, 'player', 'horsea');
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid: uid2, space: 4 }), /empty space/);
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid: uid2, space: 9 }), /empty space/);
  // Quick Attack arrives Active (Ponyta's Empowered summon gives it).
  const pony = give(s, 'player', 'ponyta');
  s = act(s, { type: 'summon', who: 'player', uid: pony, space: 0, empowered: true });
  assert.equal(s.players.player.row[0].spent, false);
  // Not on the opponent's turn.
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid: uid2, space: 1 }), /cannot summon/);
}

// --- Alert and targeting with guards ------------------------------------------------------------

{
  const s = battle();
  place(s, 'player', 0, 'growlithe');   // Swift, Physical
  place(s, 'player', 1, 'horsea');      // Steady, Special
  place(s, 'ai', 2, 'charmander');      // Steady
  assert.ok(isAlert(s, s.players.player.row[0]), 'the fastest Active Pokémon is Alert');
  assert.ok(!isAlert(s, s.players.player.row[1]), 'a slower one is not');
  const targets = (from) => legalTargets(s, 'player', from).map((t) => (t.kind === 'player' ? 'player' : t.space)).sort();
  assert.deepEqual(targets(0), [2, 'player'], 'no guards: any enemy Pokémon or the player character');
  // A Defence guard: Physical attackers must attack it (the player character too is guarded).
  place(s, 'ai', 5, 'quagsire');
  assert.deepEqual(targets(0), [5]);
  // A Special attacker ignores Defence guards, but must attack a Special Defence one.
  assert.deepEqual(targets(1).sort(), [2, 5, 'player'].sort());
  place(s, 'ai', 7, 'chinchou');
  assert.deepEqual(targets(1), [7]);
  // Infiltrator ignores both.
  place(s, 'player', 3, 'sneasel');
  assert.deepEqual(targets(3).sort(), [2, 5, 7, 'player'].sort());
}

// --- Attacks, trades and defeats --------------------------------------------------------------

{
  let s = battle();
  place(s, 'player', 0, 'growlithe');            // 3 / 3, Swift
  place(s, 'ai', 4, 'ponyta@2');                 // 3 / 4, Swift, Active: hits back
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 4 } });
  assert.equal(s.players.ai.row[4].currentStrength, 4 - 3);
  assert.equal(s.players.player.row[0], null, 'the trade defeated Growlithe (3 − 3)');
  assert.equal(s.players.player.released.length, 1, 'to the Released Pile');
  assert.equal(s.players.ai.row[4].spent, true, 'both Spent after a trade');
  const e = s.events.find((x) => x.type === 'attack');
  assert.deepEqual([e.trades, e.back], [true, 3]);
  // A Spent target doesn't hit back.
  s = battle();
  place(s, 'player', 0, 'arcanine@5');           // 6 / 6
  place(s, 'ai', 1, 'sudowoodo@4', { spent: true });  // 8
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 1 } });
  assert.deepEqual([s.players.ai.row[1].currentStrength, s.players.player.row[0].currentStrength], [2, 6]);
  // Only Alert Pokémon attack.
  s.turn = 'player';
  place(s, 'player', 2, 'horsea');
  place(s, 'player', 3, 'growlithe');   // Active and Swift: Horsea (Steady) isn't Alert
  assert.throws(() => act(s, { type: 'attack', who: 'player', from: 2, target: { kind: 'player' } }), /cannot attack|Alert/);
}

// --- Recognition: damage to the player character, and the win at 60 --------------------------------

{
  let s = battle();
  place(s, 'player', 0, 'arcanine@5');   // Attack 6
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.players.player.recognition, 6, '6 damage → 6 Recognition');
  assert.equal(s.players.ai.recognition, 0, 'the target loses nothing');
  assert.deepEqual(s.events.filter((x) => x.type === 'recognition').map((x) => [x.who, x.amount, x.total]), [['player', 6, 6]]);
  assert.equal(s.players.player.row[0].spent, true);
  // Reaching 60 wins at once.
  s = battle();
  place(s, 'player', 0, 'arcanine@5');
  s.players.player.recognition = RECOGNITION_TARGET - 6;
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.deepEqual([s.phase, s.winner, s.players.player.recognition], ['gameOver', 'player', 60]);
  assert.deepEqual(legalActions(s, 'player'), []);
  // 59 is not enough.
  s = battle();
  place(s, 'player', 0, 'arcanine@5');
  s.players.player.recognition = RECOGNITION_TARGET - 7;
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.equal(s.phase, 'battle');
}

// --- Passing --------------------------------------------------------------------------------------

{
  let s = battle();
  s.players.player.energy = 2;
  s = act(s, { type: 'pass', who: 'player' });
  assert.deepEqual([s.players.player.energy, s.turn, s.passesInARow], [3, 'ai', 1], '+1 Energy');
  const before = s.players.ai.energy;
  s = act(s, { type: 'pass', who: 'ai' });
  assert.equal(s.round, 2, 'a second Pass in a row ends the Battle Phase');
  assert.equal(s.events.find((x) => x.type === 'pass').gain, 0, 'and gains nothing');
  assert.ok(before >= 0);
  // An Action in between resets the count.
  s = battle();
  s = act(s, { type: 'pass', who: 'player' });
  const uid = give(s, 'ai', 'horsea');
  s = act(s, { type: 'summon', who: 'ai', uid, space: 0 });
  s = act(s, { type: 'pass', who: 'player' });
  assert.equal(s.round, 1, 'not two in a row');
  // Unmatched speed: passing makes your top-Speed Active Pokémon Spent.
  s = battle();
  place(s, 'player', 0, 'growlithe');
  place(s, 'ai', 0, 'horsea');
  assert.deepEqual(passSpends(s, 'player'), [0]);
  s = act(s, { type: 'pass', who: 'player' });
  assert.equal(s.players.player.row[0].spent, true);
  // Matched: the opponent has an Active Pokémon of that Speed too.
  s = battle();
  place(s, 'player', 0, 'growlithe');
  place(s, 'ai', 0, 'ponyta');
  assert.deepEqual(passSpends(s, 'player'), []);
}

// --- Supper and Breakfast: the hand is discarded except Retain; Spent Pokémon become Active ----------

{
  let s = battle();
  s.players.player.hand = [];
  give(s, 'player', 'oddish');   // Retain
  give(s, 'player', 'horsea');
  place(s, 'player', 0, 'growlithe', { spent: true });
  s = passBoth(s);
  const hand = s.players.player.hand;
  assert.equal(hand.filter((c) => c.id === 'oddish').length >= 1, true, 'Oddish (Retain) kept');
  assert.equal(hand.length, 1 + HAND_SIZE, 'Breakfast draws 7 on top of the kept card (Elliott\'s ruling)');
  assert.ok(s.players.player.discard.some((c) => c.id === 'horsea'), 'Horsea discarded');
  assert.equal(s.players.player.row[0].spent, false, 'Active again at Breakfast');
}

// --- The AI plays whole matches through the same actions ---------------------------------------------

{
  const results = { player: 0, ai: 0, unfinished: 0 };
  for (let seed = 1; seed <= 12; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 4000 && s.phase !== 'gameOver' && s.round < 40; guard++) {
      const who = s.phase === 'initiative' ? 'player' : s.turn;
      const action = chooseAction(s, who, { rng });
      assert.ok(action, 'always a move');
      assert.ok(legalActions(s, who).includes(action.type), `${action.type} is legal`);
      s = applyAction(s, action);
    }
    if (s.phase === 'gameOver' && s.winner) {
      results[s.winner] += 1;
      if (s.result.reason === 'target') assert.ok(s.players[s.winner].recognition >= RECOGNITION_TARGET);
    } else if (s.phase !== 'gameOver') results.unfinished += 1;
  }
  assert.equal(results.unfinished, 0, 'every match ends (60 Recognition, or after Round 12)');
  assert.ok(results.player > 0 && results.ai > 0, 'either side can win');
  // It takes a win when it sees one.
  let s = battle();
  s.turn = 'ai';
  place(s, 'ai', 0, 'arcanine@5');
  s.players.ai.recognition = 55;
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'attack', who: 'ai', from: 0, target: { kind: 'player' } });
}

console.log('All v2 core tests passed.');
