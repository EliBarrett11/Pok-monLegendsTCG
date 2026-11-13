// The shared choice flows (UX3): for a choice in progress ("sel": a hand card, an attacker, a Command
// mode, an Item, a React card), which places are legal, why the others aren't, what a click, a drop
// or Enter there would do, and the preview to show. Clicks (board.js), drags and keys (interact.js) all
// go through here, so the three can never behave differently. No DOM; previews come from the engine's
// pure preview helpers.
import {
  legalTargets, emptySpaces, whyNot, locationStarts, summonCost, commandTargets, commandModesFor, itemTargets, buyReason,
  trainerReason, supporterPlayable, playerGuard, guardOf, energyLeft, locationAt, damageOf, pokemonOf, hasKw,
} from '../engine/game.js?v=202611132108';
import { MODE_NAMES, modeTarget } from '../engine/cards.js?v=202611132108';
import { attackPreview, effectPreview, choicePreview } from '../engine/preview.js?v=202611132108';
import { statsIfPlaced } from '../engine/stats.js?v=202611132108';
import { attackIcon, strengthIcon, icon } from './icons.js?v=202611132108';

const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const sameHit = (a, b) => a && b && a.kind === b.kind && a.who === b.who && a.space === b.space;
export { sameHit };

// The card a choice is about (hand, Bag or PokéMart), or the attacker.
export function selCard(s, sel) {
  const me = s.players.player;
  if (!sel) return null;
  if (sel.kind === 'attack') return me.row[sel.from];
  // G2: a chosen-target On Summon: the summoned Pokémon.
  // B3-1: or the effect waiting for its choice (a Supporter's, a Trainer Command's: no Pokémon of its own).
  if (sel.kind === 'choice') return s.choice?.who === 'player' ? (s.choice.space !== null && s.choice.space !== undefined ? me.row[s.choice.space] : null) ?? { name: s.choice.name, cardType: 'Effect' } : null;
  if (sel.kind === 'item') return sel.from === 'mart' ? s.mart.onSale[sel.slot] : sel.from === 'bag' ? me.bag.find((c) => c.uid === sel.uid) : me.hand.find((c) => c.uid === sel.uid);
  return me.hand.find((c) => c.uid === sel.uid) ?? null;
}
const playableModes = (s, c) => commandModesFor(s, 'player', c.uid).filter((m) => !m.reason);
// G3: the mode whose targets a choice shows (a mode chosen, React, or the first playable from hand:
// Adapt and Strat always share their target kind).
const modeOf = (s, sel, c) => (sel.kind === 'command' ? sel.mode : sel.kind === 'react' ? 'react' : playableModes(s, c)[0]?.mode ?? 'adapt');
// A Command's targets as places on the board: a Pokémon's space; a lane (Rock Slide, Surf: its
// Location, or the lane alone); all enemies (Heat Wave): any enemy Pokémon's space stands for them all.
const cmdHits = (s, c, mode) => commandTargets(s, 'player', c, mode).flatMap((t) => (t.all ? pokemonOf(s, t.who).map(({ space }) => ({ kind: 'space', who: t.who, space })) : [{ kind: 'space', who: t.who, space: t.space }]));
// The engine target behind a place (G3: with its lane or all flag).
export function cmdTarget(s, c, mode, hit) {
  const ts = commandTargets(s, 'player', c, mode);
  return ts.find((t) => t.all) ?? ts.find((t) => t.who === hit.who && t.space === hit.space) ?? { who: hit.who, space: hit.space };
}
// G3: an Item with no target (Amulet Coin): dropped anywhere on the board.
const noTargetItem = (c) => c?.cardType === 'Item' && c.noTarget;
// Does this choice need a target on the battlefield (an arrow), or just the board?
export function needsArrow(s, sel) {
  if (!sel) return false;
  if (['attack', 'command', 'item', 'react', 'choice'].includes(sel.kind)) return true;
  const c = selCard(s, sel);
  return sel.kind === 'hand' && (c?.cardType === 'Command' || c?.cardType === 'Item');
}

