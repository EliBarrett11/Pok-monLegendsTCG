// v4's effects library (UX4). Adapted from v2/src/ui/vfx/library.js: the shared library (./shared.js,
// a copy of the root src/ui/vfx/library.js) is used unchanged for its presets, attack timelines,
// counters, Strategy openings, summons, defeats, heals and endings. This file adds what v4 needs on
// top, as data only (no DOM: it is tested in Node):
//   - which animation each v4 card plays (v4's cards carry `type`, not `pokemonType`);
//   - Commands by mode (React quick, Adapt standard, Strat big), Supporters, Items, Trainer Commands;
//   - v4's own moments (Recognition, PokéDollars, Locations, the Tournament, Partners, Supper,
//     Breakfast, banners), built only from the shared presets;
//   - EVENT_BEATS: every engine event type and the beat that shows it (tests/ux4.test.js checks the
//     engine emits nothing without one);
//   - MS: every page-animation time the presenter uses, at Normal speed (checked against BUDGETS).
import {
  TIMELINES, BUDGETS as ROOT_BUDGETS, COUNTERS, SUMMONS, attackAnimation, composeAttack, composeCounter,
  STRATEGY_OPENING, tintOf, impactScale, timelineDuration, MAX_SCALE,
} from './shared.js?v=202611131710';
import { COMMANDS, SUPPORTERS } from '../../engine/cards.js?v=202611131710';

export { TIMELINES, composeAttack, composeCounter, tintOf, impactScale, timelineDuration, MAX_SCALE };

// --- Budgets (docs/vfx.md 1): the shared ones, plus v4's own moments, ms at Normal -----------------

export const BUDGETS = {
  ...ROOT_BUDGETS,
  react: { min: 300, max: 1100 },        // a React: quick, inside the React window
  adapt: { min: 1200, max: 2500 },       // an Adapt: the card rises (~0.3 s), flares and resolves: "about 2–2.5 s"
  strat: { min: 1500, max: 2800 },       // a Strat resolving: big (a longer rise, a bigger flare)
  seal: { min: 300, max: 900 },          // a Strat sealed on its owner's board edge
  recognition: { min: 300, max: 1300 },  // "+N" flying to the ring, the ring filling
  coins: { min: 300, max: 1000 },
  item: { min: 300, max: 1200 },
  location: { min: 400, max: 1300 },     // unfolding over its lanes, or folding away
  partner: { min: 1600, max: 2600 },     // "about 2 s"
  tracker: { min: 200, max: 1000 },      // a pip filling, a tracker turning green
  tournament: { min: 2000, max: 3200 },  // the stadium sweep, the banner, the ×1.5 stamps
  supper: { min: 300, max: 1400 },       // each Supper moment (a Location's dominance, the hand going)
  breakfast: { min: 600, max: 1800 },    // the summary strip and the new hand dealing in
  banner: { min: 200, max: 800 },        // "never blocking more than ~0.8 s"
  champion: { min: 1200, max: 2600 },    // the winner's ring filling and flaring "Champion"
  think: { min: 300, max: 700 },         // the AI's "thinking" pause (~0.5 s)
  // G1 (2.7): a Trainer Objective point moment: ~1.2 s, a little longer for each extra point in the
  // same action, and the final point's longer version (the track fills, the portrait flares gold).
  objective: { min: 900, max: 2800 },
  // G2: a trigger (the card flashes its name, then the effect in miniature) and a keyword callout.
  trigger: { min: 400, max: 1500 },
  keyword: { min: 200, max: 900 },
  aim: { min: 250, max: 600 },           // the AI's arrow before its beat (~0.4 s)
  note: { min: 300, max: 1200 },         // a word floating off something
};

// --- Attacks (B1): Type + attack type -------------------------------------------------------------

