// Weather on the board (docs/vfx.md section 6, item 3): ambient Rain and Sun,
// behind the cards, never hiding them or their numbers. Each grows at the
// Weather brackets (2, 4, 6, 8); both show at once, each at its own level.
//
//   Rain  streaks across the board, with small splash ripples on the mat;
//         8 is a downpour with the odd distant lightning flicker.
//   Sun   warm light shafts and heat haze on the mat; 8 is a strong glare.
//
// The levels are pure data (tested in Node); the drawing is a layer inside the
// arena, under the Pokémon and Trainers: a 2D canvas for the rain, light
// shafts and glare as CSS, and the heat haze as an SVG displacement filter on
// the mat only. Reduced motion (the OS setting) keeps a static tint.

export const BRACKETS = [2, 4, 6, 8];

// 0 below 2, then 1–4 at each bracket reached.
export function weatherLevel(count) {
  return BRACKETS.filter((at) => (count ?? 0) >= at).length;
}

// The level of each type, from the Weather counts (weatherState in the engine).
export function weatherLevels(weather) {
  return { rain: weatherLevel(weather?.Rain?.count), sun: weatherLevel(weather?.Sun?.count) };
}

// What each level looks like. Rain: drops on screen at once, their speed and
// length (stage px), how strong, ripples per second; lightning at 8.
export const RAIN_LEVELS = [null,
  { name: 'Light drizzle', drops: 45, speed: [650, 850], length: [10, 16], alpha: 0.3, ripples: 2, tint: 0.04 },
  { name: 'Steady rain', drops: 120, speed: [850, 1100], length: [16, 24], alpha: 0.4, ripples: 6, tint: 0.07 },
  { name: 'Heavy rain', drops: 240, speed: [1050, 1350], length: [22, 32], alpha: 0.5, ripples: 12, tint: 0.1 },
  { name: 'Downpour', drops: 400, speed: [1250, 1650], length: [28, 42], alpha: 0.58, ripples: 20, tint: 0.14, lightning: true },
];
// Sun: light shafts, their strength, heat haze (displacement px on the mat), glare.
export const SUN_LEVELS = [null,
  { name: 'Warm light', shafts: 2, shaftAlpha: 0.1, haze: 0, glare: 0, tint: 0.03 },
  { name: 'Bright sun', shafts: 3, shaftAlpha: 0.14, haze: 3, glare: 0.06, tint: 0.05 },
  { name: 'Blazing sun', shafts: 4, shaftAlpha: 0.18, haze: 6, glare: 0.14, tint: 0.08 },
  { name: 'Glare', shafts: 5, shaftAlpha: 0.24, haze: 10, glare: 0.3, tint: 0.11 },
];

// --- On the page ------------------------------------------------------------------------------

const W = 1340;   // the arena, in stage px
const H = 860;
let layer = null;     // persistent: moved into each newly drawn arena
let canvas = null;
let g = null;
let levels = { rain: 0, sun: 0 };
let frame = 0;
let last = 0;
let drops = [];
let ripples = [];
let rippleAcc = 0;
let nextFlash = 0;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = ([a, b]) => a + Math.random() * (b - a);

function build() {
  layer = document.createElement('div');
  layer.className = 'weather-layer';
  layer.innerHTML = `<div class="wx-tint"></div><div class="wx-shafts"></div><canvas width="${W}" height="${H}"></canvas><div class="wx-glare"></div><div class="wx-flash"></div>`;
  canvas = layer.querySelector('canvas');
  g = canvas.getContext('2d');
  if (!document.getElementById('weather-haze-svg')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'weather-haze-svg';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="weather-haze" x="0" y="0" width="100%" height="100%">
      <feTurbulence id="weather-haze-noise" type="fractalNoise" baseFrequency="0.008 0.03" numOctaves="2" seed="5"/>
      <feDisplacementMap id="weather-haze-map" in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
    document.body.append(svg);
  }
}

// After every redraw: put the layer into the new arena (behind the cards) and
// show the current levels. weather: the engine's weatherState, or null (no match).
export function syncWeather(root, weather) {
  if (typeof document === 'undefined') return;
  const arena = root.querySelector('.arena');
  const next = weather ? weatherLevels(weather) : { rain: 0, sun: 0 };
  if (!layer) build();
  if (!arena) { stop(); layer.remove(); return; }
  if (layer.parentNode !== arena) {
    const mats = arena.querySelectorAll('.mat');
    if (mats.length) mats[mats.length - 1].after(layer);
    else arena.prepend(layer);
  }
  levels = next;
  const rain = RAIN_LEVELS[levels.rain];
  const sun = SUN_LEVELS[levels.sun];
  const still = reduced();
  layer.dataset.rain = levels.rain;
  layer.dataset.sun = levels.sun;
  layer.classList.toggle('static', still);
  // A static tint (all that shows with reduced motion): cool for Rain, warm for Sun.
  const tint = layer.querySelector('.wx-tint');
  tint.style.background = [
    rain && `linear-gradient(rgba(70, 120, 190, ${rain.tint * (still ? 1.6 : 1)}), rgba(40, 80, 140, ${rain.tint * (still ? 1.8 : 1.2)}))`,
    sun && `radial-gradient(ellipse 90% 80% at 20% 0%, rgba(255, 200, 110, ${sun.tint * (still ? 2.4 : 1.5)}), transparent 70%)`,
  ].filter(Boolean).join(', ') || 'none';
  // Light shafts and glare (CSS; they sway slowly).
  const shafts = layer.querySelector('.wx-shafts');
  const n = still ? 0 : sun?.shafts ?? 0;
  if (shafts.children.length !== n) {
    shafts.innerHTML = Array.from({ length: n }, (_, i) => `<i style="left:${8 + i * (78 / Math.max(1, n - 1 || 1))}%;animation-delay:${-i * 2.3}s;animation-duration:${9 + i * 1.7}s"></i>`).join('');
  }
  shafts.style.setProperty('--shaft', sun?.shaftAlpha ?? 0);
  layer.querySelector('.wx-glare').style.opacity = still ? 0 : sun?.glare ?? 0;
  // Heat haze: the mat only (the cards are above it, so they never ripple).
  arena.classList.toggle('wx-haze', Boolean(!still && sun?.haze));
  if (still || (!rain && !sun?.haze)) { stop(); g.clearRect(0, 0, W, H); drops = []; ripples = []; return; }
  if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
}

