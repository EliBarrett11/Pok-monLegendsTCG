// Adapted from v3/src/main.js (the stage, the AI loop, ?seed, ?autoplay, ?debug).
// Pokémon Legends v4 — entry point (F1): you against the AI, on a fixed 1920×1080 stage scaled
// to fit the window. ?seed=123 replays the same shuffle and AI choices; ?autoplay lets the AI play
// both sides; ?debug exposes window.__v4 for the layout check (v4/tools/layout.mjs).
import { createGame, applyAction, actor, energyLeft, playReason, passReason } from './engine/game.js?v=202611101851';
import { chooseAction } from './ai/ai.js?v=202611101851';
import { renderMatch, reactOpen } from './ui/board.js?v=202611101851';
import { pokemonAt, cardAtRound } from './engine/cards.js?v=202611101851';
import { setupInteraction } from './ui/interact.js?v=202611101851';
import { present, setupPresenter, isPresenting, resetFx, stampRings, skip } from './ui/present.js?v=202611101851';
import { speedFactor, setSpeed, speedName, lowMotion, setLowMotionSetting } from './ui/settings.js?v=202611101851';
import { MS } from './ui/vfx/library.js?v=202611101851';
import { played } from './ui/sound.js?v=202611101851';
import { MODE_NAMES } from './engine/cards.js?v=202611101851';

export const BUILD = 'C1 — the card renderer: the new card designs everywhere a card appears';

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
// UX4: the AI's pace follows the speed setting (C): a thinking pause, its action named, its arrow.
const thinkMs = () => (speedFactor() > 0 ? MS.think * speedFactor() : 60);

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

const ctx = { build: BUILD, autoplay, act, redraw, newMatch, setReactTimer, reactTimer: loadReactTimer(), speed: speedName(), lowMotion: lowMotion() };
// UX4 D: Slow, Normal, Fast and Instant; Low motion (saved in localStorage, inside try/catch).
ctx.setSpeed = (v) => { setSpeed(v); ctx.speed = speedName(); redraw(); };
ctx.setLowMotion = (on) => { setLowMotionSetting(on); ctx.lowMotion = lowMotion(); redraw(); };
ctx.tournamentSeen = () => stampRings();
let interaction = null;
function redraw() {
  // G2: the player's chosen-target On Summon: the targeting flow asks for it at once.
  if (state?.choice?.who === 'player' && !ui.presenting && ui.select?.kind !== 'choice') { ui.select = { kind: 'choice', space: state.choice.space }; ui.focus = null; }
  if (!state?.choice && ui.select?.kind === 'choice') ui.select = null;
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
  if (!state || state.phase !== 'battle' || state.turn !== 'player' || state.reactWindow || ui.locked || isPresenting()) return;
  // G1 (2.1): no Pass while a Ready Pokémon of yours with unmatched Speed can attack (the button shows why).
  if (passReason(state, 'player')) return;
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
  resetFx();
  Object.assign(ui, { presenting: false, aim: null, aiNote: null, select: null, ask: null, locked: false, seenTournament: null, drawer: null, martSeen: null, drag: null, picker: null, confirm: null, keys: false, focus: null, hover: null });
  redraw();
  aiLoop(match);
}

// UX4: every action is shown by the presenter (src/ui/present.js): the board as it was, then the new
// state, then arrivals. Input is locked while it plays (a click skips to the end). The presenter only
// reads prev and next; the state is set here, once, when it draws.
async function show(next) {
  const prev = state;
  const id = match;
  ui.presenting = true;
  ui.locked = true;
  try {
    await present(prev, next, () => { if (id === match) { state = next; redraw(); } });
  } finally {
    if (id === match) { ui.presenting = false; ui.locked = false; }
  }
}

async function act(action) {
  if (isPresenting()) return;
  let next;
  try {
    next = applyAction(state, action);
  } catch (err) {
    alert(err.message);
    redraw();
    return;
  }
  ui.select = null;
  ui.ask = null;
  ui.picker = null;
  ui.focus = null;
  ui.drag = null;
  const id = match;
  await show(next);
  if (id !== match) return;
  redraw();
  aiLoop(match);
}

