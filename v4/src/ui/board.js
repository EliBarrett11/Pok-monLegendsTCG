// Drawing a v4 match (F1), in v3's "necessary information only" look: the prompt bar; both Player
// Characters outside the battlefield (Recognition 0–100); the 9-lane battlefield (the Default
// Location: no placed Locations yet); the side panel (Round, Base Energy and Exert with Exhaust,
// Pass, the actions with the reasons they're unavailable, piles, the log); the hand. Board
// Pokémon show art, Level, Attack, the Speed icon and Strength (full details on hover).
import { RULES } from '../rules.js?v=202611091135';
import {
  isReady, legalTargets, attackers, summonable, emptySpaces, whyNot, passEndsPhase, passSpends, availableExert, energyLeft,
  playerGuard, guardOf,
} from '../engine/game.js?v=202611091135';
import { icon, speedIcon } from './icons.js?v=202611091135';

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const art = (c) => `${ASSETS}/cards/${c.art}.jpg`;
const COL = 150;

const detail = (c) => `${c.name} · Level ${c.level} (${c.series}) · ${c.type} · ${c.speed} · ${c.attackType} · Attack ${c.attack} · Strength ${c.currentStrength ?? c.strength}/${c.strength}${c.strengthType !== 'Hitpoints' ? ` · ${c.strengthType} guard` : ''} · cost ${c.cost}${c.text ? ` · ${c.text}` : ''}`;
const stats = (c, str = c.currentStrength ?? c.strength) => `<div class="v4-stats"><span class="atk">${icon('attack')}${c.attack}</span>${speedIcon(c.speed)}<span class="str">${icon('strength')}${str}</span></div>`;
const guardTag = (c) => (c.strengthType !== 'Hitpoints' ? `<span class="v4-guard">${icon('guard')}${c.strengthType === 'Defence' ? 'Def' : 'Sp.Def'}</span>` : '');

function boardCard(s, c, who, space, cls) {
  const ready = s.phase === 'battle' && isReady(s, c);
  return `<div class="v4-card v4-mon${ready ? ' ready' : ''}${c.spent ? ' spent' : ''}${c.currentStrength < c.strength ? ' hurt' : ''} ${cls}" data-who="${who}" data-space="${space}" title="${esc(`${detail(c)}${ready ? ' · Ready' : c.spent ? ' · Spent' : ' · Active'}`)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-lv">Lv ${c.level}</span>${guardTag(c)}${stats(c)}
  </div>`;
}

function handCard(s, c, cls, tip) {
  return `<div class="v4-card v4-hcard k-pokemon ${cls}" data-uid="${c.uid}" title="${esc(tip)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-lv">Lv ${c.level}</span><span class="v4-cost">${c.cost}</span>
    <div class="v4-htext"><b class="v4-hname">${esc(c.name)}</b><small class="v4-hline">${esc(`${c.series} · ${c.type} · ${c.attackType}${c.strengthType !== 'Hitpoints' ? ` · ${c.strengthType === 'Defence' ? 'Def' : 'Sp.Def'} guard` : ''}`)}</small>
      <div class="v4-hbody">${c.text ? `<p class="ok">${esc(c.text)}</p>` : ''}${c.retained ? '<p class="ret">Retained</p>' : ''}</div></div>
    ${stats(c, c.strength)}
  </div>`;
}

