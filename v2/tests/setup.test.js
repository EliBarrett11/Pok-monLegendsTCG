// V0 — the v2 scaffold: a separate game in v2/ that shares the root assets/ by
// relative path (so it works at …/Pok-monLegendsTCG/v2/ on GitHub Pages), keeps
// its engine free of DOM code, and leaves the current game untouched.
// Run with: node v2/tests/setup.test.js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LANES, RECOGNITION_TARGET, ROUND_LIMIT, CHAMPIONSHIP_ROUND, MAX_LEVEL, LEGENDARY_LEVEL, levelFor, costFor, DECK_SIZE,
} from '../src/engine/rules.js';
import { SERIES, artFor } from '../src/engine/series.js';
import '../src/engine/cards.js';   // registers the V6 decks' series too

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(V2, '..');

// Every file under v2/ (but not v2/tests).
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === 'tests' ? [] : files(path)) : [path];
  });
}
const source = files(V2).filter((f) => /\.(html|css|js)$/.test(f));

// --- The layout: the folders the roadmap asks for -------------------------------------------

for (const dir of ['src/engine', 'src/ai', 'src/ui', 'tests']) assert.ok(existsSync(join(V2, dir)), `v2/${dir}`);
assert.ok(existsSync(join(V2, 'index.html')) && existsSync(join(V2, 'README.md')));

// --- Paths: relative, and they all resolve (shared assets from the root assets/ folder) ---------

// Paths in HTML and in markup built by JS are relative to the page (v2/index.html); CSS url()
// and JS imports to their own file. (Paths built from template strings are checked below.)
const refs = [];
for (const file of source) {
  const text = readFileSync(file, 'utf8');
  const fromPage = [...text.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const fromFile = [
    ...[...text.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]),
    ...[...text.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]),
  ];
  for (const p of fromPage) refs.push({ file, p, base: V2 });
  for (const p of fromFile) refs.push({ file, p, base: dirname(file) });
}
const checked = refs.filter(({ p }) => !/^https?:/.test(p) && !p.includes('${'));
assert.ok(checked.length > 5, 'found the references');
for (const { file, p, base } of checked) {
  assert.ok(!p.startsWith('/'), `${relative(ROOT, file)}: "${p}" must be relative (GitHub Pages serves v2 at …/v2/)`);
  assert.ok(existsSync(resolve(base, p)), `${relative(ROOT, file)}: "${p}" exists`);
}
// Shared art is used from the root, never copied into v2/.
assert.ok(!existsSync(join(V2, 'assets')), 'no copy of assets/ in v2/');
// Paths built in JS for the page: every test card's art and Type icon exist (shared from the root).
for (const line of SERIES) {
  // Every Level shows art: its own stage's, or the line's base art.
  // A Partner with no art yet shows the Pokémon frame (V5).
  for (let level = 1; level <= line.maxLevel; level++) {
    const art = artFor(line, level);
    assert.ok(art ? existsSync(join(ROOT, 'assets/cards', `${art}.jpg`)) : line.partnerOnly && existsSync(join(ROOT, 'assets/ui/frame-pokemon.jpg')), `${line.id} L${level}: art`);
  }
  // Ghost and Dragon have no icon yet: the card shows a short label (board.js TYPE_ICONS).
  assert.ok(['Ghost', 'Dragon'].includes(line.type) || existsSync(join(ROOT, 'assets/ui/icons', `type-${line.type.toLowerCase()}.webp`)), `${line.id}: Type icon`);
}
assert.ok(existsSync(join(ROOT, 'assets/ui/card-back.jpg')));

// --- The engine has no DOM code (the same rule as v1) -------------------------------------------

for (const file of files(join(V2, 'src/engine'))) {
  const text = readFileSync(file, 'utf8');
  assert.ok(!/\b(document|window|HTMLElement|innerHTML)\b/.test(text), `${relative(ROOT, file)}: no DOM`);
}

// --- The settled numbers (docs/v2-design.md 1.1, 4, 6.1, 7a) ------------------------------------

assert.deepEqual([LANES, RECOGNITION_TARGET, ROUND_LIMIT, CHAMPIONSHIP_ROUND, DECK_SIZE], [9, 60, 12, 10, 40]);
assert.deepEqual([MAX_LEVEL, LEGENDARY_LEVEL], [6, 7]);
assert.deepEqual([1, 3, 6, 9].map((round) => levelFor(round, 6)), [1, 3, 6, 6], 'Level = the Round, up to the cap');
assert.equal(levelFor(5, 3), 3, 'a lower training cap');
assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((l) => costFor(l)), [1, 1, 2, 3, 3, 4, 6], 'the cost curve (Legendary Level 7: 6)');
assert.equal(costFor(7, 'heavy'), 7, 'a heavy Legendary: 7');
assert.deepEqual([1, 2, 3, 4, 5, 6].map((l) => costFor(l, 'heavy')), [2, 2, 3, 4, 4, 5], 'heavy: +1');
assert.deepEqual([1, 2, 3, 4, 5, 6].map((l) => costFor(l, 'very heavy')), [3, 3, 4, 5, 5, 6], 'heavy: +2');
assert.deepEqual([1, 2, 3, 6].map((l) => costFor(l, 'light')), [0, 0, 1, 3], 'light: −1, never below 0');
assert.throws(() => costFor(8), /No Level 8/);

// --- The current game is untouched: v2 only reads from the root ----------------------------------

for (const file of source.filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(file, 'utf8');
  assert.ok(!/writeFile|unlink|rmSync/.test(text), `${relative(ROOT, file)} never writes`);
}

console.log('All v2 setup tests passed.');
