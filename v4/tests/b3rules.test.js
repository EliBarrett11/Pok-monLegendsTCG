// B3-1: the new rules of the Base Game's Batch 1 (docs/base-game/design-bible.md section 4), one focused test each,
// through the engine's own actions. Run: node v4/tests/b3rules.test.js
//   Trigger: On Dominate. Keywords: Drain, Sturdy, Agility, Intimidate X, Stealth, Pickup.
//   Effects: the attack deals no damage; Shell X until Supper; becomes Spent (one enemy, each enemy in a Location);
//   becomes Active; Speed one step higher (kept, and until Supper); return to hand; hand Levels (one card, each card;
//   kept in hand, added to growth, capped); Type-keyword Held Items; Gain N Recognition; damage to the enemy Player
//   Character from a trigger. Objectives: Erika (kept gains, once per effect), Lt. Surge (extra Energy from cards),
//   Whitney (Items bought from the PokéMart). Legendaries: cost 5, Level 8.
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import {
  createGame, applyAction, legalTargets, commandTargets, hasKw, damageOf, effectiveSpeed, passBlockers, syncBonuses, isReady,
} from '../src/engine/game.js';
import { pokemonAt, cardAtRound, keywordList } from '../src/engine/cards.js';
import { DECKS } from '../src/engine/decks.js';
import { cardHTML } from '../src/ui/card.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
// Staged Pokémon: no trigger or keywords unless given (or `real: true` for the card's own).
const mon = (id, level, extra = {}) => {
  const c = pokemonAt(id, level);
  const { real, ...x } = extra;
  return { ...c, ...(real ? {} : { keywords: {}, trigger: null }), uid: `m-${n++}`, currentStrength: c.strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...x };
};
const T = (on, ...ops) => ({ on, ops });
const card = (id, round = 1) => ({ ...cardAtRound(id, round), uid: `c-${n++}` });
const ALL = [...new Set(Object.values(DECKS).flatMap((d) => d.list))];
const battle = (turn = 'player', { trainers = [] } = {}) => {
  // A deck with the Trainers asked for (the rest of Misty's Tide).
  const list = DECKS['mistys-tide'].list.filter((id) => !['misty', 'whitney'].includes(id));
  const deck = [...list, ...trainers, ...['ember', 'ember', 'surf'].slice(0, 40 - list.length - trainers.length)];
  let s = createGame(5, { decks: { player: deck, ai: deck } });
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.drawPile = Array.from({ length: 8 }, () => card('ponyta')); p.discard = []; p.row = p.row.map(() => null); p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; if (!trainers.length) p.trainers = []; p.recognition = 0; p.dollars = 10; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id, round = 1) => { const c = card(id, round); s.players[who].hand.push(c); return c.uid; };
const pass = (s) => { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; return applyAction(s, { type: 'pass', who: s.turn }); };
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') { s.players.player.hand = s.players.player.hand.filter((c) => c.retained); s.players.ai.hand = []; s = pass(s); } return s; };
const place = (s, who, id, start) => { s.players[who].hand.push(card(id)); s.turn = who; s.passesInARow = 0; const x = applyAction(s, { type: 'placeLocation', who, uid: s.players[who].hand.at(-1).uid, start }); x.turn = who; return x; };
const attack = (s, who, from, target) => { s.turn = who; s.passesInARow = 0; s.players[who].row[from].spent = false; return applyAction(s, { type: 'attack', who, from, target }); };
const settle = (s) => { while (s.reactWindow) s = applyAction(s, { type: 'decline', who: s.reactWindow.reactor }); return s; };

