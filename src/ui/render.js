// Draws the current game state and turns clicks into actions.
// Reads state only; all rule changes go through the engine.

import { ZONES } from '../engine/game.js';

// Choices the player is still making before they lock in. Reset whenever the phase changes.
const ui = { phase: null, placing: null, selectedTrainer: null, mulligan: new Set() };

function resetUiFor(state) {
  if (ui.phase === state.phase) return;
  ui.phase = state.phase;
  ui.placing = Array(ZONES).fill(null);
  ui.selectedTrainer = null;
  ui.mulligan = new Set();
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
  const me = state.players.player;
  const them = state.players.ai;

  root.innerHTML = `
    <div class="board">
      <section class="side opponent">
        ${pileBar(them, true)}
        ${energyBar(them)}
        ${trainerRow(state, 'ai')}
        ${pokemonRow(them)}
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
        ${pokemonRow(me)}
        ${trainerRow(state, 'player')}
        ${pileBar(me, false)}
        ${energyBar(me)}
        ${trainerTray(state)}
        <div class="hand">${me.hand.map((c) => card(c, {
          selectable: state.phase === 'breakfast' && state.round === 1 && !me.pending,
          selected: ui.mulligan.has(c.uid),
        })).join('')}</div>
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

function pokemonRow(p) {
  return `<div class="pokemon-row">${p.zones.map((zone, z) => `
    <div class="zone">
      <div class="zone-label">Zone ${z + 1}</div>
      <div class="spaces">${zone.pokemon.map((c) =>
        `<div class="pokemon-space">${c ? card(c) : ''}</div>`).join('')}</div>
    </div>`).join('')}</div>`;
}

function trainerTray(state) {
  if (state.phase !== 'trainers' || state.players.player.pending) return '';
  const unplaced = state.players.player.trainers.filter((t) => !ui.placing.includes(t.uid));
  if (!unplaced.length) return '';
  return `<div class="tray"><span>Your Trainers — pick one, then click a Trainer Space:</span>
    ${unplaced.map((t) => card(t, { selectable: true, selected: ui.selectedTrainer === t.uid })).join('')}</div>`;
}

function card(c, { selectable = false, selected = false } = {}) {
  const typeClass = `type-${c.type.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`;
  return `<div class="card ${typeClass}${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}" data-uid="${c.uid}">
    <div class="card-type">${c.type}</div>
    <div class="card-name">${c.name}</div>
    ${c.strength !== undefined ? `<div class="card-stat">Strength ${c.strength}</div>` : ''}
  </div>`;
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
      return '<span class="hint">Pass is the only Action so far.</span><button data-action="pass">Pass</button>';
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

  // Mulligan selection.
  root.querySelectorAll('.hand .card.selectable').forEach((el) => {
    el.onclick = () => {
      const uid = el.dataset.uid;
      ui.mulligan.has(uid) ? ui.mulligan.delete(uid) : ui.mulligan.add(uid);
      redraw();
    };
  });
}
