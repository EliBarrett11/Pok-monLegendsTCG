// Checks the card keywords and effect types of docs/decks.md 2.4: Retain,
// Search, Return, free summons, cost reductions (Wallace-style, by Zone) and
// "becomes Active", with test-only cards. Run with: node tests/hand.test.js
import assert from 'node:assert/strict';
import {
  createGame, applyAction, PLAYERS, legalActions, playablePokemon, summonCost, costPreview, isAlert,
} from '../src/engine/game.js';
import { cardDefinition } from '../src/engine/cards.js';
import { ability } from '../src/engine/cardData.js';
import { refreshAuras, resolveEffects, canResolve } from '../src/engine/effects.js';
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
    p.trainers.forEach((t) => { t.passive = { text: '' }; });
    for (const c of p.drawPile) c.ability = null;
  }
  s.initiative = 'player';
  s.turn = 'player';
  return s;
}

let made = 0;
const mon = (base, extras = {}) => ({ ...cardDefinition(base), effectTrigger: null, effectText: null, ability: null, innatePower: null, uid: `test-${base}-${made++}`, ...extras });
const strategy = (name, effects, extras = {}) => ({ id: `test-${name}`, name, cardType: 'Strategy', energyCost: 1, image: null, rarity: 'Common', effectText: name, effects, uid: `test-${name}-${made++}`, ...extras });

function place(s, who, zone, space, card, { spent = true } = {}) {
  s.players[who].zones[zone].pokemon[space] = inPlay(card, { spent });
  refreshAuras(s);
  return { kind: 'pokemon', owner: who, zone, space };
}
const at = (s, ref) => s.players[ref.owner].zones[ref.zone].pokemon[ref.space];

// Effects from a test card of `who`; returns the state (a choice may be pending).
function cast(s, who, effects, target) {
  resolveEffects(s, { who, source: { kind: 'strategy', owner: who, uid: 'test-card', name: 'Test card' }, label: 'Test card', target }, effects);
  return s;
}
const choose = (s, choice) => applyAction(s, { type: 'resolveChoice', who: s.pending.who, ...choice });

function nextRound(s) {
  s.turn = 'player';
  s.passesInARow = 0;
  s = applyAction(s, { type: 'pass', who: 'player' });
  return applyAction(s, { type: 'pass', who: 'ai' });
}
const handIds = (s, who = 'player') => s.players[who].hand.map((c) => c.uid);

// --- Retain -------------------------------------------------------------------

// Printed Retain: the card stays in hand at Supper; the rest is discarded.
// There's no hand size limit: the next Breakfast still draws 7.
{
  let s = match();
  const keep = strategy('Keeper', [], { retain: true });
  const lose = strategy('Loser', []);
  s.players.player.hand.push(keep, lose);
  s = nextRound(s);
  assert.ok(handIds(s).includes(keep.uid), 'Retain: kept at Supper');
  assert.ok(s.players.player.discard.some((c) => c.uid === lose.uid), 'the rest is discarded');
  assert.equal(s.players.player.hand.length, 8, '7 drawn + 1 kept: hands can grow above 7');
  assert.ok(s.events.some((e) => e.type === 'retained' && e.who === 'player' && e.uids.includes(keep.uid)));
  s = nextRound(s);
  assert.ok(handIds(s).includes(keep.uid), 'printed Retain keeps working');
  assert.equal(s.players.player.hand.length, 8, 'the other 7 were discarded again');
}

// Granted Retain lasts until the card leaves your hand; a kept Pokémon keeps its XP.
{
  let s = match();
  const pud = mon('horsea', { xp: { attack: 1, strength: 2 } });
  s.players.player.hand.push(pud);
  cast(s, 'player', [{ op: 'retain', target: { mode: 'targeted', side: 'friendly', kinds: ['handCard'] } }], { kind: 'hand', owner: 'player', uid: pud.uid });
  assert.ok(s.players.player.hand.find((c) => c.uid === pud.uid).retainGranted);
  s = nextRound(s);
  s = nextRound(s);
  const kept = s.players.player.hand.find((c) => c.uid === pud.uid);
  assert.ok(kept, 'still kept, two Suppers later');
  assert.deepEqual(kept.xp, { attack: 1, strength: 2 }, 'its XP buffs stay');
  // Once it leaves the hand (here: discarded to pay, then Returned), Retain is gone.
  const p = s.players.player;
  p.hand = p.hand.filter((c) => c.uid !== pud.uid);
  p.discard.push(kept);
  s = cast(s, 'player', [{ op: 'return', filter: { cardType: 'Pokémon', id: 'horsea' } }]);
  s = choose(s, { uids: [pud.uid] });
  assert.ok(!s.players.player.hand.find((c) => c.uid === pud.uid).retainGranted, 'a returned card starts without it');
}

