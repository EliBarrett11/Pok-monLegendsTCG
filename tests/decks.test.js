// Checks the three decks (Fire, Water and Grass) against docs/decks.md: deck
// construction (40 cards, the standard split, copy limits by Rarity, one
// Legendary), each card's printed data, the Trainers, the PokéMart, deck
// choice, and that a broken deck fails loudly.
// Run with: node tests/decks.test.js
import assert from 'node:assert/strict';
import { deckProblems, checkDecks, buildDeck, buildTrainers, buildMartStock, cardDefinition, DECK_SIZE } from '../src/engine/cards.js';
import {
  RARITIES, MAX_LEGENDARY, DECKS, DECK_IDS, DECK_SPLIT, POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS,
  ITEM_CARDS, TRAINER_CARDS,
} from '../src/engine/cardData.js';
import { createGame } from '../src/engine/game.js';
import { otherDeck, randomDeck, lastDeck, lastOpponent, opponentDeck } from '../src/ui/deckSelect.js';

assert.deepEqual(Object.keys(RARITIES), ['Common', 'Rare', 'Epic', 'Legendary'], 'four tiers');
assert.deepEqual(RARITIES, { Common: 3, Rare: 2, Epic: 1, Legendary: 1 });
assert.equal(MAX_LEGENDARY, 1);
assert.deepEqual(DECK_SPLIT, { 'Pokémon': 18, Strategy: 8, Supporter: 4, Location: 4, Item: 6 });
assert.equal(DECK_SIZE, 40);
assert.deepEqual(DECK_IDS, ['fire', 'water', 'grass']);

const ALL = [...POKEMON_CARDS, ...STRATEGY_CARDS, ...SUPPORTER_CARDS, ...LOCATION_CARDS, ...ITEM_CARDS];
for (const c of ALL) assert.ok(c.rarity in RARITIES, `${c.name}: ${c.rarity}`);
assert.equal(new Set(ALL.map((c) => c.id)).size, ALL.length, 'every id is unique');

// --- The decklists, exactly as docs/decks.md -------------------------------------

assert.deepEqual(DECKS.fire.list, {
  growlithe: 3, charmander: 2, ponyta: 3, mankey: 2, magmar: 2, sneasel: 2, arcanine: 2, houndoom: 1, blaziken: 1,
  ember: 3, 'flame-charge': 2, 'heat-wave': 2, 'fire-blast': 1,
  firebreather: 2, chili: 1, burglar: 1,
  'mt-ember': 2, 'cinnabar-volcano': 1, 'stark-mountain': 1,
  charcoal: 2, 'x-attack': 2, 'quick-claw': 1, 'choice-band': 1,
});
assert.deepEqual(DECKS.water.list, {
  horsea: 2, goldeen: 2, chinchou: 2, quagsire: 3, wartortle: 2, lapras: 2, pelipper: 1, chansey: 1, gyarados: 1, vaporeon: 1, kyogre: 1,
  'aqua-ring': 3, 'bubble-beam': 2, dive: 2, surf: 1,
  'nurse-joy': 2, swimmer: 1, fisherman: 1,
  'cerulean-cape': 2, 'lake-of-rage': 1, 'route-119': 1,
  'mystic-water': 2, leftovers: 2, 'full-heal': 2,
});
assert.deepEqual(DECKS.grass.list, {
  bulbasaur: 3, ivysaur: 2, venusaur: 1, oddish: 2, gloom: 2, bellossom: 1, sunkern: 2, sunflora: 1, celebi: 1, sewaddle: 2, sudowoodo: 1,
  'leech-seed': 3, 'sleep-powder': 2, synthesis: 1, 'solar-beam': 2,
  mallow: 2, 'pokemon-breeder': 1, 'professor-oak': 1,
  'floaroma-meadow': 2, 'eterna-forest': 1, 'petalburg-woods': 1,
  'miracle-seed': 2, 'oran-berry': 2, 'rare-candy': 1, 'big-root': 1,
});
assert.deepEqual(DECKS.grass.trainers, ['erika', 'gardenia', 'ramos']);
assert.deepEqual([DECKS.grass.archetype, DECKS.grass.specialization, DECKS.grass.pokemonType], ['Combo', 'Engine', 'Grass']);
assert.deepEqual(DECKS.fire.trainers, ['blaine', 'flannery', 'kabu']);
assert.deepEqual(DECKS.water.trainers, ['misty', 'crasher-wake', 'wallace']);
assert.deepEqual(DECKS.fire.showcase, ['blaziken', 'houndoom']);
assert.deepEqual(DECKS.water.showcase, ['kyogre', 'lapras']);
assert.deepEqual([DECKS.fire.archetype, DECKS.fire.specialization, DECKS.fire.pokemonType], ['Aggressive', 'Burn', 'Fire']);
assert.deepEqual([DECKS.water.archetype, DECKS.water.specialization, DECKS.water.pokemonType], ['Board-Based', 'Value-Midrange', 'Water']);
for (const deck of Object.values(DECKS)) for (const field of ['name', 'plan', 'tradeOff']) assert.ok(deck[field], `${deck.id} ${field}`);

