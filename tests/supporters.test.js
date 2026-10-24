// Checks Supporter Cards: the Card-Cost, the Gift Bonus Challenge, the three
// placeholder Supporters, and the AI's payments.
// Run with: node tests/supporters.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, playableSupporters, supporterTargets, giftMet,
  attackOf, maxStrengthOf, PLAYERS,
} from '../src/engine/game.js';
import { SUPPORTER_CARDS, PLACEHOLDER_DECKLIST } from '../src/engine/cardData.js';
import { matchesCard } from '../src/engine/effects.js';
import { cardDefinition } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Ash / Misty / Brock in zones 1–3 on both sides, empty
// hands, the player to act. Passives and abilities off, so numbers are the
// Supporters' own.
function match() {
  let s = createGame(21);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.trainers.forEach((t) => { t.passive = { text: '' }; t.power = { ...t.power, cost: 99 }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.turn = 'player';
  return s;
}

// Moves a card from the piles into the hand; returns its uid.
function give(s, who, id) {
  const p = s.players[who];
  for (const pile of [p.drawPile, p.discard]) {
    const i = pile.findIndex((c) => c.id === id);
    if (i >= 0) {
      const [card] = pile.splice(i, 1);
      p.hand.push(card);
      return card.uid;
    }
  }
  throw new Error(`no ${id} left for ${who}`);
}

function play(s, who, id, zone, space) {
  s.turn = who;
  s.passesInARow = 0;
  s.players[who].baseEnergy = 10;
  return applyAction(s, { type: 'playPokemon', who, uid: give(s, who, id), zone, space });
}

function support(s, who, uid, { discard = [], release = [], target } = {}) {
  s.turn = who;
  s.passesInARow = 0;
  return applyAction(s, { type: 'playSupporter', who, uid, discard, release, target });
}

const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const trainer = (s, who, zone) => s.players[who].zones[zone].trainer;
const uids = (cards) => cards.map((c) => c.uid);
const stats = (c) => [attackOf(c), c.currentStrength, maxStrengthOf(c)];
const zoneRef = (zone) => ({ kind: 'zone', owner: 'player', zone });
const tref = (owner, zone) => ({ kind: 'trainer', owner, zone });

// --- Card data ----------------------------------------------------------------

for (const c of SUPPORTER_CARDS) {
  assert.equal(c.cardType, 'Supporter');
  for (const field of ['name', 'effectText', 'rarity']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
  assert.ok(Number.isInteger(c.cardCost.discard) && Number.isInteger(c.cardCost.release));
  assert.ok(c.gift.challengeText && c.gift.bonusText && c.gift.challenge && c.gift.effects);
}
assert.deepEqual(SUPPORTER_CARDS.map((c) => [c.name, c.cardCost.discard, c.cardCost.release]),
  [['Field Researcher', 1, 0], ['Veteran Coach', 0, 1], ['Field Medic', 1, 1]]);
assert.equal(PLACEHOLDER_DECKLIST['field-researcher'], 2);
assert.equal(PLACEHOLDER_DECKLIST['veteran-coach'], 1);
assert.equal(PLACEHOLDER_DECKLIST['field-medic'], 1);
{
  const deck = createGame(1).players.player.drawPile;
  assert.equal(deck.length, 40);
  assert.deepEqual(deck.filter((c) => c.cardType === 'Supporter').map((c) => c.id).sort(),
    ['field-medic', 'field-researcher', 'field-researcher', 'veteran-coach']);
}

// The challenge is a general card-matching condition over printed fields.
{
  const zappip = cardDefinition('zappip');
  assert.ok(matchesCard(zappip, { cardType: 'Pokémon', speedTier: 'Swift' }));
  assert.ok(matchesCard(zappip, { pokemonType: ['Water', 'Electric'] }), 'any of a list');
  assert.ok(matchesCard(zappip, { energyCost: { max: 1 } }), 'a range');
  assert.ok(!matchesCard(zappip, { energyCost: { min: 2 } }));
  assert.ok(matchesCard(zappip, { rarity: 'Common', innatePower: 'Quick Attack' }));
  assert.ok(!matchesCard(cardDefinition('quickdraw'), { cardType: 'Pokémon' }));
  assert.ok(!matchesCard(cardDefinition('quickdraw'), { speedTier: 'Swift' }), 'a field the card lacks never matches');
}

// --- Paying ---------------------------------------------------------------------

// Exact payment only; not with itself; only cards in hand; no card twice.
{
  const s = match();
  const medic = give(s, 'player', 'field-medic');
  const [a, b, c] = ['power-band', 'potion', 'energy-drink'].map((id) => give(s, 'player', id));
  trainer(s, 'player', 0).strength = 10;
  const target = tref('player', 0);
  assert.throws(() => support(s, 'player', medic, { discard: [a], target }), /exactly/);
  assert.throws(() => support(s, 'player', medic, { discard: [a, b], release: [c], target }), /exactly/);
  assert.throws(() => support(s, 'player', medic, { discard: [], release: [a, b], target }), /exactly/);
  assert.throws(() => support(s, 'player', medic, { discard: [medic], release: [a], target }), /other than the Supporter/);
  assert.throws(() => support(s, 'player', medic, { discard: [a], release: [a], target }), /different cards/);
  assert.throws(() => support(s, 'player', medic, { discard: ['nope'], release: [a], target }), /from your hand/);
  const t = support(s, 'player', medic, { discard: [a], release: [b], target });
  assert.equal(t.turn, 'ai', 'exact payment works, and uses the turn');
}

// Discarded cards go to the Discard Pile, Released ones to the Released Pile
// (never reshuffled); the Supporter itself ends in the Discard Pile.
{
  let s = match();
  const medic = give(s, 'player', 'field-medic');
  const a = give(s, 'player', 'power-band');
  const b = give(s, 'player', 'potion');
  trainer(s, 'player', 0).strength = 10;
  s = support(s, 'player', medic, { discard: [a], release: [b], target: tref('player', 0) });
  const p = s.players.player;
  assert.deepEqual(uids(p.discard), [a, medic], 'paid card first, the Supporter after its effect');
  assert.deepEqual(uids(p.released), [b]);
  assert.equal(p.hand.length, 0);
  assert.ok(s.log.some((l) => l.includes('played Field Medic (Heal a friendly Trainer 4 Strength.), discarding Power Band and releasing Potion. Gift Challenge (a Water Pokémon) not met.')));

  // Later reshuffles never bring the Released card back.
  p.discard.push(...p.drawPile.splice(0));
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  assert.ok(s.log.some((l) => l.startsWith('You shuffled your Discard Pile')));
  assert.deepEqual(uids(s.players.player.released), [b]);
  assert.ok(![...s.players.player.hand, ...s.players.player.drawPile].some((c) => c.uid === b));
}

// Unplayable without enough other cards to pay.
{
  const s = match();
  const medic = give(s, 'player', 'field-medic');
  trainer(s, 'player', 0).strength = 10;
  give(s, 'player', 'power-band');
  assert.ok(!playableSupporters(s, 'player').some((c) => c.uid === medic), 'Medic needs 2 other cards');
  give(s, 'player', 'potion');
  assert.ok(playableSupporters(s, 'player').some((c) => c.uid === medic));

  const t = match();
  const researcher = give(t, 'player', 'field-researcher');
  assert.ok(!playableSupporters(t, 'player').some((c) => c.uid === researcher), 'it cannot pay for itself');
  assert.ok(!legalActions(t, 'player').includes('playSupporter'));
}

// One Supporter per Round.
{
  let s = match();
  const first = give(s, 'player', 'field-researcher');
  const second = give(s, 'player', 'field-researcher');
  const item = give(s, 'player', 'power-band');
  give(s, 'player', 'potion');
  s = support(s, 'player', first, { discard: [item] });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  assert.ok(!playableSupporters(s, 'player').some((c) => c.uid === second), 'already played one this Round');
  s = applyAction(s, { type: 'pass', who: 'player' });   // two passes in a row: next Round
  assert.equal(s.round, 2);
  s.turn = 'player';
  give(s, 'player', 'field-researcher');
  give(s, 'player', 'energy-drink');
  assert.ok(playableSupporters(s, 'player').length, 'a new Round');
}

// --- Gift Bonus Challenge ---------------------------------------------------------

// Met by a discarded card, or by a released one; not met otherwise.
{
  const medic = cardDefinition('field-medic');
  const water = cardDefinition('puddlop');
  const item = cardDefinition('power-band');
  assert.ok(giftMet(medic, [water, item]));
  assert.ok(giftMet(medic, [item, water]));
  assert.ok(!giftMet(medic, [item, cardDefinition('emberkit')]));
}

// --- Field Researcher ---------------------------------------------------------

{
  let s = match();
  const r = give(s, 'player', 'field-researcher');
  const item = give(s, 'player', 'power-band');
  s = support(s, 'player', r, { discard: [item] });
  assert.equal(s.players.player.hand.length, 2, 'draw 2');
  assert.ok(s.log.some((l) => l.includes('Gift Challenge (a Strategy Card) not met.')));

  let t = match();
  const r2 = give(t, 'player', 'field-researcher');
  const quick = give(t, 'player', 'quickdraw');
  t = support(t, 'player', r2, { discard: [quick] });
  assert.equal(t.players.player.hand.length, 3, 'Gift: draw 1 more');
  assert.ok(t.log.some((l) => l.includes('Gift Challenge (a Strategy Card) met: Draw 1 more card.')));
  assert.ok(t.log.some((l) => l.startsWith('Your Field Researcher: You drew 3 cards')));
}

// Pay first: with nothing else to draw, the discarded card is reshuffled and drawn back.
{
  let s = match();
  const r = give(s, 'player', 'field-researcher');
  const item = give(s, 'player', 'power-band');
  s.players.player.drawPile = [];
  s.players.player.discard = [];
  assert.ok(playableSupporters(s, 'player').some((c) => c.uid === r));
  s = support(s, 'player', r, { discard: [item] });
  assert.deepEqual(uids(s.players.player.hand), [item]);
  assert.deepEqual(uids(s.players.player.discard), [r], 'the Supporter is not drawn: it was still resolving');
}

// --- Veteran Coach ------------------------------------------------------------

{
  let s = match();
  s = play(s, 'player', 'emberkit', 0, 0);           // 2/3
  s = play(s, 'player', 'pebblet', 0, 2);            // 2/5
  s = play(s, 'player', 'puddlop', 2, 0);            // another zone
  s = play(s, 'ai', 'zappip', 0, 1);                 // enemy, same zone
  const coach = give(s, 'player', 'veteran-coach');
  const item = give(s, 'player', 'power-band');
  assert.deepEqual(supporterTargets(s, 'player', coach), [zoneRef(0), zoneRef(2)], 'only zones with a friendly Pokémon');
  assert.throws(() => support(s, 'player', coach, { release: [item], target: zoneRef(1) }), /legal target/);
  s = support(s, 'player', coach, { release: [item], target: zoneRef(0) });
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4]);
  assert.deepEqual(stats(at(s, 'player', 0, 2)), [3, 6, 6]);
  assert.deepEqual(stats(at(s, 'player', 2, 0)), [1, 4, 4], 'other zone untouched');
  assert.deepEqual(stats(at(s, 'ai', 0, 1)), [2, 2, 2], 'friendly only');
  // Permanent, and only for Pokémon there when it resolved.
  s = play(s, 'player', 'sproutle', 0, 1);
  assert.deepEqual(stats(at(s, 'player', 0, 1)), [1, 4, 4]);
  s = applyAction(s, { type: 'pass', who: 'ai' });
  s = applyAction(s, { type: 'pass', who: 'player' });
  assert.equal(s.round, 2);
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4], 'still there next Round');
}

