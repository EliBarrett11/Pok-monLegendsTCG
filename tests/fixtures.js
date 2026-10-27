// Shared test fixtures: test-only Pokémon (plain stat blocks, no abilities
// unless a test adds them) for the rules tests, and a lookup that returns a
// test card or a real card by id. None of these are in the game's card data.
import { cardDefinition } from '../src/engine/cards.js';
import { createGame, applyAction, legalActions, attackOf, maxStrengthOf, PLAYERS } from '../src/engine/game.js';
import { inPlay } from '../src/engine/board.js';
import { refreshAuras } from '../src/engine/effects.js';
import { ability, evolution } from '../src/engine/cardData.js';

// Test-only abilities (the retired placeholder ones), for the rules tests.
export const SUMMON_STRIKE = ability('On Summon', "Deal 1 damage to an opponent Pokémon in this Pokémon's Zone.", [
  { op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent', zone: 'source' } },
]);
export const TRAINER_HUNTER = ability('On Attack', 'If this Pokémon attacked a Trainer, draw 1 card.', [
  { op: 'draw', amount: 1 },
], { targetKind: 'trainer' });
export const COUNTER = ability('On Defend', 'Deal 1 damage to the attacker.', [
  { op: 'damage', amount: 1, target: { mode: 'event', role: 'attacker' } },
]);
export const LAST_GIFT = ability('On Defeated', "Heal the friendly Trainer in this Pokémon's Zone 3 Strength.", [
  { op: 'heal', amount: 3, target: { mode: 'area', side: 'friendly', kinds: ['trainer'], zone: 'source', damaged: true } },
]);
export const EARLY_RISER = ability('On Breakfast', 'Gain 1 extra Base Energy this Round.', [
  { op: 'gainEnergy', amount: 1 },
]);

function testPokemon(id, name, energyCost, pokemonType, attackType, attackValue, strengthType, strengthValue, speedTier, extras = {}) {
  return {
    id, name, cardType: 'Pokémon', energyCost, pokemonType, image: null, attackType, attackValue, strengthType, strengthValue,
    speedTier, effectTrigger: null, effectText: null, ability: null, rarity: 'Common', innatePower: null, weatherTokens: null, ...extras,
  };
}

// id → test-only Pokémon. Cost, Type, Attack, Strength, Speed-Tier.
export const TEST_POKEMON = Object.fromEntries([
  testPokemon('test-flame', 'Test Flame', 1, 'Fire', 'Physical', 3, 'Hitpoints', 5, 'Swift', { ...SUMMON_STRIKE }),
  testPokemon('test-ripple', 'Test Ripple', 1, 'Water', 'Special', 2, 'Hitpoints', 6, 'Steady', { ...LAST_GIFT }),
  testPokemon('test-leaf', 'Test Leaf', 1, 'Grass', 'Physical', 2, 'Defence', 6, 'Slow', { ...COUNTER }),
  testPokemon('test-spark', 'Test Spark', 1, 'Electric', 'Special', 3, 'Special Defence', 4, 'Swift', { innatePower: 'Quick Attack' }),
  testPokemon('test-rock', 'Test Rock', 2, 'Rock', 'Physical', 3, 'Defence', 7, 'Slow', { ...COUNTER }),
  testPokemon('test-wing', 'Test Wing', 2, 'Flying', 'Physical', 4, 'Hitpoints', 5, 'Swift', { innatePower: 'Agility', ...TRAINER_HUNTER, rarity: 'Rare' }),
  testPokemon('test-cocoon', 'Test Cocoon', 2, 'Bug', 'Special', 3, 'Special Defence', 6, 'Steady', { ...LAST_GIFT, rarity: 'Rare' }),
  testPokemon('test-fin', 'Test Fin', 3, 'Water', 'Special', 4, 'Special Defence', 7, 'Steady', { ...EARLY_RISER, rarity: 'Rare' }),
  testPokemon('test-blaze', 'Test Blaze', 3, 'Fire', 'Physical', 5, 'Hitpoints', 7, 'Steady', { innatePower: 'Quick Attack', rarity: 'Rare' }),
  testPokemon('test-mud', 'Test Mud', 3, 'Water', 'Special', 4, 'Defence', 8, 'Slow', { ...LAST_GIFT, rarity: 'Rare' }),
  testPokemon('test-ghost', 'Test Ghost', 4, 'Ghost', 'Special', 5, 'Special Defence', 8, 'Swift', { innatePower: 'Agility', ...SUMMON_STRIKE, rarity: 'Rare' }),
  testPokemon('test-steel', 'Test Steel', 4, 'Steel', 'Physical', 4, 'Defence', 10, 'Slow', { ...COUNTER, rarity: 'Rare' }),
  testPokemon('test-fairy', 'Test Fairy', 5, 'Fairy', 'Special', 6, 'Special Defence', 9, 'Steady', { innatePower: 'Agility', weatherTokens: { Sun: 1 }, ...EARLY_RISER, rarity: 'Epic' }),
  testPokemon('test-shadow', 'Test Shadow', 5, 'Dark', 'Physical', 6, 'Hitpoints', 9, 'Swift', { innatePower: 'Quick Attack', ...TRAINER_HUNTER, rarity: 'Epic' }),
  testPokemon('test-inferno', 'Test Inferno', 6, 'Fire', 'Physical', 7, 'Defence', 12, 'Slow', { ...SUMMON_STRIKE, rarity: 'Legendary' }),
  testPokemon('test-dragon', 'Test Dragon', 6, 'Dragon', 'Special', 7, 'Hitpoints', 11, 'Steady', { rarity: 'Epic' }),
  // Grass G1: a test-only evolution line (docs/decks.md 2.8). Test Sprout is a
  // Basic; Test Bloom evolves from it (Evolve cost 2, On Evolve: gain 1 Growth);
  // Test Blossom evolves from Test Bloom (Evolve cost 3).
  testPokemon('test-sprout', 'Test Sprout', 2, 'Grass', 'Physical', 2, 'Hitpoints', 5, 'Slow', { weatherTokens: { Sun: 1 } }),
  evolution('Stage 1', 'Test Sprout', 2, testPokemon('test-bloom', 'Test Bloom', 2, 'Grass', 'Special', 4, 'Defence', 8, 'Steady', {
    innatePower: 'Shell 1', weatherTokens: { Rain: 1 }, rarity: 'Rare',
    ...ability('On Evolve', 'Gain 1 Growth.', [{ op: 'gainGrowth', amount: 1 }]),
  })),
  evolution('Stage 2', 'Test Bloom', 3, testPokemon('test-blossom', 'Test Blossom', 3, 'Grass', 'Special', 6, 'Hitpoints', 11, 'Swift', { rarity: 'Epic' })),
  // On Summon: put an enemy Pokémon in this Zone to Sleep; and one that seeds.
  testPokemon('test-dozer', 'Test Dozer', 1, 'Normal', 'Physical', 1, 'Hitpoints', 4, 'Slow',
    ability('On Summon', "Put an enemy Pokémon in this Pokémon's Zone to Sleep.", [{ op: 'applyStatus', status: 'sleep', target: { mode: 'targeted', side: 'opponent', zone: 'source' } }])),
  testPokemon('test-seeder', 'Test Seeder', 1, 'Grass', 'Physical', 1, 'Hitpoints', 4, 'Slow',
    ability('On Summon', 'Leech Seed an enemy Pokémon.', [{ op: 'applyStatus', status: 'leechSeed', target: { mode: 'targeted', side: 'opponent' } }])),
  // A test-only Strategy Card.
  { id: 'test-hypervoice', name: 'Test Hypervoice', cardType: 'Strategy', energyCost: 3, image: null, rarity: 'Common',
    effectText: 'Deal 2 damage to all opponent Pokémon.', effects: [{ op: 'damage', amount: 2, target: { mode: 'area', side: 'opponent' } }] },
].map((c) => [c.id, c]));

// A card definition by id: a test-only Pokémon, or a real card.
export function def(id) {
  return TEST_POKEMON[id] ?? cardDefinition(id);
}

// A fresh copy of a card (test or real) with its own uid, plus extras.
let made = 0;
export function testCard(id, extras = {}) {
  return { ...structuredClone(def(id)), uid: `test-${id}-${made++}`, ...extras };
}

// Each side's Trainer uids, in the order their deck lists them (zone 1, 2, 3).
export const trainerOrder = (s, who) => s.players[who].trainers.map((t) => t.uid);

// Test-only Trainers (the retired placeholder ones), Strength 15 each.
export const TEST_TRAINERS = [
  {
    id: 'test-ash', name: 'Test Ash', cardType: 'Trainer', strength: 15,
    power: {
      cost: 1,
      text: 'Draw 1 card. You may summon a 1-cost Pokémon from your hand without paying its cost.',
      effects: [{ op: 'draw', amount: 1 }, { op: 'freeSummon', filter: { cardType: 'Pokémon', energyCost: 1 } }],
    },
    passive: { text: "Friendly Pokémon in this Trainer's Zone gain +1/+1.", aura: { attack: 1, strength: 1, target: { side: 'friendly', zone: 'source' } } },
  },
  {
    id: 'test-misty', name: 'Test Misty', cardType: 'Trainer', strength: 15,
    power: {
      cost: 1,
      text: "Deal 1 damage to an opponent Pokémon in this Trainer's Zone.",
      effects: [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent', zone: 'source' } }],
    },
    passive: { text: "Friendly Water Pokémon in this Trainer's Zone gain +3 Strength.", aura: { attack: 0, strength: 3, target: { side: 'friendly', zone: 'source', filter: { pokemonType: 'Water' } } } },
  },
  {
    id: 'test-brock', name: 'Test Brock', cardType: 'Trainer', strength: 15,
    power: {
      cost: 1,
      text: 'Give a friendly Pokémon +2 Defence.',
      effects: [{ op: 'buff', strength: 2, strengthType: 'Defence', target: { mode: 'targeted', side: 'friendly' } }],
    },
    passive: {
      text: "Opponent Pokémon summoned to this Trainer's Zone take 1 damage.",
      triggers: [{ on: 'summon', match: { side: 'opponent', zone: 'source' }, effects: [{ op: 'damage', amount: 1, target: { mode: 'event' } }] }],
    },
  },
];

// Swaps both sides' Trainers for the test Trainers (Test Ash, Test Misty,
// Test Brock), before they are assigned to Zones. Returns the state.
export function useTestTrainers(s) {
  for (const who of ['player', 'ai']) {
    s.players[who].trainers = TEST_TRAINERS.map((t) => ({
      ...structuredClone(t), uid: `${who}-trainer-${t.id}`, maxStrength: t.strength, powerUsedRound: null,
    }));
  }
  return s;
}

// --- Shared match helpers ------------------------------------------------------

// Round 1 Battle: each side plays its deck (player Fire, AI Water unless
// asked), Trainers in deck order in Zones 1–3, empty hands, plenty of Base
// Energy, no PokéDollars, the player to act and to have initiative.
// testTrainers: Test Ash / Test Misty / Test Brock instead of the deck's.
// passives: false turns Trainer Passives off. powers: false prices Powers out.
export function battle({ seed = 21, player = 'fire', ai = 'water', testTrainers = false, passives = true, powers = true } = {}) {
  let s = createGame(seed, { decks: { player, ai } });
  if (testTrainers) useTestTrainers(s);
  for (const who of PLAYERS) s = applyAction(s, { type: 'assignTrainers', who, order: trainerOrder(s, who) });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.dollars = 0;
    if (!passives) p.trainers.forEach((t) => { t.passive = { text: '' }; });
    if (!powers) p.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  }
  s.initiative = 'player';
  s.turn = 'player';
  s.passesInARow = 0;
  return s;
}

// Puts a card into `who`'s hand: from their Draw Pile or Discard Pile if one
// is there, otherwise a new copy (any card, test or real). Returns its uid.
let given = 0;
export function give(s, who, id, extras = {}) {
  const p = s.players[who];
  let card;
  for (const pile of [p.drawPile, p.discard]) {
    const i = pile.findIndex((c) => c.id === id);
    if (i >= 0) { [card] = pile.splice(i, 1); break; }
  }
  card ??= { ...structuredClone(def(id)), uid: `${who}-${id}-g${given++}` };
  Object.assign(card, extras);
  p.hand.push(card);
  return card.uid;
}

// Makes it `who`'s turn with plenty of Base Energy.
export function onTurn(s, who) {
  s.turn = who;
  s.passesInARow = 0;
  s.players[who].baseEnergy = 10;
  return s;
}
export const act = (s, who, action) => applyAction(onTurn(s, who), { who, ...action });

// Plays a Pokémon from hand (given first). An On Summon choice is left pending.
export const play = (s, who, id, zone, space, extras) => act(s, who, { type: 'playPokemon', uid: give(s, who, id, extras), zone, space });

// Puts a Pokémon straight into a space (no summon: no On Summon, Rally, quests).
export function place(s, who, zone, space, id, { spent = false, ...extras } = {}) {
  const card = { ...structuredClone(def(id)), uid: `${who}-${id}-p${given++}`, ...extras };
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
  return { kind: 'pokemon', owner: who, zone, space };
}

// Both pass: Supper, then the next Round's Breakfast, to its Battle Phase.
export function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  for (const who of PLAYERS) if (s.xpStep && legalActions(s, who).includes('spendXp')) s = applyAction(s, { type: 'spendXp', who, spend: [] });
  return s;
}

export const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
export const trainerAt = (s, who, zone) => s.players[who].zones[zone].trainer;
export const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });
export const tref = (owner, zone) => ({ kind: 'trainer', owner, zone });
export const zref = (owner, zone) => ({ kind: 'zone', owner, zone });
export const href = (owner, uid) => ({ kind: 'hand', owner, uid });
export const stats = (c) => [attackOf(c), c.currentStrength, maxStrengthOf(c)];
export const logged = (s, text) => s.log.some((l) => l.includes(text));
export const choose = (s, choice) => applyAction(s, { type: 'resolveChoice', who: s.pending.who, ...choice });
