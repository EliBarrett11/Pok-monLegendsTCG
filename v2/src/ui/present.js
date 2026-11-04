// v2's presenter (V8): plays an action's events back on screen, one beat after another,
// in the approved style (docs/vfx.md): the action itself on the board as it was, then
// the new state drawn, then arrivals on the new board.
//
//   before  attacks (with trades, keyword touches and lane-guard shields), Strategy Cards
//           (a bigger breakpoint plays bigger), damage numbers, statuses, healing,
//           defeats, Burn draining Recognition, Locations ending (or swept away by the
//           Championship), Supporters (Released cards burn away; Favour!), Items used,
//           Trainer Abilities;
//   after   summons by rarity (Legendary cinematics), Partners, Locations unfolding,
//           milestones and completions, the Championship's stadium, Recognition flying
//           to its panel, training (level-ups, evolution, Nurture), Trainers (tabs, points,
//           tier pips), Items found and bagged;
//   banners phases, the coin, sudden death and the end screen.
//
// Every event type has a handler (BEATS below; tests/vfx.test.js checks them against the
// engine's events and vfx/library.js EVENT_BEATS). Timings follow the speed setting
// (shared with the current game: Slow, Normal, Fast, Instant); a click skips to the end
// of the action being shown. Without WebGL the 2D particles stand in (particles.js) and
// every number, banner and card movement still plays (they're page elements).
import { vfxReady, playTimeline, skipTimelines, clearVfx, coins, rectOf } from './vfx/engine.js';
import { burst, clearParticles } from './particles.js';
import { speedFactor, readableMs } from '../../../src/ui/settings.js';
import { syncWeather, pulseWeather, clearWeather, BRACKETS } from '../../../src/ui/weather.js';
import {
  attackFor, counterFor, tintFor, strategyDef, strategyTintFor, strategyTypeOf, SWEEP_STRATEGIES, summonDef,
  defeatFor, STATUS_APPLIED, STATUS_CLEARED, BURN_TICK, HEAL, evolveFor, V2_TIMELINES, endingAnimation,
  composeAttack, composeCounter, tintOf, GROWTH_MOTES, weatherPulseText,
} from './vfx/library.js';
import { legalTargets, weatherTotals } from '../engine/game.js';
import { RECOGNITION_TARGET } from '../engine/rules.js';
import { rewardText } from '../engine/locations.js';
import { actionCard, artUrl } from './board.js';

// --- Timing and skipping ---------------------------------------------------------------------

let skipping = false;
const running = new Set();   // page animations still playing
const waiters = new Set();   // pauses still waiting
export const isSkipping = () => skipping;

// Skips to the end of the action being shown (the new state is still drawn).
export function skip() {
  skipping = true;
  skipTimelines();
  for (const a of running) a.finish();
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
  if (!el || ms <= 0 || skipping || !el.animate) return;
  const a = el.animate(frames, { duration: ms, easing: 'ease-in-out', ...options });
  running.add(a);
  try { await a.finished; } catch { /* cancelled */ } finally { running.delete(a); }
}

// A timeline from the library at this speed (rate: timeline ms per real ms). Without
// WebGL it resolves at once: the 2D fallback bursts instead, at the target.
function play(def, ctx, t) {
  if (skipping) return Promise.resolve();
  if (!vfxReady()) {
    const el = ctx.target ?? ctx.attacker;
    if (el?.isConnected) {
      const r = rectOf(el);
      burst(r.x + r.w / 2, r.y + r.h / 2, { kind: 'spark', colors: ctx.tint ?? ['#fff3c4'], count: 14 });
    }
    return Promise.resolve();
  }
  return playTimeline(def, { rate: 1 / t(1), ...ctx });
}

// --- The effects layer: numbers, banners, cards in flight -------------------------------------

let fx = null;
function fxEl() {
  if (fx?.isConnected) return fx;
  fx = document.createElement('div');
  fx.className = 'v2-fx';
  document.getElementById('stage').appendChild(fx);
  return fx;
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// A number or word rising off something (stays readable: own layer, above the board).
function floatText(el, text, kind, ms) {
  if (!el?.isConnected || skipping || ms <= 0) return;
  const r = rectOf(el);
  const n = document.createElement('div');
  n.className = `v2-float ${kind}`;
  n.textContent = text;
  n.style.left = `${r.x + r.w / 2}px`;
  n.style.top = `${r.y + r.h * 0.35}px`;
  fxEl().appendChild(n);
  const a = n.animate([
    { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
    { transform: 'translate(-50%, -18px) scale(1.15)', opacity: 1, offset: 0.15 },
    { transform: 'translate(-50%, -40px) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%, -64px) scale(1)', opacity: 0 },
  ], { duration: ms, easing: 'ease-out' });
  a.finished.then(() => n.remove(), () => n.remove());
}

// A banner across the middle of the board (phases, the Championship, completions).
async function banner(title, sub, t, { kind = '', hold = 700 } = {}) {
  if (skipping) return;
  const b = document.createElement('div');
  b.className = `v2-banner ${kind}`;
  b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  fxEl().appendChild(b);
  const show = readableMs(t(hold));
  await animate(b, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.85)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], t(220), { fill: 'forwards' });
  await wait(show);
  await animate(b, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.04)' }], t(220), { fill: 'forwards' });
  b.remove();
}

