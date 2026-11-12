// Drawing a v4 match. UX2: the approved layout (docs/design/v4-ux2-layout-mockup.jpg and .html), on a
// fixed 1920×1080 stage:
//   the prompt bar (the only place for step text and action buttons); the opponent's HUD (Recognition
//   ring, purse, Energy line, Bag, Objective trackers), hand backs and piles; the board (9 lanes, two
//   rows; Locations as full tiles under the Pokémon with a plate across the middle; the Tournament as
//   one tile); the right column (Round, Weather chip, Energy tile, END TURN, the PokéMart card (G1) and
//   drawer, the log ticker and drawer); your HUD; the fanned hand; your piles and key hints.
// Earlier stages, kept: F1–F5's actions and screens (Commands, React windows, Strats, Supporters,
// Items, Trainers, the Tournament), UX1's Objective trackers, commandModesFor, the React window and
// timer (main.js), no series shown, Recognition shown capped at 100.
import { RULES } from '../rules.js?v=202611110816';
import {
  isReady, legalTargets, attackers, summonable, emptySpaces, whyNot, passEndsPhase, passSpends, passReason, passBlockers, availableExert, energyLeft,
  playerGuard, guardOf, placeable, locationStarts, weatherTotals, activeBrackets, dominantOf, strengthIn,
  actor, commandTargets, playableSupporters, playReason, favourMet,
  commandModesFor, damageOf, effectiveSpeed, locationAt,
  itemTargets, buyReason, tournamentDominant, tournamentStrength, boosted, buyableFromHand, buyableFromMart, usableFromBag, playableTrainers, trainerReason,
} from '../engine/game.js?v=202611110816';
import { COMMANDS, SUPPORTERS, ITEMS, LOCATIONS, WEATHER_BRACKETS, MODE_NAMES, FAVOURS, modeText, effectText, opText, BAG_SIZE, PATHS, TRAINERS } from '../engine/cards.js?v=202611110816';
import { baseEnergyFor, EXERT_LIMIT } from '../engine/energy.js?v=202611110816';
import { icon, attackIcon, STAT_NAMES, attackKey, strengthKey } from './icons.js?v=202611110816';
import { hitsFor, commitHit } from './flows.js?v=202611110816';
import { cardHTML, CARD_DEFS, SIZES, H as CARD_H, W as CARD_W, artFocus } from './card.js?v=202611110816';
import { termsIn } from '../engine/glossary.js?v=202611110816';
import { effectiveStats, statSumLines } from '../engine/stats.js?v=202611110816';
import { reactOutcome, reactSummary } from '../engine/preview.js?v=202611110816';
import { rulesHTML } from './codex.js?v=202611110816';

// UX3: the key list (the ? overlay and the hint at the bottom-right).
export const KEY_LIST = [
  ['Space', 'End turn (Pass)'], ['1–9', 'select a hand card'], ['A', 'Attack: select an attacker; again for the next one'], ['R', 'Retain the selected card'],
  ['Tab / Shift+Tab', 'cycle the legal targets or spaces, with the preview'], ['Enter', 'confirm the highlighted target'], ['Esc / right-click', 'cancel the choice in progress'], ['C / right-click', 'open the Codex on what is under the pointer (right-click when no choice is in progress); Esc closes it'],
  ['L', 'open or close the log'], ['?', 'this list'], ['React window', 'Space React (one option, one target) · Esc let it happen'],
  ['Drag', 'a hand card to a space, a target or the board; a Ready Pokémon to its target; a Bag Item to one of your Pokémon'],
];

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const art = (c) => `${ASSETS}/cards/${c.art}.jpg`;

// --- Geometry (from the mockup) ---------------------------------------------------------------------
// The board: left 24, top 180, 1580×584. Lanes are 172.4 wide from x 14. C1: the board tokens are the
// card renderer's 164×230 (164, not 170: nine lanes of 172.4 leave 8 px between tokens); the rows sit 14
// from the top and the bottom. Coordinates below are relative to the board.
const BOARD = { left: 24, top: 180, w: 1580, h: 584 };
const LW = 172.4;
const TOK = { w: SIZES.token, h: Math.round((SIZES.token * CARD_H) / CARD_W) };
const laneX = (i) => 14 + i * LW + (LW - TOK.w) / 2;
const ROW_TOP = { ai: 14, player: BOARD.h - 14 - TOK.h };
const tileX = (start) => 14 + start * LW;

// --- Card text (titles and tooltips; no series anywhere) ------------------------------------------------
const isLoc = (c) => c?.cardType === 'Location';
const isCmd = (c) => c?.cardType === 'Command';
const isSup = (c) => c?.cardType === 'Supporter';
const isItem = (c) => c?.cardType === 'Item';
const isTrainer = (c) => c?.cardType === 'Trainer';
const isMon = (c) => c?.cardType === 'Pokémon';
const statWords = (c) => `${STAT_NAMES[attackKey(c)]} ${c.attack} · ${STAT_NAMES[strengthKey(c)]} ${c.currentStrength ?? c.strength}/${c.strength}${c.strengthType === 'Defence' ? ' (guards against Physical)' : c.strengthType === 'Special Defence' ? ' (guards against Special)' : ''}`;
// G3: each mode's effect from cards.js (a few words on the card; a sentence elsewhere).
const longMode = modeText;
const partnerText = (pc) => `${pc.name} (Level ${pc.level} · ${pc.type} · ${pc.speed} · ${statWords(pc)}${pc.text ? ` · ${pc.text}` : ''})`;
const weatherIcon = (type) => (type === 'Rain' ? '☂' : '☀');
const whose = (w) => (w === 'player' ? 'your' : 'the Opponent\'s');
const Whose = (w) => (w === 'player' ? 'Your' : 'The Opponent\'s');
const opponentName = (who) => (who === 'player' ? 'ai' : 'player');

