// V5 — Trainers: playing and attaching, sharing a space with a Pokémon, never a
// target, moving once per Round, Trainer Point sources, the Breakfast assign step
// (hidden until both lock in), tier unlocks, Passive, Ability and Partner (placement
// when its space is taken, waiting when none is free), and the AI (with a report).
// Run with: node v2/tests/trainers.test.js
import assert from 'node:assert/strict';
import {
  actor, createGame, applyAction, legalActions, legalTargets, targetOptions, tiersUnlocked, shellOf, needsAssign, PLAYERS,
} from '../src/engine/game.js';
import { cardDef, TEST_DECK, deckProblems } from '../src/engine/cards.js';
import { TRAINERS } from '../src/engine/cardtypes.js';
import { pokemonAt } from '../src/engine/series.js';
import { LANES } from '../src/engine/rules.js';
import { chooseAction } from '../src/ai/opponent.js';

function battle(round = 1, seed = 5) {
  let s = createGame(seed);
  s = applyAction(s, { type: 'flipCoin' });
  s.round = round;
  s.turn = 'player';
  s.initiative = 'player';
  for (const who of PLAYERS) Object.assign(s.players[who], { energy: 10, hand: [] });
  return s;
}
let n = 0;
const give = (s, who, id) => { const card = { ...cardDef(id), uid: `${who}-g${n++}` }; s.players[who].hand.push(card); return card.uid; };
function place(s, who, space, series, level = 3, extra = {}) {
  const card = { ...pokemonAt(series, level), cap: 6, uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: false, ...extra };
  return s.players[who].row[space];
}
// A Trainer straight into play, with points already on it.
function trainer(s, who, id, space, points = 0) {
  const t = { ...cardDef(id), uid: `${who}-tr${n++}`, space, points, abilityRound: 0 };
  s.players[who].trainers.push(t);
  return t;
}
const act = (s, a) => applyAction(s, a);
const other = (who) => (who === 'player' ? 'ai' : 'player');
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: other(s.turn) });
const mon = (who, space) => ({ who, kind: 'pokemon', space });
// A no-op action that lets passives settle (applyAction syncs them).
const settle = (s) => { const t = structuredClone(s); t.turn = 'player'; return act(act(t, { type: 'pass', who: 'player' }), { type: 'pass', who: 'ai' }); };

// --- The data -------------------------------------------------------------------------------------

{
  assert.equal(TRAINERS.length, 4);
  for (const t of TRAINERS) {
    assert.ok(t.cost >= 1 && t.cost <= 2, `${t.name}: cost 1–2`);
    assert.deepEqual(t.tiers.map((x) => x.kind), ['Passive', 'Ability', 'Partner']);
    assert.deepEqual(t.tiers.map((x) => x.cost), [2, 4, 6]);
    assert.equal(t.tiers[2].partner.level, 4);
  }
  assert.deepEqual(TRAINERS.map((t) => pokemonAt(t.tiers[2].partner.series, 4).name), ['Starmie', 'Magmar', 'Onix', 'Tangela']);
  assert.deepEqual(deckProblems(TEST_DECK), []);
  assert.match(deckProblems([...TEST_DECK.slice(1), { series: 'onix', cap: 4 }]).join(), /Partner Pokémon/, 'Partners are never in a deck');
}

// --- Playing and attaching; sharing a space with a Pokémon; never a target ---------------------------