// --- On Dominate: at Supper, after dominance, for each of your Pokémon in a Location you dominate -------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('bulbasaur', 3, { real: true, currentStrength: 1 });   // On Dominate: heal 2 to each of yours in its Location
  s.players.player.row[1] = mon('squirtle', 4, { currentStrength: 2 });
  s.players.player.row[5] = mon('bulbasaur', 3, { real: true, currentStrength: 1 });   // in no Location: no dominance there
  s = place(s, 'player', 'cerulean-cape', 0);
  const before = s.players.player.recognition;
  s = nextRound(s);
  const fired = s.log.filter((l) => /Bulbasaur: On Dominate/.test(l)).length;
  eq(fired, 1, 'On Dominate: only the Bulbasaur in the dominated Location');
  // (Cerulean Cape's +1 Strength raises current Strength too.)
  eq(s.players.player.row[0].currentStrength, 1 + 1 + 2, 'it heals 2');
  eq(s.players.player.row[1].currentStrength, 2 + 1 + 2, 'each of yours in its Location');
  eq(s.players.player.row[5].currentStrength, 1, 'the other Bulbasaur: no trigger');
  ok(s.players.player.recognition - before >= RULES.perDominance, 'dominance first');
  const logI = (re) => s.log.findIndex((l) => re.test(l));
  ok(logI(/dominating Cerulean Cape/) < logI(/Bulbasaur: On Dominate/), 'after dominance is decided');
  // Not dominated (the Opponent has more there): no trigger. The Tournament counts the whole battlefield.
  let t = battle();
  t.players.player.row[0] = mon('bulbasaur', 3, { real: true, currentStrength: 1 });
  t.players.ai.row[1] = mon('wooper', 7);
  t = place(t, 'player', 'cerulean-cape', 0);
  t = nextRound(t);
  ok(!t.log.some((l) => /On Dominate/.test(l)), 'not dominated: no On Dominate');
  let u = battle();
  u.tournament = { startedRound: 1, reason: 'test' };
  u.players.player.row[7] = mon('bulbasaur', 3, { real: true, currentStrength: 1 });
  u = nextRound(u);
  ok(u.log.some((l) => /Bulbasaur: On Dominate/.test(l)), 'the Tournament: dominating it is dominating a Location');
}

// --- Drain: after its attack damages a Pokémon it heals that much (up to its maximum); not on hit-backs --------------------
{
  let s = battle();
  s.players.player.row[0] = mon('bulbasaur', 5, { keywords: { drain: true }, currentStrength: 2 });   // Ivysaur
  const a = s.players.player.row[0];
  s.players.ai.row[0] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.row[0].currentStrength, Math.min(a.strength, 2 + a.attack), 'Drain: heals the damage dealt (up to its maximum)');
  ok(s.events.some((e) => e.type === 'keyword' && e.kw === 'Drain'), 'a Drain callout');
  s = battle();
  s.players.player.row[0] = mon('bulbasaur', 5, { keywords: { drain: true }, currentStrength: 1 });
  s.players.ai.row[0] = mon('wooper', 7, { keywords: { shell: 2 }, strength: 20, currentStrength: 20 });
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.row[0].currentStrength, 1 + (pokemonAt('bulbasaur', 5).attack - 2), 'heals what it dealt after Shell');
  // Not on a hit-back: the Drain Pokémon is attacked and hits back.
  s = battle('ai');
  s.players.player.row[0] = mon('bulbasaur', 5, { keywords: { drain: true }, spent: false, currentStrength: 4, speed: 'Swift' });
  s.players.ai.row[0] = mon('ponyta', 3, { speed: 'Swift' });
  const hb = s.players.player.row[0];
  s = attack(s, 'ai', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.row[0].currentStrength, 4 - pokemonAt('ponyta', 3).attack, 'no Drain on a hit-back');
  ok(!s.events.some((e) => e.type === 'keyword' && e.kw === 'Drain'), 'no callout');
  void hb;
}

