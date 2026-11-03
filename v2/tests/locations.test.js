// V2 — Locations as shared lanes, objectives, the Championship and the end of the match.
// Placement (width, free lanes, over Pokémon), the timer, both players' progress,
// milestones and completion rewards, the Championship's arrival and its effect on
// other Locations, the Round-12 end and the tiebreakers, the instant win at 60, and
// AI-vs-AI matches that finish (with a count of how they end).
// Run with: node v2/tests/locations.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, locationStarts, locationAt, placeable, pokemonIn, weatherTotals,
  championship, PLAYERS,
} from '../src/engine/game.js';
import { cardDef, TEST_DECK } from '../src/engine/cards.js';
import { lastsText } from '../src/engine/locations.js';
import { TEST_LOCATIONS, CHAMPIONSHIP, rewardText } from '../src/engine/locations.js';
import { LANES, RECOGNITION_TARGET, ROUND_LIMIT, CHAMPIONSHIP_ROUND, HAND_SIZE } from '../src/engine/rules.js';
import { chooseAction } from '../src/ai/opponent.js';

// A Battle Phase in `round`, the player to act, plenty of Energy, empty rows and hands.
function battle(round = 1, seed = 5) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'flipCoin' });
  s.round = round;
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) Object.assign(s.players[who], { energy: 10, hand: [] });
  return s;
}
let n = 0;
const def = (key) => { const [id, level] = key.split('@'); return cardDef(id, level ? Number(level) : undefined); };
function place(s, who, space, id, { spent = false } = {}) {
  const card = { ...def(id), uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent };
}
const give = (s, who, id) => { const card = { ...def(id), uid: `${who}-g${n++}` }; s.players[who].hand.push(card); return card.uid; };
const act = (s, action) => applyAction(s, action);
const other = (who) => (who === 'player' ? 'ai' : 'player');
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: other(s.turn) });
// Play a Location for `who` (it must be their turn).
function playLoc(s, who, id, start) {
  s.turn = who;
  const uid = give(s, who, id);
  return act(s, { type: 'playLocation', who, uid, start });
}

// --- The deck and the data ---------------------------------------------------------------------

{
  assert.equal(TEST_DECK.length, 40, '40 cards');
  assert.equal(lastsText(4), 'Lasts 4 Rounds, including this one', "the timer's wording (Elliott's ruling)");
  assert.equal(TEST_LOCATIONS.length, 5);
  for (const loc of TEST_LOCATIONS) {
    assert.ok([1, 2, 3].includes(loc.lanes), `${loc.name}: 1–3 lanes`);
    assert.ok(loc.rounds >= 1 && loc.objective.count >= 1 && loc.milestones.every((m) => m.at < loc.objective.count));
    assert.ok(Object.keys(loc.weather).every((k) => ['Rain', 'Sun'].includes(k)), 'Rain/Sun Weather Tokens');
  }
  assert.deepEqual([CHAMPIONSHIP.lanes, CHAMPIONSHIP.championship], [LANES, true]);
  assert.equal(rewardText({ recognition: 6, energy: 1, draw: 1 }), '+6 Recognition, +1 Energy next Round, draw 1');
}

// --- Placement: width, free lanes, over Pokémon, both sides, never replaced ----------------------------

{
  let s = battle();
  const route = cardDef('route-119');   // 3 lanes
  assert.deepEqual(locationStarts(s, route), [0, 1, 2, 3, 4, 5, 6], 'a 3-lane Location starts at lanes 1–7');
  place(s, 'player', 4, 'horsea');
  place(s, 'ai', 5, 'growlithe');
  const energy = s.players.player.energy;
  s = playLoc(s, 'player', 'route-119', 3);
  const loc = locationAt(s, 4);
  assert.deepEqual([loc.name, loc.lanes, loc.owner, loc.roundsLeft], ['Route 119', [3, 4, 5], 'player', 5]);
  assert.equal(s.players.player.energy, energy, 'Locations cost 0');
  assert.equal(s.turn, 'ai', 'placing a Location is a Battle Action');
  assert.deepEqual([pokemonIn(s, 'player', loc), pokemonIn(s, 'ai', loc)], [1, 1], 'Pokémon already there are now in it, on both sides');
  assert.equal(locationAt(s, 2), null, 'lane 3 is still Home');
  // Free lanes only: a 2-lane Location can't overlap it, and nothing replaces it.
  const cape = cardDef('cerulean-cape');
  assert.deepEqual(locationStarts(s, cape), [0, 1, 6, 7]);
  assert.throws(() => playLoc(s, 'ai', 'cerulean-cape', 2), /free Home lanes/);
  assert.throws(() => playLoc(s, 'ai', 'mt-ember', 4), /free Home lane/);
  s = playLoc(s, 'ai', 'mt-ember', 8);   // 1 lane, at the edge
  assert.deepEqual(locationAt(s, 8).lanes, [8]);
  assert.throws(() => playLoc(s, 'player', 'cerulean-cape', 8), /free Home lanes/, 'no room past the last lane');
  // Weather Tokens add up across the Locations in play.
  assert.deepEqual(weatherTotals(s), { Rain: 3, Sun: 2 });
  // A Location in hand with no room is not playable.
  s = battle();
  for (const [id, start] of [['route-119', 0], ['route-119', 3], ['eterna-forest', 6]]) s = playLoc(s, 'player', id, start);
  s.turn = 'player';
  give(s, 'player', 'mt-ember');
  assert.deepEqual([placeable(s, 'player').length, legalActions(s, 'player').includes('playLocation')], [0, false], 'no free lane, no Location');
}

