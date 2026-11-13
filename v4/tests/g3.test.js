// G3 (rewritten for B3-1): every Batch 1 Move in every mode, every Supporter with and without its Favour, every Item and
// every Trainer Command, through applyAction on a staged board; and the rules G3 added (Dive, Pokémon Breeder, Quick
// Claw, Choice Band, Rocky Helmet, Amulet Coin) and the AI with them. The card numbers themselves are checked in
// tests/cardsdata.test.js (against docs/base-game/cards.json). Run: node v4/tests/g3.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, syncBonuses, commandTargets, isReady, effectiveSpeed, canHitBack, itemTargets, buyReason, whyNot, hasKw } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, COMMANDS, SUPPORTERS, ITEMS, TRAINERS, FAVOURS, modeText, shortModeTextOf as shortModeText, modeTarget, modesOf, effectOps } from '../src/engine/cards.js';
import { chooseAction, moves } from '../src/ai/ai.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
// Board Pokémon are staged plain (no trigger, no keywords) unless a test gives them some.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `m-${n++}`, currentStrength: c.strength, spent: true, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, keywords: {}, trigger: null, ...extra }; };
const card = (id, round = 1) => ({ ...cardAtRound(id, round), uid: `c-${n++}` });
const battle = (turn = 'player', energy = 9) => {
  let s = createGame(7);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.drawPile = Array.from({ length: 6 }, () => card('ponyta')); p.discard = []; p.row = p.row.map(() => null); p.baseEnergy = energy; p.exertMax = 0; p.exhaust = []; p.trainers = []; p.recognition = 0; p.dollars = 20; p.bag = []; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const give = (s, who, id) => { const c = card(id); s.players[who].hand.push(c); return c.uid; };
const str = (s, who, sp) => s.players[who].row[sp]?.currentStrength;
const hurtBy = (before, after, who, sp) => before.players[who].row[sp].currentStrength - (after.players[who].row[sp]?.currentStrength ?? 0);
const play = (s, who, id, mode, target) => applyAction(s, { type: 'command', who, uid: give(s, who, id), mode, target });
// Let the Strat resolve: the opponent passes, and it resolves at the start of the owner's next turn.
const strat = (s, who, id, target) => { s = play(s, who, id, 'strat', target); return applyAction(s, { type: 'pass', who: who === 'player' ? 'ai' : 'player' }); };
// The Opponent's committed attack, so the player can React: an AI Pokémon at space 8 (Ready) attacks space `on`.
const attackOn = (s, on, attacker = mon('growlithe', 4, { spent: false })) => { s.turn = 'ai'; s.players.ai.row[8] = attacker; return applyAction(s, { type: 'attack', who: 'ai', from: 8, target: { kind: 'pokemon', space: on } }); };

// --- Every Move mode resolves through the engine and does what its ops say ---------------------------------------------------
// Each Command has two or three modes; its card line is one short sentence.
eq(COMMANDS.length, 12, 'the twelve Batch 1 Moves');
for (const c of COMMANDS) for (const m of modesOf(c)) ok(modeText(c, m).length > 4 && shortModeText(c, m).length > 0, `${c.name} ${m}: wording`);
// A board where every target kind exists: two of your Pokémon (one damaged), two enemies (sturdy, Ready-less).
const board = (turn = 'player') => {
  const s = battle(turn);
  s.players.player.row[3] = mon('wooper', 7, { strength: 20, currentStrength: 10 });
  s.players.player.row[4] = mon('squirtle', 7, { strength: 20, currentStrength: 10 });
  s.players.ai.row[2] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  s.players.ai.row[6] = mon('wooper', 7, { strength: 20, currentStrength: 20 });
  return s;
};
// Resolve any choice an effect waits for with its first target.
const settle = (s) => { for (let i = 0; i < 4 && s.choice; i++) s = applyAction(s, { type: 'choose', who: s.choice.who, target: s.choice.targets[0] }); return s; };
const snapshot = (s) => JSON.stringify([s.players.player.row, s.players.ai.row, s.players.player.hand.map((c) => `${c.id}:${c.level}`), s.players.player.drawPile.length, s.players.player.discard.length, s.players.player.baseEnergy, s.strats.length, s.players.player.dollars, s.players.player.recognition]);
for (const c of COMMANDS) {
  for (const m of modesOf(c).filter((x) => x !== 'react')) {
    const s = board();
    const targets = commandTargets(s, 'player', c, m);
    ok(targets.length > 0, `${c.name} ${m}: has a target on this board`);
    let a = m === 'strat' ? strat(structuredClone(s), 'player', c.id, targets[0]) : play(structuredClone(s), 'player', c.id, m, targets[0]);
    if (a.reactWindow) a = applyAction(a, { type: 'decline', who: a.reactWindow.reactor });
    a = settle(a);
    ok(snapshot(a) !== snapshot(s), `${c.name} ${m}: changes the game`);
    ok(!a.choice && !a.reactWindow, `${c.name} ${m}: nothing left waiting`);
    // A single "N damage to an enemy Pokémon": exactly N.
    const ops = c.modes[m].ops;
    if (ops.length === 1 && ops[0].op === 'damage' && ops[0].to === 'chosenEnemy') eq(hurtBy(s, a, 'ai', targets[0].space), ops[0].amount, `${c.name} ${m}: ${ops[0].amount} damage`);
  }
  if (c.modes.react) {
    // React to the Opponent's attack on your Wooper (space 3).
    let s = board();
    s.players.player.hand = [card(c.id)];
    s = attackOn(s, 3);
    const rt = commandTargets(s, 'player', s.players.player.hand[0], 'react');
    ok(rt.length > 0 && s.reactWindow?.reactor === 'player', `${c.name} React: offered against an attack`);
    const r = settle(applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: rt[0] }));
    ok(r.events.some((e) => e.type === 'commandResolved' && e.mode === 'react'), `${c.name} React: resolves`);
    ok(!r.reactWindow, `${c.name} React: then the attack resolves`);
  }
}
// React specifics: Protect (no damage), Bubble Beam (2 less), Thunderbolt (3 to the attacker first).
{
  const reactTo = (id) => {
    let s = board();
    s.players.player.hand = [card(id)];
    s = attackOn(s, 3);
    const t0 = commandTargets(s, 'player', s.players.player.hand[0], 'react')[0];
    return [s, applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: t0 })];
  };
  const atk = mon('growlithe', 4).attack;
  let [s, r] = reactTo('protect');
  eq(hurtBy(s, r, 'player', 3), 0, 'Protect React: the attack deals no damage');
  [s, r] = reactTo('bubble-beam');
  eq(hurtBy(s, r, 'player', 3), atk - 2, 'Bubble Beam React: 2 less damage');
  [s, r] = reactTo('thunderbolt');
  eq(s.players.ai.row[8].currentStrength - (r.players.ai.row[8]?.currentStrength ?? 0), 3, 'Thunderbolt React: 3 damage to the attacker');
  [s, r] = reactTo('leech-seed');
  eq([s.players.ai.row[8].currentStrength - r.players.ai.row[8].currentStrength, hurtBy(s, r, 'player', 3)], [1, atk - 1], 'Leech Seed React: 1 to the attacker, heal 1 to yours (then the attack)');
  // Not offered against an Adapt (no attacker).
  let t = board();
  t.players.player.hand = [card('protect')];
  t.turn = 'ai';
  t.players.ai.hand = [card('ember')];
  t = applyAction(t, { type: 'command', who: 'ai', uid: t.players.ai.hand[0].uid, mode: 'adapt', target: { who: 'player', space: 3 } });
  ok(!t.reactWindow || !commandTargets(t, 'player', t.players.player.hand[0], 'react').length, 'Protect: only against an attack');
}

