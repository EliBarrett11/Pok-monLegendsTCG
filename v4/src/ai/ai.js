// v4's simple AI (F1): a greedy one-move AI like v2's and v3's (adapted from v3/src/ai/ai.js).
// It plays only through the engine's actions: it tries each legal move on a copy of the state,
// scores the result, and plays the best (Pass when nothing beats it).
import { applyAction, legalActions, opponentOf, summonable, emptySpaces, attackers, legalTargets, retainable, pokemonOf, isReady, energyLeft } from '../engine/game.js?v=202611091135';

export function evaluate(s, who) {
  const foe = opponentOf(who);
  if (s.phase === 'gameOver') return s.winner === who ? 1e6 : -1e6;
  const side = (w) => {
    const p = s.players[w];
    let v = p.recognition * 1.6 + p.hand.length * 0.5;
    for (const { card } of pokemonOf(s, w)) v += card.attack * 0.9 + card.currentStrength * 0.45 + (isReady(s, card) ? 0.5 : 0);
    return v;
  };
  const me = s.players[who];
  return side(who) - side(foe) + (s.turn === who ? me.baseEnergy * 0.3 : 0) - me.exhaust.length * 0.6;
}

export function moves(s, who) {
  const legal = legalActions(s, who);
  const p = s.players[who];
  if (legal.includes('mulligan')) return [{ type: 'mulligan', who, cards: p.hand.filter((c) => c.cost > 1).map((c) => c.uid) }];
  const out = [{ type: 'pass', who }];
  if (legal.includes('summon')) {
    const seen = new Set();
    for (const c of summonable(s, who)) {
      if (seen.has(`${c.id}:${c.level}`)) continue;
      seen.add(`${c.id}:${c.level}`);
      for (const space of emptySpaces(s, who)) out.push({ type: 'summon', who, uid: c.uid, space });
    }
  }
  if (legal.includes('attack')) for (const from of attackers(s, who)) for (const target of legalTargets(s, who, from)) out.push({ type: 'attack', who, from, target });
  // Retain: only the strongest card, and only when there's Energy to spare.
  if (legal.includes('retain') && energyLeft(p) > 1) {
    const best = [...retainable(s, who)].sort((a, b) => b.level - a.level)[0];
    if (best) out.push({ type: 'retain', who, uid: best.uid });
  }
  return out;
}

export function chooseAction(s, who, { rng = Math.random } = {}) {
  const options = moves(s, who);
  if (options[0].type === 'mulligan') return options[0];
  let best = null;
  let bestScore = -Infinity;
  for (const m of options) {
    const score = evaluate(applyAction(s, m), who) + rng() * 0.05;
    if (score > bestScore) { best = m; bestScore = score; }
  }
  return best;
}
