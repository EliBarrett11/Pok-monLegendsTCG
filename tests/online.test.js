// Checks playing a friend online (Multiplayer M2; rules section 10) without a
// network: a host session and a guest session joined by an in-memory link
// play a whole seeded match. The host runs the real game and checks every
// action; the guest only ever receives its own view and redacted events.
// Run with: node tests/online.test.js
import assert from 'node:assert/strict';
import { legalActions, PLAYERS } from '../src/engine/game.js';
import { viewFor } from '../src/engine/view.js';
import { chooseAction } from '../src/ai/opponent.js';
import { HostSession, GuestSession, linkPair } from '../src/net/session.js';
import { roomCode, normalizeCode, peerId, inviteLink, decode, encode, CODE_LETTERS, PROTOCOL } from '../src/net/protocol.js';
import { iceServers, STUN_SERVERS } from '../src/net/ice.js';

const withUid = (node, uid, out = []) => {
  if (node && typeof node === 'object') {
    if (node.uid === uid) out.push(node);
    for (const v of Object.values(node)) withUid(v, uid, out);
  }
  return out;
};
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

// --- Room codes, links, messages, ICE ---------------------------------------------------------

{
  let n = 0;
  const codes = Array.from({ length: 200 }, () => roomCode(() => ((n = (n * 9301 + 49297) % 233280) / 233280)));
  assert.ok(codes.every((c) => /^[A-Z]{5}$/.test(c) && ![...c].some((ch) => 'ILOUVBSZ01'.includes(ch))), 'no look-alike characters');
  assert.ok(![...CODE_LETTERS].some((ch) => 'AEIOUCFK'.includes(ch)), 'no vowels (or C, F, K): codes never spell words');
  assert.ok(new Set(codes).size > 190, 'codes vary');
  assert.equal(normalizeCode(' hmq-xt '), 'HMQXT', 'typed codes are forgiving');
  assert.equal(normalizeCode('HMQX'), null);
  assert.equal(normalizeCode('HMQXA'), null, 'not a code letter');
  assert.equal(peerId('HMQXT'), 'pokemon-legends-tcg-hmqxt');
  assert.equal(inviteLink('https://elibarrett11.github.io/Pok-monLegendsTCG/?seed=3#x', 'HMQXT'), 'https://elibarrett11.github.io/Pok-monLegendsTCG/?join=HMQXT');
  assert.deepEqual(decode(encode('deck', { deck: 'fire' })), { p: PROTOCOL, t: 'deck', deck: 'fire' });
  assert.equal(decode('not json'), null);
  assert.deepEqual(decode(JSON.stringify({ p: PROTOCOL + 1, t: 'hello', build: 'x' })), { t: 'hello', build: 'x', otherProtocol: PROTOCOL + 1 });
  assert.deepEqual(await iceServers(), STUN_SERVERS, 'no TURN key: STUN only');
  assert.ok(STUN_SERVERS.every((s) => s.urls.startsWith('stun:stun')));
}

// --- A whole match over the link ------------------------------------------------------------------

function connect({ hostBuild = 'B', guestBuild = 'B', seed = 31 } = {}) {
  const [hostLink, guestLink] = linkPair();
  const log = { host: [], guest: [], snapshots: [], guestViews: [] };
  const host = new HostSession(hostLink, {
    build: hostBuild, seed,
    listener: {
      status: (s) => log.host.push(`status:${s}`),
      friendLocked: () => log.host.push('friendLocked'),
      start: (state) => { log.snapshots[0] = state; },
      update: (prev, next) => { log.snapshots.push(next); },
    },
  });
  const guest = new GuestSession(guestLink, {
    build: guestBuild,
    listener: {
      status: (s) => log.guest.push(`status:${s}`),
      friendLocked: () => log.guest.push('friendLocked'),
      start: (view) => log.guestViews.push({ seq: 0, view }),
      update: (prev, next) => log.guestViews.push({ seq: guest.seq, prev, view: next }),
      rejected: (message) => log.guest.push(`rejected:${message}`),
    },
  });
  return { host, guest, hostLink, guestLink, log };
}

