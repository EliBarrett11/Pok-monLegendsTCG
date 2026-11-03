// v2 rules: the numbers the v2 design has settled so far (docs/v2-design.md).
// Pure data and functions, no DOM. V1 onward builds the engine around these.
// The match-length numbers are Claude's starting picks (7a): Elliott tests them,
// and the balance tool tunes them (V7).

// The board: each side one row of 9 spaces, facing each other: 9 lanes (1.1).
export const LANES = 9;

// End of the match (7a): reach the Recognition target to win at once; otherwise the
// Championship arrives at the start of its Round and covers every lane, and after
// the Round limit the highest Recognition wins.
export const RECOGNITION_TARGET = 60;
export const ROUND_LIMIT = 12;
export const CHAMPIONSHIP_ROUND = 10;

// Training (4): a card's Level is the Round number, up to its training cap (1–6);
// Level 7 is for Legendaries only.
export const MAX_LEVEL = 6;
export const LEGENDARY_LEVEL = 7;
export const levelFor = (round, cap) => Math.max(1, Math.min(round, cap));

// The cost curve (6.1, liked) and weight classes (7a, approved): light −1,
// standard 0, heavy +1 or +2. Never below 1.
export const COST_CURVE = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3, 6: 4, 7: 5 };
export const WEIGHT_CLASSES = { light: -1, standard: 0, heavy: 1, 'very heavy': 2 };
export function costFor(level, weight = 'standard') {
  if (!(level in COST_CURVE)) throw new Error(`No Level ${level}`);
  if (!(weight in WEIGHT_CLASSES)) throw new Error(`No weight class "${weight}"`);
  return Math.max(1, COST_CURVE[level] + WEIGHT_CLASSES[weight]);
}

// The deck (7a): 40 cards for the first build.
export const DECK_SIZE = 40;

// Energy (6, 6.2): no Exert. Base Energy is the Round number, up to 10. Up to 1
// unspent Energy is stored into the next Round. A Pass gains +1 (not the Pass that
// ends the Battle Phase).
export const MAX_BASE_ENERGY = 10;
export const STORE_LIMIT = 1;
export const PASS_ENERGY = 1;
export const baseEnergyFor = (round) => Math.min(round, MAX_BASE_ENERGY);

// Breakfast draws up to this many cards in hand.
export const HAND_SIZE = 7;
