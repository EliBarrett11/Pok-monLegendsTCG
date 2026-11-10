// G2: Pokémon triggers and keywords, and the 10 new lines (docs/v4-gameplay-update.md 4). Run:
// node v4/tests/g2.test.js
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { createGame, applyAction, legalActions, legalTargets, actor, MAX_CHAIN, lanesHere } from '../src/engine/game.js';
import { pokemonAt, cardAtRound, PATHS, TRAINERS, DEMO_DECK, keywordList, triggerText, KEYWORD_ORDER, TRIGGER_NAMES } from '../src/engine/cards.js';
import { GLOSSARY } from '../src/engine/glossary.js';
import { chooseAction } from '../src/ai/ai.js';

let n = 0;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1; };
const mon = (id, level, extra = {}) => { const c = pokemonAt(id, level); return { ...c, uid: `m-${n++}`, currentStrength: c.strength, spent: false, summonedRound: 0, bonusAttack: 0, bonusStrength: 0, tempAttack: 0, ...extra }; };
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

// --- C. The 10 lines at every Level, against section 4.2 (written out here, independently of cards.js) ---
const SPEC = {
  ponyta: { series: 'Light', type: 'Fire', at: 'Physical', speed: 'Swift', guard: null, copies: 2,
    forms: [['Ponyta', 1, 'On Defeated: draw 1 card', []], ['Rapidash', 4, 'On Knockout: +1 Attack (kept)', ['Quick Attack']]],
    stats: [[2, 2], [3, 2], [3, 3], [4, 4], [5, 4], [6, 5]] },
  chinchou: { series: 'Light', type: 'Electric', at: 'Special', speed: 'Steady', guard: 'Special Defence', copies: 2,
    forms: [['Chinchou', 1, 'On Summon: +1 Energy this turn', []], ['Lanturn', 4, 'On Attack: 1 damage to each enemy Pokémon in its Location', []]],
    stats: [[1, 3], [2, 3], [2, 4], [3, 5], [4, 6], [4, 7]] },
  shinx: { series: 'Light', type: 'Electric', at: 'Physical', speed: 'Swift', guard: null, copies: 1,
    forms: [['Shinx', 1, 'On Summon: 1 damage to an enemy Pokémon', []], ['Luxio', 3, 'On Knockout: draw 1 card', ['Infiltrator']], ['Luxray', 5, 'On Summon: 2 damage to an enemy Pokémon', ['Infiltrator']]],
    stats: [[2, 2], [2, 3], [3, 3], [4, 4], [5, 5], [6, 5]] },
  squirtle: { series: 'Mid', type: 'Water', at: 'Special', speed: 'Steady', guard: 'Defence', copies: 2,
    forms: [['Squirtle', 2, 'On Summon: heal 2 to one of your Pokémon', []], ['Wartortle', 4, 'On Summon: heal 2 to each of your Pokémon in its Location', ['Shell 1']], ['Blastoise', 6, "On Attack: 2 damage to another enemy Pokémon in the target's Location", ['Shell 1']]],
    stats: [[2, 4], [2, 5], [3, 6], [4, 7], [5, 8], [6, 9]] },
  growlithe: { series: 'Mid', type: 'Fire', at: 'Physical', speed: 'Swift', guard: null, copies: 2,
    forms: [['Growlithe', 2, 'On Summon: your other Pokémon in its Location get +1 Attack until Supper', []], ['Arcanine', 5, 'On Knockout: draw 1 card', ['Overrun']]],
    stats: [[3, 3], [3, 4], [4, 4], [5, 5], [6, 6], [7, 7]] },
  horsea: { series: 'Mid', type: 'Water', at: 'Special', speed: 'Steady', speeds: { Kingdra: 'Swift' }, guard: null, copies: 1,
    forms: [['Horsea', 2, 'On Summon: 1 damage to an enemy Pokémon', []], ['Seadra', 4, 'On Summon: 1 damage to an enemy Pokémon', ['Retaliate 1']], ['Kingdra', 6, 'On Summon: 2 damage to an enemy Pokémon', ['Infiltrator']]],
    stats: [[2, 3], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]] },
  wooper: { series: 'Mid', type: 'Water', at: 'Physical', speed: 'Slow', guard: 'Defence', copies: 1,
    forms: [['Wooper', 2, 'On Summon: +1 Strength (kept) to another of your Pokémon in its Location', ['Regenerate 1']], ['Quagsire', 4, 'On Summon: heal 2 to each of your other Pokémon in its Location', ['Regenerate 1', 'Rage']]],
    stats: [[2, 4], [2, 5], [3, 7], [4, 8], [4, 9], [5, 10]] },
  magikarp: { series: 'Heavy', type: 'Water', at: 'Physical', speed: 'Steady', guard: null, copies: 1,
    forms: [['Magikarp', 3, 'On Summon: draw 1 card', []], ['Gyarados', 6, 'On Summon: 1 damage to each enemy Pokémon in its Location', ['Rage']]],
    stats: [[1, 4], [1, 5], [2, 5], [7, 8], [8, 9], [9, 10]] },
  charmander: { series: 'Heavy', type: 'Fire', at: 'Special', speed: 'Steady', speeds: { Charizard: 'Swift' }, guard: null, copies: 2,
    forms: [['Charmander', 3, 'On Attack: +1 Attack (kept)', []], ['Charmeleon', 5, 'On Summon: 1 damage to an enemy Pokémon', ['Rage']], ['Charizard', 7, 'On Summon: 2 damage to each enemy Pokémon', ['Overrun']]],
    stats: [[2, 4], [3, 4], [4, 6], [5, 6], [7, 8], [8, 9]] },
  magby: { series: 'Heavy', type: 'Fire', at: 'Special', speed: 'Steady', guard: null, copies: 1,
    forms: [['Magby', 3, 'On Defeated: 1 damage to each enemy Pokémon in its Location', []], ['Magmar', 5, 'On Summon: 1 damage to an enemy Pokémon', ['Retaliate 1']], ['Magmortar', 7, "On Attack: 1 damage to each other enemy Pokémon in the target's Location", []]],
    stats: [[2, 3], [3, 4], [4, 5], [5, 6], [7, 7], [8, 8]] },
};
const FIRST = { Light: 1, Mid: 2, Heavy: 3 };
eq(PATHS.map((p) => p.id).sort(), Object.keys(SPEC).sort(), 'exactly the 10 lines');
for (const [id, sp] of Object.entries(SPEC)) {
  for (let k = 0; k < 6; k++) {
    const level = FIRST[sp.series] + k;
    const c = pokemonAt(id, level);
    const form = [...sp.forms].reverse().find((f) => level >= f[1]);
    eq([c.series, c.type, c.attackType, c.strengthType, c.level], [sp.series, sp.type, sp.at, sp.guard ?? 'Hitpoints', level], `${id} L${level}: series, type, guard`);
    eq([c.name, c.attack, c.strength], [form[0], ...sp.stats[k]], `${id} L${level}: form and stats`);
    eq(c.speed, sp.speeds?.[c.name] ?? sp.speed, `${c.name}: Speed`);
    eq(c.cost, Math.ceil(level / 2), `${c.name} L${level}: cost`);
    eq(triggerText(c.trigger), form[2], `${c.name}: trigger`);
    eq(keywordList(c.keywords), form[3], `${c.name}: keywords`);
  }
  eq(DEMO_DECK.filter((x) => x === id).length, sp.copies, `${id}: copies in the deck`);
}
eq(DEMO_DECK.length, 35, 'the temporary deck: 15 Pokémon + the 20 other cards');
eq(DEMO_DECK.filter((x) => PATHS.some((p) => p.id === x)).length, 15);
eq(TRAINERS.map((t) => triggerText(t.partner.trigger)), ['On Summon: draw 2 cards', 'On Summon: 2 damage to each enemy Pokémon'], 'Partner triggers');
// The glossary has every trigger and keyword.
for (const k of KEYWORD_ORDER) ok(GLOSSARY.some((g) => g.id === k && g.kind === 'keyword'), `glossary: ${k}`);
for (const t of Object.keys(TRIGGER_NAMES)) ok(GLOSSARY.some((g) => g.id === t && g.kind === 'trigger'), `glossary: ${t}`);
ok(!GLOSSARY.some((g) => /\bAlert\b/.test(g.text)), 'v4 terms (Ready, not Alert)');

