// v4's Pokémon (F1): a few simple evolution paths, one per development series card, using
// existing Pokémon and art from assets/cards. Form, stats, ability and cost come from the Level
// (rules.js costFor). Data only.
//   forms: [{ name, art, from, speed? }] — the form from that Level up to the next form's Level.
//   stats: { level: [Attack, Strength] } for every Level of the series.
//   guard: 'Defence' | 'Special Defence' | null. ability: (level) → { text, onSummon } or null.
import { SERIES_RANGE, levelFor, costFor } from '../rules.js?v=202611091234';

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

// --- Command Cards (F3, section 4B): three ways to play, each with its own Energy cost.
//   Adapt: standard cost and effect, at once. React: lower cost, weaker effect, in response to an
//   eligible opponent action, before it resolves. Strat: higher cost, stronger effect, after the
//   opponent's next turn.
//   target: 'enemy' (an enemy Pokémon) · 'own' (one of your Pokémon).
//   ops: 'damage' (N to the target) · 'heal' (N, not above its Strength) · 'attackUp' (+N Attack
//        until Supper) · 'damageLocation' (N to each enemy Pokémon in the target's Location).
const mode = (cost, op, amount) => ({ cost, op, amount });
const command = (id, name, target, adapt, react, strat) => ({ id, name, cardType: 'Command', art: id, target, modes: { adapt, react, strat } });
export const COMMANDS = [
  command('ember', 'Ember', 'enemy', mode(2, 'damage', 3), mode(1, 'damage', 2), mode(3, 'damage', 5)),
  command('recover', 'Recover', 'own', mode(2, 'heal', 4), mode(1, 'heal', 2), mode(3, 'heal', 8)),
  command('x-attack', 'X Attack', 'own', mode(2, 'attackUp', 2), mode(1, 'attackUp', 1), mode(3, 'attackUp', 4)),
  command('rock-slide', 'Rock Slide', 'enemy', mode(3, 'damageLocation', 1), mode(2, 'damage', 1), mode(4, 'damageLocation', 2)),
];
export const commandDef = (id) => COMMANDS.find((c) => c.id === id);
export const MODES = ['adapt', 'react', 'strat'];
export const MODE_NAMES = { adapt: 'Adapt', react: 'React', strat: 'Strat' };
// A mode's effect in words.
export function modeText(card, m) {
  const { op, amount } = card.modes[m];
  const t = card.target === 'enemy' ? 'an enemy Pokémon' : 'one of your Pokémon';
  if (op === 'damage') return `${amount} damage to ${t}`;
  if (op === 'heal') return `heal ${t} ${amount}`;
  if (op === 'attackUp') return `+${amount} Attack to ${t} until Supper`;
  if (op === 'damageLocation') return `${amount} damage to each enemy Pokémon in a target's Location`;
  return op;
}

// --- Supporter Cards (F3, section 4D; adapted from v2's Supporters and Favours): no Energy; Release
// N other cards from hand (permanently), then the Supporter itself is Released. Favour: if a
// Released card meets the condition, the enhanced effect applies and the player earns Recognition.
//   ops: 'healAll' (each of your Pokémon) · 'search' (N Pokémon cards from your Draw Pile into your
//        hand) · 'strengthAll' (+N Strength, kept, to each of your Pokémon)
// Copied from v2/src/engine/cardtypes.js (FAVOURS), only the conditions v4 uses.
export const FAVOURS = {
  water: { text: 'a Water Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Water' },
  location: { text: 'a Location', test: (c) => c.cardType === 'Location' },
  bigPokemon: { text: 'a Pokémon of Level 4 or more', test: (c) => c.cardType === 'Pokémon' && c.level >= 4 },
};
const supporter = (id, name, release, effect, favour) => ({ id, name, cardType: 'Supporter', art: id, release, effect, favour });
export const SUPPORTERS = [
  supporter('nurse-joy', 'Nurse Joy', 1, { op: 'healAll', amount: 2 }, { condition: 'water', op: 'healAll', amount: 4 }),
  supporter('professor-oak', 'Professor Oak', 1, { op: 'search', amount: 1 }, { condition: 'location', op: 'search', amount: 2 }),
  supporter('brock', 'Brock', 2, { op: 'strengthAll', amount: 1 }, { condition: 'bigPokemon', op: 'strengthAll', amount: 2 }),
];
export const supporterDef = (id) => SUPPORTERS.find((c) => c.id === id);
export function effectText({ op, amount }) {
  if (op === 'healAll') return `heal each of your Pokémon ${amount}`;
  if (op === 'search') return `put ${amount === 1 ? 'a Pokémon card' : `${amount} Pokémon cards`} from your Draw Pile into your hand`;
  if (op === 'strengthAll') return `+${amount} Strength to each of your Pokémon (kept)`;
  return op;
}

