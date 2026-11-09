// v4's numbers in one place (docs/v4-foundation-spec.md; values not set by the spec are
// listed in v4/FOUNDATION_ASSUMPTIONS.md).
export const RULES = {
  lanes: 9,               // the battlefield: 9 lanes, one space per player each (section 16)
  handDraw: 7,            // draw at Breakfast, as in v1 (less one per Retained card)
  retainCost: 1,          // Retain: 1 Energy to keep a card in hand through Supper
  win: 100,               // Recognition to become Pokémon League Champion
  perDamageToPlayer: 1,   // Recognition per damage to the enemy Player Character
  perDefeat: 2,           // Recognition for defeating an enemy Pokémon (starting value)
  passEnergy: 1,          // Pass: +1 Base Energy (not the Pass that ends the Battle Phase)
};
// The three development series (section 4A): Level range.
export const SERIES_RANGE = { Light: [1, 6], Mid: [2, 7], Heavy: [3, 8] };
export const SPEEDS = ['Slow', 'Steady', 'Swift'];
// Level off the battlefield: the series' first Level in Round 1, +1 each Round, up to its maximum.
export const levelFor = (series, round) => Math.min(SERIES_RANGE[series][0] + round - 1, SERIES_RANGE[series][1]);
// Cost by Level (one curve for every series): Level 1 → 0, 2–3 → 1, 4–5 → 2, 6–7 → 3, 8 → 4.
// A Mid Pokémon reaches Level L in Round L−1, when Base Energy is L−1: it costs about half of it.
export const costFor = (level) => Math.ceil((level - 1) / 2);
