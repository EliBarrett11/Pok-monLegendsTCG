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
    effectTrigger: null,   // Trigger Word of its ability, if any
    effectText: null,
    ability: null,         // the ability as data: { on, match, effects }
    rarity,
    innatePower: null,
    weatherTokens: null,   // e.g. { Sun: 1 }: counted while it is in the arena
    ...extras,
  };
}

const QUICK_ATTACK = { innatePower: 'Quick Attack' };
const AGILITY = { innatePower: 'Agility' };
const ONE_SUN = { weatherTokens: { Sun: 1 } };

// Innate Powers: keywords the rules check directly (see effects.js).
export const INNATE_POWERS = {
  'Quick Attack': 'This Pokémon is summoned Active instead of Spent.',
  Agility: "This Pokémon can't be chosen as a target by Strategy Cards. Area effects still affect it.",
};

// Effect Trigger Words → the event a Pokémon ability listens for (effects.js).
export const TRIGGER_WORDS = {
  'On Summon': 'summon',       // enters the arena: played, or summoned by an effect
  'On Attack': 'attack',       // after its attack deals damage, if still in the arena
  'On Defend': 'defend',       // after it is attacked by a Command and takes damage, if still in the arena
  'On Defeated': 'defeated',   // when defeated by any cause, as it goes to the Released Pile
  'On Breakfast': 'breakfast', // each Breakfast, after cards are drawn and Energy is gained
  'On Supper': 'supper',       // each Supper, before hands are discarded
};

// A Pokémon ability: Trigger Word + Effect Text (shown) + effects (data).
function ability(word, effectText, effects, match = {}) {
  return { effectTrigger: word, effectText, ability: { on: TRIGGER_WORDS[word], match: { self: true, ...match }, effects } };
}

