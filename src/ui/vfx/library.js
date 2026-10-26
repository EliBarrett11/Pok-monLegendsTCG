// The VFX library: every effect as data (docs/vfx.md). No DOM and no WebGL
// here, so the tests can check it in Node.
//
//   EMITTERS   particle presets: what a burst or a stream of particles looks like
//   TIMELINES  animations as beats on a clock (ms at normal speed):
//     { at, end, track, motion }      a card moves ('attacker' / 'target') over [at, end]
//     { at, end, emit, on }           particles stream from an anchor over [at, end]
//     { at, emit, on }                a one-off burst
//     { at, end, ribbon, from, to }   a trail (Flame Wheel, a stream) over [at, end]
//     { at, cue, hitstop, shake, flash, distort, … }
//                                     a moment: the hit lands (cue 'impact'), Burn
//                                     catches (cue 'scorch'), heat shimmer starts…
//     Hit-stop freezes the whole clock (cards, particles, the timeline) for its ms.
//   ATTACKS    Pokémon Type + Attack-Type → a timeline (others: generic, tinted by Type)
//   STATUS_VISUALS  how each Status Effect looks on a card, by level

// Textures in assets/vfx/<name>.webp (docs/vfx.md section 8). Missing ones
// are drawn in code (textures.js), in the same cel-shaded style.
export const TEXTURES = ['flame', 'fire-burst', 'embers', 'smoke', 'splash', 'droplets', 'water-jet', 'lightning',
  'slash', 'shadow', 'impact', 'shockwave', 'bubble', 'char-edge'];
// Sprite sheets (one sprite per cell, rectangles in assets/vfx/manifest.json).
export const ATLASES = { embers: 'embers-atlas', droplets: 'droplets-atlas' };
// Always drawn in code: soft dot, glow, streak, sparkle, shard, ring, coin, and
// the distortion maps for heat shimmer and shockwaves.
export const BUILT_IN = ['dot', 'glow', 'streak', 'sparkle', 'shard', 'ring', 'coin', 'heat-map', 'ring-map'];

// Timing budgets (docs/vfx.md section 1), ms at normal speed, hit-stop included.
export const BUDGETS = {
  attack: { min: 900, max: 1500 },   // "an attack takes about 1–1.5 s"
  counter: { min: 200, max: 900 },   // a defender hitting back: a shorter version, at the same moment
  status: { min: 200, max: 1000 },   // a status flaring, catching or going out: one beat
};

// Two colours per Pokémon Type (main, highlight), for tinting generic effects.
export const TYPE_TINT = {
  normal: ['#e8e2c8', '#ffffff'], fire: ['#ff6a1a', '#ffd04a'], water: ['#3a9cff', '#bfe4ff'], grass: ['#5fd04a', '#d6ff9e'],
  electric: ['#ffd51a', '#fff7b0'], ice: ['#7fe8f0', '#ffffff'], fighting: ['#ff5a3a', '#ffc2a0'], poison: ['#b85aff', '#f0b8ff'],
  ground: ['#d8a050', '#ffe0a0'], flying: ['#9a90ff', '#e6e2ff'], psychic: ['#ff4a96', '#ffc0dc'], bug: ['#a8cc3a', '#eaff9e'],
  rock: ['#c0a050', '#f0e2b0'], ghost: ['#7a5aff', '#d8c8ff'], dragon: ['#6a4aff', '#c8b8ff'], dark: ['#8a5a4a', '#e0c8b8'],
  steel: ['#b0b8d0', '#ffffff'], fairy: ['#ff8ac8', '#ffe0f0'],
};
export const tintOf = (pokemonType) => TYPE_TINT[String(pokemonType ?? 'normal').toLowerCase()] ?? TYPE_TINT.normal;

// --- Attacks ------------------------------------------------------------------------------

