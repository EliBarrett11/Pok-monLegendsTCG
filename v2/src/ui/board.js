// Drawing a v2 match (V1), in the approved look (docs/design/v2-board-concept.jpg):
// each player's Recognition on the left, two facing rows of 9 spaces on the leather
// mat (all Home lanes in V1), the side panel on the right (Round, Energy with
// stored Energy, Weather, what to do, Pass), and the fanned hand below.
// Pokémon use the minimal card style: Level badge, small Type icon, name, ⚔ and ♥.
//
// Clicks: a Pokémon in hand, then an empty space of your row, summons it; one of
// your Alert Pokémon, then a glowing target (an enemy Pokémon, or the Opponent's
// Recognition panel for the player character), attacks.
import {
  legalTargets, alertSpaces, playable, isAlert, passEndsPhase, passSpends, opponentOf,
} from '../engine/game.js';
import { RECOGNITION_TARGET, LANES } from '../engine/rules.js';

const ASSETS = '../assets';   // the shared art, from the page (v2/index.html)
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// A Pokémon card in the minimal style. opts: { cls, spent, alert, hurt, attrs }.
function pokemonCard(card, opts = {}) {
  const strength = card.currentStrength ?? card.strength;
  const cls = ['v2-card', opts.cls, card.spent && 'spent', opts.alert && 'alert'].filter(Boolean).join(' ');
  return `
    <div class="${cls}" ${opts.attrs ?? ''} title="${esc(`${card.name} · ${card.type} · ${card.attackType} ${card.attack} · ${card.strengthType} ${card.strength} · ${card.speed}${card.keywords?.length ? ` · ${card.keywords.join(', ')}` : ''}${card.retain ? ' · Retain' : ''}`)}">
      <div class="v2-art" style="background-image: url('${ASSETS}/cards/${card.id}.jpg')"></div>
      <span class="v2-level">Lv ${card.level}</span>
      <img class="v2-type" src="${ASSETS}/ui/icons/type-${slug(card.type)}.webp" alt="${card.type}">
      ${card.strengthType !== 'Hitpoints' ? `<span class="v2-guard">${card.strengthType === 'Defence' ? 'Def' : 'Sp. Def'}</span>` : ''}
      ${card.keywords?.length ? `<span class="v2-keys">${card.keywords.map((k) => `<i>${k}</i>`).join('')}</span>` : ''}
      ${card.cost !== undefined && opts.showCost ? `<span class="v2-cost">${card.cost}</span>` : ''}
      <div class="v2-name">${card.name}</div>
      <div class="v2-stats"><span>⚔ ${card.attack}</span><span class="${strength < card.strength ? 'hurt' : ''}">♥ ${strength}</span></div>
      ${card.spent ? '<span class="v2-spent">Spent</span>' : opts.alert ? '<span class="v2-alert">Alert</span>' : ''}
    </div>`;
}

function recognitionPanel(state, who, targetable) {
  const p = state.players[who];
  const pct = Math.min(100, (100 * p.recognition) / RECOGNITION_TARGET);
  const turn = state.phase === 'battle' && state.turn === who;
  return `
    <section class="v2-panel v2-recognition ${who === 'ai' ? 'top' : 'bottom'}${targetable ? ' target' : ''}${turn ? ' turn' : ''}" data-player="${who}">
      <div class="v2-avatar"></div>
      <h3>${who === 'ai' ? 'Opponent' : 'You'}</h3>
      <div class="v2-label">Recognition</div>
      <b class="v2-score">${p.recognition}</b>
      <div class="v2-of">of ${RECOGNITION_TARGET} to win</div>
      <div class="v2-bar"><i style="width: ${pct}%"></i></div>
      ${targetable ? '<div class="v2-target-tag">Attack the Opponent</div>' : ''}
    </section>`;
}