// The animation each v4 Pokémon line plays (its Type and attack type), by name, for the report and tests.
export const ATTACK_NAMES = {
  'fire-physical': 'Flame Wheel', 'fire-special': 'Flamethrower', 'water-physical': 'Waterfall',
  'water-special': 'Hydro Pump', 'electric-special': 'forked lightning',
  // G2: Shinx, Luxio and Luxray: a charging spark rush (the shared electric-physical: crackling charge,
  // a dash wrapped in sparks, a lightning impact).
  'electric-physical': 'spark rush',
};
// Electric Special in v4: forked lightning, the shared bolt with a second, later fork.
const FORKED = (() => {
  const def = TIMELINES['electric-special'];
  const beats = [...def.beats, { at: 350, end: 500, beam: 'lightningBolt', on: 'attacker' }, { at: 380, emit: 'boltSparks', on: 'impact', countScale: 0.6 }];
  return { ...def, id: 'v4-electric-forked', beats };
})();
export const V4_TIMELINES = { 'v4-electric-forked': FORKED };
export const attackFor = (card) => {
  const id = attackAnimation({ pokemonType: card?.type, attackType: card?.attackType });
  return id === 'electric-special' ? 'v4-electric-forked' : id;
};
export const counterFor = (card) => COUNTERS[attackAnimation({ pokemonType: card?.type, attackType: card?.attackType })] ?? 'generic-counter';
export const tintFor = (card) => tintOf(card?.type);
// An attack's definition, with the defender's counter cue when it hits back.
export function attackDef(card, { trade = false } = {}) {
  const id = attackFor(card);
  if (V4_TIMELINES[id]) {
    const def = V4_TIMELINES[id];
    const hit = def.beats.find((b) => b.cue === 'impact')?.at ?? 0;
    return trade ? { ...def, beats: [...def.beats, { at: hit, cue: 'trade', keyword: 'trade' }] } : def;
  }
  return composeAttack(id, { trade });
}
export const counterDef = (card) => composeCounter(counterFor(card));

// --- Commands (B3): the card rises, flares, and resolves at the target ------------------------------

// Each Command's effect. Ember and Rock Slide are v1's Strategy animations; Recover and X Attack are
// composed here from the shared presets (X Attack leaves an aura on the Pokémon until Supper).
const RECOVER = {
  id: 'v4-recover', budget: 'effect', duration: 950,
  beats: [
    { at: 0, end: 360, projectile: 'orb', on: 'path', glow: '#9ff07a', size: 0.6 },
    { at: 0, end: 360, emit: 'healSparkle', on: 'projectile' },
    { at: 360, cue: 'heal', bloom: 0.5 },
    { at: 360, emit: 'healRise', on: 'target' },
    { at: 360, emit: 'healGlints', on: 'target' },
    { at: 360, end: 900, emit: 'healSparkle', on: 'target' },
    { at: 360, end: 900, track: 'target', motion: 'healGlow' },
  ],
};
const X_ATTACK = {
  id: 'v4-x-attack', budget: 'effect', duration: 1000,
  beats: [
    { at: 0, end: 320, projectile: 'orb', on: 'path', glow: '#ff9a3a', size: 0.6 },
    { at: 0, end: 320, emit: 'chargeSparks', on: 'projectile' },
    { at: 320, end: 900, emit: 'spiralFlames', on: 'target', countScale: 0.6 },
    { at: 320, end: 900, track: 'target', motion: 'charging' },
    { at: 820, cue: 'aura', emit: 'chargeBurst', on: 'target', flash: 'type', bloom: 0.8 },
    { at: 820, emit: 'auraMotes', on: 'target' },
  ],
};
// Effect damage that isn't an attack (Rock Slide's single target, a Trainer Command, an On Summon
// when the source isn't a Pokémon on the board): a short hit on each Pokémon.
const EFFECT_HIT = {
  id: 'v4-effect-hit', budget: 'effect', duration: 520,
  beats: [
    { at: 0, cue: 'impact', shake: 5, flash: 'type', bloom: 0.5 },
    { at: 0, emit: 'impactStar', on: 'target' },
    { at: 0, emit: 'genericSparks', on: 'target' },
    { at: 0, end: 480, track: 'target', motion: 'recoil' },
  ],
};
// G3: Surf, Bubble Beam and Dive, composed from the shared water presets.
// Surf: a wave sweeps across the target's lanes (the region the presenter passes), crashing over each enemy there.
const SURF = {
  id: 'v4-surf', budget: 'effect', duration: 1150,
  beats: [
    { at: 0, end: 1000, sweep: 'surfWave', on: 'board' },
    { at: 1000, cue: 'waveDone', shake: 6, bloom: 0.5 },
  ],
};
// Bubble Beam: a bubble stream from the card, pops on the target, then the target dims to Spent.
const BUBBLE_BEAM = {
  id: 'v4-bubble-beam', budget: 'effect', duration: 1050,
  beats: [
    { at: 0, end: 560, emit: 'bubbleStream', on: 'card' },
    { at: 0, end: 560, emit: 'bubbleSmall', on: 'card' },
    { at: 320, cue: 'impact', hitstop: 50, shake: 6, flash: 'water', bloom: 0.6 },
    { at: 320, end: 700, emit: 'bubblePops', on: 'target' },
    { at: 320, emit: 'sprayDroplets', on: 'target', countScale: 0.5 },
    { at: 320, end: 760, track: 'target', motion: 'drenched' },
    { at: 640, cue: 'spent' },
    { at: 640, end: 1040, track: 'target', motion: 'dimSpent' },
  ],
};
// Dive: the Pokémon sinks into a ripple (the presenter then flies its card back to the hand).
const DIVE = {
  id: 'v4-dive', budget: 'effect', duration: 900,
  beats: [
    { at: 0, end: 820, emit: 'ringRipples', on: 'target' },
    { at: 0, end: 700, emit: 'ringDroplets', on: 'target' },
    { at: 120, emit: 'splashCrown', on: 'target', countScale: 0.5 },
    { at: 120, end: 860, track: 'target', motion: 'sinkAway' },
    { at: 860, cue: 'dived' },
  ],
};
Object.assign(V4_TIMELINES, { 'v4-recover': RECOVER, 'v4-x-attack': X_ATTACK, 'v4-effect-hit': EFFECT_HIT, 'v4-surf': SURF, 'v4-bubble-beam': BUBBLE_BEAM, 'v4-dive': DIVE });

