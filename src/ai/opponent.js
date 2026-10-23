// The AI opponent. It reads only what it is allowed to see (its own cards
// and public information) and returns an action for the engine to apply.

import { legalActions } from '../engine/game.js';

export function chooseAction(state, who = 'ai') {
  const legal = legalActions(state, who);
  if (legal.includes('assignTrainers')) return assignTrainers(state, who);
  if (legal.includes('mulligan')) return mulligan(state, who);
  return null;
}

// No Trainer abilities exist yet, so placement is random for now.
function assignTrainers(state, who) {
  const order = state.players[who].trainers.map((t) => t.uid);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { type: 'assignTrainers', who, order };
}

// Placeholder judgement: wants at least 3 Pokémon in hand. If short, it
// throws back extra copies of non-Pokémon types, keeping one of each.
function mulligan(state, who) {
  const hand = state.players[who].hand;
  const pokemon = hand.filter((c) => c.type === 'Pokémon').length;
  if (pokemon >= 3) return { type: 'mulligan', who, cardUids: [] };
  const seen = new Set();
  const toss = [];
  for (const card of hand) {
    if (card.type === 'Pokémon') continue;
    if (seen.has(card.type)) toss.push(card.uid);
    else seen.add(card.type);
  }
  return { type: 'mulligan', who, cardUids: toss };
}
