// B3-1: the deck rules (docs/base-game-plan.md section 2, decided by Elliott) and the four Batch 1 test decks, which
// replace the old demo deck until the deck builder (B4) arrives. Pure: no DOM.
import { pathDef, trainerDef, cardKind, isCardId } from './cards.js?v=202611131336';

export const DECK_RULES = { size: 40, copies: 2, legendaryCopies: 1, trainerCopies: 1, maxTrainers: 3 };

// The reasons a deck breaks the rules, in plain words ([] when it's legal):
// exactly 40 cards; at most 2 copies of a card; a Legendary at most 1 copy (any number of different Legendaries);
// 0–3 Trainers, 1 copy each (docs/base-game-plan.md section 2); any number of Locations; no Type limit.
export function validateDeck(list) {
  const out = [];
  if (list.length !== DECK_RULES.size) out.push(`The deck has ${list.length} cards: it needs exactly ${DECK_RULES.size}.`);
  const counts = new Map();
  for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (!isCardId(id)) { out.push(`"${id}" isn't a card.`); continue; }
    const legendary = pathDef(id)?.legendary;
    const trainer = cardKind(id) === 'Trainer';
    const max = legendary ? DECK_RULES.legendaryCopies : trainer ? DECK_RULES.trainerCopies : DECK_RULES.copies;
    const name = pathDef(id)?.forms[0].name ?? trainerDef(id)?.name ?? id;
    if (n > max) out.push(legendary ? `${name} is a Legendary: at most 1 copy (the deck has ${n}).` : trainer ? `${name} is a Trainer: at most 1 copy (the deck has ${n}).` : `${name}: at most ${max} copies (the deck has ${n}).`);
  }
  const trainers = list.filter((id) => cardKind(id) === 'Trainer').length;
  if (trainers > DECK_RULES.maxTrainers) out.push(`The deck has ${trainers} Trainers: at most ${DECK_RULES.maxTrainers}.`);
  return out;
}

const x2 = (...ids) => ids.flatMap((id) => [id, id]);
// The four Batch 1 decks (the B3-1 prompt). As written there, Blaine's Blitz, Erika's Garden and Surge's Storm have 39
// cards; each gets one more so it passes the 40-card rule, matching Misty's Tide's shape (15 Pokémon, 8 Moves):
// Blaine's Blitz a second Magby, Erika's Garden a second Protect, Surge's Storm a Protect (marked "B3-1: +1").
export const DECKS = {
  'blaines-blitz': {
    name: 'Blaine\'s Blitz',
    list: ['blaine', 'lt-surge', 'mt-ember', 'cinnabar-volcano', 'power-plant', 'route-119',
      ...x2('ponyta', 'growlithe', 'charmander'), 'magby', 'magby' /* B3-1: +1 */, ...x2('pichu', 'shinx'), 'chinchou', 'entei', 'zapdos',
      ...x2('ember'), 'flame-charge', 'heat-wave', ...x2('thunderbolt'), 'thunder-wave', 'protect',
      'flannery', 'firebreather', 'chili', 'kabu', 'tracey',
      'x-attack', 'charcoal', 'magnet', 'quick-claw', 'choice-band', 'oran-berry'],
  },
  'mistys-tide': {
    name: 'Misty\'s Tide',
    list: ['misty', 'whitney', 'cerulean-cape', 'lake-of-rage', 'floaroma-meadow', 'pallet-town',
      ...x2('squirtle', 'wooper', 'horsea', 'magikarp', 'happiny', 'munchlax'), 'meowth', 'eevee', 'kyogre',
      ...x2('surf'), 'bubble-beam', ...x2('dive', 'recover'), 'protect',
      'nurse-joy', 'swimmer', 'fisherman', 'crasher-wake', 'wallace',
      'mystic-water', 'leftovers', 'potion', 'sitrus-berry', 'rocky-helmet', 'amulet-coin'],
  },
  'erikas-garden': {
    name: 'Erika\'s Garden',
    list: ['erika', 'eterna-forest', 'floaroma-meadow', 'pallet-town', 'route-119',
      ...x2('bulbasaur', 'oddish', 'sunkern', 'budew', 'eevee'), 'happiny', 'munchlax', ...x2('meowth'), 'celebi',
      ...x2('leech-seed', 'solar-beam', 'recover'), 'protect', 'protect' /* B3-1: +1 */,
      'ramos', 'gardenia', 'brock', 'professor-oak', 'pokemon-breeder',
      'miracle-seed', 'leftovers', 'super-potion', 'sitrus-berry', 'oran-berry', 'quick-claw', 'x-attack'],
  },
  'surges-storm': {
    name: 'Surge\'s Storm',
    list: ['lt-surge', 'misty', 'power-plant', 'cerulean-cape', 'route-119', 'mt-ember',
      ...x2('mareep', 'chinchou', 'pichu', 'shinx'), 'horsea', ...x2('magikarp'), 'squirtle', 'eevee', 'zapdos', 'kyogre',
      ...x2('thunderbolt', 'thunder-wave'), 'surf', 'dive', 'bubble-beam', 'protect' /* B3-1: +1 */,
      'tracey', 'professor-oak', 'swimmer', 'nurse-joy', 'pokemon-breeder',
      'magnet', 'mystic-water', 'quick-claw', 'x-attack', 'potion', 'amulet-coin'],
  },
};
export const DECK_IDS = Object.keys(DECKS);
// A deck by name: its id ('blaines-blitz') or a short name ('blaine', 'misty', 'erika', 'surge').
export function deckByName(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().replace(/[^a-z]/g, '');
  return DECK_IDS.find((id) => id.replace(/[^a-z]/g, '') === key || id.replace(/[^a-z]/g, '').startsWith(key)) ?? null;
}
