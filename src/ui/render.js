// Draws the current game state and turns clicks into actions.
// Reads state only; all rule changes go through the engine.
//
// Everything is drawn on a fixed 1920×1080 stage that main.js scales to fit
// the window, so every size here is in stage pixels and nothing ever scrolls
// the page. Panels that can grow (hand, log, prompt) overlap or scroll inside.

import {
  ZONES, playablePokemon, costPreview, isAlert, legalTargets, canUsePower, powerTargets,
  summonSpaces, isFallen, attackOf, maxStrengthOf, playableStrategies, strategyTargets,
  playableSupporters, supporterTargets, giftMet, playableLocations, locationSpaces, weatherState,
  openBagOptions, itemTargets, BAG_SIZE, passEndsPhase, PASS_ENERGY, applyAction, passSpends,
} from '../engine/game.js';
import { EXERT_LIMIT } from '../engine/energy.js';
import { keywordSummary, keywordLabel } from '../engine/keywords.js';
import { statusCount } from '../engine/status.js';
import { energySlots, exertSlots, pileDepth } from './resources.js';
import { heldBonus, weatherTotal, speedOf, cardAt } from '../engine/board.js';
import { INNATE_POWERS, WEATHER, SPEED_TIERS } from '../engine/cardData.js';
import { SPEEDS, getSpeed, setSpeed, speedFactor } from './settings.js';
import { wireInteractions } from './interact.js';
import { icon, statIcon, speedIcon, weatherIcon } from './icons.js';

export const STAGE = { width: 1920, height: 1080 };

// Choices the player is still making before they lock in. Reset whenever the
// game state changes (the engine returns a new state object for every action).
const ui = {};
// Kept across actions: whether the match log drawer is open.
let logOpen = false;
// Cards drawn this render, by index, for the hover preview.
let previews = [];
// One element per card, by uid, kept across renders so a card can move
// from place to place on screen (see adoptCards).
const cardEls = new Map();
// The line in the centre strip saying what the last action did.
let caption = '';
// Whether the settings menu is open.
let settingsOpen = false;
// The Discard or Released Pile being looked through: { who, kind } or null.
let pileView = null;
// The last actions, newest first, for the history strip: { who, kind, text, card, fresh }.
let history = [];
const HISTORY_SIZE = 10;

export function pushHistory(entry) {
  if (!entry) return;
  history = [{ ...entry, fresh: true }, ...history].slice(0, HISTORY_SIZE);
}

export function clearHistory() {
  history = [];
}

export function cardElements() {
  return cardEls;
}

export function setCaption(text) {
  caption = text;
  const el = document.querySelector('.caption');
  if (el) {
    el.textContent = text;
    el.title = text;
    el.hidden = !text;
  }
  const echo = document.querySelector('.prompt-caption');
  if (echo) echo.textContent = text;
}

// The markup for one card, for the presenter's reveals.
export function cardMarkup(c, size) {
  return card(c, size);
}

// Swaps every freshly drawn card for the element already kept for its uid
// (updated to match), so cards keep their identity between renders.
function adoptCards(root) {
  const placed = new Set();
  for (const fresh of root.querySelectorAll('.card[data-uid]')) {
    const uid = fresh.dataset.uid;
    const kept = cardEls.get(uid);
    if (placed.has(uid)) continue;
    placed.add(uid);
    if (!kept || kept === fresh) {
      cardEls.set(uid, fresh);
      continue;
    }
    for (const { name } of [...kept.attributes]) if (!fresh.hasAttribute(name)) kept.removeAttribute(name);
    for (const { name, value } of [...fresh.attributes]) kept.setAttribute(name, value);
    if (kept.innerHTML !== fresh.innerHTML) kept.innerHTML = fresh.innerHTML;
    kept.onclick = null;
    kept.onmouseenter = null;
    kept.onmouseleave = null;
    for (const a of kept.getAnimations()) a.cancel();
    fresh.replaceWith(kept);
  }
}

function resetUiFor(state) {
  if (ui.state === state) return;
  // The opponent locking in during a simultaneous step changes the state but
  // not my half-made choice: keep it.
  const was = ui.state;
  const keep = was && was.phase === state.phase && was.round === state.round && was.xpStep === state.xpStep
    && ['trainers', 'breakfast'].includes(state.phase)
    && !state.players.player.pending && !state.players.player.xpChoice
    && { placing: ui.placing, selectedTrainer: ui.selectedTrainer, mulligan: ui.mulligan, xpPlan: ui.xpPlan, xpPick: ui.xpPick };
  ui.state = state;
  ui.placing = Array(ZONES).fill(null);
  ui.selectedTrainer = null;   // setup: Trainer picked from the tray
  ui.mulligan = new Set();
  ui.selectedPokemon = null;   // uid of a Pokémon in hand to play
  ui.attacker = null;          // { zone, space } of the player's chosen Alert Pokémon
  ui.power = null;             // zone of the player's Trainer whose Power is chosen
  ui.strategy = null;          // uid of a Strategy Card in hand waiting for a target
  ui.supporter = null;         // { uid, discard: [uids], release: [uids], picking } while paying for a Supporter
  ui.location = null;          // uid of a Location Card in hand to play
  ui.xpPlan = [];              // the XP step: [{ uid, stat }] planned before locking in
  ui.xpPick = null;            // the XP step: uid of the Pokémon picked to buff
  ui.bag = null;               // Open Bag: { mode: null | 'buyHand' | 'buyMart' | 'useBag', uid, then, picking }
  ui.costFocus = null;         // the card or Power whose Energy cost is being previewed: { uid } | { power: zone }
  ui.passWarn = false;         // the "passing now will make … Spent" warning is showing
  if (keep) Object.assign(ui, keep);
}

function clearSelection() {
  ui.passWarn = false;
  ui.bag = null;
  ui.location = null;
  ui.selectedPokemon = null;
  ui.attacker = null;
  ui.power = null;
  ui.strategy = null;
  ui.supporter = null;
}

// The Supporter being paid for, and the hand cards chosen so far.
function supporterChoice(state) {
  if (!ui.supporter) return null;
  const hand = state.players.player.hand;
  const card = hand.find((c) => c.uid === ui.supporter.uid);
  const paid = hand.filter((c) => [...ui.supporter.discard, ...ui.supporter.release].includes(c.uid));
  const exact = ui.supporter.discard.length === card.cardCost.discard && ui.supporter.release.length === card.cardCost.release;
  return { card, paid, exact, gift: giftMet(card, paid) };
}

const key = (ref) => (ref.kind === 'trainer' ? `${ref.owner}:T${ref.zone}`
  : ref.kind === 'zone' ? `${ref.owner}:Z${ref.zone}`
    : ref.kind === 'hand' ? `${ref.owner}:H${ref.uid}` : `${ref.owner}:P${ref.zone}${ref.space}`);

// The Item chosen in the Open Bag flow (from hand or from the Bag).
function bagItem(state) {
  if (!ui.bag?.uid) return null;
  const p = state.players.player;
  return (ui.bag.mode === 'buyHand' ? p.hand : p.bag).find((i) => i.uid === ui.bag.uid) ?? null;
}

// Cards that can be clicked as the target of the current choice, as keys,
// with the highlight to use: red for attacks, green for effects (either side).
function targetKeys(state) {
  if (state.pending?.who === 'player' && state.pending.kind === 'target') {
    return { keys: new Set(state.pending.options.map(key)), cls: ' power-target' };
  }
  if (ui.attacker) {
    const keys = legalTargets(state, 'player', ui.attacker).map((t) => key({ ...t, owner: 'ai' }));
    return { keys: new Set(keys), cls: ' attack-target' };
  }
  if (ui.power !== null) return { keys: new Set(powerTargets(state, 'player', ui.power).map(key)), cls: ' power-target' };
  if (ui.strategy) return { keys: new Set(strategyTargets(state, 'player', ui.strategy).map(key)), cls: ' power-target' };
  if (ui.supporter?.picking) return { keys: new Set(supporterTargets(state, 'player', ui.supporter.uid).map(key)), cls: ' power-target' };
  if (ui.bag?.picking) return { keys: new Set(itemTargets(state, 'player', bagItem(state)).map(key)), cls: ' power-target' };
  return { keys: new Set(), cls: '' };
}

// Empty spaces that can be clicked: for playing a Pokémon, or Ash's free summon.
function placingSpaces(state) {
  const freeSummon = state.pending?.who === 'player' && state.pending.kind === 'freeSummon';
  if (!ui.selectedPokemon && !freeSummon) return new Set();
  return new Set(summonSpaces(state, 'player').map(({ zone, space }) => `${zone}${space}`));
}

const isMyBattleTurn = (state) => state.phase === 'battle' && state.turn === 'player' && !state.pending;

// Whether the player has something to do now (the main button glows).
function isMyMove(state) {
  if (state.phase === 'gameOver') return true;
  if (state.pending) return state.pending.who === 'player';
  if (state.phase === 'battle') return state.turn === 'player';
  if (state.phase === 'breakfast') return state.xpStep ? !state.players.player.xpChoice : !state.players.player.pending;
  if (state.phase === 'trainers') return !state.players.player.pending;
  return state.phase === 'initiative';
}

const PHASE_NAMES = {
  trainers: 'Setup · Place Trainers',
  initiative: 'Setup · Initiative',
  breakfast: 'Breakfast Phase',
  battle: 'Battle Phase',
  supper: 'Supper Phase',
  gameOver: 'Match over',
};

export function render(root, state, actions) {
  resetUiFor(state);
  previews = [];
  const c = controls(state);

  root.innerHTML = `
    <div class="table${isMyBattleTurn(state) && !ui.supporter ? ' my-turn' : ''}">
      <section class="res-row">${resources(state, 'ai')}${opponentHand(state.players.ai.hand.length)}${piles(state, 'ai')}</section>
      ${historyStrip()}
      <div class="arena">
        <div class="mat mat-top"></div><div class="mat mat-bottom"></div>
        <section class="side opponent">${lanes(state, 'ai')}</section>
        ${centreStrip(state)}
        <section class="side player">${lanes(state, 'player')}</section>
      </div>
      <section class="bottom">
        ${piles(state, 'player')}
        <div class="hand-area">${trainerTray(state) || `<div class="hand">${handCards(state)}</div>`}</div>
        ${resources(state, 'player')}
      </section>
    </div>

    <aside class="side-panel${isMyMove(state) ? ' my-move' : ''}">
      <header class="panel-title"><h1>Pokémon Legends TCG</h1><span class="build-tag">${actions.build ?? ''}</span></header>
      ${martPanel(state)}
      <div class="prompt">${c.hint}</div>
      <div class="secondary-actions">${c.secondary}</div>
      <div class="medallion-seat">${c.primary}</div>
      <div class="panel-foot">
        <button data-action="toggle-log" class="secondary">${logOpen ? 'Hide log' : 'Log'}</button>
        <button data-action="new-game" class="secondary">New match</button>
        <div class="settings-wrap">
          <button data-action="settings" class="secondary" title="Settings">⚙ ${SPEEDS[getSpeed()].label}</button>
          <div class="settings"${settingsOpen ? '' : ' hidden'}>
            <div class="settings-title">Animation speed</div>
            ${Object.entries(SPEEDS).map(([id, s]) => `<button data-speed="${id}" class="${id === getSpeed() ? 'chosen' : 'secondary'}">${s.label}</button>`).join('')}
          </div>
        </div>
      </div>
    </aside>

    <aside class="log${logOpen ? ' open' : ''}">
      <div class="log-head"><h3>Match log</h3><button data-action="toggle-log" class="secondary">Close</button></div>
      <div class="log-body">${state.log.map((line) => `<p>${line}</p>`).join('')}</div>
    </aside>
    ${passWarningBox(state)}
    ${pileViewBox(state)}
    ${gameOverScreen(state)}
    <div class="preview" hidden></div>
  `;

  adoptCards(root);
  applyCost(root, state);
  animateResources(root, state);
  const logBody = root.querySelector('.log-body');
  logBody.scrollTop = logBody.scrollHeight;
  wire(root, state, actions);
}

// --- Info bars, strip, panels ------------------------------------------------

const HISTORY_ICONS = { play: 'discard', item: 'dollar', attack: 'physical', power: 'power', pass: 'energy', choice: 'quest' };

// A strip down the left edge of the mat: the last actions as small card
// thumbnails, coloured by player; hovering one shows it in words. The newest
// slides in at the top.
function historyStrip() {
  const entries = history.map((h, i) => {
    let thumb = '<div class="hist-blank"></div>';
    let pv = '';
    if (h.card) {
      const html = card(h.card, 'mini');
      pv = html.match(/data-pv="(\d+)"/)?.[1] ?? '';
      // No uid or preview of its own: the thumbnail is not that card's element on the board.
      thumb = html.replace(/ data-uid="[^"]*"/, '').replace(/ data-pv="\d+"/, '');
    }
    const cls = `hist ${h.who} ${h.kind}${h.fresh ? ' fresh' : ''}`;
    h.fresh = false;
    return `<div class="${cls}" data-hist="${i}"${pv ? ` data-pv="${pv}"` : ''}>${thumb}<i class="hist-icon">${icon(HISTORY_ICONS[h.kind] ?? 'quest')}</i>${h.kind === 'pass' ? '<span class="hist-word">Pass</span>' : ''}</div>`;
  }).join('');
  return `<aside class="history" aria-label="Recent actions"><div class="history-title">Recent</div>${entries}</aside>`;
}

