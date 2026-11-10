// v4 UX3: result previews agree with the real results. attackPreview is checked on 200+ random legal
// attacks from AI-played matches (fixed seeds), covering Locations, Weather, Held Items and the
// Tournament; effectPreview on every Command mode, every Item and both Trainer Commands.
// Run: node v4/tests/ux3.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, actor, attackers, legalTargets, syncBonuses, locationAt, activeBrackets, damageOf, commandTargets, pokemonOf } from '../src/engine/game.js';
import { attackPreview, attackParts, effectPreview } from '../src/engine/preview.js';
import { chooseAction } from '../src/ai/ai.js';
import { pokemonAt, cardAtRound, COMMANDS, ITEMS, TRAINERS, MODES } from '../src/engine/cards.js';

let k = 12345;
const rnd = () => { k = (k * 1103515245 + 12345) % 2147483648; return k / 2147483648; };
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const resolve = (s) => (s.reactWindow ? applyAction(s, { type: 'decline', who: s.reactWindow.reactor }) : s);
const gainOf = (a, b, who) => ({ recognition: b.players[who].recognition - a.players[who].recognition, dollars: b.players[who].dollars - a.players[who].dollars });
const strengthNow = (s, who, space, uid) => (s.players[who].row[space]?.uid === uid ? s.players[who].row[space].currentStrength : s.players[who].released.find((c) => c.uid === uid)?.currentStrength);

// --- attackPreview against 200+ real attacks ---------------------------------------------------------------------------
{
  let checked = 0;
  const cover = { location: 0, weather: 0, held: 0, tournament: 0, hitBack: 0, player: 0, defeat: 0 };
  const charcoal = { ...cardAtRound('charcoal', 1), uid: 'held-test' };
  for (let m = 0; checked < 220 && m < 60; m++) {
    let s = createGame(1000 + m);
    for (let step = 0; step < 900 && s.phase !== 'gameOver' && checked < 220; step++) {
      const who = actor(s);
      if (!who) break;
      if (m % 3 === 2 && s.round >= 3 && !s.tournament && s.phase === 'battle' && !s.reactWindow) { s = structuredClone(s); s.tournament = { startedRound: s.round, reason: 'test' }; s.locations = []; syncBonuses(s); }
      const legal = legalActions(s, who);
      if (legal.includes('attack') && rnd() < 0.6) {
        s = structuredClone(s);
        const from = pick(attackers(s, who));
        // A Held Item on some attackers (through the engine's sync).
        if (m % 3 === 1 && !s.players[who].row[from].held && rnd() < 0.5) { s.players[who].row[from].held = structuredClone(charcoal); syncBonuses(s); }
        const target = pick(legalTargets(s, who, from));
        const foe = who === 'player' ? 'ai' : 'player';
        const a = s.players[who].row[from];
        const d = target.kind === 'pokemon' ? s.players[foe].row[target.space] : null;
        const pv = attackPreview(s, who, from, target);
        const after = resolve(applyAction(s, { type: 'attack', who, from, target }));
        const ev = [...(after.events ?? [])].concat([]).find((e) => e.type === 'attack');
        const evs = applyAction(s, { type: 'attack', who, from, target });
        const atk = [...evs.events, ...(evs.reactWindow ? resolve(evs).events : [])].find((e) => e.type === 'attack');
        // The damage, and its parts.
        if (atk) assert.equal(pv.damage, atk.amount, 'damage');
        assert.equal(pv.parts.reduce((n, p) => n + p.n, 0), damageOf(s, a), 'the parts add up to the attack number');
        assert.equal(pv.damage, damageOf(s, a));
        // Rewards for both players.
        assert.deepEqual(pv.rewards, gainOf(s, after, who), 'rewards');
        if (d) {
          assert.equal(pv.target.before, d.currentStrength);
          assert.equal(pv.target.defeated, after.players[foe].row[target.space]?.uid !== d.uid, 'target defeat');
          assert.equal(pv.target.after, strengthNow(after, foe, target.space, d.uid), 'target Strength after');
          if (pv.target.defeated) cover.defeat += 1;
          if (pv.hitBack) {
            cover.hitBack += 1;
            if (atk) assert.equal(pv.hitBack.damage, atk.back, 'hit-back damage');
            assert.equal(pv.hitBack.defeated, after.players[who].row[from]?.uid !== a.uid, 'attacker defeat');
            assert.equal(pv.hitBack.attackerAfter, strengthNow(after, who, from, a.uid), 'attacker Strength after');
            assert.deepEqual(pv.hitBack.rewards, gainOf(s, after, foe), 'the opponent\'s rewards');
          }
          // The attacker afterwards, in every case (a hit-back, or e.g. a Partner's On Summon set off by the attack).
          assert.equal(pv.attacker.defeated, after.players[who].row[from]?.uid !== a.uid, 'attacker defeat');
          assert.equal(pv.attacker.after, strengthNow(after, who, from, a.uid), 'attacker Strength after');
          assert.deepEqual(pv.foeRewards, gainOf(s, after, foe), 'the opponent\'s gains');
        } else cover.player += 1;
        if (locationAt(s, from)) cover.location += 1;
        if (activeBrackets(s).length) cover.weather += 1;
        if (a.held) cover.held += 1;
        if (s.tournament) cover.tournament += 1;
        void ev;
        checked += 1;
        s = after;
        continue;
      }
      s = applyAction(s, chooseAction(s, who, { rng: rnd }));
    }
  }
  assert.ok(checked >= 200, `200+ attacks checked (${checked})`);
  for (const [key, n] of Object.entries(cover)) assert.ok(n > 0, `covered: ${key} (${n})`);
  console.log(`  attackPreview: ${checked} attacks agree with applyAction (${Object.entries(cover).map(([a, b]) => `${a} ${b}`).join(', ')})`);
}