// Every legal place for a choice: { kind: 'space', who, space } | { kind: 'pc', who: 'ai' } | { kind: 'board' }.
export function hitsFor(s, sel) {
  if (!sel) return [];
  const sp = (who, space) => ({ kind: 'space', who, space });
  const c = selCard(s, sel);
  if (!c) return [];
  switch (sel.kind) {
    case 'attack': return legalTargets(s, 'player', sel.from).map((t) => (t.kind === 'player' ? { kind: 'pc', who: 'ai' } : sp('ai', t.space)));
    case 'command':
    case 'react': return cmdHits(s, c, modeOf(s, sel, c));
    case 'item': return noTargetItem(c) ? [{ kind: 'board' }] : itemTargets(s, 'player', c).map((t) => sp('player', t.space));
    // (B3-2: a card pick is made in its picker, not on the board; a space pick glows the empty spaces offered.)
    case 'choice': return s.choice?.pick === 'card' ? [] : (s.choice?.targets ?? []).map((t) => sp(t.who, t.space));
    case 'hand':
      if (c.cardType === 'Pokémon') return whyNot(s, 'player', 'summon', c) ? [] : emptySpaces(s, 'player').filter((i) => energyLeft(s.players.player) >= summonCost(s, c, i)).map((i) => sp('player', i));
      if (c.cardType === 'Location') return locationStarts(s, c).map((i) => sp('player', i));
      if (c.cardType === 'Command') return playableModes(s, c).length ? cmdHits(s, c, modeOf(s, sel, c)) : [];
      if (c.cardType === 'Item') return buyReason(s, 'player', c, 'use') ? [] : noTargetItem(c) ? [{ kind: 'board' }] : itemTargets(s, 'player', c).map((t) => sp('player', t.space));
      if (c.cardType === 'Trainer') return trainerReason(s, 'player', c) ? [] : [{ kind: 'board' }];
      if (c.cardType === 'Supporter') return supporterPlayable(s, 'player', c) ? [{ kind: 'board' }] : [];
      return [];
    default: return [];
  }
}

// What a click, drop or Enter at `hit` would do: { legal, reason } plus one of: act (an engine action),
// picker (choose a Command mode), open: 'supporter' (the Release choice).
export function evaluate(s, sel, hit) {
  const c = selCard(s, sel);
  if (!sel || !c || !hit) return { legal: false, reason: '' };
  // A Location covers both rows: a lane on either row sets its start.
  if (c.cardType === 'Location' && sel.kind === 'hand' && hit.kind === 'space') hit = { ...hit, who: 'player' };
  const hits = hitsFor(s, sel);
  const boardOnly = hits.length && hits.every((h) => h.kind === 'board');
  if (boardOnly && (hit.kind === 'board' || hit.kind === 'space')) {
    if (c.cardType === 'Trainer') return { legal: true, act: { type: 'trainerCommand', who: 'player', uid: c.uid } };
    if (noTargetItem(c)) {
      const t = { who: 'player', space: null };
      if (sel.kind === 'item' && sel.from === 'bag') return { legal: true, act: { type: 'useItem', who: 'player', uid: c.uid, target: t } };
      return { legal: true, act: { type: 'buyItem', who: 'player', from: sel.kind === 'item' ? sel.from : 'hand', uid: c.uid, slot: sel.slot, then: 'use', target: t } };
    }
    return { legal: true, open: 'supporter' };
  }
  const legal = hits.some((h) => sameHit(h, hit));
  if (!legal) return { legal: false, reason: reasonAt(s, sel, c, hit) };
  const target = hit.kind === 'pc' ? { kind: 'player' } : c.cardType === 'Command' ? cmdTarget(s, c, modeOf(s, sel, c), hit) : { who: hit.who, space: hit.space };
  switch (sel.kind) {
    case 'attack': return { legal: true, act: { type: 'attack', who: 'player', from: sel.from, target: hit.kind === 'pc' ? { kind: 'player' } : { kind: 'pokemon', space: hit.space } } };
    case 'command': return { legal: true, act: { type: 'command', who: 'player', uid: c.uid, mode: sel.mode, target } };
    case 'react': return { legal: true, act: { type: 'react', who: 'player', uid: c.uid, target } };
    case 'choice': return { legal: true, act: { type: 'choose', who: 'player', target } };
    case 'item': return { legal: true, act: sel.from === 'bag' ? { type: 'useItem', who: 'player', uid: c.uid, target: { space: hit.space } } : { type: 'buyItem', who: 'player', from: sel.from, uid: c.uid, slot: sel.slot, then: 'use', target: { space: hit.space } } };
    default: break;
  }
  if (c.cardType === 'Pokémon') return { legal: true, act: { type: 'summon', who: 'player', uid: c.uid, space: hit.space } };
  if (c.cardType === 'Location') return { legal: true, act: { type: 'placeLocation', who: 'player', uid: c.uid, start: hit.space } };
  if (c.cardType === 'Item') return { legal: true, act: { type: 'buyItem', who: 'player', from: 'hand', uid: c.uid, then: 'use', target: { space: hit.space } } };
  if (c.cardType === 'Command') {
    const modes = playableModes(s, c);
    if (modes.length === 1) return { legal: true, act: { type: 'command', who: 'player', uid: c.uid, mode: modes[0].mode, target } };
    return { legal: true, picker: { uid: c.uid, target, modes: modes.map((m) => m.mode) } };
  }
  return { legal: false, reason: '' };
}

