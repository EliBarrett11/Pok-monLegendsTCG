// Checks Supporter Cards: the Card-Cost, the Gift Bonus Challenge, each Fire
// and Water Supporter (with and without its Gift), and the AI's payments.
// Run with: node tests/supporters.test.js
import assert from 'node:assert/strict';
import { applyAction, legalActions, playableSupporters, supporterTargets, giftMet } from '../src/engine/game.js';
import { SUPPORTER_CARDS } from '../src/engine/cardData.js';
import { matchesCard } from '../src/engine/effects.js';
import { cardDefinition } from '../src/engine/cards.js';
import { statusCount } from '../src/engine/status.js';
import { hasKeyword } from '../src/engine/keywords.js';
import { chooseAction } from '../src/ai/opponent.js';
import { battle, give, act, place, nextRound, choose, at, trainerAt, tref, zref, stats, logged } from './fixtures.js';

// Trainer Passives and Powers off, so the numbers are the Supporters' own.
const fire = () => battle({ passives: false, powers: false });
const water = () => battle({ player: 'water', ai: 'fire', passives: false, powers: false });
const support = (s, who, uid, { discard = [], release = [], target } = {}) => act(s, who, { type: 'playSupporter', uid, discard, release, target });
const uids = (cards) => cards.map((c) => c.uid);
const burn = (c) => statusCount(c, 'burn');
const playable = (s, who, uid) => playableSupporters(s, who).some((c) => c.uid === uid);

// --- Card data ----------------------------------------------------------------

