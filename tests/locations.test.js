// Checks Location Cards and quests, Weather Token counts, and XP.
// Run with: node tests/locations.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, legalTargets, locationSpaces, playableLocations, weatherCounts,
  attackOf, maxStrengthOf, PLAYERS,
} from '../src/engine/game.js';
import { LOCATION_CARDS, POKEMON_CARDS, PLACEHOLDER_DECKLIST, WEATHER_TYPES } from '../src/engine/cardData.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- Helpers ----------------------------------------------------------------

// Round 1 Battle, Ash / Misty / Brock in zones 1–3 on both sides, empty
// hands, plenty of Base Energy, the player to act. Passives and abilities
// off, so numbers are the Locations' own.
function match({ seed = 31 } = {}) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.turn = 'player';
  return s;
}

function give(s, who, id) {
  const p = s.players[who];
  const held = p.hand.find((c) => c.id === id);
  if (held) return held.uid;
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

const onTurn = (s, who) => { s.turn = who; s.passesInARow = 0; s.players[who].baseEnergy = 10; return s; };
const play = (s, who, id, zone, space) => applyAction(onTurn(s, who), { type: 'playPokemon', who, uid: give(s, who, id), zone, space });
const place = (s, who, id, zone) => applyAction(onTurn(s, who), { type: 'playLocation', who, uid: give(s, who, id), zone });
const command = (s, who, from, target) => applyAction(onTurn(s, who), { type: 'command', who, from, target });
const power = (s, who, zone, target) => applyAction(onTurn(s, who), { type: 'usePower', who, zone, target });
const loc = (s, who, zone) => s.players[who].zones[zone].location;
const at = (s, who, zone, space) => s.players[who].zones[zone].pokemon[space];
const trainer = (s, who, zone) => s.players[who].zones[zone].trainer;
const ready = (s, who, zone, space) => { at(s, who, zone, space).spent = false; };
const stats = (c) => [attackOf(c), c.currentStrength, maxStrengthOf(c)];
const pref = (owner, zone, space) => ({ kind: 'pokemon', owner, zone, space });

// Both pass: Supper, then the next Round's Breakfast (stopping at an XP step).
function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}

// Puts a card on top of the Draw Pile, so the next draw takes it.
function stackTop(s, who, id) {
  const p = s.players[who];
  const i = p.drawPile.findIndex((c) => c.id === id);
  p.drawPile.unshift(...p.drawPile.splice(i, 1));
}

// --- Card data ----------------------------------------------------------------

for (const c of LOCATION_CARDS) {
  assert.equal(c.cardType, 'Location');
  for (const field of ['name', 'effectText', 'rarity', 'xp', 'effects']) assert.ok(c[field], `${c.name} ${field}`);
  assert.ok('image' in c);
  assert.ok(Object.entries(c.weatherTokens).every(([type, n]) => WEATHER_TYPES.includes(type) && n >= 1));
  assert.ok(c.quest.text && c.quest.on && c.quest.count >= 1);
}
assert.deepEqual(LOCATION_CARDS.map((c) => [c.name, c.weatherTokens, c.xp]), [
  ['Tidal Cove', { Rain: 2 }, 2], ['Sunbaked Plateau', { Sun: 2 }, 3], ['Old Training Hall', { Rain: 1, Sun: 1 }, 2],
]);
assert.equal(PLACEHOLDER_DECKLIST['tidal-cove'], 2);
assert.equal(PLACEHOLDER_DECKLIST['sunbaked-plateau'], 1);
assert.equal(PLACEHOLDER_DECKLIST['old-training-hall'], 1);
{
  const deck = createGame(1).players.player.drawPile;
  assert.equal(deck.length, 40);
  assert.deepEqual(deck.filter((c) => c.cardType === 'Location').map((c) => c.id).sort(),
    ['old-training-hall', 'sunbaked-plateau', 'tidal-cove', 'tidal-cove']);
}
assert.ok(POKEMON_CARDS.filter((c) => c.pokemonType === 'Fire').length >= 3, 'some Fire Pokémon');
assert.deepEqual(POKEMON_CARDS.filter((c) => c.weatherTokens).map((c) => [c.name, c.weatherTokens]), [['Glimmeria', { Sun: 1 }]]);