// Why a place isn't legal for this choice (shown on hover).
function reasonAt(s, sel, c, hit) {
  const me = s.players.player;
  const occupant = hit.kind === 'space' ? s.players[hit.who].row[hit.space] : null;
  if (hit.kind === 'board') return '';
  if (sel.kind === 'choice') return hit.kind === 'pc' ? 'It targets Pokémon only' : s.choice?.pick === 'space' ? (occupant ? 'Choose an empty space' : `Not a space for ${s.choice?.name ?? 'this effect'}`) : occupant ? `Not a target for ${s.choice?.name ?? 'this effect'}` : 'No Pokémon here';
  if (sel.kind === 'attack') {
    if (hit.kind === 'pc') { const g = playerGuard(s, 'player', sel.from, 'ai'); return g ? `The Opponent is guarded by ${g.card.name}` : ''; }
    if (hit.who === 'player') return 'Choose an enemy Pokémon or the Opponent';
    if (!occupant) return 'No Pokémon here';
    const g = guardOf(s, 'ai', hit.space, c.attackType);
    return g ? `Guarded by ${g.card.name}` : '';
  }
  if (hit.kind === 'pc') return 'Not a target for this card';
  if (sel.kind === 'command' || sel.kind === 'react' || (sel.kind === 'hand' && c.cardType === 'Command')) {
    if (sel.kind === 'hand') { const m = commandModesFor(s, 'player', c.uid); if (!m.some((x) => !x.reason)) return m[0]?.reason ?? 'Not now'; }
    const tg = modeTarget(c, modeOf(s, sel, c));
    if (tg === 'location') return hit.who === 'player' ? 'Choose a Location (or lane) with an enemy Pokémon' : 'No enemy Pokémon in this Location';
    if (tg === 'ownLocation') return hit.who === 'ai' ? 'Choose a Location (or lane) with one of your Pokémon' : 'None of your Pokémon in this Location';
    if (!occupant) return 'No Pokémon here';
    // B3-1: Agility: the opponent's Moves can't choose it.
    if (tg === 'enemy' && hit.who === 'ai' && hasKw(occupant, 'agility')) return `${occupant.name} has Agility: Moves can't choose it`;
    return { enemy: 'Choose an enemy Pokémon', allEnemies: 'It hits each enemy Pokémon: choose any of them', allOwn: 'It acts on each of your Pokémon: choose any of them', attacker: 'Only the attacker', attacked: 'Only your Pokémon being attacked' }[tg]
      ?? (c.modes[modeOf(s, sel, c)].ops.some((o) => o.op === 'returnHand') && occupant.partner ? 'A Partner can\'t go back to a hand (it isn\'t a deck card)' : 'Choose one of your Pokémon');
  }
  if (sel.kind === 'item' || (sel.kind === 'hand' && c.cardType === 'Item')) {
    if (sel.kind === 'hand') { const why = buyReason(s, 'player', c, 'use'); if (why) return why; }
    if (hit.who !== 'player') return 'Use it on one of your Pokémon';
    if (!occupant) return 'No Pokémon here';
    return c.itemType === 'Held' && occupant.held ? `${occupant.name} already holds ${occupant.held.name}` : 'Not a target for this Item';
  }
  if (c.cardType === 'Pokémon') {
    const why = whyNot(s, 'player', 'summon', c);
    if (why) return why;
    if (hit.who !== 'player') return 'Summon on your side';
    if (occupant) return `Taken by ${occupant.name}`;
    return `Needs ${summonCost(s, c, hit.space)} Energy · you have ${energyLeft(me)}`;
  }
  if (c.cardType === 'Location') return whyNot(s, 'player', 'summon', c) ?? `No room from lane ${hit.space + 1}: needs ${c.width} adjacent free lanes`;
  if (c.cardType === 'Trainer') return trainerReason(s, 'player', c) ?? '';
  if (c.cardType === 'Supporter') return whyNot(s, 'player', 'supporter', c) ?? '';
  return '';
}

