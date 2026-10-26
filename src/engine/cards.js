// Builds decks and Trainers from the card definitions in cardData.js.

import {
  POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS, TRAINER_CARDS,
  RARITIES, MAX_LEGENDARY, DECKS, DECK_SPLIT,
} from './cardData.js';

export const CARD_TYPES = ['Pokémon', 'Strategy', 'Item', 'Location', 'Supporter'];

export const DECK_SIZE = 40;

const DEFINITIONS = Object.fromEntries([...POKEMON_CARDS, ...STRATEGY_CARDS, ...SUPPORTER_CARDS, ...LOCATION_CARDS, ...ITEM_CARDS]
  .map((c) => [c.id, c]));
const TRAINERS = Object.fromEntries(TRAINER_CARDS.map((t) => [t.id, t]));

export function cardDefinition(id) {
  const def = DEFINITIONS[id];
  if (!def) throw new Error(`Unknown card: ${id}`);
  return def;
}

// What's wrong with a decklist ({ id: copies }), as a list of messages:
// 40 cards; the standard split by Card-Type (18 Pokémon, 8 Strategy, 4
// Supporter, 4 Location, 6 Item); copies per card within its Rarity's limit
// (Common 3, Rare 2, Epic 1, Legendary 1); at most one Legendary card.
export function deckProblems(decklist) {
  const problems = [];
  const total = Object.values(decklist).reduce((sum, n) => sum + n, 0);
  if (total !== DECK_SIZE) problems.push(`Deck must have ${DECK_SIZE} cards (has ${total})`);
  const byType = {};
  for (const [id, copies] of Object.entries(decklist)) {
    const type = cardDefinition(id).cardType;
    byType[type] = (byType[type] ?? 0) + copies;
  }
  for (const [type, want] of Object.entries(DECK_SPLIT)) {
    if ((byType[type] ?? 0) !== want) problems.push(`${type} cards: ${byType[type] ?? 0}, but a deck has ${want}`);
  }
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

// A deck by id ('fire', 'water'), checked.
export function deckDefinition(id) {
  const deck = DECKS[id];
  if (!deck) throw new Error(`Unknown deck: ${id}`);
  return deck;
}

// Throws on the first deck that breaks the construction rules, naming it and
// every problem. Every deck is checked as the game loads: a broken deck fails loudly.
export function checkDecks(decks) {
  for (const deck of Object.values(decks)) {
    const problems = deckProblems(deck.list);
    if (deck.trainers.length !== 3 || deck.trainers.some((t) => !TRAINERS[t])) problems.push('a deck has exactly 3 known Trainers');
    if (problems.length) throw new Error(`Invalid ${deck.name} deck: ${problems.join('; ')}`);
  }
}
checkDecks(DECKS);

// Each card in play is a copy of its definition with its own uid.
// deck: a deck id, or a decklist ({ id: copies }).
export function buildDeck(owner, deck = 'fire') {
  const decklist = typeof deck === 'string' ? deckDefinition(deck).list : deck;
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

// A player's 3 Trainers (their deck's), as copies of the Trainer definitions.
// maxStrength is the starting Strength, the cap for healing.
export function buildTrainers(owner, deck = 'fire') {
  return deckDefinition(deck).trainers.map((id) => TRAINERS[id]).map((def) => ({
    ...structuredClone(def),
    uid: `${owner}-trainer-${def.id}`,
    maxStrength: def.strength,
    powerUsedRound: null,
  }));
}
