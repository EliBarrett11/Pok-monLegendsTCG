// Checks Location Cards and quests, Weather Token counts, XP, and each Fire
// and Water Location working as written.
// Run with: node tests/locations.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, legalActions, locationSpaces, playableLocations, weatherCounts, PLAYERS,
} from '../src/engine/game.js';
import { LOCATION_CARDS, WEATHER_TYPES } from '../src/engine/cardData.js';
import { statusCount } from '../src/engine/status.js';
import { chooseAction } from '../src/ai/opponent.js';
import {
  battle, give, act, onTurn, play, place, choose, at, trainerAt, pref, tref, stats, logged,
} from './fixtures.js';

// --- Helpers ----------------------------------------------------------------

// Trainer Passives and Powers off, so the numbers are the Locations' own.
const fire = () => battle({ seed: 31, passives: false, powers: false });
const water = () => battle({ seed: 31, player: 'water', ai: 'fire', passives: false, powers: false });
const locate = (s, who, id, zone) => act(s, who, { type: 'playLocation', uid: give(s, who, id), zone });
const strategy = (s, who, id, target) => act(s, who, { type: 'playStrategy', uid: give(s, who, id), target });
const command = (s, who, from, target) => act(s, who, { type: 'command', from, target });
const loc = (s, who, zone) => s.players[who].zones[zone].location;
const ready = (s, who, zone, space) => { at(s, who, zone, space).spent = false; };
const hurt = (s, ref, to) => { at(s, ref.owner, ref.zone, ref.space).currentStrength = to; return ref; };
const burn = (c) => statusCount(c, 'burn');

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

// --- Playing Locations ----------------------------------------------------------

// Into an empty space: no Energy, uses the turn. Replacing: the old one is
// discarded and its progress lost.
{
  let s = water();
  s = locate(s, 'player', 'cerulean-cape', 0);
  s.players.player.baseEnergy = 10;
  assert.equal(s.turn, 'ai');
  assert.equal(loc(s, 'player', 0).name, 'Cerulean Cape');
  assert.equal(loc(s, 'player', 0).progress, 0);
  s = play(s, 'player', 'chinchou', 0, 0);
  assert.equal(loc(s, 'player', 0).progress, 1);
  const old = loc(s, 'player', 0).uid;
  s = locate(s, 'player', 'route-119', 0);
  assert.equal(loc(s, 'player', 0).name, 'Route 119');
  const discarded = s.players.player.discard.find((c) => c.uid === old);
  assert.ok(discarded, 'the old Location goes to the Discard Pile');
  assert.equal(discarded.progress, undefined, 'progress lost');
  assert.ok(logged(s, 'replaced Cerulean Cape in Zone 1') && logged(s, 'progress (1/3) is lost'));
  // Replayed later, it starts again from 0.
  s.players.player.hand.push(...s.players.player.discard.splice(s.players.player.discard.indexOf(discarded), 1));
  s = act(s, 'player', { type: 'playLocation', uid: old, zone: 2 });
  assert.equal(loc(s, 'player', 2).progress, 0);
}

// Playing one costs no Energy.
{
  let s = fire();
  s.players.player.baseEnergy = 0;
  s.turn = 'player';
  s = applyAction(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'mt-ember'), zone: 1 });
  assert.equal(s.players.player.baseEnergy, 0);
  assert.equal(loc(s, 'player', 1).name, 'Mt. Ember');
}

// Not into a fallen zone; a Location already there stays and keeps counting.
{
  let s = fire();
  s = locate(s, 'player', 'mt-ember', 0);
  trainerAt(s, 'player', 0).strength = 0;              // Zone 1 falls on your side
  assert.deepEqual(locationSpaces(s, 'player'), [1, 2]);
  const uid = give(s, 'player', 'stark-mountain');
  onTurn(s, 'player');
  assert.throws(() => applyAction(s, { type: 'playLocation', who: 'player', uid, zone: 0 }), /fallen/);
  assert.equal(loc(s, 'player', 0).name, 'Mt. Ember', 'it stays');
  s = strategy(s, 'player', 'ember', tref('ai', 1));
  assert.equal(loc(s, 'player', 0).progress, 1, 'and keeps counting');
}