// --- Resources and piles ------------------------------------------------------
//
// Each player's resources sit on their own side: mine along the bottom (piles
// left of the hand, the resource panel right of it), the opponent's along the
// top, mirrored (resource panel left, piles right). Every number the old text
// bars showed is still here, on a crystal row, a gem, a badge or a pile tag.

// A player's resource panel: name and turn, XP, PokéDollars, Energy, Exert and the Bag.
function resources(state, who) {
  const p = state.players[who];
  return `
    <div class="res ${who}">
      <div class="res-id"><i class="turn-dot${state.phase === 'battle' && state.turn === who && !state.pending ? ' on' : ''}" title="${state.turn === who ? 'Their move now' : ''}"></i><strong class="pname">${p.name}</strong>
        ${passedLast(state, who) ? `<span class="passed-chip" title="Passed last turn: ${who === 'ai' ? 'if you pass now, the Battle Phase ends' : 'if the opponent passes now, the Battle Phase ends'}">Passed</span>` : ''}</div>
      <div class="res-tokens">${xpBadge(p, who)}${coinStack(p, who)}</div>
      ${energyMeter(state, p, who)}
      ${exertGems(state, p, who)}
      ${satchel(state, who)}
    </div>`;
}

// The opponent's hand: one card back per card, in a small fan, so the count reads at a glance.
function opponentHand(n) {
  const step = n > 1 ? Math.min(20, 150 / (n - 1)) : 0;
  const backs = Array.from({ length: n }, (_, i) => {
    const off = (i - (n - 1) / 2);
    return `<i class="back" style="left:${Math.round(95 + off * step - 17)}px;--rot:${(off * 4).toFixed(1)}deg;top:${Math.round(Math.abs(off) * Math.abs(off) * 0.6)}px"></i>`;
  }).join('');
  return `<div class="opp-hand" data-pile="ai-hand" title="Opponent's hand: ${n} card${n === 1 ? '' : 's'}">${backs}<span class="opp-hand-count">Hand <b>${n}</b></span></div>`;
}

// Who passed on the last turn of this Battle Phase (their pass did not end it).
function passedLast(state, who) {
  return state.phase === 'battle' && state.passesInARow === 1 && state.turn !== who;
}

const BONUS_SHOWN = 3;   // extra crystals drawn above this Round's Base Energy; more shows as "+n"

// Base Energy as crystals: one socket per point of this Round's Base Energy
// (up to 10), lit while unspent, dim once spent. Energy above that (from
// passing or abilities) shows as extra crystals in a cooler shade.
function energyMeter(state, p, who) {
  const { sockets, lit, bonus } = energySlots(state.round, p.baseEnergy);
  const cells = [
    ...Array.from({ length: sockets }, (_, i) => `<i class="crystal ${i < lit ? 'lit' : 'empty'}"></i>`),
    ...Array.from({ length: Math.min(bonus, BONUS_SHOWN) }, () => '<i class="crystal bonus"></i>'),
    bonus > BONUS_SHOWN ? `<i class="crystal-more">+${bonus - BONUS_SHOWN}</i>` : '',
  ].join('');
  const tip = `Base Energy: ${p.baseEnergy} left of this Round's ${sockets}`
    + `${bonus ? ` (+${bonus} extra from passing or abilities)` : ''}. Spent first; it resets at Breakfast.`;
  return `
    <div class="energy" data-pile="${who}-energy" data-sockets="${sockets}" title="${attr(tip)}">
      ${icon('energy')}<span class="crystals">${cells || '<i class="crystal-none">—</i>'}</span>
      <b class="energy-n${bonus ? ' over' : ''}"><span class="base-n">${p.baseEnergy}</span><small>/ ${sockets}</small></b>
      <span class="cost-note"></span>
    </div>`;
}

// Exert: 3 sockets. Free points are amber gems; Exhausted ones are cracked
// stones marked with the Round they recover in; sockets above this Round's
// Exert maximum are locked (Rounds 1 and 2).
function exertGems(state, p, who) {
  const free = p.exertMax - p.exhaust.length;
  const slots = exertSlots(p);
  const gems = slots.map((x) => (x.kind === 'free' ? '<i class="xgem free"></i>'
    : x.kind === 'stone' ? `<i class="xgem stone"><b>R${x.recoversRound}</b></i>`
      : `<i class="xgem locked">${icon('lock')}</i>`)).join('');
  const lines = slots.map((x) => `<li>${x.kind === 'free' ? 'Ready to use'
    : x.kind === 'stone' ? `Exhausted (position ${x.position}): recovers at the start of Round ${x.recoversRound}`
      : `Locked until Round ${EXERT_LIMIT}`}</li>`).join('');
  return `
    <div class="exert" data-pile="${who}-exert">
      <span class="gems">${gems}</span><span class="exert-label">Exert <b class="exert-n">${free}/${p.exertMax}</b></span>
      <div class="res-tip"><b>Exert</b>: extra Energy, used only once Base Energy runs out. Each point used
        becomes Exhausted and takes Rounds to recover.<ul>${lines}</ul></div>
    </div>`;
}

function xpBadge(p, who) {
  return `<div class="xp-badge" data-pile="${who}-xp" title="XP: ${p.xp} (spent in the XP step to raise a Pokémon's stats)"><i class="star">${icon('xp')}</i><b class="xp-n">${p.xp}</b><span>XP</span></div>`;
}

const COINS_SHOWN = 6;

// PokéDollars: a stack of gold coins (taller with more money) and the amount.
function coinStack(p, who) {
  const n = Math.min(COINS_SHOWN, Math.ceil(p.dollars / 2));
  const coins = Array.from({ length: n }, (_, i) => `<i class="coin" style="bottom:${i * 3}px"></i>`).join('');
  return `<div class="dollars" data-pile="${who}-dollars" title="PokéDollars: $${p.dollars} (buy Items at the PokéMart)"><span class="coin-stack">${coins}</span><b class="dollars-n">$${p.dollars}</b></div>`;
}

// A player's Bag: a leather satchel with 6 spaces. Items In Delivery are
// wrapped until the next Round. Both Bags are visible.
function satchel(state, who) {
  const p = state.players[who];
  const usable = new Set(who === 'player' && isMyBattleTurn(state) && !ui.supporter
    ? openBagOptions(state, 'player').filter((o) => o.mode === 'useBag').map((o) => o.uid) : []);
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const item = p.bag[i];
    if (!item) return '<div class="bag-slot empty"></div>';
    const cls = `bag-slot${item.inDelivery ? ' delivery' : ''}${usable.has(item.uid) ? ' usable' : ''}${ui.bag?.uid === item.uid ? ' selected' : ''}`;
    const parcel = item.inDelivery ? '<i class="parcel" title="In Delivery: usable from next Round"><span>Next Round</span></i>' : '';
    return `<div class="${cls}" data-uid="${item.uid}">${card(item, 'mini')}${parcel}</div>`;
  }).join('');
  const full = p.bag.length >= BAG_SIZE;
  const delivery = p.bag.filter((i) => i.inDelivery).length;
  const tip = `Bag: ${p.bag.length} of ${BAG_SIZE} Items${full ? ' (full)' : ''}${delivery ? `, ${delivery} In Delivery until next Round` : ''}`;
  return `
    <div class="bag${full ? ' full' : ''}" data-pile="${who}-bag" title="${tip}">
      <span class="bag-flap"><span>Bag</span><b class="bag-count">${p.bag.length}/${BAG_SIZE}</b></span>
      <div class="bag-slots">${slots}</div>
    </div>`;
}

const PILE_NAMES = { draw: 'Draw Pile', discard: 'Discard Pile', released: 'Released Pile' };

// A pile as a physical stack: taller with more cards, the count on a brass
// tag. The Draw Pile is face down; the Discard and Released Piles show their
// top card (the Released Pile darker, under a brass weight) and open a view
// of all their cards when clicked.
function pileStack(p, who, kind) {
  const cards = kind === 'draw' ? p.drawPile : kind === 'discard' ? p.discard : p.released;
  const n = cards.length;
  const depth = pileDepth(n);
  const edges = Array.from({ length: depth }, (_, i) => `${i % 2 ? 0.5 : 0}px ${i + 1}px 0 ${i % 2 ? '#2a1a0c' : '#d9c79f'}`).join(', ');
  let face = '';
  if (n && kind === 'draw') face = '<div class="pile-face back"></div>';
  else if (n) {
    // The top card, face up; not that card's own element and no preview of its own.
    face = `<div class="pile-face">${card(cards[n - 1], 'mini').replace(/ data-uid="[^"]*"/, '').replace(/ data-pv="\d+"/, '')}</div>`;
  }
  const whose = who === 'player' ? 'Your' : "Opponent's";
  const label = `${whose} ${PILE_NAMES[kind]}: ${n} card${n === 1 ? '' : 's'}`;
  const opens = kind !== 'draw' && n > 0;
  return `
    <div class="pile ${kind}${n ? '' : ' none'}${opens ? ' opens' : ''}" data-pile="${who}-${kind}"${opens ? ` data-pile-view="${who}:${kind}"` : ''} title="${attr(label)}${opens ? ' (click to look through)' : ''}">
      <div class="pile-stack" style="--depth:${depth}px${edges ? `;box-shadow:${edges}, 2px ${depth + 3}px 6px rgba(0,0,0,0.6)` : ''}">${face}${kind === 'released' && n ? '<i class="weight"></i>' : ''}</div>
      <span class="pile-tag">${n}</span><span class="pile-name">${kind === 'draw' ? 'Draw' : kind === 'discard' ? 'Discard' : 'Released'}</span>
      <span class="pile-hover">${attr(label)}</span>
    </div>`;
}

function piles(state, who) {
  const p = state.players[who];
  const order = who === 'player' ? ['draw', 'discard', 'released'] : ['released', 'discard', 'draw'];
  return `<div class="piles ${who}">${order.map((k) => pileStack(p, who, k)).join('')}</div>`;
}

// Looking through a Discard or Released Pile: every card face up, in the order they arrived.
function pileViewBox(state) {
  if (!pileView) return '';
  const { who, kind } = pileView;
  const p = state.players[who];
  const cards = kind === 'discard' ? p.discard : p.released;
  const faces = cards.map((c, i) => `<div class="pv-slot"><span class="pv-i">${i + 1}</span>${card(c, 'board').replace(/ data-uid="[^"]*"/, '')}</div>`).join('');
  return `
    <div class="pile-view" data-action="close-pile">
      <div class="pile-view-box">
        <header><h3>${who === 'player' ? 'Your' : "Opponent's"} ${PILE_NAMES[kind]} <span>${cards.length} card${cards.length === 1 ? '' : 's'}</span></h3>
          <p>In the order they arrived: first on the left, the top card last.${kind === 'released' ? ' Released cards never return to play.' : ''}</p>
          <button data-action="close-pile" class="secondary">Close</button></header>
        <div class="pile-view-cards">${faces || '<p class="muted">Empty.</p>'}</div>
      </div>
    </div>`;
}

// --- Resource animations ---------------------------------------------------------
//
// Each render compares every player's numbers with the last render's and
// animates the change: crystals light up one by one or crack from the right,
// Exert gems drain into stones or glow back, XP and PokéDollars count up,
// coins slide off the stack when spent.

const lastRes = {};

function animateResources(root, state) {
  for (const who of ['player', 'ai']) {
    const p = state.players[who];
    const now = { round: state.round, base: p.baseEnergy, free: p.exertMax - p.exhaust.length, xp: p.xp, dollars: p.dollars };
    const was = lastRes[who];
    lastRes[who] = now;
    const f = speedFactor();
    if (!was || f === 0 || now.round < was.round || !state.round) continue;
    const box = root.querySelector(`.res.${who}`);
    if (!box) continue;
    const step = 110 * f;

    // Energy, position by position: the Round's sockets first, then the extra crystals.
    const sockets = [...box.querySelectorAll('.energy .crystal.lit, .energy .crystal.empty')];
    const extra = [...box.querySelectorAll('.energy .crystal.bonus')];
    const at = (k) => (k < sockets.length ? sockets[k] : extra[k - sockets.length]);
    for (let k = was.base; k < now.base; k++) {
      at(k)?.animate([
        { opacity: 0.2, transform: 'scale(0.5)', filter: 'brightness(3)' },
        { opacity: 1, transform: 'scale(1.35)', filter: 'brightness(2)', offset: 0.5 },
        { opacity: 1, transform: 'scale(1)', filter: 'none' },
      ], { duration: 380 * f, delay: (k - was.base) * step, fill: 'backwards', easing: 'ease-out' });
    }
    for (let k = was.base - 1; k >= now.base; k--) {
      const el = at(k);
      if (!el) continue;
      crackOut(el, 'crystal-ghost', 420 * f, (was.base - 1 - k) * step);
    }

    // Exert: free gems first, then stones, so a spent gem turns to stone in its own socket.
    const gems = [...box.querySelectorAll('.exert .xgem')];
    for (let k = now.free; k < was.free; k++) if (gems[k]) crackOut(gems[k], 'gem-ghost', 520 * f, (k - now.free) * step);
    for (let k = was.free; k < now.free; k++) {
      gems[k]?.animate([
        { filter: 'grayscale(1) brightness(0.5)', transform: 'scale(0.8)' },
        { filter: 'brightness(1.9) drop-shadow(0 0 6px #ffb040)', transform: 'scale(1.25)', offset: 0.55 },
        { filter: 'none', transform: 'scale(1)' },
      ], { duration: 700 * f, delay: (k - was.free) * step * 2, fill: 'backwards' });
    }

    if (now.xp !== was.xp) {
      const badge = box.querySelector('.xp-badge');
      tick(badge?.querySelector('.xp-n'), was.xp, now.xp, 500 * f, '');
      if (now.xp > was.xp) stars(badge, Math.min(5, now.xp - was.xp), f);
    }
    if (now.dollars !== was.dollars) {
      const stack = box.querySelector('.dollars');
      tick(stack?.querySelector('.dollars-n'), was.dollars, now.dollars, 500 * f, '$');
      if (now.dollars > was.dollars) {
        stack?.querySelector('.coin-stack')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2) translateY(-3px)', filter: 'brightness(1.5)' }, { transform: 'scale(1)' }], { duration: 450 * f });
      } else slideCoins(stack, Math.min(5, was.dollars - now.dollars), f);
    }
  }
}

