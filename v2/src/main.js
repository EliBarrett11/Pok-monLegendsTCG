// Pokémon Legends v2 — entry point. Three ways to play (V9):
//   against the AI (the default; the deck screen offers the other two),
//   two players, one screen (hot-seat: ?hotseat or the "Two players, one screen" button),
//   a friend online (the "Play a friend online" button, or an invite link ?join=CODE).
// The screen is only ever given a seat's view (engine/view.js viewFor), oriented so the viewer
// is at the bottom (ui/seat.js), against the AI too.
//
// ?seed=123 replays the same shuffle, coin flip and AI choices; ?autoplay lets the AI play
// both sides (with ?hotseat: each seat from its own view, passing the screen as players would);
// ?instantUntil=9 shows no animations until that Round; ?novfx forces the 2D effects;
// ?host opens an online room at once; ?peerserver=host:port uses a local PeerServer (checks).
import { createGame, applyAction, actor, legalActions, PLAYERS } from './engine/game.js';
import { viewFor } from './engine/view.js';
import { chooseAction } from './ai/opponent.js';
import { renderMatch } from './ui/board.js';
import { toastsFor, showToasts } from './ui/toasts.js';
import { openDeckBuilder } from './ui/deckbuilder.js';
import { DECKS, POOL_ITEMS, deckProblems, cardAt } from './engine/cards.js';
import { renderFriend } from './ui/lobby.js';
import { initVfx, syncStatus } from './ui/vfx/engine.js';
import { present, skip, resetFx, syncBoardWeather } from './ui/present.js';
import { orient, toEngine, screenSeat } from './ui/seat.js';
import { renderDeckPick, renderPassScreen } from './ui/lobby.js';
import { renderSetup } from './ui/setup.js';
import { createOnline, savedHostMatch } from './online.js';
import { setSpeed } from '../../src/ui/settings.js';

export const BUILD = 'v2 Feedback A — setup screen, nothing clipped';

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
const toastLayer = document.createElement('div');
toastLayer.className = 'v2-toasts';
stage.appendChild(toastLayer);
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const PAUSE = autoplay ? 250 : 650;   // a short pause before each AI action, so it can be followed

// 'ai', 'hotseat' or 'online'.
let mode = params.has('join') ? 'online' : params.has('hotseat') ? 'hotseat' : 'ai';

// The effects layer (V8): WebGL when it's available (?novfx forces the 2D fallback).
const vfxOn = params.has('novfx') ? Promise.resolve(false)
  : initVfx(document.getElementById('vfx')).catch((err) => { console.warn('VFX: WebGL layer off.', err); return false; });
vfxOn.then((on) => stage.classList.toggle('vfx-gl', Boolean(on)));
// A click while an action is being shown skips to its end.
let presenting = false;
stage.addEventListener('click', (e) => {
  if (!presenting) return;
  e.stopPropagation();
  e.preventDefault();
  skip();
}, true);
// ?seed=123 also makes the AI's choices repeatable (a seeded random, as in v2/tools).
let aiRng = Math.random;
function seedAi(seed) {
  if (!params.has('seed')) { aiRng = Math.random; return; }
  let k = seed;
  aiRng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
}
const instantUntil = Number(params.get('instantUntil')) || 0;

let state = null;    // the real game (against the AI and in hot-seat; online it's in the session)
let seat = 'player'; // whose view is on screen (the engine's seat)
let playing = null;  // the deck names in this match
let match = 0;       // bumped by every new match, so an old match's loops stop
const ui = { summon: null, location: null, attacker: null, empowerAsk: null, ask: null, pending: null, trainer: null, moveTrainer: null, assignDraft: null, locked: false };
const clearUi = () => Object.assign(ui, { summon: null, location: null, attacker: null, empowerAsk: null, ask: null, pending: null, trainer: null, moveTrainer: null });

// A seat's view of a state, oriented with that seat at the bottom.
const viewOf = (s, who = seat) => orient(viewFor(s, who));

// --- Decks (against the AI) ---------------------------------------------------------------------