// Two Locations with the same quest both count the same event.
{
  let s = water();
  s = locate(s, 'player', 'cerulean-cape', 0);
  s = locate(s, 'player', 'cerulean-cape', 1);
  s = play(s, 'player', 'horsea', 0, 0);
  s = play(s, 'player', 'horsea', 1, 0);
  assert.deepEqual([loc(s, 'player', 0).progress, loc(s, 'player', 1).progress], [1, 1], 'each counts its own Zone');
  s = play(s, 'player', 'chinchou', 0, 1);
  s = play(s, 'player', 'chinchou', 0, 2);
  assert.equal(s.players.player.xp, 2);
  assert.equal(loc(s, 'player', 1).progress, 1);
}

// --- Fire Locations ---------------------------------------------------------------

// Mt. Ember: apply Burn 4 times (each card burned counts). Then 2 XP, Burn 2 to
// each enemy Trainer, and the Location is Released.
{
  let s = fire();
  s = locate(s, 'player', 'mt-ember', 2);
  s = strategy(s, 'player', 'ember', tref('ai', 0));
  assert.equal(loc(s, 'player', 2).progress, 1);
  s = strategy(s, 'player', 'heat-wave');               // 3 enemy Trainers: 3 more
  const p = s.players.player;
  assert.equal(p.xp, 2);
  assert.equal(loc(s, 'player', 2), null);
  assert.equal(p.released.at(-1).name, 'Mt. Ember');
  assert.deepEqual(s.players.ai.zones.map((z) => burn(z.trainer)), [2 + 1 + 2, 1 + 2, 1 + 2]);
  assert.ok(logged(s, 'Your Mt. Ember quest complete! You gain 2 XP (now 2).'));
  assert.ok(logged(s, 'Your Mt. Ember goes to the Released Pile.'));
}

// Cinnabar Volcano: damage enemy Trainers 3 times with Pokémon in this Zone.
// Then 3 XP, and friendly Fire Pokémon there now gain +1/+1.
{
  let s = fire();
  s = locate(s, 'player', 'cinnabar-volcano', 1);
  place(s, 'player', 1, 0, 'growlithe');
  place(s, 'player', 1, 1, 'mankey');
  place(s, 'player', 0, 0, 'ponyta');                   // another Zone
  const attack = (zone, space) => {
    ready(s, 'player', zone, space);
    s = command(s, 'player', { zone, space }, { kind: 'trainer', zone: 2 });
  };
  attack(0, 0);
  assert.equal(loc(s, 'player', 1).progress, 0, 'Pokémon in other Zones don\'t count');
  attack(1, 0);
  attack(1, 1);
  assert.equal(loc(s, 'player', 1).progress, 2);
  s = nextRound(s);
  assert.equal(loc(s, 'player', 1).progress, 2, 'progress carries over between Rounds');
  attack(1, 0);
  assert.equal(s.players.player.xp, 3);
  assert.equal(loc(s, 'player', 1), null);
  assert.deepEqual(stats(at(s, 'player', 1, 0)).slice(0, 1).concat(stats(at(s, 'player', 1, 0))[2]), [3, 6], 'Growlithe +1/+1');
  assert.equal(stats(at(s, 'player', 1, 1))[0], 4, 'Mankey is Fighting: no buff');
  assert.equal(stats(at(s, 'player', 0, 0))[0], 3, 'other Zone: no buff');
}

// Stark Mountain: defeat 2 enemy Pokémon (by any of your cards or effects).
// Then 2 XP and 2 damage to each enemy Pokémon in this Zone.
{
  let s = fire();
  s = locate(s, 'player', 'stark-mountain', 0);
  hurt(s, place(s, 'ai', 2, 0, 'horsea', { spent: true }), 1);
  hurt(s, place(s, 'ai', 1, 0, 'horsea', { spent: true }), 4);
  place(s, 'ai', 0, 0, 'test-dragon');                   // Hitpoints: Physical attacks aren't guarded
  place(s, 'ai', 0, 1, 'horsea');
  place(s, 'player', 2, 0, 'growlithe');
  s = command(s, 'player', { zone: 2, space: 0 }, { kind: 'pokemon', zone: 2, space: 0 });
  assert.equal(loc(s, 'player', 0).progress, 1, 'an attack');
  s = strategy(s, 'player', 'fire-blast', pref('ai', 1, 0));
  assert.equal(s.players.player.xp, 2, 'a Strategy Card');
  assert.deepEqual([at(s, 'ai', 0, 0).currentStrength, at(s, 'ai', 0, 1).currentStrength], [9, 2]);
}

