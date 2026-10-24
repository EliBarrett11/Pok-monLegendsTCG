// Plays an action's events back on screen, one beat after another: cards
// revealed and moved, attacks, floating numbers, defeats and banners.
//
// The engine has already worked out the whole result (next state). This only
// decides how to show the change from the previous state to the next one,
// using the Web Animations API on the persistent card elements (see
// adoptCards in render.js), plus a separate effects layer (#fx) for
// reveals, arrows, numbers and cards on their way to a pile.

import { setCaption, cardElements, cardMarkup, STAGE } from './render.js';
import { speedFactor } from './settings.js';
import { burst, edgeBurst, clearParticles, reducedMotion } from './particles.js';
import { phaseIcon } from './icons.js';

// --- Timing and skipping -----------------------------------------------------------

let skipping = false;
const running = new Set();   // animations still playing
const waiters = new Set();   // pauses still waiting

// Skips to the end of the action being shown (its caption still updates).
export function skip() {
  skipping = true;
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
  if (!el || ms <= 0 || skipping) return;
  const a = el.animate(frames, { duration: ms, easing: 'ease-in-out', ...options });
  running.add(a);
  try {
    await a.finished;
  } catch {
    // cancelled
  } finally {
    running.delete(a);
  }
}

// The opponent's pause before each visible action.
export async function think(stage) {
  stage.classList.add('ai-thinking');
  skipping = false;
  await wait(600 * speedFactor());
  stage.classList.remove('ai-thinking');
}

// --- Geometry (everything in stage pixels) -------------------------------------------

const stageEl = () => document.getElementById('stage');
const fxEl = () => document.getElementById('fx');

function rectOf(el) {
  const s = stageEl().getBoundingClientRect();
  const scale = s.width / STAGE.width;
  const b = el.getBoundingClientRect();
  return { x: (b.left - s.left) / scale, y: (b.top - s.top) / scale, w: b.width / scale, h: b.height / scale };
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// The card element for a uid, if it is on screen now.
function shown(uid) {
  const el = uid && cardElements().get(uid);
  return el?.isConnected ? el : null;
}

function pile(root, name) {
  return root.querySelector(`[data-pile="${name}"]`);
}

// Puts an element in the effects layer at a stage rectangle.
function placeInFx(el, r) {
  fxEl().append(el);
  const w = el.offsetWidth || r.w;
  const h = el.offsetHeight || r.h;
  el.style.cssText = `position:absolute;left:${r.x}px;top:${r.y}px;margin:0;transform-origin:0 0;transform:scale(${r.w / w},${r.h / h})`;
  return { sx: r.w / w, sy: r.h / h };
}

// Animates an element from rectangle `from` to where it is now (FLIP).
function flyFrom(el, from, ms, { fade = false, base = 'none' } = {}) {
  const to = rectOf(el);
  if (!to.w || !to.h) return Promise.resolve();
  if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1 && Math.abs(from.w - to.w) < 1) return Promise.resolve();
  const start = `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h}) ${base === 'none' ? '' : base}`;
  return animate(el, [
    { transformOrigin: '0 0', transform: start, opacity: fade ? 0 : 1 },
    { transformOrigin: '0 0', transform: base, opacity: 1 },
  ], ms);
}

// --- Effects ----------------------------------------------------------------------------

const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// An element in the effects layer that removes itself when its animation ends
// (it may outlive the action, like a number still floating up).
function spawn(cls, r, html = '') {
  const el = document.createElement('div');
  el.className = `${cls} fx-keep`;
  if (html) el.innerHTML = html;
  if (r) Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  fxEl().append(el);
  return el;
}
function play(el, frames, ms, options = {}) {
  if (ms <= 0 || skipping) { el.remove(); return Promise.resolve(); }
  const a = el.animate(frames, { duration: ms, easing: 'ease-out', ...options });
  a.onfinish = () => el.remove();
  a.oncancel = () => el.remove();
  return a.finished.catch(() => {});
}

function floatNumber(r, text, kind, ms) {
  if (ms <= 0 || skipping) return;
  const n = spawn(`fx-num ${kind}`, null, `<span>${text}</span>`);
  n.style.left = `${r.x + r.w / 2}px`;
  n.style.top = `${r.y + r.h * 0.32}px`;
  // Numbers rise, except near the top edge of the stage, where they sink instead.
  const d = r.y < 120 ? -1 : 1;
  const pop = kind === 'damage';
  play(n, [
    { transform: `translate(-50%, -50%) scale(${pop ? 0.2 : 0.6})`, opacity: 0 },
    { transform: `translate(-50%, ${-50 - 6 * d}%) scale(${pop ? 1.35 : 1.15})`, opacity: 1, offset: 0.14 },
    { transform: `translate(-50%, calc(-50% - ${14 * d}px)) scale(1)`, opacity: 1, offset: 0.6 },
    { transform: `translate(-50%, calc(-50% - ${60 * d}px)) scale(0.95)`, opacity: 0 },
  ], ms);
}

// The Strength badge's number counts from one value to another (and flashes).
function countBadge(cardEl, from, to, ms, kind) {
  const badge = cardEl?.querySelector('.stat.str');
  const num = badge?.querySelector('b');
  if (!num || ms <= 0 || skipping) return;
  const start = performance.now();
  const a = Math.max(0, from);
  const b = Math.max(0, to);
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    num.textContent = Math.round(a + (b - a) * k);
    if (k < 1 && !skipping && num.isConnected) requestAnimationFrame(step);
    else num.textContent = b;
  };
  requestAnimationFrame(step);
  badge.animate([
    { boxShadow: `0 0 0 0 ${kind === 'damage' ? 'rgba(255,80,60,0)' : 'rgba(110,231,160,0)'}`, transform: 'scale(1)' },
    { boxShadow: `0 0 10px 4px ${kind === 'damage' ? 'rgba(255,80,60,0.95)' : 'rgba(110,231,160,0.95)'}`, transform: 'scale(1.25)', offset: 0.3 },
    { boxShadow: '0 0 0 0 rgba(0,0,0,0)', transform: 'scale(1)' },
  ], { duration: ms * 1.4 });
}

