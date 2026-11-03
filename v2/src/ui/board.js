// Drawing a v2 match (V1 + V2), in the approved look (docs/design/v2-board-concept.jpg):
// each player's Recognition on the left, two facing rows of 9 spaces on the leather
// mat, Locations as coloured frames over their lanes on both sides with an
// objective banner in the middle (name, Weather, objective, both players' progress
// bars with milestone ticks, Rounds left), the side panel on the right (Round of 12,
// the Championship, Energy with stored Energy, Weather), and the fanned hand below.
// Pokémon use the minimal card style: Level badge, small Type icon, name, ⚔ and ♥.
//
// Clicks: a Pokémon in hand, then an empty space of your row, summons it (one with
// an Empowered summon asks whether to pay for its bonus); a
// Location in hand, then a glowing lane in the middle of the board, places it
// there (from that lane to the right); one of your Alert Pokémon, then a glowing
// target (an enemy Pokémon, or the Opponent's Recognition panel for the player
// character), attacks.
import {
  legalTargets, alertSpaces, playable, placeable, locationStarts, locationAt, weatherTotals, championship,
  isAlert, passEndsPhase, passSpends, opponentOf, summonCost,
} from '../engine/game.js';
import { RECOGNITION_TARGET, LANES, ROUND_LIMIT, CHAMPIONSHIP_ROUND } from '../engine/rules.js';
import { rewardText, lastsText } from '../engine/locations.js';
import { seriesDef, stagesText } from '../engine/series.js';

const ASSETS = '../assets';   // the shared art, from the page (v2/index.html)
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// A Pokémon card in the minimal style. opts: { cls, alert, attrs, showCost, inHand }.
// In hand the Level badge is its current Level (Round, up to its cap; the cap shows
// beside it); on the board, the Level it was played at.
function pokemonCard(card, opts = {}) {
  const strength = card.currentStrength ?? card.strength;
  const cls = ['v2-card', opts.cls, card.spent && 'spent', opts.alert && 'alert', card.empowered && 'empowered'].filter(Boolean).join(' ');
  const line = card.series ? seriesDef(card.series) : null;
  const tip = [
    `${card.name} · Level ${card.level}${card.cap ? ` (cap ${card.cap})` : ''}`, `${card.type} · ${card.attackType} ${card.attack} · ${card.strengthType} ${card.strength} · ${card.speed}`,
    line && `${stagesText(line)} · ${line.rarity}${line.weight !== 'standard' ? ` · ${line.weight}` : ''}`,
    card.keywords?.length && card.keywords.join(', '), card.retain && 'Retain', card.ability?.text, card.empower && `Empowered summon ${card.empower.text}`,
    card.empowered && 'Empowered',
  ].filter(Boolean).join('\n');
  const notes = [card.ability?.text, opts.inHand && card.empower && `Empower ${card.empower.text}`].filter(Boolean);
  return `
    <div class="${cls}" ${opts.attrs ?? ''} title="${esc(tip)}">
      <div class="v2-art" style="background-image: url('${ASSETS}/cards/${card.art ?? card.id}.jpg')"></div>
      <span class="v2-level">Lv ${card.level}${opts.inHand && card.cap > card.level ? `<small>/${card.cap}</small>` : ''}</span>
      <img class="v2-type" src="${ASSETS}/ui/icons/type-${slug(card.type)}.webp" alt="${card.type}">
      ${card.strengthType !== 'Hitpoints' ? `<span class="v2-guard">${card.strengthType === 'Defence' ? 'Def' : 'Sp. Def'}</span>` : ''}
      ${card.keywords?.length ? `<span class="v2-keys">${card.keywords.map((k) => `<i>${k}</i>`).join('')}</span>` : ''}
      ${card.cost !== undefined && opts.showCost ? `<span class="v2-cost">${card.cost}</span>` : ''}
      <div class="v2-name">${card.name}</div>
      ${notes.length ? `<div class="v2-ability">${notes.map(esc).join('<br>')}</div>` : ''}
      <div class="v2-stats"><span>⚔ ${card.attack}</span><span class="${strength < card.strength ? 'hurt' : ''}">♥ ${strength}</span></div>
      ${card.spent ? '<span class="v2-spent">Spent</span>' : opts.alert ? '<span class="v2-alert">Alert</span>' : ''}
      ${opts.badge ? `<span class="v2-flourish">${opts.badge}</span>` : ''}
    </div>`;
}

