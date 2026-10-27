// Checks the Pokémon card format and the "Play a Pokémon Card" Battle Action.
// Run with: node tests/pokemon.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, playablePokemon, costPreview, emptySpaces, PLAYERS, opponentOf } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { WEATHER_TYPES, POKEMON_CARDS, POKEMON_TYPES, ATTACK_TYPES, STRENGTH_TYPES, SPEED_TIERS, RARITIES, DECKS } from '../src/engine/cardData.js';
import {
  def, battle, place, play as playCard, give, act, nextRound, choose, at, trainerAt, pref, tref, href, stats,
} from './fixtures.js';
import { statusCount } from '../src/engine/status.js';
import { weatherCounts } from '../src/engine/game.js';

// --- Card format ------------------------------------------------------------

assert.equal(POKEMON_CARDS.length, 20);
assert.equal(new Set(POKEMON_CARDS.map((c) => c.id)).size, 20, 'unique ids');
for (const c of POKEMON_CARDS) {
  assert.equal(c.cardType, 'Pokémon');
  assert.ok(typeof c.name === 'string' && c.name);
  assert.ok(POKEMON_TYPES.includes(c.pokemonType), c.name);
  assert.ok(ATTACK_TYPES.includes(c.attackType), c.name);
  assert.ok(STRENGTH_TYPES.includes(c.strengthType), c.name);
  assert.ok(SPEED_TIERS.includes(c.speedTier), c.name);
  assert.ok(c.rarity in RARITIES, c.name);
  assert.ok(c.energyCost >= 1 && c.energyCost <= 6, `${c.name} cost`);
  assert.ok(c.attackValue >= 1 && c.attackValue <= 7, `${c.name} attack`);
  assert.ok(c.strengthValue >= 3 && c.strengthValue <= 12, `${c.name} strength`);
  assert.ok('image' in c);
  for (const field of ['effectTrigger', 'effectText', 'innatePower']) {
    assert.ok(c[field] === null || typeof c[field] === 'string', `${c.name} ${field}`);
  }
  assert.ok(c.weatherTokens === null
    || Object.entries(c.weatherTokens).every(([type, n]) => WEATHER_TYPES.includes(type) && n >= 1), `${c.name} weather`);
  assert.equal(c.effectTrigger === null, c.effectText === null, 'trigger word and effect text go together');
}
assert.equal(POKEMON_TYPES.length, 18);
assert.deepEqual(new Set(POKEMON_CARDS.map((c) => c.rarity)), new Set(Object.keys(RARITIES)), 'every rarity used');

// Each side's deck holds its own Pokémon: 18 of them.
{
  const s = createGame(1);
  for (const who of PLAYERS) {
    const mons = [...s.players[who].hand, ...s.players[who].drawPile].filter((c) => c.cardType === 'Pokémon');
    assert.equal(mons.length, 18);
    assert.ok(mons.every((c) => (who === 'player' ? DECKS.fire : DECKS.water).list[c.id]), who);
  }
}

// --- Helpers ----------------------------------------------------------------

function toRound1Battle(seed) {
  let s = createGame(seed);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  // Plain Trainers and no abilities, so these tests check playing Pokémon alone
  // (Trainers and abilities have their own tests).
  for (const who of PLAYERS) for (const t of s.players[who].trainers) { t.power = null; t.passive = null; }
  for (const who of PLAYERS) s.players[who].dollars = 0;   // nothing to buy
  for (const who of PLAYERS) for (const c of [...s.players[who].drawPile, ...s.players[who].hand, ...s.players[who].discard]) c.ability = null;
  return s;
}

// Replaces a player's hand with the listed card ids, taken from their piles.
function setHand(s, who, ids) {
  const p = s.players[who];
  p.drawPile.push(...p.hand);
  p.hand = ids.map((id) => {
    const i = p.drawPile.findIndex((c) => c.id === id);
    return i >= 0 ? p.drawPile.splice(i, 1)[0] : { ...structuredClone(def(id)), uid: `${who}-${id}-extra` };
  });
  return p.hand.map((c) => c.uid);
}

const play = (s, who, uid, zone, space) => applyAction(s, { type: 'playPokemon', who, uid, zone, space });
const pass = (s) => applyAction(s, { type: 'pass', who: s.turn });

// --- Playing a Pokémon --------------------------------------------------------