// A short shake of the table (not of the side panel), scaled by the hit; none with reduced motion.
function shake(root, amount, ms) {
  if (reducedMotion() || ms <= 0 || skipping) return;
  const a = clamp(amount, 1, 4);
  const frames = [0, 1, 2, 3, 4, 5].map((i) => ({ translate: i === 5 ? '0 0' : `${((i % 2) ? -1 : 1) * a * (1 - i / 5)}px ${((i % 3) - 1) * a * 0.6}px` }));
  root.querySelector('.table')?.animate(frames, { duration: ms });
}

// A white impact flash over a card, stronger for bigger hits.
function flash(r, strength, ms, color = '255,250,235', kind = '') {
  const f = spawn(`fx-flash${kind ? ` ${kind}` : ''}`, { x: r.x - 10, y: r.y - 10, w: r.w + 20, h: r.h + 20 });
  f.style.background = `radial-gradient(circle, rgba(${color},${clamp(0.55 + strength * 0.06, 0.6, 1)}), rgba(${color},0.25) 45%, transparent 72%)`;
  play(f, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1.05)', offset: 0.25 }, { opacity: 0, transform: 'scale(1.15)' }], ms);
}

// Colours for a Special attack's energy burst, by Pokémon Type.
const TYPE_COLORS = {
  normal: ['#e8e2c8', '#ffffff'], fire: ['#ff7a2a', '#ffd04a'], water: ['#4aa8ff', '#bfe4ff'], grass: ['#6fdc5a', '#d6ff9e'],
  electric: ['#ffe14a', '#fff7b0'], ice: ['#8ff0f0', '#ffffff'], fighting: ['#ff6a4a', '#ffc2a0'], poison: ['#c46aff', '#f0b8ff'],
  ground: ['#e0b060', '#ffe0a0'], flying: ['#a8a0ff', '#e6e2ff'], psychic: ['#ff5aa0', '#ffc0dc'], bug: ['#b6d84a', '#eaff9e'],
  rock: ['#c8b060', '#f0e2b0'], ghost: ['#8a6aff', '#d8c8ff'], dragon: ['#7a5aff', '#c8b8ff'], dark: ['#a07a6a', '#e0c8b8'],
  steel: ['#c0c8e0', '#ffffff'], fairy: ['#ff9ad0', '#ffe0f0'],
};
// What a card on the board attacks with: Physical or Special, and its Pokémon Type.
function attackStyle(el) {
  const special = el?.querySelector('.stat.atk')?.title?.startsWith('Special');
  const type = el?.querySelector('.card-art')?.className.match(/ptype-(\w+)/)?.[1] ?? 'normal';
  return { special, colors: TYPE_COLORS[type] ?? TYPE_COLORS.normal };
}

// A hit landing on a card: flash, particles, the damage number and the badge counting down.
function impact(root, el, hit, t, { style = null, trainer = false, big = false, kind = '', rect = null } = {}) {
  if (!el) return;
  const r = rect ?? rectOf(el);
  const c = centre(r);
  const dmg = hit?.amount ?? 1;
  const scale = clamp(dmg / 4, 0.5, 2.2) * (trainer || big ? 1.4 : 1);
  flash(r, dmg * (trainer ? 1.5 : 1), t(320), undefined, kind || (style?.special ? 'hit-special' : 'hit-physical'));
  if (style?.special) {
    // An energy burst in the attacker's Type colour: a bright core, orbs and streaks.
    const core = spawn('fx-energy', { x: c.x - 70, y: c.y - 70, w: 140, h: 140 });
    core.style.background = `radial-gradient(circle, #ffffff 0, ${style.colors[1]} 22%, ${style.colors[0]} 45%, transparent 70%)`;
    play(core, [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0.95, offset: 0.35 }, { transform: 'scale(1.8)', opacity: 0 }], t(480));
    burst(c.x, c.y, { kind: 'energy', colors: style.colors, count: 22 * scale, speed: 360 * Math.sqrt(scale), life: t(620), size: 7 });
    burst(c.x, c.y, { kind: 'spark', colors: [...style.colors, '#ffffff'], count: 18 * scale, speed: 520, life: t(460), size: 3 });
  } else {
    burst(c.x, c.y + r.h * 0.2, { kind: 'dust', colors: ['#b8925e', '#8a6a44', '#d9c09a'], count: 12 * scale, speed: 180, life: t(700), size: 7, up: 30, area: r.w * 0.5 });
    burst(c.x, c.y, { kind: 'spark', colors: ['#fff3c4', '#ffd36b', '#ffffff'], count: 16 * scale, speed: 480 * Math.sqrt(scale), life: t(380), size: 2.5, gravity: 600 });
  }
  if (trainer) {
    el.animate([0, 1, 2, 3, 4, 5, 6].map((i) => ({ translate: i === 6 ? '0 0' : `${(i % 2 ? -1 : 1) * 6 * (1 - i / 6)}px 0` })), { duration: t(380) });
  }
  if (hit) {
    floatNumber(r, `−${hit.amount}`, 'damage', t(1200));
    countBadge(el, hit.before, hit.after, t(450), 'damage');
  }
}

