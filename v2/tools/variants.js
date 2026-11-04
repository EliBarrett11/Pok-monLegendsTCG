// The balance experiments (V7a–V7f; V7 kept): runs the round-robin for each variant (flags only, never the
// game's settings) in parallel child processes and prints one table.
//
//   node v2/tools/variants.js [matches per matchup, default 100] [--jobs=4] [--set=v7]
//        [--configs="T75;N1,GX;F½"] [--json > results.json]
//
// Each config plays the three mixed matchups (seats alternate, so half each way round).
// --json prints every config's full results as JSON (instead of the table); `node v2/tools/variants.js --show=results.json`
// prints the round-robin report (with all diagnostics) for each saved config.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { report } from './roundrobin.js';

// The V7a–V7f experiment sets used flags that V7 made the real rules and cards (T90, CH9,
// LG, GS, F1, WA, S2c), so they're retired; their results are in the v2 README build log.
// V7 keeps one set: the current game against a few of the remaining levers.
export const SETS = {
  v7: [[], ['T75'], ['CH10'], ['F½'], ['WA½'], ['N1', 'GX']],
};
export const CONFIGS = SETS.v7;

const RR = fileURLToPath(new URL('./roundrobin.js', import.meta.url));
const run = (flags, n) => new Promise((resolve, reject) => {
  const args = [RR, String(n), '--mixed', '--json'];
  if (flags.length) args.push(`--variant=${flags.join(',')}`);
  const p = spawn(process.execPath, args);
  let out = '';
  let err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code === 0 ? resolve(JSON.parse(out.trim().split('\n').at(-1))) : reject(new Error(`${flags.join('+') || 'baseline'}: ${err}`))));
});

export function row(flags, results) {
  const n = results.reduce((x, r) => x + r.n, 0);
  const rate = (r) => `${Math.round((100 * r.deck[r.pair[0]].wins) / r.n)}%`;
  const sum = (k) => results.reduce((x, r) => x + r.ends[k], 0);
  const rounds = results.reduce((x, r) => x + r.rounds, 0) / n;
  const pct = (x) => `${Math.round((100 * x) / n)}%`;
  return `| ${flags.join('+') || 'baseline'} | ${results.map(rate).join(' | ')} | ${rounds.toFixed(1)} | ${pct(sum('early'))} / ${pct(sum('championship'))} / ${pct(sum('final'))} |`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const n = Number(args.find((x) => /^\d+$/.test(x))) || 100;
  const jobs = Number(args.find((x) => x.startsWith('--jobs='))?.slice(7)) || 4;
  const show = args.find((x) => x.startsWith('--show='))?.slice(7);
  if (show) {
    for (const { flags, results } of JSON.parse(readFileSync(show, 'utf8'))) {
      console.log(`### ${flags.join('+') || 'baseline'}`);
      for (const r of results) console.log(report(r));
    }
    process.exit(0);
  }
  const listed = args.find((x) => x.startsWith('--configs='))?.slice(10);
  const configs = listed ? listed.split(';').map((c) => c.split(',').filter(Boolean))
    : SETS[args.find((x) => x.startsWith('--set='))?.slice(6) ?? 'v7a'];
  const out = new Array(configs.length);
  let next = 0;
  const worker = async () => {
    while (next < configs.length) {
      const i = next++;
      out[i] = await run(configs[i], n);
      console.error(`done: ${configs[i].join('+') || 'the game as it is'}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  if (args.includes('--json')) {
    console.log(JSON.stringify(out));
    process.exit(0);
  }
  console.log('| Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |');
  console.log('|---|---|---|---|---|---|');
  for (let i = 0; i < configs.length; i++) console.log(row(configs[i], out[i].results));
}
