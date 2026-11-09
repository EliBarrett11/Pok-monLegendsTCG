// v4 UX1: Trainer Objectives from the start, Command modes by situation, the React window, no series
// in displayed text. Focused tests, no match simulations. Run: node v4/tests/ux1.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, commandModesFor, actor } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, DEMO_DECK, LOCATIONS, COMMANDS, SUPPORTERS, ITEMS, TRAINERS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/ai.js';
import { renderMatch, reactSentence } from '../src/ui/board.js';

let n = 0;
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id) => ({ ...cardAtRound(id, 1), uid: `c-${n++}` });
const PILES = ['drawPile', 'hand', 'discard'];
const deckCount = (p) => PILES.reduce((k, pile) => k + p[pile].length, 0);
// A Battle Phase keeping every card where it is (piles intact), the given player's turn.
const battle = (seed = 31, turn = 'player') => {
  let s = createGame(seed);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.row = p.row.map(() => null); p.exertMax = 0; p.exhaust = []; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};

// --- Match setup: two active Objectives at progress 0; 40 cards including both Trainers --------------------------------------
{
  const s = createGame(7);
  for (const w of ['player', 'ai']) {
    const p = s.players[w];
    assert.equal(p.trainers.length, 2, 'one tracker per Trainer card in the deck');
    assert.deepEqual(p.trainers.map((t) => t.name).sort(), ['Blaine', 'Misty']);
    for (const t of p.trainers) {
      assert.equal(t.progress, 0);
      assert.equal(t.complete, false);
      assert.equal(t.startedRound, 1, 'active from Round 1');
      assert.ok([...p.drawPile, ...p.hand].some((c) => c.uid === t.cardUid && c.cardType === 'Trainer'), 'linked to its card\'s uid');
    }
    assert.equal(p.drawPile.length + p.hand.length, 40);
    assert.equal([...p.drawPile, ...p.hand].filter((c) => c.cardType === 'Trainer').length, 2, 'both Trainers stay in the deck');
  }
  assert.equal(DEMO_DECK.length, 40);
}

// --- No Objective action; a Trainer in hand is only a Trainer Command, discarded, its Objective untouched ------------------------------
{
  const s = battle();
  s.players.player.baseEnergy = 9;
  const tr = s.players.player.trainers.find((t) => t.name === 'Misty');
  const pile = PILES.find((k) => s.players.player[k].some((c) => c.uid === tr.cardUid));
  const c = s.players.player[pile].find((x) => x.uid === tr.cardUid);
  s.players.player[pile] = s.players.player[pile].filter((x) => x !== c);
  s.players.player.hand.push(c);
  assert.ok(!legalActions(s, 'player').includes('trainerObjective'), 'not a legal action');
  assert.ok(legalActions(s, 'player').includes('trainerCommand'));
  assert.throws(() => applyAction(s, { type: 'trainerObjective', who: 'player', uid: c.uid }));
  for (let i = 0; i < 50; i++) assert.ok(!legalActions(createGame(i), 'player').includes('trainerObjective'));
  const after = applyAction(s, { type: 'trainerCommand', who: 'player', uid: c.uid });
  assert.ok(after.players.player.discard.some((x) => x.uid === c.uid), 'to the Discard Pile (it keeps cycling)');
  const t2 = after.players.player.trainers.find((t) => t.name === 'Misty');
  assert.deepEqual([t2.progress, t2.complete], [0, false], 'its Objective stays active');
  assert.equal(deckCount(after.players.player), 40);
}

