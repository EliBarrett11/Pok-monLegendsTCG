// Checks drawing the board from either seat (Multiplayer M1), without the DOM:
// orient() turns a seat's view so that seat is 'player' (the bottom of the
// screen), the screen's questions get the same answers as the engine gives
// that seat, and toEngine() turns the screen's actions back into the
// engine's seats.
// Run with: node tests/seat.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, legalTargets, alertPokemon, playablePokemon, summonSpaces, PLAYERS, opponentOf } from '../src/engine/game.js';
import { viewFor } from '../src/engine/view.js';
import { orient, toEngine, screenSeat } from '../src/ui/seat.js';
import { matchStats } from '../src/ui/resources.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Seat 'player' is drawn as before; seat 'ai' is turned round ---------------------------------

{
  const s = createGame(9, { decks: { player: 'fire', ai: 'water' }, names: { player: 'Player 1', ai: 'Player 2' } });
  const mine = orient(viewFor(s, 'player'));
  assert.equal(mine.players.player.deck, 'fire');
  assert.equal(mine.seat, 'player');
  const theirs = orient(viewFor(s, 'ai'));
  assert.equal(theirs.seat, 'ai', 'the engine seat is kept');
  assert.equal(theirs.viewer, 'player');
  assert.equal(theirs.players.player.deck, 'water', "Player 2's own side is at the bottom");
  assert.equal(theirs.players.ai.deck, 'fire');
  assert.equal(theirs.players.player.name, 'You');
  assert.equal(theirs.players.ai.name, 'Player 1');
  assert.equal(theirs.players.player.hand.length, 0);
  assert.equal(theirs.names.player, 'Player 2');
  assert.equal(screenSeat('ai', 'ai'), 'player');
  assert.equal(screenSeat('ai', 'player'), 'ai');
  // An action from the screen goes back to the engine's seats.
  const act = { type: 'command', who: 'player', from: { zone: 0, space: 1 }, target: { kind: 'pokemon', owner: 'ai', zone: 2, space: 0 } };
  assert.deepEqual(toEngine(act, 'ai'), { ...act, who: 'ai', target: { ...act.target, owner: 'player' } });
  assert.deepEqual(toEngine(act, 'player'), act, 'seat player: unchanged');
}

// --- A whole match from both seats: the screen sees what the engine says ----------------------------

const swapRef = (r) => r && { ...r, ...(r.owner ? { owner: opponentOf(r.owner) } : {}) };
{
  let s = createGame(11, { decks: { player: 'water', ai: 'fire' } });
  let n = 11;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  let checked = 0;
  for (let guard = 0; guard < 5000 && s.phase !== 'gameOver'; guard++) {
    for (const seat of PLAYERS) {
      const v = orient(viewFor(s, seat));
      const flip = seat === 'ai' ? swapRef : (r) => r;
      assert.deepEqual(legalActions(v, 'player'), legalActions(s, seat), 'the same moves');
      assert.equal(v.turn, s.turn && screenSeat(s.turn, seat));
      assert.deepEqual(playablePokemon(v, 'player').map((c) => c.uid), playablePokemon(s, seat).map((c) => c.uid));
      assert.deepEqual(summonSpaces(v, 'player'), summonSpaces(s, seat));
      for (const { zone, space } of alertPokemon(s, seat)) {
        const keys = (refs) => refs.map((r) => JSON.stringify(r)).sort();
        assert.deepEqual(keys(legalTargets(v, 'player', { zone, space })), keys(legalTargets(s, seat, { zone, space }).map(flip)), 'the same attack targets');
        checked += 1;
      }
    }
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    const action = chooseAction(s, who, { rng }) ?? { type: 'flipCoin' };
    // The same action, sent from that player's screen, does the same thing.
    if (action.who) {
      const fromScreen = toEngine(toEngine(action, who), who);
      assert.deepEqual(fromScreen, action);
    }
    s = applyAction(s, action);
  }
  assert.equal(s.phase, 'gameOver');
  assert.ok(checked > 20, 'attack targets were compared');
  // The end screen reads right from each side.
  for (const seat of PLAYERS) {
    const m = matchStats(orient(viewFor(s, seat)));
    assert.equal(m.result, s.winner === seat ? 'victory' : s.winner ? 'defeat' : 'draw');
    assert.equal(m.player.trainerDamage, s.stats[seat].trainerDamage);
    assert.equal(m.deck.player, s.players[seat].deck);
  }
}

console.log('All seat tests passed.');
