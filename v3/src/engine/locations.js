// V3-0's Locations: the game controls them (docs/v3-foundations.md). Each has a width (1–3
// lanes), an objective that belongs to its identity, milestones (rewards given at once) and a
// completion reward (given when the Location expires, to each player who completed it). Some
// have an effect while on the board. Six simple test Locations, Pallet Town and the Regional
// Championship. Art is borrowed from assets/cards. Data only.
//
// Objective kinds (counted for each player's Pokémon standing in the Location's lanes):
//   summon        summon a Pokémon here
//   attack        attack with a Pokémon here
//   damagePlayer  damage dealt to the enemy player by your Pokémon here
//   defeat        enemy Pokémon defeated by your Pokémon here (its attack, or hitting back)
//   presence      have at least one Pokémon here at Supper
// Rewards: { recognition, draw, energyNext }.
// Effects: 'wild' (each Move you play summons a Wild Bug into an empty space here on your side),
//          'heal' (at Supper your Pokémon here heal fully).

const loc = (id, name, art, width, color, tagline, objective, milestones, completion, effect = null) => ({ id, name, art, width, color, tagline, objective, milestones, completion, effect });

export const PALLET_TOWN = loc('pallet-town', 'Pallet Town', 'cards/pallet-town.jpg', 2, '#e8b85a', 'Your journey begins',
  { kind: 'summon', count: 2, text: 'Summon 2 Pokémon here' }, [{ at: 1, reward: { draw: 1 } }], { recognition: 3 });

export const LOCATIONS = [
  loc('viridian-forest', 'Viridian Forest', 'cards/eterna-forest.jpg', 3, '#5ec45a', 'Wild Pokémon everywhere',
    { kind: 'presence', count: 3, text: 'Have a Pokémon here at 3 Suppers' }, [{ at: 2, reward: { recognition: 2 } }], { recognition: 4 }, 'wild'),
  loc('pokemon-center', 'Pokémon Center', 'cards/shalour-city.jpg', 1, '#ff8fb8', 'Your Pokémon here heal fully at Supper',
    { kind: 'presence', count: 2, text: 'Have a Pokémon here at 2 Suppers' }, [{ at: 1, reward: { draw: 1 } }], { recognition: 3 }, 'heal'),
  loc('cerulean-cape', 'Cerulean Cape', 'cards/cerulean-cape.jpg', 2, '#4a9ae8', 'A training ground by the sea',
    { kind: 'attack', count: 4, text: 'Attack 4 times from here' }, [{ at: 2, reward: { energyNext: 1 } }], { recognition: 5 }),
  loc('mt-ember', 'Mt. Ember', 'cards/mt-ember.jpg', 3, '#f08a3a', 'Make a name for yourself',
    { kind: 'damagePlayer', count: 8, text: 'Deal 8 damage to the enemy player from here' }, [{ at: 4, reward: { recognition: 2 } }], { recognition: 6 }),
  loc('lake-of-rage', 'Lake of Rage', 'cards/lake-of-rage.jpg', 2, '#3ab0c8', 'Prove your strength',
    { kind: 'defeat', count: 2, text: 'Defeat 2 enemy Pokémon from here' }, [{ at: 1, reward: { draw: 1 } }], { recognition: 6 }),
  loc('floaroma-meadow', 'Floaroma Meadow', 'cards/floaroma-meadow.jpg', 1, '#e86ab8', 'A quiet place to grow',
    { kind: 'summon', count: 1, text: 'Summon a Pokémon here' }, [], { recognition: 2, draw: 2 }),
];

export const CHAMPIONSHIP = loc('regional-championship', 'Regional Championship', 'cards/stark-mountain.jpg', 10, '#f6d36a', 'The final: the higher Recognition is crowned Champion',
  { kind: 'attack', count: 6, text: 'Attack 6 times in the Championship' }, [{ at: 2, reward: { recognition: 3 } }, { at: 4, reward: { recognition: 3 } }], { recognition: 4 });

export const locationDef = (id) => [PALLET_TOWN, CHAMPIONSHIP, ...LOCATIONS].find((l) => l.id === id);

export function rewardText(r = {}) {
  return [r.recognition && `+${r.recognition} Recognition`, r.draw && `draw ${r.draw}`, r.energyNext && `+${r.energyNext} Energy next Round`].filter(Boolean).join(', ') || 'nothing';
}