// Every deck passes the construction rules: 40 cards, the split, copy limits, one Legendary.
for (const [id, deck] of Object.entries(DECKS)) {
  assert.deepEqual(deckProblems(deck.list), [], id);
  const cards = buildDeck('player', id);
  assert.equal(cards.length, 40);
  const byType = {};
  for (const c of cards) byType[c.cardType] = (byType[c.cardType] ?? 0) + 1;
  assert.deepEqual(byType, DECK_SPLIT, `${id}: the standard split`);
  assert.equal(cards.filter((c) => c.rarity === 'Legendary').length, 1, `${id}: one Legendary`);
  assert.equal(new Set(cards.map((c) => c.uid)).size, 40, 'each copy has its own uid');
}
// Mostly-type: Fire 14 Fire + 4 allies; Water 15 Water + 3 allies.
const typeCount = (id, type) => buildDeck('p', id).filter((c) => c.cardType === 'Pokémon' && c.pokemonType === type).length;
assert.equal(typeCount('fire', 'Fire'), 14);
assert.equal(typeCount('water', 'Water'), 15);
// Grass: 15 Grass + 3 allies (2 Sewaddle, Bug; 1 Sudowoodo, Rock). Evolve 2 ×6, Evolve 3 ×1. Basics as the
// table in docs/decks.md lists them: cost 1 ×9, 3 ×1, 4 ×1 (its summary line says "cost 1 ×11": a question for Elliott).
assert.equal(typeCount('grass', 'Grass'), 15);
{
  const mons = buildDeck('p', 'grass').filter((c) => c.cardType === 'Pokémon');
  const curve = (list, key) => list.reduce((m, c) => ({ ...m, [c[key]]: (m[c[key]] ?? 0) + 1 }), {});
  assert.deepEqual(curve(mons.filter((c) => c.stage === 'Basic'), 'energyCost'), { 1: 9, 3: 1, 4: 1 });
  assert.deepEqual(curve(mons.filter((c) => c.stage !== 'Basic'), 'evolveCost'), { 2: 6, 3: 1 });
  assert.equal(mons.filter((c) => c.pokemonType === 'Bug').length, 2);
  assert.equal(mons.filter((c) => c.pokemonType === 'Rock').length, 1);
}

// --- Printed data -----------------------------------------------------------------

