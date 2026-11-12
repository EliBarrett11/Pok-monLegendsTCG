// G3: the nine Commands, five Supporters, the PokéMart pool and the final 40-card deck
// (docs/v4-gameplay-update.md 5.1–5.4). Run: node v4/tests/g3.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, syncBonuses, commandTargets, isReady, effectiveSpeed, canHitBack, itemTargets, buyReason, whyNot } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, COMMANDS, SUPPORTERS, ITEMS, DEMO_DECK, FAVOURS, modeText, shortModeText, modeTarget } from '../src/engine/cards.js';
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

// --- 5.1: the nine Commands, written out here independently of cards.js --------------------------------------------------
const SPEC = {
  ember: ['enemy', [1, 'damage', 2], [2, 'damage', 3], [3, 'damage', 5]],
  thunderbolt: ['enemy', [2, 'damage', 2], [3, 'damage', 4], [4, 'damage', 6]],
  'rock-slide': ['location', [2, 'damage', 1, 'enemy'], [3, 'damage', 1], [4, 'damage', 2]],
  'heat-wave': ['allEnemies', [2, 'damage', 1, 'attacker'], [3, 'damage', 1], [5, 'damage', 2]],
  surf: ['location', [1, 'heal', 2, 'attacked'], [3, 'damage', 2], [4, 'damage', 3]],
  'bubble-beam': ['enemy', [1, 'reduce', 2, 'attacker'], [2, 'damageSpent', 2], [3, 'damageSpent', 3]],
  recover: ['own', [1, 'heal', 2], [2, 'heal', 4], [3, 'heal', 8]],
  'flame-charge': ['own', [1, 'attackUp', 1], [2, 'attackKept', 1], [3, 'attackKept', 2]],
  dive: ['own', [1, 'dive', 0, 'attacked'], [1, 'dive', 0], [2, 'dive', 1]],
};
eq(COMMANDS.map((c) => c.id), Object.keys(SPEC), 'the nine Commands, in the table\'s order');
for (const c of COMMANDS) {
  const [target, react, adapt, strt] = SPEC[c.id];
  eq(c.target, target, `${c.name}: target`);
  for (const [m, [cost, op, amount, tg]] of [['react', react], ['adapt', adapt], ['strat', strt]]) {
    eq([c.modes[m].cost, c.modes[m].op, c.modes[m].amount, modeTarget(c, m)], [cost, op, amount, tg ?? target], `${c.name} ${m}`);
    ok(modeText(c, m).length > 4 && shortModeText(c, m).length <= 22, `${c.name} ${m}: card text in one short line (${shortModeText(c, m)})`);
  }
  eq(DEMO_DECK.filter((x) => x === c.id).length, 1, `${c.name}: one copy`);
}
ok(!COMMANDS.some((c) => c.id === 'x-attack'), 'X Attack is no longer a Command');

// Ember, Thunderbolt: damage to an enemy Pokémon, by mode.
for (const [id, dmg] of [['ember', [3, 5]], ['thunderbolt', [4, 6]]]) {
  let s = battle();
  s.players.ai.row[2] = mon('wooper', 7);
  const a = play(s, 'player', id, 'adapt', { who: 'ai', space: 2 });
  eq(hurtBy(s, a, 'ai', 2), dmg[0], `${id} Adapt`);
  eq(a.players.player.baseEnergy, 9 - COMMANDS.find((c) => c.id === id).modes.adapt.cost, `${id} Adapt: its cost`);
  const b = strat(s, 'player', id, { who: 'ai', space: 2 });
  eq(hurtBy(s, b, 'ai', 2), dmg[1], `${id} Strat`);
  s = battle();
  s.players.player.row[3] = mon('wooper', 7);
  s.players.ai.row[2] = mon('wooper', 7);
  s.players.player.hand = [card(id)];
  s = attackOn(s, 3);
  eq(s.reactWindow?.reactor, 'player', `${id}: a React window`);
  const r = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'ai', space: 2 } });
  eq(hurtBy(s, r, 'ai', 2), 2, `${id} React: 2 damage`);
}