// The opponent's Retain works the same, and its hand stays hidden in the log.
{
  let s = match();
  const card = strategy('Theirs', []);
  s.players.ai.hand.push(card);
  cast(s, 'ai', [{ op: 'retain', target: { mode: 'targeted', side: 'friendly', kinds: ['handCard'] } }], { kind: 'hand', owner: 'ai', uid: card.uid });
  assert.ok(s.log.at(-1).includes('a card in hand gains Retain'));
  s = nextRound(s);
  assert.ok(handIds(s, 'ai').includes(card.uid));
}

// --- Search ---------------------------------------------------------------------

// Choose a matching card from the Draw Pile (only matching ones are offered),
// put it in your hand, then shuffle the Draw Pile.
{
  let s = match();
  const p = s.players.player;
  const before = p.drawPile.map((c) => c.uid);
  const water = p.drawPile.filter((c) => c.pokemonType === 'Water').map((c) => c.uid);
  s = cast(s, 'player', [{ op: 'search', filter: { cardType: 'Pokémon', pokemonType: 'Water' }, retain: true }]);
  assert.equal(s.pending.kind, 'pick');
  assert.equal(s.pending.from, 'draw');
  assert.deepEqual([...s.pending.options].sort(), [...water].sort(), 'only the matching cards');
  assert.throws(() => choose(s, { uids: [] }), /Choose 1 card/);
  assert.throws(() => choose(s, { uids: [before.find((u) => !water.includes(u))] }), /matching/);
  s = choose(s, { uids: [water[1]] });
  const q = s.players.player;
  const got = q.hand.find((c) => c.uid === water[1]);
  assert.ok(got, 'into the hand');
  assert.ok(got.retainGranted, '"it gains Retain"');
  assert.ok(s.events.some((e) => e.type === 'shuffledDraw'), 'the Draw Pile is shuffled');
  const rest = before.filter((u) => u !== water[1]);
  assert.notDeepEqual(q.drawPile.map((c) => c.uid), rest, 'its order changed');
  assert.deepEqual([...q.drawPile.map((c) => c.uid)].sort(), [...rest].sort(), 'same cards');
  assert.ok(s.events.some((e) => e.type === 'searched' && e.cards[0].name === got.name), 'the found card is shown');
}
// Search for two; only one matches: it takes that one.
{
  let s = match();
  const p = s.players.player;
  const lone = p.drawPile.find((c) => c.id === 'dragonite');
  p.drawPile = p.drawPile.filter((c) => c.id !== 'dragonite' || c === lone);
  s = cast(s, 'player', [{ op: 'search', filter: { id: 'dragonite' }, count: 2 }]);
  assert.deepEqual([s.pending.min, s.pending.max], [1, 1]);
  s = choose(s, { uids: [lone.uid] });
  assert.ok(handIds(s).includes(lone.uid));
}
// None match: nothing happens and the Draw Pile is not shuffled. An empty
// Draw Pile is not refilled from the Discard Pile for a Search.
{
  const s = match();
  const p = s.players.player;
  const order = p.drawPile.map((c) => c.uid);
  cast(s, 'player', [{ op: 'search', filter: { name: 'Nothing like it' } }]);
  assert.equal(s.pending, null);
  assert.deepEqual(p.drawPile.map((c) => c.uid), order, 'not shuffled');
  assert.ok(s.events.some((e) => e.type === 'searchNone'));
  p.discard.push(...p.drawPile.splice(0));
  cast(s, 'player', [{ op: 'search', filter: { cardType: 'Pokémon' } }]);
  assert.equal(s.pending, null, 'only the Draw Pile is searched');
  assert.equal(p.drawPile.length, 0);
  // A Search card can still be played: the Draw Pile is hidden.
  assert.ok(canResolve(s, { who: 'player', source: { kind: 'strategy' } }, [{ op: 'search', filter: { name: 'Nothing like it' } }]));
}

// --- Return ---------------------------------------------------------------------