// --- The timer: it ends when its Rounds run out, its lanes become Home, its card is discarded ------------

{
  let s = battle();
  s = playLoc(s, 'player', 'cerulean-cape', 0);   // 4 Rounds: Rounds 1–4
  for (let round = 1; round <= 3; round++) {
    s = passBoth(s);
    assert.equal(s.round, round + 1);
    assert.equal(locationAt(s, 0)?.roundsLeft, 4 - round, `Round ${round + 1}: ${4 - round} left`);
  }
  s = passBoth(s);
  assert.equal(locationAt(s, 0), null, 'gone after Round 4\'s Supper');
  assert.ok(s.events.some((e) => e.type === 'locationEnded' && e.why === 'timer'));
  assert.ok(s.players.player.discard.some((c) => c.id === 'cerulean-cape'), 'its card goes to the discard pile');
  assert.deepEqual(locationStarts(s, cardDef('route-119')).length, 7, 'every lane is Home again');
}

// --- Both players' progress; milestones and completion rewards ----------------------------------------

{
  // Summon objective (Cerulean Cape: 3 summons; at 2: +1 Energy next Round; completion +3 Recognition).
  let s = battle();
  s = playLoc(s, 'player', 'cerulean-cape', 0);
  const summon = (who, space) => { s.turn = who; s = act(s, { type: 'summon', who, uid: give(s, who, 'horsea'), space }); };
  summon('ai', 1);
  summon('player', 0);
  summon('player', 5);   // outside the Location: no progress
  let loc = locationAt(s, 0);
  assert.deepEqual(loc.progress, { player: 1, ai: 1 }, 'each player has their own progress');
  summon('player', 1);
  loc = locationAt(s, 0);
  assert.deepEqual([loc.progress.player, loc.reached.player, s.players.player.bonusNext], [2, [2], 1], 'milestone: +1 Energy next Round');
  assert.ok(s.events.some((e) => e.type === 'milestone' && e.who === 'player' && e.at === 2));
  // Free the spaces and finish it.
  s.players.player.row[0] = null;
  const before = s.players.player.recognition;
  summon('player', 0);
  loc = locationAt(s, 0);
  assert.deepEqual([loc.completed.player, s.players.player.recognition - before], [true, 3], 'completion: +3 Recognition');
  // Once only.
  s.players.player.row[0] = null;
  summon('player', 0);
  assert.equal(s.players.player.recognition - before, 3, 'each player completes it once');
  assert.deepEqual([locationAt(s, 0).progress.ai, locationAt(s, 0).completed.ai], [1, false], 'the opponent keeps working on it');
  // The Energy arrives at the next Breakfast.
  s = passBoth(s);
  assert.equal(s.players.player.energy, 2 + s.players.player.stored + 1, 'Base 2 + stored + 1 from the milestone');
  assert.equal(s.players.player.bonusNext, 0);
}
{
  // Attack objective (Eterna Forest: 5 attacks from it; at 2: find an Item; at 4: +1 Recognition).
  let s = battle();
  s = playLoc(s, 'player', 'eterna-forest', 0);
  place(s, 'player', 1, 'arcanine@5');
  place(s, 'player', 6, 'growlithe');
  const bag = s.players.player.bag.length;
  const attack = (from) => { s.turn = 'player'; s.players.player.row[from].spent = false; s = act(s, { type: 'attack', who: 'player', from, target: { kind: 'player' } }); };
  attack(1);
  attack(6);   // outside: no progress
  assert.equal(locationAt(s, 0).progress.player, 1);
  attack(1);
  assert.equal(s.players.player.bag.length, bag + 1, 'milestone at 2: find an Item (into the Bag)');
}
{
  // Damage to the enemy player counts only by your Pokémon in the Location (Elliott's
  // ruling; Mt. Ember: 10 damage; at 5: draw 1; completion +3).
  let s = battle();
  s = playLoc(s, 'ai', 'mt-ember', 8);
  place(s, 'player', 0, 'arcanine@5');   // 6 Attack, not in the Location
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.deepEqual([locationAt(s, 8).progress.player, s.players.player.recognition], [0, 6], 'from outside: no progress');
  s.players.player.row[0] = null;
  place(s, 'player', 8, 'arcanine@5');   // in Mt. Ember
  const hit = () => { s.turn = 'player'; s.players.player.row[8].spent = false; s = act(s, { type: 'attack', who: 'player', from: 8, target: { kind: 'player' } }); };
  hit();
  assert.equal(locationAt(s, 8).progress.player, 6);
  hit();
  assert.deepEqual([locationAt(s, 8).progress.player, locationAt(s, 8).completed.player, s.players.player.recognition], [10, true, 18 + 3], 'capped at 10; +3 on completion');
}
{
  // Defeats count for whoever defeats with a Pokémon in the Location (Elliott's
  // ruling): the attacker, or an Alert defender hitting back (Stark Mountain, lanes 4–5).
  let s = battle();
  s = playLoc(s, 'player', 'stark-mountain', 3);
  place(s, 'ai', 0, 'growlithe');        // 3 Attack, 3 HP, Swift (Alert), outside
  place(s, 'player', 4, 'arcanine@5');   // Swift, in it
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 0 } });
  // Arcanine (6) defeats Growlithe; Growlithe was Alert and hit back for 3 (Arcanine survives).
  assert.deepEqual(locationAt(s, 3).progress, { player: 1, ai: 0 }, 'the target may stand anywhere');
  place(s, 'player', 7, 'arcanine@5');   // outside
  place(s, 'ai', 1, 'growlithe');
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 7, target: { kind: 'pokemon', space: 1 } });
  assert.deepEqual(locationAt(s, 3).progress, { player: 1, ai: 0 }, 'a defeat from outside does not count');
  // The hit back in a trade counts for the defender, if it stands in the Location.
  place(s, 'ai', 3, 'ponyta@2');   // Swift 3/4, in it
  s.players.player.row[4] = null;
  s.players.player.row[7] = null;
  place(s, 'player', 6, 'growlithe');   // Swift 3/3: trades with Ponyta and is defeated
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 6, target: { kind: 'pokemon', space: 3 } });
  assert.deepEqual(locationAt(s, 3).progress, { player: 1, ai: 1 }, 'the opponent\'s hit back from its lane counts for it');
}
{
  // Presence at Supper (Route 119: 3 Pokémon in it at Supper; at 2: +1 Energy; completion +4).
  let s = battle();
  s = playLoc(s, 'player', 'route-119', 0);
  place(s, 'player', 0, 'horsea');
  place(s, 'player', 1, 'horsea');
  place(s, 'ai', 2, 'horsea');
  s.turn = 'player';
  s = passBoth(s);
  assert.deepEqual(locationAt(s, 0).progress, { player: 2, ai: 1 }, 'counted at Supper');
  assert.equal(s.players.player.energy, s.players.player.roundEnergy + s.players.player.stored + 1, 'milestone Energy at Breakfast');
  s.players.player.row[0] = null;
  s = passBoth(s);
  assert.equal(locationAt(s, 0).progress.player, 2, 'progress is the most there at a Supper so far');
  place(s, 'player', 0, 'horsea');
  place(s, 'player', 2, 'horsea');
  const before = s.players.player.recognition;
  s = passBoth(s);
  assert.deepEqual([locationAt(s, 0).completed.player, s.players.player.recognition - before], [true, cardDef('route-119').completion.recognition]);
}

