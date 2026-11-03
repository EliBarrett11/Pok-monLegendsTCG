// V4 — Strategy Cards with breakpoints, Supporters and Items (docs/v2-design.md 3, 5,
// 6, 7a). Data only: game.js resolves the effect ops.
//
// Targets: { side: 'enemy' | 'friendly', kinds: ['pokemon', 'player'], count, filter? }
//   count  1, 2 (choose up to that many, at least 1), or 'all' (no choice: every one)
//   filter 'canTrain' (below its cap), 'damaged'
//   No target: the effect is on its player (draw, Energy, Recognition, find an Item).
// Ops, applied to each target (or to its player when there is none):
//   damage N · burn N · heal N · douse · cure (all statuses) · sleep · leechSeed ·
//   train N · draw N · energy N (now) · energyNext N (next Round) · recognition N ·
//   enemyLosesRecognition N (never below 0) · findItem (from the shared Item pool into
//   your Bag) · shellRound N (Shell N until Supper; V5)
//
// Strategy Cards: a list of breakpoints { cost, text, target?, ops }. The Energy you
// choose to pay sets the effect, and only a breakpoint amount can be paid. A card
// whose effect doesn't scale has a single breakpoint (its single cost).
// Supporters: cost Release N other cards from your hand, and the Supporter itself is
// Released after use. No once-per-Round limit. Favour: if a Released card meets the
// condition, the improved effect replaces the plain one.
// Items: Held (attach to a friendly Pokémon in play: stats and keywords while it's
// there) or Consumed (resolve, then leave play). Used and lost Items go to the shared
// Item pool. As deck cards they cost Energy: used at once or put into the Bag.
//
// All cards and numbers here are test values (V4); art is v1's.

const ENEMY = (count = 1, kinds = ['pokemon', 'player']) => ({ side: 'enemy', kinds, count });
const FRIEND = (count = 1, kinds = ['pokemon'], filter) => ({ side: 'friendly', kinds, count, ...(filter ? { filter } : {}) });

function strategy(id, name, rarity, breakpoints, extra = {}) {
  return { id, name, cardType: 'Strategy', rarity, art: id, breakpoints, cost: breakpoints[0].cost, ...extra };
}

// V5: Elliott's rule "each extra Energy must be truly worth it": every higher
// breakpoint gives more value per Energy than the one below it.
export const STRATEGIES = [
  // Scaling: damage. 2 per Energy · 7 for 3 (2.3) · 14 for 5 (2.8).
  strategy('thunderbolt', 'Thunderbolt', 'Common', [
    { cost: 1, text: '2 damage to an enemy Pokémon', target: ENEMY(1, ['pokemon']), ops: [{ op: 'damage', amount: 2 }] },
    { cost: 3, text: '7 damage to an enemy Pokémon', target: ENEMY(1, ['pokemon']), ops: [{ op: 'damage', amount: 7 }] },
    { cost: 5, text: '7 damage to two enemy Pokémon', target: ENEMY(2, ['pokemon']), ops: [{ op: 'damage', amount: 7 }] },
  ]),
  // Scaling: Burn (Elliott's example). Burn 2 · Burn 2 twice and −1 Recognition ·
  // Burn 2 every enemy, and −2 Recognition.
  strategy('ember', 'Ember', 'Common', [
    { cost: 2, text: 'Burn 2 an enemy Pokémon or the enemy player', target: ENEMY(1), ops: [{ op: 'burn', amount: 2 }] },
    { cost: 4, text: 'Burn 2 two targets, and the enemy player loses 1 Recognition', target: ENEMY(2), ops: [{ op: 'burn', amount: 2 }, { op: 'enemyLosesRecognition', amount: 1 }] },
    { cost: 6, text: 'Burn 2 every enemy Pokémon and the enemy player, and the enemy player loses 2 Recognition', target: ENEMY('all'), ops: [{ op: 'burn', amount: 2 }, { op: 'enemyLosesRecognition', amount: 2 }] },
  ]),
  // Scaling: heal. 2 per Energy · up to 8 and Douse for 3 · 6 to every one, Douse all, draw 1 for 5.
  strategy('recover', 'Recover', 'Common', [
    { cost: 1, text: 'Heal 2 a friendly Pokémon', target: FRIEND(1, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 2 }] },
    { cost: 3, text: 'Heal 4 and Douse up to two friendly Pokémon', target: FRIEND(2, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 4 }, { op: 'douse' }] },
    { cost: 5, text: 'Heal 6 every friendly Pokémon; Douse them and your player character; draw 1', target: FRIEND('all', ['pokemon', 'player']), ops: [{ op: 'heal', amount: 6 }, { op: 'douse' }, { op: 'draw', amount: 1 }] },
  ]),
  // Scaling: draw. 1 card per Energy · 3 cards and +1 Energy for 3 · 5 cards and +2 Energy for 5.
  strategy('quickdraw', 'Quickdraw', 'Common', [
    { cost: 1, text: 'Draw 1', ops: [{ op: 'draw', amount: 1 }] },
    { cost: 3, text: 'Draw 3 and +1 Energy next Round', ops: [{ op: 'draw', amount: 3 }, { op: 'energyNext', amount: 1 }] },
    { cost: 5, text: 'Draw 5 and +2 Energy next Round', ops: [{ op: 'draw', amount: 5 }, { op: 'energyNext', amount: 2 }] },
  ]),
  // Fixed cost (no scaling): a single breakpoint.
  strategy('sleep-powder', 'Sleep Powder', 'Common', [
    { cost: 2, text: 'Put an enemy Pokémon to Sleep', target: ENEMY(1, ['pokemon']), ops: [{ op: 'sleep' }] },
  ]),
  strategy('leech-seed', 'Leech Seed', 'Common', [
    { cost: 2, text: 'Leech Seed an enemy Pokémon', target: ENEMY(1, ['pokemon']), ops: [{ op: 'leechSeed' }] },
  ]),
];