// From the Discard Pile only, never the Released Pile.
{
  let s = match();
  const p = s.players.player;
  const gone = mon('absol');
  const old = mon('pidgey');
  p.released.push(gone);
  p.discard.push(old, strategy('Junk', []));
  s = cast(s, 'player', [{ op: 'return', filter: { cardType: 'Pokémon' } }]);
  assert.deepEqual(s.pending.options, [old.uid], 'the Released Pile is never offered');
  assert.equal(s.pending.from, 'discard');
  s = choose(s, { uids: [old.uid] });
  assert.ok(handIds(s).includes(old.uid));
  assert.ok(s.players.player.released.some((c) => c.uid === gone.uid), 'the Released card stays');
  assert.ok(s.events.some((e) => e.type === 'returned'));
}
// A Return card can't be played with nothing to Return (the Discard Pile is
// public); "up to" can, and may take fewer (even none).
{
  let s = match();
  const p = s.players.player;
  p.released.push(mon('absol'));
  const ctx = { who: 'player', source: { kind: 'strategy' } };
  assert.ok(!canResolve(s, ctx, [{ op: 'return', filter: { cardType: 'Pokémon' } }]), 'only Released matches: unplayable');
  assert.ok(canResolve(s, ctx, [{ op: 'return', filter: { cardType: 'Pokémon' }, upTo: true, count: 2 }]));
  const card = strategy('Dive', [{ op: 'return', filter: { cardType: 'Pokémon' } }]);
  p.hand.push(card);
  assert.ok(!legalActions(s, 'player').includes('playStrategy'), 'not offered as a move');
  p.discard.push(mon('pidgey'), mon('geodude'));
  s = cast(s, 'player', [{ op: 'return', filter: { cardType: 'Pokémon' }, upTo: true, count: 2 }]);
  assert.deepEqual([s.pending.min, s.pending.max], [0, 2]);
  s = choose(s, { uids: [] });
  assert.equal(s.players.player.discard.filter((c) => c.cardType === 'Pokémon').length, 2, 'took none');
}

// --- Free summon ------------------------------------------------------------------

// Summon a matching Pokémon from hand for free: normal summon rules (arrives
// Spent, On Summon, Rally, quests); "costing 2 or less" is the printed cost.
{
  let s = match();
  const p = s.players.player;
  p.baseEnergy = 0;
  const rally = place(s, 'player', 1, 0, mon('quagsire', ability('Rally', 'Gain 1.', [{ op: 'gainEnergy', amount: 1 }])));
  const cheap = mon('pidgey', ability('On Summon', 'Gain 1.', [{ op: 'gainEnergy', amount: 1 }]));
  const pricey = mon('absol');
  p.hand.push(cheap, pricey);
  p.zones[1].location = { uid: 'loc', name: 'Test Cape', cardType: 'Location', quest: { text: 'Summon 1 Pokémon into this Zone.', label: 'Summon here', on: 'summon', inZone: true, count: 5 }, xp: 1, effects: [], progress: 0 };
  s = cast(s, 'player', [{ op: 'freeSummon', filter: { energyCost: { max: 2 } } }]);
  assert.deepEqual(s.pending.options, [cheap.uid], 'only Pokémon costing 2 or less');
  s = choose(s, { uids: [cheap.uid] });
  assert.equal(s.pending.kind, 'freeSummon');
  s = choose(s, { zone: 1, space: 1 });
  const summoned = s.players.player.zones[1].pokemon[1];
  assert.equal(summoned.uid, cheap.uid);
  assert.equal(summoned.spent, true, 'arrives Spent');
  const words = s.events.filter((e) => e.type === 'abilityTriggered').map((e) => e.word);
  assert.ok(words.includes('On Summon') && words.includes('Rally'), 'On Summon and Rally fire');
  assert.equal(s.players.player.baseEnergy, 2, 'paid nothing (each trigger gained 1)');
  assert.equal(s.players.player.zones[1].location.progress, 1, 'quests count it');
  assert.ok(at(s, rally));
}
// It may be declined; "it arrives Active" (a Gift Bonus) makes it Active.
{
  let s = match();
  const a = mon('pidgey');
  s.players.player.hand.push(a);
  s = cast(s, 'player', [{ op: 'freeSummon', filter: { energyCost: { max: 2 } } }]);
  s = choose(s, { uids: [] });
  assert.ok(handIds(s).includes(a.uid), 'declined');
  s = cast(s, 'player', [{ op: 'freeSummon', filter: { energyCost: { max: 2 } }, active: true }]);
  s = choose(s, { uids: [a.uid] });
  s = choose(s, { zone: 0, space: 0 });
  assert.equal(s.players.player.zones[0].pokemon[0].spent, false, 'arrives Active');
}

// --- Cost reduction ----------------------------------------------------------------