// The curved path the targeting arrow uses, from a to b (stage px).
function curve(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.min(160, dist * 0.35) };
  const at = (s) => ({ x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x, y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y });
  return { c, at, d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}` };
}

function svgLayer(cls, inner) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `${cls} fx-keep`);
  svg.setAttribute('viewBox', `0 0 ${STAGE.width} ${STAGE.height}`);
  svg.innerHTML = inner;
  fxEl().append(svg);
  return svg;
}

async function banner(text, ms, kind = '') {
  if (ms <= 0 || skipping) return;
  const b = document.createElement('div');
  b.className = `fx-banner ${kind}`;
  b.textContent = text;
  fxEl().append(b);
  await animate(b, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.85)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.2 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.05)' },
  ], ms);
  b.remove();
}

function glow(el, cls) {
  el?.classList.add(cls);
}

// --- Before the new state is drawn: the action itself ------------------------------------

// Reveals sit over the acting player's half of the board, clear of the caption.
const REVEAL = { cx: 940, w: 272, cy: { ai: 286, player: 730 } };

// Shows a card face-up and large in the middle of the board.
async function reveal(root, prev, e, t) {
  let el = shown(e.uid);
  let from;
  if (el) {
    from = rectOf(el);
  } else {
    const card = prev.players[e.who].hand.find((c) => c.uid === e.uid)
      ?? prev.players[e.who].bag.find((c) => c.uid === e.uid);
    if (!card) return;
    const box = document.createElement('div');
    box.innerHTML = cardMarkup(card, 'hand');
    el = box.firstElementChild;
    el.style.left = '0';
    cardElements().set(e.uid, el);
    // The opponent's card rises from the top card of its fan of card backs.
    const back = e.who === 'ai' && root.querySelector('.opp-hand .back:last-of-type');
    const hand = back || pile(root, `${e.who}-hand`) || pile(root, `${e.who}-draw`);
    from = hand ? rectOf(hand) : { x: REVEAL.cx, y: 0, w: 40, h: 56 };
    if (!back) from = { x: from.x, y: from.y, w: 40, h: 56 };
    if (back) back.style.visibility = 'hidden';
  }
  el.classList.remove('selected', 'selectable', 'unavailable');
  fxEl().append(el);
  const ratio = el.offsetHeight / el.offsetWidth;
  const h = REVEAL.w * ratio;
  const r = { x: REVEAL.cx - REVEAL.w / 2, y: REVEAL.cy[e.who] - h / 2, w: REVEAL.w, h };
  const { sx } = placeInFx(el, r);
  el.classList.add('fx-revealed');
  const panel = revealPanel(e, r);
  await flyFrom(el, from, t(320), { fade: !shown(e.uid), base: `scale(${sx})` });
  const target = shown(e.target?.uid);
  glow(target, 'fx-target');
  await wait(t(950));
  panel?.remove();
  return el;
}

// Once the effects of a revealed card start, it fades back so it never hides them.
function stepAside(el, t) {
  if (!el?.isConnected) return;
  animate(el, [{ opacity: 1 }, { opacity: 0.18 }], t(250), { fill: 'forwards' });
}

// Under a revealed Supporter: the cards paid and whether the Gift was met.
function revealPanel(e, r) {
  if (e.cardType !== 'Supporter' && !(e.cardType === 'Item')) return null;
  const p = document.createElement('div');
  p.className = 'fx-panel';
  if (e.cardType === 'Supporter') {
    const paid = [e.paid.discard.length && `Discarded: ${e.paid.discard.join(', ')}`,
      e.paid.release.length && `Released: ${e.paid.release.join(', ')}`].filter(Boolean).join('<br>');
    p.innerHTML = `${paid}<div class="${e.gift.met ? 'met' : 'unmet'}">Gift ${e.gift.met ? `met ✓ ${e.gift.bonus}` : 'not met'}</div>`;
  } else {
    p.innerHTML = `Bought for $${e.cost}${e.to.kind === 'bag' ? ' · stored in the Bag' : ''}`;
  }
  // Beside the card, so it never covers the caption.
  p.style.left = `${r.x + r.w + 16}px`;
  p.style.top = `${r.y + r.h / 2}px`;
  fxEl().append(p);
  return p;
}

// An attack: wind-up, a lunge along the targeting arrow's curve, the impact
// (both sides at once in a trade), then the attacker springs back.
async function attackBeat(root, e, hits, t) {
  const a = shown(e.attacker.uid);
  const b = shown(e.target.uid);
  const onTarget = hits.find((h) => h.target.uid === e.target.uid);
  const onAttacker = hits.find((h) => h.target.uid === e.attacker.uid);
  if (!a || !b) {
    impact(root, b, onTarget, t);
    impact(root, a, onAttacker, t);
    await wait(t(450));
    return;
  }
  glow(a, 'fx-attacker');
  glow(b, 'fx-target');
  const restA = rectOf(a);   // where the attacker sits, before it lunges
  const A = centre(restA);
  const B = centre(rectOf(b));
  const path = curve(A, B);
  const line = svgLayer('fx-arrow', `<path d="${path.d}" fill="none" stroke="#f0cf78" stroke-width="7" stroke-linecap="round" stroke-dasharray="16 8" opacity="0.75"/>`);
  const total = t(560);
  // Wind-up (0–35%): lift and glow. Lunge (35–62%): most of the way along the curve. Spring back.
  const frames = [
    { transform: 'translate(0, 0) scale(1)', offset: 0 },
    { transform: 'translate(0, -12px) scale(1.07)', offset: 0.35 },
  ];
  for (const s of [0.25, 0.5, 0.72]) {
    const p = path.at(s);
    frames.push({ transform: `translate(${p.x - A.x}px, ${p.y - A.y}px) scale(1.07)`, offset: 0.35 + (s / 0.72) * 0.27 });
  }
  frames.push({ transform: 'translate(0, 0) scale(1)', offset: 1 });
  const lunge = animate(a, frames, total, { easing: 'linear' });
  await wait(total * 0.62);
  // Impact: both sides of a trade at the same moment.
  const style = attackStyle(a);
  const trainer = e.target.kind === 'trainer';
  shake(root, 1.5 + (onTarget?.amount ?? 1) * 0.35 + (trainer ? 1 : 0), t(300));
  impact(root, b, onTarget, t, { style, trainer, kind: e.trades ? 'hit-trade' : '' });
  if (e.trades) impact(root, a, onAttacker, t, { style: attackStyle(b), kind: 'hit-trade', rect: restA });
  await lunge;
  line.remove();
  await wait(t(320));
}

// A hit that isn't an attack (an ability, a Power): a smaller impact.
async function hitBeat(root, e, t) {
  impact(root, shown(e.target.uid), e, t);
  shake(root, 1 + e.amount * 0.25, t(220));
  await wait(t(420));
}

// Area damage (Hypervoice): a wave sweeps across that side, hitting each card in turn.
async function waveBeat(root, group, t) {
  const owner = group[0].target.owner;
  const side = root.querySelector(`.side.${owner === 'ai' ? 'opponent' : 'player'}`);
  const r = side ? rectOf(side) : { x: 300, y: 300, w: 1300, h: 400 };
  const waveMs = t(650);
  const wave = spawn('fx-wave', r);
  play(wave, [{ backgroundPosition: '-60% 0', opacity: 0.2 }, { opacity: 1, offset: 0.2 }, { backgroundPosition: '160% 0', opacity: 0.4 }], waveMs, { easing: 'linear' });
  const hits = group.map((h) => ({ h, el: shown(h.target.uid) })).filter((x) => x.el)
    .map((x) => ({ ...x, at: (centre(rectOf(x.el)).x - r.x) / r.w }))
    .sort((p, q) => p.at - q.at);
  await Promise.all(hits.map(({ h, el, at }) => wait(waveMs * clamp(at, 0, 1) * 0.85).then(() => {
    impact(root, el, h, t, { style: { special: true, colors: ['#ffd36b', '#fff3c4'] }, kind: 'hit-wave' });
  })));
  shake(root, 2, t(260));
  await wait(t(380));
}

async function healBeat(e, t) {
  const el = shown(e.target.uid);
  if (!el || !e.amount) return;
  const r = rectOf(el);
  burst(r.x + r.w / 2, r.y + r.h * 0.7, { kind: 'sparkle', colors: ['#7dffb0', '#c8ffd8', '#ffffff'], count: 16, speed: 70, up: 120, life: t(900), size: 7, area: r.w * 0.8 });
  floatNumber(r, `+${e.amount}`, 'heal', t(1200));
  countBadge(el, e.before, e.after, t(450), 'heal');
  await wait(t(450));
}

async function buffBeat(e, t) {
  const el = shown(e.target.uid);
  if (!el) return;
  const r = rectOf(el);
  const shimmer = spawn('fx-shimmer', r);
  play(shimmer, [{ backgroundPosition: '-120% 0', opacity: 0 }, { opacity: 1, offset: 0.2 }, { backgroundPosition: '220% 0', opacity: 0 }], t(650), { easing: 'ease-in-out' });
  for (const badge of el.querySelectorAll('.stat')) {
    badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', boxShadow: '0 0 10px 3px rgba(255,214,110,0.9)' }, { transform: 'scale(1)' }], { duration: t(600) });
  }
  const parts = [e.attack && `${signed(e.attack)} ATK`, e.strength && `${signed(e.strength)} STR`].filter(Boolean);
  if (parts.length) floatNumber(r, parts.join(' '), 'buff', t(1100));
  await wait(t(380));
}

// Defeat: a white flash and a shake, then the card burns away from its edges.
async function defeatBeat(el, t) {
  const r = rectOf(el);
  flash(r, 6, t(300), undefined, 'defeat');
  await animate(el, [0, 1, 2, 3, 4, 5].map((i) => ({ transform: i === 5 ? 'none' : `translate(${(i % 2 ? -1 : 1) * 4}px, 0)`, filter: `brightness(${i < 2 ? 2.4 : 1.3}) saturate(${i < 2 ? 0 : 0.6})` })), t(280));
  edgeBurst(r, { kind: 'ember', colors: ['#ffb347', '#ff7a2a', '#ffe08a', '#5a3018'], count: 36, speed: 70, up: 90, life: t(900), size: 3.5 });
  await animate(el, [{ opacity: 1, filter: 'sepia(0.4) brightness(1.2)' }, { opacity: 0.25, filter: 'sepia(1) brightness(0.5) contrast(1.4)' }], t(420), { fill: 'forwards' });
  el.dataset.fading = '1';
}

// A Trainer reaching 0 Strength: the card shatters, its zone dims, and a banner.
async function trainerFallsBeat(root, e, t) {
  const el = shown(e.target.uid);
  if (el) {
    const r = rectOf(el);
    const c = centre(r);
    shake(root, 4, t(500));
    flash(r, 12, t(400), '255,220,200');
    burst(c.x, c.y, { kind: 'shard', colors: ['#7a2020', '#d1a95a', '#f6dd9a', '#3d2514'], count: 34, speed: 420, life: t(1100), size: 9, gravity: 700 });
    burst(c.x, c.y, { kind: 'spark', colors: ['#fff3c4', '#ffd36b'], count: 20, speed: 520, life: t(500), size: 3 });
    animate(el, [{ filter: 'brightness(2.5)', transform: 'scale(1.05)' }, { filter: 'grayscale(0.9) brightness(0.45)', transform: 'scale(1)' }], t(600), { fill: 'forwards' });
    const lane = el.closest('.lane');
    lane?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(0.55)' }], { duration: t(700), fill: 'forwards' });
  }
  await banner(`${e.target.name} has fallen!`, t(1300), 'fallen');
}

// PokéDollars earned: gold coins fly to the winner's counter.
function coins(root, e, from, t) {
  const to = pile(root, `${e.who}-dollars`);
  if (!to || !from) return;
  const end = centre(rectOf(to));
  const start = centre(from);
  const n = clamp(e.amount, 1, 6);
  for (let i = 0; i < n; i++) {
    const coin = spawn('fx-coin', { x: start.x - 10, y: start.y - 10, w: 20, h: 20 }, '$');
    const mid = { x: (start.x + end.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(start.y, end.y) - 80 - Math.random() * 60 };
    play(coin, [
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
      { transform: `translate(${mid.x - start.x}px, ${mid.y - start.y}px) scale(1.2)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${end.x - start.x}px, ${end.y - start.y}px) scale(0.7)`, opacity: 1 },
    ], t(800), { delay: i * t(80), easing: 'ease-in-out', fill: 'backwards' });
  }
  to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', filter: 'brightness(1.6)' }, { transform: 'scale(1)' }], { duration: t(400), delay: t(800) + n * t(80) });
}

// Quest progress: the counter ticks up with a pulse.
function questTick(e, t) {
  const el = shown(e.uid);
  const badge = el?.querySelector('.stat.quest');
  if (!badge) return;
  const num = badge.querySelector('b');
  if (num) num.textContent = e.progress;
  badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)', boxShadow: '0 0 12px 4px rgba(255,214,110,0.9)' }, { transform: 'scale(1)' }], { duration: t(650) });
}

// Quest complete: the Location glows, the XP reward flies to the XP counter.
async function questCompleteBeat(root, e, t) {
  const el = shown(e.uid);
  if (!el) return;
  const r = rectOf(el);
  const c = centre(r);
  glow(el, 'fx-power');
  burst(c.x, c.y, { kind: 'sparkle', colors: ['#ffe9a0', '#ffd36b', '#ffffff'], count: 24, speed: 160, life: t(900), size: 8, area: r.w * 0.6 });
  const to = pile(root, `${e.owner}-xp`);
  if (to) {
    const end = centre(rectOf(to));
    const star = spawn('fx-xp', { x: c.x - 40, y: c.y - 18, w: 80, h: 36 }, `★ +${e.xp} XP`);
    play(star, [
      { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
      { transform: 'translate(0, -30px) scale(1.25)', opacity: 1, offset: 0.3 },
      { transform: `translate(${end.x - c.x}px, ${end.y - c.y}px) scale(0.6)`, opacity: 0.9 },
    ], t(1000), { easing: 'ease-in-out' });
  }
  await wait(t(900));
}

// A Weather bracket switching on: a short tint over the whole board.
function weatherTint(root, e, t) {
  const arena = root.querySelector('.arena');
  if (!arena) return;
  const tint = spawn(`fx-tint ${e.weather === 'Sun' ? 'sun' : 'rain'}`, rectOf(arena));
  play(tint, [{ opacity: 0, backgroundPosition: '0 -60%' }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.65 }, { opacity: 0, backgroundPosition: '0 160%' }], t(1300), { easing: 'ease-in-out' });
}

// A Trainer's Power: the Trainer glows, then a beam of sparks travels to its target.
async function powerBeat(e, t) {
  const trainer = shown(e.uid);
  glow(trainer, 'fx-power');
  await animate(trainer, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1.2)' }], t(380));
  const target = shown(e.target?.uid);
  if (trainer && target) {
    glow(target, 'fx-target');
    const A = centre(rectOf(trainer));
    const B = centre(rectOf(target));
    const path = curve(A, B);
    const beam = svgLayer('fx-beam', `<path d="${path.d}" fill="none" stroke="#ffe08a" stroke-width="6" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>`);
    const line = beam.querySelector('path');
    await animate(line, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], t(320), { fill: 'forwards' });
    burst(B.x, B.y, { kind: 'spark', colors: ['#ffe08a', '#ffffff'], count: 14, speed: 300, life: t(420), size: 2.5 });
    play(beam, [{ opacity: 1 }, { opacity: 0 }], t(300));
  }
  await wait(t(150));
}

// A triggered ability or Passive: a small banner beside its card, then its effect.
async function triggerBanner(e, t) {
  const el = shown(e.source.uid);
  if (!el) return;
  const r = rectOf(el);
  // Just above its own card (below it near the top edge), clear of its neighbours.
  const below = r.y < 150;
  const tag = spawn(`fx-trigger${below ? ' below' : ''}`, null, `<b>${e.source.name}</b> · ${e.word}`);
  tag.style.left = `${r.x + r.w / 2}px`;
  tag.style.top = `${below ? r.y + r.h + 4 : r.y - 4}px`;
  play(tag, [
    { opacity: 0, transform: 'scale(0.8)' },
    { opacity: 1, transform: 'scale(1)', offset: 0.15 },
    { opacity: 1, offset: 0.8 },
    { opacity: 0 },
  ], t(1400));
  glow(el, 'fx-power');
  await wait(t(420));
}

// Passing with unmatched speed: each of those Pokémon is marked, then turns
// Spent on the board as the new state is drawn.
async function spentBeat(e, t) {
  for (const ref of e.targets) {
    const el = shown(ref.uid);
    if (!el) continue;
    const r = rectOf(el);
    const below = r.y < 150;
    const tag = spawn(`fx-trigger spent-tag${below ? ' below' : ''}`, null, `<b>${ref.name}</b> · Spent: unmatched speed`);
    tag.style.left = `${r.x + r.w / 2}px`;
    tag.style.top = `${below ? r.y + r.h + 4 : r.y - 4}px`;
    play(tag, [{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], t(1500));
    animate(el, [{ filter: 'none', rotate: '0deg' }, { filter: 'saturate(0.6) brightness(0.94)', rotate: '4deg' }], t(500), { fill: 'forwards' });
  }
  await wait(t(650));
}

// Walks an action's events in order, each one its own beat. Effects on cards
// that aren't on screen yet (just summoned) wait until after the new state is
// drawn (`late`).
async function walk(root, events, t, late) {
  // The engine counts an attack's quest progress before resolving its damage;
  // on screen the attack lands first, then the quest ticks.
  const ev = [...events];
  const at = ev.findIndex((e) => e.type === 'attack');
  if (at >= 0) {
    const quest = ev.slice(0, at).filter((e) => e.type === 'questProgress' || e.type === 'questComplete');
    if (quest.length) {
      const rest = ev.filter((e) => !quest.includes(e));
      let after = rest.indexOf(ev[at]) + 1;
      while (after < rest.length && rest[after].type === 'damage') after += 1;
      rest.splice(after, 0, ...quest);
      ev.splice(0, ev.length, ...rest);
    }
  }
  const used = new Set();
  let lastDefeated = null;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (used.has(e)) continue;
    if (skipping) return;
    switch (e.type) {
      case 'attack': {
        const hits = [];
        for (const x of ev.slice(i + 1)) {
          if (x.type !== 'damage' || used.has(x)) continue;
          if (!hits.some((h) => h.target.uid === x.target.uid)
            && (x.target.uid === e.target.uid || (e.trades && x.target.uid === e.attacker.uid))) hits.push(x);
          if (hits.length === (e.trades ? 2 : 1)) break;
        }
        hits.forEach((h) => used.add(h));
        await attackBeat(root, e, hits, t);
        break;
      }
      case 'abilityTriggered': await triggerBanner(e, t); break;
      case 'powerUsed': await powerBeat(e, t); break;
      case 'damage': {
        const group = [e];
        for (let j = i + 1; j < ev.length && ev[j].type === 'damage' && !used.has(ev[j]); j++) group.push(ev[j]);
        group.forEach((g) => used.add(g));
        const visible = group.filter((g) => shown(g.target.uid));
        late.push(...group.filter((g) => !shown(g.target.uid)));
        if (visible.length >= 2) await waveBeat(root, visible, t);
        else if (visible.length) await hitBeat(root, visible[0], t);
        break;
      }
      case 'heal': if (shown(e.target.uid)) await healBeat(e, t); else late.push(e); break;
      case 'buff': if (shown(e.target.uid)) await buffBeat(e, t); else late.push(e); break;
      case 'defeated': {
        const el = shown(e.target.uid);
        if (el) {
          lastDefeated = rectOf(el);
          await defeatBeat(el, t);
        }
        break;
      }
      case 'trainerRemoved': await trainerFallsBeat(root, e, t); break;
      case 'spentByPass': await spentBeat(e, t); break;
      case 'dollarsEarned': coins(root, e, lastDefeated, t); break;
      case 'questProgress': questTick(e, t); break;
      case 'questComplete': await questCompleteBeat(root, e, t); break;
      case 'weatherChanged': if (e.on) weatherTint(root, e, t); break;
      default: break;
    }
  }
}

async function before(root, prev, next, actor, t, late) {
  const ev = next.events;
  const main = ev.find((e) => ['cardPlayed', 'itemUsed', 'pass', 'choiceMade', 'itemBought'].includes(e.type));
  if (main?.type === 'cardPlayed' || main?.type === 'itemUsed') {
    const shownCard = await reveal(root, prev, { ...main, cardType: main.cardType ?? 'Item', to: main.to ?? { kind: 'use' } }, t);
    const effects = ['damage', 'heal', 'buff', 'defeated', 'abilityTriggered', 'questComplete', 'trainerRemoved'];
    if (ev.some((e) => effects.includes(e.type))) stepAside(shownCard, t);
  }
  else if (main?.type === 'itemBought') {
    glow(shown(main.uid), 'fx-target');
    await wait(t(450));
  } else if (main?.type === 'choiceMade' && main.target) {
    glow(shown(main.target.uid), 'fx-target');
    await wait(t(400));
  } else if (main?.type === 'pass' && !main.endsPhase) {
    await banner(`${actor === 'player' ? 'You pass' : 'Opponent passes'}`, t(850), actor);
  }
  await walk(root, ev, t, late);
  // The Battle Phase ending (two passes in a row), then Supper, before the board changes.
  if (main?.type === 'pass' && main.endsPhase) {
    await phaseBanner('end', 'Battle ends', `${actor === 'player' ? 'You' : 'The opponent'} passed straight back`, t(800));
  }
  if (ev.some((e) => e.type === 'phaseChanged' && e.phase === 'supper')) {
    await phaseBanner('supper', 'Supper', 'Hands are discarded', t(850));
  }
}

// --- Round, phase and turn banners ----------------------------------------------------------

const PHASES = {
  round: { icon: '' },
  breakfast: { icon: 'sunrise' },
  battle: { icon: 'swords' },
  supper: { icon: 'moon' },
  end: { icon: 'swords' },
};

// A banner that sweeps across the middle of the mat. Awaited for its full
// length unless `hold` is given (then only that long, and it finishes on its own).
async function phaseBanner(kind, title, sub, ms, { hold = null, small = false } = {}) {
  if (ms <= 0 || skipping) return;
  const art = PHASES[kind]?.icon ? phaseIcon(PHASES[kind].icon) : '';
  const b = spawn(`fx-phase ${kind}${small ? ' small' : ''}`, null,
    `${art ? `<i class="fx-phase-icon">${art}</i>` : ''}<div class="fx-phase-text"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
  const done = play(b, [
    { opacity: 0, transform: 'translate(-50%, -50%) translateX(-140px) scaleX(0.7)' },
    { opacity: 1, transform: 'translate(-50%, -50%) translateX(0) scaleX(1)', offset: 0.22 },
    { opacity: 1, transform: 'translate(-50%, -50%) translateX(12px)', offset: 0.78 },
    { opacity: 0, transform: 'translate(-50%, -50%) translateX(160px) scaleX(0.85)' },
  ], ms, { easing: 'cubic-bezier(.2,.7,.3,1)' });
  if (hold !== null) await wait(hold);
  else await done;
}