{
  const { host, guest, guestLink, log } = connect();
  await flush();
  assert.equal(host.status, 'decks', 'connected');
  assert.equal(guest.status, 'decks');

  // Decks: chosen in secret. The host locks first; the guest learns only that it has.
  host.chooseDeck('fire');
  await flush();
  assert.deepEqual(log.guest, ['status:decks', 'friendLocked']);
  assert.ok(!guestLink.received.join('').includes('fire'), "the host's deck is not sent before both have chosen");
  assert.equal(host.state, null);
  guest.chooseDeck('fire');   // a mirror match is fine
  await flush();
  assert.ok(host.state, 'both locked: the match starts');
  assert.deepEqual(log.guestViews[0].view.players.player.deck, 'fire', 'both picks revealed at the start');
  assert.equal(log.guestViews[0].view.phase, 'trainers');

  // An illegal action is rejected and changes nothing.
  const before = host.seq;
  guest.act({ type: 'pass' });
  await flush();
  assert.equal(host.seq, before, 'nothing changed');
  assert.match(log.guest.at(-1), /^rejected:ai cannot pass during trainers/);
  // The guest can't act for the host: an action is always taken for its own seat.
  guest.act({ type: 'assignTrainers', who: 'player', order: host.state.players.player.trainers.map((t) => t.uid) });
  await flush();
  assert.equal(host.seq, before);
  assert.match(log.guest.at(-1), /^rejected:Each zone needs a different one of your Trainers/);
  guest.act(null);
  await flush();
  assert.match(log.guest.at(-1), /^rejected:Not an action/);

  // Both sides choose with the AI: the host from the real game; the guest's
  // choice is made by this harness (the AI needs the full game to try moves)
  // and goes over the link like any guest action.
  let n = 31;
  const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  let guestActions = 0;
  for (let guard = 0; guard < 5000 && host.state.phase !== 'gameOver'; guard++) {
    const s = host.state;
    const who = PLAYERS.find((w) => legalActions(s, w).length);
    assert.ok(who, `someone can act (${s.phase})`);
    const action = chooseAction(s, who, { rng });
    if (who === 'ai') {
      guest.act(action);
      guestActions += 1;
      await flush();
      assert.ok(host.state !== s, 'the guest action was applied');
    } else host.act(action);
    await flush();
  }
  assert.equal(host.state.phase, 'gameOver', 'the match was played to the end');
  assert.ok(host.state.winner, 'it has a winner');
  assert.ok(guestActions > 20);

  // The guest's final view is exactly the guest's view of the real game.
  assert.deepEqual(guest.view, viewFor(host.state, 'ai'));
  assert.equal(guest.seq, host.seq);
  // After every action, from either player, the guest had exactly its view, and the events with it.
  assert.equal(log.guestViews.length, log.snapshots.length);
  for (const { seq, view } of log.guestViews) assert.deepEqual(view, viewFor(log.snapshots[seq], 'ai'), `seq ${seq}`);
  assert.ok(log.guestViews.some(({ view }) => view.events.some((e) => e.type === 'attack')), 'attacks were shown');

  // The guest never received hidden information: no RNG, no Draw Pile card, no card in the host's hand.
  const received = guestLink.received.map((t) => JSON.parse(t));
  let i = 0;
  for (const m of received) {
    const text = JSON.stringify(m);
    assert.ok(!/"(rng|seed|logSource)"/.test(text), 'no random-number state');
    if (m.t !== 'update') continue;
    i += 1;
    const real = log.snapshots[m.seq];
    for (const c of real.players.player.hand) {
      for (const o of withUid(m, c.uid)) assert.ok(!('name' in o) || o.type === 'returned', `the host's ${c.name} in hand is never named`);
    }
    for (const w of PLAYERS) for (const c of real.players[w].drawPile) assert.ok(!text.includes(`"${c.uid}"`) || (w === 'ai' && real.pending?.who === 'ai'), `Draw Pile card ${c.uid} never sent`);
  }
  assert.ok(i > 50);
  const sizes = guestLink.received.map((t) => t.length);
  console.log(`${host.seq} updates; largest message ${Math.round(Math.max(...sizes) / 1024)} KB, average ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024)} KB.`);
  assert.ok(Math.max(...sizes) < 200 * 1024, 'messages stay small');

  // After the match: both back to choosing decks, on the same connection.
  guest.again();
  await flush();
  assert.equal(host.state, null);
  assert.equal(guest.view, null);
  assert.equal(host.status, 'decks');
}

// --- A different version blocks the match ---------------------------------------------------------------

{
  const { host, guest, log } = connect({ hostBuild: 'Multiplayer M2', guestBuild: 'Step 24' });
  await flush();
  assert.equal(host.status, 'mismatch');
  assert.equal(guest.status, 'mismatch', 'both see it');
  host.chooseDeck('fire');
  guest.chooseDeck('water');
  await flush();
  assert.equal(host.state, null, 'the match does not start');
  assert.equal(log.guestViews.length, 0);
}
{
  // A different protocol version is a different version too.
  const [hostLink, guestLink] = linkPair();
  const host = new HostSession(hostLink, { build: 'B' });
  guestLink.listen(() => {});
  guestLink.send(JSON.stringify({ p: PROTOCOL + 1, t: 'hello', build: 'B' }));
  await flush();
  assert.equal(host.status, 'mismatch');
}

// --- A hello lost as the connection opens doesn't stall it ------------------------------------------------

{
  const [hostLink, guestLink] = linkPair();
  const send = hostLink.send.bind(hostLink);
  let dropped = 0;
  hostLink.send = (text) => (dropped++ ? send(text) : undefined);   // the host's first message never arrives
  const host = new HostSession(hostLink, { build: 'B' });
  await flush();
  const guest = new GuestSession(guestLink, { build: 'B' });
  await flush();
  assert.equal(guest.status, 'decks', "the host answered the guest's hello");
  assert.equal(host.status, 'decks');
}

console.log('All online tests passed.');