// A small card (or anything) flying between two places, in stage px.
async function fly(html, from, to, ms, { cls = '', end = {} } = {}) {
  if (!from || !to || skipping || ms <= 0) return;
  const el = document.createElement('div');
  el.className = `v2-flyer ${cls}`;
  el.innerHTML = html;
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  fxEl().appendChild(el);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  await animate(el, [
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1.05)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${end.scale ?? 0.6})`, opacity: end.opacity ?? 0.2, filter: end.filter ?? 'none' },
  ], ms, { easing: 'ease-in-out', fill: 'forwards' });
  el.remove();
}

// Motes (Growth, stars) from one place to another: the effects layer's flyers, or dots.
function motes(from, to, n, ms, color) {
  if (!from || !to || skipping || ms <= 0) return;
  if (coins(from, to, n, ms, null, { tex: 'glow', size: GROWTH_MOTES.size, color })) return;
  for (let i = 0; i < n; i++) {
    fly(`<i style="background:${color}"></i>`, from, to, ms + i * 40, { cls: 'mote', end: { scale: 0.5, opacity: 0.4 } });
  }
}

// --- Finding things on the board ----------------------------------------------------------

const $ = (root, sel) => root.querySelector(sel);
const spaceEl = (root, who, space) => $(root, `.v2-space[data-who="${who}"][data-space="${space}"]`);
const cardEl = (root, who, space) => spaceEl(root, who, space)?.querySelector('.v2-card') ?? null;
const panelEl = (root, who) => $(root, `.v2-recognition[data-player="${who}"]`);
const locEl = (root, uid) => $(root, `.v2-loc[data-loc-target="${uid}"]`);
const trainerEl = (root, uid) => $(root, `[data-trainer="${uid}"]`);
const growthEl = (root, who) => $(root, `.v2-row.${who === 'ai' ? 'opponent' : 'player'} .v2-growth`) ?? panelEl(root, who);
const handCard = (root, uid) => $(root, `.v2-hand [data-uid="${uid}"]`);
const bagEl = (root, who) => (who === 'player' ? $(root, '.v2-bag') : $(root, '.v2-opp-hand'));
const tpEl = (root) => $(root, '.v2-tp');
const releasedEl = (root) => $(root, '.v2-piles span:nth-child(3)');
const drawEl = (root) => $(root, '.v2-piles span:nth-child(1)');
const boardEl = (root) => $(root, '.v2-board');
const sideOf = (root, who) => $(root, `.v2-row.${who === 'ai' ? 'opponent' : 'player'}`);
const pointOf = (el) => (el?.isConnected ? centre(rectOf(el)) : null);
const foeOf = (who) => (who === 'player' ? 'ai' : 'player');
const NAME = { player: 'You', ai: 'Opponent' };

// Where a card in someone's hand comes from: the fanned hand, or the opponent's backs.
function fromHand(root, who, uid) {
  const el = who === 'player' ? handCard(root, uid) : $(root, '.v2-opp-hand');
  return pointOf(el) ?? { x: 940, y: who === 'player' ? 1000 : 60 };
}

// --- Before the new state is drawn: the action itself -------------------------------------------

// Events a bigger beat has already shown (a Strategy Card's damage, a Supporter's Released
// cards), so the walk doesn't show them again.
let consumed = new WeakSet();
const take = (e) => { consumed.add(e); return e; };
// What defeated the Pokémon being shown (a Type, 'burn' or 'leechSeed').
let cause = null;

// A card on its way to the middle of the board (a Strategy Card or Supporter), face up.
async function reveal(root, who, card, t) {
  const el = document.createElement('div');
  el.className = 'v2-reveal';
  el.innerHTML = actionCard(card, {});
  const from = fromHand(root, who, card.uid);
  const to = { x: 940, y: who === 'player' ? 640 : 380 };
  el.style.left = `${to.x}px`;
  el.style.top = `${to.y}px`;
  fxEl().appendChild(el);
  await animate(el, [
    { transform: `translate(calc(-50% + ${from.x - to.x}px), calc(-50% + ${from.y - to.y}px)) scale(0.45)`, opacity: 0.4 },
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
  ], t(320), { easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
  return el;
}

async function strategyBeat(root, prev, next, e, t) {
  const card = [...prev.players[e.who].hand].find((c) => c.uid === e.uid) ?? { id: '', name: e.name, cardType: 'Strategy', breakpoints: [] };
  const ev = next.events;
  const start = ev.indexOf(e);
  const stopAt = ev.findIndex((x, j) => j > start && ['strategy', 'attack', 'supporter', 'phaseChanged', 'summoned'].includes(x.type));
  const mine = ev.slice(start + 1, stopAt < 0 ? ev.length : stopAt);
  const el = await reveal(root, e.who, card, t);
  if (skipping) { el.remove(); return; }
  const tag = document.createElement('div');
  tag.className = 'v2-reveal-tag';
  tag.innerHTML = `<b>${NAME[e.who]}: ${esc(e.name)}</b><span>${e.levels > 1 ? `Breakpoint ${e.pay} · ` : ''}${esc(e.text)}</span>`;
  el.appendChild(tag);
  const foe = foeOf(e.who);
  const damage = mine.filter((x) => x.type === 'effectDamage');
  const burns = mine.filter((x) => x.type === 'burned');
  const heals = mine.filter((x) => x.type === 'healed');
  const statuses = mine.filter((x) => x.type === 'asleep' || x.type === 'seeded');
  const pcHits = mine.filter((x) => x.type === 'recognition' && x.who === e.who && x.source === 'effect');
  const growths = mine.filter((x) => x.type === 'growth' && x.who === e.who);
  const spent = mine.filter((x) => x.type === 'growthSpent');
  const elOf = (x) => (x.kind === 'player' ? panelEl(root, x.who) : cardEl(root, x.who, x.space));
  const first = [...damage, ...burns, ...heals, ...statuses].map(elOf).find(Boolean) ?? (pcHits.length ? panelEl(root, foe) : null);
  const id = strategyDef(card, e.level);
  cause = strategyTypeOf(card);
  const shown = new Set();
  const hit = (x) => {
    if (shown.has(x)) return;
    shown.add(take(x));
    const target = elOf(x);
    if (x.type === 'effectDamage') floatText(target, `−${x.amount}`, 'damage', t(1100));
    else if (x.type === 'burned') floatText(target, `Burn +${x.amount}`, 'burn', t(1100));
    else if (x.type === 'healed') floatText(target, `+${x.amount}`, 'heal', t(1100));
    else if (x.type === 'asleep') floatText(target, 'Asleep', 'status', t(1100));
    else if (x.type === 'seeded') floatText(target, 'Leech Seed', 'status', t(1100));
  };
  const sweeps = SWEEP_STRATEGIES.includes(id.id.split('@')[0]);
  const sweepList = [
    ...[...damage, ...burns].filter((x) => x.who === foe).map((x) => ({ x, side: 'enemy' })),
    ...heals.filter((x) => x.who === e.who).map((x) => ({ x, side: 'friend' })),
  ].map((h) => ({ ...h, el: elOf(h.x) })).filter((h) => h.el);
  await play(id, {
    attacker: el, target: first ?? el, damage: damage[0]?.amount ?? pcHits[0]?.amount ?? 2,
    tint: strategyTintFor(card), fire: strategyTypeOf(card) === 'Fire', scorch: burns.length > 0, full: e.level > 0,
    region: boardEl(root), casterBelow: e.who === 'player', sweepTargets: sweeps ? sweepList : [],
    pile: drawEl(root),
    on: {
      dissolve: () => animate(el, [{ opacity: 1 }, { opacity: 0, filter: 'brightness(2.2) blur(2px)', transform: 'translate(-50%, -50%) scale(1.12)' }], t(260), { fill: 'forwards' }),
      impact: () => [...damage, ...burns].forEach(hit),
      catch: () => burns.forEach(hit),
      scorchCatch: () => burns.forEach(hit),
      heal: () => heals.forEach(hit),
      seed: () => statuses.forEach(hit),
      sleep: () => statuses.forEach(hit),
      sweepHit: ({ index }) => { const h = sweepList[index]; if (h) [...damage, ...burns, ...heals].filter((x) => x.who === h.x.who && x.space === h.x.space).forEach(hit); },
      growth: () => growths.forEach((x) => { take(x); motes(pointOf(el), pointOf(growthEl(root, x.who)), GROWTH_MOTES.count(x.amount), t(GROWTH_MOTES.ms), GROWTH_MOTES.color); }),
      charge: () => spent.forEach((x) => { take(x); motes(pointOf(growthEl(root, x.who)), pointOf(el), GROWTH_MOTES.count(x.amount), t(GROWTH_MOTES.ms), GROWTH_MOTES.color); floatText(growthEl(root, x.who), `−${x.amount} Growth`, 'growth', t(1000)); }),
    },
  }, t);
  // Whatever the cues didn't reach (no WebGL, or skipped): its numbers still show.
  [...damage, ...burns, ...heals, ...statuses].forEach(hit);
  for (const x of pcHits) { take(x); floatText(panelEl(root, foe), `−${x.amount}`, 'damage', t(1100)); }
  if (!skipping) await wait(t(120));
  el.remove();
}

async function attackBeat(root, prev, next, e, t) {
  const p = prev.players[e.who];
  const card = p.row[e.from];
  const a = cardEl(root, e.who, e.from);
  if (!card || !a) return;
  const foe = foeOf(e.who);
  const toPlayer = e.target.kind === 'player';
  const defCard = toPlayer ? null : prev.players[foe].row[e.target.space];
  const b = toPlayer ? panelEl(root, foe) : cardEl(root, foe, e.target.space);
  cause = card.type;
  // Lane guards: a matching guard across stopped an attack on the player: its shield flashes.
  const across = cardEl(root, foe, e.from);
  const blocked = !toPlayer && across && !legalTargets(prev, e.who, e.from).some((x) => x.kind === 'player');
  a.classList.add('fx-attacker');
  if (blocked) await play(V2_TIMELINES['v2-guard-block'], { target: across, tint: ['#ffffff', '#bfe4ff'] }, t).then(() => floatText(across, 'Guarded', 'status', t(900)));
  const ev = next.events;
  const i = ev.indexOf(e);
  const overrun = ev.slice(i + 1).find((x) => x.type === 'recognition' && x.source === 'overrun' && x.who === e.who);
  const scorch = ev.slice(i + 1, i + 4).find((x) => x.type === 'burned' && x.by === e.who);
  const keys = card.keywords ?? [];
  const def = composeAttack(attackFor(card), {
    trade: Boolean(e.trades && e.back > 0), shell: (defCard?.keywords ?? []).some((k) => k.startsWith('Shell')),
    infiltrator: keys.includes('Infiltrator') && !toPlayer, overrun: Boolean(overrun),
  });
  const counter = e.trades && e.back > 0 && defCard ? composeCounter(counterFor(defCard), { shell: keys.some((k) => k.startsWith('Shell')) }) : null;
  let numbers = false;
  const showNumbers = () => {
    if (numbers) return;
    numbers = true;
    floatText(b, `−${e.amount}`, toPlayer ? 'recognition-hit' : 'damage', t(1100));
    if (e.back) floatText(a, `−${e.back}`, 'damage', t(1100));
    if (e.retaliated) floatText(a, `Retaliate −${e.retaliated}`, 'damage', t(1100));
  };
  await play(def, {
    attacker: a, target: b, damage: e.amount, tint: tintFor(card), fire: card.type === 'Fire', scorch: Boolean(scorch),
    arc: keys.includes('Infiltrator'), guard: blocked ? across : null, overrunTarget: overrun ? panelEl(root, foe) : null,
    on: {
      impact: showNumbers,
      trade: () => { if (counter && b) play(counter, { attacker: b, target: a, damage: e.back, tint: tintFor(defCard) }, t); },
      scorch: () => { if (scorch) floatText(b, `Burn +${scorch.amount}`, 'burn', t(1000)); },
    },
  }, t);
  showNumbers();
  if (scorch) take(scorch);
  a.classList.remove('fx-attacker');
}

async function damageBeat(root, prev, e, t) {
  const el = cardEl(root, e.who, e.space);
  const card = prev.players[e.who].row[e.space];
  if (!el) return false;
  // At Supper the damage is Burn or Leech Seed draining.
  if (prev.phase === 'battle' && (card?.burn || card?.seededBy) && cause === 'supper') {
    await play(card.burn ? BURN_TICK : V2_TIMELINES['v2-effect-hit'], { target: el, damage: e.amount, tint: card.burn ? tintOf('Fire') : tintOf('Grass') }, t);
    cause = card.burn ? 'burn' : 'leechSeed';
  } else await play(V2_TIMELINES['v2-effect-hit'], { target: el, damage: e.amount, tint: tintOf(cause && cause !== 'supper' ? cause : 'Normal') }, t);
  floatText(el, `−${e.amount}`, 'damage', t(1100));
  return true;
}

async function defeatBeat(root, prev, e, t) {
  const el = cardEl(root, e.who, e.space);
  if (!el) return false;
  const id = defeatFor(cause === 'supper' ? 'burn' : cause);
  floatText(el, 'Defeated', 'defeat', t(1000));
  await play(id, { target: el, tint: tintOf(prev.players[e.who].row[e.space]?.type) }, t);
  await animate(el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.9)' }], t(200), { fill: 'forwards' });
  // The pieces drift to the Released Pile (the player's own; the opponent's off the top).
  fly(`<i class="ash"></i>`, pointOf(el), pointOf(releasedEl(root)) ?? { x: 1700, y: e.who === 'ai' ? 40 : 1040 }, t(500), { cls: 'mote', end: { scale: 0.3, opacity: 0 } });
  return true;
}

async function statusBeat(root, e, t) {
  const el = e.kind === 'player' ? panelEl(root, e.who) : cardEl(root, e.who, e.space);
  if (!el) return false;
  const id = STATUS_APPLIED[e.type];
  const text = { burned: `Burn +${e.amount}`, asleep: 'Asleep', seeded: 'Leech Seed' }[e.type];
  floatText(el, text, e.type === 'burned' ? 'burn' : 'status', t(1100));
  await play(id, { target: el, tint: e.type === 'burned' ? tintOf('Fire') : tintOf('Grass') }, t);
  return true;
}

async function supporterBeat(root, prev, next, e, t) {
  const card = prev.players[e.who].hand.find((c) => c.uid === e.uid) ?? { name: e.name, cardType: 'Supporter' };
  const ev = next.events;
  const start = ev.indexOf(e);
  const released = ev.slice(Math.max(0, start - e.released.length - 2), start).concat(ev.slice(start + 1))
    .filter((x) => x.type === 'released' && x.who === e.who);
  const el = await reveal(root, e.who, card, t);
  if (skipping) { el.remove(); return; }
  const tag = document.createElement('div');
  tag.className = 'v2-reveal-tag';
  tag.innerHTML = `<b>${NAME[e.who]}: ${esc(e.name)}</b><span>Released: ${esc(e.released.join(', ') || 'none')}</span>`;
  el.appendChild(tag);
  const pile = pointOf(releasedEl(root)) ?? { x: 1700, y: e.who === 'ai' ? 40 : 1040 };
  // The Released cards burn away into the Released Pile.
  const burns = released.filter((x) => x.uid !== e.uid).map((x) => {
    take(x);
    const c = prev.players[e.who].hand.find((h) => h.uid === x.uid);
    return fly(c ? `<div class="mini" style="background-image:url('${artUrl(c.art !== undefined || c.cardType !== 'Pokémon' ? c : { ...c, art: c.art ?? c.id })}')"></div>` : '<div class="mini"></div>',
      fromHand(root, e.who, x.uid), pile, t(700), { cls: 'burning', end: { scale: 0.4, opacity: 0, filter: 'sepia(1) brightness(0.3)' } });
  });
  await play('supporter-moment', {
    target: el, tint: ['#ffd36b', '#fff6c8'], when: { gift: Boolean(e.favour) },
    on: { gift: () => { if (e.favour) favourFlourish(el, t); } },
  }, t);
  await Promise.all(burns);
  if (e.favour) favourFlourish(el, t);
  // The Supporter itself is Released too.
  const self = released.find((x) => x.uid === e.uid);
  if (self) take(self);
  await fly('<div class="mini sup"></div>', pointOf(el), pile, t(500), { cls: 'burning', end: { scale: 0.3, opacity: 0, filter: 'sepia(1) brightness(0.3)' } });
  el.remove();
}

let favourShown = null;
function favourFlourish(el, t) {
  if (favourShown === el) return;
  favourShown = el;
  const f = document.createElement('div');
  f.className = 'v2-favour';
  f.textContent = 'Favour!';
  el.appendChild(f);
  animate(f, [{ opacity: 0, transform: 'translate(-50%, 0) scale(0.5)' }, { opacity: 1, transform: 'translate(-50%, -20px) scale(1.2)', offset: 0.3 }, { opacity: 1, transform: 'translate(-50%, -30px) scale(1)' }], t(900), { fill: 'forwards' });
}

async function locationGoneBeat(root, e, t, champ) {
  const el = locEl(root, e.uid);
  if (!el) return;
  if (champ) {
    // Swept away by the Championship: it slides off the board.
    await animate(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-60px) scale(0.92)', filter: 'blur(2px)' }], t(500), { fill: 'forwards' });
    return;
  }
  floatText(el.querySelector('.v2-loc-banner') ?? el, `${e.name} ends`, 'status', t(1000));
  play(V2_TIMELINES['v2-location-end'], { target: el.querySelector('.v2-loc-banner') ?? el }, t);
  await animate(el, [{ opacity: 1, filter: 'none' }, { opacity: 0, filter: 'grayscale(1) brightness(0.6)' }], t(650), { fill: 'forwards' });
}

async function recognitionDrain(root, prev, next, e, t, kind) {
  const el = panelEl(root, e.who);
  if (!el) return;
  floatText(el, `−${e.amount}`, 'recognition-loss', t(1200));
  const bar = el.querySelector('.v2-bar i');
  const pct = (n) => `${Math.min(100, (100 * n) / RECOGNITION_TARGET)}%`;
  const was = prev.players[e.who].recognition;
  const score = el.querySelector('.v2-score');
  if (score) score.textContent = String(e.total);
  await Promise.all([
    play(V2_TIMELINES['v2-recognition-loss'], { target: el, tint: tintOf('Fire') }, t),
    animate(bar, [{ width: pct(was) }, { width: pct(e.total) }], t(kind === 'burn' ? 700 : 500), { fill: 'forwards' }),
  ]);
}

// The before beats, in order. Each returns false when its element isn't on the board yet
// (e.g. damage to a Pokémon summoned by this same action): that event is shown after.
const BEFORE = {
  attack: (c) => attackBeat(c.root, c.prev, c.next, c.e, c.t),
  strategy: (c) => strategyBeat(c.root, c.prev, c.next, c.e, c.t),
  supporter: (c) => supporterBeat(c.root, c.prev, c.next, c.e, c.t),
  effectDamage: (c) => damageBeat(c.root, c.prev, c.e, c.t),
  defeated: (c) => defeatBeat(c.root, c.prev, c.e, c.t),
  burned: (c) => statusBeat(c.root, c.e, c.t),
  asleep: (c) => statusBeat(c.root, c.e, c.t),
  seeded: (c) => statusBeat(c.root, c.e, c.t),
  cured: async ({ root, e, t }) => {
    const el = e.kind === 'player' ? panelEl(root, e.who) : cardEl(root, e.who, e.space);
    if (!el) return false;
    floatText(el, 'Cured', 'heal', t(1000));
    await play(STATUS_CLEARED, { target: el, tint: tintOf('Water') }, t);
    return true;
  },
  healed: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return false;
    floatText(el, `+${e.amount}`, 'heal', t(1000));
    await play(HEAL, { target: el, tint: tintOf('Grass') }, t);
    return true;
  },
  grew: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return false;
    floatText(el, [e.attack && `+${e.attack} Attack`, e.strength && `+${e.strength} Strength`].filter(Boolean).join(' ') || 'Grew', 'heal', t(1000));
    await play(V2_TIMELINES['v2-buff'], { target: el }, t);
    return true;
  },
  rage: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return false;
    floatText(el, 'Rage +1', 'burn', t(900));
    await play(V2_TIMELINES['v2-buff'], { target: el, tint: tintOf('Fighting') }, t);
    return true;
  },
  readied: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return false;
    floatText(el, 'Active', 'status', t(800));
    await animate(el, [{ transform: 'none' }, { transform: 'translateY(-8px)' }, { transform: 'none' }], t(320));
    return true;
  },
  moved: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.from);
    const to = spaceEl(root, e.who, e.to);
    if (!el || !to) return false;
    const a = rectOf(el);
    const b = rectOf(to);
    await animate(el, [{ transform: 'none' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)` }], t(420), { fill: 'forwards' });
    return true;
  },
  growthSpent: async ({ root, e, t }) => {
    floatText(growthEl(root, e.who), `−${e.amount} Growth`, 'growth', t(900));
    return true;
  },
  burnRecognition: (c) => recognitionDrain(c.root, c.prev, c.next, c.e, c.t, 'burn'),
  recognitionLost: (c) => recognitionDrain(c.root, c.prev, c.next, c.e, c.t, 'loss'),
  locationEnded: (c) => locationGoneBeat(c.root, c.e, c.t, c.e.why === 'championship'),
  released: async ({ root, prev, e, t }) => {
    const c = prev.players[e.who].hand.find((h) => h.uid === e.uid);
    await fly(`<div class="mini"${c ? ` style="background-image:url('${artUrl(c.cardType === 'Pokémon' ? { ...c, art: c.art ?? c.id } : c)}')"` : ''}></div>`,
      fromHand(root, e.who, e.uid), pointOf(releasedEl(root)) ?? { x: 1700, y: 1040 }, t(600), { cls: 'burning', end: { scale: 0.4, opacity: 0, filter: 'sepia(1) brightness(0.3)' } });
    return true;
  },
  abilityUsed: async ({ root, e, t }) => {
    const el = trainerEl(root, e.uid);
    if (!el) return false;
    floatText(el, `${e.name}: Ability`, 'trainer', t(1200));
    await play(V2_TIMELINES['v2-ability'], { target: el, tint: ['#ffd36b', '#fff6c8'] }, t);
    return true;
  },
  ability: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return false;
    const label = { onSummon: 'On Summon', onEvolve: 'On Evolve', onAttack: 'On Attack', onDefend: 'On Defend', onKnockout: 'On Knockout', onDefeated: 'On Defeated', onBreakfast: 'On Breakfast', onHeal: 'On Heal', rally: 'Rally' }[e.trigger] ?? 'Ability';
    floatText(el, label, 'trainer', t(900));
    return true;
  },
  itemUsed: async ({ root, e, t }) => {
    const el = bagEl(root, e.who) ?? panelEl(root, e.who);
    floatText(el, e.name, 'trainer', t(1000));
    await play(V2_TIMELINES['v2-item-used'], { target: el }, t);
    return true;
  },
  itemStolen: async ({ root, e, t }) => {
    await fly('<div class="mini item"></div>', pointOf(bagEl(root, foeOf(e.who))), pointOf(bagEl(root, e.who)), t(600));
    floatText(bagEl(root, e.who), `${e.name} taken`, 'trainer', t(1000));
    return true;
  },
  pass: async ({ root, e, t }) => { floatText(panelEl(root, e.who), e.endsPhase ? 'Pass · Battle over' : 'Pass', 'status', t(900)); return true; },
  searched: async ({ root, e, t }) => { if (e.who === 'player') floatText(drawEl(root), `Searched ${e.count}`, 'status', t(800)); return true; },
  shuffled: async ({ root, e, t }) => { if (e.who === 'player') await animate(drawEl(root), [{ transform: 'none' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'none' }], t(300)); return true; },
};