const PHASE_TITLES = { breakfast: ['Breakfast', 'Energy, cards and Weather'], battle: ['Battle', 'Take turns: one Action each'] };

// After the board changes: a new Round, Breakfast, Battle, and whose turn it is now.
async function turnFlow(prev, next, t) {
  for (const e of next.events) {
    if (skipping) return;
    if (e.type === 'roundStarted') {
      await phaseBanner('round', `Round ${e.round}`, `Initiative: ${e.initiative === 'player' ? 'You' : 'Opponent'}`, t(1150));
    } else if (e.type === 'phaseChanged' && PHASE_TITLES[e.phase]) {
      await phaseBanner(e.phase, ...PHASE_TITLES[e.phase], t(850));
    }
  }
  // It became someone else's turn in the Battle Phase (or Battle just began).
  if (next.phase === 'battle' && !next.pending && (prev.phase !== 'battle' || prev.turn !== next.turn || prev.round !== next.round)) {
    if (next.turn === 'player') await phaseBanner('your-turn', 'Your Turn', '', t(1000), { hold: t(380) });
    else await phaseBanner('their-turn', "Opponent's Turn", '', t(700), { hold: 0, small: true });
  }
}

// --- After the new state is drawn: cards move to their new places --------------------------

// Where every card on screen is, before the new state is drawn.
function snapshot() {
  const snap = new Map();
  for (const [uid, el] of cardElements()) {
    if (el.isConnected) snap.set(uid, { el, rect: rectOf(el) });
  }
  return snap;
}

