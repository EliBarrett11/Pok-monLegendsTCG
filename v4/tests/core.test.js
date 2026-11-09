// v4 F1 (the core): focused rule tests, no match simulations. Run: node v4/tests/core.test.js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, levelFor, costFor, SERIES_RANGE } from '../src/rules.js';
import {
  createGame, applyAction, legalTargets, isReady, readySpaces, passSpends, gainRecognition, whyNot,
} from '../src/engine/game.js';
import { pokemonAt, cardAtRound, PATHS, DEMO_DECK } from '../src/engine/cards.js';
import { payCost, refreshEnergy, newEnergy, availableExert, canPay } from '../src/engine/energy.js';

const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `t-${id}-${level}-${Math.random()}`, currentStrength: c.strength, spent: false, ...extra }; };
const battle = (seed = 1) => {
  let s = createGame(seed);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  return applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
};
const pass = (s) => applyAction(s, { type: 'pass', who: s.turn });
const nextRound = (s) => { const r = s.round; while (s.round === r && s.phase !== 'gameOver') s = pass(s); return s; };
const clear = (s) => { for (const w of ['player', 'ai']) s.players[w].row = s.players[w].row.map(() => null); };

// --- Setup: v4 stands alone -----------------------------------------------------------------------------
{
  const V4 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : [p]; });
  for (const f of files(join(V4, 'src')).filter((x) => x.endsWith('.js'))) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/from '([^']+)'/g)) {
      const target = resolve(dirname(f), m[1].replace(/\?v=.*$/, ''));
      assert.ok(target.startsWith(V4) && existsSync(target), `${f}: imports only from v4 (${m[1]})`);
    }
    if (/\/(engine|ai)\/|rules\.js$/.test(f)) assert.ok(!/document\.|window\./.test(text), `${f}: no DOM code`);
  }
  for (const p of PATHS) for (const f of p.forms) assert.ok(existsSync(join(V4, '..', 'assets/cards', `${f.art}.jpg`)), `${f.name}: art`);
  const s = createGame(2);
  assert.equal(s.players.player.row.length, 9, '9 lanes');
  assert.deepEqual(s.players.player.drawPile.map((c) => c.id).sort().concat(s.players.player.hand.map((c) => c.id)).sort(), [...DEMO_DECK].sort(), 'the demo deck');
  assert.deepEqual([...DEMO_DECK].sort(), s.players.ai.drawPile.concat(s.players.ai.hand).map((c) => c.id).sort(), 'both players use the same list');
  assert.equal(s.players.player.hand.length, RULES.handDraw, 'Round 1: draw 7');
  // The demo deck: Light, Mid and Heavy, a Defence and a Special Defence guard.
  const lines = new Set(DEMO_DECK.map((id) => PATHS.find((p) => p.id === id)).filter(Boolean));
  for (const series of ['Light', 'Mid', 'Heavy']) assert.ok([...lines].some((p) => p.series === series), series);
  assert.ok([...lines].some((p) => p.guard === 'Defence') && [...lines].some((p) => p.guard === 'Special Defence'), 'a guard of each kind');
  // Mulligan (v1): the chosen cards go to the Discard Pile; as many are drawn.
  const back = s.players.player.hand.slice(0, 3).map((c) => c.uid);
  const m = applyAction(s, { type: 'mulligan', who: 'player', cards: back });
  assert.equal(m.players.player.hand.length, 7);
  assert.deepEqual(m.players.player.discard.map((c) => c.uid), back);
}

// --- Development levels and snapshots -----------------------------------------------------------------------
{
  assert.deepEqual(SERIES_RANGE, { Light: [1, 6], Mid: [2, 7], Heavy: [3, 8] });
  assert.equal(levelFor('Light', 1), 1);
  assert.equal(levelFor('Mid', 1), 2);
  assert.equal(levelFor('Heavy', 1), 3);
  assert.equal(levelFor('Heavy', 4), 6, '+1 Level per Round');
  assert.equal(levelFor('Light', 9), 6, 'up to the series maximum');
  assert.equal(levelFor('Heavy', 12), 8);
  // Form, stats and cost by Level; Mid costs about half the Round's Base Energy.
  assert.equal(pokemonAt('squirtle', 3).name, 'Squirtle');
  assert.equal(pokemonAt('squirtle', 5).name, 'Wartortle');
  assert.equal(pokemonAt('squirtle', 7).name, 'Blastoise');
  assert.equal(pokemonAt('charmander', 7).speed, 'Swift', 'Charizard is Swift');
  for (let r = 1; r <= 6; r++) {
    const c = cardAtRound('growlithe', r);
    assert.ok(Math.abs(c.cost - Math.min(r, 10) / 2) <= 0.5, `Round ${r}: a Mid Pokémon costs about half the Base Energy (${c.cost} of ${r})`);
  }
  assert.ok(costFor(8) > costFor(3), 'cost rises with Level');
  // Cards in hand and deck gain +1 Level each Round; the battlefield keeps a snapshot.
  let s = battle(3);
  const card = { ...cardAtRound('squirtle', 1), uid: 'snap' };
  s.players.player.hand.push(card);
  s.turn = 'player';
  s.players.player.baseEnergy = 5;
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'snap', space: 4 });
  const onBoard = s.players.player.row[4];
  assert.equal(onBoard.level, 2);
  assert.ok(onBoard.spent, 'it arrives Spent');
  const inDeck = s.players.player.drawPile[0];
  const before = inDeck.level;
  s = nextRound(s);
  s = nextRound(s);
  assert.equal(s.players.player.row[4].level, 2, 'the summoned Pokémon is a snapshot: it does not develop');
  assert.equal(s.players.player.row[4].name, 'Squirtle');
  const later = [...s.players.player.hand, ...s.players.player.drawPile, ...s.players.player.discard].find((c) => c.uid === inDeck.uid);
  assert.equal(later.level, Math.min(before + 2, SERIES_RANGE[later.series][1]), 'cards off the battlefield gained a Level each Round');
}

