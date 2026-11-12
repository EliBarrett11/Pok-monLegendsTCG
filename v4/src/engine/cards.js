// v4's Pokémon (G2, docs/v4-gameplay-update.md 4.2): 10 evolution lines, using existing art in
// assets/cards. Form, stats, trigger, keywords and cost come from the Level (rules.js costFor). Data only.
//   forms: [{ name, art, from, speed?, trigger?, keywords? }]: the form from that Level up to the next one.
//   stats: { level: [Attack, Strength] } for every Level of the series.
//   guard: 'Defence' | 'Special Defence' | null.
// Triggers (4.1): { on, ops } with on: 'summon' · 'attack' · 'defend' · 'defeated' · 'knockout' · 'breakfast'.
// Each op: { op, amount, to? }:
//   draw N · energy N (+N Base Energy, usable this turn and the rest of the Round)
//   damage N to: 'chosenEnemy' (On Summon only) · 'eachEnemy' · 'eachEnemyHere' (its Location) ·
//                'eachEnemyTargetLoc' · 'otherEnemiesTargetLoc' (each except the target) ·
//                'oneOtherEnemyTargetLoc' (the weakest other one there)
//   heal N to: 'chosenOwn' · 'eachOwnHere' · 'eachOtherOwnHere' · 'self'
//   tempAttack N (until Supper) to: 'eachOtherOwnHere'
//   attack N / strength N (kept) to: 'self' · 'chosenOtherOwnHere'
// "Here" (its Location): a placed Location's lanes, all 9 in the Tournament, or just its own lane.
// Keywords (4.1): { quickAttack, infiltrator, overrun, rage: true; shell, regenerate, retaliate: N }.
import { SERIES_RANGE, levelFor, costFor } from '../rules.js?v=202611120821';

const on = (when, ...ops) => ({ on: when, ops });
const draw = (n) => ({ op: 'draw', amount: n });
const dmg = (n, to) => ({ op: 'damage', amount: n, to });
const heal = (n, to) => ({ op: 'heal', amount: n, to });
const path = (spec) => ({ guard: null, ...spec });