// Pokémon Type + Attack-Type → timeline. Built so far: Fire. Everything else
// uses the generic Physical or Special one, tinted by its Type (Step 21 adds the rest).
export const ATTACKS = {
  'Fire Physical': 'fire-physical',
  'Fire Special': 'fire-special',
};
export function attackAnimation(card) {
  return ATTACKS[`${card.pokemonType} ${card.attackType}`] ?? (card.attackType === 'Special' ? 'generic-special' : 'generic-physical');
}
// A defender hitting back in a trade: its own type's shorter version.
export const COUNTERS = { 'fire-physical': 'fire-counter', 'fire-special': 'fire-counter' };
export const counterAnimation = (card) => COUNTERS[attackAnimation(card)] ?? 'generic-counter';

// Bigger hits, bigger effects: particle counts, shake, flash and hit-stop scale with this.
export const impactScale = (damage) => Math.max(0.7, Math.min(1.6, 0.55 + 0.13 * (damage ?? 1)));
export const MAX_SCALE = 1.6;

// --- Particle presets ---------------------------------------------------------------------
//
// tex      texture (or atlas: 'embers' picks a random ember sprite)
// blend    'add' (light: fire, sparks) or 'alpha' (solid: smoke, steam)
// count    a burst's particles · rate: particles per second while streaming
// at       where they start, around the anchor rectangle:
//            'centre' · 'card' (anywhere on it) · 'edges' (its sides and bottom edge,
//            keeping off the art's middle) · 'ring' (a circle of `radius` around it)
// dir      which way they go: 'up' · 'radial' · 'back' (against the attack) ·
//          'forward' (with the attack) · 'inward' (to the anchor's centre)
// speed, life (ms), size (start, end), alpha (start, end), spin, gravity,
// drag, lift (extra upward px/s), fadeIn (ms), rot (starting angle), spin
// (turning speed, rad/s), pivot (0..1: where on the
// sprite it's anchored vertically; flames sit on their base), tint (multiplies
// the texture's colour; 'type' uses the attacker's Type), spread (radians)
const R = (a, b) => [a, b];
export const EMITTERS = {
  // Fire Physical (the approved prototype, prototype/vfx-demo.html)
  ignite: { tex: 'flame', blend: 'add', rate: 110, at: 'edges', dir: 'up', speed: R(140, 260), life: R(380, 560), size: [R(0.12, 0.22), R(0.28, 0.42)], alpha: [0.95, 0], fadeIn: 60, pivot: 0.85, rot: R(-0.15, 0.15) },
  flameWheel: { tex: 'flame', blend: 'add', rate: 180, at: 'card', area: 0.55, dir: 'back', speed: R(200, 420), lift: 80, life: R(260, 420), size: [R(0.35, 0.55), R(0.12, 0.2)], alpha: [0.9, 0], pivot: 0.75, alignBack: true },
  wheelEmbers: { tex: 'embers', blend: 'add', rate: 60, at: 'card', area: 0.9, dir: 'back', speed: R(80, 260), lift: R(40, 200), gravity: 300, life: R(500, 800), size: [R(0.5, 0.9), 0.3], alpha: [1, 0], spin: R(-6, 6) },
  fireImpactEmbers: { tex: 'embers', blend: 'add', count: 40, at: 'centre', dir: 'radial', push: 300, speed: R(380, 1150), lift: 200, gravity: 1300, drag: 1.4, life: R(600, 1100), size: [R(0.55, 1.05), 0.25], alpha: [1, 0.2], spin: R(-10, 10) },
  impactSmoke: { tex: 'smoke', blend: 'alpha', count: 4, at: 'card', area: 0.6, offsetY: -0.5, dir: 'up', speed: R(60, 110), life: R(800, 1100), size: [R(0.16, 0.22), R(0.34, 0.45)], alpha: [0.32, 0], fadeIn: 150, rot: R(0, 6), spin: R(-0.4, 0.4), tint: '#6b5a4c' },
  scorchSwirl: { tex: 'embers', blend: 'add', count: 18, at: 'ring', radius: R(160, 260), dir: 'inward', speed: 2.4, drag: 2.5, life: 420, size: [0.9, 0.3], alpha: [0, 1], spin: 8 },
  scorchCatch: { tex: 'fire-burst', blend: 'add', count: 1, at: 'centre', offsetY: 0.17, life: 380, size: [0.2, 0.75], alpha: [0.8, 0] },
  // Fire Special: Flamethrower
  flamethrower: { tex: 'flame', blend: 'add', rate: 260, at: 'muzzle', dir: 'forward', speed: R(1100, 1500), spreadDeg: 9, life: R(380, 520), size: [R(0.16, 0.24), R(0.5, 0.8)], alpha: [1, 0], pivot: 0.5, alignForward: true, drag: 0.6 },
  streamEmbers: { tex: 'embers', blend: 'add', rate: 90, at: 'muzzle', dir: 'forward', speed: R(700, 1300), spreadDeg: 16, lift: R(0, 120), gravity: 200, life: R(420, 700), size: [R(0.4, 0.8), 0.2], alpha: [1, 0], spin: R(-8, 8) },
  engulf: { tex: 'flame', blend: 'add', rate: 140, at: 'edges', dir: 'up', speed: R(160, 300), life: R(320, 520), size: [R(0.16, 0.28), R(0.34, 0.5)], alpha: [1, 0], fadeIn: 40, pivot: 0.85, rot: R(-0.2, 0.2) },
  heatSmoke: { tex: 'smoke', blend: 'alpha', rate: 10, at: 'card', area: 0.7, offsetY: -0.4, dir: 'up', speed: R(40, 90), life: R(900, 1300), size: [0.14, 0.36], alpha: [0.3, 0], fadeIn: 200, spin: R(-0.3, 0.3), tint: '#5a4a40' },
  muzzleFlash: { tex: 'fire-burst', blend: 'add', count: 1, at: 'muzzle', life: 260, size: [0.12, 0.42], alpha: [1, 0] },
  // Shared impact pieces
  impactStar: { tex: 'impact', blend: 'add', count: 1, at: 'centre', life: 230, size: [0.35, 1.15], alpha: [1, 0], spin: 0 },
  fireBurst: { tex: 'fire-burst', blend: 'add', count: 2, at: 'centre', life: R(380, 520), size: [R(0.15, 0.25), R(0.8, 1.25)], alpha: [1, 0], spin: R(-2, 2) },
  groundRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', offsetY: 0.17, life: 420, size: [0.25, 1.2], alpha: [0.5, 0], tint: '#ffcf8a' },
  // Generic (tinted by the attacker's Type)
  genericSparks: { tex: 'streak', blend: 'add', count: 22, at: 'centre', dir: 'radial', speed: R(420, 900), gravity: 900, drag: 1, life: R(260, 480), size: [R(0.5, 0.9), 0.2], alpha: [1, 0], tint: 'type', alignVelocity: true },
  genericDust: { tex: 'smoke', blend: 'alpha', count: 7, at: 'card', area: 0.5, offsetY: 0.3, dir: 'radial', speed: R(80, 200), lift: 30, life: R(600, 900), size: [0.1, 0.3], alpha: [0.45, 0], tint: '#b8925e' },
  genericGlow: { tex: 'glow', blend: 'add', count: 1, at: 'centre', life: 380, size: [0.6, 2.2], alpha: [1, 0], tint: 'type' },
  genericOrbs: { tex: 'dot', blend: 'add', count: 18, at: 'centre', dir: 'radial', speed: R(200, 520), drag: 2, life: R(380, 620), size: [R(0.5, 0.9), 0.2], alpha: [1, 0], tint: 'type' },
  chargeOrb: { tex: 'glow', blend: 'add', rate: 70, at: 'muzzle', dir: 'radial', speed: R(10, 60), life: R(160, 260), size: [R(0.5, 0.8), 0.1], alpha: [0.9, 0], tint: 'type' },
  // Status: Burn on a card (ambient, per second, scaled by level elsewhere)
  burnFlames: { tex: 'flame', blend: 'add', rate: 12, at: 'edges', dir: 'up', speed: R(40, 80), life: R(420, 700), size: [R(0.06, 0.1), R(0.11, 0.17)], alpha: [0.9, 0], fadeIn: 80, pivot: 0.9, rot: R(-0.2, 0.2) },
  burnEmbers: { tex: 'embers', blend: 'add', rate: 7, at: 'card', area: 0.9, offsetY: 0.2, dir: 'up', speed: R(70, 160), life: R(900, 1500), size: [R(0.35, 0.6), 0.15], alpha: [1, 0], spin: R(-4, 4) },
  burnSmoke: { tex: 'smoke', blend: 'alpha', rate: 1.2, at: 'card', area: 0.7, offsetY: -0.45, dir: 'up', speed: R(30, 60), life: 1600, size: [0.12, 0.3], alpha: [0.35, 0], fadeIn: 200, spin: R(-0.3, 0.3), tint: '#4a3a32' },
  burnFlare: { tex: 'flame', blend: 'add', count: 26, at: 'edges', dir: 'up', speed: R(220, 420), life: R(380, 620), size: [R(0.16, 0.26), R(0.34, 0.5)], alpha: [1, 0], pivot: 0.85, rot: R(-0.2, 0.2) },
  burnFlareCore: { tex: 'fire-burst', blend: 'add', count: 1, at: 'centre', offsetY: 0.1, life: 420, size: [0.25, 0.9], alpha: [0.85, 0] },
  steam: { tex: 'smoke', blend: 'alpha', count: 16, at: 'card', area: 0.8, dir: 'up', speed: R(90, 220), drag: 0.8, life: R(900, 1400), size: [R(0.12, 0.18), R(0.4, 0.6)], alpha: [0.7, 0], fadeIn: 80, spin: R(-0.5, 0.5), tint: '#f2f6fa' },
  steamHiss: { tex: 'dot', blend: 'add', count: 14, at: 'card', area: 0.8, dir: 'up', speed: R(120, 260), life: R(300, 600), size: [R(0.3, 0.6), 0.1], alpha: [0.8, 0], tint: '#dff2ff' },
};

