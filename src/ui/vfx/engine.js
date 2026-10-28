// The effects engine: particles, ribbons, card motion, hit-stop, shake and
// timelines, drawn by the WebGL renderer (gl.js). Effects are data
// (library.js); this file only knows how to play them.
//
// The loop runs only while something is alive (a particle, a timeline, a
// burning card, a coin in flight). Reduced motion (the OS setting) means far
// fewer particles, no shake and no distortion. If WebGL isn't available,
// initVfx() returns false and the game keeps its 2D effects (particles.js).

import { createRenderer } from './gl.js';
import { loadTextures } from './textures.js';
import { Timeline } from './timeline.js';
import {
  EMITTERS, TIMELINES, RIBBONS, BEAMS, SWEEPS, STATUS_VISUALS, tintOf, impactScale,
} from './library.js';

const MAX_PARTICLES = 2600;
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
export const reducedMotion = () => motionQuery.matches;

let R = null;          // the renderer
let canvasEl = null;
const TEX = {};        // name → { w, h, sprites }
let ready = false;

let parts = [];        // particles (and distortion sprites, distort: true)
let streams = [];      // emitters streaming over time
let ribbons = [];      // trails
let flyers = [];       // coins and other sprites on a path
let beams = [];        // textures stretched between two points (a lightning bolt)
let running = [];      // timelines playing: { tl, ctx, rate, resolve }
let ambient = [];      // cards with a status visual: { el, id, level, acc: {} }
let heatEls = new Map();   // element → strength (SVG heat shimmer)
let shake = null;      // { amp, t, dur }
let bloomPulse = 0;
let frame = 0;
let last = 0;

// --- Setup --------------------------------------------------------------------------------

// Starts the WebGL layer on `canvas`. False (and nothing changes) without WebGL.
export async function initVfx(canvas) {
  canvasEl = canvas;
  R = createRenderer(canvas);
  if (!R) return false;
  const textures = await loadTextures();
  for (const [name, t] of Object.entries(textures)) {
    R.upload(name, t.image, { premultiply: !name.endsWith('-map') });
    TEX[name] = { w: t.image.width, h: t.image.height, sprites: t.sprites };
  }
  heatFilter();
  ready = true;
  canvas.hidden = false;
  return true;
}

export const vfxReady = () => ready && R && !R.lost();

// --- Geometry ------------------------------------------------------------------------------

