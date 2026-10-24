// Checks the Innate Powers Scorch X, Overrun, Regenerate X and Shell X, and
// the Trigger Words On Knockout, On Trainer Strike, Rally and On Heal, with
// test-only cards. Run with: node tests/innate.test.js
import assert from 'node:assert/strict';
import { createGame, applyAction, PLAYERS } from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { ability } from '../src/engine/cardData.js';
import { refreshAuras, resolveEffects } from '../src/engine/effects.js';
import { inPlay } from '../src/engine/board.js';
import { statusCount } from '../src/engine/status.js';
import { parseKeywords, keywordAmount, hasKeyword, keywordSummary, afterShell } from '../src/engine/keywords.js';

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
function mon(base, extras = {}) {
  return { ...cardDefinition(base), effectTrigger: null, effectText: null, ability: null, innatePower: null, uid: `test-${base}-${made++}`, ...extras };
}

function place(s, who, zone, space, card, { spent = true } = {}) {
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
  return { kind: 'pokemon', owner: who, zone, space };
}

const at = (s, ref) => (ref.kind === 'trainer' ? s.players[ref.owner].zones[ref.zone].trainer : s.players[ref.owner].zones[ref.zone].pokemon[ref.space]);
const trainerRef = (who, zone) => ({ kind: 'trainer', owner: who, zone });

function attack(s, from, target) {
  s.turn = from.owner;
  s.passesInARow = 0;
  return applyAction(s, { type: 'command', who: from.owner, from: { zone: from.zone, space: from.space }, target: { kind: target.kind, zone: target.zone, space: target.space } });
}

function cast(s, who, effects, target) {
  resolveEffects(s, { who, source: { kind: 'strategy', owner: who, uid: 'test-card', name: 'Test card' }, label: 'Test card', target }, effects);
}

function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}

// An ability that only says it fired (gains 1 Energy), to watch Trigger Words.
const marker = (word) => ability(word, 'Gain 1 extra Base Energy this Round.', [{ op: 'gainEnergy', amount: 1 }]);
const fired = (s, word, uid) => s.events.filter((e) => e.type === 'abilityTriggered' && e.word === word && (!uid || e.source.uid === uid)).length;
const damageTo = (s, uid) => s.events.filter((e) => e.type === 'damage' && e.target.uid === uid);

// --- Keywords ---------------------------------------------------------------------

assert.deepEqual(parseKeywords('Overrun, Scorch 2'), [{ key: 'Overrun' }, { key: 'Scorch', amount: 2 }]);
assert.deepEqual(parseKeywords(null), []);
{
  // Numbered keywords add up; ones without a number don't stack.
  const c = mon('growlithe', { innatePower: 'Scorch 1, Overrun', granted: [{ key: 'Scorch', amount: 1 }, { key: 'Overrun' }, { key: 'Shell', amount: 2 }] });
  assert.equal(keywordAmount(c, 'Scorch'), 2);
  assert.ok(hasKeyword(c, 'Overrun'));
  assert.deepEqual(keywordSummary(c), [{ key: 'Scorch', amount: 2 }, { key: 'Overrun' }, { key: 'Shell', amount: 2 }]);
  // Shell: reduced by X, to a minimum of 1; no damage stays none.
  assert.deepEqual([5, 3, 2, 1, 0].map((n) => afterShell(c, n)), [3, 1, 1, 1, 0]);
}

// --- Scorch X -------------------------------------------------------------------------

// The attack's damage applies Burn X to the target, if it's still in play.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Scorch 2' }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('dragonite'));
  s = attack(s, me, foe);
  assert.equal(statusCount(at(s, foe), 'burn'), 2);
  assert.equal(at(s, foe).status.burn.by, 'player');
  assert.ok(s.events.some((e) => e.type === 'scorch'));
}
// On a Trainer too.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Scorch 1' }), { spent: false });
  s = attack(s, me, trainerRef('ai', 1));
  assert.equal(statusCount(at(s, trainerRef('ai', 1)), 'burn'), 1);
}
// Not if the target was defeated; not with no damage; not when hitting back in a trade.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Scorch 2' }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('horsea'));
  at(s, foe).currentStrength = 2;
  s = attack(s, me, foe);
  assert.equal(at(s, foe), null);
  assert.ok(!s.events.some((e) => e.type === 'scorch' || e.type === 'statusApplied'));

  let t = match();
  const weak = place(t, 'player', 0, 0, mon('growlithe', { innatePower: 'Scorch 2', attackValue: 0 }), { spent: false });
  const foe2 = place(t, 'ai', 0, 0, mon('dragonite'));
  t = attack(t, weak, foe2);
  assert.equal(statusCount(at(t, foe2), 'burn'), 0, 'Attack 0 deals no damage: no Scorch');

  let u = match();
  const plain = place(u, 'player', 0, 0, mon('growlithe', { strengthValue: 20 }), { spent: false });
  place(u, 'ai', 0, 0, mon('growlithe', { innatePower: 'Scorch 3' }), { spent: false });   // Alert: trades
  u = attack(u, plain, { kind: 'pokemon', owner: 'ai', zone: 0, space: 0 });
  assert.equal(statusCount(at(u, plain), 'burn'), 0, 'hitting back in a trade is not its attack');
}

