// V3 — Pokémon Training series (docs/v2-design.md 4, 6.1, 7a). Data only.
//
// Each Pokémon is a series: one entry per species line, with every Level's stats,
// species name, ability and art. Three-stage lines evolve every 2 Levels (Horsea
// L1–2, Seadra L3–4, Kingdra L5–6); two-stage lines every 3 (Growlithe L1–3,
// Arcanine L4–6); single-stage Pokémon train L1–6 without evolving. Level 7 is for
// Legendaries only (and is never reached by training on the board).
//
// A line:
//   id, rarity (its copy slots), type, attackType, strengthType, speed, weight
//   (cost curve shift), retain?, legendary?
//   stages   [{ name, from, to, art }]  art: an assets/cards/<art>.jpg, or null when
//            that stage has no art yet (it falls back to the line's base art)
//   stats    [[attack, strength], …] one per Level, from Level 1
//   keywords (level) → the keywords at that Level (Infiltrator, Quick Attack)
//   ability  (level) → { text, onSummon: [effect ops] } or null: its strength per Level
//   empower? { cost, attack, strength, keywords, text }: the optional Empowered
//            summon (pay `cost` more Energy when summoning for the bonus)
//
// Effect ops (V3): { op: 'train', amount, target: 'lowestOther' }: raise a played
// Pokémon's Level by `amount`, up to its cap (see game.js train()).
//
// Test series (V3): the Horsea, Growlithe and Oddish lines, Chansey and Kyogre (asked
// for), plus the other V1/V2 test Pokémon turned into lines to fill the test deck.
// Every number is a test value; v1's art is used, and missing stages fall back.

import { costFor, MAX_LEVEL, LEGENDARY_LEVEL } from './rules.js';

const none = () => [];

function line(spec) {
  const top = spec.legendary ? LEGENDARY_LEVEL : MAX_LEVEL;
  if (spec.stats.length !== top) throw new Error(`${spec.id}: needs stats for Levels 1–${top}`);
  return {
    weight: 'standard', keywords: none, ability: () => null, art: spec.stages[0].art, ...spec,
    stageKind: spec.legendary ? 'Legendary' : spec.stages.length === 1 ? 'Single-stage' : `${spec.stages.length}-stage`,
    maxLevel: top,
  };
}

// Stages by evolution pattern.
const three = (a, b, c) => [{ ...a, from: 1, to: 2 }, { ...b, from: 3, to: 4 }, { ...c, from: 5, to: 6 }];
const two = (a, b) => [{ ...a, from: 1, to: 3 }, { ...b, from: 4, to: 6 }];
const single = (a, top = MAX_LEVEL) => [{ ...a, from: 1, to: top }];