// id: [cost, type, attack, attack type, strength, strength type, speed, rarity, innate, trigger, weather]
const POKEMON = {
  growlithe: [1, 'Fire', 2, 'Physical', 5, 'Hitpoints', 'Swift', 'Common', 'Scorch 1', null, null],
  charmander: [1, 'Fire', 3, 'Special', 6, 'Hitpoints', 'Steady', 'Common', null, 'On Summon', null],
  ponyta: [2, 'Fire', 3, 'Physical', 5, 'Hitpoints', 'Swift', 'Common', 'Quick Attack, Infiltrator', null, null],
  mankey: [2, 'Fighting', 4, 'Physical', 5, 'Hitpoints', 'Swift', 'Common', 'Overrun, Infiltrator', null, null],
  magmar: [3, 'Fire', 4, 'Special', 7, 'Hitpoints', 'Steady', 'Common', 'Scorch 2', null, null],
  sneasel: [3, 'Dark', 4, 'Physical', 4, 'Hitpoints', 'Swift', 'Common', 'Infiltrator', 'On Knockout', null],
  arcanine: [4, 'Fire', 5, 'Physical', 6, 'Hitpoints', 'Swift', 'Rare', 'Overrun, Scorch 1, Infiltrator', null, null],
  houndoom: [5, 'Fire', 5, 'Special', 7, 'Hitpoints', 'Swift', 'Epic', null, 'On Summon', null],
  blaziken: [5, 'Fire', 7, 'Physical', 8, 'Hitpoints', 'Steady', 'Legendary', 'Overrun, Scorch 2', null, null],
  horsea: [1, 'Water', 3, 'Special', 4, 'Hitpoints', 'Steady', 'Common', null, 'Rally', null],
  goldeen: [2, 'Water', 4, 'Physical', 5, 'Hitpoints', 'Steady', 'Common', null, 'On Summon', null],
  chinchou: [2, 'Electric', 3, 'Special', 5, 'Special Defence', 'Steady', 'Common', 'Regenerate 1', null, null],
  quagsire: [3, 'Water', 4, 'Physical', 7, 'Defence', 'Slow', 'Common', 'Regenerate 2', null, null],
  wartortle: [3, 'Water', 4, 'Special', 5, 'Defence', 'Steady', 'Common', 'Shell 1', null, null],
  lapras: [4, 'Water', 5, 'Special', 7, 'Hitpoints', 'Steady', 'Rare', null, 'On Summon', null],
  pelipper: [4, 'Water', 5, 'Special', 5, 'Hitpoints', 'Swift', 'Rare', null, 'On Summon', { Rain: 2 }],
  chansey: [4, 'Normal', 1, 'Physical', 12, 'Hitpoints', 'Slow', 'Rare', null, 'On Breakfast', null],
  gyarados: [5, 'Water', 7, 'Physical', 6, 'Hitpoints', 'Steady', 'Epic', null, 'On Summon', null],
  vaporeon: [5, 'Water', 5, 'Special', 7, 'Special Defence', 'Steady', 'Epic', 'Regenerate 2', 'On Heal', null],
  kyogre: [6, 'Water', 7, 'Special', 11, 'Hitpoints', 'Slow', 'Legendary', null, 'On Summon', { Rain: 2 }],
  // Grass: evolution cards have no Energy Cost (their stage line is below); several abilities show no single trigger word.
  bulbasaur: [1, 'Grass', 1, 'Special', 5, 'Hitpoints', 'Steady', 'Common', null, 'On Breakfast', null],
  ivysaur: [null, 'Grass', 3, 'Special', 7, 'Hitpoints', 'Steady', 'Common', null, null, null],
  venusaur: [null, 'Grass', 5, 'Special', 12, 'Hitpoints', 'Slow', 'Epic', 'Shell 1', 'On Breakfast', null],
  oddish: [1, 'Grass', 2, 'Special', 4, 'Hitpoints', 'Steady', 'Common', null, 'On Attack', null],
  gloom: [null, 'Grass', 3, 'Special', 6, 'Hitpoints', 'Steady', 'Common', null, 'On Evolve', null],
  bellossom: [null, 'Grass', 4, 'Special', 9, 'Hitpoints', 'Steady', 'Rare', null, null, null],
  sunkern: [1, 'Grass', 2, 'Special', 6, 'Hitpoints', 'Slow', 'Common', null, null, { Sun: 1 }],
  sunflora: [null, 'Grass', 5, 'Special', 8, 'Hitpoints', 'Slow', 'Rare', null, null, { Sun: 2 }],
  celebi: [4, 'Grass', 3, 'Special', 7, 'Hitpoints', 'Swift', 'Legendary', null, null, null],
  sewaddle: [1, 'Bug', 2, 'Physical', 5, 'Hitpoints', 'Steady', 'Common', null, 'On Defeated', null],
  sudowoodo: [3, 'Rock', 3, 'Physical', 9, 'Defence', 'Slow', 'Rare', null, null, null],
};
// id: [stage, evolves from, Evolve cost]
const STAGES = {
  ivysaur: ['Stage 1', 'Bulbasaur', 2], venusaur: ['Stage 2', 'Ivysaur', 3], gloom: ['Stage 1', 'Oddish', 2],
  bellossom: ['Stage 2', 'Gloom', 2], sunflora: ['Stage 1', 'Sunkern', 2],
};
for (const c of POKEMON_CARDS) {
  assert.deepEqual(c.stage === 'Basic' ? null : [c.stage, c.evolvesFrom, c.evolveCost], STAGES[c.id] ?? null, `${c.name} stage`);
}
// The abilities of the cards with several, word by word.
const words = (id) => cardDefinition(id).abilityParts.map((p) => p.word);
assert.deepEqual(words('ivysaur'), ['On Breakfast', 'On Evolve']);
assert.deepEqual(words('bellossom'), ['On Evolve', 'On Attack']);
assert.deepEqual(words('celebi'), ['On Summon', null]);
assert.deepEqual(POKEMON_CARDS.map((c) => c.id), Object.keys(POKEMON));
for (const c of POKEMON_CARDS) {
  assert.deepEqual([c.energyCost, c.pokemonType, c.attackValue, c.attackType, c.strengthValue, c.strengthType, c.speedTier, c.rarity,
    c.innatePower, c.effectTrigger, c.weatherTokens], POKEMON[c.id], c.name);
  assert.equal(c.cardType, 'Pokémon');
}