function row(state, who, ui, targets) {
  const mine = who === 'player';
  const p = state.players[who];
  const spaces = Array.from({ length: LANES }, (_, space) => {
    const card = p.row[space];
    const summonHere = mine && ui.summon && !card;
    const target = !mine && targets.some((t) => t.kind === 'pokemon' && t.space === space);
    const attacker = mine && ui.attacker === space;
    const cls = ['v2-space', summonHere && 'target', target && 'attack-target', attacker && 'selected'].filter(Boolean).join(' ');
    const alert = card && isAlert(state, card) && state.phase === 'battle';
    const canAct = mine && alert && state.turn === 'player' && !ui.locked;
    return `<div class="${cls}" data-who="${who}" data-space="${space}">${card ? pokemonCard(card, { alert, cls: canAct ? 'selectable' : '' }) : '<span>Home</span>'}</div>`;
  }).join('');
  return `<div class="v2-row ${who === 'ai' ? 'opponent' : 'player'}">${spaces}</div>`;
}

function sidePanel(state, ui, ctx) {
  const me = state.players.player;
  const myTurn = state.phase === 'battle' && state.turn === 'player' && !ui.locked;
  let hint = '';
  let button = '';
  if (state.phase === 'initiative') {
    hint = 'Flip a coin to decide who has initiative in Round 1.';
    button = '<button data-action="flip">Flip the coin</button>';
  } else if (state.phase === 'gameOver') {
    hint = state.winner === 'player' ? 'You reached 60 Recognition. You win!' : 'The Opponent reached 60 Recognition.';
    button = '<button data-action="new">New match</button>';
  } else if (myTurn) {
    hint = ui.summon ? 'Click an empty space in your row to summon it, or the card again to cancel.'
      : ui.attacker !== null ? 'Click a glowing target: an enemy Pokémon, or the Opponent (their Recognition panel).'
        : 'Your turn: summon a Pokémon from your hand, attack with an Alert Pokémon, or Pass.';
    const ends = passEndsPhase(state);
    const spends = passSpends(state, 'player').length;
    button = `<button data-action="pass" class="pass">Pass<small>${ends ? 'ends the Battle Phase' : `+1 Energy${spends ? ` · ${spends} become${spends === 1 ? 's' : ''} Spent` : ''}`}</small></button>`;
  } else hint = ctx.autoplay ? 'Autoplay: the AI plays both sides.' : 'The Opponent is thinking…';
  const recent = state.log.slice(-4).map((l) => `<p>${esc(l)}</p>`).join('');
  return `
    <aside class="v2-side">
      <section class="v2-panel"><div class="v2-label">Round</div><b class="v2-big">${state.round || '—'}</b>
        <p class="v2-note">${state.phase === 'battle' ? `Battle Phase · ${state.turn === 'player' ? 'your turn' : 'their turn'}` : state.phase === 'gameOver' ? 'Match over' : 'Setup'}</p></section>
      <section class="v2-panel"><div class="v2-label">Energy</div>
        <b class="v2-big">${me.energy} <small>/ ${me.roundEnergy}${me.stored ? ` · +${me.stored} stored` : ''}</small></b></section>
      <section class="v2-panel"><div class="v2-label">Weather</div><p class="v2-note">None yet (Locations bring it, V2)</p></section>
      <section class="v2-panel v2-act"><p class="v2-hint">${hint}</p>${button}</section>
      <section class="v2-panel v2-log">${recent}</section>
      <div class="v2-build">${ctx.build}</div>
    </aside>`;
}

function hand(state, ui) {
  const cards = state.players.player.hand;
  const can = new Set(state.phase === 'battle' && state.turn === 'player' && !ui.locked ? playable(state, 'player').map((c) => c.uid) : []);
  const n = cards.length;
  return `<div class="v2-hand">${cards.map((c, i) => {
    const angle = (i - (n - 1) / 2) * 4;
    const lift = Math.abs(i - (n - 1) / 2) * 6 - (ui.summon === c.uid ? 34 : 0);
    const cls = [can.has(c.uid) ? 'playable' : 'unaffordable', ui.summon === c.uid && 'picked'].filter(Boolean).join(' ');
    return `<div class="v2-hand-slot" style="transform: translateY(${lift}px) rotate(${angle}deg)">${pokemonCard(c, { cls, showCost: true, attrs: `data-uid="${c.uid}"` })}</div>`;
  }).join('')}</div>`;
}