// --- A. Each trigger at the right moment -----------------------------------------------------------------
{
  // On Summon: Magikarp draws 1 when it arrives.
  let s = battle();
  s.players.player.drawPile = [card('ponyta'), card('ponyta')];
  const k = card('magikarp');
  s.players.player.hand = [k];
  s = applyAction(s, { type: 'summon', who: 'player', uid: k.uid, space: 0 });
  eq([trig(s), s.players.player.hand.length], [['Magikarp:summon'], 1], 'On Summon: draw 1');
  // On Attack: after it attacks, if it survived (Charmander: +1 Attack kept).
  s = battle();
  s.players.player.row[0] = mon('charmander', 3, { speed: 'Swift' });
  s.players.ai.row[0] = mon('wooper', 3, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([trig(s), s.players.player.row[0].attack], [['Charmander:attack'], 3], 'On Attack after surviving: +1 Attack (kept)');
  s = battle();
  s.players.player.row[0] = mon('charmander', 3, { speed: 'Swift', currentStrength: 1 });
  s.players.ai.row[0] = mon('ponyta', 3);   // Swift and Ready: hits back for 3
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  ok(!trig(s).includes('Charmander:attack'), 'no On Attack if it was defeated');
  // On Attack also after attacking the Player Character (Lanturn: 1 to each enemy in its Location).
  s = battle();
  s.players.player.row[4] = mon('chinchou', 4, { speed: 'Swift' });
  s.players.ai.row[4] = mon('ponyta', 3, { spent: true });
  s.players.ai.row[0] = mon('ponyta', 3, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'player' } });
  eq([s.players.ai.row[4].currentStrength, s.players.ai.row[0].currentStrength], [2, 3], 'Lanturn: only the enemy in its own lane (no Location)');
  // On Defend: when it survives an attack that damaged it (staged: no 4.2 line has one).
  s = battle();
  s.players.player.row[0] = mon('ponyta', 3);
  s.players.ai.row[0] = mon('wooper', 6, { spent: true, trigger: { on: 'defend', ops: [{ op: 'heal', amount: 2, to: 'self' }] } });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([trig(s), s.players.ai.row[0].currentStrength], [['Quagsire:defend'], 9 - 3 + 2], 'On Defend: survived 3 damage, then healed 2');
  // On Defeated: Ponyta draws 1 for its owner.
  s = battle();
  s.players.ai.drawPile = [card('ponyta')];
  s.players.player.row[0] = mon('growlithe', 6, { trigger: null });
  s.players.ai.row[0] = mon('ponyta', 1, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([trig(s), s.players.ai.hand.length], [['Ponyta:defeated'], 1], 'On Defeated: its owner draws 1');
  // On Knockout: Rapidash +1 Attack (kept) when its attack defeats; also for a defender's hit-back.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 4);
  s.players.ai.row[0] = mon('ponyta', 1, { spent: true, trigger: null });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([trig(s), s.players.player.row[0].attack], [['Rapidash:knockout'], 5], 'On Knockout: +1 Attack');
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1, { trigger: null, currentStrength: 1 });
  s.players.ai.row[0] = mon('ponyta', 4);   // Rapidash, Ready: hits back and defeats the attacker
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq([trig(s), s.players.ai.row[0].attack], [['Rapidash:knockout'], 5], 'On Knockout from a hit-back');
  // On Breakfast (staged: no 4.2 line has one): at each Breakfast while in play.
  s = battle();
  s.players.player.drawPile = Array.from({ length: 10 }, () => card('ponyta'));
  s.players.player.row[3] = mon('wooper', 2, { spent: true, trigger: { on: 'breakfast', ops: [{ op: 'strength', amount: 1, to: 'self' }] } });
  const st = s.players.player.row[3].strength;
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq([s.round, s.players.player.row[3].strength], [2, st + 1], 'On Breakfast: +1 Strength at the new Round');
}

