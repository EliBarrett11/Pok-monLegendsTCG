// Balance report: plays seeded AI-vs-AI matches of Fire against Water, in both
// seat orders, and prints how each deck did.
// Run with: node tools/balance.js [matches per seat order]   (default 100)
//
// The same matches every time (seeds 1..N for each seat order, the AI's
// choices seeded too), so two runs before and after a change compare like for
// like. A match still going at Round 100 counts as stalled.
import { createGame, applyAction, PLAYERS, legalActions, opponentOf } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';
import { DECKS } from '../src/engine/cardData.js';

const MATCHES = Number(process.argv[2] ?? 100);
const STALL_ROUND = 100;
const ORDERS = [{ player: 'fire', ai: 'water' }, { player: 'water', ai: 'fire' }];

// Pokémon a player still has to play: hand, Draw Pile and Discard Pile (not the arena).
const pokemonToPlay = (p) => [...p.hand, ...p.drawPile, ...p.discard].filter((c) => c.cardType === 'Pokémon').length;
const trainerStrength = (p) => p.zones.reduce((sum, z) => sum + Math.max(0, z.trainer?.strength ?? 0), 0);

const blank = () => ({
  matches: 0, wins: 0, losses: 0, draws: 0, stalls: 0, rounds: 0, winRounds: 0,
  trainerDamage: 0, burnDamage: 0, ranDry: 0, keptPct: 0,
});
const byDeck = { fire: blank(), water: blank() };
const byOrder = ORDERS.map(() => ({ player: 0, ai: 0, draws: 0, stalls: 0 }));

ORDERS.forEach((decks, order) => {
  for (let seed = 1; seed <= MATCHES; seed++) {
    let s = createGame(seed, { decks });
    const box = { rng: seed * 7919 + order };
    const rng = () => nextRandom(box);
    const ranDry = { player: false, ai: false };
    let start = null;
    while (s.phase !== 'gameOver' && s.round < STALL_ROUND) {
      const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
      s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
      if (start === null && PLAYERS.every((w) => s.players[w].zones.every((z) => z.trainer))) {
        start = Object.fromEntries(PLAYERS.map((w) => [w, trainerStrength(s.players[w])]));
      }
      for (const e of s.events) {
        if (e.type !== 'damage' || e.target.kind !== 'trainer') continue;
        const dealt = Math.max(0, e.before - Math.max(0, e.after));   // what was actually lost
        const by = byDeck[decks[opponentOf(e.target.owner)]];
        by.trainerDamage += dealt;
        if (e.cause === 'burn') by.burnDamage += dealt;
      }
      if (s.round > 0) for (const w of PLAYERS) if (pokemonToPlay(s.players[w]) === 0) ranDry[w] = true;
    }
    for (const w of PLAYERS) {
      const d = byDeck[decks[w]];
      d.matches += 1;
      d.rounds += s.round;
      if (ranDry[w]) d.ranDry += 1;
      if (s.phase !== 'gameOver') d.stalls += 1;
      else if (!s.winner) d.draws += 1;
      else if (s.winner === w) {
        d.wins += 1;
        d.winRounds += s.round;
        d.keptPct += (100 * trainerStrength(s.players[w])) / start[w];
      } else d.losses += 1;
    }
    const o = byOrder[order];
    if (s.phase !== 'gameOver') o.stalls += 1;
    else if (!s.winner) o.draws += 1;
    else o[s.winner] += 1;
  }
});

const pct = (n, of) => `${((100 * n) / (of || 1)).toFixed(1)}%`;
const avg = (n, of) => (of ? (n / of).toFixed(1) : '-');
console.log(`Balance report: Fire vs Water, ${MATCHES} seeded AI-vs-AI matches in each seat order (${2 * MATCHES} in all; stalled = still going at Round ${STALL_ROUND})`);
for (const [id, d] of Object.entries(byDeck)) {
  console.log(`  ${DECKS[id].name.padEnd(6)} won ${pct(d.wins, d.matches)} · lost ${pct(d.losses, d.matches)} · drawn ${pct(d.draws, d.matches)} · stalled ${pct(d.stalls, d.matches)}`);
  console.log(`         ${avg(d.rounds, d.matches)} Rounds per match (${avg(d.winRounds, d.wins)} in its wins, keeping ${avg(d.keptPct, d.wins)}% of its Trainer Strength)`);
  console.log(`         ${avg(d.trainerDamage, d.matches)} damage to enemy Trainers per match (${avg(d.burnDamage, d.matches)} of it from Burn)`);
  console.log(`         ran dry (no Pokémon left in hand, Draw Pile and Discard Pile) in ${pct(d.ranDry, d.matches)} of matches`);
}
ORDERS.forEach((decks, i) => {
  const o = byOrder[i];
  console.log(`  You ${DECKS[decks.player].name} vs AI ${DECKS[decks.ai].name}: ${DECKS[decks.player].name} ${o.player}, ${DECKS[decks.ai].name} ${o.ai}, drawn ${o.draws}, stalled ${o.stalls}`);
});