// Rock Slide and Surf: a Location (or a lane with no Location): each enemy Pokémon there.
{
  let s = battle();
  s.players.player.hand.push(card('cerulean-cape'));
  s = applyAction(s, { type: 'placeLocation', who: 'player', uid: s.players.player.hand.at(-1).uid, start: 0 });
  s.turn = 'player';
  const w = s.locations[0].width;
  for (const sp of [0, 1, w, w + 2]) s.players.ai.row[sp] = mon('wooper', 7);
  syncBonuses(s);   // the Location's passive first, so only the Command's damage is measured
  const rs = card('rock-slide');
  const ts = commandTargets(s, 'player', rs, 'adapt');
  ok(ts.every((t) => t.lane && t.who === 'ai'), 'Rock Slide: lane targets');
  ok(ts.some((t) => t.space === 2) && !ts.some((t) => t.space === 8), 'a Location with an enemy is a target from any of its lanes; an empty lane is not');
  for (const [id, mode, dmg] of [['rock-slide', 'adapt', 1], ['rock-slide', 'strat', 2], ['surf', 'adapt', 2], ['surf', 'strat', 3]]) {
    const after = mode === 'adapt' ? play(structuredClone(s), 'player', id, mode, { who: 'ai', space: 1, lane: true }) : strat(structuredClone(s), 'player', id, { who: 'ai', space: 1, lane: true });
    eq([0, 1].map((sp) => hurtBy(s, after, 'ai', sp)), [dmg, dmg], `${id} ${mode}: each enemy in the Location`);
    eq([w, w + 2].map((sp) => hurtBy(s, after, 'ai', sp)), [0, 0], `${id} ${mode}: none outside it`);
    // A lane with no Location: just that lane.
    const solo = mode === 'adapt' ? play(structuredClone(s), 'player', id, mode, { who: 'ai', space: w, lane: true }) : strat(structuredClone(s), 'player', id, { who: 'ai', space: w, lane: true });
    eq([0, 1, w, w + 2].map((sp) => hurtBy(s, solo, 'ai', sp)), [0, 0, dmg, 0], `${id} ${mode}: a lane with no Location`);
  }
  // In the Tournament: the whole battlefield.
  const t = structuredClone(s);
  t.tournament = { startedRound: 1, reason: 'test' };
  t.locations = [];
  const all = play(t, 'player', 'surf', 'adapt', { who: 'ai', space: 0, lane: true });
  eq([0, 1, w, w + 2].map((sp) => hurtBy(t, all, 'ai', sp)), [2, 2, 2, 2], 'Surf in the Tournament: every enemy');
}
// Rock Slide React: 1 damage to one enemy. Surf React: heal 2 to the Pokémon being attacked.
{
  let s = battle();
  s.players.player.row[3] = mon('wooper', 7, { currentStrength: 4 });
  s.players.ai.row[1] = mon('wooper', 7);
  s.players.player.hand = [card('rock-slide')];
  s = attackOn(s, 3);
  const r = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'ai', space: 1 } });
  eq(hurtBy(s, r, 'ai', 1), 1, 'Rock Slide React: 1 damage to one enemy');
  s = battle();
  s.players.player.row[3] = mon('wooper', 7, { currentStrength: 4 });
  s.players.player.hand = [card('surf')];
  const g = mon('growlithe', 4, { spent: false });
  s = attackOn(s, 3, g);
  eq(commandTargets(s, 'player', s.players.player.hand[0], 'react'), [{ who: 'player', space: 3 }], 'Surf React: only the Pokémon being attacked');
  const sr = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 3 } });
  eq(sr.players.player.row[3].currentStrength, 4 + 2 - g.attack, 'Surf React: heal 2 before the attack lands');
}
// Heat Wave: each enemy Pokémon; React: 1 damage to the attacker.
{
  let s = battle();
  for (const sp of [0, 4, 8]) s.players.ai.row[sp] = mon('wooper', 7);
  eq(commandTargets(s, 'player', card('heat-wave'), 'adapt'), [{ who: 'ai', space: null, all: true }], 'Heat Wave: no choice');
  const a = play(structuredClone(s), 'player', 'heat-wave', 'adapt', { who: 'ai', space: null, all: true });
  eq([0, 4, 8].map((sp) => hurtBy(s, a, 'ai', sp)), [1, 1, 1], 'Heat Wave Adapt: 1 to each enemy');
  const b = strat(structuredClone(s), 'player', 'heat-wave', { who: 'ai', space: null, all: true });
  eq([0, 4, 8].map((sp) => hurtBy(s, b, 'ai', sp)), [2, 2, 2], 'Heat Wave Strat: 2 to each enemy');
  s = battle();
  s.players.player.row[3] = mon('wooper', 7);
  s.players.ai.row[0] = mon('wooper', 7);
  s.players.player.hand = [card('heat-wave')];
  s = attackOn(s, 3, mon('wooper', 7, { spent: false }));
  eq(commandTargets(s, 'player', s.players.player.hand[0], 'react'), [{ who: 'ai', space: 8 }], 'Heat Wave React: the attacker');
  const r = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'ai', space: 8 } });
  eq([hurtBy(s, r, 'ai', 8), hurtBy(s, r, 'ai', 0)], [1, 0], 'Heat Wave React: 1 to the attacker only');
  // Not offered against an Adapt (no attacker).
  let t = battle('ai');
  t.players.ai.row[0] = mon('wooper', 7, { currentStrength: 3 });
  t.players.player.row[3] = mon('wooper', 7);
  t.players.player.hand = [card('heat-wave')];
  t = play(t, 'ai', 'recover', 'adapt', { who: 'ai', space: 0 });
  eq(t.reactWindow, null, 'Heat Wave can\'t React to an Adapt: no attacker');
}
// Bubble Beam: damage, and it becomes Spent; React (C4 ruling): the attack deals 2 less damage.
{
  let s = battle();
  s.players.ai.row[2] = mon('wooper', 7, { spent: false });
  s.players.player.row[6] = mon('wooper', 7, { spent: false });   // matched Speed, so the Opponent may Pass
  const a = play(structuredClone(s), 'player', 'bubble-beam', 'adapt', { who: 'ai', space: 2 });
  eq([hurtBy(s, a, 'ai', 2), a.players.ai.row[2].spent], [2, true], 'Bubble Beam Adapt: 2 damage and Spent');
  const b = strat(structuredClone(s), 'player', 'bubble-beam', { who: 'ai', space: 2 });
  eq([hurtBy(s, b, 'ai', 2), b.players.ai.row[2].spent], [3, true], 'Bubble Beam Strat: 3 damage and Spent');
  s = battle();
  s.players.player.row[3] = mon('wooper', 7);
  s.players.player.hand = [card('bubble-beam')];
  const g = mon('growlithe', 4, { spent: false });
  s = attackOn(s, 3, g);
  const r = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'ai', space: 8 } });
  eq([hurtBy(s, r, 'player', 3), r.players.ai.row[8].spent], [g.attack - 2, true], 'Bubble Beam React: the attack deals 2 less; the attacker is Spent after it');
}
// Recover; Flame Charge: +1 until Supper (React), +1 kept (Adapt), +2 kept (Strat).
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 7, { currentStrength: 1 });
  eq(play(structuredClone(s), 'player', 'recover', 'adapt', { who: 'player', space: 0 }).players.player.row[0].currentStrength, 5, 'Recover Adapt: heal 4');
  eq(strat(structuredClone(s), 'player', 'recover', { who: 'player', space: 0 }).players.player.row[0].currentStrength, 9, 'Recover Strat: heal 8');
  const atk = s.players.player.row[0].attack;
  let k = play(structuredClone(s), 'player', 'flame-charge', 'adapt', { who: 'player', space: 0 });
  eq(k.players.player.row[0].attack, atk + 1, 'Flame Charge Adapt: +1 Attack');
  while (k.round === 1) { for (const w of ['player', 'ai']) k.players[w].row.forEach((c) => { if (c) c.spent = true; }); k = applyAction(k, { type: 'pass', who: k.turn }); }
  eq(k.players.player.row[0].attack, atk + 1, 'kept through Supper');
  eq(strat(structuredClone(s), 'player', 'flame-charge', { who: 'player', space: 0 }).players.player.row[0].attack, atk + 2, 'Flame Charge Strat: +2 Attack kept');
  s.players.player.row[3] = mon('wooper', 7);
  s.players.player.hand = [card('flame-charge')];
  s = attackOn(s, 3);
  const r = applyAction(s, { type: 'react', who: 'player', uid: s.players.player.hand[0].uid, target: { who: 'player', space: 0 } });
  eq([r.players.player.row[0].attack, r.players.player.row[0].tempAttack], [atk + 1, 1], 'Flame Charge React: +1 until Supper');
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