// --- Playing Locations ----------------------------------------------------------

// Into an empty space: no Energy, uses the turn. Replacing: the old one is
// discarded and its progress lost.
{
  let s = match();
  s = place(s, 'player', 'tidal-cove', 0);
  assert.equal(s.players.player.baseEnergy, 10, 'no Energy');
  assert.equal(s.turn, 'ai');
  assert.equal(loc(s, 'player', 0).name, 'Tidal Cove');
  assert.equal(loc(s, 'player', 0).progress, 0);
  s = play(s, 'player', 'puddlop', 1, 0);
  assert.equal(loc(s, 'player', 0).progress, 1);
  const old = loc(s, 'player', 0).uid;
  s = place(s, 'player', 'old-training-hall', 0);
  assert.equal(loc(s, 'player', 0).name, 'Old Training Hall');
  const discarded = s.players.player.discard.find((c) => c.uid === old);
  assert.ok(discarded, 'the old Location goes to the Discard Pile');
  assert.equal(discarded.progress, undefined, 'progress lost');
  assert.ok(s.log.some((l) => l.includes('replaced Tidal Cove in Zone 1') && l.includes('progress (1/2) is lost')));
  // Replayed later, it starts again from 0.
  s.players.player.hand.push(...s.players.player.discard.splice(s.players.player.discard.indexOf(discarded), 1));
  s = applyAction(onTurn(s, 'player'), { type: 'playLocation', who: 'player', uid: old, zone: 2 });
  assert.equal(loc(s, 'player', 2).progress, 0);
}

// Not into a fallen zone; a Location already there stays and keeps counting.
{
  let s = match();
  s = place(s, 'player', 'sunbaked-plateau', 0);
  s = play(s, 'player', 'emberkit', 0, 0);
  trainer(s, 'player', 0).strength = 0;              // Zone 1 falls on your side
  assert.deepEqual(locationSpaces(s, 'player'), [1, 2]);
  const uid = give(s, 'player', 'tidal-cove');
  onTurn(s, 'player');
  assert.throws(() => applyAction(s, { type: 'playLocation', who: 'player', uid, zone: 0 }), /fallen/);
  assert.equal(loc(s, 'player', 0).name, 'Sunbaked Plateau', 'it stays');
  ready(s, 'player', 0, 0);
  s = command(s, 'player', { zone: 0, space: 0 }, { kind: 'trainer', zone: 0 });
  assert.equal(loc(s, 'player', 0).progress, 1, 'and keeps counting');
}

// --- Quests -------------------------------------------------------------------

// Tidal Cove: summon 2 Water Pokémon (Ash's free summon counts). Then +2 XP,
// draw 2, and the Location is Released.
{
  let s = match();
  s = play(s, 'player', 'toxifin', 1, 0);           // before the Location: doesn't count
  s = place(s, 'player', 'tidal-cove', 2);
  s = play(s, 'ai', 'toxifin', 0, 0);                // the opponent's: doesn't count
  s = play(s, 'player', 'emberkit', 0, 0);           // not Water
  assert.equal(loc(s, 'player', 2).progress, 0);
  s = play(s, 'player', 'frostail', 0, 1);
  assert.equal(loc(s, 'player', 2).progress, 1);
  s.players.player.hand = [];
  stackTop(s, 'player', 'puddlop');
  s = power(s, 'player', 0);                          // Ash draws Puddlop (1-cost Water)
  s = applyAction(s, { type: 'resolveChoice', who: 'player', zone: 2, space: 0 });
  const q = s.players.player;
  assert.equal(q.xp, 2);
  assert.equal(q.hand.length, 2, 'drew 2');
  assert.equal(loc(s, 'player', 2), null);
  assert.equal(q.released.at(-1).name, 'Tidal Cove');
  assert.ok(s.log.some((l) => l.includes('Your Tidal Cove quest complete! You gain 2 XP (now 2).')));
  assert.ok(s.log.some((l) => l.includes('Your Tidal Cove goes to the Released Pile.')));
}