// --- The prompt bar ------------------------------------------------------------------------------------
export function promptFor(s, ui, ctx = {}) {
  const me = s.players.player;
  if (s.phase === 'gameOver') return { tag: s.winner === 'player' ? 'Champion!' : 'Defeat', text: esc(s.log.at(-1)) };
  if (s.phase === 'mulligan') return { tag: 'Round 1 · Mulligan', text: me.mulliganed ? 'The Opponent is choosing…' : 'Choose any cards to put back into your Discard Pile; you draw as many.', gold: !me.mulliganed };
  if (ui.select?.kind === 'hand') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    const why = whyNot(s, 'player', 'summon', c);
    return { tag: `${c.name} · Lv ${c.level} · ${c.cost} Energy`, text: `${why ? `Summon: ${esc(why)}.` : 'Summon: click <b>a glowing space</b> on your side.'} Or <b>Retain</b> it (1 Energy): it stays in your hand through Supper, and you draw one fewer next Breakfast.`, gold: true,
      buttons: [{ action: 'retain', label: 'Retain (1 Energy)', disabled: !!whyNot(s, 'player', 'retain', c), tip: whyNot(s, 'player', 'retain', c) }, { action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'attack') {
    const c = me.row[ui.select.from];
    const pl = legalTargets(s, 'player', ui.select.from).some((t) => t.kind === 'player');
    const g = playerGuard(s, 'player', ui.select.from, 'ai');
    return { tag: `Attack · ${c.name} · ${c.attack}`, text: `Choose <b>a glowing target</b>: an enemy Pokémon${pl ? ' or the Opponent (their panel)' : ` (the Opponent is guarded by ${esc(g?.card.name)})`}. A Ready target hits back.`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (s.phase === 'battle' && s.turn === 'player' && !ui.locked) {
    const opts = [];
    const atk = attackers(s, 'player').map((sp) => me.row[sp].name);
    if (atk.length) opts.push(`<b>Attack</b> with ${[...new Set(atk)].map((n) => `<b>${esc(n)}</b>`).join(' or ')} (Ready)`);
    if (summonable(s, 'player').length) opts.push('summon a glowing Pokémon');
    if (me.hand.some((c) => !c.retained) && energyLeft(me) >= RULES.retainCost) opts.push('<b>Retain</b> a card');
    const pass = passEndsPhase(s) ? '<b>Pass</b> to end the Battle Phase' : `<b>Pass</b> for +1 Base Energy${passSpends(s, 'player').length ? ' (your fastest Pokémon become Spent)' : ''}`;
    return { tag: `Round ${s.round} · your turn`, text: opts.length ? `${opts.join(', ').replace(/^./, (x) => x.toUpperCase())} — or ${pass}.` : `Only ${pass}: nothing else is possible now (see Actions).` };
  }
  return { tag: `Round ${s.round}`, text: ctx.autoplay ? 'Autoplay: the AI plays both sides.' : 'The Opponent is choosing…' };
}

// --- Player Characters (outside the battlefield) -------------------------------------------------------------
function character(s, who, ui) {
  const p = s.players[who];
  const target = ui.select?.kind === 'attack' && who === 'ai' && legalTargets(s, 'player', ui.select.from).some((t) => t.kind === 'player');
  return `<button class="v4-pc ${who}${target ? ' target' : ''}" data-pc="${who}" title="${esc(`${who === 'player' ? 'Your' : 'The Opponent\'s'} Player Character: no Health. Damage to it gives the attacker's player 1 Recognition per point. ${RULES.win} Recognition wins.`)}">
    <small>${who === 'player' ? 'You' : 'Opponent'}</small><b>${p.recognition}</b><span>Recognition of ${RULES.win}</span>
    <div class="v4-bar"><i style="width: ${Math.min(100, p.recognition)}%"></i></div>
  </button>`;
}

// --- The battlefield -------------------------------------------------------------------------------------------
function battlefield(s, ui) {
  const targets = new Set();
  if (ui.select?.kind === 'hand' && !whyNot(s, 'player', 'summon', s.players.player.hand.find((c) => c.uid === ui.select.uid))) for (const i of emptySpaces(s, 'player')) targets.add(`player:${i}`);
  if (ui.select?.kind === 'attack') for (const t of legalTargets(s, 'player', ui.select.from)) if (t.kind === 'pokemon') targets.add(`ai:${t.space}`);
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked;
  const canAttack = new Set(myTurn && !ui.select ? attackers(s, 'player') : []);
  const row = (who) => Array.from({ length: RULES.lanes }, (_, i) => {
    const c = s.players[who].row[i];
    const t = targets.has(`${who}:${i}`);
    const guarded = ui.select?.kind === 'attack' && who === 'ai' && c && guardOf(s, 'ai', i, s.players.player.row[ui.select.from].attackType);
    return `<div class="v4-space${t ? ' target' : ''}${ui.select?.kind === 'attack' && who === 'player' && ui.select.from === i ? ' attacking' : ''}" style="left: ${i * COL}px" data-who="${who}" data-space="${i}"${guarded ? ` title="${esc(`Guarded by ${guarded.card.name}`)}"` : ''}>${c ? boardCard(s, c, who, i, canAttack.has(i) && who === 'player' ? 'can-attack' : '') : `<span class="v4-num">${i + 1}</span>`}</div>`;
  }).join('');
  return `<section class="v4-board">
    <div class="v4-mat"></div>
    <div class="v4-default"><b>Default Location</b><small>9 lanes · no passive, Weather or dominance</small></div>
    <div class="v4-grid"><div class="v4-row opponent">${row('ai')}</div><div class="v4-row player">${row('player')}</div></div>
  </section>`;
}

// --- The side panel ---------------------------------------------------------------------------------------------
function side(s, ui, ctx) {
  const me = s.players.player;
  const foe = s.players.ai;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !ui.select;
  const ex = availableExert(me);
  const exhaust = me.exhaust.map((x) => `<li>Exhaust · position ${x.position} · back in Round ${x.recoversRound}</li>`).join('');
  const reason = (a) => (s.phase !== 'battle' ? 'Not the Battle Phase' : s.turn !== 'player' ? 'Not your turn' : null);
  const actions = [
    ['Summon', reason() ?? (summonable(s, 'player').length ? null : !emptySpaces(s, 'player').length ? 'No empty space on your side' : `No Pokémon you can pay for (${energyLeft(me)} Energy)`)],
    ['Attack', reason() ?? whyNot(s, 'player', 'attack')],
    ['Retain', reason() ?? (!me.hand.some((c) => !c.retained) ? 'No card to Retain' : energyLeft(me) < RULES.retainCost ? 'Needs 1 Energy' : null)],
    ['Pass', reason()],
  ];
  return `<aside class="v4-side">
    <section class="v4-panel"><div class="v4-label">Round ${s.round}</div><span class="v4-chip">${s.phase === 'battle' ? `Battle · ${s.turn === 'player' ? 'your turn' : 'their turn'}` : s.phase === 'mulligan' ? 'Mulligan' : 'Match over'}</span></section>
    <section class="v4-panel v4-energy">
      <div class="v4-label">${icon('energy')} Base Energy</div><b>${me.baseEnergy}</b>
      <div class="v4-exert"><span>Exert <b>${ex}</b> / ${me.exertMax}</span><span class="v4-exert-dots">${Array.from({ length: me.exertMax }, (_, i) => `<i class="${i < ex ? 'on' : ''}"></i>`).join('')}</span></div>
      ${exhaust ? `<ul class="v4-exhaust">${exhaust}</ul>` : '<p class="v4-small">Exert covers what Base Energy can\'t; each point spent is Exhausted for 2–4 Rounds.</p>'}
    </section>
    <button class="v4-pass" data-action="pass"${myTurn ? '' : ' disabled'}>Pass <small>${passEndsPhase(s) ? '(ends the Battle Phase)' : '(+1 Base Energy)'}</small></button>
    <section class="v4-panel v4-actions"><div class="v4-label">Actions</div>${actions.map(([n, why]) => `<p class="${why ? 'off' : 'on'}"><b>${n}</b>${why ? ` · ${esc(why)}` : ' · available'}</p>`).join('')}</section>
    <section class="v4-panel v4-piles">
      <div class="v4-label">You</div><p>Hand ${me.hand.length} · Deck ${me.drawPile.length} · Discard ${me.discard.length} · Released ${me.released.length}</p>
      <div class="v4-label">Opponent</div><p>Hand ${foe.hand.length} · Deck ${foe.drawPile.length} · Discard ${foe.discard.length} · Released ${foe.released.length} · Energy ${foe.baseEnergy} + Exert ${availableExert(foe)}</p>
    </section>
    <section class="v4-panel v4-log"><div class="v4-label">Log</div>${s.log.slice(-7).map((l) => `<p>${esc(l)}</p>`).join('')}</section>
    <div class="v4-build"><p>${esc(ctx.build)}</p><p><a href="../v3/">v3</a> · <a href="../v2/">v2</a> · <a href="../">v1</a> · <button class="v4-link" data-action="new">New match</button></p></div>
  </aside>`;
}

function hand(s, ui) {
  const me = s.players.player;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked;
  const n = me.hand.length;
  const W = 1590;
  const CW = 156;
  const step = n > 1 ? Math.min(CW + 4, (W - CW) / (n - 1)) : 0;
  const start = (W - (CW + step * (n - 1))) / 2;
  return `<div class="v4-hand">${me.hand.map((c, i) => {
    const why = myTurn ? whyNot(s, 'player', 'summon', c) : null;
    const cls = [myTurn ? (why ? 'dim' : 'playable') : '', ui.select?.uid === c.uid ? 'sel' : ''].join(' ');
    return `<div class="v4-slot${ui.select?.uid === c.uid ? ' picked' : ''}" style="left: ${Math.round(start + step * i)}px">${handCard(s, c, `${cls} selectable`, `${detail(c)}${why ? ` · Summon: ${why}` : ''}`)}</div>`;
  }).join('')}</div>`;
}

function dialogs(s, ui) {
  const me = s.players.player;
  if (s.phase === 'gameOver') return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-over"><h2>${s.winner === 'player' ? 'Pokémon League Champion!' : 'Defeat'}</h2><p>${esc(s.log.at(-1))}</p><p>Round ${s.round} · You ${me.recognition} · Opponent ${s.players.ai.recognition}</p><button data-action="new">New match</button></div></div>`;
  if (s.phase === 'mulligan' && !me.mulliganed && !ui.locked) {
    const chosen = ui.mull ?? [];
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide"><p><b>Round 1 · Mulligan</b>: choose any cards to put into your Discard Pile; you draw as many new ones.</p>
      <div class="v4-mini">${me.hand.map((c) => `<button class="${chosen.includes(c.uid) ? 'on' : ''}" data-mull="${c.uid}" style="background-image: url('${art(c)}')" title="${esc(detail(c))}"><span>${esc(c.name)} L${c.level}</span></button>`).join('')}</div>
      <div class="v4-buttons"><button data-action="mull-done">${chosen.length ? `Put back ${chosen.length} and draw ${chosen.length}` : 'Keep this hand'}</button></div></div></div>`;
  }
  return '';
}

export function renderMatch(root, s, ui, ctx) {
  const p = promptFor(s, ui, ctx);
  root.innerHTML = `<div class="v4-table${ui.select ? ' choosing' : ''}">
    <div class="v4-prompt${p.gold ? ' gold' : ''}"><span class="v4-tag">${esc(p.tag)}</span><span class="v4-ptext">${p.text}</span>${(p.buttons ?? []).map((b) => `<button data-action="${b.action}"${b.disabled ? ' disabled' : ''}${b.tip ? ` title="${esc(b.tip)}"` : ''}>${esc(b.label)}</button>`).join('')}</div>
    ${character(s, 'ai', ui)}${character(s, 'player', ui)}
    ${battlefield(s, ui)}
    ${side(s, ui, ctx)}
    ${hand(s, ui)}
    ${dialogs(s, ui)}
  </div>`;
  wire(root, s, ui, ctx);
}

function wire(root, s, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  on('[data-action="new"]', () => ctx.newMatch());
  on('[data-action="cancel"]', () => { ui.select = null; ctx.redraw(); });
  on('[data-mull]', (el) => { const u = el.dataset.mull; ui.mull = (ui.mull ?? []).includes(u) ? ui.mull.filter((x) => x !== u) : [...(ui.mull ?? []), u]; ctx.redraw(); });
  on('[data-action="mull-done"]', () => { const cards = ui.mull ?? []; ui.mull = []; ctx.act({ type: 'mulligan', who: 'player', cards }); });
  if (!(s.phase === 'battle' && s.turn === 'player') || ui.locked) return;
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('.v4-hand .v4-card', (el) => { ui.select = ui.select?.uid === el.dataset.uid ? null : { kind: 'hand', uid: el.dataset.uid }; ctx.redraw(); });
  on('[data-action="retain"]', () => ctx.act({ type: 'retain', who: 'player', uid: ui.select.uid }));
  on('.v4-row.player .v4-space.target', (el) => ctx.act({ type: 'summon', who: 'player', uid: ui.select.uid, space: Number(el.dataset.space) }));
  on('.v4-row.player .v4-card.can-attack', (el) => { ui.select = { kind: 'attack', from: Number(el.dataset.space) }; ctx.redraw(); });
  on('.v4-row.opponent .v4-space.target', (el) => ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'pokemon', space: Number(el.dataset.space) } }));
  on('.v4-pc.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'player' } }));
}
