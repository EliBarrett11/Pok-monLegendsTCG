// v4's simple AI (F1; F2 adds Locations and dominance; F3 Command Cards in all three modes,
// including Reacting to the player, and Supporters; F4 Items (buy from hand or the PokéMart, use
// now or store, use from the Bag) and Trainer Commands; UX1: Objectives are tracked from setup, modes come from commandModesFor): a greedy one-move AI like v2's and v3's (adapted from v3/src/ai/ai.js).
// It plays only through the engine's actions: it tries each legal move on a copy of the state,
// scores the result, and plays the best (Pass when nothing beats it).
import { RULES } from '../rules.js?v=202611110816';
import { applyAction, legalActions, hasKw, kwNum, opponentOf, summonable, emptySpaces, attackers, legalTargets, retainable, pokemonOf, isReady, energyLeft, placeable, locationStarts, dominantOf, summonCost,
  commandModesFor, commandTargets, playableSupporters, favourMet, resolveStrats,
  buyableFromHand, buyableFromMart, usableFromBag, itemTargets, buyReason, playableTrainers, tournamentDominant, boosted } from '../engine/game.js?v=202611110816';

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
    // Cards in hand (an unbought Item counts less: it's discarded at Supper unless bought).
    let v = p.recognition * 1.6 + p.hand.reduce((n, c) => n + (c.cardType === 'Item' ? 0.2 : 0.5), 0);
    // F4: PokéDollars, Items in the Bag, Trainers working on their Objectives, waiting Partners.
    v += p.dollars * 0.3 + p.bag.reduce((n, c) => n + 0.25 + c.price * 0.4, 0);
    // G1: buying the PokéMart's one Item also takes it away from the opponent (Sold out until the
    // buyer's next turn ends): a small bonus for the side that bought it.
    if (s.mart.soldOut?.by === w) v += 0.4;
    for (const tr of p.trainers.filter((x) => !x.complete)) v += (2 * tr.progress) / tr.objective.need;
    v += p.waiting.length * 3;
    // G2: keywords are worth a little on the board (Infiltrator's reach, Shell, Retaliate, Regenerate, Rage, Overrun).
    for (const { card } of pokemonOf(s, w)) {
      v += card.attack * 0.9 + card.currentStrength * 0.45 + (isReady(s, card) ? 0.5 : 0);
      v += (hasKw(card, 'infiltrator') ? 0.8 : 0) + kwNum(card, 'shell') * 0.6 + kwNum(card, 'retaliate') * 0.5 + kwNum(card, 'regenerate') * 0.4
        + (hasKw(card, 'rage') ? 0.4 : 0) + (hasKw(card, 'overrun') ? 0.3 : 0);
    }
    return v;
  };
  const me = s.players[who];
  // Dominance: each Location dominated now is worth the Recognition it would give at each Supper left.
  let dom = 0;
  for (const l of s.locations) {
    const d = dominantOf(s, l);
    if (d) dom += (d === who ? 1 : -1) * RULES.perDominance * l.roundsLeft * 1.6 * 0.8;
  }
  // F5: the Tournament's dominance, worth its (boosted) Recognition at the next Supper.
  if (s.tournament) {
    const d = tournamentDominant(s);
    if (d) dom += (d === who ? 1 : -1) * boosted(s, RULES.perTournamentDominance) * 1.6 * 0.8;
  }
  return side(who) - side(foe) + dom + (s.turn === who ? me.baseEnergy * 0.3 : 0) - me.exhaust.length * 0.6;
}

