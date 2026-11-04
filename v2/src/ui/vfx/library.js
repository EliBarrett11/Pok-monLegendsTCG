// v2's effects library (V8). The current game's library (src/ui/vfx/library.js) is
// imported unchanged: its attack, Strategy, status, summon, defeat, heal, evolution and
// ending timelines and its particle presets. This file adds what v2 needs on top, as data:
//   - which animation each v2 card plays (v2 card ids and fields differ from the current game's);
//   - Strategy breakpoints: a bigger breakpoint plays a bigger version of the card's animation;
//   - v2's own moments (Recognition, Locations, the Championship, Training, Trainers,
//     Supporters, Items, lane guards), built only from the shared presets and motions;
//   - EVENT_BEATS: every engine event type and the beat that shows it (tests/vfx.test.js
//     checks the engine emits nothing without one).
// No DOM here: it's pure data, tested in Node.
import {
  TIMELINES, BUDGETS as ROOT_BUDGETS, COUNTERS, STRATEGIES, STRATEGY_TYPES, STRATEGY_FALLBACK, SUMMONS, DEFEATS,
  attackAnimation, composeStrategy, composeSummon, composeAttack, composeCounter, tintOf, impactScale, timelineDuration,
  STATUS_VISUALS, statusLevel, evolveAnimation, GROWTH_MOTES, weatherPulseText, endingAnimation, MAX_SCALE,
} from '../../../../src/ui/vfx/library.js';

export {
  TIMELINES, COUNTERS, tintOf, impactScale, timelineDuration, STATUS_VISUALS, statusLevel, GROWTH_MOTES, weatherPulseText,
  composeAttack, composeCounter, MAX_SCALE,
};

// --- Budgets (docs/vfx.md 1): the current game's, plus v2's own moments ------------------------

export const BUDGETS = {
  ...ROOT_BUDGETS,
  recognition: { min: 300, max: 1200 },
  location: { min: 500, max: 1800 },
  championship: { min: 2000, max: 3200 },
  partner: { min: 1000, max: 2400 },
  item: { min: 300, max: 1200 },
  guard: { min: 200, max: 800 },
  banner: { min: 300, max: 1600 },
};

// --- Attacks: Type + Attack-Type (v2 cards have .type) -----------------------------------------

export const attackFor = (card) => attackAnimation({ pokemonType: card?.type, attackType: card?.attackType });
export const counterFor = (card) => COUNTERS[attackFor(card)] ?? 'generic-counter';
export const tintFor = (card) => tintOf(card?.type);

// --- Strategy Cards --------------------------------------------------------------------------

// v2 ids carry a deck prefix (f-ember); the shared library knows the plain id (ember).
const plain = (id) => String(id ?? '').replace(/^[fwgp]-/, '');
// v2's Strategy Cards the current game doesn't have: the closest shared animation.
export const V2_STRATEGIES = { 'hydro-pump': 'strategy-bubble-beam' };
const DECK_TYPE = { f: 'Fire', w: 'Water', g: 'Grass', p: 'Normal' };
export const strategyFor = (card) => STRATEGIES[plain(card?.id)] ?? V2_STRATEGIES[plain(card?.id)] ?? STRATEGY_FALLBACK;
export const strategyTypeOf = (card) => STRATEGY_TYPES[plain(card?.id)] ?? (plain(card?.id) === 'hydro-pump' ? 'Water' : DECK_TYPE[String(card?.id)[0]] ?? 'Normal');
export const strategyTintFor = (card) => tintOf(strategyTypeOf(card));
// Area cards: a wall rolls across the board.
export const SWEEP_STRATEGIES = ['strategy-heat-wave', 'strategy-surf', 'strategy-hyper-voice', 'strategy-rock-slide'];