// --- Completing an Objective takes the card from the Draw Pile, the hand or the Discard Pile ---------------------------------------
for (const where of ['drawPile', 'hand', 'discard']) {
  let s = battle(41);
  const p = s.players.player;
  p.baseEnergy = 0;
  s.players.ai.baseEnergy = 0;   // no affordable React: the attack resolves at once
  const tr = p.trainers.find((t) => t.name === 'Misty');
  const from = PILES.find((k) => p[k].some((c) => c.uid === tr.cardUid));
  const c = p[from].find((x) => x.uid === tr.cardUid);
  p[from] = p[from].filter((x) => x !== c);
  if (where === 'hand') c.retained = true;   // Retained or not, it's taken
  p[where].push(c);
  assert.equal(deckCount(p), 40);
  tr.progress = 1;
  p.row[0] = mon('growlithe', 7, { spent: false });
  s.players.ai.row[3] = mon('ponyta', 1, { currentStrength: 1 });
  const rec = p.recognition;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 3 } });
  const q = s.players.player;
  const done = q.trainers.find((t) => t.name === 'Misty');
  assert.ok(done.complete, `complete (${where})`);
  assert.equal(done.progress, 2);
  assert.ok(!PILES.some((k) => q[k].some((x) => x.uid === tr.cardUid)), `the card left the ${where}`);
  assert.equal(deckCount(q), 39, 'the deck total drops to 39');
  assert.equal(q.row[1].name, 'Starmie', 'the Partner arrives in the first free space');
  assert.equal(q.recognition, rec + RULES.perDefeat + RULES.perObjective, '+2 for the Objective');
  assert.equal(q.trainers.length, 2, 'the completed tracker stays');
  assert.ok(s.log.some((l) => l.includes('Misty is taken from your') && l.includes({ drawPile: 'Draw Pile', hand: 'hand', discard: 'Discard Pile' }[where])), 'logs where it came from');
  // A completed tracker makes no further progress.
  q.row[0].spent = false;
  s.turn = 'player';
  s.players.ai.row[4] = mon('ponyta', 1, { currentStrength: 1 });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 4 } });
  assert.equal(s.players.player.trainers.find((t) => t.name === 'Misty').progress, 2);
  assert.equal(s.players.player.row.filter((x) => x?.name === 'Starmie').length, 1, 'no second Partner');
}

// --- commandModesFor --------------------------------------------------------------------------------------------------------------
{
  const s = battle();
  s.players.player.hand = [card('ember')];
  s.players.ai.row[2] = mon('squirtle', 4);
  const uid = s.players.player.hand[0].uid;
  const modes = (st) => commandModesFor(st, 'player', uid).map((m) => [m.mode, m.reason]);
  s.players.player.baseEnergy = 9;
  assert.deepEqual(modes(s), [['adapt', null], ['strat', null]], 'your turn, Strat affordable: Adapt and Strat');
  s.players.player.baseEnergy = 2;
  assert.deepEqual(modes(s), [['adapt', null]], 'Strat (3) not affordable: Adapt only');
  s.players.player.baseEnergy = 1;
  assert.deepEqual(modes(s), [['adapt', 'Adapt needs 2 Energy · you have 1']], 'Adapt with its reason');
  s.players.ai.row[2] = null;
  s.players.player.baseEnergy = 9;
  assert.equal(commandModesFor(s, 'player', uid)[0].reason, 'No target: no enemy Pokémon');
  s.players.ai.row[2] = mon('squirtle', 4);
  s.turn = 'ai';
  assert.deepEqual(modes(s), [], 'the opponent\'s turn: none');
  assert.ok(!commandModesFor(s, 'player', uid).some((m) => m.mode === 'react'), 'never React outside a window');
  // Inside your React window: React only.
  let w = battle(31, 'ai');
  w.players.player.hand = [card('recover')];
  w.players.player.baseEnergy = 3;
  w.players.player.row[1] = mon('squirtle', 4);
  w.players.ai.row[5] = mon('growlithe', 4, { spent: false });
  w.players.ai.hand = [];
  w = applyAction(w, { type: 'attack', who: 'ai', from: 5, target: { kind: 'pokemon', space: 1 } });
  assert.equal(w.reactWindow?.reactor, 'player');
  assert.equal(actor(w), 'player');
  assert.deepEqual(commandModesFor(w, 'player', w.players.player.hand[0].uid).map((m) => m.mode), ['react']);
  assert.deepEqual(commandModesFor(w, 'ai', 'x'), []);
  // The plain sentence for the banner.
  assert.equal(reactSentence(w), 'The Opponent\'s Growlithe is attacking your Wartortle for 4.');
  // Not affordable or no target: nothing.
  const poor = structuredClone(w);
  poor.players.player.baseEnergy = 0;
  assert.deepEqual(commandModesFor(poor, 'player', poor.players.player.hand[0].uid), []);
  // Let it happen: the committed attack resolves.
  const hp = w.players.player.row[1].currentStrength;
  const d = applyAction(w, { type: 'decline', who: 'player' });
  assert.equal(d.reactWindow, null);
  assert.equal(d.players.player.row[1].currentStrength, hp - 4, 'the attack resolved after decline');
  assert.equal(d.turn, 'player', 'then it\'s the player\'s turn');
  // The AI (its own React decisions are instant, through chooseAction) gets React options from the same helper.
  let a = battle(31, 'player');
  a.players.ai.hand = [card('ember')];
  a.players.ai.baseEnergy = 3;
  a.players.player.row[1] = mon('ponyta', 1, { spent: false });
  a.players.ai.row[4] = mon('squirtle', 4);
  a.players.player.hand = [];
  a = applyAction(a, { type: 'attack', who: 'player', from: 1, target: { kind: 'pokemon', space: 4 } });
  assert.equal(chooseAction(a, 'ai', { rng: () => 0 }).type, 'react');
}

