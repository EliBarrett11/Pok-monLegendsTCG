// V9 — playing a friend online in v2 (Node, the in-memory fake transport): a full seeded
// match host vs guest reaches a winner; the guest never receives hidden information; illegal
// guest actions are rejected; reconnect, host resume and rematch all work; a v2 room and a
// current-game room never play each other.
// Run with: node v2/tests/online.test.js
import assert from 'node:assert/strict';
import { HostSession, GuestSession, linkPair, DECK_IDS } from '../src/net/session.js';
import { HOST_SEAT, GUEST_SEAT, PROTOCOL, decode, peerId, encode } from '../src/net/protocol.js';
import { actor, legalActions, PLAYERS } from '../src/engine/game.js';
import { viewFor } from '../src/engine/view.js';
import { chooseAction } from '../src/ai/opponent.js';
import { GuestSession as V1Guest } from '../../src/net/session.js';
import { peerId as v1PeerId, PROTOCOL as V1_PROTOCOL } from '../../src/net/protocol.js';

const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => { setTimeout(r, 0); }); };
const BUILD = 'v2-test';

// Every view the guest is sent: nothing hidden from the guest's seat.
function checkGuestView(view, host) {
  assert.equal(view.viewer, GUEST_SEAT);
  assert.ok(!('seed' in view) && !('rng' in view), 'no random-number state');
  const h = view.players[HOST_SEAT];
  assert.ok(h.hand.every((c) => c.hidden && Object.keys(c).every((k) => k === 'uid' || k === 'hidden')), "the host's hand is hidden");
  for (const w of PLAYERS) assert.ok(view.players[w].drawPile.every((c) => c.hidden && Object.keys(c).length === 1), 'Draw Piles hidden');
  assert.ok(view.itemPool.every((c) => c.hidden && Object.keys(c).length === 1), 'Item pool hidden');
  assert.ok(!('searchable' in h), "no view of the host's Search");
  if (view.assign?.[HOST_SEAT]) assert.deepEqual(view.assign[HOST_SEAT], { locked: true }, "the host's assignment hidden until both lock in");
  const text = JSON.stringify(view);
  assert.ok(!text.includes('⟨'), 'every seat token rendered');
  // Nothing anywhere names a card in the host's hand or either Draw Pile.
  if (host?.state) {
    const secret = new Set([...host.state.players[HOST_SEAT].hand.map((c) => c.uid), ...PLAYERS.flatMap((w) => host.state.players[w].drawPile.map((c) => c.uid))]);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (!Array.isArray(node) && secret.has(node.uid) && node.name !== undefined) assert.fail(`a secret card is shown: ${JSON.stringify(node)}`);
      Object.values(node).forEach(walk);
    };
    walk({ ...view, players: { ...view.players, [GUEST_SEAT]: { ...view.players[GUEST_SEAT], searchable: [] } } });
  }
}
// Watch everything sent to the guest.
function spy(link, host) {
  const listen = link.listen.bind(link);
  link.listen = (handler) => listen((text) => {
    const m = decode(text);
    if (m?.view) checkGuestView(m.view, host());
    if (m?.t === 'sync' && m.phase === 'match') checkGuestView(m.view, host());
    handler(text);
  });
  return link;
}

function pair(hostRef) {
  const [a, b] = linkPair();
  return [a, spy(b, hostRef)];
}

// Plays the match on, choosing for whichever seat must act (the guest's choices sent as the guest).
async function playOn(host, guest, rng, { until = () => false, max = 4000 } = {}) {
  let steps = 0;
  for (; steps < max && host.state.phase !== 'gameOver' && !until(host.state); steps++) {
    const s = host.state;
    const who = s.choices?.length ? actor(s) : s.phase === 'assign' ? (legalActions(s, GUEST_SEAT).length ? GUEST_SEAT : HOST_SEAT) : s.turn;
    const action = chooseAction(s, who, { rng });
    if (who === HOST_SEAT) host.act(action);
    else {
      const seq = host.seq;
      guest.act(action);
      await flush();
      assert.ok(host.seq > seq, `the guest's ${action.type} was taken`);
    }
    await flush(2);
  }
  return steps;
}
const seeded = (seed) => { let k = seed; return () => { k = (k * 9301 + 49297) % 233280; return k / 233280; }; };

// --- A full match, then a rematch --------------------------------------------------------

let host;
const events = { host: [], guest: [] };
const [hl, gl] = pair(() => host);
host = new HostSession(hl, { build: BUILD, seed: 11, listener: { start: () => events.host.push('start'), again: () => events.host.push('again'), rematchAsked: () => events.host.push('asked') } });
const guest = new GuestSession(gl, { build: BUILD, listener: { start: () => events.guest.push('start'), rejected: (m) => events.guest.push(`rejected: ${m}`), again: () => events.guest.push('again'), full: () => events.guest.push('full') } });
await flush();
assert.deepEqual([host.status, guest.status], ['ready', 'ready'], 'connected');
assert.deepEqual(DECK_IDS, ['fire', 'water', 'grass']);

// Decks in secret: the host learns only that the guest has chosen; mirrors allowed.
guest.chooseDeck('grass');
await flush();
assert.equal(host.guestDeck, 'grass');
assert.equal(guest.friendLocked, false);
host.chooseDeck('grass');
await flush();
assert.deepEqual(events.guest, ['start']);
assert.ok(guest.view && guest.view.phase === 'battle', 'the coin is flipped and the match on');
assert.deepEqual(guest.view.decks, { player: 'grass', ai: 'grass' }, 'a mirror, revealed once both locked in');

