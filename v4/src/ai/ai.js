// v4's simple AI (F1; F2 adds Locations and dominance; F3 Command Cards in all three modes,
// including Reacting to the player, and Supporters): a greedy one-move AI like v2's and v3's (adapted from v3/src/ai/ai.js).
// It plays only through the engine's actions: it tries each legal move on a copy of the state,
// scores the result, and plays the best (Pass when nothing beats it).
import { RULES } from '../rules.js?v=202611091159';
import { applyAction, legalActions, opponentOf, summonable, emptySpaces, attackers, legalTargets, retainable, pokemonOf, isReady, energyLeft, placeable, locationStarts, dominantOf, summonCost,
  playableCommands, commandTargets, reactOptions, playableSupporters, favourMet, resolveStrats } from '../engine/game.js?v=202611091159';

// Pending Strats count at a discount: the state as if they had resolved, blended with as it is.
export function evaluate(s, who) {
  if (!s.strats?.length) return evaluateNow(s, who);
  const done = structuredClone(s);
  resolveStrats(done);
  return 0.7 * evaluateNow(done, who) + 0.3 * evaluateNow(s, who);
}

function evaluateNow(s, who) {
  const foe = opponentOf(who);
  if (s.phase === 'gameOver') return s.winner === who ? 1e6 : -1e6;
  const side = (w) => {
    const p = s.players[w];
    let v = p.recognition * 1.6 + p.hand.length * 0.5;
    for (const { card } of pokemonOf(s, w)) v += card.attack * 0.9 + card.currentStrength * 0.45 + (isReady(s, card) ? 0.5 : 0);
    return v;
  };
  const me = s.players[who];
  // Dominance: each Location dominated now is worth the Recognition it would give at each Supper left.
  let dom = 0;
  for (const l of s.locations) {
    const d = dominantOf(s, l);
    if (d) dom += (d === who ? 1 : -1) * RULES.perDominance * l.roundsLeft * 1.6 * 0.8;
  }
  return side(who) - side(foe) + dom + (s.turn === who ? me.baseEnergy * 0.3 : 0) - me.exhaust.length * 0.6;
}

export function moves(s, who) {
  const legal = legalActions(s, who);
  const p = s.players[who];
  if (legal.includes('mulligan')) return [{ type: 'mulligan', who, cards: p.hand.filter((c) => c.cost > 1).map((c) => c.uid) }];
  // A React window (the player committed an attack, summon or Adapt): React or let it happen.
  if (legal.includes('decline')) {
    const out = [{ type: 'decline', who }];
    for (const c of dedupe(reactOptions(s, who))) for (const target of commandTargets(s, who, c)) out.push({ type: 'react', who, uid: c.uid, target });
    return out;
  }
  const out = [{ type: 'pass', who }];
  if (legal.includes('command')) {
    for (const mode of ['adapt', 'strat']) {
      for (const c of dedupe(playableCommands(s, who, mode))) for (const target of commandTargets(s, who, c)) out.push({ type: 'command', who, uid: c.uid, mode, target });
    }
  }
  // Supporters: Release the least useful cards; or, when it can, one that meets the Favour.
  if (legal.includes('supporter')) {
    for (const c of dedupe(playableSupporters(s, who))) {
      const others = p.hand.filter((x) => x !== c).sort((a, b) => worth(a) - worth(b));
      out.push({ type: 'supporter', who, uid: c.uid, release: others.slice(0, c.release).map((x) => x.uid) });
      const fav = others.find((x) => favourMet(c, [x]));
      if (fav) out.push({ type: 'supporter', who, uid: c.uid, release: [fav, ...others.filter((x) => x !== fav)].slice(0, c.release).map((x) => x.uid) });
    }
  }
  if (legal.includes('summon')) {
    const seen = new Set();
    for (const c of summonable(s, who)) {
      if (seen.has(`${c.id}:${c.level}`)) continue;
      seen.add(`${c.id}:${c.level}`);
      for (const space of emptySpaces(s, who)) if (summonCost(s, c, space) <= energyLeft(p)) out.push({ type: 'summon', who, uid: c.uid, space });
    }
  }
  if (legal.includes('placeLocation')) {
    const seen = new Set();
    for (const c of placeable(s, who)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      for (const start of locationStarts(s, c)) out.push({ type: 'placeLocation', who, uid: c.uid, start });
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

const dedupe = (cards) => { const seen = new Set(); return cards.filter((c) => !seen.has(c.id) && seen.add(c.id)); };
// How much a card in hand is worth keeping (for choosing what to Release).
const worth = (c) => (c.cardType === 'Pokémon' ? 1 + c.level : c.cardType === 'Supporter' ? 0.5 : 2);

export function chooseAction(s, who, { rng = Math.random } = {}) {
  const options = moves(s, who);
  if (options[0].type === 'mulligan') return options[0];
  let best = null;
  let bestScore = -Infinity;
  for (const m of options) {
    let next = applyAction(s, m);
    // If the player could React, judge the move as if they let it happen.
    if (next.reactWindow && next.reactWindow.reactor !== who) next = applyAction(next, { type: 'decline', who: next.reactWindow.reactor });
    const score = evaluate(next, who) + rng() * 0.05;
    if (score > bestScore) { best = m; bestScore = score; }
  }
  return best;
}