// id: [cost, rarity, Retain?]
const STRATEGY = {
  ember: [1, 'Common', false], 'flame-charge': [2, 'Common', false], 'heat-wave': [4, 'Rare', false], 'fire-blast': [5, 'Epic', false],
  'aqua-ring': [2, 'Common', true], 'bubble-beam': [3, 'Common', false], dive: [2, 'Common', false], surf: [5, 'Rare', false],
  'leech-seed': [1, 'Common', false], 'sleep-powder': [2, 'Common', false], synthesis: [1, 'Common', false], 'solar-beam': [3, 'Rare', true],
};
assert.deepEqual(STRATEGY_CARDS.map((c) => c.id), Object.keys(STRATEGY));
for (const c of STRATEGY_CARDS) assert.deepEqual([c.energyCost, c.rarity, Boolean(c.retain)], STRATEGY[c.id], c.name);

// id: [rarity, discard, release, gift challenge]
const SUPPORTERS = {
  firebreather: ['Common', 1, 0, 'a Fire Pokémon'], chili: ['Rare', 0, 1, 'a Swift Pokémon'], burglar: ['Rare', 2, 0, 'an Item card'],
  'nurse-joy': ['Common', 1, 0, 'a Normal Pokémon'], swimmer: ['Rare', 2, 0, 'a Water Pokémon'], fisherman: ['Rare', 0, 1, 'a Strategy card'],
  mallow: ['Common', 1, 0, 'a Grass Pokémon'], 'pokemon-breeder': ['Rare', 0, 1, 'an evolution card'], 'professor-oak': ['Rare', 2, 0, 'a Pokémon card'],
};
assert.deepEqual(SUPPORTER_CARDS.map((c) => c.id), Object.keys(SUPPORTERS));
for (const c of SUPPORTER_CARDS) {
  assert.deepEqual([c.rarity, c.cardCost.discard, c.cardCost.release, c.gift.challengeText], SUPPORTERS[c.id], c.name);
  assert.ok(c.gift.bonusText && c.gift.effects.length);
}