// G3 (gameplay update 5.1): the nine Commands. Thunderbolt, Heat Wave, Flame Charge, Rock Slide and
// Ember are v1's Strategy animations; Surf, Bubble Beam and Dive are composed above; Recover as before.
export const COMMAND_ANIMS = {
  ember: 'strategy-ember', thunderbolt: 'strategy-thunderbolt', 'rock-slide': 'strategy-rock-slide', 'heat-wave': 'strategy-heat-wave',
  surf: 'v4-surf', 'bubble-beam': 'v4-bubble-beam', recover: 'v4-recover', 'flame-charge': 'strategy-flame-charge', dive: 'v4-dive',
};
// B3-1: each Move's Type, from the card data (Normal Moves use Normal).
export const COMMAND_TYPES = Object.fromEntries(COMMANDS.map((c) => [c.id, c.type ?? 'Normal']));
export const commandTint = (id) => tintOf(COMMAND_TYPES[id] ?? 'Normal');
// The sweeps (Rock Slide, Heat Wave, Surf), and any single-target version of them, roll across the hit Pokémon.
export const SWEEP_COMMANDS = ['rock-slide', 'heat-wave', 'surf'];
const timeline = (id) => V4_TIMELINES[id] ?? TIMELINES[id];

// How big each mode plays: React is quick (no rise, played faster, no opening); Adapt is standard (the
// card rises, the shared opening, the effect); Strat is big (a longer rise, the fuller version, a
// bigger flare and shake).
export const MODE_STYLE = {
  react: { rise: 0, opening: false, rate: 1.5, scale: 0.85, budget: 'react' },
  adapt: { rise: 320, opening: true, rate: 1, scale: 1, budget: 'adapt' },
  strat: { rise: 420, opening: true, rate: 1, scale: 1.35, budget: 'strat', fuller: true },
};
// A Command's timeline in a mode (the opening in front of the effect, as composeStrategy does).
export function commandDef(id, mode) {
  const style = MODE_STYLE[mode];
  const def = timeline(COMMAND_ANIMS[id] ?? 'strategy-generic');
  if (!style.opening) return { ...def, id: `${def.id ?? COMMAND_ANIMS[id]}@${mode}`, budget: style.budget };
  const off = STRATEGY_OPENING.length;
  const opening = style.fuller
    ? [...STRATEGY_OPENING.beats.map((b) => (b.cue === 'flare' ? { ...b, bloom: 1.3, shake: 6 } : b)), { at: 0, emit: 'epicFlare', on: 'card' }]
    : STRATEGY_OPENING.beats;
  const beats = [...opening, ...def.beats.map((b) => ({ ...b, at: b.at + off, ...(b.end !== undefined ? { end: b.end + off } : {}) }))];
  return { ...def, id: `${COMMAND_ANIMS[id]}@${mode}`, budget: style.budget, beats, duration: def.duration + off, effectStart: off };
}
// The whole beat's length at Normal, the rise included (for the budgets).
// G3: v1's Thunderbolt and Heat Wave are a little long for Adapt's budget: they play a touch faster.
const COMMAND_TEMPO = { thunderbolt: 1.05, 'heat-wave': 1.05 };
export const commandRate = (id, mode) => MODE_STYLE[mode].rate * (COMMAND_TEMPO[id] ?? 1);
export const commandMs = (id, mode) => MODE_STYLE[mode].rise + timelineDuration(commandDef(id, mode)) / commandRate(id, mode) + MS.commandOut;