// A lit copy over the element that flares, cracks and fades: the point being spent.
function crackOut(el, cls, ms, delay) {
  const ghost = document.createElement('i');
  ghost.className = cls;
  el.append(ghost);
  const a = ghost.animate([
    { opacity: 1, filter: 'brightness(1)', transform: 'scale(1)' },
    { opacity: 1, filter: 'brightness(2.2)', transform: 'scale(1.15)', offset: 0.25 },
    { opacity: 0.9, filter: 'brightness(0.7) grayscale(0.6)', transform: 'scale(1) rotate(4deg)', offset: 0.55 },
    { opacity: 0, filter: 'brightness(0.3) grayscale(1)', transform: 'scale(0.85) translateY(3px)' },
  ], { duration: ms, delay, fill: 'backwards', easing: 'ease-in' });
  a.onfinish = () => ghost.remove();
}

// A number counting from one value to another.
function tick(el, from, to, ms, prefix) {
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = `${prefix}${Math.round(from + (to - from) * k)}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = `${prefix}${from}`;
  requestAnimationFrame(step);
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', color: '#fff6d0' }, { transform: 'scale(1)' }], { duration: ms * 1.2 });
}

// Small stars flying in to the XP badge.
function stars(badge, n, f) {
  if (!badge) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'fly-star';
    s.innerHTML = icon('xp');
    badge.append(s);
    const a = (i / n) * Math.PI * 2 + Math.random();
    const a2 = s.animate([
      { transform: `translate(${Math.cos(a) * 70}px, ${Math.sin(a) * 50 - 30}px) scale(0.6) rotate(-90deg)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'translate(0, 0) scale(1.1) rotate(0deg)', opacity: 1, offset: 0.85 },
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
    ], { duration: 650 * f, delay: i * 90 * f, fill: 'backwards', easing: 'ease-in' });
    a2.onfinish = () => s.remove();
  }
}

// Coins sliding off the top of the stack: money spent.
function slideCoins(stack, n, f) {
  const holder = stack?.querySelector('.coin-stack');
  if (!holder) return;
  const top = holder.querySelectorAll('.coin').length;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'coin sliding';
    c.style.bottom = `${(top + i) * 3}px`;
    holder.append(c);
    const a = c.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${18 + i * 4}px, -6px) rotate(25deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${34 + i * 6}px, ${24 + i * 3}px) rotate(80deg)`, opacity: 0 },
    ], { duration: 600 * f, delay: i * 90 * f, fill: 'backwards', easing: 'ease-in' });
    a.onfinish = () => c.remove();
  }
}

function weatherText(tokens) {
  return Object.entries(tokens ?? {}).map(([type, n]) => `<span class="weather-chip ${slug(type)}">${weatherIcon(type)} ${n} ${type}</span>`).join(' ');
}

// Round, phase, whose turn, initiative and the Weather in play (both sides
// combined: each type's count, its brackets, reached ones lit, and the effects).
function centreStrip(state) {
  let weather = '';
  if (state.round) {
    const types = Object.entries(weatherState(state)).filter(([, w]) => w.count > 0);
    weather = types.length ? types.map(([type, w]) => {
      // Icon, count and one pip per bracket (lit when reached); the effect text is in the tooltip.
      const pips = WEATHER[type].brackets.map((b) => `<i class="pip${w.active.includes(b) ? ' on' : ''}${w.active.includes(b) && !w.effective.includes(b) ? ' replaced' : ''}" data-at="${b.at}"></i>`).join('');
      const effects = w.effective.map((b) => b.text).join(' ') || 'No effect yet.';
      const brackets = WEATHER[type].brackets.map((b) => `${b.at}: ${b.text}`).join('\n');
      return `<span class="weather-type ${slug(type)}" title="${attr(`${type} ${w.count} — ${effects}\n\nBrackets:\n${brackets}`)}"><b>${weatherIcon(type)}${w.count}</b><span class="pips">${pips}</span></span>`;
    }).join('') : '<span class="weather-chip">No Weather</span>';
  }
  // Brass tabs above the bar, one centred on each zone column; a fallen zone says which side.
  const tabs = [0, 1, 2].map((z) => {
    const sides = ['ai', 'player'].filter((w) => isFallen(state, w, z));
    const fallen = sides.length === 2 ? 'both sides' : sides[0] === 'player' ? 'your side' : sides[0] ? "opponent's side" : '';
    return `<span class="zone-tab z${z + 1}${fallen ? ' fallen' : ''}"${fallen ? ` title="Fallen on ${fallen}: no new Pokémon can be played there"` : ''}>Zone ${z + 1}${fallen ? ` · Fallen (${fallen === 'both sides' ? 'both' : fallen === 'your side' ? 'you' : 'opp.'})` : ''}</span>`;
  }).join('');
  return `
    <section class="status">
      <div class="zone-tabs">${tabs}</div>
      <div class="strip-bar">
        <span class="strip-side left">${state.turn ? `<span class="turn ${state.turn}">${state.turn === 'player' ? 'Your turn' : "Opponent's turn"}</span>` : ''}</span>
        <span class="phase">${state.round ? `Round ${state.round} · ` : ''}${PHASE_NAMES[state.phase]}</span>
        <span class="strip-side right">${state.initiative ? `<span class="initiative">Initiative: ${state.initiative === 'player' ? 'You' : 'Opponent'}</span>` : ''}<span class="weather">${weather}</span></span>
      </div>
      <div class="caption-slot"><span class="caption" title="${attr(caption)}"${caption ? '' : ' hidden'}>${attr(caption)}</span></div>
    </section>`;
}

// The shared PokéMart: 3 Items on sale and the deck count.
function martPanel(state) {
  const onSale = state.round && state.mart ? state.mart.onSale : [null, null, null];
  const buyable = new Set(isMyBattleTurn(state) && !ui.supporter
    ? openBagOptions(state, 'player').filter((o) => o.mode === 'buyMart').map((o) => o.slot) : []);
  const slots = onSale.map((item, slot) => (item
    ? `<div class="mart-item${buyable.has(slot) ? ' buyable' : ''}" data-slot="${slot}">
        ${card(item, 'mini')}
        <div class="mart-text"><div class="mart-name"><b>${item.name}</b><span class="price">$${item.cost}</span></div>
          <div class="mart-effect">${item.itemType}: ${item.effectText}</div></div></div>`
    : `<div class="mart-item sold">${state.round ? 'Sold' : 'Opens in Round 1'}</div>`)).join('');
  return `<div class="mart"><div class="mart-label">PokéMart ${state.round && state.mart ? `<span class="hint">deck ${state.mart.deck.length}</span>` : ''}</div>${slots}</div>`;
}

// --- The arena ----------------------------------------------------------------

// One lane per zone: its Trainer and Location at the back, its Pokémon Spaces
// at the front (nearest the centre). The player's side is the mirror image.
function lanes(state, who) {
  const targets = targetKeys(state);
  return state.players[who].zones.map((zone, z) => {
    const fallen = zone.trainer && isFallen(state, who, z);
    return `
      <div class="lane">
        <div class="back">
          ${trainerSpace(state, who, z, targets)}
          ${locationSpace(state, who, z)}
        </div>
        ${pokemonZone(state, who, z, targets, fallen)}
      </div>`;
  }).join('');
}

function trainerSpace(state, who, i, targets) {
  const p = state.players[who];
  const zone = p.zones[i];
  let content = '<span class="empty">Trainer Space</span>';
  let cls = 'trainer-space';
  if (zone.trainer) {
    const usable = who === 'player' && isMyBattleTurn(state) && !ui.supporter && canUsePower(state, 'player', i);
    content = card(zone.trainer, 'board', { selectable: usable, selected: who === 'player' && ui.power === i });
    if (zone.trainer.strength <= 0) cls += ' down';
    if (targets.keys.has(key({ kind: 'trainer', owner: who, zone: i }))) cls += targets.cls;
  } else if (who === 'player' && state.phase === 'trainers') {
    const placed = ui.placing[i] && p.trainers.find((t) => t.uid === ui.placing[i]);
    content = placed ? card(placed, 'board') : '<span class="empty">Click to place</span>';
    cls += ' target';
  } else if (who === 'ai' && p.pending) {
    content = '<div class="card-back board" title="Chosen in secret"></div>';
  }
  return `<div class="${cls}" data-owner="${who}" data-zone="${i}">${content}</div>`;
}

function locationSpace(state, who, zone) {
  const z = state.players[who].zones[zone];
  const target = who === 'player' && ui.location && locationSpaces(state, 'player').includes(zone);
  return `<div class="location-space${target ? ' target' : ''}" data-owner="${who}" data-zone="${zone}">
    ${z.location ? card(z.location, 'board') : `<span class="empty">${target ? 'Play here' : 'Location Space'}</span>`}
  </div>`;
}

function pokemonZone(state, who, z, targets, fallen) {
  const p = state.players[who];
  const placing = who === 'player' ? placingSpaces(state) : new Set();
  const myTurn = isMyBattleTurn(state) && !ui.supporter;
  const zoneTarget = targets.keys.has(key({ kind: 'zone', owner: who, zone: z }));
  return `
    <div class="zone${fallen ? ' fallen' : ''}${zoneTarget ? ' zone-target' : ''}" data-owner="${who}" data-zone="${z}">
      ${p.zones[z].pokemon.map((c, s) => {
        let cls = 'pokemon-space';
        if (placing.has(`${z}${s}`)) cls += ' target';
        if (targets.keys.has(key({ kind: 'pokemon', owner: who, zone: z, space: s }))) cls += targets.cls;
        const alert = c && isAlert(state, c);
        const opts = {
          alert,
          willSpend: ui.passWarn && who === 'player' && passSpends(state, 'player').some((r) => r.uid === c?.uid),
          selectable: alert && who === 'player' && myTurn,
          selected: who === 'player' && ui.attacker?.zone === z && ui.attacker?.space === s,
        };
        const empty = placing.has(`${z}${s}`) ? '<span class="empty">Play here</span>' : '';
        return `<div class="${cls}" data-owner="${who}" data-zone="${z}" data-space="${s}">${c ? card(c, 'board', opts) : empty}</div>`;
      }).join('')}
    </div>`;
}

// --- Hand -----------------------------------------------------------------------

// My hand is a fanned arc along the bottom edge, rotating around a point far
// below the screen. At rest every card shows at least its top half (name,
// cost, art); the fan tightens as the hand grows, so it never leaves its area.
// interact.js uses arcLayout again to lift a hovered card and spread its
// neighbours apart.
export const HAND_AREA = 740;      // width of the hand area (stage px)
export const HAND_AREA_H = 142;    // its height: from its top down to the bottom edge of the stage
export const HAND_CARD = 170;
export const HAND_CARD_H = 238;
const ARC_RADIUS = 2200;
const MAX_STEP = 118;
// A hovered card: unrotated, scaled up from its bottom edge, whole card on screen.
export const LIFT = { top: HAND_AREA_H - HAND_CARD_H - 4, scale: 1.22 };

// Left, top (relative to the hand area) and rotation of each of n cards.
// With hover = i, card i lifts and the cards beside it move apart.
export function arcLayout(n, hover = -1) {
  const step = n > 1 ? Math.min(MAX_STEP, (HAND_AREA - HAND_CARD - 24) / (n - 1)) : 0;
  const drop = (x) => ARC_RADIUS * (1 - Math.cos(Math.asin(Math.max(-1, Math.min(1, x / ARC_RADIUS)))));
  // The outermost cards drop the most; the whole arc sits high enough that they still show their top half.
  const top0 = HAND_AREA_H - HAND_CARD_H / 2 - drop(((n - 1) / 2) * step) - 4;
  return Array.from({ length: n }, (_, i) => {
    let x = (i - (n - 1) / 2) * step;
    if (hover >= 0 && i !== hover) x += Math.sign(i - hover) * Math.max(8, 40 - 12 * (Math.abs(i - hover) - 1));
    const left = Math.min(Math.max(HAND_AREA / 2 + x - HAND_CARD / 2, 0), HAND_AREA - HAND_CARD);
    const angle = Math.asin(Math.max(-1, Math.min(1, x / ARC_RADIUS)));
    if (i === hover) return { left: Math.round(left), top: LIFT.top, rot: 0, lifted: true };
    return { left: Math.round(left), top: Math.round(top0 + drop(x)), rot: +((angle * 180) / Math.PI).toFixed(2) };
  });
}

export function arcStyle({ left, top, rot }, i) {
  return `left:${left}px;top:${top}px;--rot:${rot}deg;z-index:${i + 1}`;
}

function fan(cards) {
  const spots = arcLayout(cards.length);
  return cards.map((html, i) => html.replace('<div class="card ', `<div style="${arcStyle(spots[i], i)}" data-i="${i}" class="card `)).join('');
}