// --- No series in displayed text (render helpers' output) and Recognition capped at 100 on screen ---------------------------------------
{
  const html = [];
  const root = { set innerHTML(v) { html.push(v); }, querySelectorAll: () => [] };
  const ctx = { build: 'test', reactTimer: 5, act() {}, redraw() {}, newMatch() {}, setReactTimer() {} };
  const ui = () => ({ select: null, locked: false, seenTournament: null });
  // The mulligan, with every card type in hand.
  let s = createGame(3);
  const all = [...['ponyta', 'chinchou', 'squirtle', 'growlithe', 'magikarp', 'charmander'], ...LOCATIONS.map((c) => c.id), ...COMMANDS.map((c) => c.id), ...SUPPORTERS.map((c) => c.id), ...ITEMS.map((c) => c.id), ...TRAINERS.map((c) => c.id)];
  s.players.player.hand = all.map(card);
  renderMatch(root, s, ui(), ctx);
  // The Battle Phase with Pokémon of every series on both sides, Partners, a React window and selections.
  s = battle(31, 'player');
  s.players.player.hand = all.map(card);
  s.players.player.baseEnergy = 9;
  ['ponyta', 'squirtle', 'charmander'].forEach((id, i) => { s.players.player.row[i] = mon(id, 6, { spent: false }); s.players.ai.row[i + 3] = mon(id, 7); });
  s.players.player.row[8] = { ...TRAINERS[0].partner, uid: 'pp', currentStrength: 6, spent: true, trainer: 'Misty' };
  s.players.player.recognition = 117;
  renderMatch(root, s, ui(), ctx);
  for (const c of s.players.player.hand) renderMatch(root, s, { ...ui(), select: { kind: 'hand', uid: c.uid } }, ctx);
  let w = battle(31, 'ai');
  w.players.player.hand = [card('recover'), card('ember')];
  w.players.player.baseEnergy = 3;
  w.players.player.row[1] = mon('squirtle', 4);
  w.players.ai.row[5] = mon('magikarp', 6, { spent: false });
  w.players.ai.hand = [];
  w = applyAction(w, { type: 'attack', who: 'ai', from: 5, target: { kind: 'pokemon', space: 1 } });
  renderMatch(root, w, ui(), { ...ctx, reactTimer: 5 });
  renderMatch(root, w, { ...ui(), reactClock: { start: Date.now(), ms: 5000 } }, ctx);
  const text = html.join('\n');
  assert.ok(text.includes('REACT?') && text.includes('Let it happen'), 'the React window rendered');
  assert.ok(text.includes('Trainer Objectives'), 'the trackers rendered');
  assert.ok(!/\b(Light|Mid|Heavy)\b/.test(text), `no series in displayed text: ${(text.match(/.{40}\b(Light|Mid|Heavy)\b.{20}/) ?? [''])[0]}`);
  assert.ok(text.includes('<b>100</b>') && !text.includes('<b>117</b>'), 'Recognition shown capped at 100');
  // The log has no series either.
  assert.ok(!s.log.concat(w.log).some((l) => /\b(Light|Mid|Heavy)\b/.test(l)));
}

console.log('v4 UX1: Objectives from setup (40 cards, 2 trackers), no Objective action, Trainer Commands cycle, completion from the Draw Pile / hand / Discard Pile (39 left, Partner, +2, ticked), commandModesFor (Adapt/Strat, none, React), decline resolves, no series shown, Recognition capped — ok');