function backs(n) {
  return `<div class="v2-opp-hand">${Array.from({ length: n }, () => `<i style="background-image: url('${ASSETS}/ui/card-back.jpg')"></i>`).join('')}<span>Hand ${n}</span></div>`;
}

function banner(state) {
  const last = [...state.events].reverse().find((e) => ['attack', 'summoned', 'pass', 'coinFlip', 'gameOver'].includes(e.type));
  const phase = state.phase === 'battle' ? `Round ${state.round} · Battle Phase` : state.phase === 'gameOver' ? 'Match over' : 'Setup';
  const line = state.log.at(-1) ?? '';
  return `<div class="v2-strip"><b>${phase}</b><span>${esc(last ? line : '')}</span></div>`;
}

function gameOver(state) {
  if (state.phase !== 'gameOver') return '';
  const won = state.winner === 'player';
  return `<div class="v2-over"><div class="v2-panel"><h2>${won ? 'Victory' : 'Defeat'}</h2>
    <p>${won ? 'You' : 'The Opponent'} reached ${RECOGNITION_TARGET} Recognition in Round ${state.round}.</p>
    <p>You ${state.players.player.recognition} · Opponent ${state.players.ai.recognition}</p>
    <button data-action="new">New match</button></div></div>`;
}

export function renderMatch(root, state, ui, ctx) {
  const targets = ui.attacker !== null && state.phase === 'battle' ? legalTargets(state, 'player', ui.attacker) : [];
  const playerTarget = targets.some((t) => t.kind === 'player');
  root.innerHTML = `
    <div class="v2-table">
      <header class="v2-title"><h1>Pokémon Legends v2</h1><p>${ctx.build} · <a href="../">the current game</a></p></header>
      ${backs(state.players.ai.hand.length)}
      ${recognitionPanel(state, 'ai', playerTarget)}
      ${recognitionPanel(state, 'player', false)}
      <section class="v2-board">
        <div class="v2-mat"></div>
        ${row(state, 'ai', ui, targets)}
        ${banner(state)}
        ${row(state, 'player', ui, targets)}
      </section>
      ${sidePanel(state, ui, ctx)}
      ${hand(state, ui)}
      <div class="v2-piles"><span>Draw ${state.players.player.drawPile.length}</span><span>Discard ${state.players.player.discard.length}</span><span>Released ${state.players.player.released.length}</span></div>
      ${gameOver(state)}
    </div>`;
  wire(root, state, ui, ctx);
}

function wire(root, state, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  on('[data-action="flip"]', () => ctx.act({ type: 'flipCoin' }));
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('[data-action="new"]', () => ctx.newMatch());
  if (!(state.phase === 'battle' && state.turn === 'player') || ui.locked) return;
  on('.v2-hand .v2-card.playable', (el) => {
    ui.attacker = null;
    ui.summon = ui.summon === el.dataset.uid ? null : el.dataset.uid;
    ctx.redraw();
  });
  on('.v2-row.player .v2-space.target', (el) => ctx.act({ type: 'summon', who: 'player', uid: ui.summon, space: Number(el.dataset.space) }));
  on('.v2-row.player .v2-card.selectable', (el) => {
    const space = Number(el.closest('.v2-space').dataset.space);
    ui.summon = null;
    ui.attacker = ui.attacker === space ? null : space;
    ctx.redraw();
  });
  on('.v2-space.attack-target', (el) => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'pokemon', space: Number(el.dataset.space) } }));
  on('.v2-recognition.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'player' } }));
}

export { alertSpaces, opponentOf };