// Paid with Base Energy; arrives Spent with its own current Strength; uses the turn.
{
  let s = toRound1Battle(2);
  const me = s.turn;
  const [ember] = setHand(s, me, ['growlithe', 'charcoal']);
  assert.deepEqual(legalActions(s, me), ['pass', 'playPokemon']);
  assert.deepEqual(costPreview(s, me, ember), { fromBase: 1, fromExert: 0 });
  s = play(s, me, ember, 1, 2);
  const placed = s.players[me].zones[1].pokemon[2];
  assert.equal(placed.name, 'Growlithe');
  assert.equal(placed.spent, true, 'arrives Spent');
  assert.equal(placed.currentStrength, 5);
  assert.equal(placed.strengthValue, 5, 'printed value kept separately');
  assert.equal(s.players[me].baseEnergy, 0);
  assert.equal(s.players[me].exhaust.length, 0);
  assert.ok(!s.players[me].hand.some((c) => c.uid === ember), 'left the hand');
  assert.equal(s.turn, opponentOf(me), 'the play used the turn');
  assert.ok(s.log.at(-1).includes('played Growlithe into Zone 2, Space 3, paying 1 Base Energy'));
}

// Exert covers only the shortfall, and becomes Exhaust.
{
  let s = toRound1Battle(3);
  const me = s.turn;
  const [mankey] = setHand(s, me, ['mankey']);  // cost 2; Round 1 has 1 Base + 1 Exert
  assert.deepEqual(costPreview(s, me, mankey), { fromBase: 1, fromExert: 1 });
  s = play(s, me, mankey, 0, 0);
  const p = s.players[me];
  assert.equal(p.baseEnergy, 0);
  assert.deepEqual(p.exhaust.map((x) => [x.position, x.recoversRound]), [[1, 3]]);
  assert.ok(s.log.at(-1).endsWith('paying 1 Base Energy + 1 Exert.'));
}

// Refused: unaffordable, occupied space, not a Pokémon, not in hand, not your turn.
{
  let s = toRound1Battle(4);
  const me = s.turn;
  const [magmar, growlithe, item] = setHand(s, me, ['magmar', 'growlithe', 'charcoal']);
  assert.ok(!playablePokemon(s, me).some((c) => c.uid === magmar), 'cost 3 > 1 Base + 1 Exert');
  assert.throws(() => play(s, me, magmar, 0, 0), /Not enough Energy/);
  assert.throws(() => play(s, me, item, 0, 0), /Pokémon/);
  assert.throws(() => play(s, me, 'nope', 0, 0), /Pokémon/);
  assert.throws(() => play(s, me, growlithe, 3, 0), /empty/);
  assert.throws(() => play(s, opponentOf(me), growlithe, 0, 0), /cannot/);
  s.players[me].zones[0].pokemon[0] = { name: 'Blocker' };
  assert.throws(() => play(s, me, growlithe, 0, 0), /empty/);
}

// A full arena can't take another Pokémon.
{
  const s = toRound1Battle(5);
  const me = s.turn;
  setHand(s, me, ['growlithe']);
  s.players[me].zones.forEach((z) => { z.pokemon = z.pokemon.map(() => ({ name: 'Blocker', spent: true })); });
  assert.equal(emptySpaces(s, me).length, 0);
  assert.deepEqual(legalActions(s, me), ['pass']);
}

// Playing resets the pass count: a player who passed gets another turn.
// Spent Pokémon become Active at the next Breakfast, keeping current Strength.
{
  let s = toRound1Battle(6);
  const first = s.turn;
  const second = opponentOf(first);
  const [sprout] = setHand(s, second, ['horsea']);
  s = pass(s);
  s = play(s, second, sprout, 2, 1);
  assert.equal(s.phase, 'battle');
  assert.equal(s.turn, first, 'the passer gets another turn');
  s = pass(s);
  assert.equal(s.phase, 'battle', 'one pass after a play does not end Battle');
  s.players[second].zones[2].pokemon[1].currentStrength = 1;
  s = pass(s);
  assert.equal(s.round, 2);
  const horsea = s.players[second].zones[2].pokemon[1];
  assert.equal(horsea.spent, false, 'Active again at Breakfast');
  assert.equal(horsea.currentStrength, 1, 'current Strength carries over');
  assert.ok(s.log.some((l) => l.includes('Spent Pokémon became Active: Horsea')));
}

// --- AI ---------------------------------------------------------------------

