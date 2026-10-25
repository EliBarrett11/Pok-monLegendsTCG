// Checks the quest types of docs/decks.md 2.6, each counting and completing,
// with test-only Locations. Run with: node tests/quests.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { refreshAuras, resolveEffects } from '../src/engine/effects.js';
import { inPlay } from '../src/engine/board.js';

// --- Helpers ----------------------------------------------------------------

function match() {
  let s = createGame(41);
  s = applyAction(s, { type: 'assignTrainers', who: 'player', order: ['player-trainer-ash', 'player-trainer-misty', 'player-trainer-brock'] });
  s = applyAction(s, { type: 'assignTrainers', who: 'ai', order: ['ai-trainer-ash', 'ai-trainer-misty', 'ai-trainer-brock'] });
  s = applyAction(s, { type: 'flipCoin' });
  for (const who of PLAYERS) s = applyAction(s, { type: 'mulligan', who, cardUids: [] });
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.drawPile.push(...p.hand.splice(0));
    p.baseEnergy = 10;
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'player';
  s.turn = 'player';
  return s;
}

let made = 0;
const mon = (base, extras = {}) => ({ ...cardDefinition(base), effectTrigger: null, effectText: null, ability: null, innatePower: null, uid: `test-${base}-${made++}`, ...extras });
function place(s, who, zone, space, card, { spent = true } = {}) {
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
  return { kind: 'pokemon', owner: who, zone, space };
}
const at = (s, ref) => s.players[ref.owner].zones[ref.zone].pokemon[ref.space];

// A test Location with a quest, put straight into a Location space. Its reward: 2 XP.
function location(s, who, zone, quest) {
  const loc = { uid: `loc-${made++}`, id: 'test-location', name: 'Test Location', cardType: 'Location', weatherTokens: {}, quest: { text: quest.label, ...quest }, xp: 2, effectText: 'Nothing else.', effects: [], progress: 0 };
  s.players[who].zones[zone].location = loc;
  return loc;
}
const progress = (s, who, zone) => s.players[who].zones[zone].location?.progress;
const done = (s, who, zone) => !s.players[who].zones[zone].location && s.players[who].xp >= 2;

function cast(s, who, effects, target, source = { kind: 'strategy', owner: who, uid: 'test-card', name: 'Test card' }) {
  resolveEffects(s, { who, source, label: 'Test card', target }, effects);
  return s;
}
function attack(s, from, target) {
  s.turn = from.owner;
  s.passesInARow = 0;
  return applyAction(s, { type: 'command', who: from.owner, from: { zone: from.zone, space: from.space }, target: { kind: target.kind, zone: target.zone, space: target.space } });
}
function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}
const burnAll = { op: 'burn', amount: 1, target: { mode: 'area', side: 'opponent', kinds: ['pokemon', 'trainer'] } };

// --- Apply Burn N times ---------------------------------------------------------

// One count per card burned (so an area Burn can complete it at once), any
// Burn number; Scorch counts; Burn the opponent applies doesn't.
{
  let s = match();
  location(s, 'player', 0, { label: 'Apply Burn 4 times', on: 'burn', count: 4 });
  location(s, 'ai', 0, { label: 'Apply Burn 4 times', on: 'burn', count: 4 });
  place(s, 'ai', 1, 0, mon('dragonite'));
  cast(s, 'player', [{ op: 'burn', amount: 3, target: { mode: 'targeted', side: 'opponent', kinds: ['pokemon', 'trainer'] } }], { kind: 'pokemon', owner: 'ai', zone: 1, space: 0 });
  assert.equal(progress(s, 'player', 0), 1, 'Burn 3 is one application');
  assert.equal(progress(s, 'ai', 0), 0, 'only Burn I apply');
  const me = place(s, 'player', 1, 0, mon('growlithe', { innatePower: 'Scorch 1' }), { spent: false });
  s = attack(s, me, { kind: 'pokemon', owner: 'ai', zone: 1, space: 0 });
  assert.equal(progress(s, 'player', 0), 2, 'Scorch counts');
  // An area Burn on 1 Pokémon + 3 Trainers: 4 more, completing it (the Heat Wave combo).
  location(s, 'player', 0, { label: 'Apply Burn 4 times', on: 'burn', count: 4 });
  cast(s, 'player', [burnAll]);
  assert.ok(done(s, 'player', 0), 'one area Burn completes it');
}

