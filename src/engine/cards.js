// Builds decks and Trainers from the card definitions in cardData.js.

import { POKEMON_CARDS, OTHER_CARDS, PLACEHOLDER_DECKLIST } from './cardData.js';

export const CARD_TYPES = ['Pokémon', 'Strategy', 'Item', 'Location', 'Supporter'];

export const DECK_SIZE = 40;

const DEFINITIONS = Object.fromEntries([...POKEMON_CARDS, ...OTHER_CARDS].map((c) => [c.id, c]));

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

// Placeholder until real Trainer cards arrive.
export const PLACEHOLDER_TRAINER_STRENGTH = 15;

export function placeholderTrainers(owner) {
  return ['A', 'B', 'C'].map((letter) => ({
    uid: `${owner}-trainer-${letter}`,
    name: `Trainer ${letter}`,
    cardType: 'Trainer',
    strength: PLACEHOLDER_TRAINER_STRENGTH,
  }));
}
