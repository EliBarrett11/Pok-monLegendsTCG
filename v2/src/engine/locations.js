// V2 — Locations as shared lanes (docs/v2-design.md 1.2, 7a). Data only.
//
// A Location card covers 1–3 adjacent lanes on both sides of the board, for a
// number of Rounds (its timer), and carries Weather Tokens. It has one generic
// objective both players work on, each with their own progress:
//
//   objective  { kind, count, text }
//     kind  'summon'    summon a Pokémon into this Location
//           'attack'    attack with a Pokémon in this Location
//           'damage'    damage to the enemy player character (from anywhere)
//           'presence'  have Pokémon in this Location at Supper (progress: the most there so far)
//           'defeat'    defeat an enemy Pokémon (anywhere: your attack, or your hit back in a trade)
//   milestones [{ at, reward }]  reached on the way (each player, once each)
//   completion  reward          for reaching `count` (each player, once)
//
//   reward  { recognition?, energy?, draw? }   +Recognition now · +Energy at the next
//           Breakfast · draw cards now
//
// Test Locations (V2): the real ones come with the v2 decks (design gate). Art is v1's.

export const OBJECTIVES = {
  summon: { inLocation: true },
  attack: { inLocation: true },
  damage: { inLocation: false },
  presence: { inLocation: true, atSupper: true },
  defeat: { inLocation: false },
};

function location(id, name, lanes, rounds, weather, color, objective, milestones, completion, extra = {}) {
  return { id, name, cardType: 'Location', cost: 0, lanes, rounds, weather, color, objective, milestones, completion, ...extra };
}

export const TEST_LOCATIONS = [
  location('cerulean-cape', 'Cerulean Cape', 2, 4, { Rain: 2 }, '#4a9ae8',
    { kind: 'summon', count: 3, text: 'Summon 3 Pokémon into this Location' },
    [{ at: 2, reward: { energy: 1 } }], { recognition: 3 }),
  location('eterna-forest', 'Eterna Forest', 3, 4, { Rain: 1, Sun: 1 }, '#5ec45a',
    { kind: 'attack', count: 5, text: 'Attack 5 times from this Location' },
    [{ at: 2, reward: { draw: 1 } }, { at: 4, reward: { recognition: 1 } }], { recognition: 4 }),
  location('mt-ember', 'Mt. Ember', 1, 3, { Sun: 2 }, '#f08a3a',
    { kind: 'damage', count: 10, text: 'Deal 10 damage to the enemy player' },
    [{ at: 5, reward: { draw: 1 } }], { recognition: 3 }),
  location('route-119', 'Route 119', 3, 5, { Rain: 3 }, '#3ab0c8',
    { kind: 'presence', count: 3, text: 'Have 3 Pokémon in this Location at Supper' },
    [{ at: 2, reward: { energy: 1 } }], { recognition: 4 }),
  location('stark-mountain', 'Stark Mountain', 2, 4, { Sun: 3 }, '#c8603a',
    { kind: 'defeat', count: 3, text: 'Defeat 3 enemy Pokémon' },
    [{ at: 2, reward: { draw: 1 } }], { recognition: 3 }),
];

// The Championship (7a): arrives at the start of Round 10, covers every lane and
// runs to the end of Round 12. Its rewards are large (test values).
export const CHAMPIONSHIP = location('championship', 'The Championship', 9, 3, {}, '#f6d36a',
  { kind: 'attack', count: 9, text: 'Attack 9 times in the Championship' },
  [{ at: 3, reward: { recognition: 3 } }, { at: 6, reward: { recognition: 5 } }],
  { recognition: 8 }, { championship: true, image: 'assets/ui/board-mat.jpg' });

export function locationDef(id) {
  const c = TEST_LOCATIONS.find((l) => l.id === id);
  if (!c) throw new Error(`Unknown Location: ${id}`);
  return c;
}

// A reward in words: "+6 Recognition", "+1 Energy next Round", "draw 1".
export function rewardText(r = {}) {
  return [r.recognition && `+${r.recognition} Recognition`, r.energy && `+${r.energy} Energy next Round`, r.draw && `draw ${r.draw}`]
    .filter(Boolean).join(', ');
}