// --- Sturdy: the first time each match it would be defeated, it stays at 1, and Sturdy is used up -----------------------------
{
  let s = battle();
  s.players.ai.row[0] = mon('munchlax', 6, { keywords: { sturdy: true }, currentStrength: 3 });   // Snorlax
  s.players.player.row[0] = mon('growlithe', 7);
  const uid = s.players.ai.row[0].uid;
  ok(keywordList(s.players.ai.row[0].keywords).includes('Sturdy') && /Sturdy/.test(cardHTML(s.players.ai.row[0], { size: 'full' })), 'shown on the card until used');
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.ai.row[0]?.currentStrength, 1, 'Sturdy: it stays at 1 Strength');
  ok(s.players.ai.row[0].sturdyUsed && !hasKw(s.players.ai.row[0], 'sturdy'), 'and Sturdy is used up');
  ok(!/Sturdy/.test(cardHTML(s.players.ai.row[0], { size: 'full' })), 'no longer shown');
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.ai.row[0], null, 'the second time, it is defeated');
  // Used up for the match: back to hand (Swimmer) and summoned again, the same card has no Sturdy.
  s = battle('ai');
  s.players.ai.row[0] = mon('munchlax', 6, { keywords: { sturdy: true }, currentStrength: 1 });
  s.players.player.row[0] = mon('growlithe', 7);
  const u2 = s.players.ai.row[0].uid;
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  ok(s.players.ai.sturdyUsed.includes(u2), 'remembered for the match (by the card)');
  s.players.ai.row[0] = null;
  s.players.ai.hand = [{ ...pokemonAt('munchlax', 6), keywords: { sturdy: true }, trigger: null, uid: u2 }];
  s.turn = 'ai';
  s = applyAction(s, { type: 'summon', who: 'ai', uid: u2, space: 2 });
  ok(!hasKw(s.players.ai.row[2], 'sturdy'), 'summoned again: Sturdy is still used up');
  // Damage from effects counts too (it's "would be defeated", by anything).
  s = battle();
  s.players.ai.row[0] = mon('munchlax', 6, { keywords: { sturdy: true }, currentStrength: 2 });
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'thunderbolt'), mode: 'adapt', target: { who: 'ai', space: 0 } });
  eq(settle(s).players.ai.row[0]?.currentStrength, 1, 'Sturdy against a Move');
  void uid;
}

// --- Agility: the opponent's Moves can't choose it; "each enemy" effects still hit it --------------------------------------------
{
  let s = battle();
  s.players.ai.row[0] = mon('zapdos', 8, { keywords: { agility: true } });
  s.players.ai.row[3] = mon('squirtle', 3);
  const ember = card('ember');
  eq(commandTargets(s, 'player', ember, 'adapt').map((t) => t.space), [3], 'Agility: not a Move\'s chosen target');
  s.players.ai.row[3] = null;
  eq(commandTargets(s, 'player', ember, 'adapt'), [], 'no other target: none');
  s.players.ai.row[3] = mon('squirtle', 3);
  const st = s.players.ai.row[0].currentStrength;
  s = settle(applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'heat-wave'), mode: 'adapt', target: { who: 'ai', space: null, all: true } }));
  eq(s.players.ai.row[0].currentStrength, st - 1, 'Heat Wave (each enemy Pokémon) still hits it');
  // Still attackable, and a Supporter's chosen target isn't a Move (Firebreather can choose it).
  let t = battle();
  t.players.ai.row[0] = mon('zapdos', 8, { keywords: { agility: true } });
  t.players.player.row[0] = mon('growlithe', 6, { keywords: { infiltrator: true } });
  ok(legalTargets(t, 'player', 0).some((x) => x.space === 0), 'it can still be attacked');
  t.players.player.hand.push(card('ponyta'));
  t = applyAction(t, { type: 'supporter', who: 'player', uid: give(t, 'player', 'firebreather'), release: [t.players.player.hand[0].uid] });
  ok(t.choice?.targets.some((x) => x.who === 'ai' && x.space === 0), 'a Supporter can choose it (Agility is about Moves)');
  t = applyAction(t, { type: 'choose', who: 'player', target: { who: 'ai', space: 0 } });
  ok(!t.choice && t.players.ai.row[0].currentStrength === t.players.ai.row[0].strength - 3, 'Firebreather (its Favour: a Fire Pokémon Released): 3 damage to it');
}