// --- Supporters, Items, Trainer Commands (B7, B8) ----------------------------------------------------

// B3-1: each Supporter's effect from its first op (data-driven: no per-card list).
const SUPPORTER_BY_OP = { heal: 'heal-glow', search: 'v4-search', draw: 'v4-search', recover: 'v4-breeder', handLevels: 'v4-search', strength: 'v4-strength', attack: 'v4-strength',
  tempAttack: 'v4-flannery', activate: 'v4-flannery', returnHand: 'v4-search', damage: 'v4-effect-hit',
  // B3-2: hand control and the Discard Pile (Burglar, Team Rocket Grunt; Bill; Mr. Fuji), Officer Jenny's Spent.
  steal: 'v4-search', discardRandom: 'v4-effect-hit', pickDraw: 'v4-search', reviveSummon: 'v4-breeder', spend: 'v4-effect-hit' };
export const SUPPORTER_ANIMS = Object.fromEntries(SUPPORTERS.map((c) => [c.id, SUPPORTER_BY_OP[c.ops[0]?.op] ?? 'v4-search']));
// By Item id first (G3: a small effect of its own for each new Item), then by op.
export const ITEM_ANIMS = {
  heal: 'heal-glow', attackUp: 'v4-x-attack', tempAttack: 'v4-x-attack', attack: 'v4-held', strength: 'v4-held', speed: 'v4-held', keyword: 'v4-held', recognition: 'v4-amulet',
  'x-attack': 'v4-x-attack', 'choice-band': 'v4-choice-band', 'quick-claw': 'v4-quick-claw', 'rocky-helmet': 'v4-rocky-helmet', leftovers: 'v4-leftovers', 'amulet-coin': 'v4-amulet',
  // B3-2: Revive (from the Discard Pile), X Speed (Active), Ether (Energy), X Defend (Strength until Supper).
  revive: 'v4-breeder', activate: 'v4-flannery', energy: 'v4-amulet', tempStrength: 'v4-held',
};
export const itemAnim = (id, op) => ITEM_ANIMS[id] ?? ITEM_ANIMS[op] ?? 'v4-held';
export const TRAINER_COMMAND_ANIMS = { draw: 'v4-search', damageAll: 'v4-effect-hit', damage: 'v4-effect-hit', heal: 'heal-glow', strength: 'v4-strength', dollars: 'v4-amulet',
  // B3-2: Sabrina (a card you choose), Bruno (Attack), Morty (from the Discard Pile), Karen (a random discard).
  discardChosen: 'v4-effect-hit', attack: 'v4-strength', returnDiscard: 'v4-breeder', discardRandom: 'v4-effect-hit' };