function handCards(state) {
  const me = state.players.player;
  const xpStep = state.phase === 'breakfast' && state.xpStep && !me.xpChoice;
  const mulligan = state.phase === 'breakfast' && !state.xpStep && state.round === 1 && !me.pending;
  const myTurn = isMyBattleTurn(state);
  const playable = myTurn
    ? [...playablePokemon(state, 'player'), ...playableStrategies(state, 'player'), ...playableSupporters(state, 'player'),
      ...playableLocations(state, 'player')].map((c) => c.uid) : [];
  // A cost in hand turns red when it can't be paid now (Energy, or PokéDollars for Items).
  const energy = me.baseEnergy + me.exertMax - me.exhaust.length;
  const short = (c) => (c.cardType === 'Item' ? c.cost > me.dollars : (c.energyCost ?? 0) > energy);
  const hand = (c, opts = {}) => card(c, 'hand', { ...opts, cantAfford: short(c) });
  return fan(me.hand.map((c) => {
    if (mulligan) return hand(c, { selectable: true, selected: ui.mulligan.has(c.uid) });
    if (xpStep) {
      if (c.cardType !== 'Pokémon') return hand(c);
      return hand(c, { selectable: true, selected: ui.xpPick === c.uid, plan: plannedXp(c.uid) });
    }
    if (state.pending?.uid === c.uid) return hand(c, { selected: true, playable: true });
    if (ui.supporter) {
      // Paying for a Supporter: every other card can be marked Discard or Release.
      if (c.uid === ui.supporter.uid) return hand(c, { selectable: true, selected: true });
      const pay = ui.supporter.discard.includes(c.uid) ? 'discard' : ui.supporter.release.includes(c.uid) ? 'release' : null;
      return hand(c, { selectable: !ui.supporter.picking, pay });
    }
    if (ui.bag?.picking) {
      // A Held Item can go on a Pokémon in hand.
      const target = targetKeys(state).keys.has(key({ kind: 'hand', owner: 'player', uid: c.uid }));
      return hand(c, { selectable: target, selected: target });
    }
    if (myTurn && c.cardType === 'Item') {
      const buyable = openBagOptions(state, 'player').some((o) => o.mode === 'buyHand' && o.uid === c.uid);
      return hand(c, { selectable: buyable, playable: buyable, unavailable: !buyable, selected: ui.bag?.uid === c.uid });
    }
    if (myTurn && ['Pokémon', 'Strategy', 'Supporter', 'Location'].includes(c.cardType)) {
      return playable.includes(c.uid)
        ? hand(c, { selectable: true, playable: true, selected: [ui.selectedPokemon, ui.strategy, ui.location].includes(c.uid) })
        : hand(c, { unavailable: true });
    }
    return hand(c);
  }));
}

// Setup: the 3 Trainers to place, shown where the hand goes.
function trainerTray(state) {
  if (state.phase !== 'trainers' || state.players.player.pending) return '';
  const unplaced = state.players.player.trainers.filter((t) => !ui.placing.includes(t.uid));
  if (!unplaced.length) return '';
  return `<div class="tray">${fan(unplaced.map((t) => card(t, 'hand', { selectable: true, selected: ui.selectedTrainer === t.uid })))}</div>`;
}

// XP planned for a card during the XP step, before locking in.
function plannedXp(uid) {
  const plan = { attack: 0, strength: 0 };
  for (const p of ui.xpPlan) if (p.uid === uid) plan[p.stat] += 1;
  return plan;
}

function gameOverScreen(state) {
  if (state.phase !== 'gameOver') return '';
  const [title, text] = state.winner === 'player' ? ['Victory!', 'All 3 enemy Trainers are at 0 Strength.']
    : state.winner === 'ai' ? ['Defeat', 'All 3 of your Trainers are at 0 Strength.']
    : ['Draw', 'Neither player has a Pokémon left, so nobody can win.'];
  return `<div class="game-over"><div class="game-over-box ${state.winner ?? 'draw'}">
    <h2>${title}</h2><p>${text}</p><p class="hint">Round ${state.round}</p>
    <button data-action="new-game">New match</button>
  </div></div>`;
}

// --- The card component ---------------------------------------------------------
//
// Every card, of every Card-Type, uses the same layout: name and corner value,
// art window, type line, stats, text. Sizes: 'hand', 'board' and 'mini'; all
// cards of a size are exactly the same size, and long text is cut off. The
// hover preview shows the full card.

function slug(text) {
  return text.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();
}

function attr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function stateClasses({ selectable, selected, unavailable, pay, playable, cantAfford }) {
  return `${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${unavailable ? ' unavailable' : ''}${pay ? ` pay-${pay}` : ''}`
    + `${playable ? ' playable' : ''}${cantAfford ? ' cant-afford' : ''}`;
}

// Marks a hand card chosen to pay a Supporter's Card-Cost.
function payBadge({ pay }) {
  if (pay === 'discard') return '<div class="pay-badge discard">Discard</div>';
  if (pay === 'release') return '<div class="pay-badge release">Release · gone</div>';
  return '';
}

function costText({ discard, release }) {
  return [discard && `Discard ${discard}`, release && `Release ${release}`].filter(Boolean).join(', ');
}

// A Supporter's Card-Cost as icons: one per card to Discard, then one per card to Release.
function cardCostIcons({ discard, release }) {
  return `${icon('discard').repeat(discard)}${icon('release').repeat(release)}`;
}

// Weather's share of a stat, per type (shown apart from other buffs in the preview).
function weatherTags(c, stat) {
  const byType = {};
  for (const mod of Object.values(c.weather ?? {})) byType[mod.type] = (byType[mod.type] ?? 0) + (mod[stat] ?? 0);
  return Object.entries(byType).filter(([, n]) => n)
    .map(([type, n]) => `<span class="wx-tag" title="${type}">${weatherIcon(type)}${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`).join('');
}

// Weather Tokens and a Held Item, as small icon badges on the card's frame.
function frameBadges(c) {
  const weather = Object.entries(c.weatherTokens ?? {}).map(([type, n]) =>
    `<span class="frame-badge ${slug(type)}" title="${n} ${type} Weather Token${n === 1 ? '' : 's'}">${weatherIcon(type)}${n > 1 ? `<b>${n}</b>` : ''}</span>`);
  const held = c.heldItem ? [`<span class="frame-badge held" title="Held Item: ${attr(c.heldItem.name)}. ${attr(c.heldItem.effectText)}">${icon('held')}</span>`] : [];
  return [...weather, ...held];
}

// A keyword's explanation with its number filled in ("Burn X" → "Burn 2").
function keywordHelp(k) {
  const text = INNATE_POWERS[k.key] ?? '';
  return k.amount === undefined ? text : text.replace(/\bX\b/g, k.amount);
}
const keywordTags = (c) => keywordSummary(c).map((k) => `<b class="keyword" title="${attr(`${keywordLabel(k)}: ${keywordHelp(k)}`)}">${keywordLabel(k)}</b>`).join(', ');

// Keywords as chips over a board card's art (its text box is hidden at that size).
function keywordChips(c) {
  if (c.cardType !== 'Pokémon') return '';
  const chips = keywordSummary(c).map((k) => `<span class="kw-chip" title="${attr(`${keywordLabel(k)}: ${keywordHelp(k)}`)}">${keywordLabel(k)}</span>`).join('');
  return chips ? `<div class="kw-chips">${chips}</div>` : '';
}

// Burn: a flame token with its number, on Pokémon and Trainers.
function burnToken(c) {
  const n = statusCount(c, 'burn');
  if (!n) return '';
  return `<div class="burn-token" title="${attr(`Burn ${n}: takes ${n} damage at Supper, then Burn goes down by 1. Douse removes it; healing doesn't.`)}">${icon('flame')}<b>${n}</b></div>`;
}

const trend = (now, printed) => (now > printed ? 'buffed' : now < printed ? 'nerfed' : '');
const chip = (cls, text) => `<span class="chip ${cls}">${text}</span>`;
const statBadge = (cls, iconHtml, value, title) => `<span class="stat ${cls}" title="${attr(title)}">${iconHtml}${value}</span>`;

// What a card shows on its face, by Card-Type: the cost in the top-left
// corner, the type banner, the text box, the stat badges along the bottom,
// icon badges on the frame and status chips over the art.
function face(c, opts) {
  const inPlay = c.currentStrength !== undefined;
  switch (c.cardType) {
    case 'Pokémon': {
      let left;
      let right;
      if (inPlay) {
        const atk = attackOf(c);
        const max = maxStrengthOf(c);
        const hurt = c.currentStrength < max;
        left = statBadge('atk', statIcon(c.attackType), `<b class="${trend(atk, c.attackValue)}">${atk}</b>`, `${c.attackType} Attack ${atk}`);
        right = statBadge('str', statIcon(c.strengthType),
          `<b class="${hurt ? 'hurt' : trend(max, c.strengthValue)}">${c.currentStrength}</b>${hurt || max !== c.strengthValue ? `<small class="${trend(max, c.strengthValue)}">/${max}</small>` : ''}`,
          `${c.strengthType}: ${c.currentStrength} of ${max}`);
      } else {
        // XP already on the card in hand, plus any still being planned.
        const xpAtk = (c.xp?.attack ?? 0) + (opts.plan?.attack ?? 0);
        const xpStr = (c.xp?.strength ?? 0) + (opts.plan?.strength ?? 0);
        left = statBadge('atk', statIcon(c.attackType), `<b class="${xpAtk ? 'buffed' : ''}">${c.attackValue + xpAtk}</b>`, `${c.attackType} Attack${xpAtk ? ` (+${xpAtk} XP)` : ''}`);
        right = statBadge('str', statIcon(c.strengthType), `<b class="${xpStr ? 'buffed' : ''}">${c.strengthValue + xpStr}</b>`, `${c.strengthType}${xpStr ? ` (+${xpStr} XP)` : ''}`);
      }
      const speed = SPEED_TIERS[speedOf(c)];
      left += `<span class="speed${speed !== c.speedTier ? ' buffed' : ''}" title="Speed-Tier: ${speed}">${speedIcon(speed)}</span>`;
      return {
        kind: 'pokemon',
        cost: `<span class="gem-cost" title="Energy Cost">${c.energyCost}</span>`,
        type: `Pokémon · ${c.pokemonType}`,
        text: [keywordTags(c), c.effectText && `<b>${c.effectTrigger}:</b> ${c.effectText}`].filter(Boolean).join(' '),
        left,
        right,
        badges: frameBadges(c),
        status: [opts.alert && chip('alert', 'Alert'), c.spent && chip('spent', 'Spent')],
        art: [`ptype-${slug(c.pokemonType)}`, c.pokemonType],
      };
    }
    case 'Trainer': {
      const used = c.powerUsedRound === ui.state.round;
      const out = c.strength <= 0;
      return {
        kind: 'trainer',
        type: 'Trainer',
        text: `<b>Power (${c.power.cost}):</b> ${c.power.text} <b>Passive:</b> ${c.passive.text}`,
        left: statBadge('power', icon('power'), `<b>${c.power.cost}</b>`, `Power cost ${c.power.cost}`),
        right: statBadge('str', icon('hitpoints'), `<b class="${c.strength < c.maxStrength ? 'hurt' : ''}">${c.strength}</b><small>/${c.maxStrength}</small>`, `Strength ${c.strength} of ${c.maxStrength}`),
        status: [used && !out && chip('used', 'Power used'), out && chip('spent', 'Removed')],
      };
    }
    case 'Location':
      return {
        kind: 'location',
        type: 'Location',
        text: `<b>Quest:</b> ${c.quest.text} <b>Reward:</b> ${c.effectText}`,
        left: statBadge('xp', icon('xp'), `<b>${c.xp}</b>`, `XP Reward ${c.xp}`),
        right: inPlayLocation(c) ? statBadge('quest', icon('quest'), `<b>${c.progress}</b><small>/${c.quest.count}</small>`, `${c.quest.label} ${c.progress}/${c.quest.count}`) : '',
        badges: frameBadges(c),
      };
    case 'Item':
      return {
        kind: 'item',
        cost: `<span class="coin-cost" title="PokéDollar Cost">$${c.cost}</span>`,
        type: `Item · ${c.itemType}`,
        text: c.effectText,
        status: [c.inDelivery && chip('delivery', `${icon('delivery')} In Delivery`)],
      };
    case 'Strategy':
      return { kind: 'strategy', cost: `<span class="gem-cost" title="Energy Cost">${c.energyCost}</span>`, type: 'Strategy', text: c.effectText };
    case 'Supporter':
      return {
        kind: 'supporter',
        cost: `<span class="icon-cost" title="Card-Cost: ${costText(c.cardCost)}">${cardCostIcons(c.cardCost)}</span>`,
        type: 'Supporter',
        text: `${c.effectText} <b class="gift">Gift:</b> ${c.gift.challengeText} → ${c.gift.bonusText}`,
      };
    default:
      return { kind: slug(c.cardType), type: c.cardType, text: '' };
  }
}

