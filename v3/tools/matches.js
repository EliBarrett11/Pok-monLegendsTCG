// AI-vs-AI matches with the test deck (V3-0): how long they last and how they end.
//   node v3/tools/matches.js [matches, default 100] [--seed=N]
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { RULES } from '../src/rules.js';

export function playMatch(seed) {
  let s = createGame(seed);
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  let actions = 0;
  let overexerts = 0;
  for (; actions < 5000 && s.phase !== 'gameOver'; actions++) {
    const a = chooseAction(s, actor(s), { rng });
    if (a.type === 'overexert') overexerts += 1;
    s = applyAction(s, a);
  }
  return { s, actions, overexerts };
}

export function report(n = 100, seed0 = 1000) {
  const out = { n, rounds: 0, actions: 0, overexerts: 0, ends: { trophyBefore: 0, trophyInChampionship: 0, champion: 0, draw: 0 }, wins: { first: 0, second: 0 }, roundHist: {}, recognition: 0, deckOuts: 0, unfinished: 0 };
  for (let i = 0; i < n; i++) {
    const { s, actions, overexerts } = playMatch(seed0 + i);
    if (s.phase !== 'gameOver') { out.unfinished += 1; continue; }
    out.rounds += s.round;
    out.actions += actions;
    out.overexerts += overexerts;
    out.roundHist[s.round] = (out.roundHist[s.round] ?? 0) + 1;
    out.recognition += (s.result.recognition.player + s.result.recognition.ai) / 2;
    out.deckOuts += s.players.player.deckOuts + s.players.ai.deckOuts;
    const first = createGame(seed0 + i).initiative;
    if (s.winner) out.wins[s.winner === first ? 'first' : 'second'] += 1;
    if (s.result.reason === 'trophy') out.ends[s.championship ? 'trophyInChampionship' : 'trophyBefore'] += 1;
    else out.ends[s.result.reason] += 1;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const n = Number(args.find((x) => /^\d+$/.test(x))) || 100;
  const seed0 = Number(args.find((x) => x.startsWith('--seed='))?.slice(7)) || 1000;
  const r = report(n, seed0);
  const done = n - r.unfinished;
  console.log(`${n} AI-vs-AI matches (the test deck, both sides): ${r.unfinished} unfinished.`);
  console.log(`Average Rounds per match: ${(r.rounds / done).toFixed(2)} (by Round: ${Object.entries(r.roundHist).map(([k, v]) => `R${k} ${v}`).join(', ')}).`);
  console.log(`Ends: the Trophy (${RULES.win} Recognition) before the Championship ${r.ends.trophyBefore}, the Trophy during the Championship ${r.ends.trophyInChampionship}, crowned at the Championship's end ${r.ends.champion}, draws ${r.ends.draw}.`);
  console.log(`Wins: the player with initiative in Round 1 ${r.wins.first}, the other ${r.wins.second}. Average final Recognition ${(r.recognition / done).toFixed(1)}; actions per match ${(r.actions / done).toFixed(0)}; Overexerts per match ${(r.overexerts / done).toFixed(2)}; deck-outs per match ${(r.deckOuts / done).toFixed(2)}.`);
}
