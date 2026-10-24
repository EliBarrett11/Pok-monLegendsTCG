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
  openBagOptions, itemTargets, BAG_SIZE,
} from '../engine/game.js';
import { heldBonus, weatherTotal, speedOf } from '../engine/board.js';
import { INNATE_POWERS, WEATHER, SPEED_TIERS } from '../engine/cardData.js';
import { SPEEDS, getSpeed, setSpeed } from './settings.js';

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
}

function clearSelection() {
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
    <div class="table">
      ${infoBar(state, 'ai')}
      <section class="side opponent">${lanes(state, 'ai')}</section>
      ${centreStrip(state)}
      <section class="side player">${lanes(state, 'player')}</section>
      <section class="bottom">
        ${infoBar(state, 'player')}
        <div class="hand-area">${trainerTray(state) || `<div class="hand">${handCards(state)}</div>`}</div>
      </section>
    </div>

    <aside class="side-panel">
      <div class="prompt">${c.hint}</div>
      <div class="secondary-actions">${c.secondary}</div>
      ${c.primary}
      ${martPanel(state)}
      <div class="panel-foot">
        <button data-action="toggle-log" class="secondary">${logOpen ? 'Hide' : 'Show'} log</button>
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
    ${gameOverScreen(state)}
    <div class="preview" hidden></div>
  `;

  adoptCards(root);
  const logBody = root.querySelector('.log-body');
  logBody.scrollTop = logBody.scrollHeight;
  wire(root, state, actions);
}

// --- Info bars, strip, panels ------------------------------------------------

// Name, piles, Energy, XP, PokéDollars and Bag. The opponent's is the top bar;
// mine sits at the bottom left, beside the hand.
function infoBar(state, who) {
  const p = state.players[who];
  const exhaust = [...p.exhaust].sort((a, b) => a.position - b.position)
    .map((x) => `<span class="exhaust" title="Exhaust position ${x.position}, recovers in Round ${x.recoversRound}">P${x.position}→R${x.recoversRound}</span>`).join('');
  return `
    <div class="info-bar ${who}">
      <div class="info-text">
        <div class="info-line"><strong class="pname">${p.name}</strong>
          ${who === 'ai' ? `<span data-pile="ai-hand">Hand <b>${p.hand.length}</b></span>` : ''}
          <span data-pile="${who}-draw">Draw <b>${p.drawPile.length}</b></span>
          <span data-pile="${who}-discard">Discard <b>${p.discard.length}</b></span>
          <span data-pile="${who}-released">Released <b>${p.released.length}</b></span></div>
        <div class="info-line">
          <span>Energy <b>${p.baseEnergy}</b></span>
          <span>Exert <b>${p.exertMax - p.exhaust.length}/${p.exertMax}</b></span>
          <span class="xp-pool">XP <b>${p.xp}</b></span></div>
        <div class="info-line"><span class="dollars">PokéDollars <b>$${p.dollars}</b></span>
          <span>Exhaust ${exhaust || '<b>0</b>'}</span></div>
      </div>
      ${bagRow(state, who)}
    </div>`;
}

const WEATHER_ICONS = { Rain: '☔', Sun: '☀' };

function weatherText(tokens) {
  return Object.entries(tokens ?? {}).map(([type, n]) => `<span class="weather-chip">${WEATHER_ICONS[type] ?? '☁'} ${n} ${type}</span>`).join(' ');
}

// Round, phase, whose turn, initiative and the Weather in play (both sides
// combined: each type's count, its brackets, reached ones lit, and the effects).
function centreStrip(state) {
  let weather = '';
  if (state.round) {
    const types = Object.entries(weatherState(state)).filter(([, w]) => w.count > 0);
    weather = types.length ? types.map(([type, w]) => {
      const all = WEATHER[type].brackets.map((b) => `<span class="bracket${w.active.includes(b) ? ' on' : ''}${w.effective.includes(b) ? '' : ' replaced'}">${b.at}</span>`).join('');
      const effects = w.effective.map((b) => b.text).join(' ') || 'No effect yet.';
      return `<span class="weather-type" title="${attr(`${type} ${w.count}: ${effects}`)}"><b>${w.icon} ${type} ${w.count}</b>${all}<span class="weather-effects">${effects}</span></span>`;
    }).join('') : '<span class="weather-chip">No Weather</span>';
  }
  return `
    <section class="status">
      <span class="phase">${state.round ? `Round ${state.round} · ` : ''}${PHASE_NAMES[state.phase]}</span>
      ${state.turn ? `<span class="turn ${state.turn}">${state.turn === 'player' ? 'Your turn' : "AI Opponent's turn"}</span>` : ''}
      ${state.initiative ? `<span class="initiative">Initiative: ${state.players[state.initiative].name}</span>` : ''}
      <span class="caption-slot"><span class="caption" title="${attr(caption)}"${caption ? '' : ' hidden'}>${attr(caption)}</span></span>
      <span class="weather">${weather}</span>
    </section>`;
}

// A player's Bag: 6 spaces, In Delivery marked. Both Bags are visible.
function bagRow(state, who) {
  const p = state.players[who];
  const usable = new Set(who === 'player' && isMyBattleTurn(state) && !ui.supporter
    ? openBagOptions(state, 'player').filter((o) => o.mode === 'useBag').map((o) => o.uid) : []);
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const item = p.bag[i];
    if (!item) return '<div class="bag-slot empty"></div>';
    const cls = `bag-slot${item.inDelivery ? ' delivery' : ''}${usable.has(item.uid) ? ' usable' : ''}${ui.bag?.uid === item.uid ? ' selected' : ''}`;
    return `<div class="${cls}" data-uid="${item.uid}">${card(item, 'mini')}</div>`;
  }).join('');
  return `<div class="bag" data-pile="${who}-bag"><span class="bag-label">Bag ${p.bag.length}/${BAG_SIZE}</span><div class="bag-slots">${slots}</div></div>`;
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
          <div class="zone-tag${fallen ? ' fallen' : ''}"${fallen ? ' title="Fallen: no new Pokémon can be played here"' : ''}>Zone ${z + 1}${fallen ? '<br>Fallen' : ''}</div>
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
    content = '<div class="face-down">Chosen</div>';
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
          selectable: alert && who === 'player' && myTurn,
          selected: who === 'player' && ui.attacker?.zone === z && ui.attacker?.space === s,
        };
        const empty = placing.has(`${z}${s}`) ? '<span class="empty">Play here</span>' : '';
        return `<div class="${cls}" data-owner="${who}" data-zone="${z}" data-space="${s}">${c ? card(c, 'board', opts) : empty}</div>`;
      }).join('')}
    </div>`;
}