// --- Overrun ---------------------------------------------------------------------------

// Damage left over beyond the defeated Pokémon's remaining Strength hits the
// Trainer in that Zone on the defender's side; it counts as this Pokémon's
// damage (On Trainer Strike).
{
  let s = match();
  const me = place(s, 'player', 1, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 6, ...marker('On Trainer Strike') }), { spent: false });
  const foe = place(s, 'ai', 1, 0, mon('horsea'));
  at(s, foe).currentStrength = 2;
  const misty = trainerRef('ai', 1);
  const before = at(s, misty).strength;
  s = attack(s, me, foe);
  assert.equal(at(s, foe), null);
  assert.equal(at(s, misty).strength, before - 4, '6 − 2 left over');
  assert.ok(s.events.some((e) => e.type === 'overrun' && e.amount === 4));
  assert.equal(fired(s, 'On Trainer Strike'), 1);
  // Order: the defeat first, then Overrun.
  const i = (type) => s.events.findIndex((e) => e.type === type);
  assert.ok(i('defeated') < i('overrun'));
}
// Shell on the defender reduces the hit first, so less is left over.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 6 }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('horsea', { innatePower: 'Shell 1' }));
  at(s, foe).currentStrength = 3;
  s = attack(s, me, foe);
  assert.equal(at(s, trainerRef('ai', 0)).strength, 15 - 2, '6 − 1 Shell = 5 dealt, 3 needed: 2 left over');
}
// Nothing left over (exact), a removed Trainer, a surviving defender: no Overrun.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 4 }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('horsea'));
  at(s, foe).currentStrength = 4;
  s = attack(s, me, foe);
  assert.ok(!s.events.some((e) => e.type === 'overrun'));

  let t = match();
  const me2 = place(t, 'player', 0, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 9 }), { spent: false });
  const foe2 = place(t, 'ai', 0, 0, mon('horsea'));
  at(t, foe2).currentStrength = 1;
  at(t, trainerRef('ai', 0)).strength = 0;
  t = attack(t, me2, foe2);
  assert.ok(!t.events.some((e) => e.type === 'overrun'), 'lost if that Trainer has been removed');
  assert.ok(t.log.some((l) => l.includes('is lost')));
}
// The attacker defeated in the same trade: Overrun still happens, but it's
// no longer in the arena, so no On Trainer Strike.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Overrun', attackValue: 8, ...marker('On Trainer Strike') }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('growlithe', { attackValue: 9 }), { spent: false });
  at(s, foe).currentStrength = 3;
  s = attack(s, me, foe);
  assert.equal(at(s, me), null);
  assert.equal(at(s, trainerRef('ai', 0)).strength, 15 - 5);
  assert.equal(fired(s, 'On Trainer Strike'), 0);
}

// --- Shell X ----------------------------------------------------------------------------

// Every instance of damage is reduced by X, to a minimum of 1: attacks, effects, Burn.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { attackValue: 5 }), { spent: false });
  const tank = place(s, 'ai', 0, 0, mon('dragonite', { innatePower: 'Shell 2' }));   // 11
  s = attack(s, me, tank);
  assert.equal(at(s, tank).currentStrength, 11 - 3);
  const hit = damageTo(s, at(s, tank).uid)[0];
  assert.deepEqual([hit.raw, hit.amount, hit.shell], [5, 3, 2], 'the event shows the reduced number');
  cast(s, 'player', [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], tank);
  assert.equal(at(s, tank).currentStrength, 8 - 1, 'never below 1');
  cast(s, 'player', [{ op: 'burn', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], tank);
  s = nextRound(s);
  assert.equal(at(s, tank).currentStrength, 7 - 1, 'Burn 1 against Shell 2 still deals 1');
}
// The attacker's own Shell reduces the hit back in a trade.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Shell 1', strengthValue: 10 }), { spent: false });
  place(s, 'ai', 0, 0, mon('growlithe', { attackValue: 4, strengthValue: 20 }), { spent: false });
  s = attack(s, me, { kind: 'pokemon', owner: 'ai', zone: 0, space: 0 });
  assert.equal(at(s, me).currentStrength, 10 - 3);
}

