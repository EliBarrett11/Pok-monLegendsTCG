// V3-1's test cards: actual Pokémon, Moves (v2's Strategy Cards) and Supporters from v1 and v2
// (docs/v3-foundations.md, "Settled 4 Nov (late night)"): their names, art, stats and series as
// in v2 (v2/src/engine/decks.js), keeping only their effects. Anything relying on systems v3
// doesn't have yet (Growth, statuses such as Burn, Sleep and Leech Seed, Weather, Items, Trainers,
// Locations in the deck, Douse, Retain, Empowered summons) is dropped; each card notes what.
// Data only: game.js resolves it.
import { costFor, levelFor } from '../rules.js';

// --- Targets and ops -----------------------------------------------------------------------------
// A target spec: { side: 'enemy' | 'friendly', kinds: ['pokemon', 'player', 'location'], count }.
//   'location': a chosen Location; the op reaches every one of `side`'s Pokémon in its lanes.
// Ops: damage N · heal N · buff { attack, strength, keywords, until: 'supper' | 'breakfast' } ·
//   ready (it becomes Active) · draw N · damageAll N (every enemy Pokémon) · healAll N (every
//   friendly Pokémon) · damagePlayer N (the enemy player, unless protected) · gainKeyword K.
const ENEMY_ANY = (count = 1) => ({ side: 'enemy', kinds: ['pokemon', 'player'], count });
const FRIEND = { side: 'friendly', kinds: ['pokemon'], count: 1 };
const FRIEND_LOC = { side: 'friendly', kinds: ['location'], count: 1 };
const ENEMY_LOC = { side: 'enemy', kinds: ['location'], count: 1 };
const op = (name, amount, extra = {}) => ({ op: name, ...(amount !== undefined ? { amount } : {}), ...extra });

// --- Pokémon ---------------------------------------------------------------------------------------
// A series: stages by Level; stats[i] = [Attack, Strength] at Level i+1; band from v2's weight
// (light → Light, standard → Medium, heavy → Heavy); effects(level) → { keywords, text, onSummon,
// onAttack, onDefend, rally, guard, speed } (v3's abilities: see game.js).
const three = (a, b, c) => [{ ...a, from: 1, to: 2 }, { ...b, from: 3, to: 4 }, { ...c, from: 5, to: 6 }];
const two = (a, b) => [{ ...a, from: 1, to: 3 }, { ...b, from: 4, to: 6 }];
const series = (spec) => ({ guard: null, effects: () => ({}), dropped: '', ...spec });

