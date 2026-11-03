// V7a balance experiment: runs the round-robin for each variant (flags only, never the
// game's settings) in parallel child processes and prints one table.
//
//   node v2/tools/variants.js [matches per matchup, default 100] [--jobs=4]
//
// Each config plays the three mixed matchups (seats alternate, so half each way round).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CONFIGS = [
  [], ['T75'], ['T90'], ['L+'], ['CH8'], ['W1'], ['W2'],
  ['T75', 'L+'], ['T75', 'W1'], ['T75', 'L+', 'W1'], ['T90', 'L+', 'W1', 'W2'], ['T75', 'CH8', 'W1'],
];

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
  const out = new Array(CONFIGS.length);
  let next = 0;
  const worker = async () => {
    while (next < CONFIGS.length) {
      const i = next++;
      out[i] = await run(CONFIGS[i], n);
      console.error(`done: ${CONFIGS[i].join('+') || 'baseline'}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  console.log('| Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |');
  console.log('|---|---|---|---|---|---|');
  for (let i = 0; i < CONFIGS.length; i++) console.log(row(CONFIGS[i], out[i].results));
}