// --- Cards (C1: every card is drawn by src/ui/card.js) ---------------------------------------------------------
// Hover replaces tooltips: an element with data-zoom shows its card at Full size (the zoom layer, wired
// below); its reason (data-why) shows as a short line under it.
const zoomCards = new Map();
// C3: a Full card that can be inspected: a Codex ref and an ⓘ in its corner (shown on hover).
const fullWrap = (c, html) => `<div class="v4-fullwrap" data-codex="card:${c.uid}">${html}<button class="v4-info" aria-label="Inspect ${esc(c.name)} in the Codex">ⓘ</button></div>`;
// C3: plain text with every glossary term a link (opens its Codex entry); HTML tags are kept as they are.
export function linkHTML(html) {
  return String(html).split(/(<[^>]+>)/).map((part, k) => (k % 2 ? part : termsIn(part.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#39;/g, "'")).map((p) => (p.id ? `<a class="v4-term" data-term="${p.id}">${esc(p.text)}</a>` : esc(p.text))).join(''))).join('');
}
const linkText = (text) => linkHTML(esc(text));
let zoomSeq = 0;
const zoomKey = (c, state = {}) => { const k = `z${zoomSeq++}`; zoomCards.set(k, { card: c, state }); return k; };
// C4: a board Pokémon's current stats for its stat tabs (and its hover Full card), from the engine's effectiveStats.
export function tabStats(s, who, space) {
  const st = s.players[who].row[space] ? effectiveStats(s, who, space) : null;
  if (!st) return null;
  const sums = statSumLines(st);
  return { attack: st.attack, attackTrend: st.attackTrend, strength: st.strength, strengthMax: st.strengthMax, strengthTrend: st.strengthTrend, sumAttack: sums.attack, sumStrength: sums.strength };
}
function boardCard(s, c, who, space, cls = '', why = '') {
  const ready = s.phase === 'battle' && isReady(s, c);
  const stats = s.players[who].row[space]?.uid === c.uid ? tabStats(s, who, space) : null;
  const strats = s.strats.filter((x) => x.target.who === who && x.target.space === space && x.target.uid === c.uid);
  // C4 (hidden Strats): the Opponent's sealed Strat marks its target without naming the card; yours stay named.
  const badges = strats.map((x) => `<span class="cd-chip strat" style="font-size:20px">⏳ ${esc(x.owner === 'player' ? x.card.name : 'Sealed Strat')}</span>`).join('');
  const state = { ready, spent: c.spent, badges, stats };
  return `<div class="v4-card v4-mon${c.partner ? ' partner' : ''}${ready ? ' ready' : ''}${c.spent ? ' spent' : ''}${c.tempAttack > 0 ? ' aura' : ''} ${cls}" data-uid="${c.uid}" data-who="${who}" data-space="${space}" data-codex="mon:${who}:${space}" data-zoom="${zoomKey(c, { ready, spent: c.spent, stats })}"${why ? ` data-why="${esc(why)}"` : ''}>${cardHTML(c, { size: 'token', state: { ...state, illegal: !!why, illegalReason: why } })}</div>`;
}

// --- Hand cards (C1: Mini, 200 px): art, cost, name, stat tabs and one tag ------------------------------------
export function renderHandCard(s, c, cls = '', why = '', strip = null) {
  const me = s.players.player;
  const state = { retained: !!c.retained };
  if (isCmd(c)) state.modes = commandModesFor(s, 'player', c.uid);
  const afford = isMon(c) ? energyLeft(me) >= c.cost : isItem(c) ? me.dollars >= c.price : isTrainer(c) ? energyLeft(me) >= c.command.cost : true;
  return `<div class="v4-card v4-hcard k-${String(c.cardType).toLowerCase().replace('é', 'e')} ${cls}${afford ? '' : ' poor'}" data-uid="${c.uid}" data-codex="card:${c.uid}" data-zoom="${zoomKey(c, state)}"${why ? ` data-why="${esc(why)}"` : ''}>${cardHTML(c, { size: 'mini', state, strip })}</div>`;
}
// C2: in the fanned hand a card's text must show in full or not at all. After drawing, any text element
// of a hand card that reaches under the card on top of it is hidden (its Full card still shows on hover).
export function fitHandStrips(root) {
  if (typeof root?.querySelectorAll !== 'function') return;
  const slots = [...root.querySelectorAll('.v4-hand .v4-slot')];
  slots.forEach((slot, i) => {
    for (const el of slot.querySelectorAll('.cd-cut')) el.classList.remove('cd-cut');
    const above = slots.slice(i + 1).map((x) => x.querySelector('.cd')?.getBoundingClientRect()).filter(Boolean);
    if (!above.length) return;
    const coverLeft = Math.min(...above.map((r) => r.left)) - 2;
    // Each chip on its own (a tag row keeps the chips that fit), then any other piece of text.
    for (const el of slot.querySelectorAll('.cd-chip, .cd-t:not(.cd-chips)')) {
      if (el.closest('.cd-cut')) continue;
      // The text itself (a name wider than its zone spills past the zone's box).
      const range = document.createRange();
      range.selectNodeContents(el);
      const right = Math.max(el.getBoundingClientRect().right, ...[...range.getClientRects()].map((q) => q.right));
      // Also a name wider than its strip's zone (it would overflow its box even where nothing covers it).
      if (right > coverLeft || (el.matches('.cd-t') && el.scrollWidth > el.clientWidth + 1)) el.classList.add('cd-cut');
    }
  });
}

// --- The prompt bar ------------------------------------------------------------------------------------
export function promptFor(s, ui, ctx = {}) {
  const me = s.players.player;
  // UX4: the AI's pacing: a thinking pause, then its action named (C).
  if (ui.aiNote) return { tag: 'Opponent', text: esc(ui.aiNote) };
  // G2: a chosen-target On Summon waits for its target (it can't be cancelled once summoned).
  if (s.choice) {
    if (s.choice.who !== 'player') return { tag: `${s.choice.name} · On Summon`, text: 'The Opponent is choosing a target…' };
    return { tag: `${s.choice.name} · On Summon`, text: `${esc(opText(s.choice.op))}: choose <b>a glowing target</b>. (It's summoned: this can't be cancelled.)`, gold: true };
  }
  if (s.phase === 'gameOver') return { tag: s.winner === 'player' ? 'Champion!' : 'Defeat', text: esc(s.log.at(-1)) };
  if (s.phase === 'mulligan') return { tag: 'Round 1 · Mulligan', text: me.mulliganed ? 'The Opponent is choosing…' : 'Choose any cards to put back into your Discard Pile; you draw as many.', gold: !me.mulliganed };
  // The React window (UX1).
  if (s.reactWindow) {
    const w = s.reactWindow;
    // C4: once you've decided, the bar says what is resolving (the window itself is already gone).
    if (w.reactor === 'player' && ui.locked) return { tag: 'Resolving', text: `${esc(w.pending.text)}…` };
    if (w.reactor !== 'player' || ui.locked) return { tag: 'React?', text: `${esc(w.pending.text)}. The Opponent may React first…` };
    if (ui.select?.kind === 'react') {
      const c = me.hand.find((x) => x.uid === ui.select.uid);
      return { tag: `React · ${c.name} · ${c.modes.react.cost} Energy`, text: 'Choose <b>a glowing target</b> on the battlefield (Esc: let it happen).', gold: true };
    }
    // C4: the React bar: "REACT?", the sentence and the countdown, across the top; the board stays clear.
    return { tag: 'REACT?', text: `${esc(reactSentence(s))} <span class="v4-rhint">React with a card in the tray, or let it happen.</span>`, gold: true, react: true };
  }
  if (ui.select?.kind === 'command') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    const m = ui.select.mode;
    return { tag: `${c.name} · ${MODE_NAMES[m]} · ${c.modes[m].cost} Energy`, text: `${esc(modeText(c, m))}: choose <b>a glowing target</b>.${m === 'strat' ? ' It resolves after the Opponent\'s next turn (or at Supper), when they may React; if the target is gone by then, it fizzles.' : ' The Opponent may React first.'}`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'buy') {
    const c = selItem(s, ui.select);
    const use = buyReason(s, 'player', c, 'use');
    const store = buyReason(s, 'player', c, 'store');
    return { tag: `${c.name} · $${c.price} · ${c.itemType}`, text: `PokéMart: ${esc(c.text)}. Buy it, then use it now or store it in your Bag.`, gold: true,
      buttons: [{ action: 'buy-use', label: 'Buy & use now', disabled: !!use, tip: use }, { action: 'buy-store', label: 'Buy & store in Bag', disabled: !!store, tip: store }, { action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'item') {
    const c = selItem(s, ui.select);
    return { tag: `${c.name} · ${ui.select.from === 'bag' ? 'from your Bag' : `$${c.price}`}`, text: `${esc(c.text)}: choose <b>a glowing Pokémon</b> of yours.`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'supporter') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    return { tag: `${c.name} · Release ${c.release}`, text: 'Choose the cards to Release below.', gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (ui.select?.kind === 'hand') {
    const c = me.hand.find((x) => x.uid === ui.select.uid);
    const retainBtn = { action: 'retain', label: 'Retain (1 Energy)', disabled: !!whyNot(s, 'player', 'retain', c), tip: whyNot(s, 'player', 'retain', c) };
    const cancel = { action: 'cancel', label: 'Cancel' };
    if (isItem(c)) {
      const use = buyReason(s, 'player', c, 'use');
      const store = buyReason(s, 'player', c, 'store');
      return { tag: `${c.name} · $${c.price} · ${c.itemType}`, text: `${esc(c.text)}. Buy it, then use it now or store it in your Bag; unbought, it's discarded at Supper.`, gold: true,
        buttons: [{ action: 'buy-use', label: 'Buy & use now', disabled: !!use, tip: use }, { action: 'buy-store', label: 'Buy & store', disabled: !!store, tip: store }, retainBtn, cancel] };
    }
    if (isTrainer(c)) {
      const k = trainerReason(s, 'player', c);
      return { tag: `${c.name} · Trainer Command`, text: `<b>Command</b>: ${esc(c.command.text)}. It then goes to your Discard Pile and keeps cycling; its Objective is tracked either way.`, gold: true,
        buttons: [{ action: 'tr-command', label: `Command · ${c.command.cost} Energy`, disabled: !!k, tip: k }, retainBtn, cancel] };
    }
    if (isCmd(c)) {
      const modes = commandModesFor(s, 'player', c.uid);
      const modeBtn = (m) => ({ action: `mode-${m.mode}`, label: `${MODE_NAMES[m.mode]} · ${m.cost} Energy`, disabled: !!m.reason, tip: m.reason ?? modeText(c, m.mode) });
      return { tag: `${c.name} · Command`, text: `<b>Adapt</b> resolves now${modes.some((m) => m.mode === 'strat') ? '; <b>Strat</b> after the Opponent\'s next turn' : ''}.`, gold: true,
        buttons: [...modes.map(modeBtn), retainBtn, cancel] };
    }
    if (isSup(c)) {
      const why = whyNot(s, 'player', 'supporter', c);
      return { tag: `${c.name} · Supporter`, text: `No Energy: Release ${c.release} other card${c.release === 1 ? '' : 's'} from your hand for good, then ${esc(c.name)} too. ${esc(effectText(c.effect))}.`, gold: true,
        buttons: [{ action: 'play-supporter', label: `Play (Release ${c.release})`, disabled: !!why, tip: why }, retainBtn, cancel] };
    }
    if (isLoc(c)) {
      const why = whyNot(s, 'player', 'summon', c);
      return { tag: `${c.name} · Location · ${c.width} lanes`, text: `${why ? `Place: ${esc(why)}.` : `Place it (no Energy): click <b>a glowing lane</b>; it covers that lane and the ${c.width - 1} to its right, on both sides, for ${c.rounds} Rounds.`} Or <b>Retain</b> it.`, gold: true,
        buttons: [retainBtn, cancel] };
    }
    const why = whyNot(s, 'player', 'summon', c);
    return { tag: `${c.name} · Lv ${c.level} · ${c.cost} Energy`, text: `${why ? `Summon: ${esc(why)}.` : 'Summon: click <b>a glowing space</b> on your side.'} Or <b>Retain</b> it (1 Energy): it stays in your hand through Supper; you draw one fewer next Breakfast.`, gold: true,
      buttons: [retainBtn, cancel] };
  }
  if (ui.select?.kind === 'attack') {
    const c = me.row[ui.select.from];
    const pl = legalTargets(s, 'player', ui.select.from).some((t) => t.kind === 'player');
    const g = playerGuard(s, 'player', ui.select.from, 'ai');
    return { tag: 'Your turn · Attack', text: `Choose a target for <b>${esc(c.name)}</b> (${damageOf(s, c)} damage): a highlighted Pokémon${pl ? ' or the Opponent (their Recognition ring)' : ` (the Opponent is guarded by ${esc(g?.card.name)})`}. A Ready target hits back.`, gold: true, buttons: [{ action: 'cancel', label: 'Cancel' }] };
  }
  if (s.phase === 'battle' && s.turn === 'player' && !ui.locked) {
    const opts = [];
    const atk = attackers(s, 'player').map((sp) => me.row[sp].name);
    if (atk.length) opts.push(`<b>Attack</b> with ${[...new Set(atk)].map((n) => `<b>${esc(n)}</b>`).join(' or ')}`);
    if (summonable(s, 'player').length) opts.push('summon');
    if (placeable(s, 'player').length) opts.push('place a <b>Location</b>');
    if (me.hand.some((c) => isCmd(c) && commandModesFor(s, 'player', c.uid).some((m) => !m.reason))) opts.push('play a <b>Command</b>');
    if (playableSupporters(s, 'player').length) opts.push('a <b>Supporter</b>');
    if (buyableFromHand(s, 'player').length || buyableFromMart(s, 'player').length) opts.push('buy an <b>Item</b>');
    if (usableFromBag(s, 'player').length) opts.push('use a <b>Bag</b> Item');
    if (playableTrainers(s, 'player').length) opts.push('a <b>Trainer Command</b>');
    if (me.hand.some((c) => !c.retained) && energyLeft(me) >= RULES.retainCost) opts.push('<b>Retain</b>');
    // G1 (2.1): while an unmatched Ready Pokémon can attack, End turn isn't offered.
    if (passReason(s, 'player')) return { tag: `Round ${s.round} · your turn`, text: `${opts.join(', ').replace(/^./, (x) => x.toUpperCase())}. <b>End turn</b> waits: ${esc(passReason(s, 'player'))}.` };
    const pass = passEndsPhase(s) ? '<b>End turn</b> to end the Battle Phase' : `<b>End turn</b> (+1 Base Energy${passSpends(s, 'player').length ? '; your fastest Pokémon become Spent' : ''})`;
    return { tag: `Round ${s.round} · your turn`, text: opts.length ? `${opts.join(', ').replace(/^./, (x) => x.toUpperCase())} — or ${pass}.` : `Only ${pass}: nothing else is possible now.` };
  }
  return { tag: `Round ${s.round}`, text: ctx.autoplay ? 'Autoplay: the AI plays both sides.' : 'The Opponent is thinking…' };
}

// Every Battle Phase action with whether it's available now and why not (the old Actions panel, now the
// prompt bar's hover tooltip).
function actionsTip(s, ui) {
  const me = s.players.player;
  const reason = () => (s.phase !== 'battle' ? 'not the Battle Phase' : s.reactWindow ? 'a React window is open' : s.turn !== 'player' ? 'not your turn' : null);
  const rows = [
    ['Summon', reason() ?? (summonable(s, 'player').length ? null : !emptySpaces(s, 'player').length ? 'no empty space on your side' : `no Pokémon you can pay for (${energyLeft(me)} Energy)`)],
    ['Place Location', reason() ?? (placeable(s, 'player').length ? null : !me.hand.some(isLoc) ? 'no Location in hand' : playReason(s, 'player', me.hand.find(isLoc)))],
    ['Command', reason() ?? (me.hand.some((c) => isCmd(c) && commandModesFor(s, 'player', c.uid).some((m) => !m.reason)) ? null : !me.hand.some(isCmd) ? 'no Command Card in hand' : playReason(s, 'player', me.hand.find(isCmd)))],
    ['Supporter', reason() ?? (playableSupporters(s, 'player').length ? null : !me.hand.some(isSup) ? 'no Supporter in hand' : playReason(s, 'player', me.hand.find(isSup)))],
    ['Purchase Item', reason() ?? (buyableFromHand(s, 'player').length || buyableFromMart(s, 'player').length ? null : !me.hand.some(isItem) && !s.mart.onSale.some(Boolean) ? 'no Item in hand or the PokéMart' : `no Item you can buy and use or store ($${me.dollars})`)],
    ['Play Inventory Item', reason() ?? (usableFromBag(s, 'player').length ? null : !me.bag.length ? 'your Bag is empty' : whyNot(s, 'player', 'useItem', me.bag[0]))],
    ['Trainer Command', reason() ?? (playableTrainers(s, 'player').length ? null : !me.hand.some(isTrainer) ? 'no Trainer in hand' : trainerReason(s, 'player', me.hand.find(isTrainer)))],
    ['Attack', reason() ?? whyNot(s, 'player', 'attack')],
    ['Retain', reason() ?? (!me.hand.some((c) => !c.retained) ? 'no card to Retain' : energyLeft(me) < RULES.retainCost ? 'needs 1 Energy' : null)],
    ['Pass (End turn)', reason()],
  ];
  return rows.map(([n, why]) => `${n}: ${why ? why.replace(/^./, (x) => x.toLowerCase()) : 'available'}`).join('\n');
}

// --- HUDs -------------------------------------------------------------------------------------------------
function ring(s, who, ui) {
  const p = s.players[who];
  const v = Math.min(RULES.win, p.recognition);
  const C = 2 * Math.PI * 37;
  const sel = ui.drag?.sel ?? ui.select;
  const target = who === 'ai' && sel?.kind === 'attack' && legalTargets(s, 'player', sel.from).some((t) => t.kind === 'player');
  const tip = `${who === 'player' ? 'Your' : 'The Opponent\'s'} Recognition: ${p.recognition} (shown up to ${RULES.win}). The Player Character has no Health: damage to it gives the attacker's player 1 Recognition per point. ${RULES.win} wins.${target ? ' Click to attack the Opponent.' : ''}`;
  return `<button class="v4-ring ${who}${target ? ' target' : ''}" data-pc="${who}" data-codex="rec:${who}" title="${esc(tip)}"><svg width="86" height="86" aria-hidden="true"><circle cx="43" cy="43" r="37" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.1)" stroke-width="8"/><circle cx="43" cy="43" r="37" fill="none" stroke="var(--${who === 'player' ? 'you' : 'opp'})" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * v) / 100} ${C}"/></svg><span class="n"><b>${v}</b><small>of ${RULES.win}</small></span></button>`;
}
const purse = (p) => `<span class="v4-purse" data-codex="term:pokedollars" title="PokéDollars: $${RULES.dollarsPerRound} each Breakfast, +$${RULES.dollarsPerDefeat} for each enemy Pokémon defeated; kept between Rounds">$ ${p.dollars}</span>`;
function bag(s, who, ui) {
  const p = s.players[who];
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  return `<div class="v4-bag" data-codex="bag:${who}" title="${who === 'player' ? 'Your' : 'The Opponent\'s'} Inventory Bag: ${p.bag.length} of ${BAG_SIZE}">${Array.from({ length: BAG_SIZE }, (_, i) => {
    const c = p.bag[i];
    if (!c) return '<span class="v4-bslot"></span>';
    const ok = who === 'player' && myTurn && !ui.select && itemTargets(s, 'player', c).length;
    const why = who === 'player' && myTurn && !ok ? ` · ${whyNot(s, 'player', 'useItem', c) ?? ''}` : '';
    return `<span class="v4-bslot full${ok ? ' usable' : ''}"${who === 'player' ? ` data-bag="${c.uid}"` : ''} data-codex="card:${c.uid}" data-zoom="${zoomKey(c)}"${why ? ` data-why="${esc(why.replace(/^ · /, ''))}"` : ''}>${cardHTML(c, { size: 'chip', px: 30 })}</span>`;
  }).join('')}</div>`;
}
function tracker(s, who, t) {
  const p = s.players[who];
  const need = t.objective.need;
  const prog = Math.min(t.progress, need);
  const waiting = t.complete && p.waiting.some((c) => c.trainer === t.name);
  const tip = t.complete ? `${t.name}: Objective complete (${t.objective.text}). ${waiting ? `${t.card.partner.name} waits for a free space.` : `${t.card.partner.name} arrived; the card has left the deck.`}` : `${t.name}: ${t.objective.text} (${prog} of ${need}). When it completes, the ${t.name} card leaves the deck, ${partnerText(t.card.partner)} arrives, and +${RULES.perObjective} Recognition.`;
  return `<div class="v4-tr${t.complete ? ' done' : ''}" data-trk="${t.uid}" data-codex="trainer:${who}:${t.uid}" data-zoom="${zoomKey(t.card, { progress: prog })}" aria-label="${esc(tip)}">${cardHTML(t.card, { size: 'chip', px: 32, cls: 'a' })}
    <span class="t"><b>${esc(t.name)}</b><small>${esc(waiting ? `${t.card.partner.name} waits for a space` : (t.objective.short ?? t.objective.text))}</small></span>
    ${t.complete ? '<span class="tick">✓</span>' : `<span class="pips">${Array.from({ length: need }, (_, k) => `<i class="${k < prog ? 'on' : ''}"></i>`).join('')}</span>`}
    ${cardHTML(t.card.partner, { size: 'chip', px: 28, cls: 'pt' })}</div>`;
}
const trackers = (s, who) => s.players[who].trainers.map((t) => tracker(s, who, t)).join('') || '<p class="v4-none">No Trainer in the deck</p>';

function oppHud(s, ui) {
  const foe = s.players.ai;
  return `<section class="v4-panel v4-hud opp">${ring(s, 'ai', ui)}
    <div class="v4-hudmid"><div class="v4-who">OPPONENT</div><div class="v4-hudline">${purse(foe)}<span class="v4-oen" data-codex="energy:ai" title="The Opponent's Energy now: Base Energy ${foe.baseEnergy}, Exert ${availableExert(foe)} of ${foe.exertMax} ready">${icon('energy')} ${foe.baseEnergy} · Exert ${availableExert(foe)}/${foe.exertMax}</span></div>${bag(s, 'ai', ui)}</div>
    <div class="v4-trk">${trackers(s, 'ai')}</div></section>`;
}
function oppHandAndPiles(s) {
  const foe = s.players.ai;
  const n = foe.hand.length;
  const shown = Math.min(n, 8);
  const backs = Array.from({ length: shown }, (_, k) => `<span class="v4-oback" style="left: ${720 + k * 30}px; top: ${92 + Math.abs(k - (shown - 1) / 2) * 3}px; transform: rotate(${(k - (shown - 1) / 2) * 4}deg)"></span>`).join('');
  const top = foe.discard.at(-1);
  return `${backs}<p class="v4-ohand" style="left: ${720 + 46 + Math.max(shown - 1, 0) * 30 + 14}px" title="The Opponent's hand: ${n} card${n === 1 ? '' : 's'} (hidden)">${n} in hand<br><button class="v4-link small" data-codex="pile:ai:released" data-view="ai-rel">Released ${foe.released.length}</button></p>
    <div class="v4-pile small" data-pile="ai-draw" data-codex="pile:ai:draw" style="left: 1340px; top: 84px" title="The Opponent's Draw Pile: ${foe.drawPile.length}"><span class="c">${foe.drawPile.length}</span></div><p class="v4-pcap small" style="left: 1322px; top: 166px">Deck</p>
    <div class="v4-pile small disc" data-pile="ai-disc" data-codex="pile:ai:discard" data-view="ai-disc" style="left: 1430px; top: 84px${top ? `; background-image: url('${art(top)}')` : ''}" title="The Opponent's Discard Pile: ${foe.discard.length}${top ? ` (top: ${top.name})` : ''}"><span class="c">${foe.discard.length}</span></div><p class="v4-pcap small" style="left: 1412px; top: 166px">Discard</p>`;
}
function youHud(s, ui) {
  const me = s.players.player;
  return `<section class="v4-panel v4-hud you"><div class="v4-hudtop">${ring(s, 'player', ui)}<div><div class="v4-who">YOU</div><div class="v4-hudline">${purse(me)}</div>${bag(s, 'player', ui)}</div></div>
    <div class="v4-lbl">Trainer Objectives</div><div class="v4-trk">${trackers(s, 'player')}</div></section>`;
}

// --- The board -------------------------------------------------------------------------------------------
function board(s, ui) {
  // UX3: the legal places for the choice in progress (a click, a drag or the keyboard) come from flows.js.
  const sel = ui.drag?.sel ?? (ui.select && ui.select.kind !== 'supporter' ? ui.select : null);
  const hits = sel ? hitsFor(s, sel) : [];
  const targets = new Set(hits.filter((h) => h.kind === 'space').map((h) => `${h.who}:${h.space}`));
  const attackLegal = new Set(sel?.kind === 'attack' ? [...targets] : []);
  const droppable = hits.some((h) => h.kind === 'board');
  // C4: the threat (the committed action, its arrow and the outcome badges) shows only until a decision is made:
  // once the interface locks (React, Let it happen, a React target, or the timer), it's gone in the same frame.
  const pend = !ui.locked ? s.reactWindow?.pending : null;
  const committed = new Set();
  if (pend?.type === 'attack') { committed.add(`${pend.who}:${pend.from}`); if (pend.target.kind === 'pokemon') committed.add(`${opponentName(pend.who)}:${pend.target.space}`); }
  if (pend?.type === 'command' || pend?.type === 'strat') committed.add(`${pend.target.who}:${pend.target.space}`);
  if (pend?.type === 'summon') committed.add(`${pend.who}:${pend.space}`);
  const incoming = pend?.type === 'summon' ? pend : null;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  const canAttack = new Set(myTurn && !ui.select ? attackers(s, 'player') : []);
  const attacker = sel?.kind === 'attack' ? s.players.player.row[sel.from] : null;
  const row = (who) => Array.from({ length: RULES.lanes }, (_, i) => {
    const c = s.players[who].row[i];
    const key = `${who}:${i}`;
    const guard = attacker && who === 'ai' && c && !attackLegal.has(key) ? guardOf(s, 'ai', i, attacker.attackType) : null;
    const sealedOn = s.strats.some((x) => x.owner === 'ai' && !x.target.all && x.target.who === who && (x.target.lane ? x.target.space === i : x.target.space === i && !c));
    const cls = [sealedOn ? 'strat-target' : '', targets.has(key) ? 'target' : '', attackLegal.has(key) ? 'legal' : '', committed.has(key) ? 'committed' : '', sel?.kind === 'attack' && who === 'player' && sel.from === i ? 'attacking' : ''].filter(Boolean).join(' ');
    let inner = '';
    if (c) inner = boardCard(s, c, who, i, [canAttack.has(i) && who === 'player' ? 'can-attack' : '', guard ? 'dim' : ''].join(' '), guard ? `Guarded by ${guard.card.name}` : '') + (guard ? `<span class="v4-lock">Guarded by ${esc(guard.card.name)}</span>` : '');
    else if (incoming && incoming.who === who && incoming.space === i) inner = boardCard(s, { ...incoming.card, currentStrength: incoming.card.strength, spent: true }, who, i, 'incoming');
    return `<div class="v4-space ${cls}" style="left: ${laneX(i).toFixed(1)}px" data-who="${who}" data-space="${i}">${inner}</div>`;
  }).join('');
  return `<section class="v4-board${droppable ? ' droppable' : ''}">
    ${s.tournament ? tournamentTile(s) : s.locations.map((l) => locationTile(s, l)).join('')}${ambient(s)}
    <div class="v4-row opponent">${row('ai')}</div><div class="v4-row player">${row('player')}</div>${pend ? reactArrow(s) : ''}${reactBadges(s, ui)}${sealed(s)}${sealedArrows(s)}
  </section>`;
}

// UX4: ambient Weather while a bracket of 2+ is active (CSS only; hidden in low motion).
function ambient(s) {
  const on = new Set(activeBrackets(s).map((b) => b.type));
  return ['Rain', 'Sun'].filter((k) => on.has(k)).map((k) => `<div class="v4-ambient ${k.toLowerCase()}" aria-hidden="true"></div>`).join('');
}
// UX4: each pending Strat, sealed: a glowing card back with an hourglass on the board edge of its
// owner's side (the badge on its target stays).
function sealed(s) {
  // G1: a Strat resolving under a React window stays shown (first, glowing) until it resolves.
  // C4: the Opponent's sealed Strat is a face-down card back with an hourglass (its target only); it flips face
  // up as it resolves. Yours show their card to you.
  const resolving = s.reactWindow?.pending.type === 'strat' ? s.reactWindow.pending.strat : null;
  return ['ai', 'player'].map((who) => [...(resolving?.owner === who ? [resolving] : []), ...s.strats.filter((x) => x.owner === who)].map((x, k) => {
    const open = who === 'player' || x === resolving;
    const tip = open ? `${Whose(who)} Strat${x === resolving ? ', resolving' : ', sealed'}: ${x.card.name} on ${x.targetName}, ${x === resolving ? 'now' : `after ${who === 'player' ? 'the Opponent\'s' : 'your'} next turn (or at Supper)`}` : `The Opponent's sealed Strat on ${x.targetName}: hidden until it resolves, after your next turn (or at Supper)`;
    return `<span class="v4-sealed ${who}${x === resolving ? ' resolving' : ''}${open ? ' open' : ' hidden'}" data-strat="${x.uid}" data-codex="card:${x.uid}" style="top: ${(who === 'ai' ? 60 : 392) + k * 30}px${x === resolving && who === 'ai' ? `; background-image: url('${art(x.card)}')` : ''}" title="${esc(tip)}">⏳</span>`;
  }).join('')).join('');
}
// C4: the arrow from each sealed Strat to its target, shown while the sealed card is hovered (so you can plan
// around it, e.g. Dive that Pokémon). A Location or lane target points at its lane; all enemies at the middle.
function sealedArrows(s) {
  return s.strats.map((x) => {
    const k = s.strats.filter((y) => y.owner === x.owner).indexOf(x);
    const from = { x: 2, y: (x.owner === 'ai' ? 60 : 392) + k * 30 + 28 };
    const t = x.target;
    const to = t.all ? { x: BOARD.w / 2, y: ROW_TOP[t.who] + TOK.h / 2 } : spaceAt(t.who, t.space);
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 40;
    return `<svg class="v4-sarrow" data-strat="${x.uid}" viewBox="0 0 ${BOARD.w} ${BOARD.h}" width="${BOARD.w}" height="${BOARD.h}" aria-hidden="true"><path d="M${from.x},${from.y} Q${mx.toFixed(0)},${my.toFixed(0)} ${to.x.toFixed(0)},${to.y.toFixed(0)}" stroke="#ffe08a" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="2 12"/><circle cx="${to.x.toFixed(0)}" cy="${to.y.toFixed(0)}" r="12" fill="none" stroke="#ffe08a" stroke-width="4"/></svg>`;
  }).join('');
}

// A Location: its art over all its lanes on both sides (a border in its colour), with a plate across
// the middle band: name and passive; Rounds left as pips plus "N left"; the Weather it adds; Strength on
// each side and a two-colour bar along the bottom edge.
function plate(you, opp, color, title, passive, row2, tip) {
  const total = you + opp;
  return `<div class="v4-plate" style="--plate: ${color}" title="${esc(tip)}"><h3 style="color: ${color}">${title}</h3><p class="pas">${passive}</p><div class="row2">${row2}</div>
    <span class="v4-vs"><b class="you">${you}</b> vs <b class="opp">${opp}</b></span><span class="v4-sbar"><i style="width: ${total ? (100 * you) / total : 50}%"></i></span></div>`;
}
function locationTile(s, l) {
  const d = dominantOf(s, l);
  const you = strengthIn(s, l, 'player');
  const opp = strengthIn(s, l, 'ai');
  const tip = `${l.name} (placed by ${l.owner === 'player' ? 'you' : 'the Opponent'}) · ${l.passive.text} · Weather: +${l.weather.count} ${l.weather.type} · Strength here: you ${you}, the Opponent ${opp} · ${d ? `${d === 'player' ? 'you dominate' : 'the Opponent dominates'}: +${RULES.perDominance} Recognition at Supper` : 'a tie: nothing at Supper'} · ${l.roundsLeft} Round${l.roundsLeft === 1 ? '' : 's'} left`;
  const total = l.card?.rounds ?? Math.max(l.roundsLeft, 3);
  const row2 = `<span class="dur">${Array.from({ length: total }, (_, k) => `<i class="${k < l.roundsLeft ? '' : 'off'}"></i>`).join('')}</span>${l.roundsLeft} left<span class="wx ${l.weather.type.toLowerCase()}">${weatherIcon(l.weather.type)} +${l.weather.count} ${l.weather.type}</span>`;
  const x = tileX(l.start);
  const w = l.width * LW;
  // C2: the portrait art shown wide across 2–4 lanes, framed on the Location's landmark (focus.json "tile").
  const tf = artFocus(l.art).tile ?? { x: 50, y: 50 };
  return `<div class="v4-ltile" data-loc="${l.uid}" data-codex="loc:${l.uid}" style="left: ${(x + 3).toFixed(1)}px; width: ${(w - 6).toFixed(1)}px; border-color: ${l.color}; background-image: url('${art(l)}'); background-position: ${tf.x}% ${tf.y}%" title="${esc(tip)}"></div>
    <div class="v4-lplate" data-plate="${l.uid}" data-codex="loc:${l.uid}" style="left: ${(x + 10).toFixed(1)}px; width: ${(w - 20).toFixed(1)}px">${plate(you, opp, l.color, esc(l.name), esc(l.passive.text), row2, tip)}</div>`;
}
// The Pokémon League Tournament: one tile over all 9 lanes (no art yet: a gold frame).
function tournamentTile(s) {
  const d = tournamentDominant(s);
  const you = tournamentStrength(s, 'player');
  const opp = tournamentStrength(s, 'ai');
  const gain = boosted(s, RULES.perTournamentDominance);
  const tip = `The Pokémon League Tournament (since Round ${s.tournament.startedRound}: ${s.tournament.reason}). It covers the whole battlefield. Passive: all Recognition earned ×1.5, rounded up. At each Supper, more total current Strength dominates it: +${RULES.perTournamentDominance} Recognition (+${gain} with the passive). Ties give nothing. No Locations or Weather. ${d ? `${d === 'player' ? 'You dominate' : 'The Opponent dominates'} now.` : 'A tie now.'}`;
  return `<div class="v4-ltile tournament" data-codex="tournament" style="left: ${(tileX(0) + 3).toFixed(1)}px; width: ${(RULES.lanes * LW - 6).toFixed(1)}px" title="${esc(tip)}"></div>
    <div class="v4-lplate tournament" data-codex="tournament" style="left: ${(tileX(3) - 40).toFixed(1)}px; width: ${(3 * LW + 80).toFixed(1)}px">${plate(you, opp, '#f6c64a', '🏆 Pokémon League Tournament', `Recognition ×1.5 · dominance +${RULES.perTournamentDominance} (+${gain})`, `since Round ${s.tournament.startedRound} · no Locations or Weather`, tip)}</div>`;
}

// --- The React window (UX1) --------------------------------------------------------------------------------
// Board coordinates; the Recognition rings stand for the Player Characters.
const spaceAt = (who, space) => ({ x: laneX(space) + TOK.w / 2, y: ROW_TOP[who] + TOK.h / 2 });
const PC_AT = { ai: { x: 24 + 14 + 86 - BOARD.left, y: 76 + 48 - BOARD.top }, player: { x: 24 + 16 + 86 - BOARD.left, y: 790 + 14 + 43 - BOARD.top } };
function reactArrow(s) {
  const p = s.reactWindow?.pending;
  if (!p || p.type === 'summon') return '';
  // G1: a resolving Strat's arrow starts at its sealed card, on its owner's board edge.
  const from = p.type === 'attack' ? spaceAt(p.who, p.from) : p.type === 'strat' ? { x: 2, y: (p.who === 'ai' ? 60 : 392) + 28 } : { x: BOARD.w / 2, y: BOARD.h / 2 };
  const to = p.type === 'attack' ? (p.target.kind === 'player' ? PC_AT[opponentName(p.who)] : spaceAt(opponentName(p.who), p.target.space)) : spaceAt(p.target.who, p.target.space);
  const mx = (from.x + to.x) / 2 + 40;
  const my = (from.y + to.y) / 2 - 40;
  return `<svg class="v4-arrow" viewBox="0 0 ${BOARD.w} ${BOARD.h}" width="${BOARD.w}" height="${BOARD.h}" aria-hidden="true"><defs><linearGradient id="v4-ag" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd56a"/><stop offset="1" stop-color="#ff5a3a"/></linearGradient><marker id="v4-ah" markerUnits="userSpaceOnUse" markerWidth="30" markerHeight="30" refX="15" refY="15" orient="auto"><path d="M2,4 L28,15 L2,26 L9,15 z" fill="#ff5a3a"/></marker></defs>
    <path d="M${from.x.toFixed(0)},${from.y.toFixed(0)} Q${mx.toFixed(0)},${my.toFixed(0)} ${to.x.toFixed(0)},${to.y.toFixed(0)}" stroke="url(#v4-ag)" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="2 16" marker-end="url(#v4-ah)"/></svg>`;
}
// The committed action in one plain sentence, e.g. "The Opponent's Gyarados is attacking your Charizard for 9."
export function reactSentence(s) {
  const p = s.reactWindow?.pending;
  if (!p) return '';
  const foe = opponentName(p.who);
  if (p.type === 'attack') {
    const a = s.players[p.who].row[p.from];
    const n = damageOf(s, a);
    if (p.target.kind === 'player') return `${Whose(p.who)} ${a.name} is attacking ${foe === 'player' ? 'you' : 'the Opponent'} for ${n}.`;
    return `${Whose(p.who)} ${a.name} is attacking ${whose(foe)} ${s.players[foe].row[p.target.space].name} for ${n}.`;
  }
  const mode = p.type === 'strat' ? 'strat' : 'adapt';
  const on = targetWords(s, p.target);
  if (p.type === 'strat') return `${Whose(p.who)} Strat ${p.card.name} is resolving${p.at === 'supper' ? ' at Supper' : ''}: ${longMode(p.card, mode)}${on ? ` (${on})` : ''}.`;
  return `${p.who === 'player' ? 'You are' : 'The Opponent is'} playing ${p.card.name} (Adapt): ${longMode(p.card, mode)}${on ? ` (${on})` : ''}.`;
}
// G3: a Command's target in words: a Pokémon by name, a Location or lane, or every enemy Pokémon.
function targetWords(s, t) {
  if (!t) return '';
  if (t.all) return '';
  if (t.lane) return s.tournament ? 'the Tournament' : locationAt(s, t.space) ? locationAt(s, t.space).name : `lane ${t.space + 1}`;
  const on = s.players[t.who]?.row[t.space];
  return on ? `${whose(t.who)} ${on.name}` : '';
}
// A React card's effect in plain words, aimed at the actual target when there's only one.
// G3: the React mode's own effect and target (the attacker, your Pokémon being attacked, ...), named.
export function reactEffect(s, card, targets) {
  const what = { attack: 'the attack', strat: 'their Strat resolves', command: 'their Command' }[s.reactWindow?.pending.type] ?? 'their Command';
  const verb = longMode(card, 'react');
  const one = targets.length === 1 ? targetWords(s, targets[0]) : '';
  const choose = targets.length > 1 ? ' (choose)' : '';
  return `${verb.charAt(0).toUpperCase()}${verb.slice(1)}${one ? `: ${one}` : choose}, before ${what}.`;
}
// C4: the countdown strip (the same animation in the React bar and the tray).
function reactTimerBar(ui) {
  const clock = ui.reactClock;
  const elapsed = clock.paused ? clock.ms - clock.left : Math.max(0, Date.now() - clock.start);
  return `<span class="v4-rtimer${clock.paused ? ' paused' : ''}"><i style="animation-duration: ${clock.ms}ms; animation-delay: -${elapsed}ms; animation-play-state: ${clock.paused ? 'paused' : 'running'}"></i></span>`;
}
// Whether the player's React window is showing (not behind the Tournament banner).
export const reactOpen = (s, ui) => s.phase === 'battle' && s.reactWindow?.reactor === 'player' && !ui.locked && !(s.tournament && ui.seenTournament !== s.tournament.startedRound);
// UX3: the Command mode picker, at the drop point.
function picker(s, ui) {
  const pk = ui.picker;
  if (!pk) return '';
  const c = s.players.player.hand.find((x) => x.uid === pk.uid);
  if (!c) return '';
  const on = { name: pk.target.all ? 'each enemy Pokémon' : targetWords(s, pk.target).replace(/^(your|the Opponent's) /, '') };
  const x = Math.max(12, Math.min(1920 - 680, pk.x - 170));
  const y = Math.max(76, Math.min(1080 - 520, pk.y - 240));
  const modes = commandModesFor(s, 'player', c.uid);
  return `<div class="v4-panel v4-picker" role="dialog" style="left: ${x}px; top: ${y}px">${fullWrap(c, cardHTML(c, { size: 'full', state: { modes } }))}
    <div class="v4-pickcol"><p class="t">Play <b>${esc(c.name)}</b> on ${esc(on?.name ?? '')} as</p>${pk.modes.map((m) => `<button data-pick="${m}"><b>${MODE_NAMES[m].toUpperCase()}</b><span>${esc(longMode(c, m))}${m === 'strat' ? ', after their next turn' : ''}</span><i>${icon('energy')}${c.modes[m].cost}</i></button>`).join('')}<button class="cancel" data-action="cancel">Cancel <small>(Esc)</small></button></div></div>`;
}

// C4: which option's badges the board shows (the React card under the pointer in the tray; 'none' = let it happen).
let reactShow = 'none';
// C4: the React window's outcomes, computed once per state: let it happen, and each React card (on its only
// target, or its first when it has several), by the engine's own react / decline on a copy (preview.js).
function reactOptionsView(s, ui) {
  if (ui.reactCache?.state === s) return ui.reactCache.view;
  const me = s.players.player;
  const opts = me.hand.filter((c) => commandModesFor(s, 'player', c.uid).length).map((c) => {
    const targets = commandTargets(s, 'player', c, 'react');
    let out = null;
    try { out = targets.length ? reactOutcome(s, { uid: c.uid, target: targets[0] }) : null; } catch { out = null; }
    return { card: c, targets, out, line: out ? `${targets.length > 1 ? `e.g. on ${targetWords(s, targets[0]) || 'the first target'}: ` : ''}${reactSummary(s, c, out)}` : reactEffect(s, c, targets) };
  });
  let decline = null;
  try { decline = reactOutcome(s, null); } catch { decline = null; }
  const view = { opts, decline };
  ui.reactCache = { state: s, view };
  return view;
}
// The badges on the board: one set per option (data-opt), the "let it happen" set shown by default; hovering a
// card in the tray shows its set instead (the board's data-show attribute, set without a redraw).
function reactBadges(s, ui) {
  if (!reactOpen(s, ui)) { reactShow = 'none'; return ''; }
  const { opts, decline } = reactOptionsView(s, ui);
  const set = (key, out, label) => (out ? out.badges.map((b) => {
    const x = laneX(b.space) + 4;
    const y = ROW_TOP[b.who] + (b.who === 'ai' ? 30 : 26);
    const on = key === (ui.select?.kind === 'react' ? ui.select.uid : reactShow) || (key === 'none' && !opts.some((o) => o.card.uid === (ui.select?.kind === 'react' ? ui.select.uid : reactShow)));
    return `<div class="v4-rbadge ${b.tone}${on ? ' on' : ''}" data-opt="${key}" style="left: ${x.toFixed(1)}px; top: ${y}px; width: ${TOK.w - 8}px"><b>${esc(label)}</b>${b.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
  }).join('') : '');
  return set('none', decline, 'If you let it happen') + opts.map((o) => set(o.card.uid, o.out, `With ${o.card.name}`)).join('');
}
// The tray over your hand: your React cards (Mini), each with its outcome, then Let it happen and the timer.
function reactOverlay(s, ui) {
  if (!reactOpen(s, ui)) return '';
  const me = s.players.player;
  const { opts, decline } = reactOptionsView(s, ui);
  const clock = ui.reactClock;
  const elapsed = clock ? (clock.paused ? clock.ms - clock.left : Math.max(0, Date.now() - clock.start)) : 0;
  const bar = clock ? `<div class="v4-rtimer${clock.paused ? ' paused' : ''}"><i style="animation-duration: ${clock.ms}ms; animation-delay: -${elapsed}ms; animation-play-state: ${clock.paused ? 'paused' : 'running'}"></i></div>` : '';
  const picking = ui.select?.kind === 'react';
  const cards = opts.map(({ card: c, targets, line }) => {
    const cost = c.modes.react.cost;
    const sel = ui.select?.uid === c.uid;
    return `<div class="v4-ropt${sel ? ' sel' : ''}" data-opt="${c.uid}" data-codex="card:${c.uid}">
      <button class="v4-rcard" data-react="${c.uid}" data-zoom="${zoomKey(c, { modes: commandModesFor(s, 'player', c.uid) })}" aria-label="React with ${esc(c.name)}"><span class="sc">${cardHTML(c, { size: 'mini', state: { modes: commandModesFor(s, 'player', c.uid), selected: sel } })}</span></button>
      <p class="v4-reff">${esc(line)}</p>
      <p class="v4-rcost">${sel && targets.length > 1 ? 'Now click a glowing target' : `React · ${cost} Energy · ${energyLeft(me) - cost} left`}</p></div>`;
  }).join('');
  const fate = decline ? (decline.badges.find((b) => b.who === 'player' && /Defeated/.test(b.lines.join(' '))) ? `${decline.badges.find((b) => b.who === 'player' && /Defeated/.test(b.lines.join(' '))).name} is defeated` : decline.pc || (decline.badges[0] ? `${decline.badges[0].name}: ${decline.badges[0].lines[0]}` : 'Nothing changes')) : '';
  // C4: a resolving Strat of the Opponent's is revealed here in full (hover it for its Full card).
  const pend = s.reactWindow.pending;
  const theirs = pend.type === 'strat' || pend.type === 'command' ? `<div class="v4-ropt theirs" data-codex="card:${pend.type === 'strat' ? pend.strat.uid : pend.card.uid}"><span class="v4-rcard face" data-zoom="${zoomKey(pend.card, {})}"><span class="sc">${cardHTML(pend.card, { size: 'mini' })}</span></span><p class="v4-rcost">${pend.type === 'strat' ? 'Their Strat, revealed' : 'Their Adapt'}</p></div>` : '';
  return `<div class="v4-rtray${picking ? ' picking' : ''}" role="dialog" aria-label="React">
    ${theirs}<div class="v4-ropts">${cards}</div>
    <div class="v4-rside" data-opt="none"><p class="v4-rlbl">REACT?</p>${bar}<button class="v4-rlet" data-action="decline">Let it happen <small>(Esc)</small></button><p class="v4-reff">${esc(fate)}</p></div>
  </div>`;
}

// --- The right column ----------------------------------------------------------------------------------------
function roundBox(s) {
  const turn = s.turn === 'player' ? 'YOUR TURN' : 'THEIR TURN';
  const phase = s.phase === 'battle' ? (s.tournament ? turn : `BATTLE · ${turn}`) : s.phase === 'mulligan' ? 'MULLIGAN' : 'MATCH OVER';
  const when = s.tournament ? `· Tournament since Round ${s.tournament.startedRound}` : `· Tournament at Round ${RULES.tournamentRound} or ${RULES.tournamentRecognition}`;
  return `<section class="v4-panel v4-col v4-round" data-codex="${s.tournament ? 'tournament' : 'term:round'}" title="${esc(s.tournament ? 'The Pokémon League Tournament: all Recognition ×1.5' : `The Pokémon League Tournament begins at Breakfast in Round ${RULES.tournamentRound}, or at the first Breakfast where either player has ${RULES.tournamentRecognition}+ Recognition`)}"><div class="v4-lbl">Round</div>
    <div class="r">${s.round} <small>${when}</small></div><div class="v4-phases"><span class="v4-phase">${phase}</span>${s.tournament ? '<span class="v4-phase gold">🏆 TOURNAMENT</span>' : ''}</div></section>`;
}
// UX4 G: trim by measured width (canvas measureText, a binary search over the length), in the font the
// browser actually uses (a fallback font is measured as itself). Without a canvas (Node), by characters.
const TICKER_TEXT = 276 - 44 - 4;   // the ticker's text width (less its padding and the L key) and a margin
let measureCtx = null;
function textWidth(text) {
  if (measureCtx === null) {
    try { measureCtx = typeof document === 'undefined' ? false : document.createElement('canvas').getContext('2d') || false; } catch { measureCtx = false; }
  }
  if (!measureCtx) return null;
  measureCtx.font = "400 13.5px 'Alegreya Sans', 'Segoe UI', system-ui, sans-serif";
  return measureCtx.measureText(text).width;
}
// C2: a log entry's short form for the ticker: the sentence rewritten to its point ("Gyarados hit
// Charizard for 6", "Gyarados: On Summon, 1 damage to each enemy Pokémon"); whose it is shows in its
// colour. If it still doesn't fit two lines, whole clauses are dropped from the end (never words cut).
const SHORT_LOG = [
  [/^The Pokémon League Tournament begins/, () => 'The Pokémon League Tournament begins!'],
  [/^Round (\d+) · Breakfast\./, (m) => `Round ${m[1]} · Breakfast`],
  [/^(?:Your|The Opponent's) (.+?) attacked (.+?) for (\d+)(?:; .+? hit back for (\d+))?(?:; Retaliate: (\d+) back)?\./, (m) => `${m[1]} hit ${m[2]} for ${m[3]}${m[4] ? `; hit back for ${m[4]}` : ''}${m[5] ? `; Retaliate ${m[5]}` : ''}`],
  [/^(You|The Opponent) played (.+?), Releasing (.+?)( \(Favour[^)]*\))?\.$/, (m) => `${m[2]}${m[4] ? ' with its Favour' : ''}; Released ${m[3]}`],
  [/^(You|The Opponent) played (.+?) as a Strat \(\d+ Energy\) on (.+?):/, (m) => `${m[2]} sealed as a Strat on ${m[3]}`],
  [/^(You|The Opponent) played (.+?) as a Trainer Command \(\d+ Energy\): (.+?)\.$/, (m) => `${m[2]}'s Trainer Command: ${m[3]}`],
  [/^(You|The Opponent) Reacted with (.+?) \(\d+ Energy\):.*?(?: \(([^()]+)\))?\.$/, (m) => `React: ${m[2]}${m[3] ? ` on ${m[3]}` : ''}`],
  [/^(?:Your|The Opponent's) (.+?): (On [A-Z]\w+): (.+?)\.$/, (m) => `${m[1]}: ${m[2]}, ${m[3]}`],
  [/^(You|The Opponent) used (.+?) on (.+?) \(/, (m) => `${m[2]} used on ${m[3]}`],
  [/^(?:Your|The Opponent's) (.+?) now holds (.+?) \(/, (m) => `${m[1]} holds ${m[2]}`],
  [/^(You|The Opponent): \+(\d+) Recognition \(([^;)]+)[^)]*\), now (\d+)\./, (m) => `+${m[2]} Recognition: ${m[3]} (now ${m[4]})`],
  [/^([A-Z][\w .é'-]+?) \((Adapt|React|Strat)\): .*?(?: \(([^()]+)\))?\.$/, (m) => `${m[1]} (${m[2]})${m[3] ? ` on ${m[3]}` : ''}`],
];
export function shortLog(line) {
  for (const [re, f] of SHORT_LOG) { const m = line.match(re); if (m) return f(m); }
  return line.replace(/^(?:Your|The Opponent's) /, '').replace(/\.$/, '');
}
// Whole clauses only: the longest start of the short form, at a clause break, that fits `px` (two lines).
function fitClauses(text, px) {
  const w = textWidth(text);
  const fits = (t) => (w === null ? t.length * 6.6 : textWidth(t)) <= px;
  if (fits(text)) return text;
  const cuts = [...text.matchAll(/[;:,]|\s\(/g)].map((m) => m.index).reverse();
  for (const i of cuts) { const t = text.slice(0, i).trim(); if (t && fits(t)) return t; }
  return null;
}
// Short bracket effects for the Weather chip (the full table is on hover).
const BRACKET_SHORT = { healAll: 'all heal 1 at Breakfast', strength: 'all Pokémon +1 Strength', physical: 'Physical +1 damage', attack: 'all Pokémon +1 Attack' };
// C2: every line shown in full: one line per Weather in play (its chip and its strongest active effect),
// then the next bracket, only when there's a line left for it.
function weatherChip(s) {
  const all = WEATHER_BRACKETS.map((b) => `${b.type} ${b.at}+: ${b.text}`).join('\n');
  if (s.tournament) return `<section class="v4-panel v4-col v4-wx" data-codex="weather" title="${esc(`The Pokémon League Tournament replaced every Location and its Weather.\n${all}`)}"><div class="v4-lbl">Weather</div><p>None in the Tournament</p><p class="sub">Locations and Weather are gone</p></section>`;
  const t = weatherTotals(s);
  const on = activeBrackets(s);
  const types = ['Sun', 'Rain'].filter((k) => t[k]);
  const lines = types.map((k) => {
    const top = on.filter((b) => b.type === k).at(-1);
    return `<p><span class="wx ${k.toLowerCase()}">${weatherIcon(k)} ${k} ${t[k]}</span> ${esc(top ? BRACKET_SHORT[top.kind] : 'no bracket yet')}</p>`;
  });
  const next = WEATHER_BRACKETS.filter((b) => t[b.type] < b.at).sort((a, b) => (a.at - t[a.type]) - (b.at - t[b.type]))[0];
  if (!lines.length) lines.push('<p>None</p>');
  if (lines.length < 2 && next) lines.push(`<p class="sub">At ${next.type} ${next.at}: ${BRACKET_SHORT[next.kind]}</p>`);
  return `<section class="v4-panel v4-col v4-wx" data-codex="weather" title="${esc(`Weather counts add up across placed Locations; brackets apply to both players.\n${all}`)}"><div class="v4-lbl">Weather</div>${lines.join('')}</section>`;
}
function energyTile(s) {
  const me = s.players.player;
  const ex = availableExert(me);
  const of = Math.max(baseEnergyFor(s.round), me.baseEnergy);
  const dia = Array.from({ length: EXERT_LIMIT }, (_, i) => `<i class="${i < ex ? 'on' : i < me.exertMax ? 'ex' : 'lock'}"></i>`).join('');
  const back = [...me.exhaust].sort((a, b) => a.recoversRound - b.recoversRound).map((x) => x.recoversRound);
  return `<section class="v4-col v4-energy" data-codex="energy:player" title="${esc(`Base Energy left: ${me.baseEnergy} (the Round's Base Energy is ${baseEnergyFor(s.round)}; each Pass adds 1). Exert covers what Base Energy can't; each point spent is Exhausted for 2–4 Rounds.`)}">
    <div class="v4-lbl">${icon('energy')} Energy</div><div class="enrow"><div class="big">${me.baseEnergy}</div><div class="of">of ${of} this turn</div></div>
    <div class="dia">${dia}</div><small>Exert ${ex} of ${me.exertMax} ready</small>${back.length ? `<small class="dim">${back.length} Exhausted · back in Round${back.length === 1 ? '' : 's'} ${back.join(', ')}</small>` : ''}</section>`;
}
function endTurn(s, ui) {
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !ui.select && !s.reactWindow;
  // G1 (2.1): no Pass while a Ready Pokémon of yours with unmatched Speed can attack.
  const why = s.phase === 'battle' && s.turn === 'player' && !s.reactWindow ? passReason(s, 'player') : null;
  if (why) {
    const b = passBlockers(s, 'player');
    const short = b.length === 1 ? why : `${b.length} of your Pokémon are Ready and faster than anything the Opponent has: attack first`;
    return `<button class="v4-col v4-pass blocked" data-action="pass" data-codex="term:pass" disabled title="${esc(`Can't end the turn: ${why}.`)}"><b>END TURN</b><small class="why">${esc(short)}</small></button>`;
  }
  return `<button class="v4-col v4-pass" data-action="pass" data-codex="term:pass"${myTurn ? '' : ' disabled'} title="${esc(myTurn ? (passEndsPhase(s) ? 'Pass: the Opponent passed too, so this ends the Battle Phase.' : `Pass: +1 Base Energy${passSpends(s, 'player').length ? '; your fastest Pokémon become Spent (unmatched Speed)' : ''}.`) : 'Not your turn')}"><b>END TURN</b><small>${passEndsPhase(s) ? 'Pass · ends the Battle Phase' : 'Pass · +1 Base Energy'}<span class="key">Space</span></small></button>`;
}
// G1 (2.6): the PokéMart's one Item, always on show: art, name, price gem, Held or Consumed, its effect,
// a Stock pip per turn left (the last one pulsing), and Buy (then use now or store, in the prompt bar).
// Sold out: a stamp, and when it restocks.
function martCard(s, ui) {
  const c = s.mart.onSale[0];
  if (!c) {
    const by = s.mart.soldOut?.by;
    const when = by ? `Restocks after ${by === 'player' ? 'your' : 'the Opponent\'s'} next turn` : 'Nothing on sale';
    return `<section class="v4-panel v4-col v4-martcard sold" data-codex="mart"><span class="v4-mlbl">PokéMart</span><div class="v4-martback"><div class="cd-t cd-stamp v4-soldout">Sold out</div></div><p class="v4-restock">${esc(when)}</p></section>`;
  }
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  const why = !myTurn ? (s.phase !== 'battle' ? 'Not the Battle Phase' : s.reactWindow ? 'A React window is open' : 'Not your turn') : buyReason(s, 'player', c);
  const pips = Array.from({ length: s.mart.stock }, (_, k) => `<i class="${k === s.mart.stock - 1 ? 'last' : ''}"></i>`).join('');
  const stockTip = `Stock: ${s.mart.stock} turn${s.mart.stock === 1 ? '' : 's'} left on sale (of ${c.stock}). Each turn by either player uses 1; then a new Item replaces it. Buying it takes it away from the Opponent too.`;
  return `<section class="v4-panel v4-col v4-martcard" data-item="${c.id}" data-codex="mart">
    <div class="v4-martslot" data-zoom="${zoomKey(c, { stock: s.mart.stock })}"${why ? ` data-why="${esc(why)}"` : ''}>${cardHTML(c, { size: 'mini', state: { stock: s.mart.stock } })}</div>
    <div class="v4-martside"><span class="v4-mlbl">PokéMart</span><span class="stock" title="${esc(stockTip)}">${pips}</span><button data-buy="0"${why ? ` disabled title="${esc(why)}"` : ' title="Buy: use it now or store it in your Bag"'}>Buy</button></div></section>`;
}
// The log ticker and drawer. Lines are coloured by whose they are; an attack line gets its attacker's
// attack icon; long lines are shortened in the ticker (the full line is on hover and in the drawer).
const NAME_INFO = new Map([
  ...PATHS.flatMap((p) => p.forms.map((f) => [f.name, { attackType: p.attackType }])),
  ...TRAINERS.map((t) => [t.partner.name, { attackType: t.partner.attackType }]),
]);
// C1: a log line names a card: its art as a chip at the start (the first card named).
const CARD_NAMES = (() => {
  const out = new Map();
  for (const p of PATHS) for (const f of p.forms) out.set(f.name, { art: f.art, name: f.name });
  for (const t of TRAINERS) { out.set(t.name, t); out.set(t.partner.name, t.partner); }
  for (const list of [COMMANDS, SUPPORTERS, ITEMS, LOCATIONS]) for (const c of list) out.set(c.name, c);
  return [...out.entries()].sort((a, b) => b[0].length - a[0].length);
})();
const cardInLine = (line) => { let best = null; for (const [n, c] of CARD_NAMES) { const i = line.indexOf(n); if (i >= 0 && (!best || i < best.i)) best = { i, c }; } return best?.c ?? null; };
function logLine(line, short, i = -1) {
  const cls = /^(You|Your)\b/.test(line) ? 'y' : /^The Opponent/.test(line) ? 'o' : '';
  const m = line.match(/([A-Z][\w.'é -]*?) attacked /);
  const who = m && [...NAME_INFO.keys()].find((n) => m[1].endsWith(n));
  const ic = who ? attackIcon({ attackType: NAME_INFO.get(who).attackType }) : '';
  const c = cardInLine(line);
  const chip = c ? cardHTML(c, { size: 'chip', px: 24, cls: 'v4-logchip' }) : '';
  if (!short) return `<p class="${cls}" data-codex="log:${i}">${chip}${ic}<span>${linkText(line)}</span></p>`;
  // Two lines of the ticker, less the chip and icon on the first and a margin for word wrapping.
  const room = 2 * TICKER_TEXT - (ic ? 24 : 0) - (chip ? 30 : 0) - 36;
  const text = fitClauses(shortLog(line), room);
  return text ? `<p class="${cls}" data-codex="log:${i}">${chip}${ic}<span>${esc(text)}</span></p>` : '';
}
function logTicker(s) {
  return `<button class="v4-panel v4-col v4-ticker" data-action="open-log" title="Open the full log (L)">${s.log.slice(-1).map((l) => logLine(l, true, s.log.length - 1)).join('')}<span class="key open">L</span></button>`;
}

// --- Drawers -----------------------------------------------------------------------------------------------
function logDrawer(s, ui, ctx) {
  if (ui.drawer !== 'log') return '';
  return `<section class="v4-panel v4-drawer log" role="dialog"><header><b>Log</b><small>${esc(ctx.build)}</small><button data-action="close-drawer">Close <span class="key">L</span></button></header>
    <div class="v4-loglist">${s.log.map((l, i) => logLine(l, false, i)).join('')}</div>
    <footer><a href="../v3/">v3</a> · <a href="../v2/">v2</a> · <a href="../">v1</a> · <button class="v4-link" data-action="new">New match</button></footer></section>`;
}

// C1: the Discard and Released viewers: every card in the pile at Full size, newest first.
const VIEWS = { 'player-disc': ['player', 'discard', 'Your Discard Pile'], 'player-rel': ['player', 'released', 'Your Released Pile (out of the match)'],
  'ai-disc': ['ai', 'discard', 'The Opponent\'s Discard Pile'], 'ai-rel': ['ai', 'released', 'The Opponent\'s Released Pile (out of the match)'] };
function pileDrawer(s, ui) {
  const v = VIEWS[ui.drawer?.replace(/^view:/, '')];
  if (!v || !ui.drawer.startsWith('view:')) return '';
  const [who, pile, title] = v;
  const cards = [...s.players[who][pile]].reverse();
  return `<section class="v4-panel v4-drawer pileview" role="dialog"><header><b>${esc(title)}</b><small>${cards.length} card${cards.length === 1 ? '' : 's'}, newest first</small><button data-action="close-drawer">Close <span class="key">Esc</span></button></header>
    <div class="v4-pilegrid">${cards.length ? cards.map((c) => fullWrap(c, cardHTML(c, { size: 'full' }))).join('') : '<p class="v4-none">Empty</p>'}</div></section>`;
}

// --- Your hand, piles and key hints ----------------------------------------------------------------------------
// The fan: cards drop at most 14 px and tilt at most 4° at the edges, so a full hand stays on screen.
const HAND = { left: 450, right: 1510, top: 778 };
function hand(s, ui) {
  const me = s.players.player;
  const myTurn = s.phase === 'battle' && s.turn === 'player' && !ui.locked && !s.reactWindow;
  const reacting = s.reactWindow?.reactor === 'player' && !ui.locked;
  const n = me.hand.length;
  const W = HAND.right - HAND.left;
  // C2: spread across all the room the hand has before overlapping more (up to an 8-px gap).
  const step = n > 1 ? Math.min(SIZES.mini + 8, (W - SIZES.mini) / (n - 1)) : 0;
  const total = SIZES.mini + step * (n - 1);
  const x0 = (HAND.left + HAND.right) / 2 - total / 2;
  const mid = (n - 1) / 2;
  return `<div class="v4-hand">${me.hand.map((c, k) => {
    const why = reacting ? (isCmd(c) && commandModesFor(s, 'player', c.uid).length ? null : isCmd(c) ? whyNot(s, 'player', 'react', c) : 'Only a Command Card can React') : myTurn ? playReason(s, 'player', c) : null;
    const cls = [myTurn || reacting ? (why ? 'no' : reacting ? 'ok reactable' : 'ok') : '', 'selectable'].join(' ');
    const d = k - mid;
    const picked = ui.select?.uid === c.uid && !ui.drag;
    const dragging = ui.drag?.uid === c.uid;
    const drop = Math.min(4, d * d * 0.6 * (step / 150));
    // The visible strip: what the next card doesn't cover (the last card shows whole).
    const strip = k < n - 1 && step < SIZES.mini ? step - 6 : null;
    const tilt = Math.max(-4, Math.min(4, d * 1.3));
    return `<div class="v4-slot${picked ? ' picked' : ''}${dragging ? ' dragging' : ''}" style="left: ${Math.round(x0 + step * k)}px; top: ${Math.round(HAND.top + drop)}px; --r: ${tilt.toFixed(2)}deg; z-index: ${k + 1}">${renderHandCard(s, c, cls, why ?? '', strip)}</div>`;
  }).join('')}</div>`;
}
function myPiles(s, ctx) {
  const me = s.players.player;
  const top = me.discard.at(-1);
  const retained = me.hand.filter((c) => c.retained).length;
  return `<div class="v4-pile" data-pile="player-draw" data-codex="pile:player:draw" style="left: 1520px; top: 820px" title="Your Draw Pile: ${me.drawPile.length}"><span class="c">${me.drawPile.length}</span></div><p class="v4-pcap" style="left: 1520px; top: 962px">Deck</p>
    <div class="v4-pile disc" data-pile="player-disc" data-codex="pile:player:discard" data-view="player-disc" style="left: 1640px; top: 820px${top ? `; background-image: url('${art(top)}')` : ''}" title="Your Discard Pile: ${me.discard.length}${top ? ` (top: ${top.name})` : ''}"><span class="c">${me.discard.length}</span></div><p class="v4-pcap" style="left: 1640px; top: 962px">Discard</p>
    <div class="v4-keys"><div class="v4-lbl">Keys</div><p><span class="key">1–9</span>card <span class="key">A</span>attack</p><p><span class="key">R</span>retain <span class="key">L</span>log</p><p><span class="key">Tab</span>target <span class="key">?</span>keys</p>
      <label title="How long a React window waits before letting the action happen">React <select data-setting="reactTimer">${[5, 8, 12, 20].map((v) => `<option value="${v}"${(ctx.reactTimer ?? 5) === v ? ' selected' : ''}>${v} s</option>`).join('')}</select></label>
      <label title="How fast actions play out (Instant draws each result at once); a click skips the one playing">Speed <select data-setting="speed">${[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']].map(([v, n]) => `<option value="${v}"${(ctx.speed ?? 'normal') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="v4-lowm" title="Low motion: fewer particles, no shake, no distortion, no ambient Weather"><input type="checkbox" data-setting="lowMotion"${ctx.lowMotion ? ' checked' : ''}> Low motion</label></div>
    <p class="v4-relline" title="Released cards leave the match for good (never reshuffled). Retained cards stay in your hand through Supper; you draw one fewer per card."><button class="v4-link small" data-codex="pile:player:released" data-view="player-rel">Released ${me.released.length}</button> · Retained ${retained} · drag or click to play</p>`;
}

// --- Dialogs (kept from earlier stages; restyled in UX5) -----------------------------------------------------------
function dialogs(s, ui) {
  const me = s.players.player;
  // UX3: a confirmation (only where a mistake is costly), with "Don't ask again".
  if (ui.confirm) {
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-confirm"><p>${esc(ui.confirm.text)}</p>
      <label class="v4-dontask"><input type="checkbox" data-dontask${ui.confirm.dontAsk ? ' checked' : ''}> Don't ask again</label>
      <div class="v4-buttons"><button data-action="confirm-yes">${ui.confirm.kind === 'pass' ? 'End turn' : ui.confirm.kind === 'release' ? 'Release' : 'Retain'} <small>(Enter)</small></button><button data-action="confirm-no">Cancel <small>(Esc)</small></button></div></div></div>`;
  }
  // UX3: the key list.
  if (ui.keys) {
    // C3: the Rules page beside the key list: a searchable one-page summary built from the glossary.
    const tabs = `<div class="v4-keystabs"><button data-keytab="keys" class="${ui.keys === 'rules' ? '' : 'on'}">Keys</button><button data-keytab="rules" class="${ui.keys === 'rules' ? 'on' : ''}">Rules</button></div>`;
    if (ui.keys === 'rules') {
      return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-rulespage">${tabs}<input class="v4-rulesearch" type="search" placeholder="Search the rules…" aria-label="Search the rules" value="${esc(ui.rulesQ ?? '')}">
        <div class="v4-rulesbody">${rulesHTML(ui.rulesQ ?? '')}</div>
        <div class="v4-buttons"><button data-action="keys-close">Close <small>(Esc)</small></button></div></div></div>`;
    }
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide v4-keylist">${tabs}<h2>Keys</h2><dl>${KEY_LIST.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="v4-buttons"><button data-action="keys-close">Close <small>(Esc)</small></button></div></div></div>`;
  }
  // UX4: the end screen and the Tournament banner wait for the presenter's beats.
  if (ui.presenting && (s.phase === 'gameOver' || s.tournament)) return '';
  if (s.phase === 'gameOver') return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-over"><h2>${s.winner === 'player' ? 'Pokémon League Champion!' : 'Defeat'}</h2><p>${esc(s.log.at(-1))}</p><p>Round ${s.round} · You ${Math.min(RULES.win, me.recognition)} · Opponent ${Math.min(RULES.win, s.players.ai.recognition)}</p><p class="v4-small">Totals earned: you ${me.recognition}, the Opponent ${s.players.ai.recognition}.</p><button data-action="new">New match</button></div></div>`;
  if (s.tournament && ui.seenTournament !== s.tournament.startedRound && s.phase === 'battle') {
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide v4-tbanner"><h2>🏆 The Pokémon League Tournament begins!</h2>
      <p>${esc(s.tournament.reason === `Round ${RULES.tournamentRound}` ? `Round ${RULES.tournamentRound} has arrived.` : `A player has reached ${RULES.tournamentRecognition} Recognition.`)} Every Location is removed; the Tournament covers the whole battlefield, and your Pokémon stay where they are.</p>
      <p><b>Passive:</b> all Recognition earned ×1.5 (rounded up). <b>Dominance:</b> at each Supper, more total Strength on the battlefield earns +${RULES.perTournamentDominance} (+${boosted(s, RULES.perTournamentDominance)}). No Locations or Weather from now on. First to ${RULES.win} Recognition is the Pokémon League Champion.</p>
      <div class="v4-buttons"><button data-action="tournament-ok">To the Tournament</button></div></div></div>`;
  }
  if (ui.select?.kind === 'supporter') {
    const sup = me.hand.find((c) => c.uid === ui.select.uid);
    const chosen = ui.select.release;
    const others = me.hand.filter((c) => c !== sup);
    const fav = favourMet(sup, others.filter((c) => chosen.includes(c.uid)));
    const cond = FAVOURS[sup.favour.condition];
    // G3: Pokémon Breeder: choose the Pokémon cards to take back from your Discard Pile (1, or 2 with the Favour).
    const eff = fav ? sup.favour : sup.effect;
    const pool = eff.op === 'recover' ? me.discard.filter((c) => isMon(c)) : [];
    const want = Math.min(eff.amount, pool.length);
    const picks = (ui.select.pick ?? []).filter((u) => pool.some((c) => c.uid === u)).slice(0, want);
    const pickRow = eff.op === 'recover' ? `<p class="v4-pickt">Then take back <b>${want}</b> Pokémon card${want === 1 ? '' : 's'} from your Discard Pile${pool.length ? '' : ' (it has none)'}:</p>
      <div class="v4-cardrow mini v4-picks">${pool.map((c) => `<button class="v4-cbtn${picks.includes(c.uid) ? ' on' : ''}" data-pickd="${c.uid}" data-codex="card:${c.uid}">${cardHTML(c, { size: 'mini', state: { selected: picks.includes(c.uid) } })}${picks.includes(c.uid) ? '<em>Take</em>' : ''}</button>`).join('')}</div>` : '';
    const ready = chosen.length === sup.release && picks.length === want;
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide v4-release">
      <p><b>${esc(sup.name)}</b>: choose <b>${sup.release}</b> other card${sup.release === 1 ? '' : 's'} to Release. Released cards leave the match for good (the Released Pile is never reshuffled); then ${esc(sup.name)} is Released too.</p>
      <p>Effect: ${esc(effectText(sup.effect))}. <span class="fav">★ Favour: Release ${esc(cond.text)} → ${esc(effectText(sup.favour))}, and +${RULES.perFavour} Recognition.</span></p>
      <div class="v4-cardrow full">${others.map((c) => {
        const meets = cond.test(c);
        const on = chosen.includes(c.uid);
        return `<button class="v4-cbtn${on ? ' on' : ''}${meets ? ' meets' : ''}" data-rel="${c.uid}" data-codex="card:${c.uid}"><span class="v4-info" role="button" aria-label="Inspect ${esc(c.name)} in the Codex">ⓘ</span>${cardHTML(c, { size: 'full', state: { selected: on, ...(isCmd(c) ? { modes: commandModesFor(s, 'player', c.uid) } : {}) } })}${on ? '<em>Release</em>' : ''}${meets ? '<i>★ Favour</i>' : ''}</button>`;
      }).join('')}</div>
      <p class="v4-relsum">${chosen.length} of ${sup.release} chosen · ${fav ? '<b class="fav">★ Favour met: the enhanced effect and Recognition</b>' : 'Favour not met'}</p>${pickRow}
      <div class="v4-buttons"><button data-action="sup-done"${ready ? '' : ' disabled'}>Release ${sup.release} and play ${esc(sup.name)}</button><button data-action="cancel">Cancel</button></div></div></div>`;
  }
  if (s.phase === 'mulligan' && !me.mulliganed && !ui.locked) {
    const chosen = ui.mull ?? [];
    return `<div class="v4-ask" role="dialog"><div class="v4-panel v4-wide v4-mullp"><p><b>Round 1 · Mulligan</b>: choose any cards to put into your Discard Pile; you draw as many new ones.</p>
      <div class="v4-cardrow mini mull">${me.hand.map((c) => `<button class="v4-cbtn${chosen.includes(c.uid) ? ' on' : ''}" data-mull="${c.uid}" data-codex="card:${c.uid}" data-zoom="${zoomKey(c)}">${cardHTML(c, { size: 'mini', state: { selected: chosen.includes(c.uid) } })}${chosen.includes(c.uid) ? '<em>Put back</em>' : ''}</button>`).join('')}</div>
      <div class="v4-buttons"><button data-action="mull-done">${chosen.length ? `Put back ${chosen.length} and draw ${chosen.length}` : 'Keep this hand'}</button></div></div></div>`;
  }
  return '';
}

const selItem = (s, sel) => (sel.from === 'mart' ? s.mart.onSale[sel.slot] : sel.from === 'bag' ? s.players.player.bag.find((c) => c.uid === sel.uid) : s.players.player.hand.find((c) => c.uid === sel.uid));

// --- The whole screen ---------------------------------------------------------------------------------------------
export function renderMatch(root, s, ui, ctx) {
  zoomCards.clear();
  zoomSeq = 0;
  const p = promptFor(s, ui, ctx);
  const search = root.querySelector?.('.v4-rulesearch');
  const searchFocus = search && typeof document !== 'undefined' && document.activeElement === search ? search.selectionStart : null;
  root.innerHTML = `${CARD_DEFS}<div class="v4-zoom"></div><div class="v4-table${ui.select ? ' choosing' : ''}${reactOpen(s, ui) ? ' reacting' : ''}">
    <div class="v4-prompt${p.gold ? ' gold' : ''}${p.react ? ' react' : ''}"><span class="v4-tag">${esc(p.tag)}</span><span class="v4-ptext" title="${esc(actionsTip(s, ui))}">${linkHTML(p.text)}</span>${p.react && ui.reactClock ? `<span class="v4-ptimer">${reactTimerBar(ui)}</span>` : ''}${(p.buttons ?? []).map((b) => `<button data-action="${b.action}"${b.disabled ? ' disabled' : ''}${b.tip ? ` title="${esc(b.tip)}"` : ''}>${esc(b.label)}</button>`).join('')}</div>
    ${oppHud(s, ui)}${oppHandAndPiles(s)}
    ${board(s, ui)}
    ${roundBox(s)}${weatherChip(s)}${energyTile(s)}${endTurn(s, ui)}${martCard(s, ui)}${logTicker(s)}
    ${youHud(s, ui)}
    ${hand(s, ui)}
    ${myPiles(s, ctx)}
    ${logDrawer(s, ui, ctx)}${pileDrawer(s, ui)}${picker(s, ui)}
    ${reactOverlay(s, ui)}
    ${dialogs(s, ui)}
  </div>`;
  wire(root, s, ui, ctx);
  if (searchFocus !== null) { const again = root.querySelector('.v4-rulesearch'); again?.focus(); again?.setSelectionRange(searchFocus, searchFocus); }
  fitHandStrips(root);
  if (!fontsHooked && typeof document !== 'undefined' && document.fonts?.ready) { fontsHooked = true; document.fonts.ready.then(() => fitHandStrips(root)); }
}
let fontsHooked = false;

// C1: hover zoom. A card under the pointer (data-zoom) shows at Full size: above a hand card, beside a board
// token (on whichever side has room), left of the PokéMart card, beside a chip; its reason (data-why) as
// a short line under it. Display only (pointer-events: none).
function wireZoom(root) {
  // The layer is redrawn with the match (hidden); the listeners go on the root once.
  if (typeof root.addEventListener !== 'function' || !root.dataset || root.dataset.zoomWired) return;
  root.dataset.zoomWired = '1';
  const stage = root.closest('#stage') ?? document.getElementById('stage');
  const hide = () => { const layer = root.querySelector('.v4-zoom'); if (layer) { layer.style.display = 'none'; layer.innerHTML = ''; layer.dataset.key = ''; } };
  root.addEventListener('mouseover', (e) => {
    const layer = root.querySelector('.v4-zoom');
    if (!layer) return;
    const el = e.target.closest?.('[data-zoom]');
    // C4: hovering a sealed Strat shows the arrow to its target.
    const sealedEl = e.target.closest?.('.v4-sealed');
    root.querySelectorAll('.v4-sarrow.on').forEach((a) => { if (a.dataset.strat !== sealedEl?.dataset.strat) a.classList.remove('on'); });
    if (sealedEl) root.querySelector(`.v4-sarrow[data-strat="${sealedEl.dataset.strat}"]`)?.classList.add('on');
    // C4: hovering a React card in the tray switches the board's badges to its outcome (no redraw).
    const tray = e.target.closest?.('.v4-rtray');
    if (tray || (reactShow !== 'none' && root.querySelector('.v4-rbadge'))) {
      const opt = tray ? (e.target.closest('[data-opt]')?.dataset.opt ?? 'none') : 'none';
      const sel = root.querySelector('.v4-ropt.sel')?.dataset.opt;
      const show = sel ?? opt;
      if (show !== reactShow || !root.querySelector(`.v4-rbadge.on[data-opt="${show}"]`)) {
        reactShow = show;
        const has = root.querySelector(`.v4-rbadge[data-opt="${show}"]`);
        root.querySelectorAll('.v4-rbadge').forEach((b) => b.classList.toggle('on', b.dataset.opt === (has ? show : 'none')));
      }
    }
    if (!el || !root.contains(el) || el.closest('.v4-ask, .v4-drawer, .v4-picker')) { if (!el) hide(); return; }
    const z = zoomCards.get(el.dataset.zoom);
    if (!z) return hide();
    // C4: hovering a raised or lowered stat on a token adds its one-line sum ("Attack 9 = 8 + 1 Mt. Ember").
    const sum = e.target.closest?.('[data-sum]')?.dataset.sum ?? '';
    const key = `${el.dataset.zoom}|${sum}`;
    if (layer.dataset.key === key) return;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / 1920;
    const r = el.getBoundingClientRect();
    const box = { l: (r.left - sr.left) / k, t: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
    const why = el.dataset.why ?? el.querySelector('[data-why]')?.dataset.why ?? '';
    const FW = CARD_W;
    const FH = CARD_H;
    let x;
    let y;
    if (el.closest('.v4-rtray')) { x = 1512; y = 1080 - FH - 6; }   // C4: beside the tray, clear of the board's centre
    else if (el.closest('.v4-hand')) { x = box.l + box.w / 2 - FW / 2; y = box.t - FH - 26; }
    else if (el.closest('.v4-board')) { x = box.l + box.w + 14 + FW < 1910 ? box.l + box.w + 14 : box.l - FW - 14; y = box.t + box.h / 2 - FH / 2; }
    else { x = box.l - FW - 14 > 8 ? box.l - FW - 14 : box.l + box.w + 14; y = box.t + box.h / 2 - FH / 2; }
    x = Math.max(8, Math.min(1920 - FW - 8, x));
    y = Math.max(76, Math.min(1080 - FH - (why ? 34 : 8) - (sum ? 34 : 0), y));
    const inspect = el.closest('[data-codex]') ? '<span class="v4-zoominfo" title="Press C (or right-click) to open it in the Codex">ⓘ C</span>' : '';
    layer.innerHTML = `${cardHTML(z.card, { size: 'full', state: z.state })}${inspect}${sum ? `<p class="v4-zoomsum">${esc(sum)}</p>` : ''}${why ? `<p class="v4-zoomwhy">${esc(why)}</p>` : ''}`;
    Object.assign(layer.style, { display: 'block', left: `${Math.round(x)}px`, top: `${Math.round(y)}px` });
    layer.dataset.key = key;
  });
  root.addEventListener('mouseleave', hide);
  root.addEventListener('mousedown', hide);
}

function wire(root, s, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  on('[data-action="new"]', () => ctx.newMatch());

  on('[data-mull]', (el) => { const u = el.dataset.mull; ui.mull = (ui.mull ?? []).includes(u) ? ui.mull.filter((x) => x !== u) : [...(ui.mull ?? []), u]; ctx.redraw(); });
  on('[data-action="tournament-ok"]', () => { ui.seenTournament = s.tournament.startedRound; ctx.redraw(); ctx.tournamentSeen?.(); });
  root.querySelectorAll('[data-setting="reactTimer"]').forEach((el) => el.addEventListener('change', () => ctx.setReactTimer(Number(el.value))));
  root.querySelectorAll('[data-setting="speed"]').forEach((el) => el.addEventListener('change', () => ctx.setSpeed(el.value)));
  root.querySelectorAll('[data-setting="lowMotion"]').forEach((el) => el.addEventListener('change', () => ctx.setLowMotion(el.checked)));
  root.querySelectorAll('[data-dontask]').forEach((el) => el.addEventListener('change', () => { if (ui.confirm) ui.confirm.dontAsk = el.checked; }));
  on('[data-action="confirm-yes"]', () => ctx.confirmYes());
  on('[data-action="confirm-no"]', () => ctx.confirmNo());
  on('[data-action="keys-close"]', () => { ui.keys = false; ctx.redraw(); });
  on('[data-keytab]', (el) => { ui.keys = el.dataset.keytab === 'rules' ? 'rules' : true; ctx.redraw(); if (ui.keys === 'rules') root.querySelector('.v4-rulesearch')?.focus(); });
  const rs = root.querySelector?.('.v4-rulesearch');
  if (rs) {
    rs.addEventListener('input', () => { ui.rulesQ = rs.value; const b = root.querySelector('.v4-rulesbody'); if (b) b.innerHTML = rulesHTML(ui.rulesQ); });
    rs.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (rs.value) { rs.value = ''; ui.rulesQ = ''; const b = root.querySelector('.v4-rulesbody'); if (b) b.innerHTML = rulesHTML(''); } else { ui.keys = false; ctx.redraw(); } } });
  }
  on('[data-action="cancel"]', () => { ui.picker = null; ui.select = null; ui.drag = null; ctx.redraw(); });
  on('[data-action="mull-done"]', () => { const cards = ui.mull ?? []; ui.mull = []; ctx.act({ type: 'mulligan', who: 'player', cards }); });
  // The drawers open and close at any time (buying only on your turn).
  on('[data-action="open-log"]', () => { ui.drawer = ui.drawer === 'log' ? null : 'log'; ctx.redraw(); });
  on('[data-action="close-drawer"]', () => { ui.drawer = null; ctx.redraw(); });
  on('[data-view]', (el) => { ui.drawer = `view:${el.dataset.view}`; ctx.redraw(); });
  wireZoom(root);
  if (actor(s) !== 'player' || s.phase === 'mulligan' || ui.locked) return;
  // UX1: the React window pauses everything else.
  if (s.reactWindow) {
    on('[data-action="decline"]', () => ctx.act({ type: 'decline', who: 'player' }));
    on('[data-react]', (el) => {
      const c = s.players.player.hand.find((x) => x.uid === el.dataset.react);
      const targets = commandTargets(s, 'player', c, 'react');
      if (targets.length === 1) return ctx.act({ type: 'react', who: 'player', uid: c.uid, target: targets[0] });
      ui.select = { kind: 'react', uid: c.uid };
      ctx.redraw();
    });
    on('.v4-space.target', (el) => commitHit(s, ui, ctx, ui.select, { kind: 'space', who: el.dataset.who, space: Number(el.dataset.space) }));
    return;
  }
  on('[data-action="pass"]', () => ctx.endTurn());
  on('[data-pick]', (el) => { const pk = ui.picker; ui.picker = null; ctx.act({ type: 'command', who: 'player', uid: pk.uid, mode: el.dataset.pick, target: pk.target }); });
  on('.v4-hand .v4-card', (el) => { ui.select = ui.select?.uid === el.dataset.uid ? null : { kind: 'hand', uid: el.dataset.uid }; ctx.redraw(); });
  on('[data-action="retain"]', () => ctx.retain(ui.select.uid));
  on('[data-buy]', (el) => { ui.select = { kind: 'buy', from: 'mart', slot: Number(el.dataset.buy) }; ctx.redraw(); });
  on('[data-bag].usable', (el) => { ui.select = { kind: 'item', from: 'bag', uid: el.dataset.bag }; ctx.redraw(); });
  const src = () => (ui.select.kind === 'buy' ? { from: 'mart', slot: ui.select.slot } : { from: 'hand', uid: ui.select.uid });
  on('[data-action="buy-use"]', () => { ui.select = { kind: 'item', ...src() }; ctx.redraw(); });
  on('[data-action="buy-store"]', () => ctx.act({ type: 'buyItem', who: 'player', ...src(), then: 'store' }));
  on('[data-action="tr-command"]', () => ctx.act({ type: 'trainerCommand', who: 'player', uid: ui.select.uid }));
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
  on('[data-pickd]', (el) => {
    const sup = s.players.player.hand.find((c) => c.uid === ui.select.uid);
    const fav = favourMet(sup, s.players.player.hand.filter((c) => ui.select.release.includes(c.uid)));
    const want = (fav ? sup.favour : sup.effect).amount;
    const r = ui.select.pick ?? [];
    const u = el.dataset.pickd;
    ui.select.pick = r.includes(u) ? r.filter((x) => x !== u) : [...(r.length >= want ? r.slice(1) : r), u];
    ctx.redraw();
  });
  on('[data-action="sup-done"]', () => {
    // G3: only as many picks as the effect allows (the Favour can change with the Released cards).
    const sup = s.players.player.hand.find((c) => c.uid === ui.select.uid);
    const fav = favourMet(sup, s.players.player.hand.filter((c) => ui.select.release.includes(c.uid)));
    const eff = fav ? sup.favour : sup.effect;
    const pool = s.players.player.discard.filter((c) => c.cardType === 'Pokémon');
    const pick = eff.op === 'recover' ? (ui.select.pick ?? []).filter((u) => pool.some((c) => c.uid === u)).slice(0, Math.min(eff.amount, pool.length)) : [];
    ctx.release({ type: 'supporter', who: 'player', uid: ui.select.uid, release: ui.select.release, pick }, ui.select.release.length);
  });
  // A click on a glowing place: the same flow as a drop or Enter (flows.js).
  on('.v4-space.target', (el) => commitHit(s, ui, ctx, ui.select, { kind: 'space', who: el.dataset.who, space: Number(el.dataset.space) }, null));
  on('.v4-row.player .v4-card.can-attack', (el) => { ui.select = { kind: 'attack', from: Number(el.dataset.space) }; ui.focus = null; ctx.redraw(); });
  on('.v4-ring.target', () => commitHit(s, ui, ctx, ui.select, { kind: 'pc', who: 'ai' }, null));
  // C2: a choice played on the board as a whole (an Item with no target, e.g. Amulet Coin): a click anywhere on it.
  on('.v4-board.droppable', () => commitHit(s, ui, ctx, ui.select, { kind: 'board' }, null));
}