// --- Retain and the draw reduction ----------------------------------------------------------------------------
{
  let s = battle(4);
  s.turn = 'player';
  s.players.player.baseEnergy = 3;
  const [a, b] = s.players.player.hand;
  s = applyAction(s, { type: 'retain', who: 'player', uid: a.uid });
  assert.equal(s.players.player.baseEnergy, 2, 'Retain costs 1 Energy');
  assert.equal(s.turn, 'ai', 'it is an action');
  assert.throws(() => applyAction({ ...s, turn: 'player' }, { type: 'retain', who: 'player', uid: a.uid }), /isn't Retained/);
  s.turn = 'player';
  s = applyAction(s, { type: 'retain', who: 'player', uid: b.uid });
  s = nextRound(s);
  const hand = s.players.player.hand;
  assert.ok(hand.some((c) => c.uid === a.uid) && hand.some((c) => c.uid === b.uid), 'Retained cards stay in hand through Supper');
  assert.equal(hand.length, 2 + RULES.handDraw - 2, 'two Retained: two fewer drawn');
  assert.ok(hand.every((c) => !c.retained), 'Retain lasts one Supper');
  assert.equal(s.players.ai.hand.length, RULES.handDraw, 'the rest of a hand is discarded at Supper');
  assert.equal(whyNot({ ...s, turn: 'player', players: { ...s.players, player: { ...s.players.player, baseEnergy: 0, exertMax: 0, exhaust: [] } } }, 'player', 'retain', hand[0]), 'Needs 1 Energy · you have 0');
}

// --- Energy: Base Energy, Pass, Exert and Exhaust (v1) ----------------------------------------------------------
{
  const p = newEnergy();
  refreshEnergy(p, 2);
  assert.equal(p.baseEnergy, 2);
  assert.equal(p.exertMax, 2, 'Exert maximum = the Round, up to 3');
  assert.ok(canPay(p, 4) && !canPay(p, 5));
  const paid = payCost(p, 3, 2);
  assert.deepEqual(paid, { fromBase: 2, fromExert: 1 }, 'Base Energy first; Exert covers the shortfall');
  assert.deepEqual(p.exhaust.map((x) => [x.position, x.recoversRound]), [[1, 4]], 'position 1 recovers 2 Rounds later');
  refreshEnergy(p, 3);
  payCost(p, 5, 3);
  assert.deepEqual(p.exhaust.map((x) => [x.position, x.recoversRound]), [[1, 4], [2, 6], [3, 7]], 'positions 2 and 3: 3 and 4 Rounds later');
  assert.equal(availableExert(p), 0);
  refreshEnergy(p, 4);
  assert.equal(availableExert(p), 1, 'position 1 recovered at Breakfast of Round 4');
  assert.equal(p.baseEnergy, 4);
  refreshEnergy(p, 14);
  assert.equal(p.baseEnergy, 10, 'Base Energy max 10');
  // Pass: +1 Base Energy, except the Pass that ends the Battle Phase.
  let s = battle(5);
  const first = s.turn;
  const e0 = s.players[first].baseEnergy;
  s = pass(s);
  assert.equal(s.players[first].baseEnergy, e0 + 1);
  const second = s.turn;
  const e1 = s.players[second].baseEnergy;
  const ended = pass(s);
  assert.equal(ended.round, 2, 'two Passes in a row end the Battle Phase');
  assert.ok(ended.events.some((e) => e.type === 'pass' && e.who === second && e.endsPhase));
  void e1;
}

// --- Speed and Ready, Attack, trading, guards ------------------------------------------------------------------
{
  const s = battle(6);
  s.turn = 'player';
  clear(s);
  s.players.player.row[0] = mon('ponyta', 3);           // Swift, Physical
  s.players.player.row[1] = mon('magikarp', 3);         // Steady
  s.players.ai.row[0] = mon('chinchou', 3);             // Steady, Special Defence guard
  assert.deepEqual(readySpaces(s, 'player'), [0], 'only the highest Speed among all Active Pokémon is Ready');
  assert.ok(!isReady(s, s.players.ai.row[0]));
  s.players.player.row[0].spent = true;
  assert.deepEqual(readySpaces(s, 'player'), [1], 'with the Swift one Spent, Steady is the top');
  s.players.player.row[0].spent = false;
  // Guards (section 16): a Defence guard protects its other Pokémon in the same Location from
  // Physical attacks, and its Player Character from Physical attackers in its Location.
  s.players.ai.row[3] = mon('squirtle', 3);             // Defence guard
  s.players.ai.row[5] = mon('growlithe', 3);
  let t = legalTargets(s, 'player', 0);
  assert.deepEqual(t.map((x) => x.space ?? 'player').sort(), [3], 'a Physical attack must target the Defence guard; the player is guarded too');
  s.players.player.row[0] = mon('chinchou', 3);         // Special attacker
  s.players.player.row[1] = null;
  s.players.ai.row[0] = null;
  t = legalTargets(s, 'player', 0);
  assert.deepEqual(t.map((x) => x.space ?? 'player'), [3, 5, 'player'], 'a Defence guard doesn\'t stop a Special attacker');
  s.players.ai.row[0] = mon('chinchou', 2);             // Special Defence guard
  t = legalTargets(s, 'player', 0);
  assert.deepEqual(t.map((x) => x.space ?? 'player'), [0], 'a Special Defence guard stops a Special attacker');
  // Attack and trading: a Ready target hits back; both become Spent; defeats go to Released.
  const a = battle(7);
  a.turn = 'player';
  clear(a);
  a.players.player.row[2] = mon('growlithe', 5);        // Arcanine 5/6, Swift
  a.players.ai.row[6] = mon('ponyta', 2);               // 3/3 Swift: Ready, hits back
  const r0 = a.players.player.recognition;
  const after = applyAction(a, { type: 'attack', who: 'player', from: 2, target: { kind: 'pokemon', space: 6 } });
  assert.equal(after.players.player.row[2].currentStrength, 6 - 3, 'the Ready target hit back');
  assert.ok(after.players.player.row[2].spent);
  assert.equal(after.players.ai.row[6], null);
  assert.equal(after.players.ai.released.at(-1).name, 'Ponyta', 'defeated Pokémon go to the Released Pile');
  assert.equal(after.players.player.recognition, r0 + RULES.perDefeat, 'Recognition for defeating a Pokémon');
  // The unmatched-Speed Pass rule.
  const u = battle(8);
  u.turn = 'player';
  clear(u);
  u.players.player.row[0] = mon('ponyta', 2);
  u.players.ai.row[0] = mon('magikarp', 3);
  assert.deepEqual(passSpends(u, 'player'), [0]);
  assert.ok(applyAction(u, { type: 'pass', who: 'player' }).players.player.row[0].spent);
  // Unavailable actions say why.
  const w = battle(9);
  w.turn = 'player';
  clear(w);
  assert.equal(whyNot(w, 'player', 'attack'), 'No Pokémon in play');
}

// --- Recognition sources and winning at 100 ---------------------------------------------------------------------
{
  const s = battle(10);
  s.turn = 'player';
  clear(s);
  s.players.player.row[4] = mon('growlithe', 4);        // 4 Attack
  const r0 = s.players.player.recognition;
  const hit = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'player' } });
  assert.equal(hit.players.player.recognition, r0 + 4 * RULES.perDamageToPlayer, '1 Recognition per damage to the enemy Player Character');
  assert.equal(hit.players.ai.recognition, s.players.ai.recognition, 'the Player Character has no Health to lose');
  const win = structuredClone(s);
  win.players.player.recognition = 97;
  const champ = applyAction(win, { type: 'attack', who: 'player', from: 4, target: { kind: 'player' } });
  assert.equal(champ.phase, 'gameOver');
  assert.equal(champ.winner, 'player', '100 Recognition wins');
  const g = battle(11);
  gainRecognition(g, 'ai', 99, 'test');
  assert.equal(g.phase, 'battle');
  gainRecognition(g, 'ai', 1, 'test');
  assert.equal(g.winner, 'ai', 'exactly 100');
}

console.log('v4 core: setup, development and snapshots, Retain, Energy and Exert, Ready, guards, Recognition, winning — ok');
