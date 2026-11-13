// B3-1 simulation: seeded AI-vs-AI matches for each of the 16 deck pairings (4 decks × 4 decks, the "player" seat
// playing the first deck). Each match must end (a winner) with no error, no stall and no illegal action (applyAction
// throws on an illegal one). Pure Node: the same engine and AI as the browser.
//   node v4/tools/sim-b3.mjs [matches=200] [pairings=0-15] [--json]
// Pairings are numbered 0–15 (row-major over DECK_IDS); give a range or a list ("0-3", "4,5") to split the run
// across processes. Prints each pairing's result and each deck's win rate (or JSON with --json).
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { DECKS, DECK_IDS } from '../src/engine/decks.js';

const N = Number(process.argv[2] ?? 200);
const pick = (process.argv[3] ?? '0-15').split(',').flatMap((x) => { const [a, b] = x.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
const JSON_OUT = process.argv.includes('--json');
const MAX_ACTIONS = 8000;
const MAX_ROUNDS = 40;

const results = [];
for (const k of pick) {
  const A = DECK_IDS[Math.floor(k / 4)];
  const B = DECK_IDS[k % 4];
  const r = { pairing: k, player: A, ai: B, matches: N, playerWins: 0, aiWins: 0, errors: [], stalls: 0, rounds: [] };
  for (let seed = 1; seed <= N; seed++) {
    let s = createGame(seed * 7919 + k, { decks: { player: A, ai: B } });
    let x = seed * 31 + k;
    const rng = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    let n = 0;
    try {
      for (; n < MAX_ACTIONS && s.phase !== 'gameOver' && s.round <= MAX_ROUNDS; n++) {
        const who = actor(s);
        const a = chooseAction(s, who, { rng });
        s = applyAction(s, a);
      }
    } catch (e) {
      r.errors.push({ seed, round: s.round, message: e.message, stack: e.stack.split('\n').slice(0, 4).join(' | ') });
      continue;
    }
    if (s.phase !== 'gameOver') { r.stalls += 1; continue; }
    if (s.winner === 'player') r.playerWins += 1; else if (s.winner === 'ai') r.aiWins += 1;
    r.rounds.push(s.round);
  }
  results.push(r);
  if (!JSON_OUT) console.log(`${DECKS[A].name} (player) v ${DECKS[B].name} (AI seat): ${r.playerWins}–${r.aiWins}, errors ${r.errors.length}, stalls ${r.stalls}, mean Rounds ${(r.rounds.reduce((a, b) => a + b, 0) / Math.max(1, r.rounds.length)).toFixed(1)}${r.errors.length ? `\n  first error (seed ${r.errors[0].seed}): ${r.errors[0].message} | ${r.errors[0].stack}` : ''}`);
}
if (JSON_OUT) console.log(JSON.stringify(results));
else {
  const wins = Object.fromEntries(DECK_IDS.map((id) => [id, { w: 0, g: 0 }]));
  for (const r of results) {
    wins[r.player].w += r.playerWins; wins[r.player].g += r.playerWins + r.aiWins;
    wins[r.ai].w += r.aiWins; wins[r.ai].g += r.playerWins + r.aiWins;
  }
  for (const id of DECK_IDS) if (wins[id].g) console.log(`${DECKS[id].name}: ${(100 * wins[id].w / wins[id].g).toFixed(1)}% of ${wins[id].g} games`);
}