// Gift: releasing a Swift Pokémon makes it +2/+2. Unplayable with no friendly Pokémon.
{
  let s = match();
  const coach = give(s, 'player', 'veteran-coach');
  give(s, 'player', 'zappip');
  assert.ok(!playableSupporters(s, 'player').some((c) => c.uid === coach));
  s = play(s, 'player', 'ironhorn', 1, 0);           // 3/8
  const zap = s.players.player.hand.find((c) => c.id === 'zappip').uid;
  s = support(s, 'player', coach, { release: [zap], target: zoneRef(1) });
  assert.deepEqual(stats(at(s, 'player', 1, 0)), [5, 10, 10]);
  assert.ok(s.log.some((l) => l.includes('Gift Challenge (a Swift-Tier Pokémon) met: +2/+2 instead.')));
  assert.equal(s.players.player.released.at(-1).name, 'Zappip');
}

// A fallen zone can be chosen while a friendly Pokémon is still there.
{
  let s = match();
  s = play(s, 'player', 'emberkit', 1, 0);
  trainer(s, 'player', 1).strength = 0;
  const coach = give(s, 'player', 'veteran-coach');
  give(s, 'player', 'power-band');
  assert.deepEqual(supporterTargets(s, 'player', coach), [zoneRef(1)]);
}

