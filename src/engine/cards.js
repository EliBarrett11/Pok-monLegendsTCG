// Card types and placeholder decks. Real cards replace these once assets arrive.

export const CARD_TYPES = ['Pokémon', 'Strategy', 'Item', 'Location', 'Supporter'];

export const DECK_SIZE = 40;

// Placeholder mix of card types. Not a design decision, just something to play with.
const PLACEHOLDER_MIX = {
  'Pokémon': 16,
  'Strategy': 8,
  'Item': 8,
  'Location': 4,
  'Supporter': 4,
};

export function placeholderDeck(owner) {
  const cards = [];
  for (const [type, count] of Object.entries(PLACEHOLDER_MIX)) {
    for (let i = 1; i <= count; i++) {
      cards.push({
        uid: `${owner}-${type}-${i}`,
        name: `${type} ${i}`,
        type,
      });
    }
  }
  if (cards.length !== DECK_SIZE) throw new Error(`Deck must have ${DECK_SIZE} cards`);
  return cards;
}

export function placeholderTrainers(owner) {
  return ['A', 'B', 'C'].map((letter) => ({
    uid: `${owner}-trainer-${letter}`,
    name: `Trainer ${letter}`,
    type: 'Trainer',
  }));
}
