// C3: the Codex's explanations. Pure: no DOM. Each one is built from the engine's own functions (attackParts,
// wantedBonus, summonCost, effectiveSpeed, weatherTotals, levelFor, pokemonAt), so it always matches what the
// board shows. tests/c3.test.js checks the sums over 200 random mid-match states.
// Copied from v2/src/engine/explain.js (C3): the idea of "where its numbers come from" as parts that add up
// to the stat shown, and the version arrows (▲/▼); rewritten for v4's stats.
// Never the series names (Light, Mid, Heavy): a line's Levels are given by its forms.
import { RULES, SERIES_RANGE, levelFor, costFor } from '../rules.js?v=202611110816';
import { PATHS, pathDef, pokemonAt, TRAINERS, WEATHER_BRACKETS } from './cards.js?v=202611110816';
import {
  locationAt, activeBrackets, weatherTotals, summonCost, effectiveSpeed, damageOf, strengthIn, tournamentStrength, lanesOf,
  isReady, REC_KINDS, boosted,
} from './game.js?v=202611110816';
import { printedOf, effectiveStats } from './stats.js?v=202611110816';
import { baseEnergyFor, exertMaxFor, availableExert } from './energy.js?v=202611110816';

const signed = (n) => (n < 0 ? `− ${-n}` : `+ ${n}`);
// "Attack 9 = 8 base + 1 Mt. Ember": parts [{ label, n }] in words.
export function sumLine(stat, total, parts) {
  const [first, ...rest] = parts;
  if (!first) return `${stat} ${total}`;
  return `${stat} ${total} = ${first.n} ${first.label}${rest.map((p) => ` ${signed(p.n)} ${p.label}`).join('')}`;
}

// C4: printed stats and the current ones come from stats.js (one helper for the board, the Codex and previews).
export { printedOf };

// Where a Pokémon's numbers come from. On the board ({ who, space }): effectiveStats (C4), the engine's own
// numbers; elsewhere (a card in hand or a pile): its printed stats and its cost at this Round.
//   attack: parts sum to the Attack shown, the damage its attack deals now (Sun 2 included for a Physical
//   attack); strength: parts sum to the current Strength shown; cost; speed.
export function statSums(s, card, where = null) {
  const printed = printedOf(card);
  const out = {};
  if (where && s.players[where.who].row[where.space]?.uid === card.uid) {
    const st = effectiveStats(s, where.who, where.space);
    out.attack = { total: st.attack, parts: st.attackParts.map((p) => (p.label === 'printed' ? { ...p, label: 'base' } : p)) };
    out.strength = { total: st.strength, max: st.strengthMax, parts: st.strengthParts.map((p) => (p.label === 'printed' ? { ...p, label: 'base' } : p)) };
    out.cost = card.partner || card.series === 'Partner'
      ? { total: 0, parts: [], words: 'A Partner arrives free.' }
      : { total: costFor(card.level), parts: [{ label: `Level ${card.level} ÷ 2, rounded up`, n: costFor(card.level) }], words: 'Paid when it was summoned.' };
  } else {
    out.attack = { total: card.attack, parts: [{ label: 'base', n: card.attack }] };
    out.strength = { total: card.currentStrength ?? card.strength, max: card.strength, parts: [{ label: 'base', n: card.strength }] };
    if (card.partner || card.series === 'Partner') out.cost = { total: 0, parts: [], words: 'A Partner arrives free.' };
    else {
      const c = costFor(card.level);
      const cheaper = s ? s.locations.filter((l) => l.passive.kind === 'discount') : [];
      out.cost = { total: c, parts: [{ label: `Level ${card.level} ÷ 2, rounded up`, n: c }],
        words: cheaper.length ? cheaper.map((l) => `${c - Math.max(0, c - l.passive.amount)} less in ${l.name} (${Math.max(0, c - l.passive.amount)})`).join('; ') : '' };
    }
  }
  const speedParts = [{ label: 'base', n: printed.speed }];
  if (card.held?.op === 'speed') speedParts.push({ label: card.held.name, n: 'one step higher' });
  out.speed = { total: effectiveSpeed(card), parts: speedParts };
  return out;
}
// The sums as lines of words.
export function statLines(sums) {
  const lines = [sumLine('Attack', sums.attack.total, sums.attack.parts)];
  lines.push(sumLine('Strength', sums.strength.total, sums.strength.parts) + (sums.strength.total !== sums.strength.max ? ` (of ${sums.strength.max})` : ''));
  lines.push(sums.cost.parts.length ? `Cost ${sums.cost.total} = ${sums.cost.parts[0].label}${sums.cost.words ? `. ${sums.cost.words}` : ''}` : `Cost: ${sums.cost.words}`);
  lines.push(sums.speed.parts.length > 1 ? `Speed ${sums.speed.total} = ${sums.speed.parts[0].n}, ${sums.speed.parts.slice(1).map((p) => `${p.n} (${p.label})`).join(', ')}` : `Speed ${sums.speed.total}`);
  return lines;
}