// A bigger breakpoint (level 0 is the cheapest) plays a bigger version: more particles,
// a stronger shake and bloom, and from the second breakpoint on extra flares as the card
// dissolves into its effect. The timing stays the same (the same budget).
export const breakpointScale = (level) => 1 + 0.35 * Math.max(0, level ?? 0);
export function strategyDef(card, level = 0) {
  const base = composeStrategy(strategyFor(card));
  const k = breakpointScale(level);
  const beats = base.beats.map((b) => ({
    ...b,
    ...(b.emit ? { countScale: (b.countScale ?? 1) * k } : {}),
    ...(b.shake ? { shake: b.shake * k } : {}),
    ...(b.bloom ? { bloom: Math.min(1.6, b.bloom * (1 + 0.2 * level)) } : {}),
  }));
  if (level >= 1) {
    beats.push({ at: base.effectStart, emit: 'flareRing', on: 'card', breakpoint: true });
    beats.push({ at: base.effectStart, emit: 'epicSparks', on: 'card', countScale: k, breakpoint: true });
  }
  if (level >= 2) beats.push({ at: base.effectStart, cue: 'breakpoint', bloom: 1.2, distort: 'shockwave', emit: 'giftRing', on: 'card', breakpoint: true });
  return { ...base, id: `${base.id}@${level}`, beats, level, scale: k };
}

// --- Summons ---------------------------------------------------------------------------------

// Legendaries get their cinematic: Kyogre a wave and rain, Celebi its time-ripples, and
// Entei (v2's Fire Legendary) the eruption the current game made for its Fire Legendary.
export const LEGENDARIES = { 'w-kyogre': 'summon-kyogre', 'g-celebi': 'summon-celebi', 'f-entei': 'summon-blaziken' };
export function summonFor(card) {
  if (card?.rarity === 'Legendary') return LEGENDARIES[card.series] ?? SUMMONS.Legendary;
  return SUMMONS[card?.rarity] ?? SUMMONS.Common;
}
export const summonDef = (card) => composeSummon(summonFor(card), { quick: (card?.keywords ?? []).includes('Quick Attack') });

// --- Defeats, statuses, healing, evolution -----------------------------------------------------

// How a defeated Pokémon goes, by what defeated it: burnt to ash (Fire, Burn), washed away
// (Water), wilting in leaves (Grass, Leech Seed), shattered (anything else).
export function defeatFor(cause) {
  if (cause === 'burn') return DEFEATS.ash;
  if (cause === 'leechSeed') return DEFEATS.wilt;
  return { Fire: DEFEATS.ash, Water: DEFEATS.wash, Grass: DEFEATS.wilt }[cause] ?? DEFEATS.shatter;
}
export const STATUS_APPLIED = { burned: 'burn-catch', asleep: 'sleep-fall', seeded: 'leech-catch' };
export const STATUS_CLEARED = 'douse-steam';
export const BURN_TICK = 'burn-flare';
export const HEAL = 'heal-glow';
export const REGENERATE = 'regenerate-glow';
export const evolveFor = (card) => evolveAnimation({ stage: card?.stageKind });
export { endingAnimation };

