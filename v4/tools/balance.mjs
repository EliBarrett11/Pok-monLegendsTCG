// G3 balance report: node v4/tools/balance.mjs [matches=200] [out=v4/docs/balance-g3.md]
// AI-vs-AI matches (fixed seeds 1..N) with the final 40-card deck, measured against section 6 of
// docs/v4-gameplay-update.md. It reports the numbers and, for each measure out of range, a suggested
// number to change; it changes nothing itself. Pure Node: the same engine and AI as the browser.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, actor } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/ai.js';
import { DEMO_DECK, ITEMS, cardAtRound } from '../src/engine/cards.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const N = Number(process.argv[2] ?? 200);
const OUT = process.argv[3] ?? resolve(HERE, '../docs/balance-g3.md');
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const quant = (a, q) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const pct = (x) => `${(100 * x).toFixed(0)}%`;

// Recognition sources (section 6's five shares; anything else, e.g. Amulet Coin, is listed as "other").
const SOURCES = [
  ['damage', (s) => /'s attack$|Overrun/.test(s)],
  ['defeats', (s) => /^defeating /.test(s)],
  ['dominance', (s) => /^dominating /.test(s)],
  ['Favours', (s) => /Favour/.test(s)],
  ['Objectives', (s) => /Objective/.test(s)],
  ['other (Amulet Coin)', () => true],
];
const TARGET = { damage: [0.40, 0.55], defeats: [0.20, 0.30], dominance: [0.15, 0.25], Favours: [0.05, 0.10], Objectives: [0.05, 0.10] };
// The action that plays a card from hand, by type.
const PLAYS = { summon: 'uid', command: 'uid', react: 'uid', supporter: 'uid', placeLocation: 'uid', trainerCommand: 'uid', buyItem: 'uid' };

const rounds = [];
let firstWins = 0;
let finished = 0;
const rec = Object.fromEntries(SOURCES.map(([k]) => [k, 0]));
const dollarsEarned = [];
const itemsBought = [];
const martPerRound = [];
const martBought = {};
const deckIds = [...new Set(DEMO_DECK)];
const drawn = Object.fromEntries(deckIds.map((id) => [id, 0]));
const played = Object.fromEntries(deckIds.map((id) => [id, 0]));
const playedWins = Object.fromEntries(deckIds.map((id) => [id, 0]));
const modesUsed = {};
for (let seed = 1; seed <= N; seed++) {
  let s = createGame(seed);
  const first = s.initiative;
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  const seen = { player: new Set(), ai: new Set() };
  const used = { player: new Set(), ai: new Set() };
  // $ earned = $ at the end − $ at the start + $ spent (Breakfast's $1 has no event of its own).
  const start$ = { player: s.players.player.dollars, ai: s.players.ai.dollars };
  const spent = { player: 0, ai: 0 };
  const bought = { player: 0, ai: 0 };
  const shown = {};
  const note = (st) => { (shown[st.round] ??= new Set()); if (st.mart.onSale[0]) shown[st.round].add(st.mart.onSale[0].id); };
  note(s);
  for (let n = 0; n < 6000 && s.phase !== 'gameOver'; n++) {
    for (const w of ['player', 'ai']) for (const c of s.players[w].hand) seen[w].add(c.id);
    const who = actor(s);
    const a = chooseAction(s, who, { rng });
    if (PLAYS[a.type] && a.uid) {
      const c = s.players[who].hand.find((x) => x.uid === a.uid);
      if (c) { used[who].add(c.id); if (a.mode || a.type === 'react') modesUsed[`${c.id}:${a.type === 'react' ? 'react' : a.mode}`] = (modesUsed[`${c.id}:${a.type === 'react' ? 'react' : a.mode}`] ?? 0) + 1; }
    }
    if (a.type === 'useItem') { const c = s.players[who].bag.find((x) => x.uid === a.uid); if (c) used[who].add(c.id); }
    if (a.type === 'buyItem' && a.from === 'mart') martBought[s.mart.onSale[a.slot].id] = (martBought[s.mart.onSale[a.slot].id] ?? 0) + 1;
    s = applyAction(s, a);
    note(s);
    for (const e of s.events) {
      if (e.type === 'recognition') { const src = SOURCES.find(([, f]) => f(e.source)); rec[src[0]] += e.amount; }
      if (e.type === 'itemBought') { bought[e.who] += 1; spent[e.who] += e.price; }
    }
  }
  rounds.push(s.round);
  martPerRound.push(...Object.values(shown).map((x) => x.size));
  if (s.winner) { finished += 1; if (s.winner === first) firstWins += 1; }
  for (const w of ['player', 'ai']) {
    dollarsEarned.push(s.players[w].dollars - start$[w] + spent[w]);
    itemsBought.push(bought[w]);
    for (const id of seen[w]) if (drawn[id] !== undefined) { drawn[id] += 1; if (used[w].has(id)) { played[id] += 1; if (s.winner === w) playedWins[id] += 1; } }
  }
}

// --- The numbers -------------------------------------------------------------------------------------------------
const recTotal = Object.values(rec).reduce((a, b) => a + b, 0);
const share = Object.fromEntries(Object.entries(rec).map(([kk, v]) => [kk, v / recTotal]));
const firstRate = firstWins / Math.max(1, finished);
const med = median(rounds);
const dMean = mean(dollarsEarned);
const iMean = mean(itemsBought);
const mMean = mean(martPerRound);
const cards = deckIds.map((id) => ({ id, name: cardAtRound(id, 1).name, type: cardAtRound(id, 1).cardType, drawn: drawn[id], played: played[id], rate: played[id] / Math.max(1, drawn[id]), win: playedWins[id] / Math.max(1, played[id]) }));
const inRange = (x, [lo, hi]) => x >= lo && x <= hi;
const mark = (ok) => (ok ? 'in range' : '**out of range**');

// --- Suggestions (numbers to change; nothing is changed here) ------------------------------------------------------
const sug = [];
if (med < 7) sug.push(`**Match length** (median ${med} < 7): raise \`RULES.win\` from ${RULES.win} to about ${Math.round((RULES.win * 8) / med / 5) * 5} (Recognition scales roughly with Rounds played), or lower \`perDamageToPlayer\`.`);
if (med > 9) sug.push(`**Match length** (median ${med} > 9): lower \`RULES.win\` from ${RULES.win} to about ${Math.round((RULES.win * 8) / med / 5) * 5}.`);
if (!inRange(firstRate, [0.45, 0.55])) {
  sug.push(firstRate > 0.55
    ? `**First-player win rate** (${pct(firstRate)} > 55%): give the second player a start bonus, e.g. **+1 Base Energy in Round 1** for the player without initiative (\`baseEnergy\` 3 → 4 for them), or **+$1 at setup**. The first player attacks first each Round with matched Speed; +1 Energy in Round 1 is about one extra early summon.`
    : `**First-player win rate** (${pct(firstRate)} < 45%): the second player's edge is too large (they see the first move and React to it); drop any second-player compensation or give the first player +$1.`);
}
for (const [key, range] of Object.entries(TARGET)) {
  const x = share[key];
  if (inRange(x, range)) continue;
  const per = { damage: 'perDamageToPlayer', defeats: 'perDefeat', dominance: 'perDominance', Favours: 'perFavour', Objectives: 'perObjective' }[key];
  const want = (range[0] + range[1]) / 2;
  const now = RULES[per];
  const to = Math.max(1, Math.round(now * (want / Math.max(x, 0.001))));
  if (key === 'Objectives') {
    sug.push(`**Objectives** share (${pct(x)}, target 5–10%): raise \`RULES.perObjective\` (Recognition per Objective point) from ${now} to **${Math.min(to, 6)}**, which moves the share to about ${pct(x * Math.min(to, 6) / now)} (the share grows in step with it); or, keeping ${now}, shorten Misty's Objective from 8 defeats to 6 so more points are reached.`);
  } else sug.push(`**${key}** share (${pct(x)}, target ${pct(range[0])}–${pct(range[1])}): change \`RULES.${per}\` from ${now} to about **${to}**.`);
}
if (dMean < 15) sug.push(`**$ earned per player** (${dMean.toFixed(1)} < ~15): raise \`RULES.dollarsPerRound\` from ${RULES.dollarsPerRound} to 2 (≈ +${med.toFixed(0)} per match), or \`dollarsPerDefeat\` from ${RULES.dollarsPerDefeat} to 2.`);
if (dMean > 20) sug.push(`**$ earned per player** (${dMean.toFixed(1)} > ~20): lower \`RULES.dollarsPerDefeat\` from ${RULES.dollarsPerDefeat} to 0 for Partners, or raise mid prices by $1.`);
if (iMean < 5) sug.push(`**Items bought per player** (${iMean.toFixed(1)} < 5): with more $ (above) this rises; otherwise lower the $3 Items to $2 and the $4 Items to $3.`);
if (iMean > 8) sug.push(`**Items bought per player** (${iMean.toFixed(1)} > 8): raise Oran Berry and Potion by $1.`);
if (mMean < 3) sug.push(`**PokéMart variety** (${mMean.toFixed(1)} different Items per Round < 3): lower every Stock, e.g. $1 → 4, $2 → 3, $3 → 2, $4 → 2, so an Item sells out (or runs out) within a Round and a new one comes in.`);
if (mMean > 5) sug.push(`**PokéMart variety** (${mMean.toFixed(1)} > 5): raise the Stocks by about a third.`);
const low = cards.filter((c) => c.drawn >= 20 && c.rate < 0.3);
const high = cards.filter((c) => c.played >= 20 && c.win > 0.6);
for (const c of low) sug.push(`**${c.name}** is played in only ${pct(c.rate)} of the matches where it is drawn (< 30%): ${c.type === 'Command' ? 'lower its Adapt cost by 1' : c.type === 'Supporter' ? 'lower its Release by 1, or strengthen the base effect by 1' : c.type === 'Item' ? 'lower its price by $1' : c.type === 'Location' ? 'shorten it by one lane' : 'lower its cost by 1 at its first Level'} (the AI may also undervalue it; check in a playtest).`);
for (const c of high) sug.push(`**${c.name}**: the player who plays it wins ${pct(c.win)} (> 60%): weaken its effect by 1 (or note that it is played mostly by players already ahead).`);
// Bubble Beam React: the attacker is always Spent after attacking, so in v4 it does nothing.
sug.push('**Bubble Beam React** ("the attacker becomes Spent after its attack") has no effect in v4: an attacker is always Spent after attacking. Suggestion: "the attack deals 2 less damage" (cost 1), or "the attacker stays Spent through the next Breakfast" (it doesn\'t become Active next Round).');

// --- The report ------------------------------------------------------------------------------------------------------------
const rows = (xs) => xs.join('\n');
const md = `# v4 G3 balance report

${N} AI-vs-AI matches, fixed seeds 1–${N}, the final 40-card deck (docs/v4-gameplay-update.md 5.4), measured
against section 6. Generated by \`node v4/tools/balance.mjs\`; nothing in the rules was changed. The AI is
a one-move greedy player, so the numbers describe AI play: Elliott's playtest has the final say.

## Section 6 targets

| Measure | Target | Result | |
|---|---|---|---|
| Median match length | 7–9 Rounds | ${med} Rounds (middle half ${quant(rounds, 0.25)}–${quant(rounds, 0.75)}, range ${Math.min(...rounds)}–${Math.max(...rounds)}) | ${mark(inRange(med, [7, 9]))} |
| First-player win rate | 45–55% | ${pct(firstRate)} (${firstWins} of ${finished}) | ${mark(inRange(firstRate, [0.45, 0.55]))} |
${rows(Object.entries(TARGET).map(([kk, r]) => `| Recognition: ${kk} | ${pct(r[0])}–${pct(r[1])} | ${pct(share[kk])} | ${mark(inRange(share[kk], r))} |`))}
| $ earned per player | ~15–20 | ${dMean.toFixed(1)} (median ${median(dollarsEarned)}) | ${mark(inRange(dMean, [14.5, 20.5]))} |
| Items bought per player | 5–8 | ${iMean.toFixed(1)} (median ${median(itemsBought)}) | ${mark(inRange(iMean, [5, 8]))} |
| Different PokéMart Items per Round | 3–5 | ${mMean.toFixed(1)} | ${mark(inRange(mMean, [3, 5]))} |
| Cards played when drawn | ≥30% each | ${cards.filter((c) => c.rate >= 0.3).length} of ${cards.length} cards | ${mark(!low.length)} |
| Win rate when played | ≤60% each | ${cards.filter((c) => c.win <= 0.6).length} of ${cards.length} cards | ${mark(!high.length)} |

Recognition by source (all matches): ${Object.entries(rec).map(([kk, v]) => `${kk} ${v} (${pct(share[kk])})`).join(' · ')}.

## Suggestions (numbers to change)

${sug.map((x) => `- ${x}`).join('\n')}

## Each card

Play rate: the share of matches (per player) where the card was drawn in which it was played. Win rate:
how often the player who played it won.

| Card | Type | Drawn | Played | Play rate | Win rate when played |
|---|---|---|---|---|---|
${rows(cards.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map((c) => `| ${c.name} | ${c.type} | ${c.drawn} | ${c.played} | ${pct(c.rate)}${c.rate < 0.3 ? ' ⚠' : ''} | ${pct(c.win)}${c.win > 0.6 ? ' ⚠' : ''} |`))}

Command modes played (all matches): ${Object.entries(modesUsed).sort().map(([kk, v]) => `${kk} ${v}`).join(', ')}.

PokéMart Items bought from the PokéMart (all matches): ${ITEMS.map((i) => `${i.name} ${martBought[i.id] ?? 0}`).join(', ')}.
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md);
console.log(md);