Object.assign(V4_TIMELINES, {
  // Searching or drawing: motes rising from the Draw Pile.
  'v4-search': { id: 'v4-search', budget: 'effect', duration: 700, beats: [{ at: 0, cue: 'search', bloom: 0.4 }, { at: 0, end: 600, emit: 'evolveMotes', on: 'target' }, { at: 0, emit: 'flareRing', on: 'target' }] },
  // Brock's Strength: a sturdy gold flare on each Pokémon.
  'v4-strength': { id: 'v4-strength', budget: 'heal', duration: 700, beats: [{ at: 0, cue: 'heal', bloom: 0.5 }, { at: 0, emit: 'landRing', on: 'target' }, { at: 0, emit: 'healGlints', on: 'target' }, { at: 0, end: 600, track: 'target', motion: 'healGlow' }] },
  // A Held Item settling onto its Pokémon.
  'v4-held': { id: 'v4-held', budget: 'item', duration: 600, beats: [{ at: 0, cue: 'held', bloom: 0.4 }, { at: 0, emit: 'flareRing', on: 'target' }, { at: 0, emit: 'healGlints', on: 'target' }] },
  // G3: the new Items, each a small effect on its holder (Amulet Coin: on the Recognition ring).
  'v4-choice-band': { id: 'v4-choice-band', budget: 'item', duration: 650, beats: [{ at: 0, cue: 'held', bloom: 0.5, flash: 'type' }, { at: 0, emit: 'chargeBurst', on: 'target', countScale: 0.6 }, { at: 0, end: 560, track: 'target', motion: 'charging' }] },
  'v4-quick-claw': { id: 'v4-quick-claw', budget: 'item', duration: 600, beats: [{ at: 0, cue: 'held', bloom: 0.4 }, { at: 0, emit: 'speedLines', on: 'target', countScale: 0.5 }, { at: 0, emit: 'chargeSparks', on: 'target', countScale: 0.6 }, { at: 0, end: 500, track: 'target', motion: 'jolt' }] },
  'v4-rocky-helmet': { id: 'v4-rocky-helmet', budget: 'item', duration: 600, beats: [{ at: 0, cue: 'held', bloom: 0.4 }, { at: 0, emit: 'rockShards', on: 'target', countScale: 0.5 }, { at: 0, emit: 'flareRing', on: 'target' }, { at: 0, end: 500, track: 'target', motion: 'bound' }] },
  'v4-leftovers': { id: 'v4-leftovers', budget: 'item', duration: 650, beats: [{ at: 0, cue: 'held', bloom: 0.4 }, { at: 0, emit: 'regenSparkle', on: 'target' }, { at: 0, end: 600, track: 'target', motion: 'healGlowSoft' }] },
  'v4-amulet': { id: 'v4-amulet', budget: 'item', duration: 650, beats: [{ at: 0, cue: 'fill', bloom: 0.6, flash: 'gold' }, { at: 0, emit: 'crestSparkle', on: 'target' }, { at: 0, emit: 'healGlints', on: 'target', tint: ['#ffd36b', '#fff6c8'] }] },
  // G3: Flannery: a small flame aura on each of your Pokémon; Pokémon Breeder: motes rising from the Discard Pile.
  'v4-flannery': { id: 'v4-flannery', budget: 'heal', duration: 750, beats: [{ at: 0, end: 520, emit: 'spiralEmbers', on: 'target', countScale: 0.5 }, { at: 0, end: 600, track: 'target', motion: 'charging' }, { at: 520, cue: 'aura', emit: 'auraMotes', on: 'target', bloom: 0.5 }] },
  'v4-breeder': { id: 'v4-breeder', budget: 'effect', duration: 700, beats: [{ at: 0, cue: 'search', bloom: 0.4 }, { at: 0, end: 600, emit: 'healSparkle', on: 'target' }, { at: 0, emit: 'flareRing', on: 'target' }] },
  // Recognition reaching the ring; the ring flaring at 50, 70 and 90; Champion.
  'v4-recognition': { id: 'v4-recognition', budget: 'recognition', duration: 520, beats: [{ at: 0, cue: 'fill', bloom: 0.4 }, { at: 0, emit: 'healGlints', on: 'target', tint: ['#ffd36b', '#fff6c8'] }] },
  'v4-ring-flare': { id: 'v4-ring-flare', budget: 'recognition', duration: 800, beats: [{ at: 0, cue: 'flare', bloom: 1, flash: 'gold' }, { at: 0, emit: 'crestRing', on: 'target' }, { at: 0, emit: 'crestSparkle', on: 'target' }] },
  // A Location unfolding (dust and a gold ring); a Partner's gold shockwave; the Tournament's sweep.
  'v4-location': { id: 'v4-location', budget: 'location', duration: 700, beats: [{ at: 0, cue: 'place', bloom: 0.5 }, { at: 0, emit: 'landDust', on: 'target' }, { at: 0, emit: 'flareRing', on: 'target' }] },
  'v4-partner': {
    id: 'v4-partner', budget: 'summon', duration: 1100,
    beats: [
      { at: 0, end: 260, track: 'target', motion: 'slamDown' },
      { at: 260, cue: 'land', shake: 9, bloom: 1.1, distort: 'shockwave', flash: 'gold' },
      { at: 260, emit: 'bigLandRing', on: 'ground' },
      { at: 260, emit: 'crestRing', on: 'target' },
      { at: 260, emit: 'confettiGold', on: 'target', countScale: 0.3 },
      { at: 260, emit: 'landDust', on: 'ground' },
      { at: 260, end: 560, track: 'target', motion: 'settleLand' },
    ],
  },
  'v4-tracker': { id: 'v4-tracker', budget: 'tracker', duration: 700, beats: [{ at: 0, cue: 'flare', bloom: 0.8 }, { at: 0, emit: 'crestRing', on: 'target' }, { at: 0, emit: 'healGlints', on: 'target', tint: ['#7fe08a', '#e6ffd8'] }] },
  'v4-tournament': { id: 'v4-tournament', budget: 'tournament', duration: 2100, beats: [{ at: 0, cue: 'stadium', bloom: 1 }, { at: 0, end: 1100, emit: 'confettiGold', on: 'screen' }, { at: 1100, cue: 'stamp', flash: 'gold', bloom: 1.2 }, { at: 1100, emit: 'crestSparkle', on: 'target' }] },
  'v4-dominance': { id: 'v4-dominance', budget: 'supper', duration: 650, beats: [{ at: 0, cue: 'glow', bloom: 0.6 }, { at: 0, emit: 'healGlints', on: 'target', tint: ['#ffd36b', '#fff6c8'] }, { at: 0, emit: 'flareRing', on: 'target' }] },
  'v4-champion': { id: 'v4-champion', budget: 'ending', duration: 3000, beats: [{ at: 0, cue: 'victory', bloom: 1.2 }, { at: 0, emit: 'crestRing', on: 'target' }, { at: 0, emit: 'crestSparkle', on: 'target' }, { at: 300, end: 2800, emit: 'confettiGold', on: 'screen' }] },
});
export const SUMMON_ANIMS = { low: SUMMONS.Common, mid: SUMMONS.Rare, high: SUMMONS.Epic };
// A summon by Level: 1–3 plain, 4–6 a bigger flare, 7+ the Epic landing.
export const summonFor = (card) => (card?.level >= 7 ? SUMMON_ANIMS.high : card?.level >= 4 ? SUMMON_ANIMS.mid : SUMMON_ANIMS.low);
// How a defeated Pokémon goes, by what defeated it (a Type): burnt to ash, washed away or shattered.
export const defeatFor = (type) => (type === 'Fire' ? 'defeat-ash' : type === 'Water' ? 'defeat-wash' : 'defeat-shatter');
export const RING_FLARES = [50, 70, 90];

