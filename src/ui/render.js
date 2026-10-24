// Draws the current game state and turns clicks into actions.
// Reads state only; all rule changes go through the engine.

import {
  ZONES, playablePokemon, costPreview, isAlert, legalTargets, canUsePower, powerTargets,
  summonSpaces, isFallen, attackOf, maxStrengthOf,
} from '../engine/game.js';

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
}

function clearSelection() {
  ui.selectedPokemon = null;
  ui.attacker = null;
  ui.power = null;
}

const key = (ref) => (ref.kind === 'trainer' ? `${ref.owner}:T${ref.zone}` : `${ref.owner}:P${ref.zone}${ref.space}`);

// Cards that can be clicked as the target of the current choice, as keys.
function targetKeys(state) {
  if (ui.attacker) {
    return new Set(legalTargets(state, 'player', ui.attacker).map((t) => key({ ...t, owner: 'ai' })));
  }
  if (ui.power !== null) return new Set(powerTargets(state, 'player', ui.power).map(key));
  return new Set();
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
        ${pokemonRow(state, 'ai')}
      </section>

      <section class="status">
        <div class="phase">
          ${state.round ? `Round ${state.round} · ` : ''}${PHASE_NAMES[state.phase]}
          ${state.turn ? `<span class="turn">${state.turn === 'player' ? 'Your turn' : "AI Opponent's turn"}</span>` : ''}
          ${state.initiative ? `<span class="initiative">Initiative: ${state.players[state.initiative].name}</span>` : ''}
        </div>
        <div class="controls">${controls(state)}</div>
      </section>

      <section class="side player">
        ${pokemonRow(state, 'player')}
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
    </div>`;
}

function trainerRow(state, who) {
  const p = state.players[who];
  const targets = targetKeys(state);
  const cells = p.zones.map((zone, i) => {
    let content = '<span class="empty">Trainer Space</span>';
    let cls = 'trainer-space';
    if (zone.trainer) {
      const usable = who === 'player' && isMyBattleTurn(state) && canUsePower(state, 'player', i);
      content = trainerCard(state, zone.trainer, { selectable: usable, selected: who === 'player' && ui.power === i });
      if (zone.trainer.strength <= 0) cls += ' down';
      if (targets.has(key({ kind: 'trainer', owner: who, zone: i }))) cls += who === 'ai' ? ' attack-target' : ' power-target';
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
  const myTurn = isMyBattleTurn(state);
  return `<div class="pokemon-row">${p.zones.map((zone, z) => {
    const fallen = zone.trainer && isFallen(state, who, z);
    return `
    <div class="zone${fallen ? ' fallen' : ''}">
      <div class="zone-label">Zone ${z + 1}${fallen ? ' · Fallen: no new Pokémon' : ''}</div>
      <div class="spaces">${zone.pokemon.map((c, s) => {
        let cls = 'pokemon-space';
        if (placing.has(`${z}${s}`)) cls += ' target';
        if (targets.has(key({ kind: 'pokemon', owner: who, zone: z, space: s }))) cls += who === 'ai' ? ' attack-target' : ' power-target';
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
  const mulligan = state.phase === 'breakfast' && state.round === 1 && !me.pending;
  const myTurn = isMyBattleTurn(state);
  const playable = myTurn ? playablePokemon(state, 'player').map((c) => c.uid) : [];
  return me.hand.map((c) => {
    if (mulligan) return card(c, { selectable: true, selected: ui.mulligan.has(c.uid) });
    if (state.pending?.uid === c.uid) return card(c, { selected: true });
    if (myTurn && c.cardType === 'Pokémon') {
      return playable.includes(c.uid)
        ? card(c, { selectable: true, selected: ui.selectedPokemon === c.uid })
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

function stateClasses({ selectable, selected, unavailable }) {
  return `${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${unavailable ? ' unavailable' : ''}`;
}

function card(c, opts = {}) {
  if (c.cardType === 'Pokémon') return pokemonCard(c, opts);
  return `<div class="card type-${slug(c.cardType)}${stateClasses(opts)}" data-uid="${c.uid}">
    <div class="card-type">${c.cardType}</div>
    <div class="card-name">${c.name}</div>
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
function pokemonCard(c, opts) {
  return `<div class="card pokemon rarity-${slug(c.rarity)}${stateClasses(opts)}" data-uid="${c.uid}" title="${tooltip(c)}">
    <div class="card-head"><span class="card-name">${c.name}</span><span class="cost" title="Energy Cost">${c.energyCost}</span></div>
    <div class="card-type">Pokémon · ${c.pokemonType}</div>
    ${art(c)}
    <div class="stats">
      <span>${c.attackType} <b>${c.attackValue}</b></span>
      <span>${c.strengthType} <b>${c.strengthValue}</b></span>
    </div>
    <div class="card-line">Speed: ${c.speedTier}</div>
    ${c.innatePower ? `<div class="card-line keyword">${c.innatePower}</div>` : ''}
    ${c.effectText ? `<div class="card-line effect"><b>${c.effectTrigger}:</b> ${c.effectText}</div>` : ''}
    ${c.weatherToken ? `<div class="card-line weather">☁ ${c.weatherToken}</div>` : ''}
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
      <span title="${c.attackType} (printed ${c.attackValue})">${c.attackType === 'Physical' ? 'Phys' : 'Spec'} <b class="${atk > c.attackValue ? 'buffed' : ''}">${atk}</b></span>
      <span title="Current / maximum ${c.strengthType} (printed ${c.strengthValue})">Str <b>${c.currentStrength}</b>/<b class="${max > c.strengthValue ? 'buffed' : ''}">${max}</b></span>
    </div>
    <div class="card-line">${c.speedTier}</div>
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
    c.innatePower && `Innate Power: ${c.innatePower}`,
    c.effectText && `${c.effectTrigger}: ${c.effectText}`,
    c.weatherToken && `Weather Token: ${c.weatherToken}`,
    c.spent && 'Spent',
  ].filter(Boolean).join('\n').replace(/"/g, '&quot;');
}

function controls(state) {
  const me = state.players.player;
  switch (state.phase) {
    case 'trainers': {
      if (me.pending) return '<span>Waiting for opponent…</span>';
      const ready = ui.placing.every(Boolean);
      return `<button data-action="lock-trainers" ${ready ? '' : 'disabled'}>Lock in &amp; reveal Trainers</button>`;
    }
    case 'initiative':
      return '<button data-action="flip">Flip coin</button>';
    case 'breakfast': {
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
      if (ui.power !== null) {
        const t = me.zones[ui.power].trainer;
        if (powerTargets(state, 'player', ui.power).length) {
          return `<span class="hint">${t.name}'s Power: click a highlighted target, or click ${t.name} again to cancel.</span>${pass}`;
        }
        return `<span class="hint">${t.name}'s Power: ${t.power.text}</span>
          <button data-action="use-power">Use Power (${t.power.cost})</button>${pass}`;
      }
      const hint = ui.selectedPokemon ? 'Click a highlighted empty space to play it, or click the card again to cancel.'
        : ui.attacker ? 'Click a highlighted enemy Pokémon or Trainer to attack, or click your Pokémon again to cancel.'
          : 'Play a Pokémon from your hand, attack with an Alert Pokémon, use a Trainer Power, or Pass.';
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

  // Hand clicks: mark for mulligan in Breakfast, or pick a Pokémon to play in Battle.
  on('.hand .card.selectable', (el) => {
    const uid = el.dataset.uid;
    if (state.phase === 'breakfast') {
      ui.mulligan.has(uid) ? ui.mulligan.delete(uid) : ui.mulligan.add(uid);
    } else {
      const again = ui.selectedPokemon === uid;
      clearSelection();
      ui.selectedPokemon = again ? null : uid;
    }
    redraw();
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

  // Clicking a highlighted target: an attack, or a Power's target.
  on('.attack-target, .power-target', (el) => {
    const zone = Number(el.dataset.zone);
    const isTrainer = el.classList.contains('trainer-space');
    if (ui.attacker) {
      const target = isTrainer ? { kind: 'trainer', zone } : { kind: 'pokemon', zone, space: Number(el.dataset.space) };
      dispatch({ type: 'command', who: 'player', from: ui.attacker, target });
    } else if (ui.power !== null) {
      const owner = el.dataset.owner;
      usePower(isTrainer ? { kind: 'trainer', owner, zone } : { kind: 'pokemon', owner, zone, space: Number(el.dataset.space) });
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