// --- Intimidate X: enemy Pokémon in its Location (its lane, if none) have −X Attack, minimum 0 ---------------------------------
{
  let s = battle();
  s.players.ai.row[1] = mon('magikarp', 6, { keywords: { intimidate: 1 } });   // Gyarados
  s.players.player.row[0] = mon('growlithe', 4);
  s.players.player.row[1] = mon('growlithe', 4);
  s.players.player.row[5] = mon('chinchou', 1);   // Attack 1
  syncBonuses(s);
  const g = pokemonAt('growlithe', 4).attack;
  eq([damageOf(s, s.players.player.row[0]), damageOf(s, s.players.player.row[1])], [g, g - 1], 'no Location: only its own lane');
  s = place(s, 'player', 'mt-ember', 0);   // lanes 1–3: +1 Attack, and the Intimidate covers the Location
  eq([damageOf(s, s.players.player.row[0]), damageOf(s, s.players.player.row[1])], [g + 1 - 1, g + 1 - 1], 'in its Location: each enemy −1');
  ok(damageOf(s, s.players.ai.row[1]) === pokemonAt('magikarp', 6).attack + 1, 'its own side is not affected');
  // Minimum 0.
  let t = battle();
  t.players.ai.row[5] = mon('magikarp', 6, { keywords: { intimidate: 3 } });
  t.players.player.row[5] = mon('chinchou', 1);
  syncBonuses(t);
  eq([t.players.player.row[5].attack, damageOf(t, t.players.player.row[5])], [0, 0], 'minimum 0');
  t.players.ai.row[5] = null;
  syncBonuses(t);
  eq(t.players.player.row[5].attack, pokemonAt('chinchou', 1).attack, 'gone with it');
}

// --- Stealth: it can't be attacked while you have another Pokémon in its Location; Moves can still target it ---------------------
{
  let s = battle();
  s = place(s, 'ai', 'eterna-forest', 0);   // Pokémon here have Stealth
  s.players.ai.row[0] = mon('oddish', 4);
  s.players.player.row[4] = mon('growlithe', 6, { keywords: { infiltrator: true } });
  syncBonuses(s);
  ok(hasKw(s.players.ai.row[0], 'stealth'), 'Stealth from Eterna Forest');
  ok(legalTargets(s, 'player', 4).some((t) => t.space === 0), 'alone in its Location: it can be attacked');
  s.players.ai.row[1] = mon('oddish', 4);
  syncBonuses(s);
  ok(!legalTargets(s, 'player', 4).some((t) => t.space === 0 || t.space === 1), 'with another of its side there: neither can be attacked');
  ok(commandTargets(s, 'player', card('ember'), 'adapt').some((t) => t.space === 0), 'Moves can still target it');
  s.players.ai.row[1] = null;
  s.players.ai.row[5] = mon('oddish', 4);
  syncBonuses(s);
  ok(legalTargets(s, 'player', 4).some((t) => t.space === 0), 'another Pokémon outside its Location doesn\'t hide it');
}

// --- Pickup: when its attack defeats a Pokémon, gain $1 ----------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('meowth', 4, { keywords: { pickup: true } });
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 1 });
  const d = s.players.player.dollars;
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.dollars - d, 1 + 1, 'Pickup: +$1, on top of the defeat\'s $1');
  s = battle();
  s.players.player.row[0] = mon('meowth', 4, { keywords: { pickup: true } });
  s.players.ai.row[0] = mon('wooper', 7);
  s = attack(s, 'player', 0, { kind: 'pokemon', space: 0 });
  eq(s.players.player.dollars, 10, 'no defeat: nothing');
}

// --- The attack deals no damage (Protect's React); Shell X until Supper (Protect's Adapt) -------------------------------------------
{
  let s = battle('ai');
  s.players.player.row[3] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s.players.ai.row[8] = mon('growlithe', 6, { spent: false });
  s.players.player.hand = [card('protect')];
  s = attack(s, 'ai', 8, { kind: 'pokemon', space: 3 });
  eq(s.reactWindow?.reactor, 'player', 'a React window');
  s = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'ai', space: 8 } });
  eq(s.players.player.row[3].currentStrength, 20, 'Protect: the attack deals no damage');
  ok(s.events.some((e) => e.type === 'attack'), 'the attack still happens (and can be hit back)');
  s = battle();
  s.players.player.row[3] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s = settle(applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'protect'), mode: 'adapt', target: { who: 'player', space: 3 } }));
  ok(hasKw(s.players.player.row[3], 'shell') && s.players.player.row[3].tempShell === 2, 'Shell 2 until Supper');
  s.players.ai.row[8] = mon('growlithe', 6);
  s = attack(s, 'ai', 8, { kind: 'pokemon', space: 3 });
  eq(s.players.player.row[3].currentStrength, 20 - (pokemonAt('growlithe', 6).attack - 2), 'it takes 2 less');
  s = nextRound(s);
  ok(!s.players.player.row[3].tempShell && !hasKw(s.players.player.row[3], 'shell'), 'gone at Supper');
}

