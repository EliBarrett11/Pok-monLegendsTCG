// Card definitions, as plain data: the Fire and Water decks (docs/decks.md),
// their Trainers and the PokéMart's Items. Field values must come from the lists below.

export const POKEMON_TYPES = [
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];
export const ATTACK_TYPES = ['Physical', 'Special'];
export const STRENGTH_TYPES = ['Hitpoints', 'Defence', 'Special Defence'];
export const SPEED_TIERS = ['Slow', 'Steady', 'Swift'];
// Rarity-Tiers, with how many copies of a card a deck may hold.
// A deck may also hold at most one Legendary card in all (MAX_LEGENDARY).
export const RARITIES = {
  Common: 3,
  Rare: 2,
  Epic: 1,
  Legendary: 1,
};
export const MAX_LEGENDARY = 1;

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

// Innate Powers: keywords the rules check directly (see keywords.js). A card
// can have several, e.g. innatePower: 'Overrun, Scorch 2'. X is the keyword's number.
export const INNATE_POWERS = {
  'Quick Attack': 'This Pokémon is summoned Active instead of Spent.',
  Agility: "This Pokémon can't be chosen as a target by Strategy Cards. Area effects still affect it.",
  Scorch: "When this Pokémon's attack deals damage, it also applies Burn X to the target (if it's still in play). Works on Trainers too.",
  Overrun: "When this Pokémon's attack defeats an enemy Pokémon, the damage left over is dealt to the enemy Trainer in that Zone (lost if that Trainer has been removed).",
  Regenerate: 'At each Breakfast, this Pokémon heals X.',
  Shell: 'Every instance of damage this Pokémon takes is reduced by X, to a minimum of 1. Includes Burn.',
  Infiltrator: 'This Pokémon\'s attacks ignore the Defence and Special Defence targeting restrictions: it may attack any enemy Pokémon or any enemy Trainer still in play. An Alert target still hits back.',
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
// extra: { oncePerRound: true } lets it fire at most once each Round.
export function ability(word, effectText, effects, match = {}, extra = {}) {
  return { effectTrigger: word, effectText, ability: { on: TRIGGER_WORDS[word], match: { ...(TRIGGER_MATCH[word] ?? { self: true }), ...match }, effects, ...extra } };
}


// --- Card builders ---------------------------------------------------------------

const FIRE = { pokemonType: 'Fire' };
const WATER = { pokemonType: 'Water' };

// Strategy Cards: played as a Battle Action for their Energy Cost; the effect
// resolves, then the card goes to the Discard Pile.
function strategy(id, name, energyCost, rarity, effectText, effects, extras = {}) {
  return { id, name, cardType: 'Strategy', energyCost, image: null, effectText, rarity, effects, ...extras };
}

// Supporter Cards: played as a Battle Action for a Card-Cost: exactly
// `discard` cards to the Discard Pile and `release` cards to the Released
// Pile, from the hand (not the Supporter itself). If at least one paid card
// matches the Gift Bonus Challenge (any printed field; see matchesCard in
// effects.js), `gift.effects` resolves instead of `effects`.
function supporter(id, name, rarity, cardCost, effectText, effects, gift) {
  return { id, name, cardType: 'Supporter', cardCost, image: null, effectText, rarity, effects, gift };
}

function location(id, name, rarity, weatherTokens, quest, xp, effectText, effects) {
  return { id, name, cardType: 'Location', image: null, weatherTokens, quest, xp, effectText, effects, rarity };
}

// Items: bought with PokéDollars through the Open Bag Action, then used (or
// stored in the Bag and used later). `effects` resolve when it is used:
//   Held      attachHeld to a friendly Pokémon (arena or hand); `held` says
//             what the holder gets while it is in the arena:
//             { attack?, strength?, speedUp?, keywords?,
//               also?: { pokemonType, attack?, strength?, keywords? } }  (more for that Type)
//             A Held Strength bonus below 0 can't take Strength below 1.
//   Consumed  effects resolve, then the Item goes to the PokéMart
const FRIENDLY_POKEMON_ANYWHERE = { mode: 'targeted', side: 'friendly', kinds: ['pokemon', 'hand'] };

function item(id, name, itemType, cost, rarity, effectText, more) {
  return { id, name, cardType: 'Item', itemType, cost, image: null, effectText, rarity, ...more };
}

function heldItem(id, name, cost, rarity, effectText, held) {
  return item(id, name, 'Held', cost, rarity, effectText, {
    held,
    effects: [{ op: 'attachHeld', target: FRIENDLY_POKEMON_ANYWHERE }],
  });
}

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

// --- Shorthand for card effects ---------------------------------------------

const ENEMY_ANY = { mode: 'targeted', side: 'opponent', kinds: ['pokemon', 'trainer'] };
const CHOSEN = { mode: 'chosen' };           // the same card the first effect targeted, if still in play
const SELF = { mode: 'self' };               // the Pokémon whose ability this is
const ENEMY_TRAINERS = { mode: 'area', side: 'opponent', kinds: ['trainer'] };
// =============================================================================
// 🔥 FIRE DECK — "Burn" (Aggressive). docs/decks.md section 3.
// =============================================================================

export const FIRE_POKEMON = [
  pokemon('Growlithe', 1, 'Fire', 'Physical', 2, 'Hitpoints', 5, 'Swift', 'Common', { innatePower: 'Scorch 1' }),
  pokemon('Charmander', 1, 'Fire', 'Special', 3, 'Hitpoints', 6, 'Steady', 'Common',
    ability('On Summon', "Burn 1 to an enemy Pokémon or Trainer in this Pokémon's Zone.", [
      { op: 'burn', amount: 1, target: { ...ENEMY_ANY, zone: 'source' } },
    ])),
  pokemon('Ponyta', 2, 'Fire', 'Physical', 3, 'Hitpoints', 5, 'Swift', 'Common', { innatePower: 'Quick Attack, Infiltrator' }),
  pokemon('Mankey', 2, 'Fighting', 'Physical', 4, 'Hitpoints', 5, 'Swift', 'Common', { innatePower: 'Overrun, Infiltrator' }),
  pokemon('Magmar', 3, 'Fire', 'Special', 4, 'Hitpoints', 7, 'Steady', 'Common', { innatePower: 'Scorch 2' }),
  pokemon('Sneasel', 3, 'Dark', 'Physical', 4, 'Hitpoints', 4, 'Swift', 'Common', {
    innatePower: 'Infiltrator',
    ...ability('On Knockout', 'This Pokémon becomes Active (once per Round).', [{ op: 'ready', target: SELF }], {}, { oncePerRound: true }),
  }),
  pokemon('Arcanine', 4, 'Fire', 'Physical', 5, 'Hitpoints', 6, 'Swift', 'Rare', { innatePower: 'Overrun, Scorch 1, Infiltrator' }),
  pokemon('Houndoom', 5, 'Fire', 'Special', 5, 'Hitpoints', 7, 'Swift', 'Epic',
    ability('On Summon', 'Burn 2 to each enemy Trainer.', [{ op: 'burn', amount: 2, target: ENEMY_TRAINERS }])),
  pokemon('Blaziken', 5, 'Fire', 'Physical', 7, 'Hitpoints', 8, 'Steady', 'Legendary', { innatePower: 'Overrun, Scorch 2' }),
];

export const FIRE_STRATEGY = [
  strategy('ember', 'Ember', 1, 'Common', 'Burn 2 to an enemy Pokémon or Trainer.', [
    { op: 'burn', amount: 2, target: ENEMY_ANY },
  ]),
  strategy('flame-charge', 'Flame Charge', 2, 'Common', "A friendly Pokémon gains +2 Attack this Round. If it's a Fire Pokémon, it also gains Scorch 1 this Round.", [
    { op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', side: 'friendly' } },
    { op: 'grant', keyword: 'Scorch', amount: 1, thisRound: true, onlyIf: FIRE, target: CHOSEN },
  ]),
  strategy('heat-wave', 'Heat Wave', 4, 'Rare', 'Burn 1 to every enemy Pokémon and every enemy Trainer.', [
    { op: 'burn', amount: 1, target: { mode: 'area', side: 'opponent', kinds: ['pokemon', 'trainer'] } },
  ]),
  strategy('fire-blast', 'Fire Blast', 5, 'Epic', "Deal 4 damage to an enemy Pokémon or Trainer, then Burn 2 to it if it's still in play.", [
    { op: 'damage', amount: 4, target: ENEMY_ANY },
    { op: 'burn', amount: 2, target: CHOSEN },
  ]),
];

export const FIRE_SUPPORTERS = [
  supporter('firebreather', 'Firebreather', 'Common', { discard: 1, release: 0 }, 'Burn 1 to each enemy Trainer.', [
    { op: 'burn', amount: 1, target: ENEMY_TRAINERS },
  ], {
    challengeText: 'a Fire Pokémon',
    challenge: { cardType: 'Pokémon', pokemonType: 'Fire' },
    bonusText: 'Burn 2 to each enemy Trainer instead.',
    effects: [{ op: 'burn', amount: 2, target: ENEMY_TRAINERS }],
  }),
  supporter('chili', 'Chili', 'Rare', { discard: 0, release: 1 }, 'Your Pokémon in a chosen Zone gain +2 Attack and Overrun this Round.', [
    { op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } },
    { op: 'grant', keyword: 'Overrun', thisRound: true, target: { mode: 'area', side: 'friendly', zone: 'target' } },
  ], {
    challengeText: 'a Swift Pokémon',
    challenge: { cardType: 'Pokémon', speedTier: 'Swift' },
    bonusText: 'They also become Active.',
    effects: [
      { op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', pick: 'zone', side: 'friendly' } },
      { op: 'grant', keyword: 'Overrun', thisRound: true, target: { mode: 'area', side: 'friendly', zone: 'target' } },
      { op: 'ready', target: { mode: 'area', side: 'friendly', zone: 'target', filter: { spent: true } } },
    ],
  }),
  supporter('burglar', 'Burglar', 'Rare', { discard: 2, release: 0 }, 'Gain 3 PokéDollars.', [
    { op: 'gainDollars', amount: 3 },
  ], {
    challengeText: 'an Item card',
    challenge: { cardType: 'Item' },
    bonusText: 'Gain 5 PokéDollars instead.',
    effects: [{ op: 'gainDollars', amount: 5 }],
  }),
];

export const FIRE_LOCATIONS = [
  location('mt-ember', 'Mt. Ember', 'Common', { Sun: 2 },
    { text: 'Apply Burn 4 times.', label: 'Burn applied', on: 'burn', count: 4 },
    2, 'Burn 2 to each enemy Trainer.', [{ op: 'burn', amount: 2, target: ENEMY_TRAINERS }]),
  location('cinnabar-volcano', 'Cinnabar Volcano', 'Rare', { Sun: 2 },
    { text: 'Damage enemy Trainers 3 times with Pokémon in this Zone.', label: 'Trainer strikes', on: 'trainerStrike', inZone: true, count: 3 },
    3, 'Friendly Fire Pokémon in this Zone gain +1/+1.', [
      { op: 'buff', attack: 1, strength: 1, target: { mode: 'area', side: 'friendly', zone: 'source', filter: FIRE } },
    ]),
  location('stark-mountain', 'Stark Mountain', 'Rare', { Sun: 3 },
    { text: 'Defeat 2 enemy Pokémon.', label: 'Enemy Pokémon defeated', on: 'defeat', count: 2 },
    2, 'Deal 2 damage to each enemy Pokémon in this Zone.', [
      { op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent', zone: 'source' } },
    ]),
];

export const FIRE_ITEMS = [
  heldItem('charcoal', 'Charcoal', 2, 'Common', "Holder gains +1 Attack. If it's a Fire Pokémon, it also gains Scorch 1.",
    { attack: 1, also: { ...FIRE, keywords: [{ key: 'Scorch', amount: 1 }] } }),
  item('x-attack', 'X Attack', 'Consumed', 2, 'Common', 'A friendly Pokémon in the arena gains +2 Attack this Round. Retain.', {
    retain: true,
    effects: [{ op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', side: 'friendly' } }],
  }),
  heldItem('quick-claw', 'Quick Claw', 3, 'Rare', "Holder's Speed-Tier is one higher (Slow → Steady → Swift).", { speedUp: 1 }),
  heldItem('choice-band', 'Choice Band', 4, 'Rare', "Holder gains +3 Attack and −2 Strength (can't reduce Strength below 1).", { attack: 3, strength: -2 }),
];

// =============================================================================
// 💧 WATER DECK — "Value-Midrange" (Board-Based). docs/decks.md section 4.
// =============================================================================

export const WATER_POKEMON = [
  pokemon('Horsea', 1, 'Water', 'Special', 3, 'Hitpoints', 4, 'Steady', 'Common',
    ability('Rally', 'This Pokémon gains +1/+1.', [{ op: 'buff', attack: 1, strength: 1, target: SELF }])),
  pokemon('Goldeen', 2, 'Water', 'Physical', 4, 'Hitpoints', 5, 'Steady', 'Common',
    ability('On Summon', 'Heal a friendly Pokémon 2.', [{ op: 'heal', amount: 2, target: { mode: 'targeted', side: 'friendly', damaged: true } }])),
  pokemon('Chinchou', 2, 'Electric', 'Special', 3, 'Special Defence', 5, 'Steady', 'Common', { innatePower: 'Regenerate 1' }),
  pokemon('Quagsire', 3, 'Water', 'Physical', 4, 'Defence', 7, 'Slow', 'Common', { innatePower: 'Regenerate 2' }),
  pokemon('Wartortle', 3, 'Water', 'Special', 4, 'Defence', 5, 'Steady', 'Common', { innatePower: 'Shell 1' }),
  pokemon('Lapras', 4, 'Water', 'Special', 5, 'Hitpoints', 7, 'Steady', 'Rare',
    ability('On Summon', "Heal all friendly Pokémon in this Pokémon's Zone 2.", [
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', zone: 'source', damaged: true } },
    ])),
  pokemon('Pelipper', 4, 'Water', 'Special', 5, 'Hitpoints', 5, 'Swift', 'Rare', {
    weatherTokens: { Rain: 2 },
    ...ability('On Summon', 'A card in your hand gains Retain.', [
      { op: 'retain', target: { mode: 'targeted', side: 'friendly', kinds: ['handCard'] } },
    ]),
  }),
  pokemon('Chansey', 4, 'Normal', 'Physical', 1, 'Hitpoints', 12, 'Slow', 'Rare',
    ability('On Breakfast', "Heal each friendly Pokémon in this Pokémon's Zone 2.", [
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', zone: 'source', damaged: true } },
    ])),
  pokemon('Gyarados', 5, 'Water', 'Physical', 7, 'Hitpoints', 6, 'Steady', 'Epic',
    ability('On Summon', "Deal 2 damage to each enemy Pokémon in this Pokémon's Zone.", [
      { op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent', zone: 'source' } },
    ])),
  pokemon('Vaporeon', 5, 'Water', 'Special', 5, 'Special Defence', 7, 'Steady', 'Epic', {
    innatePower: 'Regenerate 2',
    ...ability('On Heal', 'This Pokémon gains +1 Attack.', [{ op: 'buff', attack: 1, strength: 0, target: SELF }]),
  }),
  pokemon('Kyogre', 6, 'Water', 'Special', 7, 'Hitpoints', 11, 'Slow', 'Legendary', {
    weatherTokens: { Rain: 2 },
    ...ability('On Summon', 'Heal every friendly Pokémon and Trainer 2.', [
      { op: 'heal', amount: 2, target: { mode: 'area', side: 'friendly', kinds: ['pokemon', 'trainer'], damaged: true } },
    ]),
  }),
];

export const WATER_STRATEGY = [
  strategy('aqua-ring', 'Aqua Ring', 2, 'Common', 'Heal a friendly Pokémon 3 and Douse it. Retain.', [
    { op: 'heal', amount: 3, target: { mode: 'targeted', side: 'friendly' } },
    { op: 'douse', target: CHOSEN },
  ], { retain: true }),
  strategy('bubble-beam', 'Bubble Beam', 3, 'Common', 'Deal 2 damage to an enemy Pokémon, or 3 if Rain is 2 or more.', [
    { op: 'damage', amount: 2, amountIf: { weather: 'Rain', min: 2, amount: 3 }, target: { mode: 'targeted', side: 'opponent' } },
  ]),
  strategy('dive', 'Dive', 2, 'Common', 'Return a Pokémon from your Discard Pile to your hand. It gains Retain.', [
    { op: 'return', filter: { cardType: 'Pokémon' }, retain: true },
  ]),
  strategy('surf', 'Surf', 5, 'Rare', 'Deal 2 damage to each enemy Pokémon, and heal each friendly Pokémon 1.', [
    { op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent' } },
    { op: 'heal', amount: 1, target: { mode: 'area', side: 'friendly', damaged: true } },
  ]),
];

export const WATER_SUPPORTERS = [
  supporter('nurse-joy', 'Nurse Joy', 'Common', { discard: 1, release: 0 }, 'Heal a friendly Trainer 3 and Douse it.', [
    { op: 'heal', amount: 3, target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'] } },
    { op: 'douse', target: CHOSEN },
  ], {
    challengeText: 'a Normal Pokémon',
    challenge: { cardType: 'Pokémon', pokemonType: 'Normal' },
    bonusText: 'Heal 5 instead.',
    effects: [
      { op: 'heal', amount: 5, target: { mode: 'targeted', side: 'friendly', kinds: ['trainer'] } },
      { op: 'douse', target: CHOSEN },
    ],
  }),
  supporter('swimmer', 'Swimmer', 'Rare', { discard: 2, release: 0 }, 'Free summon a Pokémon costing 2 or less from your hand.', [
    { op: 'freeSummon', filter: { energyCost: { max: 2 } } },
  ], {
    challengeText: 'a Water Pokémon',
    challenge: { cardType: 'Pokémon', pokemonType: 'Water' },
    bonusText: 'It arrives Active.',
    effects: [{ op: 'freeSummon', filter: { energyCost: { max: 2 } }, active: true }],
  }),
  supporter('fisherman', 'Fisherman', 'Rare', { discard: 0, release: 1 }, 'Search your Draw Pile for a Water Pokémon; it gains Retain.', [
    { op: 'search', filter: { cardType: 'Pokémon', ...WATER }, retain: true },
  ], {
    challengeText: 'a Strategy card',
    challenge: { cardType: 'Strategy' },
    bonusText: 'Search for two instead.',
    effects: [{ op: 'search', filter: { cardType: 'Pokémon', ...WATER }, count: 2, retain: true }],
  }),
];

export const WATER_LOCATIONS = [
  location('cerulean-cape', 'Cerulean Cape', 'Common', { Rain: 2 },
    { text: 'Summon 3 Pokémon into this Zone.', label: 'Pokémon summoned here', on: 'summon', inZone: true, count: 3 },
    2, 'Friendly Pokémon in this Zone gain +1/+1.', [
      { op: 'buff', attack: 1, strength: 1, target: { mode: 'area', side: 'friendly', zone: 'source' } },
    ]),
  location('lake-of-rage', 'Lake of Rage', 'Rare', { Rain: 2 },
    { text: 'Heal 10 Strength in total.', label: 'Strength healed', on: 'heal', count: 10 },
    3, 'Return up to 2 Pokémon from your Discard Pile to your hand.', [
      { op: 'return', filter: { cardType: 'Pokémon' }, count: 2, upTo: true },
    ]),
  location('route-119', 'Route 119', 'Rare', { Rain: 3 },
    { text: 'Have 3 friendly Pokémon in this Zone at Supper.', label: 'Friendly Pokémon here at Supper', on: 'presence', inZone: true, count: 3 },
    2, 'Heal all friendly Trainers 3.', [
      { op: 'heal', amount: 3, target: { mode: 'area', side: 'friendly', kinds: ['trainer'], damaged: true } },
    ]),
];

export const WATER_ITEMS = [
  heldItem('mystic-water', 'Mystic Water', 2, 'Common', "Holder gains +1 Attack. If it's a Water Pokémon, it also gains +1 Strength.",
    { attack: 1, also: { ...WATER, strength: 1 } }),
  heldItem('leftovers', 'Leftovers', 3, 'Common', 'Holder gains Regenerate 1.', { keywords: [{ key: 'Regenerate', amount: 1 }] }),
  item('full-heal', 'Full Heal', 'Consumed', 1, 'Common', 'Douse a friendly Pokémon or Trainer and heal it 2. Retain.', {
    retain: true,
    effects: [
      { op: 'douse', target: { mode: 'targeted', side: 'friendly', kinds: ['pokemon', 'trainer'] } },
      { op: 'heal', amount: 2, target: CHOSEN },
    ],
  }),
];

// --- Trainers ---------------------------------------------------------------
//
// Powers and Passives are written in the effect language from effects.js:
//   power:   { cost, text, effects: [effect, ...] }
//   passive: { text, aura?, triggers?, cost?, burnBonus? }
//     aura       { attack, strength, keywords?, target } continuous bonus for matching Pokémon
//     cost       { amount, first? } summons into this Zone cost less (see summonCost in game.js)
//     burnBonus  Burn applied by friendly Pokémon in this Zone is increased by this much
// "source" zone = the Trainer's own Zone (both sides of the arena).

function trainer(id, name, strength, power, passive) {
  return { id, name, cardType: 'Trainer', strength, image: null, power, passive };
}

export const TRAINER_CARDS = [
  // Fire
  trainer('blaine', 'Blaine', 14,
    { cost: 1, text: 'Burn 1 to an enemy Pokémon or Trainer.', effects: [{ op: 'burn', amount: 1, target: ENEMY_ANY }] },
    { text: "Burn applied by friendly Pokémon in Blaine's Zone is increased by 1.", burnBonus: 1 }),
  trainer('flannery', 'Flannery', 13,
    { cost: 1, text: "A friendly Pokémon in Flannery's Zone gains +2 Attack this Round.", effects: [
      { op: 'buff', attack: 2, strength: 0, thisRound: true, target: { mode: 'targeted', side: 'friendly', zone: 'source' } },
    ] },
    { text: "Friendly Fire Pokémon in Flannery's Zone gain Overrun.",
      aura: { attack: 0, strength: 0, keywords: [{ key: 'Overrun' }], target: { side: 'friendly', zone: 'source', filter: FIRE } } }),
  trainer('kabu', 'Kabu', 16,
    { cost: 2, text: "A friendly Spent Pokémon in Kabu's Zone becomes Active.", effects: [
      { op: 'ready', target: { mode: 'targeted', side: 'friendly', zone: 'source', filter: { spent: true } } },
    ] },
    { text: "Friendly Pokémon in Kabu's Zone gain +2 Strength.",
      aura: { attack: 0, strength: 2, target: { side: 'friendly', zone: 'source' } } }),
  // Water
  trainer('misty', 'Misty', 16,
    { cost: 1, text: "Heal a friendly Pokémon in Misty's Zone 3.", effects: [
      { op: 'heal', amount: 3, target: { mode: 'targeted', side: 'friendly', zone: 'source', damaged: true } },
    ] },
    { text: "Friendly Water Pokémon in Misty's Zone gain +2 Strength.",
      aura: { attack: 0, strength: 2, target: { side: 'friendly', zone: 'source', filter: WATER } } }),
  trainer('crasher-wake', 'Crasher Wake', 17,
    { cost: 2, text: "Deal 2 damage to an enemy Pokémon in Wake's Zone.", effects: [
      { op: 'damage', amount: 2, target: { mode: 'targeted', side: 'opponent', zone: 'source' } },
    ] },
    { text: "Friendly Pokémon in Wake's Zone gain Shell 1.",
      aura: { attack: 0, strength: 0, keywords: [{ key: 'Shell', amount: 1 }], target: { side: 'friendly', zone: 'source' } } }),
  trainer('wallace', 'Wallace', 15,
    { cost: 1, text: 'Return a Pokémon from your Discard Pile to your hand.', effects: [{ op: 'return', filter: { cardType: 'Pokémon' } }] },
    { text: "The first Pokémon you summon into Wallace's Zone each Round costs 1 less.", cost: { amount: 1, first: true } }),
];

// --- All cards and the decks ---------------------------------------------------

export const POKEMON_CARDS = [...FIRE_POKEMON, ...WATER_POKEMON];
export const STRATEGY_CARDS = [...FIRE_STRATEGY, ...WATER_STRATEGY];
export const SUPPORTER_CARDS = [...FIRE_SUPPORTERS, ...WATER_SUPPORTERS];
export const LOCATION_CARDS = [...FIRE_LOCATIONS, ...WATER_LOCATIONS];
// The PokéMart holds one copy of every Item in the game (section 5).
export const ITEM_CARDS = [...FIRE_ITEMS, ...WATER_ITEMS];

// The standard split of a deck by Card-Type (section 1).
export const DECK_SPLIT = { Pokémon: 18, Strategy: 8, Supporter: 4, Location: 4, Item: 6 };

// Each deck: what it is, its 3 Trainers, its 40 cards (id → copies), and the
// two cards shown on the deck selection screen.
export const DECKS = {
  fire: {
    id: 'fire',
    name: 'Fire',
    archetype: 'Aggressive',
    specialization: 'Burn',
    pokemonType: 'Fire',
    plan: 'Fast pressure from Round 1: Burn keeps damaging Trainers every Supper, and Overrun pushes damage onto them.',
    tradeOff: 'Fragile Pokémon and lower Trainer Strength; it fades in long matches.',
    showcase: ['blaziken', 'houndoom'],
    trainers: ['blaine', 'flannery', 'kabu'],
    list: {
      growlithe: 3, charmander: 2, ponyta: 3, mankey: 2, magmar: 2, sneasel: 2, arcanine: 2, houndoom: 1, blaziken: 1,
      ember: 3, 'flame-charge': 2, 'heat-wave': 2, 'fire-blast': 1,
      firebreather: 2, chili: 1, burglar: 1,
      'mt-ember': 2, 'cinnabar-volcano': 1, 'stark-mountain': 1,
      charcoal: 2, 'x-attack': 2, 'quick-claw': 1, 'choice-band': 1,
    },
  },
  water: {
    id: 'water',
    name: 'Water',
    archetype: 'Board-Based',
    specialization: 'Value-Midrange',
    pokemonType: 'Water',
    plan: 'Sturdy Pokémon that heal, return from the Discard Pile and grow stronger together in a Zone; it wins longer matches.',
    tradeOff: 'Slow starts and low burst damage.',
    showcase: ['kyogre', 'lapras'],
    trainers: ['misty', 'crasher-wake', 'wallace'],
    list: {
      horsea: 2, goldeen: 2, chinchou: 2, quagsire: 3, wartortle: 2, lapras: 2, pelipper: 1, chansey: 1, gyarados: 1, vaporeon: 1, kyogre: 1,
      'aqua-ring': 3, 'bubble-beam': 2, dive: 2, surf: 1,
      'nurse-joy': 2, swimmer: 1, fisherman: 1,
      'cerulean-cape': 2, 'lake-of-rage': 1, 'route-119': 1,
      'mystic-water': 2, leftovers: 2, 'full-heal': 2,
    },
  },
};
export const DECK_IDS = Object.keys(DECKS);