// --- The Championship: Round 10, all 9 lanes, every other Location ends --------------------------------

{
  let s = battle(CHAMPIONSHIP_ROUND - 1);
  s = playLoc(s, 'player', 'cerulean-cape', 0);
  s = playLoc(s, 'ai', 'route-119', 4);
  // A milestone earned before it arrives is kept.
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'horsea'), space: 0 });
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'horsea'), space: 1 });
  assert.equal(s.players.player.bonusNext, 1);
  place(s, 'ai', 5, 'sudowoodo');
  s.turn = 'player';
  s = passBoth(s);
  assert.equal(s.round, CHAMPIONSHIP_ROUND);
  assert.equal(s.locations.length, 1, 'every other Location ended');
  const champ = championship(s);
  assert.deepEqual([champ.name, champ.lanes.length, champ.roundsLeft, champ.owner], ['The Championship', LANES, 3, null]);
  assert.ok(s.events.some((e) => e.type === 'championship'));
  assert.equal(s.events.filter((e) => e.type === 'locationEnded' && e.why === 'championship').length, 2);
  assert.equal(s.players.player.energy, s.players.player.roundEnergy + s.players.player.stored + 1, 'the milestone Energy is kept');
  assert.deepEqual([s.players.player.row[0]?.id, s.players.ai.row[5]?.id], ['horsea', 'sudowoodo'], 'Pokémon stay where they are, now in the Championship');
  assert.deepEqual([pokemonIn(s, 'player', champ), pokemonIn(s, 'ai', champ)], [2, 1]);
  // No room for other Locations now.
  s.turn = 'player';
  give(s, 'player', 'mt-ember');
  assert.equal(legalActions(s, 'player').includes('playLocation'), false);
  // Its milestones give large Recognition: attacks from anywhere count.
  s.players.player.row[0].spent = false;
  const r0 = s.players.player.recognition;
  for (let i = 0; i < 3; i++) {
    s.turn = 'player';
    s.players.player.row[0].spent = false;
    s.players.ai.row[5] = null;
    s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  }
  assert.equal(championship(s).progress.player, 3);
  assert.equal(s.players.player.recognition - r0, 3 * 2 + CHAMPIONSHIP.milestones[0].reward.recognition, '3 hits of 2 + the first milestone');
  // It stays through Round 12.
  s = passBoth(s);
  s = passBoth(s);
  assert.deepEqual([s.round, championship(s).roundsLeft], [ROUND_LIMIT, 1]);
}

