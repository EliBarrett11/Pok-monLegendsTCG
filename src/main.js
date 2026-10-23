// Entry point: wires the pure game engine to the browser UI.
import { createGame } from './engine/game.js';
import { render } from './ui/render.js';

export const BUILD = 'Step 0 — project shell';

document.getElementById('build-tag').textContent = BUILD;

const state = createGame();
render(document.getElementById('app'), state);
