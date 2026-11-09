// v4's Pokémon (F1): a few simple evolution paths, one per development series card, using
// existing Pokémon and art from assets/cards. Form, stats, ability and cost come from the Level
// (rules.js costFor). Data only.
//   forms: [{ name, art, from, speed? }] — the form from that Level up to the next form's Level.
//   stats: { level: [Attack, Strength] } for every Level of the series.
//   guard: 'Defence' | 'Special Defence' | null. ability: (level) → { text, onSummon } or null.
import { SERIES_RANGE, levelFor, costFor } from '../rules.js?v=202611091145';

const op = (name, amount) => ({ op: name, amount });
const path = (spec) => ({ guard: null, ability: () => null, ...spec });

export const PATHS = [
  // --- Light (Levels 1–6) ---
  path({ id: 'ponyta', series: 'Light', type: 'Fire', attackType: 'Physical', speed: 'Swift',
    forms: [{ name: 'Ponyta', art: 'ponyta', from: 1 }, { name: 'Rapidash', art: 'rapidash', from: 4 }],
    stats: { 1: [2, 2], 2: [3, 3], 3: [3, 4], 4: [4, 4], 5: [5, 5], 6: [6, 5] } }),
  path({ id: 'chinchou', series: 'Light', type: 'Electric', attackType: 'Special', speed: 'Steady', guard: 'Special Defence',
    forms: [{ name: 'Chinchou', art: 'chinchou', from: 1 }, { name: 'Lanturn', art: 'lanturn', from: 4 }],
    stats: { 1: [1, 3], 2: [2, 4], 3: [2, 5], 4: [3, 6], 5: [4, 7], 6: [4, 8] } }),
  // --- Mid (Levels 2–7) ---
  path({ id: 'squirtle', series: 'Mid', type: 'Water', attackType: 'Special', speed: 'Steady', guard: 'Defence',
    forms: [{ name: 'Squirtle', art: 'squirtle', from: 2 }, { name: 'Wartortle', art: 'wartortle', from: 4 }, { name: 'Blastoise', art: 'blastoise', from: 6 }],
    stats: { 2: [2, 4], 3: [3, 5], 4: [3, 6], 5: [4, 7], 6: [5, 9], 7: [6, 10] } }),
  path({ id: 'growlithe', series: 'Mid', type: 'Fire', attackType: 'Physical', speed: 'Swift',
    forms: [{ name: 'Growlithe', art: 'growlithe', from: 2 }, { name: 'Arcanine', art: 'arcanine', from: 5 }],
    stats: { 2: [3, 3], 3: [3, 4], 4: [4, 5], 5: [5, 6], 6: [6, 7], 7: [7, 8] } }),
  // --- Heavy (Levels 3–8) ---
  path({ id: 'magikarp', series: 'Heavy', type: 'Water', attackType: 'Physical', speed: 'Steady',
    forms: [{ name: 'Magikarp', art: 'magikarp', from: 3 }, { name: 'Gyarados', art: 'gyarados', from: 6 }],
    stats: { 3: [1, 4], 4: [1, 5], 5: [2, 5], 6: [7, 8], 7: [8, 9], 8: [9, 10] },
    ability: (l) => (l < 6 ? { text: 'On Summon: draw 1 card', onSummon: [op('draw', 1)] } : null) }),
  path({ id: 'charmander', series: 'Heavy', type: 'Fire', attackType: 'Special', speed: 'Steady',
    forms: [{ name: 'Charmander', art: 'charmander', from: 3 }, { name: 'Charmeleon', art: 'charmeleon', from: 5 }, { name: 'Charizard', art: 'charizard', from: 7, speed: 'Swift' }],
    stats: { 3: [2, 4], 4: [3, 4], 5: [4, 6], 6: [5, 6], 7: [7, 8], 8: [8, 9] },
    ability: (l) => (l >= 7 ? { text: 'On Summon: 2 damage to each enemy Pokémon', onSummon: [op('damageAll', 2)] } : null) }),
];
export const pathDef = (id) => PATHS.find((p) => p.id === id);