// The preview panel for a legal place (HTML), or null.
const chip = (text, kind) => `<span class="gain ${kind}">${esc(text)}</span>`;
const rec = (n, s) => `+${n} Recognition${s.tournament ? ' (×1.5)' : ''}`;
function rewardChips(r, s, lead = '') {
  const out = [];
  if (r.recognition) out.push(chip(`${lead}${rec(r.recognition, s)}`, 'r'));
  if (r.dollars) out.push(chip(`+$${r.dollars}`, 'd'));
  return out.join('');
}
function changeLine(s, ch) {
  const p = s.players[ch.who].row[ch.space];
  const ic = ch.stat === 'attack' ? attackIcon(p) : strengthIcon(p);
  return `<div class="m">${esc(ch.who === 'player' ? 'Your' : 'Their')} ${esc(ch.name)}: ${ic} <s>${ch.before}</s> → <b>${Math.max(0, ch.after)}</b>${ch.defeated ? ' <span class="k">defeated</span>' : ''}</div>`;
}
export function previewHTML(s, sel, hit) {
  const c = selCard(s, sel);
  const r = evaluate(s, sel, hit);
  if (!r.legal) return null;
  if (sel.kind === 'attack') {
    const pv = attackPreview(s, 'player', sel.from, hit.kind === 'pc' ? { kind: 'player' } : { kind: 'pokemon', space: hit.space });
    const a = c;
    const parts = pv.parts.length > 1 ? `<div class="sub">${pv.damage} = ${pv.parts.map((p) => `${p.n} ${esc(p.label)}`).join(' + ')}</div>` : '';
    if (hit.kind === 'pc') {
      return `<div class="h">${esc(a.name)} attacks the Opponent</div><div class="m">${attackIcon(a)} ${pv.damage} → Recognition</div>${parts}<div class="g">${rewardChips(pv.rewards, s)}${pv.gameOver === 'player' ? chip('Wins the match!', 'r') : ''}</div>`;
    }
    const d = s.players.ai.row[hit.space];
    const t = pv.target;
    let html = `<div class="h">${esc(a.name)} attacks ${esc(d.name)}</div><div class="m">${attackIcon(a)} ${pv.damage} → ${strengthIcon(d)} <s>${t.before}</s> → <b>${Math.max(0, t.after)}</b></div>${parts}`;
    const chips = [];
    if (t.defeated) chips.push(chip(`Defeats it · ${rec(pv.rewards.recognition, s)}`, 'r'));
    else if (pv.rewards.recognition) chips.push(chip(rec(pv.rewards.recognition, s), 'r'));
    if (pv.rewards.dollars) chips.push(chip(`+$${pv.rewards.dollars}`, 'd'));
    for (const o of pv.objectives) chips.push(chip(`${o.who === 'player' ? 'Your' : 'Their'} ${o.name} Objective completes`, 'r'));
    html += chips.length ? `<div class="g">${chips.join('')}</div>` : '';
    if (pv.hitBack) {
      const hb = pv.hitBack;
      html += `<div class="hb">${esc(d.name)} hits back: ${attackIcon(d)} ${hb.damage} → ${esc(a.name)} ${strengthIcon(a)} <s>${a.currentStrength}</s> → <b>${Math.max(0, hb.attackerAfter)}</b>${hb.defeated ? ' (defeated)' : ''}${hb.rewards.recognition || hb.rewards.dollars ? ` · the Opponent ${[hb.rewards.recognition ? rec(hb.rewards.recognition, s) : '', hb.rewards.dollars ? `+$${hb.rewards.dollars}` : ''].filter(Boolean).join(', ')}` : ''}</div>`;
    } else if (pv.attacker.defeated) html += `<div class="hb">${esc(a.name)} is defeated too</div>`;
    return html;
  }
  if (sel.kind === 'choice') {
    const pv = choicePreview(s, { who: hit.who, space: hit.space });
    const on = s.players[hit.who].row[hit.space];
    const onName = on?.name ?? locationAt(s, hit.space)?.name ?? `lane ${hit.space + 1}`;   // (B3-1: a Location's lane)
    let html = `<div class="h">${esc(pv.name)} → ${esc(onName)}</div><div class="sub">${esc(pv.text)}</div>` + pv.changes.map((ch) => changeLine(s, ch)).join('');
    const chips = rewardChips(pv.rewards, s, pv.changes.some((ch) => ch.defeated && ch.who === 'ai') ? 'Defeats · ' : '');
    if (chips) html += `<div class="g">${chips}</div>`;
    return html;
  }
  if (c.cardType === 'Pokémon') {
    const cost = summonCost(s, c, hit.space);
    const l = locationAt(s, hit.space);
    // C4: the values it would have here (the engine's own summon on a copy): "Attack 4 ▲ on Mt. Ember".
    const st = statsIfPlaced(s, 'player', c, hit.space);
    const arrow = { up: ' ▲', down: ' ▼', '': '' };
    const why = st ? st.attackParts.slice(1).map((x) => x.label).concat(st.strengthParts.slice(1).filter((x) => x.label !== 'damage').map((x) => x.label)) : [];
    const stats = st ? `<div class="m stats"><span class="${st.attackTrend}">Attack ${st.attack}${arrow[st.attackTrend]}</span> · <span class="${st.strengthTrend}">Strength ${st.strength}${arrow[st.strengthTrend]}</span>${why.length ? ` <span class="k">on ${esc([...new Set(why)].join(', '))}</span>` : ''}</div>` : '';
    return `<div class="h">Summon ${esc(c.name)} here</div>${stats}<div class="m">${icon('energy')} ${cost} Energy${cost < c.cost ? ` <span class="k">(${esc(l?.name ?? 'discount')}: −${c.cost - cost})</span>` : ''}</div><div class="sub">Lane ${hit.space + 1}${l ? ` · in ${esc(l.name)}: ${esc(l.passive.text)}` : ''} · arrives Spent</div>`;
  }
  if (c.cardType === 'Location') return `<div class="h">Place ${esc(c.name)}</div><div class="m">Lanes ${hit.space + 1}–${hit.space + c.width} · ${c.rounds} Rounds · no Energy</div><div class="sub">${esc(c.passive.text)}</div>`;
  if (r.open === 'supporter') return `<div class="h">Play ${esc(c.name)}</div><div class="sub">Then choose ${c.release} card${c.release === 1 ? '' : 's'} to Release</div>`;
  // Effects: Commands (the chosen mode, or each available mode), Items, Trainer Commands.
  const target = hit.kind === 'space' ? (c.cardType === 'Command' ? cmdTarget(s, c, modeOf(s, sel, c), hit) : { who: hit.who, space: hit.space }) : noTargetItem(c) ? { who: 'player', space: null } : null;
  const modes = c.cardType === 'Command' ? (sel.kind === 'command' ? [sel.mode] : sel.kind === 'react' ? ['react'] : playableModes(s, c).map((m) => m.mode)) : [c.cardType === 'Item' ? 'use' : 'command'];
  const on = target && target.space !== null && !target.lane && !target.all ? s.players[target.who].row[target.space] : null;
  const area = target?.all ? 'each enemy Pokémon' : target?.lane ? (locationAt(s, target.space)?.name ? `each enemy in ${locationAt(s, target.space).name}` : `each enemy in lane ${target.space + 1}`) : '';
  let html = `<div class="h">${esc(c.name)}${on ? ` → ${esc(on.name)}` : area ? ` → ${esc(area)}` : ''}</div>`;
  for (const m of modes) {
    const pv = effectPreview(s, 'player', c, m, target);
    const head = c.cardType === 'Command' && modes.length > 1 ? `<div class="mode-h">${MODE_NAMES[m]} · ${icon('energy')}${c.modes[m].cost}${m === 'strat' ? ' · after their next turn' : ''}</div>` : '';
    html += head + pv.changes.map((ch) => changeLine(s, ch)).join('') + (pv.text ? `<div class="sub">${esc(pv.text)}</div>` : '');
    const chips = rewardChips(pv.rewards, s, pv.changes.some((ch) => ch.defeated && ch.who === 'ai') ? 'Defeats · ' : '');
    if (chips) html += `<div class="g">${chips}</div>`;
  }
  return html;
}

// The Location's outline for a placement preview: { start, width } when legal.
export function placementAt(s, sel, hit) {
  const c = selCard(s, sel);
  if (!c || c.cardType !== 'Location' || hit?.kind !== 'space') return null;
  return evaluate(s, sel, hit).legal ? { start: hit.space, width: c.width } : null;
}

// Carry out a legal choice: act, open the mode picker, or open the Release choice. Returns true if
// something happened.
export function commitHit(s, ui, ctx, sel, hit, at = null) {
  const r = evaluate(s, sel, hit);
  if (!r.legal) return false;
  ui.drag = null;
  ui.focus = null;
  if (r.picker) {
    ui.select = { kind: 'hand', uid: r.picker.uid };
    ui.picker = { ...r.picker, x: at?.x ?? 960, y: at?.y ?? 480 };
    ctx.redraw();
    return true;
  }
  if (r.open === 'supporter') {
    ui.select = { kind: 'supporter', uid: sel.uid, release: [] };
    ctx.redraw();
    return true;
  }
  ui.select = null;
  ui.picker = null;
  ctx.act(r.act);
  return true;
}
export const damageNumber = damageOf;