// --- Regenerate X -------------------------------------------------------------------------

// At Breakfast it heals X (capped), with On Breakfast abilities, ahead of its own;
// at full Strength nothing happens (no heal, no tag).
{
  let s = match();
  const slug = place(s, 'player', 0, 0, mon('quagsire', { innatePower: 'Regenerate 2', ...marker('On Breakfast') }));   // 8
  const full = place(s, 'player', 0, 1, mon('quagsire', { innatePower: 'Regenerate 2' }));
  at(s, slug).currentStrength = 3;
  s = nextRound(s);
  assert.equal(at(s, slug).currentStrength, 5);
  assert.equal(at(s, full).currentStrength, 8);
  assert.equal(fired(s, 'Regenerate 2', at(s, slug).uid), 1);
  assert.equal(fired(s, 'Regenerate 2', at(s, full).uid), 0, 'at full Strength: nothing');
  const order = s.events.filter((e) => e.type === 'abilityTriggered').map((e) => e.word);
  assert.ok(order.indexOf('Regenerate 2') < order.indexOf('On Breakfast'), 'Regenerate before its own On Breakfast');
  at(s, slug).currentStrength = 7;
  s = nextRound(s);
  assert.equal(at(s, slug).currentStrength, 8, 'capped at maximum Strength');
}
// After the Breakfast Weather: Sun 8 damage, then Regenerate heals it.
{
  let s = match();
  const slug = place(s, 'player', 0, 0, mon('quagsire', { innatePower: 'Regenerate 1' }));
  s.players.ai.zones[0].location = { uid: 'wx', name: 'Weather test', cardType: 'Location', weatherTokens: { Sun: 8 }, quest: null };
  refreshAuras(s);
  s = nextRound(s);
  assert.equal(at(s, slug).currentStrength, 8, 'Sun 8 −1, then Regenerate +1');
}

// --- On Knockout ----------------------------------------------------------------------------

// Its attack defeats an enemy Pokémon.
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', marker('On Knockout')), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('horsea'));
  at(s, foe).currentStrength = 1;
  s = attack(s, me, foe);
  assert.equal(fired(s, 'On Knockout'), 1);
  // After On Defeated.
  const ev = s.events.map((e) => e.type);
  assert.ok(ev.indexOf('defeated') < ev.indexOf('abilityTriggered'));
}
// Its hit back in a trade defeats the attacker; an attacker defeated in the same
// trade gets no On Knockout (it has left the arena).
{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', { attackValue: 9, ...marker('On Knockout') }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('growlithe', { attackValue: 9, ...marker('On Knockout') }), { spent: false });
  const foeUid = at(s, foe).uid;
  s = attack(s, me, foe);
  assert.equal(at(s, me), null);
  assert.equal(at(s, foe), null);
  assert.equal(fired(s, 'On Knockout'), 0, 'both defeated: neither is still in the arena');

  let t = match();
  const me2 = place(t, 'player', 0, 0, mon('growlithe', { attackValue: 1 }), { spent: false });
  const foe2 = place(t, 'ai', 0, 0, mon('growlithe', { attackValue: 9, ...marker('On Knockout') }), { spent: false });
  t = attack(t, me2, foe2);
  assert.equal(at(t, me2), null);
  assert.equal(fired(t, 'On Knockout', at(t, foe2).uid), 1, 'the trade\'s hit back counts');
  assert.ok(foeUid);
}
// Its own ability's damage defeats an enemy Pokémon (one per Pokémon defeated).
{
  let s = match();
  // The watcher deals damage through an ability of its own (resolved with it as the source).
  const watcher = mon('growlithe', { uid: 'test-watcher', ...marker('On Knockout') });
  const a = place(s, 'ai', 0, 0, mon('horsea'));
  const b = place(s, 'ai', 0, 1, mon('horsea'));
  at(s, a).currentStrength = 1;
  at(s, b).currentStrength = 1;
  place(s, 'player', 0, 0, watcher);
  resolveEffects(s, { who: 'player', source: { kind: 'pokemon', owner: 'player', zone: 0, space: 0, uid: 'test-watcher', name: 'Growlithe' }, label: 'Test ability' },
    [{ op: 'damage', amount: 1, target: { mode: 'area', side: 'opponent', zone: 'source' } }]);
  assert.equal(at(s, a), null);
  assert.equal(at(s, b), null);
  assert.equal(fired(s, 'On Knockout', 'test-watcher'), 2);
}
// Burn defeats have no source Pokémon: no On Knockout.
{
  let s = match();
  place(s, 'player', 0, 0, mon('growlithe', { innatePower: 'Scorch 3', ...marker('On Knockout') }), { spent: false });
  const foe = place(s, 'ai', 0, 0, mon('dragonite'));
  s = attack(s, { kind: 'pokemon', owner: 'player', zone: 0, space: 0 }, foe);
  at(s, foe).currentStrength = 1;
  s = nextRound(s);
  assert.equal(at(s, foe), null, 'defeated by Burn');
  assert.equal(fired(s, 'On Knockout'), 0);
}

