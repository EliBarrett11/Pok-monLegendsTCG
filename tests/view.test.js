// Checks Multiplayer M1's hidden information (rules sections 9.1 and 10),
// without the DOM: viewFor(state, seat) never shows a seat the opponent's
// hand, either Draw Pile, the PokéMart deck or the random-number state, after
// any action of a whole match; and still shows everything that is public.
// Run with: node tests/view.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, PLAYERS, opponentOf } from '../src/engine/game.js';
import { localize, secretOf, nameOf, verbFor, whose } from '../src/engine/board.js';
import { viewFor, redactEvents } from '../src/engine/view.js';
import { chooseAction } from '../src/ai/opponent.js';

// --- The log's seat words -------------------------------------------------------------

{
  const names = { player: 'You', ai: 'AI Opponent' };
  const line = `${nameOf('ai')} ${verbFor('ai', 'win', 'wins')}! ${whose(null, 'player')} hand: ${secretOf('player', 'Surf', 'a card')}.`;
  assert.equal(localize(line, 'player', names), 'AI Opponent wins! Your hand: Surf.');
  assert.equal(localize(line, 'ai', names), 'You win! Opponent\'s hand: a card.');
  const hot = { player: 'Player 1', ai: 'Player 2' };
  assert.equal(localize(line, 'player', hot), 'Player 2 wins! Your hand: Surf.');
  assert.equal(localize(line, 'ai', hot), "You win! Player 1's hand: a card.");
  // A secret can hold other seat words.
  assert.equal(localize(secretOf('ai', `${whose(null, 'ai')} Kyogre`, 'a card'), 'ai', hot), 'Your Kyogre');
}

// --- A whole match, checked after every action ----------------------------------------------

const keysDeep = (node, out = new Set()) => {
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { out.add(k); keysDeep(v, out); }
  return out;
};
const objectsWithUid = (node, uid, out = []) => {
  if (node && typeof node === 'object') {
    if (node.uid === uid) out.push(node);
    for (const v of Object.values(node)) objectsWithUid(v, uid, out);
  }
  return out;
};
// The full state's words as this seat reads them.
const local = (node, seat, names) => (typeof node === 'string' ? localize(node, seat, names)
  : Array.isArray(node) ? node.map((x) => local(x, seat, names))
    : node && typeof node === 'object' ? Object.fromEntries(Object.entries(node).map(([k, x]) => [k, local(x, seat, names)])) : node);
const PUBLIC_FIELDS = ['discard', 'released', 'bag', 'dollars', 'xp', 'trainers', 'zones', 'deck', 'supporterRound',
  'baseEnergy', 'exertMax', 'exhaust'];
const ALL_NAMES = new Set();
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function checkView(state, seat, seen) {
  const foe = opponentOf(seat);
  const v = viewFor(state, seat);
  const json = JSON.stringify(v);
  const ctx = `${seat}, Round ${state.round} ${state.phase}`;

  // The random-number state and seed.
  const keys = keysDeep(v);
  assert.ok(!keys.has('rng') && !keys.has('seed') && !keys.has('logSource'), `${ctx}: no RNG state`);

  // The opponent's hand: its size and uids, not the cards.
  const hand = state.players[foe].hand;
  assert.deepEqual(v.players[foe].hand.map((c) => c.uid), hand.map((c) => c.uid), `${ctx}: opponent's hand uids and count`);
  for (const c of hand) {
    // (A card Returned from the Discard Pile was public on its way back to the hand.)
    const shown = { ...v, events: v.events.filter((e) => e.type !== 'returned') };
    for (const o of objectsWithUid(shown, c.uid)) assert.ok(!('name' in o) && !('cardType' in o) && !('id' in o), `${ctx}: opponent's ${c.name} is hidden`);
  }
  // Both Draw Piles: counts only (the seat's own Search shows the matching cards).
  const ownSearch = v.pending?.who === seat && v.pending.from === 'draw' ? v.pending.options : [];
  for (const who of PLAYERS) {
    assert.equal(v.players[who].drawPile.length, state.players[who].drawPile.length, `${ctx}: ${who}'s Draw Pile count`);
    assert.ok(v.players[who].drawPile.every((c) => Object.keys(c).join() === 'hidden'), `${ctx}: nothing about Draw Pile cards`);
    for (const c of state.players[who].drawPile) {
      if (ownSearch.includes(c.uid)) continue;
      assert.ok(!json.includes(`"${c.uid}"`), `${ctx}: Draw Pile card ${c.uid} never appears`);
    }
  }
  // The PokéMart deck: count only; the 3 on sale show.
  assert.equal(v.mart.deck.length, state.mart.deck.length);
  assert.ok(v.mart.deck.every((c) => Object.keys(c).join() === 'hidden'));
  // (An Item sent back to the PokéMart is known to be in it; where it is, isn't.)
  for (const c of state.mart.deck) assert.ok(!JSON.stringify(v.mart).includes(`"${c.uid}"`), `${ctx}: PokéMart deck order`);
  assert.deepEqual(v.mart.onSale, state.mart.onSale, `${ctx}: the Items on sale`);
  // The opponent's secret choices, until both lock in.
  if (state.players[foe].pending) assert.deepEqual(v.players[foe].pending, { locked: true }, `${ctx}: their choice is secret`);
  if (state.players[foe].xpChoice) assert.deepEqual(v.players[foe].xpChoice, [], `${ctx}: their XP is secret`);
  if (state.pending?.who === foe) assert.equal(v.pending.options, undefined, `${ctx}: their choice's options are secret`);

  // The log and events: no card the seat can't see by name, unless that name is public anyway.
  // (Not the PokéMart deck: which Items it holds is public, only its order is not.)
  const hidden = new Set([...hand, ...PLAYERS.flatMap((w) => state.players[w].drawPile)].map((c) => c.name));
  // Cards this action showed (played, used, moved to a public pile) count as public.
  const publicText = JSON.stringify({ ...v, log: [] });
  for (const name of hidden) if (publicText.includes(`"${name}"`)) hidden.delete(name);
  const told = v.log.slice(seen[seat]);
  seen[seat] = v.log.length;
  // Whole names only ("Ember" is not in "Mt. Ember"): longer names are masked first.
  const longer = [...ALL_NAMES].sort((a, b) => b.length - a.length);
  for (const name of hidden) {
    const masks = longer.filter((n) => n !== name && n.includes(name));
    const re = new RegExp(`(^|[^\\w])${escape(name)}($|[^\\w])`);
    for (const line of told) {
      const text = masks.reduce((t, m) => t.split(m).join('•'), line);
      assert.ok(!re.test(text), `${ctx}: "${name}" is hidden but named: ${line.slice(0, 160)}`);
    }
  }
  assert.deepEqual(v.events, redactEvents(state.events, seat, state.names));

  // Everything public is there: both arenas, piles, Bags, money, XP, Energy...
  for (const who of PLAYERS) {
    for (const f of PUBLIC_FIELDS) assert.deepEqual(v.players[who][f], local(state.players[who][f], seat, state.names), `${ctx}: ${who}'s ${f}`);
    assert.equal(v.players[who].hand.length, state.players[who].hand.length);
  }
  assert.deepEqual(v.players[seat].hand, local(state.players[seat].hand, seat, state.names), `${ctx}: your own hand in full`);
  for (const f of ['round', 'phase', 'turn', 'initiative', 'winner', 'passesInARow', 'stats', 'names']) assert.deepEqual(v[f], state[f], f);
  assert.equal(v.players[seat].name, 'You');
  // The same moves are open to the seat as in the full game.
  assert.deepEqual(legalActions(v, seat), legalActions(state, seat), `${ctx}: legal actions`);
}

