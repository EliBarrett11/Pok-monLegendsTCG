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
  perDominance: 3,        // Recognition at Supper for dominating a placed Location (G1: was 1)
  perFavour: 3,           // Recognition for completing a Supporter's Favour (G1: was 1)
  perObjective: 2,        // Recognition for completing a Trainer Objective (starting value)
  dollarsPerRound: 1,     // PokéDollars at each Breakfast
  dollarsPerDefeat: 1,    // PokéDollars for each enemy Pokémon defeated, Partners included (G1: was its cost)
  // The Pokémon League Tournament (F5; Elliott's starting values): it begins at Breakfast in this
  // Round, or at the first Breakfast where either player has this much Recognition, whichever first.
  tournamentRound: 10,
  tournamentRecognition: 70,
  perTournamentDominance: 5,   // Recognition at Supper for dominating the Tournament (before its passive; G1: was 3)
};
// The three development series (section 4A): Level range.
export const SERIES_RANGE = { Light: [1, 6], Mid: [2, 7], Heavy: [3, 8] };
export const SPEEDS = ['Slow', 'Steady', 'Swift'];
// Level off the battlefield: the series' first Level in Round 1, +1 each Round, up to its maximum.
export const levelFor = (series, round) => Math.min(SERIES_RANGE[series][0] + round - 1, SERIES_RANGE[series][1]);
// Cost by Level (G1, gameplay update 2.3): half the Level, rounded up, one curve for every series:
// Level 1–2 → 1, 3–4 → 2, 5–6 → 3, 7–8 → 4. Nothing is free; in any Round a Heavy card (2 Levels above
// a Light one) costs about 1 more Energy. Partners are Level 8, cost 4.
export const costFor = (level) => Math.ceil(level / 2);