// Favour conditions: a test on a Released card.
export const FAVOURS = {
  location: { text: 'a Location', test: (c) => c.cardType === 'Location' },
  bigPokemon: { text: 'a Pokémon of Level 4 or more', test: (c) => c.cardType === 'Pokémon' && c.level >= 4 },
  grass: { text: 'a Grass Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Grass' },
  // V6
  fire: { text: 'a Fire Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Fire' },
  water: { text: 'a Water Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Water' },
  normal: { text: 'a Normal Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Normal' },
  rock: { text: 'a Rock Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Rock' },
  swift: { text: 'a Swift Pokémon', test: (c) => c.cardType === 'Pokémon' && c.speed === 'Swift' },
  pokemon: { text: 'a Pokémon card', test: (c) => c.cardType === 'Pokémon' },
  item: { text: 'an Item card', test: (c) => c.cardType === 'Item' },
  strategy: { text: 'a Strategy Card', test: (c) => c.cardType === 'Strategy' },
  // "a Pokémon from an evolution line": its series has more than one stage.
  evolutionLine: { text: 'a Pokémon from an evolution line', test: (c) => c.cardType === 'Pokémon' && c.stage !== undefined && /-stage$/.test(c.stageKind ?? '') },
};

function supporter(id, name, rarity, release, text, effect, favour) {
  return { id, name, cardType: 'Supporter', rarity, art: id, release, cost: 0, text, ...effect, favour };
}

export const SUPPORTERS = [
  // Draw.
  supporter('professor-oak', 'Professor Oak', 'Rare', 1, 'Draw 3',
    { ops: [{ op: 'draw', amount: 3 }] },
    { condition: 'location', text: 'Draw 4 instead', ops: [{ op: 'draw', amount: 4 }] }),
  // Recognition.
  supporter('ash', 'Ash', 'Rare', 2, '+3 Recognition',
    { ops: [{ op: 'recognition', amount: 3 }] },
    { condition: 'bigPokemon', text: '+6 Recognition instead', ops: [{ op: 'recognition', amount: 6 }] }),
  // Board.
  supporter('pokemon-breeder', 'Pokémon Breeder', 'Rare', 1, 'Train 1 one of your Pokémon, and heal it 2',
    { target: FRIEND(1, ['pokemon'], 'canTrain'), ops: [{ op: 'train', amount: 1 }, { op: 'heal', amount: 2 }] },
    { condition: 'grass', text: 'Train 2 and heal 3 instead', ops: [{ op: 'train', amount: 2 }, { op: 'heal', amount: 3 }] }),
];

function item(id, name, rarity, kind, cost, text, effect = {}, extra = {}) {
  return { id, name, cardType: 'Item', rarity, art: id, kind, cost, text, ...effect, ...extra };
}

export const ITEMS = [
  item('choice-band', 'Choice Band', 'Common', 'Held', 2, 'Held: +2 Attack',
    { target: FRIEND(1, ['pokemon']), held: { attack: 2 } }),
  item('leftovers', 'Leftovers', 'Common', 'Held', 1, 'Held: Regenerate 1 (heals 1 at Breakfast)',
    { target: FRIEND(1, ['pokemon']), held: { keywords: ['Regenerate 1'] } }),
  item('oran-berry', 'Oran Berry', 'Common', 'Consumed', 1, 'Heal 3 a friendly Pokémon',
    { target: FRIEND(1, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 3 }] }),
  item('full-heal', 'Full Heal', 'Common', 'Consumed', 1, 'Cure a friendly Pokémon or your player character of all statuses and heal it 2. Retain.',
    { target: FRIEND(1, ['pokemon', 'player']), ops: [{ op: 'cure' }, { op: 'heal', amount: 2 }] }, { retain: true }),
  item('amulet-coin', 'Amulet Coin', 'Common', 'Consumed', 0, '+1 Energy now',
    { ops: [{ op: 'energy', amount: 1 }] }),
  item('field-notes', 'Field Notes', 'Common', 'Consumed', 1, 'Draw 2',
    { ops: [{ op: 'draw', amount: 2 }] }, { art: null }),
];