// --- The end of the match: Round 12, the tiebreakers, sudden death --------------------------------------

function round12({ player, ai, champ = { player: 0, ai: 0 } }) {
  let s = battle(CHAMPIONSHIP_ROUND - 1);
  s = passBoth(s);   // Round 10: the Championship arrives
  s = passBoth(s);
  s = passBoth(s);   // Round 12
  assert.equal(s.round, ROUND_LIMIT);
  s.players.player.recognition = player;
  s.players.ai.recognition = ai;
  championship(s).progress = { ...champ };
  return s;
}
{
  let s = round12({ player: 40, ai: 44 });
  s = passBoth(s);
  assert.deepEqual([s.phase, s.winner, s.result.reason, s.round], ['gameOver', 'ai', 'recognition', ROUND_LIMIT], 'after Round 12\'s Supper the highest Recognition wins');
  // A tie goes to the most Championship progress.
  s = round12({ player: 40, ai: 40, champ: { player: 5, ai: 3 } });
  s = passBoth(s);
  assert.deepEqual([s.winner, s.result.reason], ['player', 'championship']);
  // Still tied: one sudden-death Round (the Championship stays for it).
  s = round12({ player: 40, ai: 40, champ: { player: 4, ai: 4 } });
  s = passBoth(s);
  assert.deepEqual([s.phase, s.round, s.suddenDeath, championship(s)?.roundsLeft], ['battle', ROUND_LIMIT + 1, true, 1]);
  assert.ok(s.events.some((e) => e.type === 'suddenDeath'));
  // Sudden death: the highest Recognition at its Supper wins.
  s.players.ai.recognition += 2;
  s = passBoth(s);
  assert.deepEqual([s.phase, s.winner, s.result.reason, s.round], ['gameOver', 'ai', 'suddenDeath', ROUND_LIMIT + 1]);
  // Tied even after that: a draw (placeholder until Elliott rules).
  s = round12({ player: 40, ai: 40, champ: { player: 4, ai: 4 } });
  s = passBoth(s);
  s = passBoth(s);
  assert.deepEqual([s.phase, s.winner, s.result.reason], ['gameOver', null, 'draw']);
}

// --- 60 Recognition still wins at once, at any time ------------------------------------------------------