// The AI's action in words, for the prompt bar (C), and the points its arrow joins.
function describe(s, a) {
  const who = a.who === 'ai' ? 'The Opponent' : 'Autoplay (you)';
  const p = s.players[a.who];
  const foe = a.who === 'player' ? 'ai' : 'player';
  const card = p.hand.find((c) => c.uid === a.uid) ?? p.bag.find((c) => c.uid === a.uid);
  const on = (t) => (t ? s.players[t.who ?? a.who]?.row[t.space]?.name ?? '' : '');
  switch (a.type) {
    case 'attack': return `${who}'s ${p.row[a.from].name} attacks ${a.target.kind === 'player' ? (foe === 'player' ? 'you' : 'the Opponent') : s.players[foe].row[a.target.space].name}`;
    case 'summon': return `${who} summons ${card.name} (Level ${card.level}) into lane ${a.space + 1}`;
    case 'command': return `${who} plays ${card.name} (${MODE_NAMES[a.mode]}) on ${on(a.target)}`;
    case 'react': return `${who} Reacts with ${card.name} on ${on(a.target)}`;
    case 'decline': return `${who} lets it happen`;
    case 'placeLocation': return `${who} places ${card.name} over lanes ${a.start + 1}–${a.start + card.width}`;
    case 'supporter': return `${who} plays ${card.name}`;
    case 'buyItem': { const item = a.from === 'mart' ? s.mart.onSale[a.slot] : card; return `${who} buys ${item.name}${a.then === 'use' ? ` and uses it on ${on({ who: a.who, space: a.target.space })}` : ''}`; }
    case 'useItem': return `${who} uses ${card.name} on ${on({ who: a.who, space: a.target.space })}`;
    case 'trainerCommand': return `${who} plays ${card.name} (Trainer Command)`;
    case 'retain': return `${who} Retains a card`;
    case 'choose': return `${who}'s ${s.choice.name} On Summon targets ${s.players[a.target.who].row[a.target.space].name}`;
    case 'pass': return `${who} ends the turn (Pass)`;
    case 'mulligan': return `${who} ${a.cards?.length ? `mulligans ${a.cards.length}` : 'keeps the hand'}`;
    default: return `${who}: ${a.type}`;
  }
}
function aimFor(a) {
  const q = (sel) => document.querySelector(`#app ${sel}`);
  const space = (who, i) => q(`.v4-space[data-who="${who}"][data-space="${i}"]`);
  const foe = a.who === 'player' ? 'ai' : 'player';
  const hand = a.who === 'ai' ? q('.v4-oback:last-of-type') ?? q('.v4-ohand') : q(`.v4-hand [data-uid="${a.uid}"]`);
  let from = null;
  let to = null;
  if (a.type === 'attack') { from = space(a.who, a.from); to = a.target.kind === 'player' ? q(`.v4-ring.${foe}`) : space(foe, a.target.space); }
  else if (a.type === 'summon') { from = hand; to = space(a.who, a.space); }
  else if (a.type === 'command' || a.type === 'react') { from = hand; to = space(a.target.who, a.target.space); }
  else if (a.type === 'choose') { from = space(a.who, state.choice.space); to = space(a.target.who, a.target.space); }
  else if (a.type === 'placeLocation') { from = hand; to = space(a.who, a.start); }
  else if (a.type === 'useItem' || (a.type === 'buyItem' && a.then === 'use')) { from = a.type === 'useItem' ? q(`.v4-hud.${a.who === 'ai' ? 'opp' : 'you'} .v4-bag`) : a.from === 'mart' ? q('.v4-martcard') : hand; to = space(a.who, a.target.space); }
  if (!from || !to || !interaction) return null;
  const c = (el) => { const r = interaction.rectOf(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
  return { from: c(from), to: c(to) };
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
      // UX1: the AI's own React decisions stay instant. UX4 C: otherwise a thinking pause first.
      const k = speedFactor();
      if (!state.reactWindow) {
        if (k > 0) { ui.aiNote = `${who === 'ai' ? 'The Opponent' : 'You (autoplay)'} ${who === 'ai' ? 'is' : 'are'} thinking…`; }
        redraw();
        await wait(thinkMs());
      }
      if (id !== match) return;
      // The state may have changed during the pause (e.g. the debug hooks): choose for whoever acts now.
      if (actor(state) !== who) continue;
      const action = chooseAction(state, who, { rng: aiRng });
      const next = applyAction(state, action);
      if (k > 0) {
        // The prompt bar names the action; anything with a target gets the arrow for ~0.4 s.
        ui.aiNote = describe(state, action);
        redraw();
        ui.aim = aimFor(action);
        if (ui.aim) { interaction?.refresh(); await wait(MS.aim * k); }
        ui.aim = null;
        if (id !== match) return;
      }
      await show(next);
      ui.aiNote = null;
    }
  } finally {
    running = false;
    ui.aiNote = null;
    ui.aim = null;
    if (id === match) { ui.locked = false; redraw(); }
    // A new match began while this loop was waiting: its own loop was refused, so start it now.
    else aiLoop(match);
  }
}

if (params.has('debug')) {
  window.__v4 = {
    get state() { return state; }, ui, redraw, newMatch,
    // Play AI moves for both sides until the given Round (the player's turn), for checks.
    fastForward(round) {
      match += 1;
      resetFx();
      Object.assign(ui, { presenting: false, aim: null, aiNote: null });
      for (let i = 0; i < 4000 && state.phase !== 'gameOver'; i++) {
        if (state.round >= round && state.phase === 'battle' && state.turn === 'player') break;
        state = applyAction(state, chooseAction(state, actor(state), { rng: aiRng }));
      }
      ui.locked = false;
      redraw();
    },
    // UX4: the presenter, for checks.
    skip, isPresenting, played, speed: () => speedName(), setSpeed: ctx.setSpeed, setLowMotion: ctx.setLowMotion, show: (action) => act(action),
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

// UX3: the targeting arrow, previews, drag and drop and the keyboard. UX4: the presenter's layers
// (?nowebgl forces the 2D fallback).
interaction = setupInteraction({ stage, ui, ctx, getState: () => state });
setupPresenter(stage, { webgl: !params.has('nowebgl') }).then((r) => { if (window.__v4) window.__v4.webgl = r.webgl; });
newMatch();