// --- Every Supporter, without and with its Favour (+3 Recognition) --------------------------------------------------------------
eq(SUPPORTERS.length, 15, 'the fifteen Batch 1 Supporters');
const meets = { water: 'squirtle', fire: 'ponyta', grass: 'oddish', electric: 'pichu', location: 'mt-ember', bigPokemon: null, item: 'potion', move: 'ember' };
const misses = { water: 'ponyta', fire: 'squirtle', grass: 'ponyta', electric: 'ponyta', location: 'potion', bigPokemon: 'potion', item: 'ember', move: 'potion' };
for (const c of SUPPORTERS) {
  for (const fav of [false, true]) {
    let s = board();
    s.players.player.discard = [card('ponyta'), card('charmander')];
    const rel = [];
    for (let k = 0; k < c.release; k++) {
      const id = fav && k === 0 ? meets[c.favour.condition] : misses[c.favour.condition];
      const x = id ? card(id) : { ...pokemonAt('charmander', 6), uid: `big-${n++}` };
      s.players.player.hand.push(x);
      rel.push(x.uid);
    }
    const uid = give(s, 'player', c.id);
    const before = structuredClone(s);
    s = settle(applyAction(s, { type: 'supporter', who: 'player', uid, release: rel, pick: c.ops.concat(c.favour.ops).some((o) => o.op === 'recover') ? s.players.player.discard.filter((x) => x.cardType === 'Pokémon').slice(0, fav ? 3 : 2).map((x) => x.uid) : undefined }));
    eq(s.players.player.recognition - before.players.player.recognition, fav ? (c.favour.recognition ?? RULES.perFavour) : 0, `${c.name}${fav ? ' with its Favour' : ''}: Recognition`);
    ok(snapshot(s) !== snapshot(before), `${c.name}${fav ? ' with its Favour' : ''}: changes the game`);
    ok(!s.choice && s.turn === 'ai', `${c.name}: then the turn ends`);
  }
}
{
  // Pokémon Breeder: Pokémon cards from the Discard Pile into the hand (the player chooses).
  // (B3-1: 2 cards; its Favour, an Item Released: 3.)
  for (const [rel, want, rec] of [['ember', 2, 0], ['potion', 3, 3]]) {
    const s = battle();
    s.players.player.discard = [card('ponyta'), card('magikarp'), card('charmander'), card('squirtle'), card('ember')];
    const ids = s.players.player.discard.map((c) => c.uid);
    const r = give(s, 'player', rel);
    const sup = give(s, 'player', 'pokemon-breeder');
    assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick: [ids[4], ...ids.slice(0, want - 1)] }), /Discard Pile/, 'only Pokémon cards');
    assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick: ids.slice(0, want + 1) }), /choose/, 'exactly as many as it allows');
    const pick = ids.slice(4 - want, 4);
    const a = applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick });
    ok(pick.every((u) => a.players.player.hand.some((c) => c.uid === u)) && pick.every((u) => !a.players.player.discard.some((c) => c.uid === u)), `Pokémon Breeder (${rel}): ${want} cards to hand`);
    eq(a.players.player.recognition, rec, `Pokémon Breeder (${rel}): Favour Recognition ${rec}`);
    eq(a.events.find((e) => e.type === 'supporter').recovered.map((c) => c.uid), pick, 'the event names the cards (for the presenter)');
  }
  // An empty Discard Pile: no pick needed (it fizzles quietly).
  const s = battle();
  const a = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'pokemon-breeder'), release: [give(s, 'player', 'ember')], pick: [] });
  eq(a.players.player.hand.length, 0, 'Pokémon Breeder with nothing to take back');
  // The AI picks through its normal choice (its moves carry a legal pick).
  const ai = battle('ai');
  ai.players.ai.discard = [card('ponyta'), card('charmander')];
  ai.players.ai.hand = [card('pokemon-breeder'), card('ember')];
  const m = moves(ai, 'ai').filter((x) => x.type === 'supporter');
  ok(m.length && m.every((x) => x.pick.length === 2), 'the AI picks two Pokémon cards (all there are)');
  ok(m.every((x) => { try { applyAction(ai, x); return true; } catch { return false; } }), 'the AI\'s Breeder moves are legal');
}

