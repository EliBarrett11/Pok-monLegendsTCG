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

// Innate Powers: keywords the rules check directly (see keywords.js). A card
// can have several, e.g. innatePower: 'Overrun, Scorch 2'. X is the keyword's number.
export const INNATE_POWERS = {
  'Quick Attack': 'This Pokémon is summoned Active instead of Spent.',
  Agility: "This Pokémon can't be chosen as a target by Strategy Cards. Area effects still affect it.",
  Scorch: "When this Pokémon's attack deals damage, it also applies Burn X to the target (if it's still in play). Works on Trainers too.",
  Overrun: "When this Pokémon's attack defeats an enemy Pokémon, the damage left over is dealt to the enemy Trainer in that Zone (lost if that Trainer has been removed).",
  Regenerate: 'At each Breakfast, this Pokémon heals X.',
  Shell: 'Every instance of damage this Pokémon takes is reduced by X, to a minimum of 1. Includes Burn.',
};

// Effect Trigger Words → the event a Pokémon ability listens for (effects.js).
export const TRIGGER_WORDS = {
  'On Summon': 'summon',       // enters the arena: played, or summoned by an effect
  'On Attack': 'attack',       // after its attack deals damage, if still in the arena
  'On Defend': 'defend',       // after it is attacked by a Command and takes damage, if still in the arena
  'On Defeated': 'defeated',   // when defeated by any cause, as it goes to the Released Pile
  'On Breakfast': 'breakfast', // each Breakfast, after cards are drawn and Energy is gained
  'On Supper': 'supper',       // each Supper, after Burn, before "this Round" effects expire
  'On Knockout': 'knockout',   // damage dealt by this Pokémon (attack, trade, its own ability) defeats an enemy Pokémon
  'On Trainer Strike': 'trainerStrike', // this Pokémon damages an enemy Trainer (attack or Overrun)
  Rally: 'summon',             // another friendly Pokémon is summoned into this Pokémon's Zone (same side)
  'On Heal': 'heal',           // this Pokémon is healed by at least 1
};

// Which card of the event a Trigger Word listens for: this Pokémon itself,
// except Rally (another friendly Pokémon in its Zone).
export const TRIGGER_MATCH = {
  Rally: { side: 'friendly', zone: 'source', notSelf: true, kind: 'pokemon' },
};

