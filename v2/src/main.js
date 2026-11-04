// Pokémon Legends v2 — entry point (V1 core + V2 Locations and the Championship, against the AI).
// ?seed=123 replays the same shuffle and coin flip; ?autoplay lets the AI play
// both sides (for watching and testing).
import { createGame, applyAction, actor, legalActions } from './engine/game.js';
import { chooseAction } from './ai/opponent.js';
import { renderMatch } from './ui/board.js';
import { toastsFor, showToasts } from './ui/toasts.js';
import { openDeckBuilder } from './ui/deckbuilder.js';
import { DECKS, POOL_ITEMS, deckProblems } from './engine/cards.js';

export const BUILD = 'V7 — the balance';

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

let state = null;
let playing = null;   // the deck names in this match
let match = 0;   // bumped by New match, so an old match's AI loop stops
const ui = { summon: null, location: null, attacker: null, empowerAsk: null, ask: null, pending: null, trainer: null, moveTrainer: null, assignDraft: null, locked: false };

// The decks (V6): Fire, Water, Grass or Random for each player (mirrors allowed),
// chosen before the coin flip and remembered in this browser; or Your deck, built in
// the deck builder (kept in this browser too).
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
  newMatch();
}
function openDeck() {
  const base = DECKS[deckChoice.player] ?? DECKS.fire;
  openDeckBuilder(stage, {
    deck: customDeck ?? base.list,
    premade: base.list,
    onUse: (deck) => { saveDeck(deck); deckChoice = { ...deckChoice, player: 'custom' }; newMatch(); },
  });
}

// Apply an action and show the moments it brings (milestones, completions…).
function apply(action) {
  state = applyAction(state, action);
  showToasts(toastLayer, toastsFor(state, state.events));
}

function redraw() {
  renderMatch(root, state, ui, { build: BUILD, autoplay, act, newMatch, redraw, openDeck, customDeck: !!customDeck, deckChoice, setDeck, playing });
}

// An action from the screen (or the AI). Errors from the engine are shown, not thrown.
async function act(action) {
  try {
    apply(action);
  } catch (err) {
    alert(err.message);
    // Start the choice over from a clean screen.
    Object.assign(ui, { summon: null, location: null, attacker: null, empowerAsk: null, ask: null, pending: null, trainer: null, moveTrainer: null });
    redraw();
    return;
  }
  ui.summon = null;
  ui.location = null;
  ui.attacker = null;
  ui.empowerAsk = null;
  ui.ask = null;
  ui.pending = null;
  ui.trainer = null;
  ui.moveTrainer = null;
  redraw();
  await aiTurn(match);
}

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
    await wait(PAUSE);
    if (id !== match) return;
    const action = chooseAction(state, who);
    if (!action) break;
    apply(action);
    redraw();
  }
  if (id !== match) return;
  ui.locked = false;
  redraw();
}

const legalNow = (who) => legalActions(state, who).length > 0;

function newMatch() {
  match += 1;
  const seed = (match === 1 && Number(params.get('seed'))) || Date.now();
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
  ui.summon = null;
  ui.location = null;
  ui.attacker = null;
  ui.empowerAsk = null;
  ui.ask = null;
  ui.pending = null;
  ui.trainer = null;
  ui.moveTrainer = null;
  ui.assignDraft = null;
  ui.locked = false;
  redraw();
  if (autoplay) aiTurn(match);
}

newMatch();
