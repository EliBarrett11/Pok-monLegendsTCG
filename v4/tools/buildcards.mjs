// B3-1: generates v4/src/data/cards.js from docs/base-game/cards.json (the approved Base Game; the source of truth).
//   node v4/tools/buildcards.mjs [--check]
// Every effect's wording is matched here to the effect vocabulary (src/engine/wording.js), as clauses of ops; the game
// generates its wording back from the ops, and tests/cardsdata.test.js checks it equals cards.json word for word.
// A sentence that matches no pattern stops the build (it names the card), so nothing is ever hand-typed in the game.
// Batch 1 only (B3-1); Batches 2–4 arrive in B3-2 and B3-3. The output is stable: the same input gives the same file.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { effectText, favourText, targetPhrase, FAVOUR_RELEASE, KEYWORD_NAMES, objectiveText, shortModeText } from '../src/engine/wording.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = `${ROOT}docs/base-game/cards.json`;
const OUT = `${ROOT}v4/src/data/cards.js`;
const BATCHES = [1];

// --- Phrases --------------------------------------------------------------------------------------------------------
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TARGETS = [];
for (const to of ['chosenEnemy', 'chosenOwn', 'eachEnemy', 'eachEnemyHere', 'chosenLocEnemies', 'oneOtherEnemyTargetLoc', 'otherEnemiesTargetLoc', 'otherEnemiesItsLoc',
  'eachOwn', 'eachOwnHere', 'chosenLocOwn', 'thereOwn', 'acrossEnemy', 'enemyPC', 'attacker', 'attacked', 'attackerLocEnemies']) {
  for (const word of ['', 'yours', 'short']) {
    const p = targetPhrase(to, word);
    if (!TARGETS.some((t) => t.p === p)) TARGETS.push({ to, word, p });
  }
}
TARGETS.sort((a, b) => b.p.length - a.p.length);
const TGT = `(${TARGETS.map((t) => esc(t.p)).join('|')})`;
const target = (p) => { const t = TARGETS.find((x) => x.p === p); return t.word ? { to: t.to, word: t.word } : { to: t.to }; };
const SUBJECTS = [['One of your Pokémon', 'chosenOwn'], ['Your Pokémon being attacked', 'attacked'], ['An enemy Pokémon', 'chosenEnemy'],
  ['Each enemy Pokémon in a Location', 'chosenLocEnemies'], ['Your other Pokémon in its Location', 'eachOtherOwnHere'], ['Your other Pokémon', 'eachOtherOwn'],
  ['Your Pokémon', 'eachOwn', 'your'], ['Each of your Pokémon', 'eachOwn'], ['The attacker', 'attacker'], ['It', 'it'], ['They', 'they']];
const SUBJ = `(${SUBJECTS.map(([p]) => esc(p)).sort((a, b) => b.length - a.length).join('|')})`;
const KWS = Object.entries(KEYWORD_NAMES).sort((a, b) => b[1].length - a[1].length);
const KW = `(${KWS.map(([, n]) => esc(n)).join('|')})`;
const kwId = (name) => KWS.find(([, n]) => n === name)[0];
const STATS = '((?:[+−]\\d+ (?:Attack|Strength))(?: and [+−]\\d+ (?:Attack|Strength))?)';
const num = (t) => Number(t.replace('−', '-'));
const statOps = (t, kind, extra = {}) => [...t.matchAll(/([+−]\d+) (Attack|Strength)/g)].map((m, i) => ({ op: { kept: m[2] === 'Attack' ? 'attack' : 'strength', temp: m[2] === 'Attack' ? 'tempAttack' : 'tempStrength', held: m[2] === 'Attack' ? 'attack' : 'strength' }[kind], amount: num(m[1]), ...(i ? { to: 'same' } : {}), ...extra }));

