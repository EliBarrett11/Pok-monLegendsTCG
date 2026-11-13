// v4 UX3: result previews agree with the real results. attackPreview is checked on 200+ random legal
// attacks from AI-played matches (fixed seeds), covering Locations, Held Items and the
// Tournament; effectPreview on every Command mode, every Item and both Trainer Commands.
// Run: node v4/tests/ux3.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, actor, attackers, legalTargets, syncBonuses, locationAt, damageOf, commandTargets, pokemonOf, passBlockers } from '../src/engine/game.js';
import { attackPreview, attackParts, effectPreview } from '../src/engine/preview.js';
import { chooseAction } from '../src/ai/ai.js';
import { DECK_IDS } from '../src/engine/decks.js';
import { pokemonAt, cardAtRound, COMMANDS, ITEMS, TRAINERS, MODES, modeTarget } from '../src/engine/cards.js';

let k = 12345;
const rnd = () => { k = (k * 1103515245 + 12345) % 2147483648; return k / 2147483648; };
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const resolve = (s) => (s.reactWindow ? applyAction(s, { type: 'decline', who: s.reactWindow.reactor }) : s);
const gainOf = (a, b, who) => ({ recognition: b.players[who].recognition - a.players[who].recognition, dollars: b.players[who].dollars - a.players[who].dollars });
// B3-2: a Pokémon whose On Defeated returns it to its owner's hand (Gastly's line) was defeated: its Strength there is
// a fresh card's, so it reads as defeated (the preview's own number is taken).
const strengthNow = (s, who, space, uid, shown) => (s.players[who].row[space]?.uid === uid ? s.players[who].row[space].currentStrength
  : s.players[who].hand.some((c) => c.uid === uid) && shown <= 0 ? shown : s.players[who].released.find((c) => c.uid === uid)?.currentStrength);