// Every timeline id → its definition (shared or v4's).
export const defOf = (id) => (typeof id === 'string' ? timeline(id) : id);

// --- Page animation times at Normal (ms): the presenter uses only these -------------------------------

export const MS = {
  think: 500,          // C: the AI's thinking pause
  aim: 400,            // C: the AI's arrow before its beat
  banner: 700,         // B11: in, hold, out: never more than ~0.8 s
  number: 1100,        // a damage or heal number rising
  tick: 450,           // a Strength number ticking to its new value
  fly: 650,            // "+N" flying to the ring
  ring: 500,           // the ring filling
  coins: 600,
  itemFly: 600,
  seal: 520,           // a Strat flying to its owner's board edge, sealed
  rise: 320,           // a card rising to centre stage
  commandOut: 120,     // the card fading after its effect
  burn: 650,           // Released cards burning away
  favour: 900,
  defeat: 260,         // the card fading after its dissolve
  locationIn: 650,
  locationOut: 500,
  lock: 600,           // Retaining: a small lock
  pip: 450,
  tracker: 700,
  partnerBurst: 350,   // the tracker bursting
  partnerSweep: 650,   // the Trainer's art sweeping across
  stadium: 1100,       // the Tournament's sweep across all 9 lanes
  stamp: 450,          // "×1.5" stamped on each ring
  dominance: 650,
  handOut: 500,        // Supper: the hand sliding to the Discard Pile
  strip: 1100,         // Breakfast: the summary strip
  deal: 600,           // the new hand dealing in
  champion: 1800,
  note: 900,
  // G1: the Objective point moment (about 1.2 s in all) and the PokéMart's new Item sliding in.
  objIn: 150,          // the backdrop fades in
  objSlide: 250,       // the portrait slides in from that player's side
  objStamp: 300,       // each new pip stamps in (+1, the count ticks)
  objHold: 200,
  objOut: 300,         // the portrait slides back into the tracker, which pulses
  objFinal: 900,       // the final point: the track fills and the portrait flares gold
  martIn: 500,
  // G2: a trigger's flash, its effect in miniature, a keyword's callout.
  triggerFlash: 380,
  triggerEffect: 650,
  keyword: 700,
  // G3: Dive's card flying back to the hand; a card taken back from the Discard Pile.
  diveFly: 550,
};