const inPlayLocation = (c) => c.progress !== undefined;

// Card art: assets/cards/<card id>.jpg (or a card's own `image`). It is a
// background layer over the placeholder box, so a missing file just leaves
// the placeholder showing (no broken-image icon), and a file added to the
// folder later shows up without any code change.
function artUrl(c) {
  return c.image ?? `assets/cards/${c.id}.jpg`;
}

function art(c, f, extra = '') {
  const [cls, label] = f.art ?? [`${f.kind}-art`, c.cardType];
  return `<div class="card-art ${cls}"><span>${label}</span><div class="art-img" style="background-image:url('${artUrl(c)}')"></div>${extra}</div>`;
}

function cardClasses(c, f, size, opts) {
  return `card ${size} ${f.kind}${c.rarity ? ` rarity-${slug(c.rarity)}` : ''}${f.cost ? ' has-cost' : ''}${c.spent ? ' spent' : ''}${opts.willSpend ? ' will-spend' : ''}`
    + `${opts.alert ? ' alert' : ''}${c.inDelivery ? ' delivery' : ''}${stateClasses(opts)}`;
}

// The parts every card face shares, top to bottom.
function plate(c, f) {
  return `<div class="plate"><span class="card-name">${c.name}</span></div>${f.cost ? `<div class="cost">${f.cost}</div>` : ''}`;
}

function statRow(c, f) {
  return `<div class="stat-row"><span class="stat-left">${f.left ?? ''}</span>`
    + `${c.rarity ? `<span class="gem" title="${c.rarity}"></span>` : ''}<span class="stat-right">${f.right ?? ''}</span></div>`;
}

function card(c, size, opts = {}) {
  const f = face(c, opts);
  const pv = previews.push({ c, opts }) - 1;
  const head = `class="${cardClasses(c, f, size, opts)}" data-uid="${c.uid}" data-pv="${pv}"`;
  if (size === 'mini') return `<div ${head}>${plate(c, f)}${art(c, f)}</div>`;
  const badges = (f.badges ?? []).filter(Boolean).join('');
  const status = (f.status ?? []).filter(Boolean).join('');
  return `<div ${head}>
    ${payBadge(opts)}${plate(c, f)}
    ${art(c, f, `${badges ? `<div class="frame-badges">${badges}</div>` : ''}${size === 'board' ? keywordChips(c) : ''}${burnToken(c)}${status ? `<div class="status-chips">${status}</div>` : ''}`)}
    <div class="type-banner">${f.type}</div>
    <div class="text-box">${f.text}</div>
    ${statRow(c, f)}
  </div>`;
}

// --- Hover preview: the full card, every field, current stats ---------------------