// A Pokémon card at a Level.
export function pokemonAt(id, level) {
  const p = pathDef(id);
  const [lo, hi] = SERIES_RANGE[p.series];
  const l = Math.max(lo, Math.min(hi, level));
  const form = [...p.forms].reverse().find((f) => l >= f.from);
  const [attack, strength] = p.stats[l];
  const ab = p.ability(l);
  return {
    id: p.id, cardType: 'Pokémon', name: form.name, art: form.art, series: p.series, type: p.type, attackType: p.attackType,
    speed: form.speed ?? p.speed, strengthType: p.guard ?? 'Hitpoints', level: l, cost: costFor(l), attack, strength,
    text: ab?.text ?? '', onSummon: ab?.onSummon ?? null,
  };
}
// --- Location Cards (F2; adapted from v2's Locations): placed on 2–4 adjacent free lanes on both
// sides, for a set number of Rounds. passive: on Pokémon in its lanes. weather: one type.
//   passive kinds: 'strength' (+N Strength) · 'attack' (+N Attack) · 'heal' (heal N at Breakfast)
//                  · 'discount' (summoning here costs N less, minimum 0)
const location = (id, name, width, rounds, weather, color, passive) => ({ id, name, cardType: 'Location', art: id, width, rounds, weather, color, passive });
export const LOCATIONS = [
  location('cerulean-cape', 'Cerulean Cape', 2, 3, { type: 'Rain', count: 1 }, '#4a9ae8', { kind: 'strength', amount: 1, text: 'Pokémon here have +1 Strength' }),
  location('mt-ember', 'Mt. Ember', 3, 3, { type: 'Sun', count: 2 }, '#f08a3a', { kind: 'attack', amount: 1, text: 'Pokémon here have +1 Attack' }),
  location('lake-of-rage', 'Lake of Rage', 2, 2, { type: 'Sun', count: 1 }, '#3ab0c8', { kind: 'heal', amount: 2, text: 'Pokémon here heal 2 at Breakfast' }),
  location('route-119', 'Route 119', 4, 2, { type: 'Rain', count: 2 }, '#3ab07a', { kind: 'discount', amount: 1, text: 'Summoning a Pokémon here costs 1 less (minimum 0)' }),
];
export const locationDef = (id) => LOCATIONS.find((l) => l.id === id);

// Weather (section 16): two types; counts combined across all placed Locations (both players');
// brackets apply to both players.
export const WEATHER_BRACKETS = [
  { type: 'Rain', at: 2, kind: 'healAll', amount: 1, text: 'every Pokémon heals 1 at Breakfast' },
  { type: 'Rain', at: 4, kind: 'strength', amount: 1, text: 'every Pokémon has +1 Strength' },
  { type: 'Sun', at: 2, kind: 'physical', amount: 1, text: 'Physical attacks deal +1 damage' },
  { type: 'Sun', at: 4, kind: 'attack', amount: 1, text: 'every Pokémon has +1 Attack' },
];

// A card at a Round (off the battlefield, a Pokémon's Level follows the Round).
export const cardAtRound = (id, round) => (locationDef(id) ? structuredClone(locationDef(id)) : pokemonAt(id, levelFor(pathDef(id).series, round)));

// The demo deck so far, the same for both players: Pokémon (F1: Light, Mid and Heavy, a Defence
// guard (Squirtle) and a Special Defence guard (Chinchou)) and one of each Location (F2).
export const DEMO_DECK = [
  'cerulean-cape', 'mt-ember', 'lake-of-rage', 'route-119',
  ...Array(4).fill('ponyta'), ...Array(3).fill('chinchou'),
  ...Array(4).fill('squirtle'), ...Array(4).fill('growlithe'),
  ...Array(3).fill('magikarp'), ...Array(2).fill('charmander'),
];