// --- Timelines ----------------------------------------------------------------------------

export const TIMELINES = {
  // Fire Physical (Growlithe, Ponyta, Arcanine, Blaziken): the card catches fire,
  // charges with a Flame Wheel trail, a hit-stop impact bursts into embers;
  // with Scorch, embers swirl into the target and become its Burn.
  'fire-physical': {
    budget: 'attack', duration: 1250,
    beats: [
      { at: 0, end: 240, track: 'attacker', motion: 'windup' },
      { at: 0, end: 240, emit: 'ignite', on: 'attacker' },
      { at: 240, end: 500, track: 'attacker', motion: 'dash' },
      { at: 240, end: 500, emit: 'flameWheel', on: 'attacker' },
      { at: 240, end: 500, emit: 'wheelEmbers', on: 'attacker' },
      { at: 240, end: 500, ribbon: 'flameWheelTrail', on: 'attacker' },
      { at: 500, cue: 'impact', hitstop: 90, shake: 14, flash: 'fire', bloom: 1, distort: 'shockwave' },
      { at: 500, emit: 'impactStar', on: 'impact' },
      { at: 500, emit: 'fireBurst', on: 'impact' },
      { at: 500, emit: 'groundRing', on: 'impact' },
      { at: 500, emit: 'fireImpactEmbers', on: 'impact' },
      { at: 500, emit: 'impactSmoke', on: 'impact' },
      { at: 500, end: 920, track: 'attacker', motion: 'return' },
      { at: 500, end: 1150, track: 'target', motion: 'recoil' },
      { at: 820, cue: 'scorch', emit: 'scorchSwirl', on: 'target' },
      { at: 1200, cue: 'scorchCatch', emit: 'scorchCatch', on: 'target' },
    ],
  },
  // Fire Special (Charmander, Magmar, Houndoom): rears back, a Flamethrower
  // stream with heat shimmer engulfs the target.
  'fire-special': {
    budget: 'attack', duration: 1300,
    beats: [
      { at: 0, end: 220, track: 'attacker', motion: 'rear' },
      { at: 0, end: 220, emit: 'chargeOrb', on: 'attacker', tint: ['#ff6a1a', '#ffd04a'] },
      { at: 220, emit: 'muzzleFlash', on: 'attacker' },
      { at: 220, end: 760, track: 'attacker', motion: 'brace' },
      { at: 220, end: 720, emit: 'flamethrower', on: 'attacker' },
      { at: 220, end: 720, emit: 'streamEmbers', on: 'attacker' },
      { at: 220, end: 720, ribbon: 'flameStream', on: 'attacker' },
      { at: 330, end: 900, cue: 'heat', on: 'target' },
      { at: 420, cue: 'impact', hitstop: 60, shake: 9, flash: 'fire', bloom: 0.8 },
      { at: 420, emit: 'fireBurst', on: 'impact' },
      { at: 420, end: 900, emit: 'engulf', on: 'target' },
      { at: 420, end: 1000, emit: 'heatSmoke', on: 'target' },
      { at: 420, end: 1100, track: 'target', motion: 'scorched' },
      { at: 760, end: 1000, track: 'attacker', motion: 'settle' },
      { at: 900, cue: 'scorch', emit: 'scorchSwirl', on: 'target' },
      { at: 1250, cue: 'scorchCatch', emit: 'scorchCatch', on: 'target' },
    ],
  },
  // Generic Physical: a lunge and a tinted impact (every other Type until Step 21).
  'generic-physical': {
    budget: 'attack', duration: 1000,
    beats: [
      { at: 0, end: 220, track: 'attacker', motion: 'windup' },
      { at: 220, end: 440, track: 'attacker', motion: 'dash' },
      { at: 220, end: 440, ribbon: 'tintTrail', on: 'attacker' },
      { at: 440, cue: 'impact', hitstop: 70, shake: 10, flash: 'type', bloom: 0.7, distort: 'shockwave' },
      { at: 440, emit: 'impactStar', on: 'impact', tint: 'type' },
      { at: 440, emit: 'genericSparks', on: 'impact' },
      { at: 440, emit: 'genericDust', on: 'impact' },
      { at: 440, emit: 'groundRing', on: 'impact', tint: 'type' },
      { at: 440, end: 820, track: 'attacker', motion: 'return' },
      { at: 440, end: 980, track: 'target', motion: 'recoil' },
    ],
  },
  // Generic Special: an orb of the Type's colour flies across with a trail.
  'generic-special': {
    budget: 'attack', duration: 1050,
    beats: [
      { at: 0, end: 260, track: 'attacker', motion: 'rear' },
      { at: 0, end: 260, emit: 'chargeOrb', on: 'attacker' },
      { at: 260, end: 560, projectile: 'orb', on: 'path' },
      { at: 260, end: 560, ribbon: 'orbTrail', on: 'projectile' },
      { at: 260, end: 560, track: 'attacker', motion: 'settle' },
      { at: 560, cue: 'impact', hitstop: 60, shake: 8, flash: 'type', bloom: 0.9, distort: 'shockwave' },
      { at: 560, emit: 'genericGlow', on: 'impact' },
      { at: 560, emit: 'genericOrbs', on: 'impact' },
      { at: 560, emit: 'genericSparks', on: 'impact' },
      { at: 560, end: 1030, track: 'target', motion: 'recoil' },
    ],
  },
  // Trades: the defender's shorter answer, at the moment of impact.
  'fire-counter': {
    budget: 'counter', duration: 560,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 60, cue: 'counterHit', shake: 5, flash: 'fire', bloom: 0.6 },
      { at: 60, emit: 'fireBurst', on: 'counterImpact' },
      { at: 60, emit: 'fireImpactEmbers', on: 'counterImpact', countScale: 0.4 },
      { at: 160, end: 420, track: 'self', motion: 'settle' },
    ],
  },
  'generic-counter': {
    budget: 'counter', duration: 500,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 60, cue: 'counterHit', shake: 4, flash: 'type', bloom: 0.5 },
      { at: 60, emit: 'genericSparks', on: 'counterImpact', countScale: 0.6 },
      { at: 160, end: 400, track: 'self', motion: 'settle' },
    ],
  },
  // Status beats
  'burn-flare': {
    budget: 'status', duration: 650,
    beats: [
      { at: 0, cue: 'flare', bloom: 0.8 },
      { at: 0, emit: 'burnFlare', on: 'target' },
      { at: 0, emit: 'burnFlareCore', on: 'target' },
      { at: 0, end: 600, track: 'target', motion: 'scorched' },
    ],
  },
  'burn-catch': {
    budget: 'status', duration: 620,
    beats: [
      { at: 0, emit: 'scorchSwirl', on: 'target' },
      { at: 380, cue: 'scorchCatch', emit: 'scorchCatch', on: 'target' },
    ],
  },
  'douse-steam': {
    budget: 'status', duration: 800,
    beats: [
      { at: 0, cue: 'douse' },
      { at: 0, emit: 'steam', on: 'target' },
      { at: 0, emit: 'steamHiss', on: 'target' },
      { at: 0, end: 700, track: 'target', motion: 'cool' },
    ],
  },
};

