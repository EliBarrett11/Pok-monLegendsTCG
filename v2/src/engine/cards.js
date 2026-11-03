import { TEST_LOCATIONS } from './locations.js';
import { SERIES, seriesDef, pokemonAt } from './series.js';
import { DECK_SIZE, COPY_LIMITS, LEGENDARY_PER_DECK, MAX_LEVEL, levelFor } from './rules.js';

// V3: a deck is a list of cards. A Pokémon card is a series plus a chosen cap (the
// highest Level it trains to): { series, cap }. A Location card is { location: id }.
// In a match a Pokémon card's Level = the Round number, up to its cap (series.js has
// each Level's stats); once played it stays at that Level.

// The premade test deck both players use by default: 40 cards (7a): 34 Pokémon in
// 14 series, each with its own caps, and 6 test Locations.
const caps = (series, ...list) => list.map((cap) => ({ series, cap }));
export const TEST_DECK = [
  ...caps('horsea', 2, 4, 6), ...caps('growlithe', 3, 6, 6), ...caps('oddish', 2, 4, 6), ...caps('chansey', 3, 6),
  ...caps('kyogre', 7), ...caps('charmander', 3, 5, 6), ...caps('bulbasaur', 2, 4, 6), ...caps('goldeen', 3, 4, 6),
  ...caps('ponyta', 3, 5, 6), ...caps('chinchou', 3, 6), ...caps('wooper', 3, 5, 6), ...caps('sudowoodo', 4, 6),
  ...caps('sneasel', 3, 6), ...caps('magmar', 5),
  ...['cerulean-cape', 'cerulean-cape', 'eterna-forest', 'mt-ember', 'route-119', 'stark-mountain'].map((location) => ({ location })),
];

export const SPEEDS = ['Slow', 'Steady', 'Swift'];

// A card as it is at a Round (before it is played): a Pokémon at Level = Round up to its cap.
export function cardAt(entry, round = 1) {
  if (entry.location) return locationCard(entry.location);
  return { ...pokemonAt(entry.series, levelFor(round, entry.cap)), cap: entry.cap };
}
const locationCard = (id) => {
  const loc = TEST_LOCATIONS.find((l) => l.id === id);
  if (!loc) throw new Error(`Unknown Location: ${id}`);
  return loc;
};

// For tests and tools: a card by series, species or Location id. A species gives its
// line at that stage's first Level (or `level`); the cap defaults to the line's top.
export function cardDef(id, level) {
  const loc = TEST_LOCATIONS.find((l) => l.id === id);
  if (loc) return loc;
  const line = SERIES.find((l) => l.id === id) ?? SERIES.find((l) => l.stages.some((st) => slugOf(st.name) === id));
  if (!line) throw new Error(`Unknown card: ${id}`);
  const stage = line.stages.find((st) => slugOf(st.name) === id) ?? line.stages[0];
  return { ...pokemonAt(line, level ?? stage.from), cap: line.maxLevel };
}
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Copy slots used per series (each card in a series uses 1 slot of its rarity) and
// per Location.
export function copiesOf(deck) {
  const out = {};
  for (const e of deck) {
    const key = e.location ?? e.series;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export const copyLimit = (key) => {
  const line = SERIES.find((l) => l.id === key);
  const rarity = line ? line.rarity : (TEST_LOCATIONS.find((l) => l.id === key)?.rarity ?? 'Common');
  return COPY_LIMITS[rarity];
};

// What's wrong with a deck, as a list of messages (empty: it can be used).
export function deckProblems(deck) {
  const problems = [];
  if (!Array.isArray(deck)) return ['A deck is a list of cards'];
  if (deck.length !== DECK_SIZE) problems.push(`A deck has ${DECK_SIZE} cards (this one has ${deck.length})`);
  for (const e of deck) {
    if (e.location) {
      if (!TEST_LOCATIONS.some((l) => l.id === e.location)) problems.push(`Unknown Location: ${e.location}`);
      continue;
    }
    const line = SERIES.find((l) => l.id === e.series);
    if (!line) { problems.push(`Unknown series: ${e.series}`); continue; }
    const top = line.legendary ? line.maxLevel : MAX_LEVEL;
    if (!(Number.isInteger(e.cap) && e.cap >= 1 && e.cap <= top)) problems.push(`${line.stages[0].name}: the cap must be a Level from 1 to ${top} (not ${e.cap})`);
  }
  for (const [key, n] of Object.entries(copiesOf(deck))) {
    const known = SERIES.some((l) => l.id === key) || TEST_LOCATIONS.some((l) => l.id === key);
    if (known && n > copyLimit(key)) problems.push(`${nameOf(key)}: ${n} cards, but its rarity allows ${copyLimit(key)}`);
  }
  const legendaries = deck.filter((e) => SERIES.find((l) => l.id === e.series)?.legendary).length;
  if (legendaries > LEGENDARY_PER_DECK) problems.push(`At most ${LEGENDARY_PER_DECK} Legendary card in a deck (this one has ${legendaries})`);
  return problems;
}

const nameOf = (key) => {
  const line = SERIES.find((l) => l.id === key);
  return line ? `${line.stages.map((st) => st.name).join('/')} (${line.rarity})` : TEST_LOCATIONS.find((l) => l.id === key)?.name ?? key;
};

export { SERIES, seriesDef };
