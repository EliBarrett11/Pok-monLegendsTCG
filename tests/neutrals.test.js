// N1 — the neutral cards (docs/decks.md, "Neutral cards" in each deck), one by
// one, and the general effects they brought: On Defend at the attacker, a bonus
// against a burned target, Retaliate (Rocky Helmet), looking at the top of the
// Draw Pile (Tracey) and effects that last until the next Breakfast (Brock).
// Run with: node tests/neutrals.test.js
import assert from 'node:assert/strict';
import { applyAction, legalActions, PLAYERS, attackOf, maxStrengthOf, attackPower } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { hasKeyword, keywordAmount } from '../src/engine/keywords.js';
import { viewFor } from '../src/engine/view.js';
import { DECKS, INNATE_POWERS } from '../src/engine/cardData.js';
import { battle, give, act, place, nextRound, at, trainerAt, tref, choose, logged, def } from './fixtures.js';
import { chooseAction } from '../src/ai/opponent.js';

// A Round 1 Battle with no Trainer Passives or Powers in the way.
const match = (decks = {}) => battle({ passives: false, powers: false, ...decks });
const statusOf = (card) => Object.keys(card?.status ?? {});
const burnOf = (card) => card?.status?.burn?.count ?? 0;
// Only `ref` is Active: every other Pokémon is Spent, so `ref` is Alert whatever its speed.
function onlyAlert(s, ...refs) {
  for (const who of PLAYERS) {
    s.players[who].zones.forEach((z, zone) => z.pokemon.forEach((c, space) => {
      if (c) c.spent = !refs.some((r) => r.owner === who && r.zone === zone && r.space === space);
    }));
  }
}
const attack = (s, from, to) => act(s, from.owner, { type: 'command', from: { zone: from.zone, space: from.space }, target: { kind: to.kind ?? 'pokemon', zone: to.zone, space: to.space } });
const strategy = (s, id, target) => act(s, 'player', { type: 'playStrategy', uid: give(s, 'player', id), target });
const supporter = (s, id, pay, target) => {
  const uid = give(s, 'player', id);
  const cost = s.players.player.hand.find((c) => c.uid === uid).cardCost;
  const uids = pay.map((pid) => give(s, 'player', pid));
  return act(s, 'player', { type: 'playSupporter', uid, discard: uids.slice(0, cost.discard), release: uids.slice(cost.discard), target });
};

// --- The decks: each neutral replaces one copy, as docs/decks.md lists ----------------------------------------

{
  const has = (deck, id) => DECKS[deck].list[id];
  for (const id of ['dusclops', 'absol', 'hyper-voice', 'black-belt']) assert.equal(has('fire', id), 1, id);
  for (const id of ['dragonite', 'shinx', 'thunderbolt', 'rocky-helmet', 'tracey']) assert.equal(has('water', id), 1, id);
  for (const id of ['metapod', 'geodude', 'rock-slide', 'brock']) assert.equal(has('grass', id), 1, id);
  assert.deepEqual(['growlithe', 'magmar', 'ember', 'x-attack'].map((id) => has('fire', id)), [2, 1, 2, 1]);
  assert.deepEqual(['quagsire', 'lapras', 'bubble-beam', 'mystic-water', 'nurse-joy'].map((id) => has('water', id)), [2, 1, 1, 1, 1]);
  assert.deepEqual(['sewaddle', 'bulbasaur', 'leech-seed', 'mallow'].map((id) => has('grass', id)), [1, 2, 1, 1]);
  // Art: all 13 in assets/cards (Hyper Voice's file is hypervoice.jpg).
  assert.equal(cardDefinition('hyper-voice').image, 'assets/cards/hypervoice.jpg');
}

// --- Fire: Dusclops — On Defend: Burn 1 to the attacker --------------------------------------------------------

