// Feedback B — information: why a card can't be played, what a target choice will do (or why
// it can't be chosen), and which version of a Strategy Card the hand shows. Pure: no DOM.
// The screen (board.js, prompt.js) and the Codex (codex.js) read these; the rules don't.
import {
  summonCost, locationStarts, breakpointsFor, opsPossible, canTarget, supporterPlayable, itemUsable, bagFull,
  trainerSpaces, targetOptions, legalTargets, attackPreview, opponentOf, trainTop, kwSum, shellOf, locLanesAt,
} from './game.js';
import { LANES } from './rules.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const needs = (cost, have) => `Needs ${cost} Energy · you have ${have}`;

// Why a card in hand can't be played now (null when it can). On your turn only.
export function whyNot(state, who, card) {
  const p = state.players[who];
  const energy = p.energy;
  switch (card.cardType) {
    case 'Pokémon': {
      if (!p.row.includes(null)) return 'No empty space';
      const cost = Math.min(...Array.from({ length: LANES }, (_, i) => i).filter((i) => !p.row[i]).map((i) => summonCost(card, false, state, who, i)));
      return cost > energy ? needs(cost, energy) : null;
    }
    case 'Location':
      return locationStarts(state, card).length ? null : `No room: needs ${plural(card.lanes, 'free Home lane')} side by side`;
    case 'Strategy': {
      if (breakpointsFor(state, who, card).length) return null;
      const cheapest = Math.min(...card.breakpoints.map((b) => b.cost));
      if (cheapest > energy) return needs(cheapest, energy);
      const affordable = card.breakpoints.filter((b) => b.cost <= energy);
      if (affordable.every((b) => b.needsGrowth && p.growth < 1)) return 'Needs Growth · you have 0';
      if (affordable.every((b) => !canTarget(state, who, b.target))) return 'No legal target';
      return 'Nothing to choose from';
    }
    case 'Supporter': {
      if (supporterPlayable(state, who, card)) return null;
      if (p.hand.length - 1 < card.release) return `Needs ${plural(card.release, 'other card')} to Release`;
      if (!opsPossible(state, who, card.ops)) return 'Nothing to choose from';
      return 'No legal target';
    }
    case 'Item':
      if (card.cost > energy) return needs(card.cost, energy);
      if (!itemUsable(state, who, card) && bagFull(state, who)) return 'No legal target, and your Bag is full';
      return null;
    case 'Trainer':
      if (card.cost > energy) return needs(card.cost, energy);
      return trainerSpaces(state, who).length ? null : 'Every space has a Trainer';
    default: return null;
  }
}

// A Strategy Card's versions (Feedback B, 5): the breakpoint the hand shows is the highest
// affordable one (with a target), or the one you selected if it's still affordable; if none
// is, the cheapest, dimmed. Each version: { cost, text, can, why }.
export function strategyVersions(state, who, card, selected) {
  const ok = new Set(breakpointsFor(state, who, card).map((b) => b.cost));
  const energy = state.players[who].energy;
  const versions = card.breakpoints.map((b, i) => ({ index: i, cost: b.cost, text: b.text, can: ok.has(b.cost), why: ok.has(b.cost) ? null : b.cost > energy ? `Needs ${b.cost}` : 'No legal target' }));
  const playable = versions.filter((v) => v.can);
  const chosen = playable.find((v) => v.cost === selected) ?? playable.at(-1) ?? versions[0];
  return { versions, shown: chosen.index, can: playable.length > 0 };
}

// --- Choosing targets ------------------------------------------------------------------------

// What an effect's ops will do to a target, in a few words ("Burn 2", "deal 4 damage").
export function opsVerb(ops = [], { x } = {}) {
  const words = ops.map((o) => {
    switch (o.op) {
      case 'damage': return `deal ${o.amount} damage`;
      case 'solarBeam': return `deal ${x ?? 'X'} damage`;
      case 'burn': return `Burn ${o.amount}`;
      case 'heal': return `heal ${o.amount}`;
      case 'douse': return 'Douse it';
      case 'cure': return 'cure its statuses';
      case 'sleep': return 'put it to Sleep';
      case 'leechSeed': return 'Leech Seed it';
      case 'train': return `train it ${o.amount}`;
      case 'buff': return `give it ${[o.attack && `+${o.attack} Attack`, o.strength && `+${o.strength} Strength`, ...(o.keywords ?? [])].filter(Boolean).join(', ')} ${o.until === 'breakfast' ? 'until Breakfast' : 'this Round'}`;
      case 'grow': return `give it +${o.attack ?? 0}/+${o.strength ?? 0} for good`;
      case 'shellRound': return `give it Shell ${o.amount} this Round`;
      case 'gainKeyword': return `give it ${o.keyword}`;
      case 'ready': return 'make it Active';
      case 'enemyLosesRecognition': return `the enemy player also loses ${o.amount} Recognition`;
      default: return null;
    }
  }).filter(Boolean);
  return words.join(', ') || 'choose it';
}