// --- v2's own moments ------------------------------------------------------------------------
//
// Cues the presenter answers (page-side, DOM): unfold (a Location's frame opens over its
// lanes), tick (a milestone's gold tick), banner (a completion or Championship banner),
// sweep (the other Locations swept away), stadium (the Championship frame covers the
// board), pip (a Trainer tier lights), slide (a Trainer tab slides in), partner (the
// Partner! flourish), shield (a lane guard's shield), arrive (a number lands on a panel).
export const V2_TIMELINES = {
  'v2-recognition': {
    budget: 'recognition', duration: 720, beats: [
      { at: 0, cue: 'arrive', bloom: 0.5 },
      { at: 0, emit: 'giftSparkles', on: 'target', countScale: 0.6 },
      { at: 0, emit: 'giftRing', on: 'target' },
    ],
  },
  'v2-recognition-loss': {
    budget: 'recognition', duration: 760, beats: [
      { at: 0, cue: 'drain', bloom: 0.4 },
      { at: 0, emit: 'burnFlare', on: 'target' },
      { at: 0, end: 600, emit: 'ashSmoke', on: 'target' },
      { at: 80, emit: 'risingEmbers', on: 'target' },
    ],
  },
  'v2-location-place': {
    budget: 'location', duration: 1100, beats: [
      { at: 0, cue: 'unfold' },
      { at: 0, end: 700, emit: 'giftSparkles', on: 'target', countScale: 0.5 },
      { at: 700, cue: 'placed', bloom: 0.6 },
      { at: 700, emit: 'landDust', on: 'ground' },
      { at: 700, emit: 'flareRing', on: 'target' },
    ],
  },
  'v2-milestone': {
    budget: 'location', duration: 900, beats: [
      { at: 0, cue: 'tick', bloom: 0.7 },
      { at: 0, emit: 'crestSparkle', on: 'target' },
      { at: 0, emit: 'giftRing', on: 'target' },
      { at: 350, cue: 'reward' },
    ],
  },
  'v2-completion': {
    budget: 'location', duration: 1600, beats: [
      { at: 0, cue: 'banner', bloom: 1, shake: 4 },
      { at: 0, emit: 'crestRing', on: 'target' },
      { at: 0, emit: 'giftSparkles', on: 'target' },
      { at: 100, end: 1300, emit: 'confettiGold', on: 'target' },
      { at: 700, cue: 'reward' },
    ],
  },
  'v2-location-end': {
    budget: 'location', duration: 700, beats: [
      { at: 0, cue: 'fade' },
      { at: 0, end: 600, emit: 'dissolveMotes', on: 'target' },
    ],
  },
  // The Championship: the other Locations sweep away, then the stadium frame covers all 9
  // lanes with light, a shockwave and gold. Long enough to read at Normal speed.
  'v2-championship': {
    budget: 'championship', duration: 2900, beats: [
      { at: 0, cue: 'sweep' },
      { at: 700, cue: 'stadium', bloom: 1.3, shake: 10, distort: 'shockwave', flash: 'sun' },
      { at: 700, emit: 'lightShaft', on: 'target' },
      { at: 700, emit: 'crestRing', on: 'target' },
      { at: 700, emit: 'epicSparks', on: 'target', countScale: 2 },
      { at: 800, end: 2600, emit: 'confettiGold', on: 'screen' },
      { at: 1000, cue: 'title' },
    ],
  },
  'v2-level-up': {
    budget: 'growth', duration: 650, beats: [
      { at: 0, cue: 'level', bloom: 0.5 },
      { at: 0, emit: 'evolveSparkle', on: 'target' },
      { at: 0, end: 600, track: 'target', motion: 'healGlowSoft' },
    ],
  },
  'v2-trainer-attach': {
    budget: 'trainer', duration: 700, beats: [
      { at: 0, cue: 'slide' },
      { at: 300, emit: 'portraitGlints', on: 'target' },
      { at: 300, cue: 'landed', bloom: 0.4 },
    ],
  },
  'v2-points': {
    budget: 'trainer', duration: 600, beats: [
      { at: 0, cue: 'points', bloom: 0.3 },
      { at: 0, emit: 'giftSparkles', on: 'target', countScale: 0.4 },
    ],
  },
  'v2-tier-unlock': {
    budget: 'trainer', duration: 1000, beats: [
      { at: 0, cue: 'pip', bloom: 0.9 },
      { at: 0, emit: 'crestSparkle', on: 'target' },
      { at: 0, emit: 'giftRing', on: 'target' },
      { at: 0, end: 700, emit: 'portraitGlints', on: 'target' },
    ],
  },
  'v2-ability': {
    budget: 'trainer', duration: 900, beats: [
      { at: 0, cue: 'ability', bloom: 0.6 },
      { at: 0, emit: 'trainerFlash', on: 'target' },
      { at: 0, end: 700, emit: 'portraitGlints', on: 'target' },
    ],
  },
  // A Partner's own entrance: a shaft of light from its Trainer's tab, a slam, a gold ring.
  'v2-partner': {
    budget: 'partner', duration: 1700, beats: [
      { at: 0, emit: 'lightShaft', on: 'target' },
      { at: 0, emit: 'portraitGlints', on: 'target' },
      { at: 200, end: 520, track: 'target', motion: 'slamDown' },
      { at: 520, cue: 'land', shake: 8, bloom: 1, distort: 'shockwave' },
      { at: 520, emit: 'landRing', on: 'ground' },
      { at: 520, emit: 'crestRing', on: 'target' },
      { at: 520, emit: 'giftSparkles', on: 'target' },
      { at: 520, end: 800, track: 'target', motion: 'settleLand' },
      { at: 700, cue: 'partner' },
    ],
  },
  'v2-item-found': {
    budget: 'item', duration: 800, beats: [
      { at: 0, cue: 'fly' },
      { at: 550, cue: 'bagged', bloom: 0.4 },
      { at: 550, emit: 'giftSparkles', on: 'target', countScale: 0.4 },
    ],
  },
  'v2-item-used': {
    budget: 'item', duration: 700, beats: [
      { at: 0, cue: 'use', bloom: 0.5 },
      { at: 0, emit: 'healGlints', on: 'target' },
      { at: 0, emit: 'flareRing', on: 'target' },
    ],
  },
  // Lane guards: a guard across stopped an attack on the player character.
  'v2-guard-block': {
    budget: 'guard', duration: 560, beats: [
      { at: 0, cue: 'shield', bloom: 0.6, flash: 'white' },
      { at: 0, emit: 'shellShimmer', on: 'target' },
      { at: 0, emit: 'shellGlints', on: 'target' },
    ],
  },
  'v2-effect-hit': {
    budget: 'effect', duration: 480, beats: [
      { at: 0, cue: 'impact', flash: 'type', bloom: 0.5, shake: 4 },
      { at: 0, emit: 'impactStar', on: 'target' },
      { at: 0, emit: 'genericSparks', on: 'target' },
    ],
  },
  'v2-growth': {
    budget: 'growth', duration: 600, beats: [
      { at: 0, cue: 'growth', bloom: 0.3 },
      { at: 0, emit: 'leafGlints', on: 'target' },
    ],
  },
  'v2-buff': {
    budget: 'heal', duration: 600, beats: [
      { at: 0, cue: 'buff', bloom: 0.3 },
      { at: 0, emit: 'epicSparks', on: 'target', countScale: 0.4 },
      { at: 0, end: 500, track: 'target', motion: 'healGlowSoft' },
    ],
  },
};
for (const [id, def] of Object.entries(V2_TIMELINES)) def.id = id;
export const v2Timeline = (id) => V2_TIMELINES[id];