// --- effectPreview against real results: every Command mode, every Item, both Trainer Commands ---------------------------------
let n = 0;
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `m-${n++}`, currentStrength: c.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const card = (id) => ({ ...cardAtRound(id, 1), uid: `c-${n++}` });
const battle = (turn = 'player') => {
  let s = createGame(4242);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = 9; p.exertMax = 0; p.exhaust = []; p.dollars = 10; p.trainers = []; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
// Every Pokémon's actual change matches the preview's list (and nothing else changed).
function agree(before, after, pv, label) {
  for (const who of ['player', 'ai']) {
    for (const { card: c, space } of pokemonOf(before, who)) {
      const now = after.players[who].row[space];
      const defeated = now?.uid !== c.uid;
      const strengthChange = defeated || now.currentStrength !== c.currentStrength || now.strength !== c.strength;
      const p = pv.changes.find((x) => x.who === who && x.space === space && x.stat === 'strength');
      if (strengthChange) {
        assert.ok(p, `${label}: ${c.name}'s Strength change is previewed`);
        assert.equal(p.defeated, defeated, `${label}: ${c.name} defeat`);
        assert.equal(p.after, defeated ? after.players[who].released.find((x) => x.uid === c.uid).currentStrength : now.currentStrength, `${label}: ${c.name} Strength after`);
      } else assert.ok(!p, `${label}: no change previewed for ${c.name}`);
      const pa = pv.changes.find((x) => x.who === who && x.space === space && x.stat === 'attack');
      if (!defeated && now.attack !== c.attack) assert.equal(pa?.after, now.attack, `${label}: ${c.name} Attack after`);
      else assert.ok(!pa || defeated, `${label}: no Attack change previewed for ${c.name}`);
    }
  }
  assert.deepEqual(pv.rewards, gainOf(before, after, 'player'), `${label}: rewards`);
}
const setBoard = (s) => {
  s.players.ai.row[1] = mon('ponyta', 2);                 // 3 Strength: a defeat for 3+ damage
  s.players.ai.row[2] = mon('squirtle', 5);               // 7
  s.players.ai.row[6] = mon('growlithe', 4);              // 5, elsewhere
  s.players.player.row[3] = mon('squirtle', 6, { currentStrength: 2 });   // hurt: heals show
  s.players.player.row[4] = mon('ponyta', 3);
};
let effects = 0;
for (const c of COMMANDS) {
  for (const mode of MODES) {
    for (const space of [1, 2, 3, 4]) {
      let s = battle(mode === 'react' ? 'ai' : 'player');
      setBoard(s);
      const target = c.target === 'enemy' ? { who: 'ai', space: space < 3 ? space : 6 } : { who: 'player', space: space % 2 ? 3 : 4 };
      if (!commandTargets(s, 'player', c).some((t) => t.who === target.who && t.space === target.space)) continue;
      const cc = card(c.id);
      s.players.player.hand = [cc];
      let before;
      let after;
      let pv;
      if (mode === 'adapt') {
        before = s;
        pv = effectPreview(s, 'player', cc, 'adapt', target);
        after = resolve(applyAction(s, { type: 'command', who: 'player', uid: cc.uid, mode: 'adapt', target }));
      } else if (mode === 'strat') {
        before = s;
        pv = effectPreview(s, 'player', cc, 'strat', target);
        after = applyAction(s, { type: 'command', who: 'player', uid: cc.uid, mode: 'strat', target });
        after = applyAction(after, { type: 'pass', who: 'ai' });   // the Strat resolves at the start of the player's next turn
        assert.equal(after.strats.length, 0);
      } else {
        // A React window (G1: summons can't be Reacted to): the Opponent plays Recover as Adapt on a
        // Pokémon at full Strength (no change), and the player Reacts.
        s.players.ai.row[8] = mon('ponyta', 2);
        s.players.ai.hand = [{ ...cardAtRound('recover', 1), uid: 'opp-adapt' }];
        s = applyAction(s, { type: 'command', who: 'ai', uid: 'opp-adapt', mode: 'adapt', target: { who: 'ai', space: 8 } });
        assert.equal(s.reactWindow?.reactor, 'player');
        before = s;
        pv = effectPreview(s, 'player', cc, 'react', target);
        after = applyAction(s, { type: 'react', who: 'player', uid: cc.uid, target });
      }
      agree(before, after, pv, `${c.name} ${mode} → ${target.who} ${target.space}`);
      effects += 1;
    }
  }
}
for (const it of ITEMS) {
  for (const space of [3, 4]) {
    const s = battle();
    setBoard(s);
    const ic = card(it.id);
    s.players.player.hand = [ic];
    const pv = effectPreview(s, 'player', ic, 'use', { who: 'player', space });
    const after = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: ic.uid, then: 'use', target: { space } });
    // Buying costs $: the preview is of the effect, so compare the effect's own rewards (none) on the board.
    agree(s, after, { ...pv, rewards: gainOf(s, after, 'player') }, `${it.name} → ${space}`);
    assert.deepEqual(pv.rewards, { recognition: 0, dollars: 0 }, `${it.name}: the effect itself gives nothing`);
    if (it.op === 'healBreakfast') assert.match(pv.text, /Breakfast/);
    effects += 1;
  }
}
for (const t of TRAINERS) {
  const s = battle();
  setBoard(s);
  s.players.player.drawPile = Array.from({ length: 5 }, () => card('ponyta'));
  const tc = card(t.id);
  s.players.player.hand = [tc];
  const pv = effectPreview(s, 'player', tc, 'command', null);
  const after = applyAction(s, { type: 'trainerCommand', who: 'player', uid: tc.uid });
  agree(s, after, pv, `${t.name}'s Trainer Command`);
  if (t.command.ops.some((o) => o.op === 'draw')) {
    assert.equal(pv.text, 'Draw 2 cards', 'a sentence for an effect with no number');
    assert.equal(after.players.player.hand.length, 2);
  }
  effects += 1;
}
// A defeat by an effect in the Tournament: Recognition ×1.5.
{
  const s = battle();
  setBoard(s);
  s.tournament = { startedRound: 1, reason: 'test' };
  const cc = card('ember');
  s.players.player.hand = [cc];
  const pv = effectPreview(s, 'player', cc, 'adapt', { who: 'ai', space: 1 });
  const after = resolve(applyAction(s, { type: 'command', who: 'player', uid: cc.uid, mode: 'adapt', target: { who: 'ai', space: 1 } }));
  agree(s, after, pv, 'Ember in the Tournament');
  assert.equal(pv.rewards.recognition, 3, 'a defeat: 2 → 3 in the Tournament');
  effects += 1;
}
// The parts of an attack number: Location, Weather (Sun 2 and Sun 4), Held Item, until Supper.
{
  const s = battle();
  s.players.player.row[1] = mon('growlithe', 4, { spent: false });
  for (const [id, start] of [['mt-ember', 0], ['mt-ember', 3]]) {
    s.players.player.hand.push(card(id));
    const x = applyAction(s, { type: 'placeLocation', who: 'player', uid: s.players.player.hand.at(-1).uid, start });
    Object.assign(s, x);
    s.turn = 'player';
  }
  s.players.player.row[1].held = { ...cardAtRound('charcoal', 1), uid: 'h' };
  s.players.player.row[1].attack += 2;
  s.players.player.row[1].tempAttack = 2;
  syncBonuses(s);
  const parts = attackParts(s, 'player', 1);
  assert.deepEqual(parts.map((p) => p.label), ['Attack', 'Mt. Ember', 'Sun 4', 'Charcoal', 'until Supper', 'Sun 2 (Physical)']);
  assert.equal(parts.reduce((a, p) => a + p.n, 0), damageOf(s, s.players.player.row[1]));
  assert.equal(parts[0].n, pokemonAt('growlithe', 4).attack);
}
console.log(`v4 UX3: previews agree with the engine — attacks, ${effects} effect cases (every Command mode, every Item, both Trainer Commands, the Tournament), attack parts — ok`);