// "+1 XP, +2 Passive, ☔+1 Weather" — where a stat's change from print comes from.
function sources(c, stat) {
  const parts = [];
  const add = (n, label) => { if (n) parts.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ${label}`); };
  add(stat === 'attack' ? c.attackBonus : c.strengthBonus, 'buffs and XP');
  add(Object.values(c.aura ?? {}).reduce((s, b) => s + (b[stat] ?? 0), 0), 'Trainer Passive');
  if (weatherTotal(c, stat)) parts.push(`${weatherTags(c, stat)} Weather`);
  add(heldBonus(c, stat), 'Held Item');
  return parts.length ? ` <span class="muted">(printed ${stat === 'attack' ? c.attackValue : c.strengthValue}: ${parts.join(', ')})</span>` : '';
}

function detailLines(c, opts) {
  const row = (label, value) => (value || value === 0 ? `<div class="pv-row"><span class="pv-label">${label}</span><span>${value}</span></div>` : '');
  const inPlay = c.currentStrength !== undefined;
  switch (c.cardType) {
    case 'Pokémon': {
      const xpAtk = (c.xp?.attack ?? 0) + (opts.plan?.attack ?? 0);
      const xpStr = (c.xp?.strength ?? 0) + (opts.plan?.strength ?? 0);
      const speed = SPEED_TIERS[speedOf(c)];
      return [
        row('Energy Cost', c.energyCost),
        row('Attack', inPlay ? `${statIcon(c.attackType)} ${c.attackType} <b>${attackOf(c)}</b>${sources(c, 'attack')}`
          : `${statIcon(c.attackType)} ${c.attackType} <b>${c.attackValue + xpAtk}</b>${xpAtk ? ` <span class="xp-tag">(+${xpAtk} XP)</span>` : ''}`),
        row('Strength', inPlay ? `${statIcon(c.strengthType)} ${c.strengthType} <b>${c.currentStrength}</b> / ${maxStrengthOf(c)}${sources(c, 'strength')}`
          : `${statIcon(c.strengthType)} ${c.strengthType} <b>${c.strengthValue + xpStr}</b>${xpStr ? ` <span class="xp-tag">(+${xpStr} XP)</span>` : ''}`),
        row('Speed-Tier', `${speedIcon(speed)} ${speed === c.speedTier ? speed : `${speed} <span class="muted">(printed ${c.speedTier}, raised by Held Item)</span>`}`),
        ...keywordSummary(c).map((k, i) => row(i ? '' : 'Innate Power', `<b class="keyword">${keywordLabel(k)}</b> ${keywordHelp(k)}`)),
        statusCount(c, 'burn') && row('Burn', `${icon('flame')} <b>${statusCount(c, 'burn')}</b>: takes that much damage at Supper, then Burn goes down by 1.`),
        c.effectText && row(c.effectTrigger, c.effectText),
        c.weatherTokens && row('Weather', weatherText(c.weatherTokens)),
        c.heldItem && row('Held Item', `${icon('held')} <b>${c.heldItem.name}</b> ${c.heldItem.effectText}`),
        inPlay && row('Status', [c.spent ? 'Spent' : 'Active', opts.alert && 'Alert: can attack now'].filter(Boolean).join(' · ')),
      ];
    }
    case 'Trainer': {
      const used = c.powerUsedRound === ui.state.round;
      return [
        row('Strength', c.strength <= 0 ? 'Removed (0 Strength)' : `<b>${c.strength}</b> / ${c.maxStrength}`),
        row(`Power (${c.power.cost})`, `${c.power.text}${used ? ' <i class="used">Used this Round</i>' : ''}`),
        row('Passive', c.passive.text),
        statusCount(c, 'burn') && row('Burn', `${icon('flame')} <b>${statusCount(c, 'burn')}</b>: takes that much damage at Supper, then Burn goes down by 1.`),
      ];
    }
    case 'Location':
      return [
        row('Quest', c.quest.text),
        inPlayLocation(c) && row('Progress', `${c.quest.label} <b>${c.progress}/${c.quest.count}</b>`),
        row('XP Reward', `${c.xp} XP`),
        row('Reward', c.effectText),
        c.weatherTokens && row('Weather', weatherText(c.weatherTokens)),
      ];
    case 'Item':
      return [row('Item type', c.itemType), row('Price', `$${c.cost}`), row('Effect', c.effectText),
        c.inDelivery && row('Status', 'In Delivery: usable from next Breakfast')];
    case 'Strategy':
      return [row('Energy Cost', c.energyCost), row('Effect', c.effectText)];
    case 'Supporter':
      return [row('Card-Cost', `${cardCostIcons(c.cardCost)} ${costText(c.cardCost)}`), row('Effect', c.effectText),
        row('Gift Challenge', c.gift.challengeText), row('Gift Bonus', c.gift.bonusText)];
    default:
      return [];
  }
}

// The large preview: the same card face, with every field written out on the parchment.
function detail({ c, opts }) {
  const f = face(c, opts);
  const badges = (f.badges ?? []).filter(Boolean).join('');
  return `<div class="${cardClasses(c, f, 'full', {})}">
    ${plate(c, f)}
    ${art(c, f, badges ? `<div class="frame-badges">${badges}</div>` : '')}
    <div class="type-banner">${[f.type, c.rarity].filter(Boolean).join(' · ')}</div>
    <div class="text-box pv-lines">${detailLines(c, opts).filter(Boolean).join('')}</div>
    ${statRow(c, f)}
  </div>`;
}

// Shows the preview beside the hovered card, inside the stage, without moving anything.
function showPreview(root, el) {
  const box = root.querySelector('.preview');
  const entry = el.dataset.hist !== undefined ? history[Number(el.dataset.hist)] : null;
  box.innerHTML = `${entry ? `<div class="pv-caption ${entry.who}">${attr(entry.text)}</div>` : ''}${el.dataset.pv ? detail(previews[Number(el.dataset.pv)]) : ''}`;
  box.hidden = false;
  const stage = root.getBoundingClientRect();
  const scale = stage.width / STAGE.width;
  const r = el.getBoundingClientRect();
  const x = (r.left - stage.left) / scale;
  const y = (r.top - stage.top) / scale;
  const w = r.width / scale;
  const h = r.height / scale;
  const pw = box.offsetWidth;
  const ph = box.offsetHeight;
  let left = x + w + 14;
  if (left + pw > STAGE.width - 8) left = x - pw - 14;
  const top = Math.min(Math.max(8, y + h / 2 - ph / 2), STAGE.height - ph - 8);
  box.style.left = `${Math.max(8, left)}px`;
  box.style.top = `${top}px`;
}

// --- Prompt and buttons -----------------------------------------------------------
//
// What to do now (hint), smaller choices (secondary), and the one big main
// action button, which is always on screen.

const button = (action, label, { disabled = false, cls = '', extra = '' } = {}) => `<button data-action="${action}"${extra}${cls ? ` class="${cls}"` : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
// The main action: a brass medallion whose label always says what will
// happen (main word, then a detail), with its keyboard shortcut.
const medal = (main, sub) => `<span class="m-main">${main}</span>${sub ? `<span class="m-sub">${sub}</span>` : ''}`;
const primary = (action, main, sub = '', disabled = false) => `<button data-action="${action}" class="primary" title="${attr(sub ? `${main} (${sub})` : main)} · Space"${disabled ? ' disabled' : ''}>${medal(main, sub)}<kbd>Space</kbd></button>`;
const idle = (main, sub = '') => `<button class="primary" disabled>${medal(main, sub)}</button>`;
const waiting = {
  get hint() { return `<b class="prompt-caption">${attr(caption)}</b><p class="muted">Waiting for the opponent…</p>`; },
  secondary: '',
  primary: idle('Waiting…'),
};

// In a simultaneous step: both players choose at once; this says whether the opponent has locked in.
function together(state, what, ready) {
  return `<b>${what}</b> — the opponent is choosing too.
    <div class="sim-status${ready ? ' ready' : ''}">${ready ? 'Opponent ready ✓' : '<i class="dots"></i>Opponent choosing…'}</div>`;
}

function controls(state) {
  const me = state.players.player;
  // An ability waiting for my target, in any phase.
  if (state.pending?.who === 'player' && state.pending.kind === 'target') {
    return { hint: `<b>${state.pending.label}:</b> ${state.pending.text ?? ''} Choose a highlighted target.`, secondary: '', primary: idle('Choose', 'a target') };
  }
  switch (state.phase) {
    case 'trainers': {
      if (me.pending) return waiting;
      const ready = ui.placing.every(Boolean);
      return {
        hint: `${together(state, 'Choose your Trainers', Boolean(state.players.ai.pending))}
          <p>Drag (or click) a Trainer from the bottom of the screen to one of your Trainer Spaces. Click a placed Trainer to take it back.</p>`,
        secondary: '', primary: primary('lock-trainers', 'Lock in', 'Trainers', !ready),
      };
    }
    case 'initiative':
      return { hint: 'Flip a coin to decide who has initiative.', secondary: '', primary: primary('flip', 'Flip', 'coin') };
    case 'breakfast': {
      if (state.xpStep) {
        if (me.xpChoice) return waiting;
        const left = me.xp - ui.xpPlan.length;
        const pick = ui.xpPick && me.hand.find((c) => c.uid === ui.xpPick);
        return {
          hint: `${together(state, 'Spend your XP', Boolean(state.players.ai.xpChoice))}
            <p>${left} of ${me.xp} XP left: each point gives a Pokémon in hand +1 Attack or +1 Strength. ${pick ? `<b>${pick.name}</b> picked.` : 'Click a Pokémon in your hand.'}</p>`,
          secondary: `${pick ? `${button('xp-attack', '+1 Attack', { disabled: !left })}${button('xp-strength', '+1 Strength', { disabled: !left })}` : ''}
            ${button('xp-undo', 'Undo', { disabled: !ui.xpPlan.length, cls: 'secondary' })}`,
          primary: primary('xp-lock', 'Confirm XP', ui.xpPlan.length ? `spend ${ui.xpPlan.length}` : 'keep it all'),
        };
      }
      if (me.pending) return waiting;
      const n = ui.mulligan.size;
      return {
        hint: `${together(state, 'Mulligan', Boolean(state.players.ai.pending))}
          <p>Click cards in your hand to mark them, then swap them, or keep your hand.</p>`,
        secondary: '', primary: n ? primary('mulligan', `Mulligan ${n}`, `swap ${n} card${n === 1 ? '' : 's'}`) : primary('mulligan', 'Keep hand'),
      };
    }
    case 'battle': {
      if (state.pending?.who === 'player' && state.pending.kind === 'freeSummon') {
        const c = me.hand.find((h) => h.uid === state.pending.uid);
        return { hint: `Ash drew <b>${c.name}</b>: click a highlighted space to summon it for free, or keep it.`, secondary: '', primary: primary('keep-card', 'Keep', 'in hand') };
      }
      if (state.turn !== 'player' || state.pending) return waiting;
      if (ui.bag) {
        const cancel = button('cancel-bag', 'Cancel', { cls: 'secondary' });
        const opts = openBagOptions(state, 'player');
        const has = (mode) => opts.some((o) => o.mode === mode);
        const item = bagItem(state);
        if (ui.bag.picking) {
          const where = item.itemType === 'Held' ? ' (a Pokémon in the arena, or one in your hand)' : '';
          return { hint: `<b>${item.name}</b>: click a highlighted target${where}.`, secondary: cancel, primary: idle('Choose', 'a target') };
        }
        if (ui.bag.mode === 'buyHand' && item) {
          const can = (then) => opts.some((o) => o.uid === item.uid && o.then === then);
          return {
            hint: `Buy <b>${item.name}</b> for $${item.cost}, then use it now or store it in your Bag.`,
            secondary: `${button('bag-use', 'Use now', { disabled: !can('use') })}${button('bag-store', 'Store in Bag', { disabled: !can('store') })}${cancel}`,
            primary: idle('Choose', 'above'),
          };
        }
        const hints = { buyHand: 'Click an Item in your hand to buy it.', buyMart: 'Click an Item in the PokéMart to buy it (In Delivery until next Breakfast).', useBag: 'Click an Item in your Bag to use it.' };
        if (ui.bag.mode) return { hint: hints[ui.bag.mode], secondary: cancel, primary: idle('Choose', 'an Item') };
        return {
          hint: `<b>Open Bag</b> ($${me.dollars}): choose one.`,
          secondary: `${button('bag-mode', 'Buy from hand', { disabled: !has('buyHand'), extra: ' data-mode="buyHand"' })}
            ${button('bag-mode', 'Buy from PokéMart', { disabled: !has('buyMart'), extra: ' data-mode="buyMart"' })}
            ${button('bag-mode', 'Use from Bag', { disabled: !has('useBag'), extra: ' data-mode="useBag"' })}${cancel}`,
          primary: idle('Choose', 'above'),
        };
      }
      const paying = supporterChoice(state);
      if (paying) {
        const { card: c, exact, gift } = paying;
        const cancel = button('cancel-supporter', 'Cancel', { cls: 'secondary' });
        if (ui.supporter.picking) return { hint: `<b>${c.name}</b>: click a highlighted target.`, secondary: cancel, primary: idle('Choose', 'a target') };
        const counts = [c.cardCost.discard && `Discard ${ui.supporter.discard.length}/${c.cardCost.discard}`,
          c.cardCost.release && `<span class="release-count">Release ${ui.supporter.release.length}/${c.cardCost.release}</span>`].filter(Boolean).join(' · ');
        return {
          hint: `<b>${c.name}</b>: click hand cards to pay (click again: Discard → Release → none).<br>${counts}<br>
            Gift (${c.gift.challengeText}): <span class="gift-status ${gift ? 'met' : ''}">${gift ? '✓ met' : 'not met'}</span>`,
          secondary: cancel, primary: primary('confirm-supporter', 'Confirm', c.name, !exact),
        };
      }
      // What passing will do: +1 Base Energy, or end the phase after the opponent's Pass.
      const spends = passSpends(state, 'player').length;
      const passSub = passEndsPhase(state) ? 'end Battle'
        : spends ? `+${PASS_ENERGY} Energy, spends ${spends} Pokémon` : `+${PASS_ENERGY} Energy`;
      const passLabel = `Pass (${passSub})`;
      const pass = primary('pass', 'Pass', passSub);
      if (ui.power !== null) {
        const t = me.zones[ui.power].trainer;
        if (powerTargets(state, 'player', ui.power).length) {
          return { hint: `<b>${t.name}'s Power:</b> click a highlighted target, or click ${t.name} again to cancel.`, secondary: '', primary: pass };
        }
        return {
          hint: `<b>${t.name}'s Power:</b> ${t.power.text}`,
          secondary: button('pass', passLabel, { cls: 'secondary' }), primary: primary('use-power', 'Use Power', `${t.name} · ${t.power.cost} Energy`),
        };
      }
      const strategy = ui.strategy && me.hand.find((c) => c.uid === ui.strategy);
      const hint = ui.location ? 'Click one of your highlighted Location spaces (playing on a Location replaces it), or click the card again to cancel.'
        : ui.selectedPokemon ? 'Click a highlighted empty space to play it, or click the card again to cancel.'
        : ui.attacker ? 'Click a highlighted enemy Pokémon or Trainer to attack, or click your Pokémon again to cancel.'
          : strategy ? `<b>${strategy.name}</b>: click a highlighted target, or click the card again to cancel.`
            : '<b>Your turn.</b> Play a card from your hand, attack with an Alert Pokémon, use a Trainer Power, or Pass.';
      const openBag = openBagOptions(state, 'player').length ? button('open-bag', 'Open Bag', { cls: 'secondary' }) : '';
      return { hint, secondary: openBag, primary: pass };
    }
    case 'gameOver':
      return {
        hint: `<b>${state.winner ? `${state.players[state.winner].name} ${state.winner === 'player' ? 'win' : 'wins'}!` : 'Draw.'}</b>`,
        secondary: '', primary: primary('new-game', 'New match'),
      };
    default:
      return waiting;
  }
}

// --- Passing with unmatched speed -------------------------------------------------------

const listNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// The warning to show before I pass, when the Pass would make my top-speed
// Pokémon Spent (the opponent can't match their speed); null otherwise.
export function passWarning(state) {
  if (state.phase !== 'battle' || state.turn !== 'player' || state.pending) return null;
  const refs = passSpends(state, 'player');
  if (!refs.length) return null;
  const names = listNames(refs.map((r) => r.name));
  return {
    refs,
    text: `Passing now will make ${names} Spent this Round, because the opponent can't match ${refs.length === 1 ? 'its' : 'their'} speed.`,
  };
}

function passWarningBox(state) {
  const w = ui.passWarn && passWarning(state);
  if (!w) return '';
  return `<div class="pass-warn" role="dialog" aria-label="Pass warning">
    <p>${w.text}</p>
    <p class="muted">You still gain +${PASS_ENERGY} Base Energy. Cancel to attack with ${w.refs.length === 1 ? 'it' : 'them'} first.</p>
    <div class="pass-warn-buttons">
      <button data-action="cancel-pass" class="secondary">Cancel</button>
      <button data-action="pass-anyway">Pass anyway</button>
    </div>
  </div>`;
}

// --- Cost previews ------------------------------------------------------------------
//
// Hovering (or dragging) anything that costs Energy shows on my Energy
// crystals what it would spend: Base Energy first (those crystals flicker),
// then Exert (glowing amber, "+1 Exhaust"), or why it can't be paid.

function costOf(state, focus) {
  const p = state.players.player;
  if (focus.power !== undefined) {
    const t = p.zones[focus.power]?.trainer;
    return t && t.strength > 0 ? t.power.cost : null;
  }
  const c = p.hand.find((h) => h.uid === focus.uid);
  return c && (c.cardType === 'Pokémon' || c.cardType === 'Strategy') ? c.energyCost : null;
}

function applyCost(root, state) {
  const box = root.querySelector('[data-pile="player-energy"]');
  const exert = root.querySelector('[data-pile="player-exert"]');
  if (!box || !exert) return;
  box.classList.remove('previewing', 'short');
  exert.classList.remove('previewing', 'short');
  root.querySelectorAll('.res.player .spend, .res.player .spend-exert').forEach((c) => c.classList.remove('spend', 'spend-exert'));
  const note = box.querySelector('.cost-note');
  note.textContent = '';
  const cost = ui.costFocus && state.phase === 'battle' ? costOf(state, ui.costFocus) : null;
  if (cost === null || cost === undefined) return;
  const p = state.players.player;
  const free = p.exertMax - p.exhaust.length;
  box.classList.add('previewing');
  exert.classList.add('previewing');
  if (cost > p.baseEnergy + free) {
    box.classList.add('short');
    exert.classList.add('short');
    note.textContent = `Costs ${cost}: only ${p.baseEnergy} Base + ${free} Exert`;
    return;
  }
  const fromBase = Math.min(cost, p.baseEnergy);
  const fromExert = cost - fromBase;
  // The crystals it would spend flicker: the rightmost unspent ones (extra crystals first).
  const unspent = [...box.querySelectorAll('.crystal.lit'), ...box.querySelectorAll('.crystal.bonus')];
  unspent.slice(unspent.length - Math.min(fromBase, unspent.length)).forEach((c) => c.classList.add('spend'));
  const gems = [...exert.querySelectorAll('.xgem.free')];
  if (fromExert) gems.slice(gems.length - fromExert).forEach((c) => c.classList.add('spend-exert'));
  note.textContent = cost === 0 ? 'Free' : fromExert ? `−${fromBase} Base · +${fromExert} Exhaust` : `−${fromBase} Base Energy`;
  if (fromExert) note.classList.add('exert'); else note.classList.remove('exert');
}

function wireCostPreview(root, state) {
  let current = null;
  const keyOf = (f) => (f ? JSON.stringify(f) : '');
  root.onmouseover = (e) => {
    const handCard = e.target.closest('.hand > .card');
    const trainer = e.target.closest('.player .trainer-space');
    const focus = handCard ? { uid: handCard.dataset.uid }
      : trainer?.querySelector('.card') ? { power: Number(trainer.dataset.zone) } : null;
    if (keyOf(focus) === current) return;
    current = keyOf(focus);
    ui.costFocus = focus;
    applyCost(root, state);
  };
}

// A brief ring around what I could still do (when I pass anyway).
function remind(root) {
  const can = [...root.querySelectorAll('.hand > .card.playable, .player .pokemon-space .card.selectable, '
    + '.player .trainer-space .card.selectable, .player .bag-slot.usable')].slice(0, 10);
  const fx = document.getElementById('fx');
  if (!can.length || !fx) return;
  const stage = document.getElementById('stage').getBoundingClientRect();
  const scale = stage.width / STAGE.width;
  for (const el of can) {
    const r = el.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'fx-remind fx-keep';
    Object.assign(ring.style, {
      left: `${(r.left - stage.left) / scale - 5}px`, top: `${(r.top - stage.top) / scale - 5}px`,
      width: `${r.width / scale + 10}px`, height: `${r.height / scale + 10}px`,
    });
    ring.addEventListener('animationend', () => ring.remove());
    fx.append(ring);
  }
}

// Space: the main action, whenever it is enabled and nothing else is going on.
let spaceInstalled = false;
function installSpace() {
  if (spaceInstalled) return;
  spaceInstalled = true;
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    const stage = document.getElementById('stage');
    if (stage.classList.contains('locked') || !document.getElementById('inspect')?.hidden || document.querySelector('.pass-warn')) return;
    document.querySelector('#app .side-panel button.primary:not(:disabled)')?.click();
  });
}

// --- Clicks -----------------------------------------------------------------

// Using Exert has a recovery cost, so it needs a yes first.
function confirmExert(fromExert) {
  return !fromExert || confirm(`This will use ${fromExert} Exert. Exert takes Rounds to recover. Go ahead?`);
}

function wire(root, state, actions) {
  const { dispatch, newGame } = actions;
  const redraw = () => render(root, state, actions);
  const on = (selector, fn) => root.querySelectorAll(selector).forEach((el) => { el.onclick = () => fn(el); });

  // Hover preview for every card on screen except my hand (a hovered hand card lifts instead).
  const box = root.querySelector('.preview');
  root.querySelectorAll('[data-pv], .hist').forEach((el) => {
    if (el.closest('.hand, .tray')) return;
    el.onmouseenter = () => showPreview(root, el);
    el.onmouseleave = () => { box.hidden = true; };
  });

  on('[data-action="toggle-log"]', () => { logOpen = !logOpen; redraw(); });
  // The settings menu updates in place (it works while actions are playing out).
  const menu = root.querySelector('.settings');
  on('[data-action="settings"]', () => { settingsOpen = !settingsOpen; menu.hidden = !settingsOpen; });
  on('[data-speed]', (el) => {
    setSpeed(el.dataset.speed);
    settingsOpen = false;
    menu.hidden = true;
    root.querySelectorAll('[data-speed]').forEach((b) => { b.className = b === el ? 'chosen' : 'secondary'; });
    root.querySelector('[data-action="settings"]').textContent = `⚙ ${SPEEDS[getSpeed()].label}`;
  });
  on('[data-action="new-game"]', () => { pileView = null; newGame(); });
  // Looking through a Discard or Released Pile; the backdrop or Close shuts it.
  on('[data-pile-view]', (el) => {
    const [who, kind] = el.dataset.pileView.split(':');
    pileView = { who, kind };
    redraw();
  });
  root.querySelectorAll('[data-action="close-pile"]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target !== el) return;
      pileView = null;
      redraw();
    };
  });
  on('[data-action="flip"]', () => dispatch({ type: 'flipCoin' }));
  on('[data-action="lock-trainers"]', () => dispatch({ type: 'assignTrainers', who: 'player', order: [...ui.placing] }));
  // Passing is never blocked, but a brief ring shows anything I could still have done.
  // A Pass with unmatched speed would make Pokémon Spent: ask first.
  on('[data-action="pass"]', () => {
    if (passWarning(state) && !ui.passWarn) {
      clearSelection();
      ui.passWarn = true;
      redraw();
      return;
    }
    remind(root);
    dispatch({ type: 'pass', who: 'player' });
  });
  on('[data-action="pass-anyway"]', () => dispatch({ type: 'pass', who: 'player' }));
  on('[data-action="cancel-pass"]', () => { ui.passWarn = false; redraw(); });
  on('[data-action="mulligan"]', () => dispatch({ type: 'mulligan', who: 'player', cardUids: [...ui.mulligan] }));
  on('[data-action="keep-card"]', () => dispatch({ type: 'resolveChoice', who: 'player' }));

  // XP step: plan points on Pokémon in hand, undo, then lock in.
  const planXp = (stat) => { ui.xpPlan.push({ uid: ui.xpPick, stat }); redraw(); };
  on('[data-action="xp-attack"]', () => planXp('attack'));
  on('[data-action="xp-strength"]', () => planXp('strength'));
  on('[data-action="xp-undo"]', () => { ui.xpPlan.pop(); redraw(); });
  on('[data-action="xp-lock"]', () => dispatch({ type: 'spendXp', who: 'player', spend: [...ui.xpPlan] }));

  // Location: pick the card, then one of your Location spaces.
  on('.player .location-space.target', (el) => {
    const zone = Number(el.dataset.zone);
    const old = state.players.player.zones[zone].location;
    if (old && !confirm(`Replace ${old.name}? It goes to your Discard Pile and its quest progress (${old.progress}/${old.quest.count}) is lost.`)) return;
    dispatch({ type: 'playLocation', who: 'player', uid: ui.location, zone });
  });

  // Trainer placement: select from the tray, then click a space. Click a placed one to take it back.
  on('.tray .card', (el) => {
    ui.selectedTrainer = ui.selectedTrainer === el.dataset.uid ? null : el.dataset.uid;
    redraw();
  });
  on('.player .trainer-space.target', (el) => {
    const zone = Number(el.dataset.zone);
    if (ui.selectedTrainer) {
      ui.placing[zone] = ui.selectedTrainer;
      ui.selectedTrainer = null;
    } else if (ui.placing[zone]) {
      ui.placing[zone] = null;
    }
    redraw();
  });

  // Hand clicks: mark for mulligan in Breakfast; in Battle, pick a Pokémon to
  // play, or play a Strategy Card (straight away, or after picking a target).
  on('.hand .card.selectable', (el) => {
    const uid = el.dataset.uid;
    const c = state.players.player.hand.find((h) => h.uid === uid);
    if (ui.bag?.picking) {
      dispatchBag({ kind: 'hand', owner: 'player', uid });
      return;
    }
    if (state.phase === 'breakfast' && state.xpStep) {
      ui.xpPick = ui.xpPick === uid ? null : uid;
    } else if (state.phase === 'breakfast') {
      ui.mulligan.has(uid) ? ui.mulligan.delete(uid) : ui.mulligan.add(uid);
    } else if (ui.supporter) {
      // Paying: the Supporter itself cancels; other cards cycle Discard → Release → none.
      if (uid === ui.supporter.uid) {
        ui.supporter = null;
      } else {
        const sup = state.players.player.hand.find((h) => h.uid === ui.supporter.uid);
        const { discard, release } = ui.supporter;
        const room = (list, n) => list.length < n;
        if (discard.includes(uid)) {
          discard.splice(discard.indexOf(uid), 1);
          if (room(release, sup.cardCost.release)) release.push(uid);
        } else if (release.includes(uid)) {
          release.splice(release.indexOf(uid), 1);
        } else if (room(discard, sup.cardCost.discard)) {
          discard.push(uid);
        } else if (room(release, sup.cardCost.release)) {
          release.push(uid);
        }
      }
    } else if (c.cardType === 'Item') {
      // Buy from hand: then Use now or Store in Bag.
      const again = ui.bag?.uid === uid;
      clearSelection();
      ui.bag = again ? null : { mode: 'buyHand', uid };
    } else if (c.cardType === 'Location') {
      const again = ui.location === uid;
      clearSelection();
      ui.location = again ? null : uid;
    } else if (c.cardType === 'Supporter') {
      clearSelection();
      ui.supporter = { uid, discard: [], release: [], picking: false };
    } else if (c.cardType === 'Strategy') {
      const again = ui.strategy === uid;
      clearSelection();
      if (!again && !strategyTargets(state, 'player', uid).length) {
        if (confirmExert(costPreview(state, 'player', uid).fromExert)) dispatch({ type: 'playStrategy', who: 'player', uid });
        return;
      }
      ui.strategy = again ? null : uid;
    } else {
      const again = ui.selectedPokemon === uid;
      clearSelection();
      ui.selectedPokemon = again ? null : uid;
    }
    redraw();
  });

  // Supporter: Confirm the payment, then pick a target if it needs one.
  const playSupporter = (target) => {
    const { uid, discard, release } = ui.supporter;
    dispatch({ type: 'playSupporter', who: 'player', uid, discard: [...discard], release: [...release], target });
  };
  on('[data-action="cancel-supporter"]', () => { ui.supporter = null; redraw(); });
  on('[data-action="confirm-supporter"]', () => {
    if (supporterTargets(state, 'player', ui.supporter.uid).length) {
      ui.supporter.picking = true;
      redraw();
    } else {
      playSupporter(undefined);
    }
  });
  on('.zone.zone-target', (el) => playSupporter({ kind: 'zone', owner: el.dataset.owner, zone: Number(el.dataset.zone) }));

  // Open Bag: choose a mode, then an Item, then (to use it) a target.
  const dispatchBag = (target) => {
    const { mode, uid, then } = ui.bag;
    dispatch({ type: 'openBag', who: 'player', mode, uid, then, target });
  };
  // Using an Item: pick a target if it needs one, otherwise go straight away.
  const useNow = () => {
    if (bagItem(state).effects.some((e) => e.target?.mode === 'targeted')) {
      ui.bag.picking = true;
      redraw();
    } else {
      dispatchBag(undefined);
    }
  };
  on('[data-action="open-bag"]', () => { clearSelection(); ui.bag = { mode: null }; redraw(); });
  on('[data-action="cancel-bag"]', () => { ui.bag = null; redraw(); });
  on('[data-action="bag-mode"]', (el) => { ui.bag = { mode: el.dataset.mode }; redraw(); });
  on('[data-action="bag-store"]', () => { ui.bag.then = 'store'; dispatchBag(undefined); });
  on('[data-action="bag-use"]', () => { ui.bag.then = 'use'; useNow(); });
  on('.mart-item.buyable', (el) => dispatch({ type: 'openBag', who: 'player', mode: 'buyMart', slot: Number(el.dataset.slot) }));
  on('.player .bag-slot.usable', (el) => {
    clearSelection();
    ui.bag = { mode: 'useBag', uid: el.dataset.uid };
    useNow();
  });

  // Command: pick one of your Alert Pokémon, then a highlighted target.
  // (While a Power is picking a target, a click on a target card goes to the Power.)
  on('.player .pokemon-space .card.selectable', (el) => {
    if (el.closest('.power-target')) return;
    const space = el.closest('.pokemon-space');
    const from = { zone: Number(space.dataset.zone), space: Number(space.dataset.space) };
    const again = ui.attacker?.zone === from.zone && ui.attacker?.space === from.space;
    clearSelection();
    ui.attacker = again ? null : from;
    redraw();
  });

  // Trainer Power: pick your Trainer, then a highlighted target (or "Use Power").
  on('.player .trainer-space .card.selectable', (el) => {
    if (el.closest('.power-target')) return;
    const zone = Number(el.closest('.trainer-space').dataset.zone);
    const again = ui.power === zone;
    clearSelection();
    ui.power = again ? null : zone;
    redraw();
  });
  const usePower = (target) => {
    if (!confirmExert(costPreview(state, 'player', { power: ui.power }).fromExert)) return;
    dispatch({ type: 'usePower', who: 'player', zone: ui.power, target });
  };
  on('[data-action="use-power"]', () => usePower(undefined));

  // Clicking a highlighted target: an attack, a Power's target, or a Strategy Card's.
  on('.attack-target, .power-target', (el) => {
    const zone = Number(el.dataset.zone);
    const isTrainer = el.classList.contains('trainer-space');
    const owner = el.dataset.owner;
    const ref = isTrainer ? { kind: 'trainer', owner, zone } : { kind: 'pokemon', owner, zone, space: Number(el.dataset.space) };
    if (state.pending?.kind === 'target') {
      dispatch({ type: 'resolveChoice', who: 'player', target: ref });
    } else if (ui.attacker) {
      const target = isTrainer ? { kind: 'trainer', zone } : { kind: 'pokemon', zone, space: Number(el.dataset.space) };
      dispatch({ type: 'command', who: 'player', from: ui.attacker, target });
    } else if (ui.power !== null) {
      usePower(ref);
    } else if (ui.strategy) {
      if (!confirmExert(costPreview(state, 'player', ui.strategy).fromExert)) return;
      dispatch({ type: 'playStrategy', who: 'player', uid: ui.strategy, target: ref });
    } else if (ui.supporter?.picking) {
      playSupporter(ref);
    } else if (ui.bag?.picking) {
      dispatchBag(ref);
    }
  });

  // Empty spaces: play the selected Pokémon, or take Ash's free summon.
  on('.player .pokemon-space.target', (el) => {
    const zone = Number(el.dataset.zone);
    const space = Number(el.dataset.space);
    if (state.pending?.kind === 'freeSummon') {
      dispatch({ type: 'resolveChoice', who: 'player', zone, space });
      return;
    }
    const uid = ui.selectedPokemon;
    if (!confirmExert(costPreview(state, 'player', uid).fromExert)) return;
    dispatch({ type: 'playPokemon', who: 'player', uid, zone, space });
  });

  wireCostPreview(root, state);
  installSpace();

  // Drag to play, targeting arrows and inspection (interact.js) work through
  // the same choices and click handlers as above.
  wireInteractions(root, {
    dragPlan: (el) => dragPlan(state, el, { redraw, dispatch, dispatchBag, usePower }),
    arrowSource: () => arrowSource(state),
    outcome: (el) => outcome(state, el),
    inspect: (el) => inspectView(previews[Number(el.dataset.pv)]),
    selecting: () => Boolean(pileView || ui.passWarn || ui.attacker || ui.power !== null || ui.strategy || ui.location || ui.selectedPokemon
      || ui.bag || ui.supporter || ui.selectedTrainer),
    cancel: () => { pileView = null; clearSelection(); ui.selectedTrainer = null; ui.costFocus = null; redraw(); },
  });
}

