// Particles for combat and effects. With WebGL they're drawn on the effects
// layer (vfx/engine.js); without it, here on a 2D canvas over the stage (the
// fallback). The 2D loop only runs while particles are alive, the total is
// capped, and "reduce motion" (an operating-system setting) means far fewer.

import { STAGE } from './render.js';
import { vfxReady, burstCompat } from './vfx/engine.js';

const MAX_PARTICLES = 420;
const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

export function reducedMotion() {
  return motion.matches;
}

let parts = [];
let frame = 0;
let last = 0;

const canvas = () => document.getElementById('particles');

// A burst at (x, y), stage px.
//   kind     'spark' streaks · 'dust' soft puffs · 'energy' glowing orbs ·
//            'sparkle' rising stars · 'ember' rising embers · 'shard' tumbling pieces · 'ring' one expanding ring
//   colors   list of CSS colours to pick from
//   count, speed (px/s), life (ms), size (px), gravity (px/s²), up (bias upwards), spread (radians around `angle`)
export function burst(x, y, {
  kind = 'spark', colors = ['#fff3c4'], count = 12, speed = 260, life = 600, size = 3,
  gravity = 0, up = 0, angle = -Math.PI / 2, spread = Math.PI * 2, area = 0,
} = {}) {
  if (vfxReady()) {
    burstCompat(x, y, { kind, colors, count, speed, life, size, gravity, up, angle, spread, area });
    return;
  }
  if (!canvas() || life <= 0) return;
  const n = Math.max(1, Math.round(count * (reducedMotion() ? 0.35 : 1)));
  for (let i = 0; i < n && parts.length < MAX_PARTICLES; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.35 + Math.random() * 0.75);
    parts.push({
      kind,
      x: x + (Math.random() - 0.5) * area,
      y: y + (Math.random() - 0.5) * area * 0.6,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - up,
      g: gravity,
      age: 0,
      life: life * (0.6 + Math.random() * 0.6),
      size: size * (0.6 + Math.random() * 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 10,
    });
  }
  if (!frame) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
}

// Particles along the edge of a rectangle (a card burning away, a ring of dust).
export function edgeBurst(r, opts) {
  const n = opts.count ?? 20;
  for (let i = 0; i < n; i++) {
    const side = i % 4;
    const s = Math.random();
    const x = side === 0 ? r.x + s * r.w : side === 1 ? r.x + r.w : side === 2 ? r.x + s * r.w : r.x;
    const y = side === 0 ? r.y : side === 1 ? r.y + s * r.h : side === 2 ? r.y + r.h : r.y + s * r.h;
    burst(x, y, { ...opts, count: 1 });
  }
}

export function clearParticles() {
  parts = [];
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  const c = canvas();
  c?.getContext('2d').clearRect(0, 0, STAGE.width, STAGE.height);
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const c = canvas();
  if (!c) { frame = 0; return; }
  const g = c.getContext('2d');
  g.clearRect(0, 0, STAGE.width, STAGE.height);
  parts = parts.filter((p) => (p.age += dt * 1000) < p.life);
  for (const p of parts) {
    p.vy += p.g * dt;
    if (p.kind === 'dust' || p.kind === 'sparkle' || p.kind === 'ember') { p.vx *= 0.94; p.vy *= 0.94; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    draw(g, p, 1 - p.age / p.life);
  }
  if (parts.length) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
    g.clearRect(0, 0, STAGE.width, STAGE.height);
  }
}

function draw(g, p, left) {
  g.globalAlpha = Math.max(0, Math.min(1, left * 1.4));
  g.globalCompositeOperation = p.kind === 'spark' || p.kind === 'energy' || p.kind === 'sparkle' || p.kind === 'ember' ? 'lighter' : 'source-over';
  g.fillStyle = p.color;
  g.strokeStyle = p.color;
  switch (p.kind) {
    case 'spark': {
      g.lineWidth = p.size * 0.7;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      g.stroke();
      break;
    }
    case 'energy': {
      const r = p.size * (1.4 - left * 0.4);
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, p.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'dust': {
      g.globalAlpha *= 0.55;
      g.beginPath();
      g.arc(p.x, p.y, p.size * (2 - left), 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'sparkle': {
      const s = p.size * (0.6 + left * 0.6);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.moveTo(0, 0);
        g.quadraticCurveTo(s * 0.18, s * 0.18, s, 0);
        g.quadraticCurveTo(s * 0.18, -s * 0.18, 0, 0);
      }
      g.fill();
      g.restore();
      break;
    }
    case 'ember': {
      g.beginPath();
      g.arc(p.x, p.y, p.size * left + 0.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'shard': {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.beginPath();
      g.moveTo(-p.size, -p.size * 0.6);
      g.lineTo(p.size, -p.size * 0.2);
      g.lineTo(-p.size * 0.2, p.size);
      g.closePath();
      g.fill();
      g.restore();
      break;
    }
    case 'ring': {
      g.lineWidth = 3 * left + 0.5;
      g.beginPath();
      g.ellipse(p.x, p.y, (1 - left) * p.size * 12 + 4, ((1 - left) * p.size * 12 + 4) * 0.35, 0, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    default:
      break;
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
