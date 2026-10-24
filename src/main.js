// Entry point: holds the current game state, sends the player's actions
// to the engine, lets the AI respond, and plays each action back on screen.
import { createGame, applyAction } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { render, STAGE } from './ui/render.js';
import { present, think, skip, resetFx } from './ui/present.js';

export const BUILD = 'V1b — Animations and opponent actions';

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
const params = new URLSearchParams(location.search);
const seedFromUrl = Number(params.get('seed'));
// ?autoplay: the AI plays both sides (for watching, and for testing the presentation).
const autoplay = params.has('autoplay');
let state = createGame(seedFromUrl || Date.now());

// While actions play out, input is locked; it unlocks when it's the player's move.
let busy = false;
let match = 0;   // bumped by New match, so an old match's playback stops
const lockEl = document.getElementById('lock');
lockEl.onclick = () => skip();
function lock(on) {
  busy = on;
  stage.classList.toggle('locked', on);
}

async function show(prev, next, who) {
  await present(root, prev, next, who, draw);
}

async function dispatch(action) {
  if (busy) return;
  let next;
  try {
    next = applyAction(state, action);
  } catch (err) {
    alert(err.message);
    return;
  }
  const id = match;
  lock(true);
  const prev = state;
  state = next;
  await show(prev, next, 'player');
  await opponentActs(id);
  if (id !== match) return;
  lock(false);
  draw();
}

// The AI acts one action at a time until it's the player's move. In
// simultaneous steps it chooses in secret; the engine reveals both choices
// once both have locked in. Each visible action gets a short thinking pause
// first, and is shown in full before the next starts.
async function opponentActs(id) {
  for (let guard = 0; guard < 1000 && id === match; guard++) {
    let who = 'ai';
    let action = chooseAction(state, 'ai');
    if (!action && autoplay) {
      who = 'player';
      action = chooseAction(state, 'player') ?? (state.phase === 'initiative' ? { type: 'flipCoin' } : null);
    }
    if (!action) return;
    if (who === 'ai' && state.phase === 'battle') await think(stage);
    await nextFrame();   // lets the page paint and take clicks between actions, even at Instant speed
    if (id !== match) return;
    const prev = state;
    state = applyAction(state, action);
    await show(prev, state, who);
  }
}

const nextFrame = () => new Promise((resolve) => { setTimeout(resolve, 0); });

function newGame() {
  match += 1;
  resetFx();
  lock(false);
  state = createGame(Date.now());
  draw();
  if (autoplay) start();
}

function draw() {
  render(root, state, { dispatch, newGame });
}

async function start() {
  const id = match;
  lock(true);
  await opponentActs(id);
  if (id !== match) return;
  lock(false);
  draw();
}

draw();
if (autoplay) start();
