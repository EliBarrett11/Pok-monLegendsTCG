// Draws the current game state and turns clicks into actions.
// Reads state only; all rule changes go through the engine.

import {
  ZONES, playablePokemon, costPreview, isAlert, legalTargets, canUsePower, powerTargets,
  summonSpaces, isFallen, attackOf, maxStrengthOf, playableStrategies, strategyTargets,
  playableSupporters, supporterTargets, giftMet, playableLocations, locationSpaces, weatherState,
} from '../engine/game.js';
import { INNATE_POWERS, WEATHER } from '../engine/cardData.js';

// Choices the player is still making before they lock in. Reset whenever the
// game state changes (the engine returns a new state object for every action).
const ui = {};

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
}

function clearSelection() {
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
  : ref.kind === 'zone' ? `${ref.owner}:Z${ref.zone}` : `${ref.owner}:P${ref.zone}${ref.space}`);

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
  const me = state.players.player;
  const them = state.players.ai;

  root.innerHTML = `
    <div class="board">
      <section class="side opponent">
        ${pileBar(them, true)}
        ${energyBar(them)}
        ${trainerRow(state, 'ai')}
        ${locationRow(state, 'ai')}
        ${pokemonRow(state, 'ai')}
      </section>

      <section class="status">
        <div class="phase">
          ${state.round ? `Round ${state.round} · ` : ''}${PHASE_NAMES[state.phase]}
          ${state.turn ? `<span class="turn">${state.turn === 'player' ? 'Your turn' : "AI Opponent's turn"}</span>` : ''}
          ${state.initiative ? `<span class="initiative">Initiative: ${state.players[state.initiative].name}</span>` : ''}
        </div>
        ${weatherPanel(state)}
        <div class="controls">${controls(state)}</div>
      </section>

      <section class="side player">
        ${pokemonRow(state, 'player')}
        ${locationRow(state, 'player')}
        ${trainerRow(state, 'player')}
        ${pileBar(me, false)}
        ${energyBar(me)}
        ${trainerTray(state)}
        <div class="hand">${handCards(state)}</div>
      </section>
    </div>

    <aside class="log">
      <h3>Match log</h3>
      ${state.log.map((line) => `<p>${line}</p>`).join('')}
      <button data-action="new-game" class="secondary">New match</button>
    </aside>
    ${gameOverScreen(state)}
  `;

  const logEl = root.querySelector('.log');
  logEl.scrollTop = logEl.scrollHeight;
  wire(root, state, actions);
}

// --- Pieces ----------------------------------------------------------------

function pileBar(p, hideHand) {
  return `
    <div class="piles">
      <strong>${p.name}</strong>
      <span>Draw Pile: ${p.drawPile.length}</span>
      <span>Discard Pile: ${p.discard.length}</span>
      ${hideHand ? `<span>Hand: ${p.hand.length}</span>` : ''}
      <span>Released Pile: ${p.released.length}</span>
    </div>`;
}

function energyBar(p) {
  const exhaust = [...p.exhaust].sort((a, b) => a.position - b.position)
    .map((x) => `<span class="exhaust">P${x.position} → Round ${x.recoversRound}</span>`).join('');
  return `
    <div class="energy">
      <span>Base Energy: <strong>${p.baseEnergy}</strong></span>
      <span>Exert: <strong>${p.exertMax - p.exhaust.length}/${p.exertMax}</strong></span>
      <span>Exhaust: ${exhaust || '<strong>0</strong>'}</span>
      <span class="xp-pool">XP: <strong>${p.xp}</strong></span>
    </div>`;
}

const WEATHER_ICONS = { Rain: '☔', Sun: '☀' };

function weatherText(tokens) {
  return Object.entries(tokens ?? {}).map(([type, n]) => `<span class="weather-chip">${WEATHER_ICONS[type] ?? '☁'} ${n} ${type}</span>`).join(' ');
}

// Weather in play, both sides combined: each type's count, its brackets
// (reached ones lit), and the effects that apply, in plain words.
function weatherPanel(state) {
  if (!state.round) return '';
  const types = Object.entries(weatherState(state)).filter(([, w]) => w.count > 0);
  if (!types.length) return '<div class="weather-panel">Weather: <span class="weather-chip">none</span></div>';
  return `<div class="weather-panel" title="Weather Tokens in play: Locations and Pokémon, both sides">${types.map(([type, w]) => {
    const all = WEATHER[type].brackets.map((b) => `<span class="bracket${w.active.includes(b) ? ' on' : ''}${w.effective.includes(b) ? '' : ' replaced'}">${b.at}</span>`).join('');
    const effects = w.effective.map((b) => b.text).join(' ') || 'No effect yet.';
    return `<div class="weather-type"><b>${w.icon} ${type} ${w.count}</b> ${all} <span class="weather-effects">${effects}</span></div>`;
  }).join('')}</div>`;
}

