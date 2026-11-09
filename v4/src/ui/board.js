// Drawing a v4 match (F1; F2 adds Locations), in v3's "necessary information only" look: the prompt
// bar; both Player Characters outside the battlefield (Recognition 0–100); the 9-lane battlefield
// (placed Locations as bold tiles over their lanes with a compact panel: name, Weather, who
// dominates and what it gives at Supper, Rounds left; the passive on hover; the rest is the
// Default Location); the side panel (Round, Base Energy and Exert with Exhaust, Weather counts and
// active brackets, Pass, the actions with the reasons they're unavailable, pending Strats, piles,
// the log); the hand. Board Pokémon show art, Level, Attack, the Speed icon and Strength (full
// details on hover). F3: Command Cards (the mode chooser, targets, the React window with the
// committed action, pending Strats on their targets) and Supporters (the Release and Favour screen).
import { RULES } from '../rules.js?v=202611091159';
import {
  isReady, legalTargets, attackers, summonable, emptySpaces, whyNot, passEndsPhase, passSpends, availableExert, energyLeft,
  playerGuard, guardOf, placeable, locationStarts, weatherTotals, activeBrackets, dominantOf, strengthIn, locationAt,
  actor, commandTargets, playableCommands, playableSupporters, playReason, favourMet,
} from '../engine/game.js?v=202611091159';
import { WEATHER_BRACKETS, MODES, MODE_NAMES, FAVOURS, modeText, effectText } from '../engine/cards.js?v=202611091159';
import { icon, speedIcon } from './icons.js?v=202611091159';

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const art = (c) => `${ASSETS}/cards/${c.art}.jpg`;
const COL = 150;

const isLoc = (c) => c?.cardType === 'Location';
const locDetail = (c) => `${c.name} · Location · covers ${c.width} adjacent lanes on both sides · stays ${c.rounds} Rounds · no Energy · ${c.passive.text} · Weather: ${c.weather.count} ${c.weather.type}`;
const bonusText = (c) => [c.bonusAttack ? `+${c.bonusAttack} Attack` : '', c.bonusStrength ? `+${c.bonusStrength} Strength` : ''].filter(Boolean).join(', ');
const isCmd = (c) => c?.cardType === 'Command';
const isSup = (c) => c?.cardType === 'Supporter';
const cmdDetail = (c) => `${c.name} · Command Card · ${MODES.map((m) => `${MODE_NAMES[m]} (${c.modes[m].cost} Energy): ${modeText(c, m)}`).join(' · ')} · Adapt resolves now; React only in reply to the opponent's attack, summon or Adapt, before it; Strat after the opponent's next turn`;
const supDetail = (c) => `${c.name} · Supporter · no Energy · Release ${c.release} other card${c.release === 1 ? '' : 's'} from hand (permanently), then this card · ${effectText(c.effect)} · Favour (Release ${FAVOURS[c.favour.condition].text}): ${effectText(c.favour)}, +${RULES.perFavour} Recognition`;
const shortMode = (c, m) => { const { op, amount } = c.modes[m]; return { damage: `${amount} damage`, heal: `heal ${amount}`, attackUp: `+${amount} Attack`, damageLocation: `${amount} to each there` }[op]; };
// A Supporter effect, short (for the card face; the full text is on hover).
const shortEffect = ({ op, amount }) => ({ healAll: `Heal yours ${amount}`, search: `Search ${amount} Pokémon`, strengthAll: `+${amount} Strength to yours` }[op]);
const shortFavour = { water: 'Water', location: 'Location', bigPokemon: 'Lv 4+ Pokémon' };
const detail = (c) => (isCmd(c) ? cmdDetail(c) : isSup(c) ? supDetail(c) : isLoc(c) ? locDetail(c) : `${c.name} · Level ${c.level} (${c.series}) · ${c.type} · ${c.speed} · ${c.attackType} · Attack ${c.attack} · Strength ${c.currentStrength ?? c.strength}/${c.strength}${c.strengthType !== 'Hitpoints' ? ` · ${c.strengthType} guard` : ''} · cost ${c.cost}${c.text ? ` · ${c.text}` : ''}${bonusText(c) ? ` · includes ${bonusText(c)} from Location/Weather` : ''}`);
const stats = (c, str = c.currentStrength ?? c.strength) => `<div class="v4-stats"><span class="atk">${icon('attack')}${c.attack}</span>${speedIcon(c.speed)}<span class="str">${icon('strength')}${str}</span></div>`;
const guardTag = (c) => (c.strengthType !== 'Hitpoints' ? `<span class="v4-guard">${icon('guard')}${c.strengthType === 'Defence' ? 'Def' : 'Sp.Def'}</span>` : '');