// Sunbaked Plateau: 3 attacks with Pokémon in this Zone; others don't count.
// Then +3 XP and +1 Attack for friendly Pokémon there now; then Released.
{
  let s = match();
  s = place(s, 'player', 'sunbaked-plateau', 1);
  s = play(s, 'player', 'gustling', 1, 0);           // in the zone
  s = play(s, 'player', 'zappip', 1, 1);
  s = play(s, 'player', 'emberkit', 0, 0);           // another zone
  const attack = (zone, space) => {
    ready(s, 'player', zone, space);
    s = command(s, 'player', { zone, space }, { kind: 'trainer', zone: 0 });
  };
  attack(0, 0);
  assert.equal(loc(s, 'player', 1).progress, 0, 'zone-specific: other zones ignored');
  attack(1, 0);
  attack(1, 1);
  assert.equal(loc(s, 'player', 1).progress, 2);
  s = nextRound(s);                                  // progress carries over between Rounds
  assert.equal(loc(s, 'player', 1).progress, 2);
  attack(1, 0);
  assert.equal(s.players.player.xp, 3);
  assert.equal(loc(s, 'player', 1), null);
  assert.equal(attackOf(at(s, 'player', 1, 0)), 4, 'Gustling 3 + 1');
  assert.equal(attackOf(at(s, 'player', 1, 1)), 3, 'Zappip 2 + 1');
  assert.equal(attackOf(at(s, 'player', 0, 0)), 2, 'other zone: no buff');
  s = play(s, 'player', 'brawlix', 1, 2);
  assert.equal(attackOf(at(s, 'player', 1, 2)), 4, 'a one-off: later Pokémon get nothing');
}

// Old Training Hall: 3 Trainer Powers. Then +2 XP and heal friendly Trainers 2.
{
  let s = match();
  s = place(s, 'player', 'old-training-hall', 0);
  trainer(s, 'player', 0).strength = 10;
  trainer(s, 'player', 1).strength = 14;
  trainer(s, 'ai', 0).strength = 10;
  s = play(s, 'ai', 'puddlop', 1, 0);
  s = play(s, 'player', 'pebblet', 2, 0);
  s = power(s, 'player', 1, pref('ai', 1, 0));       // Misty
  s = power(s, 'player', 2, pref('player', 2, 0));   // Brock
  assert.equal(loc(s, 'player', 0).progress, 2);
  s = nextRound(s);
  s = power(s, 'player', 0);                         // Ash
  if (s.pending) s = applyAction(s, { type: 'resolveChoice', who: 'player' });
  assert.equal(s.players.player.xp, 2);
  assert.deepEqual([0, 1, 2].map((z) => trainer(s, 'player', z).strength), [12, 15, 15], 'healed 2, capped at 15');
  assert.equal(trainer(s, 'ai', 0).strength, 10, 'friendly Trainers only');
  assert.equal(loc(s, 'player', 0), null);
}

// Two Locations with the same quest both count the same event.
{
  let s = match();
  s = place(s, 'player', 'tidal-cove', 0);
  s = place(s, 'player', 'tidal-cove', 1);
  s = play(s, 'player', 'puddlop', 2, 0);
  assert.equal(loc(s, 'player', 0).progress, 1);
  assert.equal(loc(s, 'player', 1).progress, 1);
  s = play(s, 'player', 'toxifin', 2, 1);
  assert.equal(s.players.player.xp, 4, 'both completed');
  assert.equal(s.players.player.released.filter((c) => c.id === 'tidal-cove').length, 2);
}

// --- Weather Tokens -------------------------------------------------------------

