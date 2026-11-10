// G1 simulation summary: node v4/tools/sim-g1.mjs [matches=100]
// AI-vs-AI matches (the current deck, the G1 rules), fixed seeds. Reports the median match length,
// Recognition by source, PokéDollars earned and Items bought per player, the different PokéMart Items
// shown per Round, and how often a Pass was refused (decision points where Pass wasn't legal).
import { createGame, applyAction, actor, passReason } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { RULES } from '../src/rules.js';

const N = Number(process.argv[2] ?? 100);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const SOURCES = [
  ['damage to the Player', (s) => /'s attack$/.test(s)],
  ['defeats', (s) => /^defeating /.test(s)],
  ['Location dominance', (s) => /^dominating (?!the Pokémon League)/.test(s)],
  ['Tournament dominance', (s) => /Tournament/.test(s)],
  ['Favours', (s) => /Favour/.test(s)],
  ['Objectives', (s) => /Objective/.test(s)],
];

const rounds = [];
const wins = { player: 0, ai: 0, none: 0 };
const rec = Object.fromEntries(SOURCES.map(([k]) => [k, []]));
const dollars = [];
const bought = [];
const boughtMart = [];
const shownPerRound = [];
let decisions = 0;
let refused = 0;
let tournaments = 0;
for (let seed = 1; seed <= N; seed++) {
  let s = createGame(seed);
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  const r = { player: Object.fromEntries(SOURCES.map(([key]) => [key, 0])), ai: Object.fromEntries(SOURCES.map(([key]) => [key, 0])) };
  const got = { player: 1, ai: 1 };   // $1 at the first Breakfast (match setup)
  const buys = { player: 0, ai: 0 };
  const martBuys = { player: 0, ai: 0 };
  let shown = new Set([s.mart.onSale[0]?.id].filter(Boolean));
  const perRound = [];
  for (let n = 0; n < 5000 && s.phase !== 'gameOver'; n++) {
    const who = actor(s);
    if (s.phase === 'battle' && !s.reactWindow && s.turn === who) { decisions += 1; if (passReason(s, who)) refused += 1; }
    const prev = s;
    s = applyAction(s, chooseAction(s, who, { rng }));
    for (const e of s.events) {
      if (e.type === 'recognition') { const src = SOURCES.find(([, f]) => f(e.source)); if (src) r[e.who][src[0]] += e.amount; }
      if (e.type === 'dollars') got[e.who] += e.amount;
      if (e.type === 'breakfast') { got.player += RULES.dollarsPerRound; got.ai += RULES.dollarsPerRound; perRound.push(shown.size); shown = new Set([s.mart.onSale[0]?.id].filter(Boolean)); }
      if (e.type === 'martRefreshed') shown.add(e.id);
      if (e.type === 'itemBought') { buys[e.who] += 1; if (e.from === 'mart') martBuys[e.who] += 1; }
      if (e.type === 'tournament') tournaments += 1;
    }
    if (prev.round !== s.round && !s.events.some((e) => e.type === 'breakfast')) perRound.push(shown.size);
  }
  perRound.push(shown.size);
  rounds.push(s.round);
  wins[s.winner ?? 'none'] += 1;
  for (const w of ['player', 'ai']) {
    for (const [key] of SOURCES) rec[key].push(r[w][key]);
    dollars.push(got[w]);
    bought.push(buys[w]);
    boughtMart.push(martBuys[w]);
  }
  shownPerRound.push(...perRound);
}

const totalRec = SOURCES.reduce((n, [key]) => n + mean(rec[key]), 0);
console.log(`G1 simulation: ${N} AI-vs-AI matches (the current deck, the G1 rules)\n`);
console.log(`Match length: median ${median(rounds)} Rounds (range ${Math.min(...rounds)}–${Math.max(...rounds)}); wins: first seat ${wins.player}, second seat ${wins.ai}${wins.none ? `, unfinished ${wins.none}` : ''}; the Tournament began in ${tournaments} of ${N}`);
console.log('\nRecognition per player per match, by source (mean, share):');
for (const [key] of SOURCES) console.log(`  ${key.padEnd(22)} ${mean(rec[key]).toFixed(1).padStart(5)}  ${((100 * mean(rec[key])) / totalRec).toFixed(0).padStart(3)}%`);
console.log(`  ${'total'.padEnd(22)} ${totalRec.toFixed(1).padStart(5)}`);
console.log(`\nPokéDollars earned per player per match: mean $${mean(dollars).toFixed(1)}, median $${median(dollars)}`);
console.log(`Items bought per player per match: mean ${mean(bought).toFixed(1)} (from the PokéMart ${mean(boughtMart).toFixed(1)}), median ${median(bought)}`);
console.log(`Different PokéMart Items shown per Round: mean ${mean(shownPerRound).toFixed(2)}, median ${median(shownPerRound)}`);
console.log(`Pass refused (an unmatched Ready Pokémon could attack): ${refused} of ${decisions} turn decisions (${((100 * refused) / decisions).toFixed(1)}%), ${(refused / N).toFixed(1)} per match`);
