// Entry point: holds the current game state, sends the player's actions
// to the engine, lets the AI respond, and plays each action back on screen.
import { createGame, applyAction, legalActions } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { render, STAGE, pushHistory, clearHistory, setCaption } from './ui/render.js';
import { present, think, skip, resetFx, historyEntry, captionFor } from './ui/present.js';
import { speedFactor } from './ui/settings.js';
import { probeCardIcons } from './ui/cardIcons.js';
import { renderDeckSelect, otherDeck, randomDeck } from './ui/deckSelect.js';
import { initVfx, syncStatus } from './ui/vfx/engine.js';

export const BUILD = 'Feedback batch 2';


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
// ?autoplay: the AI plays both sides (for watching, and for testing the
// presentation), with the decks picked at random.
const autoplay = params.has('autoplay');
// null while the player is choosing a deck (before each match).
let state = null;

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

// New match: back to deck selection (or straight in, with ?autoplay).
function newGame() {
  match += 1;
  clearTimeout(lockInTimer);
  resetFx();
  clearHistory();
  setCaption('');
  lock(false);
  state = null;
  if (autoplay) startMatch(randomDeck());
  else draw();
}

// The player plays `deck`; the AI plays the other one. ?seed= applies to the first match.
let firstMatch = true;
function startMatch(deck) {
  const seed = (firstMatch && seedFromUrl) || Date.now();
  firstMatch = false;
  state = createGame(seed, { decks: { player: deck, ai: otherDeck(deck) } });
  draw();
  start();
}

function draw() {
  if (!state) renderDeckSelect(root, { build: BUILD, choose: startMatch });
  else render(root, state, { dispatch, newGame, build: BUILD });
  syncStatus(root);   // burning cards keep smouldering on the effects layer
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
  // The WebGL effects layer (with its textures); without WebGL the 2D effects stay.
  // ?novfx forces the 2D fallback (for checking it).
  const vfx = params.has('novfx') ? Promise.resolve(false)
    : initVfx(document.getElementById('vfx')).catch((err) => { console.warn('VFX: WebGL layer off.', err); return false; });
  return Promise.race([Promise.all([...images, fonts, probeCardIcons(), vfx]), limit]);
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
  stage.classList.add('ready');
  newGame();
});
