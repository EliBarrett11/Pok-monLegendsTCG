// Checks mirror matches (Multiplayer M1; rules section 9.1): both seats may
// play the same deck. Every card keeps a uid of its own, each side gets its
// own three Trainers, and seeded Fire vs Fire and Water vs Water matches play
// to the end.
// Run with: node tests/mirror.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, PLAYERS } from '../src/engine/game.js';
import { deckDefinition } from '../src/engine/cards.js';
import { viewFor } from '../src/engine/view.js';
import { chooseAction } from '../src/ai/opponent.js';

// Every card in the game: hands, piles, arenas, Bags, Trainers and the PokéMart.
function allCards(s) {
  const out = [...s.mart.deck, ...s.mart.onSale.filter(Boolean)];
  for (const who of PLAYERS) {
    const p = s.players[who];
    out.push(...p.hand, ...p.drawPile, ...p.discard, ...p.released, ...p.bag, ...p.trainers);
    for (const z of p.zones) {
      for (const c of [z.location, ...z.pokemon]) {
        if (!c) continue;
        out.push(c);
        if (c.heldItem) out.push(c.heldItem);
      }
    }
  }
  return out;
}

function playMirror(deck, seed) {
  let s = createGame(seed, { decks: { player: deck, ai: deck } });
  // Each side has its own three Trainers: the deck's, as separate cards.
  const [mine, theirs] = PLAYERS.map((w) => s.players[w].trainers);
  assert.deepEqual(mine.map((t) => t.id), deckDefinition(deck).trainers);
  assert.deepEqual(theirs.map((t) => t.id), deckDefinition(deck).trainers);
  assert.ok(mine.every((t, i) => t !== theirs[i] && t.uid !== theirs[i].uid), 'separate Trainer cards');
  let n = seed;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  let actions = 0;
  for (let guard = 0; guard < 6000 && s.phase !== 'gameOver'; guard++) {
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
    actions += 1;
    const uids = allCards(s).map((c) => c.uid);
    assert.equal(new Set(uids).size, uids.length, `${deck} mirror: every card has its own uid`);
    // Each player's cards stay on their own side (none crosses over by sharing a uid).
    for (const who of PLAYERS) {
      const p = s.players[who];
      assert.ok([...p.hand, ...p.drawPile, ...p.discard].every((c) => c.uid.startsWith(`${who}-`)), 'own cards only');
    }
  }
  assert.equal(s.phase, 'gameOver', `${deck} vs ${deck} played to the end`);
  assert.ok(actions > 50);
  // The winner's view says so; the Trainers revealed on both sides are the same three.
  for (const who of PLAYERS) assert.deepEqual(s.players[who].zones.map((z) => z.trainer.id).sort(), [...deckDefinition(deck).trainers].sort());
  if (s.winner) assert.ok(viewFor(s, s.winner).log.at(-1).startsWith('You win!'));
  return s;
}

const fire = playMirror('fire', 17);
const water = playMirror('water', 23);
console.log(`Fire mirror: ${fire.winner ?? 'draw'} in Round ${fire.round}. Water mirror: ${water.winner ?? 'draw'} in Round ${water.round}.`);
console.log('All mirror-match tests passed.');
