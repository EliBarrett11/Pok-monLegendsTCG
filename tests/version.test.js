// Checks that index.html lists every game module for cache busting, so no
// file can be served from an old cached copy after an update.
// Run with: node tests/version.test.js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const html = readFileSync(join(root, 'index.html'), 'utf8');
const block = html.match(/const MODULES = \[([\s\S]*?)\];/);
assert.ok(block, 'index.html has the MODULES list');
const listed = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

const files = [];
(function walk(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) walk(path);
    else if (name.endsWith('.js')) files.push(path);
  }
})('src');

assert.deepEqual(listed, files.sort(), 'every module in src/ is listed in index.html, and nothing else');
assert.ok(html.includes("import './src/main.js'"), 'the game starts through the import map');
console.log('Cache-busting list is complete.');
