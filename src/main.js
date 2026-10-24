// Entry point: holds the current game state, sends the player's actions
// to the engine, and lets the AI respond.
import { createGame, applyAction } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { render, STAGE } from './ui/render.js';

export const BUILD = 'V1a — One-screen layout';

document.getElementById('build-tag').textContent = BUILD;

// The whole game is drawn on a fixed 1920×1080 stage, scaled uniformly to
// fit the window and centred (letterboxed), so the page never scrolls.
const stage = document.getElementById('stage');
function fitStage() {
  const scale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height);
  const x = (innerWidth - STAGE.width * scale) / 2;
  const y = (innerHeight - STAGE.height * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}
addEventListener('resize', fitStage);
fitStage();

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
  // The AI acts until it's the player's move. In simultaneous steps it
  // chooses in secret; the engine only reveals both choices once both have
  // locked in. In Battle it takes each turn that is its own.
  for (let guard = 0; guard < 100; guard++) {
    const aiAction = chooseAction(state, 'ai');
    if (!aiAction) break;
    state = applyAction(state, aiAction);
  }
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