// --- Becomes Spent (one enemy; each enemy in a Location); becomes Active ------------------------------------------------------
{
  let s = battle();
  for (const sp of [0, 1, 5]) s.players.ai.row[sp] = mon('squirtle', 4, { spent: false });
  s = settle(applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'thunder-wave'), mode: 'adapt', target: { who: 'ai', space: 1 } }));
  eq([0, 1, 5].map((sp) => s.players.ai.row[sp].spent), [false, true, false], 'Thunder Wave Adapt: one enemy becomes Spent');
  s = battle();
  s = place(s, 'player', 'cerulean-cape', 0);
  for (const sp of [0, 1, 5]) s.players.ai.row[sp] = mon('squirtle', 4, { spent: false });
  s = applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'thunder-wave'), mode: 'strat', target: { who: 'ai', space: 0, lane: true } });
  // (A Swift Pokémon of the player's keeps the Opponent's Steady ones from being Ready, so the Opponent can Pass; the
  // Strat resolves as the player's next turn starts.)
  s.players.player.row[8] = mon('ponyta', 3, { spent: false });
  s = settle(applyAction(s, { type: 'pass', who: 'ai' }));
  eq([0, 1, 5].map((sp) => s.players.ai.row[sp].spent), [true, true, false], 'Thunder Wave Strat: each enemy in the Location becomes Spent');
  s = battle();
  s.players.player.row[2] = mon('ponyta', 3, { spent: true });
  s.players.player.hand.push(card('squirtle'));
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'chili'), release: [s.players.player.hand[0].uid] });
  s = applyAction(s, { type: 'choose', who: 'player', target: { who: 'player', space: 2 } });
  ok(!s.players.player.row[2].spent && s.players.player.row[2].tempAttack === 2, 'Chili: becomes Active and +2 Attack until Supper');
}

// --- Speed one step higher: kept, and until Supper ------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 4, { trigger: T('summon', { op: 'speed', amount: 1, to: 'self' }) });   // staged
  const h = { ...pokemonAt('wooper', 4), keywords: {}, trigger: T('summon', { op: 'speed', amount: 1, to: 'self', until: 'supper' }), uid: 'spd' };
  s.players.player.row[0] = null;
  s.players.player.hand = [h];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'spd', space: 0 });
  eq(effectiveSpeed(s.players.player.row[0]), 'Steady', 'Slow → Steady until Supper');
  s = nextRound(s);
  eq(effectiveSpeed(s.players.player.row[0]), 'Slow', 'back at Supper');
  s = battle();
  const k = { ...pokemonAt('wooper', 4), keywords: {}, trigger: T('summon', { op: 'speed', amount: 1, to: 'self' }), uid: 'spd2' };
  s.players.player.hand = [k];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'spd2', space: 0 });
  s = nextRound(s);
  eq(effectiveSpeed(s.players.player.row[0]), 'Steady', 'kept: still Steady after Supper');
  void isReady;
}

// --- Return one of your Pokémon to your hand (Swimmer) ------------------------------------------------------------------------------
{
  let s = battle();
  s.players.player.row[4] = mon('squirtle', 3, { currentStrength: 1 });
  const uid = s.players.player.row[4].uid;
  s.players.player.hand.push(card('ponyta'));
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'swimmer'), release: [s.players.player.hand[0].uid] });
  s = applyAction(s, { type: 'choose', who: 'player', target: { who: 'player', space: 4 } });
  ok(s.players.player.row[4] === null && s.players.player.hand.some((c) => c.uid === uid), 'Swimmer: back to your hand');
  eq(s.players.player.hand.length, 1 + 2, 'and draw 2');
  // A Partner can't be returned (it isn't a deck card).
  let t = battle();
  t.players.player.row[4] = mon('squirtle', 3, { partner: true });
  t.players.player.hand.push(card('ponyta'));
  t = applyAction(t, { type: 'supporter', who: 'player', uid: give(t, 'player', 'swimmer'), release: [t.players.player.hand[0].uid] });
  ok(t.players.player.row[4] && !t.choice && t.events.some((e) => e.type === 'fizzled'), 'a Partner can\'t be chosen: that part fizzles');
}