// --- B. Keywords -----------------------------------------------------------------------------------------
{
  // Quick Attack: Rapidash arrives Active (and Ready if it's the fastest).
  let s = battle();
  const r = { ...pokemonAt('ponyta', 4), uid: 'qa' };
  s.players.player.hand = [r];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'qa', space: 2 });
  ok(!s.players.player.row[2].spent, 'Quick Attack: Active on arrival');
  ok(s.events.some((e) => e.type === 'keyword' && e.kw === 'Quick Attack'), 'and a callout');
  const plain = { ...pokemonAt('ponyta', 3), uid: 'np' };
  s.turn = 'player';
  s.players.player.hand = [plain];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'np', space: 3 });
  ok(s.players.player.row[3].spent, 'without it: Spent');
  // Infiltrator: Luxio ignores guards (a Defence guard protecting others and the Player Character).
  s = battle();
  s.players.player.row[0] = mon('shinx', 3);
  s.players.ai.row[0] = mon('squirtle', 2, { spent: true });   // Defence guard
  s.players.ai.row[3] = mon('ponyta', 2, { spent: true });
  eq(legalTargets(s, 'player', 0).map((t) => t.space ?? 'PC'), [0, 3, 'PC'], 'Infiltrator: every enemy Pokémon and the Player Character');
  s.players.player.row[0] = mon('ponyta', 2);
  eq(legalTargets(s, 'player', 0).map((t) => t.space ?? 'PC'), [0], 'without it: only the guard');
  // Shell: Wartortle takes each instance of damage 1 less (minimum 1).
  s = battle();
  s.players.player.row[0] = mon('growlithe', 4);   // 4 Attack
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true });   // Wartortle 3/6, Shell 1
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].currentStrength, 6 - 3, 'Shell 1: 4 → 3');
  s = battle();
  s.players.player.row[0] = mon('chinchou', 1, { speed: 'Swift' });   // 1 Attack
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].currentStrength, 5, 'minimum 1');
  // Retaliate: the attacker takes X when the attack damages it; Shell reduces Retaliate (min 1).
  s = battle();
  s.players.player.row[0] = mon('growlithe', 4);
  s.players.ai.row[0] = mon('horsea', 4, { spent: true });   // Seadra, Retaliate 1
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.row[0].currentStrength, s.players.player.row[0].strength - 1, 'Retaliate 1: the attacker takes 1');
  s = battle();
  s.players.player.row[0] = mon('ponyta', 1, { currentStrength: 1, trigger: null });
  s.players.ai.row[0] = mon('magby', 5, { spent: true });   // Magmar, Retaliate 1
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.row[0], null, 'Retaliate defeats an attacker');
  eq(s.players.ai.recognition, RULES.perDefeat, 'and its owner gets the defeat');
  // Rage: +1 Attack for good each time it survives damage.
  s = battle();
  s.players.player.row[0] = mon('ponyta', 2);
  s.players.ai.row[0] = mon('wooper', 4, { spent: true });   // Quagsire, Rage
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.ai.row[0].attack, 4, 'Rage: 3 → 4');
  // Regenerate: heals X at Breakfast.
  s = battle();
  s.players.player.drawPile = Array.from({ length: 10 }, () => card('ponyta'));
  s.players.player.row[0] = mon('wooper', 3, { currentStrength: 2, spent: true });
  s.passesInARow = 1;
  s = applyAction(s, { type: 'pass', who: 'player' });
  eq(s.players.player.row[0].currentStrength, 3, 'Regenerate 1 at Breakfast');
  // Overrun: the leftover damage hits the enemy Player Character as Recognition (at the normal rate).
  s = battle();
  s.players.player.row[0] = mon('growlithe', 7);   // Arcanine 7
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 2, spent: true, trigger: null });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.recognition, (7 - 2) * RULES.perDamageToPlayer + RULES.perDefeat, 'Overrun 5 + the defeat');
  ok(s.events.some((e) => e.type === 'recognition' && /Overrun/.test(e.source)), 'Overrun Recognition is its own source');
  s = battle();
  s.tournament = { startedRound: 1, reason: 'test' };
  s.players.player.row[0] = mon('growlithe', 7);
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 2, spent: true, trigger: null });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  eq(s.players.player.recognition, Math.ceil(5 * 1.5) + Math.ceil(2 * 1.5), 'in the Tournament, ×1.5 like any Recognition');
}

