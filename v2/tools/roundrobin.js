// The v2 round-robin (V6): AI-vs-AI matches for every pairing of the three decks,
// seats alternating, with win rates, average Rounds and how matches end.
// Run with: node v2/tools/roundrobin.js [matches per matchup, default 40]
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';

const N = Number(process.argv[2]) || 40;
const pairs = [['fire', 'water'], ['fire', 'grass'], ['water', 'grass'], ['fire', 'fire'], ['water', 'water'], ['grass', 'grass']];
const out = [];
for (const [a, b] of pairs) {
  const r = { pair: `${DECKS[a].name}–${DECKS[b].name}`, wins: { [a]: 0, [b]: 0 }, first: 0, second: 0, draws: 0, rounds: 0, ends: { early: 0, championship: 0, final: 0 } };
  for (let i = 0; i < N; i++) {
    const seed = 1000 + i;
    const swap = i % 2 === 1;   // seats alternate
    const [p, q] = swap ? [b, a] : [a, b];
    let s = createGame(seed, { decks: { player: DECKS[p].list, ai: DECKS[q].list }, itemPool: POOL_ITEMS, plans: { player: p, ai: q } });
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 8000 && s.phase !== 'gameOver'; guard++) s = applyAction(s, chooseAction(s, actor(s), { rng }));
    if (s.phase !== 'gameOver') throw new Error(`${r.pair} seed ${seed} did not finish`);
    r.rounds += s.round;
    if (!s.winner) r.draws += 1;
    else {
      const deck = s.winner === 'player' ? p : q;
      if (a === b) r[s.winner === 'player' ? 'first' : 'second'] += 1;
      else r.wins[deck] += 1;
    }
    if (s.result.reason === 'target') r.ends[s.round < 10 ? 'early' : 'championship'] += 1;
    else r.ends.final += 1;
  }
  const pct = (x) => `${Math.round((100 * x) / N)}%`;
  const line = a === b
    ? `${r.pair} (mirror): player seat ${r.first}, AI seat ${r.second}${r.draws ? `, draws ${r.draws}` : ''}`
    : `${r.pair}: ${DECKS[a].name} ${r.wins[a]} (${pct(r.wins[a])}), ${DECKS[b].name} ${r.wins[b]} (${pct(r.wins[b])})${r.draws ? `, draws ${r.draws}` : ''}`;
  out.push(`${line} · avg ${(r.rounds / N).toFixed(1)} Rounds · ends: 60 early ${r.ends.early}, 60 in the Championship ${r.ends.championship}, final count ${r.ends.final}`);
  console.log(out.at(-1));
}