export const SERIES = [
  series({ id: 'growlithe', type: 'Fire', band: 'Medium', speed: 'Swift', attackType: 'Physical',
    stages: two({ name: 'Growlithe', art: 'growlithe' }, { name: 'Arcanine', art: 'arcanine' }),
    stats: [[3, 4], [3, 5], [4, 5], [5, 7], [6, 7], [7, 8]],
    effects: (l) => (l <= 3 ? {} : { keywords: ['Infiltrator', 'Overrun'], text: 'Infiltrator, Overrun' }),
    dropped: 'Scorch (Burn); its Empowered summon' }),
  series({ id: 'ponyta', type: 'Fire', band: 'Light', speed: 'Swift', attackType: 'Physical',
    stages: two({ name: 'Ponyta', art: 'ponyta' }, { name: 'Rapidash', art: 'rapidash' }),
    stats: [[3, 3], [3, 4], [4, 4], [5, 5], [5, 6], [6, 6]],
    effects: (l) => (l <= 3 ? { keywords: ['Quick Attack'], text: 'Quick Attack' } : { keywords: ['Quick Attack', 'Infiltrator'], text: 'Quick Attack, Infiltrator' }),
    dropped: 'Rapidash Level 6: On Attack, the enemy player gains Burn 1' }),
  series({ id: 'mankey', type: 'Fighting', band: 'Light', speed: 'Swift', attackType: 'Physical',
    stages: two({ name: 'Mankey', art: 'mankey' }, { name: 'Primeape', art: 'primeape' }),
    stats: [[3, 2], [4, 2], [4, 3], [5, 4], [6, 4], [7, 5]],
    effects: (l) => (l <= 3 ? { keywords: ['Overrun'], text: 'Overrun' } : { keywords: ['Overrun', 'Infiltrator', 'Rage'], text: 'Overrun, Infiltrator, Rage (+1 Attack each time it survives damage)' }) }),
  series({ id: 'magby', type: 'Fire', band: 'Heavy', speed: 'Steady', attackType: 'Special',
    stages: three({ name: 'Magby', art: 'magby' }, { name: 'Magmar', art: 'magmar' }, { name: 'Magmortar', art: 'magmortar' }),
    stats: [[2, 5], [3, 5], [4, 6], [5, 7], [6, 8], [8, 9]],
    effects: (l) => (l <= 4 ? {} : { text: 'On Attack: 1 damage to each other enemy Pokémon in its Location', onAttack: { to: 'enemyHereOthers', ops: [op('damage', 1)] } }),
    dropped: 'Scorch (Burn)' }),
  series({ id: 'duskull', type: 'Ghost', band: 'Heavy', speed: 'Slow', attackType: 'Special', guard: 'Special Defence',
    stages: two({ name: 'Duskull', art: 'duskull' }, { name: 'Dusclops', art: 'dusclops' }),
    stats: [[1, 5], [1, 6], [2, 7], [2, 8], [3, 9], [3, 10]],
    dropped: 'On Defend: Burn to the attacker' }),
  series({ id: 'squirtle', type: 'Water', band: 'Medium', speed: 'Steady', attackType: 'Special', guard: 'Defence',
    stages: three({ name: 'Squirtle', art: 'squirtle' }, { name: 'Wartortle', art: 'wartortle' }, { name: 'Blastoise', art: 'blastoise' }),
    stats: [[3, 4], [3, 5], [4, 6], [5, 7], [6, 9], [7, 10]],
    effects: (l) => (l <= 2 ? {} : l <= 4 ? { keywords: ['Shell 1'], text: 'Shell 1' } : { keywords: ['Shell 2'], text: 'Shell 2' }),
    dropped: 'its Empowered summon' }),
  series({ id: 'horsea', type: 'Water', band: 'Medium', speed: 'Steady', attackType: 'Special',
    stages: three({ name: 'Horsea', art: 'horsea' }, { name: 'Seadra', art: 'seadra' }, { name: 'Kingdra', art: 'kingdra' }),
    stats: [[3, 4], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9]],
    effects: (l) => (l <= 4 ? { text: 'Rally: +1/+1 when another friendly Pokémon is summoned into its Location', rally: { attack: 1, strength: 1 } }
      : { keywords: ['Shell 1'], text: 'Rally: +2/+2. Shell 1', rally: { attack: 2, strength: 2 } }) }),
  series({ id: 'magikarp', type: 'Water', band: 'Heavy', speed: 'Steady', attackType: 'Physical',
    stages: two({ name: 'Magikarp', art: 'magikarp' }, { name: 'Gyarados', art: 'gyarados' }),
    stats: [[2, 3], [2, 4], [2, 5], [8, 6], [9, 7], [10, 8]],
    effects: (l) => (l <= 3 ? { text: 'Splash: On Summon, draw 1 card', onSummon: { ops: [op('draw', 1)] } }
      : { keywords: ['Overrun'], text: 'Overrun. On Summon: 2 damage to each enemy Pokémon in its Location', onSummon: { to: 'enemyHere', ops: [op('damage', 2)] } }) }),
  series({ id: 'chinchou', type: 'Electric', band: 'Light', speed: 'Steady', attackType: 'Special', guard: 'Special Defence',
    stages: two({ name: 'Chinchou', art: 'chinchou' }, { name: 'Lanturn', art: 'lanturn' }),
    stats: [[2, 4], [3, 4], [3, 5], [4, 6], [5, 7], [5, 8]],
    effects: (l) => (l <= 3 ? { keywords: ['Regenerate 1'], text: 'Regenerate 1' }
      : { keywords: ['Regenerate 1'], text: 'Regenerate 1. On Attack: heal another friendly Pokémon in its Location 2', onAttack: { to: 'friendHereOtherDamaged', ops: [op('heal', 2)] } }) }),
  series({ id: 'bulbasaur', type: 'Grass', band: 'Medium', speed: 'Steady', attackType: 'Special', guard: 'Special Defence',
    stages: three({ name: 'Bulbasaur', art: 'bulbasaur' }, { name: 'Ivysaur', art: 'ivysaur' }, { name: 'Venusaur', art: 'venusaur' }),
    stats: [[2, 4], [2, 5], [3, 6], [4, 6], [5, 9], [6, 11]],
    effects: (l) => (l <= 2 ? {} : l <= 4 ? { guard: null } : { guard: null, keywords: ['Shell 1'], text: 'Shell 1' }),
    dropped: 'On Breakfast: gain Growth; Ivysaur On Evolve: Leech Seed' }),
  series({ id: 'geodude', type: 'Rock', band: 'Heavy', speed: 'Slow', attackType: 'Physical', guard: 'Defence',
    stages: three({ name: 'Geodude', art: 'geodude' }, { name: 'Graveler', art: 'geodude' }, { name: 'Golem', art: 'geodude' }),
    stats: [[3, 5], [3, 6], [4, 7], [5, 8], [7, 10], [8, 11]],
    effects: (l) => { const n = l <= 4 ? 1 : 2; return { text: `On Defend: ${n} damage to the attacker`, onDefend: n }; } }),
  series({ id: 'wingull', type: 'Water', band: 'Light', speed: 'Swift', attackType: 'Special',
    stages: two({ name: 'Wingull', art: 'wingull' }, { name: 'Pelipper', art: 'pelipper' }),
    stats: [[3, 3], [4, 3], [4, 4], [5, 5], [6, 5], [6, 6]],
    dropped: 'Weather (Rain); Pelipper On Summon: a card gains Retain' }),
];
// A Location's wild Pokémon (Eterna Forest; not in a deck): Sewaddle, at Level 1.
export const WILD = series({ id: 'wild-sewaddle', type: 'Bug', band: 'Light', speed: 'Slow', attackType: 'Physical',
  stages: [{ name: 'Wild Sewaddle', art: 'sewaddle', from: 1, to: 6 }], stats: Array(6).fill([1, 3]) });