// Dive: back to hand (develops again; Held Item to the PokéMart; damage and kept bonuses lost); Strat draws 1.
{
  let s = battle();
  const charcoal = card('charcoal');
  s.players.player.row[2] = mon('squirtle', 1, { currentStrength: 1, attack: 9, held: charcoal });
  const uid = s.players.player.row[2].uid;
  s.round = 4;
  const pool = s.mart.pool.length;
  const a = play(structuredClone(s), 'player', 'dive', 'adapt', { who: 'player', space: 2 });
  const back = a.players.player.hand.find((c) => c.uid === uid);
  eq(a.players.player.row[2], null, 'Dive: it leaves the battlefield');
  ok(back, 'Dive: the same card is in the hand');
  const r4 = cardAtRound('squirtle', 4);
  eq([back.level, back.attack, back.strength], [r4.level, r4.attack, r4.strength], `it develops with the Rounds again (Round 4: Level ${r4.level}), kept bonuses gone`);
  ok(r4.level > 1, 'a higher Level than it was summoned at');
  ok(back.currentStrength === undefined || back.currentStrength === back.strength, 'damage is lost');
  eq(a.mart.pool.length, pool + 1, 'its Held Item goes back to the PokéMart\'s pool');
  ok(a.mart.pool.some((c) => c.id === 'charcoal'), 'the Charcoal');
  ok(a.events.some((e) => e.type === 'returned' && e.uid === uid), 'a returned event');
  const h0 = s.players.player.hand.length;
  const b = strat(structuredClone(s), 'player', 'dive', { who: 'player', space: 2 });
  eq(b.players.player.hand.length - h0, 2, 'Dive Strat: back to hand, and draw 1');
  // A Partner can't Dive.
  const p = structuredClone(s);
  p.players.player.row[5] = mon('squirtle', 4, { partner: true });
  ok(!commandTargets(p, 'player', card('dive'), 'adapt').some((t) => t.space === 5), 'not a Partner');
  // Dive React: the attacked Pokémon goes back to hand, so the attack fizzles.
  let r = battle();
  r.players.player.row[3] = mon('ponyta', 2);
  const ru = r.players.player.row[3].uid;
  r.players.player.hand = [card('dive')];
  r = attackOn(r, 3, mon('growlithe', 6, { spent: false }));
  eq(commandTargets(r, 'player', r.players.player.hand[0], 'react'), [{ who: 'player', space: 3 }], 'Dive React: only the Pokémon being attacked');
  const d = applyAction(r, { type: 'react', who: 'player', uid: r.players.player.hand[0].uid, target: { who: 'player', space: 3 } });
  ok(d.players.player.hand.some((c) => c.uid === ru), 'Dive React: the attacked Pokémon is back in hand');
  ok(d.events.some((e) => e.type === 'fizzled'), 'the attack fizzles');
  eq(d.players.ai.recognition, 0, 'no defeat, no Recognition for the attacker');
  eq(d.players.ai.row[8].spent, true, 'the attacker is still Spent');
}