{
  let s = match();
  assert.deepEqual(weatherCounts(s), {});
  s = place(s, 'player', 'tidal-cove', 0);           // Rain 2
  s = place(s, 'player', 'old-training-hall', 1);    // Rain 1, Sun 1
  s = place(s, 'ai', 'sunbaked-plateau', 2);         // Sun 2
  give(s, 'player', 'glimmeria');
  assert.deepEqual(weatherCounts(s), { Rain: 3, Sun: 3 }, 'combined across both players; a card in hand doesn\'t count');
  s = play(s, 'player', 'glimmeria', 2, 0);          // Sun 1 while in the arena
  assert.deepEqual(weatherCounts(s), { Rain: 3, Sun: 4 });
  // Glimmeria defeated: its token stops counting.
  s = play(s, 'ai', 'duskfang', 2, 1);               // Quick Attack: Active, Swift
  at(s, 'player', 2, 0).currentStrength = 1;
  s = command(s, 'ai', { zone: 2, space: 1 }, { kind: 'pokemon', zone: 2, space: 0 });
  assert.equal(at(s, 'player', 2, 0), null);
  assert.deepEqual(weatherCounts(s), { Rain: 3, Sun: 3 });
  // A completed Location leaves play: its tokens stop counting.
  s = play(s, 'player', 'puddlop', 0, 0);
  s = play(s, 'player', 'toxifin', 0, 1);
  assert.equal(loc(s, 'player', 0), null);
  assert.deepEqual(weatherCounts(s), { Rain: 1, Sun: 3 });
}

// --- XP -----------------------------------------------------------------------

// The XP step: at Breakfast after drawing; choose in secret, lock in. A
// player with no XP skips it. Buffs carry into play; unspent XP is kept.
{
  let s = match();
  s.players.player.xp = 3;
  stackTop(s, 'player', 'emberkit');
  s = nextRound(s);
  assert.equal(s.phase, 'breakfast');
  assert.equal(s.xpStep, true);
  assert.deepEqual(legalActions(s, 'player'), ['spendXp']);
  assert.deepEqual(legalActions(s, 'ai'), [], 'no XP: skipped');
  const ember = s.players.player.hand.find((c) => c.id === 'emberkit');
  const item = s.players.player.hand.find((c) => c.cardType !== 'Pokémon');
  assert.throws(() => applyAction(s, { type: 'spendXp', who: 'player', spend: Array(4).fill({ uid: ember.uid, stat: 'attack' }) }), /Only 3 XP/);
  if (item) assert.throws(() => applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: item.uid, stat: 'attack' }] }), /Pokémon/);
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: ember.uid, stat: 'attack' }, { uid: ember.uid, stat: 'strength' }] });
  assert.equal(s.phase, 'battle');
  assert.equal(s.players.player.xp, 1, 'unspent XP is stored');
  assert.deepEqual(s.players.player.hand.find((c) => c.uid === ember.uid).xp, { attack: 1, strength: 1 });
  assert.ok(s.log.some((l) => l.includes('You spent 2 XP: Emberkit +1 Attack, +1 Strength (1 XP left).')));
  s = applyAction(onTurn(s, 'player'), { type: 'playPokemon', who: 'player', uid: ember.uid, zone: 0, space: 0 });
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4], 'permanent once played: current and maximum Strength');
  s = nextRound(s);
  if (s.xpStep) s = applyAction(s, { type: 'spendXp', who: 'player', spend: [] });
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 4, 4], 'still there next Round');
}