// Weather's share of a stat, per type, e.g. ☔+1 ☀−1 (shown apart from other buffs).
function weatherTags(c, stat) {
  const byType = {};
  for (const mod of Object.values(c.weather ?? {})) byType[mod.type] = (byType[mod.type] ?? 0) + (mod[stat] ?? 0);
  return Object.entries(byType).filter(([, n]) => n)
    .map(([type, n]) => `<span class="wx-tag" title="${type}">${WEATHER[type].icon}${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`).join('');
}

function locationRow(state, who) {
  const p = state.players[who];
  const open = who === 'player' && ui.location ? locationSpaces(state, 'player') : [];
  return `<div class="location-row">${p.zones.map((z, zone) => {
    const target = open.includes(zone);
    return `<div class="location-space${target ? ' target' : ''}" data-owner="${who}" data-zone="${zone}">
      ${z.location ? locationCard(z.location) : `<span class="empty">${target ? 'Click to play here' : 'Location Space'}</span>`}
    </div>`;
  }).join('')}</div>`;
}

// A Location: in a Location space it shows its quest progress.
function locationCard(c, opts = {}) {
  const inPlay = c.progress !== undefined;
  return `<div class="card location rarity-${slug(c.rarity)}${stateClasses(opts)}" data-uid="${c.uid}" title="${c.name} (${c.rarity})&#10;Quest: ${c.quest.text}&#10;Reward: ${c.xp} XP&#10;${c.effectText}">
    ${payBadge(opts)}
    <div class="card-head"><span class="card-name">${c.name}</span><span class="xp-reward" title="XP Reward">${c.xp} XP</span></div>
    <div class="card-type">Location · ${weatherText(c.weatherTokens)}</div>
    ${!inPlay ? (c.image ? `<img class="card-art" src="${c.image}" alt="">` : '<div class="card-art location-art">Location</div>') : ''}
    <div class="card-line quest"><b>Quest:</b> ${c.quest.text}${inPlay ? ` <span class="progress">${c.quest.label} ${c.progress}/${c.quest.count}</span>` : ''}</div>
    <div class="card-line effect"><b>Reward:</b> ${c.effectText}</div>
  </div>`;
}

function trainerRow(state, who) {
  const p = state.players[who];
  const targets = targetKeys(state);
  const cells = p.zones.map((zone, i) => {
    let content = '<span class="empty">Trainer Space</span>';
    let cls = 'trainer-space';
    if (zone.trainer) {
      const usable = who === 'player' && isMyBattleTurn(state) && !ui.supporter && canUsePower(state, 'player', i);
      content = trainerCard(state, zone.trainer, { selectable: usable, selected: who === 'player' && ui.power === i });
      if (zone.trainer.strength <= 0) cls += ' down';
      if (targets.keys.has(key({ kind: 'trainer', owner: who, zone: i }))) cls += targets.cls;
    } else if (who === 'player' && state.phase === 'trainers') {
      const placed = ui.placing[i] && p.trainers.find((t) => t.uid === ui.placing[i]);
      content = placed ? trainerCard(state, placed) : '<span class="empty">Click to place</span>';
      cls += ' target';
    } else if (who === 'ai' && p.pending) {
      content = '<span class="face-down">Chosen</span>';
    }
    return `<div class="${cls}" data-owner="${who}" data-zone="${i}">${content}</div>`;
  });
  return `<div class="trainer-row">${cells.join('')}</div>`;
}