// --- 5.2: Supporters, with and without the Favour (+3 Recognition) ------------------------------------------------------------
eq(SUPPORTERS.map((c) => [c.id, c.release, c.effect.op, c.effect.amount, c.favour.condition, c.favour.op, c.favour.amount]), [
  ['nurse-joy', 1, 'healAll', 2, 'water', 'healAll', 4],
  ['professor-oak', 1, 'search', 1, 'location', 'search', 2],
  ['brock', 2, 'strengthAll', 1, 'bigPokemon', 'strengthAll', 2],
  ['flannery', 1, 'attackAll', 1, 'fire', 'attackAll', 2],
  ['pokemon-breeder', 1, 'recover', 1, 'item', 'recover', 2],
], 'the five Supporters of 5.2');
eq(RULES.perFavour, 3, 'a Favour gives +3 Recognition');
eq(DEMO_DECK.filter((x) => x === 'professor-oak').length, 1, 'one Professor Oak');
ok(FAVOURS.fire.test(card('ponyta')) && !FAVOURS.fire.test(card('squirtle')) && FAVOURS.item.test(card('potion')) && !FAVOURS.item.test(card('ember')), 'the new Favours: a Fire Pokémon, an Item');
{
  // Flannery: each of your Pokémon +1 Attack until Supper; Favour (Fire Pokémon): +2, and +3 Recognition.
  for (const [rel, amt, rec] of [['squirtle', 1, 0], ['ponyta', 2, 3]]) {
    const s = battle();
    s.players.player.row[0] = mon('wooper', 4);
    s.players.player.row[5] = mon('squirtle', 4);
    const r = give(s, 'player', rel);
    const a = applyAction(s, { type: 'supporter', who: 'player', uid: give(s, 'player', 'flannery'), release: [r] });
    eq([0, 5].map((sp) => a.players.player.row[sp].attack - s.players.player.row[sp].attack), [amt, amt], `Flannery (${rel}): +${amt} Attack`);
    eq([0, 5].map((sp) => a.players.player.row[sp].tempAttack), [amt, amt], 'until Supper');
    eq(a.players.player.recognition, rec, `Flannery (${rel}): Favour Recognition ${rec}`);
  }
  // Pokémon Breeder: Pokémon cards from the Discard Pile into the hand (the player chooses).
  for (const [rel, want, rec] of [['ember', 1, 0], ['potion', 2, 3]]) {
    const s = battle();
    s.players.player.discard = [card('ponyta'), card('magikarp'), card('ember'), card('charmander')];
    const ids = s.players.player.discard.map((c) => c.uid);
    const r = give(s, 'player', rel);
    const sup = give(s, 'player', 'pokemon-breeder');
    assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick: [ids[2]].concat(want === 2 ? [ids[0]] : []) }), /Discard Pile/, 'only Pokémon cards');
    assert.throws(() => applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick: ids.slice(0, want + 1) }), /choose/, 'exactly as many as it allows');
    const pick = want === 2 ? [ids[1], ids[3]] : [ids[3]];
    const a = applyAction(s, { type: 'supporter', who: 'player', uid: sup, release: [r], pick });
    ok(pick.every((u) => a.players.player.hand.some((c) => c.uid === u)) && pick.every((u) => !a.players.player.discard.some((c) => c.uid === u)), `Pokémon Breeder (${rel}): ${want} card(s) to hand`);
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
  ok(m.length && m.every((x) => x.pick.length === 1), 'the AI picks one Pokémon card');
  ok(m.every((x) => { try { applyAction(ai, x); return true; } catch { return false; } }), 'the AI\'s Breeder moves are legal');
  // Nurse Joy, Professor Oak and Brock are unchanged (covered in tests/commands.test.js).
}