{
  let s = battle();
  place(s, 'player', 4, 'horsea', 2);
  const uid = give(s, 'player', 'misty');   // cost 1
  s.players.player.energy = 1;
  s = act(s, { type: 'playTrainer', who: 'player', uid, space: 4 });
  const p = s.players.player;
  assert.deepEqual([p.trainers.length, p.trainers[0].space, p.trainers[0].points, p.energy, s.turn], [1, 4, 0, 0, 'ai'], 'a Battle Action, paid');
  assert.equal(p.row[4].name, 'Horsea', 'the Pokémon keeps its space: they share it');
  assert.ok(!p.hand.some((c) => c.uid === uid));
  // A Pokémon can be summoned into a Trainer's space.
  s.turn = 'player';
  s.players.player.energy = 20;
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'growlithe'), space: 3 });
  s.turn = 'player';
  s = act(s, { type: 'playTrainer', who: 'player', uid: give(s, 'player', 'brock'), space: 3 });
  assert.equal(s.players.player.row[3].name, 'Growlithe');
  // One Trainer per space (Claude's placeholder); no limit on Trainers in play.
  s.turn = 'player';
  assert.throws(() => act(s, { type: 'playTrainer', who: 'player', uid: give(s, 'player', 'erika'), space: 4 }), /without a Trainer/);
  for (let i = 5; i < LANES; i++) { s.turn = 'player'; s = act(s, { type: 'playTrainer', who: 'player', uid: give(s, 'player', 'blaine'), space: i }); }
  assert.equal(s.players.player.trainers.length, 2 + LANES - 5);
  // Trainers are never a target: not for attacks, not for effects.
  s = battle();
  trainer(s, 'ai', 'blaine', 2, 6);
  place(s, 'player', 0, 'sneasel', 6);   // Infiltrator: may attack anything
  assert.ok(legalTargets(s, 'player', 0).every((t) => t.kind === 'pokemon' || t.kind === 'player'));
  assert.deepEqual(legalTargets(s, 'player', 0), [{ kind: 'player' }], 'no Pokémon: only the player character');
  for (const spec of [{ side: 'enemy', kinds: ['pokemon', 'player'], count: 'all' }, { side: 'friendly', kinds: ['pokemon', 'player'], count: 1 }]) {
    assert.ok(targetOptions(s, 'player', spec).every((t) => t.kind !== 'trainer'));
  }
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'ember'), pay: 6 });
  assert.deepEqual([s.players.ai.trainers.length, s.players.ai.trainers[0].points], [1, 6], 'Ember 6 hits every enemy, never a Trainer');
}

// --- Move: once per Round, a Battle Action ---------------------------------------------------------------

{
  let s = battle();
  const t = trainer(s, 'player', 'misty', 0);
  trainer(s, 'player', 'brock', 1);
  assert.throws(() => act(s, { type: 'moveTrainer', who: 'player', uid: t.uid, space: 1 }), /without a Trainer/);
  s = act(s, { type: 'moveTrainer', who: 'player', uid: t.uid, space: 6 });
  assert.deepEqual([s.players.player.trainers[0].space, s.players.player.movedTrainer, s.turn], [6, true, 'ai']);
  assert.ok(s.events.some((e) => e.type === 'trainerMoved' && e.from === 0 && e.to === 6));
  s.turn = 'player';
  assert.equal(legalActions(s, 'player').includes('moveTrainer'), false, 'once per Round');
  assert.throws(() => act(s, { type: 'moveTrainer', who: 'player', uid: t.uid, space: 7 }), /cannot moveTrainer/);
  s = passBoth(s);
  assert.equal(legalActions(s, s.turn === 'player' ? 'player' : 'ai').length > 0, true);
  s.turn = 'player';
  assert.equal(legalActions(s, 'player').includes('moveTrainer'), true, 'again next Round');
}

// --- Trainer Point sources ----------------------------------------------------------------------------