export function moves(s, who) {
  const legal = legalActions(s, who);
  const p = s.players[who];
  // G2: a chosen-target On Summon: one move per legal target.
  if (legal.includes('choose')) return s.choice.targets.map((target) => ({ type: 'choose', who, target }));
  if (legal.includes('mulligan')) return [{ type: 'mulligan', who, cards: p.hand.filter((c) => c.cost > 1).map((c) => c.uid) }];
  // A React window (an attack, an Adapt, or a Strat resolving): React or let it happen.
  if (legal.includes('decline')) {
    const out = [{ type: 'decline', who }];
    // UX1: the React options come from commandModesFor, the same helper the hand display uses.
    const reacts = p.hand.filter((c) => commandModesFor(s, who, c.uid).some((m) => m.mode === 'react'));
    for (const c of dedupe(reacts)) for (const target of commandTargets(s, who, c, 'react')) out.push({ type: 'react', who, uid: c.uid, target });
    return out;
  }
  // G1: Pass only when it's legal (not while an unmatched Ready Pokémon can attack).
  const out = legal.includes('pass') ? [{ type: 'pass', who }] : [];
  if (legal.includes('command')) {
    for (const mode of ['adapt', 'strat']) {
      const cards = p.hand.filter((c) => commandModesFor(s, who, c.uid).some((m) => m.mode === mode && !m.reason));
      for (const c of dedupe(cards)) for (const target of commandTargets(s, who, c, mode)) out.push({ type: 'command', who, uid: c.uid, mode, target });
    }
  }
  // Supporters: Release the least useful cards; or, when it can, one that meets the Favour.
  if (legal.includes('supporter')) {
    for (const c of dedupe(playableSupporters(s, who))) {
      const others = p.hand.filter((x) => x !== c).sort((a, b) => worth(a) - worth(b));
      const plain = others.slice(0, c.release);
      out.push({ type: 'supporter', who, uid: c.uid, release: plain.map((x) => x.uid), pick: recoverPick(s, who, c, plain) });
      const fav = others.find((x) => favourMet(c, [x]));
      if (fav) {
        const rel = [fav, ...others.filter((x) => x !== fav)].slice(0, c.release);
        out.push({ type: 'supporter', who, uid: c.uid, release: rel.map((x) => x.uid), pick: recoverPick(s, who, c, rel) });
      }
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
  // Items: buy from hand or the PokéMart (use now on each target, or store); use from the Bag.
  if (legal.includes('buyItem')) {
    const buys = [...dedupe(buyableFromHand(s, who)).map((c) => ({ item: c, src: { from: 'hand', uid: c.uid } })),
      ...buyableFromMart(s, who).map((slot) => ({ item: s.mart.onSale[slot], src: { from: 'mart', slot } }))];
    for (const { item, src } of buys) {
      if (!buyReason(s, who, item, 'store')) out.push({ type: 'buyItem', who, ...src, then: 'store' });
      if (!buyReason(s, who, item, 'use')) for (const target of itemTargets(s, who, item)) out.push({ type: 'buyItem', who, ...src, then: 'use', target });
    }
  }
  if (legal.includes('useItem')) for (const c of dedupe(usableFromBag(s, who))) for (const target of itemTargets(s, who, c)) out.push({ type: 'useItem', who, uid: c.uid, target });
  // Trainers: as an Objective, or as a Trainer Command.
  // Trainers: only as Trainer Commands (UX1: Objectives are tracked from match setup).
  if (legal.includes('trainerCommand')) for (const c of dedupe(playableTrainers(s, who))) out.push({ type: 'trainerCommand', who, uid: c.uid });
  if (legal.includes('attack')) for (const from of attackers(s, who)) for (const target of legalTargets(s, who, from)) out.push({ type: 'attack', who, from, target });
  // Retain: only the strongest card, and only when there's Energy to spare.
  if (legal.includes('retain') && energyLeft(p) > 1) {
    const best = [...retainable(s, who)].sort((a, b) => b.level - a.level)[0];
    if (best) out.push({ type: 'retain', who, uid: best.uid });
  }
  return out;
}

// G3: Pokémon Breeder: take back the highest-Level Pokémon cards from the Discard Pile (its normal choice).
function recoverPick(s, who, card, release) {
  const eff = favourMet(card, release) ? card.favour : card.effect;
  if (eff.op !== 'recover') return [];
  return s.players[who].discard.filter((c) => c.cardType === 'Pokémon').sort((a, b) => b.level - a.level).slice(0, eff.amount).map((c) => c.uid);
}

const dedupe = (cards) => { const seen = new Set(); return cards.filter((c) => !seen.has(c.id) && seen.add(c.id)); };
// How much a card in hand is worth keeping (for choosing what to Release).
const worth = (c) => (c.cardType === 'Pokémon' ? 1 + c.level : c.cardType === 'Supporter' ? 0.5 : 2);

// After a move, any On Summon target choice of ours resolved greedily (one step deep each).
function bestChoice(s, who) {
  for (let i = 0; i < 4 && s.choice?.who === who; i++) {
    let best = null;
    let bestScore = -Infinity;
    for (const target of s.choice.targets) {
      const n = applyAction(s, { type: 'choose', who, target });
      const v = evaluate(n, who);
      if (v > bestScore) { best = n; bestScore = v; }
    }
    s = best;
  }
  return s;
}

export function chooseAction(s, who, { rng = Math.random } = {}) {
  const options = moves(s, who);
  if (options[0].type === 'mulligan') return options[0];
  let best = null;
  let bestScore = -Infinity;
  for (const m of options) {
    let next = applyAction(s, m);
    // If the player could React, judge the move as if they let it happen.
    if (next.reactWindow && next.reactWindow.reactor !== who) next = applyAction(next, { type: 'decline', who: next.reactWindow.reactor });
    // G2: a summon whose On Summon asks for a target: judge it with its best target (greedy).
    next = bestChoice(next, who);
    const score = evaluate(next, who) + rng() * 0.05;
    if (score > bestScore) { best = m; bestScore = score; }
  }
  return best;
}