{
  let s = match({ player: 'water', ai: 'fire' });
  const horsea = place(s, 'player', 0, 0, 'horsea');
  const dusclops = place(s, 'ai', 0, 0, 'dusclops');
  onlyAlert(s, horsea);
  s = attack(s, horsea, dusclops);
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 8 - 3, 'Dusclops took the hit');
  assert.equal(burnOf(at(s, 'player', 0, 0)), 1, 'and Burned the attacker 1');
  // Defeated by the attack: no On Defend (as every On Defend).
  s = match({ player: 'water', ai: 'fire' });
  const lapras = place(s, 'player', 0, 0, 'lapras');
  place(s, 'ai', 0, 0, 'dusclops');
  at(s, 'ai', 0, 0).currentStrength = 2;
  onlyAlert(s, lapras);
  s = attack(s, lapras, { zone: 0, space: 0 });
  assert.equal(at(s, 'ai', 0, 0), null);
  assert.equal(burnOf(at(s, 'player', 0, 0)), 0, 'no Burn from a defeated Dusclops');
}

// --- Fire: Absol — +2 damage with its attack against a burned target ----------------------------------------

{
  let s = match();
  const absol = place(s, 'player', 0, 0, 'absol');
  place(s, 'ai', 0, 0, 'lapras');
  place(s, 'ai', 0, 1, 'lapras', { status: { burn: { count: 1, by: 'player' } } });
  assert.equal(attackPower(s, at(s, 'player', 0, 0), at(s, 'ai', 0, 0)), 5, 'not burned: its Attack');
  assert.equal(attackPower(s, at(s, 'player', 0, 0), at(s, 'ai', 0, 1)), 7, 'burned: +2');
  assert.equal(attackOf(at(s, 'player', 0, 0)), 5, 'its Attack stays 5');
  onlyAlert(s, absol);
  s = attack(s, absol, { zone: 0, space: 1 });
  assert.equal(s.events.find((e) => e.type === 'attack').amount, 7);
  // Hitting back in a trade it deals its plain Attack (only its own attack gets the bonus, like Sunflora).
  s = match({ player: 'water', ai: 'fire' });
  const shinx = place(s, 'player', 0, 0, 'shinx', { status: { burn: { count: 1, by: 'ai' } } });
  place(s, 'ai', 0, 0, 'absol');
  onlyAlert(s, shinx, { owner: 'ai', zone: 0, space: 0 });   // both Swift and Active: Absol hits back
  s = attack(s, shinx, { zone: 0, space: 0 });
  assert.ok(logged(s, 'hit back for 5'), 'its plain 5 when hitting back');
}

// --- Fire: Hyper Voice — 2 damage to each enemy Pokémon (Shell applies) ----------------------------------------

{
  let s = match();
  place(s, 'ai', 0, 0, 'horsea');
  place(s, 'ai', 1, 0, 'wartortle');   // Shell 1
  place(s, 'ai', 2, 2, 'lapras');
  place(s, 'player', 0, 0, 'growlithe');
  s = strategy(s, 'hyper-voice');
  assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, at(s, 'ai', 1, 0).currentStrength, at(s, 'ai', 2, 2).currentStrength], [4 - 2, 5 - 1, 7 - 2]);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5, 'friendly Pokémon untouched');
  assert.ok(trainerAt(s, 'ai', 0).strength === trainerAt(s, 'ai', 0).maxStrength, 'Trainers untouched');
}

// --- Fire: Black Belt — holder gains +1 Attack and Overrun ----------------------------------------------------

{
  let s = match();
  const mankey = place(s, 'player', 0, 0, 'growlithe', { heldItem: structuredClone(def('black-belt')) });
  assert.equal(attackOf(at(s, 'player', 0, 0)), 3, '+1 Attack');
  assert.ok(hasKeyword(at(s, 'player', 0, 0), 'Overrun'));
  place(s, 'ai', 0, 0, 'horsea');
  at(s, 'ai', 0, 0).currentStrength = 1;
  onlyAlert(s, mankey);
  const before = trainerAt(s, 'ai', 0).strength;
  s = attack(s, mankey, { zone: 0, space: 0 });
  assert.equal(trainerAt(s, 'ai', 0).strength, before - 2, 'Overrun: 3 − 1 = 2 through to the Trainer');
}