// --- Item Cards (F4, section 4E; the shape follows v1's Items): a PokéDollar price; Held (attaches
// to one of your Pokémon in play, one Item each) or Consumed (resolves, then goes to the PokéMart).
// Every Item targets one of your Pokémon.
//   Consumed ops: 'heal' (N) · 'attackUp' (+N Attack until Supper)
//   Held ops:     'attack' (+N Attack) · 'strength' (+N Strength) · 'healBreakfast' (heal N at Breakfast)
const item = (id, name, price, itemType, op, amount, text) => ({ id, name, cardType: 'Item', art: id, price, itemType, op, amount, text });
export const ITEMS = [
  item('potion', 'Potion', 2, 'Consumed', 'heal', 3, 'Heal one of your Pokémon 3'),
  item('oran-berry', 'Oran Berry', 1, 'Consumed', 'heal', 2, 'Heal one of your Pokémon 2'),
  item('choice-band', 'Choice Band', 2, 'Consumed', 'attackUp', 2, 'One of your Pokémon has +2 Attack until Supper'),
  item('charcoal', 'Charcoal', 2, 'Held', 'attack', 1, 'Held: +1 Attack'),
  item('mystic-water', 'Mystic Water', 2, 'Held', 'strength', 2, 'Held: +2 Strength'),
  item('leftovers', 'Leftovers', 3, 'Held', 'healBreakfast', 1, 'Held: heal 1 at each Breakfast'),
];
export const itemDef = (id) => ITEMS.find((c) => c.id === id);
export const BAG_SIZE = 6;   // the Inventory Bag (v1: src/engine/game.js BAG_SIZE)

// --- Trainer Cards (F4, section 4F; Partners as in v2's printed Partner cards): two ways to play.
//   Objective: costs objectiveCost Energy; goes to the Trainer area and is tracked from then on.
//     kinds: 'defeat' (defeat N enemy Pokémon) · 'dominate' (dominate a Location at Supper, N times).
//     On completion: its Partner arrives (an empty space; else it waits), its On Summon resolves,
//     +Recognition, and the Trainer goes to the Discard Pile.
//   Command: costs command.cost Energy; resolves at once (ops as Pokémon abilities: 'draw', 'damageAll').
const partner = (spec) => ({ cardType: 'Pokémon', series: 'Partner', strengthType: 'Hitpoints', partner: true, ...spec });
const trainer = (id, name, objectiveCost, objective, partnerCard, command) => ({ id, name, cardType: 'Trainer', art: id, objectiveCost, objective, partner: partnerCard, command });
export const TRAINERS = [
  trainer('misty', 'Misty', 1, { kind: 'defeat', need: 2, text: 'Defeat 2 enemy Pokémon' },
    partner({ id: 'starmie', name: 'Starmie', art: 'starmie', type: 'Water', attackType: 'Special', speed: 'Swift', level: 5, cost: 3, attack: 4, strength: 6,
      text: 'On Summon: draw 2 cards', onSummon: [{ op: 'draw', amount: 2 }] }),
    { cost: 1, ops: [{ op: 'draw', amount: 2 }], text: 'Draw 2 cards' }),
  trainer('blaine', 'Blaine', 1, { kind: 'dominate', need: 1, text: 'Dominate a Location at Supper' },
    partner({ id: 'ninetales', name: 'Ninetales', art: 'ninetales', type: 'Fire', attackType: 'Special', speed: 'Steady', level: 5, cost: 3, attack: 5, strength: 6,
      text: 'On Summon: 1 damage to each enemy Pokémon', onSummon: [{ op: 'damageAll', amount: 1 }] }),
    { cost: 2, ops: [{ op: 'damageAll', amount: 1 }], text: '1 damage to each enemy Pokémon' }),
];
export const trainerDef = (id) => TRAINERS.find((c) => c.id === id);

// A card at a Round (off the battlefield, a Pokémon's Level follows the Round).
const fixedDef = (id) => locationDef(id) ?? commandDef(id) ?? supporterDef(id) ?? itemDef(id) ?? trainerDef(id);
export const cardAtRound = (id, round) => (fixedDef(id) ? structuredClone(fixedDef(id)) : pokemonAt(id, levelFor(pathDef(id).series, round)));

// The demo deck so far, the same for both players: Pokémon (F1: Light, Mid and Heavy, a Defence
// guard (Squirtle) and a Special Defence guard (Chinchou)), one of each Location (F2), and one of
// each Command Card and Supporter (F3), three Items and two Trainers (F4).
export const DEMO_DECK = [
  'cerulean-cape', 'mt-ember', 'lake-of-rage', 'route-119',
  ...Array(4).fill('ponyta'), ...Array(3).fill('chinchou'),
  ...Array(4).fill('squirtle'), ...Array(4).fill('growlithe'),
  ...Array(3).fill('magikarp'), ...Array(2).fill('charmander'),
  // F3: Command Cards and Supporters.
  'ember', 'recover', 'x-attack', 'rock-slide', 'nurse-joy', 'professor-oak', 'brock',
  // F4: Items (the other three are only in the PokéMart) and Trainers.
  'potion', 'charcoal', 'choice-band', 'misty', 'blaine',
  // F5: the final foundation deck (40): a second Ember, Recover, Potion and Professor Oak.
  'ember', 'recover', 'potion', 'professor-oak',
];
