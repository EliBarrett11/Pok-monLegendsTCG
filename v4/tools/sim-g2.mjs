// G2 simulation summary: node v4/tools/sim-g2.mjs [matches=100]
// AI-vs-AI matches with the temporary 35-card deck (the 10 new lines) and the G1 rules, fixed seeds.
// Reports the median match length, the first player's win rate (initiative in Round 1), Recognition by
// source, each line's play rate (summoned in the matches where it was drawn, per player), and how often
// each trigger and keyword acted.
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { PATHS } from '../src/engine/cards.js';

const N = Number(process.argv[2] ?? 100);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const SOURCES = [
  ['damage to the Player', (s) => /'s attack$/.test(s)],
  ['Overrun', (s) => /Overrun/.test(s)],
  ['defeats', (s) => /^defeating /.test(s)],
  ['Location dominance', (s) => /^dominating (?!the Pokémon League)/.test(s)],
  ['Tournament dominance', (s) => /Tournament/.test(s)],
  ['Favours', (s) => /Favour/.test(s)],
  ['Objectives', (s) => /Objective/.test(s)],
];
const rounds = [];
let firstWins = 0;
let finished = 0;
const rec = Object.fromEntries(SOURCES.map(([k]) => [k, []]));
const drawn = Object.fromEntries(PATHS.map((p) => [p.id, 0]));
const played = Object.fromEntries(PATHS.map((p) => [p.id, 0]));
const triggers = {};
const keywords = {};
let choices = 0;
for (let seed = 1; seed <= N; seed++) {
  let s = createGame(seed);
  const first = s.initiative;
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  const r = { player: {}, ai: {} };
  const seen = { player: new Set(), ai: new Set() };
  const summoned = { player: new Set(), ai: new Set() };
  for (let n = 0; n < 5000 && s.phase !== 'gameOver'; n++) {
    for (const w of ['player', 'ai']) for (const c of s.players[w].hand) if (c.cardType === 'Pokémon') seen[w].add(c.id);
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    for (const e of s.events) {
      if (e.type === 'recognition') { const src = SOURCES.find(([, f]) => f(e.source)); if (src) r[e.who][src[0]] = (r[e.who][src[0]] ?? 0) + e.amount; }
      if (e.type === 'summoned') summoned[e.who].add(e.id);
      if (e.type === 'trigger') triggers[`${e.name} ${e.on}`] = (triggers[`${e.name} ${e.on}`] ?? 0) + 1;
      if (e.type === 'keyword') keywords[e.kw] = (keywords[e.kw] ?? 0) + 1;
      if (e.type === 'triggerChoice') choices += 1;
    }
  }
  rounds.push(s.round);
  if (s.winner) { finished += 1; if (s.winner === first) firstWins += 1; }
  for (const w of ['player', 'ai']) {
    for (const [key] of SOURCES) rec[key].push(r[w][key] ?? 0);
    for (const id of seen[w]) { drawn[id] += 1; if (summoned[w].has(id)) played[id] += 1; }
  }
}
const total = SOURCES.reduce((n, [key]) => n + mean(rec[key]), 0);
console.log(`G2 simulation: ${N} AI-vs-AI matches (the temporary 35-card deck, the 10 new lines, the G1 rules)\n`);
console.log(`Match length: median ${median(rounds)} Rounds (range ${Math.min(...rounds)}–${Math.max(...rounds)}); finished ${finished} of ${N}`);
console.log(`First player (Round 1 initiative) win rate: ${((100 * firstWins) / Math.max(1, finished)).toFixed(0)}% (${firstWins} of ${finished})`);
console.log('\nRecognition per player per match, by source (mean, share):');
for (const [key] of SOURCES) console.log(`  ${key.padEnd(22)} ${mean(rec[key]).toFixed(1).padStart(5)}  ${((100 * mean(rec[key])) / total).toFixed(0).padStart(3)}%`);
console.log(`  ${'total'.padEnd(22)} ${total.toFixed(1).padStart(5)}`);
console.log('\nEach line: summoned in the matches where it was drawn (per player):');
for (const p of PATHS) console.log(`  ${p.id.padEnd(11)} ${((100 * played[p.id]) / Math.max(1, drawn[p.id])).toFixed(0).padStart(3)}%  (${played[p.id]} of ${drawn[p.id]})`);
console.log(`\nTriggers per match: ${Object.entries(triggers).sort((a, b) => b[1] - a[1]).map(([kk, v]) => `${kk} ${(v / N).toFixed(1)}`).join(', ')}`);
console.log(`On Summon target choices per match: ${(choices / N).toFixed(1)}`);
console.log(`Keywords acting per match: ${Object.entries(keywords).sort((a, b) => b[1] - a[1]).map(([kk, v]) => `${kk} ${(v / N).toFixed(1)}`).join(', ')}`);
