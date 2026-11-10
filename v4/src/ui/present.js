// The presenter (UX4 A, B). Adapted from v2/src/ui/present.js: plays each action's events beat by
// beat: the action itself on the board as it was, then the new state drawn, then arrivals on the new
// board. The order and the beats come from plan.js (pure); this file only draws them. Input is locked
// while a beat plays, except click-to-skip (a click, Space or Esc), which jumps to the end of the
// action. The presenter never changes the state: it gets prev and next and calls draw() once.
// Without WebGL the 2D particles stand in (particles.js); numbers, banners and moves are page elements
// and always play. Every beat calls a sound hook (sound.js).
import { initVfx, vfxReady, playTimeline, skipTimelines, clearVfx, coins, rectOf, reducedMotion } from './vfx/engine.js?v=202611100828';
import { burst, clearParticles } from './particles.js?v=202611100828';
import { plan } from './plan.js?v=202611100828';
import {
  MS, attackDef, counterDef, tintFor, commandDef, MODE_STYLE, commandTint, SWEEP_COMMANDS, COMMAND_TYPES, summonFor, defeatFor, defOf,
  RING_FLARES, SUPPORTER_ANIMS, ITEM_ANIMS, attackSfx, tintOf,
} from './vfx/library.js?v=202611100828';
import { sfx } from './sound.js?v=202611100828';
import { speedFactor } from './settings.js?v=202611100828';
import { RULES } from '../rules.js?v=202611100828';
import { activeBrackets } from '../engine/game.js?v=202611100828';
import { commandDef as cardCommand, itemDef, supporterDef, trainerDef } from '../engine/cards.js?v=202611100828';
import { renderHandCard } from './board.js?v=202611100828';

const GOLD = ['#ffd36b', '#fff6c8'];
const NAME = { player: 'You', ai: 'The Opponent' };
const foeOf = (who) => (who === 'player' ? 'ai' : 'player');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// --- Timing and skipping ------------------------------------------------------------------------

let skipping = false;
let presenting = false;
const running = new Set();   // page animations still playing
const waiters = new Set();   // pauses still waiting
export const isPresenting = () => presenting;

// Skips to the end of the action being shown (the new state is still drawn).
export function skip() {
  if (!presenting) return;
  skipping = true;
  skipTimelines();
  for (const a of [...running]) { try { a.finish(); } catch { /* already gone */ } }
  for (const done of [...waiters]) done();
}

function wait(ms) {
  if (ms <= 0 || skipping) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(id); waiters.delete(done); resolve(); };
    const id = setTimeout(done, ms);
    waiters.add(done);
  });
}
async function animate(el, frames, ms, options = {}) {
  if (!el?.animate || ms <= 0 || skipping) return;
  const a = el.animate(frames, { duration: ms, easing: 'ease-in-out', ...options });
  running.add(a);
  try { await a.finished; } catch { /* cancelled */ } finally { running.delete(a); }
}
// A library timeline at this speed. Without WebGL it resolves at once: a 2D burst stands in.
function play(def, ctx, t, rate = 1) {
  if (skipping || !def) return Promise.resolve();
  if (!vfxReady()) {
    const el = ctx.target ?? ctx.attacker;
    if (el?.isConnected) {
      const r = rectOf(el);
      burst(r.x + r.w / 2, r.y + r.h / 2, { kind: 'spark', colors: ctx.tint ?? GOLD, count: 14 });
    }
    return Promise.resolve();
  }
  return playTimeline(defOf(def), { rate: rate / t(1), ...ctx });
}

// --- The animation layer: numbers, banners, cards in flight -------------------------------------------

let layer = null;
function fx() {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'v4-anim';
  document.getElementById('stage').appendChild(layer);
  return layer;
}
const add = (cls, html, at) => {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  if (at) Object.assign(el.style, { left: `${at.x}px`, top: `${at.y}px` });
  fx().appendChild(el);
  return el;
};
const pointOf = (el) => (el?.isConnected ? centre(rectOf(el)) : null);

// A number or word rising off something.
function floatText(el, text, kind, ms, at = null) {
  const p = at ?? pointOf(el);
  if (!p || skipping || ms <= 0) return;
  const n = add(`v4-float ${kind}`, esc(text), { x: p.x, y: p.y - 20 });
  const a = n.animate([
    { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
    { transform: 'translate(-50%, -18px) scale(1.15)', opacity: 1, offset: 0.15 },
    { transform: 'translate(-50%, -40px) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%, -64px) scale(1)', opacity: 0 },
  ], { duration: ms, easing: 'ease-out' });
  running.add(a);
  a.finished.then(() => n.remove(), () => n.remove()).finally(() => running.delete(a));
}

// A banner across the middle (Round N, turns, Supper): short, never more than ~0.8 s.
async function banner(title, sub, t, kind = '') {
  if (skipping) return;
  const b = add(`v4-banner ${kind}`, `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`);
  const all = t(MS.banner);
  await animate(b, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.85)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.25 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.04)' }], all, { fill: 'forwards' });
  b.remove();
}