// --- Drag to play ------------------------------------------------------------------
//
// What dragging a card does, as a plan for interact.js:
//   kind     'card' (the card follows the cursor) or 'arrow' (a targeting arrow from it)
//   prepare  makes the same choice a click would, so valid destinations glow
//   arena    for untargeted plays: what releasing over the arena does
//   bag      for Items: what releasing over my Bag does
//   source   the element a targeting arrow starts from
// Releasing over a glowing destination clicks it, so every confirmation
// (Exert, Supporter payment, replacing a Location) still appears.
function dragPlan(state, el, { redraw, dispatch, dispatchBag, usePower }) {
  const uid = el.dataset.uid;
  const me = state.players.player;
  const pick = (fn) => () => { clearSelection(); ui.selectedTrainer = null; fn(); redraw(); };
  const source = () => cardEls.get(uid);
  if (state.phase === 'gameOver') return null;
  if (el.closest('.tray')) return { kind: 'card', prepare: () => { ui.selectedTrainer = uid; redraw(); } };

  if (el.closest('.hand')) {
    if (state.pending?.who === 'player' && state.pending.kind === 'freeSummon' && state.pending.uid === uid) return { kind: 'card' };
    if (!isMyBattleTurn(state) || ui.supporter || !el.classList.contains('selectable')) return null;
    const c = me.hand.find((h) => h.uid === uid);
    if (c.cardType === 'Pokémon') return { kind: 'card', prepare: pick(() => { ui.selectedPokemon = uid; }) };
    if (c.cardType === 'Location') return { kind: 'card', prepare: pick(() => { ui.location = uid; }) };
    if (c.cardType === 'Strategy') {
      if (strategyTargets(state, 'player', uid).length) return { kind: 'arrow', source, prepare: pick(() => { ui.strategy = uid; }) };
      return {
        kind: 'card',
        arena: () => {
          if (confirmExert(costPreview(state, 'player', uid).fromExert)) dispatch({ type: 'playStrategy', who: 'player', uid });
        },
      };
    }
    if (c.cardType === 'Supporter') {
      return { kind: 'card', arena: pick(() => { ui.supporter = { uid, discard: [], release: [], picking: false }; }) };
    }
    if (c.cardType === 'Item') {
      const options = openBagOptions(state, 'player').filter((o) => o.mode === 'buyHand' && o.uid === uid);
      const canUse = options.some((o) => o.then === 'use');
      const targeted = c.effects.some((e) => e.target?.mode === 'targeted');
      return {
        kind: 'card',
        prepare: pick(() => { ui.bag = { mode: 'buyHand', uid, then: 'use', picking: canUse && targeted }; }),
        bag: options.some((o) => o.then === 'store') ? () => { ui.bag = { mode: 'buyHand', uid, then: 'store' }; dispatchBag(undefined); } : null,
        arena: canUse && !targeted ? () => { ui.bag = { mode: 'buyHand', uid, then: 'use' }; dispatchBag(undefined); } : null,
      };
    }
    return null;
  }

  if (el.closest('.player .bag-slot.usable')) {
    const item = me.bag.find((i) => i.uid === uid);
    const targeted = item.effects.some((e) => e.target?.mode === 'targeted');
    return {
      kind: targeted ? 'arrow' : 'card',
      source,
      prepare: pick(() => { ui.bag = { mode: 'useBag', uid, picking: targeted }; }),
      arena: targeted ? null : () => dispatchBag(undefined),
    };
  }
  const mart = el.closest('.mart-item.buyable');
  if (mart) return { kind: 'card', bag: () => dispatch({ type: 'openBag', who: 'player', mode: 'buyMart', slot: Number(mart.dataset.slot) }) };

  if (!el.classList.contains('selectable')) return null;
  const space = el.closest('.player .pokemon-space');
  if (space) {
    const from = { zone: Number(space.dataset.zone), space: Number(space.dataset.space) };
    return { kind: 'arrow', source, prepare: pick(() => { ui.attacker = from; }) };
  }
  const trainer = el.closest('.player .trainer-space');
  if (trainer) {
    const zone = Number(trainer.dataset.zone);
    const targeted = powerTargets(state, 'player', zone).length > 0;
    return {
      kind: 'arrow',
      source,
      prepare: pick(() => { ui.power = zone; }),
      arena: targeted ? null : () => usePower(undefined),
    };
  }
  return null;
}

