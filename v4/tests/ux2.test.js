// v4 UX2: Objective targets, stronger Partners, the stat icons and the new card faces. Focused tests,
// no match simulations. Run: node v4/tests/ux2.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, passBlockers } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, TRAINERS, LOCATIONS, COMMANDS, SUPPORTERS, ITEMS } from '../src/engine/cards.js';
import { attackIcon, strengthIcon, STAT_ICONS } from '../src/ui/icons.js';
import { renderMatch, renderHandCard } from '../src/ui/board.js';

let n = 0;
// G2: board Pokémon are staged plain (no trigger or keywords): these tests check rules; tests/g2.test.js checks the Pokémon.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, keywords: {}, trigger: null, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id) => ({ ...cardAtRound(id, 1), uid: `c-${n++}` });
const battle = (turn = 'player') => {
  let s = createGame(77);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; p.dollars = 0; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const tracker = (s, who, name) => s.players[who].trainers.find((t) => t.name === name);
// G1: a Ready Pokémon with unmatched Speed blocks Pass; these tests only move time on, so it's made Spent.
const pass = (s) => { for (const sp of passBlockers(s, s.turn)) s.players[s.turn].row[sp].spent = true; return applyAction(s, { type: 'pass', who: s.turn }); };
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') s = pass(s); return s; };

// --- A. The Objective targets and texts --------------------------------------------------------------------------
{
  const misty = TRAINERS.find((t) => t.id === 'misty');
  const blaine = TRAINERS.find((t) => t.id === 'blaine');
  assert.deepEqual([misty.objective.kind, misty.objective.need, misty.objective.text], ['defeat', 8, 'Defeat 8 enemy Pokémon']);
  assert.deepEqual([blaine.objective.kind, blaine.objective.need, blaine.objective.text], ['dominate', 5, 'Dominate a Location 5 times']);
  const s = createGame(3);
  assert.equal(tracker(s, 'player', 'Misty').objective.need, 8);
  assert.equal(tracker(s, 'ai', 'Blaine').objective.need, 5);
}

// --- A. The stronger Partners (stats, On Summon, $4 when defeated) -------------------------------------------------
{
  const star = TRAINERS.find((t) => t.id === 'misty').partner;
  const nine = TRAINERS.find((t) => t.id === 'blaine').partner;
  assert.deepEqual([star.level, star.speed, star.attackType, star.strengthType, star.attack, star.strength, star.cost], [8, 'Swift', 'Special', 'Hitpoints', 8, 10, 4]);
  assert.deepEqual(star.trigger, { on: 'summon', ops: [{ op: 'draw', amount: 2 }] });
  assert.deepEqual([nine.level, nine.speed, nine.attackType, nine.strengthType, nine.attack, nine.strength, nine.cost], [8, 'Steady', 'Special', 'Hitpoints', 9, 11, 4]);
  assert.deepEqual(nine.trigger, { on: 'summon', ops: [{ op: 'damage', amount: 2, to: 'eachEnemy' }] }, 'up from 1');
  // Ninetales arriving deals 2 to each enemy Pokémon: Blaine one domination short, then a dominated Location at Supper.
  let s = battle();
  tracker(s, 'player', 'Blaine').progress = 4;
  s.players.player.row[0] = mon('squirtle', 5);
  s.players.ai.row[6] = mon('squirtle', 5);   // Wartortle, Strength 7
  s = applyAction(s, { type: 'placeLocation', who: 'player', uid: (s.players.player.hand.push(card('cerulean-cape')), s.players.player.hand.at(-1).uid), start: 0 });
  s = nextRound(s);
  assert.ok(tracker(s, 'player', 'Blaine').complete);
  const nt = s.players.player.row.find((c) => c?.name === 'Ninetales');
  assert.deepEqual([nt.level, nt.attack, nt.strength - nt.bonusStrength], [8, 9, 11], 'printed stats (it arrived inside Cerulean Cape: +1 Strength on top)');
  assert.equal(s.players.ai.row[6].currentStrength, 7 - 2, 'On Summon: 2 damage');
  // Starmie arriving draws 2.
  s = battle();
  tracker(s, 'player', 'Misty').progress = 7;
  s.players.player.drawPile = Array.from({ length: 5 }, () => card('ponyta'));
  s.players.player.row[0] = mon('growlithe', 7, { spent: false });
  s.players.ai.row[2] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.hand = [];
  const hand = s.players.player.hand.length;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 2 } });
  const st = s.players.player.row.find((c) => c?.name === 'Starmie');
  assert.deepEqual([st.level, st.speed, st.attack, st.strength], [8, 'Swift', 8, 10]);
  assert.equal(s.players.player.hand.length, hand + 2);
  // A defeated Partner gives its opponent $1 (G1: a flat $1 per defeat).
  s = battle('ai');
  s.players.player.row[3] = { ...structuredClone(nine), uid: 'p9', currentStrength: 1, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, trainer: 'Blaine' };
  s.players.ai.row[3] = mon('growlithe', 7, { spent: false });
  s.players.player.hand = [];
  s = applyAction(s, { type: 'attack', who: 'ai', from: 3, target: { kind: 'pokemon', space: 3 } });
  assert.equal(s.players.player.row[3], null);
  assert.equal(s.players.ai.dollars, 1, '$1 for a defeated Partner');
}