function destination(root, uid, events) {
  const attached = events.find((e) => e.type === 'itemAttached' && e.item.uid === uid);
  if (attached) return shown(attached.target.uid) ?? root.querySelector(`.side.${attached.target.owner === 'ai' ? 'opponent' : 'player'}`);
  const moved = events.filter((e) => e.type === 'cardMoved' && e.uid === uid).at(-1);
  if (!moved) return null;
  if (moved.to === 'mart') return root.querySelector('.mart');
  return pile(root, `${moved.owner}-${moved.to}`);
}

// A summoned Pokémon lands in its space: a small bounce and a ring of dust on
// the mat; one that arrives Active (Quick Attack) lands with a flash.
function land(el, t) {
  const r = rectOf(el);
  animate(el, [
    { transform: 'translateY(-18px) scale(1.08)' },
    { transform: 'translateY(0) scale(0.96)', offset: 0.55 },
    { transform: 'translateY(-3px) scale(1.01)', offset: 0.8 },
    { transform: 'none' },
  ], t(360), { easing: 'ease-out' });
  setTimeout(() => {
    burst(r.x + r.w / 2, r.y + r.h - 6, { kind: 'ring', colors: ['rgba(214,184,140,0.85)'], count: 1, speed: 0, life: t(520), size: 6 });
    burst(r.x + r.w / 2, r.y + r.h - 6, { kind: 'dust', colors: ['#b8925e', '#d9c09a'], count: 14, speed: 160, life: t(600), size: 6, angle: -Math.PI / 2, spread: Math.PI * 1.2, area: r.w * 0.7 });
    if (!el.classList.contains('spent')) {
      flash(r, 6, t(420), '255,240,190');
      burst(r.x + r.w / 2, r.y + r.h / 2, { kind: 'spark', colors: ['#fff3c4', '#ffd36b'], count: 16, speed: 360, life: t(420), size: 2.5 });
    }
  }, t(200));
}

