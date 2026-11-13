// G2: Pokémon triggers and keywords (docs/v4-gameplay-update.md 4). Run: node v4/tests/g2.test.js
// B3-1: the cards now come from docs/base-game/cards.json (tests/cardsdata.test.js checks them, and tests/b3rules.test.js
// the new triggers and keywords). These checks stage each trigger and keyword on the Pokémon they use, so they test the
// rule, not a card's numbers.
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, legalTargets, actor, MAX_CHAIN, lanesHere } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, TRAINERS, keywordList, triggerText, KEYWORD_ORDER, TRIGGER_NAMES } from '../src/engine/cards.js';
import { GLOSSARY, triggerTermId } from '../src/engine/glossary.js';
import { chooseAction } from '../src/ai/ai.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
// Staged: no trigger or keywords unless given.
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, keywords: {}, trigger: null, uid: `m-${n++}`, currentStrength: c.strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
const inHand = (id, level, extra = {}) => ({ ...pokemonAt(id, level), keywords: {}, trigger: null, uid: `h-${n++}`, ...extra });
const T = (on, ...ops) => ({ on, ops });
const card = (id, round = 1) => ({ ...cardAtRound(id, round), uid: `c-${n++}` });
const battle = (turn = 'player', energy = 8) => {
  let s = createGame(5);
  s = applyAction(s, { type: 'mulligan', who: 'player', cards: [] });
  s = applyAction(s, { type: 'mulligan', who: 'ai', cards: [] });
  for (const w of ['player', 'ai']) { const p = s.players[w]; p.hand = []; p.row = p.row.map(() => null); p.baseEnergy = energy; p.exertMax = 0; p.exhaust = []; p.trainers = []; p.recognition = 0; p.dollars = 0; }
  s.turn = turn;
  s.passesInARow = 0;
  return s;
};
const types = (s) => s.events.map((e) => e.type);
const trig = (s) => s.events.filter((e) => e.type === 'trigger').map((e) => `${e.name}:${e.on}`);
// (One event per op: the names of the triggers that fired, once each in order.)
const fired = (s) => trig(s).filter((x, i, a) => a.indexOf(x) === i);

// The Partners' triggers (B3-1: cards.json) and the glossary has every trigger and keyword.
eq(TRAINERS.map((t) => triggerText(t.partner.trigger)), ['On Summon: Draw 2 cards', 'On Summon: 2 damage to each enemy Pokémon', 'On Summon: Heal 4 to each of your Pokémon, and they get +1 Strength (kept)', 'On Summon: 3 damage to the enemy across from it', 'On Summon: Heal 3 to each of your Pokémon',
  // B3-2: Sabrina, Bruno, Morty, Karen.
  'On Summon: 3 damage to an enemy Pokémon, and draw 1 card', 'On Summon: 3 damage to an enemy Pokémon', 'On Summon: Return 2 Pokémon cards from your Discard Pile to your hand', 'On Summon: Each enemy Pokémon gets −2 Attack until Supper'], 'Partner triggers');
for (const k of KEYWORD_ORDER) ok(GLOSSARY.some((g) => g.id === k && g.kind === 'keyword'), `glossary: ${k}`);
for (const t of Object.keys(TRIGGER_NAMES)) ok(GLOSSARY.some((g) => g.id === triggerTermId(t) && g.kind === 'trigger'), `glossary: ${t}`);
ok(!GLOSSARY.some((g) => /\bAlert\b/.test(g.text)), 'v4 terms (Ready, not Alert)');
eq(keywordList({ shell: 1, rage: true }), ['Shell 1', 'Rage'], 'keyword wording');