// --- Field Medic --------------------------------------------------------------

{
  let s = match();
  s = play(s, 'player', 'ironhorn', 1, 0);
  s = play(s, 'player', 'emberkit', 0, 0);
  at(s, 'player', 1, 0).currentStrength = 3;
  at(s, 'player', 0, 0).currentStrength = 1;
  trainer(s, 'player', 1).strength = 13;
  trainer(s, 'ai', 0).strength = 5;
  const medic = give(s, 'player', 'field-medic');
  const [a, b] = ['power-band', 'potion'].map((id) => give(s, 'player', id));
  assert.deepEqual(supporterTargets(s, 'player', medic), [tref('player', 1)], 'damaged friendly Trainers only');
  s = support(s, 'player', medic, { discard: [a], release: [b], target: tref('player', 1) });
  assert.equal(trainer(s, 'player', 1).strength, 15, 'healed 4, capped at 15');
  assert.equal(at(s, 'player', 1, 0).currentStrength, 3, 'no Gift: Pokémon not healed');
}

// Gift (a Water Pokémon paid): also heals friendly Pokémon in that Trainer's Zone 2.
{
  let s = match();
  s = play(s, 'player', 'ironhorn', 1, 0);           // Misty's Zone
  s = play(s, 'player', 'pebblet', 1, 1);
  s = play(s, 'player', 'emberkit', 0, 0);           // other zone
  s = play(s, 'ai', 'mothdust', 1, 0);               // enemy, same zone
  at(s, 'player', 1, 0).currentStrength = 3;
  at(s, 'player', 1, 1).currentStrength = 4;         // 1 below max: capped
  at(s, 'player', 0, 0).currentStrength = 1;
  at(s, 'ai', 1, 0).currentStrength = 1;
  trainer(s, 'player', 1).strength = 6;
  const medic = give(s, 'player', 'field-medic');
  const water = give(s, 'player', 'toxifin');
  const item = give(s, 'player', 'power-band');
  s = support(s, 'player', medic, { discard: [item], release: [water], target: tref('player', 1) });
  assert.equal(trainer(s, 'player', 1).strength, 10);
  assert.equal(at(s, 'player', 1, 0).currentStrength, 5);
  assert.equal(at(s, 'player', 1, 1).currentStrength, 5, 'capped at maximum');
  assert.equal(at(s, 'player', 0, 0).currentStrength, 1, 'other zone untouched');
  assert.equal(at(s, 'ai', 1, 0).currentStrength, 1, 'friendly only');
  assert.ok(s.log.some((l) => l.includes('Gift Challenge (a Water Pokémon) met')));
}