// --- After the new state is drawn: arrivals ---------------------------------------------------

async function summonBeat(root, next, e, t) {
  const el = cardEl(root, e.who, e.space);
  const card = next.players[e.who].row[e.space];
  if (!el || !card) return;
  const legendary = card.rarity === 'Legendary';
  if (legendary) banner(card.name, 'Legendary', t, { kind: 'legend', hold: 900 });
  if (e.empowered) floatText(el, 'Empowered!', 'trainer', t(1100));
  await play(summonDef(card), { target: el, tint: tintFor(card), fire: card.type === 'Fire' }, t);
}

async function recognitionBeat(root, prev, next, e, t, from) {
  const el = panelEl(root, e.who);
  if (!el) return;
  const start = from ?? { x: 940, y: e.who === 'player' ? 640 : 380 };
  const to = pointOf(el);
  const label = { attack: '', overrun: 'Overrun ', effect: '', location: '', championship: 'Championship ', other: '' }[e.source] ?? '';
  // The number flies to the panel, then the meter fills.
  const n = document.createElement('div');
  n.className = 'v2-float recognition';
  n.textContent = `${label}+${e.amount}`;
  n.style.left = `${start.x}px`;
  n.style.top = `${start.y}px`;
  fxEl().appendChild(n);
  await animate(n, [
    { transform: 'translate(-50%, -50%) scale(0.7)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.2 },
    { transform: `translate(calc(-50% + ${to.x - start.x}px), calc(-50% + ${to.y - start.y}px)) scale(0.8)`, opacity: 0.9 },
  ], t(650), { easing: 'ease-in', fill: 'forwards' });
  n.remove();
  const bar = el.querySelector('.v2-bar i');
  const pct = (x) => `${Math.min(100, (100 * x) / RECOGNITION_TARGET)}%`;
  const before = e.total - e.amount;
  play(V2_TIMELINES['v2-recognition'], { target: el, tint: ['#ffd36b', '#fff6c8'] }, t);
  await animate(bar, [{ width: pct(before) }, { width: pct(e.total) }], t(500), { easing: 'ease-out' });
}

// Where a Recognition gain comes from, on the new board.
function recognitionSource(root, next, e, i) {
  const ev = next.events;
  if (e.source === 'location' || e.source === 'championship') {
    const m = [...ev.slice(0, i)].reverse().find((x) => (x.type === 'milestone' || x.type === 'completed') && x.who === e.who);
    const loc = m && (locEl(root, m.location) ?? $(root, '.v2-loc.champ'));
    return pointOf(loc?.querySelector('.v2-loc-banner') ?? loc);
  }
  if (e.source === 'attack' || e.source === 'overrun') return pointOf(panelEl(root, foeOf(e.who)));
  return null;
}

async function locationPlacedBeat(root, e, t) {
  const el = locEl(root, e.uid);
  if (!el) return;
  floatText(el.querySelector('.v2-loc-banner') ?? el, `${NAME[e.who]}: ${e.name}`, 'trainer', t(1200));
  await Promise.all([
    animate(el, [{ clipPath: 'inset(0 50% 0 50%)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], t(700), { easing: 'cubic-bezier(.2,.9,.3,1)' }),
    play(V2_TIMELINES['v2-location-place'], { target: el.querySelector('.v2-loc-banner') ?? el, tint: ['#ffd36b', '#fff6c8'] }, t),
  ]);
}

async function milestoneBeat(root, e, t, complete) {
  const el = locEl(root, e.location) ?? (e.championship ? $(root, '.v2-loc.champ') : null);
  if (!el) return;
  const bannerEl = el.querySelector('.v2-loc-banner') ?? el;
  const prog = el.querySelector(`.v2-prog.${e.who}`);
  const tick = complete ? null : [...(prog?.querySelectorAll('.tick') ?? [])].find((x) => Number.parseFloat(x.style.left) === (100 * e.at) / e.count);
  const reward = rewardText(complete ? e.reward : e.reward) || '';
  if (complete) {
    const b = document.createElement('div');
    b.className = 'v2-complete';
    b.innerHTML = `<b>Completed!</b><span>${NAME[e.who]} · ${esc(reward)}</span>`;
    bannerEl.appendChild(b);
    await Promise.all([
      play(V2_TIMELINES['v2-completion'], { target: bannerEl, tint: ['#ffd36b', '#fff6c8'] }, t),
      animate(b, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.1)', offset: 0.25 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], readableMs(t(1300)), { fill: 'forwards' }),
    ]);
    b.remove();
    return;
  }
  if (tick) animate(tick, [{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(2.2)', background: '#ffe08a' }, { transform: 'translateX(-50%) scale(1)' }], t(600));
  floatText(prog ?? bannerEl, `Milestone ${e.at}: ${reward}`, 'milestone', t(1300));
  await play(V2_TIMELINES['v2-milestone'], { target: prog ?? bannerEl, tint: ['#ffd36b', '#fff6c8'] }, t);
}

async function championshipBeat(root, e, t) {
  const el = $(root, '.v2-loc.champ');
  if (!el) return;
  const t2 = (ms) => Math.max(t(ms), ms * 0.9);   // a big moment: readable even at Fast
  await Promise.all([
    animate(el, [{ clipPath: 'inset(0 50% 0 50%)', opacity: 0, filter: 'brightness(2)' }, { clipPath: 'inset(0 0 0 0)', opacity: 1, filter: 'brightness(1)' }], t2(900), { easing: 'cubic-bezier(.2,.9,.3,1)' }),
    play(V2_TIMELINES['v2-championship'], { target: el.querySelector('.v2-loc-banner') ?? el, tint: ['#ffd36b', '#fff6c8'] }, t),
    banner('The Championship', 'Every lane · the biggest rewards · to the end of Round 12', t2, { kind: 'champ', hold: 1400 }),
  ]);
}

async function trainedBeat(root, next, e, t) {
  const el = cardEl(root, e.who, e.space);
  const card = next.players[e.who].row[e.space];
  if (!el || !card) return;
  floatText(el, e.evolved ? `${e.fromName} → ${e.name}` : `Level ${e.to}`, 'level', t(1300));
  await play(e.evolved ? evolveFor(card) : V2_TIMELINES['v2-level-up'], { target: el, tint: tintFor(card) }, t);
}

async function trainerTabBeat(root, e, t, kind) {
  const el = trainerEl(root, e.uid);
  if (!el) return;
  if (kind === 'played') {
    floatText(el, `${NAME[e.who]}: ${e.name}`, 'trainer', t(1100));
    await Promise.all([
      animate(el, [{ transform: `translateY(${e.who === 'ai' ? -40 : 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], t(420), { easing: 'cubic-bezier(.2,.9,.3,1)' }),
      play(V2_TIMELINES['v2-trainer-attach'], { target: el }, t),
    ]);
  } else {
    await animate(el, [{ transform: 'translateX(0)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], t(380));
  }
}

const AFTER = {
  summoned: (c) => summonBeat(c.root, c.next, c.e, c.t),
  partnerArrived: async ({ root, next, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    if (!el) return;
    banner(`${e.trainer}'s Partner`, e.name, t, { kind: 'partner', hold: 800 });
    await play(V2_TIMELINES['v2-partner'], { target: el, tint: tintFor(next.players[e.who].row[e.space]) }, t);
  },
  partnerWaiting: async ({ root, e, t }) => { floatText(panelEl(root, e.who), `${e.name} is waiting for a space`, 'trainer', t(1100)); },
  locationPlaced: (c) => locationPlacedBeat(c.root, c.e, c.t),
  progress: async ({ root, e, t }) => {
    const bar = locEl(root, e.location)?.querySelector(`.v2-prog.${e.who} .v2-prog-bar b`);
    if (bar) await animate(bar, [{ filter: 'brightness(2.2)' }, { filter: 'none' }], t(450));
  },
  milestone: (c) => milestoneBeat(c.root, c.e, c.t, false),
  completed: (c) => milestoneBeat(c.root, c.e, c.t, true),
  championship: (c) => championshipBeat(c.root, c.e, c.t),
  recognition: (c) => recognitionBeat(c.root, c.prev, c.next, c.e, c.t, recognitionSource(c.root, c.next, c.e, c.i)),
  trained: (c) => trainedBeat(c.root, c.next, c.e, c.t),
  levelUp: async ({ root, e, t }) => {
    const el = e.who === 'player' ? handCard(root, e.uid) : null;
    if (!el) return;
    floatText(el, `Lv ${e.level} · ${e.to}`, 'level', t(1100));
    await animate(el, [{ filter: 'brightness(1)', transform: 'translateY(0)' }, { filter: 'brightness(1.8) drop-shadow(0 0 14px #ffe08a)', transform: 'translateY(-14px)' }, { filter: 'brightness(1)', transform: 'translateY(0)' }], t(650));
  },
  nurtured: async ({ root, e, t }) => {
    const el = cardEl(root, e.who, e.space);
    motes(pointOf(growthEl(root, e.who)), pointOf(el), GROWTH_MOTES.count(e.cost || 1), t(GROWTH_MOTES.ms), GROWTH_MOTES.color);
    floatText(el, `Nurture −${e.cost} Growth`, 'growth', t(1000));
    await wait(t(GROWTH_MOTES.ms));
  },
  growth: async ({ root, e, t }) => {
    const tree = growthEl(root, e.who);
    motes({ x: 940, y: e.who === 'player' ? 640 : 380 }, pointOf(tree), GROWTH_MOTES.count(e.amount), t(GROWTH_MOTES.ms), GROWTH_MOTES.color);
    floatText(tree, `+${e.amount} Growth`, 'growth', t(1000));
    play(V2_TIMELINES['v2-growth'], { target: tree, tint: tintOf('Grass') }, t);
  },
  trainerPlayed: (c) => trainerTabBeat(c.root, c.e, c.t, 'played'),
  trainerMoved: (c) => trainerTabBeat(c.root, c.e, c.t, 'moved'),
  trainerPoints: async ({ root, e, t }) => {
    const el = e.who === 'player' ? tpEl(root) : panelEl(root, e.who);
    floatText(el, `+${e.amount} Trainer Point${e.amount === 1 ? '' : 's'}`, 'trainer', t(1100));
    play(V2_TIMELINES['v2-points'], { target: el }, t);
  },
  pointsAssigned: async ({ root, e, t }) => {
    const el = trainerEl(root, e.uid);
    if (!el) return;
    motes(pointOf(e.who === 'player' ? tpEl(root) : panelEl(root, e.who)), pointOf(el), Math.min(6, 2 * e.amount), t(600), '#ffe08a');
    floatText(el, `+${e.amount} ★`, 'trainer', t(1000));
    await play(V2_TIMELINES['v2-points'], { target: el }, t);
  },
  tierUnlocked: async ({ root, e, t }) => {
    const el = trainerEl(root, e.uid);
    if (!el) return;
    const pip = el.querySelectorAll('.v2-pips i')[e.tier - 1];
    floatText(el, `${e.name}: ${e.kind} unlocked`, 'trainer', t(1300));
    await Promise.all([
      animate(pip, [{ transform: 'scale(1)', filter: 'none' }, { transform: 'scale(1.8)', filter: 'brightness(2) drop-shadow(0 0 8px #ffe08a)' }, { transform: 'scale(1)', filter: 'none' }], t(700)),
      play(V2_TIMELINES['v2-tier-unlock'], { target: pip ?? el }, t),
    ]);
  },
  assignLocked: async ({ root, e, t }) => { if (e.who === 'player') floatText(tpEl(root), 'Locked in', 'status', t(800)); },
  itemFound: async ({ root, next, e, t, i }) => {
    const ev = next.events;
    const m = [...ev.slice(0, i)].reverse().find((x) => (x.type === 'milestone' || x.type === 'completed') && x.who === e.who);
    const loc = m && (locEl(root, m.location) ?? $(root, '.v2-loc.champ'));
    const from = pointOf(loc?.querySelector('.v2-loc-banner') ?? loc) ?? { x: 940, y: 510 };
    const item = next.players[e.who].bag.find((c) => c.uid === e.uid);
    floatText(loc?.querySelector('.v2-loc-banner') ?? panelEl(root, e.who), `Found ${e.name}`, 'trainer', t(1100));
    await fly(`<div class="mini item" style="background-image:url('${item ? artUrl(item) : ''}')"></div>`, from, pointOf(bagEl(root, e.who)), t(650), { end: { scale: 0.5, opacity: 0.6 } });
    play(V2_TIMELINES['v2-item-found'], { target: bagEl(root, e.who) }, t);
  },
  bagged: async ({ root, next, e, t }) => {
    const item = next.players[e.who].bag.find((c) => c.uid === e.uid);
    await fly(`<div class="mini item" style="background-image:url('${item ? artUrl(item) : ''}')"></div>`, { x: 940, y: e.who === 'player' ? 900 : 120 }, pointOf(bagEl(root, e.who)), t(550));
  },
  choiceWaiting: async ({ root, t }) => { const el = $(root, '.v2-act'); if (el) await animate(el, [{ filter: 'none' }, { filter: 'brightness(1.6)' }, { filter: 'none' }], t(500)); },
};

// --- Banners -------------------------------------------------------------------------------

const BANNERS = {
  coinFlip: ({ e, t }) => banner(`${e.winner === 'player' ? 'You have' : 'The Opponent has'} initiative`, 'The coin is flipped', t, { hold: 700 }),
  phaseChanged: ({ e, t, next }) => {
    if (e.phase === 'breakfast') return banner(`Round ${e.round}`, 'Breakfast · Energy, cards and Weather', t, { kind: 'phase', hold: 450 });
    if (e.phase === 'supper') return banner('Supper', 'Burn, Leech Seed and Locations', t, { kind: 'phase small', hold: 300 });
    if (e.phase === 'assign') return banner('Trainer Points', 'Assign them to your Trainers', t, { kind: 'phase small', hold: 300 });
    return banner('Battle', 'Take turns: one Action each', t, { kind: 'phase small', hold: 250 });
  },
  turnChanged: async ({ root, e, t }) => { const el = panelEl(root, e.who); if (el) await animate(el, [{ filter: 'none' }, { filter: 'brightness(1.35)' }, { filter: 'none' }], t(300)); },
  suddenDeath: ({ t }) => banner('Sudden death', 'One more Round: the highest Recognition wins', t, { kind: 'champ', hold: 900 }),
  gameOver: (c) => endingBeat(c.root, c.next, c.t),
};

async function endingBeat(root, next, t) {
  const crest = $(root, '.v2-crest');
  if (!crest || !next.winner) return;
  const mine = next.players.player.plan ?? 'fire';
  const { id, style } = endingAnimation({ result: next.winner === 'player' ? 'victory' : 'defeat', deck: { player: mine } });
  await animate(crest, next.winner === 'player'
    ? [{ transform: 'translateY(-80px) scale(1.4)', opacity: 0 }, { transform: 'none', opacity: 1 }]
    : [{ transform: 'translateY(0)', opacity: 0 }, { transform: 'translateY(10px)', opacity: 1 }], t(700), { easing: 'cubic-bezier(.2,1.5,.4,1)' });
  play(id, { target: crest, tint: ['#ffd36b', '#fff6c8'], when: { fire: style === 'fire', water: style === 'water', grass: style === 'grass' } }, (ms) => ms);
}

// Every engine event type's handler (tests/vfx.test.js checks the list).
export const BEATS = { ...BEFORE, ...AFTER, ...BANNERS };

// --- Weather on the board ---------------------------------------------------------------------

// After every redraw: Rain and Sun behind the cards (the current game's weather layer, put
// into v2's board), and a pulse naming the new effect when a bracket is reached.
export function syncBoardWeather(root, state) {
  const board = boardEl(root);
  if (!board) return;
  const shim = { querySelector: (sel) => (sel === '.arena' ? board : root.querySelector(sel)) };
  syncWeather(shim, state.round ? weatherTotals(state) : null);
}
function weatherPulses(root, prev, next, t) {
  if (!prev.round) return;
  const a = weatherTotals(prev);
  const b = weatherTotals(next);
  for (const kind of ['Rain', 'Sun']) {
    const crossed = BRACKETS.filter((n) => (a[kind] ?? 0) < n && (b[kind] ?? 0) >= n).at(-1);
    if (!crossed) continue;
    pulseWeather(kind);
    floatText($(root, '.v2-wx-row') ?? boardEl(root), weatherPulseText(kind, crossed), 'weather', t(1500));
  }
}

// --- The queue ------------------------------------------------------------------------------

// Shows one action, from prev to next (actor: who took it), then draws the next state.
// Own actions play a little faster. Instant (or skipping) draws at once. Never throws:
// a problem showing it still leaves the next state drawn.
export async function present(root, prev, next, actor, draw) {
  const k = speedFactor() * (actor === 'player' ? 0.6 : 1);
  if (k <= 0 || typeof document === 'undefined') { draw(); return; }
  const t = (ms) => ms * k;
  skipping = false;
  consumed = new WeakSet();
  cause = null;
  favourShown = null;
  const ev = next.events;
  const late = [];
  let drawn = false;
  try {
    const championshipNow = ev.some((x) => x.type === 'championship');
    if (championshipNow) banner('The Championship arrives', 'Every other Location is swept away', (ms) => Math.max(t(ms), ms * 0.9), { kind: 'champ', hold: 700 });
    for (const e of ev) {
      if (skipping) break;
      // Supper's banner comes first: then its Burn and Leech Seed ticks, on the board as it was.
      if (e.type === 'phaseChanged' && e.phase === 'supper') {
        cause = 'supper';
        take(e);
        await BANNERS.phaseChanged({ root, prev, next, e, t });
        continue;
      }
      const fn = BEFORE[e.type];
      if (!fn || consumed.has(e)) continue;
      const shown = await fn({ root, prev, next, e, t, i: ev.indexOf(e) });
      if (shown === false) late.push(e);
    }
    draw();
    drawn = true;
    weatherPulses(root, prev, next, t);
    for (const [i, e] of ev.entries()) {
      if (skipping) break;
      if (consumed.has(e)) continue;
      const fn = AFTER[e.type] ?? (late.includes(e) ? BEFORE[e.type] : null) ?? BANNERS[e.type];
      if (fn) await fn({ root, prev, next, e, t, i });
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (!drawn) draw();
    finish();
  }
}

// Removes what's left of the effects (numbers and banners finish on their own).
function finish() {
  skipping = false;
  for (const el of document.querySelectorAll('.v2-reveal, .v2-flyer')) el.remove();
}

export function resetFx() {
  skip();
  finish();
  clearWeather();
  clearParticles();
  clearVfx();
  fx?.replaceChildren();
}