// A Pokémon ability: Trigger Word + Effect Text (shown) + effects (data).
export function ability(word, effectText, effects, match = {}) {
  return { effectTrigger: word, effectText, ability: { on: TRIGGER_WORDS[word], match: { ...(TRIGGER_MATCH[word] ?? { self: true }), ...match }, effects } };
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

// PLACEHOLDER Pokémon: invented stats (Cost 1–6, Attack 2–7, Strength 4–12). Step 15 raised every one
// by +1 Attack and +2 Strength so Pokémon last longer.
export const POKEMON_CARDS = [
  pokemon('Growlithe',   1, 'Fire',     'Physical', 3, 'Hitpoints',       5,  'Swift',  'Common', SUMMON_STRIKE),
  pokemon('Horsea',    1, 'Water',    'Special',  2, 'Hitpoints',       6,  'Steady', 'Common', LAST_GIFT),
  pokemon('Sewaddle',   1, 'Grass',    'Physical', 2, 'Defence',         6,  'Slow',   'Common', COUNTER),
  pokemon('Shinx',     1, 'Electric', 'Special',  3, 'Special Defence', 4,  'Swift',  'Common', QUICK_ATTACK),
  pokemon('Geodude',    2, 'Rock',     'Physical', 3, 'Defence',         7,  'Slow',   'Common', COUNTER),
  pokemon('Pidgey',   2, 'Flying',   'Physical', 4, 'Hitpoints',       5,  'Swift',  'Uncommon', { ...AGILITY, ...TRAINER_HUNTER }),
  pokemon('Metapod',   2, 'Bug',      'Special',  3, 'Special Defence', 6,  'Steady', 'Uncommon', LAST_GIFT),
  pokemon('Goldeen',   3, 'Water',    'Special',  4, 'Special Defence', 7,  'Steady', 'Uncommon', EARLY_RISER),
  pokemon('Magmar',    3, 'Fire',     'Physical', 5, 'Hitpoints',       7,  'Steady', 'Uncommon', QUICK_ATTACK),
  pokemon('Quagsire',    3, 'Water',    'Special',  4, 'Defence',         8,  'Slow',   'Rare', LAST_GIFT),
  pokemon('Dusclops',   4, 'Ghost',    'Special',  5, 'Special Defence', 8,  'Swift',  'Rare', { ...AGILITY, ...SUMMON_STRIKE }),
  pokemon('Lairon',   4, 'Steel',    'Physical', 4, 'Defence',         10,  'Slow',   'Rare', COUNTER),
  pokemon('Sylveon',  5, 'Fairy',    'Special',  6, 'Special Defence', 9,  'Steady', 'Epic', { ...AGILITY, ...ONE_SUN, ...EARLY_RISER }),
  pokemon('Absol',   5, 'Dark',     'Physical', 6, 'Hitpoints',       9,  'Swift',  'Epic', { ...QUICK_ATTACK, ...TRAINER_HUNTER }),
  pokemon('Blaziken',   6, 'Fire',     'Physical', 7, 'Defence',         12, 'Slow',   'Legendary', SUMMON_STRIKE),
  pokemon('Dragonite',   6, 'Dragon',   'Special',  7, 'Hitpoints',       11,  'Steady', 'Legendary'),
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
  supporter('Tracey', 'Common', { discard: 1, release: 0 }, 'Draw 2 cards.', [
    { op: 'draw', amount: 2 },
  ], {
    challengeText: 'a Strategy Card',
    challenge: { cardType: 'Strategy' },
    bonusText: 'Draw 1 more card.',
    effects: [{ op: 'draw', amount: 3 }],
  }),
  supporter('Professor Oak', 'Uncommon', { discard: 0, release: 1 }, 'Friendly Pokémon in a chosen Zone gain +1/+1.', [
    { op: 'buff', attack: 1, strength: 1, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } },
  ], {
    challengeText: 'a Swift-Tier Pokémon',
    challenge: { cardType: 'Pokémon', speedTier: 'Swift' },
    bonusText: '+2/+2 instead.',
    effects: [{ op: 'buff', attack: 2, strength: 2, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } }],
  }),
  supporter('Mallow', 'Rare', { discard: 1, release: 1 }, 'Heal a friendly Trainer 4 Strength.', [
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
//   quest: { text, label, on, filter?, inZone?, count }
//     on      'summon' | 'attack' | 'power' (each one) · 'burn' (each card you burn) ·
//             'heal' (Strength healed on your cards) · 'trainerStrike' (your Pokémon damaging
//             an enemy Trainer) · 'defeat' (enemy Pokémon you defeat) · 'presence' (friendly
//             Pokémon in this Zone, checked at Supper)
//     filter  a card condition (matchesCard) on the summoned / attacking / defeated Pokémon
//     inZone  only events in this Location's zone (your side)
//   Trainer Passive cost reductions: passive.cost = { amount, first? } makes a
//   friendly Pokémon summoned into that Trainer's Zone cost `amount` less (only
//   the first one each Round with first: true; never below 0).
// When the quest is completed you gain `xp`, `effects` resolve (the
// Location's Zone is the source Zone), then the Location is Released.

// --- Weather ------------------------------------------------------------------
//
// Each Weather type has milestone brackets by combined token count (both
// players' cards). A bracket is active while the count is at or above `at`.
//   mode   'also' adds to the brackets before it; 'instead' replaces the
//          bracket just before it (and whatever that one replaced)
//   stats  continuous modifiers: [{ filter, attack?, strength? }] for every
//          matching Pokémon in the arena, both sides (like a Passive)
//   timed  [{ at: 'breakfast' | 'supper', effects }] resolving at that moment,
//          before Pokémon abilities that trigger then
// PLACEHOLDER Weather types.

const WATER = { pokemonType: 'Water' };
const FIRE = { pokemonType: 'Fire' };

export const WEATHER = {
  Rain: {
    icon: '☔',
    brackets: [
      { at: 2, mode: 'also', text: 'Water Pokémon gain +1 Attack.', stats: [{ filter: WATER, attack: 1 }] },
      { at: 4, mode: 'instead', text: 'Water Pokémon gain +1/+1 (instead).', stats: [{ filter: WATER, attack: 1, strength: 1 }] },
      { at: 6, mode: 'also', text: 'Fire Pokémon have −1 Attack.', stats: [{ filter: FIRE, attack: -1 }] },
      { at: 8, mode: 'also', text: 'At Supper, each Water Pokémon heals 2 Strength.', timed: [{
        at: 'supper', effects: [{ op: 'heal', amount: 2, target: { mode: 'area', side: 'any', filter: WATER, damaged: true } }],
      }] },
    ],
  },
  Sun: {
    icon: '☀',
    brackets: [
      { at: 2, mode: 'also', text: 'Fire Pokémon gain +1 Attack.', stats: [{ filter: FIRE, attack: 1 }] },
      { at: 4, mode: 'instead', text: 'Fire Pokémon gain +2 Attack (instead).', stats: [{ filter: FIRE, attack: 2 }] },
      { at: 6, mode: 'also', text: 'Water Pokémon have −1 Attack.', stats: [{ filter: WATER, attack: -1 }] },
      { at: 8, mode: 'also', text: 'At Breakfast, each non-Fire Pokémon takes 1 damage.', timed: [{
        at: 'breakfast', effects: [{ op: 'damage', amount: 1, target: { mode: 'area', side: 'any', filter: { pokemonType: { not: 'Fire' } } } }],
      }] },
    ],
  },
};

export const WEATHER_TYPES = Object.keys(WEATHER);

function location(name, rarity, weatherTokens, quest, xp, effectText, effects) {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, cardType: 'Location', image: null, weatherTokens, quest, xp, effectText, effects, rarity };
}

export const LOCATION_CARDS = [
  location('Cerulean Cape', 'Common', { Rain: 2 },
    { text: 'Summon 2 Water Pokémon.', label: 'Water Pokémon summoned', on: 'summon', filter: { pokemonType: 'Water' }, count: 2 },
    2, 'Draw 2 cards.', [{ op: 'draw', amount: 2 }]),
  location('Floaroma Meadow', 'Uncommon', { Sun: 2 },
    { text: 'Attack 3 times with Pokémon in this Zone.', label: 'Attacks', on: 'attack', inZone: true, count: 3 },
    3, 'Friendly Pokémon in this Zone gain +1 Attack.', [
      { op: 'buff', attack: 1, strength: 0, target: { mode: 'area', side: 'friendly', zone: 'source' } },
    ]),
  location('Shalour City', 'Uncommon', { Rain: 1, Sun: 1 },
    { text: 'Use 3 Trainer Powers.', label: 'Powers used', on: 'power', count: 3 },
    2, 'Heal all friendly Trainers 2 Strength.', [
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', kinds: ['trainer'], damaged: true } },
    ]),
];

// --- Item Cards -------------------------------------------------------------
//
// Bought with PokéDollars through the Open Bag Action, then used (or stored
// in the Bag and used later). `effects` resolve when it is used:
//   Held      attachHeld to a friendly Pokémon (arena or hand); `held` says
//             what the holder gets while it is in the arena:
//             { attack?, strength?, speedUp?, luckyCoin? }
//   Consumed  effects resolve, then the Item goes to the PokéMart

const FRIENDLY_POKEMON_ANYWHERE = { mode: 'targeted', side: 'friendly', kinds: ['pokemon', 'hand'] };

function item(name, itemType, cost, rarity, effectText, more) {
  const id = name.toLowerCase().replace(/\s+/g, '-');
  return { id, name, cardType: 'Item', itemType, cost, image: null, effectText, rarity, ...more };
}

function heldItem(name, cost, rarity, effectText, held) {
  return item(name, 'Held', cost, rarity, effectText, {
    held,
    effects: [{ op: 'attachHeld', target: FRIENDLY_POKEMON_ANYWHERE }],
  });
}

// PLACEHOLDER Items.
export const ITEM_CARDS = [
  heldItem('Black Belt', 3, 'Common', 'Holder gains +2 Attack.', { attack: 2 }),
  heldItem('Rocky Helmet', 3, 'Common', 'Holder gains +3 Strength.', { strength: 3 }),
  heldItem('Oran Berry', 4, 'Uncommon', "Holder's Speed-Tier is one higher (Slow → Steady → Swift).", { speedUp: 1 }),
  heldItem('Amulet Coin', 2, 'Uncommon', 'When the holder deals the damage that defeats an opponent Pokémon, gain 2 extra PokéDollars.', { luckyCoin: 2 }),
  item('Potion', 'Consumed', 2, 'Common', 'Heal a friendly Pokémon in the arena 4 Strength.', {
    effects: [{ op: 'heal', amount: 4, target: { mode: 'targeted', side: 'friendly', damaged: true } }],
  }),
  item('Rose Incense', 'Consumed', 3, 'Uncommon', 'A friendly Spent Pokémon in the arena becomes Active.', {
    effects: [{ op: 'ready', target: { mode: 'targeted', side: 'friendly', filter: { spent: true } } }],
  }),
  item('Miracle Seed', 'Consumed', 4, 'Rare', 'Gain 2 Base Energy this Round.', {
    effects: [{ op: 'gainEnergy', amount: 2 }],
  }),
];

// PLACEHOLDER non-Pokémon cards still to come.
export const OTHER_CARDS = [];

// Each deck: card id → number of copies. PLACEHOLDER: one of every card above.
export const PLACEHOLDER_DECKLIST = {
  ...Object.fromEntries([...POKEMON_CARDS, ...OTHER_CARDS].map((c) => [c.id, 1])),
  'black-belt': 2,
  'rocky-helmet': 2,
  'oran-berry': 1,
  'amulet-coin': 1,
  potion: 1,
  'miracle-seed': 1,
  quickdraw: 3,
  hypervoice: 3,
  recover: 2,
  'tracey': 2,
  'professor-oak': 1,
  'mallow': 1,
  'cerulean-cape': 2,
  'floaroma-meadow': 1,
  'shalour-city': 1,
};