// --- Every engine event type and its beat ----------------------------------------------------
//
//   phase  'before': played on the board as it was (the action itself: attacks, damage,
//          defeats, things leaving); 'after': on the newly drawn board (arrivals: summons,
//          Locations, numbers landing on panels); 'banner': a phase or match banner.
//   beat   what the player sees (the presenter's handler of that name does it).
export const EVENT_BEATS = {
  attack: { phase: 'before', beat: 'the attacker\'s Type + Attack-Type animation; a trade plays the defender\'s counter; a lane guard across shows its shield' },
  effectDamage: { phase: 'before', beat: 'a hit on the Pokémon with the damage number (part of its Strategy Card\'s animation when one played it)' },
  defeated: { phase: 'before', beat: 'the Pokémon dissolves by what defeated it (ash, washed away, wilting, shattered)' },
  burned: { phase: 'before', beat: 'embers catch on the target (card or player character); Burn +N' },
  asleep: { phase: 'before', beat: 'the card dims and sways as it falls Asleep' },
  seeded: { phase: 'before', beat: 'vines wrap the target' },
  cured: { phase: 'before', beat: 'steam: the status is gone' },
  healed: { phase: 'before', beat: 'a rising glow with the number' },
  grew: { phase: 'before', beat: 'a sparkle and +Attack/+Strength on the card' },
  rage: { phase: 'before', beat: 'Rage: +1 Attack on the card' },
  readied: { phase: 'before', beat: 'the card lifts, Active again' },
  moved: { phase: 'before', beat: 'the card slides to its new space' },
  growthSpent: { phase: 'before', beat: 'motes leave the Growth tree' },
  burnRecognition: { phase: 'before', beat: 'the Burn on the player character flares and drains the Recognition meter' },
  recognitionLost: { phase: 'before', beat: 'the Recognition meter drains, with −N' },
  locationEnded: { phase: 'before', beat: 'the Location\'s frame fades (or sweeps away for the Championship)' },
  released: { phase: 'before', beat: 'the card burns away into the Released Pile' },
  supporter: { phase: 'before', beat: 'the Supporter\'s moment; Released cards burn away; a met Favour shows a gold Favour!' },
  strategy: { phase: 'before', beat: 'the card rises, flares and dissolves into its effect; a bigger breakpoint plays bigger' },
  abilityUsed: { phase: 'before', beat: 'the Trainer\'s tab flashes with its Ability' },
  ability: { phase: 'before', beat: 'the Pokémon\'s ability tag (On Summon, On Attack…)' },
  itemUsed: { phase: 'before', beat: 'the Item glints out of the Bag (or hand) onto its target' },
  itemStolen: { phase: 'before', beat: 'the Item flies from one Bag to the other' },
  pass: { phase: 'before', beat: 'a Pass tag on the player\'s side' },
  searched: { phase: 'before', beat: 'the draw pile glints' },
  shuffled: { phase: 'before', beat: 'the draw pile wobbles' },
  choiceWaiting: { phase: 'after', beat: 'the choice prompt pulses' },
  summoned: { phase: 'after', beat: 'the summon entrance by rarity; Legendaries play their cinematic' },
  partnerArrived: { phase: 'after', beat: 'the Partner\'s entrance from its Trainer\'s tab, and Partner!' },
  partnerWaiting: { phase: 'after', beat: 'the Trainer\'s tab glows: a Partner is waiting for a space' },
  locationPlaced: { phase: 'after', beat: 'the frame unfolds over its lanes' },
  progress: { phase: 'after', beat: 'the progress bar fills' },
  milestone: { phase: 'after', beat: 'a gold tick on the bar, and the reward' },
  completed: { phase: 'after', beat: 'a completion banner, gold, and the reward' },
  championship: { phase: 'after', beat: 'the other Locations sweep away and the stadium frame covers all 9 lanes' },
  recognition: { phase: 'after', beat: 'the number flies to the Recognition panel and the meter fills' },
  trained: { phase: 'after', beat: 'a level-up glow; a new stage plays the evolution moment' },
  levelUp: { phase: 'after', beat: 'a card in hand glows with its new Level' },
  nurtured: { phase: 'after', beat: 'Growth motes fly from the Growth tree into the Pokémon' },
  growth: { phase: 'after', beat: 'Growth motes fly into the Growth tree' },
  trainerPlayed: { phase: 'after', beat: 'the Trainer\'s tab slides in' },
  trainerMoved: { phase: 'after', beat: 'the tab slides to its new space' },
  trainerPoints: { phase: 'after', beat: 'stars fly to the Trainer Points panel' },
  pointsAssigned: { phase: 'after', beat: 'stars fly from the panel into the Trainer\'s tab' },
  tierUnlocked: { phase: 'after', beat: 'the tier\'s pip lights with a flourish' },
  assignLocked: { phase: 'after', beat: 'a tick: the assignment is locked' },
  itemFound: { phase: 'after', beat: 'the card flies from the Location into the Bag' },
  bagged: { phase: 'after', beat: 'the Item flies from the hand into the Bag' },
  coinFlip: { phase: 'banner', beat: 'the coin banner: who has initiative' },
  phaseChanged: { phase: 'banner', beat: 'Breakfast / Battle / Supper banners' },
  turnChanged: { phase: 'banner', beat: 'the side to act glows' },
  suddenDeath: { phase: 'banner', beat: 'the Sudden death banner' },
  gameOver: { phase: 'banner', beat: 'the end screen: Victory or Defeat crest, celebration or slump' },
};

// --- Wiring helpers (tests) ------------------------------------------------------------------

// Every timeline a v2 card can play, by card (tests: every card in the three decks maps).
export function animationsOf(card) {
  if (card.cardType === 'Pokémon') return [attackFor(card), counterFor(card), summonFor(card), evolveFor(card)];
  if (card.cardType === 'Strategy') return [strategyFor(card)];
  if (card.cardType === 'Supporter') return ['supporter-moment'];
  if (card.cardType === 'Trainer') return ['v2-trainer-attach', 'v2-tier-unlock', 'v2-ability', 'v2-partner'];
  if (card.cardType === 'Item') return ['v2-item-found', 'v2-item-used'];
  if (card.cardType === 'Location') return ['v2-location-place', 'v2-milestone', 'v2-completion', 'v2-location-end'];
  return [];
}
// A timeline by id: v2's own, the shared library's, or a Strategy breakpoint (id@level).
export function defOf(id) {
  if (V2_TIMELINES[id]) return V2_TIMELINES[id];
  return TIMELINES[id] ?? null;
}