// Something (a small card, a coin, a word) flying between two places, in stage px.
async function fly(html, from, to, ms, { cls = '', end = {}, arc = 60 } = {}) {
  if (!from || !to || skipping || ms <= 0) return;
  const el = add(`v4-flyer ${cls}`, html, from);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  await animate(el, [
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - arc}px)) scale(1.05)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${end.scale ?? 0.6})`, opacity: end.opacity ?? 0.2, filter: end.filter ?? 'none' },
  ], ms, { easing: 'ease-in-out', fill: 'forwards' });
  el.remove();
}

// --- Finding things on the board (whichever board is drawn) ----------------------------------------

const $ = (sel) => document.querySelector(`#app ${sel}`);
const spaceEl = (who, space) => $(`.v4-space[data-who="${who}"][data-space="${space}"]`);
// A Pokémon's card: on the board, or its ghost (a Pokémon defeated after the new board was drawn).
let ghosts = new Map();
const cardEl = (who, space) => ghosts.get(`${who}:${space}`) ?? spaceEl(who, space)?.querySelector('.v4-mon') ?? null;
const ringEl = (who) => $(`.v4-ring.${who}`);
const purseEl = (who) => $(`.v4-hud.${who === 'player' ? 'you' : 'opp'} .v4-purse`);
const bagEl = (who) => $(`.v4-hud.${who === 'player' ? 'you' : 'opp'} .v4-bag`);
const trackerEl = (uid) => $(`[data-trk="${uid}"]`);
const plateEl = (uid) => $(`[data-plate="${uid}"]`);
const tileEl = (uid) => $(`[data-loc="${uid}"]`);
const pileEl = (who, kind) => $(`[data-pile="${who}-${kind}"]`);
const boardEl = () => $('.v4-board');
const STAGE_MID = { x: 815, y: 472 };
// Where a card in someone's hand comes from: the fanned hand, or the opponent's backs.
function fromHand(who, uid) {
  const el = who === 'player' ? $(`.v4-hand [data-uid="${uid}"]`) : $('.v4-oback:last-of-type') ?? $('.v4-ohand');
  return pointOf(el) ?? { x: 940, y: who === 'player' ? 1000 : 100 };
}
// A sealed Strat's place on its owner's board edge (board.js sealed()).
const sealSpot = (who, k = 0) => ({ x: 24 - 18 + 20, y: 180 + (who === 'ai' ? 60 : 392) + k * 30 + 28 });

// A Strength number ticking to its new value on a card (the old board's own number, presentation only).
function tick(el, before, after, ms) {
  const str = el?.querySelector('.v4-st .str');
  if (!str) return;
  const node = [...str.childNodes].reverse().find((n) => n.nodeType === 3);
  if (!node) return;
  const show = (v) => { node.textContent = ` ${Math.max(0, Math.round(v))}`; };
  str.classList.toggle('hurt', after < before);
  if (skipping || ms <= 0 || before === after) { show(after); return; }
  const steps = Math.min(8, Math.abs(after - before));
  for (let k = 1; k <= steps; k++) setTimeout(() => { if (str.isConnected) show(before + ((after - before) * k) / steps); }, (ms * k) / steps);
}
// Every hit an effect did (Strength or Attack changes): numbers, ticks, motes and auras.
function showHit(h, t, { el = cardEl(h.who, h.space) } = {}) {
  if (!el) return;
  if (h.after < h.before) { floatText(el, `−${h.before - h.after}`, 'damage', t(MS.number)); sfx('hit', { who: h.who }); }
  if (h.after > h.before) {
    floatText(el, `+${h.after - h.before}`, 'heal', t(MS.number));
    sfx('heal', { who: h.who });
    if (!vfxReady()) burst(pointOf(el).x, pointOf(el).y, { kind: 'sparkle', colors: ['#9ff07a', '#e0ffd0'], count: 10, up: 120 });
  }
  if (h.attackAfter > h.attackBefore) { floatText(el, `+${h.attackAfter - h.attackBefore} Attack`, 'level', t(MS.number)); el.classList.add('aura'); }
  if (h.before !== h.after) tick(el, h.before, h.after, t(MS.tick));
}

// --- A card revealed at centre stage (a Command, a Supporter, a Trainer Command) ------------------------

async function reveal(prev, who, card, from, t, { rise = 320, scale = 1, tag = '' } = {}) {
  const to = { x: STAGE_MID.x, y: who === 'player' ? 520 : 420 };
  const el = add('v4-reveal', `${renderHandCard(prev, card, 'shown')}${tag ? `<div class="v4-reveal-tag">${tag}</div>` : ''}`, to);
  el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  await animate(el, [
    { transform: `translate(calc(-50% + ${from.x - to.x}px), calc(-50% + ${from.y - to.y}px)) scale(0.45)`, opacity: 0.4 },
    { transform: `translate(-50%, -50%) scale(${scale})`, opacity: 1 },
  ], t(rise), { easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
  return el;
}
async function fadeOut(el, t) {
  await animate(el, [{ opacity: 1 }, { opacity: 0, filter: 'brightness(2) blur(2px)' }], t(MS.commandOut), { fill: 'forwards' });
  el.remove();
}
// A Command card as it was played (from the hand, the React window's pending action or a Strat).
function playedCommand(prev, e) {
  const fromStrat = prev.strats.find((x) => x.owner === e.who && x.card.id === e.id && x.target.space === e.target.space && x.target.who === e.target.who);
  const pending = prev.reactWindow?.pending;
  const card = fromStrat?.card ?? (pending?.type === 'command' && pending.card.id === e.id ? pending.card : null)
    ?? prev.players[e.who].hand.find((c) => c.id === e.id) ?? { ...cardCommand(e.id), uid: `x-${e.id}` };
  const from = fromStrat ? pointOf($(`[data-strat="${fromStrat.uid}"]`)) ?? sealSpot(e.who) : fromHand(e.who, card.uid);
  return { card, from };
}
// A temporary region over some spaces (for a sweep), removed with the layer.
function regionOver(spaces) {
  const rects = spaces.map((el) => rectOf(el));
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)) - 8;
  const y = Math.min(...rects.map((r) => r.y)) - 8;
  const r = add('v4-region', '', { x, y });
  Object.assign(r.style, { width: `${Math.max(...rects.map((q) => q.x + q.w)) - x + 8}px`, height: `${Math.max(...rects.map((q) => q.y + q.h)) - y + 8}px` });
  return r;
}