// --- Order, chains, choices, React -------------------------------------------------------------------------
{
  // Order: the attacker's On Attack, then On Knockout, then the defender's On Defeated.
  let s = battle();
  s.players.player.row[4] = mon('shinx', 3, { trigger: { on: 'attack', ops: [{ op: 'draw', amount: 1 }] } });
  s.players.player.drawPile = [card('ponyta'), card('ponyta')];
  s.players.ai.row[4] = mon('magby', 3, { currentStrength: 1, spent: true });
  s.players.player.row[4].trigger = { on: 'attack', ops: [{ op: 'draw', amount: 1 }] };
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 4 } });
  eq(trig(s), ['Luxio:attack', 'Magby:defeated'], 'On Attack, then On Defeated');
  s = battle();
  s.players.player.row[4] = mon('shinx', 3);   // Luxio: On Knockout draw 1
  s.players.player.drawPile = [card('ponyta')];
  s.players.ai.row[4] = mon('magby', 3, { currentStrength: 1, spent: true });   // On Defeated: 1 to each enemy in its Location
  s = applyAction(s, { type: 'attack', who: 'player', from: 4, target: { kind: 'pokemon', space: 4 } });
  eq(trig(s), ['Luxio:knockout', 'Magby:defeated'], 'the attacker\'s On Knockout, then the defender\'s On Defeated');
  eq(s.players.player.row[4].currentStrength, s.players.player.row[4].strength - 1, 'Magby\'s On Defeated hits Luxio in its lane');
  ok(lanesHere(s, 4).length === 1, 'no Location: just its lane');
  // Chains: a trigger's defeat sets off more triggers, capped at MAX_CHAIN levels.
  s = battle();
  const boom = { on: 'defeated', ops: [{ op: 'damage', amount: 1, to: 'eachEnemy' }] };
  // Each side's weakest has 1 Strength left at every step, so each level defeats exactly one Pokémon,
  // alternating sides: the chain would go on for 12 levels without the cap.
  for (let i = 1; i <= 6; i++) {
    s.players.player.row[i] = mon('ponyta', 1, { currentStrength: i, strength: 9, spent: true, trigger: boom });
    s.players.ai.row[i] = mon('ponyta', 1, { currentStrength: i, strength: 9, spent: true, trigger: boom });
  }
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 1, spent: true, trigger: boom });
  s.players.player.row[0] = mon('growlithe', 7, { trigger: null, currentStrength: 30, strength: 30 });
  s = applyAction(s, { type: 'attack', who: 'player', from: 0, target: { kind: 'pokemon', space: 0 } });
  ok(s.log.some((l) => /chain of triggers stops/.test(l)), 'the chain stops at the cap');
  ok(s.events.filter((e) => e.type === 'trigger').length > 3, 'after several levels');
  eq(MAX_CHAIN, 4);
  ok(!s.triggers && !s.draining, 'nothing left queued');
  // A trigger can't be Reacted to: Gyarados's On Summon damage with the Opponent holding Ember.
  s = battle();
  s.players.ai.hand = [card('ember')];
  s.players.ai.row[2] = mon('ponyta', 3, { spent: true });
  const g = { ...pokemonAt('magikarp', 6), uid: 'gy' };
  s.players.player.hand = [g];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'gy', space: 2 });
  eq([s.reactWindow, s.players.ai.row[2].currentStrength], [null, 2], 'On Summon damage resolves with no React window');
  // A chosen target: the summon waits for it; only 'choose' is legal; the AI picks through its normal choice.
  s = battle();
  s.players.ai.row[1] = mon('ponyta', 3, { spent: true });
  s.players.ai.row[6] = mon('wooper', 3, { spent: true });
  const sh = { ...pokemonAt('shinx', 1), uid: 'sx' };
  s.players.player.hand = [sh];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'sx', space: 4 });
  eq([s.choice?.who, legalActions(s, 'player'), legalActions(s, 'ai'), actor(s)], ['player', ['choose'], [], 'player'], 'the choice waits (it can\'t be cancelled)');
  eq(s.turn, 'player', 'the turn waits too');
  assert.throws(() => applyAction(s, { type: 'choose', who: 'player', target: { who: 'player', space: 4 } }), /glowing/);
  const ai = chooseAction(s, 'player', { rng: () => 0.5 });
  eq(ai.type, 'choose', 'the AI chooses through its normal choice');
  s = applyAction(s, { type: 'choose', who: 'player', target: { who: 'ai', space: 1 } });
  eq([s.choice, s.players.ai.row[1].currentStrength, s.turn], [null, 2, 'ai'], 'then it resolves and the turn ends');
  // No legal choice: that part fizzles, and the turn ends.
  s = battle();
  const sq = { ...pokemonAt('wooper', 2), uid: 'wo' };   // +1 Strength to another of yours in its Location: none
  s.players.player.hand = [sq];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'wo', space: 0 });
  ok(!s.choice && types(s).includes('fizzled') && s.turn === 'ai', 'no target: it fizzles');
  // Overrun from the trigger table: Charizard's On Summon (2 to each enemy) and Shell.
  s = battle();
  s.players.ai.row[0] = mon('squirtle', 4, { spent: true });   // Wartortle, Shell 1
  s.players.ai.row[5] = mon('ponyta', 3, { spent: true });
  const cz = { ...pokemonAt('charmander', 7), uid: 'cz' };
  s.players.player.hand = [cz];
  s = applyAction(s, { type: 'summon', who: 'player', uid: 'cz', space: 3 });
  eq([s.players.ai.row[0].currentStrength, s.players.ai.row[5].currentStrength], [5, 1], 'Charizard: 2 to each enemy (Shell: 1)');
}

// --- The AI with triggers and keywords: 20 matches run through applyAction ---------------------------------
{
  let fired = 0;
  for (let seed = 1; seed <= 20; seed++) {
    let s = createGame(seed);
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
      s = applyAction(s, chooseAction(s, actor(s), { rng }));
      fired += s.events.filter((e) => e.type === 'trigger').length;
    }
    ok(s.phase === 'gameOver', `match ${seed} finishes`);
  }
  ok(fired > 100, `triggers fired in AI play (${fired})`);
}
{
  // The AI doesn't attack into a Retaliate that would defeat its attacker for nothing.
  const s = battle('ai');
  s.players.ai.row[0] = mon('ponyta', 1, { currentStrength: 1, trigger: null });
  s.players.player.row[0] = mon('magby', 5, { spent: true });   // Magmar 4/5, Retaliate 1
  const m = chooseAction(s, 'ai', { rng: () => 0.5 });
  ok(!(m.type === 'attack' && m.target.kind === 'pokemon'), `no suicidal attack into Retaliate (${m.type} ${m.target?.kind ?? ''})`);
}

console.log(`g2: ${checks} checks passed`);
