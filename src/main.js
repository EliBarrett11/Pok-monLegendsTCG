// Entry point: holds the current game state, sends the player's actions
// to the engine, lets the AI respond, and plays each action back on screen.
//
// The start screen picks a mode: the AI, a friend online, or two players on
// one screen (hot-seat).
//
// The screen is only ever given what one seat may see: viewFor(state, viewer)
// (engine/view.js), turned so the viewer is at the bottom (ui/seat.js).
// Against the AI the viewer is always the 'player' seat. In hot-seat mode it
// is whoever has control, with a "Pass to" screen hiding the board whenever
// control changes hands. Online (net/), the host's browser holds the real
// game and the guest's only ever gets its view from the host.
import { createGame, applyAction, legalActions, PLAYERS } from './engine/game.js';
import { viewFor } from './engine/view.js';
import { chooseAction } from './ai/opponent.js';
import { render, STAGE, pushHistory, clearHistory, setHistory, setCaption } from './ui/render.js';
import { present, think, skip, resetFx, historyEntry, captionFor } from './ui/present.js';
import { orient, toEngine, screenSeat } from './ui/seat.js';
import { speedFactor } from './ui/settings.js';
import { probeCardIcons } from './ui/cardIcons.js';
import { renderDeckSelect, opponentDeck, randomDeck } from './ui/deckSelect.js';
import { renderPassScreen } from './ui/passScreen.js';
import { renderStart } from './ui/lobby.js';
import { initVfx, syncStatus } from './ui/vfx/engine.js';
import { createOnline, savedHostMatch, forgetHostMatch } from './online.js';

export const BUILD = 'Grass G2 — the Grass deck';


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

// 'ai', 'hotseat' or 'online'; null on the start screen.
// ?autoplay plays the AI, ?hotseat goes straight to hot-seat, ?join=CODE joins a friend.
let mode = autoplay ? 'ai' : params.has('hotseat') ? 'hotseat' : params.has('join') ? 'online' : null;
const isHotseat = () => mode === 'hotseat';

// Hot-seat: two players take turns at one screen. Seat 'player' is Player 1, 'ai' Player 2.
const HOTSEAT_NAMES = { player: 'Player 1', ai: 'Player 2' };
let viewer = 'player';    // the seat whose view is on screen
let passingTo = null;     // hot-seat: the seat the screen is being passed to (board hidden)
let picks = {};           // hot-seat deck selection: each seat's deck, in turn
let lastShown = null;     // hot-seat: the last action, replayed for the next player
const histories = { player: [], ai: [] };   // the recent-actions list, as each seat reads it

// What the viewer may see, with them at the bottom. The same state and seat
// give the same view object, so a redraw keeps the player's half-made choices.
const views = new WeakMap();
function viewOf(s, seat = viewer) {
  const cached = views.get(s)?.[seat];
  if (cached) return cached;
  const v = orient(viewFor(s, seat));
  views.set(s, { ...views.get(s), [seat]: v });
  return v;
}

// While actions play out, input is locked; it unlocks when it's the player's move.
let busy = false;
let match = 0;   // bumped by New match, so an old match's playback stops
const lockEl = document.getElementById('lock');
lockEl.onclick = () => skip();
function lock(on) {
  busy = on;
  stage.classList.toggle('locked', on);
}

// Shows an action (who: the engine seat that took it) from the viewer's seat.
async function show(prev, next, who) {
  const seats = isHotseat() ? PLAYERS : [viewer];
  for (const seat of seats) {
    const entry = historyEntry(viewOf(prev, seat), viewOf(next, seat), screenSeat(who, seat));
    if (entry) histories[seat] = [entry, ...histories[seat]].slice(0, 10);
  }
  pushHistory(historyEntry(viewOf(prev), viewOf(next), screenSeat(who, viewer)));
  lastShown = { prev, next, who };
  await present(root, viewOf(prev), viewOf(next), screenSeat(who, viewer), draw);
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
    setCaption(captionFor(viewOf(state), 'ai'));
    draw();
  }, (900 + Math.random() * 900) * speedFactor());
}

// An action from the screen, in its seats ('player' = the viewer).
async function dispatch(action) {
  if (busy) return;
  if (mode === 'online') {
    online.dispatch(action);
    return;
  }
  clearTimeout(lockInTimer);
  let next;
  try {
    next = applyAction(state, toEngine(action, viewer));
  } catch (err) {
    alert(err.message);
    return;
  }
  const id = match;
  lock(true);
  const prev = state;
  state = next;
  await show(prev, next, viewer);
  if (isHotseat()) await handOver(id);
  else await opponentActs(id);
  if (id !== match) return;
  lock(false);
  draw();
}

// Hot-seat: after each action, whoever must act next. The coin flip needs no
// one; if it's the other player's move (their turn, their choice, or their
// half of a simultaneous step), the board is hidden behind "Pass to …".
async function handOver(id) {
  for (let guard = 0; guard < 100 && id === match && state.phase !== 'gameOver'; guard++) {
    if (state.phase === 'initiative') {
      await nextFrame();
      if (id !== match) return;
      const prev = state;
      state = applyAction(state, { type: 'flipCoin' });
      await show(prev, state, viewer);
      continue;
    }
    const next = PLAYERS.filter((w) => legalActions(state, w).length);
    if (!next.length || next.includes(viewer)) return;
    passingTo = next[0];
    return;
  }
}