function stop() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

// A bracket crossed: a short pulse (a gust of rain, or a flare of sunlight).
export function pulseWeather(type) {
  if (!layer || reduced()) return;
  if (type === 'Rain') {
    for (let i = 0; i < 60; i++) ripples.push({ x: Math.random() * W, y: Math.random() * H, age: -Math.random() * 300, life: 600, r: 6 + Math.random() * 10 });
    flash('rgba(160, 200, 255, 0.25)', 420);
  } else {
    layer.querySelector('.wx-glare')?.animate([{ opacity: 0.6 }, { opacity: SUN_LEVELS[levels.sun]?.glare ?? 0 }], { duration: 900, easing: 'ease-out' });
  }
}

function flash(color, ms) {
  const f = layer?.querySelector('.wx-flash');
  if (!f) return;
  f.style.background = color;
  f.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 0.7, offset: 0.4 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

function tick(now) {
  frame = 0;
  if (!layer?.isConnected) return;
  const dt = Math.min(50, now - last);
  last = now;
  const rain = RAIN_LEVELS[levels.rain];
  const sun = SUN_LEVELS[levels.sun];
  g.clearRect(0, 0, W, H);
  if (rain) {
    // Keep the number of drops at this level's; each falls to a random spot on the mat.
    while (drops.length < rain.drops) drops.push(newDrop(rain, true));
    if (drops.length > rain.drops) drops.length = rain.drops;
    g.lineCap = 'round';
    g.lineWidth = 1.9;
    g.strokeStyle = `rgba(200, 225, 255, ${rain.alpha})`;
    g.beginPath();
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v * dt / 1000;
      d.x += d.v * 0.16 * dt / 1000;
      if (d.y >= d.floor) {
        if (Math.random() < 0.35) ripples.push({ x: d.x, y: d.floor, age: 0, life: 420, r: 4 + Math.random() * 6 });
        drops[i] = newDrop(rain, false);
        continue;
      }
      g.moveTo(d.x, d.y);
      g.lineTo(d.x - d.len * 0.16, d.y - d.len);
    }
    g.stroke();
    // Extra splash ripples on the mat.
    rippleAcc += rain.ripples * dt / 1000;
    while (rippleAcc >= 1) { rippleAcc -= 1; ripples.push({ x: Math.random() * W, y: Math.random() * H, age: 0, life: 520, r: 5 + Math.random() * 8 }); }
    // A downpour: now and then, distant lightning.
    if (rain.lightning) {
      if (!nextFlash) nextFlash = now + 3000 + Math.random() * 5000;
      if (now >= nextFlash) { flash('rgba(220, 235, 255, 0.35)', 380); nextFlash = now + 4000 + Math.random() * 6000; }
    }
  } else if (drops.length) drops = [];
  g.lineWidth = 1.2;
  for (const r of ripples) {
    r.age += dt;
    if (r.age < 0) continue;
    const k = r.age / r.life;
    g.strokeStyle = `rgba(215, 236, 255, ${0.65 * (1 - k)})`;
    g.beginPath();
    g.ellipse(r.x, r.y, r.r * (0.3 + k), r.r * 0.38 * (0.3 + k), 0, 0, Math.PI * 2);
    g.stroke();
  }
  ripples = ripples.filter((r) => r.age < r.life);
  // Heat haze: the noise drifts, the mat shimmers.
  if (sun?.haze) {
    document.getElementById('weather-haze-noise')?.setAttribute('baseFrequency', `${0.008 + 0.002 * Math.sin(now / 900)} ${0.03 + 0.008 * Math.sin(now / 600)}`);
    document.getElementById('weather-haze-map')?.setAttribute('scale', String(sun.haze * (0.85 + 0.15 * Math.sin(now / 400))));
  }
  if (rain || sun?.haze) frame = requestAnimationFrame(tick);
}

function newDrop(rain, anywhere) {
  const len = rnd(rain.length);
  return { x: Math.random() * (W + 120) - 120, y: anywhere ? Math.random() * H : -len - Math.random() * 120, v: rnd(rain.speed), len, floor: 30 + Math.random() * (H - 40) };
}

export function clearWeather() {
  stop();
  drops = [];
  ripples = [];
  g?.clearRect(0, 0, W, H);
}
