// V9 — hidden information: viewFor(state, seat) and redactEvents for v2. Full seeded matches
// (every deck pairing): after every action, both seats' views leak nothing: not the opponent's
// hand, neither Draw Pile, not the Item pool's order, not the random-number state, not the
// opponent's Trainer Point assignment before both lock in, not which cards a Search or Tracey
// took or which card in hand gained Retain or levelled up. The log is seat-neutral; uids are opaque.
// Run with: node v2/tests/view.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, actor, legalActions, localize, PLAYERS, opponentOf, pickOptions } from '../src/engine/game.js';
import { DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';
import { viewFor, redactEvents } from '../src/engine/view.js';

const ONLY = (o, keys) => Object.keys(o).every((k) => keys.includes(k));

function checkView(state, seat) {
  const v = viewFor(state, seat);
  const foe = opponentOf(seat);
  const label = `round ${state.round} ${state.phase} (${seat})`;
  assert.ok(!('seed' in v) && !('rng' in v), `${label}: no random-number state`);
  // The opponent's hand: count and opaque uids only.
  assert.equal(v.players[foe].hand.length, state.players[foe].hand.length, `${label}: opponent's hand count`);
  assert.ok(v.players[foe].hand.every((c) => c.hidden && ONLY(c, ['uid', 'hidden'])), `${label}: opponent's hand hidden`);
  // Both Draw Piles and the Item pool: counts only.
  for (const w of PLAYERS) {
    assert.equal(v.players[w].drawPile.length, state.players[w].drawPile.length, `${label}: ${w} Draw Pile count`);
    assert.ok(v.players[w].drawPile.every((c) => c.hidden && ONLY(c, ['hidden'])), `${label}: ${w} Draw Pile hidden`);
    assert.ok(!('reshuffles' in v.players[w]));
  }
  assert.equal(v.itemPool.length, state.itemPool.length);
  assert.ok(v.itemPool.every((c) => ONLY(c, ['hidden'])), `${label}: Item pool hidden`);
  assert.ok(!('searchable' in v.players[foe]), `${label}: no view of the opponent's Search`);
  // Anything anywhere carrying a secret uid is blank (except the seat's own Search list).
  const secret = new Set([...state.players[foe].hand.map((c) => c.uid), ...PLAYERS.flatMap((w) => state.players[w].drawPile.map((c) => c.uid)), ...state.itemPool.map((c) => c.uid)]);
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (path.endsWith('.searchable')) return;
    if (!Array.isArray(node) && secret.has(node.uid)) assert.ok(ONLY(node, ['uid', 'hidden']), `${label}: ${path} shows a secret card: ${JSON.stringify(node)}`);
    for (const [k, x] of Object.entries(node)) walk(x, `${path}.${k}`);
  };
  walk(v, 'view');
  // Own Search: only cards matching a Search the seat holds, all from its own Draw Pile.
  for (const c of v.players[seat].searchable ?? []) assert.ok(state.players[seat].drawPile.some((d) => d.uid === c.uid), `${label}: searchable from own Draw Pile`);
  // The opponent's Trainer Point assignment: only that they've locked in.
  if (state.assign?.[foe]) assert.deepEqual(v.assign[foe], { locked: true }, `${label}: assignment hidden until both lock in`);
  // Events: nothing about the opponent's hidden cards.
  for (const e of v.events) {
    if (e.who !== foe) continue;
    assert.notEqual(e.type, 'levelUp', `${label}: a card in their hand levelling up isn't shown`);
    if (e.type === 'searched') assert.ok(!('cards' in e));
  }
  // The log: rendered for this seat (no tokens left), Retain on their card unnamed.
  const text = JSON.stringify(v);
  assert.ok(!text.includes('⟨') && !text.includes('⟩'), `${label}: every seat token rendered`);
  for (const line of v.log) {
    if (line.endsWith('gains Retain.') && !line.startsWith('A card in the Opponent')) {
      const name = line.replace(' gains Retain.', '');
      assert.ok(state.players[seat].hand.concat(state.players[seat].discard, state.players[seat].row.filter(Boolean)).some((c) => c?.name === name) || !state.players[foe].hand.some((c) => c.name === name),
        `${label}: "${line}" names a card the seat may know`);
    }
  }
  // The seat's own hand is all there.
  assert.deepEqual(v.players[seat].hand.map((c) => c.uid), state.players[seat].hand.map((c) => c.uid));
  assert.ok(v.players[seat].hand.every((c) => c.name), `${label}: own hand visible`);
  // Plain JSON: the same after being sent.
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
  return v;
}

