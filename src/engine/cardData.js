// Card definitions, as plain data. Real cards replace the placeholders here
// without code changes. Field values must come from the lists below.

export const POKEMON_TYPES = [
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];
export const ATTACK_TYPES = ['Physical', 'Special'];
export const STRENGTH_TYPES = ['Hitpoints', 'Defence', 'Special Defence'];
export const SPEED_TIERS = ['Slow', 'Steady', 'Swift'];
// Rarity-Tier → border colour.
export const RARITIES = {
  Common: 'grey',
  Uncommon: 'green',
  Rare: 'blue',
  Epic: 'purple',
  Legendary: 'orange',
};

// Shorthand for the placeholder list below. Optional fields default to null.
function pokemon(name, energyCost, pokemonType, attackType, attackValue, strengthType, strengthValue, speedTier, rarity, extras = {}) {
  return {
    id: name.toLowerCase(),
    name,
    cardType: 'Pokémon',
    energyCost,
    pokemonType,
    image: null,              // placeholder until card art arrives
    attackType,
    attackValue,
    strengthType,
    strengthValue,
    speedTier,
    effectTrigger: null,
    effectText: null,
    rarity,
    innatePower: null,
    weatherToken: null,
    ...extras,
  };
}

// Placeholder effect text: display only, implies no rules.
const SAMPLE_EFFECT = { effectTrigger: 'Placeholder', effectText: 'Sample effect text. Does nothing yet.' };
const SAMPLE_POWER = { innatePower: 'Placeholder Power' };
const SAMPLE_WEATHER = { weatherToken: 'Placeholder Weather' };

// PLACEHOLDER Pokémon: invented names and stats (Cost 1–6, Attack 1–6, Strength 2–10).
export const POKEMON_CARDS = [
  pokemon('Emberkit',   1, 'Fire',     'Physical', 2, 'Hitpoints',       3,  'Swift',  'Common'),
  pokemon('Puddlop',    1, 'Water',    'Special',  1, 'Hitpoints',       4,  'Steady', 'Common'),
  pokemon('Sproutle',   1, 'Grass',    'Physical', 1, 'Defence',         4,  'Slow',   'Common', SAMPLE_EFFECT),
  pokemon('Zappip',     1, 'Electric', 'Special',  2, 'Special Defence', 2,  'Swift',  'Common'),
  pokemon('Pebblet',    2, 'Rock',     'Physical', 2, 'Defence',         5,  'Slow',   'Common'),
  pokemon('Gustling',   2, 'Flying',   'Physical', 3, 'Hitpoints',       3,  'Swift',  'Uncommon', SAMPLE_WEATHER),
  pokemon('Mothdust',   2, 'Bug',      'Special',  2, 'Special Defence', 4,  'Steady', 'Uncommon'),
  pokemon('Frostail',   3, 'Ice',      'Special',  3, 'Special Defence', 5,  'Steady', 'Uncommon', SAMPLE_EFFECT),
  pokemon('Brawlix',    3, 'Fighting', 'Physical', 4, 'Hitpoints',       5,  'Steady', 'Uncommon'),
  pokemon('Toxifin',    3, 'Poison',   'Special',  3, 'Defence',         6,  'Slow',   'Rare', SAMPLE_POWER),
  pokemon('Shadepup',   4, 'Ghost',    'Special',  4, 'Special Defence', 6,  'Swift',  'Rare', SAMPLE_EFFECT),
  pokemon('Ironhorn',   4, 'Steel',    'Physical', 3, 'Defence',         8,  'Slow',   'Rare'),
  pokemon('Glimmeria',  5, 'Fairy',    'Special',  5, 'Special Defence', 7,  'Steady', 'Epic', { ...SAMPLE_POWER, ...SAMPLE_WEATHER }),
  pokemon('Duskfang',   5, 'Dark',     'Physical', 5, 'Hitpoints',       7,  'Swift',  'Epic', SAMPLE_EFFECT),
  pokemon('Quakemaw',   6, 'Ground',   'Physical', 6, 'Defence',         10, 'Slow',   'Legendary', { ...SAMPLE_EFFECT, ...SAMPLE_POWER }),
  pokemon('Mindrake',   6, 'Dragon',   'Special',  6, 'Hitpoints',       9,  'Steady', 'Legendary', SAMPLE_WEATHER),
];

// PLACEHOLDER non-Pokémon cards: name and Card-Type only, for now.
export const OTHER_CARDS = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `strategy-${i + 1}`, name: `Strategy ${i + 1}`, cardType: 'Strategy' })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}`, cardType: 'Item' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `location-${i + 1}`, name: `Location ${i + 1}`, cardType: 'Location' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `supporter-${i + 1}`, name: `Supporter ${i + 1}`, cardType: 'Supporter' })),
];

// Each deck: card id → number of copies. PLACEHOLDER: one of every card above.
export const PLACEHOLDER_DECKLIST = Object.fromEntries(
  [...POKEMON_CARDS, ...OTHER_CARDS].map((c) => [c.id, 1]),
);
