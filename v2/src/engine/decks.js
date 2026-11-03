// V6 — the v2 decks (Elliott approved, 3 Nov): docs/v2-fire.md, docs/v2-water.md,
// docs/v2-grass.md, and the shared Item pool (docs/v2-items-draft.md, treated as
// approved). Data only: every Pokémon series (stages by Level, stats, weight, rarity,
// abilities by Level, Empower), Strategy breakpoints, Release-only Supporters with
// Favour, Trainers (Passive / Ability / Partner), Locations and Items.
//
// Ids are prefixed by deck (f-, w-, g-; p- for the pool) so they never meet the test
// cards; `art` names the picture in assets/cards (null: the frame for its card type).
// The shapes are the ones the engine already reads (series.js, cardtypes.js,
// locations.js); see game.js for the ops and triggers. Numbers are first-pass values
// for the V7 balance pass. Elliott's rulings on the V6 questions are noted where they apply.

import { line, three, two, single } from './series.js';

// --- Targets ---------------------------------------------------------------------------------
const T = {
  enemyPoke: (count = 1, extra = {}) => ({ side: 'enemy', kinds: ['pokemon'], count, ...extra }),
  enemyAny: (count = 1, extra = {}) => ({ side: 'enemy', kinds: ['pokemon', 'player'], count, ...extra }),
  enemyAll: { side: 'enemy', kinds: ['pokemon'], count: 'all' },
  enemyEvery: { side: 'enemy', kinds: ['pokemon', 'player'], count: 'all' },
  enemyPlayer: { side: 'enemy', kinds: ['player'], count: 'all' },
  friend: (count = 1, extra = {}) => ({ side: 'friendly', kinds: ['pokemon'], count, ...extra }),
  friendAll: { side: 'friendly', kinds: ['pokemon'], count: 'all' },
  friendOrMe: (count = 1, extra = {}) => ({ side: 'friendly', kinds: ['pokemon', 'player'], count, ...extra }),
  myPlayer: { side: 'friendly', kinds: ['player'], count: 'all' },
  friendLoc: { side: 'friendly', kinds: ['location'], count: 1 },
  enemyLoc: { side: 'enemy', kinds: ['location'], count: 1 },
  // "in its Location" (the source Pokémon's Location; at Home, all of Home).
  enemyHere: (count = 'all') => ({ side: 'enemy', kinds: ['pokemon'], count, scope: 'location' }),
  friendHere: (count = 'all', extra = {}) => ({ side: 'friendly', kinds: ['pokemon'], count, scope: 'location', ...extra }),
  self: { special: 'self' },
  attacker: { special: 'attacker' },
  target: { special: 'target' },
};
const eff = (target, ...ops) => ({ target, ops });
const op = (name, amount, extra = {}) => ({ op: name, ...(amount !== undefined ? { amount } : {}), ...extra });
// Ability bundles by Level: stages(level) picks the bundle for that Level.
const byLevel = (fn) => (level) => fn(level);

// --- Pokémon ---------------------------------------------------------------------------------
const fire = (spec) => line({ deck: 'fire', ...spec });
const water = (spec) => line({ deck: 'water', ...spec });
const grass = (spec) => line({ deck: 'grass', ...spec });