// A line's forms by Level: [{ name, art, from, to, current }]. Partners have none.
export function formsRow(id, level) {
  const p = pathDef(id);
  if (!p) return [];
  const hi = SERIES_RANGE[p.series][1];
  return p.forms.map((f, i) => {
    const to = (p.forms[i + 1]?.from ?? hi + 1) - 1;
    return { name: f.name, art: f.art, from: f.from, to, level: f.from, current: level >= f.from && level <= to };
  });
}
// The Levels a line covers, in words ("Levels 3–8").
export const lineRange = (id) => { const p = pathDef(id); return p ? SERIES_RANGE[p.series] : null; };

// For a card off the battlefield: its Level now and how it grows.
export function levelGrowth(card, round) {
  const r = lineRange(card.id);
  if (!r) return '';
  const now = levelFor(pathDef(card.id).series, round);
  return now >= r[1] ? `Level ${now} now: its line's maximum.` : `Level ${now} now; +1 each Round it stays off the battlefield, up to ${r[1]}.`;
}
// What a card in hand becomes next Round: { level, name, attack, strength, cost, arrows, text } or null at its
// maximum. ▲/▼ compare with now (v2's version arrows).
export function nextRound(card, round) {
  const p = pathDef(card.id);
  if (!p) return null;
  const lv = levelFor(p.series, round + 1);
  const now = pokemonAt(card.id, levelFor(p.series, round));
  if (lv === now.level) return { level: lv, same: true, text: `Stays Level ${lv} next Round (its maximum).` };
  const next = pokemonAt(card.id, lv);
  const arrow = (a, b) => (b > a ? '▲' : b < a ? '▼' : '');
  const bits = [`Attack ${next.attack}${arrow(now.attack, next.attack)}`, `Strength ${next.strength}${arrow(now.strength, next.strength)}`, `cost ${next.cost}${arrow(now.cost, next.cost)}`];
  return {
    level: lv, name: next.name, attack: next.attack, strength: next.strength, cost: next.cost, evolves: next.name !== now.name,
    text: `Lv ${lv} next Round${next.name !== now.name ? ` (${next.name})` : ''}: ${bits.join(', ')}`,
  };
}

// A Pokémon's state in words (Ready, Active, Spent; damaged; guard; Held Item).
export function pokemonState(s, card, where) {
  const out = [];
  if (where) {
    out.push(isReady(s, card) ? 'Ready: it can attack, and hits back if attacked.' : card.spent ? 'Spent: it can\'t attack until Breakfast.' : 'Active, but not Ready: a faster Pokémon is Active.');
    if (card.currentStrength < card.strength) out.push(`Damaged: ${card.currentStrength} of ${card.strength} Strength.`);
    if (card.tempAttack) out.push(`+${card.tempAttack} Attack until Supper.`);
    if (card.held) out.push(`Holding ${card.held.name}: ${card.held.text.replace(/^Held: /, '')}.`);
  }
  out.push(`${card.attackType} attacks.`);
  if (card.strengthType === 'Defence') out.push('Defence guard: it protects your other Pokémon in its Location, and your Player Character from Physical attackers there.');
  else if (card.strengthType === 'Special Defence') out.push('Special Defence guard: it protects your other Pokémon in its Location, and your Player Character from Special attackers there.');
  return out;
}

// --- Recognition, Energy, Weather, the PokéMart, Locations, Objectives --------------------------------