{
  // A Location milestone (Route 119 at 2: +1 Energy, +1 Trainer Point) and a completion (Cerulean Cape: +2).
  let s = battle();
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'route-119'), start: 0 });
  place(s, 'player', 0, 'horsea');
  place(s, 'player', 1, 'horsea');
  s.turn = 'player';
  s = passBoth(s);
  assert.equal(s.players.player.trainerPoints, 1, 'milestone');
  s = battle();
  s = act(s, { type: 'playLocation', who: 'player', uid: give(s, 'player', 'cerulean-cape'), start: 0 });
  for (const sp of [0, 1]) { s.turn = 'player'; s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'horsea'), space: sp }); }
  s.players.player.row[0] = null;
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'horsea'), space: 0 });
  assert.equal(s.players.player.trainerPoints, 2, 'completion');
  assert.ok(s.events.some((e) => e.type === 'trainerPoints' && e.amount === 2));
  // A Supporter's Favour with a Trainer in play: +1. Without a Trainer: nothing.
  s = battle();
  const oak = give(s, 'player', 'professor-oak');
  const loc = give(s, 'player', 'route-119');
  let t = act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [loc] });
  assert.equal(t.players.player.trainerPoints, 0, 'Favour, but no Trainer in play');
  trainer(s, 'player', 'erika', 3);
  t = act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [loc] });
  assert.equal(t.players.player.trainerPoints, 1, 'Favour with a Trainer in play');
  t = act(s, { type: 'playSupporter', who: 'player', uid: oak, release: [give(s, 'player', 'horsea')] });
  assert.equal(t.players.player.trainerPoints, 0, 'no Favour, no point');
}

// --- The assign step: at Breakfast after drawing, simultaneous, hidden until both lock in ------------------

{
  let s = battle();
  const misty = trainer(s, 'player', 'misty', 4);
  const blaine = trainer(s, 'ai', 'blaine', 2);
  s.players.player.trainerPoints = 3;
  s.players.ai.trainerPoints = 2;
  s = passBoth(s);
  assert.deepEqual([s.phase, s.turn, s.round], ['assign', null, 2]);
  assert.equal(s.players.player.hand.length, 7, 'after drawing');
  assert.deepEqual([legalActions(s, 'player'), legalActions(s, 'ai'), actor(s)], [['assignPoints'], ['assignPoints'], 'player']);
  assert.throws(() => act(s, { type: 'assignPoints', who: 'player', points: { [misty.uid]: 4 } }), /have 3 Trainer Points/);
  assert.throws(() => act(s, { type: 'assignPoints', who: 'player', points: { [blaine.uid]: 1 } }), /your Trainers/);
  // The player locks in: nothing is applied or shown yet.
  s = act(s, { type: 'assignPoints', who: 'player', points: { [misty.uid]: 2 } });
  assert.deepEqual([s.phase, s.players.player.trainers[0].points, s.players.player.trainerPoints], ['assign', 0, 3], 'hidden until both lock in');
  assert.deepEqual(s.events.map((e) => e.type), ['assignLocked'], 'the event says only that you locked in');
  assert.deepEqual([legalActions(s, 'player'), legalActions(s, 'ai'), actor(s)], [[], ['assignPoints'], 'ai']);
  // The AI locks in: both resolve, then the Battle Phase.
  s = act(s, { type: 'assignPoints', who: 'ai', points: { [blaine.uid]: 2 } });
  assert.deepEqual([s.phase, s.players.player.trainers[0].points, s.players.player.trainerPoints, s.players.ai.trainers[0].points], ['battle', 2, 1, 2]);
  assert.deepEqual(s.events.filter((e) => e.type === 'tierUnlocked').map((e) => [e.name, e.tier]), [['Misty', 1], ['Blaine', 1]]);
  // Points stay on the Trainer, and unspent points stay in the pool.
  s = passBoth(s);
  assert.equal(s.phase, 'assign', 'the player still has a point');
  assert.equal(needsAssign(s, 'ai'), false, 'nothing to assign: no part in the step');
  s = act(s, { type: 'assignPoints', who: 'player', points: {} });
  assert.deepEqual([s.phase, s.players.player.trainers[0].points, s.players.player.trainerPoints], ['battle', 2, 1]);
  // No Trainer Points: no assign step.
  s = battle();
  trainer(s, 'player', 'misty', 4);
  s = passBoth(s);
  assert.equal(s.phase, 'battle');
}

