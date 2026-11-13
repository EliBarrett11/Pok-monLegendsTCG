// v4's cards (B3-1): every card comes from the data module, src/data/cards.js, which tools/buildcards.mjs generates from
// docs/base-game/cards.json (the approved Base Game). This module turns that data into the cards the engine plays with
// and keeps the names the rest of the game imports (PATHS, pokemonAt, COMMANDS, …). Its wording comes from the ops
// (src/engine/wording.js). No card is defined by hand here. Data only.
import { SERIES_RANGE, levelFor, costFor } from '../rules.js?v=202611120821';
import { POKEMON, MOVES, SUPPORTERS as SUP_DATA, ITEMS as ITEM_DATA, LOCATIONS as LOC_DATA, TRAINERS as TR_DATA } from '../data/cards.js?v=202611120821';
import {
  effectText, effectOps, shortModeText, favourText, objectiveText, triggerLine, KEYWORD_NAMES, KEYWORD_ORDER, TRIGGER_NAMES, keywordText, FAVOUR_RELEASE,
} from './wording.js?v=202611120821';

export { KEYWORD_NAMES, KEYWORD_ORDER, TRIGGER_NAMES };
// (In the card's own order, as cards.json prints them.)
export const keywordList = (kw = {}) => Object.keys(kw).filter((k) => kw[k] && KEYWORD_NAMES[k]).map((k) => keywordText(k, kw[k]));
// A trigger's effect in words ("1 damage to an enemy Pokémon."), and with its trigger's name.
export const triggerText = (t) => (t ? `${TRIGGER_NAMES[t.on]}: ${effectText(t.effect).replace(/\.$/, '')}` : '');
export const cardText = (c) => [keywordList(c.keywords).join(', '), triggerText(c.trigger)].filter(Boolean).join('. ');
// The resolution-time choices ("an enemy Pokémon", "one of your Pokémon", "each enemy Pokémon in a Location").
export const CHOSEN = ['chosenEnemy', 'chosenOwn', 'chosenOtherOwnHere', 'chosenLocEnemies', 'chosenLocOwn'];
export const needsChoice = (t) => !!t && t.effect && effectOps(t.effect).some((o) => CHOSEN.includes(o.to));
const withOps = (t) => (t ? { on: t.on, effect: t.effect, ops: effectOps(t.effect) } : null);

// --- Pokémon ----------------------------------------------------------------------------------------------------
// A series ("path"): its forms by Level, its stats at each Level ([Attack, Strength]), its guard.
export const PATHS = POKEMON.map((p) => ({ ...p, guard: p.guard ?? null, legendary: !!p.legendary }));
export const pathDef = (id) => PATHS.find((p) => p.id === id);
// A Pokémon card at a Level (clamped to its series). levelBonus: Levels a card in hand has gained (Fisherman,
// Gardenia, Celebi); they stay with the card while it's in hand, and never take it past its series' top Level.
export function pokemonAt(id, level, levelBonus = 0) {
  const p = pathDef(id);
  const [lo, hi] = SERIES_RANGE[p.series];
  const l = Math.max(lo, Math.min(hi, level + levelBonus));
  const form = [...p.forms].reverse().find((f) => l >= f.from) ?? p.forms[0];
  const [attack, strength] = p.stats[l];
  const card = {
    id: p.id, cardType: 'Pokémon', name: form.name, art: form.art, hasArt: form.hasArt, series: p.series, legendary: p.legendary, type: p.type, attackType: p.attackType,
    speed: form.speed, strengthType: p.guard ?? 'Hitpoints', level: l, cost: costFor(l, p.legendary), attack, strength,
    trigger: withOps(form.trigger), keywords: { ...form.keywords },
  };
  if (levelBonus) card.levelBonus = levelBonus;
  card.text = cardText(card);
  return card;
}