// An illegal action from the guest is rejected and changes nothing.
{
  const seq = host.seq;
  const before = JSON.stringify(host.state);
  guest.act({ type: 'attack', from: 0, target: { kind: 'player' } });
  guest.act({ type: 'nonsense' });
  guest.act(null);
  // Acting for the host's seat: the host applies it as the guest (it isn't theirs to take).
  guest.act({ type: 'pass', who: HOST_SEAT });
  await flush();
  const rejected = events.guest.filter((x) => x.startsWith('rejected'));
  assert.ok(rejected.length >= 3, `rejected: ${rejected.join(' | ')}`);
  if (host.seq === seq) assert.equal(JSON.stringify(host.state), before, 'nothing changed');
  else assert.ok(host.state.events.every((e) => e.who !== HOST_SEAT || e.type !== 'pass'), 'a seat only ever acts for itself');
}

const rng = seeded(31);
await playOn(host, guest, rng, { until: (s) => s.round >= 4 });

// --- Reconnect: the guest's link drops mid-match; it comes back with its token ---------------

{
  hl.drop();
  await flush();
  assert.equal(guest.status, 'connecting');
  // The match carries on for the host while the guest is away (if it's the host's move).
  const [a2, b2] = pair(() => host);
  host.offer(a2);
  guest.attach(b2);
  await flush();
  assert.equal(guest.status, 'ready', 'reconnected');
  assert.deepEqual(guest.view.players.ai.hand.map((c) => c.uid), viewFor(host.state, GUEST_SEAT).players.ai.hand.map((c) => c.uid), 'back where the match is');
  // Someone else with the invite link: the room is full.
  const [a3, b3] = linkPair();
  const stranger = new GuestSession(null, { build: BUILD, listener: { full: () => events.guest.push('stranger full') } });
  host.offer(a3);
  stranger.attach(b3);
  await flush();
  assert.ok(events.guest.includes('stranger full'), 'a third browser gets "full"');
}
await playOn(host, guest, rng, { until: (s) => s.round >= 6 });

// --- Host resume: the host's browser refreshes; the saved match carries on ----------------------

{
  const saved = JSON.parse(JSON.stringify(host.save()));
  host.close();
  const resumed = HostSession.restore(saved, { build: BUILD, listener: {} });
  assert.ok(resumed && resumed.state.round === saved.state.round, 'restored');
  assert.equal(HostSession.restore(saved, { build: 'another build' }), null, 'a different build can\'t resume it');
  host = resumed;
  const [a4, b4] = pair(() => host);
  host.offer(a4);
  guest.attach(b4);
  await flush();
  assert.equal(guest.status, 'ready');
  assert.equal(guest.seq, host.seq, 'the guest is in step with the resumed host');
}
await playOn(host, guest, rng);
assert.equal(host.state.phase, 'gameOver', 'the match reached its end');
await flush();
assert.equal(guest.view.phase, 'gameOver');
assert.ok(['player', 'ai', null].includes(guest.view.winner) && guest.view.winner === host.state.winner, `a winner: ${host.state.winner}`);

// --- Rematch: both must accept; then decks again and a new coin flip ------------------------

{
  const seed = host.seed;
  guest.requestRematch();
  await flush();
  assert.equal(host.friendRematch, true);
  assert.equal(host.state.phase, 'gameOver', 'not until both accept');
  host.requestRematch();
  await flush();
  assert.equal(host.state, null, 'back to choosing decks');
  assert.equal(guest.view, null);
  assert.notEqual(host.seed, seed, 'a new seed: a new coin flip');
  guest.chooseDeck('fire');
  host.chooseDeck('water');
  await flush();
  assert.ok(guest.view?.phase === 'battle' && guest.view.decks.ai === 'fire');
  await playOn(host, guest, seeded(5), { until: (s) => s.round >= 3 });
  // Leave: the other side is told, and that's the end.
  let left = false;
  guest.on.left = () => { left = true; };
  host.leave();
  await flush(10);
  assert.ok(left && guest.ended, 'Leave match ends it for both');
}

// --- v2 and the current game never play each other -----------------------------------------

{
  assert.notEqual(PROTOCOL, V1_PROTOCOL);
  assert.notEqual(peerId('HMQXT'), v1PeerId('HMQXT'), 'different room ids for the same code');
  assert.ok(peerId('HMQXT').startsWith('pokemon-legends-v2-'));
  // A current-game guest reaching a v2 host (or the reverse) is a version mismatch on both sides.
  const [a, b] = linkPair();
  const v2host = new HostSession(a, { build: BUILD, seed: 1 });
  const v1guest = new V1Guest(b, { build: BUILD });
  await flush();
  assert.deepEqual([v2host.status, v1guest.status], ['mismatch', 'mismatch']);
  v1guest.chooseDeck('fire');
  await flush();
  assert.equal(v2host.state, null, 'no match starts');
  assert.equal(decode(encode('hello', { build: 'x' })).p, PROTOCOL);
  assert.equal(decode(JSON.stringify({ p: 1, t: 'hello', build: 'x' })).otherProtocol, 1);
}

console.log('online.test: ok (a full match host vs guest, reconnect, resume, rematch, leave; the guest saw nothing hidden)');