async function after(root, snap, next, actor, t, late) {
  const ev = next.events;
  const moves = [];
  // Cards still on screen glide to their new place; new ones arrive from a pile.
  for (const fresh of root.querySelectorAll('.card[data-uid]')) {
    const was = snap.get(fresh.dataset.uid);
    if (was?.el === fresh) {
      moves.push(flyFrom(fresh, was.rect, t(380)));
    } else if (!was) {
      const mine = fresh.closest('.hand');
      const theirs = fresh.closest('.side.opponent');
      const from = mine ? pile(root, 'player-draw') : theirs ? pile(root, 'ai-hand') : null;
      if (from) {
        const r = rectOf(from);
        moves.push(flyFrom(fresh, { x: r.x, y: r.y, w: fresh.offsetWidth * 0.3, h: fresh.offsetHeight * 0.3 }, t(380), { fade: true }));
      } else {
        moves.push(animate(fresh, [{ opacity: 0 }, { opacity: 1 }], t(300)));
      }
    }
  }
  // Cards that left the screen fly to their pile (or fade where they were).
  for (const [uid, { el, rect }] of snap) {
    if (el.isConnected && !el.closest('#fx')) continue;
    const fading = el.dataset.fading;
    placeInFx(el, rect);
    if (fading) el.style.filter = 'sepia(1) brightness(0.5)';
    const dest = destination(root, uid, ev);
    const start = fading ? 0.3 : 1;
    if (dest) {
      const d = centre(rectOf(dest));
      const s = 0.25;
      moves.push(animate(el, [
        { transformOrigin: '0 0', transform: el.style.transform, opacity: start },
        { transformOrigin: '0 0', transform: `translate(${d.x - rect.x - (rect.w * s) / 2}px, ${d.y - rect.y - (rect.h * s) / 2}px) scale(${(rect.w / el.offsetWidth) * s})`, opacity: 0 },
      ], t(520), { fill: 'forwards' }));
    } else {
      moves.push(animate(el, [{ opacity: start }, { opacity: 0 }], t(400), { fill: 'forwards' }));
    }
  }
  await Promise.all(moves);

  // Summoned Pokémon land.
  for (const e of ev.filter((x) => x.type === 'summoned')) {
    const el = shown(e.target.uid);
    if (el?.closest('.pokemon-space')) land(el, t);
  }

  // Trainers revealed together: they flip face-up.
  const revealed = ev.filter((e) => e.type === 'trainersRevealed').flatMap((e) => e.trainers.map((tr) => shown(tr.uid)));
  const flips = revealed.filter(Boolean).map((el) => animate(el, [
    { transform: 'perspective(600px) rotateY(90deg)' }, { transform: 'none' },
  ], t(520)));

  // Effects on cards that only just arrived.
  for (const e of late) {
    if (e.type === 'heal') await healBeat(e, t);
    else if (e.type === 'buff') await buffBeat(e, t);
    else if (e.type === 'damage' && shown(e.target.uid)) await hitBeat(root, e, t);
  }
  // Base Energy gained by passing floats up from that player's Energy counter.
  for (const e of ev.filter((x) => x.type === 'energyGained' && x.source === 'Pass')) {
    const counter = pile(root, `${e.who}-energy`);
    if (counter) floatNumber(rectOf(counter), `+${e.amount} Energy`, 'buff', t(1300));
  }
  // A Weather bracket that switched on: its pip lights up.
  for (const e of ev.filter((x) => x.type === 'weatherChanged' && x.on)) {
    const pip = root.querySelector(`.weather-type.${e.weather.toLowerCase()} .pip[data-at="${e.at}"]`);
    pip?.animate([{ transform: 'scale(1)' }, { transform: 'scale(2.2)', filter: 'brightness(2)' }, { transform: 'scale(1)' }], { duration: t(700) });
  }
  await Promise.all(flips);
}