function playChecked(seed, decks) {
  let s = createGame(seed, { decks });
  for (const w of PLAYERS) for (const c of [...s.players[w].drawPile, ...s.players[w].trainers, ...s.mart.deck]) ALL_NAMES.add(c.name);
  let n = seed;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const seen = { player: 0, ai: 0 };
  let actions = 0;
  for (let guard = 0; guard < 5000 && s.phase !== 'gameOver'; guard++) {
    const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
    s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
    actions += 1;
    for (const seat of PLAYERS) checkView(s, seat, seen);
  }
  return { s, actions };
}

{
  const { s, actions } = playChecked(7, { player: 'fire', ai: 'water' });
  assert.equal(s.phase, 'gameOver', 'the match was played to the end');
  assert.ok(actions > 50);
  // The log reads right for each seat.
  const won = viewFor(s, s.winner).log.at(-1);
  const lost = viewFor(s, opponentOf(s.winner)).log.at(-1);
  assert.ok(won.startsWith('You win!'), won);
  assert.ok(!lost.startsWith('You'), lost);
}

// --- Simultaneous choices stay secret until both lock in ---------------------------------------

{
  let s = createGame(4, { decks: { player: 'fire', ai: 'water' } });
  const order = s.players.ai.trainers.map((t) => t.uid).reverse();
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order });
  const v = viewFor(s, 'player');
  assert.deepEqual(v.players.ai.pending, { locked: true }, 'you see that they locked in');
  assert.ok(!JSON.stringify(v.players.ai.pending).includes('trainer'), 'not where they put their Trainers');
  assert.ok(v.players.ai.zones.every((z) => z.trainer === null));
  assert.deepEqual(viewFor(s, 'ai').players.ai.pending, order, 'they see their own choice');
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: s.players.player.trainers.map((t) => t.uid) });
  assert.deepEqual(viewFor(s, 'player').players.ai.zones.map((z) => z.trainer.uid), order, 'revealed together');
}

// --- Events: what the opponent drew, searched or put XP on stays hidden ---------------------------

{
  const events = [
    { type: 'cardsDrawn', who: 'ai', uids: ['ai-3'], count: 1 },
    { type: 'searched', who: 'ai', source: 'x', cards: [{ uid: 'ai-9', name: 'Kyogre' }] },
    { type: 'xpSpent', who: 'ai', total: 3, parts: [{ name: 'Horsea', attack: 1, strength: 1 }, { name: 'Goldeen', attack: 0, strength: 1 }] },
    { type: 'retainGranted', who: 'ai', uid: 'ai-4', name: 'Surf' },
    { type: 'itemAttached', who: 'ai', item: { uid: 'mart-x', name: 'Leftovers' }, target: { kind: 'hand', owner: 'ai', uid: 'ai-5', name: 'Kyogre' } },
  ];
  const mine = redactEvents(events, 'player');
  assert.ok(!JSON.stringify(mine).match(/Kyogre|Horsea|Goldeen|Surf/), 'no hidden names');
  assert.equal(mine[0].count, 1, '"drew a card" is fine');
  assert.deepEqual(mine[2].parts, [{ attack: 1, strength: 2 }]);
  assert.equal(mine[4].item.name, 'Leftovers', 'the Item used is public');
  assert.deepEqual(redactEvents(events, 'ai'), events, 'they see their own');
}

console.log('All hidden-information tests passed.');