// --- Hand -----------------------------------------------------------------------

// Hand cards fan out across the hand area, overlapping more as the hand grows,
// and peek up from the bottom edge (a hovered card rises fully into view).
export const HAND_AREA = 1140;
export const HAND_CARD = 170;

// Left edge of each of n hand cards: side by side while they fit, then overlapping.
export function fanPositions(n) {
  const step = n > 1 ? Math.min(HAND_CARD + 10, (HAND_AREA - HAND_CARD) / (n - 1)) : 0;
  const start = (HAND_AREA - (HAND_CARD + step * (n - 1))) / 2;
  return Array.from({ length: n }, (_, i) => Math.round(start + step * i));
}

function fan(cards) {
  const left = fanPositions(cards.length);
  return cards.map((html, i) => html.replace('<div class="card ', `<div style="left:${left[i]}px;z-index:${i + 1}" class="card `)).join('');
}

function handCards(state) {
  const me = state.players.player;
  const xpStep = state.phase === 'breakfast' && state.xpStep && !me.xpChoice;
  const mulligan = state.phase === 'breakfast' && !state.xpStep && state.round === 1 && !me.pending;
  const myTurn = isMyBattleTurn(state);
  const playable = myTurn
    ? [...playablePokemon(state, 'player'), ...playableStrategies(state, 'player'), ...playableSupporters(state, 'player'),
      ...playableLocations(state, 'player')].map((c) => c.uid) : [];
  const hand = (c, opts) => card(c, 'hand', opts);
  return fan(me.hand.map((c) => {
    if (mulligan) return hand(c, { selectable: true, selected: ui.mulligan.has(c.uid) });
    if (xpStep) {
      if (c.cardType !== 'Pokémon') return hand(c);
      return hand(c, { selectable: true, selected: ui.xpPick === c.uid, plan: plannedXp(c.uid) });
    }
    if (state.pending?.uid === c.uid) return hand(c, { selected: true });
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
      return hand(c, { selectable: buyable, unavailable: !buyable, selected: ui.bag?.uid === c.uid });
    }
    if (myTurn && ['Pokémon', 'Strategy', 'Supporter', 'Location'].includes(c.cardType)) {
      return playable.includes(c.uid)
        ? hand(c, { selectable: true, selected: [ui.selectedPokemon, ui.strategy, ui.location].includes(c.uid) })
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

function stateClasses({ selectable, selected, unavailable, pay }) {
  return `${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${unavailable ? ' unavailable' : ''}${pay ? ` pay-${pay}` : ''}`;
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

const SHORT = { Physical: 'PHY', Special: 'SPC', Hitpoints: 'HP', Defence: 'DEF', 'Special Defence': 'SPD' };

// Weather's share of a stat, per type, e.g. ☔+1 ☀−1 (shown apart from other buffs).
function weatherTags(c, stat) {
  const byType = {};
  for (const mod of Object.values(c.weather ?? {})) byType[mod.type] = (byType[mod.type] ?? 0) + (mod[stat] ?? 0);
  return Object.entries(byType).filter(([, n]) => n)
    .map(([type, n]) => `<span class="wx-tag" title="${type}">${WEATHER[type].icon}${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`).join('');
}

const trend = (now, printed) => (now > printed ? 'buffed' : now < printed ? 'nerfed' : '');

// What a card shows on its face, by Card-Type.
function face(c, opts) {
  const inPlay = c.currentStrength !== undefined;
  switch (c.cardType) {
    case 'Pokémon': {
      let stats;
      if (inPlay) {
        const atk = attackOf(c);
        const max = maxStrengthOf(c);
        stats = `<span class="stat" title="${c.attackType}">${SHORT[c.attackType]} <b class="${trend(atk, c.attackValue)}">${atk}</b></span>
          <span class="stat" title="${c.strengthType}: current / maximum">${SHORT[c.strengthType]} <b>${c.currentStrength}</b>/<b class="${trend(max, c.strengthValue)}">${max}</b></span>`;
      } else {
        // XP already on the card in hand, plus any still being planned.
        const xpAtk = (c.xp?.attack ?? 0) + (opts.plan?.attack ?? 0);
        const xpStr = (c.xp?.strength ?? 0) + (opts.plan?.strength ?? 0);
        stats = `<span class="stat">${SHORT[c.attackType]} <b class="${xpAtk ? 'buffed' : ''}">${c.attackValue + xpAtk}</b>${xpAtk ? `<span class="xp-tag">+${xpAtk}XP</span>` : ''}</span>
          <span class="stat">${SHORT[c.strengthType]} <b class="${xpStr ? 'buffed' : ''}">${c.strengthValue + xpStr}</b>${xpStr ? `<span class="xp-tag">+${xpStr}XP</span>` : ''}</span>`;
      }
      const speed = SPEED_TIERS[speedOf(c)];
      const text = [c.innatePower && `<b class="keyword">${c.innatePower}</b>`,
        c.effectText && `<b>${c.effectTrigger}:</b> ${c.effectText}`].filter(Boolean).join(' ');
      const badges = [
        c.heldItem && `<span class="badge held">🎒 ${c.heldItem.name}</span>`,
        c.spent && '<span class="badge spent">Spent</span>',
        opts.alert && '<span class="badge alert">Alert</span>',
      ];
      return {
        kind: 'pokemon', corner: `<span class="cost" title="Energy Cost">${c.energyCost}</span>`,
        type: `${c.pokemonType} · ${speed}${c.weatherTokens ? ` · ${weatherText(c.weatherTokens)}` : ''}`,
        stats, text, badges, art: [`ptype-${slug(c.pokemonType)}`, c.pokemonType],
      };
    }
    case 'Trainer': {
      const used = c.powerUsedRound === ui.state.round;
      return {
        kind: 'trainer',
        corner: `<span class="trainer-strength" title="Strength">${c.strength <= 0 ? 'Out' : `${c.strength}/${c.maxStrength}`}</span>`,
        type: 'Trainer',
        text: `<b>Power (${c.power.cost}):</b> ${c.power.text} <b>Passive:</b> ${c.passive.text}`,
        badges: [used && '<span class="badge used">Power used</span>', c.strength <= 0 && '<span class="badge spent">Removed</span>'],
      };
    }
    case 'Location':
      return {
        kind: 'location', corner: `<span class="xp-reward" title="XP Reward">${c.xp} XP</span>`,
        type: `Location ${weatherText(c.weatherTokens)}`,
        stats: inPlayLocation(c) ? `<span class="progress">${c.quest.label} ${c.progress}/${c.quest.count}</span>` : '',
        text: `<b>Quest:</b> ${c.quest.text}`,
      };
    case 'Item':
      return {
        kind: 'item', corner: `<span class="price" title="PokéDollar Cost">$${c.cost}</span>`,
        type: `Item · ${c.itemType}`, text: c.effectText,
        badges: [c.inDelivery && '<span class="badge delivery">In Delivery</span>'],
      };
    case 'Strategy':
      return { kind: 'strategy', corner: `<span class="cost" title="Energy Cost">${c.energyCost}</span>`, type: 'Strategy', text: c.effectText };
    case 'Supporter':
      return {
        kind: 'supporter', corner: '', type: `Supporter · <span class="card-cost">${costText(c.cardCost)}</span>`,
        text: `${c.effectText} <b class="gift">Gift:</b> ${c.gift.challengeText} → ${c.gift.bonusText}`,
      };
    default:
      return { kind: slug(c.cardType), corner: '', type: c.cardType, text: '' };
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

function art(c, f, badges = '') {
  const [cls, label] = f.art ?? [`${f.kind}-art`, c.cardType];
  return `<div class="card-art ${cls}"><span>${label}</span><div class="art-img" style="background-image:url('${artUrl(c)}')"></div>${badges}</div>`;
}

function card(c, size, opts = {}) {
  const f = face(c, opts);
  const pv = previews.push({ c, opts }) - 1;
  const cls = `card ${size} ${f.kind}${c.rarity ? ` rarity-${slug(c.rarity)}` : ''}${c.spent ? ' spent' : ''}${opts.alert ? ' alert' : ''}${stateClasses(opts)}`;
  const head = `<div class="card-head"><span class="card-name">${c.name}</span>${f.corner}</div>`;
  if (size === 'mini') return `<div class="${cls}" data-uid="${c.uid}" data-pv="${pv}">${head}${art(c, f)}</div>`;
  const badges = (f.badges ?? []).filter(Boolean).join('');
  return `<div class="${cls}" data-uid="${c.uid}" data-pv="${pv}">
    ${payBadge(opts)}${head}
    ${art(c, f, badges ? `<div class="badges">${badges}</div>` : '')}
    <div class="card-type">${f.type}</div>
    ${f.stats ? `<div class="stats">${f.stats}</div>` : ''}
    <div class="card-text">${f.text}</div>
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
        row('Attack', inPlay ? `${c.attackType} <b>${attackOf(c)}</b>${sources(c, 'attack')}`
          : `${c.attackType} <b>${c.attackValue + xpAtk}</b>${xpAtk ? ` <span class="xp-tag">(+${xpAtk} XP)</span>` : ''}`),
        row('Strength', inPlay ? `${c.strengthType} <b>${c.currentStrength}</b> / ${maxStrengthOf(c)}${sources(c, 'strength')}`
          : `${c.strengthType} <b>${c.strengthValue + xpStr}</b>${xpStr ? ` <span class="xp-tag">(+${xpStr} XP)</span>` : ''}`),
        row('Speed-Tier', speed === c.speedTier ? speed : `${speed} <span class="muted">(printed ${c.speedTier}, raised by Held Item)</span>`),
        c.innatePower && row('Innate Power', `<b class="keyword">${c.innatePower}</b> ${INNATE_POWERS[c.innatePower] ?? ''}`),
        c.effectText && row(c.effectTrigger, c.effectText),
        c.weatherTokens && row('Weather', weatherText(c.weatherTokens)),
        c.heldItem && row('Held Item', `<b>🎒 ${c.heldItem.name}</b> ${c.heldItem.effectText}`),
        inPlay && row('Status', [c.spent ? 'Spent' : 'Active', opts.alert && 'Alert: can attack now'].filter(Boolean).join(' · ')),
      ];
    }
    case 'Trainer': {
      const used = c.powerUsedRound === ui.state.round;
      return [
        row('Strength', c.strength <= 0 ? 'Removed (0 Strength)' : `<b>${c.strength}</b> / ${c.maxStrength}`),
        row(`Power (${c.power.cost})`, `${c.power.text}${used ? ' <i class="used">Used this Round</i>' : ''}`),
        row('Passive', c.passive.text),
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
      return [row('Card-Cost', costText(c.cardCost)), row('Effect', c.effectText),
        row('Gift Challenge', c.gift.challengeText), row('Gift Bonus', c.gift.bonusText)];
    default:
      return [];
  }
}

function detail({ c, opts }) {
  const f = face(c, opts);
  return `<div class="pv-card ${f.kind}${c.rarity ? ` rarity-${slug(c.rarity)}` : ''}">
    <div class="card-head"><span class="card-name">${c.name}</span>${f.corner}</div>
    <div class="pv-sub">${[c.rarity, c.cardType === 'Pokémon' ? `Pokémon · ${c.pokemonType}` : c.cardType].filter(Boolean).join(' · ')}</div>
    ${art(c, f)}
    <div class="pv-lines">${detailLines(c, opts).filter(Boolean).join('')}</div>
  </div>`;
}

// Shows the preview beside the hovered card, inside the stage, without moving anything.
function showPreview(root, el) {
  const box = root.querySelector('.preview');
  box.innerHTML = detail(previews[Number(el.dataset.pv)]);
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
const primary = (action, label, disabled = false) => button(action, label, { disabled, cls: 'primary' });
const idle = (label) => `<button class="primary" disabled>${label}</button>`;
const waiting = {
  get hint() { return `${caption ? `<b>${attr(caption)}</b><br><br>` : ''}<span class="muted">Waiting for the opponent…</span>`; },
  secondary: '',
  primary: idle('Waiting…'),
};

function controls(state) {
  const me = state.players.player;
  // An ability waiting for my target, in any phase.
  if (state.pending?.who === 'player' && state.pending.kind === 'target') {
    return { hint: `<b>${state.pending.label}:</b> ${state.pending.text ?? ''} Choose a highlighted target.`, secondary: '', primary: idle('Choose a target') };
  }
  switch (state.phase) {
    case 'trainers': {
      if (me.pending) return waiting;
      const ready = ui.placing.every(Boolean);
      return {
        hint: '<b>Place your Trainers.</b> Pick a Trainer from the bottom of the screen, then click one of your Trainer Spaces. Click a placed Trainer to take it back.',
        secondary: '', primary: primary('lock-trainers', 'Lock in Trainers', !ready),
      };
    }
    case 'initiative':
      return { hint: 'Flip a coin to decide who has initiative.', secondary: '', primary: primary('flip', 'Flip coin') };
    case 'breakfast': {
      if (state.xpStep) {
        if (me.xpChoice) return waiting;
        const left = me.xp - ui.xpPlan.length;
        const pick = ui.xpPick && me.hand.find((c) => c.uid === ui.xpPick);
        return {
          hint: `<b>Spend XP</b> (${left} of ${me.xp} left): each point gives a Pokémon in hand +1 Attack or +1 Strength. ${pick ? `<b>${pick.name}</b> picked.` : 'Click a Pokémon in your hand.'}`,
          secondary: `${pick ? `${button('xp-attack', '+1 Attack', { disabled: !left })}${button('xp-strength', '+1 Strength', { disabled: !left })}` : ''}
            ${button('xp-undo', 'Undo', { disabled: !ui.xpPlan.length, cls: 'secondary' })}`,
          primary: primary('xp-lock', `Lock in${ui.xpPlan.length ? ` (${ui.xpPlan.length} XP)` : ' (keep XP)'}`),
        };
      }
      if (me.pending) return waiting;
      const n = ui.mulligan.size;
      return {
        hint: '<b>Mulligan.</b> Click cards in your hand to mark them, then swap them, or keep your hand.',
        secondary: '', primary: primary('mulligan', n ? `Mulligan ${n} card${n === 1 ? '' : 's'}` : 'Keep hand'),
      };
    }
    case 'battle': {
      if (state.pending?.who === 'player' && state.pending.kind === 'freeSummon') {
        const c = me.hand.find((h) => h.uid === state.pending.uid);
        return { hint: `Ash drew <b>${c.name}</b>: click a highlighted space to summon it for free, or keep it.`, secondary: '', primary: primary('keep-card', 'Keep in hand') };
      }
      if (state.turn !== 'player' || state.pending) return waiting;
      if (ui.bag) {
        const cancel = button('cancel-bag', 'Cancel', { cls: 'secondary' });
        const opts = openBagOptions(state, 'player');
        const has = (mode) => opts.some((o) => o.mode === mode);
        const item = bagItem(state);
        if (ui.bag.picking) {
          const where = item.itemType === 'Held' ? ' (a Pokémon in the arena, or one in your hand)' : '';
          return { hint: `<b>${item.name}</b>: click a highlighted target${where}.`, secondary: cancel, primary: idle('Choose a target') };
        }
        if (ui.bag.mode === 'buyHand' && item) {
          const can = (then) => opts.some((o) => o.uid === item.uid && o.then === then);
          return {
            hint: `Buy <b>${item.name}</b> for $${item.cost}, then use it now or store it in your Bag.`,
            secondary: `${button('bag-use', 'Use now', { disabled: !can('use') })}${button('bag-store', 'Store in Bag', { disabled: !can('store') })}${cancel}`,
            primary: idle('Choose above'),
          };
        }
        const hints = { buyHand: 'Click an Item in your hand to buy it.', buyMart: 'Click an Item in the PokéMart to buy it (In Delivery until next Breakfast).', useBag: 'Click an Item in your Bag to use it.' };
        if (ui.bag.mode) return { hint: hints[ui.bag.mode], secondary: cancel, primary: idle('Choose an Item') };
        return {
          hint: `<b>Open Bag</b> ($${me.dollars}): choose one.`,
          secondary: `${button('bag-mode', 'Buy from hand', { disabled: !has('buyHand'), extra: ' data-mode="buyHand"' })}
            ${button('bag-mode', 'Buy from PokéMart', { disabled: !has('buyMart'), extra: ' data-mode="buyMart"' })}
            ${button('bag-mode', 'Use from Bag', { disabled: !has('useBag'), extra: ' data-mode="useBag"' })}${cancel}`,
          primary: idle('Choose above'),
        };
      }
      const paying = supporterChoice(state);
      if (paying) {
        const { card: c, exact, gift } = paying;
        const cancel = button('cancel-supporter', 'Cancel', { cls: 'secondary' });
        if (ui.supporter.picking) return { hint: `<b>${c.name}</b>: click a highlighted target.`, secondary: cancel, primary: idle('Choose a target') };
        const counts = [c.cardCost.discard && `Discard ${ui.supporter.discard.length}/${c.cardCost.discard}`,
          c.cardCost.release && `<span class="release-count">Release ${ui.supporter.release.length}/${c.cardCost.release}</span>`].filter(Boolean).join(' · ');
        return {
          hint: `<b>${c.name}</b>: click hand cards to pay (click again: Discard → Release → none).<br>${counts}<br>
            Gift (${c.gift.challengeText}): <span class="gift-status ${gift ? 'met' : ''}">${gift ? '✓ met' : 'not met'}</span>`,
          secondary: cancel, primary: primary('confirm-supporter', 'Confirm', !exact),
        };
      }
      const pass = primary('pass', 'Pass');
      if (ui.power !== null) {
        const t = me.zones[ui.power].trainer;
        if (powerTargets(state, 'player', ui.power).length) {
          return { hint: `<b>${t.name}'s Power:</b> click a highlighted target, or click ${t.name} again to cancel.`, secondary: '', primary: pass };
        }
        return {
          hint: `<b>${t.name}'s Power:</b> ${t.power.text}`,
          secondary: button('pass', 'Pass', { cls: 'secondary' }), primary: primary('use-power', `Use Power (${t.power.cost})`),
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

// --- Clicks -----------------------------------------------------------------

// Using Exert has a recovery cost, so it needs a yes first.
function confirmExert(fromExert) {
  return !fromExert || confirm(`This will use ${fromExert} Exert. Exert takes Rounds to recover. Go ahead?`);
}

function wire(root, state, { dispatch, newGame }) {
  const redraw = () => render(root, state, { dispatch, newGame });
  const on = (selector, fn) => root.querySelectorAll(selector).forEach((el) => { el.onclick = () => fn(el); });

  // Hover preview for every card on screen.
  const box = root.querySelector('.preview');
  root.querySelectorAll('[data-pv]').forEach((el) => {
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
  on('[data-action="new-game"]', newGame);
  on('[data-action="flip"]', () => dispatch({ type: 'flipCoin' }));
  on('[data-action="lock-trainers"]', () => dispatch({ type: 'assignTrainers', who: 'player', order: [...ui.placing] }));
  on('[data-action="pass"]', () => dispatch({ type: 'pass', who: 'player' }));
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
}
