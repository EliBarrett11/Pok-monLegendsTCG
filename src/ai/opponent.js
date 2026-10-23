// The AI opponent. It reads only what it is allowed to see (its own cards
// and public information) and returns an action for the engine to apply.

import { legalActions, playablePokemon, emptySpaces } from '../engine/game.js';

export function chooseAction(state, who = 'ai') {
  const legal = legalActions(state, who);
  if (legal.includes('assignTrainers')) return assignTrainers(state, who);
  if (legal.includes('mulligan')) return mulligan(state, who);
  if (legal.includes('playPokemon')) {
    const play = playPokemon(state, who);
    if (play) return play;
  }
  if (legal.includes('pass')) return { type: 'pass', who };
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

// Plays a random Pokémon it can afford with Base Energy alone (never Exert)
// into a random empty space.
function playPokemon(state, who) {
  const p = state.players[who];
  const options = playablePokemon(state, who).filter((c) => c.energyCost <= p.baseEnergy);
  if (!options.length) return null;
  const card = pick(options);
  const { zone, space } = pick(emptySpaces(state, who));
  return { type: 'playPokemon', who, uid: card.uid, zone, space };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Placeholder judgement: wants at least 3 Pokémon in hand. If short, it
// throws back extra copies of non-Pokémon types, keeping one of each.
function mulligan(state, who) {
  const hand = state.players[who].hand;
  const pokemon = hand.filter((c) => c.cardType === 'Pokémon').length;
  if (pokemon >= 3) return { type: 'mulligan', who, cardUids: [] };
  const seen = new Set();
  const toss = [];
  for (const card of hand) {
    if (card.cardType === 'Pokémon') continue;
    if (seen.has(card.cardType)) toss.push(card.uid);
    else seen.add(card.cardType);
  }
  return { type: 'mulligan', who, cardUids: toss };
}