// A subject's predicates, in order: "gets +2 Attack (kept)", "becomes Active", "gets Shell 2 until Supper" …
const PRED = `(?:(?:gets?|becomes?) (?:${STATS} \\(kept\\)|${STATS} until Supper|Shell \\d+ until Supper|Active|Spent))`;
function predOps(text) {
  const ops = [];
  for (const m of text.matchAll(new RegExp(`(gets?|becomes?) (${STATS} \\(kept\\)|${STATS} until Supper|Shell (\\d+) until Supper|Active|Spent)`, 'g'))) {
    const p = m[2];
    if (/\(kept\)$/.test(p)) ops.push(...statOps(p, 'kept'));
    else if (/until Supper$/.test(p) && /^Shell/.test(p)) ops.push({ op: 'shellTemp', amount: num(m[5]) });
    else if (/until Supper$/.test(p)) ops.push(...statOps(p, 'temp'));
    else ops.push({ op: p === 'Active' ? 'activate' : 'spend' });
  }
  return ops;
}

// --- Clause patterns (anchored; tried at each position; the longest match that ends at a separator wins) ----------
const PATTERNS = {
  effect: [
    ['typeKept', /^\+(\d+) Attack and \+\1 Strength \(kept\) for each other Type among your Pokémon, up to \+(\d+)/, (m) => [{ op: 'typeBonus', amount: num(m[1]), cap: num(m[2]), stats: ['attack', 'strength'], to: 'self' }]],
    ['damage', new RegExp(`^(\\d+) damage to ${TGT}(, before its attack)?`), (m) => [{ op: 'damage', amount: num(m[1]), ...target(m[2]), ...(m[3] ? { before: true } : {}) }]],
    ['damageShort', new RegExp(`^(\\d+) to ${TGT}`), (m) => [{ op: 'damage', amount: num(m[1]), ...target(m[2]) }]],
    ['healKept', new RegExp(`^Heal (\\d+) and \\+(\\d+) (Attack|Strength) \\(kept\\) to ${TGT}`), (m) => [{ op: 'heal', amount: num(m[1]), ...target(m[4]) }, { op: m[3] === 'Attack' ? 'attack' : 'strength', amount: num(m[2]), to: 'same' }]],
    ['heal', new RegExp(`^Heal (\\d+) to ${TGT}(, before the damage)?`), (m) => [{ op: 'heal', amount: num(m[1]), ...target(m[2]), ...(m[3] ? { before: true } : {}) }]],
    ['healEach', /^Heal (\d+) to each/, (m) => [{ op: 'heal', amount: num(m[1]), to: 'they' }]],
    ['kept', new RegExp(`^${STATS} \\(kept\\)(?: to ${TGT})?`), (m) => { const t = m[2] ? target(m[2]) : { to: 'self' }; const ops = statOps(m[1], 'kept'); Object.assign(ops[0], t); return ops; }],
    ['subject', new RegExp(`^${SUBJ} (${PRED}(?: and ${PRED})*)`), (m) => {
      const s = SUBJECTS.find(([p]) => p === m[1]);
      const ops = predOps(m[2]);
      Object.assign(ops[0], { to: s[1], ...(s[2] ? { word: s[2] } : {}) });
      for (const o of ops.slice(1)) o.to = s[1] === 'it' || s[1] === 'they' ? s[1] : 'same';
      return ops;
    }],
    ['energy', /^\+(\d+) Energy this Round/, (m) => [{ op: 'energy', amount: num(m[1]) }]],
    ['draw', /^Draw (\d+) cards?/, (m) => [{ op: 'draw', amount: num(m[1]) }]],
    ['dollars', /^Gain \$(\d+)/, (m) => [{ op: 'dollars', amount: num(m[1]) }]],
    ['recognition', /^Gain (\d+) Recognition/, (m) => [{ op: 'recognition', amount: num(m[1]) }]],
    ['handLevels', /^(Each Pokémon card in your hand|It) gains \+(\d+) Levels?/, (m) => [{ op: 'handLevels', amount: num(m[2]), to: m[1] === 'It' ? 'found' : 'eachHand' }]],
    ['search', /^Put (a|\d+) Pokémon cards? from your (Draw Pile|Discard Pile) into your hand/, (m) => [{ op: m[2] === 'Draw Pile' ? 'search' : 'recover', amount: m[1] === 'a' ? 1 : num(m[1]) }]],
    ['returnHand', new RegExp(`^Return ${TGT} to your hand`), (m) => [{ op: 'returnHand', ...target(m[1]) }]],
    ['attackFizzles', /^The attack fizzles/, () => [{ op: 'attackFizzles' }]],
    ['reduce', /^The attack deals (\d+) less damage \(minimum 0\)/, (m) => [{ op: 'reduce', amount: num(m[1]), to: 'attack' }]],
    ['noDamage', /^The attack deals no damage/, () => [{ op: 'noDamage', to: 'attack' }]],
  ],
  held: [
    ['heldStat', /^\+(\d+) (Attack|Strength)(, but it can't hit back)?/, (m) => [{ op: m[2] === 'Attack' ? 'attack' : 'strength', amount: num(m[1]), ...(m[3] ? { noHitBack: true } : {}) }]],
    ['heldTypeKeyword', new RegExp(`^An? (\\w+) Pokémon also has ${KW}(?: (\\d+))?`), (m) => [{ op: 'keyword', keyword: kwId(m[2]), ...(m[3] ? { amount: num(m[3]) } : {}), type: m[1] }]],
    ['heldKeyword', new RegExp(`^${KW}(?: (\\d+))?`), (m) => [{ op: 'keyword', keyword: kwId(m[1]), ...(m[2] ? { amount: num(m[2]) } : {}) }]],
    ['heldSpeed', /^Its Speed is one step higher/, () => [{ op: 'speed', amount: 1 }]],
  ],
  location: [
    ['locStat', new RegExp(`^Pokémon(?: of Level (\\d+) or less)? here have ${STATS}`), (m) => statOps(m[2], 'held', m[1] ? { maxLevel: num(m[1]) } : {}).map((o) => { const { to, ...rest } = o; return rest; })],
    ['locKeyword', new RegExp(`^Pokémon here have ${KW}(?: (\\d+))?`), (m) => [{ op: 'keyword', keyword: kwId(m[1]), ...(m[2] ? { amount: num(m[2]) } : {}) }]],
    ['locDiscount', /^Summoning a Pokémon here costs (\d+) less \(minimum 0\)/, (m) => [{ op: 'discount', amount: num(m[1]) }]],
    ['locHeal', /^Pokémon here heal (\d+) at Breakfast/, (m) => [{ op: 'heal', amount: num(m[1]), when: 'breakfast' }]],
  ],
};
const SEPS = ['. ', ', and ', ', '];

// Parse one effect sentence into clauses; throws if any part matches no pattern.
function parse(text, kind, where) {
  if (!text.endsWith('.')) throw new Error(`${where}: no full stop: "${text}"`);
  const body = text.slice(0, -1);
  const clauses = [];
  let pos = 0;
  let sep = '';
  while (pos < body.length) {
    const rest = body.slice(pos);
    const chunk = rest.charAt(0).toUpperCase() + rest.slice(1);
    let best = null;
    for (const [say, re, make] of PATTERNS[kind]) {
      const m = chunk.match(re);
      if (!m) continue;
      const after = rest.slice(m[0].length);
      if (after && !SEPS.some((x) => after.startsWith(x))) continue;
      if (!best || m[0].length > best.m[0].length) best = { say, m, make };
    }
    if (!best) throw new Error(`${where}: no pattern for "${rest}" (in "${text}")`);
    clauses.push({ say: best.say, ...(clauses.length ? { sep } : {}), ops: best.make(best.m) });
    pos += best.m[0].length;
    if (pos >= body.length) break;
    sep = SEPS.find((x) => body.startsWith(x, pos));
    pos += sep.length;
  }
  const again = effectText(clauses);
  if (again !== text) throw new Error(`${where}: the wording doesn't round-trip:\n  card: ${text}\n  gen:  ${again}`);
  return clauses;
}

// A Favour: the base effect with the changes its line names ("Heal 5 instead.", "3 and 2 instead.", "+3 Attack, and
// Overrun until Supper.").
function favourEffect(base, text, where) {
  const fx = structuredClone(base);
  const ops = fx.flatMap((c) => c.ops);
  const first = (pred) => { const o = ops.find(pred); if (!o) throw new Error(`${where}: favour "${text}" names nothing in the effect`); return o; };
  let m;
  if ((m = text.match(/^(\d+) and (\d+) instead\.$/))) { const d = ops.filter((o) => o.op === 'damage'); d[0].amount = num(m[1]); d[1].amount = num(m[2]); }
  else if ((m = text.match(/^\+(\d+) and \+(\d+) instead\.$/))) { first((o) => o.op === 'attack').amount = num(m[1]); first((o) => o.op === 'strength').amount = num(m[2]); }
  else if ((m = text.match(/^Heal (\d+) instead\.$/))) first((o) => o.op === 'heal').amount = num(m[1]);
  else if ((m = text.match(/^Draw (\d+) instead\.$/))) first((o) => o.op === 'draw').amount = num(m[1]);
  else if ((m = text.match(/^(\d+) cards instead\.$/))) first((o) => o.op === 'search' || o.op === 'recover').amount = num(m[1]);
  else if ((m = text.match(/^\+(\d+) Strength instead\.$/))) first((o) => o.op === 'strength').amount = num(m[1]);
  else if ((m = text.match(/^\+(\d+) Attack instead\.$/))) first((o) => o.op === 'attack' || o.op === 'tempAttack').amount = num(m[1]);
  else if ((m = text.match(/^\+(\d+) Levels instead\.$/))) first((o) => o.op === 'handLevels').amount = num(m[1]);
  else if ((m = text.match(/^(\d+) damage instead\.$/))) first((o) => o.op === 'damage').amount = num(m[1]);
  else if ((m = text.match(/^Shell (\d+) instead\.$/))) first((o) => o.op === 'shellTemp').amount = num(m[1]);
  else if ((m = text.match(new RegExp(`^\\+(\\d+) Attack, and ${KW} until Supper\\.$`)))) {
    first((o) => o.op === 'tempAttack').amount = num(m[1]);
    fx.at(-1).ops.push({ op: 'tempKeyword', keyword: kwId(m[2]), to: 'same' });
  } else throw new Error(`${where}: no pattern for the Favour "${text}"`);
  return fx;
}
const FAVOUR_KEY = Object.fromEntries(Object.entries(FAVOUR_RELEASE).map(([k, v]) => [v, k]));
const OBJECTIVES = [[/^Defeat (\d+) enemy Pokémon\.$/, 'defeat'], [/^Dominate a Location (\d+) times\.$/, 'dominate'], [/^Give your Pokémon kept Attack or Strength (\d+) times\.$/, 'keptGain'],
  [/^Gain (\d+) extra Energy from your cards\.$/, 'extraEnergy'], [/^Buy (\d+) Items from the PokéMart\.$/, 'itemsBought']];
const TRIGGERS = { 'On Summon': 'summon', 'On Attack': 'attack', 'On Defend': 'defend', 'On Defeated': 'defeated', 'On Knockout': 'knockout', 'On Breakfast': 'breakfast', 'On Dominate': 'dominate' };
const keywords = (list) => Object.fromEntries(list.map((k) => { const m = k.match(/^(.*?)(?: (\d+))?$/); return [kwId(m[1]), m[2] ? num(m[2]) : true]; }));
const trigger = (f, where) => (f.trigger ? { on: TRIGGERS[f.trigger] ?? (() => { throw new Error(`${where}: unknown trigger ${f.trigger}`); })(), effect: parse(f.text, 'effect', where) } : null);

// --- Build -------------------------------------------------------------------------------------------------------------
const db = JSON.parse(readFileSync(SRC, 'utf8'));
const inBatch = (c) => BATCHES.includes(c.batch);
const pokemon = db.pokemon.filter(inBatch).map((p) => ({
  id: p.id, name: p.name, batch: p.batch, type: p.type, series: p.series, legendary: !!p.legendary, attackType: p.attackType, guard: p.guard ?? null,
  forms: p.forms.map((f) => ({ name: f.name, art: f.art, hasArt: !!f.hasArt, from: f.from, to: f.to, speed: f.speed, keywords: keywords(f.keywords ?? []), trigger: trigger(f, `${p.id}/${f.name}`) })),
  stats: Object.fromEntries(Object.entries(p.stats).map(([lv, st]) => [lv, [st.attack, st.strength]])),
}));
const MODES = { React: 'react', Adapt: 'adapt', Strat: 'strat' };
const moves = db.moves.filter(inBatch).map((m) => ({
  id: m.id, name: m.name, batch: m.batch, type: m.type, art: m.art, hasArt: !!m.hasArt,
  modes: Object.fromEntries(m.modes.map((x) => {
    const effect = parse(x.text, 'effect', `${m.id}/${x.mode}`);
    if (shortModeText(effect) !== x.cardText) throw new Error(`${m.id}/${x.mode}: the card line doesn't round-trip:\n  card: ${x.cardText}\n  gen:  ${shortModeText(effect)}`);
    return [MODES[x.mode], { cost: x.cost, effect }];
  })),
}));
const supporters = db.supporters.filter(inBatch).map((s) => {
  const effect = parse(s.text, 'effect', s.id);
  const condition = FAVOUR_KEY[s.favour.release];
  if (!condition) throw new Error(`${s.id}: unknown Favour condition "${s.favour.release}"`);
  const sup = { id: s.id, name: s.name, batch: s.batch, art: s.art, hasArt: !!s.hasArt, release: s.release, effect,
    favour: { condition, recognition: s.favour.recognition, effect: favourEffect(effect, s.favour.text, `${s.id} Favour`) } };
  if (favourText(sup) !== s.favour.text) throw new Error(`${s.id}: the Favour doesn't round-trip:\n  card: ${s.favour.text}\n  gen:  ${favourText(sup)}`);
  return sup;
});
const items = db.items.filter(inBatch).map((i) => ({ id: i.id, name: i.name, batch: i.batch, art: i.art, hasArt: !!i.hasArt, price: i.price, itemType: i.kind, stock: i.stock,
  effect: parse(i.text, i.kind === 'Held' ? 'held' : 'effect', i.id) }));
const locations = db.locations.filter(inBatch).map((l) => ({ id: l.id, name: l.name, batch: l.batch, art: l.art, hasArt: !!l.hasArt, width: l.lanes, rounds: l.rounds,
  passive: parse(l.passive, 'location', l.id) }));
const trainers = db.trainers.filter(inBatch).map((t) => {
  const o = OBJECTIVES.map(([re, op]) => [t.objective.text.match(re), op]).find(([m]) => m);
  if (!o) throw new Error(`${t.id}: no pattern for the Objective "${t.objective.text}"`);
  const objective = { op: o[1], need: num(o[0][1]) };
  if (objective.need !== t.objective.need || objectiveText(objective) !== t.objective.text) throw new Error(`${t.id}: the Objective doesn't round-trip`);
  const p = t.partner;
  return { id: t.id, name: t.name, batch: t.batch, type: t.type, art: t.art, hasArt: !!t.hasArt,
    command: { cost: t.command.cost, effect: parse(t.command.text, 'effect', `${t.id} Command`) }, objective,
    partner: { id: p.id, name: p.name, art: p.art, hasArt: !!p.hasArt, type: t.type, level: p.level, cost: p.cost, speed: p.speed, attackType: p.attackType, attack: p.attack, strength: p.strength,
      keywords: keywords(p.keywords ?? []), trigger: trigger(p, `${t.id}/${p.name}`) } };
});

// --- Write ---------------------------------------------------------------------------------------------------------------
const list = (name, rows) => `export const ${name} = [\n${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`;
const file = `// GENERATED by v4/tools/buildcards.mjs from docs/base-game/cards.json (version ${db.version}). Don't edit by hand:
// change cards.json (with Elliott's approval) and run \`node v4/tools/buildcards.mjs\`. Batch ${BATCHES.join(', ')}.
//
// The effect vocabulary. Every trigger, Move mode, Supporter, Item, Location passive and Trainer Command is a list of
// clauses { say, sep, ops }: the engine runs the ops in order; src/engine/wording.js writes the wording from them.
//   ops (amount N):
//     damage N · heal N · draw N · energy N (Base Energy this Round) · dollars N ($) · recognition N
//     attack N / strength N (kept) · tempAttack ±N / tempStrength N (until Supper) · shellTemp N (Shell N until Supper)
//     tempKeyword (a keyword until Supper) · spend (becomes Spent) · activate (becomes Active)
//     returnHand (to its owner's hand) · attackFizzles (the attack being Reacted to fizzles: Dive's React)
//     reduce N / noDamage (the attack being Reacted to deals N less / no damage, minimum 0)
//     search N / recover N (Pokémon cards from the Draw / Discard Pile into your hand) · handLevels N (Pokémon cards in
//     your hand gain N Levels: 'eachHand', or 'found': the cards just searched)
//     typeBonus N, cap (+N of each stat, kept, for each other Type among your Pokémon, up to cap)
//   Held Items and Location passives (while held / while in that Location): attack N · strength N (maxLevel: only Pokémon
//     of that Level or less) · keyword (type: only a Pokémon of that Type) · speed N (steps) · noHitBack · discount N ·
//     heal N at Breakfast
//   targets (to): self · chosenEnemy · chosenOwn (you choose; a Move's or Item's target is the first one)
//     chosenLocEnemies / chosenLocOwn (each enemy / each of yours in a chosen Location) · thereOwn (each of yours in it)
//     eachEnemy · eachEnemyHere / eachOwnHere / eachOtherOwnHere (in its Location) · eachOwn · eachOtherOwn
//     oneOtherEnemyTargetLoc / otherEnemiesTargetLoc (in the attack target's Location) · otherEnemiesItsLoc (the chosen
//     enemy's Location) · acrossEnemy (the same lane) · enemyPC (the enemy Player Character) · attacker · attacked ·
//     attackerLocEnemies (each enemy in the attacker's Location) · attack (the attack being Reacted to)
//     same / it / they (the previous op's Pokémon)
//   triggers (on): summon · attack · defend · defeated · knockout · breakfast · dominate
//   keywords: quickAttack · infiltrator · overrun · shell N · regenerate N · retaliate N · rage · drain · sturdy ·
//     agility · intimidate N · stealth · pickup
//   Objectives (op, need): defeat · dominate · keptGain · extraEnergy · itemsBought

${list('POKEMON', pokemon)}
${list('MOVES', moves)}
${list('SUPPORTERS', supporters)}
${list('ITEMS', items)}
${list('LOCATIONS', locations)}
${list('TRAINERS', trainers)}`;
if (process.argv.includes('--check')) {
  const now = readFileSync(OUT, 'utf8');
  if (now !== file) { console.error('src/data/cards.js is out of date: run node v4/tools/buildcards.mjs'); process.exit(1); }
  console.log('src/data/cards.js is up to date');
} else {
  writeFileSync(OUT, file);
  console.log(`wrote ${OUT}: ${pokemon.length} Pokémon series, ${moves.length} Moves, ${supporters.length} Supporters, ${items.length} Items, ${locations.length} Locations, ${trainers.length} Trainers`);
}