// The ring's history by source: [{ kind, label, total, items: [{ round, amount, source }] }], with the
// Tournament's bonus (amount − base) as its own group. Totals add up to the player's Recognition.
export function recognitionHistory(s, who) {
  const h = s.players[who].recHistory ?? [];
  const groups = new Map();
  const add = (kind, label, round, amount, source) => {
    if (!groups.has(kind)) groups.set(kind, { kind, label, total: 0, items: [] });
    const g = groups.get(kind);
    g.total += amount;
    g.items.push({ round, amount, source });
  };
  for (const e of h) {
    add(e.kind, REC_KINDS[e.kind] ?? 'Other', e.round, e.base, e.source);
    if (e.amount !== e.base) add('tournament', 'Tournament bonus', e.round, e.amount - e.base, e.source);
  }
  const order = [...Object.keys(REC_KINDS), 'tournament'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

// The Energy tile in words.
export function energyExplain(s, who) {
  const p = s.players[who];
  const r = p.energyRound ?? { round: s.round, base: baseEnergyFor(s.round), pass: 0, effects: [] };
  const lines = [`This Round's Base Energy: ${r.base} (Round ${s.round}; it is the Round number, at most 10).`];
  if (r.pass) lines.push(`Passes this Round: +${r.pass}.`);
  for (const e of r.effects) lines.push(`${e.source}: +${e.amount} this Round.`);
  lines.push(`Base Energy left: ${p.baseEnergy}.`);
  lines.push(`Exert: ${availableExert(p)} of ${p.exertMax} ready (the maximum is the Round number, at most ${exertMaxFor(99)}).`);
  if (p.exhaust.length) lines.push(`Exhausted: ${p.exhaust.slice().sort((a, b) => a.position - b.position).map((x) => `position ${x.position} recovers at Round ${x.recoversRound}'s Breakfast`).join('; ')}.`);
  else lines.push('Nothing is Exhausted.');
  lines.push(`Energy you can spend now: ${p.baseEnergy + availableExert(p)}.`);
  return lines;
}

// The Weather: the full bracket table (reached or not), the totals and which Locations add them.
export function weatherExplain(s) {
  const t = weatherTotals(s);
  return {
    totals: t,
    tournament: !!s.tournament,
    brackets: WEATHER_BRACKETS.map((b) => ({ ...b, reached: !s.tournament && t[b.type] >= b.at })),
    sources: s.locations.map((l) => ({ name: l.name, type: l.weather.type, count: l.weather.count, owner: l.owner })),
  };
}

// The PokéMart in words.
export function martExplain(s) {
  const m = s.mart;
  const c = m.onSale[0];
  const lines = [];
  if (m.soldOut) lines.push(`Sold out: bought by ${m.soldOut.by === 'player' ? 'you' : 'the Opponent'}. A random Item arrives with full Stock once ${m.soldOut.by === 'player' ? 'you have' : 'they have'} finished ${m.soldOut.by === 'player' ? 'your' : 'their'} next turn${m.soldOut.armed ? ' (the next one ends it)' : ''}. Nothing counts down until then.`);
  else if (c) {
    lines.push(`On sale: ${c.name}, $${c.price}, ${c.itemType}. ${c.text}.`);
    lines.push(`Stock ${m.stock} of ${c.stock}: each turn taken by either player in the Battle Phase uses 1. At 0 it goes back to the pool and a different random Item replaces it.`);
  } else lines.push('Nothing is on sale: the pool is empty.');
  lines.push(`The pool: ${m.pool.length ? m.pool.map((x) => x.name).sort().join(', ') : 'empty'}.`);
  return lines;
}

// A placed Location in words, or the Tournament.
export function locationExplain(s, l) {
  if (!l) return [];
  const lanes = lanesOf(l);
  const a = strengthIn(s, l, 'player');
  const b = strengthIn(s, l, 'ai');
  return [
    `${l.passive.text}.`,
    `Lanes ${lanes[0] + 1}–${lanes.at(-1) + 1} (${l.width}), placed by ${l.owner === 'player' ? 'you' : 'the Opponent'}.`,
    `${l.roundsLeft} Round${l.roundsLeft === 1 ? '' : 's'} left: it counts down at Supper, after scoring.`,
    `Weather: adds ${l.weather.count} ${l.weather.type}.`,
    `Strength here: you ${a}, the Opponent ${b}. ${a > b ? 'You dominate it' : b > a ? 'The Opponent dominates it' : 'Nobody dominates it (a tie)'}.`,
    `Dominating it at Supper: +${boosted(s, RULES.perDominance)} Recognition.`,
  ];
}
export function tournamentExplain(s) {
  const a = tournamentStrength(s, 'player');
  const b = tournamentStrength(s, 'ai');
  return [
    s.tournament ? `It began at Round ${s.tournament.startedRound}'s Breakfast.` : `It begins at Breakfast in Round ${RULES.tournamentRound}, or at the first Breakfast where either player has ${RULES.tournamentRecognition}+ Recognition.`,
    `It covers all ${RULES.lanes} lanes: no Location passives, no Weather, and no Location can be placed.`,
    'Passive: all Recognition earned is increased by half, rounded up (1 → 2, 3 → 5, 4 → 6).',
    `Strength across the battlefield: you ${a}, the Opponent ${b}.`,
    `Dominating it at Supper: +${RULES.perTournamentDominance} Recognition, ${boosted({ tournament: true }, RULES.perTournamentDominance)} with the passive. It counts for Blaine's Objective.`,
  ];
}
export function objectiveExplain(s, who, t) {
  return [
    `Goal: ${t.objective.text}.`,
    t.complete ? 'Complete.' : `Progress: ${Math.min(t.progress, t.objective.need)} of ${t.objective.need}.`,
    `Reward: ${t.card.partner.name} arrives as a Partner (its On Summon resolves) and +${RULES.perObjective} Recognition. The Trainer card leaves the deck for good.`,
    'Tracked from Round 1, free. Playing the Trainer card as its Trainer Command doesn\'t affect it.',
  ];
}

// Every line has every Level covered by exactly one form (the test reads this).
export const LINES = PATHS.map((p) => ({ id: p.id, range: SERIES_RANGE[p.series] }));