export const DECK_SERIES = [
  // ===== Fire =====
  fire({
    id: 'f-growlithe', rarity: 'Common', type: 'Fire', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', cap: 6,
    stages: two({ name: 'Growlithe', art: 'growlithe' }, { name: 'Arcanine', art: 'arcanine' }),
    stats: [[3, 3], [3, 4], [4, 4], [5, 6], [6, 6], [7, 7]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Scorch 1'], text: 'Scorch 1' }
      : { keywords: ['Scorch 1', 'Infiltrator', 'Overrun'], text: 'Scorch 1, Infiltrator, Overrun' })),
    empower: { cost: 2, attack: 2, strength: 2, keywords: ['Quick Attack'], text: '+2: +2/+2 and Quick Attack' },
  }),
  fire({
    id: 'f-ponyta', rarity: 'Common', type: 'Fire', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', weight: 'light', cap: 4,
    stages: two({ name: 'Ponyta', art: 'ponyta' }, { name: 'Rapidash', art: 'rapidash' }),
    stats: [[3, 2], [3, 3], [4, 3], [5, 4], [5, 5], [6, 5]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Quick Attack'], text: 'Quick Attack' }
      : l < 6 ? { keywords: ['Quick Attack', 'Infiltrator'], text: 'Quick Attack, Infiltrator' }
        : { keywords: ['Quick Attack', 'Infiltrator'], text: 'Quick Attack, Infiltrator. On Attack: the enemy player gains Burn 1', onAttack: eff(null, op('enemyBurn', 1)) })),
  }),
  fire({
    id: 'f-mankey', rarity: 'Common', type: 'Fighting', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', weight: 'light', cap: 4,
    stages: two({ name: 'Mankey', art: 'mankey' }, { name: 'Primeape', art: 'primeape' }),
    stats: [[3, 2], [4, 2], [4, 3], [5, 4], [6, 4], [7, 5]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Overrun'], text: 'Overrun' }
      : { keywords: ['Overrun', 'Infiltrator', 'Rage'], text: 'Overrun, Infiltrator, Rage (+1 Attack each time it survives damage)' })),
  }),
  fire({
    id: 'f-houndour', rarity: 'Rare', type: 'Fire', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Swift', cap: 6,
    stages: two({ name: 'Houndour', art: 'houndour' }, { name: 'Houndoom', art: 'houndoom' }),
    stats: [[2, 3], [3, 3], [3, 4], [5, 5], [5, 6], [6, 7]],
    ability: byLevel((l) => {
      const n = l <= 3 ? 1 : l < 6 ? 2 : 3;
      return { text: `On Summon: the enemy player gains Burn ${n}`, onSummon: eff(null, op('enemyBurn', n)) };
    }),
  }),
  fire({
    id: 'f-magby', rarity: 'Rare', type: 'Fire', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', weight: 'heavy', cap: 6,
    stages: three({ name: 'Magby', art: 'magby' }, { name: 'Magmar', art: 'magmar' }, { name: 'Magmortar', art: 'magmortar' }),
    stats: [[2, 4], [3, 4], [4, 5], [5, 6], [6, 7], [8, 8]],
    ability: byLevel((l) => (l <= 2 ? { keywords: ['Scorch 1'], text: 'Scorch 1' }
      : l <= 4 ? { keywords: ['Scorch 2'], text: 'Scorch 2' }
        : {
          keywords: ['Scorch 2'], text: 'Scorch 2. On Attack: 1 damage to each other enemy Pokémon in its Location',
          onAttack: eff(null, op('damage', 1, { to: { ...T.enemyHere(), notTarget: true } })),
        })),
  }),
  fire({
    id: 'f-sneasel', rarity: 'Rare', type: 'Dark', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', cap: 5,
    stages: two({ name: 'Sneasel', art: 'sneasel' }, { name: 'Weavile', art: 'weavile' }),
    stats: [[3, 2], [4, 2], [4, 3], [5, 4], [6, 4], [7, 5]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Infiltrator'], text: 'Infiltrator' }
      : { keywords: ['Infiltrator'], text: 'Infiltrator. On Knockout: becomes Active (once per Round)', onKnockout: { ...eff(T.self, op('ready')), oncePerRound: true } })),
  }),
  fire({
    id: 'f-charmander', rarity: 'Epic', type: 'Fire', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', weight: 'heavy', cap: 6,
    stages: three({ name: 'Charmander', art: 'charmander' }, { name: 'Charmeleon', art: 'charmeleon' }, { name: 'Charizard', art: 'charizard' }),
    stats: [[3, 3], [3, 4], [4, 5], [5, 5], [7, 7], [8, 8]],
    ability: byLevel((l) => (l <= 4 ? { keywords: ['Scorch 1'], text: 'Scorch 1' }
      : {
        keywords: ['Scorch 2', 'Infiltrator'], speed: 'Swift', text: 'Scorch 2, Infiltrator, Swift. On Summon: Burn 1 to every enemy Pokémon',
        onSummon: eff(T.enemyAll, op('burn', 1)),
      })),
    empower: { cost: 3, attack: 0, strength: 0, keywords: [], ops: [op('enemyBurn', 2)], text: '+3: the enemy player also gains Burn 2' },
  }),
  fire({
    id: 'f-duskull', rarity: 'Rare', type: 'Ghost', attackType: 'Special', strengthType: 'Special Defence', speed: 'Slow', weight: 'heavy', cap: 4,
    stages: two({ name: 'Duskull', art: 'duskull' }, { name: 'Dusclops', art: 'dusclops' }),
    stats: [[1, 5], [1, 6], [2, 7], [2, 8], [3, 9], [3, 10]],
    ability: byLevel((l) => {
      const n = l <= 3 ? 1 : 2;
      return { text: `On Defend: Burn ${n} to the attacker`, onDefend: eff(T.attacker, op('burn', n)) };
    }),
  }),
  fire({
    id: 'f-absol', rarity: 'Rare', type: 'Dark', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', cap: 4,
    stages: single({ name: 'Absol', art: 'absol' }),
    stats: [[3, 3], [4, 3], [4, 4], [5, 4], [6, 5], [6, 6]],
    ability: () => ({ vsBurned: 2, text: '+2 damage with its attack against a burned target' }),
  }),
  fire({
    // A Legendary (V7a): a single card, cost 6, 9/9.
    id: 'f-entei', rarity: 'Legendary', type: 'Fire', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift', legendary: true, cost: 6,
    stages: single({ name: 'Entei', art: 'entei' }, 1),
    stats: [[9, 9]],
    ability: () => ({ keywords: ['Infiltrator', 'Overrun', 'Scorch 2'], text: 'Infiltrator, Overrun, Scorch 2. On Summon: the enemy player gains Burn 3', onSummon: eff(null, op('enemyBurn', 3)) }),
  }),

  // ===== Water =====
  water({
    id: 'w-squirtle', rarity: 'Common', type: 'Water', attackType: 'Special', strengthType: 'Defence', speed: 'Steady', cap: 6,
    stages: three({ name: 'Squirtle', art: 'squirtle' }, { name: 'Wartortle', art: 'wartortle' }, { name: 'Blastoise', art: 'blastoise' }),
    stats: [[2, 4], [2, 5], [3, 6], [4, 7], [5, 9], [6, 10]],
    ability: byLevel((l) => (l <= 2 ? null : l <= 4 ? { keywords: ['Shell 1'], text: 'Shell 1' } : { keywords: ['Shell 2'], text: 'Shell 2' })),
    empower: { cost: 2, attack: 0, strength: 0, keywords: [], target: T.enemyHere(), ops: [op('damage', 2)], text: '+2: on summon, 2 damage to each enemy Pokémon in its Location' },
  }),
  water({
    // Kingdra's "Shell 1" is a keyword it always has, not part of Rally (Elliott's V6 ruling).
    id: 'w-horsea', rarity: 'Rare', type: 'Water', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', cap: 6,
    stages: three({ name: 'Horsea', art: 'horsea' }, { name: 'Seadra', art: 'seadra' }, { name: 'Kingdra', art: 'kingdra' }),
    stats: [[2, 4], [3, 5], [4, 6], [4, 7], [6, 8], [7, 9]],
    ability: byLevel((l) => (l <= 4
      ? { text: 'Rally: +1/+1 when another friendly Pokémon is summoned into its Location', rally: eff(T.self, op('grow', undefined, { attack: 1, strength: 1 })) }
      : { keywords: ['Shell 1'], text: 'Rally: +2/+2. Shell 1', rally: eff(T.self, op('grow', undefined, { attack: 2, strength: 2 })) })),
  }),
  water({
    id: 'w-magikarp', rarity: 'Rare', type: 'Water', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Steady', weight: 'heavy', cap: 6,
    stages: two({ name: 'Magikarp', art: 'magikarp' }, { name: 'Gyarados', art: 'gyarados' }),
    stats: [[1, 3], [1, 4], [1, 5], [7, 6], [8, 7], [9, 8]],
    ability: byLevel((l) => (l <= 3 ? { text: 'Splash: On Summon, draw 1 card', onSummon: eff(null, op('draw', 1)) }
      : { keywords: ['Overrun'], text: 'Overrun. On Summon: 2 damage to each enemy Pokémon in its Location', onSummon: eff(T.enemyHere(), op('damage', 2)) })),
  }),
  water({
    id: 'w-wooper', rarity: 'Common', type: 'Water', attackType: 'Physical', strengthType: 'Defence', speed: 'Slow', weight: 'light', cap: 4,
    stages: two({ name: 'Wooper', art: null }, { name: 'Quagsire', art: 'quagsire' }), art: 'quagsire',
    stats: [[2, 4], [2, 5], [3, 5], [4, 7], [4, 8], [5, 8]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Regenerate 1'], text: 'Regenerate 1' } : { keywords: ['Regenerate 2'], text: 'Regenerate 2' })),
  }),
  water({
    id: 'w-chinchou', rarity: 'Common', type: 'Electric', attackType: 'Special', strengthType: 'Special Defence', speed: 'Steady', weight: 'light', cap: 4,
    stages: two({ name: 'Chinchou', art: 'chinchou' }, { name: 'Lanturn', art: 'lanturn' }),
    stats: [[2, 4], [3, 4], [3, 5], [4, 6], [5, 7], [5, 8]],
    ability: byLevel((l) => (l <= 3 ? { keywords: ['Regenerate 1'], text: 'Regenerate 1' }
      : { keywords: ['Regenerate 1'], text: 'Regenerate 1. On Attack: heal another friendly Pokémon in its Location 2', onAttack: eff(T.friendHere(1, { other: true, filter: 'damaged' }), op('heal', 2)) })),
  }),
  water({
    id: 'w-wingull', rarity: 'Common', type: 'Water', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Swift', weight: 'light', cap: 4,
    stages: two({ name: 'Wingull', art: 'wingull' }, { name: 'Pelipper', art: 'pelipper' }),
    stats: [[2, 3], [3, 3], [3, 4], [4, 5], [5, 5], [5, 6]],
    ability: byLevel((l) => (l <= 3 ? { weather: { Rain: 1 }, text: 'Weather: 1 Rain' }
      : { weather: { Rain: 2 }, text: 'Weather: 2 Rain. On Summon: a card in your hand gains Retain', onSummon: eff(null, op('grantRetain')) })),
  }),
  water({
    id: 'w-eevee', rarity: 'Epic', type: 'Normal', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', cap: 6,
    stages: two({ name: 'Eevee', art: 'eevee' }, { name: 'Vaporeon', art: 'vaporeon' }),
    stats: [[2, 4], [3, 4], [3, 5], [5, 7], [5, 8], [6, 9]],
    ability: byLevel((l) => (l <= 3 ? { text: 'On Summon: heal a friendly Pokémon 2', onSummon: eff(T.friend(1, { filter: 'damaged' }), op('heal', 2)) }
      : {
        type: 'Water', guard: 'Special Defence', keywords: ['Regenerate 2'], text: 'Regenerate 2. On Heal: +1 Attack (permanent)',
        onHeal: eff(T.self, op('grow', undefined, { attack: 1 })),
      })),
  }),
  water({
    // "And Douse them" is Blissey's only (Elliott's V6 ruling).
    id: 'w-happiny', rarity: 'Rare', type: 'Normal', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Slow', weight: 'heavy', cap: 6,
    stages: three({ name: 'Happiny', art: 'happiny' }, { name: 'Chansey', art: 'chansey' }, { name: 'Blissey', art: 'blissey' }),
    stats: [[0, 5], [1, 6], [1, 8], [1, 10], [2, 12], [2, 14]],
    ability: byLevel((l) => (l <= 2 ? { text: 'On Breakfast: heal a friendly Pokémon in its Location 1', onBreakfast: eff(T.friendHere(1, { filter: 'damaged' }), op('heal', 1)) }
      : l <= 4 ? { text: 'On Breakfast: heal each friendly Pokémon in its Location 2', onBreakfast: eff(T.friendHere(), op('heal', 2)) }
        : { text: 'On Breakfast: heal each friendly Pokémon in its Location 3 and Douse them', onBreakfast: eff(T.friendHere(), op('heal', 3), op('douse')) })),
  }),
  water({
    id: 'w-dratini', rarity: 'Epic', type: 'Dragon', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Steady', weight: 'heavy', cap: 6,
    stages: three({ name: 'Dratini', art: null }, { name: 'Dragonair', art: null }, { name: 'Dragonite', art: 'dragonite' }), art: 'dragonite',
    stats: [[2, 4], [3, 4], [4, 5], [5, 6], [7, 8], [8, 9]],
    ability: byLevel((l) => (l <= 2 ? null : l <= 4 ? { keywords: ['Infiltrator'], text: 'Infiltrator' } : { keywords: ['Infiltrator', 'Shell 1'], text: 'Infiltrator, Shell 1' })),
  }),
  water({
    // A Legendary (V7a): a single card, cost 7, 10/12.
    id: 'w-kyogre', rarity: 'Legendary', type: 'Water', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Slow', legendary: true, cost: 7,
    stages: single({ name: 'Kyogre', art: 'kyogre' }, 1),
    stats: [[10, 12]],
    ability: () => ({
      weather: { Rain: 2 }, text: 'Weather: 2 Rain. On Summon, Origin Pulse: heal every friendly Pokémon 2, and 3 damage to every enemy Pokémon',
      onSummon: eff(T.friendAll, op('heal', 2), op('damage', 3, { to: T.enemyAll })),
    }),
  }),

  // ===== Grass =====
  grass({
    id: 'g-bulbasaur', rarity: 'Common', type: 'Grass', attackType: 'Special', strengthType: 'Special Defence', speed: 'Steady', cap: 6,
    stages: three({ name: 'Bulbasaur', art: 'bulbasaur' }, { name: 'Ivysaur', art: 'ivysaur' }, { name: 'Venusaur', art: 'venusaur' }),
    stats: [[2, 5], [2, 6], [3, 7], [4, 7], [5, 10], [6, 12]],
    ability: byLevel((l) => (l <= 2 ? { text: 'On Breakfast: gain 1 Growth', onBreakfast: eff(null, op('growth', 1)) }
      : l <= 4 ? { guard: 'none', text: 'On Breakfast: gain 1 Growth. On Evolve: Leech Seed an enemy Pokémon in its Location', onBreakfast: eff(null, op('growth', 1)), onEvolve: eff(T.enemyHere(1), op('leechSeed')) }
        : { guard: 'none', keywords: ['Shell 1'], text: 'On Breakfast: gain 2 Growth. Shell 1', onBreakfast: eff(null, op('growth', 2)) })),
  }),
  grass({
    id: 'g-oddish', rarity: 'Common', type: 'Grass', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', weight: 'light', cap: 6,
    stages: three({ name: 'Oddish', art: 'oddish' }, { name: 'Gloom', art: 'gloom' }, { name: 'Bellossom', art: 'bellossom' }),
    stats: [[2, 4], [3, 4], [3, 5], [3, 6], [4, 8], [5, 9]],
    ability: byLevel((l) => {
      if (l <= 2) return { text: 'On Breakfast: gain 1 Growth', onBreakfast: eff(null, op('growth', 1)) };
      if (l <= 4) {
        const e = eff(T.enemyHere(1), op('sleep'));
        return { text: 'On Evolve or Summon: put an enemy Pokémon in its Location to Sleep', onEvolve: e, onSummon: e };
      }
      const e = eff(T.enemyHere(), op('sleep'));
      return { text: 'On Evolve or Summon: put each enemy Pokémon in its Location to Sleep. On Attack: gain 1 Growth', onEvolve: e, onSummon: e, onAttack: eff(null, op('growth', 1)) };
    }),
  }),
  grass({
    id: 'g-sunkern', rarity: 'Common', type: 'Grass', attackType: 'Special', strengthType: 'Defence', speed: 'Slow', weight: 'light', cap: 6,
    stages: two({ name: 'Sunkern', art: 'sunkern' }, { name: 'Sunflora', art: 'sunflora' }),
    stats: [[2, 6], [3, 6], [3, 7], [5, 7], [5, 8], [6, 8]],
    ability: byLevel((l) => (l <= 3 ? { weather: { Sun: 1 }, text: 'Weather: 1 Sun. On Breakfast: gain 1 Growth', onBreakfast: eff(null, op('growth', 1)) }
      : { guard: 'none', weather: { Sun: 2 }, sunBonus: { at: 4, amount: 2 }, text: 'Weather: 2 Sun. +2 damage with its attack while Sun is 4+' })),
  }),
  grass({
    id: 'g-sewaddle', rarity: 'Common', type: 'Bug', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Steady', cap: 6,
    stages: three({ name: 'Sewaddle', art: 'sewaddle' }, { name: 'Swadloon', art: 'swadloon' }, { name: 'Leavanny', art: 'leavanny' }),
    stats: [[3, 4], [3, 5], [2, 8], [2, 9], [6, 7], [7, 8]],
    ability: byLevel((l) => (l <= 2 ? { text: 'On Defeated: gain 2 Growth', onDefeated: eff(null, op('growth', 2)) }
      : l <= 4 ? { guard: 'Defence', keywords: ['Shell 1'], text: 'Shell 1' }
        : { speed: 'Swift', keywords: ['Infiltrator'], text: 'Infiltrator. On Attack: gain 1 Growth', onAttack: eff(null, op('growth', 1)) })),
  }),
  grass({
    id: 'g-eevee', rarity: 'Epic', type: 'Normal', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Steady', cap: 6,
    stages: two({ name: 'Eevee', art: 'eevee' }, { name: 'Leafeon', art: null }),
    stats: [[2, 4], [3, 4], [3, 5], [5, 6], [6, 6], [7, 7]],
    ability: byLevel((l) => (l <= 3 ? { text: 'On Summon: gain 1 Growth', onSummon: eff(null, op('growth', 1)) }
      : { type: 'Grass', speed: 'Swift', text: 'On Evolve: train 1 another friendly Pokémon in its Location', onEvolve: eff(T.friendHere(1, { other: true, filter: 'canTrain' }), op('train', 1)) })),
  }),
  grass({
    id: 'g-caterpie', rarity: 'Common', type: 'Bug', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Slow', weight: 'light', cap: 6,
    stages: three({ name: 'Caterpie', art: null }, { name: 'Metapod', art: 'metapod' }, { name: 'Butterfree', art: null }), art: 'metapod',
    stats: [[1, 4], [1, 5], [1, 7], [1, 8], [5, 6], [6, 7]],
    ability: byLevel((l) => (l <= 2 ? null : l <= 4 ? { guard: 'Defence', keywords: ['Shell 1'], text: 'Shell 1' }
      : { speed: 'Swift', keywords: ['Agility'], text: 'Agility. On Evolve: put an enemy Pokémon to Sleep', onEvolve: eff(T.enemyPoke(1), op('sleep')) })),
  }),
  grass({
    id: 'g-geodude', rarity: 'Rare', type: 'Rock', attackType: 'Physical', strengthType: 'Defence', speed: 'Slow', weight: 'heavy', cap: 6,
    stages: three({ name: 'Geodude', art: 'geodude' }, { name: 'Graveler', art: null }, { name: 'Golem', art: null }), art: 'geodude',
    stats: [[3, 6], [3, 7], [4, 8], [5, 9], [7, 11], [8, 12]],
    ability: byLevel((l) => {
      const n = l <= 4 ? 1 : 2;
      return { text: `On Defend: ${n} damage to the attacker`, onDefend: eff(T.attacker, op('damage', n)) };
    }),
  }),
  grass({
    id: 'g-bonsly', rarity: 'Rare', type: 'Rock', attackType: 'Physical', strengthType: 'Defence', speed: 'Slow', cap: 4,
    stages: two({ name: 'Bonsly', art: null }, { name: 'Sudowoodo', art: 'sudowoodo' }), art: 'sudowoodo',
    stats: [[1, 6], [2, 6], [2, 7], [3, 9], [4, 9], [4, 10]],
    ability: byLevel((l) => (l <= 3 ? null : { keywords: ['Shell 1'], text: 'Shell 1' })),
  }),
  grass({
    // A Legendary (V7a): a single card, cost 3, 4/6 (the early supporter).
    id: 'g-celebi', rarity: 'Legendary', type: 'Grass', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Swift', legendary: true, cost: 3,
    stages: single({ name: 'Celebi', art: 'celebi' }, 1),
    stats: [[4, 6]],
    ability: () => ({ text: 'On Summon: gain 3 Growth, and train 1 every friendly Pokémon', onSummon: eff(null, op('growth', 3), op('train', 1, { to: T.friendAll })) }),
  }),
];

