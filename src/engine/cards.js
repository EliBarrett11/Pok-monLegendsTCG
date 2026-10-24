// Builds decks and Trainers from the card definitions in cardData.js.

import {
  POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS, OTHER_CARDS, PLACEHOLDER_DECKLIST, TRAINER_CARDS,
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

// Each card in play is a copy of its definition with its own uid.
export function buildDeck(owner, decklist = PLACEHOLDER_DECKLIST) {
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
