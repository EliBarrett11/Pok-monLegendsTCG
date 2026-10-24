// Entry point: holds the current game state, sends the player's actions
// to the engine, lets the AI respond, and plays each action back on screen.
import { createGame, applyAction, legalActions } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { render, STAGE, pushHistory, clearHistory, setCaption } from './ui/render.js';
import { present, think, skip, resetFx, historyEntry, captionFor } from './ui/present.js';
import { speedFactor } from './ui/settings.js';

export const BUILD = 'V6 — Resources and piles';


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
  pushHistory(historyEntry(prev, next, who));
  await present(root, prev, next, who, draw);
}

// Simultaneous steps (Trainers, mulligan, XP): both players choose at once.
// The AI takes a moment, then locks in on its own, so "Opponent ready" shows
// while the player is still choosing. Input stays open meanwhile.
const SIMULTANEOUS = ['assignTrainers', 'mulligan', 'spendXp'];
let lockInTimer = null;
function scheduleAiLockIn(id) {
  clearTimeout(lockInTimer);
  lockInTimer = setTimeout(() => {
    if (id !== match || busy) return;
    const action = chooseAction(state, 'ai');
    if (!action || !SIMULTANEOUS.includes(action.type)) return;
    state = applyAction(state, action);
    setCaption(captionFor(state, 'ai'));
    draw();
  }, (900 + Math.random() * 900) * speedFactor());
}

async function dispatch(action) {
  if (busy) return;
  clearTimeout(lockInTimer);
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
    // The player is still choosing in a simultaneous step: the AI locks in by itself, shortly.
    if (who === 'ai' && !autoplay && SIMULTANEOUS.includes(action.type) && legalActions(state, 'player').includes(action.type)) {
      scheduleAiLockIn(id);
      return;
    }
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
  clearTimeout(lockInTimer);
  resetFx();
  clearHistory();
  setCaption('');
  lock(false);
  state = createGame(Date.now());
  draw();
  start();
}

function draw() {
  render(root, state, { dispatch, newGame, build: BUILD });
}

// The tabletop art and fonts, loaded before the first frame so nothing pops in
// (with a time limit, so a slow or failed load never blocks the game).
const UI_ART = ['table', 'board-mat', 'card-back', 'frame-pokemon', 'frame-strategy', 'frame-item',
  'frame-location', 'frame-supporter', 'frame-trainer'].map((name) => `assets/ui/${name}.jpg`);
function preload() {
  const images = UI_ART.map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode().catch(() => {});
  });
  const fonts = document.fonts
    ? Promise.all(['700 16px Cinzel', '800 16px Cinzel', '400 16px "Alegreya Sans"', '800 16px "Alegreya Sans"'].map((f) => document.fonts.load(f))).catch(() => {})
    : Promise.resolve();
  const limit = new Promise((resolve) => { setTimeout(resolve, 3000); });
  return Promise.race([Promise.all([...images, fonts]), limit]);
}

async function start() {
  const id = match;
  lock(true);
  await opponentActs(id);
  if (id !== match) return;
  lock(false);
  draw();
}

preload().then(() => {
  draw();
  stage.classList.add('ready');
  start();
});