// --- 5.3: the PokéMart pool, Held and Consumed effects ------------------------------------------------------------------------
eq(ITEMS.map((c) => [c.id, c.price, c.stock, c.itemType]), [
  ['oran-berry', 1, 8, 'Consumed'], ['potion', 2, 6, 'Consumed'], ['x-attack', 2, 6, 'Consumed'], ['charcoal', 2, 6, 'Held'], ['mystic-water', 2, 6, 'Held'],
  ['quick-claw', 3, 4, 'Held'], ['rocky-helmet', 3, 4, 'Held'], ['leftovers', 3, 4, 'Held'], ['choice-band', 4, 3, 'Held'], ['amulet-coin', 4, 3, 'Consumed'],
], 'the pool of 5.3');
eq(createGame(1).mart.pool.length + 1, ITEMS.length, 'one copy of each in the PokéMart (one on sale)');
const useItem = (s, id, space) => applyAction(s, { type: 'buyItem', who: 'player', from: 'hand', uid: give(s, 'player', id), then: 'use', target: { space } });
{
  const s = battle();
  s.players.player.row[0] = mon('wooper', 7, { currentStrength: 2 });
  const atk = s.players.player.row[0].attack;
  eq(useItem(structuredClone(s), 'oran-berry', 0).players.player.row[0].currentStrength, 4, 'Oran Berry: heal 2');
  eq(useItem(structuredClone(s), 'potion', 0).players.player.row[0].currentStrength, 6, 'Potion: heal 4');
  const x = useItem(structuredClone(s), 'x-attack', 0);
  eq([x.players.player.row[0].attack, x.players.player.row[0].tempAttack], [atk + 2, 2], 'X Attack: +2 Attack until Supper (an Item now)');
  eq(useItem(structuredClone(s), 'charcoal', 0).players.player.row[0].attack, atk + 1, 'Charcoal: +1 Attack');
  eq(useItem(structuredClone(s), 'mystic-water', 0).players.player.row[0].strength, s.players.player.row[0].strength + 2, 'Mystic Water: +2 Strength');
  eq(useItem(structuredClone(s), 'choice-band', 0).players.player.row[0].attack, atk + 3, 'Choice Band: +3 Attack');
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
  s.players.player.row[3] = mon('horsea', 4, { keywords: { retaliate: 1 }, held: card('rocky-helmet') });   // Seadra: Retaliate 1, plus 2
  s.players.ai.row[8] = mon('wooper', 7, { spent: false });
  const r = applyAction(s, { type: 'attack', who: 'ai', from: 8, target: { kind: 'pokemon', space: 3 } });
  eq(r.events.find((e) => e.type === 'attack').retaliated, 3, 'Rocky Helmet: Retaliate 2 + the printed 1');
}
// Leftovers: Regenerate 1 (heals 1 at Breakfast).
{
  let s = battle();
  s.players.player.row[0] = mon('wooper', 7, { currentStrength: 3 });
  s = useItem(s, 'leftovers', 0);
  while (s.round === 1) { for (const w of ['player', 'ai']) s.players[w].hand = []; s = applyAction(s, { type: 'pass', who: s.turn }); }
  eq(s.players.player.row[0].currentStrength, 4, 'Leftovers: heal 1 at Breakfast');
}
// Amulet Coin: no target; buy it to use and gain 3 Recognition at once; or store it and use it from the Bag.
{
  const s = battle();
  const coin = card('amulet-coin');
  eq(itemTargets(s, 'player', coin).length, 1, 'one pseudo-target: no Pokémon needed');
  eq(buyReason(s, 'player', coin, 'use'), null, 'buy-to-use with no Pokémon in play');
  const a = useItem(structuredClone(s), 'amulet-coin', null);
  eq([a.players.player.recognition, a.players.player.dollars], [3, 20 - 4], 'Amulet Coin: +3 Recognition for $4');
  ok(a.mart.pool.some((c) => c.id === 'amulet-coin'), 'then back to the PokéMart\'s pool');
  let b = structuredClone(s);
  b = applyAction(b, { type: 'buyItem', who: 'player', from: 'hand', uid: give(b, 'player', 'amulet-coin'), then: 'store' });
  b.turn = 'player';
  b = applyAction(b, { type: 'useItem', who: 'player', uid: b.players.player.bag[0].uid, target: { space: null } });
  eq(b.players.player.recognition, 3, 'from the Bag too');
  eq(whyNot(s, 'player', 'useItem', coin), null, 'always usable');
}