export const PATHS = [
  // --- Light (Levels 1–6) ---
  path({ id: 'ponyta', series: 'Light', type: 'Fire', attackType: 'Physical', speed: 'Swift',
    forms: [{ name: 'Ponyta', art: 'ponyta', from: 1, trigger: on('defeated', draw(1)) },
      { name: 'Rapidash', art: 'rapidash', from: 4, keywords: { quickAttack: true }, trigger: on('knockout', { op: 'attack', amount: 1, to: 'self' }) }],
    stats: { 1: [2, 2], 2: [3, 2], 3: [3, 3], 4: [4, 4], 5: [5, 4], 6: [6, 5] } }),
  path({ id: 'chinchou', series: 'Light', type: 'Electric', attackType: 'Special', speed: 'Steady', guard: 'Special Defence',
    forms: [{ name: 'Chinchou', art: 'chinchou', from: 1, trigger: on('summon', { op: 'energy', amount: 1 }) },
      { name: 'Lanturn', art: 'lanturn', from: 4, trigger: on('attack', dmg(1, 'eachEnemyHere')) }],
    stats: { 1: [1, 3], 2: [2, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6], 6: [4, 7] } }),
  path({ id: 'shinx', series: 'Light', type: 'Electric', attackType: 'Physical', speed: 'Swift',
    forms: [{ name: 'Shinx', art: 'shinx', from: 1, trigger: on('summon', dmg(1, 'chosenEnemy')) },
      { name: 'Luxio', art: 'luxio', from: 3, keywords: { infiltrator: true }, trigger: on('knockout', draw(1)) },
      { name: 'Luxray', art: 'luxray', from: 5, keywords: { infiltrator: true }, trigger: on('summon', dmg(2, 'chosenEnemy')) }],
    stats: { 1: [2, 2], 2: [2, 3], 3: [3, 3], 4: [4, 4], 5: [5, 5], 6: [6, 5] } }),
  // --- Mid (Levels 2–7) ---
  path({ id: 'squirtle', series: 'Mid', type: 'Water', attackType: 'Special', speed: 'Steady', guard: 'Defence',
    forms: [{ name: 'Squirtle', art: 'squirtle', from: 2, trigger: on('summon', heal(2, 'chosenOwn')) },
      { name: 'Wartortle', art: 'wartortle', from: 4, keywords: { shell: 1 }, trigger: on('summon', heal(2, 'eachOwnHere')) },
      { name: 'Blastoise', art: 'blastoise', from: 6, keywords: { shell: 1 }, trigger: on('attack', dmg(2, 'oneOtherEnemyTargetLoc')) }],
    stats: { 2: [2, 4], 3: [2, 5], 4: [3, 6], 5: [4, 7], 6: [5, 8], 7: [6, 9] } }),
  path({ id: 'growlithe', series: 'Mid', type: 'Fire', attackType: 'Physical', speed: 'Swift',
    forms: [{ name: 'Growlithe', art: 'growlithe', from: 2, trigger: on('summon', { op: 'tempAttack', amount: 1, to: 'eachOtherOwnHere' }) },
      { name: 'Arcanine', art: 'arcanine', from: 5, keywords: { overrun: true }, trigger: on('knockout', draw(1)) }],
    stats: { 2: [3, 3], 3: [3, 4], 4: [4, 4], 5: [5, 5], 6: [6, 6], 7: [7, 7] } }),
  path({ id: 'horsea', series: 'Mid', type: 'Water', attackType: 'Special', speed: 'Steady',
    forms: [{ name: 'Horsea', art: 'horsea', from: 2, trigger: on('summon', dmg(1, 'chosenEnemy')) },
      { name: 'Seadra', art: 'seadra', from: 4, keywords: { retaliate: 1 }, trigger: on('summon', dmg(1, 'chosenEnemy')) },
      { name: 'Kingdra', art: 'kingdra', from: 6, speed: 'Swift', keywords: { infiltrator: true }, trigger: on('summon', dmg(2, 'chosenEnemy')) }],
    stats: { 2: [2, 3], 3: [3, 3], 4: [4, 4], 5: [5, 5], 6: [6, 6], 7: [7, 7] } }),
  path({ id: 'wooper', series: 'Mid', type: 'Water', attackType: 'Physical', speed: 'Slow', guard: 'Defence',
    forms: [{ name: 'Wooper', art: 'wooper', from: 2, keywords: { regenerate: 1 }, trigger: on('summon', { op: 'strength', amount: 1, to: 'chosenOtherOwnHere' }) },
      { name: 'Quagsire', art: 'quagsire', from: 4, keywords: { regenerate: 1, rage: true }, trigger: on('summon', heal(2, 'eachOtherOwnHere')) }],
    stats: { 2: [2, 4], 3: [2, 5], 4: [3, 7], 5: [4, 8], 6: [4, 9], 7: [5, 10] } }),
  // --- Heavy (Levels 3–8) ---
  path({ id: 'magikarp', series: 'Heavy', type: 'Water', attackType: 'Physical', speed: 'Steady',
    forms: [{ name: 'Magikarp', art: 'magikarp', from: 3, trigger: on('summon', draw(1)) },
      { name: 'Gyarados', art: 'gyarados', from: 6, keywords: { rage: true }, trigger: on('summon', dmg(1, 'eachEnemyHere')) }],
    stats: { 3: [1, 4], 4: [1, 5], 5: [2, 5], 6: [7, 8], 7: [8, 9], 8: [9, 10] } }),
  path({ id: 'charmander', series: 'Heavy', type: 'Fire', attackType: 'Special', speed: 'Steady',
    forms: [{ name: 'Charmander', art: 'charmander', from: 3, trigger: on('attack', { op: 'attack', amount: 1, to: 'self' }) },
      { name: 'Charmeleon', art: 'charmeleon', from: 5, keywords: { rage: true }, trigger: on('summon', dmg(1, 'chosenEnemy')) },
      { name: 'Charizard', art: 'charizard', from: 7, speed: 'Swift', keywords: { overrun: true }, trigger: on('summon', dmg(2, 'eachEnemy')) }],
    stats: { 3: [2, 4], 4: [3, 4], 5: [4, 6], 6: [5, 6], 7: [7, 8], 8: [8, 9] } }),
  path({ id: 'magby', series: 'Heavy', type: 'Fire', attackType: 'Special', speed: 'Steady',
    forms: [{ name: 'Magby', art: 'magby', from: 3, trigger: on('defeated', dmg(1, 'eachEnemyHere')) },
      { name: 'Magmar', art: 'magmar', from: 5, keywords: { retaliate: 1 }, trigger: on('summon', dmg(1, 'chosenEnemy')) },
      { name: 'Magmortar', art: 'magmortar', from: 7, trigger: on('attack', dmg(1, 'otherEnemiesTargetLoc')) }],
    stats: { 3: [2, 3], 4: [3, 4], 5: [4, 5], 6: [5, 6], 7: [7, 7], 8: [8, 8] } }),
];
export const pathDef = (id) => PATHS.find((p) => p.id === id);