// Plays something it can pay for with Base Energy alone, never using Exert.
for (let seed = 1; seed <= 20; seed++) {
  let s = toRound1Battle(seed);
  s.turn = 'ai';
  setHand(s, 'ai', ['growlithe', 'horsea', 'mankey', 'charcoal']);
  const action = chooseAction(s, 'ai');
  assert.equal(action.type, 'playPokemon');
  s = applyAction(s, action);
  const placed = s.players.ai.zones.flatMap((z) => z.pokemon).filter(Boolean);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].energyCost, 1, 'Mankey would need Exert');
  assert.equal(s.players.ai.exhaust.length, 0);
}

// Passes when only Exert could pay, or with no Pokémon.
{
  const s = toRound1Battle(7);
  s.turn = 'ai';
  setHand(s, 'ai', ['mankey', 'charcoal']);
  assert.ok(playablePokemon(s, 'ai').length, 'Mankey is affordable with Exert...');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' }, '...but the AI will not use Exert');
  setHand(s, 'ai', ['charcoal']);
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' });
  assert.equal(chooseAction(s, 'player'), null, 'nothing to do off-turn');
}

// --- The Fire and Water Pokémon, each working as written ------------------------

{
  // Trainer Passives and Powers off, so the numbers are the cards' own.
  const fire = () => battle({ passives: false, powers: false });
  const water = () => battle({ player: 'water', ai: 'fire', passives: false, powers: false });
  const attack = (s, who, from, target) => act(s, who, { type: 'command', from, target });
  const burn = (c) => statusCount(c, 'burn');
  const hurt = (s, ref, to) => { at(s, ref.owner, ref.zone, ref.space).currentStrength = to; return ref; };

  // Growlithe — Scorch 1: its attack Burns the target 1.
  {
    let s = fire();
    place(s, 'player', 0, 0, 'growlithe');
    place(s, 'ai', 1, 0, 'test-dragon', { spent: true });
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
    assert.equal(at(s, 'ai', 1, 0).currentStrength, 11 - 2);
    assert.equal(burn(at(s, 'ai', 1, 0)), 1);
  }

  // Charmander — On Summon: Burn 1 to an enemy Pokémon or Trainer in its Zone.
  {
    let s = fire();
    place(s, 'ai', 0, 0, 'test-dragon');
    place(s, 'ai', 1, 0, 'test-flame');                       // another Zone: not offered
    s = playCard(s, 'player', 'charmander', 0, 1);
    assert.equal(s.pending.kind, 'target');
    assert.deepEqual(s.pending.options.map((o) => [o.kind, o.owner, o.zone]).sort(), [['pokemon', 'ai', 0], ['trainer', 'ai', 0]],
      'the enemy Pokémon and the enemy Trainer in its Zone');
    s = choose(s, { target: tref('ai', 0) });
    assert.equal(burn(trainerAt(s, 'ai', 0)), 1, 'Trainers can be burned');
  }

  // Ponyta — Quick Attack: arrives Active.
  {
    let s = fire();
    s = playCard(s, 'player', 'ponyta', 0, 0);
    assert.equal(at(s, 'player', 0, 0).spent, false);
  }

  // Mankey — Overrun: damage left over after a defeat hits the Trainer in that Zone.
  {
    let s = fire();
    place(s, 'player', 0, 0, 'mankey');                       // Attack 4
    hurt(s, place(s, 'ai', 2, 0, 'test-flame', { spent: true }), 1);
    const before = trainerAt(s, 'ai', 2).strength;
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 2, space: 0 });
    assert.equal(at(s, 'ai', 2, 0), null, 'defeated');
    assert.equal(trainerAt(s, 'ai', 2).strength, before - 3, '4 damage, 1 needed: 3 to the Trainer');
  }

  // Magmar — Scorch 2.
  {
    let s = fire();
    place(s, 'player', 0, 0, 'magmar');
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'trainer', zone: 1 });
    assert.equal(trainerAt(s, 'ai', 1).strength, 17 - 4);
    assert.equal(burn(trainerAt(s, 'ai', 1)), 2, 'Scorch works on Trainers too');
  }

  // Sneasel — On Knockout: it becomes Active, once per Round.
  {
    let s = fire();
    place(s, 'player', 0, 0, 'sneasel');                      // Attack 4
    hurt(s, place(s, 'ai', 0, 0, 'test-flame', { spent: true }), 1);
    hurt(s, place(s, 'ai', 1, 0, 'test-flame', { spent: true }), 1);
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 0, space: 0 });
    assert.equal(at(s, 'ai', 0, 0), null);
    assert.equal(at(s, 'player', 0, 0).spent, false, 'Active again after the knockout');
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
    assert.equal(at(s, 'ai', 1, 0), null);
    assert.equal(at(s, 'player', 0, 0).spent, true, 'only once per Round');
    s = nextRound(s);
    hurt(s, place(s, 'ai', 2, 0, 'test-flame', { spent: true }), 1);
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 2, space: 0 });
    assert.equal(at(s, 'player', 0, 0).spent, false, 'again the next Round');
  }

  // Arcanine — Overrun and Scorch 1. Scorch only Burns a target still in play.
  {
    let s = fire();
    place(s, 'player', 0, 0, 'arcanine');                     // Attack 5
    place(s, 'ai', 0, 0, 'test-dragon', { spent: true });
    s = attack(s, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 0, space: 0 });
    assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, burn(at(s, 'ai', 0, 0))], [6, 1]);
    let t = fire();
    place(t, 'player', 0, 0, 'arcanine');
    hurt(t, place(t, 'ai', 0, 0, 'test-flame', { spent: true }), 2);
    t = attack(t, 'player', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 0, space: 0 });
    assert.equal(trainerAt(t, 'ai', 0).strength, 16 - 3, 'Overrun: 3 left over');
    assert.equal(burn(trainerAt(t, 'ai', 0)), 0, "Scorch Burns the attack's target, not the Trainer");
  }

  // Houndoom — On Summon: Burn 2 to each enemy Trainer.
  {
    let s = fire();
    s = playCard(s, 'player', 'houndoom', 1, 0);
    assert.deepEqual(s.players.ai.zones.map((z) => burn(z.trainer)), [2, 2, 2]);
    assert.ok(s.players.player.zones.every((z) => burn(z.trainer) === 0), 'enemy Trainers only');
  }

  // Blaziken — Overrun and Scorch 2.
  {
    let s = fire();
    place(s, 'player', 1, 0, 'blaziken');                     // Attack 7
    hurt(s, place(s, 'ai', 1, 0, 'test-flame', { spent: true }), 3);
    s = attack(s, 'player', { zone: 1, space: 0 }, { kind: 'pokemon', zone: 1, space: 0 });
    assert.equal(trainerAt(s, 'ai', 1).strength, 17 - 4);
    s = nextRound(s);
    s = attack(s, 'player', { zone: 1, space: 0 }, { kind: 'trainer', zone: 1 });
    assert.equal(burn(trainerAt(s, 'ai', 1)), 2);
  }

  // Horsea — Rally: +1/+1 when another friendly Pokémon is summoned into its Zone.
  {
    let s = water();
    s = playCard(s, 'player', 'horsea', 0, 0);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4], 'not for its own summon');
    s = playCard(s, 'player', 'chinchou', 1, 0);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4], 'not for another Zone');
    s = playCard(s, 'player', 'chinchou', 0, 1);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [4, 5, 5]);
    s = playCard(s, 'ai', 'growlithe', 0, 0);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [4, 5, 5], 'not for an enemy');
  }

  // Goldeen — On Summon: heal a damaged friendly Pokémon 2.
  {
    let s = water();
    hurt(s, place(s, 'player', 2, 0, 'quagsire'), 3);
    s = playCard(s, 'player', 'goldeen', 0, 0);
    assert.deepEqual(s.pending.options, [pref('player', 2, 0)], 'damaged friendly Pokémon only');
    s = choose(s, { target: pref('player', 2, 0) });
    assert.equal(at(s, 'player', 2, 0).currentStrength, 5);
    let t = water();
    t = playCard(t, 'player', 'goldeen', 0, 0);
    assert.equal(t.pending, null, 'nothing damaged: nothing to heal');
  }

  // Chinchou — Regenerate 1; Quagsire — Regenerate 2: they heal at Breakfast.
  {
    let s = water();
    hurt(s, place(s, 'player', 0, 0, 'chinchou'), 1);
    hurt(s, place(s, 'player', 1, 0, 'quagsire'), 1);
    s = nextRound(s);
    assert.equal(at(s, 'player', 0, 0).currentStrength, 2);
    assert.equal(at(s, 'player', 1, 0).currentStrength, 3);
  }

  // Wartortle — Shell 1: every instance of damage is 1 less, to a minimum of 1.
  {
    let s = water();
    place(s, 'player', 0, 0, 'wartortle', { spent: true });   // Strength 5
    place(s, 'ai', 0, 0, 'magmar');                           // Attack 4, Scorch 2
    s = attack(s, 'ai', { zone: 0, space: 0 }, { kind: 'pokemon', zone: 0, space: 0 });
    assert.equal(at(s, 'player', 0, 0).currentStrength, 2, '4 − 1');
    assert.equal(burn(at(s, 'player', 0, 0)), 2);
    s = nextRound(s);                                         // Burn 2 − 1 Shell = 1
    assert.equal(at(s, 'player', 0, 0).currentStrength, 1);
  }

  // Lapras — On Summon: heal all friendly Pokémon in its Zone 2.
  {
    let s = water();
    hurt(s, place(s, 'player', 0, 0, 'quagsire'), 2);
    hurt(s, place(s, 'player', 1, 0, 'quagsire'), 2);        // another Zone
    s = playCard(s, 'player', 'lapras', 0, 1);
    assert.equal(at(s, 'player', 0, 0).currentStrength, 4);
    assert.equal(at(s, 'player', 1, 0).currentStrength, 2);
  }

  // Pelipper — 2 Rain; On Summon: a card in your hand gains Retain.
  {
    let s = water();
    const keep = give(s, 'player', 'surf');
    const other = give(s, 'player', 'dive');
    s = playCard(s, 'player', 'pelipper', 0, 0);
    assert.equal(weatherCounts(s).Rain, 2);
    assert.equal(s.pending.kind, 'target');
    s = choose(s, { target: href('player', keep) });
    s = nextRound(s);
    assert.ok(s.players.player.hand.some((c) => c.uid === keep), 'kept at Supper');
    assert.ok(s.players.player.discard.some((c) => c.uid === other), 'the other card was discarded');
  }

  // Chansey — On Breakfast: heal each friendly Pokémon in its Zone 2.
  {
    let s = water();
    place(s, 'player', 0, 0, 'chansey');
    hurt(s, place(s, 'player', 0, 1, 'horsea'), 1);
    hurt(s, place(s, 'player', 1, 0, 'horsea'), 1);
    s = nextRound(s);
    assert.equal(at(s, 'player', 0, 1).currentStrength, 3);
    assert.equal(at(s, 'player', 1, 0).currentStrength, 1, 'its Zone only');
  }

  // Gyarados — On Summon: 2 damage to each enemy Pokémon in its Zone.
  {
    let s = water();
    place(s, 'ai', 0, 0, 'test-dragon');
    place(s, 'ai', 0, 1, 'test-shadow');
    place(s, 'ai', 1, 0, 'test-dragon');
    s = playCard(s, 'player', 'gyarados', 0, 0);
    assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, at(s, 'ai', 0, 1).currentStrength, at(s, 'ai', 1, 0).currentStrength], [9, 7, 11]);
  }

  // Vaporeon — Regenerate 2; On Heal: +1 Attack (permanent).
  {
    let s = water();
    hurt(s, place(s, 'player', 0, 0, 'vaporeon'), 3);
    s = nextRound(s);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [6, 5, 7]);
    s = nextRound(s);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [7, 7, 7]);
    s = nextRound(s);
    assert.deepEqual(stats(at(s, 'player', 0, 0)), [7, 7, 7], 'not healed: no On Heal');
  }

  // Kyogre — 2 Rain; On Summon: heal every friendly Pokémon and Trainer 2.
  {
    let s = water();
    hurt(s, place(s, 'player', 2, 0, 'quagsire'), 1);
    trainerAt(s, 'player', 0).strength = 10;
    trainerAt(s, 'ai', 0).strength = 10;
    place(s, 'ai', 1, 0, 'growlithe');
    hurt(s, { kind: 'pokemon', owner: 'ai', zone: 1, space: 0 }, 1);
    s = playCard(s, 'player', 'kyogre', 1, 1);
    assert.equal(weatherCounts(s).Rain, 2);
    // Kyogre's own 2 Rain: ☔ Rain 2 adds 1 to each heal, so heal 2 heals 3.
    assert.equal(at(s, 'player', 2, 0).currentStrength, 4);
    assert.equal(trainerAt(s, 'player', 0).strength, 13);
    assert.equal(trainerAt(s, 'ai', 0).strength, 10, 'friendly only');
    assert.equal(at(s, 'ai', 1, 0).currentStrength, 1);
  }
}

console.log('All Pokémon tests passed.');