// Why a Pokémon isn't a legal target for a spec (null if it is). ref: { who, kind, space }.
export function targetWhyNot(state, who, spec, ref, ctx = {}) {
  if (!spec) return 'Nothing to choose';
  const key = (t) => `${t.who}:${t.kind}:${t.space ?? t.id ?? ''}`;
  if (targetOptions(state, who, spec, ctx).some((o) => key(o) === key(ref))) return null;
  const side = spec.side === 'enemy' ? opponentOf(who) : who;
  if (ref.who !== side) return spec.side === 'enemy' ? 'Choose an enemy' : 'Choose one of yours';
  if (ref.kind === 'player') return spec.kinds.includes('player') ? null : 'Only Pokémon can be chosen';
  if (!spec.kinds.includes('pokemon')) return 'Only a player or a Location can be chosen';
  const card = state.players[ref.who].row[ref.space];
  if (!card) return 'An empty space';
  if (spec.scope === 'location' && !locLanesAt(state, ctx.space ?? 0).includes(ref.space)) return 'Not in this Location';
  if (spec.scope === 'lane' && ref.space !== (ctx.lane ?? ctx.space)) return 'Not in this lane';
  if (spec.other && ref.space === ctx.space) return 'Not this Pokémon itself';
  if ((spec.filter === 'canTrain' || spec.filter === 'canNurture') && card.level >= trainTop(card)) return `Already at its cap (Level ${trainTop(card)})`;
  if (spec.filter === 'canNurture' && card.nurturedRound === state.round) return 'Already Nurtured this Round';
  if (spec.filter === 'damaged') return 'Not damaged';
  if (spec.filter === 'spent') return card.asleep ? 'Asleep (it stays Spent)' : 'Not Spent';
  if (spec.filter === 'unseeded') return 'Already Leech Seeded';
  if (spec.belowLevel !== undefined) return `Level ${card.level}: only below Level ${spec.belowLevel}`;
  if (spec.strategy && (card.keywords ?? []).includes('Agility')) return 'Agility: Strategy Cards can\'t choose it';
  return 'Not a legal target';
}

// The hover note on a target while choosing (Feedback B, 7): what will happen if you click it.
export function targetNote(state, who, spec, ref, ops, ctx = {}) {
  const card = ref.kind === 'pokemon' ? state.players[ref.who].row[ref.space] : null;
  const name = card ? card.name : ref.kind === 'player' ? (ref.who === who ? 'You' : 'The Opponent') : 'This Location';
  const why = targetWhyNot(state, who, spec, ref, ctx);
  if (why) return `${name} · ${why}`;
  const shell = card && ops.some((o) => o.op === 'damage') ? shellOf(state, ref.who, ref.space) : 0;
  const scorch = card ? kwSum(card, 'Scorch') : 0;
  return `${name} · click to ${opsVerb(ops.filter((o) => o.op !== 'enemyLosesRecognition'), ctx)}${shell ? ` · it has Shell ${shell}` : ''}${scorch ? ` · it has Scorch ${scorch}` : ''}`;
}

// Attacks: the hover note on an enemy Pokémon or the enemy player for the chosen attacker.
export function attackNote(state, who, from, target) {
  const attacker = state.players[who].row[from];
  const foe = opponentOf(who);
  if (!attacker) return '';
  const legal = legalTargets(state, who, from).some((t) => t.kind === target.kind && t.space === target.space);
  if (target.kind === 'player') {
    if (legal) return `The Opponent · click to attack: +${attackPreview(state, who, from, target).hit} Recognition`;
    const across = state.players[foe].row[from];
    return `The Opponent · Guarded by ${across?.name ?? 'a guard'}, across from this Pokémon`;
  }
  const defender = state.players[foe].row[target.space];
  if (!defender) return '';
  const pv = attackPreview(state, who, from, target);
  return `${defender.name} · click to attack: ${pv.hit} damage${pv.defeats ? ' (defeats it)' : ''}${pv.back ? ` · it's Alert and hits back for ${pv.back}${pv.falls ? ' (defeats yours)' : ''}` : ''}`;
}
