// V3 — Training: Pokémon series, the cap, the cost curve and weight classes, the
// freeze on play, Empowered summon, "train N", copy slots and the deck builder's
// validity check, and the AI playing series (with a report of the Levels played at
// and how often each stage is seen).
// Run with: node v2/tests/training.test.js
import assert from 'node:assert/strict';
import { actor, createGame, applyAction, legalActions, train, trainTop, summonCost, PLAYERS } from '../src/engine/game.js';
import { SERIES, seriesDef, pokemonAt, artFor, stagesText } from '../src/engine/series.js';
import { TEST_DECK, cardAt, cardDef, deckProblems, copiesOf, copyLimit } from '../src/engine/cards.js';
import { levelFor, costFor, MAX_LEVEL, COPY_LIMITS, CHAMPIONSHIP_ROUND } from '../src/engine/rules.js';
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
const give = (s, who, series, cap, round = s.round) => { const card = { ...cardAt({ series, cap }, round), uid: `${who}-g${n++}` }; s.players[who].hand.push(card); return card.uid; };
function place(s, who, space, series, level, cap = 6) {
  const card = { ...pokemonAt(series, level), cap, uid: `${who}-t${n++}` };
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: false };
  return s.players[who].row[space];
}
const act = (s, a) => applyAction(s, a);
const passBoth = (s) => act(act(s, { type: 'pass', who: s.turn }), { type: 'pass', who: s.turn === 'player' ? 'ai' : 'player' });

// --- Series: names and stats per Level; evolution every 2 or 3 Levels; single-stage; Legendaries -------

{
  const names = (id) => Array.from({ length: seriesDef(id).maxLevel }, (_, i) => pokemonAt(id, i + 1).name);
  assert.deepEqual(names('horsea'), ['Horsea', 'Horsea', 'Seadra', 'Seadra', 'Kingdra', 'Kingdra'], 'three-stage: every 2 Levels');
  assert.deepEqual(names('growlithe'), ['Growlithe', 'Growlithe', 'Growlithe', 'Arcanine', 'Arcanine', 'Arcanine'], 'two-stage: every 3');
  assert.deepEqual(names('oddish'), ['Oddish', 'Oddish', 'Gloom', 'Gloom', 'Vileplume', 'Vileplume']);
  assert.deepEqual(names('chansey'), Array(6).fill('Chansey'), 'single-stage: trains L1–6 without evolving');
  // A Legendary (V7a) is a single card: no series of Levels, a fixed cost and stats.
  assert.deepEqual([seriesDef('kyogre').maxLevel, pokemonAt('kyogre', 1).cost, pokemonAt('kyogre', 1).attack, pokemonAt('kyogre', 1).strength], [1, 7, 10, 12]);
  assert.equal(stagesText(seriesDef('horsea')), 'Horsea L1–2 · Seadra L3–4 · Kingdra L5–6');
  for (const line of SERIES) {
    assert.equal(line.maxLevel, line.legendary ? 1 : MAX_LEVEL, `${line.id}: Levels 1–6, or a single Legendary card`);
    assert.throws(() => pokemonAt(line.id, 7), /no Level 7/);
    const stats = Array.from({ length: line.maxLevel }, (_, i) => pokemonAt(line.id, i + 1)).map((c) => c.attack + c.strength);
    assert.ok(stats.every((v, i) => i === 0 || v >= stats[i - 1]), `${line.id}: Levels never get weaker`);
  }
  // Each Level's stats (the training mockup's Horsea line).
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((l) => [pokemonAt('horsea', l).attack, pokemonAt('horsea', l).strength]), [[2, 4], [3, 5], [4, 6], [4, 7], [6, 8], [7, 9]]);
  // Missing stage art falls back to the line's base art.
  assert.deepEqual([1, 3, 5].map((l) => artFor(seriesDef('horsea'), l)), ['horsea', 'horsea', 'horsea']);
  assert.deepEqual([1, 4].map((l) => artFor(seriesDef('growlithe'), l)), ['growlithe', 'arcanine'], 'its own art when it exists');
  assert.equal(artFor(seriesDef('bulbasaur'), 6), 'venusaur');
  // Ability strength per Level (Chansey's train).
  assert.deepEqual([1, 3, 4, 6].map((l) => pokemonAt('chansey', l).ability.onSummon.ops[0].amount), [1, 1, 2, 2]);
}

// --- Cost: the curve and weight classes --------------------------------------------------------------

