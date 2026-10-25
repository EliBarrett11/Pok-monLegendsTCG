// Builds decks and Trainers from the card definitions in cardData.js.

import {
  POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS, OTHER_CARDS, PLACEHOLDER_DECKLIST, TRAINER_CARDS,
  RARITIES, MAX_LEGENDARY,
} from './cardData.js';

export const CARD_TYPES = ['Pokémon', 'Strategy', 'Item', 'Location', 'Supporter'];

export const DECK_SIZE = 40;

const DEFINITIONS = Object.fromEntries([...POKEMON_CARDS, ...STRATEGY_CARDS, ...SUPPORTER_CARDS, ...LOCATION_CARDS, ...ITEM_CARDS, ...OTHER_CARDS]
  .map((c) => [c.id, c]));

export function cardDefinition(id) {
  const def = DEFINITIONS[id];
  if (!def) throw new Error(`Unknown card: ${id}`);
  return def;
}

// What's wrong with a decklist ({ id: copies }), as a list of messages:
// 40 cards; copies per card within its Rarity's limit (Common 3, Rare 2,
// Epic 1, Legendary 1); at most one Legendary card in the whole deck.
export function deckProblems(decklist) {
  const problems = [];
  const total = Object.values(decklist).reduce((sum, n) => sum + n, 0);
  if (total !== DECK_SIZE) problems.push(`Deck must have ${DECK_SIZE} cards (has ${total})`);
  let legendary = 0;
  for (const [id, copies] of Object.entries(decklist)) {
    const card = cardDefinition(id);
    const limit = RARITIES[card.rarity];
    if (limit === undefined) problems.push(`${card.name}: unknown Rarity "${card.rarity}"`);
    else if (copies > limit) problems.push(`${card.name}: ${copies} copies, but ${/^[AEIOU]/.test(card.rarity) ? 'an' : 'a'} ${card.rarity} card allows ${limit}`);
    if (card.rarity === 'Legendary') legendary += copies;
  }
  if (legendary > MAX_LEGENDARY) problems.push(`${legendary} Legendary cards, but a deck allows ${MAX_LEGENDARY}`);
  return problems;
}

// Each card in play is a copy of its definition with its own uid.
export function buildDeck(owner, decklist = PLACEHOLDER_DECKLIST) {
  const problems = deckProblems(decklist);
  if (problems.length) throw new Error(`Invalid deck: ${problems.join('; ')}`);
  const cards = [];
  for (const [id, copies] of Object.entries(decklist)) {
    for (let i = 1; i <= copies; i++) {
      cards.push({ ...cardDefinition(id), uid: `${owner}-${id}-${i}` });
    }
  }
  if (cards.length !== DECK_SIZE) throw new Error(`Deck must have ${DECK_SIZE} cards`);
  return cards;
}

// The PokéMart's starting stock: one copy of every Item in the game.
export function buildMartStock() {
  return ITEM_CARDS.map((def) => ({ ...structuredClone(def), uid: `mart-${def.id}` }));
}

// Each player's 3 Trainers, as copies of the Trainer definitions.
// maxStrength is the starting Strength, the cap for healing.
export function buildTrainers(owner) {
  return TRAINER_CARDS.map((def) => ({
    ...structuredClone(def),
    uid: `${owner}-trainer-${def.id}`,
    maxStrength: def.strength,
    powerUsedRound: null,
  }));
}
