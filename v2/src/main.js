// Pokémon Legends v2 — entry point (V1: the core, against the AI).
// ?seed=123 replays the same shuffle and coin flip; ?autoplay lets the AI play
// both sides (for watching and testing).
import { createGame, applyAction } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { renderMatch } from './ui/board.js';

export const BUILD = 'V1 — v2 core';

const STAGE = { width: 1920, height: 1080 };
const stage = document.getElementById('stage');
function fitStage() {
  const scale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height);
  const x = (innerWidth - STAGE.width * scale) / 2;
  const y = (innerHeight - STAGE.height * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}
addEventListener('resize', fitStage);
fitStage();

const params = new URLSearchParams(location.search);
const autoplay = params.has('autoplay');
const root = document.getElementById('app');
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const PAUSE = autoplay ? 250 : 650;   // a short pause before each AI action, so it can be followed

let state = null;
let match = 0;   // bumped by New match, so an old match's AI loop stops
const ui = { summon: null, attacker: null, locked: false };

function redraw() {
  renderMatch(root, state, ui, { build: BUILD, autoplay, act, newMatch, redraw });
}

// An action from the screen (or the AI). Errors from the engine are shown, not thrown.
async function act(action) {
  try {
    state = applyAction(state, action);
  } catch (err) {
    alert(err.message);
    return;
  }
  ui.summon = null;
  ui.attacker = null;
  redraw();
  await aiTurn(match);
}

// The AI acts while it's its move (with ?autoplay, both sides), one action at a time.
async function aiTurn(id) {
  ui.locked = true;
  redraw();
  for (let guard = 0; guard < 2000 && id === match && state.phase !== 'gameOver'; guard++) {
    const who = state.phase === 'initiative' ? (autoplay ? 'player' : null) : state.turn;
    if (!who || (who === 'player' && !autoplay)) break;
    await wait(PAUSE);
    if (id !== match) return;
    const action = chooseAction(state, who);
    if (!action) break;
    state = applyAction(state, action);
    redraw();
  }
  if (id !== match) return;
  ui.locked = false;
  redraw();
}

function newMatch() {
  match += 1;
  const seed = (match === 1 && Number(params.get('seed'))) || Date.now();
  state = createGame(seed);
  ui.summon = null;
  ui.attacker = null;
  ui.locked = false;
  redraw();
  if (autoplay) aiTurn(match);
}

newMatch();