// A Wallace-style Passive: the first Pokémon you summon into his Zone each
// Round costs 1 less. Only that Zone, only the first summon each Round.
{
  let s = match();
  const p = s.players.player;
  p.zones[2].trainer.passive = { text: 'The first Pokémon you summon into this Zone each Round costs 1 less.', cost: { amount: 1, first: true } };
  const geo = mon('geodude');   // cost 2
  const geo2 = mon('geodude');
  p.hand.push(geo, geo2);
  assert.equal(summonCost(s, 'player', geo, 2), 1);
  assert.equal(summonCost(s, 'player', geo, 0), 2, 'other Zones: full cost');
  assert.equal(geo.energyCost, 2, 'the printed cost never changes');
  // Affordability uses the reduced cost: with 1 Energy it can only go into Zone 3.
  p.baseEnergy = 1;
  p.exhaust = [{ position: 1, spentRound: 1, recoversRound: 3 }];   // no Exert left
  assert.ok(playablePokemon(s, 'player').some((c) => c.uid === geo.uid));
  assert.deepEqual(costPreview(s, 'player', geo.uid, 2), { fromBase: 1, fromExert: 0 });
  assert.throws(() => applyAction(s, { type: 'playPokemon', who: 'player', uid: geo.uid, zone: 0, space: 0 }), /Not enough Energy/);
  s = applyAction(s, { type: 'playPokemon', who: 'player', uid: geo.uid, zone: 2, space: 0 });
  assert.equal(s.players.player.baseEnergy, 0, 'paid 1');
  assert.ok(s.log.some((l) => l.includes('cost 2 → 1')));
  // The second summon there this Round pays full price.
  assert.equal(summonCost(s, 'player', s.players.player.hand.find((c) => c.uid === geo2.uid), 2), 2);
  s = nextRound(s);   // (geo2 was discarded at Supper; the Zone's reduction is what's checked)
  assert.equal(summonCost(s, 'player', geo2, 2), 1, 'again next Round');
}
// A free summon into the Zone uses up the first summon; reductions stack and never go below 0.
{
  let s = match();
  const p = s.players.player;
  p.zones[0].trainer.passive = { text: '', cost: { amount: 1, first: true } };
  const free = mon('pidgey');
  const next = mon('shinx');   // cost 1
  p.hand.push(free, next);
  s = cast(s, 'player', [{ op: 'freeSummon', filter: {} }]);
  s = choose(s, { uids: [free.uid] });
  s = choose(s, { zone: 0, space: 0 });
  assert.equal(summonCost(s, 'player', s.players.player.hand.find((c) => c.uid === next.uid), 0), 1, 'the free summon was the first');
  const t = match();
  t.players.player.zones[1].trainer.passive = { text: '', cost: { amount: 1, first: true } };
  const cheap = mon('shinx');
  t.players.player.hand.push(cheap);
  cast(t, 'player', [{ op: 'reduceCost', amount: 2, target: { mode: 'targeted', side: 'friendly', kinds: ['hand'] } }], { kind: 'hand', owner: 'player', uid: cheap.uid });
  assert.equal(summonCost(t, 'player', cheap, 1), 0, '1 − 2 − 1: never below 0');
  assert.equal(summonCost(t, 'player', cheap, 0), 0);
  // PokéDollars for defeating it still use the printed cost.
  t.players.player.baseEnergy = 0;
  const after = applyAction(t, { type: 'playPokemon', who: 'player', uid: cheap.uid, zone: 1, space: 0 });
  after.players.player.zones[1].pokemon[0].currentStrength = 1;
  const dollars = after.players.ai.dollars;
  cast(after, 'ai', [{ op: 'damage', amount: 1, target: { mode: 'targeted', side: 'opponent' } }], { kind: 'pokemon', owner: 'player', zone: 1, space: 0 });
  assert.equal(after.players.ai.dollars, dollars + 1, 'its printed Energy Cost (1)');
}

// --- Becomes Active ------------------------------------------------------------------

{
  const s = match();
  const a = place(s, 'player', 0, 0, mon('pidgey'));   // Spent, Swift
  assert.ok(!isAlert(s, at(s, a)));
  cast(s, 'player', [{ op: 'ready', target: { mode: 'targeted', side: 'friendly' } }], a);
  assert.equal(at(s, a).spent, false);
  assert.ok(isAlert(s, at(s, a)), 'Alert is worked out again');
}

console.log('All Retain, Search, Return, free summon, cost reduction and "becomes Active" tests passed.');
