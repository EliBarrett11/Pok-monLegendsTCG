// V3-0's basic AI. It plays only through the engine's actions (applyAction), looking one move
// ahead: it tries each legal move on a copy of the state, scores the result, and plays the best
// (Pass when nothing beats it). Overexert is tried before a summon or Move it would pay for.
import {
  applyAction, legalActions, opponentOf, summonable, emptyOpenSpaces, attackers, legalTargets, playableMoves,
  affordableBreakpoints, effectTargets, playableSupporters, canOverexert, pokemonOf, isReady, portraitOf,
} from '../engine/game.js';
import { RULES } from '../rules.js';
import { FAVOURS } from '../engine/cards.js';

// How good a state is for `who` (Recognition first; then board, hand, Energy).
export function evaluate(s, who) {
  const foe = opponentOf(who);
  if (s.phase === 'gameOver') return s.winner === who ? 1e6 : s.winner === foe ? -1e6 : 0;
  const side = (w) => {
    const p = s.players[w];
    let v = p.recognition * 1.6;
    for (const { card } of pokemonOf(s, w)) v += card.attack * 0.9 + card.currentStrength * 0.45 + (isReady(s, card) ? 0.6 : 0);
    v += Math.min(p.hand.length, RULES.handLimit) * 0.55;
    if (p.row[portraitOf(s, w)]) v += 2;   // the player character protected
    for (const l of s.locations) v += (l.progress[w] / l.objective.count) * 2;
    return v;
  };
  const me = s.players[who];
  return side(who) - side(foe) + (s.turn === who ? me.energy * 0.35 : me.energy * 0.2) - me.debt * 0.5;
}

// Every move worth trying now.
export function moves(s, who) {
  const legal = legalActions(s, who);
  const p = s.players[who];
  if (legal.includes('mulligan')) return [{ type: 'mulligan', who, redraw: p.hand.filter((c) => c.cardType === 'Pokémon' && c.cost <= 1).length < 2 }];
  const out = [{ type: 'pass', who }];
  if (legal.includes('summon')) {
    const seen = new Set();
    for (const c of summonable(s, who)) {
      const key = `${c.series}:${c.level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const space of emptyOpenSpaces(s, who)) out.push({ type: 'summon', who, uid: c.uid, space });
    }
  }
  if (legal.includes('attack')) for (const from of attackers(s, who)) for (const target of legalTargets(s, who, from)) out.push({ type: 'attack', who, from, target });
  if (legal.includes('playMove')) {
    const seen = new Set();
    for (const c of playableMoves(s, who)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      for (const bp of affordableBreakpoints(s, who, c)) {
        if (!bp.target) out.push({ type: 'playMove', who, uid: c.uid, pay: bp.cost });
        else for (const targets of targetSets(s, who, bp.target)) out.push({ type: 'playMove', who, uid: c.uid, pay: bp.cost, targets });
      }
    }
  }
  if (legal.includes('playSupporter')) {
    for (const c of playableSupporters(s, who)) {
      const others = p.hand.filter((x) => x !== c).sort((a, b) => worth(a) - worth(b));
      const fav = others.find((x) => FAVOURS[c.favour.condition].test(x));
      const pay = (fav ? [fav, ...others.filter((x) => x !== fav)] : others).slice(0, c.release).map((x) => x.uid);
      const met = fav && c.favour.untargeted;
      const sets = c.target && !met ? targetSets(s, who, c.target) : [[]];
      for (const targets of sets) out.push({ type: 'playSupporter', who, uid: c.uid, release: pay, targets });
    }
  }
  return out;
}
// Target choices worth trying: each single target, and for two-target effects each pair.
function targetSets(s, who, spec) {
  const opts = effectTargets(s, who, spec);
  const sets = opts.map((t) => [t]);
  if ((spec.count ?? 1) >= 2) for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) sets.push([opts[i], opts[j]]);
  return sets;
}
const worth = (c) => (c.cardType === 'Pokémon' ? c.attack + c.strength : 4);

export function chooseAction(s, who, { rng = Math.random } = {}) {
  const options = moves(s, who);
  if (options[0].type === 'mulligan') return options[0];
  let best = null;
  let bestScore = -Infinity;
  const consider = (move, after, extra = 0) => {
    const score = evaluate(after, who) + extra + rng() * 0.05;
    if (score > bestScore) { best = move; bestScore = score; }
  };
  for (const move of options) consider(move, applyAction(s, move));
  // Overexert, then a summon or Move it pays for (it costs that much + 1 next Round).
  if (canOverexert(s, who)) {
    for (const amount of [1, 2].filter((n) => n <= RULES.overexertMax)) {
      const lent = applyAction(s, { type: 'overexert', who, amount });
      for (const move of moves(lent, who)) {
        if (move.type !== 'summon' && move.type !== 'playMove') continue;
        const cost = move.type === 'summon' ? lent.players[who].hand.find((c) => c.uid === move.uid).cost : move.pay;
        if (cost <= s.players[who].energy) continue;   // affordable anyway
        consider({ type: 'overexert', who, amount }, applyAction(lent, move), -(amount + RULES.overexertPenalty) * 0.9);
      }
    }
  }
  return best;
}