function stageScale() {
  const s = document.getElementById('stage').getBoundingClientRect();
  return { left: s.left, top: s.top, k: s.width / 1920 };
}
// An element's rectangle in stage px (ignoring transforms we add: we read the layout box).
export function rectOf(el) {
  const s = stageScale();
  const b = el.getBoundingClientRect();
  return { x: (b.left - s.left) / s.k, y: (b.top - s.top) / s.k, w: b.width / s.k, h: b.height / s.k };
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const rnd = (v) => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v ?? 0);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = {
  outCubic: (t) => 1 - (1 - t) ** 3,
  inQuad: (t) => t * t,
  outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
};
function hex(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(String(c).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// --- Particles -----------------------------------------------------------------------------

// Spawns a preset's particles around an anchor:
//   anchor: { rect, dir: {x, y}, muzzle: {x, y}, tint: [main, highlight] }
//   opts: { count, scale (impact size), countScale, rate (sim speed), tint }
export function emit(name, anchor, opts = {}) {
  const e = EMITTERS[name];
  if (!e || !vfxReady()) return;
  const n = opts.count ?? Math.max(1, Math.round((e.count ?? 1) * (opts.countScale ?? 1) * (opts.scale ?? 1) * (reducedMotion() ? 0.35 : 1)));
  for (let i = 0; i < n; i++) spawnOne(e, anchor, opts);
}

// Presets are sized for a 250 px wide card (the prototype's); effects scale
// with the card they're on (a board card is about 120 px), a little larger for drama.
const unitOf = (r) => (r && r.w > 20 ? Math.max(0.45, Math.min(1.3, (r.w / 250) * 1.3)) : 0.7);

function spawnOne(e, anchor, opts) {
  if (parts.length >= MAX_PARTICLES) return;
  const unit = opts.unit ?? unitOf(anchor.unitRect ?? anchor.rect);
  const r = anchor.rect ?? { x: anchor.x - 1, y: anchor.y - 1, w: 2, h: 2 };
  const c = centre(r);
  const dir = anchor.dir ?? { x: 0, y: -1 };
  let x = c.x;
  let y = c.y + rnd(e.offsetY) * r.h;
  let arm = null;
  switch (e.at) {
    case 'card': {
      const a = e.area ?? 1;
      x += (Math.random() - 0.5) * r.w * a;
      y += (Math.random() - 0.5) * r.h * a;
      break;
    }
    case 'edges': {
      // Flames hug the sides and the bottom edge, so the art and numbers stay readable.
      if (Math.random() < 0.35) { x = c.x + (Math.random() - 0.5) * r.w * 0.92; y = c.y + r.h * 0.52; }
      else { x = c.x + (Math.random() < 0.5 ? -1 : 1) * r.w * 0.53; y = c.y + rnd([-0.37, 0.49]) * r.h; }
      break;
    }
    case 'ring': {
      const a = Math.random() * Math.PI * 2;
      const rad = rnd(e.radius) * (r.h / 350);
      x = c.x + Math.cos(a) * rad;
      y = c.y + Math.sin(a) * rad;
      break;
    }
    case 'top': {
      // Anywhere along the top edge (things falling across the whole screen).
      x = r.x + Math.random() * r.w;
      y = r.y - 30;
      break;
    }
    case 'line': {
      // Somewhere along a line (a wall rolling across the board).
      const l = anchor.line;
      if (!l) break;
      const u = Math.random();
      x = l[0].x + (l[1].x - l[0].x) * u;
      y = l[0].y + (l[1].y - l[0].y) * u;
      break;
    }
    case 'dai': {
      // Fire Blast's 大: five arms (up, left, right, and two legs), flames along each.
      const ARMS = [-Math.PI / 2, Math.PI, 0, Math.PI * 0.68, Math.PI * 0.32];
      const a = ARMS[Math.floor(Math.random() * ARMS.length)];
      const along = rnd([0.12, 1]) * r.h * 0.95;
      arm = { x: Math.cos(a), y: Math.sin(a), a };
      x = c.x + arm.x * along;
      y = c.y + arm.y * along;
      break;
    }
    case 'muzzle': {
      const m = anchor.muzzle ?? c;
      x = m.x + (Math.random() - 0.5) * 20;
      y = m.y + (Math.random() - 0.5) * 20;
      break;
    }
    default: break;
  }
  const speed = rnd(e.speed) * (e.dir === 'inward' ? 1 : unit);
  let vx = 0;
  let vy = 0;
  switch (e.dir) {
    case 'up': vx = rnd([-20, 20]); vy = -speed; break;
    case 'radial': {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * speed + dir.x * (e.push ?? 0);
      vy = Math.sin(a) * speed + dir.y * (e.push ?? 0);
      break;
    }
    case 'back': vx = -dir.x * speed; vy = -dir.y * speed; break;
    case 'forward': {
      const a = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * ((e.spreadDeg ?? 0) * Math.PI / 180) * 2;
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
      break;
    }
    case 'inward': vx = (c.x - x) * speed; vy = (c.y - y) * speed; break;
    case 'down': vx = rnd([-6, 6]); vy = speed; break;
    case 'arm': if (arm) { vx = arm.x * speed; vy = arm.y * speed; } break;
    default: break;
  }
  vy -= rnd(e.lift) * unit;
  // A stream that stops at its target (a jet): it lives just long enough to get there.
  let life = rnd(e.life);
  if (e.toTarget && anchor.goal && speed > 0) life = Math.min(life, (Math.hypot(anchor.goal.x - x, anchor.goal.y - y) / speed) * 1000 * rnd([0.92, 1.08]));
  const tintSpec = opts.tint ?? e.tint;
  const tint = tintSpec === 'type' ? hex((anchor.tint ?? ['#ffffff', '#ffffff'])[Math.random() < 0.6 ? 0 : 1])
    : Array.isArray(tintSpec) ? hex(tintSpec[Math.random() < 0.6 ? 0 : 1]) : tintSpec ? hex(tintSpec) : [1, 1, 1];
  const [s0, s1] = e.size ?? [1, 1];
  const sprites = TEX[e.tex]?.sprites;
  let rot = rnd(e.rot);
  if (e.alignBack) rot += Math.atan2(-dir.y, -dir.x) + Math.PI / 2 + rnd([-0.3, 0.3]);
  // Turned to the attack: textures that point up (flames), or that run at texAngle (a water jet).
  if (e.alignForward) rot += Math.atan2(dir.y, dir.x) - (e.texAngle ?? Math.PI / 2);
  if (e.alignArm && arm) rot += arm.a + Math.PI / 2;   // the flame's tip points out along its arm
  // Orbiting particles circle the anchor's centre in perspective (a flattened ring) as they rise.
  const orbit = e.at === 'orbit' ? { cx: c.x, cy: y, a: Math.random() * Math.PI * 2, r: rnd(e.radius) * r.w, w: rnd(e.orbit), rise: rnd(e.rise) * unit } : null;
  if (orbit) { x = orbit.cx + Math.cos(orbit.a) * orbit.r; y = orbit.cy + Math.sin(orbit.a) * orbit.r * 0.38; }
  parts.push({
    tex: e.tex, sprite: sprites ? sprites[Math.floor(Math.random() * sprites.length)] : null,
    x, y, vx, vy, g: (e.gravity ?? 0) * unit, drag: e.drag ?? 0, rot, vr: rnd(e.spin),
    s0: rnd(s0) * unit, s1: rnd(s1) * unit, a0: e.alpha?.[0] ?? 1, a1: e.alpha?.[1] ?? 0,
    life, age: 0, fadeIn: e.fadeIn ?? 0, pivot: e.pivot ?? 0.5, add: e.blend !== 'alpha',
    color: tint, alignVelocity: e.alignVelocity, rate: opts.rate ?? 1, ambient: Boolean(opts.ambient),
    squash: e.squash ?? 1, orbit,
  });
}

// A raw particle (used by the 2D-compatible bursts below).
function push(p) {
  if (parts.length < MAX_PARTICLES) parts.push({ vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0, a0: 1, a1: 0, fadeIn: 0, pivot: 0.5, add: true, color: [1, 1, 1], rate: 1, age: 0, ...p });
}

// The old 2D burst() kinds, drawn on the WebGL layer (sparks, dust, energy,
// sparkles, embers, shards, rings), so every existing effect moves across.
export function burstCompat(x, y, { kind = 'spark', colors = ['#fff3c4'], count = 12, speed = 260, life = 600, size = 3, gravity = 0, up = 0, angle = -Math.PI / 2, spread = Math.PI * 2, area = 0 } = {}) {
  if (!vfxReady() || life <= 0) return;
  const n = Math.max(1, Math.round(count * (reducedMotion() ? 0.35 : 1)));
  const TEXOF = { spark: 'streak', dust: 'smoke', energy: 'glow', sparkle: 'sparkle', ember: 'embers', shard: 'shard', ring: 'shockwave' };
  const tex = TEXOF[kind] ?? 'dot';
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = kind === 'ring' ? 0 : speed * (0.35 + Math.random() * 0.75);
    const px = size * (0.6 + Math.random() * 0.8);
    const w = TEX[tex]?.sprites ? 110 : (TEX[tex]?.w ?? 128);
    const base = { spark: (px * 9) / w, dust: (px * 4.5) / w, energy: (px * 6) / w, sparkle: (px * 2.6) / w, ember: (px * 3) / 110, shard: (px * 2.4) / w, ring: (px * 24) / w }[kind] ?? px / w;
    const sprites = TEX[tex]?.sprites;
    push({
      tex, sprite: sprites ? sprites[Math.floor(Math.random() * sprites.length)] : null,
      x: x + (Math.random() - 0.5) * area, y: y + (Math.random() - 0.5) * area * 0.6,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g: gravity, drag: ['dust', 'sparkle', 'ember'].includes(kind) ? 3.5 : 0,
      rot: Math.random() * Math.PI, vr: kind === 'spark' ? 0 : (Math.random() - 0.5) * 10,
      s0: kind === 'ring' ? base * 0.15 : base, s1: kind === 'ring' ? base : base * (kind === 'dust' ? 2 : 0.4),
      a0: kind === 'dust' ? 0.55 : 1, a1: 0, life: life * (0.6 + Math.random() * 0.6),
      add: !['dust', 'shard'].includes(kind), color: hex(colors[Math.floor(Math.random() * colors.length)]),
      alignVelocity: kind === 'spark',
    });
  }
  wake();
}

// --- Coins and other sprites on a path --------------------------------------------------------

// n coins from `from` to `to` (stage px points), each over `ms`, staggered.
export function coins(from, to, n, ms, onArrive, { tex = 'coin', size = 26, color = null } = {}) {
  if (!vfxReady()) return false;
  for (let i = 0; i < n; i++) {
    const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(from.y, to.y) - 80 - Math.random() * 60 };
    flyers.push({ tex, from, mid, to, t: -i * ms * 0.1, ms, size: size * (tex === 'coin' ? 1 : 0.7 + Math.random() * 0.6), color, arrive: i === n - 1 ? onArrive : null, sprite: Math.floor(Math.random() * 1e6) });
  }
  wake();
  return true;
}

// --- Card motion (tracks) ---------------------------------------------------------------

