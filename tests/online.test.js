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
  assert.equal(host.status, 'ready', 'connected');
  assert.equal(guest.status, 'ready');

  // Decks: chosen in secret. The host locks first; the guest learns only that it has.
  host.chooseDeck('fire');
  await flush();
  assert.deepEqual(log.guest, ['status:ready', 'friendLocked']);
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

  // A rematch: both must accept. Then both choose decks again and a new coin flip decides initiative.
  const firstSeed = host.seed;
  let asked = 0;
  host.on.rematchAsked = () => { asked += 1; };
  guest.requestRematch();
  await flush();
  assert.equal(asked, 1, 'the host sees that the guest wants a rematch');
  assert.equal(host.state.phase, 'gameOver', 'not until both accept');
  host.requestRematch();
  await flush();
  assert.equal(host.state, null, 'both accepted: back to choosing decks');
  assert.equal(guest.view, null);
  assert.notEqual(host.seed, firstSeed, 'a new seed, so a new shuffle and coin flip');
  host.chooseDeck('water');
  guest.chooseDeck('fire');
  await flush();
  assert.deepEqual([host.state.players.player.deck, host.state.players.ai.deck], ['water', 'fire'], 'new decks');
  host.act({ type: 'assignTrainers', order: host.state.players.player.trainers.map((t) => t.uid) });
  guest.act({ type: 'assignTrainers', order: guest.view.players.ai.trainers.map((t) => t.uid) });
  await flush();
  assert.equal(host.state.phase, 'breakfast');
  assert.ok(host.state.initiative, 'a new coin flip decided initiative');
  assert.ok(log.guestViews.at(-1).view.events.some((e) => e.type === 'coinFlip') || guest.view.log.some((l) => l.startsWith('Coin flip')), 'the guest saw the coin flip');
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
  assert.equal(guest.status, 'ready', "the host answered the guest's hello");
  assert.equal(host.status, 'ready');
}

// --- Multiplayer M3: reconnecting, saving the host, leaving --------------------------------------------------

// Plays on with the AI choosing for both (the guest's moves go over its link) until `until` says stop.
async function playOn(host, guest, rng, until = () => false) {
  for (let guard = 0; guard < 5000 && host.state.phase !== 'gameOver' && !until(); guard++) {
    const s = host.state;
    const who = PLAYERS.find((w) => legalActions(s, w).length);
    const action = chooseAction(s, who, { rng });
    if (who === 'ai') guest.act(action);
    else host.act(action);
    await flush();
    assert.ok(host.state !== s, `${who}'s action was applied`);
  }
}
const seeded = (seed) => { let n = seed; return () => { n = (n * 9301 + 49297) % 233280; return n / 233280; }; };
async function begin(seed, token = 'tok-1') {
  const [hostLink, guestLink] = linkPair();
  const events = { gone: 0, back: 0, left: 0, syncs: [] };
  const host = new HostSession(hostLink, { build: 'B', seed, listener: { friendGone: () => { events.gone += 1; }, back: () => { events.back += 1; }, left: () => { events.left += 1; } } });
  const guest = new GuestSession(guestLink, { build: 'B', token, listener: { sync: (info) => events.syncs.push(info), left: () => { events.left += 1; } } });
  await flush();
  host.chooseDeck('fire');
  guest.chooseDeck('water');
  await flush();
  return { host, guest, hostLink, guestLink, events };
}

// The guest drops mid-match (or refreshes) and comes back with its token: the same view, and play goes on to the end.
{
  const { host, guestLink, events, guest: first } = await begin(41);
  const rng = seeded(41);
  await playOn(host, first, rng, () => host.state.round === 2 && host.state.phase === 'battle');
  assert.equal(host.state.round, 2);
  guestLink.drop();
  assert.equal(events.gone, 1, 'the host sees the guest go');
  assert.equal(host.link, null, 'and keeps the match');
  // The host stays usable: while it's the host's move, it can play on.
  let hostMoves = 0;
  while (PLAYERS.find((w) => legalActions(host.state, w).length) === 'player' && host.state.phase === 'battle') {
    host.act(chooseAction(host.state, 'player', { rng }));
    hostMoves += 1;
  }
  // The guest refreshes: a new session, the same token (kept in its browser), a new link.
  const [h2, g2] = linkPair();
  const guest = new GuestSession(null, { build: 'B', token: 'tok-1', listener: { sync: (info) => events.syncs.push(info) } });
  host.offer(h2);
  guest.attach(g2);
  await flush();
  assert.equal(events.back, 1, 'the host sees the guest come back');
  assert.equal(events.syncs.at(-1).phase, 'match');
  assert.deepEqual(guest.view, viewFor(host.state, 'ai'), 'the guest has the current view');
  assert.equal(guest.seq, host.seq);
  // Play continues to the end; the guest's view keeps up.
  await playOn(host, guest, rng);
  assert.equal(host.state.phase, 'gameOver');
  assert.deepEqual(guest.view, viewFor(host.state, 'ai'));
  console.log(`Guest reconnect: dropped in Round 2 (the host played ${hostMoves} more), back, played on to Round ${host.state.round}.`);
}