// The card a targeting arrow starts from while a target is being chosen (by click or drag).
function arrowSource(state) {
  const uid = ui.attacker ? state.players.player.zones[ui.attacker.zone].pokemon[ui.attacker.space]?.uid
    : ui.power !== null ? state.players.player.zones[ui.power].trainer.uid
      : ui.strategy ?? (ui.bag?.picking ? ui.bag.uid : null) ?? (ui.supporter?.picking ? ui.supporter.uid : null);
  if (ui.power !== null && !powerTargets(state, 'player', ui.power).length) return null;
  const el = uid && cardEls.get(uid);
  return el?.isConnected ? el : null;
}

// The place a target element stands for, as a ref.
function refOf(el) {
  const { owner } = el.dataset;
  const zone = Number(el.dataset.zone);
  if (el.classList.contains('trainer-space')) return { kind: 'trainer', owner, zone };
  if (el.classList.contains('pokemon-space')) return { kind: 'pokemon', owner, zone, space: Number(el.dataset.space) };
  if (el.closest('.hand') && el.dataset.uid) return { kind: 'hand', owner: 'player', uid: el.dataset.uid };
  return null;
}

// What would happen if the current choice went to this target: tried on a
// copy of the game (the engine is pure), so the arrow can show "−5 · Defeated".
function outcome(state, el) {
  const ref = refOf(el);
  if (!ref) return null;
  const me = 'player';
  let action = null;
  let from = null;
  if (state.pending?.who === me && state.pending.kind === 'target') action = { type: 'resolveChoice', who: me, target: ref };
  else if (ui.attacker) {
    from = { kind: 'pokemon', owner: me, ...ui.attacker };
    action = { type: 'command', who: me, from: ui.attacker, target: ref.kind === 'trainer' ? { kind: 'trainer', zone: ref.zone } : { kind: 'pokemon', zone: ref.zone, space: ref.space } };
  } else if (ui.power !== null) action = { type: 'usePower', who: me, zone: ui.power, target: ref };
  else if (ui.strategy) action = { type: 'playStrategy', who: me, uid: ui.strategy, target: ref };
  else if (ui.bag?.picking) action = { type: 'openBag', who: me, mode: ui.bag.mode, uid: ui.bag.uid, then: ui.bag.then ?? 'use', target: ref };
  else if (ui.supporter?.picking) {
    const { uid, discard, release } = ui.supporter;
    action = { type: 'playSupporter', who: me, uid, discard: [...discard], release: [...release], target: ref };
  }
  if (!action) return null;
  let after;
  try {
    after = applyAction(state, action);
  } catch {
    return null;
  }
  const change = (r) => {
    const before = cardAt(state, r);
    if (!before) return null;
    const now = findByUid(after, before.uid);
    if (before.cardType === 'Trainer') {
      const d = now.strength - before.strength;
      if (now.strength <= 0 && before.strength > 0) return { text: `${before.name} −${-d} · Removed`, bad: true };
      return d ? { text: `${before.name} ${d > 0 ? '+' : '−'}${Math.abs(d)}`, bad: d < 0 } : null;
    }
    if (!now) return { text: `${before.name} · Defeated`, bad: true };
    const d = (now.currentStrength ?? 0) - (before.currentStrength ?? 0);
    const a = (now.currentStrength !== undefined ? attackOf(now) : now.attackValue) - (before.currentStrength !== undefined ? attackOf(before) : before.attackValue);
    const parts = [d && `${d > 0 ? '+' : '−'}${Math.abs(d)}`, a && `${a > 0 ? '+' : '−'}${Math.abs(a)} ATK`, now.heldItem?.uid !== before.heldItem?.uid && now.heldItem && `holds ${now.heldItem.name}`].filter(Boolean);
    return parts.length ? { text: `${before.name} ${parts.join(' ')}`, bad: d < 0 } : null;
  };
  return { target: change(ref), source: from ? change(from) : null };
}

// A card anywhere in the arena or a hand, by uid.
function findByUid(state, uid) {
  for (const p of Object.values(state.players)) {
    for (const z of p.zones) {
      if (z.trainer?.uid === uid) return z.trainer;
      const c = z.pokemon.find((x) => x?.uid === uid);
      if (c) return c;
    }
    const h = p.hand.find((x) => x.uid === uid);
    if (h) return h;
  }
  return null;
}

// --- Inspect: the full card, with every keyword and buff explained ---------------------

const TRIGGER_HELP = {
  'On Summon': 'when this Pokémon enters the arena, whether played or summoned by an effect.',
  'On Attack': 'after its attack deals damage, if it is still in the arena.',
  'On Defend': 'after it is attacked by a Command and takes damage, if it is still in the arena.',
  'On Defeated': 'when it is defeated by any cause, as it goes to the Released Pile.',
  'On Breakfast': 'each Breakfast, after cards are drawn and Energy is gained.',
  'On Supper': 'each Supper, after Burn, before hands are discarded.',
  'On Knockout': 'when damage dealt by this Pokémon (its attack, a trade, or its own ability) defeats an enemy Pokémon, if it is still in the arena.',
  'On Trainer Strike': 'when this Pokémon damages an enemy Trainer (its attack, or Overrun), if it is still in the arena.',
  Rally: 'when another friendly Pokémon is summoned into this Pokémon\'s Zone (same side).',
  'On Heal': 'when this Pokémon is healed by at least 1.',
};
const STRENGTH_HELP = {
  Hitpoints: 'Hitpoints: no targeting restriction.',
  Defence: 'Defence: while you have one, an opponent\'s Physical attackers must target a Defence Pokémon.',
  'Special Defence': 'Special Defence: while you have one, an opponent\'s Special attackers must target a Special Defence Pokémon.',
};

function inspectView(entry) {
  if (!entry) return '';
  const { c, opts } = entry;
  const item = (title, text) => `<div class="explain"><h4>${title}</h4><p>${text}</p></div>`;
  const lines = [];
  if (c.cardType === 'Pokémon') {
    const inPlay = c.currentStrength !== undefined;
    lines.push(item('Energy Cost', `Pay ${c.energyCost} Energy to play it: Base Energy first, Exert only for a shortfall.`));
    lines.push(item(`${c.attackType} Attack`, `Deals its Attack Value to its target when Commanded. ${c.attackType === 'Physical' ? 'Must target a Defence Pokémon if the opponent has one.' : 'Must target a Special Defence Pokémon if the opponent has one.'}`));
    lines.push(item(`${c.strengthType} Strength`, `${STRENGTH_HELP[c.strengthType]} At 0 Strength the Pokémon is defeated and goes to the Released Pile.`));
    lines.push(item(`Speed-Tier: ${SPEED_TIERS[speedOf(c)]}`, 'An Active Pokémon is Alert, and can be Commanded, if its Speed-Tier equals the highest among all Active Pokémon in the arena. Swift > Steady > Slow.'));
    for (const k of keywordSummary(c)) lines.push(item(keywordLabel(k), keywordHelp(k)));
    if (statusCount(c, 'burn')) lines.push(item(`Burn ${statusCount(c, 'burn')}`, 'At Supper it takes damage equal to its Burn, then Burn goes down by 1. Burn damage is effect damage (no On Defend). Douse removes it; healing doesn\'t.'));
    if (c.effectTrigger) lines.push(item(c.effectTrigger, `Its ability triggers ${TRIGGER_HELP[c.effectTrigger] ?? ''} ${c.effectText}`));
    if (inPlay) {
      const buffs = [sources(c, 'attack') && `Attack ${attackOf(c)}${sources(c, 'attack')}`, sources(c, 'strength') && `Strength ${c.currentStrength}/${maxStrengthOf(c)}${sources(c, 'strength')}`].filter(Boolean);
      const auras = Object.values(c.aura ?? {}).map((b) => `${b.name}'s Passive: +${b.attack} Attack, +${b.strength} Strength`);
      const weather = Object.entries(c.weather ?? {}).map(([k, m]) => `Weather ${k}: ${m.attack ? `${m.attack > 0 ? '+' : ''}${m.attack} Attack ` : ''}${m.strength ? `${m.strength > 0 ? '+' : ''}${m.strength} Strength` : ''}`);
      lines.push(item('Current buffs', [...buffs, ...auras, ...weather].join('<br>') || 'None: printed stats.'));
      lines.push(item('Status', c.spent ? 'Spent: it becomes Active again at the next Breakfast.' : opts.alert ? 'Alert: it can be Commanded now.' : 'Active, but not Alert (a faster Pokémon is Active).'));
    } else if (c.xp) {
      lines.push(item('XP buffs', `+${c.xp.attack} Attack, +${c.xp.strength} Strength, permanent once played; lost if it leaves your hand any other way.`));
    }
    if (c.weatherTokens) lines.push(item('Weather Tokens', `${weatherText(c.weatherTokens)}: counted while it is in the arena.`));
  } else if (c.cardType === 'Trainer') {
    lines.push(item('Strength', `${c.strength}/${c.maxStrength}. At 0 the Trainer is removed and its zone has fallen: no new Pokémon can be played there. All 3 enemy Trainers at 0 wins the match.`));
    lines.push(item(`Power (${c.power.cost})`, `${c.power.text} A Battle Action, once per Round, paid like any cost; not usable without a legal target.`));
    lines.push(item('Passive', `${c.passive.text} Always on, but only in this Trainer's zone.`));
  } else if (c.cardType === 'Location') {
    lines.push(item('Quest', `${c.quest.text}${c.progress !== undefined ? ` Progress: ${c.progress}/${c.quest.count}.` : ''}`));
    lines.push(item('Reward', `${c.xp} XP, then: ${c.effectText} The Location then goes to the Released Pile.`));
    lines.push(item('Playing it', 'No Energy. Into one of your Location spaces outside a fallen zone, replacing any Location there.'));
    if (c.weatherTokens) lines.push(item('Weather Tokens', `${weatherText(c.weatherTokens)}: counted while it is in play.`));
  } else if (c.cardType === 'Item') {
    lines.push(item(`${c.itemType} Item · $${c.cost}`, c.itemType === 'Held'
      ? 'Attaches to a friendly Pokémon (in the arena or in your hand) and stays with that card until it is Released. One per Pokémon.'
      : 'Its effect resolves immediately, then it goes to the PokéMart.'));
    lines.push(item('Effect', c.effectText));
    if (c.inDelivery) lines.push(item('In Delivery', 'Bought from the PokéMart: usable from the next Breakfast.'));
  } else if (c.cardType === 'Strategy') {
    lines.push(item(`Energy Cost ${c.energyCost}`, 'A Battle Action. Its effect resolves immediately, then it goes to your Discard Pile. It needs a legal target.'));
    lines.push(item('Effect', c.effectText));
  } else if (c.cardType === 'Supporter') {
    lines.push(item(`Card-Cost: ${costText(c.cardCost)}`, 'Paid with other cards from your hand, exactly. Discarded cards go to your Discard Pile; Released cards are gone for the match. Once per Round.'));
    lines.push(item('Effect', c.effectText));
    lines.push(item('Gift Bonus', `If a paid card meets the challenge (${c.gift.challengeText}): ${c.gift.bonusText}`));
  }
  if (c.heldItem) lines.push(item(`Held Item: ${c.heldItem.name}`, `${c.heldItem.effectText} It stays with this card until the card is Released.`));
  return `<div class="inspect-card">${detail(entry)}</div><div class="inspect-side"><h3>${c.name}</h3>${lines.join('')}<p class="inspect-close">Click anywhere or press Escape to close.</p></div>`;
}
