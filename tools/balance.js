// Balance report: plays seeded AI-vs-AI matches and prints how they went.
// Run with: node tools/balance.js [matches]   (default 120)
//
// The same matches every time (seeds 1..N, the AI's choices seeded too), so
// two runs before and after a change compare like for like. A match still
// going at Round 100 counts as stalled.
import { createGame, applyAction, PLAYERS, legalActions, opponentOf } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';

const MATCHES = Number(process.argv[2] ?? 120);
const STALL_ROUND = 100;

// Pokémon a player still has to play: hand, Draw Pile and Discard Pile (not the arena).
const pokemonToPlay = (p) => [...p.hand, ...p.drawPile, ...p.discard].filter((c) => c.cardType === 'Pokémon').length;
const pokemonLeft = (p) => pokemonToPlay(p) + p.zones.flatMap((z) => z.pokemon).filter(Boolean).length;
const trainerStrength = (p) => p.zones.reduce((sum, z) => sum + Math.max(0, z.trainer?.strength ?? 0), 0);

const totals = {
  wins: 0, draws: 0, stalls: 0, rounds: 0, actions: 0, finished: 0, finishedRounds: 0, finishedActions: 0,
  ranDry: 0, ranDryRound: 0,
  loserPokemon: 0, winnerStrengthPct: 0,
  damageToTrainers: 0, damageToPokemon: 0,
};

for (let seed = 1; seed <= MATCHES; seed++) {
  let s = createGame(seed);
  const box = { rng: seed * 7919 };
  const rng = () => nextRandom(box);
  let actions = 0;
  let dryAt = null;
  let startStrength = null;
  while (s.phase !== 'gameOver' && s.round < STALL_ROUND) {
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
    actions += 1;
    if (startStrength === null && s.players.player.zones.every((z) => z.trainer)) {
      startStrength = Object.fromEntries(PLAYERS.map((w) => [w, trainerStrength(s.players[w])]));
    }
    for (const e of s.events) {
      if (e.type !== 'damage') continue;
      const dealt = Math.max(0, e.before - Math.max(0, e.after));   // what was actually lost
      if (e.target.kind === 'trainer') totals.damageToTrainers += dealt;
      else totals.damageToPokemon += dealt;
    }
    if (dryAt === null && s.round > 0 && PLAYERS.some((w) => pokemonToPlay(s.players[w]) === 0)) dryAt = s.round;
  }
  totals.actions += actions;
  totals.rounds += s.round;
  if (dryAt !== null) {
    totals.ranDry += 1;
    totals.ranDryRound += dryAt;
  }
  if (s.phase !== 'gameOver') {
    totals.stalls += 1;
    continue;
  }
  totals.finished += 1;
  totals.finishedRounds += s.round;
  totals.finishedActions += actions;
  if (!s.winner) {
    totals.draws += 1;
    continue;
  }
  totals.wins += 1;
  totals.loserPokemon += pokemonLeft(s.players[opponentOf(s.winner)]);
  totals.winnerStrengthPct += (100 * trainerStrength(s.players[s.winner])) / startStrength[s.winner];
}

const pct = (n, of = MATCHES) => `${((100 * n) / (of || 1)).toFixed(1)}%`;
const avg = (n, of) => (of ? (n / of).toFixed(1) : '-');
console.log(`Balance report: ${MATCHES} seeded AI-vs-AI matches (stalled = still going at Round ${STALL_ROUND})`);
console.log(`  Results:     ${pct(totals.wins)} won · ${pct(totals.draws)} drawn · ${pct(totals.stalls)} stalled`);
console.log(`  Length:      ${avg(totals.rounds, MATCHES)} Rounds and ${avg(totals.actions, MATCHES)} actions per match (all matches); `
  + `${avg(totals.finishedRounds, totals.finished)} Rounds and ${avg(totals.finishedActions, totals.finished)} actions in finished ones`);
console.log(`  Ran dry:     ${pct(totals.ranDry)} of matches had a player with no Pokémon left in hand, Draw Pile and Discard Pile`
  + `${totals.ranDry ? ` (first at Round ${avg(totals.ranDryRound, totals.ranDry)} on average)` : ''}`);
console.log(`  In wins:     the loser had ${avg(totals.loserPokemon, totals.wins)} Pokémon left; the winner kept ${avg(totals.winnerStrengthPct, totals.wins)}% of its Trainer Strength`);
console.log(`  Damage:      ${avg(totals.damageToTrainers, MATCHES)} to Trainers vs ${avg(totals.damageToPokemon, MATCHES)} to Pokémon per match`);