// --- Water: Dragonite (Infiltrator, Shell 1) and Shinx (Quick Attack) ----------------------------------------

{
  const dragonite = cardDefinition('dragonite');
  assert.ok(hasKeyword(dragonite, 'Infiltrator') && keywordAmount(dragonite, 'Shell') === 1);
  let s = match({ player: 'water', ai: 'fire' });
  s = act(s, 'player', { type: 'playPokemon', uid: give(s, 'player', 'shinx'), zone: 0, space: 0 });
  assert.equal(at(s, 'player', 0, 0).spent, false, 'Shinx arrives Active (Quick Attack)');
}

// --- Water: Thunderbolt — 4 damage to an enemy Pokémon or Trainer --------------------------------------------

{
  let s = match({ player: 'water', ai: 'fire' });
  place(s, 'ai', 0, 0, 'magmar');
  s = strategy(s, 'thunderbolt', { kind: 'pokemon', owner: 'ai', zone: 0, space: 0 });
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 7 - 4);
  const before = trainerAt(s, 'ai', 1).strength;
  s = strategy(s, 'thunderbolt', tref('ai', 1));
  assert.equal(trainerAt(s, 'ai', 1).strength, before - 4, 'or a Trainer');
}

// --- Water: Rocky Helmet — Retaliate 2: when the holder takes damage from an attack, 2 to the attacker -----------

{
  assert.ok(INNATE_POWERS.Retaliate, 'Retaliate has rule text');
  let s = match();
  const growlithe = place(s, 'player', 0, 0, 'growlithe');
  place(s, 'ai', 0, 0, 'quagsire', { heldItem: structuredClone(def('rocky-helmet')) });
  assert.equal(keywordAmount(at(s, 'ai', 0, 0), 'Retaliate'), 2);
  onlyAlert(s, growlithe);
  s = attack(s, growlithe, { zone: 0, space: 0 });
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5 - 2, 'the attacker takes 2');
  assert.ok(s.events.some((e) => e.type === 'retaliate'));
  // Even if the holder is defeated by the attack.
  s = match();
  const arcanine = place(s, 'player', 0, 0, 'arcanine');
  place(s, 'ai', 0, 0, 'horsea', { heldItem: structuredClone(def('rocky-helmet')) });
  onlyAlert(s, arcanine);
  s = attack(s, arcanine, { zone: 0, space: 0 });
  assert.equal(at(s, 'ai', 0, 0), null, 'Horsea defeated');
  assert.equal(at(s, 'player', 0, 0).currentStrength, 6 - 2, 'still 2 back');
  // Not when the holder is the attacker and takes damage hitting back in a trade (only as the attack's target).
  s = match({ player: 'water', ai: 'fire' });
  const holder = place(s, 'player', 0, 0, 'shinx', { heldItem: structuredClone(def('rocky-helmet')) });
  place(s, 'ai', 0, 0, 'growlithe');
  onlyAlert(s, holder, { owner: 'ai', zone: 0, space: 0 });
  s = attack(s, holder, { zone: 0, space: 0 });
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 5 - 3, 'Growlithe only takes Shinx\'s attack');
  assert.ok(!s.events.some((e) => e.type === 'retaliate'));
}

// --- Water: Tracey — look at the top 4: 2 into your hand, the rest to the bottom; Gift (a Pokémon card): 3 ---------