const weatherIcons = (weather = {}) => Object.entries(weather).filter(([, n]) => n)
  .map(([kind, n]) => `<span class="v2-wx"><img src="${ASSETS}/ui/icons/weather-${slug(kind)}.webp" alt="${kind}">${n}</span>`).join('');

// A Location card (in hand): its art, name, lanes and Rounds, Weather and objective.
function locationCard(card, opts = {}) {
  const cls = ['v2-card', 'v2-loc-card', opts.cls].filter(Boolean).join(' ');
  const goals = [...card.milestones.map((m) => `${m.at}: ${rewardText(m.reward)}`), `${card.objective.count}: ${rewardText(card.completion)}`].join(' · ');
  return `
    <div class="${cls}" ${opts.attrs ?? ''} style="--loc: ${card.color}" title="${esc(`${card.name} · Location · ${card.lanes} lane${card.lanes > 1 ? 's' : ''} · ${lastsText(card.rounds)} · ${card.objective.text} · ${goals}`)}">
      <div class="v2-art" style="background-image: url('${ASSETS}/cards/${card.id}.jpg')"></div>
      <span class="v2-level">Location</span>
      <span class="v2-loc-wx">${weatherIcons(card.weather)}</span>
      <div class="v2-name">${card.name}</div>
      <div class="v2-loc-meta">${card.lanes} lane${card.lanes > 1 ? 's' : ''} · ${lastsText(card.rounds)}</div>
      <div class="v2-loc-goal">${card.objective.text}</div>
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
    const loc = locationAt(state, space);
    const cls = ['v2-space', loc && 'in-loc', summonHere && 'target', target && 'attack-target', attacker && 'selected'].filter(Boolean).join(' ');
    const alert = card && isAlert(state, card) && state.phase === 'battle';
    const canAct = mine && alert && state.turn === 'player' && !ui.locked;
    const trained = card && state.events.find((e) => e.type === 'trained' && e.who === who && e.space === space);
    const cardCls = [canAct && 'selectable', trained && 'levelup'].filter(Boolean).join(' ');
    const face = card ? pokemonCard(card, { alert, cls: cardCls, badge: trained ? `Level ${trained.to}${trained.name !== trained.fromName ? ` · ${trained.name}!` : ''}` : '' }) : '';
    return `<div class="${cls}" data-who="${who}" data-space="${space}"${loc ? ` style="--loc: ${loc.color}"` : ''}>${face}</div>`;
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
    hint = resultLine(state);
    button = '<button data-action="new">New match</button>';
  } else if (myTurn) {
    hint = ui.summon ? 'Click an empty space in your row to summon it, or the card again to cancel.'
      : ui.location ? 'Click a glowing lane in the middle of the board: the Location covers it and the lanes to its right, on both sides.'
      : ui.attacker !== null ? 'Click a glowing target: an enemy Pokémon, or the Opponent (their Recognition panel).'
        : 'Your turn: summon a Pokémon, place a Location, attack with an Alert Pokémon, or Pass.';
    const ends = passEndsPhase(state);
    const spends = passSpends(state, 'player').length;
    button = `<button data-action="pass" class="pass">Pass<small>${ends ? 'ends the Battle Phase' : `+1 Energy${spends ? ` · ${spends} become${spends === 1 ? 's' : ''} Spent` : ''}`}</small></button>`;
  } else hint = ctx.autoplay ? 'Autoplay: the AI plays both sides.' : 'The Opponent is thinking…';
  const recent = state.log.slice(-4).map((l) => `<p>${esc(l)}</p>`).join('');
  return `
    <aside class="v2-side">
      <section class="v2-panel"><div class="v2-label">Round</div><b class="v2-big">${state.round || '—'} <small>of ${ROUND_LIMIT}${state.suddenDeath ? ' · sudden death' : ''}</small></b>
        <p class="v2-note">${state.phase === 'battle' ? `Battle Phase · ${state.turn === 'player' ? 'your turn' : 'their turn'}` : state.phase === 'gameOver' ? 'Match over' : 'Setup'}</p></section>
      ${champPanel(state)}
      <section class="v2-panel"><div class="v2-label">Energy</div>
        <b class="v2-big">${me.energy} <small>/ ${me.roundEnergy}${me.stored ? ` · +${me.stored} stored` : ''}${me.bonus ? ` · +${me.bonus} milestone` : ''}</small></b>
        ${me.bonusNext ? `<p class="v2-note">+${me.bonusNext} next Round</p>` : ''}</section>
      <section class="v2-panel"><div class="v2-label">Weather</div>${weatherPanel(state)}</section>
      <section class="v2-panel v2-act"><p class="v2-hint">${hint}</p>${button}</section>
      <section class="v2-panel v2-log">${recent}</section>
      <div class="v2-build">${ctx.build}</div>
    </aside>`;
}

function champPanel(state) {
  const champ = championship(state);
  let text;
  if (champ) text = `<b>Now</b>, over all 9 lanes: ${esc(champ.objective.text)}. ${champ.roundsLeft} Round${champ.roundsLeft === 1 ? '' : 's'} left.`;
  else if (state.phase === 'gameOver') text = 'The match ended before it arrived.';
  else text = `Arrives for both players in <b>Round ${CHAMPIONSHIP_ROUND}</b>: the final Location, over every lane, with the biggest Recognition rewards. Every other Location ends.`;
  return `<section class="v2-panel v2-champ${champ ? ' live' : ''}"><div class="v2-label">Championship</div><p>${text}</p></section>`;
}

function weatherPanel(state) {
  const totals = weatherTotals(state);
  const icons = ['Rain', 'Sun'].map((kind) => `<span class="v2-wx big"><img src="${ASSETS}/ui/icons/weather-${slug(kind)}.webp" alt="${kind}">${totals[kind] ?? 0}<small>${kind}</small></span>`).join('');
  return `<div class="v2-wx-row">${icons}</div><p class="v2-note">From the Locations in play (no effects yet).</p>`;
}

function hand(state, ui) {
  const cards = state.players.player.hand;
  const mine = state.phase === 'battle' && state.turn === 'player' && !ui.locked;
  const can = new Set(mine ? [...playable(state, 'player'), ...placeable(state, 'player')].map((c) => c.uid) : []);
  const n = cards.length;
  return `<div class="v2-hand">${cards.map((c, i) => {
    const picked = ui.summon === c.uid || ui.location === c.uid;
    const angle = (i - (n - 1) / 2) * 4;
    const lift = Math.abs(i - (n - 1) / 2) * 6 - (picked ? 34 : 0);
    const cls = [can.has(c.uid) ? 'playable' : 'unaffordable', picked && 'picked'].filter(Boolean).join(' ');
    const attrs = `data-uid="${c.uid}" data-kind="${c.cardType === 'Location' ? 'location' : 'pokemon'}"`;
    const up = state.events.find((e) => e.type === 'levelUp' && e.uid === c.uid);
    const face = c.cardType === 'Location' ? locationCard(c, { cls, attrs })
      : pokemonCard(c, { cls: [cls, up && 'levelup'].filter(Boolean).join(' '), showCost: true, inHand: true, attrs, badge: up ? `Evolved: ${up.to}!` : '' });
    return `<div class="v2-hand-slot" style="transform: translateY(${lift}px) rotate(${angle}deg)">${face}</div>`;
  }).join('')}</div>`;
}

// A progress bar for one player on a Location's objective, with milestone ticks.
function progressBar(loc, who) {
  const count = loc.objective.count;
  const n = loc.progress[who];
  const ticks = loc.milestones.map((m) => `<i class="tick${loc.reached[who].includes(m.at) ? ' hit' : ''}" style="left: ${(100 * m.at) / count}%" title="${m.at}: ${esc(rewardText(m.reward))}"></i>`).join('');
  return `<div class="v2-prog ${who}${loc.completed[who] ? ' done' : ''}"><span>${who === 'player' ? 'You' : 'Opp'}</span>
    <div class="v2-prog-bar"><b style="width: ${(100 * n) / count}%"></b>${ticks}</div><em>${n}/${count}${loc.completed[who] ? ' ✓' : ''}</em></div>`;
}

// The Location frames over their lanes (both rows), each with its banner in the
// middle of the board; the middle of Home lanes says Home. While a Location from
// hand is picked, the lanes it can start at glow.
function locationLayer(state, ui) {
  const flash = new Set(state.events.filter((e) => ['milestone', 'completed', 'locationPlaced', 'championship'].includes(e.type)).map((e) => e.location ?? e.uid));
  const frames = state.locations.map((loc) => {
    const width = loc.lanes.length;
    const goals = [...loc.milestones.map((m) => `${m.at}: ${rewardText(m.reward)}`), `${loc.objective.count}: ${rewardText(loc.completion)}`].join(' · ');
    return `
      <div class="v2-loc w${width}${loc.championship ? ' champ' : ''}${flash.has(loc.uid) ? ' flash' : ''}" style="grid-column: ${loc.lanes[0] + 1} / span ${width}; --loc: ${loc.color}">
        <div class="v2-loc-art" style="background-image: url('${ASSETS}/${loc.image.replace(/^assets\//, '')}')"></div>
        <div class="v2-loc-banner" title="${esc(`${loc.name}: ${loc.objective.text}. Milestones and completion · ${goals}`)}">
          <header><h4>${esc(loc.name)}</h4><span class="v2-loc-wx">${weatherIcons(loc.weather)}</span></header>
          <p>${esc(loc.objective.text)}</p>
          ${progressBar(loc, 'player')}
          ${progressBar(loc, 'ai')}
          <footer><span class="v2-rounds">⌛ ${loc.roundsLeft} Round${loc.roundsLeft === 1 ? '' : 's'} left</span>${loc.championship ? `<span class="v2-goals">${esc(goals)}</span>` : ''}</footer>
        </div>
      </div>`;
  }).join('');
  const pick = ui.location ? state.players.player.hand.find((c) => c.uid === ui.location) : null;
  const starts = pick ? locationStarts(state, pick) : [];
  const lanes = Array.from({ length: LANES }, (_, lane) => {
    if (locationAt(state, lane)) return '';
    const can = starts.includes(lane);
    return `<div class="v2-lane${can ? ' pick' : ''}" style="grid-column: ${lane + 1}" data-lane="${lane}">${can ? `<span>Place<br>here</span>` : '<span>Home</span>'}</div>`;
  }).join('');
  const ghost = pick ? `<div class="v2-loc ghost" style="--loc: ${pick.color}; display: none"></div>` : '';
  return `<div class="v2-locs">${frames}${ghost}</div><div class="v2-lanes">${lanes}</div>`;
}

function backs(n) {
  return `<div class="v2-opp-hand">${Array.from({ length: n }, () => `<i style="background-image: url('${ASSETS}/ui/card-back.jpg')"></i>`).join('')}<span>Hand ${n}</span></div>`;
}

// The slim strip at the top of the mat: the phase and the last thing that happened.
function strip(state) {
  const phase = state.phase === 'battle' ? `Round ${state.round} · Battle Phase` : state.phase === 'gameOver' ? 'Match over' : 'Setup';
  return `<div class="v2-strip"><b>${phase}</b><span>${esc(state.log.at(-1) ?? '')}</span></div>`;
}

// How the match ended, in words.
function resultLine(state) {
  const r = state.result ?? {};
  const who = state.winner === 'player' ? 'You' : 'The Opponent';
  const champ = state.locations.find((l) => l.championship);
  switch (r.reason) {
    case 'target': return `${who} reached ${RECOGNITION_TARGET} Recognition in Round ${state.round}${champ ? ', during the Championship' : ''}.`;
    case 'recognition': return `After Round ${ROUND_LIMIT}, ${who === 'You' ? 'you have' : 'the Opponent has'} the most Recognition.`;
    case 'championship': return `Tied on Recognition after Round ${ROUND_LIMIT}: ${who === 'You' ? 'you have' : 'the Opponent has'} more Championship progress (${champ?.progress.player ?? 0} to ${champ?.progress.ai ?? 0}).`;
    case 'suddenDeath': return `${who} won the sudden-death Round on Recognition.`;
    case 'draw': return 'Still tied after the sudden-death Round: a draw.';
    default: return 'Match over.';
  }
}

// The Empowered summon chooser (the Growth chooser's small dialog style).
function empowerBox(state, ui) {
  const a = ui.empowerAsk;
  const card = a && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const energy = state.players.player.energy;
  const can = summonCost(card, true) <= energy;
  return `<div class="v2-ask" role="dialog" aria-label="Empowered summon"><div class="v2-panel">
    <p>Summon <b>${card.name}</b> (Level ${card.level}) into space ${a.space + 1}.</p>
    <div class="v2-ask-buttons">
      <button data-action="summon-plain">Summon<small>${card.cost} Energy</small></button>
      <button data-action="summon-empowered"${can ? '' : ' disabled'}>Empowered<small>${summonCost(card, true)} Energy · ${esc(card.empower.text)}</small></button>
    </div>
    <button data-action="summon-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

function gameOver(state) {
  if (state.phase !== 'gameOver') return '';
  const title = state.winner === 'player' ? 'Victory' : state.winner === 'ai' ? 'Defeat' : 'Draw';
  return `<div class="v2-over"><div class="v2-panel"><h2>${title}</h2>
    <p>${resultLine(state)}</p>
    <p>You ${state.players.player.recognition} · Opponent ${state.players.ai.recognition}</p>
    <button data-action="new">New match</button></div></div>`;
}

export function renderMatch(root, state, ui, ctx) {
  const targets = ui.attacker !== null && state.phase === 'battle' ? legalTargets(state, 'player', ui.attacker) : [];
  const playerTarget = targets.some((t) => t.kind === 'player');
  root.innerHTML = `
    <div class="v2-table">
      <header class="v2-title"><h1>Pokémon Legends v2</h1><p>${ctx.build} · <a href="../">the current game</a> · <button class="v2-linkbtn" data-action="deck">${ctx.customDeck ? "Your deck" : "Deck builder"}</button></p></header>
      ${backs(state.players.ai.hand.length)}
      ${recognitionPanel(state, 'ai', playerTarget)}
      ${recognitionPanel(state, 'player', false)}
      <section class="v2-board">
        <div class="v2-mat"></div>
        ${strip(state)}
        ${locationLayer(state, ui)}
        ${row(state, 'ai', ui, targets)}
        ${row(state, 'player', ui, targets)}
      </section>
      ${sidePanel(state, ui, ctx)}
      ${hand(state, ui)}
      <div class="v2-piles"><span>Draw ${state.players.player.drawPile.length}</span><span>Discard ${state.players.player.discard.length}</span><span>Released ${state.players.player.released.length}</span></div>
      ${empowerBox(state, ui)}
      ${gameOver(state)}
    </div>`;
  wire(root, state, ui, ctx);
}

function wire(root, state, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  on('[data-action="flip"]', () => ctx.act({ type: 'flipCoin' }));
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('[data-action="new"]', () => ctx.newMatch());
  on('[data-action="deck"]', () => ctx.openDeck());
  if (!(state.phase === 'battle' && state.turn === 'player') || ui.locked) return;
  on('.v2-hand .v2-card.playable', (el) => {
    ui.attacker = null;
    const key = el.dataset.kind === 'location' ? 'location' : 'summon';
    const other = key === 'location' ? 'summon' : 'location';
    ui[other] = null;
    ui[key] = ui[key] === el.dataset.uid ? null : el.dataset.uid;
    ctx.redraw();
  });
  on('.v2-lane.pick', (el) => ctx.act({ type: 'playLocation', who: 'player', uid: ui.location, start: Number(el.dataset.lane) }));
  // Hovering a lane shows where the Location would go.
  const ghost = root.querySelector('.v2-loc.ghost');
  const pick = state.players.player.hand.find((c) => c.uid === ui.location);
  root.querySelectorAll('.v2-lane.pick').forEach((el) => {
    el.addEventListener('mouseenter', () => { ghost.style.display = ''; ghost.style.gridColumn = `${Number(el.dataset.lane) + 1} / span ${pick.lanes}`; });
    el.addEventListener('mouseleave', () => { ghost.style.display = 'none'; });
  });
  on('.v2-row.player .v2-space.target', (el) => {
    const space = Number(el.dataset.space);
    const card = state.players.player.hand.find((c) => c.uid === ui.summon);
    // A Pokémon with an Empowered summon asks first.
    if (card?.empower) { ui.empowerAsk = { uid: card.uid, space }; ctx.redraw(); return; }
    ctx.act({ type: 'summon', who: 'player', uid: ui.summon, space });
  });
  on('[data-action="summon-plain"]', () => ctx.act({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space }));
  on('[data-action="summon-empowered"]', () => ctx.act({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space, empowered: true }));
  on('[data-action="summon-cancel"]', () => { ui.empowerAsk = null; ctx.redraw(); });
  on('.v2-row.player .v2-card.selectable', (el) => {
    const space = Number(el.closest('.v2-space').dataset.space);
    ui.summon = null;
    ui.location = null;
    ui.attacker = ui.attacker === space ? null : space;
    ctx.redraw();
  });
  on('.v2-space.attack-target', (el) => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'pokemon', space: Number(el.dataset.space) } }));
  on('.v2-recognition.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'player' } }));
}

export { alertSpaces, opponentOf };
