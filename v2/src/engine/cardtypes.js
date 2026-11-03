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
//   findItem (from the shared Item pool into your Bag)
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

export const STRATEGIES = [
  // Scaling: damage.
  strategy('thunderbolt', 'Thunderbolt', 'Common', [
    { cost: 1, text: '2 damage to an enemy Pokémon', target: ENEMY(1, ['pokemon']), ops: [{ op: 'damage', amount: 2 }] },
    { cost: 3, text: '4 damage to an enemy Pokémon', target: ENEMY(1, ['pokemon']), ops: [{ op: 'damage', amount: 4 }] },
    { cost: 5, text: '4 damage to two enemy Pokémon', target: ENEMY(2, ['pokemon']), ops: [{ op: 'damage', amount: 4 }] },
  ]),
  // Scaling: Burn (the design's example).
  strategy('ember', 'Ember', 'Common', [
    { cost: 2, text: 'Burn 2 an enemy Pokémon or the enemy player', target: ENEMY(1), ops: [{ op: 'burn', amount: 2 }] },
    { cost: 4, text: 'Burn 2, and also a second target', target: ENEMY(2), ops: [{ op: 'burn', amount: 2 }] },
    { cost: 6, text: 'Burn 2 every enemy (every enemy Pokémon and the enemy player)', target: ENEMY('all'), ops: [{ op: 'burn', amount: 2 }] },
  ]),
  // Scaling: heal.
  strategy('recover', 'Recover', 'Common', [
    { cost: 1, text: 'Heal 2 a friendly Pokémon', target: FRIEND(1, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 2 }] },
    { cost: 3, text: 'Heal 3 and Douse up to two friendly Pokémon', target: FRIEND(2, ['pokemon'], 'damaged'), ops: [{ op: 'heal', amount: 3 }, { op: 'douse' }] },
    { cost: 5, text: 'Heal 4 every friendly Pokémon; Douse them and your player character', target: FRIEND('all', ['pokemon', 'player']), ops: [{ op: 'heal', amount: 4 }, { op: 'douse' }] },
  ]),
  // Scaling: draw.
  strategy('quickdraw', 'Quickdraw', 'Common', [
    { cost: 1, text: 'Draw 1', ops: [{ op: 'draw', amount: 1 }] },
    { cost: 3, text: 'Draw 2', ops: [{ op: 'draw', amount: 2 }] },
    { cost: 5, text: 'Draw 3 and +1 Energy next Round', ops: [{ op: 'draw', amount: 3 }, { op: 'energyNext', amount: 1 }] },
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

export const ALL_OTHER_CARDS = [...STRATEGIES, ...SUPPORTERS, ...ITEMS];
export const otherCard = (id) => ALL_OTHER_CARDS.find((c) => c.id === id) ?? null;
export const itemDef = (id) => ITEMS.find((c) => c.id === id) ?? null;

// A Strategy Card's cost in words: "1–5" or "2".
export const costRange = (card) => {
  const costs = card.breakpoints.map((b) => b.cost);
  return costs.length === 1 ? `${costs[0]}` : `${costs[0]}–${costs.at(-1)}`;
};