{
  const costs = (id) => Array.from({ length: seriesDef(id).maxLevel }, (_, i) => pokemonAt(id, i + 1).cost);
  assert.deepEqual(costs('horsea'), [1, 1, 2, 3, 3, 4], 'standard');
  assert.deepEqual(costs('oddish'), [0, 0, 1, 2, 2, 3], 'light: −1, minimum 0');
  assert.deepEqual(costs('chansey'), [2, 2, 3, 4, 4, 5], 'heavy: +1');
  assert.deepEqual(costs('kyogre'), [7], 'a Legendary: one fixed cost');
  assert.equal(costFor(4, 'very heavy'), 5, 'heavy +2');
}

// --- Level = the Round, up to the cap; it keeps following the Round off the board --------------------

{
  assert.deepEqual([1, 2, 5, 9].map((r) => levelFor(r, 5)), [1, 2, 5, 5]);
  assert.deepEqual([1, 3, 5, 6].map((r) => cardAt({ series: 'horsea', cap: 5 }, r).name), ['Horsea', 'Seadra', 'Kingdra', 'Kingdra'], 'a Kingdra capped at 5, drawn in Round 1, is a Level-1 Horsea');
  assert.deepEqual([1, 9].map((r) => cardAt({ series: 'kyogre' }, r).attack), [10, 10], 'a Legendary is the same in every Round');
  // In a match: hand, draw pile and discard all follow the Round.
  let s = createGame(11);
  s = applyAction(s, { type: 'flipCoin' });
  const cards = (st, who) => ['hand', 'drawPile', 'discard'].flatMap((pile) => st.players[who][pile]).filter((c) => c.cardType === 'Pokémon');
  for (let round = 1; round <= 7; round++) {
    assert.equal(s.round, round);
    for (const who of PLAYERS) for (const c of cards(s, who)) assert.equal(c.level, Math.min(round, c.cap), `Round ${round}: ${c.name} (cap ${c.cap})`);
    s = passBoth(s);
  }
}

// --- The freeze: once played, it stays at its Level ----------------------------------------------------

{
  let s = battle(2);
  const uid = give(s, 'player', 'horsea', 6);
  s = act(s, { type: 'summon', who: 'player', uid, space: 0 });
  assert.deepEqual([s.players.player.row[0].level, s.players.player.row[0].name], [2, 'Horsea']);
  assert.ok(s.events.some((e) => e.type === 'summoned' && e.level === 2));
  for (let i = 0; i < 4; i++) s = passBoth(s);
  assert.equal(s.round, 6);
  assert.deepEqual([s.players.player.row[0].level, s.players.player.row[0].name, s.players.player.row[0].attack], [2, 'Horsea', 3], 'still a Level-2 Horsea in Round 6');
}

// --- A card in hand that reaches a new stage at Breakfast says so (the flourish) ------------------------

{
  let s = battle(2);
  give(s, 'player', 'oddish', 6, 2);   // Retain: kept in hand
  s = passBoth(s);
  const up = s.events.find((e) => e.type === 'levelUp' && e.who === 'player');
  assert.deepEqual([up?.from, up?.to, up?.level], ['Oddish', 'Gloom', 3]);
  assert.equal(s.players.player.hand.find((c) => c.uid === up.uid).name, 'Gloom');
}

// --- Empowered summon ---------------------------------------------------------------------------------

{
  let s = battle(4);
  const uid = give(s, 'player', 'growlithe', 6);   // Arcanine L4: 5/6, cost 3; +2: +2/+2 and Quick Attack
  const card = s.players.player.hand.find((c) => c.uid === uid);
  assert.deepEqual([card.name, card.cost, summonCost(card, true), card.empower.text], ['Arcanine', 3, 5, '+2: +2/+2 and Quick Attack']);
  s.players.player.energy = 4;
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid, space: 0, empowered: true }), /Not enough Energy/);
  s.players.player.energy = 5;
  s = act(s, { type: 'summon', who: 'player', uid, space: 0, empowered: true });
  const a = s.players.player.row[0];
  assert.deepEqual([a.attack, a.strength, a.currentStrength, a.spent, a.keywords.includes('Quick Attack'), a.empowered, s.players.player.energy], [7, 8, 8, false, true, true, 0], 'paid 5; +2/+2 and Quick Attack: arrives Active');
  // Not on Pokémon without it.
  s = battle();
  const h = give(s, 'player', 'horsea', 6);
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid: h, space: 0, empowered: true }), /no Empowered summon/);
  // Without it, the normal summon.
  s = battle(4);
  const g = give(s, 'player', 'growlithe', 6);
  s = act(s, { type: 'summon', who: 'player', uid: g, space: 0 });
  assert.deepEqual([s.players.player.row[0].attack, s.players.player.row[0].spent, s.players.player.energy], [5, true, 7]);
}

// --- train N: up to the cap; new stats, name and ability; damage carries over and never defeats ------------