// --- Heal N Strength in total ----------------------------------------------------

// What you actually heal, on your own cards; not Weather, not the opponent's cards.
{
  let s = match();
  location(s, 'player', 0, { label: 'Heal 10 Strength in total', on: 'heal', count: 10 });
  const mine = place(s, 'player', 1, 0, mon('dragonite'));   // 11
  const theirs = place(s, 'ai', 1, 0, mon('dragonite'));
  at(s, mine).currentStrength = 2;
  at(s, theirs).currentStrength = 2;
  s.players.player.zones[1].trainer.strength = 10;
  const heal = (amount, target, side = 'friendly', kinds = ['pokemon', 'trainer']) => cast(s, 'player', [{ op: 'heal', amount, target: { mode: 'targeted', side, kinds } }], target);
  heal(4, mine);
  assert.equal(progress(s, 'player', 0), 4);
  heal(5, { kind: 'trainer', owner: 'player', zone: 1 });
  assert.equal(progress(s, 'player', 0), 9, 'a Trainer is one of my cards: 5 healed (10 → 15)');
  heal(9, theirs, 'opponent');
  assert.equal(progress(s, 'player', 0), 9, "healing the opponent's cards doesn't count");
  heal(9, { kind: 'trainer', owner: 'player', zone: 1 });
  assert.equal(progress(s, 'player', 0), 9, 'at full Strength: nothing healed');
  // Weather healing (Rain 8 at Supper) doesn't count.
  const wet = place(s, 'player', 2, 0, mon('horsea'));
  at(s, wet).currentStrength = 1;
  s.players.ai.zones[2].location = { uid: 'wx', name: 'Weather test', cardType: 'Location', weatherTokens: { Rain: 8 }, quest: null };
  refreshAuras(s);
  s = nextRound(s);
  assert.ok(s.players.player.zones[2].pokemon[0].currentStrength > 1, 'Rain healed it');
  assert.equal(progress(s, 'player', 0), 9, 'Weather healing does not count');
  heal(3, mine);
  assert.ok(done(s, 'player', 0), '9 + 3 ≥ 10: complete');
}

// --- Damage enemy Trainers N times with Pokémon in this Zone ------------------------

// Attacks and Overrun from my Pokémon in this Zone, and a Pokémon's own ability
// hitting a Trainer; not Burn, not Pokémon in other Zones.
{
  let s = match();
  location(s, 'player', 1, { label: 'Damage enemy Trainers 4 times with Pokémon in this Zone', on: 'trainerStrike', inZone: true, count: 4 });
  const here = place(s, 'player', 1, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 6 }), { spent: false });
  const there = place(s, 'player', 0, 0, mon('growlithe'), { spent: false });
  s = attack(s, there, { kind: 'trainer', owner: 'ai', zone: 0 });
  assert.equal(progress(s, 'player', 1), 0, 'another Zone');
  s = attack(s, here, { kind: 'trainer', owner: 'ai', zone: 2 });
  assert.equal(progress(s, 'player', 1), 1, 'an attack on a Trainer');
  at(s, here).spent = false;
  const victim = place(s, 'ai', 1, 0, mon('horsea'));
  at(s, victim).currentStrength = 1;
  s = attack(s, here, victim);
  assert.equal(progress(s, 'player', 1), 2, 'Overrun');
  cast(s, 'player', [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent', kinds: ['trainer'] } }], { kind: 'trainer', owner: 'ai', zone: 1 },
    { kind: 'pokemon', owner: 'player', zone: 1, space: 0, uid: at(s, here).uid, name: 'Growlithe' });
  assert.equal(progress(s, 'player', 1), 3, "the Pokémon's own ability");
  cast(s, 'player', [{ op: 'burn', amount: 2, target: { mode: 'targeted', side: 'opponent', kinds: ['trainer'] } }], { kind: 'trainer', owner: 'ai', zone: 2 });
  s = nextRound(s);
  assert.equal(progress(s, 'player', 1), 3, 'Burn damage has no source Pokémon');
  at(s, here).spent = false;
  s = attack(s, here, { kind: 'trainer', owner: 'ai', zone: 1 });
  assert.ok(done(s, 'player', 1));
}