// id: [rarity, weather, quest count, XP]
const LOCATIONS = {
  'mt-ember': ['Common', { Sun: 2 }, 4, 2], 'cinnabar-volcano': ['Rare', { Sun: 2 }, 3, 3], 'stark-mountain': ['Rare', { Sun: 3 }, 2, 2],
  'cerulean-cape': ['Common', { Rain: 2 }, 3, 2], 'lake-of-rage': ['Rare', { Rain: 2 }, 10, 3], 'route-119': ['Rare', { Rain: 3 }, 3, 2],
  'floaroma-meadow': ['Common', { Sun: 2 }, 6, 2], 'eterna-forest': ['Rare', { Sun: 1 }, 2, 3], 'petalburg-woods': ['Rare', { Sun: 2 }, 3, 2],
};
assert.deepEqual(LOCATION_CARDS.map((c) => c.id), Object.keys(LOCATIONS));
for (const c of LOCATION_CARDS) assert.deepEqual([c.rarity, c.weatherTokens, c.quest.count, c.xp], LOCATIONS[c.id], c.name);

// id: [Item-Type, PokéDollars, rarity, Retain?]
const ITEMS = {
  charcoal: ['Held', 2, 'Common', false], 'x-attack': ['Consumed', 2, 'Common', true], 'quick-claw': ['Held', 3, 'Rare', false],
  'choice-band': ['Held', 4, 'Rare', false], 'mystic-water': ['Held', 2, 'Common', false], leftovers: ['Held', 3, 'Common', false],
  'full-heal': ['Consumed', 1, 'Common', true],
  'miracle-seed': ['Held', 2, 'Common', false], 'oran-berry': ['Consumed', 1, 'Common', true], 'rare-candy': ['Consumed', 3, 'Rare', false],
  'big-root': ['Held', 3, 'Rare', false],
};
assert.deepEqual(ITEM_CARDS.map((c) => c.id), Object.keys(ITEMS));
for (const c of ITEM_CARDS) assert.deepEqual([c.itemType, c.cost, c.rarity, Boolean(c.retain)], ITEMS[c.id], c.name);

// Trainers: Fire totals 43 Strength, Water 48, Grass 46.
const TRAINERS = {
  blaine: [14, 1], flannery: [13, 1], kabu: [16, 2], misty: [16, 1], 'crasher-wake': [17, 2], wallace: [15, 1],
  erika: [15, 2], gardenia: [16, 1], ramos: [15, 1],
};
assert.deepEqual(TRAINER_CARDS.map((t) => t.id), Object.keys(TRAINERS));
for (const t of TRAINER_CARDS) assert.deepEqual([t.strength, t.power.cost], TRAINERS[t.id], t.name);
const total = (id) => buildTrainers('p', id).reduce((sum, t) => sum + t.strength, 0);
assert.equal(total('fire'), 43);
assert.equal(total('water'), 48);
assert.equal(total('grass'), 46);
assert.deepEqual(buildTrainers('ai', 'water').map((t) => [t.uid, t.maxStrength]),
  [['ai-trainer-misty', 16], ['ai-trainer-crasher-wake', 17], ['ai-trainer-wallace', 15]]);

// The PokéMart: one copy of every Item in the game.
assert.deepEqual(buildMartStock().map((i) => i.id), ['charcoal', 'x-attack', 'quick-claw', 'choice-band', 'mystic-water', 'leftovers', 'full-heal',
  'miracle-seed', 'oran-berry', 'rare-candy', 'big-root']);

// The retired placeholder cards and Trainers are gone.
for (const id of ['shinx', 'pidgey', 'absol', 'dragonite', 'quickdraw', 'hypervoice', 'potion', 'black-belt', 'tracey']) {
  assert.throws(() => cardDefinition(id), /Unknown card/, id);
}
assert.ok(!TRAINER_CARDS.some((t) => ['ash', 'brock'].includes(t.id)));

// --- Deck choice -------------------------------------------------------------------