const useItem = (s, id, space) => applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: give(s, 'player', id), then: 'use', target: { space } });
// --- Every Item: Consumed Items resolve; Held Items attach -------------------------------------------------------------------------
eq(ITEMS.length, 14, 'the fourteen Batch 1 Items');
eq(createGame(1).mart.pool.length + 1, ITEMS.length, 'one copy of each in the PokéMart (one on sale)');
for (const it of ITEMS) {
  const s = board();
  s.players.player.row[3].spent = true;
  const sp = it.noTarget ? null : 3;
  const iu = give(s, 'player', it.id);
  const a = settle(applyAction(structuredClone(s), { type: 'buyItem', who: 'player', from: 'hand', uid: iu, then: 'use', target: { space: sp } }));
  ok(snapshot(a) !== snapshot(s), `${it.name}: changes the game`);
  if (it.itemType === 'Held') eq(a.players.player.row[3].held?.id, it.id, `${it.name}: held`);
}
// Type-keyword Held Items: the keyword only while the holder is that Type (Charcoal: a Fire Pokémon has Overrun).
{
  const s = battle();
  s.players.player.row[0] = mon('ponyta', 3);
  s.players.player.row[1] = mon('squirtle', 3);
  let a = useItem(s, 'charcoal', 0);
  a.turn = 'player';
  a = useItem(a, 'charcoal', 1);
  ok(hasKw(a.players.player.row[0], 'overrun') && !hasKw(a.players.player.row[1], 'overrun'), 'Charcoal: Overrun for the Fire Pokémon only');
  eq(a.players.player.row[1].attack, pokemonAt('squirtle', 3).attack + 2, 'and +2 Attack for either');
}
// Quick Claw: Speed one step higher; Ready, Pass and every Speed check use it; Swift stays Swift.
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 4, { spent: false });              // Slow
  s.players.ai.row[0] = mon('squirtle', 4, { spent: false });                // Steady
  ok(!isReady(s, s.players.player.row[0]) && isReady(s, s.players.ai.row[0]), 'without it: the Steady Pokémon is Ready');
  s = useItem(s, 'quick-claw', 0);
  eq(effectiveSpeed(s.players.player.row[0]), 'Steady', 'Slow → Steady');
  ok(isReady(s, s.players.player.row[0]) && isReady(s, s.players.ai.row[0]), 'with it: both Ready (matched Speed)');
  s.turn = 'player';
  ok(legalActions(s, 'player').includes('attack'), 'it can attack');
  // Swift stays Swift.
  const t = battle();
  t.players.player.row[1] = mon('ponyta', 2, { spent: false });
  eq(effectiveSpeed(useItem(t, 'quick-claw', 1).players.player.row[1]), 'Swift', 'Swift stays Swift');
  // Pass: an unmatched Ready Pokémon with Quick Claw blocks a Pass (and is made Spent by one when it has no target).
  const u = battle();
  u.players.player.row[0] = mon('squirtle', 4, { spent: false });
  u.players.ai.row[0] = mon('squirtle', 4, { spent: false });
  let v = useItem(u, 'quick-claw', 0);
  v.turn = 'player';
  ok(!legalActions(v, 'player').includes('pass'), 'Pass blocked: it is now the fastest (Swift), unmatched, with a target');
  ok(!isReady(v, v.players.ai.row[0]), 'and the Opponent\'s Steady Pokémon is no longer Ready');
}
// Choice Band: the holder can't hit back. Rocky Helmet: Retaliate 2, stacking with a printed Retaliate.
{
  let s = battle('ai');
  s.players.player.row[3] = mon('wooper', 7, { spent: false, held: card('choice-band') });
  s.players.ai.row[8] = mon('wooper', 7, { spent: false });
  ok(isReady(s, s.players.player.row[3]) && !canHitBack(s, s.players.player.row[3]), 'Ready but can\'t hit back');
  const a = applyAction(s, { type: 'attack', who: 'ai', from: 8, target: { kind: 'pokemon', space: 3 } });
  eq(a.players.ai.row[8].currentStrength, s.players.ai.row[8].currentStrength, 'Choice Band: no hit-back');
  ok(!a.events.find((e) => e.type === 'attack').back, 'no hit-back damage in the event');
  const b = structuredClone(s);
  b.players.player.row[3].held = null;
  const c = applyAction(b, { type: 'attack', who: 'ai', from: 8, target: { kind: 'pokemon', space: 3 } });
  ok(c.players.ai.row[8].currentStrength < b.players.ai.row[8].currentStrength, 'without it, a Ready target hits back');
  s = battle('ai');
  s.players.player.row[3] = mon('horsea', 4, { keywords: { retaliate: 1 }, held: card('rocky-helmet') });   // Retaliate 1, plus 2
  s.players.ai.row[8] = mon('wooper', 7, { spent: false });
  const r = applyAction(s, { type: 'attack', who: 'ai', from: 8, target: { kind: 'pokemon', space: 3 } });
  eq(r.events.find((e) => e.type === 'attack').retaliated, 3, 'Rocky Helmet: Retaliate 2 + the printed 1');
}
// Leftovers (B3-1: Regenerate 2): heals 2 at Breakfast.
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 7, { currentStrength: 3 });
  s = useItem(s, 'leftovers', 0);
  while (s.round === 1) { for (const w of ['player', 'ai']) s.players[w].hand = []; s = applyAction(s, { type: 'pass', who: s.turn }); }
  eq(s.players.player.row[0].currentStrength, 5, 'Leftovers: heal 2 at Breakfast');
}
// Amulet Coin (B3-1: Gain 5 Recognition, $3): no target; buy it to use; or store it and use it from the Bag.
{
  const s = battle();
  const coin = card('amulet-coin');
  eq(itemTargets(s, 'player', coin).length, 1, 'one pseudo-target: no Pokémon needed');
  eq(buyReason(s, 'player', coin, 'use'), null, 'buy-to-use with no Pokémon in play');
  const a = useItem(structuredClone(s), 'amulet-coin', null);
  eq([a.players.player.recognition, a.players.player.dollars], [5, 20 - 3], 'Amulet Coin: +5 Recognition for $3');
  ok(a.mart.pool.some((c) => c.id === 'amulet-coin'), 'then back to the PokéMart\'s pool');
  let b = structuredClone(s);
  b = applyAction(b, { type: 'buyItem', who: 'player', from: 'hand', uid: give(b, 'player', 'amulet-coin'), then: 'store' });
  b.turn = 'player';
  b = applyAction(b, { type: 'useItem', who: 'player', uid: b.players.player.bag[0].uid, target: { space: null } });
  eq(b.players.player.recognition, 5, 'from the Bag too');
  eq(whyNot(s, 'player', 'useItem', coin), null, 'always usable');
}

