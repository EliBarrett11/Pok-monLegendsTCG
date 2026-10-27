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
  'slash', 'shadow', 'impact', 'shockwave', 'bubble', 'char-edge', 'wave', 'ripple', 'sparkle', 'cracks'];
// Sprite sheets (one sprite per cell, rectangles in assets/vfx/manifest.json).
export const ATLASES = { embers: 'embers-atlas', droplets: 'droplets-atlas', sparkle: 'sparkle-atlas' };
// Always drawn in code: soft dot, glow, streak, shard, ring, coin, and the
// distortion maps for heat shimmer and shockwaves.
export const BUILT_IN = ['dot', 'glow', 'streak', 'shard', 'ring', 'coin', 'heat-map', 'ring-map'];

// Timing budgets (docs/vfx.md section 1), ms at normal speed, hit-stop included.
export const BUDGETS = {
  attack: { min: 900, max: 1500 },   // "an attack takes about 1–1.5 s"
  counter: { min: 200, max: 900 },   // a defender hitting back: a shorter version, at the same moment
  status: { min: 200, max: 1000 },   // a status flaring, catching or going out: one beat
  // A Strategy Card, "about 2–2.5 s": the card's ~300 ms rise to centre stage,
  // then this timeline (the flare, its name, the dissolve, and its effect).
  strategy: { min: 1500, max: 2300 },
  effect: { min: 300, max: 1500 },   // a follow-up moment (Dive's Pokémon rising out of the Discard Pile)
  summon: { min: 400, max: 1300 },   // a Pokémon landing in its space
  cinematic: { min: 2000, max: 2800 },   // a Legendary's entrance, "about 2.5 s"
  defeat: { min: 500, max: 1300 },   // a Pokémon burnt to ash, washed away or shattered
  heal: { min: 300, max: 1000 },
  trainer: { min: 250, max: 1800 },   // a Trainer flinching, or cracking and falling
  supporter: { min: 900, max: 2000 },   // a Supporter's portrait moment
  ending: { min: 2500, max: 4000 },   // the Victory or Defeat crest and what falls round it
};

// The end of the match (docs/vfx.md section 6, item 7): Victory rains gold
// sparkle and confetti-like embers or droplets in the winning deck's style;
// Defeat lets ash or rain fall (in the player's own deck's style).
export function endingAnimation(stats) {
  if (stats.result === 'victory') return { id: 'ending-victory', style: stats.deck.player === 'water' ? 'water' : 'fire' };
  return { id: 'ending-defeat', style: stats.deck.player === 'water' ? 'water' : 'fire' };
}

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

// Pokémon Type + Attack-Type → timeline: the 8 combinations the two decks use
// (docs/vfx.md section 3). Any other combination (Types no deck uses yet) falls
// back to the generic Physical or Special one, tinted by its Type.
export const ATTACKS = {
  'Fire Physical': 'fire-physical',
  'Fire Special': 'fire-special',
  'Water Physical': 'water-physical',
  'Water Special': 'water-special',
  'Electric Special': 'electric-special',
  'Fighting Physical': 'fighting-physical',
  'Dark Physical': 'dark-physical',
  'Normal Physical': 'normal-physical',
};
export const FALLBACKS = ['generic-physical', 'generic-special'];
export function attackAnimation(card) {
  return ATTACKS[`${card.pokemonType} ${card.attackType}`] ?? (card.attackType === 'Special' ? 'generic-special' : 'generic-physical');
}
// A defender hitting back in a trade: its own type's shorter version.
export const COUNTERS = {
  'fire-physical': 'fire-counter', 'fire-special': 'fire-counter',
  'water-physical': 'water-counter', 'water-special': 'water-counter',
  'electric-special': 'electric-counter', 'fighting-physical': 'fighting-counter',
  'dark-physical': 'dark-counter', 'normal-physical': 'normal-counter',
};
export const counterAnimation = (card) => COUNTERS[attackAnimation(card)] ?? 'generic-counter';

// --- Strategy Cards (docs/vfx.md section 4) -------------------------------------------------
//
// Every Strategy Card opens the same way: it rises to centre stage (done by the
// page, ~300 ms), flares in its Type's colour, shows its name, then dissolves
// into its own effect. STRATEGIES maps each card id to its effect timeline;
// composeStrategy puts the shared opening in front of it.
export const STRATEGIES = {
  ember: 'strategy-ember',
  'flame-charge': 'strategy-flame-charge',
  'heat-wave': 'strategy-heat-wave',
  'fire-blast': 'strategy-fire-blast',
  'aqua-ring': 'strategy-aqua-ring',
  'bubble-beam': 'strategy-bubble-beam',
  dive: 'strategy-dive',
  surf: 'strategy-surf',
};
export const STRATEGY_FALLBACK = 'strategy-generic';
// The Type colour each card flares in.
export const STRATEGY_TYPES = {
  ember: 'Fire', 'flame-charge': 'Fire', 'heat-wave': 'Fire', 'fire-blast': 'Fire',
  'aqua-ring': 'Water', 'bubble-beam': 'Water', dive: 'Water', surf: 'Water',
};
export const strategyTint = (card) => tintOf(STRATEGY_TYPES[card?.id] ?? 'Normal');
export const strategyAnimation = (card) => STRATEGIES[card?.id] ?? STRATEGY_FALLBACK;
// Dive's second moment, when the chosen Pokémon comes back: it rises out of the Discard Pile.
export const DIVE_RISE = 'dive-rise';
export const STRATEGY_OPENING = {
  length: 900,
  beats: [
    { at: 0, cue: 'flare', emit: 'strategyFlare', on: 'card', bloom: 0.9 },
    { at: 0, emit: 'flareRing', on: 'card' },
    { at: 0, end: 480, emit: 'flareSparks', on: 'card' },
    { at: 60, cue: 'banner' },
    { at: 640, cue: 'dissolve' },
    { at: 640, end: 900, emit: 'dissolveMotes', on: 'card' },
  ],
};
// The opening, then the card's own effect (its beats moved to start after the opening).
export function composeStrategy(id) {
  const def = TIMELINES[id];
  const off = STRATEGY_OPENING.length;
  const beats = [
    ...STRATEGY_OPENING.beats,
    ...def.beats.map((b) => ({ ...b, at: b.at + off, ...(b.end !== undefined ? { end: b.end + off } : {}) })),
  ];
  return { ...def, id, budget: 'strategy', beats, duration: def.duration + off, effectStart: off };
}

// Sweeps: a wall that rolls across a region of the board (from the caster's
// side), hitting each card as it passes: Heat Wave's wall of heat, Surf's wave.
//   line     emitters spawned along the wall · sprite: a texture tiled along it
//   distort  heat shimmer along the wall · hit: emitters on each card it reaches
//   skew     px: the far end of the wall trails, so cards are hit one after another
export const SWEEPS = {
  heatWall: { line: ['heatFlames', 'heatEmbers'], distort: 'heat', skew: 260, hit: { enemy: ['scorchCatch', 'heatIgnite'], friend: [] } },
  surfWave: { line: ['surfSpray', 'surfFoam'], sprite: 'wave', tiles: 4, skew: 320, hit: { enemy: ['splashCrown', 'sprayDroplets'], friend: ['healGlints'] } },
};

// --- Summons, defeats, healing, Trainers, Supporters (docs/vfx.md section 6) ----------------

// A Pokémon's entrance by rarity; Legendaries have their own cinematic.
export const SUMMONS = { Common: 'summon-common', Rare: 'summon-rare', Epic: 'summon-epic', Legendary: 'summon-legendary' };
export const LEGENDARY_SUMMONS = { kyogre: 'summon-kyogre', blaziken: 'summon-blaziken' };
export function summonAnimation(card) {
  if (card?.rarity === 'Legendary') return LEGENDARY_SUMMONS[card.id] ?? SUMMONS.Legendary;
  return SUMMONS[card?.rarity] ?? SUMMONS.Common;
}
// Quick Attack: it lands already Active, with a quick speed streak.
export function composeSummon(id, { quick = false } = {}) {
  const def = TIMELINES[id];
  const land = def.beats.find((b) => b.cue === 'land')?.at ?? 0;
  const beats = [...def.beats];
  if (quick) {
    beats.push({ at: Math.max(0, land - 140), end: land, ribbon: 'speedStreak', on: 'target', keyword: 'Quick Attack' });
    beats.push({ at: land, emit: 'speedLines', on: 'target', keyword: 'Quick Attack' });
    beats.push({ at: land, cue: 'active', flash: 'white', bloom: 0.5, keyword: 'Quick Attack' });
  }
  return { ...def, id, beats, keywords: quick ? ['Quick Attack'] : [] };
}

// How a defeated Pokémon goes, by what defeated it: burnt to ash (Fire attacks,
// Fire cards and Burn), washed away (Water), shattered (everything else).
export const DEFEATS = { ash: 'defeat-ash', wash: 'defeat-wash', shatter: 'defeat-shatter' };
export function defeatStyle(e) {
  if (e?.cause === 'burn') return 'ash';
  const hit = e?.hitBy ?? {};
  const type = hit.type ?? (hit.kind === 'strategy' ? STRATEGY_TYPES[hit.id] : null);
  return type === 'Fire' ? 'ash' : type === 'Water' ? 'wash' : 'shatter';
}

// Bigger hits, bigger effects: particle counts, shake, flash and hit-stop scale with this.
export const impactScale = (damage) => Math.max(0.7, Math.min(1.6, 0.55 + 0.13 * (damage ?? 1)));
export const MAX_SCALE = 1.6;