{
  const s = battle(6);
  const h = place(s, 'player', 0, 'horsea', 2, 5);   // Horsea L2 3/5, cap 5
  h.currentStrength = 2;   // 3 damage
  assert.equal(train(s, 'player', 0, 1), true);
  let c = s.players.player.row[0];
  assert.deepEqual([c.level, c.name, c.attack, c.strength, c.currentStrength], [3, 'Seadra', 4, 6, 3], 'evolved; 3 damage carried over');
  assert.ok(s.events.some((e) => e.type === 'trained' && e.from === 2 && e.to === 3 && e.name === 'Seadra'));
  train(s, 'player', 0, 5);
  c = s.players.player.row[0];
  assert.deepEqual([c.level, c.name], [5, 'Kingdra'], 'only up to its cap (5)');
  assert.equal(train(s, 'player', 0, 1), false, 'at its cap: nothing');
  // Damage never defeats: at least 1 Strength is left.
  const g = place(s, 'player', 1, 'sneasel', 1);   // 2/3
  g.currentStrength = 1;
  train(s, 'player', 1, 1);   // 3/3: 2 damage carried over, 1 left
  assert.equal(s.players.player.row[1].currentStrength, 1);
  // A Legendary never trains.
  place(s, 'player', 2, 'kyogre', 1, 1);
  assert.deepEqual([trainTop(s.players.player.row[2]), train(s, 'player', 2, 1)], [1, false]);
  // An Empowered bonus stays through training.
  const a = place(s, 'player', 3, 'growlithe', 3, 6);
  Object.assign(a, { empowered: true, attack: a.attack + 2, strength: a.strength + 2, currentStrength: a.strength + 2, keywords: ['Quick Attack'] });
  train(s, 'player', 3, 1);
  c = s.players.player.row[3];
  assert.deepEqual([c.name, c.attack, c.strength, c.keywords], ['Arcanine', 7, 8, ['Quick Attack']]);
}
{
  // The test card: Chansey trains one of your Pokémon when summoned. Elliott's V3
  // ruling: the player chooses (any of their Pokémon that can still train).
  let s = battle(2);
  place(s, 'player', 0, 'horsea', 2, 6);
  place(s, 'player', 1, 'oddish', 1, 6);
  place(s, 'player', 2, 'goldeen', 1, 1);   // capped at 1: can't train
  const ref = (space) => [{ who: 'player', kind: 'pokemon', space }];
  let uid = give(s, 'player', 'chansey', 6);   // Level 2: train 1
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid, space: 4 }), /Choose a target/, 'a target must be chosen');
  assert.throws(() => act(s, { type: 'summon', who: 'player', uid, space: 4, targets: ref(2) }), /not a legal target/, 'not one at its cap');
  s = act(s, { type: 'summon', who: 'player', uid, space: 4, targets: ref(0) });
  assert.deepEqual([s.players.player.row[0].level, s.players.player.row[0].name, s.players.player.row[1].level], [3, 'Seadra', 1], 'the chosen Horsea trains (not the lowest)');
  // It can train itself.
  s.turn = 'player';
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'chansey', 6), space: 5, targets: ref(5) });
  assert.equal(s.players.player.row[5].level, 3);
  // Level 4+: train 2 (Oddish L1 → Gloom L3).
  s = battle(4);
  place(s, 'player', 0, 'oddish', 1, 6);
  s = act(s, { type: 'summon', who: 'player', uid: give(s, 'player', 'chansey', 6), space: 1, targets: ref(0) });
  assert.deepEqual([s.players.player.row[0].level, s.players.player.row[0].name], [3, 'Gloom']);
  // Nothing to train: nothing happens.
  s = battle(6);
  uid = give(s, 'player', 'chansey', 6);
  s = act(s, { type: 'summon', who: 'player', uid, space: 0 });
  assert.equal(s.players.player.row[0].level, 6);
}

// --- Copy slots and the deck builder's validity check -------------------------------------------------