// --- 5.4: the deck, exactly ---------------------------------------------------------------------------------------------------------
eq([...DEMO_DECK].sort(), [
  'cerulean-cape', 'mt-ember', 'lake-of-rage', 'route-119',
  'ponyta', 'ponyta', 'chinchou', 'chinchou', 'shinx', 'squirtle', 'squirtle', 'growlithe', 'growlithe', 'horsea', 'wooper', 'magikarp', 'charmander', 'charmander', 'magby',
  'ember', 'thunderbolt', 'rock-slide', 'heat-wave', 'surf', 'bubble-beam', 'recover', 'flame-charge', 'dive',
  'nurse-joy', 'professor-oak', 'brock', 'flannery', 'pokemon-breeder',
  'potion', 'oran-berry', 'x-attack', 'charcoal', 'quick-claw',
  'misty', 'blaine',
].sort(), 'DEMO_DECK is exactly the 5.4 list');
eq(DEMO_DECK.length, 40);

// --- F. The AI: Dive as a React saves a Pokémon from a lethal attack ---------------------------------------------------------------
{
  let s = battle('ai');
  s.players.player.row[3] = mon('charmander', 7);       // worth saving
  s.players.player.row[3].currentStrength = 2;
  s.players.player.hand = [card('dive')];
  s = attackOn(s, 3, mon('growlithe', 6, { spent: false }));
  eq(s.reactWindow?.reactor, 'player');
  const m = chooseAction(s, 'player', { rng: () => 0 });
  eq([m.type, m.target?.space], ['react', 3], 'the AI Dives its Charizard out of a lethal attack');
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
  for (const id of ['thunderbolt', 'heat-wave', 'surf', 'bubble-beam', 'flame-charge', 'dive', 'flannery', 'pokemon-breeder', 'x-attack', 'quick-claw']) ok(played.has(id), `the AI plays ${id}`);
}

console.log(`v4 G3: the nine Commands in every mode (Location, all enemies, the attacker, the attacked; Spent; kept; Dive), the five Supporters with and without Favour, the PokéMart pool (Quick Claw, Choice Band, Rocky Helmet, Leftovers, Amulet Coin), the 40-card deck, the AI — ${checks} checks ok`);
