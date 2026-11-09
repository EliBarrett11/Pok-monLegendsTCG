// v4 F2 (Locations): focused rule tests, no match simulations. Run: node v4/tests/locations.test.js
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.js';
import {
  createGame, applyAction, legalActions, locationOf, locationStarts, placeable, whyNot, weatherTotals, activeBrackets,
  dominantOf, strengthIn, summonCost, damageOf,
} from '../src/engine/game.js';
import { pokemonAt, cardAtRound, LOCATIONS, DEMO_DECK, WEATHER_BRACKETS } from '../src/engine/cards.js';
import { chooseAction, moves } from '../src/ai/ai.js';

let n = 0;
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `t-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, ...extra }; };
const locCard = (id) => ({ ...cardAtRound(id, 1), uid: `L-${n++}` });
const battle = (seed = 1) => {
  let s = createGame(seed);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { s.players[w].hand = []; s.players[w].row = s.players[w].row.map(() => null); }
  return s;
};
// Place a Location for `who` (it becomes their turn first).
const place = (s, who, id, start) => {
  const c = locCard(id);
  s.players[who].hand.push(c);
  s.turn = who;
  s.passesInARow = 0;
  return applyAction(s, { type: 'placeLocation', who, uid: c.uid, start });
};
const pass = (s) => applyAction(s, { type: 'pass', who: s.turn });
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') s = pass(s); return s; };
const loc = (s, id) => s.locations.find((l) => l.id === id);

// --- The four Location cards and the demo deck -----------------------------------------------------------------
{
  const V4 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(LOCATIONS.length, 4);
  assert.deepEqual(LOCATIONS.map((l) => l.id), ['cerulean-cape', 'mt-ember', 'lake-of-rage', 'route-119']);
  assert.equal(new Set(LOCATIONS.map((l) => l.passive.kind)).size, 4, 'each has a different passive');
  for (const l of LOCATIONS) {
    assert.ok([2, 3, 4].includes(l.width), `${l.name}: covers 2, 3 or 4 lanes`);
    assert.ok(l.rounds >= 1 && ['Rain', 'Sun'].includes(l.weather.type) && l.weather.count >= 1, `${l.name}: rounds and Weather`);
    assert.ok(existsSync(join(V4, '..', 'assets/cards', `${l.art}.jpg`)), `${l.name}: art`);
    assert.equal(DEMO_DECK.filter((id) => id === l.id).length, 1, `${l.name} is in the demo deck`);
  }
  const s = createGame(3);
  for (const w of ['player', 'ai']) assert.equal(s.players[w].drawPile.concat(s.players[w].hand).filter((c) => c.cardType === 'Location').length, 4, 'both players have the 4 Locations');
}

// --- Placement: widths, free lanes, over Pokémon, no room, no Energy -------------------------------------------------
{
  let s = battle();
  s.players.player.row[3] = mon('ponyta', 1);
  const energy = s.players.player.baseEnergy;
  s = place(s, 'player', 'mt-ember', 2);
  const l = loc(s, 'mt-ember');
  assert.deepEqual([l.start, l.width, l.roundsLeft, l.owner], [2, 3, 3, 'player']);
  assert.equal(s.players.player.baseEnergy, energy, 'placing costs no Energy');
  assert.equal(s.players.player.hand.length, 0, 'the card leaves the hand');
  assert.equal(s.turn, 'ai', 'placing is the turn\'s action');
  for (const lane of [2, 3, 4]) assert.equal(locationOf(s, lane), l.uid, `lane ${lane + 1} is in Mt. Ember (both sides)`);
  assert.equal(locationOf(s, 1), 'default');
  assert.equal(locationOf(s, 5), 'default');
  assert.equal(s.players.player.row[3].name, 'Ponyta', 'a Pokémon already there stays, now in the Location');
  assert.equal(s.players.player.row[3].bonusAttack, 1, 'and gets its passive');
  // Free lanes: Route 119 (4 wide) can start only where 4 adjacent lanes are free: lanes 6–9.
  assert.deepEqual(locationStarts(s, locCard('route-119')), [5]);
  assert.deepEqual(locationStarts(s, locCard('cerulean-cape')), [0, 5, 6, 7]);
  assert.throws(() => place(structuredClone(s), 'player', 'cerulean-cape', 1), /adjacent free lanes/, 'cannot overlap another Location');
  assert.throws(() => place(structuredClone(s), 'player', 'cerulean-cape', 8), /adjacent free lanes/, 'cannot run off the battlefield');
  // The opponent may place too (the AI uses the same action).
  s = place(s, 'ai', 'route-119', 5);
  assert.equal(loc(s, 'route-119').owner, 'ai');
  // No room: only lanes 1–2 are free now; Mt. Ember (3 wide) can't be placed, Cerulean Cape (2) can.
  s.turn = 'player';
  s.players.player.hand = [locCard('mt-ember')];
  assert.deepEqual(locationStarts(s, s.players.player.hand[0]), []);
  assert.equal(whyNot(s, 'player', 'summon', s.players.player.hand[0]), 'No room: needs 3 adjacent free lanes');
  assert.ok(!legalActions(s, 'player').includes('placeLocation'));
  s.players.player.hand.push(locCard('cerulean-cape'));
  assert.deepEqual(placeable(s, 'player').map((c) => c.id), ['cerulean-cape']);
  assert.ok(legalActions(s, 'player').includes('placeLocation'));
}

// --- Duration and removal: Rounds count down at Supper; then the lanes are Default again ----------------------------
{
  let s = battle();
  s = place(s, 'player', 'lake-of-rage', 0);
  s.players.player.row[1] = mon('squirtle', 2);
  assert.equal(loc(s, 'lake-of-rage').roundsLeft, 2);
  s = nextRound(s);
  assert.equal(loc(s, 'lake-of-rage').roundsLeft, 1, 'one Round passed');
  s = nextRound(s);
  assert.equal(loc(s, 'lake-of-rage'), undefined, 'removed after its Rounds');
  assert.equal(locationOf(s, 0), 'default');
  assert.equal(locationOf(s, 1), 'default');
  assert.equal(s.players.player.row[1]?.name, 'Squirtle', 'Pokémon in a removed Location stay where they are');
  assert.ok(s.players.player.discard.some((c) => c.id === 'lake-of-rage') || s.players.player.hand.some((c) => c.id === 'lake-of-rage') || s.players.player.drawPile.some((c) => c.id === 'lake-of-rage'), 'the card goes back to its owner\'s piles (the Discard Pile)');
}

// --- Passives -----------------------------------------------------------------------------------------------------------
{
  // Cerulean Cape: +1 Strength (current and maximum); losing it never defeats.
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 1);
  const base = s.players.player.row[0].strength;
  s = place(s, 'player', 'cerulean-cape', 0);
  assert.equal(s.players.player.row[0].strength, base + 1);
  assert.equal(s.players.player.row[0].currentStrength, base + 1);
  s.players.player.row[0].currentStrength = 1;
  s = nextRound(nextRound(nextRound(s)));
  assert.equal(loc(s, 'cerulean-cape'), undefined);
  assert.equal(s.players.player.row[0].strength, base, 'the bonus goes with the Location');
  assert.ok(s.players.player.row[0].currentStrength >= 1, 'and never defeats');

  // Mt. Ember: +1 Attack to Pokémon there (either player's); Pokémon outside don't get it.
  s = battle();
  s.players.player.row[0] = mon('growlithe', 2);
  s.players.ai.row[1] = mon('growlithe', 2);
  s.players.player.row[5] = mon('growlithe', 2);
  const atk = s.players.player.row[5].attack;
  s = place(s, 'ai', 'mt-ember', 0);
  assert.equal(s.players.player.row[0].attack, atk + 1);
  assert.equal(s.players.ai.row[1].attack, atk + 1, 'for both players');
  assert.equal(s.players.player.row[5].attack, atk, 'only within it');
  // A Pokémon summoned into it gets the passive too.
  s.players.player.hand = [{ ...cardAtRound('ponyta', 1), uid: 'p1' }];
  s.turn = 'player';
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'p1', space: 2 });
  assert.equal(s.players.player.row[2].attack, pokemonAt('ponyta', 1).attack + 1);

  // Lake of Rage: Pokémon there heal 2 at Breakfast (not above their Strength); others don't.
  s = battle();
  s.players.player.row[0] = mon('squirtle', 2);
  s.players.player.row[4] = mon('squirtle', 2);
  s = place(s, 'player', 'lake-of-rage', 0);
  const max = s.players.player.row[0].strength;
  s.players.player.row[0].currentStrength = max - 3;
  s.players.player.row[4].currentStrength = max - 3;
  s.players.player.row[1] = mon('squirtle', 2, { currentStrength: max - 1 });
  s = nextRound(s);
  assert.equal(s.players.player.row[0].currentStrength, max - 1, 'heals 2');
  assert.equal(s.players.player.row[4].currentStrength, max - 3, 'outside: no heal');
  assert.equal(s.players.player.row[1].currentStrength, max, 'not above its Strength');

  // Route 119: summoning into it costs 1 less (minimum 0).
  s = battle();
  s = place(s, 'player', 'route-119', 0);
  const c = { ...cardAtRound('charmander', 1), uid: 'c1' };
  assert.equal(c.cost, 1);
  assert.equal(summonCost(s, c, 0), 0);
  assert.equal(summonCost(s, c, 6), 1, 'outside: full cost');
  assert.equal(summonCost(s, { ...c, cost: 0 }, 0), 0, 'never below 0');
  s.players.ai.hand = [c];
  s.turn = 'ai';
  s.players.ai.baseEnergy = 0;
  s.players.ai.exertMax = 0;
  assert.equal(whyNot(s, 'ai', 'summon', c), null, 'payable with no Energy because of the discount');
  s = applyAction(s, { type: 'summon', who: 'ai', uid: 'c1', space: 3 });
  assert.equal(s.players.ai.row[3].name, 'Charmander');
  assert.equal(s.players.ai.exhaust.length, 0, 'nothing paid');
  // The AI offers only the spaces it can pay for (here: Route 119's lanes).
  s = battle();
  s = place(s, 'player', 'route-119', 0);
  s.players.ai.hand = [{ ...cardAtRound('charmander', 1), uid: 'c2' }];
  s.players.ai.baseEnergy = 0;
  s.players.ai.exertMax = 0;
  s.turn = 'ai';
  const ms = moves(s, 'ai').filter((m) => m.type === 'summon');
  assert.ok(ms.length && ms.every((m) => m.space <= 3), 'summons only where the discount makes it payable');
  for (const m of ms) applyAction(s, m);
}

// --- Weather: counts combine across placed Locations; brackets apply to both players ------------------------------------
{
  assert.deepEqual(WEATHER_BRACKETS.map((b) => `${b.type}${b.at}`), ['Rain2', 'Rain4', 'Sun2', 'Sun4']);
  let s = battle();
  s.players.player.row[0] = mon('ponyta', 1);
  s.players.ai.row[8] = mon('squirtle', 2);
  const ponyta = s.players.player.row[0];
  const squirtle = s.players.ai.row[8];
  assert.deepEqual(weatherTotals(s), { Rain: 0, Sun: 0 });
  assert.equal(activeBrackets(s).length, 0);
  assert.equal(damageOf(s, ponyta), ponyta.attack);
  // Sun 1: no bracket yet.
  s = place(s, 'player', 'lake-of-rage', 0);
  assert.deepEqual(weatherTotals(s), { Rain: 0, Sun: 1 });
  assert.equal(activeBrackets(s).length, 0);
  // Sun 3 (combined): Sun 2 — Physical attacks deal +1 damage (Ponyta is Physical; Squirtle Special).
  s = place(s, 'ai', 'mt-ember', 2);
  assert.deepEqual(weatherTotals(s), { Rain: 0, Sun: 3 });
  assert.deepEqual(activeBrackets(s).map((b) => `${b.type}${b.at}`), ['Sun2']);
  assert.equal(damageOf(s, s.players.player.row[0]), ponyta.attack + 1);
  assert.equal(damageOf(s, s.players.ai.row[8]), squirtle.attack, 'Special attacks: unchanged');
  // An attack uses it.
  s.players.player.row[0].spent = false;
  s.players.ai.row[8].strength = 20;
  s.players.ai.row[8].currentStrength = 20;
  s.turn = 'player';
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 8 } });
  assert.equal(s.players.ai.row[8].currentStrength, 20 - (ponyta.attack + 1));
  // Sun 5: Sun 4 — every Pokémon has +1 Attack, in or out of a Location.
  s = place(s, 'player', 'mt-ember', 5);
  assert.equal(weatherTotals(s).Sun, 5);
  assert.equal(s.players.ai.row[8].attack, squirtle.attack + 1, 'Sun 4: +1 Attack everywhere (both players)');
  assert.equal(s.players.player.row[0].attack, ponyta.attack + 1, 'in Lake of Rage too');

  // Rain 2: every Pokémon heals 1 at Breakfast; Rain 4: every Pokémon has +1 Strength.
  s = battle();
  s.players.player.row[8] = mon('squirtle', 2);
  s.players.ai.row[8] = mon('squirtle', 2);
  const str = s.players.player.row[8].strength;
  s = place(s, 'player', 'route-119', 0);
  assert.deepEqual(weatherTotals(s), { Rain: 2, Sun: 0 });
  assert.deepEqual(activeBrackets(s).map((b) => `${b.type}${b.at}`), ['Rain2']);
  s.players.player.row[8].currentStrength = str - 2;
  s.players.ai.row[8].currentStrength = str - 2;
  s = nextRound(s);
  assert.equal(s.players.player.row[8].currentStrength, str - 1, 'Rain 2: heals 1');
  assert.equal(s.players.ai.row[8].currentStrength, str - 1, 'both players');
  s = place(s, 'ai', 'route-119', 4);
  assert.equal(weatherTotals(s).Rain, 4);
  assert.equal(s.players.player.row[8].strength, str + 1, 'Rain 4: +1 Strength everywhere');
  assert.equal(s.players.ai.row[8].strength, str + 1);
}

// --- Dominance and its Recognition at Supper; ties give nothing ---------------------------------------------------------
{
  assert.equal(RULES.perDominance, 1);
  let s = battle();
  s = place(s, 'player', 'cerulean-cape', 0);
  s = place(s, 'ai', 'lake-of-rage', 3);
  s = place(s, 'player', 'route-119', 5);
  // Cerulean Cape: you 2 Pokémon vs 1; Lake of Rage: tied; Route 119: the Opponent only.
  s.players.player.row[0] = mon('ponyta', 1);
  s.players.player.row[1] = mon('ponyta', 1);
  s.players.ai.row[0] = mon('ponyta', 1);
  s.players.player.row[3] = mon('squirtle', 2);
  s.players.ai.row[4] = mon('squirtle', 2);
  s.players.ai.row[7] = mon('magikarp', 1);
  const cape = loc(s, 'cerulean-cape');
  const lake = loc(s, 'lake-of-rage');
  const route = loc(s, 'route-119');
  assert.equal(dominantOf(s, cape), 'player');
  assert.equal(strengthIn(s, lake, 'player'), strengthIn(s, lake, 'ai'));
  assert.equal(dominantOf(s, lake), null, 'a tie: nobody dominates');
  assert.equal(dominantOf(s, route), 'ai', 'even a Location the other player placed');
  const before = { player: s.players.player.recognition, ai: s.players.ai.recognition };
  s = nextRound(s);
  assert.equal(s.players.player.recognition - before.player, RULES.perDominance, 'you: Cerulean Cape only');
  assert.equal(s.players.ai.recognition - before.ai, RULES.perDominance, 'the Opponent: Route 119; the tie gives nothing');
  // Uses current Strength: a damaged Pokémon counts less.
  s.players.player.row[0].currentStrength = 1;
  s.players.player.row[1].currentStrength = 1;
  assert.equal(dominantOf(s, loc(s, 'cerulean-cape')), 'ai');
  // Empty Location: nobody.
  let e = battle();
  e = place(e, 'player', 'mt-ember', 0);
  const r = e.players.player.recognition;
  e = nextRound(e);
  assert.equal(e.players.player.recognition, r);
  assert.equal(e.players.ai.recognition, 0);
}

// --- The AI places Locations and contests dominance (through applyAction) ------------------------------------------------
{
  // It places a Location over lanes where its Pokémon would dominate.
  let s = battle();
  s.players.ai.row[6] = mon('squirtle', 2);
  s.players.ai.hand = [locCard('cerulean-cape')];
  s.turn = 'ai';
  const a = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(a.type, 'placeLocation');
  assert.ok(a.start <= 6 && a.start + 2 > 6, 'covering its Squirtle');
  // It summons into a Location you dominate, rather than elsewhere.
  s = battle();
  s = place(s, 'player', 'lake-of-rage', 4);
  s.players.player.row[4] = mon('ponyta', 1);
  s.players.ai.hand = [{ ...cardAtRound('squirtle', 1), uid: 'q1' }];
  s.turn = 'ai';
  const b = chooseAction(s, 'ai', { rng: () => 0 });
  assert.equal(b.type, 'summon');
  assert.ok([4, 5].includes(b.space), `contests Lake of Rage (chose lane ${b.space + 1})`);
}

console.log('v4 locations: placement, duration and removal, passives, Weather brackets, dominance, ties, AI — ok');
