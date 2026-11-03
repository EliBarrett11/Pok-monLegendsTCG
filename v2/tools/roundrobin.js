// The v2 round-robin (V6; diagnostics and variants V7a): AI-vs-AI matches for every pairing
// of the three decks, seats alternating (half the matches each way round).
//
//   node v2/tools/roundrobin.js [matches per matchup, default 40] [--mixed] [--variant=T75,L+,W1] [--json]
//
// --mixed     only the three mixed matchups (no mirrors)
// --variant   balance-experiment flags, off by default and never the game's settings:
//             T75 / T90  Recognition target 75 / 90
//             L+         every Location Recognition reward ×1.5 (rounded up)
//             CH8        the Championship arrives in Round 8 (the limit stays 12)
//             W1         Water Pokémon +1 Strength at every Level
//             W2         Water's Locations last 1 Round longer; their milestones give +1 Recognition
// --json      one JSON line with the results (for v2/tools/variants.js)
//
// For each deck in each matchup it reports, per match: Recognition by source (attacks on
// the enemy player, Overrun, Strategy and ability damage to the player, Location
// milestones and completions, the Championship, other), Recognition it removed from the
// enemy (by Burn at Supper, and Ember-style losses), how often its attacks were limited by
// guards, its Pokémon defeated, the average Level of the Pokémon it played, and Rounds.
import { createGame, applyAction, actor, legalTargets } from '../src/engine/game.js';
import { DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';

export const VARIANTS = {
  T75: { target: 75 }, T90: { target: 90 }, 'L+': { locMult: 1.5 }, CH8: { champRound: 8 },
  W1: { waterStrength: 1 }, W2: { waterLocations: true },
};
export const variantOf = (flags = []) => (flags.length ? Object.assign({}, ...flags.map((f) => {
  if (!VARIANTS[f]) throw new Error(`No variant ${f}`);
  return VARIANTS[f];
})) : null);

const SOURCES = ['attack', 'overrun', 'effect', 'location', 'championship', 'other'];
const blank = () => ({ wins: 0, recognition: Object.fromEntries(SOURCES.map((k) => [k, 0])), burnRemoved: 0, lossRemoved: 0,
  attacks: 0, guarded: 0, defeated: 0, levels: 0, played: 0 });

// One matchup: n matches, seats alternating. Returns totals per deck (by seat-free name).
export function runMatchup(a, b, n, variant = null, seed0 = 1000) {
  const r = { pair: [a, b], n, draws: 0, rounds: 0, ends: { early: 0, championship: 0, final: 0 }, deck: { [a]: blank(), [b]: blank() }, seats: { first: 0, second: 0 } };
  const mirror = a === b;
  if (mirror) r.deck = { player: blank(), ai: blank() };
  const champ = variant?.champRound ?? 10;
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i;
    const swap = i % 2 === 1;
    const [p, q] = swap ? [b, a] : [a, b];
    const deckOf = (who) => (mirror ? who : who === 'player' ? p : q);
    let s = createGame(seed, { decks: { player: DECKS[p].list, ai: DECKS[q].list }, itemPool: POOL_ITEMS, plans: { player: p, ai: q }, variant });
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 10000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      if (action.type === 'attack') {
        const d = r.deck[deckOf(who)];
        d.attacks += 1;
        if (!legalTargets(s, who, action.from).some((t) => t.kind === 'player')) d.guarded += 1;
      }
      s = applyAction(s, action);
      for (const e of s.events) {
        if (e.type === 'recognition') r.deck[deckOf(e.who)].recognition[e.source ?? 'other'] += e.amount;
        else if (e.type === 'burnRecognition') r.deck[deckOf(e.who === 'player' ? 'ai' : 'player')].burnRemoved += e.amount;
        else if (e.type === 'recognitionLost') r.deck[deckOf(e.who === 'player' ? 'ai' : 'player')].lossRemoved += e.amount;
        else if (e.type === 'defeated') r.deck[deckOf(e.who)].defeated += 1;
        else if (e.type === 'summoned' && !e.partner && e.level !== undefined) {
          const d = r.deck[deckOf(e.who)];
          d.levels += e.level;
          d.played += 1;
        }
      }
    }
    if (s.phase !== 'gameOver') throw new Error(`${a}–${b} seed ${seed} did not finish`);
    r.rounds += s.round;
    if (!s.winner) r.draws += 1;
    else {
      r.deck[deckOf(s.winner)].wins += 1;
      if (mirror) r.seats[s.winner === 'player' ? 'first' : 'second'] += 1;
    }
    if (s.result.reason === 'target') r.ends[s.round < champ ? 'early' : 'championship'] += 1;
    else r.ends.final += 1;
  }
  return r;
}

const PAIRS = { all: [['fire', 'water'], ['fire', 'grass'], ['water', 'grass'], ['fire', 'fire'], ['water', 'water'], ['grass', 'grass']], mixed: [['fire', 'water'], ['fire', 'grass'], ['water', 'grass']] };
export const pairsFor = (mixed) => (mixed ? PAIRS.mixed : PAIRS.all);

const per = (x, n) => (x / n).toFixed(1);
export function report(r) {
  const [a, b] = r.pair;
  const name = (k) => (DECKS[k] ? DECKS[k].name : k === 'player' ? 'first seat' : 'second seat');
  const pct = (x) => `${Math.round((100 * x) / r.n)}%`;
  const lines = [];
  const head = a === b
    ? `${DECKS[a].name} mirror: first seat ${r.deck.player.wins}, second ${r.deck.ai.wins}${r.draws ? `, draws ${r.draws}` : ''}`
    : `${DECKS[a].name}–${DECKS[b].name}: ${DECKS[a].name} ${r.deck[a].wins} (${pct(r.deck[a].wins)}), ${DECKS[b].name} ${r.deck[b].wins} (${pct(r.deck[b].wins)})${r.draws ? `, draws ${r.draws}` : ''}`;
  lines.push(`${head} · avg ${per(r.rounds, r.n)} Rounds · ends: 60 early ${r.ends.early}, in the Championship ${r.ends.championship}, final count ${r.ends.final}`);
  for (const [k, d] of Object.entries(r.deck)) {
    const rec = d.recognition;
    const total = SOURCES.reduce((x, s) => x + rec[s], 0);
    lines.push(`  ${name(k)}: Recognition/match ${per(total, r.n)} = attacks ${per(rec.attack, r.n)}, Overrun ${per(rec.overrun, r.n)}, Strategy/ability damage ${per(rec.effect, r.n)}, Locations ${per(rec.location, r.n)}, Championship ${per(rec.championship, r.n)}, other ${per(rec.other, r.n)} · removed from the enemy: Burn ${per(d.burnRemoved, r.n)}, Ember-style ${per(d.lossRemoved, r.n)} · attacks ${per(d.attacks, r.n)}/match, ${d.attacks ? Math.round((100 * d.guarded) / d.attacks) : 0}% limited by guards · Pokémon defeated ${per(d.defeated, r.n)}/match · avg Level played ${d.played ? (d.levels / d.played).toFixed(2) : '–'}`);
  }
  return lines.join('\n');
}

// The command line.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const n = Number(args.find((x) => /^\d+$/.test(x))) || 40;
  const flags = args.find((x) => x.startsWith('--variant='))?.slice(10).split(',').filter(Boolean) ?? [];
  const variant = variantOf(flags);
  const results = pairsFor(args.includes('--mixed')).map(([a, b]) => runMatchup(a, b, n, variant));
  if (args.includes('--json')) console.log(JSON.stringify({ flags, results }));
  else for (const r of results) console.log(report(r));
}