function pokemonRow(state, who) {
  const p = state.players[who];
  const placing = who === 'player' ? placingSpaces(state) : new Set();
  const targets = targetKeys(state);
  const myTurn = isMyBattleTurn(state) && !ui.supporter;
  return `<div class="pokemon-row">${p.zones.map((zone, z) => {
    const fallen = zone.trainer && isFallen(state, who, z);
    const zoneTarget = targets.keys.has(key({ kind: 'zone', owner: who, zone: z }));
    return `
    <div class="zone${fallen ? ' fallen' : ''}${zoneTarget ? ' zone-target' : ''}" data-owner="${who}" data-zone="${z}">
      <div class="zone-label">Zone ${z + 1}${fallen ? ' · Fallen: no new Pokémon' : ''}</div>
      <div class="spaces">${zone.pokemon.map((c, s) => {
        let cls = 'pokemon-space';
        if (placing.has(`${z}${s}`)) cls += ' target';
        if (targets.keys.has(key({ kind: 'pokemon', owner: who, zone: z, space: s }))) cls += targets.cls;
        const alert = c && isAlert(state, c);
        const opts = {
          alert,
          selectable: alert && who === 'player' && myTurn,
          selected: who === 'player' && ui.attacker?.zone === z && ui.attacker?.space === s,
        };
        return `<div class="${cls}" data-owner="${who}" data-zone="${z}" data-space="${s}">${c ? boardPokemon(c, opts) : ''}</div>`;
      }).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}

function handCards(state) {
  const me = state.players.player;
  const xpStep = state.phase === 'breakfast' && state.xpStep && !me.xpChoice;
  const mulligan = state.phase === 'breakfast' && !state.xpStep && state.round === 1 && !me.pending;
  const myTurn = isMyBattleTurn(state);
  const playable = myTurn
    ? [...playablePokemon(state, 'player'), ...playableStrategies(state, 'player'), ...playableSupporters(state, 'player'),
      ...playableLocations(state, 'player')].map((c) => c.uid) : [];
  return me.hand.map((c) => {
    if (mulligan) return card(c, { selectable: true, selected: ui.mulligan.has(c.uid) });
    if (xpStep) {
      if (c.cardType !== 'Pokémon') return card(c);
      return card(c, { selectable: true, selected: ui.xpPick === c.uid, plan: plannedXp(c.uid) });
    }
    if (state.pending?.uid === c.uid) return card(c, { selected: true });
    if (ui.supporter) {
      // Paying for a Supporter: every other card can be marked Discard or Release.
      if (c.uid === ui.supporter.uid) return card(c, { selectable: true, selected: true });
      const pay = ui.supporter.discard.includes(c.uid) ? 'discard' : ui.supporter.release.includes(c.uid) ? 'release' : null;
      return card(c, { selectable: !ui.supporter.picking, pay });
    }
    if (myTurn && ['Pokémon', 'Strategy', 'Supporter', 'Location'].includes(c.cardType)) {
      return playable.includes(c.uid)
        ? card(c, { selectable: true, selected: [ui.selectedPokemon, ui.strategy, ui.location].includes(c.uid) })
        : card(c, { unavailable: true });
    }
    return card(c);
  }).join('');
}

function trainerTray(state) {
  if (state.phase !== 'trainers' || state.players.player.pending) return '';
  const unplaced = state.players.player.trainers.filter((t) => !ui.placing.includes(t.uid));
  if (!unplaced.length) return '';
  return `<div class="tray"><span>Your Trainers — pick one, then click a Trainer Space:</span>
    ${unplaced.map((t) => trainerCard(state, t, { selectable: true, selected: ui.selectedTrainer === t.uid })).join('')}</div>`;
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

function slug(text) {
  return text.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();
}

function stateClasses({ selectable, selected, unavailable, pay }) {
  return `${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${unavailable ? ' unavailable' : ''}${pay ? ` pay-${pay}` : ''}`;
}

// Marks a hand card chosen to pay a Supporter's Card-Cost.
function payBadge({ pay }) {
  if (pay === 'discard') return '<div class="pay-badge discard">Discard</div>';
  if (pay === 'release') return '<div class="pay-badge release">Release · gone for the match</div>';
  return '';
}

function card(c, opts = {}) {
  if (c.cardType === 'Pokémon') return pokemonCard(c, opts);
  if (c.cardType === 'Strategy') return strategyCard(c, opts);
  if (c.cardType === 'Supporter') return supporterCard(c, opts);
  if (c.cardType === 'Location') return locationCard(c, opts);
  return `<div class="card type-${slug(c.cardType)}${stateClasses(opts)}" data-uid="${c.uid}">
    ${payBadge(opts)}
    <div class="card-type">${c.cardType}</div>
    <div class="card-name">${c.name}</div>
  </div>`;
}

function costText({ discard, release }) {
  return [discard && `Discard ${discard}`, release && `Release ${release}`].filter(Boolean).join(', ');
}

function supporterCard(c, opts) {
  return `<div class="card supporter rarity-${slug(c.rarity)}${stateClasses(opts)}" data-uid="${c.uid}" title="${c.name} (${c.rarity})&#10;Card-Cost: ${costText(c.cardCost)}&#10;${c.effectText}&#10;Gift Bonus Challenge: ${c.gift.challengeText}&#10;Gift Bonus: ${c.gift.bonusText}">
    ${payBadge(opts)}
    <div class="card-head"><span class="card-name">${c.name}</span></div>
    <div class="card-type">Supporter · <span class="card-cost">${costText(c.cardCost)}</span></div>
    ${c.image ? `<img class="card-art" src="${c.image}" alt="">` : '<div class="card-art supporter-art">Supporter</div>'}
    <div class="card-line effect">${c.effectText}</div>
    <div class="card-line gift"><b>Gift:</b> ${c.gift.challengeText} → ${c.gift.bonusText}</div>
    <div class="card-line rarity">${c.rarity}</div>
  </div>`;
}

function strategyCard(c, opts) {
  return `<div class="card strategy rarity-${slug(c.rarity)}${stateClasses(opts)}" data-uid="${c.uid}" title="${c.name} (${c.rarity})&#10;Energy Cost: ${c.energyCost}&#10;${c.effectText}">
    ${payBadge(opts)}
    <div class="card-head"><span class="card-name">${c.name}</span><span class="cost" title="Energy Cost">${c.energyCost}</span></div>
    <div class="card-type">Strategy</div>
    ${c.image ? `<img class="card-art" src="${c.image}" alt="">` : '<div class="card-art strategy-art">Strategy</div>'}
    <div class="card-line effect">${c.effectText}</div>
    <div class="card-line rarity">${c.rarity}</div>
  </div>`;
}

function trainerCard(state, t, opts = {}) {
  const used = t.powerUsedRound === state.round;
  const removed = t.strength <= 0;
  return `<div class="card trainer${stateClasses(opts)}" data-uid="${t.uid}">
    <div class="card-head"><span class="card-name">${t.name}</span>
      <span class="trainer-strength">${removed ? 'Removed' : `Strength ${t.strength}/${t.maxStrength}`}</span></div>
    <div class="card-line power-line${used ? ' used' : ''}"><b>Power (${t.power.cost}):</b> ${t.power.text}${used ? ' <i>Used this Round</i>' : ''}</div>
    <div class="card-line"><b>Passive:</b> ${t.passive.text}</div>
  </div>`;
}

function art(c) {
  return c.image
    ? `<img class="card-art" src="${c.image}" alt="">`
    : `<div class="card-art ptype-${slug(c.pokemonType)}">${c.pokemonType}</div>`;
}

// Full Pokémon card, with every field.
// XP planned for a card during the XP step, before locking in.
function plannedXp(uid) {
  const plan = { attack: 0, strength: 0 };
  for (const p of ui.xpPlan) if (p.uid === uid) plan[p.stat] += 1;
  return plan;
}

function pokemonCard(c, opts) {
  // XP already on the card in hand, plus any still being planned (shown in green).
  const xpAtk = (c.xp?.attack ?? 0) + (opts.plan?.attack ?? 0);
  const xpStr = (c.xp?.strength ?? 0) + (opts.plan?.strength ?? 0);
  const xpTag = (n) => (n ? ` <span class="xp-tag">(+${n} XP)</span>` : '');
  return `<div class="card pokemon rarity-${slug(c.rarity)}${stateClasses(opts)}" data-uid="${c.uid}" title="${tooltip(c)}">
    ${payBadge(opts)}
    <div class="card-head"><span class="card-name">${c.name}</span><span class="cost" title="Energy Cost">${c.energyCost}</span></div>
    <div class="card-type">Pokémon · ${c.pokemonType}</div>
    ${art(c)}
    <div class="stats">
      <span>${c.attackType} <b class="${xpAtk ? 'buffed' : ''}">${c.attackValue + xpAtk}</b>${xpTag(xpAtk)}</span>
      <span>${c.strengthType} <b class="${xpStr ? 'buffed' : ''}">${c.strengthValue + xpStr}</b>${xpTag(xpStr)}</span>
    </div>
    <div class="card-line">Speed: ${c.speedTier}</div>
    ${c.innatePower ? `<div class="card-line keyword" title="${INNATE_POWERS[c.innatePower] ?? ''}">${c.innatePower}</div>` : ''}
    ${c.effectText ? `<div class="card-line effect"><b>${c.effectTrigger}:</b> ${c.effectText}</div>` : ''}
    ${c.weatherTokens ? `<div class="card-line weather">Weather: ${weatherText(c.weatherTokens)}</div>` : ''}
    <div class="card-line rarity">${c.rarity}</div>
  </div>`;
}

// Compact Pokémon in a Pokémon Space; all fields are in the tooltip.
// Stats above the printed values show in green.
function boardPokemon(c, { alert, ...opts } = {}) {
  const atk = attackOf(c);
  const max = maxStrengthOf(c);
  return `<div class="card pokemon board rarity-${slug(c.rarity)}${c.spent ? ' spent' : ''}${alert ? ' alert' : ''}${stateClasses(opts)}" title="${tooltip(c)}">
    <div class="card-head"><span class="card-name">${c.name}</span><span class="cost">${c.energyCost}</span></div>
    <div class="card-type">${c.pokemonType}</div>
    <div class="stats">
      <span title="${c.attackType} (printed ${c.attackValue})">${c.attackType === 'Physical' ? 'Phys' : 'Spec'} <b class="${atk > c.attackValue ? 'buffed' : atk < c.attackValue ? 'nerfed' : ''}">${atk}</b>${weatherTags(c, 'attack')}</span>
      <span title="Current / maximum ${c.strengthType} (printed ${c.strengthValue})">Str <b>${c.currentStrength}</b>/<b class="${max > c.strengthValue ? 'buffed' : ''}">${max}</b>${weatherTags(c, 'strength')}</span>
    </div>
    <div class="card-line">${c.speedTier}</div>
    ${c.effectTrigger ? `<div class="card-line" title="${c.effectText}"><b>${c.effectTrigger}</b></div>` : ''}
    ${c.spent ? '<div class="spent-badge">Spent</div>' : ''}
    ${alert ? '<div class="alert-badge">Alert</div>' : ''}
  </div>`;
}

function tooltip(c) {
  const inPlay = c.currentStrength !== undefined;
  return [
    `${c.name} (${c.rarity})`,
    `Card-Type: Pokémon · Pokémon Type: ${c.pokemonType}`,
    `Energy Cost: ${c.energyCost}`,
    `Attack: ${c.attackType} ${inPlay ? attackOf(c) : c.attackValue}${inPlay && attackOf(c) !== c.attackValue ? ` (printed ${c.attackValue})` : ''}`,
    `Strength: ${c.strengthType} ${inPlay ? `${c.currentStrength}/${maxStrengthOf(c)}` : c.strengthValue}${inPlay && maxStrengthOf(c) !== c.strengthValue ? ` (printed ${c.strengthValue})` : ''}`,
    `Speed-Tier: ${c.speedTier}`,
    c.innatePower && `Innate Power: ${c.innatePower}${INNATE_POWERS[c.innatePower] ? ` (${INNATE_POWERS[c.innatePower]})` : ''}`,
    c.effectText && `${c.effectTrigger}: ${c.effectText}`,
    c.weatherTokens && `Weather Tokens: ${Object.entries(c.weatherTokens).map(([t, n]) => `${n} ${t}`).join(', ')}`,
    c.spent && 'Spent',
  ].filter(Boolean).join('\n').replace(/"/g, '&quot;');
}

function controls(state) {
  const me = state.players.player;
  // An ability waiting for my target, in any phase.
  if (state.pending?.who === 'player' && state.pending.kind === 'target') {
    return `<span class="hint"><b>${state.pending.label}:</b> ${state.pending.text ?? ''} Choose a highlighted target.</span>`;
  }
  switch (state.phase) {
    case 'trainers': {
      if (me.pending) return '<span>Waiting for opponent…</span>';
      const ready = ui.placing.every(Boolean);
      return `<button data-action="lock-trainers" ${ready ? '' : 'disabled'}>Lock in &amp; reveal Trainers</button>`;
    }
    case 'initiative':
      return '<button data-action="flip">Flip coin</button>';
    case 'breakfast': {
      if (state.xpStep) {
        if (me.xpChoice) return '<span>Waiting for opponent…</span>';
        const left = me.xp - ui.xpPlan.length;
        const pick = ui.xpPick && me.hand.find((c) => c.uid === ui.xpPick);
        return `<span class="hint"><b>Spend XP</b> (${left} of ${me.xp} left): each point gives a Pokémon in hand +1 Attack or +1 Strength.
          ${pick ? `${pick.name}:` : 'Click a Pokémon in your hand.'}</span>
          ${pick ? `<button data-action="xp-attack" ${left ? '' : 'disabled'}>+1 Attack</button>
            <button data-action="xp-strength" ${left ? '' : 'disabled'}>+1 Strength</button>` : ''}
          <button data-action="xp-undo" class="secondary" ${ui.xpPlan.length ? '' : 'disabled'}>Undo</button>
          <button data-action="xp-lock">Lock in${ui.xpPlan.length ? ` (${ui.xpPlan.length} XP)` : ' (keep XP)'}</button>`;
      }
      if (me.pending) return '<span>Waiting for opponent…</span>';
      const n = ui.mulligan.size;
      return `<span class="hint">Click cards in your hand to mark them for mulligan.</span>
        <button data-action="mulligan">${n ? `Mulligan ${n} card${n === 1 ? '' : 's'}` : 'Keep hand'}</button>`;
    }
    case 'battle': {
      if (state.pending?.who === 'player' && state.pending.kind === 'freeSummon') {
        const c = me.hand.find((h) => h.uid === state.pending.uid);
        return `<span class="hint">Ash drew ${c.name}: click a highlighted space to summon it for free, or keep it.</span>
          <button data-action="keep-card" class="secondary">Keep in hand</button>`;
      }
      if (state.turn !== 'player' || state.pending) return '<span>Waiting for opponent…</span>';
      const pass = '<button data-action="pass">Pass</button>';
      const paying = supporterChoice(state);
      if (paying) {
        const { card: c, exact, gift } = paying;
        const cancel = '<button data-action="cancel-supporter" class="secondary">Cancel</button>';
        if (ui.supporter.picking) return `<span class="hint">${c.name}: click a highlighted target.</span>${cancel}`;
        return `<span class="hint"><b>${c.name}</b>: click hand cards to pay (click again: Discard → Release → none).
          ${[c.cardCost.discard && `Discard ${ui.supporter.discard.length}/${c.cardCost.discard}`,
    c.cardCost.release && `<span class="release-count">Release ${ui.supporter.release.length}/${c.cardCost.release}</span>`].filter(Boolean).join(' · ')} ·
          Gift (${c.gift.challengeText}): <span class="gift-status ${gift ? 'met' : ''}">${gift ? '✓ met' : 'not met'}</span></span>
          <button data-action="confirm-supporter" ${exact ? '' : 'disabled'}>Confirm</button>${cancel}`;
      }
      if (ui.power !== null) {
        const t = me.zones[ui.power].trainer;
        if (powerTargets(state, 'player', ui.power).length) {
          return `<span class="hint">${t.name}'s Power: click a highlighted target, or click ${t.name} again to cancel.</span>${pass}`;
        }
        return `<span class="hint">${t.name}'s Power: ${t.power.text}</span>
          <button data-action="use-power">Use Power (${t.power.cost})</button>${pass}`;
      }
      const strategy = ui.strategy && me.hand.find((c) => c.uid === ui.strategy);
      const hint = ui.location ? 'Click one of your highlighted Location spaces (playing on a Location replaces it), or click the card again to cancel.'
        : ui.selectedPokemon ? 'Click a highlighted empty space to play it, or click the card again to cancel.'
        : ui.attacker ? 'Click a highlighted enemy Pokémon or Trainer to attack, or click your Pokémon again to cancel.'
          : strategy ? `${strategy.name}: click a highlighted target, or click the card again to cancel.`
            : 'Play a card from your hand, attack with an Alert Pokémon, use a Trainer Power, or Pass.';
      return `<span class="hint">${hint}</span>${pass}`;
    }
    case 'gameOver':
      return `<span>${state.winner ? `${state.players[state.winner].name} ${state.winner === 'player' ? 'win' : 'wins'}!` : 'Draw.'}</span>`;
    default:
      return '';
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
      const owner = el.dataset.owner;
      usePower(isTrainer ? { kind: 'trainer', owner, zone } : { kind: 'pokemon', owner, zone, space: Number(el.dataset.space) });
    } else if (ui.strategy) {
      if (!confirmExert(costPreview(state, 'player', ui.strategy).fromExert)) return;
      dispatch({ type: 'playStrategy', who: 'player', uid: ui.strategy, target: ref });
    } else if (ui.supporter?.picking) {
      playSupporter(ref);
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
