// Drawing a v3 match (V3-0), in v2's approved look and the v3 concept images
// (docs/design/v3-concept-R1.jpg, R2, R6): the prompt bar along the top; the board of 10 spaces
// per side, two facing rows, with each Location as a bold tile over its spaces and its panel on
// the midline; closed spaces dark; each player's portrait framing its space, with a Recognition
// medal; the Trophy on space 10; the side panel (Round, Energy with Overexert, Pass, piles, the
// log); the hand below. Pokémon on the board show their art, Attack, Speed-Tier and Strength;
// Ready Pokémon glow on both sides.
import {
  RULES,
} from '../rules.js';
import {
  isOpen, locationAt, portraitOf, isReady, legalTargets, attackers, summonable, emptyOpenSpaces, playableMoves,
  affordableBreakpoints, effectTargets, playableSupporters, supporterPlayable, favourMet, canOverexert, passEndsPhase, passSpends,
  legalActions, protectorOf, guardedBy, topSpeed, lanesOf, rewardText,
} from '../engine/game.js';
import { FAVOURS } from '../engine/cards.js';
import { icon, speedIcon } from './icons.js';

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const art = (c) => `${ASSETS}/cards/${c.art}.jpg`;
const COL = 156;   // one space's width on the board (px)
// Locations already shown (the arrival animation plays once, not on every redraw).
const shownLocations = new Set();

// --- Cards --------------------------------------------------------------------------------------

function boardCard(s, card, who, space, opts = {}) {
  const ready = s.phase === 'battle' && isReady(s, card);
  const cls = ['v3-card', 'v3-mon', ready && 'ready', card.spent && 'spent', opts.cls, card.currentStrength < card.strength && 'hurt'].filter(Boolean).join(' ');
  const tip = `${card.name} · Level ${card.level} · ${card.type} · ${card.band} · ${card.speed} · ${card.attackType}${card.strengthType !== 'Hitpoints' ? ` · ${card.strengthType} guard` : ''} · ${card.currentStrength}/${card.strength} Strength${ready ? ' · Ready' : card.spent ? ' · Spent' : ''}${card.text ? ` · ${card.text}` : ''}${card.buffs?.length ? ` · ${card.buffs.map((b) => [b.attack && `+${b.attack} Attack`, b.strength && `+${b.strength} Strength`, ...b.keywords].filter(Boolean).join(', ')).join('; ')} (${card.buffs[0].until === 'breakfast' ? 'until Breakfast' : 'this Round'})` : ''}`;
  return `<div class="${cls}" title="${esc(tip)}" data-who="${who}" data-space="${space}">
    <div class="v3-art" style="background-image: url('${art(card)}')"></div>
    ${card.strengthType !== 'Hitpoints' ? `<span class="v3-guard" title="${card.strengthType} guard">${icon('guard')}${card.strengthType === 'Defence' ? 'Def' : 'Sp.Def'}</span>` : ''}
    <div class="v3-stats"><span class="atk">${icon('attack')}${card.attack}</span>${speedIcon(card.speed)}<span class="str">${icon('strength')}${card.currentStrength}</span></div>
  </div>`;
}