// --- Hand Levels: one card (Fisherman), each card (Gardenia, Celebi); kept in hand, added to growth, capped ---------------------------
{
  let s = battle();
  s.players.player.drawPile = [card('charmander'), card('ponyta')];
  s.players.player.hand.push(card('ember'));
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'fisherman'), release: [s.players.player.hand[0].uid] });
  const found = s.players.player.hand.find((c) => c.id === 'charmander');
  eq([found.level, found.levelBonus], [3 + 2, 2], 'Fisherman: the card found gains +2 Levels (Level 5: Charmeleon)');
  eq(found.name, pokemonAt('charmander', 5).name, 'its form follows its Level');
  ok(/cd-lvup/.test(cardHTML(found, { size: 'full' })), 'the card shows the Levels it gained');
  // Each Pokémon card in hand (Gardenia): Items and Moves are untouched.
  s = battle();
  s.players.player.hand = [card('ponyta'), card('squirtle'), card('ember')];
  s.players.player.hand.push(card('potion'));
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'gardenia'), release: [s.players.player.hand[3].uid] });
  eq(s.players.player.hand.filter((c) => c.cardType === 'Pokémon').slice(0, 2).map((c) => [c.id, c.level]), [['ponyta', 2], ['squirtle', 3]], 'Gardenia: +1 Level to each Pokémon card in hand');
  // Kept while in hand, on top of its growth each Round (Retained through Supper, so it stays in hand).
  let k = battle();
  const ch = card('charmander');   // Level 3 in Round 1
  k.players.player.hand = [ch, card('potion')];
  k = applyAction(k, { type: 'supporter', who: 'player', uid: give(k, 'player', 'gardenia'), release: [k.players.player.hand[1].uid] });
  eq(k.players.player.hand.find((c) => c.uid === ch.uid).level, 4, 'Gardenia: Level 4 now');
  k.turn = 'player';
  k = applyAction(k, { type: 'retain', who: 'player', uid: ch.uid });
  k = nextRound(k);
  const kept = k.players.player.hand.find((c) => c.uid === ch.uid);
  eq([kept.level, kept.levelBonus], [3 + 1 + 1, 1], 'Round 2: its growth (+1) and the Level it gained (+1)');
  // The cap: Celebi's +2 on a Level 7 Charizard line card stops at 8.
  let c = battle();
  c.round = 5;
  c.players.player.hand = [card('charmander', 5)];   // Level 7 in Round 5
  c.players.player.hand.push({ ...pokemonAt('celebi', 8), uid: 'cel' });
  c = applyAction(c, { type: 'summon', who: 'player', uid: 'cel', space: 0 });
  eq(c.players.player.hand[0].level, 8, 'capped at its series\' top Level');
  // Leaving the hand loses the bonus (summoned at its Level; back to the Draw Pile at the Round's).
  let d = battle();
  d.players.player.hand = [card('charmander')];
  d.players.player.hand.push({ ...pokemonAt('celebi', 8), uid: 'cel2' });
  d = applyAction(d, { type: 'summon', who: 'player', uid: 'cel2', space: 0 });
  d.turn = 'player';
  d.players.player.baseEnergy = 9;
  d = applyAction(d, { type: 'summon', who: 'player', uid: d.players.player.hand[0].uid, space: 1 });
  eq([d.players.player.row[1].level, 'levelBonus' in d.players.player.row[1]], [5, false], 'summoned at the Level it had in hand');
}

// --- Type-keyword Held Items: the keyword only while the holder is that Type ---------------------------------------------------
{
  const s = battle();
  const cases = [['charcoal', 'ponyta', 'squirtle', 'overrun'], ['mystic-water', 'squirtle', 'ponyta', 'shell'], ['miracle-seed', 'oddish', 'ponyta', 'drain'], ['magnet', 'pichu', 'ponyta', 'infiltrator']];
  for (const [item, yes, no, kw] of cases) {
    const a = mon(yes, 3, { held: card(item) });
    const b = mon(no, 3, { held: card(item) });
    ok(hasKw(a, kw) && !hasKw(b, kw), `${item}: ${kw} for a ${a.type} Pokémon only`);
  }
  void s;
}