// Ribbons (trails): texture, width (px), how long a point lives (ms), colour, opacity.
export const RIBBONS = {
  flameWheelTrail: { tex: 'streak', width: 90, life: 200, color: '#ff4000', alpha: 0.28, blend: 'add' },
  flameStream: { tex: 'streak', width: 64, life: 140, color: '#ff8a20', alpha: 0.55, blend: 'add', toTarget: true },
  tintTrail: { tex: 'streak', width: 80, life: 200, color: 'type', alpha: 0.5, blend: 'add' },
  orbTrail: { tex: 'streak', width: 54, life: 260, color: 'type', alpha: 0.6, blend: 'add' },
};

// Real time a timeline takes at normal speed: its beats plus every hit-stop,
// at the largest scale (hit-stop grows with the damage).
export function timelineDuration(def, scale = MAX_SCALE) {
  return def.duration + def.beats.reduce((sum, b) => sum + (b.hitstop ?? 0) * scale, 0);
}

// --- Status visuals -----------------------------------------------------------------------
//
// Each Status Effect has levels (from its count), an ambient effect per level,
// an overlay on the card (CSS, so it shows without WebGL too), and beats for
// when it ticks, catches and is removed. New statuses (Poison, Sleep…) add an
// entry here.
export const STATUS_VISUALS = {
  burn: {
    maxLevel: 4,
    // Burn 1 a faint edge glow … Burn 4 or more a properly burning card.
    levels: [null,
      { overlay: 0.35, flames: 0.5, embers: 0.6, smoke: 0 },
      { overlay: 0.55, flames: 1, embers: 1, smoke: 0.4 },
      { overlay: 0.75, flames: 1.7, embers: 1.5, smoke: 0.8 },
      { overlay: 1, flames: 2.6, embers: 2.2, smoke: 1.2 }],
    ambient: { flames: 'burnFlames', embers: 'burnEmbers', smoke: 'burnSmoke' },
    tick: 'burn-flare',
    applied: 'burn-catch',
    cleared: 'douse-steam',
  },
};
// The visual level for a status count: 0 (none) up to the status's maximum.
export function statusLevel(id, count) {
  const v = STATUS_VISUALS[id];
  if (!v || !count || count < 1) return 0;
  return Math.min(v.maxLevel, Math.floor(count));
}