// PLACEHOLDER abilities, each on 2–3 placeholder Pokémon.
const SUMMON_STRIKE = ability('On Summon', "Deal 1 damage to an opponent Pokémon in this Pokémon's Zone.", [
  { op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent', zone: 'source' } },
]);
const TRAINER_HUNTER = ability('On Attack', 'If this Pokémon attacked a Trainer, draw 1 card.', [
  { op: 'draw', amount: 1 },
], { targetKind: 'trainer' });
const COUNTER = ability('On Defend', 'Deal 1 damage to the attacker.', [
  { op: 'damage', amount: 1, target: { mode: 'event', role: 'attacker' } },
]);
const LAST_GIFT = ability('On Defeated', "Heal the friendly Trainer in this Pokémon's Zone 3 Strength.", [
  { op: 'heal', amount: 3, target: { mode: 'area', side: 'friendly', kinds: ['trainer'], zone: 'source', damaged: true } },
]);
const EARLY_RISER = ability('On Breakfast', 'Gain 1 extra Base Energy this Round.', [
  { op: 'gainEnergy', amount: 1 },
]);

// PLACEHOLDER Pokémon: invented names and stats (Cost 1–6, Attack 1–6, Strength 2–10).
export const POKEMON_CARDS = [
  pokemon('Emberkit',   1, 'Fire',     'Physical', 2, 'Hitpoints',       3,  'Swift',  'Common', SUMMON_STRIKE),
  pokemon('Puddlop',    1, 'Water',    'Special',  1, 'Hitpoints',       4,  'Steady', 'Common', LAST_GIFT),
  pokemon('Sproutle',   1, 'Grass',    'Physical', 1, 'Defence',         4,  'Slow',   'Common', COUNTER),
  pokemon('Zappip',     1, 'Electric', 'Special',  2, 'Special Defence', 2,  'Swift',  'Common', QUICK_ATTACK),
  pokemon('Pebblet',    2, 'Rock',     'Physical', 2, 'Defence',         5,  'Slow',   'Common', COUNTER),
  pokemon('Gustling',   2, 'Flying',   'Physical', 3, 'Hitpoints',       3,  'Swift',  'Uncommon', { ...AGILITY, ...TRAINER_HUNTER }),
  pokemon('Mothdust',   2, 'Bug',      'Special',  2, 'Special Defence', 4,  'Steady', 'Uncommon', LAST_GIFT),
  pokemon('Frostail',   3, 'Water',    'Special',  3, 'Special Defence', 5,  'Steady', 'Uncommon', EARLY_RISER),
  pokemon('Brawlix',    3, 'Fire',     'Physical', 4, 'Hitpoints',       5,  'Steady', 'Uncommon', QUICK_ATTACK),
  pokemon('Toxifin',    3, 'Water',    'Special',  3, 'Defence',         6,  'Slow',   'Rare', LAST_GIFT),
  pokemon('Shadepup',   4, 'Ghost',    'Special',  4, 'Special Defence', 6,  'Swift',  'Rare', { ...AGILITY, ...SUMMON_STRIKE }),
  pokemon('Ironhorn',   4, 'Steel',    'Physical', 3, 'Defence',         8,  'Slow',   'Rare', COUNTER),
  pokemon('Glimmeria',  5, 'Fairy',    'Special',  5, 'Special Defence', 7,  'Steady', 'Epic', { ...AGILITY, ...ONE_SUN, ...EARLY_RISER }),
  pokemon('Duskfang',   5, 'Dark',     'Physical', 5, 'Hitpoints',       7,  'Swift',  'Epic', { ...QUICK_ATTACK, ...TRAINER_HUNTER }),
  pokemon('Quakemaw',   6, 'Fire',     'Physical', 6, 'Defence',         10, 'Slow',   'Legendary', SUMMON_STRIKE),
  pokemon('Mindrake',   6, 'Dragon',   'Special',  6, 'Hitpoints',       9,  'Steady', 'Legendary'),
];

// --- Trainers ---------------------------------------------------------------
//
// Powers and Passives are written in the effect language from effects.js:
//   power:   { cost, text, effects: [effect, ...] }
//   passive: { text, aura?: { attack, strength, target }, triggers?: [{ on, match, effects }] }
// "source" zone = the Trainer's own Zone (both sides of the arena).

// PLACEHOLDER Trainers: both players use these three for now.
export const TRAINER_CARDS = [
  {
    id: 'ash',
    name: 'Ash',
    cardType: 'Trainer',
    strength: 15,
    power: {
      cost: 1,
      text: 'Draw 1 card. If it is a 1-cost Pokémon, you may summon it immediately without paying its cost.',
      effects: [
        { op: 'draw', amount: 1 },
        { op: 'mayPlayFree', filter: { cardType: 'Pokémon', energyCost: 1 } },
      ],
    },
    passive: {
      text: "Friendly Pokémon in Ash's Zone gain +1/+1.",
      aura: { attack: 1, strength: 1, target: { side: 'friendly', zone: 'source' } },
    },
  },
  {
    id: 'misty',
    name: 'Misty',
    cardType: 'Trainer',
    strength: 15,
    power: {
      cost: 1,
      text: "Deal 1 damage to an opponent Pokémon in Misty's Zone.",
      effects: [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent', zone: 'source' } }],
    },
    passive: {
      text: "Friendly Water Pokémon in Misty's Zone gain +3 Strength.",
      aura: { attack: 0, strength: 3, target: { side: 'friendly', zone: 'source', filter: { pokemonType: 'Water' } } },
    },
  },
  {
    id: 'brock',
    name: 'Brock',
    cardType: 'Trainer',
    strength: 15,
    power: {
      cost: 1,
      text: 'Give a friendly Pokémon +2 Defence.',
      effects: [{ op: 'buff', strength: 2, strengthType: 'Defence', target: { mode: 'targeted', side: 'friendly' } }],
    },
    passive: {
      text: "Opponent Pokémon summoned to Brock's Zone take 1 damage.",
      triggers: [{
        on: 'summon',
        match: { side: 'opponent', zone: 'source' },
        effects: [{ op: 'damage', amount: 1, target: { mode: 'event' } }],
      }],
    },
  },
];

// --- Strategy Cards ---------------------------------------------------------
//
// Played as a Battle Action for their Energy Cost; the effect resolves, then
// the card goes to the Discard Pile. `effects` uses the language in effects.js.

function strategy(name, energyCost, rarity, effectText, effects) {
  return { id: name.toLowerCase(), name, cardType: 'Strategy', energyCost, image: null, effectText, rarity, effects };
}

export const STRATEGY_CARDS = [
  strategy('Quickdraw', 1, 'Common', 'Draw 2 cards.', [{ op: 'draw', amount: 2 }]),
  strategy('Hypervoice', 3, 'Uncommon', 'Deal 2 damage to all opponent Pokémon.', [
    { op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent' } },
  ]),
  strategy('Recover', 3, 'Rare', 'Heal 5 Strength to any target.', [
    { op: 'heal', amount: 5, target: { mode: 'targeted', side: 'any', kinds: ['pokemon', 'trainer'], damaged: true } },
  ]),
];

// --- Supporter Cards --------------------------------------------------------
//
// Played as a Battle Action for a Card-Cost: exactly `discard` cards to the
// Discard Pile and `release` cards to the Released Pile, from the hand (not
// the Supporter itself). If at least one paid card matches the Gift Bonus
// Challenge (any printed field; see matchesCard in effects.js), the Gift
// Bonus applies: `gift.effects` resolves instead of `effects`.

function supporter(name, rarity, cardCost, effectText, effects, gift) {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, cardType: 'Supporter', cardCost, image: null, effectText, rarity, effects, gift };
}

export const SUPPORTER_CARDS = [
  supporter('Field Researcher', 'Common', { discard: 1, release: 0 }, 'Draw 2 cards.', [
    { op: 'draw', amount: 2 },
  ], {
    challengeText: 'a Strategy Card',
    challenge: { cardType: 'Strategy' },
    bonusText: 'Draw 1 more card.',
    effects: [{ op: 'draw', amount: 3 }],
  }),
  supporter('Veteran Coach', 'Uncommon', { discard: 0, release: 1 }, 'Friendly Pokémon in a chosen Zone gain +1/+1.', [
    { op: 'buff', attack: 1, strength: 1, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } },
  ], {
    challengeText: 'a Swift-Tier Pokémon',
    challenge: { cardType: 'Pokémon', speedTier: 'Swift' },
    bonusText: '+2/+2 instead.',
    effects: [{ op: 'buff', attack: 2, strength: 2, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } }],
  }),
  supporter('Field Medic', 'Rare', { discard: 1, release: 1 }, 'Heal a friendly Trainer 4 Strength.', [
    { op: 'heal', amount: 4, target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'], damaged: true } },
  ], {
    challengeText: 'a Water Pokémon',
    challenge: { cardType: 'Pokémon', pokemonType: 'Water' },
    bonusText: "Also heal all friendly Pokémon in that Trainer's Zone 2 Strength.",
    effects: [
      { op: 'heal', amount: 4, target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'], damaged: true } },
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', zone: 'target' } },
    ],
  }),
];

// --- Location Cards ---------------------------------------------------------
//
// Played as a Battle Action (no Energy) into the Location space of one of
// your zones. Its Weather Tokens count while it is in play. Its quest counts
// your own actions from the moment it is played:
//   quest: { text, label, on: 'summon' | 'attack' | 'power', filter?, inZone?, count }
//     filter  a card condition (matchesCard) on the summoned / attacking Pokémon
//     inZone  only events in this Location's zone (your side)
// When the quest is completed you gain `xp`, `effects` resolve (the
// Location's Zone is the source Zone), then the Location is Released.

export const WEATHER_TYPES = ['Rain', 'Sun'];

function location(name, rarity, weatherTokens, quest, xp, effectText, effects) {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, cardType: 'Location', image: null, weatherTokens, quest, xp, effectText, effects, rarity };
}

export const LOCATION_CARDS = [
  location('Tidal Cove', 'Common', { Rain: 2 },
    { text: 'Summon 2 Water Pokémon.', label: 'Water Pokémon summoned', on: 'summon', filter: { pokemonType: 'Water' }, count: 2 },
    2, 'Draw 2 cards.', [{ op: 'draw', amount: 2 }]),
  location('Sunbaked Plateau', 'Uncommon', { Sun: 2 },
    { text: 'Attack 3 times with Pokémon in this Zone.', label: 'Attacks', on: 'attack', inZone: true, count: 3 },
    3, 'Friendly Pokémon in this Zone gain +1 Attack.', [
      { op: 'buff', attack: 1, strength: 0, target: { mode: 'area', side: 'friendly', zone: 'source' } },
    ]),
  location('Old Training Hall', 'Uncommon', { Rain: 1, Sun: 1 },
    { text: 'Use 3 Trainer Powers.', label: 'Powers used', on: 'power', count: 3 },
    2, 'Heal all friendly Trainers 2 Strength.', [
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', kinds: ['trainer'], damaged: true } },
    ]),
];

// PLACEHOLDER non-Pokémon cards: name and Card-Type only, for now.
export const OTHER_CARDS = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}`, cardType: 'Item' })),
];

// Each deck: card id → number of copies. PLACEHOLDER: one of every card above.
export const PLACEHOLDER_DECKLIST = {
  ...Object.fromEntries([...POKEMON_CARDS, ...OTHER_CARDS].map((c) => [c.id, 1])),
  quickdraw: 3,
  hypervoice: 3,
  recover: 2,
  'field-researcher': 2,
  'veteran-coach': 1,
  'field-medic': 1,
  'tidal-cove': 2,
  'sunbaked-plateau': 1,
  'old-training-hall': 1,
};