// --- Water Locations --------------------------------------------------------------

// Cerulean Cape: summon 3 of your Pokémon into this Zone (a free summon counts).
// Then 2 XP, and friendly Pokémon there now gain +1/+1.
{
  let s = water();
  s = play(s, 'player', 'quagsire', 2, 0);              // before the Location: doesn't count
  s = locate(s, 'player', 'cerulean-cape', 2);
  s = play(s, 'ai', 'growlithe', 2, 0);                 // the opponent's: doesn't count
  s = play(s, 'player', 'horsea', 1, 0);                // another Zone
  assert.equal(loc(s, 'player', 2).progress, 0);
  s = play(s, 'player', 'chinchou', 2, 1);
  give(s, 'player', 'horsea');
  s = act(s, 'player', { type: 'playSupporter', uid: give(s, 'player', 'swimmer'), discard: [give(s, 'player', 'dive'), give(s, 'player', 'surf')], release: [] });
  s = choose(s, { uids: [s.pending.options[0]] });
  s = choose(s, { zone: 2, space: 2 });                 // a free summon
  assert.equal(loc(s, 'player', 2).progress, 2);
  hurt(s, pref('player', 2, 0), 2);
  s.players.player.zones[2].pokemon[2] = null;
  s = play(s, 'player', 'goldeen', 2, 2);
  if (s.pending) s = choose(s, { target: s.pending.options[0] });
  assert.equal(s.players.player.xp, 2);
  assert.equal(stats(at(s, 'player', 2, 1))[0], 4, 'Chinchou 3 + 1');
  assert.equal(stats(at(s, 'player', 1, 0))[0], 3, 'other Zone: no buff');
  assert.equal(loc(s, 'player', 2), null);
}

// Lake of Rage: heal 10 Strength in total (only what is actually healed counts).
// Then 3 XP, and Return up to 2 Pokémon from the Discard Pile.
{
  let s = water();
  s = locate(s, 'player', 'lake-of-rage', 1);
  hurt(s, place(s, 'player', 0, 0, 'quagsire'), 6);      // 1 below its maximum
  s = strategy(s, 'player', 'aqua-ring', pref('player', 0, 0));
  assert.equal(loc(s, 'player', 1).progress, 1, 'healed 1, not 3');
  hurt(s, pref('player', 0, 0), 1);
  s = strategy(s, 'player', 'aqua-ring', pref('player', 0, 0));
  s = strategy(s, 'player', 'aqua-ring', pref('player', 0, 0));
  assert.equal(loc(s, 'player', 1).progress, 7);
  const p = s.players.player;
  const gone = ['lapras', 'gyarados', 'horsea'].map((id) => { const c = p.drawPile.find((x) => x.id === id); p.drawPile.splice(p.drawPile.indexOf(c), 1); p.discard.push(c); return c.uid; });
  trainerAt(s, 'player', 0).strength = 10;
  s = act(s, 'player', { type: 'playSupporter', uid: give(s, 'player', 'nurse-joy'), discard: [give(s, 'player', 'surf')], target: tref('player', 0) });
  assert.equal(s.players.player.xp, 3);
  assert.equal(s.pending.kind, 'pick');
  assert.deepEqual([s.pending.min, s.pending.max], [0, 2], 'up to 2');
  assert.deepEqual([...s.pending.options].sort(), [...gone].sort());
  s = choose(s, { uids: gone.slice(0, 2) });
  assert.ok(gone.slice(0, 2).every((u) => s.players.player.hand.some((c) => c.uid === u)));
}

// Route 119: have 3 friendly Pokémon in this Zone at Supper. Then 2 XP and heal
// all friendly Trainers 3.
{
  let s = water();
  s = locate(s, 'player', 'route-119', 0);
  place(s, 'player', 0, 0, 'horsea');
  place(s, 'player', 0, 1, 'horsea');
  trainerAt(s, 'player', 1).strength = 10;
  s = nextRound(s);
  assert.equal(s.players.player.xp, 0, 'only 2 there at Supper');
  place(s, 'player', 0, 2, 'chinchou');
  s = act(s, 'player', { type: 'pass' });
  s = applyAction(s, { type: 'pass', who: 'ai' });
  assert.equal(s.players.player.xp, 2);
  assert.equal(trainerAt(s, 'player', 1).strength, 13);
  assert.equal(loc(s, 'player', 0), null);
}