// --- Tiers, Passives, Abilities --------------------------------------------------------------------------

{
  const t = { ...cardDef('misty'), points: 0 };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((p) => tiersUnlocked({ ...t, points: p })), [0, 0, 1, 1, 2, 2, 3]);
  // Misty's Passive: your Water Pokémon in her lane +1 Strength (not other Types; not before tier 1).
  let s = battle();
  place(s, 'player', 4, 'horsea', 3);   // 4/6 Water
  place(s, 'player', 5, 'growlithe', 3);
  const misty = trainer(s, 'player', 'misty', 4, 0);
  s = settle(s);
  assert.equal(s.players.player.row[4].strength, 6, 'locked: no bonus');
  s.players.player.trainers[0].points = 2;
  s = settle(s);
  assert.deepEqual([s.players.player.row[4].strength, s.players.player.row[4].currentStrength], [7, 7]);
  s.players.player.trainers[0].space = 5;   // over the Fire Pokémon: no bonus there, and Horsea loses it
  s = settle(s);
  assert.deepEqual([s.players.player.row[4].strength, s.players.player.row[5].strength], [6, 4]);
  assert.ok(misty);
  // Blaine's Passive: each Burn you apply +1.
  s = battle();
  trainer(s, 'player', 'blaine', 0, 2);
  place(s, 'ai', 0, 'sudowoodo', 4);
  s = act(s, { type: 'playStrategy', who: 'player', uid: give(s, 'player', 'ember'), pay: 2, targets: [mon('ai', 0)] });
  assert.equal(s.players.ai.row[0].burn, 3);
  // Brock's Passive: your Pokémon in his space: Shell 1 (each damage 1 less, minimum 1).
  s = battle();
  trainer(s, 'player', 'brock', 2, 2);
  place(s, 'player', 2, 'horsea', 5);   // 6/8
  place(s, 'ai', 0, 'growlithe', 5, {});   // Swift 6/6
  assert.equal(shellOf(s, 'player', 2), 1);
  s.turn = 'ai';
  s = act(s, { type: 'attack', who: 'ai', from: 0, target: mon('player', 2) });
  assert.equal(s.players.player.row[2].currentStrength, 8 - 5);
  s.turn = 'ai';
  s.players.ai.row[1] = null;
  s = act(s, { type: 'playStrategy', who: 'ai', uid: give(s, 'ai', 'thunderbolt'), pay: 1, targets: [mon('player', 2)] });
  assert.equal(s.players.player.row[2].currentStrength, 3 - 1, '2 damage − 1');
  // Erika's Passive: at Breakfast, your Pokémon in her lane train 1.
  s = battle();
  trainer(s, 'player', 'erika', 1, 2);
  place(s, 'player', 1, 'oddish', 2);
  s = passBoth(s);
  assert.deepEqual([s.players.player.row[1].level, s.players.player.row[1].name], [3, 'Gloom']);
  // Abilities: unlocked at tier 2, their own Energy cost, once per Round per Trainer.
  s = battle();
  const m = trainer(s, 'player', 'misty', 0, 2);
  place(s, 'player', 0, 'horsea', 5, { currentStrength: 2 });
  assert.equal(legalActions(s, 'player').includes('useAbility'), false, 'tier 1 only');
  s.players.player.trainers[0].points = 4;
  s.players.player.energy = 1;
  s = act(s, { type: 'useAbility', who: 'player', uid: m.uid, targets: [mon('player', 0)] });
  assert.deepEqual([s.players.player.row[0].currentStrength, s.players.player.energy, s.turn], [2 + 3 + 1, 0, 'ai'], 'heal 3 for 1 Energy (+1 from her Passive on this Water Pokémon)');
  s.turn = 'player';
  s.players.player.energy = 5;
  assert.throws(() => act(s, { type: 'useAbility', who: 'player', uid: m.uid, targets: [mon('player', 0)] }), /cannot useAbility|used this Round/);
  // Blaine: Burn 2 the enemy player (+1 from his own Passive).
  s = battle();
  const b = trainer(s, 'player', 'blaine', 0, 4);
  s = act(s, { type: 'useAbility', who: 'player', uid: b.uid, targets: [{ who: 'ai', kind: 'player' }] });
  assert.equal(s.players.ai.burn, 3);
  // Brock: a friendly Pokémon gains Shell 1 this Round (gone at Supper).
  s = battle();
  const br = trainer(s, 'player', 'brock', 8, 4);
  place(s, 'player', 0, 'horsea', 5);
  s = act(s, { type: 'useAbility', who: 'player', uid: br.uid, targets: [mon('player', 0)] });
  assert.equal(shellOf(s, 'player', 0), 1);
  s = passBoth(s);
  assert.equal(shellOf(s, 'player', 0), 0, 'this Round only');
  // Erika: put an enemy Pokémon to Sleep.
  s = battle();
  const er = trainer(s, 'player', 'erika', 0, 4);
  place(s, 'ai', 3, 'growlithe');
  s = act(s, { type: 'useAbility', who: 'player', uid: er.uid, targets: [mon('ai', 3)] });
  assert.equal(s.players.ai.row[3].asleep, true);
}