// --- Strategy Cards (breakpoints; each higher one gives more per Energy) ---------------------------
const strategy = (deck, id, name, rarity, art, breakpoints, extra = {}) => ({
  id, name, cardType: 'Strategy', rarity, art, deck, breakpoints: breakpoints.map((b) => (b.target ? { ...b, target: { ...b.target, strategy: true } } : b)),
  cost: breakpoints[0].cost, ...extra,
});
const bp = (cost, text, target, ...ops) => ({ cost, text, ...(target ? { target } : {}), ops });

export const DECK_STRATEGIES = [
  // Fire
  strategy('fire', 'f-ember', 'Ember', 'Common', 'ember', [
    bp(2, 'Burn 2 to an enemy Pokémon or the enemy player', T.enemyAny(1), op('burn', 2)),
    bp(4, 'Burn 2 to two targets, and the enemy player loses 1 Recognition', T.enemyAny(2), op('burn', 2), op('enemyLosesRecognition', 1)),
    bp(6, 'Burn 2 to every enemy Pokémon and the enemy player, who also loses 2 Recognition', T.enemyEvery, op('burn', 2), op('enemyLosesRecognition', 2)),
  ]),
  strategy('fire', 'f-flame-charge', 'Flame Charge', 'Common', 'flame-charge', [
    bp(1, 'A friendly Pokémon gains +2 Attack this Round', T.friend(1), op('buff', undefined, { attack: 2 })),
    bp(3, 'A friendly Pokémon gains +2 Attack and Scorch 1 this Round, and becomes Active', T.friend(1), op('buff', undefined, { attack: 2, keywords: ['Scorch 1'] }), op('ready')),
  ]),
  strategy('fire', 'f-heat-wave', 'Heat Wave', 'Rare', 'heat-wave', [
    bp(3, 'Burn 1 to every enemy Pokémon', T.enemyAll, op('burn', 1)),
    bp(5, 'Burn 2 to every enemy Pokémon and the enemy player', T.enemyEvery, op('burn', 2)),
  ]),
  strategy('fire', 'f-fire-blast', 'Fire Blast', 'Epic', 'fire-blast', [
    bp(3, '4 damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('damage', 4)),
    bp(5, '6 damage, then Burn 2', T.enemyAny(1), op('damage', 6), op('burn', 2)),
    bp(7, '9 damage, then Burn 3', T.enemyAny(1), op('damage', 9), op('burn', 3)),
  ]),
  strategy('fire', 'f-hyper-voice', 'Hyper Voice', 'Rare', 'hypervoice', [
    bp(4, '2 damage to every enemy Pokémon', T.enemyAll, op('damage', 2)),
    bp(6, '3 damage to every enemy Pokémon and 2 to the enemy player', T.enemyAll, op('damage', 3), op('damage', 2, { to: T.enemyPlayer })),
  ]),
  // Water
  strategy('water', 'w-aqua-ring', 'Aqua Ring', 'Common', 'aqua-ring', [
    bp(1, 'Heal a friendly Pokémon 2 and Douse it', T.friend(1), op('heal', 2), op('douse')),
    bp(3, 'Heal a friendly Pokémon 4, Douse it, and it gains Regenerate 1', T.friend(1), op('heal', 4), op('douse'), op('gainKeyword', undefined, { keyword: 'Regenerate 1' })),
    bp(5, 'Every friendly Pokémon in a chosen Location: heal 4, Douse, Regenerate 1', T.friendLoc, op('heal', 4), op('douse'), op('gainKeyword', undefined, { keyword: 'Regenerate 1' })),
  ], { retain: true }),
  strategy('water', 'w-bubble-beam', 'Bubble Beam', 'Common', 'bubble-beam', [
    bp(2, '2 damage to an enemy Pokémon (3 if Rain is 2+)', T.enemyPoke(1), op('damage', 2, { rainBonus: 1 })),
    bp(4, '3 damage to two enemy Pokémon', T.enemyPoke(2), op('damage', 3)),
    bp(6, '3 damage to every enemy Pokémon in a chosen Location', T.enemyLoc, op('damage', 3)),
  ]),
  strategy('water', 'w-dive', 'Dive', 'Common', 'dive', [
    bp(2, 'Return a Pokémon from your Discard Pile to your hand. It gains Retain', null, op('returnFromDiscard', undefined, { filter: 'pokemon', retain: true })),
  ]),
  strategy('water', 'w-surf', 'Surf', 'Rare', 'surf', [
    bp(3, '2 damage to each enemy Pokémon', T.enemyAll, op('damage', 2)),
    bp(5, '3 damage to each enemy Pokémon, and heal each friendly Pokémon 2', T.enemyAll, op('damage', 3), op('heal', 2, { to: T.friendAll })),
  ]),
  strategy('water', 'w-hydro-pump', 'Hydro Pump', 'Epic', 'hydro-pump', [
    bp(3, '4 damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('damage', 4)),
    bp(6, '9 damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('damage', 9)),
  ]),
  strategy('water', 'w-thunderbolt', 'Thunderbolt', 'Rare', 'thunderbolt', [
    // 2 and 4 hit an enemy Pokémon or the enemy player, like 6 (Elliott's V6 ruling).
    bp(2, '3 damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('damage', 3)),
    bp(4, '6 damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('damage', 6)),
    bp(6, '6 damage to two targets (Pokémon or the enemy player)', T.enemyAny(2), op('damage', 6)),
  ]),
  // Grass
  strategy('grass', 'g-leech-seed', 'Leech Seed', 'Common', 'leech-seed', [
    bp(1, 'Leech Seed an enemy Pokémon', T.enemyPoke(1, { filter: 'unseeded' }), op('leechSeed')),
  ]),
  strategy('grass', 'g-sleep-powder', 'Sleep Powder', 'Common', 'sleep-powder', [
    bp(2, 'Put an enemy Pokémon to Sleep', T.enemyPoke(1), op('sleep')),
  ]),
  strategy('grass', 'g-synthesis', 'Synthesis', 'Common', 'synthesis', [
    bp(1, 'Gain 2 Growth; heal a friendly Pokémon 2 and Douse it, or Douse your player character', T.friendOrMe(1), op('growth', 2), op('heal', 2), op('douse')),
    bp(3, 'Gain 4 Growth; heal every friendly Pokémon in a chosen Location 3; Douse your player character', T.friendLoc, op('growth', 4), op('heal', 3), op('douse', undefined, { to: T.myPlayer })),
  ]),
  strategy('grass', 'g-solar-beam', 'Solar Beam', 'Rare', 'solar-beam', [
    { ...bp(2, 'Spend up to 5 Growth: deal that much damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('solarBeam', undefined, { max: 5 })), needsGrowth: true },
    // Elliott's V6 ruling: no "can't be guarded"; spending up to 10 Growth is its payoff.
    { ...bp(4, 'Spend up to 10 Growth: deal that much damage to an enemy Pokémon or the enemy player', T.enemyAny(1), op('solarBeam', undefined, { max: 10 })), needsGrowth: true },
  ], { retain: true }),
  strategy('grass', 'g-rock-slide', 'Rock Slide', 'Rare', 'rock-slide', [
    bp(3, '2 damage to every enemy Pokémon in a chosen Location', T.enemyLoc, op('damage', 2)),
    bp(5, '3 damage to every enemy Pokémon in a chosen Location, and 1 to every other enemy Pokémon', T.enemyLoc, op('damage', 3), op('damage', 1, { to: { ...T.enemyAll, others: true } })),
  ]),
];

// --- Supporters (Release only; Favour) -------------------------------------------------------------
const supporter = (deck, id, name, rarity, art, release, text, effect, favour) => ({
  id, name, cardType: 'Supporter', rarity, art, deck, release, cost: 0, text, ...effect, favour,
});
export const DECK_SUPPORTERS = [
  supporter('fire', 'f-firebreather', 'Firebreather', 'Common', 'firebreather', 1, 'The enemy player gains Burn 2', { ops: [op('enemyBurn', 2)] },
    { condition: 'fire', text: 'Burn 3 instead, and Burn 1 to every enemy Pokémon', ops: [op('enemyBurn', 3), op('burn', 1, { to: T.enemyAll })] }),
  supporter('fire', 'f-chili', 'Chili', 'Rare', 'chili', 1, 'Your Pokémon in a chosen Location gain +2 Attack and Overrun this Round',
    { target: T.friendLoc, ops: [op('buff', undefined, { attack: 2, keywords: ['Overrun'] })] },
    { condition: 'swift', text: 'They also become Active', ops: [op('buff', undefined, { attack: 2, keywords: ['Overrun'] }), op('ready')] }),
  supporter('fire', 'f-burglar', 'Burglar', 'Rare', 'burglar', 2, "Take an Item from the opponent's Bag into yours (your choice)", { ops: [op('stealItem')], needs: 'stealItem' },
    { condition: 'item', text: 'Also draw 2 cards', ops: [op('stealItem'), op('draw', 2)] }),
  supporter('water', 'w-nurse-joy', 'Nurse Joy', 'Common', 'nurse-joy', 1, 'Heal each friendly Pokémon in a chosen Location 3 and Douse them',
    { target: T.friendLoc, ops: [op('heal', 3), op('douse')] },
    { condition: 'normal', text: 'Every Location instead', target: T.friendAll, ops: [op('heal', 3), op('douse')] }),
  supporter('water', 'w-swimmer', 'Swimmer', 'Rare', 'swimmer', 1, 'Free summon a Pokémon of Level 3 or lower from your hand', { ops: [op('freeSummon', undefined, { maxLevel: 3 })], needs: 'freeSummon' },
    { condition: 'water', text: 'It arrives Active', ops: [op('freeSummon', undefined, { maxLevel: 3, active: true })] }),
  supporter('water', 'w-fisherman', 'Fisherman', 'Rare', 'fisherman', 1, 'Search your Draw Pile for a Water Pokémon; it gains Retain', { ops: [op('search', undefined, { filter: 'waterPokemon', count: 1, retain: true })] },
    { condition: 'strategy', text: 'Search for two instead', ops: [op('search', undefined, { filter: 'waterPokemon', count: 2, retain: true })] }),
  supporter('water', 'w-tracey', 'Tracey', 'Rare', 'tracey', 1, 'Look at the top 4 cards of your Draw Pile: put 2 in your hand, the rest on the bottom', { ops: [op('lookTop', undefined, { n: 4, take: 2 })] },
    { condition: 'pokemon', text: 'Put 3 in your hand', ops: [op('lookTop', undefined, { n: 4, take: 3 })] }),
  supporter('grass', 'g-mallow', 'Mallow', 'Common', 'mallow', 1, 'Gain 3 Growth', { ops: [op('growth', 3)] },
    { condition: 'grass', text: 'Also train 1 a friendly Pokémon', target: T.friend(1, { filter: 'canTrain', optional: true }), ops: [op('growth', 3), op('train', 1)] }),
  supporter('grass', 'g-pokemon-breeder', 'Pokémon Breeder', 'Rare', 'pokemon-breeder', 1, 'Train 2 a friendly Pokémon', { target: T.friend(1, { filter: 'canTrain' }), ops: [op('train', 2)] },
    { condition: 'evolutionLine', text: 'Train 3 instead', ops: [op('train', 3)] }),
  supporter('grass', 'g-professor-oak', 'Professor Oak', 'Rare', 'professor-oak', 2, 'Draw 3 cards', { ops: [op('draw', 3)] },
    { condition: 'pokemon', text: 'Draw 4 instead', ops: [op('draw', 4)] }),
  supporter('grass', 'g-brock', 'Brock', 'Rare', 'brock', 1, 'Friendly Pokémon in a chosen Location gain +2 Strength and Shell 1 until your next Breakfast; Douse your player character',
    { target: T.friendLoc, ops: [op('buff', undefined, { strength: 2, keywords: ['Shell 1'], until: 'breakfast' }), op('douse', undefined, { to: T.myPlayer })] },
    { condition: 'rock', text: 'Every Location instead', target: T.friendAll, ops: [op('buff', undefined, { strength: 2, keywords: ['Shell 1'], until: 'breakfast' }), op('douse', undefined, { to: T.myPlayer })] }),
];

// --- Trainers (tiers at 2 / 4 / 6) ----------------------------------------------------------------
// Every Trainer costs 1 Energy (Elliott's V6 ruling).
const partner = (name, art, type, attackType, speed, attack, strength, extra = {}) => ({ name, art, level: 5, type, attackType, speed, attack, strength, ...extra });
const trainer = (deck, id, name, art, [passiveText, passive], [abCost, abText, abTarget, ...abOps], [partnerText, partnerSpec]) => ({
  id, name, cardType: 'Trainer', rarity: 'Rare', art, deck, cost: 1,
  tiers: [
    { kind: 'Passive', cost: 2, text: passiveText, passive },
    { kind: 'Ability', cost: 4, text: `${abCost} Energy: ${abText}`, ability: { cost: abCost, target: abTarget, ops: abOps } },
    { kind: 'Partner', cost: 6, text: `Partner: ${partnerText}`, partner: partnerSpec },
  ],
});
const laneFriend = (extra = {}) => ({ side: 'friendly', kinds: ['pokemon'], count: 1, scope: 'lane', ...extra });
const laneEnemy = (extra = {}) => ({ side: 'enemy', kinds: ['pokemon'], count: 1, scope: 'lane', ...extra });

export const DECK_TRAINERS = [
  trainer('fire', 'f-blaine', 'Blaine', 'blaine',
    ['Burn applied by your Pokémon in his lane is +1', { kind: 'burnPlusLane', amount: 1 }],
    [1, 'Burn 1 to an enemy Pokémon or the enemy player', T.enemyAny(1), op('burn', 1)],
    ['Ninetales (Level 5): Special · Swift · 6/6, On Summon: the enemy player gains Burn 2',
      partner('Ninetales', 'ninetales', 'Fire', 'Special', 'Swift', 6, 6, { ability: { text: 'On Summon: the enemy player gains Burn 2', onSummon: eff(null, op('enemyBurn', 2)) } })]),
  trainer('fire', 'f-flannery', 'Flannery', 'flannery',
    ['Your Fire Pokémon in her lane gain Overrun', { kind: 'laneKeyword', keyword: 'Overrun', type: 'Fire', amount: 1 }],
    // "A Pokémon in her lane" is one of yours (Elliott's V6 ruling).
    [1, 'A Pokémon in her lane gains +2 Attack this Round', laneFriend(), op('buff', undefined, { attack: 2 })],
    // Torkoal is Special (Elliott's V6 ruling).
    ['Torkoal (Level 5): Slow · Defence guard · 4/10, Shell 1',
      partner('Torkoal', 'torkoal', 'Fire', 'Special', 'Slow', 4, 10, { strengthType: 'Defence', keywords: ['Shell 1'] })]),
  trainer('fire', 'f-kabu', 'Kabu', 'kabu',
    ['Your Pokémon in his lane gain +2 Strength', { kind: 'laneStrength', amount: 2 }],
    [2, 'A Spent Pokémon in his lane becomes Active', laneFriend({ filter: 'spent' }), op('ready')],
    ['Centiskorch (Level 5): Physical · Steady · 7/7, Overrun, Scorch 1',
      partner('Centiskorch', 'centiskorch', 'Fire', 'Physical', 'Steady', 7, 7, { keywords: ['Overrun', 'Scorch 1'] })]),
  trainer('water', 'w-misty', 'Misty', 'misty',
    ['Your Water Pokémon in her lane gain +1/+1', { kind: 'laneStrength', type: 'Water', amount: 1, alsoAttack: true }],
    [1, 'Heal a friendly Pokémon 3', T.friend(1, { filter: 'damaged' }), op('heal', 3)],
    ['Starmie (Level 5): Special · Swift · 6/7, Regenerate 1, Infiltrator',
      partner('Starmie', 'starmie', 'Water', 'Special', 'Swift', 6, 7, { keywords: ['Regenerate 1', 'Infiltrator'] })]),
  trainer('water', 'w-crasher-wake', 'Crasher Wake', 'crasher-wake',
    ['Your Pokémon in his lane gain Shell 1', { kind: 'spaceShell', amount: 1 }],
    [2, '2 damage to an enemy Pokémon in his lane', laneEnemy(), op('damage', 2)],
    ['Floatzel (Level 5): Physical · Swift · 6/6, Quick Attack, Overrun',
      partner('Floatzel', 'floatzel', 'Water', 'Physical', 'Swift', 6, 6, { keywords: ['Quick Attack', 'Overrun'] })]),
  trainer('water', 'w-wallace', 'Wallace', 'wallace',
    ['The first Pokémon you summon into his lane each Round costs 1 less', { kind: 'laneDiscount', amount: 1 }],
    [1, 'Return a Pokémon from your Discard Pile to your hand', null, op('returnFromDiscard', undefined, { filter: 'pokemon' })],
    ['Milotic (Level 5): Special · Steady · 5/10, Regenerate 2, On Summon: heal every friendly Pokémon 2',
      partner('Milotic', 'milotic', 'Water', 'Special', 'Steady', 5, 10, { keywords: ['Regenerate 2'], ability: { text: 'On Summon: heal every friendly Pokémon 2', onSummon: eff(T.friendAll, op('heal', 2)) } })]),
  trainer('grass', 'g-erika', 'Erika', 'erika',
    ['Your Pokémon in her lane train 1 at Breakfast', { kind: 'laneTrain', amount: 1 }],
    [2, 'Put an enemy Pokémon to Sleep', T.enemyPoke(1), op('sleep')],
    ['Vileplume (Level 5): Special · Slow · 5/10, On Summon: put each enemy Pokémon in its Location to Sleep',
      partner('Vileplume', 'vileplume', 'Grass', 'Special', 'Slow', 5, 10, { ability: { text: 'On Summon: put each enemy Pokémon in its Location to Sleep', onSummon: eff(T.enemyHere(), op('sleep')) } })]),
  trainer('grass', 'g-gardenia', 'Gardenia', 'gardenia',
    ['Nurturing a Pokémon in her lane costs 1 Growth less', { kind: 'nurtureDiscount', amount: 1 }],
    [1, 'Gain 1 Growth', null, op('growth', 1)],
    ['Roserade (Level 5): Special · Swift · 6/5, On Attack: Leech Seed the target',
      partner('Roserade', 'roserade', 'Grass', 'Special', 'Swift', 6, 5, { ability: { text: 'On Attack: Leech Seed the target', onAttack: eff(T.target, op('leechSeed')) } })]),
  trainer('grass', 'g-ramos', 'Ramos', 'ramos',
    ['Leech Seeds on enemy Pokémon in his lane drain 1 more', { kind: 'seedPlus', amount: 1 }],
    [1, 'Leech Seed an enemy Pokémon in his lane', laneEnemy({ filter: 'unseeded' }), op('leechSeed')],
    ['Gogoat (Level 5): Physical · Steady · 6/8, Regenerate 2',
      partner('Gogoat', 'gogoat', 'Grass', 'Physical', 'Steady', 6, 8, { keywords: ['Regenerate 2'] })]),
];

// --- Items --------------------------------------------------------------------------------------
const item = (deck, id, name, art, kind, cost, text, effect = {}, extra = {}) => ({
  id, name, cardType: 'Item', rarity: 'Common', art, deck, kind, cost, text, ...effect, ...extra,
});
export const DECK_ITEMS = [
  item('fire', 'f-charcoal', 'Charcoal', 'charcoal', 'Held', 1, 'Held: +1 Attack; a Fire Pokémon also gains Scorch 1', { target: T.friend(1), held: { attack: 1, typed: { type: 'Fire', keywords: ['Scorch 1'] } } }),
  item('fire', 'f-black-belt', 'Black Belt', 'black-belt', 'Held', 2, 'Held: +1 Attack and Overrun', { target: T.friend(1), held: { attack: 1, keywords: ['Overrun'] } }),
  item('fire', 'f-choice-band', 'Choice Band', 'choice-band', 'Held', 2, 'Held: +3 Attack, −2 Strength (minimum 1)', { target: T.friend(1), held: { attack: 3, strength: -2 } }),
  item('fire', 'f-quick-claw', 'Quick Claw', 'quick-claw', 'Held', 1, 'Held: Speed one tier higher', { target: T.friend(1), held: { speedUp: 1 } }),
  item('water', 'w-mystic-water', 'Mystic Water', 'mystic-water', 'Held', 1, 'Held: +1 Attack; a Water Pokémon also gains +1 Strength', { target: T.friend(1), held: { attack: 1, typed: { type: 'Water', strength: 1 } } }),
  item('water', 'w-leftovers', 'Leftovers', 'leftovers', 'Held', 1, 'Held: Regenerate 1', { target: T.friend(1), held: { keywords: ['Regenerate 1'] } }),
  item('water', 'w-rocky-helmet', 'Rocky Helmet', 'rocky-helmet', 'Held', 2, 'Held: Retaliate 2 (when the holder is attacked, the attacker takes 2)', { target: T.friend(1), held: { keywords: ['Retaliate 2'] } }),
  item('water', 'w-full-heal', 'Full Heal', 'full-heal', 'Consumed', 1, 'Cure a friendly Pokémon of all statuses and heal it 2. Retain', { target: T.friend(1), ops: [op('cure'), op('heal', 2)] }, { retain: true }),
  item('grass', 'g-miracle-seed', 'Miracle Seed', 'miracle-seed', 'Held', 1, 'Held: +1 Attack; a Grass Pokémon also gains Regenerate 1', { target: T.friend(1), held: { attack: 1, typed: { type: 'Grass', keywords: ['Regenerate 1'] } } }),
  item('grass', 'g-big-root', 'Big Root', 'big-root', 'Held', 2, 'Held: healing the holder receives is +1; your Leech Seeds heal the holder first', { target: T.friend(1), held: { keywords: ['Big Root'] } }),
  item('grass', 'g-rare-candy', 'Rare Candy', 'rare-candy', 'Consumed', 2, 'Train 2 a friendly Pokémon', { target: T.friend(1, { filter: 'canTrain' }), ops: [op('train', 2)] }),
  item('grass', 'g-oran-berry', 'Oran Berry', 'oran-berry', 'Consumed', 1, 'Heal a friendly Pokémon 3 and Douse it, or Douse your player character; a Grass Pokémon also gives 1 Growth. Retain',
    { target: T.friendOrMe(1), ops: [op('heal', 3), op('douse'), op('growthIfType', 1, { type: 'Grass' })] }, { retain: true }),
];

// The shared Item pool (found at Locations): one copy of each. Cost 0 (they're never in a deck).
export const POOL_ITEMS = [
  item('pool', 'p-potion', 'Potion', 'potion', 'Consumed', 0, 'Heal a friendly Pokémon 3', { target: T.friend(1, { filter: 'damaged' }), ops: [op('heal', 3)] }),
  item('pool', 'p-super-potion', 'Super Potion', null, 'Consumed', 0, 'Heal a friendly Pokémon 5 and Douse it', { target: T.friend(1), ops: [op('heal', 5), op('douse')] }),
  item('pool', 'p-full-heal', 'Full Heal', 'full-heal', 'Consumed', 0, 'Cure a friendly Pokémon, or your player character, of all statuses', { target: T.friendOrMe(1), ops: [op('cure')] }),
  item('pool', 'p-revive', 'Revive', null, 'Consumed', 0, 'Return a Pokémon from your Discard Pile to your hand; it gains Retain', { ops: [op('returnFromDiscard', undefined, { filter: 'pokemon', retain: true })], needs: 'returnFromDiscard' }),
  item('pool', 'p-x-attack', 'X Attack', 'x-attack', 'Consumed', 0, 'A friendly Pokémon gains +2 Attack this Round', { target: T.friend(1), ops: [op('buff', undefined, { attack: 2 })] }),
  item('pool', 'p-ether', 'Ether', null, 'Consumed', 0, '+1 Energy now', { ops: [op('energy', 1)] }),
  item('pool', 'p-escape-rope', 'Escape Rope', null, 'Consumed', 0, 'Move a friendly Pokémon to an empty space of yours (another lane or Location)', { target: T.friend(1), ops: [op('moveTo')], needs: 'freeSpace' }),
  item('pool', 'p-exp-share', 'Exp. Share', null, 'Consumed', 0, 'Gain 1 Trainer Point', { ops: [op('trainerPoint', 1)] }),
  item('pool', 'p-amulet-coin', 'Amulet Coin', 'amulet-coin', 'Consumed', 0, 'Gain 2 Recognition', { ops: [op('recognition', 2)] }),
  item('pool', 'p-quick-claw', 'Quick Claw', 'quick-claw', 'Held', 0, 'Held: Speed one tier higher', { target: T.friend(1), held: { speedUp: 1 } }),
  item('pool', 'p-leftovers', 'Leftovers', 'leftovers', 'Held', 0, 'Held: Regenerate 1', { target: T.friend(1), held: { keywords: ['Regenerate 1'] } }),
  item('pool', 'p-rocky-helmet', 'Rocky Helmet', 'rocky-helmet', 'Held', 0, 'Held: Retaliate 2', { target: T.friend(1), held: { keywords: ['Retaliate 2'] } }),
];

// --- Locations ---------------------------------------------------------------------------------
const loc = (deck, id, name, art, lanes, rounds, weather, color, objective, milestones, completion) => ({
  id, name, cardType: 'Location', rarity: 'Common', art, deck, cost: 0, lanes, rounds, weather, color, objective, milestones, completion,
});
const ms = (at, reward) => ({ at, reward });
export const DECK_LOCATIONS = [
  loc('fire', 'f-mt-ember', 'Mt. Ember', 'mt-ember', 2, 3, { Sun: 2 }, '#f08a3a', { kind: 'attack', count: 4, text: 'Attack 4 times from this Location' },
    [ms(2, { recognition: 2 })], { recognition: 3, trainerPoints: 1 }),
  loc('fire', 'f-cinnabar-volcano', 'Cinnabar Volcano', 'cinnabar-volcano', 1, 3, { Sun: 2 }, '#e0503a', { kind: 'damage', count: 6, text: 'Deal 6 damage to the enemy player from this Location' },
    [ms(3, { energy: 1 })], { recognition: 3, item: 1 }),
  loc('fire', 'f-stark-mountain', 'Stark Mountain', 'stark-mountain', 3, 4, { Sun: 3 }, '#c8603a', { kind: 'defeat', count: 3, text: 'Defeat 3 enemy Pokémon from this Location' },
    [ms(1, { recognition: 2 }), ms(2, { trainerPoints: 1 })], { recognition: 5 }),
  loc('water', 'w-cerulean-cape', 'Cerulean Cape', 'cerulean-cape', 2, 3, { Rain: 2 }, '#4a9ae8', { kind: 'summon', count: 3, text: 'Summon 3 Pokémon into this Location' },
    [ms(2, { energy: 1 })], { recognition: 3, trainerPoints: 1 }),
  loc('water', 'w-lake-of-rage', 'Lake of Rage', 'lake-of-rage', 2, 4, { Rain: 2 }, '#3a7ac8', { kind: 'presence', count: 3, text: 'Have 3 Pokémon in this Location at Supper' },
    [ms(2, { recognition: 2 })], { recognition: 4, item: 1 }),
  loc('water', 'w-route-119', 'Route 119', 'route-119', 3, 4, { Rain: 3 }, '#3ab0c8', { kind: 'attack', count: 5, text: 'Attack 5 times from this Location' },
    [ms(2, { recognition: 2 }), ms(4, { trainerPoints: 1 })], { recognition: 5 }),
  loc('grass', 'g-floaroma-meadow', 'Floaroma Meadow', 'floaroma-meadow', 2, 3, { Rain: 2 }, '#e88ac0', { kind: 'presence', count: 3, text: 'Have 3 Pokémon in this Location at Supper' },
    [ms(2, { healHere: 2 })], { recognition: 3, trainerPoints: 1 }),
  loc('grass', 'g-eterna-forest', 'Eterna Forest', 'eterna-forest', 3, 4, { Rain: 1, Sun: 1 }, '#5ec45a', { kind: 'summon', count: 4, text: 'Summon 4 Pokémon into this Location' },
    [ms(2, { draw: 1 }), ms(3, { item: 1 })], { recognition: 4 }),
  loc('grass', 'g-petalburg-woods', 'Petalburg Woods', 'petalburg-woods', 2, 4, { Rain: 2 }, '#7ab04a', { kind: 'defeat', count: 2, text: 'Defeat 2 enemy Pokémon from this Location' },
    [ms(1, { trainerPoints: 1 })], { recognition: 4, item: 1 }),
];

// --- The decks: 40 cards each (17 Pokémon, 8 Strategy, 4 Supporters, 3 Trainers, 4 Locations, 4 Items) --
const mon = (series, n) => {
  const s = DECK_SERIES.find((l) => l.id === series);
  return Array.from({ length: n }, () => (s.legendary ? { series } : { series, cap: s.cap }));
};
const cards = (id, n = 1) => Array.from({ length: n }, () => ({ card: id }));
const locs = (id, n = 1) => Array.from({ length: n }, () => ({ location: id }));

export const DECKS = {
  fire: {
    name: 'Fire', plan: 'fire', description: 'Burn · Aggressive: races Recognition and Burns the enemy player.',
    list: [
      ...mon('f-growlithe', 3), ...mon('f-ponyta', 3), ...mon('f-mankey', 2), ...mon('f-houndour', 2), ...mon('f-magby', 2),
      ...mon('f-sneasel', 1), ...mon('f-charmander', 1), ...mon('f-duskull', 1), ...mon('f-absol', 1), ...mon('f-entei', 1),
      ...cards('f-ember', 3), ...cards('f-flame-charge', 2), ...cards('f-heat-wave'), ...cards('f-fire-blast'), ...cards('f-hyper-voice'),
      ...cards('f-firebreather', 2), ...cards('f-chili'), ...cards('f-burglar'),
      ...cards('f-blaine'), ...cards('f-flannery'), ...cards('f-kabu'),
      ...locs('f-mt-ember', 2), ...locs('f-cinnabar-volcano'), ...locs('f-stark-mountain'),
      ...cards('f-charcoal'), ...cards('f-black-belt'), ...cards('f-choice-band'), ...cards('f-quick-claw'),
    ],
  },
  water: {
    name: 'Water', plan: 'water', description: 'Value-Midrange · Board-Based: holds Locations and builds toward the Championship.',
    list: [
      ...mon('w-squirtle', 3), ...mon('w-horsea', 2), ...mon('w-magikarp', 2), ...mon('w-wooper', 2), ...mon('w-chinchou', 2),
      ...mon('w-wingull', 2), ...mon('w-eevee', 1), ...mon('w-happiny', 1), ...mon('w-dratini', 1), ...mon('w-kyogre', 1),
      ...cards('w-aqua-ring', 2), ...cards('w-bubble-beam', 2), ...cards('w-dive'), ...cards('w-surf'), ...cards('w-hydro-pump'), ...cards('w-thunderbolt'),
      ...cards('w-nurse-joy'), ...cards('w-swimmer'), ...cards('w-fisherman'), ...cards('w-tracey'),
      ...cards('w-misty'), ...cards('w-crasher-wake'), ...cards('w-wallace'),
      ...locs('w-cerulean-cape', 2), ...locs('w-lake-of-rage'), ...locs('w-route-119'),
      ...cards('w-mystic-water'), ...cards('w-leftovers'), ...cards('w-rocky-helmet'), ...cards('w-full-heal'),
    ],
  },
  grass: {
    name: 'Grass', plan: 'grass', description: 'Engine · Combo: builds Growth, Nurtures and finishes with Solar Beam.',
    list: [
      ...mon('g-bulbasaur', 3), ...mon('g-oddish', 3), ...mon('g-sunkern', 3), ...mon('g-sewaddle', 3), ...mon('g-eevee', 1),
      ...mon('g-caterpie', 1), ...mon('g-geodude', 1), ...mon('g-bonsly', 1), ...mon('g-celebi', 1),
      ...cards('g-leech-seed', 2), ...cards('g-sleep-powder'), ...cards('g-synthesis', 2), ...cards('g-solar-beam', 2), ...cards('g-rock-slide'),
      ...cards('g-mallow'), ...cards('g-pokemon-breeder'), ...cards('g-professor-oak'), ...cards('g-brock'),
      ...cards('g-erika'), ...cards('g-gardenia'), ...cards('g-ramos'),
      ...locs('g-floaroma-meadow', 2), ...locs('g-eterna-forest'), ...locs('g-petalburg-woods'),
      ...cards('g-miracle-seed'), ...cards('g-big-root'), ...cards('g-rare-candy'), ...cards('g-oran-berry'),
    ],
  },
};
export const DECK_NAMES = Object.keys(DECKS);