// --- Weather Tokens -------------------------------------------------------------

{
  let s = fire();
  assert.deepEqual(weatherCounts(s), {});
  s = locate(s, 'player', 'mt-ember', 0);               // Sun 2
  s = locate(s, 'player', 'stark-mountain', 1);         // Sun 3
  s = locate(s, 'ai', 'cerulean-cape', 2);              // Rain 2
  give(s, 'ai', 'pelipper');
  assert.deepEqual(weatherCounts(s), { Sun: 5, Rain: 2 }, 'combined across both players; a card in hand doesn\'t count');
  s = play(s, 'ai', 'pelipper', 1, 0);                  // Rain 2 while in the arena
  if (s.pending) s = choose(s, { target: s.pending.options[0] });
  assert.deepEqual(weatherCounts(s), { Sun: 5, Rain: 4 });
  // Pelipper defeated: its tokens stop counting.
  hurt(s, pref('ai', 1, 0), 1);
  s = strategy(s, 'player', 'fire-blast', pref('ai', 1, 0));
  assert.equal(at(s, 'ai', 1, 0), null);
  assert.deepEqual(weatherCounts(s), { Sun: 5, Rain: 2 });
  // A completed Location leaves play: its tokens stop counting.
  s = strategy(s, 'player', 'heat-wave');
  s = strategy(s, 'player', 'ember', tref('ai', 0));
  assert.equal(loc(s, 'player', 0), null);
  assert.deepEqual(weatherCounts(s), { Sun: 3, Rain: 2 });
}

// --- XP -----------------------------------------------------------------------

// The XP step: at Breakfast after drawing; choose in secret, lock in. A
// player with no XP skips it. Buffs carry into play; unspent XP is kept.
{
  let s = fire();
  s.players.player.xp = 3;
  stackTop(s, 'player', 'growlithe');
  s = nextRound(s);
  assert.equal(s.phase, 'breakfast');
  assert.equal(s.xpStep, true);
  assert.deepEqual(legalActions(s, 'player'), ['spendXp']);
  assert.deepEqual(legalActions(s, 'ai'), [], 'no XP: skipped');
  const ember = s.players.player.hand.find((c) => c.id === 'growlithe');
  const item = s.players.player.hand.find((c) => c.cardType !== 'Pokémon');
  assert.throws(() => applyAction(s, { type: 'spendXp', who: 'player', spend: Array(4).fill({ uid: ember.uid, stat: 'attack' }) }), /Only 3 XP/);
  if (item) assert.throws(() => applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: item.uid, stat: 'attack' }] }), /Pokémon/);
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: ember.uid, stat: 'attack' }, { uid: ember.uid, stat: 'strength' }] });
  assert.equal(s.phase, 'battle');
  assert.equal(s.players.player.xp, 1, 'unspent XP is stored');
  assert.deepEqual(s.players.player.hand.find((c) => c.uid === ember.uid).xp, { attack: 1, strength: 1 });
  assert.ok(s.log.some((l) => l.includes('You spent 2 XP: Growlithe +1 Attack, +1 Strength (1 XP left).')));
  s = applyAction(onTurn(s, 'player'), { type: 'playPokemon', who: 'player', uid: ember.uid, zone: 0, space: 0 });
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 6, 6], 'permanent once played: current and maximum Strength');
  s = nextRound(s);
  if (s.xpStep) s = applyAction(s, { type: 'spendXp', who: 'player', spend: [] });
  assert.deepEqual(stats(at(s, 'player', 0, 0)), [3, 6, 6], 'still there next Round');
}