// Each composed moment's total at Normal (for the budget check in tests/ux4.test.js).
export const MOMENTS = {
  partner: { budget: 'partner', ms: MS.partnerBurst + MS.partnerSweep + timelineDuration(V4_TIMELINES['v4-partner'], 1) },
  tournament: { budget: 'tournament', ms: Math.max(MS.stadium + MS.stamp, timelineDuration(V4_TIMELINES['v4-tournament'], 1)) + MS.banner },
  recognition: { budget: 'recognition', ms: MS.fly + MS.ring },
  coins: { budget: 'coins', ms: MS.coins },
  seal: { budget: 'seal', ms: MS.seal },
  banner: { budget: 'banner', ms: MS.banner },
  breakfast: { budget: 'breakfast', ms: MS.strip + MS.deal },
  supperHand: { budget: 'supper', ms: MS.handOut },
  dominance: { budget: 'supper', ms: MS.dominance },
  locationIn: { budget: 'location', ms: MS.locationIn },
  locationOut: { budget: 'location', ms: MS.locationOut },
  tracker: { budget: 'tracker', ms: MS.tracker },
  pip: { budget: 'tracker', ms: MS.pip },
  item: { budget: 'item', ms: MS.itemFly },
  champion: { budget: 'champion', ms: MS.champion },
  think: { budget: 'think', ms: MS.think },
  aim: { budget: 'aim', ms: MS.aim },
  note: { budget: 'note', ms: MS.note },
  objective: { budget: 'objective', ms: MS.objIn + MS.objSlide + MS.objStamp + MS.objHold + MS.objOut },
  objectiveFinal: { budget: 'objective', ms: MS.objIn + MS.objSlide + MS.objStamp + MS.objHold + MS.objFinal + MS.objOut },
  mart: { budget: 'item', ms: MS.martIn },
  trigger: { budget: 'trigger', ms: MS.triggerFlash + MS.triggerEffect },
  keyword: { budget: 'keyword', ms: MS.keyword * 0.6 },
};

