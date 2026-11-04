// V3-0: v3 is its own game in v3/: plain JS modules with relative paths, its engine free of DOM
// code, sharing only the root assets/ folder (no code imported from v1 or v2).
// Run: node v3/tests/setup.test.js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERIES, MOVES, SUPPORTERS, WILD } from '../src/engine/cards.js';
import { LOCATIONS, PALLET_TOWN, CHAMPIONSHIP } from '../src/engine/locations.js';
import { RULES } from '../src/rules.js';

const V3 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(V3, '..');
const files = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
const src = files(join(V3, 'src')).filter((f) => f.endsWith('.js'));
for (const f of src) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/from '([^']+)'/g)) {
    const target = resolve(dirname(f), m[1]);
    assert.ok(target.startsWith(V3), `${f}: imports only from v3 (${m[1]})`);
    assert.ok(existsSync(target), `${f}: ${m[1]} exists`);
  }
  if (f.includes('/engine/') || f.includes('/ai/') || f.endsWith('rules.js')) assert.ok(!/document\.|window\./.test(text), `${f}: no DOM code`);
}
// The page and the stylesheet: relative paths only.
assert.ok(!/(src|href)="\//.test(readFileSync(join(V3, 'index.html'), 'utf8')), 'index.html: relative paths');
const css = readFileSync(join(V3, 'src/ui/style.css'), 'utf8');
for (const m of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(existsSync(resolve(V3, 'src/ui', m[1])), `style.css: ${m[1]} exists`);
// Art: every card and Location's placeholder art is in assets/.
for (const c of [...SERIES, WILD, ...MOVES, ...SUPPORTERS]) assert.ok(existsSync(join(ROOT, 'assets/cards', `${c.art}.jpg`)), `${c.name}: art ${c.art}`);
for (const l of [PALLET_TOWN, CHAMPIONSHIP, ...LOCATIONS]) assert.ok(existsSync(join(ROOT, 'assets', l.art)), `${l.name}: art ${l.art}`);
assert.equal(PALLET_TOWN.width, 2);
for (const l of LOCATIONS) assert.ok(l.width >= 1 && l.width <= 3, `${l.name}: 1–3 lanes`);
assert.equal(CHAMPIONSHIP.width, RULES.spaces);
// Icons are coded (no icon images).
for (const f of [...src, join(V3, 'src/ui/style.css')]) assert.ok(!/icons\/|\.svg['")]|\.png['")]/.test(readFileSync(f, 'utf8')), `${f}: coded icons only`);
console.log('setup: v3 stands alone (own engine, AI, UI; shared art only) — ok');