export const SERIES = [
  // --- Asked for in V3 -------------------------------------------------------------------------
  line({
    id: 'horsea', rarity: 'Common', type: 'Water', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady',
    stages: three({ name: 'Horsea', art: 'horsea' }, { name: 'Seadra', art: null }, { name: 'Kingdra', art: null }),
    stats: [[2, 4], [3, 5], [4, 6], [4, 7], [6, 8], [7, 9]],
  }),
  line({
    id: 'growlithe', rarity: 'Common', type: 'Fire', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift',
    stages: two({ name: 'Growlithe', art: 'growlithe' }, { name: 'Arcanine', art: 'arcanine' }),
    stats: [[3, 3], [3, 4], [4, 4], [5, 6], [6, 6], [7, 7]],
    empower: { cost: 2, attack: 2, strength: 2, keywords: ['Quick Attack'], text: '+2: +2/+2 and Quick Attack' },
  }),
  line({
    id: 'oddish', rarity: 'Common', type: 'Grass', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', weight: 'light', retain: true,
    stages: three({ name: 'Oddish', art: 'oddish' }, { name: 'Gloom', art: 'gloom' }, { name: 'Vileplume', art: null }),
    stats: [[2, 4], [2, 5], [3, 6], [4, 6], [5, 7], [5, 8]],
  }),
  line({
    id: 'chansey', rarity: 'Rare', type: 'Normal', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Slow', weight: 'heavy',
    stages: single({ name: 'Chansey', art: 'chansey' }),
    stats: [[1, 5], [1, 6], [2, 7], [2, 8], [3, 9], [3, 10]],
    // The test card for "train N": its strength grows with its Level.
    ability: (level) => {
      const amount = level >= 4 ? 2 : 1;
      return { text: `On summon: train ${amount} your lowest-Level Pokémon`, onSummon: [{ op: 'train', amount, target: 'lowestOther' }] };
    },
  }),
  line({
    id: 'kyogre', rarity: 'Legendary', type: 'Water', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady', weight: 'heavy', legendary: true,
    stages: single({ name: 'Kyogre', art: 'kyogre' }, LEGENDARY_LEVEL),
    stats: [[3, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 10], [10, 12]],
    empower: { cost: 2, attack: 2, strength: 2, keywords: [], text: '+2: +2/+2' },
  }),
  // --- The other test Pokémon, as lines ------------------------------------------------------------
  line({
    id: 'charmander', rarity: 'Common', type: 'Fire', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady',
    stages: three({ name: 'Charmander', art: 'charmander' }, { name: 'Charmeleon', art: null }, { name: 'Charizard', art: null }),
    stats: [[3, 3], [3, 4], [4, 5], [5, 5], [6, 7], [7, 8]],
  }),
  line({
    id: 'bulbasaur', rarity: 'Common', type: 'Grass', attackType: 'Special', strengthType: 'Special Defence', speed: 'Steady',
    stages: three({ name: 'Bulbasaur', art: 'bulbasaur' }, { name: 'Ivysaur', art: 'ivysaur' }, { name: 'Venusaur', art: 'venusaur' }),
    stats: [[2, 5], [2, 6], [3, 6], [3, 7], [4, 8], [5, 9]],
  }),
  line({
    id: 'goldeen', rarity: 'Common', type: 'Water', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Steady',
    stages: two({ name: 'Goldeen', art: 'goldeen' }, { name: 'Seaking', art: null }),
    stats: [[3, 4], [4, 4], [4, 5], [5, 6], [6, 6], [6, 7]],
  }),
  line({
    id: 'ponyta', rarity: 'Common', type: 'Fire', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift',
    stages: two({ name: 'Ponyta', art: 'ponyta' }, { name: 'Rapidash', art: null }),
    stats: [[2, 3], [3, 4], [3, 4], [4, 5], [5, 5], [6, 6]],
    keywords: () => ['Infiltrator'],
    empower: { cost: 1, attack: 0, strength: 0, keywords: ['Quick Attack'], text: '+1: Quick Attack' },
  }),
  line({
    id: 'chinchou', rarity: 'Common', type: 'Electric', attackType: 'Special', strengthType: 'Special Defence', speed: 'Steady',
    stages: two({ name: 'Chinchou', art: 'chinchou' }, { name: 'Lanturn', art: null }),
    stats: [[2, 4], [3, 5], [3, 5], [4, 6], [4, 7], [5, 8]],
  }),
  line({
    id: 'wooper', rarity: 'Common', type: 'Water', attackType: 'Physical', strengthType: 'Defence', speed: 'Slow', weight: 'heavy',
    stages: two({ name: 'Wooper', art: null }, { name: 'Quagsire', art: 'quagsire' }),
    art: 'quagsire',   // the line's base art: Wooper has none yet
    stats: [[2, 5], [2, 6], [3, 6], [4, 7], [4, 8], [5, 9]],
  }),
  line({
    id: 'sudowoodo', rarity: 'Common', type: 'Rock', attackType: 'Physical', strengthType: 'Defence', speed: 'Slow', weight: 'heavy',
    stages: single({ name: 'Sudowoodo', art: 'sudowoodo' }),
    stats: [[2, 6], [2, 7], [3, 7], [3, 8], [4, 9], [4, 10]],
  }),
  line({
    id: 'sneasel', rarity: 'Common', type: 'Dark', attackType: 'Physical', strengthType: 'Hitpoints', speed: 'Swift',
    stages: single({ name: 'Sneasel', art: 'sneasel' }),
    stats: [[2, 3], [3, 3], [3, 4], [4, 4], [5, 5], [5, 6]],
    keywords: () => ['Infiltrator'],
  }),
  line({
    id: 'magmar', rarity: 'Rare', type: 'Fire', attackType: 'Special', strengthType: 'Hitpoints', speed: 'Steady',
    stages: single({ name: 'Magmar', art: 'magmar' }),
    stats: [[2, 4], [3, 4], [4, 5], [5, 6], [5, 7], [6, 7]],
  }),
];

export function seriesDef(id) {
  const s = SERIES.find((l) => l.id === id);
  if (!s) throw new Error(`Unknown series: ${id}`);
  return s;
}

export const stageAt = (line, level) => line.stages.find((st) => level >= st.from && level <= st.to);
// The art for a Level: its stage's own, or the line's base art.
export const artFor = (line, level) => stageAt(line, level).art ?? line.art;
export const stageIndex = (line, level) => line.stages.indexOf(stageAt(line, level));

// A card of this series at a Level: everything the engine and screen read.
export function pokemonAt(seriesId, level) {
  const line = typeof seriesId === 'string' ? seriesDef(seriesId) : seriesId;
  if (!(level >= 1 && level <= line.maxLevel)) throw new Error(`${line.id} has no Level ${level}`);
  const stage = stageAt(line, level);
  const [attack, strength] = line.stats[level - 1];
  return {
    id: slug(stage.name), name: stage.name, cardType: 'Pokémon', series: line.id, level, stage: stageIndex(line, level),
    art: artFor(line, level), cost: costFor(level, line.weight), weight: line.weight, rarity: line.rarity,
    type: line.type, attack, attackType: line.attackType, strength, strengthType: line.strengthType, speed: line.speed,
    keywords: [...line.keywords(level)], ability: line.ability(level), empower: line.empower ?? null,
    retain: !!line.retain, legendary: !!line.legendary,
  };
}

// The species at each Level, e.g. Horsea L1–2 · Seadra L3–4 · Kingdra L5–6.
export const stagesText = (line) => line.stages.map((st) => `${st.name} L${st.from}${st.to > st.from ? `–${st.to}` : ''}`).join(' · ');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