// --- attackPreview against 200+ real attacks ---------------------------------------------------------------------------
{
  let checked = 0;
  const g2cover = {};
  const cover = { location: 0, held: 0, tournament: 0, hitBack: 0, player: 0, defeat: 0 };
  const charcoal = { ...cardAtRound('charcoal', 1), uid: 'held-test' };
  for (let m = 0; checked < 300 && m < 60; m++) {
    // B3-2: every deck in turn (eight since Batch 2), against another.
    let s = createGame(1000 + m, { decks: { player: DECK_IDS[m % DECK_IDS.length], ai: DECK_IDS[(m * 3 + 1) % DECK_IDS.length] } });
    for (let step = 0; step < 900 && s.phase !== 'gameOver' && checked < 300; step++) {
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
        assert.equal(pv.raw, damageOf(s, a));
        // G2: keywords and triggers set off by the attack, as the real result has them.
        const real = [...evs.events, ...(evs.reactWindow ? resolve(evs).events : [])];
        assert.deepEqual(pv.keywords.map((k) => k.kw), real.filter((e) => e.type === 'keyword').map((e) => e.kw), 'keyword callouts');
        for (const k of pv.keywords) g2cover[k.kw] = (g2cover[k.kw] ?? 0) + 1;
        for (const t of pv.triggers) g2cover[t.on] = (g2cover[t.on] ?? 0) + 1;
        // Rewards for both players.
        assert.deepEqual(pv.rewards, gainOf(s, after, who), 'rewards');
        if (d) {
          assert.equal(pv.target.before, d.currentStrength);
          assert.equal(pv.target.defeated, after.players[foe].row[target.space]?.uid !== d.uid, 'target defeat');
          assert.equal(pv.target.after, strengthNow(after, foe, target.space, d.uid, pv.target.after), 'target Strength after');
          if (pv.target.defeated) cover.defeat += 1;
          if (pv.hitBack) {
            cover.hitBack += 1;
            if (atk) assert.equal(pv.hitBack.damage, atk.back, 'hit-back damage');
            assert.equal(pv.hitBack.defeated, after.players[who].row[from]?.uid !== a.uid, 'attacker defeat');
            assert.equal(pv.hitBack.attackerAfter, strengthNow(after, who, from, a.uid, pv.hitBack.attackerAfter), 'attacker Strength after');
            assert.deepEqual(pv.hitBack.rewards, gainOf(s, after, foe), 'the opponent\'s rewards');
          }
          // The attacker afterwards, in every case (a hit-back, or e.g. a Partner's On Summon set off by the attack).
          assert.equal(pv.attacker.defeated, after.players[who].row[from]?.uid !== a.uid, 'attacker defeat');
          assert.equal(pv.attacker.after, strengthNow(after, who, from, a.uid, pv.attacker.after), 'attacker Strength after');
          assert.deepEqual(pv.foeRewards, gainOf(s, after, foe), 'the opponent\'s gains');
        } else cover.player += 1;
        if (locationAt(s, from)) cover.location += 1;
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
  assert.ok(checked >= 300, `300 attacks checked (${checked})`);
  // (B3-1: no Batch 1 card has On Defeated: tests/g2.test.js stages it. The new keywords that act in an attack are covered too.)
  for (const k of ['Shell', 'Retaliate', 'Rage', 'Overrun', 'Sturdy', 'Drain', 'Pickup', 'attack', 'knockout', 'defend'])
    assert.ok(g2cover[k] > 0, `G2 covered: ${k} (${JSON.stringify(g2cover)})`);
  for (const [key, n] of Object.entries(cover)) assert.ok(n > 0, `covered: ${key} (${n})`);
  console.log(`  attackPreview: ${checked} attacks agree with applyAction (${Object.entries(cover).map(([a, b]) => `${a} ${b}`).join(', ')}; G2: ${Object.entries(g2cover).map(([a, b]) => `${a} ${b}`).join(', ')})`);
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
      // G3: Dive: back in hand, not defeated.
      if (now?.uid !== c.uid && after.players[who].hand.some((x) => x.uid === c.uid)) {
        assert.ok(pv.changes.some((x) => x.who === who && x.space === space && x.returned), `${label}: ${c.name}'s return to hand is previewed`);
        continue;
      }
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
  s.players.ai.row[4] = mon('squirtle', 3, { spent: false });   // B3-2: Active (Sucker Punch), across from one of yours (Close Combat)
};
let effects = 0;
const seenModes = new Set();
// A React window: the Opponent attacks (with 0 Attack, so the attack itself changes nothing) when the
// mode's target is the attacker or the attacked Pokémon (G3); otherwise it plays Protect as Adapt (B3-1: Shell
// until Supper on its own Pokémon: no stat changes). G1: summons can't be Reacted to.
function openWindow(s, c) {
  const tg = modeTarget(c, 'react');
  if (tg === 'attacker' || tg === 'attacked') {
    s.players.ai.row[8] = mon('ponyta', 2, { spent: false, attack: 0 });
    const target = legalTargets(s, 'ai', 8).find((t) => t.kind === 'pokemon' && t.space === 3) ?? legalTargets(s, 'ai', 8).find((t) => t.kind === 'pokemon');
    return applyAction(s, { type: 'attack', who: 'ai', from: 8, target });
  }
  s.players.ai.row[8] = mon('ponyta', 2);
  s.players.ai.hand = [{ ...cardAtRound('protect', 1), uid: 'opp-adapt' }];
  return applyAction(s, { type: 'command', who: 'ai', uid: 'opp-adapt', mode: 'adapt', target: { who: 'ai', space: 8 } });
}
for (const c of COMMANDS) {
  for (const mode of MODES.filter((m) => c.modes[m])) {   // (B3-1: some Moves have two modes)
    let s0 = battle(mode === 'react' ? 'ai' : 'player');
    setBoard(s0);
    const cc0 = card(c.id);
    s0.players.player.hand = [cc0];
    if (mode === 'react') s0 = openWindow(s0, c);
    // (Not the Pokémon the Opponent's Protect is about to shield: that would hide the React's change.)
    const targets = commandTargets(s0, 'player', cc0, mode).filter((t) => !(s0.reactWindow?.pending.type === 'command' && t.who === 'ai' && t.space === 8));
    assert.ok(targets.length, `${c.name} ${mode}: has targets on the test board`);
    for (const target of targets.slice(0, 4)) {
      let s = structuredClone(s0);
      const cc = s.players.player.hand[0];
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
        for (const sp of passBlockers(after, 'ai')) after.players.ai.row[sp].spent = true;   // (B3-2: an Active one can't pass)
        after = applyAction(after, { type: 'pass', who: 'ai' });   // the Strat resolves at the start of the player's next turn
        assert.equal(after.strats.length, 0);
      } else {
        assert.equal(s.reactWindow?.reactor, 'player');
        before = s;
        pv = effectPreview(s, 'player', cc, 'react', target);
        after = applyAction(s, { type: 'react', who: 'player', uid: cc.uid, target });
      }
      agree(before, after, pv, `${c.name} ${mode} → ${target.who} ${target.space}${target.lane ? ' (lane)' : ''}${target.all ? ' (all)' : ''}`);
      seenModes.add(`${c.id}:${mode}`);
      effects += 1;
    }
  }
}
assert.equal(seenModes.size, COMMANDS.reduce((k, c) => k + Object.keys(c.modes).length, 0), 'every Command mode previewed');
for (const it of ITEMS) {
  for (const space of [3, 4]) {
    const s = battle();
    setBoard(s);
    const ic = card(it.id);
    s.players.player.hand = [ic];
    const t = it.noTarget ? { who: 'player', space: null } : { who: 'player', space };
    const pv = effectPreview(s, 'player', ic, 'use', t);
    const after = applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: ic.uid, then: 'use', target: t });
    // Buying costs $: the preview is of the effect, so compare the effect's own rewards (none) on the board.
    agree(s, after, { ...pv, rewards: gainOf(s, after, 'player') }, `${it.name} → ${space}`);
    // G3: Amulet Coin's effect is Recognition; every other Item's effect gives nothing.
    const rec = it.ops.find((o) => o.op === 'recognition');
    assert.deepEqual(pv.rewards, { recognition: rec ? rec.amount : 0, dollars: 0 }, `${it.name}: the effect's own rewards`);
    effects += 1;
  }
}
for (const t of TRAINERS) {
  const s = battle();
  setBoard(s);
  s.players.player.drawPile = Array.from({ length: 5 }, () => card('ponyta'));
  const tc = card(t.id);
  s.players.player.hand = [tc];
  // (B3-1: a Command that names "an enemy Pokémon", Lt. Surge's, previews with its target, then chooses it.)
  // (B3-2: Bruno's names one of your Pokémon.)
  const chosen = t.command.ops.some((o) => o.to === 'chosenEnemy') ? { who: 'ai', space: 1 } : t.command.ops.some((o) => o.to === 'chosenOwn') ? { who: 'player', space: 3 } : null;
  const pv = effectPreview(s, 'player', tc, 'command', chosen);
  let after = applyAction(s, { type: 'trainerCommand', who: 'player', uid: tc.uid });
  // (B3-2: a card pick, Sabrina's from the opponent's hand: the first card offered.)
  while (after.choice) after = applyAction(after, { type: 'choose', who: 'player', target: after.choice.pick === 'card' ? after.choice.targets[0] : chosen });
  agree(s, after, { ...pv, rewards: pv.rewards }, `${t.name}'s Trainer Command`);
  if (t.id === 'misty') {
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
// The parts of an attack number: Location, Held Item, Intimidate (B3-1), until Supper.
{
  const s = battle();
  s.players.player.row[1] = mon('growlithe', 4, { spent: false });
  s.players.ai.row[2] = mon('squirtle', 4, { keywords: { intimidate: 1 } });   // in Mt. Ember with it
  for (const [id, start] of [['mt-ember', 0]]) {
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
  assert.deepEqual(parts.map((p) => [p.label, p.n]), [['Attack', pokemonAt('growlithe', 4).attack], ['Mt. Ember', 1], ['Charcoal', 2], ['Intimidate', -1], ['until Supper', 2]]);
  assert.equal(parts.reduce((a, p) => a + p.n, 0), damageOf(s, s.players.player.row[1]));
  assert.equal(parts[0].n, pokemonAt('growlithe', 4).attack);
}
console.log(`v4 UX3: previews agree with the engine — attacks, ${effects} effect cases (every Command mode, every Item, every Trainer Command, the Tournament), attack parts — ok`);
