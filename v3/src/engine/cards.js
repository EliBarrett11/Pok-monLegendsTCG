// V3-0's generic test cards (docs/v3-foundations.md: "If it's not fun with bad cards, it's not
// fun with great decks"). Plain names; the art is borrowed from assets/cards as placeholders.
// Data only: game.js resolves them.
import { costFor, levelFor } from '../rules.js';

// --- Pokémon: a series is one card, Level 1–6. stats[i] = [Attack, Strength] at Level i+1. ----
// band: Light (cost 0–5), Medium (1–6), Heavy (2–7). guard: 'Defence' | 'Special Defence' | null.
const series = (id, name, art, band, speed, attackType, guard, stats) => ({ id, name, art, band, speed, attackType, guard, stats });
export const SERIES = [
  series('swift-striker', 'Swift Striker', 'ponyta', 'Light', 'Swift', 'Physical', null, [[2, 2], [3, 2], [3, 3], [4, 3], [5, 4], [5, 5]]),
  series('ember-pup', 'Ember Pup', 'growlithe', 'Light', 'Steady', 'Special', null, [[1, 3], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6]]),
  series('sprout', 'Sprout', 'oddish', 'Light', 'Slow', 'Special', null, [[1, 4], [1, 5], [2, 6], [3, 6], [3, 7], [4, 8]]),
  series('shell-guard', 'Shell Guard', 'squirtle', 'Medium', 'Slow', 'Physical', 'Defence', [[1, 5], [2, 6], [2, 7], [3, 8], [3, 10], [4, 11]]),
  series('mist-warden', 'Mist Warden', 'chinchou', 'Medium', 'Steady', 'Special', 'Special Defence', [[2, 4], [2, 5], [3, 6], [3, 7], [4, 8], [5, 9]]),
  series('river-runner', 'River Runner', 'horsea', 'Medium', 'Steady', 'Special', null, [[2, 3], [3, 4], [4, 5], [5, 5], [6, 6], [7, 7]]),
  series('storm-wing', 'Storm Wing', 'wingull', 'Medium', 'Swift', 'Special', null, [[2, 3], [3, 3], [4, 4], [5, 4], [6, 5], [6, 6]]),
  series('iron-brute', 'Iron Brute', 'machamp-placeholder', 'Heavy', 'Slow', 'Physical', null, [[3, 5], [4, 6], [5, 8], [7, 9], [8, 10], [9, 12]]),
  series('flame-titan', 'Flame Titan', 'magmar', 'Heavy', 'Steady', 'Special', null, [[3, 4], [4, 5], [5, 6], [6, 8], [8, 9], [9, 10]]),
  series('rock-hound', 'Rock Hound', 'houndour', 'Heavy', 'Swift', 'Physical', null, [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]]),
];
SERIES.find((s) => s.id === 'iron-brute').art = 'primeape';
// Viridian Forest's wild Pokémon (summoned by the Location, not in a deck).
export const WILD = series('wild-bug', 'Wild Bug', 'sewaddle', 'Light', 'Slow', 'Physical', null, [[1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3]]);

export const seriesDef = (id) => (id === WILD.id ? WILD : SERIES.find((s) => s.id === id));

// A Pokémon card at a Level (off the board: Level = the Round, up to its cap).
export function pokemonAt(id, level, cap = 6) {
  const s = seriesDef(id);
  const [attack, strength] = s.stats[level - 1];
  return {
    id: s.id, series: s.id, name: s.name, cardType: 'Pokémon', art: s.art, band: s.band, speed: s.speed, attackType: s.attackType,
    strengthType: s.guard ?? 'Hitpoints', level, cap, cost: costFor(s.band, level), attack, strength,
  };
}