// --- Card text (G2): the trigger's name, then its effect in plain words; keywords as chips. ---
export const TRIGGER_NAMES = { summon: 'On Summon', attack: 'On Attack', defend: 'On Defend', defeated: 'On Defeated', knockout: 'On Knockout', breakfast: 'On Breakfast' };
const TO_WORDS = {
  chosenEnemy: 'an enemy Pokémon', eachEnemy: 'each enemy Pokémon', eachEnemyHere: 'each enemy Pokémon in its Location',
  eachEnemyTargetLoc: "each enemy Pokémon in the target's Location", otherEnemiesTargetLoc: "each other enemy Pokémon in the target's Location",
  oneOtherEnemyTargetLoc: "another enemy Pokémon in the target's Location",
  chosenOwn: 'one of your Pokémon', eachOwnHere: 'each of your Pokémon in its Location', eachOtherOwnHere: 'each of your other Pokémon in its Location',
  self: 'itself', chosenOtherOwnHere: 'another of your Pokémon in its Location',
};
export function opText({ op, amount, to }) {
  if (op === 'draw') return `draw ${amount} card${amount === 1 ? '' : 's'}`;
  if (op === 'energy') return `+${amount} Energy this Round`;
  if (op === 'damage' || op === 'damageAll') return `${amount} damage to ${TO_WORDS[to ?? 'eachEnemy']}`;
  if (op === 'heal') return to === 'self' ? `heal ${amount}` : `heal ${amount} to ${TO_WORDS[to]}`;
  if (op === 'tempAttack') return to === 'eachOtherOwnHere' ? `your other Pokémon in its Location get +${amount} Attack until Supper` : `+${amount} Attack until Supper to ${TO_WORDS[to]}`;
  if (op === 'attack' || op === 'strength') {
    const stat = op === 'attack' ? 'Attack' : 'Strength';
    return to === 'self' ? `+${amount} ${stat} (kept)` : `+${amount} ${stat} (kept) to ${TO_WORDS[to]}`;
  }
  return op;
}
export const triggerText = (t) => (t ? `${TRIGGER_NAMES[t.on]}: ${t.ops.map(opText).join(', then ')}` : '');
export const KEYWORD_ORDER = ['quickAttack', 'infiltrator', 'overrun', 'shell', 'regenerate', 'retaliate', 'rage'];
export const KEYWORD_NAMES = { quickAttack: 'Quick Attack', infiltrator: 'Infiltrator', overrun: 'Overrun', shell: 'Shell', regenerate: 'Regenerate', retaliate: 'Retaliate', rage: 'Rage' };
export const keywordList = (kw = {}) => KEYWORD_ORDER.filter((k) => kw[k]).map((k) => (kw[k] === true ? KEYWORD_NAMES[k] : `${KEYWORD_NAMES[k]} ${kw[k]}`));
export const cardText = (c) => [keywordList(c.keywords).join(', '), triggerText(c.trigger)].filter(Boolean).join('. ');
// A chosen target (On Summon only): the ops that ask for one.
export const CHOSEN = ['chosenEnemy', 'chosenOwn', 'chosenOtherOwnHere'];
export const needsChoice = (t) => !!t && t.on === 'summon' && t.ops.some((o) => CHOSEN.includes(o.to));