// Each motion: progress k (0..1) and the context → { x, y, s, r, filter }.
const MOTIONS = {
  windup: (k, c) => { const e = ease.outCubic(k); return { x: -c.dir.x * 46 * e, y: -c.dir.y * 46 * e, s: 1 + 0.07 * e, r: -0.06 * e }; },
  dash: (k, c) => {
    const e = ease.inQuad(k);
    const bx = -c.dir.x * 46;
    const by = -c.dir.y * 46;
    // Infiltrator: arc up and over the guards on the way.
    const hop = c.arc ? -Math.sin(k * Math.PI) * 120 : 0;
    return { x: bx + (c.contact.x - bx) * e, y: by + (c.contact.y - by) * e + hop, s: 1.07 + 0.05 * e, r: -0.06 + 0.1 * e };
  },
  return: (k, c) => { const e = ease.outBack(k); return { x: c.contact.x * (1 - e), y: c.contact.y * (1 - e), s: 1.12 - 0.12 * e, r: 0.04 * (1 - e) }; },
  recoil: (k, c) => {
    const spring = Math.exp(-6 * k) * Math.cos(k * 14);
    const tint = Math.max(0, 1 - k * 2.2) * (c.fire ? 1 : 0.4);
    return { x: c.dir.x * 46 * spring * c.scale, y: c.dir.y * 46 * spring * c.scale, r: 0.09 * spring, filter: tint > 0.01 ? `brightness(${1 + tint * 0.6}) sepia(${tint * 0.7}) saturate(${1 + tint * 1.4}) hue-rotate(-12deg)` : '' };
  },
  rear: (k, c) => { const e = ease.outCubic(k); return { x: -c.dir.x * 30 * e, y: -c.dir.y * 30 * e - 8 * e, s: 1 + 0.05 * e, r: -0.04 * e }; },
  brace: (k, c) => ({ x: -c.dir.x * (30 + Math.sin(k * 60) * 3), y: -c.dir.y * (30 + Math.cos(k * 50) * 3) - 8, s: 1.05, r: -0.04 }),
  settle: (k, c) => { const e = ease.outCubic(k); const f = 1 - e; return { x: (c.from?.x ?? -c.dir.x * 30) * f, y: (c.from?.y ?? -c.dir.y * 30 - 8) * f, s: 1 + 0.05 * f, r: -0.04 * f }; },
  scorched: (k) => {
    const t = Math.max(0, 1 - k) * (0.6 + 0.4 * Math.sin(k * 40));
    return { x: Math.sin(k * 70) * 3 * (1 - k), y: 0, filter: `brightness(${1 + t * 0.9}) sepia(${t * 0.8}) saturate(${1 + t * 1.6}) hue-rotate(-15deg)` };
  },
  cool: (k) => { const t = 1 - ease.outCubic(k); return { filter: `brightness(${1 + 0.35 * t}) saturate(${1 - 0.4 * t})` }; },
  flinchForward: (k, c) => { const e = Math.sin(k * Math.PI); return { x: c.dir.x * 22 * e, y: c.dir.y * 22 * e, s: 1 + 0.04 * e }; },
  // Water Physical: rises inside the column, surges up, crashes down onto the target.
  rise: (k) => { const e = ease.outCubic(k); return { y: -40 * e, s: 1 + 0.05 * e }; },
  surge: (k, c) => { const e = ease.outCubic(k); return { x: -c.dir.x * 20 * e, y: -40 - 80 * e, s: 1.05 + 0.08 * e, r: -0.05 * e }; },
  crash: (k, c) => {
    const e = ease.inQuad(k);
    const sx = -c.dir.x * 20;
    const hop = c.arc ? -Math.sin(k * Math.PI) * 90 : 0;
    return { x: sx + (c.contact.x - sx) * e, y: -120 + (c.contact.y + 120) * e + hop, s: 1.13 - 0.05 * e, r: -0.05 + 0.13 * e };
  },
  // Water: the target is soaked (a springy recoil, washed bright and cool).
  drenched: (k, c) => {
    const spring = Math.exp(-5 * k) * Math.cos(k * 12);
    const t = Math.max(0, 1 - k * 1.6);
    return { x: c.dir.x * 34 * spring * c.scale, y: c.dir.y * 34 * spring * c.scale, r: 0.06 * spring, filter: t > 0.01 ? `brightness(${1 + 0.1 * t}) saturate(${1 - 0.3 * t}) contrast(${1 + 0.08 * t})` : '' };
  },
  // Electric: the card crackles as it charges; the target jolts and flickers.
  charge: (k) => ({ x: Math.sin(k * 120) * 2.5 * k, y: -6 * ease.outCubic(k), s: 1 + 0.04 * k, filter: `brightness(${1 + 0.45 * k * (0.7 + 0.3 * Math.sin(k * 80))})` }),
  shocked: (k) => {
    const t = 1 - k;
    return { x: Math.sin(k * 95) * 5 * t, y: Math.cos(k * 70) * 2 * t, filter: t > 0.02 ? `brightness(${1 + (Math.sin(k * 60) > 0 ? 0.5 : 0.1) * t}) saturate(${1 + 0.3 * t})` : '' };
  },
  // Fighting: three quick jabs at contact distance.
  flurry: (k, c) => { const f = Math.abs(Math.sin(k * Math.PI * 3)); return { x: c.contact.x * (1 - 0.14 * f), y: c.contact.y * (1 - 0.14 * f), s: 1.1 + 0.03 * f, r: 0.04 * Math.sin(k * Math.PI * 6) }; },
  // Dark: melts into shadow, reappears behind the target, slashes, fades back home.
  melt: (k) => ({ y: 10 * k, s: 1 - 0.15 * k, filter: `brightness(${1 - 0.75 * k}) opacity(${1 - 0.95 * k})` }),
  vanish: (k, c) => {
    const o = k < 0.5 ? 0 : (k - 0.5) * 2;
    return { x: c.behind.x, y: c.behind.y, s: 1.05, filter: `brightness(${0.3 + 0.7 * o}) opacity(${o})` };
  },
  strikeBehind: (k, c) => {
    const e = Math.sin(k * Math.PI);
    // Lunge from beside the target into it.
    const vx = c.dir.x * c.len - c.behind.x;
    const vy = c.dir.y * c.len - c.behind.y;
    const l = Math.hypot(vx, vy) || 1;
    return { x: c.behind.x + (vx / l) * 50 * e, y: c.behind.y + (vy / l) * 50 * e, s: 1.05 + 0.04 * e, r: -0.1 * e };
  },
  fadeBack: (k, c) => {
    if (k < 0.45) { const o = 1 - k / 0.45; return { x: c.behind.x, y: c.behind.y, s: 1.05, filter: `brightness(${0.3 + 0.7 * o}) opacity(${o})` }; }
    const o = k < 0.6 ? 0 : (k - 0.6) / 0.4;
    return { filter: o < 1 ? `brightness(${0.3 + 0.7 * o}) opacity(${o})` : '' };
  },
  // Flame Charge: the Pokémon glows hotter as the fire spirals round it.
  charging: (k) => { const t = Math.sin(k * Math.PI); return { y: -10 * t, s: 1 + 0.05 * t, filter: `brightness(${1 + 0.35 * t}) saturate(${1 + 0.5 * t})` }; },
  // Summons: a slam down into the space and a small settle.
  slamDown: (k) => { const e = ease.inQuad(k); return { y: -70 * (1 - e), s: 1.15 - 0.15 * e }; },
  settleLand: (k) => { const b = Math.sin(k * Math.PI) * (1 - k); return { y: 4 * b, s: 1 - 0.03 * b }; },
  // A Legendary: descends large to centre stage, hovers, then shrinks into its space.
  descend: (k, c) => { const e = ease.outCubic(k); return { x: c.toCentre.x, y: c.toCentre.y - 420 * (1 - e), s: 2.6 - 0.4 * e }; },
  hover: (k, c) => ({ x: c.toCentre.x, y: c.toCentre.y + Math.sin(k * Math.PI * 2) * 6, s: 2.2 }),
  shrinkHome: (k, c) => { const e = ease.inQuad(k); return { x: c.toCentre.x * (1 - e), y: c.toCentre.y * (1 - e) - 30 * Math.sin(k * Math.PI), s: 2.2 - 1.2 * e }; },
  // Defeats: charring to ash, washing away, cracking then breaking.
  char: (k) => ({ y: 6 * k, s: 1 - 0.08 * k, filter: `sepia(${k}) brightness(${1 - 0.7 * k}) contrast(${1 + 0.4 * k}) opacity(${1 - k * k})` }),
  washAway: (k) => ({ y: 30 * k, s: 1 + 0.04 * k, filter: `saturate(${1 - 0.7 * k}) brightness(${1 + 0.3 * k}) blur(${2 * k}px) opacity(${1 - k})` }),
  crackShake: (k) => ({ x: Math.sin(k * 80) * 3, filter: `brightness(${1 + 0.4 * k})` }),
  // Grass G4.
  // String Shot or Leech Seed's vines: the target is bound, squeezed and held for a moment.
  bound: (k) => { const t = Math.sin(k * Math.PI); return { x: Math.sin(k * 50) * 2 * t, s: 1 - 0.05 * t, filter: `saturate(${1 - 0.3 * t}) brightness(${1 + 0.1 * t})` }; },
  // Sleep Powder: it sways and dims, with a sleepy blue tint.
  drowsy: (k) => { const t = Math.min(1, k * 2.5); return { r: Math.sin(k * 9) * 0.04 * t, y: 3 * t, filter: `brightness(${1 - 0.25 * t}) saturate(${1 - 0.3 * t}) hue-rotate(${-12 * t}deg)` }; },
  // Synthesis: lit warm and bright from above.
  sunlit: (k) => { const t = Math.sin(k * Math.PI); return { y: -4 * t, filter: `brightness(${1 + 0.45 * t}) sepia(${0.25 * t}) saturate(${1 + 0.4 * t})` }; },
  // Evolving: it glows white and its silhouette pulses, faster as the moment builds.
  silhouette: (k) => {
    const on = Math.min(1, k * 4);
    const pulse = 0.5 + 0.5 * Math.sin(k * k * 46);
    return { s: 1 + 0.06 * on + 0.04 * pulse * k, filter: `brightness(${1 + 9 * on}) saturate(${1 - on}) contrast(${1 - 0.4 * on * pulse}) drop-shadow(0 0 ${8 + 18 * pulse * on}px rgba(255,255,240,${0.9 * on}))` };
  },
  // The new card revealed: the white light fades off it with a small pop.
  revealPop: (k) => { const e = 1 - ease.outCubic(k); return { s: 1 + 0.12 * Math.sin(k * Math.PI) * (1 - k * 0.5), filter: `brightness(${1 + 4 * e}) drop-shadow(0 0 ${20 * e}px rgba(255,255,240,${e}))` }; },
  // Waking up: a little jolt.
  jolt: (k) => { const t = Math.exp(-6 * k) * Math.sin(k * 40); return { y: -10 * Math.abs(t), r: 0.05 * t, filter: `brightness(${1 + 0.3 * (1 - k)})` }; },
  // Defeated by Grass: it wilts, droops and fades into falling leaves.
  wilt: (k) => ({ y: 26 * k, r: 0.12 * k, s: 1 - 0.1 * k, filter: `saturate(${1 - 0.8 * k}) sepia(${0.5 * k}) brightness(${1 - 0.3 * k}) opacity(${1 - k})` }),
  shatterOut: (k) => ({ s: 1 + 0.1 * k, filter: `opacity(${1 - k})` }),
  // Healing: a warm glow lifting the card a little.
  healGlow: (k) => { const t = Math.sin(k * Math.PI); return { y: -4 * t, filter: `brightness(${1 + 0.35 * t}) saturate(${1 + 0.3 * t})` }; },
  healGlowSoft: (k) => { const t = Math.sin(k * Math.PI); return { y: -2 * t, filter: `brightness(${1 + 0.18 * t})` }; },
  // A Trainer flinching: knocked back (away from the hit) and springing back.
  knockBack: (k, c) => {
    const spring = Math.exp(-6 * k) * Math.cos(k * 14);
    const d = c.knock ?? c.dir;
    return { x: d.x * 16 * spring, y: d.y * 16 * spring, r: 0.05 * spring };
  },
  // Normal: a slow, heavy lift, then a drop.
  heave: (k) => { const e = ease.outCubic(k); return { y: -80 * e, s: 1 + 0.14 * e, r: 0.03 * Math.sin(k * 7) * e }; },
  slam: (k, c) => {
    const e = k * k * k;
    const hop = c.arc ? -Math.sin(k * Math.PI) * 60 : 0;
    return { x: c.contact.x * e, y: -80 + (c.contact.y + 80) * e + hop, s: 1.14 - 0.04 * e, r: 0.06 * e };
  },
};
export const MOTION_NAMES = Object.keys(MOTIONS);