// "I'm ready": the next player's view, and the last action shown again from their side.
async function ready() {
  const id = match;
  viewer = passingTo;
  passingTo = null;
  setHistory(histories[viewer]);
  setCaption('');
  const last = lastShown;
  if (last?.next === state && last.who !== viewer) {
    lock(true);
    draw();
    await present(root, viewOf(last.prev), viewOf(state), screenSeat(last.who, viewer), draw);
    if (id !== match) return;
    lock(false);
  }
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
// Online, after a match both go back to choosing decks; during one, it leaves.
function newGame() {
  if (mode === 'online' && online.active()) {
    online.leave();   // (the "Leave match" button)
    return;
  }
  match += 1;
  clearTimeout(lockInTimer);
  resetFx();
  clearHistory();
  histories.player = [];
  histories.ai = [];
  setCaption('');
  lock(false);
  state = null;
  viewer = 'player';
  passingTo = null;
  picks = {};
  lastShown = null;
  if (autoplay) startMatch(randomDeck());
  else draw();
}

// Rematch (the end screen's New match): the same decks again, straight in.
function rematch() {
  if (mode === 'online') {
    online.rematch();
    return;
  }
  const decks = state && { player: state.players.player.deck, ai: state.players.ai.deck };
  newGame();
  if (!decks || autoplay) return;
  if (isHotseat()) {
    picks = decks;
    passingTo = 'player';   // Player 1 starts: placing Trainers
    beginMatch(decks);
  } else startMatch(decks.player, decks.ai);   // a rematch: the same two decks
}

// The player plays `deck`; the AI plays `opponent` (a deck id, or 'random':
// any deck, the same one included). ?seed= applies to the first match.
let firstMatch = true;
function startMatch(deck, opponent = 'random') {
  beginMatch({ player: deck, ai: opponentDeck(opponent) });
}

function beginMatch(decks) {
  const seed = (firstMatch && seedFromUrl) || Date.now();
  firstMatch = false;
  state = createGame(seed, { decks, ...(isHotseat() ? { names: HOTSEAT_NAMES } : {}) });
  draw();
  if (!isHotseat()) start();
}

// Hot-seat deck selection: Player 1 chooses, the screen is passed, Player 2
// chooses (neither sees the other's choice, and either may pick the same deck).
function chooseHotseat(deck) {
  const seat = picks.player ? 'ai' : 'player';
  picks[seat] = deck;
  passingTo = seat === 'player' ? 'ai' : 'player';
  if (seat === 'ai') beginMatch({ ...picks });
  else draw();
}

// The start screen's choices (and Back, to it). ?hotseat stays in the address for a refresh.
function setMode(next) {
  if (next) startNotice = null;
  mode = next;
  const url = new URL(location.href);
  url.searchParams.delete('join');
  if (next === 'hotseat') url.searchParams.set('hotseat', '');
  else url.searchParams.delete('hotseat');
  history.replaceState(null, '', url.toString().replace('hotseat=', 'hotseat'));
  newGame();
}

// --- Playing a friend online (online.js) ---------------------------------------------------

const online = createOnline({
  build: BUILD,
  seed: () => seedFromUrl,
  draw: () => draw(),
  lock: (on) => lock(on),
  toStart: (notice) => { startNotice = notice ?? null; setMode(null); },
  stage,
});
let startNotice = null;   // a line of news for the start screen ("Your friend left the match.")
addEventListener('pagehide', () => online.goodbye());

function playFriend(code = null) {
  mode = 'online';
  if (code) online.join(code);
  else online.hostNew();
}

function resumeFriend() {
  mode = 'online';
  online.hostResume();
}

function draw() {
  if (passingTo) {
    const name = HOTSEAT_NAMES[passingTo];
    renderPassScreen(root, {
      name,
      from: HOTSEAT_NAMES[passingTo === 'player' ? 'ai' : 'player'],
      what: !state ? 'choose a deck' : 'take over',
      ready: () => {
        if (state) ready();
        else { viewer = passingTo; passingTo = null; draw(); }
      },
    });
  } else if (!mode) {
    const saved = savedHostMatch(BUILD);
    renderStart(root, {
      build: BUILD, notice: startNotice, playAi: () => setMode('ai'), playFriend: () => playFriend(), hotseat: () => setMode('hotseat'),
      resume: saved && { ...saved, go: resumeFriend },
      discard: () => { forgetHostMatch(); draw(); },
    });
  } else if (mode === 'online') {
    const view = online.view();
    if (view) render(root, view, { dispatch, newGame, rematch, build: BUILD, online: online.endButtons() });
    else if (online.active()) online.drawScreen(root);
    online.decorate();
  } else if (!state) {
    renderDeckSelect(root, isHotseat()
      ? { build: BUILD, choose: chooseHotseat, who: HOTSEAT_NAMES[picks.player ? 'ai' : 'player'], back: () => setMode(null) }
      : { build: BUILD, choose: startMatch, back: autoplay ? null : () => setMode(null) });
  } else render(root, viewOf(state), { dispatch, newGame, rematch, build: BUILD });
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
  if (mode === 'online') playFriend(params.get('join'));
  else newGame();
});