function handCard(s, card, opts = {}) {
  let body = '';
  let line = '';
  let corner = '';
  let cost = '';
  let foot = '';
  if (card.cardType === 'Pokémon') {
    line = `${card.type} · ${card.band} · ${card.attackType}${card.strengthType !== 'Hitpoints' ? ` · ${card.strengthType === 'Defence' ? 'Def' : 'Sp.Def'} guard` : ''}`;
    body = card.text ? `<p class="ok">${esc(card.text)}</p>` : '';
    corner = `<span class="v3-lv">Lv ${card.level}<small>/${card.cap}</small></span>`;
    cost = `<span class="v3-cost">${card.cost}</span>`;
    foot = `<div class="v3-stats"><span class="atk">${icon('attack')}${card.attack}</span>${speedIcon(card.speed)}<span class="str">${icon('strength')}${card.strength}</span></div>`;
  } else if (card.cardType === 'Move') {
    const energy = s.players.player.energy;
    line = `Move · ${card.breakpoints.map((b) => b.cost).join(' / ')} Energy`;
    cost = `<span class="v3-cost">${card.breakpoints[0].cost}+</span>`;
    body = card.breakpoints.map((b) => `<p class="${b.cost <= energy ? 'ok' : ''}"><b>${b.cost}:</b> ${esc(b.text)}</p>`).join('');
  } else {
    line = `Supporter · Release ${card.release}`;
    cost = '<span class="v3-cost sup">0</span>';
    body = `<p>${esc(card.text)}</p><p class="fav"><b>Favour</b> (${esc(FAVOURS[card.favour.condition].text)}): ${esc(card.favour.text)}</p>`;
  }
  return `<div class="v3-card v3-hcard k-${card.cardType === 'Pokémon' ? 'pokemon' : card.cardType.toLowerCase()} ${opts.cls ?? ''}" data-uid="${card.uid}" title="${esc(opts.tip ?? card.name)}">
    <div class="v3-art" style="background-image: url('${art(card)}')"></div>
    ${corner}${cost}
    <div class="v3-htext"><b class="v3-hname">${esc(card.name)}</b><small class="v3-hline">${esc(line)}</small><div class="v3-hbody">${body}</div></div>
    ${foot}
  </div>`;
}

