// V7e: an AI check. Per deck: unspent Energy per Round, passes per Round (with an
// affordable play available, or nothing affordable), hand size at Supper, and for the
// passes made with a play available, which plays were skipped and how they scored.
//
//   node v2/tools/aicheck.js [matches per matchup, default 20] [--variant=T90,CH9,LG,GS]
//
// "An affordable play" is any move the AI itself lists other than passing (every one of
// them is legal and paid for: summons, Strategy, Supporters, Items, Trainers, Abilities,
// Nurture, attacks, moving a Trainer).
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { POOL_ITEMS } from '../src/engine/cards.js';
import { chooseAction, moves, scoreMove } from '../src/ai/opponent.js';
import { variantOf, pairsFor, deckList } from './roundrobin.js';

const blank = () => ({ rounds: 0, unspent: 0, hand: 0, passes: 0, passWithPlay: 0, passNothing: 0, skipped: {}, gap: 0, passScore: 0 });

export function check(a, b, n, variant, seed0 = 1000) {
  const out = { [a]: blank(), [b]: blank() };
  const mirror = a === b;
  if (mirror) throw new Error('aicheck: mixed matchups only');
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i;
    const [p, q] = i % 2 ? [b, a] : [a, b];
    const deckOf = (who) => (who === 'player' ? p : q);
    let s = createGame(seed, { decks: { player: deckList(p, variant), ai: deckList(q, variant) }, itemPool: POOL_ITEMS, plans: { player: p, ai: q }, variant });
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 10000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      if (action.type === 'pass') {
        const d = out[deckOf(who)];
        d.passes += 1;
        const plays = moves(s, who).filter((m) => m.type !== 'pass');
        if (!plays.length) d.passNothing += 1;
        else {
          d.passWithPlay += 1;
          const scored = plays.map((m) => ({ m, score: scoreMove(s, who, m) })).sort((x, y) => y.score - x.score);
          const top = scored[0];
          const key = top.m.type === 'attack' ? `attack ${top.m.target.kind === 'player' ? 'the player' : 'a Pokémon'}` : top.m.type;
          const e = (d.skipped[key] ??= { n: 0, score: 0 });
          e.n += 1;
          e.score += top.score;
          d.passScore += scoreMove(s, who, { type: 'pass', who });
        }
      }
      const prev = s;
      s = applyAction(s, action);
      if (s.events.some((e) => e.type === 'phaseChanged' && e.phase === 'supper')) {
        for (const w of ['player', 'ai']) {
          const d = out[deckOf(w)];
          d.rounds += 1;
          d.unspent += prev.players[w].energy;
          d.hand += prev.players[w].hand.length;
        }
      }
    }
  }
  return out;
}

export function report(name, d) {
  const per = (x) => (d.rounds ? (x / d.rounds).toFixed(2) : '–');
  const share = d.passes ? Math.round((100 * d.passWithPlay) / d.passes) : 0;
  const skipped = Object.entries(d.skipped).sort((x, y) => y[1].n - x[1].n)
    .map(([k, e]) => `${k} ${e.n} (avg score ${(e.score / e.n).toFixed(1)})`).join(', ');
  return `${name}: unspent Energy/Round ${per(d.unspent)} · passes/Round ${per(d.passes)} = with a play available ${per(d.passWithPlay)} (${share}% of passes), nothing affordable ${per(d.passNothing)} · hand at Supper ${per(d.hand)}`
    + (d.passWithPlay ? `\n    best play skipped when passing: ${skipped} · pass scored ${(d.passScore / d.passWithPlay).toFixed(1)} on average` : '');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const n = Number(args.find((x) => /^\d+$/.test(x))) || 20;
  const flags = args.find((x) => x.startsWith('--variant='))?.slice(10).split(',').filter(Boolean) ?? [];
  const variant = variantOf(flags);
  for (const [a, b] of pairsFor(true)) {
    const r = check(a, b, n, variant);
    console.log(`${a}–${b} (${flags.join('+') || 'baseline'}, ${n} matches)`);
    for (const k of [a, b]) console.log(`  ${report(k, r[k])}`);
  }
}