// --- A. Each trigger at the right moment -----------------------------------------------------------------
{
  // On Summon: draw 1 when it arrives.
  let s = battle();
  s.players.player.drawPile = [card('ponyta'), card('ponyta')];
  const k = inHand('magikarp', 3, { trigger: T('summon', { op: 'draw', amount: 1 }) });
  s.players.player.hand = [k];
  s = applyAction(s, { type: 'summon', who: 'player', uid: k.uid, space: 0 });
  eq([fired(s), s.players.player.hand.length], [['Magikarp:summon'], 1], 'On Summon: draw 1');
  // On Attack: after it attacks, if it survived (+1 Attack kept).
  s = battle();
  s.players.player.row[0] = mon('charmander', 3, { speed: 'Swift', trigger: T('attack', { op: 'attack', amount: 1, to: 'self' }) });
  const a0 = s.players.player.row[0].attack;
  s.players.ai.row[0] = mon('wooper', 3, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([fired(s), s.players.player.row[0].attack], [['Charmander:attack'], a0 + 1], 'On Attack after surviving: +1 Attack (kept)');
  s = battle();
  s.players.player.row[0] = mon('charmander', 3, { speed: 'Swift', currentStrength: 1, trigger: T('attack', { op: 'attack', amount: 1, to: 'self' }) });
  s.players.ai.row[0] = mon('ponyta', 3);   // Swift and Ready: hits back for 3
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  ok(!trig(s).includes('Charmander:attack'), 'no On Attack if it was defeated');
  // On Attack also after attacking the Player Character (1 to each enemy in its Location).
  s = battle();
  s.players.player.row[4] = mon('chinchou', 4, { speed: 'Swift', trigger: T('attack', { op: 'damage', amount: 1, to: 'eachEnemyHere' }) });
  s.players.ai.row[4] = mon('ponyta', 3, { spent: true });
  s.players.ai.row[0] = mon('ponyta', 3, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'player' } });
  eq([s.players.ai.row[4].currentStrength, s.players.ai.row[0].currentStrength], [2, 3], 'only the enemy in its own lane (no Location)');
  // On Defend: when it survives an attack that damaged it.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 3);
  s.players.ai.row[0] = mon('wooper', 6, { spent: true, trigger: T('defend', { op: 'heal', amount: 2, to: 'self' }) });
  const w6 = s.players.ai.row[0];
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([fired(s), s.players.ai.row[0].currentStrength], [[`${w6.name}:defend`], w6.strength - 3 + 2], 'On Defend: survived 3 damage, then healed 2');
  // On Defeated: its owner draws 1.
  s = battle();
  s.players.ai.drawPile = [card('ponyta')];
  s.players.player.row[0] = mon('growlithe', 6);
  s.players.ai.row[0] = mon('ponyta', 1, { spent: true, trigger: T('defeated', { op: 'draw', amount: 1 }) });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([fired(s), s.players.ai.hand.length], [['Ponyta:defeated'], 1], 'On Defeated: its owner draws 1');
  // On Knockout: +1 Attack (kept) when its attack defeats; also for a defender's hit-back.
  const ko = T('knockout', { op: 'attack', amount: 1, to: 'self' });
  s = battle();
  s.players.player.row[0] = mon('ponyta', 4, { trigger: ko });
  const r4 = s.players.player.row[0];
  s.players.ai.row[0] = mon('ponyta', 1, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([fired(s), s.players.player.row[0].attack], [[`${r4.name}:knockout`], r4.attack + 1], 'On Knockout: +1 Attack');
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.row[0] = mon('ponyta', 4, { trigger: ko });   // Ready: hits back and defeats the attacker
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([fired(s), s.players.ai.row[0].attack], [[`${r4.name}:knockout`], r4.attack + 1], 'On Knockout from a hit-back');
  // On Breakfast: at each Breakfast while in play.
  s = battle();
  s.players.player.drawPile = Array.from({ length: 10 }, () => card('ponyta'));
  s.players.player.row[3] = mon('wooper', 2, { spent: true, trigger: T('breakfast', { op: 'strength', amount: 1, to: 'self' }) });
  const st = s.players.player.row[3].strength;
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq([s.round, s.players.player.row[3].strength], [2, st + 1], 'On Breakfast: +1 Strength at the new Round');
}