export const seriesDef = (id) => (id === WILD.id ? WILD : SERIES.find((s) => s.id === id));
const stageAt = (s, level) => s.stages.find((st) => level >= st.from && level <= st.to);

// A Pokémon card at a Level (off the board: Level = the Round, up to its cap).
export function pokemonAt(id, level, cap = 6) {
  const s = seriesDef(id);
  const st = stageAt(s, level);
  const [attack, strength] = s.stats[level - 1];
  const fx = s.effects(level) ?? {};
  const guard = 'guard' in fx ? fx.guard : s.guard;
  return {
    id: s.id, series: s.id, name: st.name, cardType: 'Pokémon', art: st.art, type: s.type, band: s.band, speed: fx.speed ?? s.speed,
    attackType: s.attackType, strengthType: guard ?? 'Hitpoints', level, cap, cost: costFor(s.band, level), attack, strength,
    keywords: [...(fx.keywords ?? [])], text: fx.text ?? '', onSummon: fx.onSummon ?? null, onAttack: fx.onAttack ?? null,
    onDefend: fx.onDefend ?? 0, rally: fx.rally ?? null,
  };
}

// --- Moves (v2's Strategy Cards): breakpoints ----------------------------------------------------------
const move = (id, name, art, breakpoints, dropped = '') => ({ id, name, cardType: 'Move', art, breakpoints, dropped });
const bp = (cost, text, target, ...ops) => ({ cost, text, ...(target ? { target } : {}), ops });
export const MOVES = [
  move('hydro-pump', 'Hydro Pump', 'hydro-pump', [
    bp(3, '4 damage to an enemy Pokémon or the enemy player', ENEMY_ANY(), op('damage', 4)),
    bp(6, '9 damage to an enemy Pokémon or the enemy player', ENEMY_ANY(), op('damage', 9)),
  ]),
  move('thunderbolt', 'Thunderbolt', 'thunderbolt', [
    bp(2, '3 damage to an enemy Pokémon or the enemy player', ENEMY_ANY(), op('damage', 3)),
    bp(4, '6 damage to an enemy Pokémon or the enemy player', ENEMY_ANY(), op('damage', 6)),
    bp(6, '6 damage to two targets (Pokémon or the enemy player)', ENEMY_ANY(2), op('damage', 6)),
  ]),
  move('surf', 'Surf', 'surf', [
    bp(2, '2 damage to each enemy Pokémon', null, op('damageAll', 2)),
    bp(5, '3 damage to each enemy Pokémon, and heal each friendly Pokémon 2', null, op('damageAll', 3), op('healAll', 2)),
  ]),
  move('hyper-voice', 'Hyper Voice', 'hypervoice', [
    bp(4, '2 damage to every enemy Pokémon', null, op('damageAll', 2)),
    bp(6, '3 damage to every enemy Pokémon and 2 to the enemy player', null, op('damageAll', 3), op('damagePlayer', 2)),
  ]),
  move('flame-charge', 'Flame Charge', 'flame-charge', [
    bp(1, 'A friendly Pokémon gains +2 Attack this Round', FRIEND, op('buff', undefined, { attack: 2 })),
    bp(3, 'A friendly Pokémon gains +2 Attack this Round, and becomes Active', FRIEND, op('buff', undefined, { attack: 2 }), op('ready')),
  ], 'Scorch 1 (at 3)'),
  move('rock-slide', 'Rock Slide', 'rock-slide', [
    bp(3, '2 damage to every enemy Pokémon in a chosen Location', ENEMY_LOC, op('damage', 2)),
    bp(5, '3 damage to every enemy Pokémon in a chosen Location, and 1 to every other enemy Pokémon', ENEMY_LOC, op('damage', 3), op('damageOthers', 1)),
  ]),
];