// --- Moves: breakpoints; each higher one gives more value per Energy. ----------------------------
// target: { side: 'enemy' | 'friendly', kinds: ['pokemon', 'player'] } (one target), or none.
const ENEMY = { side: 'enemy', kinds: ['pokemon', 'player'] };
export const MOVES = [
  { id: 'quick-strike', name: 'Quick Strike', cardType: 'Move', art: 'thunderbolt', breakpoints: [
    { cost: 1, text: '2 damage to an enemy Pokémon or the enemy player', target: ENEMY, ops: [{ op: 'damage', amount: 2 }] },
    { cost: 3, text: '7 damage to an enemy Pokémon or the enemy player', target: ENEMY, ops: [{ op: 'damage', amount: 7 }] },
    { cost: 5, text: '13 damage to an enemy Pokémon or the enemy player', target: ENEMY, ops: [{ op: 'damage', amount: 13 }] },
  ] },
  { id: 'patch-up', name: 'Patch Up', cardType: 'Move', art: 'recover', breakpoints: [
    { cost: 1, text: 'Heal 3 one of your Pokémon', target: { side: 'friendly', kinds: ['pokemon'], damaged: true }, ops: [{ op: 'heal', amount: 3 }] },
    { cost: 3, text: 'Heal 11 one of your Pokémon', target: { side: 'friendly', kinds: ['pokemon'], damaged: true }, ops: [{ op: 'heal', amount: 11 }] },
    { cost: 5, text: 'Heal 10 every one of your Pokémon', ops: [{ op: 'healAll', amount: 10 }] },
  ] },
  { id: 'study', name: 'Study', cardType: 'Move', art: 'quickdraw', breakpoints: [
    { cost: 1, text: 'Draw 1', ops: [{ op: 'draw', amount: 1 }] },
    { cost: 3, text: 'Draw 4', ops: [{ op: 'draw', amount: 4 }] },
    { cost: 5, text: 'Draw 7', ops: [{ op: 'draw', amount: 7 }] },
  ] },
  { id: 'show-off', name: 'Show Off', cardType: 'Move', art: 'hypervoice', breakpoints: [
    { cost: 2, text: '+2 Recognition', ops: [{ op: 'recognition', amount: 2 }] },
    { cost: 4, text: '+5 Recognition', ops: [{ op: 'recognition', amount: 5 }] },
    { cost: 6, text: '+9 Recognition', ops: [{ op: 'recognition', amount: 9 }] },
  ] },
];

// --- Supporters: Release other cards from your hand; the Favour improves them. -------------------
export const FAVOURS = {
  bigPokemon: { text: 'a Pokémon of Level 4 or more', test: (c) => c.cardType === 'Pokémon' && c.level >= 4 },
  swift: { text: 'a Swift Pokémon', test: (c) => c.cardType === 'Pokémon' && c.speed === 'Swift' },
};
export const SUPPORTERS = [
  { id: 'professor', name: 'Professor', cardType: 'Supporter', art: 'professor-oak', release: 1,
    text: 'Draw 3', ops: [{ op: 'draw', amount: 3 }],
    favour: { condition: 'bigPokemon', text: 'Draw 3 and +3 Recognition', ops: [{ op: 'draw', amount: 3 }, { op: 'recognition', amount: 3 }] } },
  { id: 'rival', name: 'Rival', cardType: 'Supporter', art: 'brock', release: 2,
    text: '5 damage to an enemy Pokémon or the enemy player', target: ENEMY, ops: [{ op: 'damage', amount: 5 }],
    favour: { condition: 'swift', text: '9 damage instead', ops: [{ op: 'damage', amount: 9 }] } },
];

export const cardById = (id) => MOVES.find((c) => c.id === id) ?? SUPPORTERS.find((c) => c.id === id) ?? null;

// The test deck (both players): 26 Pokémon, 10 Moves, 4 Supporters = 40.
export const TEST_DECK = [
  ...['swift-striker', 'ember-pup'].flatMap((id) => [{ series: id, cap: 4 }, { series: id, cap: 4 }, { series: id, cap: 6 }]),
  { series: 'sprout', cap: 4 }, { series: 'sprout', cap: 6 },
  ...['shell-guard', 'mist-warden', 'river-runner', 'storm-wing'].flatMap((id) => [{ series: id, cap: 6 }, { series: id, cap: 6 }, { series: id, cap: 5 }]),
  ...['iron-brute', 'flame-titan', 'rock-hound'].flatMap((id) => [{ series: id, cap: 6 }, { series: id, cap: 6 }]),
  ...[['quick-strike', 3], ['patch-up', 2], ['study', 3], ['show-off', 2]].flatMap(([id, n]) => Array(n).fill({ card: id })),
  ...[['professor', 2], ['rival', 2]].flatMap(([id, n]) => Array(n).fill({ card: id })),
];

// A deck entry as a card at a Round.
export function cardAt(entry, round = 1) {
  if (entry.series) return pokemonAt(entry.series, levelFor(round, entry.cap), entry.cap);
  return structuredClone(cardById(entry.card));
}