function boardCard(s, c, who, space, cls) {
  const ready = s.phase === 'battle' && isReady(s, c);
  // Pending Strats aimed at this Pokémon (both players').
  const strats = s.strats.filter((x) => x.target.who === who && x.target.space === space && x.target.uid === c.uid);
  const badges = strats.map((x) => `<span class="v4-strat ${x.owner}" title="${esc(`${x.owner === 'player' ? 'Your' : 'The Opponent\'s'} Strat: ${x.card.name} (${modeText(x.card, 'strat')}), after ${x.owner === 'player' ? 'the Opponent\'s' : 'your'} next turn`)}">⏳ ${esc(x.card.name)}</span>`).join('');
  return `<div class="v4-card v4-mon${ready ? ' ready' : ''}${c.spent ? ' spent' : ''}${c.currentStrength < c.strength ? ' hurt' : ''} ${cls}" data-who="${who}" data-space="${space}" title="${esc(`${detail(c)}${ready ? ' · Ready' : c.spent ? ' · Spent' : ' · Active'}`)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-lv">Lv ${c.level}</span>${guardTag(c)}${stats(c)}${badges ? `<div class="v4-strats">${badges}</div>` : ''}
  </div>`;
}

function handCard(s, c, cls, tip) {
  if (isCmd(c)) {
    return `<div class="v4-card v4-hcard k-command ${cls}" data-uid="${c.uid}" title="${esc(tip)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-cost">${c.modes.adapt.cost}</span>
    <div class="v4-htext"><b class="v4-hname">${esc(c.name)}</b><small class="v4-hline">Command · ${c.target === 'enemy' ? 'enemy Pokémon' : 'your Pokémon'}</small>
      <div class="v4-hbody v4-modes">${MODES.map((m) => `<p><b>${MODE_NAMES[m]} ${c.modes[m].cost}</b> ${esc(shortMode(c, m))}</p>`).join('')}${c.retained ? '<p class="ret">Retained</p>' : ''}</div></div>
  </div>`;
  }
  if (isSup(c)) {
    return `<div class="v4-card v4-hcard k-supporter ${cls}" data-uid="${c.uid}" title="${esc(tip)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-cost sup">0</span>
    <div class="v4-htext"><b class="v4-hname">${esc(c.name)}</b><small class="v4-hline">Supporter · Release ${c.release}</small>
      <div class="v4-hbody"><p class="ok">${esc(shortEffect(c.effect))}</p><p class="fav">★ ${esc(shortFavour[c.favour.condition])}: ${esc(shortEffect(c.favour))}</p>${c.retained ? '<p class="ret">Retained</p>' : ''}</div></div>
  </div>`;
  }
  if (isLoc(c)) {
    return `<div class="v4-card v4-hcard k-location ${cls}" data-uid="${c.uid}" title="${esc(tip)}" style="--loc: ${c.color}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-cost">0</span>
    <div class="v4-htext"><b class="v4-hname">${esc(c.name)}</b><small class="v4-hline">${esc(`Location · ${c.width} lanes · ${c.rounds} Rounds`)}</small>
      <div class="v4-hbody"><p class="ok">${esc(c.passive.text)}</p><p>${weatherIcon(c.weather.type)} ${c.weather.count} ${c.weather.type}</p>${c.retained ? '<p class="ret">Retained</p>' : ''}</div></div>
  </div>`;
  }
  return `<div class="v4-card v4-hcard k-pokemon ${cls}" data-uid="${c.uid}" title="${esc(tip)}">
    <div class="v4-art" style="background-image: url('${art(c)}')"></div>
    <span class="v4-lv">Lv ${c.level}</span><span class="v4-cost">${c.cost}</span>
    <div class="v4-htext"><b class="v4-hname">${esc(c.name)}</b><small class="v4-hline">${esc(`${c.series} · ${c.type} · ${c.attackType}${c.strengthType !== 'Hitpoints' ? ` · ${c.strengthType === 'Defence' ? 'Def' : 'Sp.Def'} guard` : ''}`)}</small>
      <div class="v4-hbody">${c.text ? `<p class="ok">${esc(c.text)}</p>` : ''}${c.retained ? '<p class="ret">Retained</p>' : ''}</div></div>
    ${stats(c, c.strength)}
  </div>`;
}