// --- B. Keywords -----------------------------------------------------------------------------------------
{
  // Quick Attack: it arrives Active (and Ready if it's the fastest).
  let s = battle();
  const r = inHand('ponyta', 4, { keywords: { quickAttack: true } });
  s.players.player.hand = [r];
  s = applyAction(s, { type: 'summon', who: 'player', uid: r.uid, space: 2 });
  ok(!s.players.player.row[2].spent, 'Quick Attack: Active on arrival');
  ok(s.events.some((e) => e.type === 'keyword' && e.kw === 'Quick Attack'), 'and a callout');
  const plain = inHand('ponyta', 3);
  s.turn = 'player';
  s.players.player.hand = [plain];
  s = applyAction(s, { type: 'summon', who: 'player', uid: plain.uid, space: 3 });
  ok(s.players.player.row[3].spent, 'without it: Spent');
  // Infiltrator: ignores guards (a Defence guard protecting others and the Player Character).
  s = battle();
  s.players.player.row[0] = mon('shinx', 3, { keywords: { infiltrator: true } });
  s.players.ai.row[0] = mon('squirtle', 2, { spent: true });   // Defence guard
  s.players.ai.row[3] = mon('ponyta', 2, { spent: true });
  eq(legalTargets(s, 'player', 0).map((t) => t.space ?? 'PC'), [0, 3, 'PC'], 'Infiltrator: every enemy Pokémon and the Player Character');
  s.players.player.row[0] = mon('ponyta', 2);
  eq(legalTargets(s, 'player', 0).map((t) => t.space ?? 'PC'), [0], 'without it: only the guard');
  // Shell: each instance of damage 1 less (minimum 1).
  s = battle();
  s.players.player.row[0] = mon('growlithe', 4);   // 4 Attack
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true, keywords: { shell: 1 } });
  const sh0 = s.players.ai.row[0].strength;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].currentStrength, sh0 - 3, 'Shell 1: 4 → 3');
  s = battle();
  s.players.player.row[0] = mon('chinchou', 1, { speed: 'Swift' });   // 1 Attack
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true, keywords: { shell: 1 } });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].currentStrength, sh0 - 1, 'minimum 1');
  // Retaliate: the attacker takes X when the attack damages it.
  s = battle();
  s.players.player.row[0] = mon('growlithe', 4);
  s.players.ai.row[0] = mon('horsea', 4, { spent: true, keywords: { retaliate: 1 } });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.row[0].currentStrength, s.players.player.row[0].strength - 1, 'Retaliate 1: the attacker takes 1');
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.ai.row[0] = mon('magby', 5, { spent: true, keywords: { retaliate: 1 } });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.row[0], null, 'Retaliate defeats an attacker');
  eq(s.players.ai.recognition, RULES.perDefeat, 'and its owner gets the defeat');
  // Rage: +1 Attack for good each time it survives damage.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('wooper', 4, { spent: true, keywords: { rage: true } });
  const ra = s.players.ai.row[0].attack;
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].attack, ra + 1, 'Rage: +1');
  // Regenerate: heals X at Breakfast.
  s = battle();
  s.players.player.drawPile = Array.from({ length: 10 }, () => card('ponyta'));
  s.players.player.row[0] = mon('wooper', 3, { currentStrength: 2, spent: true, keywords: { regenerate: 1 } });
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq(s.players.player.row[0].currentStrength, 3, 'Regenerate 1 at Breakfast');
  // Overrun: the leftover damage hits the enemy Player Character as Recognition (at the normal rate).
  s = battle();
  s.players.player.row[0] = mon('growlithe', 7, { keywords: { overrun: true } });
  const oa = s.players.player.row[0].attack;
  s.players.ai.row[0] = mon('ponyta', 1, { strength: 2, currentStrength: 2, spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.recognition, (oa - 2) * RULES.perDamageToPlayer + RULES.perDefeat, 'Overrun + the defeat');
  ok(s.events.some((e) => e.type === 'recognition' && /Overrun/.test(e.source)), 'Overrun Recognition is its own source');
  s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('growlithe', 7, { keywords: { overrun: true } });
  s.players.ai.row[0] = mon('ponyta', 1, { strength: 2, currentStrength: 2, spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.recognition, Math.ceil((oa - 2) * 1.5) + Math.ceil(2 * 1.5), 'in the Tournament, ×1.5 like any Recognition');
}

// --- Order, chains, choices, React -------------------------------------------------------------------------
{
  // Order: the attacker's On Attack, then the defender's On Defeated.
  const boomHere = T('defeated', { op: 'damage', amount: 1, to: 'eachEnemyHere' });
  let s = battle();
  s.players.player.row[4] = mon('shinx', 3, { trigger: T('attack', { op: 'draw', amount: 1 }) });
  s.players.player.drawPile = [card('ponyta'), card('ponyta')];
  s.players.ai.row[4] = mon('magby', 3, { currentStrength: 1, spent: true, trigger: boomHere });
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 4 } });
  eq(fired(s), ['Luxio:attack', 'Magby:defeated'], 'On Attack, then On Defeated');
  s = battle();
  s.players.player.row[4] = mon('shinx', 3, { trigger: T('knockout', { op: 'draw', amount: 1 }) });
  s.players.player.drawPile = [card('ponyta')];
  s.players.ai.row[4] = mon('magby', 3, { currentStrength: 1, spent: true, trigger: boomHere });
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 4 } });
  eq(fired(s), ['Luxio:knockout', 'Magby:defeated'], 'the attacker\'s On Knockout, then the defender\'s On Defeated');
  eq(s.players.player.row[4].currentStrength, s.players.player.row[4].strength - 1, 'On Defeated hits Luxio in its lane');
  ok(lanesHere(s, 4).length === 1, 'no Location: just its lane');
  // Chains: a trigger's defeat sets off more triggers, capped at MAX_CHAIN levels.
  s = battle();
  const boom = T('defeated', { op: 'damage', amount: 1, to: 'eachEnemy' });
  for (let i = 1; i <= 6; i++) {
    s.players.player.row[i] = mon('ponyta', 1, { currentStrength: i, strength: 9, spent: true, trigger: boom });
    s.players.ai.row[i] = mon('ponyta', 1, { currentStrength: i, strength: 9, spent: true, trigger: boom });
  }
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 1, spent: true, trigger: boom });
  s.players.player.row[0] = mon('growlithe', 7, { currentStrength: 30, strength: 30 });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  ok(s.log.some((l) => /chain of triggers stops/.test(l)), 'the chain stops at the cap');
  ok(s.events.filter((e) => e.type === 'trigger').length > 3, 'after several levels');
  eq(MAX_CHAIN, 4);
  ok(!s.triggers && !s.draining, 'nothing left queued');
  // A trigger can't be Reacted to: an On Summon's damage with the Opponent holding Ember.
  s = battle();
  s.players.ai.hand = [card('ember')];
  s.players.ai.row[2] = mon('ponyta', 3, { spent: true });
  const g = inHand('magikarp', 6, { trigger: T('summon', { op: 'damage', amount: 1, to: 'eachEnemyHere' }) });
  s.players.player.hand = [g];
  s = applyAction(s, { type: 'summon', who: 'player', uid: g.uid, space: 2 });
  eq([s.reactWindow, s.players.ai.row[2].currentStrength], [null, 2], 'On Summon damage resolves with no React window');
  // A chosen target: the summon waits for it; only 'choose' is legal; the AI picks through its normal choice.
  s = battle();
  s.players.ai.row[1] = mon('ponyta', 3, { spent: true });
  s.players.ai.row[6] = mon('wooper', 3, { spent: true });
  const sh = inHand('shinx', 1, { trigger: T('summon', { op: 'damage', amount: 1, to: 'chosenEnemy' }) });
  s.players.player.hand = [sh];
  s = applyAction(s, { type: 'summon', who: 'player', uid: sh.uid, space: 4 });
  eq([s.choice?.who, legalActions(s, 'player'), legalActions(s, 'ai'), actor(s)], ['player', ['choose'], [], 'player'], 'the choice waits (it can\'t be cancelled)');
  eq(s.turn, 'player', 'the turn waits too');
  assert.throws(() => applyAction(s, { type: 'choose', who: 'player', target: { who: 'player', space: 4 } }), /glowing/);
  const ai = chooseAction(s, 'player', { rng: () => 0.5 });
  eq(ai.type, 'choose', 'the AI chooses through its normal choice');
  s = applyAction(s, { type: 'choose', who: 'player', target: { who: 'ai', space: 1 } });
  eq([s.choice, s.players.ai.row[1].currentStrength, s.turn], [null, 2, 'ai'], 'then it resolves and the turn ends');
  // No legal choice: that part fizzles, and the turn ends.
  s = battle();
  const sq = inHand('wooper', 2, { trigger: T('summon', { op: 'strength', amount: 1, to: 'chosenOtherOwnHere' }) });
  s.players.player.hand = [sq];
  s = applyAction(s, { type: 'summon', who: 'player', uid: sq.uid, space: 0 });
  ok(!s.choice && types(s).includes('fizzled') && s.turn === 'ai', 'no target: it fizzles');
  // Damage to each enemy from a trigger, and Shell.
  s = battle();
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true, keywords: { shell: 1 } });
  s.players.ai.row[5] = mon('ponyta', 3, { spent: true });
  const s0 = s.players.ai.row[0].strength;
  const cz = inHand('charmander', 7, { trigger: T('summon', { op: 'damage', amount: 2, to: 'eachEnemy' }) });
  s.players.player.hand = [cz];
  s = applyAction(s, { type: 'summon', who: 'player', uid: cz.uid, space: 3 });
  eq([s.players.ai.row[0].currentStrength, s.players.ai.row[5].currentStrength], [s0 - 1, 1], '2 to each enemy (Shell: 1)');
}

// --- The AI with triggers and keywords: 12 matches run through applyAction ---------------------------------
{
  let count = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let i = 0; i < 6000 && s.phase !== 'gameOver'; i++) {
      s = applyAction(s, chooseAction(s, actor(s), { rng }));
      count += s.events.filter((e) => e.type === 'trigger').length;
    }
    ok(s.phase === 'gameOver', `match ${seed} finishes`);
  }
  ok(count > 100, `triggers fired in AI play (${count})`);
}
{
  // The AI doesn't attack into a Retaliate that would defeat its attacker for nothing.
  const s = battle('ai');
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 1 });
  s.players.player.row[0] = mon('magby', 5, { spent: true, keywords: { retaliate: 1 } });
  const m = chooseAction(s, 'ai', { rng: () => 0.5 });
  ok(!(m.type === 'attack' && m.target.kind === 'pokemon'), `no suicidal attack into Retaliate (${m.type} ${m.target?.kind ?? ''})`);
}

console.log(`g2: ${checks} checks passed`);