// --- Defeat N enemy Pokémon --------------------------------------------------------

// Defeated by my cards or effects, on anyone's turn: my attack, my Pokémon's
// hit back in a trade, Burn I applied. Not Weather.
{
  let s = match();
  location(s, 'player', 0, { label: 'Defeat 4 enemy Pokémon', on: 'defeat', count: 4 });
  const me = place(s, 'player', 0, 0, mon('growlithe', { attackValue: 9, strengthValue: 30 }), { spent: false });
  const a = place(s, 'ai', 0, 0, mon('horsea'));
  s = attack(s, me, a);
  assert.equal(progress(s, 'player', 0), 1, 'my attack');
  // The opponent attacks my Alert Pokémon on its turn; my hit back defeats it.
  at(s, me).spent = false;
  const b = place(s, 'ai', 1, 0, mon('growlithe'), { spent: false });
  s = attack(s, b, me);
  assert.equal(at(s, b), null);
  assert.equal(progress(s, 'player', 0), 2, 'a trade on their turn');
  // Burn I applied.
  const c = place(s, 'ai', 2, 0, mon('horsea'));
  at(s, c).currentStrength = 1;
  cast(s, 'player', [{ op: 'burn', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], c);
  // Weather (Sun 8 at Breakfast) defeating one doesn't count.
  const d = place(s, 'ai', 2, 1, mon('horsea'));
  at(s, d).currentStrength = 1;
  s.players.ai.zones[1].location = { uid: 'wx', name: 'Weather test', cardType: 'Location', weatherTokens: { Sun: 8 }, quest: null };
  refreshAuras(s);
  s = nextRound(s);
  assert.equal(at(s, c), null);
  assert.equal(at(s, d), null);
  assert.equal(progress(s, 'player', 0), 3, 'Burn counts, Weather does not');
  const e = place(s, 'ai', 0, 0, mon('horsea'));
  at(s, e).currentStrength = 1;
  cast(s, 'player', [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], e);
  assert.ok(done(s, 'player', 0), 'my effect: the 4th');
}

// --- Have N friendly Pokémon in this Zone at Supper ------------------------------------

// Checked at each Supper, after On Supper (so Pokémon Burn just defeated don't
// count); completes when it's true then.
{
  let s = match();
  location(s, 'player', 2, { label: 'Have 3 friendly Pokémon in this Zone at Supper', on: 'presence', inZone: true, count: 3 });
  place(s, 'player', 2, 0, mon('dragonite'));
  place(s, 'player', 2, 1, mon('dragonite'));
  const weak = place(s, 'player', 2, 2, mon('horsea'));
  at(s, weak).currentStrength = 1;
  cast(s, 'ai', [{ op: 'burn', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], weak);
  s = nextRound(s);
  assert.equal(at(s, weak), null, 'Burn defeated it at Supper');
  assert.equal(progress(s, 'player', 2), 2, 'checked after Burn: 2 of 3');
  place(s, 'player', 2, 2, mon('horsea'));
  assert.equal(progress(s, 'player', 2), 2, 'only checked at Supper');
  s = nextRound(s);
  assert.ok(done(s, 'player', 2), '3 at Supper: complete');
}

// --- Summon N Pokémon into this Zone -------------------------------------------------

{
  let s = match();
  location(s, 'player', 1, { label: 'Summon 2 Pokémon into this Zone', on: 'summon', inZone: true, count: 2 });
  const give = () => { const c = mon('pidgey'); s.players.player.hand.push(c); return c.uid; };
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: give(), zone: 0, space: 0 });
  assert.equal(progress(s, 'player', 1), 0, 'another Zone');
  s.turn = 'player';
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: give(), zone: 1, space: 0 });
  assert.equal(progress(s, 'player', 1), 1);
  // A free summon counts too.
  const uid = give();
  cast(s, 'player', [{ op: 'freeSummon', filter: {} }]);
  s = applyAction(s, { type: 'resolveChoice', who: 'player', uids: [uid] });
  s = applyAction(s, { type: 'resolveChoice', who: 'player', zone: 1, space: 1 });
  assert.ok(done(s, 'player', 1));
}

console.log('All quest type tests passed.');
