// Draws the current game state and turns clicks into actions.
// Reads state only; all rule changes go through the engine.

import { ZONES, playablePokemon, costPreview } from '../engine/game.js';

// Choices the player is still making before they lock in. Reset whenever the
// game state changes (the engine returns a new state object for every action).
const ui = { state: null, placing: null, selectedTrainer: null, mulligan: new Set(), selectedPokemon: null };

function resetUiFor(state) {
  if (ui.state === state) return;
  ui.state = state;
  ui.placing = Array(ZONES).fill(null);
  ui.selectedTrainer = null;
  ui.mulligan = new Set();
  ui.selectedPokemon = null;
}

const isMyBattleTurn = (state) => state.phase === 'battle' && state.turn === 'player';

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
  const cells = p.zones.map((zone, i) => {
    let content = '<span class="empty">Trainer Space</span>';
    let cls = 'trainer-space';
    if (zone.trainer) {
      content = card(zone.trainer);
    } else if (who === 'player' && state.phase === 'trainers') {
      const placed = ui.placing[i] && p.trainers.find((t) => t.uid === ui.placing[i]);
      content = placed ? card(placed) : '<span class="empty">Click to place</span>';
      cls += ' target';
    } else if (who === 'ai' && p.pending) {
      content = '<span class="face-down">Chosen</span>';
    }
    return `<div class="${cls}" data-zone="${i}">${content}</div>`;
  });
  return `<div class="trainer-row">${cells.join('')}</div>`;
}

function pokemonRow(state, who) {
  const p = state.players[who];
  const placing = who === 'player' && ui.selectedPokemon;
  return `<div class="pokemon-row">${p.zones.map((zone, z) => `
    <div class="zone">
      <div class="zone-label">Zone ${z + 1}</div>
      <div class="spaces">${zone.pokemon.map((c, s) => {
        const target = placing && !c;
        return `<div class="pokemon-space${target ? ' target' : ''}" data-zone="${z}" data-space="${s}">${c ? boardPokemon(c) : ''}</div>`;
      }).join('')}</div>
    </div>`).join('')}</div>`;
}

function handCards(state) {
  const me = state.players.player;
  const mulligan = state.phase === 'breakfast' && state.round === 1 && !me.pending;
  const myTurn = isMyBattleTurn(state);
  const playable = myTurn ? playablePokemon(state, 'player').map((c) => c.uid) : [];
  return me.hand.map((c) => {
    if (mulligan) return card(c, { selectable: true, selected: ui.mulligan.has(c.uid) });
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
    ${unplaced.map((t) => card(t, { selectable: true, selected: ui.selectedTrainer === t.uid })).join('')}</div>`;
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
    ${c.strength !== undefined ? `<div class="card-stat">Strength ${c.strength}</div>` : ''}
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
function boardPokemon(c) {
  return `<div class="card pokemon board rarity-${slug(c.rarity)}${c.spent ? ' spent' : ''}" title="${tooltip(c)}">
    <div class="card-head"><span class="card-name">${c.name}</span><span class="cost">${c.energyCost}</span></div>
    <div class="card-type">${c.pokemonType}</div>
    <div class="stats">
      <span title="${c.attackType}">${c.attackType === 'Physical' ? 'Phys' : 'Spec'} <b>${c.attackValue}</b></span>
      <span title="Current / printed ${c.strengthType}">Str <b>${c.currentStrength}/${c.strengthValue}</b></span>
    </div>
    ${c.spent ? '<div class="spent-badge">Spent</div>' : ''}
  </div>`;
}

function tooltip(c) {
  return [
    `${c.name} (${c.rarity})`,
    `Card-Type: Pokémon · Pokémon Type: ${c.pokemonType}`,
    `Energy Cost: ${c.energyCost}`,
    `Attack: ${c.attackType} ${c.attackValue}`,
    `Strength: ${c.strengthType} ${c.currentStrength ?? c.strengthValue}/${c.strengthValue}`,
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
    case 'battle':
      if (state.turn !== 'player') return '<span>Waiting for opponent…</span>';
      return `<span class="hint">${ui.selectedPokemon
        ? 'Click a highlighted empty space to play it, or click the card again to cancel.'
        : 'Click a Pokémon in your hand to play it, or Pass.'}</span><button data-action="pass">Pass</button>`;
    case 'gameOver':
      return `<span>${state.players[state.winner].name} ${state.winner === 'player' ? 'win' : 'wins'}!</span>`;
    default:
      return '';
  }
}

// --- Clicks -----------------------------------------------------------------

function wire(root, state, { dispatch, newGame }) {
  const redraw = () => render(root, state, { dispatch, newGame });

  root.querySelector('[data-action="new-game"]').onclick = newGame;

  root.querySelector('[data-action="flip"]')?.addEventListener('click', () =>
    dispatch({ type: 'flipCoin' }));

  root.querySelector('[data-action="lock-trainers"]')?.addEventListener('click', () =>
    dispatch({ type: 'assignTrainers', who: 'player', order: [...ui.placing] }));

  root.querySelector('[data-action="pass"]')?.addEventListener('click', () =>
    dispatch({ type: 'pass', who: 'player' }));

  root.querySelector('[data-action="mulligan"]')?.addEventListener('click', () =>
    dispatch({ type: 'mulligan', who: 'player', cardUids: [...ui.mulligan] }));

  // Trainer placement: select from the tray, then click a space. Click a placed one to take it back.
  root.querySelectorAll('.tray .card').forEach((el) => {
    el.onclick = () => {
      ui.selectedTrainer = ui.selectedTrainer === el.dataset.uid ? null : el.dataset.uid;
      redraw();
    };
  });
  root.querySelectorAll('.player .trainer-space.target').forEach((el) => {
    el.onclick = () => {
      const zone = Number(el.dataset.zone);
      if (ui.selectedTrainer) {
        ui.placing[zone] = ui.selectedTrainer;
        ui.selectedTrainer = null;
      } else if (ui.placing[zone]) {
        ui.placing[zone] = null;
      }
      redraw();
    };
  });

  // Hand clicks: mark for mulligan in Breakfast, or pick a Pokémon to play in Battle.
  root.querySelectorAll('.hand .card.selectable').forEach((el) => {
    el.onclick = () => {
      const uid = el.dataset.uid;
      if (state.phase === 'breakfast') {
        ui.mulligan.has(uid) ? ui.mulligan.delete(uid) : ui.mulligan.add(uid);
      } else {
        ui.selectedPokemon = ui.selectedPokemon === uid ? null : uid;
      }
      redraw();
    };
  });

  // Play the selected Pokémon into an empty space. Using Exert needs a confirm.
  root.querySelectorAll('.player .pokemon-space.target').forEach((el) => {
    el.onclick = () => {
      const uid = ui.selectedPokemon;
      const { fromExert } = costPreview(state, 'player', uid);
      if (fromExert && !confirm(`This will use ${fromExert} Exert. Exert takes Rounds to recover. Play it?`)) return;
      dispatch({ type: 'playPokemon', who: 'player', uid, zone: Number(el.dataset.zone), space: Number(el.dataset.space) });
    };
  });
}