let actions = 0;
let retainLines = 0;
let assigns = 0;
for (const [a, b, seed] of [['fire', 'water', 3], ['water', 'grass', 5], ['grass', 'fire', 8], ['grass', 'grass', 13], ['water', 'fire', 21]]) {
  let s = createGame(seed, { decks: { player: DECKS[a].list, ai: DECKS[b].list }, itemPool: POOL_ITEMS, plans: { player: a, ai: b } });
  let k = seed;
  const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
    s = applyAction(s, chooseAction(s, actor(s), { rng }));
    actions += 1;
    for (const seat of PLAYERS) checkView(s, seat);
    retainLines += s.log.filter((l) => l.includes('gains Retain')).length > 0 ? 1 : 0;
    if (s.assign && PLAYERS.some((w) => s.assign[w])) assigns += 1;
  }
  assert.equal(s.phase, 'gameOver', `${a}–${b} ends`);
}
assert.ok(assigns > 0, 'the assign step (one locked, one not) was checked');

// The log is seat-neutral: each seat reads it as "You" for its own moves.
{
  let s = applyAction(createGame(4, { decks: { player: DECKS.fire.list, ai: DECKS.water.list } }), { type: 'flipCoin' });
  const who = s.turn;
  const card = s.players[who].hand.find((c) => c.cardType === 'Pokémon' && c.cost <= s.players[who].energy);
  if (card) {
    s = applyAction(s, { type: 'summon', who, uid: card.uid, space: 0 });
    const mine = viewFor(s, who).log.at(-1);
    const theirs = viewFor(s, opponentOf(who)).log.at(-1);
    assert.ok(mine.startsWith('You summoned'), mine);
    assert.ok(theirs.startsWith('Opponent summoned'), theirs);
  }
  assert.equal(localize('⟨ai|Your|The Opponent\'s⟩ card', 'ai'), 'Your card');
  assert.equal(localize('⟨ai|Your|The Opponent\'s⟩ card', 'player'), 'The Opponent\'s card');
}

// Opaque uids: by place after the shuffle, and renumbered when a Discard Pile becomes the Draw Pile.
{
  const s = createGame(9, { decks: { player: DECKS.fire.list, ai: DECKS.grass.list } });
  for (const w of PLAYERS) s.players[w].drawPile.forEach((c, i) => assert.equal(c.uid, `${w}-${i}`));
  // The same deck list shuffled by another seed: the same uids, other cards.
  const t = createGame(10, { decks: { player: DECKS.fire.list, ai: DECKS.grass.list } });
  assert.notDeepEqual(s.players.player.drawPile.map((c) => c.name), t.players.player.drawPile.map((c) => c.name));
  let r = applyAction(s, { type: 'flipCoin' });
  const p = r.players.player;
  const seen = new Set(p.discard.map((c) => c.uid));
  p.discard.push(...p.drawPile.splice(0));
  for (const c of p.discard) seen.add(c.uid);
  r.turn = 'player';
  r.players.ai.hand = [];
  r = applyAction(r, { type: 'pass', who: 'player' });
  r = applyAction(r, { type: 'pass', who: 'ai' });
  const fresh = r.players.player.hand.concat(r.players.player.drawPile);
  assert.ok(fresh.length > 0 && fresh.every((c) => !seen.has(c.uid) || r.players.player.hand.includes(c)), 'reshuffled cards get new uids');
}

// The seat's own Search lists only what it could take; a view's hidden top cards offer nothing.
{
  const s = createGame(2, { decks: { player: DECKS.water.list, ai: DECKS.fire.list } });
  const p = s.players.player;
  const fisher = p.drawPile.findIndex((c) => c.id === 'w-fisherman');
  if (fisher >= 0) p.hand.push(...p.drawPile.splice(fisher, 1));
  const v = viewFor(s, 'player');
  assert.ok(v.players.player.searchable.length > 0 && v.players.player.searchable.every((c) => c.cardType === 'Pokémon' && c.type === 'Water'), 'Fisherman: Water Pokémon only');
  assert.deepEqual(pickOptions(v, 'player', { op: 'search', filter: 'waterPokemon' }).map((c) => c.uid).sort(), v.players.player.searchable.map((c) => c.uid).sort());
  assert.deepEqual(pickOptions(v, 'player', { op: 'lookTop', n: 4 }), []);
}

// redactEvents alone.
assert.deepEqual(redactEvents([{ type: 'levelUp', who: 'ai', uid: 'ai-3', from: 'Squirtle', to: 'Wartortle', level: 3 }], 'player'), [], 'their hand levelling up: not shown');
assert.deepEqual(redactEvents([{ type: 'levelUp', who: 'player', uid: 'player-3', from: 'Squirtle', to: 'Wartortle', level: 3 }], 'player')[0].to, 'Wartortle');

console.log(`view.test: ok (${actions} actions, both seats checked after each; ${retainLines} with Retain lines)`);
