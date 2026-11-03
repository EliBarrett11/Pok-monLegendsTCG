// The v2 AI opponent (V1, basic). It plays only through the engine's own actions:
// it lists every legal move, tries each on a copy of the game (applyAction is pure),
// and takes the best-scoring one (ties at random). It never edits the game.
//
// Scoring, roughly:
//   1000 wins the match (reaches 60 Recognition)
//   attacks on the player character: 20 + 3 × the Recognition gained
//   defeating an enemy Pokémon without losing the attacker: 40 + its value
//   a trade that loses the attacker for nothing: −20; for a defeat: the difference
//   chip damage: 5 + the damage
//   summoning: 15 + 3 × cost (pricier first), into the lane facing the most
//   enemy pressure (a Pokémon opposite), else the middle
//   Pass: 0 (−6 if it would make its own Pokémon Spent by unmatched speed)
import {
  applyAction, legalActions, legalTargets, alertSpaces, playable, passSpends, opponentOf, pokemonOf,
} from '../engine/game.js';
import { LANES } from '../engine/rules.js';

const value = (card) => card.cost * 3 + card.attack;

// Every move it could make now.
export function moves(state, who) {
  const legal = legalActions(state, who);
  const out = [];
  if (legal.includes('flipCoin')) return [{ type: 'flipCoin' }];
  if (legal.includes('attack')) {
    for (const from of alertSpaces(state, who)) for (const target of legalTargets(state, who, from)) out.push({ type: 'attack', who, from, target });
  }
  if (legal.includes('summon')) {
    const space = bestSpace(state, who);
    const seen = new Set();
    for (const card of playable(state, who)) {
      if (seen.has(card.id)) continue;   // copies are the same move
      seen.add(card.id);
      out.push({ type: 'summon', who, uid: card.uid, space });
    }
  }
  if (legal.includes('pass')) out.push({ type: 'pass', who });
  return out;
}

// The empty space to summon into: opposite an enemy Pokémon if one stands across an
// empty space of ours, otherwise the empty space nearest the middle.
function bestSpace(state, who) {
  const row = state.players[who].row;
  const enemy = state.players[opponentOf(who)].row;
  const empty = row.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  const opposite = empty.filter((i) => enemy[i]);
  const middle = (LANES - 1) / 2;
  return (opposite.length ? opposite : empty).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0];
}

export function scoreMove(state, who, move) {
  if (move.type === 'flipCoin') return 0;
  if (move.type === 'pass') return passSpends(state, who).length ? -6 : 0;
  const after = applyAction(state, move);
  if (after.winner === who) return 1000;
  if (move.type === 'summon') {
    const card = state.players[who].hand.find((c) => c.uid === move.uid);
    return 15 + 3 * card.cost;
  }
  // An attack.
  const foe = opponentOf(who);
  const gained = after.players[who].recognition - state.players[who].recognition;
  if (move.target.kind === 'player') return 20 + 3 * gained;
  const defender = state.players[foe].row[move.target.space];
  const attacker = state.players[who].row[move.from];
  const killed = !after.players[foe].row[move.target.space];
  const lost = !after.players[who].row[move.from];
  if (killed && !lost) return 40 + value(defender);
  if (lost && !killed) return -20;
  if (killed && lost) return 10 + value(defender) - value(attacker);
  return 5 + (defender.currentStrength - after.players[foe].row[move.target.space].currentStrength);
}

export function chooseAction(state, who, { rng = Math.random } = {}) {
  const options = moves(state, who);
  if (!options.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const move of options) {
    const score = scoreMove(state, who, move) + rng() * 0.01;
    if (score > bestScore) { best = move; bestScore = score; }
  }
  return best;
}

export { pokemonOf };