// Secret: the first lock-in isn't applied until both have locked in.
{
  let s = match();
  s.players.player.xp = 1;
  s.players.ai.xp = 2;
  stackTop(s, 'player', 'emberkit');
  stackTop(s, 'ai', 'zappip');
  s.players.ai.drawPile.forEach((c) => { if (c.cardType === 'Pokémon' && c.id !== 'zappip') c.energyCost = 9; });
  s = nextRound(s);
  s = applyAction(s, chooseAction(s, 'ai'));
  const zap = s.players.ai.hand.find((c) => c.id === 'zappip');
  assert.equal(zap.xp, undefined, 'hidden until both lock in');
  assert.equal(s.players.ai.xp, 2);
  const ember = s.players.player.hand.find((c) => c.id === 'emberkit');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: ember.uid, stat: 'strength' }] });
  const zapAfter = s.players.ai.hand.find((c) => c.id === 'zappip');
  assert.equal(zapAfter.xp.attack + zapAfter.xp.strength, 2, 'the AI spent all its XP on its cheapest affordable Pokémon');
  assert.equal(s.players.ai.xp, 0);
}

// Round 1: the XP step comes after the mulligan.
{
  let s = createGame(4);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  s.players.player.xp = 1;
  s.players.player.hand.push(...s.players.player.drawPile.filter((c) => c.id === 'emberkit').splice(0, 1));
  s.players.player.drawPile = s.players.player.drawPile.filter((c) => c.id !== 'emberkit');
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  assert.equal(s.xpStep, true);
  assert.deepEqual(legalActions(s, 'player'), ['spendXp']);
}

// Lost when the Pokémon leaves the hand unplayed: discarded at Supper...
{
  let s = match();
  s.players.player.xp = 2;
  stackTop(s, 'player', 'mindrake');
  s = nextRound(s);
  const mind = s.players.player.hand.find((c) => c.id === 'mindrake');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: mind.uid, stat: 'attack' }, { uid: mind.uid, stat: 'attack' }] });
  s = nextRound(s);                                  // Supper discards it
  const gone = s.players.player.discard.find((c) => c.uid === mind.uid)
    ?? s.players.player.hand.find((c) => c.uid === mind.uid) ?? s.players.player.drawPile.find((c) => c.uid === mind.uid);
  assert.equal(gone.xp, undefined, 'the buff is lost');
  assert.equal(s.players.player.xp, 0, 'and so is the XP');
}

// ...or paid to a Supporter.
{
  let s = match();
  s.players.player.xp = 1;
  stackTop(s, 'player', 'mindrake');
  s = nextRound(s);
  const mind = s.players.player.hand.find((c) => c.id === 'mindrake');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: mind.uid, stat: 'strength' }] });
  s.players.player.supporterRound = null;
  const researcher = give(s, 'player', 'field-researcher');
  s = applyAction(onTurn(s, 'player'), { type: 'playSupporter', who: 'player', uid: researcher, discard: [mind.uid] });
  const paid = [...s.players.player.discard, ...s.players.player.hand].find((c) => c.uid === mind.uid);
  assert.equal(paid.xp, undefined);
}

// --- AI -----------------------------------------------------------------------

// Locations only into empty spaces; never replaces.
{
  let s = match();
  s = place(s, 'ai', 'tidal-cove', 0);
  s = place(s, 'ai', 'tidal-cove', 1);
  onTurn(s, 'ai');
  s.players.ai.hand = [];
  give(s, 'ai', 'sunbaked-plateau');
  s.players.ai.trainers.forEach((t) => { t.power = { ...t.power, cost: 99 }; });
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'playLocation', who: 'ai', uid: s.players.ai.hand[0].uid, zone: 2 });
  s = place(s, 'ai', 'old-training-hall', 2);
  onTurn(s, 'ai');
  assert.ok(playableLocations(s, 'ai').length, 'replacing would be legal...');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' }, '...but the AI never replaces');
}

// XP: kept when it has no Pokémon it can afford this Round.
{
  let s = match();
  s.players.ai.xp = 2;
  s.players.ai.drawPile.forEach((c) => { if (c.cardType === 'Pokémon') c.energyCost = 9; });
  s.players.player.xp = 1;
  stackTop(s, 'player', 'emberkit');
  stackTop(s, 'ai', 'mindrake');
  s = nextRound(s);
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'spendXp', who: 'ai', spend: [] });
}

console.log('All Location, Weather and XP tests passed.');