// --- A. Blaine counts one per Location dominated at a Supper (and the Tournament counts one) ------------------------------
{
  let s = battle();
  const before = tracker(s, 'player', 'Blaine').progress;
  s.players.player.row[0] = mon('squirtle', 5);
  s.players.player.row[5] = mon('squirtle', 5);
  for (const [id, start] of [['cerulean-cape', 0], ['lake-of-rage', 4]]) {
    s.players.player.hand.push(card(id));
    s.turn = 'player';
    s.passesInARow = 0;
    s = applyAction(s, { type: 'placeLocation', who: 'player', uid: s.players.player.hand.at(-1).uid, start });
  }
  s = nextRound(s);
  assert.equal(tracker(s, 'player', 'Blaine').progress, before + 2, 'two Locations dominated at one Supper: +2');
  assert.equal(tracker(s, 'ai', 'Blaine').progress, 0);
  s.tournament = { startedRound: s.round, reason: 'test' };
  s.locations = [];
  const p2 = tracker(s, 'player', 'Blaine').progress;
  s = nextRound(s);
  assert.equal(tracker(s, 'player', 'Blaine').progress, p2 + 1, 'the Tournament counts 1');
}

// --- B. The stat icons ---------------------------------------------------------------------------------------------
{
  const has = (html, key) => html.includes(`c-${key}`) && html.includes(STAT_ICONS[key]);
  assert.ok(has(attackIcon({ attackType: 'Physical' }), 'pa'), 'Physical Attack: claw slashes');
  assert.ok(has(attackIcon({ attackType: 'Special' }), 'sa'), 'Special Attack: a burst');
  assert.ok(has(strengthIcon({ strengthType: 'Hitpoints' }), 'hp'), 'Hitpoints: a heart');
  assert.ok(has(strengthIcon({ strengthType: 'Defence' }), 'def'), 'Defence: a shield');
  assert.ok(has(strengthIcon({ strengthType: 'Special Defence' }), 'sdef'), 'Special Defence: a barrier');
  assert.ok(STAT_ICONS.pa.includes('M4 15C6 10 9 6 15 3') && STAT_ICONS.sdef.includes('M12 2l8.6 5v10L12 22l-8.6-5V7z'), 'paths copied from the icon sheet');
  assert.notEqual(attackIcon({ attackType: 'Physical' }), attackIcon({ attackType: 'Special' }));
  // Real cards: Charizard (Special, Hitpoints), Squirtle (Special, Defence), Chinchou (Special, Special Defence), Ponyta (Physical).
  assert.ok(strengthIcon(pokemonAt('squirtle', 3)).includes('c-def'));
  assert.ok(strengthIcon(pokemonAt('chinchou', 3)).includes('c-sdef'));
  assert.ok(attackIcon(pokemonAt('ponyta', 3)).includes('c-pa'));
  assert.ok(attackIcon(pokemonAt('charmander', 7)).includes('c-sa'));
}

// --- B. Card faces: no cost on a Location; no series anywhere ---------------------------------------------------------
{
  const s = battle();
  const loc = card('lake-of-rage');
  const locHtml = renderHandCard(s, loc);
  assert.ok(!locHtml.includes('v4-gem'), 'a Location card has no cost element');
  assert.ok(renderHandCard(s, card('potion')).includes('v4-gem money'), 'an Item has a $ gem');
  assert.ok(renderHandCard(s, mon('ponyta', 1)).includes('v4-gem'), 'a Pokémon has an Energy gem');
  s.players.player.baseEnergy = 0;
  assert.ok(renderHandCard(s, mon('charmander', 7)).includes('v4-gem no'), 'red when you can\'t afford it');
  // Every card type in hand and on the board, across screens: no Light, Mid or Heavy.
  const html = [];
  const root = { set innerHTML(v) { html.push(v); }, querySelectorAll: () => [] };
  const ctx = { build: 'test', reactTimer: 5, act() {}, redraw() {}, newMatch() {}, setReactTimer() {} };
  const all = ['ponyta', 'chinchou', 'squirtle', 'growlithe', 'magikarp', 'charmander', ...LOCATIONS.map((c) => c.id), ...COMMANDS.map((c) => c.id), ...SUPPORTERS.map((c) => c.id), ...ITEMS.map((c) => c.id), ...TRAINERS.map((c) => c.id)];
  const b = battle();
  b.players.player.hand = all.map(card);
  ['ponyta', 'squirtle', 'charmander', 'magikarp'].forEach((id, i) => { b.players.player.row[i] = mon(id, 6, { spent: false }); b.players.ai.row[i + 4] = mon(id, 7); });
  b.players.player.row[8] = { ...structuredClone(TRAINERS[0].partner), uid: 'pp', currentStrength: 6, spent: true, trainer: 'Misty' };
  for (const c of b.players.player.hand) html.push(renderHandCard(b, c));
  renderMatch(root, b, { select: null, locked: false, drawer: 'log' }, ctx);
  renderMatch(root, b, { select: { kind: 'attack', from: 0 }, locked: false }, ctx);
  for (const c of b.players.player.hand) renderMatch(root, b, { select: { kind: 'hand', uid: c.uid }, locked: false }, ctx);
  const text = html.join('\n');
  const m = text.match(/.{30}\b(Light|Mid|Heavy)\b.{20}/);
  assert.ok(!m, `no series in displayed text: ${m?.[0]}`);
  assert.ok(text.includes('PokéMart') && text.includes('v4-drawer log') && text.includes('v4-martcard'), 'the log drawer and the PokéMart card rendered (G1: no PokéMart drawer)');
  assert.ok(text.includes('Trainer Objectives') && text.includes('Defeat 8 Pokémon'));
}

console.log('v4 UX2: Objective targets 8/5, stronger Partners (stats, On Summon, $4), Blaine counts per Location, the five stat icons, no cost on Locations, no series shown — ok');