{
  // From a reward, mid-action.
  let s = battle();
  s = playLoc(s, 'player', 'cerulean-cape', 0);
  locationAt(s, 0).progress.player = 2;
  locationAt(s, 0).reached.player = [2];
  s.players.player.recognition = RECOGNITION_TARGET - 2;
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'horsea'), space: 0 });
  assert.deepEqual([s.phase, s.winner, s.result.reason], ['gameOver', 'player', 'target'], 'a completion reward reaching 60 wins');
  assert.equal(s.turn, null);
  // From a presence reward at Supper: the match ends there.
  s = battle(4);
  s = playLoc(s, 'ai', 'route-119', 0);
  for (const sp of [0, 1, 2]) place(s, 'ai', sp, 'horsea');
  locationAt(s, 0).reached.ai = [2];
  s.players.ai.recognition = RECOGNITION_TARGET - 1;
  s.turn = 'player';
  s = passBoth(s);
  assert.deepEqual([s.phase, s.winner, s.round], ['gameOver', 'ai', 4]);
  // During the Championship, by damage.
  s = round12({ player: 58, ai: 10 });
  place(s, 'player', 0, 'arcanine@5');
  s.turn = 'player';
  s = act(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'player' } });
  assert.deepEqual([s.winner, s.result.reason, s.round], ['player', 'target', ROUND_LIMIT]);
}

// --- Reward cards drawn at Supper are kept (Elliott's ruling) ---------------------------------------------

{
  let s = battle();
  s = playLoc(s, 'player', 'route-119', 0);
  locationAt(s, 0).milestones = [{ at: 1, reward: { draw: 2 } }];
  place(s, 'player', 0, 'horsea');
  s.turn = 'player';
  s = passBoth(s);
  assert.equal(s.players.player.hand.length, 2 + HAND_SIZE, 'the 2 drawn at Supper, plus the 7 at Breakfast');
}

// --- Breakfast draws 7 on top of kept cards (Elliott's ruling) ---------------------------------------------

{
  let s = battle();
  give(s, 'player', 'oddish');   // Retain
  s = passBoth(s);
  assert.equal(s.players.player.hand.length, 1 + HAND_SIZE);
}

// --- The AI places and pursues Locations; AI-vs-AI matches finish ---------------------------------------

{
  // It places a summon Location over empty lanes of its own and summons into it.
  let s = battle(2);
  s.turn = 'ai';
  give(s, 'ai', 'cerulean-cape');
  give(s, 'ai', 'goldeen');
  let move = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.equal(move.type, 'playLocation', 'it plays the Location first');
  s = act(s, move);
  s.turn = 'ai';
  move = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.equal(move.type, 'summon');
  assert.ok(locationAt(s, move.space)?.id === 'cerulean-cape', 'and summons into it');
  // It doesn't start a Location the Championship would end at once.
  s = battle(CHAMPIONSHIP_ROUND - 1);
  s.turn = 'ai';
  give(s, 'ai', 'route-119');
  give(s, 'ai', 'horsea');
  assert.notEqual(chooseAction(s, 'ai', { rng: () => 0.5 }).type, 'playLocation');
}
{
  const ends = { early: 0, inChampionship: 0, afterRound12: 0, draws: 0 };
  let placed = 0;
  let completions = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 5000 && s.phase !== 'gameOver'; guard++) {
      const who = s.phase === 'initiative' ? 'player' : s.turn;
      const action = chooseAction(s, who, { rng });
      assert.ok(legalActions(s, who).includes(action.type));
      s = applyAction(s, action);
      placed += s.events.filter((e) => e.type === 'locationPlaced').length;
      completions += s.events.filter((e) => e.type === 'completed').length;
    }
    assert.equal(s.phase, 'gameOver', `seed ${seed} finishes`);
    assert.ok(s.round <= ROUND_LIMIT + 1, 'by Round 12, or 13 with sudden death');
    if (s.result.reason === 'target') {
      assert.ok(s.players[s.winner].recognition >= RECOGNITION_TARGET);
      ends[s.round < CHAMPIONSHIP_ROUND ? 'early' : 'inChampionship'] += 1;
    } else if (s.result.reason === 'draw') ends.draws += 1;
    else ends.afterRound12 += 1;
  }
  assert.ok(placed / N >= 3, 'the AI places Locations');
  assert.ok(completions > 0, 'and completes them');
  console.log(`${N} AI-vs-AI matches: ${ends.early} won at 60 before the Championship, ${ends.inChampionship} won at 60 during the Championship, ${ends.afterRound12} decided after Round 12, ${ends.draws} draws. ${(placed / N).toFixed(1)} Locations placed and ${(completions / N).toFixed(1)} completed per match.`);
}

console.log('All v2 Location tests passed.');