function applyMotion(el, m) {
  if (!el) return;
  el.style.transform = m ? `translate(${m.x ?? 0}px, ${m.y ?? 0}px) rotate(${m.r ?? 0}rad) scale(${m.s ?? 1})` : '';
  // Keep the heat shimmer (a CSS filter too) while a motion tints the card.
  const heat = el.classList.contains('vfx-heat') ? ' url(#vfx-heat)' : '';
  el.style.filter = m?.filter ? `${m.filter}${heat}` : '';
}

// --- Heat shimmer on the cards themselves (an SVG displacement filter) -----------------------------

function heatFilter() {
  if (document.getElementById('vfx-heat-svg')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'vfx-heat-svg';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="vfx-heat" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence id="vfx-heat-noise" type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="3"/>
    <feDisplacementMap id="vfx-heat-map" in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
  document.body.append(svg);
}
function heatFrame(now) {
  const noise = document.getElementById('vfx-heat-noise');
  const map = document.getElementById('vfx-heat-map');
  if (!noise || !map) return;
  let strongest = 0;
  for (const [el, k] of heatEls) {
    if (!el.isConnected) { heatEls.delete(el); continue; }
    strongest = Math.max(strongest, k);
  }
  noise.setAttribute('baseFrequency', `${0.012 + 0.002 * Math.sin(now / 300)} ${0.05 + 0.01 * Math.sin(now / 170)}`);
  noise.setAttribute('seed', String(Math.floor(now / 60) % 50));
  map.setAttribute('scale', String(strongest * 16));
}
function setHeat(el, k) {
  if (!el || reducedMotion()) return;
  if (k <= 0) {
    heatEls.delete(el);
    el.classList.remove('vfx-heat');
  } else {
    heatEls.set(el, k);
    el.classList.add('vfx-heat');
  }
}

// --- Timelines ------------------------------------------------------------------------------

const SCORCH_CUES = ['scorch', 'scorchCatch'];

// Plays a library timeline. ctx:
//   attacker / target: card elements (either may be missing)
//   rate: timeline ms per real ms (the speed setting), damage, tint ([main, highlight]),
//   arc (Infiltrator), fire (the hit is Fire), on: { impact, scorch, scorchCatch, counterHit, flare, douse }
// Resolves when it ends or is skipped.
export function playTimeline(idOrDef, ctx) {
  const def = typeof idOrDef === 'string' ? TIMELINES[idOrDef] : idOrDef;
  const id = typeof idOrDef === 'string' ? idOrDef : def?.id;
  if (!def || !vfxReady()) return Promise.resolve();
  const scale = impactScale(ctx.damage);
  const aRect = ctx.attacker ? rectOf(ctx.attacker) : null;
  const tRect = ctx.target ? rectOf(ctx.target) : null;
  const A = aRect ? centre(aRect) : null;
  const B = tRect ? centre(tRect) : null;
  const len = A && B ? Math.hypot(B.x - A.x, B.y - A.y) : 1;
  const dir = A && B ? { x: (B.x - A.x) / len, y: (B.y - A.y) / len } : { x: 0, y: -1 };
  const stop = Math.min(len - 40, (tRect?.w ?? 160) * 0.85 + 20);
  const c = {
    ...ctx, id, scale, dir, aRect, tRect, len,
    contact: { x: dir.x * (len - stop), y: dir.y * (len - stop) },
    tint: ctx.tint ?? ['#ffffff', '#ffd36b'],
    self: ctx.self ?? ctx.attacker,
    muzzle: A ? { x: A.x + dir.x * (aRect.w * 0.45), y: A.y + dir.y * (aRect.h * 0.4) } : null,
    // Feint Attack: where the attacker reappears, beside and just behind the target
    // (relative to its own place), on the side nearer the middle of the board, so it stays in view.
    behind: feintSpot(A, B, dir, len, tRect),
    gRect: ctx.guard ? rectOf(ctx.guard) : null,
    // A Legendary's entrance: from its space to centre stage.
    toCentre: tRect ? { x: 940 - (tRect.x + tRect.w / 2), y: 500 - (tRect.y + tRect.h / 2) } : { x: 0, y: 0 },
    pRect: ctx.pile ? rectOf(ctx.pile) : null,
    regionRect: ctx.region ? rectOf(ctx.region) : null,
    oRect: ctx.overrunTarget ? rectOf(ctx.overrunTarget) : null,
  };
  const anchor = (on) => {
    const at = (el, r) => ({ rect: r ?? (el ? rectOf(el) : null), dir: c.dir, tint: c.tint, muzzle: livePoint('muzzle') });
    switch (on) {
      case 'attacker': return { ...at(null, moved(c.attacker, c.aRect)), muzzle: livePoint('muzzle'), goal: B };
      case 'target': return at(null, moved(c.target, c.tRect));
      case 'impact': return { ...at(null, c.tRect ? { ...c.tRect, x: c.tRect.x - dir.x * 40, y: c.tRect.y - dir.y * 40 } : null) };
      case 'counterImpact': return at(null, c.tRect);
      case 'projectile': return { x: c.proj?.x ?? 0, y: c.proj?.y ?? 0, dir: c.projDir ?? c.dir, tint: c.tint, unitRect: c.aRect };
      case 'behind': return at(null, c.aRect ? { ...c.aRect, x: c.aRect.x + c.behind.x, y: c.aRect.y + c.behind.y } : null);
      case 'guard': return at(null, c.gRect ?? c.tRect);
      case 'card': return { ...at(null, moved(c.attacker, c.aRect)), muzzle: livePoint('muzzle'), goal: B };
      case 'ground': return at(null, c.tRect);
      case 'screen': return { rect: { x: 0, y: 0, w: 1920, h: 1080 }, unitRect: { x: 0, y: 0, w: 200, h: 280 }, dir: { x: 0, y: 1 }, tint: c.tint };
      case 'pile': return at(null, c.pRect);
      case 'sweep': return { rect: c.sw?.unitRect, line: c.sw?.line, dir: c.sw?.dir ?? c.dir, tint: c.tint };
      case 'trainer': return at(null, c.oRect ?? c.tRect);
      default: return at(null, c.tRect);
    }
  };
  // A card's rectangle now, including the motion we're giving it.
  function moved(el, rest) {
    if (!rest) return null;
    const m = el === c.attacker ? c.mA : el === c.target ? c.mT : null;
    return m ? { ...rest, x: rest.x + (m.x ?? 0), y: rest.y + (m.y ?? 0) } : rest;
  }
  function livePoint(name) {
    if (name === 'muzzle' && c.muzzle) return { x: c.muzzle.x + (c.mA?.x ?? 0), y: c.muzzle.y + (c.mA?.y ?? 0) };
    return null;
  }
  const elFor = (track) => (track === 'attacker' ? c.attacker : track === 'target' ? c.target : c.self);
  const handlers = {
    start(beat) {
      if (beat.when && !c.when?.[beat.when]) return;
      if (beat.emit) streams.push({ beat, preset: EMITTERS[beat.emit], name: beat.emit, anchor: () => anchor(beat.on), acc: 0, rate: c.rate, tint: beat.tint, boost: beat.fuller && c.full ? 2 : 1 });
      if (beat.sweep) startSweep(beat, c, anchor);
      if (beat.beam) beams.push({ beat, def: BEAMS[beat.beam], ctx: c });
      if (beat.ribbon) ribbons.push({ beat, def: RIBBONS[beat.ribbon], points: [], active: true, anchor: () => anchor(beat.on), tint: c.tint, ctx: c, unit: unitOf(c.aRect) });
      if (beat.cue === 'heat') setHeat(c.target, 1);
      if (beat.track) c.from = c.mA;
    },
    update(beat, k) {
      if (beat.when && !c.when?.[beat.when]) return;
      if (beat.sweep) { sweepFrame(beat, c, k); return; }
      // In a trade the defender answers with its own counter, so the attack doesn't also recoil it.
      if (beat.track === 'target' && c.trade) return;
      if (beat.track) {
        const m = MOTIONS[beat.motion]?.(k, c);
        if (beat.track === 'attacker' || (beat.track === 'self' && c.self === c.attacker)) c.mA = m;
        else c.mT = m;
        applyMotion(elFor(beat.track), m);
      }
      if (beat.projectile === 'overrun') {
        // Overrun: the leftover blast travels on from the defeated Pokémon into its Trainer.
        if (!c.tRect || !c.oRect) return;
        const P = centre(c.tRect);
        const Q = centre(c.oRect);
        const e = ease.inQuad(k);
        const d = Math.hypot(Q.x - P.x, Q.y - P.y) || 1;
        c.projDir = { x: (Q.x - P.x) / d, y: (Q.y - P.y) / d };
        c.proj = { x: P.x + (Q.x - P.x) * e, y: P.y + (Q.y - P.y) * e - Math.sin(k * Math.PI) * Math.min(80, d * 0.25) };
        push({ tex: 'glow', x: c.proj.x, y: c.proj.y, s0: 0.8, s1: 0.8, life: 40, a0: 0.9, a1: 0.9, color: hex(c.tint[0]) });
        push({ tex: 'glow', x: c.proj.x, y: c.proj.y, s0: 0.35, s1: 0.35, life: 40, a0: 1, a1: 1, color: [1, 1, 1] });
      } else if (beat.projectile && A && B) {
        // An orb, Ember's coal or Fire Blast's fireball, arcing from the muzzle to the target.
        const e = ease.inQuad(k);
        // A coal, a seed and a thrown rock arc high; an orb or a fireball flies flatter.
        const high = ['coal', 'seed', 'rock'].includes(beat.projectile);
        const lift = -Math.sin(k * Math.PI) * Math.min(high ? 220 : 160, len * (high ? 0.45 : 0.3));
        const prev = c.proj;
        c.proj = { x: c.muzzle.x + (B.x - c.muzzle.x) * e, y: c.muzzle.y + (B.y - c.muzzle.y) * e + lift };
        if (prev) { const d = Math.hypot(c.proj.x - prev.x, c.proj.y - prev.y); if (d > 0.5) c.projDir = { x: (c.proj.x - prev.x) / d, y: (c.proj.y - prev.y) / d }; }
        const sz = beat.size ?? 0.9;
        push({ tex: 'glow', x: c.proj.x, y: c.proj.y, s0: sz, s1: sz, life: 40, a0: 1, a1: 1, color: hex(beat.glow ?? c.tint[0]) });
        push({ tex: 'glow', x: c.proj.x, y: c.proj.y, s0: sz * 0.5, s1: sz * 0.5, life: 40, a0: 1, a1: 1, color: [1, 1, 1] });
      }
      if (beat.cue === 'heat') setHeat(c.target, Math.sin(k * Math.PI));
    },
    end(beat) {
      if (beat.sweep) endSweep(beat, c);
      streams = streams.filter((s) => s.beat !== beat);
      beams = beams.filter((b) => b.beat !== beat);
      for (const rb of ribbons) if (rb.beat === beat) rb.active = false;
      if (beat.track) applyMotion(elFor(beat.track), null);
      if (beat.track === 'attacker') c.mA = null;
      if (beat.track === 'target') c.mT = null;
      if (beat.cue === 'heat') setHeat(c.target, 0);
    },
    fire(beat, { skipped }) {
      // The Scorch beats only play when the attack applies Burn.
      if (SCORCH_CUES.includes(beat.cue) && !c.scorch) return;
      if (beat.when && !c.when?.[beat.when]) return;
      if (beat.on === 'guard' && !c.gRect) { if (beat.cue) c.on?.[beat.cue]?.({ skipped }); return; }
      if (!skipped && beat.emit) emit(beat.emit, anchor(beat.on), { scale: c.scale, countScale: beat.countScale, rate: c.rate, tint: beat.tint === 'type' ? 'type' : beat.tint });
      if (beat.cue) cue(beat, c, anchor, skipped);
    },
  };
  // Without Scorch, the timeline ends once everything but its Scorch beats is done.
  const cut = c.scorch || !def.beats.some((b) => SCORCH_CUES.includes(b.cue)) ? Infinity
    : Math.max(...def.beats.filter((b) => !SCORCH_CUES.includes(b.cue)).map((b) => b.end ?? b.at));
  return new Promise((resolve) => {
    const tl = new Timeline(def, { handlers: { ...handlers, done: () => {} }, scale });
    running.push({ tl, ctx: c, rate: c.rate ?? 1, resolve, cut });
    wake();
  });
}

function feintSpot(A, B, dir, len, tRect) {
  if (!A || !B) return { x: 0, y: 0 };
  const w = tRect?.w ?? 120;
  const h = tRect?.h ?? 168;
  let px = -dir.y;
  let py = dir.x;
  if ((B.x + px * w) > 1500 || (B.x + px * w) < 380 || Math.abs(B.x + px * w - 940) > Math.abs(B.x - px * w - 940)) { px = -px; py = -py; }
  return { x: dir.x * (len + h * 0.18) + px * w * 1.02, y: dir.y * (len + h * 0.18) + py * w * 1.02 };
}

// --- Sweeps: a wall rolling across the board (Heat Wave, Surf) -----------------------------
//
// The wall starts at the caster's edge of the region (ctx.region) and rolls to
// the far edge, slanting so the far end trails (cards are hit one after another).
// Each card in ctx.sweepTargets ({ el, side: 'enemy' | 'friend' }) is hit as the
// wall passes it: its hit emitters burst and on.sweepHit({ index }) is called.
function startSweep(beat, c, anchor) {
  const def = SWEEPS[beat.sweep];
  const r = c.regionRect;
  if (!def || !r) return;
  const sgn = c.casterBelow === false ? 1 : -1;   // the player's side is at the bottom: walls roll up
  c.sw = { def, r, sgn, hit: new Set(), dir: { x: 0, y: sgn }, unitRect: c.tRect ?? { x: 0, y: 0, w: 130, h: 180 } };
  for (const name of def.line) streams.push({ beat, preset: EMITTERS[name], name, anchor: () => anchor('sweep'), acc: 0, rate: c.rate, boost: 1 });
}
// How far the wall has travelled to reach a point (px from the caster's edge, plus the slant).
function sweepDistance(sw, p) {
  const fromEdge = sw.sgn > 0 ? p.y - sw.r.y : sw.r.y + sw.r.h - p.y;
  return fromEdge + sw.def.skew * ((p.x - sw.r.x) / sw.r.w);
}
function sweepFrame(beat, c, k) {
  const sw = c.sw;
  if (!sw) return;
  const travel = (sw.r.h + sw.def.skew) * k;
  const edge = sw.sgn > 0 ? sw.r.y : sw.r.y + sw.r.h;
  const yAt = (x) => edge + sw.sgn * (travel - sw.def.skew * ((x - sw.r.x) / sw.r.w));
  sw.line = [{ x: sw.r.x, y: yAt(sw.r.x) }, { x: sw.r.x + sw.r.w, y: yAt(sw.r.x + sw.r.w) }];
  // The wall itself: a texture tiled along it (Surf's wave), or heat shimmer.
  if (sw.def.sprite && TEX[sw.def.sprite]) {
    const T = TEX[sw.def.sprite];
    const n = sw.def.tiles ?? 4;
    const tw = (sw.r.w / n) * 1.25;
    const th = tw * (T.h / T.w);
    for (let i = 0; i < n; i++) {
      const x = sw.r.x + (i + 0.5) * (sw.r.w / n);
      push({ tex: sw.def.sprite, x, y: yAt(x) - sw.sgn * th * 0.25, s0: tw / T.w, s1: tw / T.w, life: 34, a0: 0.95, a1: 0.95, add: false, rate: 1 });
    }
  }
  if (sw.def.distort === 'heat' && !reducedMotion()) {
    for (let i = 0; i < 5; i++) {
      const x = sw.r.x + ((i + Math.random()) / 5) * sw.r.w;
      push({ tex: 'heat-map', distort: true, x, y: yAt(x) + sw.sgn * 20, s0: 2.4, s1: 2.6, life: 60, a0: 0.8, a1: 0, rate: 1 });
    }
  }
  (c.sweepTargets ?? []).forEach((t, i) => {
    if (sw.hit.has(i) || !t.el?.isConnected) return;
    const p = centre(rectOf(t.el));
    if (sweepDistance(sw, p) <= travel) hitBySweep(c, t, i, false);
  });
}
function hitBySweep(c, t, i, skipped) {
  const sw = c.sw;
  sw.hit.add(i);
  if (!skipped) {
    const rect = rectOf(t.el);
    for (const name of sw.def.hit[t.side] ?? []) emit(name, { rect, dir: sw.dir, tint: c.tint }, { scale: c.scale, rate: c.rate });
    if (t.side === 'enemy' && sw.def.distort === 'heat') setHeat(t.el, 0.8);
  }
  c.on?.sweepHit?.({ index: i, skipped });
}
function endSweep(beat, c) {
  const sw = c.sw;
  if (!sw) return;
  // Anything the wall didn't reach (a skip) is hit now, so every number still lands.
  (c.sweepTargets ?? []).forEach((t, i) => { if (!sw.hit.has(i)) hitBySweep(c, t, i, true); });
  for (const t of c.sweepTargets ?? []) setHeat(t.el, 0);
  streams = streams.filter((s) => s.beat !== beat);
  c.sw = null;
}

// Where each moment happens, and its flash colour.
const CUE_ANCHOR = { counterHit: 'counterImpact', impact: 'impact', jab: 'impact', overrunHit: 'trainer', infiltrate: 'guard', shell: 'target', bolt: 'attacker', land: 'ground', fall: 'ground' };
const FLASH = {
  fire: [1, 0.6, 0.25], water: [0.55, 0.8, 1], electric: [1, 0.95, 0.5], dark: [0.72, 0.45, 1], white: [1, 1, 1],
  grass: [0.6, 1, 0.45], rock: [0.95, 0.85, 0.6], sun: [1, 0.95, 0.6],
};

function cue(beat, c, anchor, skipped) {
  c.on?.[beat.cue]?.({ skipped });
  if (skipped) return;
  // For checks and recordings: a 'vfxcue' event on the canvas at each moment (e.g. the impact).
  canvasEl?.dispatchEvent(new CustomEvent('vfxcue', { detail: { cue: beat.cue, timeline: c.id } }));
  const at = anchor(CUE_ANCHOR[beat.cue] ?? 'target');
  const r = at.rect;
  const p = r ? centre(r) : { x: at.x, y: at.y };
  const k = (c.scale ?? 1) * unitOf(r ?? c.tRect);
  if (beat.shake && !reducedMotion()) shake = { amp: beat.shake * 0.7 * (c.scale ?? 1), t: 0, dur: 300 + 60 * (c.scale ?? 1) };
  if (beat.flash) {
    const col = FLASH[beat.flash] ?? (beat.flash === 'type' ? hex(c.tint[1]) : [1, 0.95, 0.85]);
    push({ tex: 'glow', x: p.x, y: p.y, s0: 1.4 * k, s1: 2.4 * k, life: 240, a0: 0.55, a1: 0, color: col, rate: c.rate });
  }
  if (beat.bloom) bloomPulse = Math.max(bloomPulse, beat.bloom * k);
  // A one-frame white flicker over the whole stage (the lightning bolt).
  if (beat.flicker && !reducedMotion()) {
    const s = 4200 / (TEX.glow?.w ?? 128);
    push({ tex: 'glow', x: 960, y: 540, s0: s, s1: s, life: 45, a0: 0.42, a1: 0.42, color: [1, 1, 1], rate: 1 });
  }
  if (beat.distort === 'shockwave' && !reducedMotion()) {
    push({ tex: 'ring-map', distort: true, x: p.x, y: p.y, s0: 0.6, s1: 5 * k, life: 420, a0: 1, a1: 0, rate: c.rate });
  }
}

// Every timeline still playing jumps to its end (click-to-skip).
export function skipTimelines() {
  for (const r of running) r.tl.skip();
  settleTimelines();
}

function settleTimelines() {
  const done = running.filter((r) => r.tl.done);
  running = running.filter((r) => !r.tl.done);
  for (const r of done) {
    beams = beams.filter((b) => b.ctx !== r.ctx);
    applyMotion(r.ctx.attacker, null);
    applyMotion(r.ctx.target, null);
    setHeat(r.ctx.target, 0);
    r.resolve();
  }
}

// --- Status visuals (ambient) ------------------------------------------------------------

// Finds every card on the board with a status visual (data-status-<id>="level")
// and keeps its ambient effect going. Called after each redraw.
export function syncStatus(root) {
  if (!vfxReady()) return;
  const found = [];
  for (const id of Object.keys(STATUS_VISUALS)) {
    for (const el of root.querySelectorAll(`.table .card[data-status-${id}]`)) {
      if (el.closest('.hand') || el.closest('#fx')) continue;
      const level = Number(el.getAttribute(`data-status-${id}`)) || 0;
      if (!level) continue;
      const was = ambient.find((a) => a.el === el && a.id === id);
      found.push(was ? Object.assign(was, { level }) : { el, id, level, acc: {} });
    }
  }
  ambient = found;
  if (ambient.length) wake();
}

function ambientFrame(dt) {
  for (const a of ambient) {
    if (!a.el.isConnected) continue;
    const v = STATUS_VISUALS[a.id];
    const lv = v.levels[a.level];
    const rect = rectOf(a.el);
    const anchor = { rect, dir: { x: 0, y: -1 } };
    for (const [part, preset] of Object.entries(v.ambient)) {
      const e = EMITTERS[preset];
      const rate = e.rate * (lv[part] ?? 0) * (reducedMotion() ? 0.35 : 1) * (rect.w / 160);
      a.acc[part] = (a.acc[part] ?? 0) + rate * dt / 1000;
      while (a.acc[part] >= 1) {
        a.acc[part] -= 1;
        spawnOne(e, anchor, { ambient: true });
      }
    }
  }
  ambient = ambient.filter((a) => a.el.isConnected);
}

// --- The loop --------------------------------------------------------------------------------

function wake() {
  if (!vfxReady() || frame) return;
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

function alive() {
  return parts.length || streams.length || ribbons.length || beams.length || flyers.length || running.length || ambient.length || shake || heatEls.size;
}

// While the only thing alive is ambient (burning cards smouldering), the layer
// redraws at 30 fps: every other frame. Attacks and bursts get every frame.
let odd = false;
function ambientOnly() {
  return !running.length && !streams.length && !ribbons.length && !beams.length && !flyers.length && !shake && !heatEls.size
    && parts.every((p) => p.ambient);
}

function tick(now) {
  frame = 0;
  odd = !odd;
  if (odd && ambientOnly() && ambient.length) {
    frame = requestAnimationFrame(tick);
    return;
  }
  const dt = Math.min(50, now - last);
  last = now;
  // Hit-stop: while a timeline holds, only it moves (to use up the hold); everything else freezes.
  const holding = running.some((r) => r.tl.holding);
  for (const r of running) {
    if (!holding || r.tl.holding) r.tl.advance(dt * r.rate);
    if (r.tl.t >= r.cut) r.tl.skip();
  }
  settleTimelines();
  const sdt = holding ? 0 : dt;
  if (!holding) {
    streamFrame(sdt);
    ambientFrame(sdt);
  }
  simulate(sdt);
  shakeFrame(dt);
  heatFrame(now);
  if (vfxReady()) R.render(collect());
  bloomPulse = Math.max(0, bloomPulse - dt / 400);
  if (alive()) frame = requestAnimationFrame(tick);
  else R?.clear();
}

function streamFrame(dt) {
  for (const s of streams) {
    const rate = (s.preset.rate ?? 0) * (reducedMotion() ? 0.35 : 1) * s.rate * (s.boost ?? 1);
    s.acc += rate * dt / 1000;
    const anchor = s.anchor();
    while (s.acc >= 1) {
      s.acc -= 1;
      spawnOne(s.preset, anchor, { rate: s.rate, tint: s.tint });
    }
  }
  for (const rb of ribbons) {
    const life = rb.def.life;
    for (const p of rb.points) p.age += dt * (rb.ctx?.rate ?? 1);
    if (rb.active) {
      const a = rb.anchor();
      const pt = a.rect ? centre(a.rect) : { x: a.x, y: a.y };
      if (rb.def.toTarget && rb.ctx?.tRect && rb.ctx.muzzle) {
        // A stream: from the muzzle to the target, wavering.
        rb.points = [];
        const m = a.muzzle ?? rb.ctx.muzzle;
        const t = centre(rb.ctx.tRect);
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          // A twisting strand: wobble (px) and phase let two strands spiral round each other.
          const amp = rb.def.wobble ? rb.def.wobble * Math.sin(k * Math.PI) : 10 * k;
          const wob = Math.sin(performance.now() / 45 + i + (rb.def.phase ?? 0)) * amp;
          rb.points.push({ x: m.x + (t.x - m.x) * k - rb.ctx.dir.y * wob, y: m.y + (t.y - m.y) * k + rb.ctx.dir.x * wob, age: life * 0.3 * (1 - k) });
        }
      } else {
        rb.points.push({ ...pt, age: 0 });
      }
    }
    rb.points = rb.points.filter((p) => p.age < life);
  }
  ribbons = ribbons.filter((rb) => rb.active || rb.points.length);
}

function simulate(dt) {
  for (const p of parts) {
    const d = dt * p.rate;
    p.age += d;
    p.vy += p.g * d / 1000;
    if (p.drag) { const f = Math.max(0, 1 - p.drag * d / 1000); p.vx *= f; p.vy *= f; }
    if (p.orbit) {
      const o = p.orbit;
      o.a += o.w * d / 1000;
      o.cy -= o.rise * d / 1000;
      p.x = o.cx + Math.cos(o.a) * o.r;
      p.y = o.cy + Math.sin(o.a) * o.r * 0.38;
    } else {
      p.x += p.vx * d / 1000;
      p.y += p.vy * d / 1000;
    }
    p.rot += p.vr * d / 1000;
  }
  parts = parts.filter((p) => p.age < p.life);
  for (const f of flyers) {
    f.t += dt;
    if (f.t >= f.ms && !f.landed) { f.landed = true; f.arrive?.(); }
  }
  flyers = flyers.filter((f) => !f.landed);
}

function shakeFrame(dt) {
  const table = document.querySelector('#app .table');
  if (!shake) return;
  shake.t += dt;
  const k = 1 - shake.t / shake.dur;
  if (k <= 0) {
    shake = null;
    if (table) table.style.translate = '';
    if (canvasEl) canvasEl.style.translate = '';
    return;
  }
  const a = shake.amp * k * k;
  const off = `${(Math.random() * 2 - 1) * a}px ${(Math.random() * 2 - 1) * a}px`;
  if (table) table.style.translate = off;
  if (canvasEl) canvasEl.style.translate = off;
}

// --- Building the frame ------------------------------------------------------------------------

function quad(tex, x, y, w, h, rot, pivot, uv, color, alpha, add) {
  const ax = w / 2;
  const ay = h * pivot;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const corner = (cx, cy) => [x + cx * cos - cy * sin, y + cx * sin + cy * cos];
  const p = [...corner(-ax, -ay), ...corner(w - ax, -ay), ...corner(w - ax, h - ay), ...corner(-ax, h - ay)];
  return { tex, p, uv, c: [color[0], color[1], color[2], alpha], add };
}

function collect() {
  const alpha = [];
  const additive = [];
  const distort = [];
  for (const p of parts) {
    const t = p.age / p.life;
    const fade = p.fadeIn ? clamp01(p.age / p.fadeIn) : 1;
    const a = Math.max(0, (p.a0 + (p.a1 - p.a0) * t) * fade);
    const s = p.s0 + (p.s1 - p.s0) * ease.outCubic(t);
    const T = TEX[p.tex] ?? TEX.dot;
    let w;
    let h;
    let uv = [0, 0, 1, 1];
    if (p.sprite) {
      const [sx, sy, sw, sh] = p.sprite;
      w = sw * s; h = sh * s;
      uv = [sx / T.w, sy / T.h, (sx + sw) / T.w, (sy + sh) / T.h];
    } else { w = T.w * s; h = T.h * s; }
    h *= p.squash ?? 1;
    let rot = p.rot;
    if (p.alignVelocity) {
      rot = Math.atan2(p.vy, p.vx);
      const v = Math.hypot(p.vx, p.vy);
      w *= 1 + Math.min(3, v / 400);
    }
    const q = quad(p.tex, p.x, p.y, w, h, rot, p.pivot, uv, p.color, a, p.add);
    (p.distort ? distort : p.add ? additive : alpha).push(q);
  }
  for (const rb of ribbons) ribbonQuads(rb, additive);
  for (const b of beams) beamQuads(b, additive);
  for (const f of flyers) {
    if (f.t < 0) continue;
    const k = clamp01(f.t / f.ms);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const x = (1 - e) ** 2 * f.from.x + 2 * (1 - e) * e * f.mid.x + e * e * f.to.x;
    const y = (1 - e) ** 2 * f.from.y + 2 * (1 - e) * e * f.mid.y + e * e * f.to.y;
    const sz = f.size * (0.6 + 0.6 * Math.sin(k * Math.PI));
    if (f.tex === 'coin') {
      alpha.push(quad('coin', x, y, sz * Math.abs(Math.cos(f.t / 90)) + 4, sz, 0, 0.5, [0, 0, 1, 1], [1, 1, 1], 1, false));
      additive.push(quad('glow', x, y, sz * 1.6, sz * 1.6, 0, 0.5, [0, 0, 1, 1], [1, 0.8, 0.3], 0.35, true));
    } else {
      // A piece of a defeated card drifting to the Released Pile.
      const T = TEX[f.tex] ?? TEX.dot;
      const sp = T.sprites?.[(f.sprite ?? 0) % T.sprites.length];
      const uv = sp ? [sp[0] / T.w, sp[1] / T.h, (sp[0] + sp[2]) / T.w, (sp[1] + sp[3]) / T.h] : [0, 0, 1, 1];
      // Glowing flyers (embers, Growth motes) are light; the rest are solid pieces.
      const add = f.tex === 'embers' || f.tex === 'glow';
      (add ? additive : alpha).push(quad(f.tex, x, y, sz, sz, f.t / 120, 0.5, uv, f.color ? hex(f.color) : [1, 1, 1], 1 - k * 0.5, add));
      if (f.tex === 'glow') additive.push(quad('glow', x, y, sz * 0.45, sz * 0.45, 0, 0.5, [0, 0, 1, 1], [1, 1, 0.9], 1 - k * 0.3, true));
    }
  }
  additive.sort((a, b) => (a.tex < b.tex ? -1 : a.tex > b.tex ? 1 : 0));
  // Keep the Burn numbers readable: dim effects over every status token.
  const keep = [];
  for (const a of ambient) {
    const tok = a.el.querySelector('.burn-token');
    if (tok && keep.length < 8) { const r = rectOf(tok); keep.push([r.x - 2, r.y - 2, r.w + 4, r.h + 4]); }
  }
  return {
    quads: [...alpha, ...additive],
    distort: reducedMotion() ? [] : distort,
    bloom: 0.5 + bloomPulse * 0.7,
    distortAmount: reducedMotion() ? 0 : 0.035,
    keep,
  };
}

// A beam: its texture stretched from the attacker's muzzle (moving with it) to
// the target, turned to the attack, flickering and jittering like a real bolt.
function beamQuads(b, out) {
  const c = b.ctx;
  const T = TEX[b.def.tex];
  if (!T || !c.tRect || !c.muzzle) return;
  const m = { x: c.muzzle.x + (c.mA?.x ?? 0), y: c.muzzle.y + (c.mA?.y ?? 0) };
  const t = centre(c.tRect);
  const L = Math.hypot(t.x - m.x, t.y - m.y);
  if (L < 10) return;
  const ang = Math.atan2(t.y - m.y, t.x - m.x);
  const j = b.def.jitter ?? 0;
  const mid = { x: (m.x + t.x) / 2 + (Math.random() - 0.5) * j, y: (m.y + t.y) / 2 + (Math.random() - 0.5) * j };
  // The texture's art runs at texAngle: scale it so that run spans the gap.
  const w = (L / Math.cos(b.def.texAngle ?? 0)) * 1.04;
  const h = w * (T.h / T.w) * (b.def.thickness ?? 1) * 0.6;
  const flip = Math.random() < 0.5;
  const uv = flip ? [0, 1, 1, 0] : [0, 0, 1, 1];
  const a = b.def.flicker ? 0.65 + Math.random() * 0.35 : 1;
  const rot = ang - (b.def.texAngle ?? 0) * (flip ? -1 : 1);
  out.push(quad('glow', mid.x, mid.y, L * 1.25, Math.max(90, L * 0.35), ang, 0.5, [0, 0, 1, 1], hex(b.def.glow ?? b.def.color), 0.25 * a, true));
  out.push(quad(b.def.tex, mid.x, mid.y, w, h, rot, 0.5, uv, hex(b.def.color), a, true));
  // A second, fainter fork alongside (mirrored), so the bolt reads as forked.
  out.push(quad(b.def.tex, mid.x, mid.y, w * 0.9, h * 0.8, ang + (b.def.texAngle ?? 0) * (flip ? -1 : 1), 0.5, flip ? [0, 0, 1, 1] : [0, 1, 1, 0], hex(b.def.glow ?? b.def.color), 0.55 * a, true));
}

function ribbonQuads(rb, out) {
  const pts = rb.points;
  if (pts.length < 2) return;
  const col = hex(rb.def.color === 'type' ? rb.tint[0] : rb.def.color);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const wa = rb.def.width * (rb.unit ?? 1) * 0.5 * (1 - a.age / rb.def.life);
    const wb = rb.def.width * (rb.unit ?? 1) * 0.5 * (1 - b.age / rb.def.life);
    const alpha = (rb.def.alpha ?? 0.6) * (1 - b.age / rb.def.life);
    const u0 = (i - 1) / pts.length;
    const u1 = i / pts.length;
    out.push({
      tex: rb.def.tex,
      p: [a.x + nx * wa, a.y + ny * wa, b.x + nx * wb, b.y + ny * wb, b.x - nx * wb, b.y - ny * wb, a.x - nx * wa, a.y - ny * wa],
      uv: [0.15 + u0 * 0.7, 0, 0.15 + u1 * 0.7, 1], c: [...col, alpha], add: true,
    });
  }
}

// Clears everything (a new match).
export function clearVfx() {
  for (const r of running) r.tl.skip();
  settleTimelines();
  parts = [];
  streams = [];
  ribbons = [];
  beams = [];
  flyers = [];
  ambient = [];
  shake = null;
  for (const el of heatEls.keys()) el.classList.remove('vfx-heat');
  heatEls = new Map();
  R?.clear();
}