// Messages arriving on a link after it dropped are ignored safely.
{
  const { host, guest, hostLink, guestLink } = await begin(43);
  const seq = host.seq;
  guestLink.drop();
  hostLink.inject(encode('action', { id: 99, action: { type: 'assignTrainers', order: host.state.players.ai.trainers.map((t) => t.uid) } }));
  hostLink.inject('not even json');
  assert.equal(host.seq, seq, 'a late guest action changes nothing');
  guestLink.inject(encode('update', { seq: guest.seq + 1, who: 'player', view: { junk: true }, logFrom: 0, log: [] }));
  guestLink.inject(encode('leave'));
  assert.notDeepEqual(guest.view, { junk: true, log: [] }, 'a late host update is ignored');
  assert.equal(guest.ended, false, 'a late leave is ignored');
  assert.equal(guest.act({ type: 'pass' }), null, 'no actions while disconnected');
}

// Only the guest who joined can come back: anyone else gets "the room is full".
{
  const { host, guest } = await begin(44);
  const [h2, g2] = linkPair();
  let full = 0;
  const stranger = new GuestSession(null, { build: 'B', token: 'someone-else', listener: { full: () => { full += 1; } } });
  host.offer(h2);
  stranger.attach(g2);
  await flush();
  await new Promise((resolve) => { setTimeout(resolve, 250); });
  assert.equal(full, 1, 'turned away');
  assert.equal(stranger.view, null, 'and shown nothing');
  assert.equal(host.status, 'ready');
  guest.act({ type: 'assignTrainers', order: guest.view.players.ai.trainers.map((t) => t.uid) });
  await flush();
  assert.ok(host.state.players.ai.pending, 'the real guest is still connected and playing');
}

// The host's session is saved after an action and restored after a refresh: an identical state, and play goes on
// exactly as it would have without the refresh.
{
  const reference = await begin(45);
  await playOn(reference.host, reference.guest, seeded(45));
  const finalRef = JSON.stringify(reference.host.state);

  const { host, guest, guestLink } = await begin(45);
  const rng = seeded(45);
  await playOn(host, guest, rng, () => host.state.round === 3);
  const saved = JSON.parse(JSON.stringify(host.save()));   // through localStorage: JSON
  assert.equal(JSON.stringify(saved.state), JSON.stringify(host.state));
  host.close();          // the host's page goes away
  guestLink.drop();
  assert.equal(HostSession.restore(saved, { build: 'other' }), null, 'a save from another version is not resumed');
  const restored = HostSession.restore(saved, { build: 'B' });
  assert.equal(JSON.stringify(restored.state), JSON.stringify(host.state), 'restored: an identical state');
  assert.equal(restored.seq, host.seq);
  // The guest reconnects to the restored host (same room code, same token).
  const [h2, g2] = linkPair();
  restored.offer(h2);
  guest.attach(g2);
  await flush();
  assert.deepEqual(guest.view, viewFor(restored.state, 'ai'));
  await playOn(restored, guest, rng);
  assert.equal(JSON.stringify(restored.state), finalRef, 'the match ends exactly as it would have without the refresh');
}

// Leave match: the other player is told, and nothing more happens.
{
  const { host, guest, events } = await begin(46);
  guest.leave();
  await flush();
  assert.equal(events.left, 1, 'the host is told the guest left');
  assert.ok(host.ended && guest.ended);
  assert.throws(() => host.act({ type: 'assignTrainers', order: host.state.players.player.trainers.map((t) => t.uid) }), /ended/);
  const again = await begin(47);
  again.host.leave();
  await flush();
  assert.equal(again.events.left, 1, 'the guest is told the host left');
}

console.log('All online tests passed.');