// Each side gets the deck it was given, and that deck's three Trainers.
for (const [player, ai] of [['fire', 'water'], ['water', 'fire']]) {
  const s = createGame(5, { decks: { player, ai } });
  for (const [who, deck] of [['player', player], ['ai', ai]]) {
    const p = s.players[who];
    assert.equal(p.deck, deck);
    const ids = [...p.hand, ...p.drawPile].map((c) => c.id);
    assert.equal(ids.length, 40);
    for (const [id, copies] of Object.entries(DECKS[deck].list)) assert.equal(ids.filter((x) => x === id).length, copies, `${who} ${id}`);
    assert.deepEqual(p.trainers.map((t) => t.id), DECKS[deck].trainers);
    assert.ok(p.trainers.every((t) => t.uid.startsWith(`${who}-trainer-`)));
  }
}
// The selection screen's helpers: the AI gets the other deck; Random picks
// either; with no browser storage there is no remembered choice.
assert.equal(otherDeck('fire'), 'water');
assert.equal(otherDeck('water'), 'fire');
assert.deepEqual([randomDeck(() => 0), randomDeck(() => 0.5), randomDeck(() => 0.99)], ['fire', 'water', 'grass']);
// Against the AI: its deck is chosen too (Random by default, any deck, mirrors allowed).
assert.equal(lastOpponent(), 'random');
assert.equal(opponentDeck('grass'), 'grass');
assert.equal(opponentDeck('fire'), 'fire', 'a mirror');
assert.equal(opponentDeck('random', () => 0.99), 'grass');
assert.equal(lastDeck(), null);
// The default match: the player plays Fire, the AI Water.
assert.deepEqual([createGame(1).players.player.deck, createGame(1).players.ai.deck], ['fire', 'water']);
assert.throws(() => createGame(1, { decks: { player: 'earth', ai: 'water' } }), /Unknown deck: earth/);

// --- Broken decks fail loudly -----------------------------------------------------

// A decklist with one card swapped for another, keeping 40 cards.
const swap = (deck, out, inn, n = 1) => {
  const d = { ...DECKS[deck].list };
  d[out] -= n;
  if (!d[out]) delete d[out];
  d[inn] = (d[inn] ?? 0) + n;
  return d;
};
assert.deepEqual(deckProblems(swap('fire', 'mankey', 'growlithe')), ['Growlithe: 4 copies, but a Common card allows 3']);
assert.deepEqual(deckProblems(swap('fire', 'magmar', 'arcanine')), ['Arcanine: 3 copies, but a Rare card allows 2']);
assert.deepEqual(deckProblems(swap('fire', 'magmar', 'houndoom')), ['Houndoom: 2 copies, but an Epic card allows 1']);
assert.deepEqual(deckProblems(swap('fire', 'magmar', 'kyogre')), ['2 Legendary cards, but a deck allows 1']);
assert.deepEqual(deckProblems(swap('fire', 'charcoal', 'chili')), ['Supporter cards: 5, but a deck has 4', 'Item cards: 5, but a deck has 6']);
assert.deepEqual(deckProblems({ ...DECKS.water.list, surf: 0 }), ['Deck must have 40 cards (has 39)', 'Strategy cards: 7, but a deck has 8']);
assert.throws(() => buildDeck('player', swap('water', 'horsea', 'quagsire')), /Invalid deck: Quagsire: 4 copies/);
// At load: a broken deck stops the game with its name and every problem.
assert.throws(() => checkDecks({ broken: { ...DECKS.fire, list: swap('fire', 'charcoal', 'chili') } }),
  /Invalid Fire deck: Supporter cards: 5, but a deck has 4; Item cards: 5, but a deck has 6/);
assert.throws(() => checkDecks({ broken: { ...DECKS.water, trainers: ['misty', 'wallace'] } }), /Invalid Water deck: a deck has exactly 3 known Trainers/);
assert.doesNotThrow(() => checkDecks(DECKS));

console.log('All deck tests passed (Fire, Water and Grass).');