// --- Gain N Recognition (Amulet Coin); damage to the enemy Player Character from a trigger (Budew) -------------------------------
{
  let s = battle();
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: give(s, 'player', 'amulet-coin'), then: 'use', target: { space: null } });
  eq(s.players.player.recognition, 5, 'Amulet Coin: gain 5 Recognition');
  s = battle();
  s.players.player.row[2] = mon('budew', 2, { real: true });   // On Attack: 1 damage to the enemy Player Character
  s.players.ai.row[2] = mon('wooper', 7);
  s = attack(s, 'player', 2, { kind: 'pokemon', space: 2 });
  eq(s.players.player.recognition, 1 * RULES.perDamageToPlayer, 'Budew: 1 damage to the enemy Player Character, as Recognition');
  ok(s.events.some((e) => e.type === 'pcDamage' && e.amount === 1), 'a Player Character hit');
}

// --- Objectives: Erika (kept gains, once per effect), Lt. Surge (extra Energy from cards), Whitney (Items bought from the PokéMart) ---
{
  let s = battle('player', { trainers: ['erika', 'lt-surge', 'whitney'] });
  const tr = (name) => s.players.player.trainers.find((t) => t.name === name);
  ok(tr('Erika') && tr('Lt. Surge') && tr('Whitney'), 'the three trackers');
  for (const sp of [0, 1, 2]) s.players.player.row[sp] = mon('squirtle', 3);
  s = settle(applyAction(s, { type: 'command', who: 'player', uid: give(s, 'player', 'recover'), mode: 'strat', target: { who: 'player', space: null, all: true } }));
  s = settle(applyAction(s, { type: 'pass', who: 'ai' }));
  eq(tr('Erika').progress, 1, 'Erika: Recover\'s Strat gave 3 Pokémon kept Strength: counts once');
  s.turn = 'player';
  const rel = card('ponyta');
  s.players.player.hand.push(rel);
  s = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'flannery'), release: [rel.uid] });
  eq(tr('Erika').progress, 1, 'until-Supper gains don\'t count');
  // Lt. Surge: extra Energy gained from cards (Chinchou's On Summon: +1 Energy); a Pass's Energy isn't from a card.
  s.turn = 'player';
  s.players.player.hand = [{ ...pokemonAt('chinchou', 1), uid: 'ch1' }];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'ch1', space: 5 });
  eq(tr('Lt. Surge').progress, 1, 'Lt. Surge: +1 Energy from Chinchou counts 1');
  s.turn = 'player';
  for (const sp of passBlockers(s, 'player')) s.players.player.row[sp].spent = true;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq(tr('Lt. Surge').progress, 1, 'a Pass doesn\'t count');
  // Whitney: Items bought from the PokéMart (buying one from your hand isn't "from the PokéMart").
  s.turn = 'player';
  s.passesInARow = 0;
  s.players.player.dollars = 20;
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: give(s, 'player', 'potion'), then: 'store' });
  eq(tr('Whitney').progress, 0, 'from your hand: no');
  s.turn = 'player';
  s.mart.soldOut = null;
  if (!s.mart.onSale[0]) s.mart.onSale[0] = s.mart.pool.shift();
  s.mart.stock = 3;
  s = applyAction(s, { type: 'buyItem', who: 'player', from: 'mart', slot: 0, then: 'store' });
  eq(tr('Whitney').progress, 1, 'from the PokéMart: 1');
}

// --- Legendaries: cost 5 and Level 8 from the start; they don't grow ---------------------------------------------------------------
{
  let s = battle();
  const e = card('entei', 1);
  eq([e.level, e.cost], [8, 5], 'Entei in Round 1: Level 8, cost 5');
  s.players.player.hand = [e];
  s.players.player.baseEnergy = 5;
  s = applyAction(s, { type: 'summon', who: 'player', uid: e.uid, space: 0 });
  eq([s.players.player.row[0].name, s.players.player.baseEnergy], ['Entei', 0], 'summoned for 5');
  ok(!s.players.player.row[0].spent, 'Quick Attack: Active');
  eq(card('entei', 9).level, 8, 'Round 9: still Level 8');
  void ALL;
}

console.log(`b3rules: ${checks} checks passed`);