{
  let s = match({ player: 'water', ai: 'fire' });
  const uid = give(s, 'player', 'tracey');
  const pay = give(s, 'player', 'dive');   // a Strategy card: no Gift
  const pile = s.players.player.drawPile;
  const top = pile.slice(0, 4).map((c) => c.uid);
  const below = pile.slice(4).map((c) => c.uid);
  s = act(s, 'player', { type: 'playSupporter', uid, discard: [pay], release: [] });
  assert.deepEqual([s.pending.kind, s.pending.from, s.pending.options, s.pending.min, s.pending.max], ['pick', 'draw', top, 2, 2]);
  // The seat choosing sees the 4 cards; the opponent sees only that a choice is being made.
  assert.equal(viewFor(s, 'player').pending.cards.length, 4);
  assert.equal(viewFor(s, 'ai').pending.options, undefined);
  assert.throws(() => choose(s, { uids: [top[0]] }), /Choose 2 cards/);
  s = choose(s, { uids: [top[1], top[3]] });
  const hand = s.players.player.hand.map((c) => c.uid);
  assert.ok(hand.includes(top[1]) && hand.includes(top[3]));
  assert.deepEqual(s.players.player.drawPile.map((c) => c.uid), [...below, top[0], top[2]], 'the rest to the bottom, in order');
  // What the opponent learns: 2 cards taken, not which.
  const event = viewFor(s, 'ai').events.find((e) => e.type === 'lookedTop');
  assert.deepEqual([event.looked, event.cards.map((c) => c.name), event.bottom], [4, [undefined, undefined], 2]);
  // Gift: a Pokémon card paid → 3 into your hand.
  s = nextRound(s);
  s.players.player.hand = [];
  s = supporter(s, 'tracey', ['horsea']);
  assert.equal(s.pending.max, 3, 'Gift: 3');
  // Fewer than 4 cards in the Draw Pile: look at those (it isn't refilled).
  s = match({ player: 'water', ai: 'fire' });
  s.players.player.drawPile = s.players.player.drawPile.slice(0, 2);
  s = supporter(s, 'tracey', ['dive']);
  assert.deepEqual([s.pending.options.length, s.pending.max], [2, 2]);
}

// --- Grass: Metapod (Shell 1, a Defence guard) and Geodude (On Defend: 1 damage to the attacker) ------------------

{
  assert.equal(keywordAmount(cardDefinition('metapod'), 'Shell'), 1);
  assert.equal(cardDefinition('metapod').strengthType, 'Defence');
  let s = match({ player: 'fire', ai: 'grass' });
  const growlithe = place(s, 'player', 0, 0, 'growlithe');
  place(s, 'ai', 1, 0, 'metapod');
  place(s, 'ai', 0, 0, 'oddish');
  onlyAlert(s, growlithe);
  const targets = legalActions(s, 'player').includes('command');
  assert.ok(targets);
  // A Physical attacker must target the Defence guard.
  assert.throws(() => attack(s, growlithe, { zone: 0, space: 0 }), /legal target/);
  s = attack(s, growlithe, { zone: 1, space: 0 });
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 6 - 1, 'Shell 1: 2 → 1');
  // Geodude
  s = match({ player: 'fire', ai: 'grass' });
  const ponyta = place(s, 'player', 0, 0, 'ponyta');
  place(s, 'ai', 0, 0, 'geodude');
  onlyAlert(s, ponyta);
  s = attack(s, ponyta, { zone: 0, space: 0 });
  assert.equal(at(s, 'ai', 0, 0).currentStrength, 6 - 3);
  assert.equal(at(s, 'player', 0, 0).currentStrength, 5 - 1, 'Geodude deals 1 back');
}

// --- Grass: Rock Slide — 2 damage to each enemy Pokémon in a chosen Zone -----------------------------------------

{
  let s = match({ player: 'grass', ai: 'fire' });
  place(s, 'ai', 1, 0, 'growlithe');
  place(s, 'ai', 1, 2, 'magmar');
  place(s, 'ai', 2, 0, 'ponyta');
  s = strategy(s, 'rock-slide', { kind: 'zone', owner: 'ai', zone: 1 });
  assert.deepEqual([at(s, 'ai', 1, 0).currentStrength, at(s, 'ai', 1, 2).currentStrength, at(s, 'ai', 2, 0).currentStrength], [5 - 2, 7 - 2, 5]);
}

// --- Grass: Brock — friendly Pokémon in a chosen Zone: +2 Strength and Shell 1 until your next Breakfast ---------
//     Gift (a Rock Pokémon): every Zone.