// Effect damage from a card that isn't an attack reuses an attack animation
// (docs/vfx.md section 3): a Pokémon's own (Gyarados's On Summon), and these
// Trainers' Powers by name. Burn from a Pokémon's ability uses the Scorch
// ember swirl, cast from that Pokémon.
export const EFFECT_ANIMATIONS = { 'Crasher Wake': 'water-special' };
export const BURN_CAST = 'ember-cast';
export function effectAnimation(source) {
  if (!source) return null;
  if (EFFECT_ANIMATIONS[source.name]) return EFFECT_ANIMATIONS[source.name];
  return source.pokemonType && source.attackType ? attackAnimation(source) : null;
}

// An attack's timeline with its keyword touches added as beats:
//   trade        the defender answers (cue 'trade' at the impact: its counter starts)
//   shell        a translucent shell shimmers on the defender, absorbing part of the hit
//   infiltrator  the attacker arcs over the enemy guards, a shadowy afterimage over a guard
//   overrun      the leftover blast carries on, in the attack's own style, into the Trainer
// Each added beat is tagged with its keyword. Returns a new definition.
export function composeAttack(id, { trade = false, shell = false, infiltrator = false, overrun = false } = {}) {
  const def = TIMELINES[id];
  const hit = def.beats.find((b) => b.cue === 'impact')?.at ?? 0;
  const [a0, a1] = def.approach ?? [0, hit];
  const style = def.style ?? {};
  const beats = [...def.beats];
  if (infiltrator) {
    beats.push({ at: a0, end: a1, emit: 'afterimage', on: 'attacker', keyword: 'Infiltrator' });
    beats.push({ at: Math.round((a0 + a1) / 2), cue: 'infiltrate', emit: 'guardShadow', on: 'guard', keyword: 'Infiltrator' });
  }
  if (trade) beats.push({ at: hit, cue: 'trade', keyword: 'trade' });
  if (shell) {
    beats.push({ at: hit, cue: 'shell', emit: 'shellShimmer', on: 'target', keyword: 'Shell' });
    beats.push({ at: hit, emit: 'shellGlints', on: 'target', keyword: 'Shell' });
  }
  if (overrun) {
    beats.push({ at: hit + 150, end: hit + 420, projectile: 'overrun', emit: style.overrunTrail ?? 'overrunEmbers', on: 'projectile', keyword: 'Overrun' });
    beats.push({ at: hit + 420, cue: 'overrunHit', emit: style.overrunBurst ?? 'impactStar', on: 'trainer', shake: 9, flash: style.flash ?? 'type', bloom: 0.7, tint: style.overrunTint, keyword: 'Overrun' });
  }
  const last = Math.max(...beats.map((b) => b.end ?? b.at));
  return { ...def, id, beats, duration: Math.max(def.duration, last + 80), keywords: [...new Set(beats.map((b) => b.keyword).filter(Boolean))] };
}
// A counter (a defender hitting back) with Shell on the original attacker.
export function composeCounter(id, { shell = false } = {}) {
  const def = TIMELINES[id];
  const hit = def.beats.find((b) => b.cue === 'counterHit')?.at ?? 0;
  const beats = [...def.beats];
  if (shell) {
    beats.push({ at: hit, cue: 'shell', emit: 'shellShimmer', on: 'counterImpact', keyword: 'Shell' });
    beats.push({ at: hit, emit: 'shellGlints', on: 'counterImpact', keyword: 'Shell' });
  }
  return { ...def, id, beats, keywords: shell ? ['Shell'] : [] };
}

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
  flamethrower: { tex: 'flame', blend: 'add', rate: 150, at: 'muzzle', dir: 'forward', speed: R(1100, 1500), spreadDeg: 9, life: R(380, 520), size: [R(0.14, 0.2), R(0.36, 0.56)], alpha: [0.7, 0], pivot: 0.5, alignForward: true, drag: 0.6 },
  streamEmbers: { tex: 'embers', blend: 'add', rate: 90, at: 'muzzle', dir: 'forward', speed: R(700, 1300), spreadDeg: 16, lift: R(0, 120), gravity: 200, life: R(420, 700), size: [R(0.4, 0.8), 0.2], alpha: [1, 0], spin: R(-8, 8) },
  engulf: { tex: 'flame', blend: 'add', rate: 100, at: 'edges', dir: 'up', speed: R(160, 300), life: R(320, 520), size: [R(0.14, 0.24), R(0.3, 0.44)], alpha: [0.85, 0], fadeIn: 40, pivot: 0.85, rot: R(-0.2, 0.2) },
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
  // Water Physical: Waterfall (a column of water, a crash, a splash crown)
  waterColumn: { tex: 'splash', blend: 'alpha', rate: 28, at: 'edges', dir: 'up', speed: R(260, 440), life: R(380, 560), size: [R(0.12, 0.18), R(0.26, 0.38)], alpha: [0.9, 0], fadeIn: 40, pivot: 0.85, rot: R(-0.15, 0.15) },
  columnDroplets: { tex: 'droplets', blend: 'alpha', rate: 70, at: 'card', area: 0.9, dir: 'up', speed: R(220, 460), gravity: 900, life: R(400, 700), size: [R(0.35, 0.6), 0.2], alpha: [0.95, 0], spin: R(-3, 3) },
  columnMist: { tex: 'smoke', blend: 'alpha', rate: 9, at: 'card', area: 0.8, dir: 'up', speed: R(60, 130), life: R(600, 900), size: [0.12, 0.3], alpha: [0.3, 0], fadeIn: 120, spin: R(-0.4, 0.4), tint: '#d8f0ff' },
  splashCrown: { tex: 'splash', blend: 'alpha', count: 2, at: 'centre', offsetY: 0.18, life: R(420, 560), size: [R(0.2, 0.3), R(0.75, 1)], alpha: [1, 0], pivot: 0.85, rot: R(-0.12, 0.12) },
  splashDroplets: { tex: 'droplets', blend: 'alpha', count: 34, at: 'centre', dir: 'radial', push: 200, speed: R(320, 900), lift: 260, gravity: 1400, drag: 0.8, life: R(600, 1000), size: [R(0.45, 0.9), 0.3], alpha: [1, 0.2], spin: R(-6, 6) },
  splashMist: { tex: 'smoke', blend: 'alpha', count: 5, at: 'card', area: 0.6, offsetY: 0.1, dir: 'radial', speed: R(60, 160), life: R(700, 1000), size: [R(0.14, 0.2), R(0.36, 0.5)], alpha: [0.4, 0], fadeIn: 60, spin: R(-0.4, 0.4), tint: '#e6f6ff' },
  // Water Special: Hydro Pump (a spiralling jet, spray at the impact, droplets running down)
  hydroJet: { tex: 'water-jet', blend: 'alpha', rate: 95, at: 'muzzle', dir: 'forward', speed: R(1100, 1400), spreadDeg: 3, drag: 0.3, life: R(320, 420), size: [R(0.18, 0.24), R(0.38, 0.5)], alpha: [0.9, 0.5], alignForward: true, texAngle: 0.35, toTarget: true },
  jetDroplets: { tex: 'droplets', blend: 'alpha', rate: 80, at: 'muzzle', dir: 'forward', speed: R(800, 1300), spreadDeg: 14, gravity: 400, toTarget: true, life: R(350, 600), size: [R(0.3, 0.55), 0.2], alpha: [1, 0], spin: R(-8, 8) },
  spray: { tex: 'splash', blend: 'alpha', rate: 22, at: 'centre', dir: 'back', speed: R(100, 260), life: R(300, 450), size: [R(0.12, 0.18), R(0.32, 0.46)], alpha: [0.9, 0], pivot: 0.8, alignBack: true },
  sprayDroplets: { tex: 'droplets', blend: 'alpha', count: 22, at: 'centre', dir: 'radial', speed: R(260, 620), lift: 120, gravity: 1100, drag: 0.6, life: R(450, 750), size: [R(0.35, 0.7), 0.25], alpha: [1, 0.1], spin: R(-6, 6) },
  dropletsBead: { tex: 'droplets', blend: 'alpha', rate: 26, at: 'card', area: 0.85, dir: 'down', speed: R(15, 50), gravity: 140, life: R(700, 1100), size: [R(0.26, 0.42), R(0.22, 0.34)], alpha: [0.95, 0], fadeIn: 120 },
  // Electric Special: Thunderbolt (a crackling charge, then arcs on the target)
  chargeSparks: { tex: 'streak', blend: 'add', rate: 80, at: 'edges', dir: 'radial', speed: R(80, 240), life: R(90, 180), size: [R(0.35, 0.6), 0.1], alpha: [1, 0], tint: ['#ffe14a', '#ffffff'], alignVelocity: true },
  boltSparks: { tex: 'streak', blend: 'add', count: 30, at: 'centre', dir: 'radial', speed: R(500, 1100), gravity: 600, drag: 1, life: R(200, 420), size: [R(0.5, 0.9), 0.2], alpha: [1, 0], tint: ['#ffe94a', '#ffffff'], alignVelocity: true },
  crackleArcs: { tex: 'lightning', blend: 'add', rate: 34, at: 'edges', dir: 'none', life: R(60, 130), size: [R(0.08, 0.13), R(0.08, 0.13)], alpha: [1, 0.5], rot: R(0, 6.28), tint: ['#ffe94a', '#ffffff'] },
  // Fighting Physical: a flurry of strikes
  strikeRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', life: 300, size: [0.15, 0.75], alpha: [0.9, 0], tint: '#ffb08a' },
  fistSparks: { tex: 'streak', blend: 'add', count: 14, at: 'centre', dir: 'radial', speed: R(380, 820), gravity: 700, drag: 1, life: R(200, 380), size: [R(0.45, 0.8), 0.2], alpha: [1, 0], tint: ['#ffb070', '#ffffff'], alignVelocity: true },
  // Dark Physical: Feint Attack (melts into shadow, slashes from behind)
  shadowMelt: { tex: 'shadow', blend: 'alpha', rate: 24, at: 'card', area: 0.8, dir: 'up', speed: R(40, 120), life: R(400, 650), size: [R(0.12, 0.17), R(0.24, 0.32)], alpha: [0.85, 0], fadeIn: 60, rot: R(0, 6.28), spin: R(-1, 1) },
  shadowPuff: { tex: 'shadow', blend: 'alpha', count: 6, at: 'card', area: 0.5, dir: 'radial', speed: R(40, 140), drag: 1.5, life: R(450, 700), size: [R(0.16, 0.22), R(0.34, 0.46)], alpha: [0.8, 0], rot: R(0, 6.28), spin: R(-1.2, 1.2) },
  slashMarks: { tex: 'slash', blend: 'add', count: 1, at: 'centre', life: 440, size: [0.32, 0.88], alpha: [1, 0], rot: R(-0.2, 0.2) },
  slashSparks: { tex: 'streak', blend: 'add', count: 18, at: 'centre', dir: 'radial', speed: R(300, 800), drag: 1.2, life: R(200, 380), size: [R(0.4, 0.8), 0.15], alpha: [1, 0], tint: ['#c070ff', '#ffffff'], alignVelocity: true },
  // Normal Physical: Body Slam (a heavy drop, a dust burst)
  dustBurst: { tex: 'smoke', blend: 'alpha', count: 20, at: 'centre', offsetY: 0.3, dir: 'radial', speed: R(180, 480), lift: 30, drag: 2.2, life: R(800, 1200), size: [R(0.16, 0.24), R(0.5, 0.75)], alpha: [0.8, 0], tint: '#e4cfa6', spin: R(-0.6, 0.6) },
  debris: { tex: 'shard', blend: 'alpha', count: 16, at: 'centre', dir: 'radial', speed: R(300, 700), lift: 300, gravity: 1500, life: R(500, 800), size: [R(0.4, 0.7), 0.3], alpha: [1, 0], tint: '#8a6a44', spin: R(-10, 10) },
  slamRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', offsetY: 0.2, life: 520, size: [0.3, 1.7], alpha: [0.6, 0], tint: '#f0dcb0' },
  // Keyword touches
  afterimage: { tex: 'shadow', blend: 'alpha', rate: 30, at: 'card', area: 0.6, dir: 'back', speed: R(30, 90), life: R(260, 420), size: [R(0.14, 0.2), R(0.24, 0.32)], alpha: [0.55, 0], rot: R(0, 6.28), spin: R(-1, 1) },
  guardShadow: { tex: 'shadow', blend: 'alpha', count: 4, at: 'card', area: 0.4, offsetY: -0.45, dir: 'up', speed: R(30, 80), life: R(500, 750), size: [R(0.16, 0.22), R(0.3, 0.4)], alpha: [0.7, 0], rot: R(0, 6.28), spin: R(-1, 1) },
  shellShimmer: { tex: 'bubble', blend: 'alpha', count: 1, at: 'centre', life: 560, size: [0.42, 0.52], alpha: [0.55, 0], fadeIn: 40, tint: '#c8f2ff' },
  shellGlints: { tex: 'sparkle', blend: 'add', count: 10, at: 'card', area: 0.9, dir: 'radial', speed: R(20, 80), life: R(300, 520), size: [R(0.4, 0.7), 0.1], alpha: [1, 0], tint: '#e0f8ff' },
  overrunEmbers: { tex: 'embers', blend: 'add', rate: 120, at: 'centre', dir: 'back', speed: R(60, 200), life: R(260, 420), size: [R(0.6, 1), 0.2], alpha: [1, 0], spin: R(-6, 6) },
  overrunFlame: { tex: 'flame', blend: 'add', rate: 90, at: 'centre', dir: 'back', speed: R(120, 260), life: R(220, 360), size: [R(0.2, 0.3), R(0.1, 0.14)], alpha: [0.9, 0], pivot: 0.75, alignBack: true },
  overrunWater: { tex: 'droplets', blend: 'alpha', rate: 110, at: 'centre', dir: 'back', speed: R(80, 240), gravity: 500, life: R(260, 460), size: [R(0.4, 0.7), 0.2], alpha: [1, 0], spin: R(-6, 6) },
  overrunStreaks: { tex: 'streak', blend: 'add', rate: 90, at: 'centre', dir: 'back', speed: R(200, 420), life: R(140, 260), size: [R(0.5, 0.8), 0.2], alpha: [1, 0], tint: 'type', alignVelocity: true },
  overrunShadow: { tex: 'shadow', blend: 'alpha', rate: 50, at: 'centre', dir: 'back', speed: R(40, 120), life: R(260, 420), size: [R(0.12, 0.16), R(0.22, 0.3)], alpha: [0.75, 0], rot: R(0, 6.28), spin: R(-1, 1) },
  overrunDust: { tex: 'smoke', blend: 'alpha', rate: 40, at: 'centre', dir: 'back', speed: R(60, 160), life: R(400, 600), size: [R(0.1, 0.14), R(0.24, 0.32)], alpha: [0.55, 0], tint: '#c9a878', spin: R(-0.6, 0.6) },
  // Burn from a Pokémon's ability: embers cast from it to the target
  emberStream: { tex: 'embers', blend: 'add', rate: 90, at: 'muzzle', dir: 'forward', speed: R(700, 1000), spreadDeg: 10, toTarget: true, life: R(380, 520), size: [R(0.6, 0.9), 0.3], alpha: [1, 0.2], spin: R(-8, 8) },
  // Strategy Cards: the shared opening (a flare in the card's Type colour, then it dissolves)
  strategyFlare: { tex: 'glow', blend: 'add', count: 1, at: 'centre', life: 560, size: [0.8, 3.4], alpha: [1, 0], tint: 'type' },
  flareRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', life: 560, size: [0.3, 1.7], alpha: [0.85, 0], tint: 'type' },
  flareSparks: { tex: 'streak', blend: 'add', rate: 50, at: 'edges', dir: 'radial', speed: R(200, 520), drag: 1.5, life: R(250, 450), size: [R(0.4, 0.8), 0.1], alpha: [1, 0], tint: 'type', alignVelocity: true },
  dissolveMotes: { tex: 'sparkle', blend: 'add', rate: 110, at: 'card', area: 1, dir: 'up', speed: R(60, 200), lift: 40, drag: 1, life: R(400, 700), size: [R(0.16, 0.3), 0.04], alpha: [1, 0], tint: 'type', spin: R(-3, 3) },
  // Ember: a glowing coal arcs over and catches on the target
  coalSparks: { tex: 'embers', blend: 'add', rate: 80, at: 'centre', dir: 'back', speed: R(40, 160), gravity: 300, life: R(250, 450), size: [R(0.4, 0.7), 0.1], alpha: [1, 0], spin: R(-6, 6) },
  emberCling: { tex: 'embers', blend: 'add', rate: 34, at: 'edges', dir: 'up', speed: R(30, 90), life: R(400, 700), size: [R(0.4, 0.6), 0.1], alpha: [1, 0], spin: R(-4, 4) },
  // Flame Charge: fire spirals up around the Pokémon; the aura stays for the Round
  spiralFlames: { tex: 'flame', blend: 'add', rate: 120, at: 'orbit', radius: R(0.58, 0.7), offsetY: 0.45, orbit: R(5, 7), rise: R(220, 320), life: R(420, 640), size: [R(0.1, 0.15), R(0.18, 0.26)], alpha: [0.95, 0], fadeIn: 40, pivot: 0.85 },
  spiralEmbers: { tex: 'embers', blend: 'add', rate: 60, at: 'orbit', radius: R(0.5, 0.75), offsetY: 0.4, orbit: R(5, 8), rise: R(260, 380), life: R(500, 800), size: [R(0.4, 0.7), 0.1], alpha: [1, 0], spin: R(-6, 6) },
  chargeBurst: { tex: 'fire-burst', blend: 'add', count: 1, at: 'centre', life: 420, size: [0.2, 0.8], alpha: [0.85, 0] },
  auraFlames: { tex: 'flame', blend: 'add', rate: 9, at: 'edges', dir: 'up', speed: R(50, 100), life: R(350, 550), size: [R(0.06, 0.09), R(0.1, 0.14)], alpha: [0.8, 0], fadeIn: 60, pivot: 0.9, rot: R(-0.2, 0.2), tint: '#ffc060' },
  auraMotes: { tex: 'embers', blend: 'add', rate: 6, at: 'orbit', radius: R(0.55, 0.65), offsetY: 0.3, orbit: R(2.5, 3.5), rise: R(40, 80), life: R(1200, 1700), size: [R(0.3, 0.45), 0.15], alpha: [0.9, 0], fadeIn: 200 },
  // Heat Wave: a wall of heat rolling across the enemy side
  heatFlames: { tex: 'flame', blend: 'add', rate: 240, at: 'line', dir: 'up', speed: R(80, 200), life: R(250, 420), size: [R(0.1, 0.16), R(0.2, 0.3)], alpha: [0.85, 0], pivot: 0.85, rot: R(-0.2, 0.2) },
  heatEmbers: { tex: 'embers', blend: 'add', rate: 80, at: 'line', dir: 'forward', speed: R(100, 300), lift: 60, life: R(400, 700), size: [R(0.4, 0.7), 0.1], alpha: [1, 0], spin: R(-6, 6) },
  heatIgnite: { tex: 'flame', blend: 'add', count: 16, at: 'edges', dir: 'up', speed: R(200, 380), life: R(350, 560), size: [R(0.14, 0.22), R(0.28, 0.4)], alpha: [1, 0], pivot: 0.85, rot: R(-0.2, 0.2) },
  // Fire Blast: a fireball, then the 大-shaped five-pointed burst
  blastFlames: { tex: 'flame', blend: 'add', rate: 160, at: 'centre', dir: 'back', speed: R(160, 320), life: R(200, 340), size: [R(0.22, 0.32), R(0.1, 0.16)], alpha: [0.95, 0], pivot: 0.75, alignBack: true },
  daiFlames: { tex: 'flame', blend: 'add', count: 90, at: 'dai', dir: 'arm', speed: R(120, 300), life: R(420, 620), size: [R(0.16, 0.24), R(0.28, 0.42)], alpha: [1, 0], pivot: 0.8, alignArm: true },
  daiCore: { tex: 'fire-burst', blend: 'add', count: 1, at: 'centre', life: 520, size: [0.3, 1.3], alpha: [1, 0] },
  // Aqua Ring: rings of water around the Pokémon, steam if it was burning, glints as it heals
  ringRipples: { tex: 'ripple', blend: 'alpha', rate: 16, at: 'centre', offsetY: R(-0.35, 0.4), dir: 'none', life: R(560, 760), size: [0.18, 0.56], alpha: [1, 0.1], squash: 0.32 },
  ringDroplets: { tex: 'droplets', blend: 'alpha', rate: 50, at: 'orbit', radius: R(0.6, 0.7), offsetY: R(-0.3, 0.4), orbit: R(5, 7), rise: R(20, 60), life: R(400, 650), size: [R(0.3, 0.45), 0.15], alpha: [0.95, 0] },
  healGlints: { tex: 'sparkle', blend: 'add', count: 14, at: 'card', area: 0.9, dir: 'up', speed: R(30, 90), life: R(500, 800), size: [R(0.16, 0.28), 0.04], alpha: [1, 0], spin: R(-2, 2), tint: '#f0fff6' },
  healSparkle: { tex: 'sparkle', blend: 'add', rate: 22, at: 'card', area: 0.9, dir: 'up', speed: R(20, 70), life: R(500, 800), size: [R(0.14, 0.24), 0.04], alpha: [1, 0], spin: R(-2, 2), tint: '#e8fff0' },
  // Bubble Beam: a stream of bubbles that pop on the target
  bubbleStream: { tex: 'bubble', blend: 'alpha', rate: 26, at: 'muzzle', dir: 'forward', speed: R(500, 780), spreadDeg: 9, toTarget: true, life: R(600, 900), size: [R(0.05, 0.09), R(0.06, 0.1)], alpha: [0.9, 0.75] },
  bubbleSmall: { tex: 'bubble', blend: 'alpha', rate: 30, at: 'muzzle', dir: 'forward', speed: R(450, 700), spreadDeg: 16, toTarget: true, life: R(600, 900), size: [R(0.025, 0.045), R(0.03, 0.05)], alpha: [0.85, 0.7] },
  bubblePops: { tex: 'sparkle', blend: 'add', rate: 34, at: 'card', area: 0.7, dir: 'radial', speed: R(40, 120), life: R(150, 260), size: [R(0.12, 0.2), 0.04], alpha: [1, 0], tint: '#dff6ff' },
  // Dive: a water surface spreads over the Discard Pile
  pileRipple: { tex: 'ripple', blend: 'alpha', rate: 6, at: 'centre', dir: 'none', life: R(700, 900), size: [0.06, 0.4], alpha: [0.95, 0], squash: 0.45 },
  pileDroplets: { tex: 'droplets', blend: 'alpha', rate: 30, at: 'card', area: 0.6, dir: 'up', speed: R(120, 260), gravity: 700, life: R(400, 650), size: [R(0.3, 0.5), 0.15], alpha: [0.95, 0] },
  // Surf: spray and foam along the wave's front
  surfSpray: { tex: 'droplets', blend: 'alpha', rate: 160, at: 'line', dir: 'forward', speed: R(120, 360), lift: 160, gravity: 900, life: R(350, 600), size: [R(0.4, 0.7), 0.2], alpha: [1, 0], spin: R(-6, 6) },
  surfFoam: { tex: 'smoke', blend: 'alpha', rate: 40, at: 'line', dir: 'forward', speed: R(40, 120), life: R(500, 800), size: [R(0.1, 0.16), R(0.24, 0.34)], alpha: [0.6, 0], tint: '#eaf8ff', spin: R(-0.6, 0.6) },
  // Summons: a slam with a dust ring; a Type flare (Rare); a bigger flare and a light shaft (Epic)
  landRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', offsetY: 0.45, life: 480, size: [0.2, 1], alpha: [0.7, 0], tint: '#f0d8a8' },
  landDust: { tex: 'smoke', blend: 'alpha', count: 9, at: 'card', area: 0.8, offsetY: 0.42, dir: 'radial', speed: R(90, 240), lift: 20, drag: 2, life: R(600, 900), size: [R(0.08, 0.12), R(0.22, 0.32)], alpha: [0.6, 0], tint: '#d2b488', spin: R(-0.6, 0.6) },
  typeFlare: { tex: 'glow', blend: 'add', count: 1, at: 'centre', life: 520, size: [0.6, 2.4], alpha: [0.9, 0], tint: 'type' },
  epicFlare: { tex: 'glow', blend: 'add', count: 2, at: 'centre', life: 700, size: [0.8, 3.6], alpha: [1, 0], tint: 'type' },
  epicSparks: { tex: 'sparkle', blend: 'add', count: 18, at: 'card', area: 1, dir: 'radial', speed: R(120, 320), drag: 1.6, life: R(500, 800), size: [R(0.18, 0.3), 0.05], alpha: [1, 0], tint: 'type', spin: R(-3, 3) },
  lightShaft: { tex: 'glow', blend: 'add', count: 1, at: 'centre', offsetY: -0.9, life: 900, size: [0.9, 1.1], squash: 7, alpha: [0.75, 0], fadeIn: 120, tint: 'type' },
  speedLines: { tex: 'streak', blend: 'add', count: 14, at: 'card', area: 0.9, dir: 'back', speed: R(500, 900), drag: 2, life: R(160, 300), size: [R(0.6, 1), 0.2], alpha: [1, 0], tint: ['#fff6c8', '#ffffff'], alignVelocity: true },
  // Legendary cinematics
  bigLandRing: { tex: 'shockwave', blend: 'add', count: 2, at: 'centre', offsetY: 0.45, life: 700, size: [0.3, 2.4], alpha: [0.8, 0], tint: 'type' },
  kyogreWave: { tex: 'wave', blend: 'alpha', count: 2, at: 'card', area: 1.2, offsetY: 0.4, dir: 'radial', speed: R(40, 120), life: R(800, 1000), size: [R(0.5, 0.7), R(1.1, 1.4)], alpha: [0.95, 0], fadeIn: 120 },
  rainBurst: { tex: 'streak', blend: 'add', rate: 160, at: 'card', area: 7, offsetY: -2.4, dir: 'down', speed: R(1300, 1800), life: R(450, 700), size: [R(0.5, 0.8), R(0.5, 0.8)], alpha: [0.75, 0.2], tint: ['#8fd0ff', '#e0f4ff'], alignVelocity: true },
  rainDrops: { tex: 'droplets', blend: 'alpha', rate: 50, at: 'card', area: 6, offsetY: -2, dir: 'down', speed: R(900, 1300), life: R(500, 800), size: [R(0.3, 0.5), 0.3], alpha: [0.9, 0.3] },
  eruption: { tex: 'fire-burst', blend: 'add', count: 3, at: 'centre', offsetY: 0.2, life: R(500, 700), size: [R(0.3, 0.4), R(1.4, 1.9)], alpha: [1, 0], spin: R(-1, 1) },
  eruptionFlames: { tex: 'flame', blend: 'add', count: 46, at: 'card', area: 0.9, offsetY: 0.3, dir: 'up', speed: R(500, 1100), gravity: 300, life: R(500, 800), size: [R(0.2, 0.32), R(0.4, 0.6)], alpha: [1, 0], pivot: 0.85, rot: R(-0.3, 0.3) },
  eruptionColumn: { tex: 'flame', blend: 'add', rate: 120, at: 'edges', dir: 'up', speed: R(400, 700), life: R(300, 500), size: [R(0.16, 0.24), R(0.3, 0.44)], alpha: [0.9, 0], pivot: 0.85, rot: R(-0.2, 0.2) },
  // Defeats: burnt to ash, washed away, shattered
  charEdges: { tex: 'flame', blend: 'add', rate: 80, at: 'edges', dir: 'up', speed: R(80, 180), life: R(300, 500), size: [R(0.08, 0.13), R(0.16, 0.24)], alpha: [0.95, 0], pivot: 0.85, rot: R(-0.2, 0.2) },
  ashCrumble: { tex: 'shard', blend: 'alpha', rate: 70, at: 'card', area: 0.9, dir: 'down', speed: R(40, 120), gravity: 500, life: R(500, 800), size: [R(0.3, 0.6), 0.2], alpha: [1, 0], tint: '#2a1a12', spin: R(-6, 6) },
  ashSmoke: { tex: 'smoke', blend: 'alpha', rate: 14, at: 'card', area: 0.8, dir: 'up', speed: R(40, 90), life: R(700, 1000), size: [R(0.1, 0.14), R(0.26, 0.36)], alpha: [0.55, 0], tint: '#3a302a', spin: R(-0.5, 0.5) },
  risingEmbers: { tex: 'embers', blend: 'add', rate: 70, at: 'card', area: 0.9, dir: 'up', speed: R(80, 220), lift: 40, life: R(600, 1000), size: [R(0.4, 0.7), 0.15], alpha: [1, 0], spin: R(-5, 5) },
  dripDroplets: { tex: 'droplets', blend: 'alpha', rate: 60, at: 'card', area: 0.9, dir: 'down', speed: R(60, 160), gravity: 900, life: R(400, 700), size: [R(0.3, 0.5), 0.25], alpha: [1, 0] },
  cardShards: { tex: 'shard', blend: 'alpha', count: 30, at: 'card', area: 0.9, dir: 'radial', speed: R(180, 520), lift: 160, gravity: 1400, life: R(600, 900), size: [R(0.4, 0.75), 0.3], alpha: [1, 0], tint: ['#c8b48a', '#6a4a2c'], spin: R(-10, 10) },
  breakSparks: { tex: 'streak', blend: 'add', count: 16, at: 'centre', dir: 'radial', speed: R(300, 700), drag: 1.5, life: R(200, 360), size: [R(0.4, 0.7), 0.1], alpha: [1, 0], tint: ['#fff3c4', '#ffffff'], alignVelocity: true },
  // Healing and Regenerate: a rising green-gold glow with glints
  healRise: { tex: 'glow', blend: 'add', count: 5, at: 'card', area: 0.6, offsetY: 0.3, dir: 'up', speed: R(60, 140), life: R(600, 900), size: [R(0.5, 0.8), R(0.9, 1.2)], alpha: [0.6, 0], tint: ['#7dffb0', '#ffe48a'] },
  regenRise: { tex: 'glow', blend: 'add', count: 3, at: 'card', area: 0.6, offsetY: 0.3, dir: 'up', speed: R(40, 100), life: R(600, 900), size: [R(0.4, 0.6), R(0.7, 0.9)], alpha: [0.4, 0], tint: ['#7dffb0', '#ffe48a'] },
  regenSparkle: { tex: 'sparkle', blend: 'add', rate: 10, at: 'card', area: 0.8, dir: 'up', speed: R(20, 60), life: R(500, 800), size: [R(0.12, 0.2), 0.04], alpha: [0.9, 0], spin: R(-2, 2), tint: '#e8fff0' },
  // Trainers: a flash as they're hit; cracks spreading with light through them as they fall
  trainerFlash: { tex: 'glow', blend: 'add', count: 1, at: 'centre', life: 260, size: [0.6, 1.6], alpha: [0.7, 0], tint: '#fff2d8' },
  crackSpread: { tex: 'cracks', blend: 'add', count: 2, at: 'centre', life: 1300, size: [0.18, 0.5], alpha: [1, 0.9], fadeIn: 60, rot: R(-0.4, 0.4), tint: '#ffd870' },
  crackLight: { tex: 'glow', blend: 'add', rate: 14, at: 'card', area: 0.7, dir: 'none', life: R(200, 360), size: [R(0.3, 0.5), R(0.6, 0.9)], alpha: [0.8, 0], tint: ['#ffd36b', '#ffffff'] },
  // Supporters: glints round the portrait, a gold flourish when the Gift Bonus is met
  portraitGlints: { tex: 'sparkle', blend: 'add', rate: 24, at: 'edges', dir: 'up', speed: R(30, 90), life: R(500, 800), size: [R(0.16, 0.26), 0.04], alpha: [1, 0], spin: R(-2, 2), tint: '#fff0c0' },
  giftSparkles: { tex: 'sparkle', blend: 'add', count: 36, at: 'centre', dir: 'radial', speed: R(200, 520), drag: 1.6, life: R(600, 1000), size: [R(0.2, 0.36), 0.05], alpha: [1, 0], spin: R(-4, 4), tint: ['#ffd36b', '#fff6c8'] },
  giftRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', offsetY: 0.12, life: 700, size: [0.2, 0.95], alpha: [0.85, 0], tint: '#ffcf5a' },
  // The end of the match: across the whole screen, falling from the top
  crestSparkle: { tex: 'sparkle', blend: 'add', count: 40, at: 'centre', offsetY: -0.22, dir: 'radial', speed: R(200, 600), drag: 1.4, life: R(700, 1200), size: [R(0.06, 0.12), 0.02], alpha: [1, 0], spin: R(-4, 4), tint: ['#ffd36b', '#fff6c8'] },
  crestRing: { tex: 'shockwave', blend: 'add', count: 1, at: 'centre', offsetY: -0.22, life: 800, size: [0.1, 0.9], alpha: [0.9, 0], tint: '#ffcf5a' },
  confettiEmbers: { tex: 'embers', blend: 'add', rate: 60, at: 'top', dir: 'down', speed: R(160, 320), gravity: 60, life: R(2200, 3200), size: [R(0.3, 0.55), R(0.2, 0.4)], alpha: [1, 0.3], spin: R(-6, 6) },
  confettiDroplets: { tex: 'droplets', blend: 'alpha', rate: 60, at: 'top', dir: 'down', speed: R(200, 380), gravity: 80, life: R(2000, 3000), size: [R(0.3, 0.5), R(0.25, 0.4)], alpha: [1, 0.4], spin: R(-4, 4) },
  confettiGold: { tex: 'sparkle', blend: 'add', rate: 30, at: 'top', dir: 'down', speed: R(120, 260), life: R(2200, 3200), size: [R(0.05, 0.09), 0.03], alpha: [1, 0.2], spin: R(-4, 4), tint: ['#ffd36b', '#fff6c8'] },
  ashFall: { tex: 'shard', blend: 'alpha', rate: 50, at: 'top', dir: 'down', speed: R(60, 140), life: R(3000, 4000), size: [R(0.2, 0.4), R(0.15, 0.3)], alpha: [0.85, 0.2], tint: ['#5a4a42', '#2a201a'], spin: R(-3, 3) },
  ashFlakes: { tex: 'smoke', blend: 'alpha', rate: 6, at: 'top', dir: 'down', speed: R(40, 90), life: R(3000, 4000), size: [R(0.06, 0.1), R(0.12, 0.18)], alpha: [0.35, 0], tint: '#3a302a', spin: R(-0.5, 0.5) },
  rainFall: { tex: 'streak', blend: 'add', rate: 140, at: 'top', dir: 'down', speed: R(1100, 1500), life: R(700, 1000), size: [R(0.5, 0.9), R(0.5, 0.9)], alpha: [0.45, 0.15], tint: ['#7a9cc8', '#b8cce8'], alignVelocity: true },
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
    budget: 'attack', duration: 1250, approach: [240, 500],
    style: { flash: 'fire', overrunTrail: 'overrunFlame', overrunBurst: 'fireBurst' },
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
    budget: 'attack', duration: 1300, approach: [220, 420],
    style: { flash: 'fire', overrunTrail: 'overrunEmbers', overrunBurst: 'fireBurst' },
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
  // Water Physical (Goldeen, Quagsire, Gyarados): Waterfall. The card surges up
  // inside a column of water and crashes down onto the target in a splash.
  'water-physical': {
    budget: 'attack', duration: 1250, approach: [520, 760],
    style: { flash: 'water', overrunTrail: 'overrunWater', overrunBurst: 'splashCrown' },
    beats: [
      { at: 0, end: 260, track: 'attacker', motion: 'rise' },
      { at: 0, end: 560, emit: 'waterColumn', on: 'attacker' },
      { at: 0, end: 560, emit: 'columnDroplets', on: 'attacker' },
      { at: 100, end: 560, emit: 'columnMist', on: 'attacker' },
      { at: 260, end: 520, track: 'attacker', motion: 'surge' },
      { at: 520, end: 760, track: 'attacker', motion: 'crash' },
      { at: 520, end: 760, ribbon: 'waterTrail', on: 'attacker' },
      { at: 520, end: 760, emit: 'columnDroplets', on: 'attacker' },
      { at: 760, cue: 'impact', hitstop: 80, shake: 14, flash: 'water', bloom: 0.8, distort: 'shockwave' },
      { at: 760, emit: 'splashCrown', on: 'impact' },
      { at: 760, emit: 'splashDroplets', on: 'impact' },
      { at: 760, emit: 'splashMist', on: 'impact' },
      { at: 760, emit: 'groundRing', on: 'impact', tint: '#9fd8ff' },
      { at: 760, end: 1120, track: 'attacker', motion: 'return' },
      { at: 760, end: 1220, track: 'target', motion: 'drenched' },
    ],
  },
  // Water Special (Horsea, Wartortle, Lapras, Pelipper, Vaporeon, Kyogre): Hydro
  // Pump. A spiralling jet, spray at the impact, droplets beading and running
  // down the target.
  'water-special': {
    budget: 'attack', duration: 1300, approach: [220, 420],
    style: { flash: 'water', overrunTrail: 'overrunWater', overrunBurst: 'splashCrown' },
    beats: [
      { at: 0, end: 220, track: 'attacker', motion: 'rear' },
      { at: 0, end: 220, emit: 'chargeOrb', on: 'attacker', tint: ['#3a9cff', '#bfe4ff'] },
      { at: 220, end: 760, track: 'attacker', motion: 'brace' },
      { at: 220, end: 720, emit: 'hydroJet', on: 'attacker' },
      { at: 220, end: 720, emit: 'jetDroplets', on: 'attacker' },
      { at: 220, end: 720, ribbon: 'hydroStream', on: 'attacker' },
      { at: 220, end: 720, ribbon: 'hydroStreamCore', on: 'attacker' },
      { at: 420, cue: 'impact', hitstop: 50, shake: 8, flash: 'water', bloom: 0.7 },
      { at: 420, emit: 'sprayDroplets', on: 'impact' },
      { at: 420, end: 760, emit: 'spray', on: 'target' },
      { at: 420, end: 1150, emit: 'dropletsBead', on: 'target' },
      { at: 420, end: 1100, track: 'target', motion: 'drenched' },
      { at: 760, end: 1000, track: 'attacker', motion: 'settle' },
    ],
  },
  // Electric Special (Chinchou): Thunderbolt. A crackling charge, a forked bolt
  // with a one-frame white flicker, and the target crackles for a moment after.
  'electric-special': {
    budget: 'attack', duration: 1150, approach: [320, 360],
    style: { flash: 'electric', overrunTrail: 'overrunStreaks', overrunBurst: 'boltSparks', overrunTint: ['#ffe14a', '#ffffff'] },
    beats: [
      { at: 0, end: 320, track: 'attacker', motion: 'charge' },
      { at: 0, end: 320, emit: 'chargeSparks', on: 'attacker' },
      { at: 0, end: 320, emit: 'chargeOrb', on: 'attacker', tint: ['#ffd51a', '#fff7b0'] },
      { at: 320, cue: 'bolt', flicker: true },
      { at: 320, end: 480, beam: 'lightningBolt', on: 'attacker' },
      { at: 360, cue: 'impact', hitstop: 70, shake: 10, flash: 'electric', bloom: 1.2, distort: 'shockwave' },
      { at: 360, emit: 'impactStar', on: 'impact', tint: ['#fff3a0', '#ffffff'] },
      { at: 360, emit: 'boltSparks', on: 'impact' },
      { at: 360, end: 900, emit: 'crackleArcs', on: 'target' },
      { at: 360, end: 1000, track: 'target', motion: 'shocked' },
      { at: 480, end: 760, track: 'attacker', motion: 'settle' },
    ],
  },
  // Fighting Physical (Mankey): a flurry of three rapid strikes, each with an
  // impact starburst and a shockwave ring; a short hit-stop on the last.
  'fighting-physical': {
    budget: 'attack', duration: 1200, approach: [200, 380],
    style: { flash: 'type', overrunTrail: 'overrunStreaks', overrunBurst: 'fistSparks' },
    beats: [
      { at: 0, end: 200, track: 'attacker', motion: 'windup' },
      { at: 200, end: 380, track: 'attacker', motion: 'dash' },
      { at: 200, end: 380, ribbon: 'tintTrail', on: 'attacker' },
      { at: 380, end: 660, track: 'attacker', motion: 'flurry' },
      { at: 380, cue: 'jab', shake: 5, flash: 'type', bloom: 0.4 },
      { at: 380, emit: 'impactStar', on: 'impact', tint: ['#ffd0a0', '#ffffff'] },
      { at: 380, emit: 'strikeRing', on: 'impact' },
      { at: 520, cue: 'jab', shake: 6, flash: 'type', bloom: 0.5 },
      { at: 520, emit: 'impactStar', on: 'impact', tint: ['#ffd0a0', '#ffffff'] },
      { at: 520, emit: 'strikeRing', on: 'impact' },
      { at: 660, cue: 'impact', hitstop: 90, shake: 13, flash: 'type', bloom: 0.9, distort: 'shockwave' },
      { at: 660, emit: 'impactStar', on: 'impact', tint: ['#ffd0a0', '#ffffff'] },
      { at: 660, emit: 'strikeRing', on: 'impact' },
      { at: 660, emit: 'fistSparks', on: 'impact' },
      { at: 660, emit: 'genericDust', on: 'impact' },
      { at: 660, end: 1000, track: 'attacker', motion: 'return' },
      { at: 380, end: 1150, track: 'target', motion: 'recoil' },
    ],
  },
  // Dark Physical (Sneasel): Feint Attack. The card melts into shadow, reappears
  // behind the target and slashes; the shadow fades back to its space.
  'dark-physical': {
    budget: 'attack', duration: 1250, approach: [0, 440],
    style: { flash: 'dark', overrunTrail: 'overrunShadow', overrunBurst: 'slashMarks' },
    beats: [
      { at: 0, end: 260, track: 'attacker', motion: 'melt' },
      { at: 0, end: 300, emit: 'shadowMelt', on: 'attacker' },
      { at: 260, emit: 'shadowPuff', on: 'attacker' },
      { at: 260, end: 420, track: 'attacker', motion: 'vanish' },
      { at: 330, emit: 'shadowPuff', on: 'behind' },
      { at: 420, end: 620, track: 'attacker', motion: 'strikeBehind' },
      { at: 440, cue: 'impact', hitstop: 80, shake: 12, flash: 'dark', bloom: 0.9, distort: 'shockwave' },
      { at: 440, emit: 'slashMarks', on: 'target' },
      { at: 440, emit: 'slashSparks', on: 'target' },
      { at: 440, end: 1050, track: 'target', motion: 'recoil' },
      { at: 620, end: 1150, track: 'attacker', motion: 'fadeBack' },
      { at: 620, end: 800, emit: 'shadowMelt', on: 'attacker' },
    ],
  },
  // Normal Physical (Chansey): Body Slam. A slow lift, then a heavy drop with a
  // big dust burst and a strong shake.
  'normal-physical': {
    budget: 'attack', duration: 1250, approach: [420, 640],
    style: { flash: 'white', overrunTrail: 'overrunDust', overrunBurst: 'dustBurst' },
    beats: [
      { at: 0, end: 420, track: 'attacker', motion: 'heave' },
      { at: 420, end: 640, track: 'attacker', motion: 'slam' },
      { at: 640, cue: 'impact', hitstop: 120, shake: 22, flash: 'white', bloom: 1, distort: 'shockwave' },
      { at: 640, emit: 'impactStar', on: 'impact', tint: ['#fff3d0', '#ffffff'] },
      { at: 640, emit: 'dustBurst', on: 'impact' },
      { at: 640, emit: 'debris', on: 'impact' },
      { at: 640, emit: 'slamRing', on: 'impact' },
      { at: 640, end: 1000, track: 'attacker', motion: 'return' },
      { at: 640, end: 1200, track: 'target', motion: 'recoil' },
    ],
  },
  // Burn from a Pokémon's ability (Charmander's and Houndoom's On Summon):
  // embers cast from it swirl into the target and become its Burn.
  'ember-cast': {
    budget: 'status', duration: 760,
    beats: [
      { at: 0, end: 260, emit: 'emberStream', on: 'attacker' },
      { at: 200, cue: 'scorch', emit: 'scorchSwirl', on: 'target' },
      { at: 620, cue: 'scorchCatch', emit: 'scorchCatch', on: 'target' },
    ],
  },
  // Generic Physical: a lunge and a tinted impact (the fallback for Types no deck uses yet).
  'generic-physical': {
    budget: 'attack', duration: 1000, approach: [220, 440],
    style: { overrunTrail: 'overrunStreaks', overrunBurst: 'genericSparks' },
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
  // Generic Special: an orb of the Type's colour flies across with a trail (the fallback).
  'generic-special': {
    budget: 'attack', duration: 1050, approach: [260, 560],
    style: { overrunTrail: 'overrunStreaks', overrunBurst: 'genericSparks' },
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
  'water-counter': {
    budget: 'counter', duration: 560,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 60, cue: 'counterHit', shake: 5, flash: 'water', bloom: 0.5 },
      { at: 60, emit: 'splashCrown', on: 'counterImpact', countScale: 0.5 },
      { at: 60, emit: 'sprayDroplets', on: 'counterImpact', countScale: 0.6 },
      { at: 160, end: 420, track: 'self', motion: 'settle' },
    ],
  },
  'electric-counter': {
    budget: 'counter', duration: 560,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 40, end: 150, beam: 'lightningBolt', on: 'attacker' },
      { at: 60, cue: 'counterHit', shake: 5, flash: 'electric', bloom: 0.7 },
      { at: 60, emit: 'boltSparks', on: 'counterImpact', countScale: 0.5 },
      { at: 60, end: 360, emit: 'crackleArcs', on: 'counterImpact' },
      { at: 160, end: 420, track: 'self', motion: 'settle' },
    ],
  },
  'fighting-counter': {
    budget: 'counter', duration: 520,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 60, cue: 'counterHit', shake: 6, flash: 'type', bloom: 0.5 },
      { at: 60, emit: 'impactStar', on: 'counterImpact', tint: ['#ffd0a0', '#ffffff'] },
      { at: 60, emit: 'strikeRing', on: 'counterImpact' },
      { at: 160, end: 400, track: 'self', motion: 'settle' },
    ],
  },
  'dark-counter': {
    budget: 'counter', duration: 540,
    beats: [
      { at: 0, end: 160, track: 'self', motion: 'flinchForward' },
      { at: 60, cue: 'counterHit', shake: 5, flash: 'dark', bloom: 0.5 },
      { at: 60, emit: 'slashMarks', on: 'counterImpact' },
      { at: 60, emit: 'shadowPuff', on: 'counterImpact', countScale: 0.5 },
      { at: 160, end: 400, track: 'self', motion: 'settle' },
    ],
  },
  'normal-counter': {
    budget: 'counter', duration: 560,
    beats: [
      { at: 0, end: 180, track: 'self', motion: 'flinchForward' },
      { at: 70, cue: 'counterHit', shake: 8, flash: 'white', bloom: 0.5 },
      { at: 70, emit: 'impactStar', on: 'counterImpact', tint: ['#fff3d0', '#ffffff'] },
      { at: 70, emit: 'dustBurst', on: 'counterImpact', countScale: 0.5 },
      { at: 180, end: 420, track: 'self', motion: 'settle' },
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
  // --- Strategy Cards: each card's own effect (the opening goes in front, composeStrategy) ---
  // Ember: a single glowing coal arcs over and catches on the target (into the Burn visuals).
  'strategy-ember': {
    budget: 'strategy', duration: 1050,
    beats: [
      { at: 0, end: 440, projectile: 'coal', on: 'path', glow: '#ff7a1a', size: 0.7 },
      { at: 0, end: 440, ribbon: 'coalTrail', on: 'projectile' },
      { at: 0, end: 440, emit: 'coalSparks', on: 'projectile' },
      { at: 440, cue: 'catch', flash: 'fire', bloom: 0.8 },
      { at: 440, emit: 'scorchCatch', on: 'target' },
      { at: 440, emit: 'fireImpactEmbers', on: 'target', countScale: 0.4 },
      { at: 440, end: 960, emit: 'emberCling', on: 'target' },
      { at: 440, end: 900, track: 'target', motion: 'scorched' },
    ],
  },
  // Flame Charge: fire spirals up around the friendly Pokémon; a burning aura stays on it this Round.
  'strategy-flame-charge': {
    budget: 'strategy', duration: 1050,
    beats: [
      { at: 0, end: 820, emit: 'spiralFlames', on: 'target' },
      { at: 0, end: 820, emit: 'spiralEmbers', on: 'target' },
      { at: 0, end: 900, track: 'target', motion: 'charging' },
      { at: 700, cue: 'aura', emit: 'chargeBurst', on: 'target', flash: 'fire', bloom: 0.8 },
    ],
  },
  // Heat Wave: a shimmering wall of heat rolls across the whole enemy side,
  // igniting every enemy Pokémon and Trainer as it passes.
  'strategy-heat-wave': {
    budget: 'strategy', duration: 1200,
    beats: [
      { at: 0, end: 1050, sweep: 'heatWall', on: 'enemySide' },
      { at: 1050, cue: 'waveDone', bloom: 0.6 },
    ],
  },
  // Fire Blast: a fireball, then the 大-shaped five-pointed fire burst slams into
  // the target: hit-stop and the damage, then Burn.
  'strategy-fire-blast': {
    budget: 'strategy', duration: 1180,
    beats: [
      { at: 0, end: 340, projectile: 'blast', on: 'path', glow: '#ff6a1a', size: 1.5 },
      { at: 0, end: 340, ribbon: 'blastTrail', on: 'projectile' },
      { at: 0, end: 340, emit: 'blastFlames', on: 'projectile' },
      { at: 340, cue: 'impact', hitstop: 110, shake: 18, flash: 'fire', bloom: 1.3, distort: 'shockwave' },
      { at: 340, emit: 'daiFlames', on: 'target' },
      { at: 340, emit: 'daiCore', on: 'target' },
      { at: 340, emit: 'fireImpactEmbers', on: 'target' },
      { at: 340, end: 900, track: 'target', motion: 'recoil' },
      { at: 760, cue: 'scorch', emit: 'scorchSwirl', on: 'target' },
      { at: 1120, cue: 'scorchCatch', emit: 'scorchCatch', on: 'target' },
    ],
  },
  // Aqua Ring: rings of water circle the Pokémon, put out any Burn with a hiss
  // of steam, and glisten as it heals.
  'strategy-aqua-ring': {
    budget: 'strategy', duration: 1100,
    beats: [
      { at: 0, end: 900, emit: 'ringRipples', on: 'target' },
      { at: 0, end: 900, emit: 'ringDroplets', on: 'target' },
      { at: 360, cue: 'douse', when: 'douse' },
      { at: 360, emit: 'steam', on: 'target', when: 'douse' },
      { at: 360, emit: 'steamHiss', on: 'target', when: 'douse' },
      { at: 360, end: 900, track: 'target', motion: 'cool', when: 'douse' },
      { at: 620, cue: 'heal', emit: 'healGlints', on: 'target', bloom: 0.5 },
      { at: 620, end: 1050, emit: 'healSparkle', on: 'target' },
    ],
  },
  // Bubble Beam: a stream of bubbles that pop on impact, fuller when Rain is 2 or more.
  'strategy-bubble-beam': {
    budget: 'strategy', duration: 1050,
    beats: [
      { at: 0, end: 620, emit: 'bubbleStream', on: 'card', fuller: true },
      { at: 0, end: 620, emit: 'bubbleSmall', on: 'card', fuller: true },
      { at: 320, cue: 'impact', hitstop: 50, shake: 7, flash: 'water', bloom: 0.6 },
      { at: 320, end: 760, emit: 'bubblePops', on: 'target', fuller: true },
      { at: 320, emit: 'sprayDroplets', on: 'target', countScale: 0.6 },
      { at: 320, end: 1000, track: 'target', motion: 'drenched' },
    ],
  },
  // Dive (when played): a water surface spreads over the Discard Pile. The chosen
  // Pokémon rises out of it when it is picked (DIVE_RISE).
  'strategy-dive': {
    budget: 'strategy', duration: 900,
    beats: [
      { at: 0, end: 820, emit: 'pileRipple', on: 'pile' },
      { at: 100, end: 700, emit: 'pileDroplets', on: 'pile' },
      { at: 100, emit: 'splashCrown', on: 'pile', countScale: 0.5 },
    ],
  },
  // Surf: a full wave sweeps from the caster's side across the board, crashing
  // over every enemy Pokémon and leaving friendly ones glinting.
  'strategy-surf': {
    budget: 'strategy', duration: 1300,
    beats: [
      { at: 0, end: 1150, sweep: 'surfWave', on: 'board' },
      { at: 1150, cue: 'waveDone', shake: 6 },
    ],
  },
  // A Strategy Card with no animation of its own yet: the opening, then a burst on the target.
  'strategy-generic': {
    budget: 'strategy', duration: 700,
    beats: [
      { at: 0, cue: 'impact', flash: 'type', bloom: 0.7 },
      { at: 0, emit: 'genericGlow', on: 'target' },
      { at: 0, emit: 'genericOrbs', on: 'target' },
    ],
  },
  'dive-rise': {
    budget: 'effect', duration: 950,
    beats: [
      { at: 0, end: 800, emit: 'pileRipple', on: 'pile' },
      { at: 80, cue: 'rise' },
      { at: 120, emit: 'splashCrown', on: 'pile', countScale: 0.5 },
      { at: 120, end: 600, emit: 'pileDroplets', on: 'pile' },
    ],
  },
  // --- Summon entrances by rarity (the card is the 'target') ---
  'summon-common': {
    budget: 'summon', duration: 700,
    beats: [
      { at: 0, end: 200, track: 'target', motion: 'slamDown' },
      { at: 200, cue: 'land', shake: 5 },
      { at: 200, emit: 'landRing', on: 'ground' },
      { at: 200, emit: 'landDust', on: 'ground' },
      { at: 200, end: 440, track: 'target', motion: 'settleLand' },
    ],
  },
  'summon-rare': {
    budget: 'summon', duration: 800,
    beats: [
      { at: 0, end: 200, track: 'target', motion: 'slamDown' },
      { at: 200, cue: 'land', shake: 6, bloom: 0.6 },
      { at: 200, emit: 'landRing', on: 'ground' },
      { at: 200, emit: 'landDust', on: 'ground' },
      { at: 200, emit: 'typeFlare', on: 'target' },
      { at: 200, emit: 'flareRing', on: 'target' },
      { at: 200, end: 440, track: 'target', motion: 'settleLand' },
    ],
  },
  'summon-epic': {
    budget: 'summon', duration: 1100,
    beats: [
      { at: 0, emit: 'lightShaft', on: 'target' },
      { at: 0, end: 260, track: 'target', motion: 'slamDown' },
      { at: 260, cue: 'land', shake: 8, bloom: 0.9, distort: 'shockwave' },
      { at: 260, emit: 'landRing', on: 'ground' },
      { at: 260, emit: 'landDust', on: 'ground' },
      { at: 260, emit: 'epicFlare', on: 'target' },
      { at: 260, emit: 'flareRing', on: 'target' },
      { at: 260, emit: 'epicSparks', on: 'target' },
      { at: 260, end: 520, track: 'target', motion: 'settleLand' },
    ],
  },
  // Legendary: the board dims, the card descends large to centre stage, then
  // shrinks into its space and lands.
  'summon-legendary': {
    budget: 'cinematic', duration: 2450,
    beats: [
      { at: 0, cue: 'dim' },
      { at: 0, end: 900, track: 'target', motion: 'descend' },
      { at: 700, emit: 'epicFlare', on: 'target' },
      { at: 700, emit: 'epicSparks', on: 'target' },
      { at: 900, end: 1500, track: 'target', motion: 'hover' },
      { at: 1500, end: 1900, track: 'target', motion: 'shrinkHome' },
      { at: 1900, cue: 'land', shake: 14, bloom: 1.2, distort: 'shockwave' },
      { at: 1900, emit: 'bigLandRing', on: 'ground' },
      { at: 1900, emit: 'landDust', on: 'ground', countScale: 2 },
      { at: 1900, emit: 'typeFlare', on: 'target' },
      { at: 2250, cue: 'undim' },
    ],
  },
  // Kyogre: a wave and a burst of rain while it hovers.
  'summon-kyogre': {
    budget: 'cinematic', duration: 2450,
    beats: [
      { at: 0, cue: 'dim' },
      { at: 0, end: 900, track: 'target', motion: 'descend' },
      { at: 700, emit: 'kyogreWave', on: 'target' },
      { at: 700, emit: 'epicFlare', on: 'target' },
      { at: 800, end: 1700, emit: 'rainBurst', on: 'target' },
      { at: 800, end: 1700, emit: 'rainDrops', on: 'target' },
      { at: 900, end: 1500, track: 'target', motion: 'hover' },
      { at: 1500, end: 1900, track: 'target', motion: 'shrinkHome' },
      { at: 1900, cue: 'land', shake: 14, bloom: 1.2, distort: 'shockwave' },
      { at: 1900, emit: 'bigLandRing', on: 'ground' },
      { at: 1900, emit: 'splashCrown', on: 'ground' },
      { at: 1900, emit: 'splashDroplets', on: 'ground' },
      { at: 2250, cue: 'undim' },
    ],
  },
  // Blaziken: an eruption of fire from its space as it lands.
  'summon-blaziken': {
    budget: 'cinematic', duration: 2450,
    beats: [
      { at: 0, cue: 'dim' },
      { at: 0, end: 900, track: 'target', motion: 'descend' },
      { at: 700, emit: 'epicFlare', on: 'target' },
      { at: 700, emit: 'epicSparks', on: 'target' },
      { at: 900, end: 1500, track: 'target', motion: 'hover' },
      { at: 1500, end: 1900, track: 'target', motion: 'shrinkHome' },
      { at: 1900, cue: 'land', shake: 16, flash: 'fire', bloom: 1.4, distort: 'shockwave' },
      { at: 1900, emit: 'eruption', on: 'ground' },
      { at: 1900, emit: 'eruptionFlames', on: 'ground' },
      { at: 1900, emit: 'fireImpactEmbers', on: 'ground' },
      { at: 1900, end: 2300, emit: 'eruptionColumn', on: 'ground' },
      { at: 1900, emit: 'bigLandRing', on: 'ground' },
      { at: 2250, cue: 'undim' },
    ],
  },
  // --- Defeats (the card is the 'target'); 'gone' sends the pieces to the Released Pile ---
  'defeat-ash': {
    budget: 'defeat', duration: 950,
    beats: [
      { at: 0, cue: 'defeatHit', flash: 'fire', shake: 4, bloom: 0.6 },
      { at: 0, end: 800, track: 'target', motion: 'char' },
      { at: 0, end: 560, emit: 'charEdges', on: 'target' },
      { at: 300, end: 850, emit: 'ashCrumble', on: 'target' },
      { at: 300, end: 900, emit: 'ashSmoke', on: 'target' },
      { at: 250, end: 900, emit: 'risingEmbers', on: 'target' },
      { at: 820, cue: 'gone' },
    ],
  },
  'defeat-wash': {
    budget: 'defeat', duration: 900,
    beats: [
      { at: 0, cue: 'defeatHit', flash: 'water', shake: 4, bloom: 0.5 },
      { at: 0, emit: 'splashCrown', on: 'target' },
      { at: 0, emit: 'splashDroplets', on: 'target', countScale: 0.6 },
      { at: 0, end: 760, track: 'target', motion: 'washAway' },
      { at: 120, end: 820, emit: 'dripDroplets', on: 'target' },
      { at: 780, cue: 'gone' },
    ],
  },
  'defeat-shatter': {
    budget: 'defeat', duration: 800,
    beats: [
      { at: 0, cue: 'defeatHit', flash: 'white', shake: 5 },
      { at: 0, end: 200, track: 'target', motion: 'crackShake' },
      { at: 200, cue: 'break', shake: 8, bloom: 0.7 },
      { at: 200, emit: 'cardShards', on: 'target' },
      { at: 200, emit: 'breakSparks', on: 'target' },
      { at: 200, end: 420, track: 'target', motion: 'shatterOut' },
      { at: 700, cue: 'gone' },
    ],
  },
  // --- Healing ---
  'heal-glow': {
    budget: 'heal', duration: 760,
    beats: [
      { at: 0, cue: 'heal', bloom: 0.4 },
      { at: 0, emit: 'healRise', on: 'target' },
      { at: 0, emit: 'healGlints', on: 'target' },
      { at: 0, end: 600, emit: 'healSparkle', on: 'target' },
      { at: 0, end: 650, track: 'target', motion: 'healGlow' },
    ],
  },
  // Regenerate at Breakfast: the same, softer.
  'regenerate-glow': {
    budget: 'heal', duration: 650,
    beats: [
      { at: 0, cue: 'heal', bloom: 0.2 },
      { at: 0, emit: 'regenRise', on: 'target' },
      { at: 0, end: 500, emit: 'regenSparkle', on: 'target' },
      { at: 0, end: 560, track: 'target', motion: 'healGlowSoft' },
    ],
  },
  // --- Trainers ---
  // Hit: the portrait flinches (knocked back, unless the attack already moves it) and flashes.
  'trainer-hit': {
    budget: 'trainer', duration: 420,
    beats: [
      { at: 0, cue: 'flinch', bloom: 0.3 },
      { at: 0, emit: 'trainerFlash', on: 'target' },
      { at: 0, end: 380, track: 'target', motion: 'knockBack', when: 'move' },
    ],
  },
  // Reduced to 0: cracks spread with light shining through, then it falls and darkens.
  'trainer-fall': {
    budget: 'trainer', duration: 1500,
    beats: [
      { at: 0, cue: 'crack', shake: 6, flash: 'white', bloom: 0.6 },
      { at: 0, emit: 'crackSpread', on: 'target' },
      { at: 150, end: 750, emit: 'crackLight', on: 'target' },
      { at: 0, end: 700, track: 'target', motion: 'crackShake' },
      { at: 750, cue: 'fall', shake: 10, bloom: 0.8 },
      { at: 750, emit: 'cardShards', on: 'target', countScale: 0.5 },
      { at: 750, emit: 'landDust', on: 'ground' },
      { at: 1300, cue: 'dimZone' },
    ],
  },
  // --- Supporters: the portrait moment (the art itself is a page element) ---
  'supporter-moment': {
    budget: 'supporter', duration: 1500,
    beats: [
      { at: 0, cue: 'portrait' },
      { at: 250, end: 1300, emit: 'portraitGlints', on: 'target' },
      { at: 500, cue: 'paid' },
      { at: 950, cue: 'gift', when: 'gift', bloom: 1 },
      { at: 950, emit: 'giftSparkles', on: 'target', when: 'gift' },
      { at: 950, emit: 'giftRing', on: 'target', when: 'gift' },
      { at: 1400, cue: 'portraitOut' },
    ],
  },
  // --- The end of the match (the 'target' is the crest) ---
  'ending-victory': {
    budget: 'ending', duration: 3200,
    beats: [
      { at: 0, cue: 'victory', bloom: 1.2 },
      { at: 600, emit: 'crestSparkle', on: 'target' },
      { at: 600, emit: 'crestRing', on: 'target' },
      { at: 300, end: 3000, emit: 'confettiGold', on: 'screen' },
      { at: 300, end: 3000, emit: 'confettiEmbers', on: 'screen', when: 'fire' },
      { at: 300, end: 3000, emit: 'confettiDroplets', on: 'screen', when: 'water' },
    ],
  },
  'ending-defeat': {
    budget: 'ending', duration: 3200,
    beats: [
      { at: 0, cue: 'defeat' },
      { at: 200, end: 3100, emit: 'ashFall', on: 'screen', when: 'fire' },
      { at: 200, end: 3100, emit: 'ashFlakes', on: 'screen', when: 'fire' },
      { at: 200, end: 3100, emit: 'rainFall', on: 'screen', when: 'water' },
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
  flameStream: { tex: 'streak', width: 56, life: 140, color: '#ff5a10', alpha: 0.3, blend: 'add', toTarget: true },
  tintTrail: { tex: 'streak', width: 80, life: 200, color: 'type', alpha: 0.5, blend: 'add' },
  orbTrail: { tex: 'streak', width: 54, life: 260, color: 'type', alpha: 0.6, blend: 'add' },
  waterTrail: { tex: 'streak', width: 96, life: 220, color: '#4aa8ff', alpha: 0.4, blend: 'add' },
  coalTrail: { tex: 'streak', width: 34, life: 240, color: '#ff7a1a', alpha: 0.6, blend: 'add' },
  blastTrail: { tex: 'streak', width: 110, life: 220, color: '#ff4a10', alpha: 0.45, blend: 'add' },
  speedStreak: { tex: 'streak', width: 70, life: 160, color: '#fff3c4', alpha: 0.6, blend: 'add' },
  // Hydro Pump: two strands twisting round each other, so the stream spirals.
  hydroStream: { tex: 'streak', width: 72, life: 140, color: '#3a9cff', alpha: 0.55, blend: 'add', toTarget: true, wobble: 20, phase: 0 },
  hydroStreamCore: { tex: 'streak', width: 34, life: 140, color: '#e6f6ff', alpha: 0.6, blend: 'add', toTarget: true, wobble: 20, phase: Math.PI },
};

// Beams: a texture stretched from the attacker's muzzle to the target, flickering
// (the lightning bolt). texAngle: the direction the texture's art runs (radians;
// lightning runs left to right, falling about 25°), so it can be turned to the attack.
export const BEAMS = {
  lightningBolt: { tex: 'lightning', texAngle: 0.44, color: '#ffe866', glow: '#ff9d00', thickness: 1.7, flicker: true, jitter: 8 },
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
  // Flame Charge (and any "this Round" Attack buff): a burning aura until the
  // Round ends at Supper. Its level comes from the card, not a status count.
  charged: {
    maxLevel: 1,
    levelOf: (card) => ((card?.roundBuffs ?? []).some((b) => b.attack > 0) ? 1 : 0),
    levels: [null, { flames: 1, motes: 1 }],
    ambient: { flames: 'auraFlames', motes: 'auraMotes' },
  },
};
// The visual level for a status count: 0 (none) up to the status's maximum.
export function statusLevel(id, count) {
  const v = STATUS_VISUALS[id];
  if (!v || !count || count < 1) return 0;
  return Math.min(v.maxLevel, Math.floor(count));
}