// Unplayable with no damaged friendly Trainer (even if the Gift could heal Pokémon).
{
  let s = match();
  s = play(s, 'player', 'ironhorn', 1, 0);
  at(s, 'player', 1, 0).currentStrength = 1;
  trainer(s, 'ai', 1).strength = 3;                  // enemy Trainer: not friendly
  const medic = give(s, 'player', 'field-medic');
  give(s, 'player', 'puddlop');
  give(s, 'player', 'power-band');
  assert.ok(!playableSupporters(s, 'player').some((c) => c.uid === medic));
}

// --- AI -----------------------------------------------------------------------

// Pays to meet the Gift when it can.
{
  for (let i = 0; i < 10; i++) {
    const s = match();
    s.turn = 'ai';
    const r = give(s, 'ai', 'field-researcher');
    ['power-band', 'potion', 'quickdraw', 'energy-drink'].forEach((id) => give(s, 'ai', id));
    s.players.ai.baseEnergy = 0;                     // nothing else affordable
    const move = chooseAction(s, 'ai');
    assert.equal(move.type, 'playSupporter');
    assert.equal(move.uid, r);
    const paid = s.players.ai.hand.find((c) => c.uid === move.discard[0]);
    assert.equal(paid.id, 'quickdraw', 'the Strategy Card meets the Gift');
    applyAction(s, move);
  }
}
{
  const s = match();
  s.turn = 'ai';
  s.players.ai.baseEnergy = 0;
  trainer(s, 'ai', 2).strength = 4;
  const medic = give(s, 'ai', 'field-medic');
  ['power-band', 'puddlop', 'potion'].forEach((id) => give(s, 'ai', id));
  const move = chooseAction(s, 'ai');
  assert.equal(move.uid, medic);
  assert.deepEqual(move.target, tref('ai', 2));
  const paid = s.players.ai.hand.filter((c) => [...move.discard, ...move.release].includes(c.uid));
  assert.ok(paid.some((c) => c.id === 'puddlop'), 'a Water Pokémon paid: Gift met');
}

console.log('All Supporter tests passed.');