// A Pokémon card at a Level.
export function pokemonAt(id, level) {
  const p = pathDef(id);
  const [lo, hi] = SERIES_RANGE[p.series];
  const l = Math.max(lo, Math.min(hi, level));
  const form = [...p.forms].reverse().find((f) => l >= f.from);
  const [attack, strength] = p.stats[l];
  const card = {
    id: p.id, cardType: 'Pokémon', name: form.name, art: form.art, series: p.series, type: p.type, attackType: p.attackType,
    speed: form.speed ?? p.speed, strengthType: p.guard ?? 'Hitpoints', level: l, cost: costFor(l), attack, strength,
    trigger: form.trigger ? structuredClone(form.trigger) : null, keywords: { ...(form.keywords ?? {}) },
  };
  card.text = cardText(card);
  return card;
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

// --- Command Cards (F3; G3: gameplay update 5.1, one copy each): three ways to play, each with its own
//   Energy cost and its own target. Adapt: standard, at once. React: cheaper, weaker, in reply to an
//   attack, an Adapt or a resolving Strat, before it. Strat: dearer, stronger, after the opponent's
//   next turn.
//   targets: 'enemy' (an enemy Pokémon) · 'own' (one of your Pokémon) · 'location' (a Location, or a
//            lane with no Location: each enemy Pokémon there) · 'allEnemies' (no choice) ·
//            React only: 'attacker' (the attacking Pokémon) · 'attacked' (your Pokémon being attacked)
//   ops: 'damage' · 'heal' · 'attackUp' (+N Attack until Supper) · 'attackKept' (+N Attack, kept) ·
//        'damageSpent' (N damage, then it becomes Spent) · 'reduce' (React: the attack deals N less damage) ·
//        'dive' (return it to your hand; draw N cards)
const mode = (cost, op, amount, target) => ({ cost, op, amount, target });
const command = (id, name, target, adapt, react, strat) => ({ id, name, cardType: 'Command', art: id, target,
  modes: { adapt: { target, ...adapt }, react: { target, ...react }, strat: { target, ...strat } } });
const strip = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
const M = (cost, op, amount, target) => strip(mode(cost, op, amount, target));
export const COMMANDS = [
  command('ember', 'Ember', 'enemy', M(2, 'damage', 3), M(1, 'damage', 2), M(3, 'damage', 5)),
  command('thunderbolt', 'Thunderbolt', 'enemy', M(3, 'damage', 4), M(2, 'damage', 2), M(4, 'damage', 6)),
  command('rock-slide', 'Rock Slide', 'location', M(3, 'damage', 1), M(2, 'damage', 1, 'enemy'), M(4, 'damage', 2)),
  command('heat-wave', 'Heat Wave', 'allEnemies', M(3, 'damage', 1), M(2, 'damage', 1, 'attacker'), M(5, 'damage', 2)),
  command('surf', 'Surf', 'location', M(3, 'damage', 2), M(1, 'heal', 2, 'attacked'), M(4, 'damage', 3)),
  command('bubble-beam', 'Bubble Beam', 'enemy', M(2, 'damageSpent', 2), M(1, 'reduce', 2, 'attacker'), M(3, 'damageSpent', 3)),
  command('recover', 'Recover', 'own', M(2, 'heal', 4), M(1, 'heal', 2), M(3, 'heal', 8)),
  command('flame-charge', 'Flame Charge', 'own', M(2, 'attackKept', 1), M(1, 'attackUp', 1), M(3, 'attackKept', 2)),
  command('dive', 'Dive', 'own', M(1, 'dive', 0), M(1, 'dive', 0, 'attacked'), M(2, 'dive', 1)),
];
export const commandDef = (id) => COMMANDS.find((c) => c.id === id);
export const MODES = ['adapt', 'react', 'strat'];
export const MODE_NAMES = { adapt: 'Adapt', react: 'React', strat: 'Strat' };
export const modeTarget = (card, m) => card.modes[m].target ?? card.target;
const TARGET_WORDS = {
  enemy: 'an enemy Pokémon', own: 'one of your Pokémon', location: 'each enemy Pokémon in a Location', allEnemies: 'each enemy Pokémon',
  attacker: 'the attacker', attacked: 'your Pokémon being attacked',
};
// A mode's effect in words.
export function modeText(card, m) {
  const { op, amount } = card.modes[m];
  const tg = modeTarget(card, m);
  const t = TARGET_WORDS[tg];
  if (op === 'damage') return `${amount} damage to ${t}`;
  if (op === 'heal') return tg === 'attacked' ? `heal ${amount} to the Pokémon being attacked` : `heal ${t} ${amount}`;
  if (op === 'attackUp') return `+${amount} Attack to ${t} until Supper`;
  if (op === 'attackKept') return `+${amount} Attack (kept) to ${t}`;
  if (op === 'damageSpent') return `${amount} damage to ${t}, and it becomes Spent`;
  // C4 (Elliott, 11 November 2026): Bubble Beam's React (was "the attacker becomes Spent", a dead effect).
  if (op === 'reduce') return `the attack deals ${amount} less damage (minimum 0)`;
  if (op === 'dive') return tg === 'attacked' ? 'return the attacked Pokémon to your hand (the attack fizzles)' : `return ${t} to your hand${amount ? ` and draw ${amount} card${amount === 1 ? '' : 's'}` : ''}`;
  return op;
}
// A mode's effect in a few words (hand cards, the mode picker).
export function shortModeText(card, m) {
  const { op, amount } = card.modes[m];
  const tg = modeTarget(card, m);
  const where = { location: ' in area', allEnemies: ' to all', attacker: ' to attacker' }[tg] ?? '';
  if (op === 'damage') return `${amount} dmg${where}`;
  if (op === 'heal') return tg === 'attacked' ? `heal ${amount} (attacked)` : `heal ${amount}`;
  if (op === 'attackUp') return `+${amount} Atk to Supper`;
  if (op === 'attackKept') return `+${amount} Atk kept`;
  if (op === 'damageSpent') return `${amount} dmg + Spent`;
  if (op === 'reduce') return `attack −${amount}`;
  if (op === 'dive') return tg === 'attacked' ? 'save the attacked' : amount ? `hand + draw ${amount}` : 'to hand';
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
  // G3 (gameplay update 5.2).
  fire: { text: 'a Fire Pokémon', test: (c) => c.cardType === 'Pokémon' && c.type === 'Fire' },
  item: { text: 'an Item', test: (c) => c.cardType === 'Item' },
};
const supporter = (id, name, release, effect, favour) => ({ id, name, cardType: 'Supporter', art: id, release, effect, favour });
export const SUPPORTERS = [
  supporter('nurse-joy', 'Nurse Joy', 1, { op: 'healAll', amount: 2 }, { condition: 'water', op: 'healAll', amount: 4 }),
  supporter('professor-oak', 'Professor Oak', 1, { op: 'search', amount: 1 }, { condition: 'location', op: 'search', amount: 2 }),
  supporter('brock', 'Brock', 2, { op: 'strengthAll', amount: 1 }, { condition: 'bigPokemon', op: 'strengthAll', amount: 2 }),
  // G3 (gameplay update 5.2).
  supporter('flannery', 'Flannery', 1, { op: 'attackAll', amount: 1 }, { condition: 'fire', op: 'attackAll', amount: 2 }),
  supporter('pokemon-breeder', 'Pokémon Breeder', 1, { op: 'recover', amount: 1 }, { condition: 'item', op: 'recover', amount: 2 }),
];
export const supporterDef = (id) => SUPPORTERS.find((c) => c.id === id);
export function effectText({ op, amount }) {
  if (op === 'healAll') return `heal each of your Pokémon ${amount}`;
  if (op === 'search') return `put ${amount === 1 ? 'a Pokémon card' : `${amount} Pokémon cards`} from your Draw Pile into your hand`;
  if (op === 'strengthAll') return `+${amount} Strength to each of your Pokémon (kept)`;
  if (op === 'attackAll') return `each of your Pokémon +${amount} Attack until Supper`;
  if (op === 'recover') return `put ${amount === 1 ? 'a Pokémon card' : `${amount} Pokémon cards`} from your Discard Pile into your hand`;
  return op;
}

// --- Item Cards (F4; G3: gameplay update 5.3): a PokéDollar price and Stock (turns on sale in the
// PokéMart's one slot: $1 → 8, $2 → 6, $3 → 4, $4 → 3); Held (attaches to one of your Pokémon in play,
// one Item each) or Consumed (resolves, then goes back to the PokéMart's pool).
//   Consumed ops: 'heal' (N) · 'attackUp' (+N Attack until Supper) · 'recognition' (gain N; no target)
//   Held ops:     'attack' (+N Attack) · 'strength' (+N Strength) · 'speed' (one step higher) ·
//                 'keyword' (its keywords: Retaliate 2, Regenerate 1)
//   noHitBack: the holder can't hit back (Choice Band).
const item = (id, name, price, itemType, op, amount, text, stock, extra = {}) => ({ id, name, cardType: 'Item', art: id, price, itemType, op, amount, text, stock, ...extra });
export const ITEMS = [
  item('oran-berry', 'Oran Berry', 1, 'Consumed', 'heal', 2, 'Heal one of your Pokémon 2', 8),
  item('potion', 'Potion', 2, 'Consumed', 'heal', 4, 'Heal one of your Pokémon 4', 6),
  item('x-attack', 'X Attack', 2, 'Consumed', 'attackUp', 2, 'One of your Pokémon has +2 Attack until Supper', 6),
  item('charcoal', 'Charcoal', 2, 'Held', 'attack', 1, 'Held: +1 Attack', 6),
  item('mystic-water', 'Mystic Water', 2, 'Held', 'strength', 2, 'Held: +2 Strength', 6),
  item('quick-claw', 'Quick Claw', 3, 'Held', 'speed', 1, 'Held: Speed one step higher', 4),
  item('rocky-helmet', 'Rocky Helmet', 3, 'Held', 'keyword', 0, 'Held: Retaliate 2', 4, { keywords: { retaliate: 2 } }),
  item('leftovers', 'Leftovers', 3, 'Held', 'keyword', 0, 'Held: Regenerate 1', 4, { keywords: { regenerate: 1 } }),
  item('choice-band', 'Choice Band', 4, 'Held', 'attack', 3, 'Held: +3 Attack, but it can\'t hit back', 3, { noHitBack: true }),
  item('amulet-coin', 'Amulet Coin', 4, 'Consumed', 'recognition', 3, 'Gain 3 Recognition', 3, { noTarget: true }),
];
export const itemDef = (id) => ITEMS.find((c) => c.id === id);
export const BAG_SIZE = 6;   // the Inventory Bag (v1: src/engine/game.js BAG_SIZE)

// --- Trainer Cards (F4, section 4F; Partners as in v2's printed Partner cards). UX1 (Elliott's rule):
//   Objective: tracked from match setup for each Trainer card in a deck (free, from Round 1).
//     kinds: 'defeat' (defeat N enemy Pokémon) · 'dominate' (dominate a Location at Supper, N times).
//     On completion: the Trainer card is taken from wherever it is and leaves the deck for good; its
//     Partner arrives (an empty space; else it waits), its On Summon resolves, +Recognition.
//   Command: the only way to play a drawn Trainer: costs command.cost Energy; resolves at once (ops as
//     Pokémon abilities: 'draw', 'damageAll'); then it's discarded and keeps cycling.
const partner = (spec) => ({ cardType: 'Pokémon', series: 'Partner', strengthType: 'Hitpoints', partner: true, ...spec });
const trainer = (id, name, objective, partnerCard, command) => ({ id, name, cardType: 'Trainer', art: id, objective, partner: partnerCard, command });
export const TRAINERS = [
  // UX2 (Elliott, Q5 and Q7): Objective targets 8 and 5; stronger Level 8 Partners (cost 4).
  trainer('misty', 'Misty', { kind: 'defeat', need: 8, text: 'Defeat 8 enemy Pokémon', short: 'Defeat 8 Pokémon' },
    partner({ id: 'starmie', name: 'Starmie', art: 'starmie', type: 'Water', attackType: 'Special', speed: 'Swift', level: 8, cost: 4, attack: 8, strength: 10,
      trigger: { on: 'summon', ops: [{ op: 'draw', amount: 2 }] }, keywords: {}, text: 'On Summon: draw 2 cards' }),
    { cost: 1, ops: [{ op: 'draw', amount: 2 }], text: 'Draw 2 cards' }),
  trainer('blaine', 'Blaine', { kind: 'dominate', need: 5, text: 'Dominate a Location 5 times', short: 'Dominate 5 times' },
    partner({ id: 'ninetales', name: 'Ninetales', art: 'ninetales', type: 'Fire', attackType: 'Special', speed: 'Steady', level: 8, cost: 4, attack: 9, strength: 11,
      trigger: { on: 'summon', ops: [{ op: 'damage', amount: 2, to: 'eachEnemy' }] }, keywords: {}, text: 'On Summon: 2 damage to each enemy Pokémon' }),
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
  // G3 (gameplay update 5.4): the final 40.
  // Locations (4).
  'cerulean-cape', 'mt-ember', 'lake-of-rage', 'route-119',
  // Pokémon (15).
  'ponyta', 'ponyta', 'chinchou', 'chinchou', 'shinx',
  'squirtle', 'squirtle', 'growlithe', 'growlithe', 'horsea', 'wooper',
  'magikarp', 'charmander', 'charmander', 'magby',
  // Commands (9).
  'ember', 'thunderbolt', 'rock-slide', 'heat-wave', 'surf', 'bubble-beam', 'recover', 'flame-charge', 'dive',
  // Supporters (5).
  'nurse-joy', 'professor-oak', 'brock', 'flannery', 'pokemon-breeder',
  // Items (5).
  'potion', 'oran-berry', 'x-attack', 'charcoal', 'quick-claw',
  // Trainers (2).
  'misty', 'blaine',
];
