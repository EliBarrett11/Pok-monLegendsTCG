// VFX textures: the kit in assets/vfx/<name>.webp when it's there, otherwise a
// stand-in drawn in code in the same anime cel-shaded style (2–3 flat tones,
// bold shapes, crisp edges). The built-in ones (dot, glow, streak, sparkle,
// shard, ring, coin and the distortion maps) are always drawn in code.

import { TEXTURES, ATLASES, BUILT_IN } from './library.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Flat colour bands from the centre out: [[radius 0..1, colour], …], outermost first.
function bands(g, cx, cy, r, list, sy = 1) {
  for (const [k, colour] of list) {
    g.fillStyle = colour;
    g.beginPath();
    g.ellipse(cx, cy, r * k, r * k * sy, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// A flame tongue: a teardrop, three tones (red rim, orange body, yellow core).
function flameShape(g, cx, base, w, h) {
  g.beginPath();
  g.moveTo(cx, base - h);
  g.bezierCurveTo(cx + w * 0.15, base - h * 0.7, cx + w * 0.55, base - h * 0.45, cx + w * 0.5, base - h * 0.2);
  g.bezierCurveTo(cx + w * 0.45, base, cx - w * 0.45, base, cx - w * 0.5, base - h * 0.2);
  g.bezierCurveTo(cx - w * 0.55, base - h * 0.5, cx - w * 0.1, base - h * 0.65, cx, base - h);
  g.fill();
}

const PAINT = {
  flame(g, w, h) {
    for (const [k, c] of [[1, '#e0300c'], [0.74, '#ff8a1a'], [0.46, '#ffe066']]) {
      g.fillStyle = c;
      flameShape(g, w / 2, h * (0.98 - (1 - k) * 0.1), w * k, h * k);
    }
  },
  'fire-burst'(g, w, h) {
    for (const [k, c] of [[1, '#e0300c'], [0.72, '#ff8a1a'], [0.44, '#ffe066'], [0.2, '#fffbe0']]) {
      g.fillStyle = c;
      g.beginPath();
      const spikes = 11;
      for (let i = 0; i <= spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const r = (i % 2 ? 0.62 : 1) * k * w * 0.48 * (0.85 + 0.15 * Math.sin(i * 2.3));
        g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      g.fill();
    }
  },
  embers(g, w, h) {
    bands(g, w / 2, h / 2, w * 0.45, [[1, '#ff5a1a'], [0.6, '#ffb030'], [0.28, '#fff2b0']]);
  },
  smoke(g, w, h) {
    // Lumpy puff, two flat greys (tinted by the effect).
    for (const [k, c] of [[1, '#9a9a9a'], [0.7, '#cfcfcf']]) {
      g.fillStyle = c;
      for (const [x, y, r] of [[0.5, 0.55, 0.3], [0.32, 0.5, 0.2], [0.68, 0.48, 0.22], [0.45, 0.35, 0.22], [0.6, 0.66, 0.2]]) {
        g.beginPath();
        g.arc(w * x, h * y, w * r * k, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
  splash(g, w, h) { bands(g, w / 2, h * 0.7, w * 0.45, [[1, '#2a7ad8'], [0.7, '#6ab8ff'], [0.35, '#e0f4ff']], 0.45); },
  droplets(g, w, h) { bands(g, w / 2, h / 2, w * 0.4, [[1, '#2a7ad8'], [0.65, '#8acaff'], [0.25, '#ffffff']]); },
  'water-jet'(g, w, h) {
    for (const [k, c] of [[1, '#2a7ad8'], [0.62, '#7ac0ff'], [0.28, '#eaf6ff']]) {
      g.fillStyle = c;
      g.fillRect(0, h / 2 - h * 0.4 * k, w, h * 0.8 * k);
    }
  },
  lightning(g, w, h) {
    g.lineJoin = 'miter';
    for (const [lw, c] of [[h * 0.14, '#ffd51a'], [h * 0.06, '#fffbe0']]) {
      g.strokeStyle = c;
      g.lineWidth = lw;
      g.beginPath();
      let y = h / 2;
      g.moveTo(0, y);
      for (let x = w / 10; x <= w; x += w / 10) { y = h / 2 + (Math.sin(x * 7.3) * h * 0.3); g.lineTo(x, y); }
      g.stroke();
    }
  },
  slash(g, w, h) {
    for (let i = 0; i < 3; i++) {
      for (const [lw, c] of [[w * 0.05, '#c040ff'], [w * 0.02, '#ffffff']]) {
        g.strokeStyle = c;
        g.lineWidth = lw;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(w * (0.25 + i * 0.2), h * 0.1);
        g.quadraticCurveTo(w * (0.15 + i * 0.2), h * 0.5, w * (0.3 + i * 0.2), h * 0.9);
        g.stroke();
      }
    }
  },
  shadow(g, w, h) { bands(g, w / 2, h / 2, w * 0.45, [[1, '#2a1a3a'], [0.6, '#120a1a']]); },
  impact(g, w, h) {
    for (const [k, c] of [[1, '#ffd36b'], [0.55, '#fffbe8']]) {
      g.fillStyle = c;
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = (i % 2 ? 0.18 : 1) * k * w * 0.48;
        g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      g.fill();
    }
  },
  shockwave(g, w, h) {
    g.strokeStyle = '#fff4cc';
    g.lineWidth = h * 0.07;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
    g.stroke();
  },
  bubble(g, w, h) {
    bands(g, w / 2, h / 2, w * 0.45, [[1, '#7ac0ff'], [0.85, 'rgba(200,235,255,0.35)']]);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(w * 0.36, h * 0.34, w * 0.1, h * 0.06, -0.6, 0, Math.PI * 2);
    g.fill();
  },
  'char-edge'(g, w, h) {
    g.strokeStyle = '#ff6a1a';
    g.lineWidth = w * 0.05;
    g.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94);
    g.strokeStyle = '#2a1206';
    g.lineWidth = w * 0.03;
    g.strokeRect(w * 0.02, h * 0.015, w * 0.96, h * 0.97);
  },
  // Built-ins
  dot(g, w, h) { bands(g, w / 2, h / 2, w * 0.48, [[1, 'rgba(255,255,255,0.35)'], [0.7, 'rgba(255,255,255,0.75)'], [0.4, '#ffffff']]); },
  glow(g, w, h) {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  },
  streak(g, w, h) {
    // A horizontal band, bright in the middle, for trails and sparks.
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const fade = g.createLinearGradient(0, 0, w, 0);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.15, 'rgba(0,0,0,0)');
    fade.addColorStop(0.85, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  },
  sparkle(g, w, h) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = (i % 2 ? 0.12 : 0.48) * w;
      g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    g.fill();
  },
  shard(g, w, h) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(w * 0.1, h * 0.2);
    g.lineTo(w * 0.95, h * 0.4);
    g.lineTo(w * 0.35, h * 0.95);
    g.fill();
  },
  ring(g, w, h) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = w * 0.06;
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
    g.stroke();
  },
  coin(g, w, h) {
    bands(g, w / 2, h / 2, w * 0.46, [[1, '#8a5a12'], [0.86, '#f0b830'], [0.6, '#ffe07a']]);
    g.fillStyle = '#8a5a12';
    g.font = `800 ${Math.round(h * 0.56)}px 'Alegreya Sans', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', w / 2, h * 0.53);
  },
  // Distortion maps: red/green are the x/y push (0.5 = none), alpha how much.
  'ring-map'(g, w, h) {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5) / w - 0.5;
        const dy = (y + 0.5) / h - 0.5;
        const d = Math.hypot(dx, dy) * 2;
        const band = Math.max(0, 1 - Math.abs(d - 0.8) / 0.18);
        const i = (y * w + x) * 4;
        img.data[i] = 128 + (dx / (d || 1)) * 127 * band;
        img.data[i + 1] = 128 + (dy / (d || 1)) * 127 * band;
        img.data[i + 3] = 255 * band;
      }
    }
    g.putImageData(img, 0, 0);
  },
  'heat-map'(g, w, h) {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5) / w - 0.5;
        const dy = (y + 0.5) / h - 0.5;
        const fall = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
        const i = (y * w + x) * 4;
        img.data[i] = 128 + Math.sin(y * 0.55 + x * 0.12) * 110;
        img.data[i + 1] = 128 + Math.cos(x * 0.4 - y * 0.2) * 60;
        img.data[i + 3] = 255 * fall;
      }
    }
    g.putImageData(img, 0, 0);
  },
};

const SIZES = { flame: [146, 256], 'water-jet': [256, 96], lightning: [256, 96], 'char-edge': [250, 350], streak: [128, 32], 'ring-map': [128, 128], 'heat-map': [128, 128] };

// A stand-in drawn in code, as a canvas.
export function paint(name) {
  const [w, h] = SIZES[name] ?? [128, 128];
  const c = canvas(w, h);
  const g = c.getContext('2d');
  (PAINT[name] ?? PAINT.dot)(g, w, h);
  return c;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Every texture, as { name: { image, sprites? } }: the file when it loads,
// otherwise the stand-in. Atlases add `sprites` (pixel rectangles).
export async function loadTextures(base = 'assets/vfx/') {
  let manifest = {};
  try {
    manifest = await (await fetch(`${base}manifest.json`)).json();
  } catch {
    // No manifest: every texture is drawn in code.
  }
  const out = {};
  await Promise.all(TEXTURES.map(async (name) => {
    const atlas = ATLASES[name] && manifest[name]?.atlas;
    const img = await loadImage(`${base}${atlas ? atlas.file : `${name}.webp`}`);
    out[name] = img ? { image: img, sprites: atlas?.sprites ?? null, loaded: true } : { image: paint(name), sprites: null, loaded: false };
  }));
  for (const name of BUILT_IN) out[name] = { image: paint(name), sprites: null, loaded: false };
  return out;
}
