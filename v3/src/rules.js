// v3's numbers, all in one place so they're easy to tune (docs/v3-foundations.md; the
// starting values Elliott approved for V3-0). Nothing here comes from v1 or v2 unless the
// foundations say so.

export const RULES = {
  // The board: 10 spaces per side; Pallet Town (2 lanes) starts on spaces 1–2.
  spaces: 10,
  startLocation: 'pallet-town',
  // A new Location every Round from this Round on (at Breakfast). Locations fill the board
  // from the left; once all 10 spaces are covered, a new Location pushes the others left by
  // its width (Elliott, V3-0), and any that fall off the left are removed.
  newLocationFrom: 2,
  // The Regional Championship arrives as this Location (Pallet Town is the 1st), if no one
  // has reached the Trophy. It covers every space and lasts this many Rounds; at its end the
  // higher Recognition is crowned Champion (a tie plays on, Round by Round, up to the limit).
  championshipAs: 10,
  championshipRounds: 2,
  championshipTieRounds: 3,

  // Recognition.
  win: 100,                 // the Trophy (the portrait reaches it on space 10)
  perSpace: 10,             // a portrait moves one space right per 10 Recognition
  passivePerRound: 2,       // at each Breakfast (from Round 2)
  perDefeat: 2,             // for defeating an enemy Pokémon
  perDamageToPlayer: 1,     // per damage to the enemy player character
  deckOut: 3,               // each draw you can't make gives the opponent 3, then 6, then 9…

  // Energy: the Round number, capped; Pass gives +1. No stored Energy.
  energyCap: 10,
  passEnergy: 1,
  // Overexert: once per Round, spend up to 2 Energy you don't have; at the next Breakfast
  // you get that much less, plus 1 (borrow 2, lose 3).
  overexertMax: 2,
  overexertPenalty: 1,

  // Hand and deck.
  deckSize: 40,
  openingHand: 6,
  drawPerRound: 2,
  handLimit: 10,            // a card drawn beyond it is lost (to the Released Pile)
  mulligans: 1,             // Round 1: shuffle the hand back and draw 6 again

  // Pokémon: Level 1–6, Level = the Round up to its cap while off the board; frozen when played.
  maxLevel: 6,
  // Cost by band: Level 1 = the band's lowest cost, +1 per Level.
  costBands: { Light: 0, Medium: 1, Heavy: 2 },
};

export const SPEEDS = ['Slow', 'Steady', 'Swift'];
export const levelFor = (round, cap) => Math.max(1, Math.min(round, cap, RULES.maxLevel));
export const costFor = (band, level) => RULES.costBands[band] + level - 1;
export const energyFor = (round) => Math.min(round, RULES.energyCap);
export const portraitSpace = (recognition) => Math.floor(recognition / RULES.perSpace); // 0-based space index (≥10 = the Trophy)
