// V1 test cards: fixed stats, no Training yet (V3 brings Level series). They reuse
// v1's art (assets/cards/<id>.jpg) so the board looks right; the stats are v2's own.
// Every Pokémon: cost, Type, Attack and its Attack-Type (Physical / Special),
// Strength and its Strength-Type (Hitpoints / Defence / Special Defence), Speed,
// keywords (Infiltrator, Quick Attack), and Retain (kept in hand at Supper).

function pokemon(id, name, level, cost, type, attack, attackType, strength, strengthType, speed, extra = {}) {
  return { id, name, cardType: 'Pokémon', level, cost, type, attack, attackType, strength, strengthType, speed, keywords: [], ...extra };
}

export const TEST_POKEMON = [
  pokemon('horsea', 'Horsea', 1, 1, 'Water', 2, 'Special', 4, 'Hitpoints', 'Steady'),
  pokemon('charmander', 'Charmander', 1, 1, 'Fire', 3, 'Special', 3, 'Hitpoints', 'Steady'),
  pokemon('bulbasaur', 'Bulbasaur', 1, 1, 'Grass', 2, 'Special', 5, 'Special Defence', 'Steady'),
  pokemon('growlithe', 'Growlithe', 1, 1, 'Fire', 3, 'Physical', 3, 'Hitpoints', 'Swift'),
  pokemon('oddish', 'Oddish', 1, 1, 'Grass', 2, 'Special', 4, 'Hitpoints', 'Steady', { retain: true }),
  pokemon('goldeen', 'Goldeen', 2, 2, 'Water', 4, 'Physical', 4, 'Hitpoints', 'Steady'),
  pokemon('ponyta', 'Ponyta', 2, 2, 'Fire', 3, 'Physical', 4, 'Hitpoints', 'Swift', { keywords: ['Quick Attack', 'Infiltrator'] }),
  pokemon('chinchou', 'Chinchou', 2, 2, 'Electric', 3, 'Special', 5, 'Special Defence', 'Steady'),
  pokemon('quagsire', 'Quagsire', 3, 3, 'Water', 4, 'Physical', 7, 'Defence', 'Slow'),
  pokemon('sneasel', 'Sneasel', 3, 3, 'Dark', 4, 'Physical', 4, 'Hitpoints', 'Swift', { keywords: ['Infiltrator'] }),
  pokemon('sudowoodo', 'Sudowoodo', 3, 3, 'Rock', 3, 'Physical', 8, 'Defence', 'Slow'),
  pokemon('magmar', 'Magmar', 3, 3, 'Fire', 5, 'Special', 6, 'Hitpoints', 'Steady'),
  pokemon('lapras', 'Lapras', 4, 4, 'Water', 5, 'Special', 8, 'Hitpoints', 'Steady'),
  pokemon('arcanine', 'Arcanine', 5, 4, 'Fire', 6, 'Physical', 6, 'Hitpoints', 'Swift'),
];

// The test deck both players use: 40 cards (7a).
export const TEST_DECK = {
  horsea: 4, charmander: 4, bulbasaur: 3, growlithe: 4, oddish: 3, goldeen: 3, ponyta: 3, chinchou: 3,
  quagsire: 3, sneasel: 2, sudowoodo: 2, magmar: 2, lapras: 2, arcanine: 2,
};

export const SPEEDS = ['Slow', 'Steady', 'Swift'];

export function cardDef(id) {
  const c = TEST_POKEMON.find((p) => p.id === id);
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}