// --- The beats ---------------------------------------------------------------------------------------

let cause = null;   // the Type that last dealt damage (how a defeated Pokémon goes)

const BEATS = {
  async attack({ prev, e, t }) {
    const card = prev.players[e.who].row[e.from];
    const a = cardEl(e.who, e.from);
    if (!card || !a) return;
    const foe = foeOf(e.who);
    const toPlayer = e.target.kind === 'player';
    const d = toPlayer ? null : prev.players[foe].row[e.target.space];
    const b = toPlayer ? ringEl(foe) : cardEl(foe, e.target.space);
    cause = card.type;
    const trade = e.back > 0 && d;
    sfx(attackSfx(card), { who: e.who, damage: e.amount });
    let shown = false;
    const numbers = () => {
      if (shown) return;
      shown = true;
      sfx('hit', { damage: e.amount });
      if (toPlayer) floatText(b, `Hit · ${e.amount}`, 'recognition-hit', t(MS.number));
      else { floatText(b, `−${e.amount}`, 'damage', t(MS.number)); tick(b, d.currentStrength, d.currentStrength - e.amount, t(MS.tick)); }
      if (trade) {
        // The hit-back's number lands with its own (shorter) animation, or now without WebGL.
        if (!vfxReady() || skipping) { floatText(a, `−${e.back}`, 'damage', t(MS.number)); tick(a, card.currentStrength, card.currentStrength - e.back, t(MS.tick)); }
      }
    };
    let backShown = false;
    const back = () => {
      if (backShown || !trade) return;
      backShown = true;
      floatText(a, `−${e.back}`, 'damage', t(MS.number));
      tick(a, card.currentStrength, card.currentStrength - e.back, t(MS.tick));
    };
    a.classList.add('fx-attacker');
    await play(attackDef(card, { trade: !!trade }), {
      attacker: a, target: b, damage: e.amount, tint: tintFor(card), fire: card.type === 'Fire',
      on: {
        impact: numbers,
        trade: () => { if (trade && b) { sfx(attackSfx(d), { who: foe, damage: e.back, counter: true }); play(counterDef(d), { attacker: b, target: a, damage: e.back, tint: tintFor(d), on: { counterHit: back } }, t); } },
      },
    }, t);
    numbers();
    if (trade && vfxReady() && !skipping) await wait(t(260));
    back();
    a.classList.remove('fx-attacker');
  },

  async command({ prev, e, t }) {
    const style = MODE_STYLE[e.mode];
    const { card, from } = playedCommand(prev, e);
    const tag = `<b>${NAME[e.who]}: ${esc(card.name)}</b><span>${e.mode === 'strat' ? 'Strat resolves' : 'Adapt'}</span>`;
    sfx(e.mode === 'strat' ? 'command-strat' : 'command-adapt', { id: e.id, who: e.who });
    const el = await reveal(prev, e.who, card, from, t, { rise: style.rise, scale: e.mode === 'strat' ? 1.1 : 1, tag });
    await commandEffect(prev, e, el, t, style);
    await fadeOut(el, t);
  },

  async react({ prev, next, e, t, i }) {
    // The React card (quick: no rise), then its effect (the commandResolved that follows it).
    const r = e.type === 'react' ? e : null;
    const res = r ? next.events.slice(i + 1).find((x) => x.type === 'commandResolved' && x.mode === 'react' && x.who === e.who) : e;
    const card = prev.players[e.who].hand.find((c) => c.uid === r?.uid) ?? { ...cardCommand(e.id), uid: r?.uid ?? `x-${e.id}` };
    sfx('react', { id: e.id, who: e.who });
    const tEl = cardEl(e.target.who, e.target.space);
    const at = pointOf(tEl) ?? STAGE_MID;
    const el = await reveal(prev, e.who, card, fromHand(e.who, card.uid), t, { rise: 160, scale: 0.7, tag: `<b>${NAME[e.who]} React: ${esc(card.name)}</b>` });
    el.style.left = `${Math.max(140, Math.min(1500, at.x + (at.x > 900 ? -230 : 230)))}px`;
    el.style.top = `${Math.max(200, Math.min(760, at.y))}px`;
    if (res) await commandEffect(prev, res, el, t, MODE_STYLE.react);
    await fadeOut(el, t);
  },

  async seal({ prev, e, t }) {
    // A Strat is shown sealed: the card flies to its owner's board edge and turns into a glowing back.
    const card = prev.players[e.who].hand.find((c) => c.id === e.id) ?? { ...cardCommand(e.id), uid: 'x' };
    sfx('command-strat', { id: e.id, who: e.who, sealed: true });
    const k = prev.strats.filter((x) => x.owner === e.who).length;
    floatText(cardEl(e.target.who, e.target.space), `Strat: ${card.name}`, 'status', t(MS.note));
    await fly('<div class="v4-sealcard"><i>⏳</i></div>', fromHand(e.who, card.uid), sealSpot(e.who, k), t(MS.seal), { cls: 'seal', end: { scale: 0.45, opacity: 1 } });
  },

  async trainerCommand({ prev, e, t }) {
    const card = prev.players[e.who].hand.find((c) => c.id === e.id) ?? { ...trainerDef(e.id), uid: 'x' };
    sfx('command-adapt', { id: e.id, who: e.who });
    const el = await reveal(prev, e.who, card, fromHand(e.who, card.uid), t, { tag: `<b>${NAME[e.who]}: ${esc(card.name)}</b><span>Trainer Command</span>` });
    const hits = e.hits ?? [];
    if (hits.length) {
      cause = card.partner?.type ?? 'Normal';
      await Promise.all(hits.map((h, k) => wait(t(80 * k)).then(() => play('v4-effect-hit', { target: cardEl(h.who, h.space), damage: h.before - h.after, tint: tintOf(cause), on: { impact: () => showHit(h, t) } }, t))));
      hits.forEach((h) => showHit(h, t));
    } else {
      const pile = pileEl(e.who, 'draw');
      floatText(pile, card.command?.text ?? 'Draw', 'status', t(MS.note));
      await play('v4-search', { target: pile, tint: GOLD }, t);
    }
    await fadeOut(el, t);
  },

  async supporter({ prev, e, t }) {
    const card = prev.players[e.who].hand.find((c) => c.uid === e.uid) ?? { ...supporterDef(e.id), uid: 'x' };
    sfx('command-adapt', { id: e.id, who: e.who, supporter: true });
    const el = await reveal(prev, e.who, card, fromHand(e.who, card.uid), t, { tag: `<b>${NAME[e.who]}: ${esc(card.name)}</b><span>Released: ${esc(e.released.join(', '))}</span>` });
    // The Released cards burn away (to the Released Pile: out of the match).
    const sink = pointOf(e.who === 'player' ? $('.v4-relline') : $('.v4-ohand')) ?? { x: 1700, y: e.who === 'ai' ? 60 : 1040 };
    const burns = (e.releasedUids ?? []).map((uid, k) => {
      const c = prev.players[e.who].hand.find((h) => h.uid === uid);
      const html = c && e.who === 'player' ? `<div class="v4-mini-card" style="background-image: url('../assets/cards/${c.art}.jpg')"></div>` : '<div class="v4-mini-card back"></div>';
      return wait(t(90 * k)).then(() => fly(html, fromHand(e.who, uid), sink, t(MS.burn), { cls: 'burning', end: { scale: 0.4, opacity: 0, filter: 'sepia(1) brightness(0.3)' } }));
    });
    await Promise.all(burns);
    // Then the effect: on each of the player's Pokémon, or a search of the Draw Pile.
    const hits = e.hits ?? [];
    const anim = SUPPORTER_ANIMS[e.id];
    if (hits.length) await Promise.all(hits.map((h, k) => wait(t(70 * k)).then(() => play(anim, { target: cardEl(h.who, h.space), tint: tintOf('Grass'), on: { heal: () => showHit(h, t) } }, t))));
    else { floatText(pileEl(e.who, 'draw'), 'Search', 'status', t(MS.note)); await play(anim, { target: pileEl(e.who, 'draw'), tint: GOLD }, t); }
    hits.forEach((h) => showHit(h, t));
    if (e.favour && !skipping) {
      const f = add('v4-favour', 'Favour!', pointOf(el));
      await Promise.all([play('supporter-moment', { target: el, tint: GOLD, when: { gift: true } }, t, 2), animate(f, [{ opacity: 0, transform: 'translate(-50%, 0) scale(0.5)' }, { opacity: 1, transform: 'translate(-50%, -30px) scale(1.2)', offset: 0.3 }, { opacity: 1, transform: 'translate(-50%, -40px) scale(1)' }], t(MS.favour), { fill: 'forwards' })]);
      f.remove();
    }
    await fly('<div class="v4-mini-card back"></div>', pointOf(el), sink, t(MS.burn * 0.6), { cls: 'burning', end: { scale: 0.3, opacity: 0, filter: 'sepia(1) brightness(0.3)' } });
    el.remove();
  },

  async itemBought({ prev, e, t }) {
    const item = itemDef(e.id);
    const from = e.from === 'mart' ? pointOf($('.v4-martbtn')) : fromHand(e.who, e.uid);
    const to = e.then === 'store' ? pointOf(bagEl(e.who)) : pointOf(purseEl(e.who));
    sfx('coins', { who: e.who, spent: e.price });
    floatText(purseEl(e.who), `−$${e.price}`, 'coins', t(MS.number));
    await fly(`<div class="v4-mini-card item" style="background-image: url('../assets/cards/${item.art}.jpg')"></div>`, from, to, t(MS.itemFly), { end: { scale: 0.5, opacity: 0.7 } });
  },

  async itemUsed({ e, t }) {
    const el = cardEl(e.who, e.space);
    sfx('heal', { who: e.who, item: e.id });
    floatText(el, e.itemType === 'Held' ? `Holds ${e.name}` : e.name, 'status', t(MS.note));
    const hits = e.hits ?? [];
    await play(ITEM_ANIMS[e.op] ?? 'v4-held', { target: el, tint: e.op === 'attackUp' ? tintOf('Fighting') : tintOf('Grass'), on: { heal: () => hits.forEach((h) => showHit(h, t)), aura: () => hits.forEach((h) => showHit(h, t)) } }, t);
    hits.forEach((h) => showHit(h, t));
  },

  async defeat({ prev, e, t }) {
    const el = cardEl(e.who, e.space);
    if (!el) return;
    sfx('defeat', { who: e.who });
    floatText(el, 'Defeated', 'defeat', t(MS.number));
    await play(defeatFor(cause), { target: el, tint: tintOf(prev.players[e.who].row[e.space]?.type) }, t);
    await animate(el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.9)', filter: 'brightness(0.4)' }], t(MS.defeat), { fill: 'forwards' });
  },

  async summon({ next, e, t }) {
    const el = cardEl(e.who, e.space);
    const card = next.players[e.who].row[e.space];
    if (!el || !card) return;
    sfx('summon', { who: e.who, level: e.level });
    await play(summonFor(card), { target: el, tint: tintFor(card), fire: card.type === 'Fire' }, t);
    await onSummon(el, card, e, t);
  },

  async partner({ next, e, t }) {
    const card = next.players[e.who].row[e.space];
    const el = cardEl(e.who, e.space);
    const tr = next.players[e.who].trainers.find((x) => x.name === e.trainer);
    const trk = tr && trackerEl(tr.uid);
    sfx('partner', { who: e.who, name: e.name });
    // The tracker bursts; the Trainer's art sweeps across; the Partner lands with a gold shockwave.
    if (trk) { trk.classList.add('done'); play('v4-tracker', { target: trk, tint: GOLD }, t); await animate(trk, [{ transform: 'scale(1)', filter: 'none' }, { transform: 'scale(1.12)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], t(MS.partnerBurst)); }
    if (!skipping && tr) {
      const sw = add('v4-sweep', `<span class="a" style="background-image: url('../assets/cards/${tr.card.art}.jpg')"></span><b>${esc(e.trainer)}'s Partner</b><span class="n">${esc(e.name)}</span>`);
      await animate(sw, [{ transform: 'translate(-120%, -50%) skewX(-12deg)', opacity: 0 }, { transform: 'translate(-50%, -50%) skewX(-12deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%, -50%) skewX(-12deg)', opacity: 1, offset: 0.65 }, { transform: 'translate(20%, -50%) skewX(-12deg)', opacity: 0 }], t(MS.partnerSweep), { fill: 'forwards' });
      sw.remove();
    }
    if (el && card) {
      await play('v4-partner', { target: el, tint: GOLD }, t);
      await onSummon(el, card, e, t);
    }
  },

  async pip({ e, t }) {
    const trk = trackerEl(e.uid);
    if (!trk) return;
    const pip = trk.querySelectorAll('.pips i')[Math.min(e.progress, e.need) - 1];
    if (pip) { pip.classList.add('on'); await animate(pip, [{ transform: 'scale(1)' }, { transform: 'scale(2.2)', background: '#fff2b8', boxShadow: '0 0 10px #ffe08a' }, { transform: 'scale(1)' }], t(MS.pip)); }
  },

  async trackerComplete({ e, t }) {
    const trk = trackerEl(e.uid);
    if (!trk) return;
    trk.classList.add('done');
    floatText(trk, `${e.name}: Objective complete!`, 'level', t(MS.number));
    await Promise.all([play('v4-tracker', { target: trk, tint: ['#7fe08a', '#e6ffd8'] }, t), animate(trk, [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], t(MS.tracker))]);
  },

  async recognition({ e, t }) {
    const ring = ringEl(e.who);
    if (!ring) return;
    sfx('recognition', { who: e.who, amount: e.amount });
    const f = e.from ?? {};
    const src = f.kind === 'space' ? spaceEl(f.who, f.space) : f.kind === 'pc' ? ringEl(f.who) : f.kind === 'location' ? plateEl(f.uid) : f.kind === 'tournament' ? $('.v4-lplate.tournament') : f.kind === 'tracker' ? trackerEl(f.uid) : $('.v4-reveal');
    const from = pointOf(src) ?? STAGE_MID;
    const to = pointOf(ring);
    // In the Tournament the chip shows the boost: "+2 → +3".
    const text = e.amount !== e.base ? `+${e.base} → +${e.amount}` : `+${e.amount}`;
    if (!skipping) {
      const n = add('v4-float recognition', esc(text), from);
      await animate(n, [{ transform: 'translate(-50%, -50%) scale(0.7)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.8)`, opacity: 0.9 }], t(MS.fly), { easing: 'ease-in', fill: 'forwards' });
      n.remove();
    }
    await fillRing(e.who, e.total - e.amount, e.total, t);
  },

  async coins({ e, t }) {
    const to = pointOf(purseEl(e.who));
    const f = e.from ?? {};
    const from = (f.kind === 'space' ? pointOf(spaceEl(f.who, f.space)) : null) ?? STAGE_MID;
    sfx('coins', { who: e.who, amount: e.amount });
    floatText(purseEl(e.who), `+$${e.amount}`, 'coins', t(MS.number));
    if (!coins(from, to, Math.min(6, 1 + e.amount), t(MS.coins), null)) {
      for (let k = 0; k < Math.min(4, e.amount); k++) fly('<i class="v4-coin">$</i>', from, to, t(MS.coins) + k * 60, { end: { scale: 0.7, opacity: 0.5 } });
    }
    await wait(t(MS.coins * 0.5));
  },

  async dominance({ e, t }) {
    if (!e.who) { floatText($('.v4-lplate.tournament'), 'Tied: nobody dominates', 'status', t(MS.note)); return; }
    const plate = e.type === 'tournamentDominance' ? $('.v4-lplate.tournament') : plateEl(e.uid);
    if (!plate) return;
    // The winner's side of the plate glows (yours below, the Opponent's above).
    const r = rectOf(plate);
    const g = add(`v4-domglow ${e.who}`, '', { x: r.x, y: r.y + (e.who === 'player' ? r.h / 2 : 0) });
    Object.assign(g.style, { width: `${r.w}px`, height: `${r.h / 2}px` });
    await Promise.all([play('v4-dominance', { target: plate, tint: GOLD }, t), animate(g, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], t(MS.dominance))]);
    g.remove();
  },

  async locationPlaced({ prev, next, e, t }) {
    const tile = tileEl(e.uid);
    const plate = plateEl(e.uid);
    if (!tile) return;
    sfx('location-place', { who: e.who, id: e.id });
    floatText(plate ?? tile, `${NAME[e.who]}: ${e.name}`, 'status', t(MS.note));
    const unfold = [{ clipPath: 'inset(0 50% 0 50%)', opacity: 0.3 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }];
    await Promise.all([animate(tile, unfold, t(MS.locationIn), { easing: 'cubic-bezier(.2,.9,.3,1)' }), plate && animate(plate, unfold, t(MS.locationIn)), play('v4-location', { target: plate ?? tile, tint: GOLD }, t)]);
    weatherPulse(prev, next, t);
  },

  async locationRemoved({ prev, next, e, t }) {
    const tile = tileEl(e.uid);
    const plate = plateEl(e.uid);
    if (!tile) return;
    floatText(plate ?? tile, `${e.name} leaves`, 'status', t(MS.note));
    const fold = [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 50% 0 50%)', opacity: 0.2 }];
    await Promise.all([animate(tile, fold, t(MS.locationOut), { fill: 'forwards' }), plate && animate(plate, fold, t(MS.locationOut), { fill: 'forwards' })]);
  },

  async tournament({ t }) {
    // A stadium sweep across all 9 lanes; then the existing banner; then "×1.5" on each ring (main.js).
    sfx('tournament');
    const tile = $('.v4-ltile.tournament');
    const b = boardEl();
    if (b && !skipping) {
      const r = rectOf(b);
      const sw = add('v4-stadium', '', { x: r.x, y: r.y });
      Object.assign(sw.style, { width: `${r.w}px`, height: `${r.h}px` });
      await Promise.all([
        animate(sw.appendChild(document.createElement('i')), [{ transform: 'translateX(-30%)' }, { transform: `translateX(${r.w}px)` }], t(MS.stadium), { easing: 'ease-in-out', fill: 'forwards' }),
        tile && animate(tile, [{ opacity: 0, filter: 'brightness(2)' }, { opacity: 1, filter: 'brightness(1)' }], t(MS.stadium)),
        play('v4-tournament', { target: tile ?? b, tint: GOLD }, t),
      ]);
      sw.remove();
    }
    // The existing banner follows (once this action is drawn); closing it stamps "×1.5" on each ring.
  },

  async breakfast({ next, e, t }) {
    await banner(`Round ${e.round}`, 'Breakfast', t, 'phase');
    sfx('turn', { round: e.round });
    // The summary strip, then the new hand deals in (and Breakfast's heals on the board).
    const sum = e.summary ?? {};
    const line = (w) => (sum[w] ? `<p class="${w}"><b>${w === 'player' ? 'You' : 'Opponent'}</b> drew ${sum[w].drew} · +$${sum[w].dollars} · ${sum[w].energy} Base Energy${(e.hits ?? []).filter((h) => h.who === w && h.after > h.before).length ? ` · ${(e.hits ?? []).filter((h) => h.who === w && h.after > h.before).length} healed` : ''}</p>` : '');
    const strip = skipping ? null : add('v4-strip', `${line('player')}${line('ai')}`);
    (e.hits ?? []).forEach((h) => showHit(h, t));
    const slots = [...document.querySelectorAll('#app .v4-hand .v4-slot')];
    const from = pointOf(pileEl('player', 'draw')) ?? { x: 1560, y: 880 };
    const deals = slots.map((sl, k) => {
      const r = rectOf(sl);
      return wait(t((MS.deal / Math.max(1, slots.length)) * k)).then(() => animate(sl, [{ translate: `${from.x - r.x - 91}px ${from.y - r.y - 127}px`, opacity: 0 }, { translate: '0 0', opacity: 1 }], t(MS.deal * 0.6), { easing: 'cubic-bezier(.2,.9,.3,1)' }));
    });
    if (strip) await animate(strip, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], t(MS.strip), { fill: 'forwards' });
    await Promise.all(deals);
    strip?.remove();
  },

  async supperHand({ prev, t }) {
    // Each Location counts down (a pip goes out); the hand slides to the Discard Pile (Retained cards stay).
    for (const l of prev.locations) {
      const pip = [...(plateEl(l.uid)?.querySelectorAll('.dur i:not(.off)') ?? [])].at(-1);
      if (pip) animate(pip, [{ opacity: 1, transform: 'scale(1.6)' }, { opacity: 0.2, transform: 'scale(1)' }], t(MS.handOut), { fill: 'forwards' });
    }
    const to = pointOf(pileEl('player', 'disc')) ?? { x: 1690, y: 880 };
    const slots = [...document.querySelectorAll('#app .v4-hand .v4-slot')].filter((sl) => !sl.querySelector('.v4-ret'));
    await Promise.all(slots.map((sl, k) => {
      const r = rectOf(sl);
      return wait(t(30 * k)).then(() => animate(sl, [{ translate: '0 0', opacity: 1 }, { translate: `${to.x - r.x - 91}px ${to.y - r.y - 127}px`, opacity: 0, scale: '0.5' }], t(MS.handOut), { easing: 'ease-in', fill: 'forwards' }));
    }));
  },

  async retain({ e, t }) {
    const el = e.who === 'player' ? $(`.v4-hand [data-uid="${e.uid}"]`) : $('.v4-ohand');
    if (!el) return;
    const p = pointOf(el);
    const lock = add('v4-lockfx', '🔒', p);
    await animate(lock, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(2)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.4 }, { opacity: 0, transform: 'translate(-50%, -80%) scale(1)' }], t(MS.lock), { fill: 'forwards' });
    lock.remove();
  },

  async mart({ t }) {
    const b = $('.v4-martbtn');
    if (b) await animate(b, [{ filter: 'none' }, { filter: 'brightness(1.6)' }, { filter: 'none' }], t(MS.note * 0.6));
  },

  async round({ e, t }) { sfx('turn', { round: e.round }); await banner(`Round ${e.round}`, 'Battle', t, 'phase'); },
  async supper({ e, t }) { await banner('Supper', `Round ${e.round}: Strats, dominance, the hand to the Discard Pile`, t, 'phase small'); },
  async turn({ e, t }) { sfx('turn', { who: e.who }); await banner(e.who === 'player' ? 'Your turn' : 'Opponent\'s turn', '', t, `turn ${e.who}`); },

  async champion({ next, e, t }) {
    // The winner's ring fills and flares "Champion", then the end screen.
    sfx('victory', { winner: e.winner });
    const ring = ringEl(e.winner);
    await fillRing(e.winner, next.players[e.winner].recognition, RULES.win, t);
    if (ring && !skipping) {
      const c = add('v4-champ', 'Champion', pointOf(ring));
      await Promise.all([play('v4-champion', { target: ring, tint: GOLD }, t), animate(c, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.3)', offset: 0.3 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 }, { opacity: 0 }], t(MS.champion), { fill: 'forwards' })]);
      c.remove();
    }
  },

  async note({ prev, e, t }) {
    const at = {
      decline: () => [ringEl(e.who), 'Let it happen'],
      fizzled: () => [boardEl(), `${e.what}: fizzled`],
      partnerWaiting: () => [ringEl(e.who), `${e.name} waits for a space`],
      trainerTaken: () => [pileEl(e.who, e.from === 'discard' ? 'disc' : 'draw') ?? ringEl(e.who), 'Trainer card leaves the deck'],
      pass: () => [ringEl(e.who), e.endsPhase ? 'Pass · the Battle Phase ends' : 'Pass · +1 Energy'],
      reshuffled: () => [pileEl(e.who, 'draw'), 'Reshuffled'],
    }[e.type]?.();
    if (!at) return;
    floatText(at[0], at[1], 'status', t(MS.note));
    if (e.type === 'pass' && e.spends?.length) for (const sp of e.spends) floatText(cardEl(e.who, sp), 'Spent', 'status', t(MS.note));
    await wait(t(MS.note * 0.35));
  },
};

// A Command's effect at its target (Ember, Rock Slide, Recover, X Attack), from the revealed card.
async function commandEffect(prev, e, el, t, style) {
  const hits = e.hits ?? [];
  const target = cardEl(e.target.who, e.target.space);
  cause = COMMAND_TYPES[e.id] ?? 'Normal';
  const sweep = SWEEP_COMMANDS.includes(e.id);
  const sweepTargets = sweep ? hits.map((h) => ({ el: cardEl(h.who, h.space), side: 'enemy', h })).filter((x) => x.el) : [];
  const region = sweep ? regionOver(sweepTargets.map((x) => x.el.closest('.v4-space') ?? x.el)) : null;
  const shown = new Set();
  const hit = (h) => { if (!h || shown.has(h)) return; shown.add(h); showHit(h, t); };
  const all = () => hits.forEach(hit);
  await play(commandDef(e.id, e.mode), {
    attacker: el, target: target ?? el, damage: Math.max(1, ...hits.map((h) => h.before - h.after)) * (style.scale ?? 1), tint: commandTint(e.id),
    fire: e.id === 'ember', full: !!style.fuller, region, casterBelow: e.who === 'player', sweepTargets,
    on: { catch: all, impact: all, heal: all, aura: all, sweepHit: ({ index }) => hit(sweepTargets[index]?.h) },
  }, t, style.rate);
  all();
  region?.remove();
  if (!skipping) await wait(t(120));
}

// On Summon after a summon or a Partner: damage to each enemy uses the Pokémon's own attack
// animation (at the first, a short hit on the rest); a draw shows at the Draw Pile.
async function onSummon(el, card, e, t) {
  const hits = e.hits ?? [];
  if (!card.onSummon) return;
  if (!hits.length) {
    if (card.onSummon.some((o) => o.op === 'draw')) floatText(el, card.text || 'On Summon', 'status', t(MS.note));
    return;
  }
  floatText(el, 'On Summon', 'status', t(MS.note));
  cause = card.type;
  sfx(attackSfx(card), { who: e.who, onSummon: true });
  const [first, ...rest] = hits;
  const shown = new Set();
  const show = (h) => { if (!shown.has(h)) { shown.add(h); showHit(h, t); } };
  await play(attackDef(card), {
    attacker: el, target: cardEl(first.who, first.space), damage: first.before - first.after, tint: tintFor(card), fire: card.type === 'Fire',
    on: {
      impact: () => {
        show(first);
        rest.forEach((h, k) => wait(t(70 * k)).then(() => { play('v4-effect-hit', { target: cardEl(h.who, h.space), damage: h.before - h.after, tint: tintFor(card) }, t); show(h); }));
      },
    },
  }, t);
  hits.forEach(show);
}

// The ring fills smoothly (capped at 100), flaring at 50, 70 and 90.
async function fillRing(who, from, to, t) {
  const ring = ringEl(who);
  const arc = ring?.querySelectorAll('circle')[1];
  const num = ring?.querySelector('.n b');
  if (!arc) return;
  const C = 2 * Math.PI * 37;
  const a = Math.min(RULES.win, from);
  const b = Math.min(RULES.win, to);
  const dash = (v) => `${(C * v) / 100} ${C}`;
  if (num) num.textContent = String(b);
  await animate(arc, [{ strokeDasharray: dash(a) }, { strokeDasharray: dash(b) }], t(MS.ring), { easing: 'ease-out', fill: 'forwards' });
  arc.setAttribute('stroke-dasharray', dash(b));
  const crossed = RING_FLARES.filter((n) => a < n && b >= n);
  if (crossed.length && !skipping) {
    floatText(ring, `${crossed.at(-1)}!`, 'level', t(MS.number));
    await play('v4-ring-flare', { target: ring, tint: GOLD }, t);
  }
}

// "×1.5" stamped on each ring (the Tournament).
export async function stampRings(t = (ms) => ms * speedFactor()) {
  if (t(1) <= 0) return;
  await Promise.all(['player', 'ai'].map(async (who) => {
    const ring = ringEl(who);
    if (!ring) return;
    const s = add('v4-stamp', '×1.5', { x: pointOf(ring).x + 34, y: pointOf(ring).y - 30 });
    await animate(s, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(2.4) rotate(-14deg)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(-8deg)', offset: 0.35 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], t(MS.stamp * 2.4), { fill: 'forwards' });
    s.remove();
  }));
}

// A Weather bracket reached: the chip pulses and names what it now does.
function weatherPulse(prev, next, t) {
  const before = new Set(activeBrackets(prev).map((b) => `${b.type} ${b.at}`));
  const now = activeBrackets(next).filter((b) => !before.has(`${b.type} ${b.at}`));
  const chip = $('.v4-wx');
  if (!now.length || !chip) return;
  animate(chip, [{ filter: 'none', transform: 'scale(1)' }, { filter: 'brightness(1.8)', transform: 'scale(1.06)' }, { filter: 'none', transform: 'scale(1)' }], t(MS.weatherPulse));
  floatText(chip, now.map((b) => `${b.type} ${b.at}: ${b.text}`).join(' · '), 'weather', t(MS.weatherPulse * 1.6));
}

// --- The queue -------------------------------------------------------------------------------------

// Shows one action, from prev to next, then leaves the next state drawn. Instant (or no page) draws at
// once. Never throws: a problem showing it still leaves the next state drawn.
export async function present(prev, next, draw) {
  const k = speedFactor();
  if (k <= 0 || typeof document === 'undefined') { draw(); return; }
  const t = (ms) => ms * k;
  const { steps, switchAt } = plan(prev, next, k);
  presenting = true;
  skipping = false;
  cause = null;
  ghosts = new Map();
  let drawn = false;
  const toNew = () => {
    if (drawn) return;
    // Pokémon defeated after the switch keep a ghost on the new board, so their defeat still plays.
    for (const st of steps.slice(switchAt)) {
      if (st.beat !== 'defeat') continue;
      const el = spaceEl(st.e.who, st.e.space)?.querySelector('.v4-mon');
      if (!el) continue;
      const r = rectOf(el);
      const g = el.cloneNode(true);
      g.classList.add('v4-ghostmon');
      Object.assign(g.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, inset: 'auto' });
      fx().appendChild(g);
      ghosts.set(`${st.e.who}:${st.e.space}`, g);
    }
    draw();
    drawn = true;
    weatherPulse(prev, next, t);
  };
  try {
    for (const [n, st] of steps.entries()) {
      if (skipping) break;
      if (n === switchAt) toNew();
      const fn = BEATS[st.beat];
      if (fn) await fn({ prev, next, e: st.e, i: st.i, t });
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (!drawn) toNew();
    finish();
  }
}

function finish() {
  presenting = false;
  skipping = false;
  for (const g of ghosts.values()) g.remove();
  ghosts = new Map();
  for (const el of document.querySelectorAll('.v4-reveal, .v4-flyer, .v4-region, .v4-strip, .v4-sweep, .v4-stadium, .v4-domglow')) el.remove();
}

// The effects layers on the stage: the WebGL canvas (unless ?nowebgl), the 2D fallback canvas, and the
// page-element layer. Click-to-skip: a click (or Space, Esc) while a beat plays skips to its end.
export async function setupPresenter(stage, { webgl = true } = {}) {
  const gl = document.createElement('canvas');
  gl.id = 'vfx';
  gl.width = 1920;
  gl.height = 1080;
  gl.hidden = true;
  const p2 = document.createElement('canvas');
  p2.id = 'particles';
  p2.width = 1920;
  p2.height = 1080;
  stage.append(gl, p2);
  fx();
  const swallow = (ev) => { if (!presenting) return; ev.stopPropagation(); ev.preventDefault(); skip(); };
  stage.addEventListener('pointerdown', swallow, true);
  stage.addEventListener('click', (ev) => { if (presenting) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  addEventListener('keydown', (ev) => { if (presenting && [' ', 'Escape', 'Enter'].includes(ev.key)) { ev.stopPropagation(); ev.preventDefault(); skip(); } }, true);
  let ok = false;
  if (webgl) { try { ok = await initVfx(gl); } catch (err) { console.warn('WebGL effects unavailable', err); ok = false; } }
  return { webgl: ok };
}

export function resetFx() {
  skip();
  finish();
  clearParticles();
  clearVfx();
  layer?.replaceChildren();
}

export { reducedMotion };