// --- Moves (Command Cards) -----------------------------------------------------------------------------------------
// Each mode: { cost, effect, ops, target, text (the Codex's wording), short (the card's line) }. A mode's target is what
// its first chosen op asks for (the Move's target when it's played); some Moves have only two modes.
export const MODES = ['adapt', 'react', 'strat'];
export const MODE_NAMES = { adapt: 'Adapt', react: 'React', strat: 'Strat' };
const TARGET_OF = { chosenEnemy: 'enemy', chosenOwn: 'own', chosenLocEnemies: 'location', chosenLocOwn: 'ownLocation', eachEnemy: 'allEnemies', eachOwn: 'allOwn',
  attacker: 'attacker', attackerLocEnemies: 'attacker', attack: 'attacker', attacked: 'attacked' };
const modeTargetOf = (ops) => TARGET_OF[ops.find((o) => TARGET_OF[o.to])?.to] ?? 'none';
export const COMMANDS = MOVES.map((m) => ({
  id: m.id, name: m.name, cardType: 'Command', type: m.type, art: m.art, hasArt: m.hasArt,
  modes: Object.fromEntries(Object.entries(m.modes).map(([k, x]) => {
    const ops = effectOps(x.effect);
    return [k, { cost: x.cost, effect: x.effect, ops, target: modeTargetOf(ops), text: effectText(x.effect), short: shortModeText(x.effect) }];
  })),
}));
for (const c of COMMANDS) c.target = (c.modes.adapt ?? c.modes.strat ?? c.modes.react).target;
export const commandDef = (id) => COMMANDS.find((c) => c.id === id);
export const modesOf = (card) => MODES.filter((m) => card.modes?.[m]);
export const modeTarget = (card, m) => card.modes[m]?.target ?? card.target;
export const modeText = (card, m) => card.modes[m]?.text.replace(/\.$/, '') ?? '';
export const shortModeTextOf = (card, m) => card.modes[m]?.short ?? '';

// --- Supporters -------------------------------------------------------------------------------------------------------
// Favour conditions (copied from v2/src/engine/cardtypes.js FAVOURS, extended for the Base Game).
export const FAVOURS = {
  water: { text: FAVOUR_RELEASE.water, test: (c) => c.cardType === 'Pokémon' && c.type === 'Water' },
  fire: { text: FAVOUR_RELEASE.fire, test: (c) => c.cardType === 'Pokémon' && c.type === 'Fire' },
  grass: { text: FAVOUR_RELEASE.grass, test: (c) => c.cardType === 'Pokémon' && c.type === 'Grass' },
  electric: { text: FAVOUR_RELEASE.electric, test: (c) => c.cardType === 'Pokémon' && c.type === 'Electric' },
  location: { text: FAVOUR_RELEASE.location, test: (c) => c.cardType === 'Location' },
  bigPokemon: { text: FAVOUR_RELEASE.bigPokemon, test: (c) => c.cardType === 'Pokémon' && c.level >= 4 },
  item: { text: FAVOUR_RELEASE.item, test: (c) => c.cardType === 'Item' },
  move: { text: FAVOUR_RELEASE.move, test: (c) => c.cardType === 'Command' },
};
export const SUPPORTERS = SUP_DATA.map((s) => {
  const sup = { id: s.id, name: s.name, cardType: 'Supporter', art: s.art, hasArt: s.hasArt, release: s.release, effect: s.effect, ops: effectOps(s.effect), text: effectText(s.effect),
    favour: { condition: s.favour.condition, recognition: s.favour.recognition, effect: s.favour.effect, ops: effectOps(s.favour.effect), text: '' } };
  sup.favour.text = favourText(sup);
  return sup;
});
export const supporterDef = (id) => SUPPORTERS.find((c) => c.id === id);

// --- Items -----------------------------------------------------------------------------------------------------------
// Consumed Items run their effect on one of your Pokémon (the first chosen op) or, with none, on you (Amulet Coin).
// Held Items attach to one of your Pokémon: held = the passive ops (attack, strength, keyword, speed, noHitBack).
export const ITEMS = ITEM_DATA.map((i) => {
  const ops = effectOps(i.effect);
  const item = { id: i.id, name: i.name, cardType: 'Item', art: i.art, hasArt: i.hasArt, price: i.price, itemType: i.itemType, stock: i.stock, effect: i.effect, ops, text: effectText(i.effect).replace(/\.$/, '') };
  if (i.itemType === 'Consumed' && !ops.some((o) => o.to === 'chosenOwn')) item.noTarget = true;
  if (i.itemType === 'Held' && ops.some((o) => o.noHitBack)) item.noHitBack = true;
  return item;
});
export const itemDef = (id) => ITEMS.find((c) => c.id === id);
export const BAG_SIZE = 6;   // the Inventory Bag (v1: src/engine/game.js BAG_SIZE)