const DECK_KEY = 'pokemon-legends-v2-deck';
function savedDeck() {
  try {
    const deck = JSON.parse(localStorage.getItem(DECK_KEY));
    return deck && !deckProblems(deck).length ? deck : null;
  } catch { return null; }
}
function saveDeck(deck) {
  try { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); } catch { /* private window: this match only */ }
  customDeck = deck;
}
let customDeck = savedDeck();
const CHOICE_KEY = 'pokemon-legends-v2-deck-choice';
let deckChoice = { player: 'fire', ai: 'water' };
try { deckChoice = { ...deckChoice, ...JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}') }; } catch { /* the defaults */ }
const DECK_IDS = Object.keys(DECKS);
const resolve = (choice) => (choice === 'random' ? DECK_IDS[Math.floor(Math.random() * DECK_IDS.length)] : choice);
function setDeck(who, value) {
  deckChoice = { ...deckChoice, [who]: value };
  try { localStorage.setItem(CHOICE_KEY, JSON.stringify(deckChoice)); } catch { /* this match only */ }
  redraw();
}
function openDeck() {
  const base = DECKS[deckChoice.player] ?? DECKS.fire;
  openDeckBuilder(stage, {
    deck: customDeck ?? base.list,
    premade: base.list,
    onUse: (deck) => { saveDeck(deck); deckChoice = { ...deckChoice, player: 'custom' }; redraw(); },
  });
}

// --- Drawing ------------------------------------------------------------------------------------

// What the board's buttons and labels need, for this mode.
function matchCtx(extra = {}) {
  return {
    build: BUILD, autoplay, act, newMatch, redraw, openDeck, customDeck: !!customDeck, deckChoice, setDeck, playing,
    setSpeed: (v) => { setSpeed(v); redraw(); },
    mode, hotseat: () => switchMode('hotseat'), online: () => startOnline(), leave: () => switchMode('ai'),
    modeLabel: mode === 'hotseat' ? `Two players, one screen · ${HOTSEAT_NAMES[seat]}` : '',
    ...extra,
  };
}

// The setup screen (v2 Feedback A): before every match against the AI.
let setupOpen = false;
function drawSetup() {
  renderSetup(root, {
    deckChoice, customDeck: Boolean(customDeck), build: BUILD, resume: savedHostMatch(BUILD),
    handlers: {
      ai: () => redraw(), hotseat: () => switchMode('hotseat'), online: () => switchMode('online'),
      setDeck, start: () => { setupOpen = false; startAiMatch(); }, deck: openDeck,
      resume: () => { mode = 'online'; setupOpen = false; setUrl('online'); online.hostResume(); },
    },
  });
}
function showSetup() {
  match += 1;
  resetFx();
  mode = 'ai';
  setupOpen = true;
  state = null;
  redraw();
}

function redraw() {
  if (mode === 'ai' && setupOpen) { drawSetup(); return; }
  if (mode === 'online') online.drawScreen(root, ui);
  else if (mode === 'hotseat' && hot.screen !== 'match') drawHotseatScreen();
  else renderMatch(root, viewOf(state), ui, matchCtx());
  syncStatus(root);   // burning, sleeping and seeded cards keep their ambient effects
  const shown = mode === 'online' ? null : state && (mode !== 'hotseat' || hot.screen === 'match') ? state : null;
  if (shown) syncBoardWeather(root, viewOf(shown));   // Rain and Sun behind the cards
}

// Shows an action (prev → state) from the viewer's seat, then draws the new state.
async function show(prev, who) {
  if (state.round < instantUntil && state.phase !== 'gameOver') { redraw(); return; }
  presenting = true;
  const locked = ui.locked;
  ui.locked = true;
  try {
    await present(root, viewOf(prev), viewOf(state), screenSeat(who, seat), redraw);
  } finally {
    presenting = false;
    ui.locked = locked;
  }
}

// Apply an action (in the engine's seats) and show the moments it brings (milestones…).
function apply(action) {
  state = applyAction(state, action);
  const v = viewOf(state);
  showToasts(toastLayer, toastsFor(v, v.events));
}

// An action from the screen (in the screen's seats: the viewer is 'player').
async function act(action) {
  if (mode === 'online') { online.dispatch(action); clearUi(); return; }
  const prev = state;
  const engineAction = action.type === 'flipCoin' ? action : toEngine(action, seat);
  try {
    apply(engineAction);
  } catch (err) {
    alert(err.message);
    clearUi();
    redraw();
    return;
  }
  clearUi();
  const id = match;
  await show(prev, engineAction.who ?? seat);
  if (id !== match) return;
  if (mode === 'hotseat') { await handOver(prev, engineAction.who ?? seat); return; }
  redraw();
  await aiTurn(match);
}

// --- Against the AI ------------------------------------------------------------------------------

// The AI acts while it's its move (with ?autoplay, both sides), one action at a time.
async function aiTurn(id) {
  ui.locked = true;
  redraw();
  for (let guard = 0; guard < 2000 && id === match && state.phase !== 'gameOver'; guard++) {
    // The assign step is simultaneous: the AI locks in while you choose.
    const who = state.choices?.length ? actor(state)
      : state.phase === 'assign' ? (legalNow('ai') ? 'ai' : autoplay ? actor(state) : null)
        : state.phase === 'initiative' ? (autoplay ? 'player' : null) : state.turn;
    if (!who || (who === 'player' && !autoplay)) break;
    await wait(state.round < instantUntil ? 0 : PAUSE);
    if (id !== match) return;
    const action = chooseAction(state, who, { rng: aiRng });
    if (!action) break;
    const prev = state;
    apply(action);
    await show(prev, who);
    if (id !== match) return;
  }
  if (id !== match) return;
  ui.locked = false;
  redraw();
}

const legalNow = (who) => legalActions(state, who).length > 0;

// New match (the end screen's button, Leave, Back): the setup screen again.
function newMatch() {
  if (mode === 'hotseat') { startHotseat(); return; }
  if (mode === 'online') return;
  showSetup();
}

function startAiMatch() {
  mode = 'ai';
  setupOpen = false;
  match += 1;
  resetFx();
  seat = 'player';
  const seed = (match === 1 && Number(params.get('seed'))) || Date.now();
  seedAi(seed);
  // ?decks=fire,grass picks both from the address (for testing).
  const fromUrl = params.get('decks')?.split(',');
  const pick = { player: fromUrl?.[0] ?? deckChoice.player, ai: fromUrl?.[1] ?? deckChoice.ai };
  const mine = pick.player === 'custom' && customDeck ? null : resolve(pick.player === 'custom' ? 'fire' : pick.player);
  const theirs = resolve(pick.ai === 'custom' ? 'water' : pick.ai);
  playing = { player: mine ? DECKS[mine].name : 'Your deck', ai: DECKS[theirs].name };
  state = createGame(seed, {
    decks: { player: mine ? DECKS[mine].list : customDeck, ai: DECKS[theirs].list },
    itemPool: POOL_ITEMS, plans: { player: mine ?? null, ai: theirs },
  });
  clearUi();
  ui.assignDraft = null;
  ui.locked = false;
  redraw();
  if (autoplay) aiTurn(match);
}

// --- Two players, one screen ------------------------------------------------------------------

const HOTSEAT_NAMES = { player: 'Player 1', ai: 'Player 2' };
const hot = { screen: 'pick', picking: 'player', picks: {}, pass: null };

function startHotseat() {
  match += 1;
  resetFx();
  Object.assign(hot, { screen: 'pick', picking: 'player', picks: {}, pass: null });
  state = null;
  seat = 'player';
  redraw();
  if (autoplay) autoHotseatPicks();
}

function drawHotseatScreen() {
  if (hot.screen === 'pick') {
    const name = HOTSEAT_NAMES[hot.picking];
    renderDeckPick(root, {
      kicker: 'Two players, one screen', title: `${name}: choose your deck`,
      note: `In secret: ${HOTSEAT_NAMES[hot.picking === 'player' ? 'ai' : 'player']} looks away. Mirrors are allowed.`,
      choose: chooseHotseat, back: () => switchMode('ai'), backLabel: 'Back to playing the AI',
    });
  } else if (hot.screen === 'pass') {
    renderPassScreen(root, { ...hot.pass, ready: () => hot.pass.ready() });
  }
}

function chooseHotseat(deck) {
  hot.picks[hot.picking] = deck;
  if (hot.picking === 'player') {
    hot.picking = 'ai';
    passTo('ai', 'choose a deck', () => { hot.screen = 'pick'; redraw(); });
    return;
  }
  // Both chosen: Player 1 starts at the coin.
  const seed = Number(params.get('seed')) || Date.now();
  seedAi(seed);
  state = createGame(seed, { decks: { player: DECKS[hot.picks.player].list, ai: DECKS[hot.picks.ai].list }, itemPool: POOL_ITEMS });
  state.decks = { ...hot.picks };
  playing = { player: `${HOTSEAT_NAMES.player}: ${DECKS[hot.picks.player].name}`, ai: `${HOTSEAT_NAMES.ai}: ${DECKS[hot.picks.ai].name}` };
  clearUi();
  ui.assignDraft = null;
  ui.locked = false;
  passTo('player', 'start the match', () => { seat = 'player'; hot.screen = 'match'; redraw(); });
}

// The board is hidden until the next player is ready.
function passTo(who, what, ready) {
  hot.screen = 'pass';
  hot.pass = { name: HOTSEAT_NAMES[who], from: HOTSEAT_NAMES[who === 'player' ? 'ai' : 'player'], what, ready };
  resetFx();
  redraw();
}

// Who must act next: an On Evolve choice, either half of the Trainer Point step, the turn.
function nextSeat(s) {
  if (!s || s.phase === 'gameOver') return null;
  if (s.choices?.length) return actor(s);
  if (s.phase === 'initiative') return 'player';
  if (s.phase === 'assign') return PLAYERS.find((w) => legalActions(s, w).length) ?? null;
  return s.turn;
}

// After an action in hot-seat: if the other player must act now, pass the screen; once they
// are ready, the last action is shown again from their side.
async function handOver(prev, who) {
  const next = nextSeat(state);
  if (!next || next === seat) { redraw(); if (autoplay) autoHotseat(match); return; }
  const id = match;
  passTo(next, state.phase === 'assign' ? 'assign your Trainer Points' : 'take your turn', async () => {
    seat = next;
    hot.screen = 'match';
    if (prev) await show(prev, who);
    if (id !== match) return;
    redraw();
    if (autoplay) autoHotseat(match);
  });
  if (autoplay) { await wait(PAUSE); if (id === match && hot.screen === 'pass') hot.pass.ready(); }
}

// ?hotseat&autoplay: each seat plays from its own view, passing the screen as people would.
async function autoHotseatPicks() {
  await wait(PAUSE);
  const decks = params.get('decks')?.split(',') ?? ['fire', 'water'];
  chooseHotseat(decks[0]);
  await wait(PAUSE);
  hot.pass.ready();
  await wait(PAUSE);
  chooseHotseat(decks[1] ?? 'water');
  await wait(PAUSE);
  hot.pass.ready();
  autoHotseat(match);
}
async function autoHotseat(id) {
  if (!autoplay || id !== match || !state || state.phase === 'gameOver' || hot.screen !== 'match') return;
  const who = nextSeat(state);
  if (who !== seat) return;
  await wait(state.round < instantUntil ? 0 : PAUSE);
  if (id !== match || hot.screen !== 'match') return;
  const action = chooseAction(state, seat, { rng: aiRng });
  if (!action) return;
  // From the screen's seats, as a player's click would be (the engine's seats swapped back for seat 'ai').
  await act(toEngine(action, seat));
}

// --- Online --------------------------------------------------------------------------------------

const online = createOnline({
  build: BUILD,
  seed: () => Number(params.get('seed')) || 0,
  draw: () => redraw(),
  lock: (on) => { ui.locked = on; },
  toStart: (notice) => { if (notice) alert(notice); switchMode('ai'); },
  stage,
  matchCtx: (extra) => matchCtx(extra),
  autoplay,
});
addEventListener('pagehide', () => online.goodbye());

// A new room (the setup screen offers "Resume your online match" separately).
function startOnline() {
  mode = 'online';
  setupOpen = false;
  match += 1;
  resetFx();
  setUrl('online');
  online.hostNew();
}

// Switching between the AI, hot-seat and online (the address keeps ?hotseat for a refresh).
function switchMode(next) {
  if (mode === 'online' && online.active()) { online.leave(); if (online.active()) return; }
  mode = next;
  setUrl(next);
  if (next === 'hotseat') startHotseat();
  else if (next === 'online') startOnline();
  else showSetup();
}
function setUrl(next) {
  const url = new URL(location.href);
  url.searchParams.delete('join');
  if (next === 'hotseat') url.searchParams.set('hotseat', '');
  else url.searchParams.delete('hotseat');
  history.replaceState(null, '', url.toString().replace('hotseat=', 'hotseat'));
}

// --- ?debug: a hook for the layout check (v2/tools/layout.mjs) -------------------------------------

if (params.has('debug')) {
  let n = 0;
  const make = (id) => {
    const entry = DECKS.fire.list.concat(DECKS.water.list, DECKS.grass.list).find((e) => (e.series ?? e.card ?? e.location) === id) ?? { card: id };
    return { ...cardAt(entry, state?.round || 1), uid: `dbg-${n++}` };
  };
  window.__v2 = {
    get state() { return state; },
    ui,
    redraw,
    showSetup,
    startAiMatch,
    // Both seats play (no animations) until Round r and it's the viewer's Battle turn.
    fastForward(r) {
      match += 1;
      for (let i = 0; i < 4000 && state.phase !== 'gameOver'; i++) {
        if (state.round >= r && state.phase === 'battle' && state.turn === 'player' && !state.choices?.length) break;
        const who = state.choices?.length ? actor(state) : state.phase === 'assign' ? PLAYERS.find((w) => legalActions(state, w).length)
          : state.phase === 'initiative' ? 'player' : state.turn;
        state = applyAction(state, chooseAction(state, who, { rng: aiRng }));
      }
      clearUi();
      ui.locked = false;
      redraw();
    },
    // A card into a pile of the player's (hand by default); returns its uid.
    give(id, pile = 'hand') { const c = make(id); state.players.player[pile].push(c); return c.uid; },
    set(fn) { fn(state, ui); redraw(); },
    lobby(screen) { renderFriend(root, screen, { back() {}, join() {}, retry: screen.retry ? () => {} : null, copy() {}, chooseDeck() {} }); },
    make,
  };
}

// --- Start ----------------------------------------------------------------------------------------

if (mode === 'online') online.join(params.get('join'));
else if (params.has('host')) switchMode('online');   // ?host opens a room at once (for checks)
else if (mode === 'hotseat') startHotseat();
// ?autoplay or ?decks= go straight into a match (for checks); otherwise the setup screen.
else if (autoplay || params.has('decks')) startAiMatch();
else showSetup();
