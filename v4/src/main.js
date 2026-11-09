// Adapted from v3/src/main.js (the stage, the AI loop, ?seed, ?autoplay, ?debug).
// Pokémon Legends v4 — entry point (F1): you against the AI, on a fixed 1920×1080 stage scaled
// to fit the window. ?seed=123 replays the same shuffle and AI choices; ?autoplay lets the AI play
// both sides; ?debug exposes window.__v4 for the layout check (v4/tools/layout.mjs).
import { createGame, applyAction, actor, energyLeft, playReason } from './engine/game.js?v=202611091758';
import { chooseAction } from './ai/ai.js?v=202611091758';
import { renderMatch, reactOpen } from './ui/board.js?v=202611091758';
import { pokemonAt, cardAtRound } from './engine/cards.js?v=202611091758';
import { setupInteraction } from './ui/interact.js?v=202611091758';

export const BUILD = 'UX3 — drag and drop, targeting arrows and previews, keyboard, confirmations';

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

// UX1: the React timer setting (5, 8, 12 or 20 s), kept in localStorage (the full Settings screen is UX5).
const TIMER_CHOICES = [5, 8, 12, 20];
function loadReactTimer() {
  try { const v = Number(localStorage.getItem('v4.reactTimer')); return TIMER_CHOICES.includes(v) ? v : 5; } catch { return 5; }
}
function setReactTimer(v) {
  ctx.reactTimer = TIMER_CHOICES.includes(v) ? v : 5;
  try { localStorage.setItem('v4.reactTimer', String(ctx.reactTimer)); } catch { /* storage unavailable: keep it for this page */ }
  redraw();
}

const ctx = { build: BUILD, autoplay, act, redraw, newMatch, setReactTimer, reactTimer: loadReactTimer() };
let interaction = null;
function redraw() {
  syncReactClock();
  renderMatch(root, state, ui, ctx);
  interaction?.refresh();
}

// UX1: the React window's countdown belongs to the interface, not the engine. When the human
// player's window opens, a timer starts; on timeout it sends exactly the decline action the
// "Let it happen" button sends. Autoplay never shows the window (the AI decides at once).
let reactTimeout = null;
function syncReactClock() {
  const open = !autoplay && state && reactOpen(state, ui);
  if (!open) {
    if (ui.reactClock) { clearTimeout(reactTimeout); ui.reactClock = null; }
    return;
  }
  if (ui.reactClock?.state === state) return;
  clearTimeout(reactTimeout);
  const ms = ctx.reactTimer * 1000;
  const forState = state;
  ui.reactClock = { state, start: Date.now(), ms };
  reactTimeout = setTimeout(() => {
    if (state === forState && state.reactWindow?.reactor === 'player') act({ type: 'decline', who: 'player' });
  }, ms);
}

// UX3: confirmations, only where a mistake is costly (ending a turn with Energy unused and a playable
// card, Releasing cards for a Supporter, Retaining your last card). Each has "Don't ask again", kept in
// localStorage (inside try/catch).
const askKey = (kind) => `v4.ask.${kind}`;
const skipAsk = (kind) => { try { return localStorage.getItem(askKey(kind)) === 'no'; } catch { return false; } };
function confirmThen(kind, text, action) {
  if (skipAsk(kind)) return act(action);
  ui.confirm = { kind, text, action, dontAsk: false };
  redraw();
}
ctx.confirmYes = () => {
  const c = ui.confirm;
  if (!c) return;
  if (c.dontAsk) { try { localStorage.setItem(askKey(c.kind), 'no'); } catch { /* storage unavailable: ask again next time */ } }
  ui.confirm = null;
  act(c.action);
};
ctx.confirmNo = () => { ui.confirm = null; redraw(); };
ctx.endTurn = () => {
  if (!state || state.phase !== 'battle' || state.turn !== 'player' || state.reactWindow || ui.locked) return;
  const me = state.players.player;
  const left = energyLeft(me);
  const playable = me.hand.some((c) => !playReason(state, 'player', c));
  const action = { type: 'pass', who: 'player' };
  if (left > 0 && playable) confirmThen('pass', `End turn with ${left} Energy unused?`, action);
  else act(action);
};
ctx.retain = (uid) => {
  const me = state.players.player;
  const action = { type: 'retain', who: 'player', uid };
  if (me.hand.length === 1) confirmThen('retain', 'Retain your last card in hand? You draw one fewer next Breakfast.', action);
  else act(action);
};
ctx.release = (action, n) => confirmThen('release', `Release ${n} card${n === 1 ? '' : 's'}? Released cards leave the match.`, action);

function newMatch() {
  match += 1;
  const seed = (match === 1 && Number(params.get('seed'))) || Date.now();
  let k = seed;
  aiRng = params.has('seed') ? () => { k = (k * 9301 + 49297) % 233280; return k / 233280; } : Math.random;
  state = createGame(seed);
  Object.assign(ui, { select: null, ask: null, locked: false, seenTournament: null, drawer: null, martSeen: null, drag: null, picker: null, confirm: null, keys: false, focus: null, hover: null });
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
  ui.picker = null;
  ui.focus = null;
  ui.drag = null;
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
      // UX1: the AI's own React decisions stay instant.
      if (!state.reactWindow) await wait(PAUSE);
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

// UX3: the targeting arrow, previews, drag and drop and the keyboard.
interaction = setupInteraction({ stage, ui, ctx, getState: () => state });
newMatch();
