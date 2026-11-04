// Cache-busting (V3-1 fix): browsers and GitHub Pages cache JavaScript modules, so after a push
// players could keep getting the previous build. This stamps every relative import in v3/src,
// the stylesheet and the entry script in v3/index.html with ?v=<stamp>, so each build's files
// have new URLs. Run before each commit: node v3/tools/stamp.mjs [stamp] (default: the time).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const V3 = join(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = process.argv[2] ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
const tag = (spec) => `${spec.replace(/\?v=[^'"]*$/, '')}?v=${stamp}`;
for (const f of files(join(V3, 'src')).filter((x) => x.endsWith('.js'))) {
  const text = readFileSync(f, 'utf8');
  const out = text.replace(/(from\s+|import\s*\(\s*|import\s+)'(\.{1,2}\/[^']+)'/g, (m, pre, spec) => `${pre}'${tag(spec)}'`);
  if (out !== text) writeFileSync(f, out);
}
const html = join(V3, 'index.html');
writeFileSync(html, readFileSync(html, 'utf8').replace(/(src|href)="(src\/[^"]+)"/g, (m, attr, spec) => `${attr}="${tag(spec)}"`));
console.log(`v3 stamped: ?v=${stamp}`);