// --- On Trainer Strike --------------------------------------------------------------------

{
  let s = match();
  const me = place(s, 'player', 0, 0, mon('growlithe', marker('On Trainer Strike')), { spent: false });
  s = attack(s, me, trainerRef('ai', 2));
  assert.equal(fired(s, 'On Trainer Strike'), 1);
  // Not for attacking a Pokémon, and not for effect damage to a Trainer.
  let t = match();
  const me2 = place(t, 'player', 0, 0, mon('growlithe', marker('On Trainer Strike')), { spent: false });
  t = attack(t, me2, place(t, 'ai', 0, 0, mon('dragonite')));
  assert.equal(fired(t, 'On Trainer Strike'), 0);
}

// --- Rally ---------------------------------------------------------------------------------

// Another friendly Pokémon summoned into its Zone (same side) — not itself,
// not another Zone, not the opponent's side.
{
  let s = match();
  const rally = place(s, 'player', 1, 0, mon('horsea', marker('Rally')));
  const rallyUid = at(s, rally).uid;
  const give = (who, id) => {
    const c = mon(id);
    s.players[who].hand.push(c);
    return c.uid;
  };
  s.turn = 'player';
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: give('player', 'growlithe'), zone: 1, space: 1 });
  assert.equal(fired(s, 'Rally', rallyUid), 1, 'friendly, same Zone');
  s.turn = 'player';
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: give('player', 'growlithe'), zone: 2, space: 0 });
  assert.equal(fired(s, 'Rally'), 0, 'another Zone');
  s.turn = 'ai';
  s = applyAction(s, { type: 'playPokemon', who: 'ai', uid: give('ai', 'growlithe'), zone: 1, space: 0 });
  assert.equal(fired(s, 'Rally'), 0, 'the opponent\'s side');
  // Itself being summoned is not a Rally.
  const self = mon('horsea', marker('Rally'));
  s.players.player.hand.push(self);
  s.turn = 'player';
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: self.uid, zone: 0, space: 0 });
  assert.equal(fired(s, 'Rally'), 0, 'not itself');
}

// --- On Heal --------------------------------------------------------------------------------

// Healed by at least 1; healing at full Strength is not a heal.
{
  const s = match();
  const pud = place(s, 'player', 0, 0, mon('horsea', marker('On Heal')));
  const heal = () => cast(s, 'player', [{ op: 'heal', amount: 3, target: { mode: 'targeted', side: 'friendly' } }], pud);
  s.events = [];
  heal();
  assert.equal(fired(s, 'On Heal'), 0, 'at full Strength');
  at(s, pud).currentStrength = 5;
  s.events = [];
  heal();
  assert.equal(at(s, pud).currentStrength, 6);
  assert.equal(fired(s, 'On Heal'), 1, 'healed by 1');
}
// Regenerate's heal counts.
{
  let s = match();
  const v = place(s, 'player', 0, 0, mon('quagsire', { innatePower: 'Regenerate 2', ...marker('On Heal') }));
  at(s, v).currentStrength = 1;
  s = nextRound(s);
  assert.equal(fired(s, 'On Heal', at(s, v).uid), 1);
}

console.log('All Innate Power and Trigger Word tests passed.');