// --- Supporters: Release other cards from your hand; the Favour improves them -------------------------
export const FAVOURS = {
  pokemon: { text: 'a Pokémon card', test: (c) => c.cardType === 'Pokémon' },
  normal: { text: 'a Normal Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Normal' },
  rock: { text: 'a Rock Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Rock' },
};
export const SUPPORTERS = [
  { id: 'professor-oak', name: 'Professor Oak', cardType: 'Supporter', art: 'professor-oak', release: 2,
    text: 'Draw 3 cards', ops: [op('draw', 3)], favour: { condition: 'pokemon', text: 'Draw 4 instead', ops: [op('draw', 4)] } },
  { id: 'nurse-joy', name: 'Nurse Joy', cardType: 'Supporter', art: 'nurse-joy', release: 1,
    text: 'Heal each friendly Pokémon in a chosen Location 3', target: FRIEND_LOC, ops: [op('heal', 3)],
    favour: { condition: 'normal', text: 'Every Location instead', untargeted: true, ops: [op('healAll', 3)] }, dropped: 'Douse' },
  { id: 'brock', name: 'Brock', cardType: 'Supporter', art: 'brock', release: 1,
    text: 'Friendly Pokémon in a chosen Location gain +2 Strength and Shell 1 until your next Breakfast', target: FRIEND_LOC, ops: [op('buff', undefined, { strength: 2, keywords: ['Shell 1'], until: 'breakfast' })],
    favour: { condition: 'rock', text: 'Every Location instead', untargeted: true, ops: [op('buffAll', undefined, { strength: 2, keywords: ['Shell 1'], until: 'breakfast' })] }, dropped: 'Douse your player character' },
];

export const cardById = (id) => MOVES.find((c) => c.id === id) ?? SUPPORTERS.find((c) => c.id === id) ?? null;

// The test deck (both players): 26 Pokémon, 10 Moves, 4 Supporters = 40. A mix of Types, Light,
// Medium and Heavy, every Speed-Tier, Physical and Special, Defence and Special Defence guards.
const copies = (id, n, cap = 6) => Array.from({ length: n }, () => ({ series: id, cap }));
export const TEST_DECK = [
  ...copies('growlithe', 3), ...copies('ponyta', 3, 4), ...copies('mankey', 2, 4), ...copies('magby', 2), ...copies('duskull', 2, 4),
  ...copies('squirtle', 3), ...copies('horsea', 2), ...copies('magikarp', 2), ...copies('chinchou', 2, 4), ...copies('bulbasaur', 2),
  ...copies('geodude', 2), ...copies('wingull', 1, 4),
  ...[['hydro-pump', 2], ['thunderbolt', 2], ['surf', 2], ['hyper-voice', 1], ['flame-charge', 2], ['rock-slide', 1]].flatMap(([id, n]) => Array(n).fill({ card: id })),
  ...[['professor-oak', 2], ['nurse-joy', 1], ['brock', 1]].flatMap(([id, n]) => Array(n).fill({ card: id })),
];

// A deck entry as a card at a Round.
export function cardAt(entry, round = 1) {
  if (entry.series) return pokemonAt(entry.series, levelFor(round, entry.cap), entry.cap);
  return structuredClone(cardById(entry.card));
}
