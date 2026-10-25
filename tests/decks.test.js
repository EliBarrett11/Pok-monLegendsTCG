// Checks deck construction: 40 cards, copy limits by Rarity (Common 3, Rare 2,
// Epic 1, Legendary 1), at most one Legendary card per deck, and that only the
// four Rarity tiers exist. Run with: node tests/decks.test.js
import assert from 'node:assert/strict';
import { deckProblems, buildDeck, cardDefinition } from '../src/engine/cards.js';
import { RARITIES, MAX_LEGENDARY, PLACEHOLDER_DECKLIST, POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS } from '../src/engine/cardData.js';

assert.deepEqual(Object.keys(RARITIES), ['Common', 'Rare', 'Epic', 'Legendary'], 'four tiers, no Uncommon');
assert.deepEqual(RARITIES, { Common: 3, Rare: 2, Epic: 1, Legendary: 1 });
assert.equal(MAX_LEGENDARY, 1);

// Every card uses one of the four tiers.
for (const c of [...POKEMON_CARDS, ...STRATEGY_CARDS, ...SUPPORTER_CARDS, ...LOCATION_CARDS, ...ITEM_CARDS]) {
  assert.ok(c.rarity in RARITIES, `${c.name}: ${c.rarity}`);
}

// The current deck is valid and builds.
assert.deepEqual(deckProblems(PLACEHOLDER_DECKLIST), []);
assert.equal(buildDeck('player').length, 40);

// A decklist with one card swapped for another, keeping 40 cards.
const swap = (out, inn, n = 1) => {
  const d = { ...PLACEHOLDER_DECKLIST };
  d[out] -= n;
  if (!d[out]) delete d[out];
  d[inn] = (d[inn] ?? 0) + n;
  return d;
};

// Copy limits: Common 3, Rare 2, Epic 1, Legendary 1.
assert.equal(cardDefinition('quickdraw').rarity, 'Common');
assert.deepEqual(deckProblems(swap('cerulean-cape', 'quickdraw')), ['Quickdraw: 4 copies, but a Common card allows 3']);
assert.equal(cardDefinition('recover').rarity, 'Rare');
assert.deepEqual(deckProblems(swap('hypervoice', 'recover')), ['Recover: 3 copies, but a Rare card allows 2']);
assert.equal(cardDefinition('absol').rarity, 'Epic');
assert.deepEqual(deckProblems(swap('hypervoice', 'absol')), ['Absol: 2 copies, but an Epic card allows 1']);
assert.equal(cardDefinition('blaziken').rarity, 'Legendary');
assert.deepEqual(deckProblems(swap('hypervoice', 'blaziken')), [
  'Blaziken: 2 copies, but a Legendary card allows 1',
  '2 Legendary cards, but a deck allows 1',
]);

// At most one Legendary card in a deck. Dragonite became Epic, so the
// placeholder deck keeps a single Legendary (Blaziken).
assert.equal(cardDefinition('dragonite').rarity, 'Epic');
const legendary = Object.keys(PLACEHOLDER_DECKLIST).filter((id) => cardDefinition(id).rarity === 'Legendary');
assert.deepEqual(legendary, ['blaziken'], 'exactly one Legendary in the current deck');

// Wrong size.
assert.deepEqual(deckProblems({ ...PLACEHOLDER_DECKLIST, quickdraw: 2 }), ['Deck must have 40 cards (has 39)']);
assert.throws(() => buildDeck('player', { ...PLACEHOLDER_DECKLIST, quickdraw: 2 }), /Invalid deck/);

// The old Uncommon cards: 2–3 copies became Common, 1 copy became Rare.
assert.equal(cardDefinition('hypervoice').rarity, 'Common');
for (const id of ['pidgey', 'metapod', 'goldeen', 'magmar', 'professor-oak', 'floaroma-meadow', 'shalour-city', 'oran-berry', 'amulet-coin', 'rose-incense']) {
  assert.equal(cardDefinition(id).rarity, 'Rare', id);
}

console.log('All deck construction tests passed.');
