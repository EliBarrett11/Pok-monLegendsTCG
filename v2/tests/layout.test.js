// v2 Feedback A — the setup screen and the "nothing clipped" rule (docs/v2-design.md 7b).
// The full check runs in a browser: node v2/tools/layout.mjs (after every v2 step). This test
// checks what Node can: every deck on the setup screen has its art and one-line plan, and the
// layout check covers every screen, dialog type and window size the rule names.
// Run with: node v2/tests/layout.test.js
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECKS } from '../src/engine/cards.js';
import { DECK_LOOK } from '../src/ui/setup.js';

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(V2, '..');

// Every deck (and Random, and Your deck) has a plan; the three decks show their own art.
for (const id of [...Object.keys(DECKS), 'random', 'custom']) {
  assert.ok(DECK_LOOK[id]?.plan?.length > 10, `${id}: a one-line plan`);
}
for (const id of Object.keys(DECKS)) {
  assert.ok(DECK_LOOK[id].art, `${id}: deck art`);
  assert.ok(existsSync(resolve(ROOT, 'assets/cards', `${DECK_LOOK[id].art}.jpg`)), `${id}: art file exists`);
}

// The layout check: all three sizes, every screen and dialog type.
const tool = readFileSync(resolve(V2, 'tools/layout.mjs'), 'utf8');
for (const size of ['1920x1080', '1366x768', '1280x720']) assert.ok(tool.includes(size), `checks ${size}`);
for (const scenario of ['setup', 'deckbuilder', 'board', 'board-busy', 'empower', 'strategy', 'preview', 'choose', 'codex', 'codex-rules', 'tracey', 'amount', 'pick', 'space', 'release', 'item', 'trainer', 'assign', 'end-victory', 'hotseat-pick', 'hotseat-pass', 'online-waiting', 'online-decks', 'online-error', 'online-mismatch']) {
  assert.ok(tool.includes(`${scenario.includes('-') ? `'${scenario}'` : scenario}:`), `checks ${scenario}`);
}
// It fails on the page scrolling, things off-screen, clipped or covered.
for (const rule of ['scrolls', 'outside', 'clipped', 'covered']) assert.ok(tool.includes(rule), `fails on ${rule}`);

// The rule is in the design doc.
assert.ok(readFileSync(resolve(ROOT, 'docs/v2-design.md'), 'utf8').includes('Nothing clipped: every piece of information and every action is visible and usable in full screen without scrolling at 1920×1080, 1366×768 and 1280×720.'));

console.log('layout: setup decks and the nothing-clipped check — ok');