// --- Every Trainer Command ----------------------------------------------------------------------------------------------------------
for (const tr of TRAINERS) {
  let s = board();
  const before = structuredClone(s);
  s = settle(applyAction(s, { type: 'trainerCommand', who: 'player', uid: give(s, 'player', tr.id) }));
  ok(snapshot(s) !== snapshot(before), `${tr.name}'s Command: changes the game`);
  eq(before.players.player.baseEnergy - s.players.player.baseEnergy, tr.command.cost, `${tr.name}'s Command: costs ${tr.command.cost}`);
  ok(s.turn === 'ai' && !s.choice, `${tr.name}'s Command: then the turn ends`);
}

// --- F. The AI: Dive as a React saves a Pokémon from a lethal attack ---------------------------------------------------------------
{
  let s = battle('ai');
  s.players.player.row[3] = mon('charmander', 7);       // worth saving
  s.players.player.row[3].currentStrength = 2;
  s.players.player.hand = [card('dive')];
  s = attackOn(s, 3, mon('growlithe', 6, { spent: false }));
  eq(s.reactWindow?.reactor, 'player');   // (B3-1: Dive's React)
  const m = chooseAction(s, 'player', { rng: () => 0 });
  eq([m.type, m.target?.space], ['react', 3], 'the AI saves its Charizard from a lethal attack');
  // ...and lets a harmless attack happen.
  let t = battle('ai');
  t.players.player.row[3] = mon('wooper', 7);
  t.players.player.hand = [card('dive')];
  t = attackOn(t, 3, mon('ponyta', 1, { spent: false }));
  eq(chooseAction(t, 'player', { rng: () => 0 }).type, 'decline', 'no Dive against a scratch');
}
// The AI plays whole matches with the new cards, every card through the engine.
{
  const played = new Set();
  for (let seed = 0; seed < 12; seed++) {
    let s = createGame(300 + seed);
    for (let i = 0; i < 3000 && s.phase !== 'gameOver'; i++) {
      const who = s.choice?.who ?? (s.phase === 'mulligan' ? (s.players.player.mulliganed ? 'ai' : 'player') : s.reactWindow?.reactor ?? s.turn);
      const m = chooseAction(s, who, { rng: () => 0.5 });
      if (m.uid) { const c = [...s.players[who].hand, ...s.players[who].bag].find((x) => x.uid === m.uid); if (c) played.add(c.id); }
      if (m.type === 'buyItem' && m.from === 'mart') played.add(s.mart.onSale[m.slot].id);
      s = applyAction(s, m);
    }
    ok(s.phase === 'gameOver', `match ${seed} ends`);
  }
  ok(played.size >= 25, `the AI plays many different cards (${played.size})`);
}

console.log(`v4 G3 (B3-1): every Move mode, Supporter (with and without Favour), Item and Trainer Command through the engine; Dive, Pokémon Breeder, Quick Claw, Choice Band, Rocky Helmet, Amulet Coin; the AI — ${checks} checks ok`);