export const BAG_SIZE = 6;

// --- Trainers (V5) ----------------------------------------------------------------------------------
//
// Played from hand as a Battle Action (cost 1–2) above or below one of your spaces; a
// Pokémon can stand there too. They can't be attacked or removed (no effect does so
// yet). Trainer Points assigned to a Trainer unlock its tiers at their costs:
//   passive  always on: { kind, … } (see game.js: passives)
//            laneStrength { type?, amount }   your Pokémon (of that Type) in this lane +N Strength
//            burnPlus { amount }              each Burn you apply +N
//            spaceShell { amount }            your Pokémon in this space: Shell N
//            laneTrain { amount }             at Breakfast, your Pokémon in this lane train N
//   ability  a Battle Action with its own Energy cost: { cost, text, target, ops }, once per
//            Round per Trainer (Claude's placeholder)
//   partner  { series, level }: summoned at once from outside the deck into the Trainer's
//            space (or a free space you choose; if none is free, it waits)
// Art: the Trainer's portrait (v1's art). Test values throughout.
function trainer(id, name, cost, [passive, ability, partner], extra = {}) {
  return {
    id, name, cardType: 'Trainer', rarity: 'Rare', art: id, cost,
    tiers: [
      { kind: 'Passive', cost: passive.cost, text: passive.text, passive: passive.effect },
      { kind: 'Ability', cost: ability.cost, text: ability.text, ability: ability.effect },
      { kind: 'Partner', cost: partner.cost, text: partner.text, partner: partner.effect },
    ],
    ...extra,
  };
}

export const TRAINERS = [
  trainer('misty', 'Misty', 1, [
    { cost: 2, text: 'Your Water Pokémon in this lane +1 Strength', effect: { kind: 'laneStrength', type: 'Water', amount: 1 } },
    { cost: 4, text: '1 Energy: heal a friendly Pokémon 3', effect: { cost: 1, target: FRIEND(1, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 3 }] } },
    { cost: 6, text: 'Partner: Starmie (Level 4)', effect: { series: 'staryu', level: 4 } },
  ]),
  trainer('blaine', 'Blaine', 2, [
    { cost: 2, text: 'Each Burn you apply +1', effect: { kind: 'burnPlus', amount: 1 } },
    { cost: 4, text: '2 Energy: Burn 2 the enemy player', effect: { cost: 2, target: ENEMY(1, ['player']), ops: [{ op: 'burn', amount: 2 }] } },
    { cost: 6, text: 'Partner: Magmar (Level 4)', effect: { series: 'magmar', level: 4 } },
  ]),
  trainer('brock', 'Brock', 1, [
    { cost: 2, text: 'Your Pokémon in this space: Shell 1 (each damage it takes is 1 less, minimum 1)', effect: { kind: 'spaceShell', amount: 1 } },
    { cost: 4, text: '1 Energy: a friendly Pokémon gains Shell 1 this Round', effect: { cost: 1, target: FRIEND(1, ['pokemon']), ops: [{ op: 'shellRound', amount: 1 }] } },
    { cost: 6, text: 'Partner: Onix (Level 4)', effect: { series: 'onix', level: 4 } },
  ]),
  trainer('erika', 'Erika', 2, [
    { cost: 2, text: 'At Breakfast, your Pokémon in this lane train 1', effect: { kind: 'laneTrain', amount: 1 } },
    { cost: 4, text: '2 Energy: put an enemy Pokémon to Sleep', effect: { cost: 2, target: ENEMY(1, ['pokemon']), ops: [{ op: 'sleep' }] } },
    { cost: 6, text: 'Partner: Tangela (Level 4)', effect: { series: 'tangela', level: 4 } },
  ]),
];
export const trainerDef = (id) => TRAINERS.find((t) => t.id === id) ?? null;

export const ALL_OTHER_CARDS = [...STRATEGIES, ...SUPPORTERS, ...ITEMS, ...TRAINERS];
export const otherCard = (id) => ALL_OTHER_CARDS.find((c) => c.id === id) ?? null;
export const itemDef = (id) => ITEMS.find((c) => c.id === id) ?? null;

// A Strategy Card's cost in words: "1–5" or "2".
export const costRange = (card) => {
  const costs = card.breakpoints.map((b) => b.cost);
  return costs.length === 1 ? `${costs[0]}` : `${costs[0]}–${costs.at(-1)}`;
};
