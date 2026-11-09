// Adapted from v3/src/main.js (the stage, the AI loop, ?seed, ?autoplay, ?debug).
// Pokémon Legends v4 — entry point (F1): you against the AI, on a fixed 1920×1080 stage scaled
// to fit the window. ?seed=123 replays the same shuffle and AI choices; ?autoplay lets the AI play
// both sides; ?debug exposes window.__v4 for the layout check (v4/tools/layout.mjs).
import { createGame, applyAction, actor } from './engine/game.js?v=202611091234';
import { chooseAction } from './ai/ai.js?v=202611091234';
import { renderMatch } from './ui/board.js?v=202611091234';
import { pokemonAt, cardAtRound } from './engine/cards.js?v=202611091234';

export const BUILD = 'F5 — v4 foundation: the Pokémon League Tournament (complete)';

const STAGE = { width: 1920, height: 1080 };
const stage = document.getElementById('stage');
function fitStage() {
  const scale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height);
  stage.style.transform = `translate(${(innerWidth - STAGE.width * scale) / 2}px, ${(innerHeight - STAGE.height * scale) / 2}px) scale(${scale})`;
}
addEventListener('resize', fitStage);
fitStage();

const params = new URLSearchParams(location.search);
const autoplay = params.has('autoplay');
const root = document.getElementById('app');
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const PAUSE = autoplay ? 120 : 550;

let state = null;
let match = 0;
let aiRng = Math.random;
const ui = { select: null, ask: null, locked: false };

const ctx = { build: BUILD, autoplay, act, redraw, newMatch };
function redraw() { renderMatch(root, state, ui, ctx); }

function newMatch() {
  match += 1;
  const seed = (match === 1 && Number(params.get('seed'))) || Date.now();
  let k = seed;
  aiRng = params.has('seed') ? () => { k = (k * 9301 + 49297) % 233280; return k / 233280; } : Math.random;
  state = createGame(seed);
  Object.assign(ui, { select: null, ask: null, locked: false, seenTournament: null });
  redraw();
  aiLoop(match);
}

function act(action) {
  try {
    state = applyAction(state, action);
  } catch (err) {
    alert(err.message);
  }
  ui.select = null;
  ui.ask = null;
  redraw();
  aiLoop(match);
}

// The AI moves while it's its turn (with ?autoplay, both sides), one action at a time.
let running = false;
async function aiLoop(id) {
  if (running) return;
  running = true;
  try {
    for (let guard = 0; guard < 4000 && id === match && state.phase !== 'gameOver'; guard++) {
      const who = actor(state);
      if (!who || (who === 'player' && !autoplay)) break;
      ui.locked = true;
      redraw();
      await wait(PAUSE);
      if (id !== match) return;
      state = applyAction(state, chooseAction(state, who, { rng: aiRng }));
    }
  } finally {
    running = false;
    if (id === match) { ui.locked = false; redraw(); }
  }
}

if (params.has('debug')) {
  window.__v4 = {
    get state() { return state; }, ui, redraw, newMatch,
    // Play AI moves for both sides until the given Round (the player's turn), for checks.
    fastForward(round) {
      match += 1;
      for (let i = 0; i < 4000 && state.phase !== 'gameOver'; i++) {
        if (state.round >= round && state.phase === 'battle' && state.turn === 'player') break;
        state = applyAction(state, chooseAction(state, actor(state), { rng: aiRng }));
      }
      ui.locked = false;
      redraw();
    },
    set(fn) { fn(state, ui); redraw(); },
    // F2: give a Location card, or place one for either side (through the engine's action).
    giveLocation(id) { const c = { ...cardAtRound(id, 1), uid: `dbg-${Math.random().toString(36).slice(2, 7)}` }; state.players.player.hand.push(c); redraw(); return c.uid; },
    place(who, id, start) {
      const c = { ...cardAtRound(id, 1), uid: `dbg-${Math.random().toString(36).slice(2, 7)}` };
      const turn = state.turn;
      state.players[who].hand.push(c);
      state.turn = who;
      state = applyAction(state, { type: 'placeLocation', who, uid: c.uid, start });
      state.turn = turn;
      redraw();
    },
    // F3: give any card by id; apply an action as either side (through the engine).
    giveCard(id) { const c = { ...cardAtRound(id, state.round), uid: `dbg-${Math.random().toString(36).slice(2, 7)}` }; state.players.player.hand.push(c); redraw(); return c.uid; },
    apply(action) { state = applyAction(state, action); redraw(); },
    give(id, level = 3) { const c = pokemonAt(id, level); c.uid = `dbg-${Math.random().toString(36).slice(2, 7)}`; state.players.player.hand.push(c); redraw(); return c.uid; },
  };
}

newMatch();