{
  let s = match({ player: 'grass', ai: 'fire' });
  place(s, 'player', 0, 0, 'bulbasaur');
  place(s, 'player', 0, 1, 'oddish');
  place(s, 'player', 1, 0, 'sunkern');
  s = supporter(s, 'brock', ['oddish'], { kind: 'zone', owner: 'player', zone: 0 });   // released: not a Rock Pokémon
  const b = () => at(s, 'player', 0, 0);
  assert.deepEqual([maxStrengthOf(b()), b().currentStrength, keywordAmount(b(), 'Shell')], [6 + 2, 6 + 2, 1]);
  assert.deepEqual([maxStrengthOf(at(s, 'player', 0, 1)), keywordAmount(at(s, 'player', 0, 1), 'Shell')], [5 + 2, 1]);
  assert.deepEqual([maxStrengthOf(at(s, 'player', 1, 0)), keywordAmount(at(s, 'player', 1, 0), 'Shell')], [7, 0], 'another Zone: no');
  // It outlasts Supper ("this Round" effects end there)…
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  // (At the start of the next Breakfast it's gone; by the Battle Phase it has ended.)
  for (const who of PLAYERS) if (s.xpStep && legalActions(s, who).includes('spendXp')) s = applyAction(s, { type: 'spendXp', who, spend: [] });
  for (const who of PLAYERS) if (s.evolveStep && legalActions(s, who).includes('breakfastEvolve')) s = applyAction(s, { type: 'breakfastEvolve', who, evolves: [] });
  assert.ok(logged(s, '"Until your next Breakfast" effects end: Bulbasaur, Oddish'));
  assert.ok(!logged(s, '"This Round" effects end: Bulbasaur'), 'Supper did not end it');
  assert.deepEqual([maxStrengthOf(b()), keywordAmount(b(), 'Shell')], [6, 0], 'ended at Breakfast');
  // Damage taken while it lasted carries over, but losing it never defeats.
  s = match({ player: 'grass', ai: 'fire' });
  place(s, 'player', 0, 0, 'bulbasaur');
  s = supporter(s, 'brock', ['oddish'], { kind: 'zone', owner: 'player', zone: 0 });
  b().currentStrength = 1;
  s = nextRound(s);
  assert.equal(b().currentStrength, 1, 'still 1, not defeated');
  // Gift: a Rock Pokémon paid → every Zone.
  s = match({ player: 'grass', ai: 'fire' });
  place(s, 'player', 0, 0, 'bulbasaur');
  place(s, 'player', 2, 1, 'sunkern');
  s = supporter(s, 'brock', ['geodude']);
  assert.deepEqual([maxStrengthOf(at(s, 'player', 0, 0)), maxStrengthOf(at(s, 'player', 2, 1))], [8, 9], 'Gift: every Zone');
  assert.ok(keywordAmount(at(s, 'player', 2, 1), 'Shell') === 1);
}

// --- The AI uses them sensibly ------------------------------------------------------------------------------------

{
  // Absol attacks the burned one of two otherwise equal targets (its +2 shows when it tries each).
  let s = match();
  const absol = place(s, 'player', 0, 0, 'absol');
  place(s, 'ai', 0, 0, 'lapras');
  place(s, 'ai', 0, 1, 'lapras', { status: { burn: { count: 1, by: 'player' } } });
  onlyAlert(s, absol);
  s.players.player.hand = [];
  for (const t of s.players.player.trainers ?? []) t.power = { ...t.power, cost: 99 };
  const move = chooseAction(s, 'player');
  assert.deepEqual([move.type, move.target?.space], ['command', 1], 'the burned Lapras');
}
{
  // Tracey: the AI picks 2 of the top 4 as it resolves.
  let s = match({ player: 'water', ai: 'fire' });
  s = supporter(s, 'tracey', ['dive']);
  const pick = chooseAction(s, 'player');
  assert.deepEqual([pick.type, pick.uids.length], ['resolveChoice', 2]);
  s = applyAction(s, pick);
  assert.equal(s.pending, null);
}

console.log('All neutral card tests passed.');