// --- Every engine event type and the beat that shows it ----------------------------------------------
//   when  'before' (on the board as it was) · 'after' (on the new board) · 'banner' · 'quiet' (the
//         interface already shows it, e.g. the React window opening)
//   beat  the presenter's handler · sfx: the sound hook it calls (src/ui/sound.js)
export const EVENT_BEATS = {
  attack: { when: 'before', beat: 'attack', budget: 'attack', sfx: 'attack-<type>' },
  commandResolved: { when: 'before', beat: 'command', budget: 'adapt', sfx: 'command-adapt' },
  react: { when: 'before', beat: 'react', budget: 'react', sfx: 'react' },
  strat: { when: 'before', beat: 'seal', budget: 'seal', sfx: 'command-strat' },
  decline: { when: 'before', beat: 'note', budget: 'note', sfx: null },
  reactWindow: { when: 'quiet', beat: null, budget: null, sfx: null },
  fizzled: { when: 'before', beat: 'note', budget: 'note', sfx: null },
  summoned: { when: 'after', beat: 'summon', budget: 'summon', sfx: 'summon' },
  partnerArrived: { when: 'after', beat: 'partner', budget: 'partner', sfx: 'partner' },
  partnerWaiting: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  objectiveProgress: { when: 'after', beat: 'objective', budget: 'objective', sfx: 'objective' },
  objectiveComplete: { when: 'after', beat: 'trackerComplete', budget: 'tracker', sfx: null },
  trainerTaken: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  trainerCommand: { when: 'before', beat: 'trainerCommand', budget: 'adapt', sfx: 'command-adapt' },
  supporter: { when: 'before', beat: 'supporter', budget: 'supporter', sfx: 'command-adapt' },
  itemBought: { when: 'before', beat: 'itemBought', budget: 'item', sfx: 'coins' },
  itemUsed: { when: 'before', beat: 'itemUsed', budget: 'item', sfx: 'heal' },
  martRefreshed: { when: 'after', beat: 'mart', budget: 'item', sfx: null },
  dollars: { when: 'after', beat: 'coins', budget: 'coins', sfx: 'coins' },
  recognition: { when: 'after', beat: 'recognition', budget: 'recognition', sfx: 'recognition' },
  defeated: { when: 'before', beat: 'defeat', budget: 'defeat', sfx: 'defeat' },
  gameOver: { when: 'banner', beat: 'champion', budget: 'champion', sfx: 'victory' },
  battle: { when: 'banner', beat: 'round', budget: 'banner', sfx: 'turn' },
  supper: { when: 'banner', beat: 'supper', budget: 'banner', sfx: null },
  dominance: { when: 'before', beat: 'dominance', budget: 'supper', sfx: null },
  tournamentDominance: { when: 'before', beat: 'dominance', budget: 'supper', sfx: null },
  locationPlaced: { when: 'after', beat: 'locationPlaced', budget: 'location', sfx: 'location-place' },
  locationRemoved: { when: 'before', beat: 'locationRemoved', budget: 'location', sfx: null },
  breakfast: { when: 'banner', beat: 'breakfast', budget: 'breakfast', sfx: 'turn' },
  tournament: { when: 'after', beat: 'tournament', budget: 'tournament', sfx: 'tournament' },
  retained: { when: 'before', beat: 'retain', budget: 'note', sfx: null },
  pass: { when: 'before', beat: 'note', budget: 'note', sfx: null },
  reshuffled: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  // G2: triggers and keywords.
  trigger: { when: 'after', beat: 'trigger', budget: 'trigger', sfx: 'trigger' },
  keyword: { when: 'after', beat: 'keyword', budget: 'keyword', sfx: 'keyword' },
  triggerChoice: { when: 'quiet', beat: null, budget: null, sfx: null },
  // G3: Dive: a Pokémon back to its owner's hand (shown within the Command's own beat, so quiet here).
  returned: { when: 'quiet', beat: null, budget: null, sfx: null },
  // B3-1: an effect's second choice resolving; Pokémon cards in hand gaining Levels; a trigger's damage to the
  // enemy Player Character (Budew, Zapdos).
  effectChoice: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  handLevels: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  pcDamage: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  // B3-2: a pick from a pile or a hand being asked for; cards discarded or stolen from a hand; cards back to hand
  // from the Discard Pile; cards picked from the Draw Pile (Bill).
  cardChoice: { when: 'quiet', beat: null, budget: null, sfx: null },
  cardsDiscarded: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  cardsStolen: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  cardsReturned: { when: 'after', beat: 'note', budget: 'note', sfx: null },
  cardsPicked: { when: 'after', beat: 'note', budget: 'note', sfx: null },
};

// The sound hooks (src/ui/sound.js names them; every beat calls one).
export const SFX = ['attack-fire-physical', 'attack-fire-special', 'attack-water-physical', 'attack-water-special', 'attack-electric-special',
  'hit', 'defeat', 'heal', 'summon', 'partner', 'recognition', 'coins', 'command-adapt', 'command-strat', 'react', 'location-place',
  'tournament', 'turn', 'victory', 'objective', 'trigger', 'keyword', 'attack-electric-physical'];
export const attackSfx = (card) => `attack-${String(card?.type).toLowerCase()}-${String(card?.attackType).toLowerCase()}`;

// Speed (D): timeline ms per real ms is 1 / factor. Instant draws at once.
export const SPEEDS = { slow: 1.5, normal: 1, fast: 0.5, instant: 0 };