// Secret: the first lock-in isn't applied until both have locked in.
{
  let s = fire();
  s.players.player.xp = 1;
  s.players.ai.xp = 2;
  stackTop(s, 'player', 'growlithe');
  stackTop(s, 'ai', 'horsea');
  s.players.ai.drawPile.forEach((c) => { if (c.cardType === 'Pokémon' && c.id !== 'horsea') c.energyCost = 9; });
  s = nextRound(s);
  s = applyAction(s, chooseAction(s, 'ai'));
  const zap = s.players.ai.hand.find((c) => c.id === 'horsea');
  assert.equal(zap.xp, undefined, 'hidden until both lock in');
  assert.equal(s.players.ai.xp, 2);
  const ember = s.players.player.hand.find((c) => c.id === 'growlithe');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: ember.uid, stat: 'strength' }] });
  const zapAfter = s.players.ai.hand.find((c) => c.id === 'horsea');
  assert.equal(zapAfter.xp.attack + zapAfter.xp.strength, 2, 'the AI spent all its XP on its cheapest affordable Pokémon');
  assert.equal(s.players.ai.xp, 0);
}

// Round 1: the XP step comes after the mulligan.
{
  let s = createGame(4);
  for (const who of PLAYERS) s = applyAction(s, chooseAction(s, who));
  s = applyAction(s, { type: 'flipCoin' });
  s.players.player.xp = 1;
  s.players.player.hand.push(...s.players.player.drawPile.filter((c) => c.id === 'growlithe').splice(0, 1));
  s.players.player.drawPile = s.players.player.drawPile.filter((c) => c.id !== 'growlithe');
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  assert.equal(s.xpStep, true);
  assert.deepEqual(legalActions(s, 'player'), ['spendXp']);
}

// Lost when the Pokémon leaves the hand unplayed: discarded at Supper...
{
  let s = fire();
  s.players.player.xp = 2;
  stackTop(s, 'player', 'blaziken');
  s = nextRound(s);
  const mind = s.players.player.hand.find((c) => c.id === 'blaziken');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: mind.uid, stat: 'attack' }, { uid: mind.uid, stat: 'attack' }] });
  s = nextRound(s);                                  // Supper discards it
  const gone = s.players.player.discard.find((c) => c.uid === mind.uid)
    ?? s.players.player.hand.find((c) => c.uid === mind.uid) ?? s.players.player.drawPile.find((c) => c.uid === mind.uid);
  assert.equal(gone.xp, undefined, 'the buff is lost');
  assert.equal(s.players.player.xp, 0, 'and so is the XP');
}

// ...or paid to a Supporter.
{
  let s = fire();
  s.players.player.xp = 1;
  stackTop(s, 'player', 'blaziken');
  s = nextRound(s);
  const mind = s.players.player.hand.find((c) => c.id === 'blaziken');
  s = applyAction(s, { type: 'spendXp', who: 'player', spend: [{ uid: mind.uid, stat: 'strength' }] });
  s.players.player.supporterRound = null;
  const researcher = give(s, 'player', 'firebreather');
  s = applyAction(onTurn(s, 'player'), { type: 'playSupporter', who: 'player', uid: researcher, discard: [mind.uid] });
  const paid = [...s.players.player.discard, ...s.players.player.hand].find((c) => c.uid === mind.uid);
  assert.equal(paid.xp, undefined);
}

// --- AI -----------------------------------------------------------------------

// Locations only into empty spaces; never replaces.
{
  let s = battle({ seed: 31, passives: false, powers: false });
  s = locate(s, 'ai', 'cerulean-cape', 0);
  s = locate(s, 'ai', 'cerulean-cape', 1);
  onTurn(s, 'ai');
  s.players.ai.hand = [];
  give(s, 'ai', 'lake-of-rage');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'playLocation', who: 'ai', uid: s.players.ai.hand[0].uid, zone: 2 });
  s = locate(s, 'ai', 'route-119', 2);
  onTurn(s, 'ai');
  assert.ok(playableLocations(s, 'ai').length, 'replacing would be legal...');
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'pass', who: 'ai' }, '...but the AI never replaces');
}

// XP: kept when it has no Pokémon it can afford this Round.
{
  let s = fire();
  s.players.ai.xp = 2;
  s.players.ai.drawPile.forEach((c) => { if (c.cardType === 'Pokémon') c.energyCost = 9; });
  s.players.player.xp = 1;
  stackTop(s, 'player', 'growlithe');
  stackTop(s, 'ai', 'kyogre');
  s = nextRound(s);
  assert.deepEqual(chooseAction(s, 'ai'), { type: 'spendXp', who: 'ai', spend: [] });
}

console.log('All Location, Weather and XP tests passed.');