const weatherIcon = (type) => (type === 'Rain' ? '🌧' : '☀');
const bracketText = (b) => `${b.type} ${b.at}+: ${b.text}`;

// --- The prompt bar ------------------------------------------------------------------------------------
export function promptFor(s, ui, ctx = {}) {
  const me = s.players.player;
  if (s.phase === 'gameOver') return { tag: s.winner === 'player' ? 'Champion!' : 'Defeat', text: esc(s.log.at(-1)) };
  if (s.phase === 'mulligan') return { tag: 'Round 1 · Mulligan', text: me.mulliganed ? 'The Opponent is choosing…' : 'Choose any cards to put back into your Discard Pile; you draw as many.', gold: !me.mulliganed };
  // The React window (F3).
  if (s.reactWindow) {
    const w = s.reactWindow;
    if (w.reactor !== 'player' || ui.locked) return { tag: 'React?', text: `${esc(w.pending.text)}. The Opponent may React first…` };
    if (ui.select?.kind === 'react') {
      const c = me.hand.find((x) => x.uid === ui.select.uid);
      return { tag: `React · ${c.name} · ${c.modes.react.cost} Energy`, text: `${esc(modeText(c, 'react'))}: choose <b>a glowing target</b>. It resolves before: ${esc(w.pending.text)}.`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
    }
    return { tag: 'React?', text: `<b>${esc(w.pending.text)}.</b> React first with a glowing Command card (its React cost; it doesn't use your turn), or let it happen.`, gold: true, buttons: [{ action: 'decline', label: 'Let it happen' }] };
  }
  if (ui.select?.kind === 'command') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    const m = ui.select.mode;
    return { tag: `${c.name} · ${MODE_NAMES[m]} · ${c.modes[m].cost} Energy`, text: `${esc(modeText(c, m))}: choose <b>a glowing target</b>.${m === 'strat' ? ' It resolves after the Opponent\'s next turn (or at Supper); if the target is gone by then, it fizzles.' : ' The Opponent may React first.'}`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'supporter') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    return { tag: `${c.name} · Release ${c.release}`, text: 'Choose the cards to Release below.', gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'hand') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    const retainBtn = { action: 'retain', label: 'Retain (1 Energy)', disabled: !!whyNot(s, 'player', 'retain', c), tip: whyNot(s, 'player', 'retain', c) };
    if (isCmd(c)) {
      const modeBtn = (m) => { const why = whyNot(s, 'player', 'command', c, m); return { action: `mode-${m}`, label: `${MODE_NAMES[m]} · ${c.modes[m].cost} Energy`, disabled: !!why, tip: why ?? modeText(c, m) }; };
      return { tag: `${c.name} · Command`, text: '<b>Adapt</b> resolves now; <b>Strat</b> after the Opponent\'s next turn. <b>React</b> only in reply to their attack, summon or Adapt.', gold: true,
        buttons: [modeBtn('adapt'), modeBtn('strat'), retainBtn, { action: 'cancel', label: 'Cancel' }] };
    }
    if (isSup(c)) {
      const why = whyNot(s, 'player', 'supporter', c);
      return { tag: `${c.name} · Supporter`, text: `No Energy: Release ${c.release} other card${c.release === 1 ? '' : 's'} from your hand for good, then ${esc(c.name)} too. ${esc(effectText(c.effect))}.`, gold: true,
        buttons: [{ action: 'play-supporter', label: `Play (Release ${c.release})`, disabled: !!why, tip: why }, retainBtn, { action: 'cancel', label: 'Cancel' }] };
    }
    if (isLoc(c)) {
      const why = whyNot(s, 'player', 'summon', c);
      return { tag: `${c.name} · Location · ${c.width} lanes`, text: `${why ? `Place: ${esc(why)}.` : `Place it (no Energy): click <b>a glowing lane</b>; it covers that lane and the ${c.width - 1} to its right, on both sides, for ${c.rounds} Rounds.`} Or <b>Retain</b> it.`, gold: true,
        buttons: [retainBtn, { action: 'cancel', label: 'Cancel' }] };
    }
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
    if (placeable(s, 'player').length) opts.push('place a <b>Location</b>');
    if (playableCommands(s, 'player', 'adapt').length || playableCommands(s, 'player', 'strat').length) opts.push('play a <b>Command</b>');
    if (playableSupporters(s, 'player').length) opts.push('a <b>Supporter</b>');
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
  const selCard = ui.select?.kind === 'hand' ? s.players.player.hand.find((c) => c.uid === ui.select.uid) : null;
  if (selCard && (isLoc(selCard) || selCard.cardType === 'Pokémon') && !whyNot(s, 'player', 'summon', selCard)) for (const i of isLoc(selCard) ? locationStarts(s, selCard) : emptySpaces(s, 'player')) targets.add(`player:${i}`);
  if (ui.select?.kind === 'attack') for (const t of legalTargets(s, 'player', ui.select.from)) if (t.kind === 'pokemon') targets.add(`ai:${t.space}`);
  if (['command', 'react'].includes(ui.select?.kind)) for (const t of commandTargets(s, 'player', s.players.player.hand.find((c) => c.uid === ui.select.uid))) targets.add(`${t.who}:${t.space}`);
  // The committed action during a React window.
  const pend = s.reactWindow?.pending;
  const committed = new Set();
  if (pend?.type === 'attack') { committed.add(`${pend.who}:${pend.from}`); if (pend.target.kind === 'pokemon') committed.add(`${opponentName(pend.who)}:${pend.target.space}`); }
  if (pend?.type === 'command') committed.add(`${pend.target.who}:${pend.target.space}`);
  if (pend?.type === 'summon') committed.add(`${pend.who}:${pend.space}`);
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  const canAttack = new Set(myTurn && !ui.select ? attackers(s, 'player') : []);
  const row = (who) => Array.from({ length: RULES.lanes }, (_, i) => {
    const c = s.players[who].row[i];
    const t = targets.has(`${who}:${i}`);
    const guarded = ui.select?.kind === 'attack' && who === 'ai' && c && guardOf(s, 'ai', i, s.players.player.row[ui.select.from].attackType);
    return `<div class="v4-space${t ? ' target' : ''}${committed.has(`${who}:${i}`) ? ' committed' : ''}${ui.select?.kind === 'attack' && who === 'player' && ui.select.from === i ? ' attacking' : ''}" style="left: ${i * COL}px" data-who="${who}" data-space="${i}"${guarded ? ` title="${esc(`Guarded by ${guarded.card.name}`)}"` : ''}>${c ? boardCard(s, c, who, i, canAttack.has(i) && who === 'player' ? 'can-attack' : '') : `<span class="v4-num">${i + 1}</span>`}</div>`;
  }).join('');
  return `<section class="v4-board">
    <div class="v4-mat"></div>
    ${defaultLabel(s)}
    <div class="v4-grid">${s.locations.map((l) => locationTile(s, l)).join('')}<div class="v4-row opponent">${row('ai')}</div><div class="v4-row player">${row('player')}</div></div>
  </section>`;
}

const opponentName = (who) => (who === 'player' ? 'ai' : 'player');

// A placed Location: a bold tile behind its lanes (both rows) with a compact panel between the rows.
function locationTile(s, l) {
  const d = dominantOf(s, l);
  const you = strengthIn(s, l, 'player');
  const opp = strengthIn(s, l, 'ai');
  const dom = d ? `<span class="${d}">${d === 'player' ? 'You dominate' : 'Opponent dominates'}</span> · +${RULES.perDominance} at Supper` : `<span>${you || opp ? 'Tied' : 'No one'}</span> · nothing at Supper`;
  const tip = `${l.name} (placed by ${l.owner === 'player' ? 'you' : 'the Opponent'}) · ${l.passive.text} · Weather: ${l.weather.count} ${l.weather.type} · Strength here: you ${you}, Opponent ${opp} · ${l.roundsLeft} Round${l.roundsLeft === 1 ? '' : 's'} left`;
  return `<div class="v4-loc" style="left: ${l.start * COL}px; width: ${l.width * COL}px; --loc: ${l.color}" title="${esc(tip)}">
    <div class="v4-loc-art" style="background-image: url('${art(l)}')"></div>
    <div class="v4-loc-panel" title="${esc(tip)}">
      <b>${esc(l.name)}</b>
      <p>${weatherIcon(l.weather.type)} ${l.weather.count} ${l.weather.type} · ${l.roundsLeft} Round${l.roundsLeft === 1 ? '' : 's'} left</p>
      <p class="v4-dom">${dom} <small>(${you}–${opp})</small></p>
    </div>
  </div>`;
}

// The Default Location's label, over its widest run of lanes (hidden when no lane is Default).
function defaultLabel(s) {
  let best = null;
  for (let i = 0; i < RULES.lanes;) {
    if (locationAt(s, i)) { i++; continue; }
    let j = i;
    while (j < RULES.lanes && !locationAt(s, j)) j++;
    if (!best || j - i > best.w) best = { start: i, w: j - i };
    i = j;
  }
  if (!best) return '';
  return `<div class="v4-default" style="left: ${14 + (best.start + best.w / 2) * COL}px"><b>Default Location</b>${best.w >= 3 ? '<small>no passive, Weather or dominance</small>' : ''}</div>`;
}

// --- The side panel ---------------------------------------------------------------------------------------------
function side(s, ui, ctx) {
  const me = s.players.player;
  const foe = s.players.ai;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !ui.select && !s.reactWindow;
  const ex = availableExert(me);
  const exhaust = me.exhaust.map((x) => `<li>Exhaust · position ${x.position} · back in Round ${x.recoversRound}</li>`).join('');
  const reason = (a) => (s.phase !== 'battle' ? 'Not the Battle Phase' : s.reactWindow ? 'A React window is open' : s.turn !== 'player' ? 'Not your turn' : null);
  const actions = [
    ['Summon', reason() ?? (summonable(s, 'player').length ? null : !emptySpaces(s, 'player').length ? 'No empty space on your side' : `No Pokémon you can pay for (${energyLeft(me)} Energy)`)],
    ['Place Location', reason() ?? (placeable(s, 'player').length ? null : !me.hand.some(isLoc) ? 'No Location in hand' : 'No room: not enough adjacent free lanes')],
    ['Command', reason() ?? (playableCommands(s, 'player', 'adapt').length || playableCommands(s, 'player', 'strat').length ? null : !me.hand.some(isCmd) ? 'No Command Card in hand' : playReason(s, 'player', me.hand.find(isCmd)))],
    ['Supporter', reason() ?? (playableSupporters(s, 'player').length ? null : !me.hand.some(isSup) ? 'No Supporter in hand' : playReason(s, 'player', me.hand.find(isSup)))],
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
    ${weatherPanel(s)}
    <button class="v4-pass" data-action="pass"${myTurn ? '' : ' disabled'}>Pass <small>${passEndsPhase(s) ? '(ends the Battle Phase)' : '(+1 Base Energy)'}</small></button>
    <section class="v4-panel v4-actions"><div class="v4-label">Actions</div>${actions.map(([n, why]) => `<p class="${why ? 'off' : 'on'}"><b>${n}</b>${why ? ` · ${esc(why)}` : ' · available'}</p>`).join('')}</section>
    ${stratPanel(s)}
    <section class="v4-panel v4-piles">
      <div class="v4-label">You</div><p>Hand ${me.hand.length} · Deck ${me.drawPile.length} · Discard ${me.discard.length} · <b title="${esc(`Released (for good, never reshuffled): ${me.released.map((c) => c.name).join(', ') || 'none'}`)}">Released ${me.released.length}</b></p>
      <div class="v4-label">Opponent</div><p>Hand ${foe.hand.length} · Deck ${foe.drawPile.length} · Discard ${foe.discard.length} · <b title="${esc(`Released: ${foe.released.map((c) => c.name).join(', ') || 'none'}`)}">Released ${foe.released.length}</b> · Energy ${foe.baseEnergy} + Exert ${availableExert(foe)}</p>
    </section>
    <section class="v4-panel v4-log"><div class="v4-label">Log</div>${s.log.slice(-7).map((l) => `<p>${esc(l)}</p>`).join('')}</section>
    <div class="v4-build"><p>${esc(ctx.build)}</p><p><a href="../v3/">v3</a> · <a href="../v2/">v2</a> · <a href="../">v1</a> · <button class="v4-link" data-action="new">New match</button></p></div>
  </aside>`;
}

// Pending Strats (both players'), with their targets.
function stratPanel(s) {
  if (!s.strats.length) return '';
  return `<section class="v4-panel v4-stratlist"><div class="v4-label">Pending Strats</div>${s.strats.map((x) => {
    const lane = x.target.space + 1;
    return `<p class="${x.owner}" title="${esc(`${modeText(x.card, 'strat')}. Resolves after ${x.owner === 'player' ? 'the Opponent\'s' : 'your'} next turn, or at Supper; fizzles if the target is gone.`)}">⏳ <b>${x.owner === 'player' ? 'Your' : 'Their'} ${esc(x.card.name)}</b> → ${esc(x.targetName)} (lane ${lane}) · ${esc(shortMode(x.card, 'strat'))}</p>`;
  }).join('')}</section>`;
}

// Weather: combined counts across placed Locations, and which brackets are active (both players).
function weatherPanel(s) {
  const t = weatherTotals(s);
  const on = new Set(activeBrackets(s));
  return `<section class="v4-panel v4-weather"><div class="v4-label">Weather</div>
    <p class="v4-wcount">${weatherIcon('Rain')} Rain <b>${t.Rain}</b> · ${weatherIcon('Sun')} Sun <b>${t.Sun}</b></p>
    ${WEATHER_BRACKETS.map((b) => `<p class="${[...on].some((x) => x.type === b.type && x.at === b.at) ? 'on' : 'off'}" title="${esc(`${b.type} ${b.at} or more (all placed Locations combined): ${b.text}. Applies to both players.`)}">${esc(bracketText(b))}</p>`).join('')}
  </section>`;
}

function hand(s, ui) {
  const me = s.players.player;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  const reacting = s.reactWindow?.reactor === 'player' && !ui.locked;
  const n = me.hand.length;
  const W = 1590;
  const CW = 156;
  const step = n > 1 ? Math.min(CW + 4, (W - CW) / (n - 1)) : 0;
  const start = (W - (CW + step * (n - 1))) / 2;
  return `<div class="v4-hand">${me.hand.map((c, i) => {
    const why = reacting ? (isCmd(c) ? whyNot(s, 'player', 'react', c) : 'Only a Command Card can React') : myTurn ? playReason(s, 'player', c) : null;
    const cls = [myTurn || reacting ? (why ? 'dim' : reacting ? 'playable reactable' : 'playable') : '', ui.select?.uid === c.uid ? 'sel' : ''].join(' ');
    return `<div class="v4-slot${ui.select?.uid === c.uid ? ' picked' : ''}" style="left: ${Math.round(start + step * i)}px">${handCard(s, c, `${cls} selectable`, `${detail(c)}${why ? ` · ${why}` : ''}`)}</div>`;
  }).join('')}</div>`;
}

function dialogs(s, ui) {
  const me = s.players.player;
  if (s.phase === 'gameOver') return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-over"><h2>${s.winner === 'player' ? 'Pokémon League Champion!' : 'Defeat'}</h2><p>${esc(s.log.at(-1))}</p><p>Round ${s.round} · You ${me.recognition} · Opponent ${s.players.ai.recognition}</p><button data-action="new">New match</button></div></div>`;
  if (ui.select?.kind === 'supporter') {
    const sup = me.hand.find((c) => c.uid === ui.select.uid);
    const chosen = ui.select.release;
    const others = me.hand.filter((c) => c !== sup);
    const fav = favourMet(sup, others.filter((c) => chosen.includes(c.uid)));
    const cond = FAVOURS[sup.favour.condition];
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide v4-release">
      <p><b>${esc(sup.name)}</b>: choose <b>${sup.release}</b> other card${sup.release === 1 ? '' : 's'} to Release. Released cards leave the match for good (the Released Pile is never reshuffled); then ${esc(sup.name)} is Released too.</p>
      <p>Effect: ${esc(effectText(sup.effect))}. <span class="fav">★ Favour: Release ${esc(cond.text)} → ${esc(effectText(sup.favour))}, and +${RULES.perFavour} Recognition.</span></p>
      <div class="v4-mini">${others.map((c) => {
        const meets = cond.test(c);
        const on = chosen.includes(c.uid);
        return `<button class="${on ? 'on' : ''}${meets ? ' meets' : ''}" data-rel="${c.uid}" style="background-image: url('${art(c)}')" title="${esc(detail(c))}">${on ? '<em>Release</em>' : ''}${meets ? '<i>★ Favour</i>' : ''}<span>${esc(c.name)}${c.cardType === 'Pokémon' ? ` L${c.level}` : ''}</span></button>`;
      }).join('')}</div>
      <p class="v4-relsum">${chosen.length} of ${sup.release} chosen · ${fav ? '<b class="fav">★ Favour met: the enhanced effect and Recognition</b>' : 'Favour not met'}</p>
      <div class="v4-buttons"><button data-action="sup-done"${chosen.length === sup.release ? '' : ' disabled'}>Release ${sup.release} and play ${esc(sup.name)}</button><button data-action="cancel">Cancel</button></div></div></div>`;
  }
  if (s.phase === 'mulligan' && !me.mulliganed && !ui.locked) {
    const chosen = ui.mull ?? [];
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide"><p><b>Round 1 · Mulligan</b>: choose any cards to put into your Discard Pile; you draw as many new ones.</p>
      <div class="v4-mini">${me.hand.map((c) => `<button class="${chosen.includes(c.uid) ? 'on' : ''}" data-mull="${c.uid}" style="background-image: url('${art(c)}')" title="${esc(detail(c))}"><span>${esc(c.name)}${c.cardType === 'Pokémon' ? ` L${c.level}` : ''}</span></button>`).join('')}</div>
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
  if (actor(s) !== 'player' || s.phase === 'mulligan' || ui.locked) return;
  // The React window: pick a Command card to React with, or let it happen.
  if (s.reactWindow) {
    on('[data-action="decline"]', () => ctx.act({ type: 'decline', who: 'player' }));
    on('.v4-hand .v4-card.reactable', (el) => { ui.select = ui.select?.uid === el.dataset.uid ? null : { kind: 'react', uid: el.dataset.uid }; ctx.redraw(); });
    on('.v4-space.target', (el) => ctx.act({ type: 'react', who: 'player', uid: ui.select.uid, target: { who: el.dataset.who, space: Number(el.dataset.space) } }));
    return;
  }
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('.v4-hand .v4-card', (el) => { ui.select = ui.select?.uid === el.dataset.uid ? null : { kind: 'hand', uid: el.dataset.uid }; ctx.redraw(); });
  on('[data-action="retain"]', () => ctx.act({ type: 'retain', who: 'player', uid: ui.select.uid }));
  on('[data-action="mode-adapt"]', () => { ui.select = { kind: 'command', uid: ui.select.uid, mode: 'adapt' }; ctx.redraw(); });
  on('[data-action="mode-strat"]', () => { ui.select = { kind: 'command', uid: ui.select.uid, mode: 'strat' }; ctx.redraw(); });
  on('[data-action="play-supporter"]', () => { ui.select = { kind: 'supporter', uid: ui.select.uid, release: [] }; ctx.redraw(); });
  on('[data-rel]', (el) => {
    const sup = s.players.player.hand.find((c) => c.uid === ui.select.uid);
    const r = ui.select.release;
    const u = el.dataset.rel;
    ui.select.release = r.includes(u) ? r.filter((x) => x !== u) : [...(r.length >= sup.release ? r.slice(1) : r), u];
    ctx.redraw();
  });
  on('[data-action="sup-done"]', () => ctx.act({ type: 'supporter', who: 'player', uid: ui.select.uid, release: ui.select.release }));
  on('.v4-space.target', (el) => {
    const who = el.dataset.who;
    const space = Number(el.dataset.space);
    const k = ui.select?.kind;
    if (k === 'command') return ctx.act({ type: 'command', who: 'player', uid: ui.select.uid, mode: ui.select.mode, target: { who, space } });
    if (k === 'attack') return ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'pokemon', space } });
    const c = s.players.player.hand.find((x) => x.uid === ui.select.uid);
    if (isLoc(c)) return ctx.act({ type: 'placeLocation', who: 'player', uid: c.uid, start: space });
    return ctx.act({ type: 'summon', who: 'player', uid: c.uid, space });
  });
  on('.v4-row.player .v4-card.can-attack', (el) => { ui.select = { kind: 'attack', from: Number(el.dataset.space) }; ctx.redraw(); });
  on('.v4-pc.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.select.from, target: { kind: 'player' } }));
}