// --- Captions -----------------------------------------------------------------------------

const subject = (w) => (w === 'player' ? 'You' : 'Opponent');
const verb = (w, base, third) => (w === 'player' ? base : third ?? `${base}s`);
const owned = (owner, capital = false) => (owner === 'player' ? (capital ? 'Your' : 'your') : "Opponent's");
const named = (t) => (t ? `${t.owner ? `${owned(t.owner)} ` : ''}${t.name}` : '');
const on = (t) => (t ? ` on ${named(t)}` : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// One line, in plain words, for what this action did.
export function captionFor(state, actor) {
  const ev = state.events ?? [];
  const find = (type) => ev.find((e) => e.type === type);
  const all = (type) => ev.filter((e) => e.type === type);
  const S = subject(actor);
  let text = '';

  const reveals = all('trainersRevealed');
  const mulls = all('mulligan');
  const xpLocks = all('xpLocked');
  const main = ev.find((e) => ['cardPlayed', 'itemBought', 'itemUsed', 'attack', 'powerUsed', 'pass', 'choiceMade'].includes(e.type));
  if (reveals.length) {
    const theirs = reveals.find((e) => e.who === 'ai');
    text = `Trainers revealed — Opponent: ${theirs.trainers.map((tr) => `${tr.name} (Zone ${tr.zone + 1})`).join(', ')}`;
  } else if (find('coinFlip')) {
    const w = find('coinFlip').winner;
    text = `Coin flip: ${subject(w)} ${verb(w, 'win')} initiative`;
  } else if (mulls.length) {
    text = ['ai', 'player'].map((w) => {
      const m = mulls.find((e) => e.who === w);
      return m.count ? `${subject(w)} mulliganed ${plural(m.count, 'card')}` : `${subject(w)} kept ${w === 'player' ? 'your' : 'their'} hand`;
    }).join(' · ');
  } else if (xpLocks.length && find('phaseChanged')) {
    text = ['ai', 'player'].map((w) => {
      const x = ev.find((e) => e.type === 'xpSpent' && e.who === w);
      if (!x) return `${subject(w)} spent no XP`;
      return `${subject(w)} spent ${x.total} XP (${x.parts.map((p) => `${p.name} ${[p.attack && `+${p.attack} Attack`, p.strength && `+${p.strength} Strength`].filter(Boolean).join(', ')}`).join('; ')})`;
    }).join(' · ');
  } else if (find('trainersLocked') || find('mulliganLocked') || xpLocks.length) {
    text = actor === 'player' ? 'You locked in — waiting for the opponent' : 'Opponent is ready — your move';
  } else if (main?.type === 'cardPlayed') {
    const where = main.to.kind === 'pokemon' || main.to.kind === 'location' ? ` ${main.to.kind === 'location' ? 'in' : 'into'} Zone ${main.to.zone + 1}` : '';
    if (main.cardType === 'Item') {
      text = main.to.kind === 'bag'
        ? `${S} ${verb(actor, 'buy')} ${main.name} and ${verb(actor, 'store')} it in the Bag`
        : `${S} ${verb(actor, 'buy')} and ${verb(actor, 'use')} ${main.name}${on(main.target)}`;
    } else if (main.cardType === 'Supporter') {
      const paid = [...main.paid.discard, ...main.paid.release];
      text = `${S} ${verb(actor, 'play')} ${main.name}${on(main.target)}${paid.length ? `, paying ${paid.join(', ')}` : ''} — Gift ${main.gift.met ? 'met' : 'not met'}`;
    } else {
      text = `${S} ${verb(actor, 'play')} ${main.name}${where}${on(main.target)}`;
    }
  } else if (main?.type === 'itemBought') {
    text = `${S} ${verb(actor, 'buy')} ${main.name} from the PokéMart ($${main.cost})`;
  } else if (main?.type === 'itemUsed') {
    text = `${S} ${verb(actor, 'use')} ${main.name} from the Bag${on(main.target)}`;
  } else if (main?.type === 'attack') {
    text = `${owned(actor, true)} ${main.attacker.name} attacks ${named(main.target)} — ${main.amount} damage`
      + (main.trades ? `; ${main.target.name} hits back for ${main.back}` : '');
  } else if (main?.type === 'powerUsed') {
    text = `${S} ${verb(actor, 'use')} ${main.name}'s Power${on(main.target)}`;
  } else if (main?.type === 'pass') {
    text = `${S} ${verb(actor, 'pass', 'passes')}${main.gain ? `, +${main.gain} Energy` : ''}`;
    if (main.spends?.length) {
      const names = main.spends.map((r) => r.name);
      const list = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
      text += ` — ${list} ${names.length === 1 ? 'is' : 'are'} Spent (unmatched speed)`;
    }
    if (ev.some((e) => e.type === 'phaseChanged' && e.phase === 'supper')) text += ' · Battle Phase ends';
  } else if (main?.type === 'choiceMade') {
    text = main.kind === 'target'
      ? `${S} ${verb(actor, 'choose')} ${named(main.target)} for ${main.source}`
      : main.summon ? `${S} ${verb(actor, 'summon')} ${main.name} for free into Zone ${main.zone + 1}`
        : `${S} ${verb(actor, 'keep')} ${main.name} in hand`;
  }
  const extra = [
    ...all('defeated').map((e) => `${named(e.target)} defeated`),
    ...all('trainerRemoved').map((e) => `${named(e.target)} removed`),
    ...all('questComplete').map((e) => `${owned(e.owner, true)} ${e.name} quest complete`),
  ];
  const over = find('matchOver');
  if (over) extra.push(over.winner ? `${subject(over.winner)} ${verb(over.winner, 'win')}!` : 'Match drawn');
  return [text, ...extra].filter(Boolean).join(' · ');
}

// --- The history strip --------------------------------------------------------------------

// One entry for the history strip, or null for actions that aren't worth one.
export function historyEntry(prev, next, who) {
  const ev = next.events ?? [];
  const main = ev.find((e) => ['cardPlayed', 'itemBought', 'itemUsed', 'attack', 'powerUsed', 'pass', 'choiceMade'].includes(e.type));
  if (!main) return null;
  const find = (uid) => {
    for (const p of Object.values(prev.players)) {
      const c = p.hand.find((x) => x.uid === uid) ?? p.bag.find((x) => x.uid === uid);
      if (c) return c;
      for (const z of p.zones) {
        if (z.trainer?.uid === uid) return z.trainer;
        if (z.location?.uid === uid) return z.location;
        const m = z.pokemon.find((x) => x?.uid === uid);
        if (m) return m;
      }
    }
    return prev.mart?.onSale.find((x) => x?.uid === uid) ?? null;
  };
  const kind = main.type === 'cardPlayed' ? (main.cardType === 'Item' ? 'item' : 'play')
    : main.type === 'itemBought' || main.type === 'itemUsed' ? 'item'
      : main.type === 'attack' ? 'attack' : main.type === 'powerUsed' ? 'power' : main.type === 'pass' ? 'pass' : 'choice';
  const uid = main.type === 'attack' ? main.attacker.uid : main.type === 'choiceMade' ? (main.uid ?? main.target?.uid) : main.uid;
  return { who, kind, text: captionFor(next, who), card: uid ? find(uid) : null };
}

// --- The queue ---------------------------------------------------------------------------

// Shows one action, from prev to next (actor: who took it), then draws
// the next state. Own actions play faster. Never throws: a problem showing
// it still leaves the next state drawn.
export async function present(root, prev, next, actor, draw) {
  const k = speedFactor() * (actor === 'player' ? 0.45 : 1);
  const t = (ms) => ms * k;
  skipping = false;
  setCaption(captionFor(next, actor));
  const late = [];
  try {
    if (k > 0) await before(root, prev, next, actor, t, late);
    const snap = k > 0 ? snapshot() : new Map();
    draw();
    if (k > 0 && !skipping) await after(root, snap, next, actor, t, late);
    // Round, phase and turn banners: own actions don't speed these up.
    const kb = speedFactor();
    if (kb > 0 && !skipping) await turnFlow(prev, next, (ms) => ms * kb);
  } catch (err) {
    console.error(err);
    draw();
  } finally {
    clearFx();
    skipping = false;
  }
}

// Removes everything but effects still finishing on their own (numbers, coins, banners).
function clearFx() {
  const fx = fxEl();
  for (const el of [...fx.children]) {
    if (!el.classList.contains('fx-keep')) el.remove();
  }
  for (const [uid, el] of cardElements()) if (!el.isConnected) cardElements().delete(uid);
  for (const el of document.querySelectorAll('.fx-target, .fx-attacker, .fx-power')) {
    el.classList.remove('fx-target', 'fx-attacker', 'fx-power');
  }
}

export function resetFx() {
  skip();
  clearFx();
  clearParticles();
}