// --- The prompt bar -------------------------------------------------------------------------------------
export function promptFor(s, ui, ctx = {}) {
  const me = s.players.player;
  if (s.phase === 'gameOver') return { tag: s.winner === 'player' ? 'Champion!' : s.winner ? 'Defeat' : 'Draw', text: esc(s.log.at(-1)), buttons: [] };
  if (s.phase === 'mulligan') return me.decided ? { tag: 'Round 1', text: 'The Opponent is deciding on a mulligan…', buttons: [] }
    : { tag: 'Round 1', text: `Your opening hand: keep it, or take a <b>mulligan</b> (shuffle these 6 back and draw 6 new ones; once).`, buttons: [], gold: true };
  if (ui.select?.kind === 'summon') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    return { tag: `${c?.name} · ${c?.cost} Energy`, text: 'Choose <b>an empty space</b> in your row inside a Location (glowing). Closed spaces can\'t be used.', buttons: [{ action: 'cancel', label: 'Cancel' }], gold: true };
  }
  if (ui.select?.kind === 'attack') {
    const c = me.row[ui.select.from];
    const t = legalTargets(s, 'player', ui.select.from);
    const pl = t.some((x) => x.kind === 'player');
    return { tag: `${c?.name} attacks · ${c?.attack}`, text: `Choose <b>a glowing target</b>: an enemy Pokémon${pl ? ' or the Opponent (their portrait medal)' : ` (the Opponent is protected by ${esc(protectorOf(s, 'ai')?.name)} on their portrait's space)`}. A Ready target hits back.`, buttons: [{ action: 'cancel', label: 'Cancel' }], gold: true };
  }
  if (ui.select?.kind === 'target') {
    const n = ui.select.spec.count ?? 1;
    const k = (ui.select.chosen ?? []).length;
    const what = ui.select.spec.kinds.includes('location') ? 'a glowing Location panel' : 'a glowing target';
    return { tag: ui.select.tag, text: `${n > 1 ? `Choose <b>target ${k + 1} of ${n}</b>` : `Choose <b>${what}</b>`}: ${esc(ui.select.text)}${n > 1 ? ', or Done' : ''}.`,
      buttons: [...(n > 1 ? [{ action: 'targets-done', label: `Done (${k})` }] : []), { action: 'cancel', label: 'Cancel' }], gold: true };
  }
  if (ui.ask) return { tag: ui.ask.kind === 'move' ? 'Choose a breakpoint' : 'Release cards', text: ui.ask.kind === 'move' ? 'Pay one of the amounts shown: more Energy, a bigger effect.' : 'Choose the cards to Release (gone for the match).', buttons: [], gold: true };
  if (s.phase === 'battle' && s.turn === 'player' && !ui.locked) {
    const opts = [];
    const atk = attackers(s, 'player').map((sp) => me.row[sp].name);
    if (atk.length) opts.push(`attack with <b>${[...new Set(atk)].map(esc).join('</b> or <b>')}</b> (Ready)`);
    const cards = [...summonable(s, 'player'), ...playableMoves(s, 'player'), ...playableSupporters(s, 'player')];
    if (cards.length) opts.push('play a glowing card');
    if (canOverexert(s, 'player')) opts.push('<b>Overexert</b> for up to 2 more Energy');
    const pass = passEndsPhase(s) ? '<b>Pass</b> to end the Battle Phase' : `<b>Pass</b> for +1 Energy${passSpends(s, 'player').length ? ' (your fastest Pokémon become Spent)' : ''}`;
    const only = !atk.length && !cards.length;
    return { tag: `Round ${s.round} · your turn`, text: only ? `Nothing to play now${me.hand.length ? ' (not enough Energy, or no open space)' : ''}: ${canOverexert(s, 'player') ? 'Overexert, or ' : ''}${pass}.` : `${opts.join(', ').replace(/^./, (c) => c.toUpperCase())} — or ${pass}.`, buttons: [] };
  }
  if (ctx.autoplay) return { tag: `Round ${s.round}`, text: 'Autoplay: the AI plays both sides.', buttons: [] };
  return { tag: `Round ${s.round}`, text: 'The Opponent is choosing…', buttons: [] };
}

// --- The board -------------------------------------------------------------------------------------------

function board(s, ui) {
  const targets = targetSet(s, ui);
  const cols = Array.from({ length: RULES.spaces }, (_, i) => i);
  // Location tiles (art over both rows) and their midline panels.
  const tiles = s.locations.map((l) => {
    const lanes = lanesOf(l);
    if (!lanes.length) return '';
    const left = lanes[0] * COL;
    const width = lanes.length * COL;
    const isNew = l.arrivedRound === s.round && s.round > 1;
    const arriving = !shownLocations.has(l.uid);
    shownLocations.add(l.uid);
    const hasTrophy = lanes.includes(RULES.spaces - 1);
    const bar = (who) => `<div class="v3-prog ${who}${l.completed[who] ? ' done' : ''}"><span>${who === 'player' ? 'You' : 'Opp'}</span><div class="v3-prog-bar"><b style="width: ${(100 * l.progress[who]) / l.objective.count}%"></b>${l.milestones.map((m) => `<i style="left: ${(100 * m.at) / l.objective.count}%"></i>`).join('')}</div><em>${l.progress[who]}/${l.objective.count}</em></div>`;
    const rewards = `${l.milestones.map((m) => `${m.at}: ${rewardText(m.reward)}`).join(' · ')}${l.milestones.length ? ' · ' : ''}${l.championship ? 'Done' : 'Done (as it leaves)'}: ${rewardText(l.completion)}`;
    return `<div class="v3-loc w${lanes.length}${l.championship ? ' champ' : ''}${isNew && arriving ? ' arriving' : ''}" style="left: ${left}px; width: ${width}px; --loc: ${l.color}" data-loc="${l.uid}">
      <div class="v3-loc-art" style="background-image: url('${ASSETS}/${l.art}')"></div>
      ${isNew ? '<span class="v3-new">New</span>' : ''}
      <div class="v3-loc-panel${hasTrophy ? ' trophy' : ''}${targets.has(`ai:loc:${l.uid}`) || targets.has(`player:loc:${l.uid}`) ? ' target' : ''}" data-loc-uid="${l.uid}" data-loc-who="${targets.has(`ai:loc:${l.uid}`) ? 'ai' : 'player'}" title="${esc(`${l.name}: ${l.objective.text}. Rewards · ${rewards}`)}">
        <header><h4>${esc(l.name)}</h4>${l.width > lanes.length ? `<small>${lanes.length} of ${l.width} lanes left</small>` : ''}</header>
        <p>${esc(l.objective.text)}${l.effect ? ` · <em>${esc(l.tagline)}</em>` : ''}</p>
        ${bar('player')}${bar('ai')}
        <p class="v3-rewards">${esc(rewards)}</p>
        ${hasTrophy ? `<span class="v3-trophy-badge" title="The Trophy: ${RULES.win} Recognition">${icon('trophy')}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  const closedTrophy = !isOpen(s, RULES.spaces - 1) ? `<div class="v3-trophy" style="left: ${(RULES.spaces - 1) * COL}px">${icon('trophy')}<b>Pokémon League</b><small>${RULES.win} Recognition</small></div>` : '';
  const row = (who) => cols.map((i) => {
    const card = s.players[who].row[i];
    const open = isOpen(s, i);
    const isTarget = targets.has(`${who}:${i}`);
    const portrait = portraitOf(s, who) === i;
    const cls = ['v3-space', open ? 'open' : 'closed', isTarget && 'target', portrait && `portrait ${who}`, ui.select?.kind === 'attack' && ui.select.from === i && who === 'player' && 'attacking'].filter(Boolean).join(' ');
    const mine = who === 'player' && card && s.phase === 'battle' && s.turn === 'player' && !ui.locked && !ui.select && attackers(s, 'player').includes(i);
    return `<div class="${cls}" style="left: ${i * COL}px" data-who="${who}" data-space="${i}">${open ? '' : `<span class="v3-num">${i + 1}</span>`}${card ? boardCard(s, card, who, i, { cls: mine ? 'can-attack' : '' }) : ''}</div>`;
  }).join('');
  const medal = (who) => {
    const p = s.players[who];
    const sp = portraitOf(s, who);
    const target = targets.has(`${who}:player`);
    return `<button class="v3-medal ${who}${target ? ' target' : ''}" style="left: ${sp * COL + COL / 2}px" data-player="${who}" title="${esc(`${who === 'player' ? 'You' : 'The Opponent'}: ${p.recognition} Recognition · portrait on space ${sp + 1}${protectorOf(s, who) ? ` · protected by ${protectorOf(s, who).name}` : ' · unprotected'}`)}">
      <small>${who === 'player' ? 'You' : 'Opp'}</small><b>${p.recognition}</b></button>`;
  };
  return `<section class="v3-board">
    <div class="v3-mat"></div>
    <div class="v3-grid">
      ${tiles}${closedTrophy}
      <div class="v3-row opponent">${row('ai')}</div>
      <div class="v3-row player">${row('player')}</div>
      ${medal('ai')}${medal('player')}
    </div>
  </section>`;
}

const key = (t) => (t.kind === 'player' ? `${t.who}:player` : t.kind === 'location' ? `${t.who}:loc:${t.uid}` : `${t.who}:${t.space}`);
// The spaces (and players, and Locations) that can be clicked for the choice in progress.
function targetSet(s, ui) {
  const out = new Set();
  if (ui.select?.kind === 'summon') for (const i of emptyOpenSpaces(s, 'player')) out.add(`player:${i}`);
  if (ui.select?.kind === 'attack') for (const t of legalTargets(s, 'player', ui.select.from)) out.add(t.kind === 'player' ? 'ai:player' : `ai:${t.space}`);
  if (ui.select?.kind === 'target') {
    const chosen = new Set((ui.select.chosen ?? []).map(key));
    for (const t of effectTargets(s, 'player', ui.select.spec)) if (!chosen.has(key(t))) out.add(key(t));
  }
  return out;
}

// --- The side panel ------------------------------------------------------------------------------------------
function side(s, ui, ctx) {
  const me = s.players.player;
  const foe = s.players.ai;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked;
  const champIn = RULES.championshipAs - s.locationCount;
  const chip = s.championship ? `Championship · ${s.championship.roundsLeft} Round${s.championship.roundsLeft === 1 ? '' : 's'} left` : `Championship in ${champIn} Round${champIn === 1 ? '' : 's'}`;
  const gain = Math.min(s.round, RULES.energyCap);
  const crystals = Array.from({ length: Math.max(me.energy, gain) }, (_, i) => `<i class="${i < me.energy ? 'on' : ''}"></i>`).join('');
  const over = me.overexertRound === s.round;
  const canOver = myTurn && canOverexert(s, 'player') && !ui.select && !ui.ask;
  return `<aside class="v3-side">
    <section class="v3-panel"><div class="v3-label">Round ${s.round}</div><span class="v3-chip${s.championship ? ' live' : ''}">${chip}</span></section>
    <section class="v3-panel v3-energy${me.debt ? ' debt' : ''}">
      <div class="v3-label">${icon('energy')} Energy</div><b>${me.energy}</b><span>Round ${s.round}: ${gain}</span>
      <div class="v3-crystals">${crystals}</div>
      ${over ? `<p class="v3-owe">Overexerted: <b>−${me.debt}</b> next Breakfast</p>` : `<div class="v3-overx"><span>Overexert</span><button data-over="1"${canOver ? '' : ' disabled'} title="+1 Energy now; 2 less next Breakfast">+1</button><button data-over="2"${canOver ? '' : ' disabled'} title="+2 Energy now; 3 less next Breakfast">+2</button></div>`}
    </section>
    <button class="v3-pass" data-action="pass"${myTurn && !ui.select && !ui.ask ? '' : ' disabled'}>Pass <small>${passEndsPhase(s) ? '(ends the Battle Phase)' : `(+${RULES.passEnergy} Energy)`}</small></button>
    <section class="v3-panel v3-piles">
      <div class="v3-label">You</div><p>Hand ${me.hand.length}/${RULES.handLimit} · Deck ${me.drawPile.length} · Released ${me.released.length}</p>
      <div class="v3-label">Opponent</div><p>Hand ${foe.hand.length} · Deck ${foe.drawPile.length} · Energy ${foe.energy}${foe.debt ? ` (owes ${foe.debt})` : ''}</p>
    </section>
    <section class="v3-panel v3-log"><div class="v3-label">Log</div>${s.log.slice(-6).map((l) => `<p>${esc(l)}</p>`).join('')}</section>
    <div class="v3-build"><p>${esc(ctx.build)}</p><p><a href="../v2/">v2</a> · <a href="../">the current game</a> · <button class="v3-link" data-action="new">New match</button></p></div>
  </aside>`;
}

// --- The hand ----------------------------------------------------------------------------------------------------
function hand(s, ui) {
  const me = s.players.player;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !ui.ask;
  const can = new Set(myTurn ? [...summonable(s, 'player'), ...playableMoves(s, 'player'), ...playableSupporters(s, 'player')].map((c) => c.uid) : []);
  const n = me.hand.length;
  const W = 1590;
  const CW = 156;
  const step = n > 1 ? Math.min(CW + 4, (W - CW) / (n - 1)) : 0;
  const start = (W - (CW + step * (n - 1))) / 2;
  return `<div class="v3-hand">${me.hand.map((c, i) => {
    const picked = ui.select?.uid === c.uid || ui.ask?.uid === c.uid;
    const why = myTurn && !can.has(c.uid) ? whyNot(s, c) : '';
    return `<div class="v3-slot${picked ? ' picked' : ''}" style="left: ${Math.round(start + step * i)}px">${handCard(s, c, { cls: can.has(c.uid) ? 'playable' : myTurn ? 'dim' : '', tip: why ? `${c.name} · ${why}` : c.name })}</div>`;
  }).join('')}</div>`;
}
function whyNot(s, c) {
  const me = s.players.player;
  if (c.cardType === 'Pokémon') return !emptyOpenSpaces(s, 'player').length ? 'No empty open space' : `Needs ${c.cost} Energy · you have ${me.energy}`;
  if (c.cardType === 'Move') return c.breakpoints[0].cost > me.energy ? `Needs ${c.breakpoints[0].cost} Energy · you have ${me.energy}` : 'No legal target';
  return me.hand.length - 1 < c.release ? `Needs ${c.release} other card${c.release === 1 ? '' : 's'} to Release` : 'No legal target';
}

// --- Dialogs ---------------------------------------------------------------------------------------------------------
function dialogs(s, ui, ctx) {
  const me = s.players.player;
  if (s.phase === 'gameOver') {
    const title = s.winner === 'player' ? 'Regional Champion!' : s.winner ? 'Defeat' : 'Draw';
    return `<div class="v3-ask" role="dialog"><div class="v3-panel v3-over"><h2>${title}</h2><p>${esc(s.log.at(-1))}</p><p>Round ${s.round} · You ${me.recognition} · Opponent ${s.players.ai.recognition}</p><button data-action="new">New match</button></div></div>`;
  }
  if (s.phase === 'mulligan' && !me.decided && !ui.locked) {
    return `<div class="v3-ask" role="dialog"><div class="v3-panel"><p><b>Round 1</b>: keep this hand, or take a mulligan (shuffle these 6 back into your deck and draw 6 new ones; once).</p>
      <div class="v3-mini">${me.hand.map((c) => `<i style="background-image: url('${art(c)}')" title="${esc(c.name)}"><span>${esc(c.name)}</span></i>`).join('')}</div>
      <div class="v3-buttons"><button data-mull="0">Keep</button><button data-mull="1">Mulligan</button></div></div></div>`;
  }
  if (ui.ask?.kind === 'move') {
    const c = me.hand.find((x) => x.uid === ui.ask.uid);
    const ok = new Set(affordableBreakpoints(s, 'player', c).map((b) => b.cost));
    return `<div class="v3-ask" role="dialog"><div class="v3-panel"><p><b>${esc(c.name)}</b>: choose how much Energy to pay (you have ${me.energy}).</p>
      <div class="v3-bps">${c.breakpoints.map((b) => `<button data-pay="${b.cost}"${ok.has(b.cost) ? '' : ' disabled'}><b>${b.cost}</b><span>${esc(b.text)}</span></button>`).join('')}</div>
      <button class="v3-cancel" data-action="cancel">Cancel</button></div></div>`;
  }
  if (ui.ask?.kind === 'release') {
    const c = me.hand.find((x) => x.uid === ui.ask.uid);
    const others = me.hand.filter((x) => x !== c);
    const picked = others.filter((x) => ui.ask.chosen.includes(x.uid));
    const met = favourMet(c, picked);
    return `<div class="v3-ask" role="dialog"><div class="v3-panel v3-wide"><p><b>${esc(c.name)}</b>: Release ${c.release} card${c.release === 1 ? '' : 's'} (gone for the match). ${esc(c.text)}.</p>
      <p class="v3-fav${met ? ' met' : ''}">Favour: Release ${esc(FAVOURS[c.favour.condition].text)} → ${esc(c.favour.text)}${met ? ' ✓' : ''}</p>
      <div class="v3-mini">${others.map((x) => `<button class="${ui.ask.chosen.includes(x.uid) ? 'on' : ''}${FAVOURS[c.favour.condition].test(x) ? ' fav' : ''}" data-rel="${x.uid}" style="background-image: url('${art(x)}')"><span>${esc(x.name)}${x.level ? ` L${x.level}` : ''}</span></button>`).join('')}</div>
      <div class="v3-buttons"><button data-action="release-done"${picked.length === c.release ? '' : ' disabled'}>Release ${picked.length}/${c.release} and play</button></div>
      <button class="v3-cancel" data-action="cancel">Cancel</button></div></div>`;
  }
  return '';
}

// --- Drawing and wiring --------------------------------------------------------------------------------------------------

export function renderMatch(root, s, ui, ctx) {
  const p = promptFor(s, ui, ctx);
  root.innerHTML = `<div class="v3-table${ui.select ? ' choosing' : ''}">
    <div class="v3-prompt${p.gold ? ' gold' : ''}"><span class="v3-tag">${esc(p.tag)}</span><span class="v3-ptext">${p.text}</span>${p.buttons.map((b) => `<button data-action="${b.action}">${esc(b.label)}</button>`).join('')}</div>
    ${board(s, ui)}
    ${side(s, ui, ctx)}
    ${hand(s, ui)}
    ${dialogs(s, ui, ctx)}
  </div>`;
  wire(root, s, ui, ctx);
  fitText(root);
}

const FIT = [['.v3-loc-panel h4', 10], ['.v3-loc-panel p', 8], ['.v3-hbody', 8], ['.v3-hname', 11], ['.v3-hline', 8], ['.v3-ptext', 13], ['.v3-log', 9]];
function fitText(root) {
  if (typeof getComputedStyle !== 'function') return;
  for (const [sel, min] of FIT) {
    for (const el of root.querySelectorAll(sel)) {
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 30 && size > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); i++) { size -= 0.5; el.style.fontSize = `${size}px`; }
    }
  }
}

function wire(root, s, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  const redraw = () => ctx.redraw();
  on('[data-action="new"]', () => ctx.newMatch());
  on('[data-action="cancel"]', () => { ui.select = null; ui.ask = null; redraw(); });
  on('[data-mull]', (el) => ctx.act({ type: 'mulligan', who: 'player', redraw: el.dataset.mull === '1' }));
  if (!(s.phase === 'battle' && s.turn === 'player') || ui.locked) return;
  const me = s.players.player;
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('[data-over]', (el) => ctx.act({ type: 'overexert', who: 'player', amount: Number(el.dataset.over) }));
  // A card from hand.
  on('.v3-hand .v3-card.playable', (el) => {
    const c = me.hand.find((x) => x.uid === el.dataset.uid);
    if (c.cardType === 'Pokémon') { ui.select = ui.select?.uid === c.uid ? null : { kind: 'summon', uid: c.uid }; return redraw(); }
    ui.select = null;
    ui.ask = c.cardType === 'Move' ? { kind: 'move', uid: c.uid } : { kind: 'release', uid: c.uid, chosen: [] };
    redraw();
  });
  // Moves: a breakpoint, then a target if it has one.
  on('[data-pay]', (el) => {
    const c = me.hand.find((x) => x.uid === ui.ask.uid);
    const bp = c.breakpoints.find((b) => b.cost === Number(el.dataset.pay));
    ui.ask = null;
    if (!bp.target) return ctx.act({ type: 'playMove', who: 'player', uid: c.uid, pay: bp.cost });
    ui.select = { kind: 'target', spec: bp.target, tag: `${c.name} · ${bp.cost} Energy`, text: bp.text, action: { type: 'playMove', who: 'player', uid: c.uid, pay: bp.cost } };
    redraw();
  });
  on('[data-rel]', (el) => {
    const c = me.hand.find((x) => x.uid === ui.ask.uid);
    const list = ui.ask.chosen;
    if (list.includes(el.dataset.rel)) ui.ask.chosen = list.filter((u) => u !== el.dataset.rel);
    else if (list.length < c.release) list.push(el.dataset.rel);
    redraw();
  });
  on('[data-action="release-done"]', () => {
    const c = me.hand.find((x) => x.uid === ui.ask.uid);
    const action = { type: 'playSupporter', who: 'player', uid: c.uid, release: [...ui.ask.chosen] };
    const met = favourMet(c, me.hand.filter((x) => ui.ask.chosen.includes(x.uid)));
    ui.ask = null;
    if (!c.target || (met && c.favour.untargeted)) return ctx.act(action);
    ui.select = { kind: 'target', spec: c.target, tag: c.name, text: met ? c.favour.text : c.text, action };
    redraw();
  });
  // The board: summon into a glowing space; choose an attacker; choose a target.
  // A target for a Move or Supporter: one acts at once; for two, the second (or Done).
  const pick = (t) => {
    const sel = ui.select;
    sel.chosen = [...(sel.chosen ?? []), t];
    const left = effectTargets(s, 'player', sel.spec).filter((o) => !sel.chosen.some((c) => key(c) === key(o)));
    if (sel.chosen.length >= (sel.spec.count ?? 1) || !left.length) return ctx.act({ ...sel.action, targets: sel.chosen });
    redraw();
  };
  on('[data-action="targets-done"]', () => { if (ui.select?.chosen?.length) ctx.act({ ...ui.select.action, targets: ui.select.chosen }); });
  on('.v3-row.player .v3-space.target', (el) => {
    if (ui.select?.kind === 'summon') ctx.act({ type: 'summon', who: 'player', uid: ui.select.uid, space: Number(el.dataset.space) });
    else if (ui.select?.kind === 'target') pick({ who: 'player', kind: 'pokemon', space: Number(el.dataset.space) });
  });
  on('.v3-row.opponent .v3-space.target', (el) => {
    const space = Number(el.dataset.space);
    if (ui.select?.kind === 'attack') ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'pokemon', space } });
    else if (ui.select?.kind === 'target') pick({ who: 'ai', kind: 'pokemon', space });
  });
  on('.v3-medal.target', (el) => {
    if (ui.select?.kind === 'attack') ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'player' } });
    else if (ui.select?.kind === 'target') pick({ who: el.dataset.player, kind: 'player' });
  });
  on('.v3-loc-panel.target', (el) => pick({ who: el.dataset.locWho, kind: 'location', uid: el.dataset.locUid }));
  on('.v3-row.player .v3-card.can-attack', (el) => { ui.select = { kind: 'attack', from: Number(el.dataset.space) }; redraw(); });
}

export { promptFor as prompt, guardedBy, topSpeed, legalActions, supporterPlayable, locationAt };