for (const c of SUPPORTER_CARDS) {
  assert.equal(c.cardType, 'Supporter');
  for (const field of ['name', 'effectText', 'rarity']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
  assert.ok(Number.isInteger(c.cardCost.discard) && Number.isInteger(c.cardCost.release));
  assert.ok(c.gift.challengeText && c.gift.bonusText && c.gift.challenge && c.gift.effects);
}

// The challenge is a general card-matching condition over printed fields.
{
  const ponyta = cardDefinition('ponyta');
  assert.ok(matchesCard(ponyta, { cardType: 'Pokémon', speedTier: 'Swift' }));
  assert.ok(matchesCard(ponyta, { pokemonType: ['Water', 'Fire'] }), 'any of a list');
  assert.ok(matchesCard(ponyta, { energyCost: { max: 2 } }), 'a range');
  assert.ok(!matchesCard(ponyta, { energyCost: { min: 3 } }));
  assert.ok(matchesCard(ponyta, { rarity: 'Common', innatePower: 'Quick Attack, Infiltrator' }));
  assert.ok(!matchesCard(cardDefinition('ember'), { cardType: 'Pokémon' }));
  assert.ok(!matchesCard(cardDefinition('ember'), { speedTier: 'Swift' }), 'a field the card lacks never matches');
}

// --- Paying ---------------------------------------------------------------------

// Exact payment only; not with itself; only cards in hand; no card twice.
{
  const s = fire();
  const thief = give(s, 'player', 'burglar');                // Discard 2
  const [a, b, c] = ['ember', 'flame-charge', 'heat-wave'].map((id) => give(s, 'player', id));
  assert.throws(() => support(s, 'player', thief, { discard: [a] }), /exactly/);
  assert.throws(() => support(s, 'player', thief, { discard: [a, b], release: [c] }), /exactly/);
  assert.throws(() => support(s, 'player', thief, { release: [a, b] }), /exactly/);
  assert.throws(() => support(s, 'player', thief, { discard: [thief, a] }), /other than the Supporter/);
  assert.throws(() => support(s, 'player', thief, { discard: [a, a] }), /different cards/);
  assert.throws(() => support(s, 'player', thief, { discard: ['nope', a] }), /from your hand/);
  const t = support(s, 'player', thief, { discard: [a, b] });
  assert.equal(t.turn, 'ai', 'exact payment works, and uses the turn');
}

// Discarded cards go to the Discard Pile, Released ones to the Released Pile
// (never reshuffled); the Supporter itself ends in the Discard Pile.
{
  let s = fire();
  place(s, 'player', 0, 0, 'growlithe');
  const chili = give(s, 'player', 'chili');                 // Release 1
  const a = give(s, 'player', 'ember');
  s = support(s, 'player', chili, { release: [a], target: zref('player', 0) });
  const p = s.players.player;
  assert.deepEqual(uids(p.discard), [chili]);
  assert.deepEqual(uids(p.released), [a]);
  assert.equal(p.hand.length, 0);
  assert.ok(logged(s, 'played Chili (Your Pokémon in a chosen Zone gain +2 Attack and Overrun this Round.), releasing Ember. Gift Challenge (a Swift Pokémon) not met.'));

  // Later reshuffles never bring the Released card back.
  p.discard.push(...p.drawPile.splice(0));
  s = nextRound(s);
  assert.ok(logged(s, 'You shuffled your Discard Pile'));
  assert.deepEqual(uids(s.players.player.released), [a]);
  assert.ok(![...s.players.player.hand, ...s.players.player.drawPile].some((c) => c.uid === a));
}

// Unplayable without enough other cards to pay; one Supporter per Round.
{
  let s = fire();
  const thief = give(s, 'player', 'burglar');
  give(s, 'player', 'ember');
  assert.ok(!playable(s, 'player', thief), 'Burglar needs 2 other cards');
  assert.ok(!legalActions(s, 'player').includes('playSupporter'));
  const second = give(s, 'player', 'firebreather');
  assert.ok(playable(s, 'player', thief));
  s = support(s, 'player', second, { discard: [s.players.player.hand.find((c) => c.id === 'ember').uid] });
  s.turn = 'player';
  give(s, 'player', 'ember');
  give(s, 'player', 'ember');
  assert.ok(!playable(s, 'player', thief), 'already played one this Round');
  s = nextRound(s);
  s.turn = 'player';
  give(s, 'player', 'burglar');
  give(s, 'player', 'ember');
  give(s, 'player', 'ember');
  assert.ok(playableSupporters(s, 'player').length, 'a new Round');
}

// The Gift Challenge is met by a discarded card or a released one.
{
  const breather = cardDefinition('firebreather');
  assert.ok(giftMet(breather, [cardDefinition('ember'), cardDefinition('growlithe')]));
  assert.ok(giftMet(breather, [cardDefinition('growlithe')]));
  assert.ok(!giftMet(breather, [cardDefinition('mankey')]), 'Fighting is not Fire');
}

// --- Fire -----------------------------------------------------------------------

// Firebreather: Burn 1 to each enemy Trainer; Gift (a Fire Pokémon): Burn 2 instead.
{
  let s = fire();
  s = support(s, 'player', give(s, 'player', 'firebreather'), { discard: [give(s, 'player', 'ember')] });
  assert.deepEqual(s.players.ai.zones.map((z) => burn(z.trainer)), [1, 1, 1]);
  let t = fire();
  t = support(t, 'player', give(t, 'player', 'firebreather'), { discard: [give(t, 'player', 'growlithe')] });
  assert.deepEqual(t.players.ai.zones.map((z) => burn(z.trainer)), [2, 2, 2]);
  assert.ok(logged(t, 'Gift Challenge (a Fire Pokémon) met: Burn 2 to each enemy Trainer instead.'));
}

// Chili: Pokémon in a chosen Zone gain +2 Attack and Overrun this Round;
// Gift (a Swift Pokémon): they also become Active.
{
  let s = fire();
  place(s, 'player', 1, 0, 'magmar', { spent: true });
  place(s, 'player', 1, 1, 'growlithe');
  place(s, 'player', 2, 0, 'charmander', { spent: true });
  place(s, 'ai', 1, 0, 'quagsire');
  const chili = give(s, 'player', 'chili');
  give(s, 'player', 'ember');
  assert.deepEqual(supporterTargets(s, 'player', chili), [zref('player', 1), zref('player', 2)], 'Zones with a friendly Pokémon');
  s = support(s, 'player', chili, { release: [s.players.player.hand.find((c) => c.id === 'ember').uid], target: zref('player', 1) });
  assert.deepEqual([stats(at(s, 'player', 1, 0))[0], stats(at(s, 'player', 1, 1))[0], stats(at(s, 'player', 2, 0))[0]], [6, 4, 3]);
  assert.ok(hasKeyword(at(s, 'player', 1, 0), 'Overrun') && hasKeyword(at(s, 'player', 1, 1), 'Overrun'));
  assert.ok(!hasKeyword(at(s, 'player', 2, 0), 'Overrun'), 'other Zone untouched');
  assert.ok(!hasKeyword(at(s, 'ai', 1, 0), 'Overrun'), 'friendly only');
  assert.equal(at(s, 'player', 1, 0).spent, true, 'no Gift: still Spent');
  s = nextRound(s);
  assert.equal(stats(at(s, 'player', 1, 0))[0], 4, 'this Round only');
  assert.ok(!hasKeyword(at(s, 'player', 1, 0), 'Overrun'));

  let t = fire();
  place(t, 'player', 0, 0, 'magmar', { spent: true });
  place(t, 'player', 0, 1, 'growlithe', { spent: true });
  const c2 = give(t, 'player', 'chili');
  t = support(t, 'player', c2, { release: [give(t, 'player', 'ponyta')], target: zref('player', 0) });
  assert.deepEqual([at(t, 'player', 0, 0).spent, at(t, 'player', 0, 1).spent], [false, false], 'Gift: they become Active');
  assert.ok(logged(t, 'Gift Challenge (a Swift Pokémon) met'));
}

// Burglar: gain 3 PokéDollars; Gift (an Item card): 5 instead.
{
  let s = fire();
  s = support(s, 'player', give(s, 'player', 'burglar'), { discard: [give(s, 'player', 'ember'), give(s, 'player', 'growlithe')] });
  assert.equal(s.players.player.dollars, 3);
  let t = fire();
  t = support(t, 'player', give(t, 'player', 'burglar'), { discard: [give(t, 'player', 'ember'), give(t, 'player', 'charcoal')] });
  assert.equal(t.players.player.dollars, 5);
}

// --- Water ----------------------------------------------------------------------

// Nurse Joy: heal a friendly Trainer 3 and Douse it; Gift (a Normal Pokémon): heal 5.
{
  let s = water();
  trainerAt(s, 'player', 1).strength = 10;
  trainerAt(s, 'player', 1).status = { burn: { count: 2, by: 'ai' } };
  const joy = give(s, 'player', 'nurse-joy');
  give(s, 'player', 'dive');
  assert.deepEqual(supporterTargets(s, 'player', joy), [tref('player', 0), tref('player', 1), tref('player', 2)], 'any friendly Trainer');
  s = support(s, 'player', joy, { discard: [s.players.player.hand.find((c) => c.id === 'dive').uid], target: tref('player', 1) });
  assert.deepEqual([trainerAt(s, 'player', 1).strength, burn(trainerAt(s, 'player', 1))], [13, 0]);

  let t = water();
  trainerAt(t, 'player', 0).strength = 5;
  t = support(t, 'player', give(t, 'player', 'nurse-joy'), { discard: [give(t, 'player', 'chansey')], target: tref('player', 0) });
  assert.equal(trainerAt(t, 'player', 0).strength, 10);
  trainerAt(t, 'player', 2).strength = 14;
  t = nextRound(t);
  t = support(t, 'player', give(t, 'player', 'nurse-joy'), { discard: [give(t, 'player', 'chansey')], target: tref('player', 2) });
  assert.equal(trainerAt(t, 'player', 2).strength, 15, 'capped at its starting Strength');
}

// Swimmer: free summon a Pokémon costing 2 or less from hand (arrives Spent);
// Gift (a Water Pokémon): it arrives Active.
{
  let s = water();
  s.players.player.baseEnergy = 0;
  const cheap = give(s, 'player', 'goldeen');
  give(s, 'player', 'lapras');
  const swim = give(s, 'player', 'swimmer');
  s.turn = 'player';
  s = applyAction(s, { type: 'playSupporter', who: 'player', uid: swim, discard: [give(s, 'player', 'dive'), give(s, 'player', 'surf')], release: [] });
  assert.deepEqual(s.pending.options, [cheap], 'only Pokémon costing 2 or less');
  s = choose(s, { uids: [cheap] });
  s = choose(s, { zone: 0, space: 0 });
  assert.equal(at(s, 'player', 0, 0).id, 'goldeen');
  assert.equal(at(s, 'player', 0, 0).spent, true);
  assert.equal(s.players.player.baseEnergy, 0, 'without paying its cost');

  let t = water();
  const c2 = give(t, 'player', 'chinchou');
  t = support(t, 'player', give(t, 'player', 'swimmer'), { discard: [give(t, 'player', 'horsea'), give(t, 'player', 'dive')] });
  t = choose(t, { uids: [c2] });
  t = choose(t, { zone: 1, space: 0 });
  assert.equal(at(t, 'player', 1, 0).spent, false, 'Gift: arrives Active');
}

// Fisherman: Search the Draw Pile for a Water Pokémon, which gains Retain;
// Gift (a Strategy card): two instead.
{
  let s = water();
  s = support(s, 'player', give(s, 'player', 'fisherman'), { release: [give(s, 'player', 'nurse-joy')] });
  const water1 = s.pending.options;
  assert.ok(water1.length && water1.every((u) => s.players.player.drawPile.find((c) => c.uid === u).pokemonType === 'Water'), 'Water Pokémon only');
  assert.deepEqual([s.pending.min, s.pending.max], [1, 1]);
  s = choose(s, { uids: [water1[0]] });
  assert.ok(s.players.player.hand.find((c) => c.uid === water1[0]).retainGranted);

  let t = water();
  t = support(t, 'player', give(t, 'player', 'fisherman'), { release: [give(t, 'player', 'dive')] });
  assert.deepEqual([t.pending.min, t.pending.max], [2, 2]);
  t = choose(t, { uids: t.pending.options.slice(0, 2) });
  assert.equal(t.players.player.hand.filter((c) => c.retainGranted).length, 2);
}

// --- AI -----------------------------------------------------------------------

// Fire: pays Firebreather with a Fire Pokémon to meet its Gift.
{
  const s = battle({ player: 'water', ai: 'fire', passives: false, powers: false });
  s.turn = 'ai';
  s.players.ai.baseEnergy = 0;                               // nothing else affordable
  const fb = give(s, 'ai', 'firebreather');
  ['charcoal', 'growlithe'].forEach((id) => give(s, 'ai', id));
  const move = chooseAction(s, 'ai');
  assert.equal(move.type, 'playSupporter');
  assert.equal(move.uid, fb);
  assert.equal(s.players.ai.hand.find((c) => c.uid === move.discard[0]).id, 'growlithe', 'the Fire Pokémon meets the Gift');
}

// Water: Nurse Joy on its damaged Trainer.
{
  const s = battle({ player: 'fire', ai: 'water', passives: false, powers: false });
  s.turn = 'ai';
  s.players.ai.baseEnergy = 0;
  trainerAt(s, 'ai', 2).strength = 4;
  const joy = give(s, 'ai', 'nurse-joy');
  ['mystic-water', 'chansey'].forEach((id) => give(s, 'ai', id));
  const move = chooseAction(s, 'ai');
  assert.equal(move.uid, joy);
  assert.deepEqual(move.target, tref('ai', 2));
}

console.log('All Supporter tests passed.');