// --- Partners: into the Trainer's space; a chosen free space when it's taken; waiting when none is free -----

{
  const unlock = (s, who, t) => {
    s.players[who].trainerPoints = 6 - t.points;
    s = passBoth(s);
    assert.equal(s.phase, 'assign');
    s = act(s, { type: 'assignPoints', who, points: { [t.uid]: 6 - t.points } });
    return s;
  };
  // Its space is free: it arrives there at once, at its Level.
  let s = battle();
  const misty = trainer(s, 'player', 'misty', 3, 4);
  s = unlock(s, 'player', misty);
  const star = s.players.player.row[3];
  assert.deepEqual([star.name, star.level, star.partner, star.spent], ['Starmie', 4, true, true]);
  assert.ok(s.events.some((e) => e.type === 'partnerArrived' && e.name === 'Starmie' && e.space === 3));
  assert.equal(s.players.player.drawPile.concat(s.players.player.hand).some((c) => c.name === 'Starmie'), false, 'from outside the deck');
  // Its space is taken: the player chooses a free space.
  s = battle();
  const brock = trainer(s, 'player', 'brock', 2, 4);
  place(s, 'player', 2, 'horsea', 3);
  s = unlock(s, 'player', brock);
  assert.deepEqual([s.players.player.waiting.map((c) => c.name), s.players.player.row[2].name], [['Onix'], 'Seadra']);
  const waitingUid = s.players.player.waiting[0].uid;
  if (s.turn !== 'player') s = act(s, { type: 'pass', who: s.turn });
  assert.ok(legalActions(s, 'player').includes('placePartner'));
  assert.throws(() => act(s, { type: 'placePartner', who: 'player', uid: waitingUid, space: 2 }), /free space/);
  s = act(s, { type: 'placePartner', who: 'player', uid: waitingUid, space: 6 });
  assert.deepEqual([s.players.player.row[6].name, s.players.player.waiting.length, s.turn], ['Onix', 0, 'player'], 'placing it is not a Battle Action');
  // No free space: it waits, and comes at the next opportunity (when a space frees).
  s = battle();
  const erika = trainer(s, 'player', 'erika', 0, 4);
  for (let i = 0; i < LANES; i++) place(s, 'player', i, 'sudowoodo', 4);
  s = unlock(s, 'player', erika);
  if (s.turn !== 'player') s = act(s, { type: 'pass', who: s.turn });
  assert.deepEqual([s.players.player.waiting.length, legalActions(s, 'player').includes('placePartner')], [1, false], 'waiting');
  s.players.player.row[7] = null;   // a space frees
  assert.ok(legalActions(s, 'player').includes('placePartner'));
  s = act(s, { type: 'placePartner', who: 'player', uid: s.players.player.waiting[0].uid, space: 7 });
  assert.equal(s.players.player.row[7].name, 'Tangela');
  // A defeated Partner leaves the game (not to the Released Pile).
  s.players.player.row[7].currentStrength = 1;
  s.turn = 'ai';
  s = act(s, { type: 'playStrategy', who: 'ai', uid: give(s, 'ai', 'thunderbolt'), pay: 1, targets: [mon('player', 7)] });
  assert.equal(s.players.player.released.some((c) => c.name === 'Tangela'), false);
}