// --- Locations ---------------------------------------------------------------------------------------------------------
// A Location: its lanes, Rounds and passive (ops on the Pokémon there; symmetric). Colours are the tile's border.
const LOCATION_COLOR = { 'cerulean-cape': '#4a9ae8', 'mt-ember': '#f08a3a', 'lake-of-rage': '#3ab0c8', 'route-119': '#3ab07a', 'cinnabar-volcano': '#e0603a',
  'eterna-forest': '#4f9a52', 'floaroma-meadow': '#e08ab8', 'pallet-town': '#c8b07a', 'power-plant': '#e2c040' };
export const LOCATIONS = LOC_DATA.map((l) => ({ id: l.id, name: l.name, cardType: 'Location', art: l.art, hasArt: l.hasArt, width: l.width, rounds: l.rounds,
  color: LOCATION_COLOR[l.id] ?? '#c2a36a', passive: { effect: l.passive, ops: effectOps(l.passive), text: effectText(l.passive).replace(/\.$/, '') } }));
export const locationDef = (id) => LOCATIONS.find((l) => l.id === id);

// --- Trainers and Partners ------------------------------------------------------------------------------------------------
// The Objective is tracked from match setup; the Command is the only way to play a drawn Trainer; the Partner arrives
// when the Objective completes (Level 8, free).
const SHORT_OBJECTIVE = { defeat: (n) => `Defeat ${n} Pokémon`, dominate: (n) => `Dominate ${n} times`, keptGain: (n) => `Kept gains ${n} times`,
  extraEnergy: (n) => `${n} extra Energy`, itemsBought: (n) => `Buy ${n} Items` };
export const TRAINERS = TR_DATA.map((t) => {
  const p = t.partner;
  const partner = { id: p.id, name: p.name, cardType: 'Pokémon', art: p.art, hasArt: p.hasArt, series: 'Partner', partner: true, type: p.type, attackType: p.attackType, speed: p.speed,
    strengthType: 'Hitpoints', level: p.level, cost: p.cost, attack: p.attack, strength: p.strength, keywords: { ...p.keywords }, trigger: withOps(p.trigger) };
  partner.text = cardText(partner);
  return { id: t.id, name: t.name, cardType: 'Trainer', type: t.type, art: t.art, hasArt: t.hasArt,
    command: { cost: t.command.cost, effect: t.command.effect, ops: effectOps(t.command.effect), text: effectText(t.command.effect).replace(/\.$/, '') },
    objective: { ...t.objective, kind: t.objective.op, text: objectiveText(t.objective).replace(/\.$/, ''), short: SHORT_OBJECTIVE[t.objective.op](t.objective.need) }, partner };
});
export const trainerDef = (id) => TRAINERS.find((c) => c.id === id);

// A card at a Round (off the battlefield, a Pokémon's Level follows the Round, plus any Levels it gained in hand).
const fixedDef = (id) => locationDef(id) ?? commandDef(id) ?? supporterDef(id) ?? itemDef(id) ?? trainerDef(id);
export const cardAtRound = (id, round, levelBonus = 0) => (fixedDef(id) ? structuredClone(fixedDef(id)) : pokemonAt(id, levelFor(pathDef(id).series, round), levelBonus));
export const isCardId = (id) => !!(fixedDef(id) || pathDef(id));
// Every card by id (the deck validator and the Codex use it).
export const cardKind = (id) => (pathDef(id) ? 'Pokémon' : fixedDef(id)?.cardType ?? null);
export { triggerLine, effectText, effectOps };
