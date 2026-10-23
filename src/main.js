// Entry point: holds the current game state, sends the player's actions
// to the engine, and lets the AI respond.
import { createGame, applyAction } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { render } from './ui/render.js';

export const BUILD = 'Step 1 — match setup';

document.getElementById('build-tag').textContent = BUILD;

const root = document.getElementById('app');
const seedFromUrl = Number(new URLSearchParams(location.search).get('seed'));
let state = createGame(seedFromUrl || Date.now());

function dispatch(action) {
  try {
    state = applyAction(state, action);
  } catch (err) {
    alert(err.message);
    return;
  }
  // In simultaneous steps the AI chooses in secret right away; the engine
  // only reveals both choices once both players have locked in.
  const aiAction = chooseAction(state, 'ai');
  if (aiAction) state = applyAction(state, aiAction);
  draw();
}

function newGame() {
  state = createGame(Date.now());
  draw();
}

function draw() {
  render(root, state, { dispatch, newGame });
}

draw();