// --- The AI -----------------------------------------------------------------------------------------------

{
  // Plays a Trainer into a good space: Misty beside its Water Pokémon.
  let s = battle(2);
  s.turn = 'ai';
  s.players.ai.energy = 1;
  place(s, 'ai', 6, 'horsea', 2, { spent: true });
  give(s, 'ai', 'misty');
  let m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.space], ['playTrainer', 6]);
  // Assigns points to finish a tier before spreading.
  s = battle();
  const a = trainer(s, 'ai', 'blaine', 0, 1);   // 1 short of tier 1
  const b = trainer(s, 'ai', 'brock', 1, 0);
  s.players.ai.trainerPoints = 2;
  s = passBoth(s);
  m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual(m.points, { [a.uid]: 2 }, 'Blaine to tier 1 (1 point), then on toward tier 2');
  assert.ok(b);
  // Moves a Trainer when useful: Misty to its Water Pokémon.
  s = battle(3);
  s.turn = 'ai';
  s.players.ai.energy = 0;
  trainer(s, 'ai', 'misty', 0, 2);
  place(s, 'ai', 5, 'horsea', 3, { spent: true });
  m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.space], ['moveTrainer', 5]);
  // Uses Abilities: Blaine burns the enemy player.
  s = battle(3);
  s.turn = 'ai';
  s.players.ai.energy = 2;
  trainer(s, 'ai', 'blaine', 0, 4);
  m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.equal(m.type, 'useAbility');
}
{
  const N = 40;
  let points = 0;
  let tiers = 0;
  let partners = 0;
  let matchesWithPartner = 0;
  let trainersPlayed = 0;
  let abilities = 0;
  let movesMade = 0;
  for (let seed = 1; seed <= N; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    let partnerHere = false;
    for (let guard = 0; guard < 6000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      assert.ok(legalActions(s, who).includes(action.type), action.type);
      s = applyAction(s, action);
      for (const e of s.events) {
        if (e.type === 'trainerPoints') points += e.amount;
        if (e.type === 'tierUnlocked') tiers += 1;
        if (e.type === 'partnerArrived') { partners += 1; partnerHere = true; }
        if (e.type === 'trainerPlayed') trainersPlayed += 1;
        if (e.type === 'abilityUsed') abilities += 1;
        if (e.type === 'trainerMoved') movesMade += 1;
      }
    }
    assert.equal(s.phase, 'gameOver', `seed ${seed} finishes`);
    if (partnerHere) matchesWithPartner += 1;
  }
  assert.ok(trainersPlayed > 0 && tiers > 0, 'the AI plays Trainers and unlocks tiers');
  console.log(`${N} AI-vs-AI matches (both players): Trainer Points earned ${(points / N).toFixed(1)} per match; tiers unlocked ${(tiers / N).toFixed(1)} per match; Partners arrived ${partners} times (${(partners / N).toFixed(2)} per match, in ${matchesWithPartner} of ${N} matches).`);
  console.log(`Trainers played ${(trainersPlayed / N).toFixed(1)}, Abilities used ${(abilities / N).toFixed(1)}, Trainer moves ${(movesMade / N).toFixed(1)} per match.`);
}

console.log('All v2 Trainer tests passed.');