{
  assert.deepEqual(deckProblems(TEST_DECK), [], 'the premade deck is valid');
  assert.deepEqual(COPY_LIMITS, { Common: 3, Rare: 2, Epic: 1, Legendary: 1 });
  // Each card in a series uses 1 copy slot of its rarity, whatever its cap.
  assert.equal(copiesOf(TEST_DECK).growlithe, 3);
  assert.deepEqual([copyLimit('horsea'), copyLimit('chansey'), copyLimit('kyogre'), copyLimit('cerulean-cape')], [3, 2, 1, 3]);
  const swap = (deck, i, entry) => deck.map((e, j) => (j === i ? entry : e));
  const firstChinchou = TEST_DECK.findIndex((e) => e.series === 'chinchou');
  assert.deepEqual(deckProblems(swap(TEST_DECK, firstChinchou, { series: 'growlithe', cap: 1 })), ['Growlithe/Arcanine (Common): 4 cards, but its rarity allows 3']);
  assert.match(deckProblems(swap(TEST_DECK, firstChinchou, { series: 'kyogre' })).join(), /Kyogre \(Legendary\): 2 cards.*At most 1 Legendary/);
  assert.match(deckProblems(swap(TEST_DECK, firstChinchou, { series: 'chinchou', cap: 7 })).join(), /cap must be a Level from 1 to 6/);
  assert.match(deckProblems(swap(TEST_DECK, firstChinchou, { series: 'chinchou', cap: 0 })).join(), /cap must be/);
  assert.match(deckProblems(swap(TEST_DECK, TEST_DECK.findIndex((e) => e.series === 'kyogre'), { series: 'kyogre', cap: 3 })).join(), /a single card with no cap/, 'a Legendary has no cap');
  assert.match(deckProblems(TEST_DECK.slice(1)).join(), /40 cards \(this one has 39\)/);
  assert.match(deckProblems([...TEST_DECK.slice(1), { series: 'mewtwo', cap: 3 }]).join(), /Unknown series/);
  // A built deck plays.
  const built = swap(TEST_DECK, firstChinchou, { series: 'magmar', cap: 2 });
  assert.deepEqual(deckProblems(built), []);
  const s = applyAction(createGame(4, { decks: { player: built, ai: TEST_DECK } }), { type: 'flipCoin' });
  assert.equal(s.players.player.hand.length + s.players.player.drawPile.length, 40);
}

// --- The AI: series sensibly, waiting, Empowered summon; AI-vs-AI matches finish ---------------------------

{
  // Waiting: with a cap-6 Horsea and a cap-1 Horsea in Round 1, it plays the cap-1 one now.
  let s = battle(1);
  s.turn = 'ai';
  s.players.ai.energy = 1;
  const high = give(s, 'ai', 'horsea', 6);
  const low = give(s, 'ai', 'horsea', 1);
  const m = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([m.type, m.uid], ['summon', low], 'saves the one that trains on');
  assert.notEqual(m.uid, high);
  // From the Championship on, nothing is saved: a big Kyogre now beats waiting.
  s = battle(CHAMPIONSHIP_ROUND);
  s.turn = 'ai';
  give(s, 'ai', 'kyogre');
  give(s, 'ai', 'horsea', 1);
  const k = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.equal(s.players.ai.hand.find((c) => c.uid === k.uid)?.series, 'kyogre');
  // Empowered when it pays: Arcanine with Energy to spare.
  s = battle(5);
  s.turn = 'ai';
  s.players.ai.energy = 5;
  give(s, 'ai', 'growlithe', 5);
  const e = chooseAction(s, 'ai', { rng: () => 0.5 });
  assert.deepEqual([e.type, e.empowered], ['summon', true]);
}
{
  const N = 40;
  let summons = 0;
  let levels = 0;
  let empowered = 0;
  let trained = 0;
  const stages = {};
  const species = {};
  for (let seed = 1; seed <= N; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 5000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      assert.ok(legalActions(s, who).includes(action.type));
      s = applyAction(s, action);
      for (const ev of s.events) {
        if (ev.type === 'summoned') {
          summons += 1;
          levels += ev.level;
          if (ev.empowered) empowered += 1;
          const line = seriesDef(ev.series);
          const kind = line.legendary ? 'Legendary' : line.stages.length === 1 ? 'Single-stage' : ['Basic', 'Stage 1', 'Stage 2'][ev.stage];
          stages[kind] = (stages[kind] ?? 0) + 1;
          species[ev.name] = (species[ev.name] ?? 0) + 1;
        }
        if (ev.type === 'trained') trained += 1;
      }
    }
    assert.equal(s.phase, 'gameOver', `seed ${seed} finishes`);
  }
  assert.ok(empowered > 0, 'the AI uses Empowered summon');
  assert.ok(trained > 0, 'Chansey trains Pokémon in play');
  const pct = (x) => `${Math.round((100 * x) / summons)}%`;
  console.log(`${N} AI-vs-AI matches: ${summons} summons, average Level when played ${(levels / summons).toFixed(2)}; ${pct(empowered)} Empowered; ${trained} trainings by Chansey.`);
  console.log(`Stages seen when played: ${Object.entries(stages).map(([kind, x]) => `${kind} ${pct(x)}`).join(', ')}.`);
  console.log(`By species: ${Object.entries(species).sort((a, b) => b[1] - a[1]).map(([name, x]) => `${name} ${x}`).join(', ')}.`);
}

console.log('All v2 Training tests passed.');
