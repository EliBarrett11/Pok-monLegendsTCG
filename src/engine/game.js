// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.
//
// Every change goes through applyAction(state, action), which returns a new
// state and never edits the old one.

import { shuffle, nextRandom } from './random.js';
import { placeholderDeck, placeholderTrainers } from './cards.js';

export const PLAYERS = ['player', 'ai'];
export const ZONES = 3;
export const SPACES_PER_ZONE = 3;
export const HAND_SIZE = 7;

// Phases, in match order.
//   trainers   - before Round 1: secretly place Trainers, then reveal together
//   initiative - before Round 1: coin flip for who has initiative
//   breakfast  - simultaneous: draw, and in Round 1 a mulligan
//   battle     - alternating turns (next step)
//   supper     - simultaneous (later step)

export function opponentOf(who) {
  return who === 'player' ? 'ai' : 'player';
}

function newPlayer(name, owner, state) {
  return {
    name,
    drawPile: shuffle(state, placeholderDeck(owner)),
    hand: [],
    discard: [],
    trainers: placeholderTrainers(owner),
    // The Battle Arena row: 3 zones, each with 1 Trainer Space and 3 Pokémon Spaces.
    zones: Array.from({ length: ZONES }, () => ({
      trainer: null,
      pokemon: Array(SPACES_PER_ZONE).fill(null),
    })),
    // Choices made in secret during a simultaneous step, revealed together.
    pending: null,
  };
}

export function createGame(seed = Date.now()) {
  const state = {
    seed,
    rng: seed >>> 0,
    round: 0,
    phase: 'trainers',
    initiative: null,
    log: [],
  };
  state.players = {
    player: newPlayer('You', 'player', state),
    ai: newPlayer('AI Opponent', 'ai', state),
  };
  log(state, 'The Battle Arena is laid out: 3 zones per side, each with a Trainer Space and 3 Pokémon Spaces.');
  log(state, 'Both players choose which Trainer takes each zone.');
  return state;
}

function log(state, message) {
  state.log.push(message);
}

function draw(state, who, count) {
  const p = state.players[who];
  const drawn = p.drawPile.splice(0, count);
  p.hand.push(...drawn);
  return drawn.length;
}

// --- Actions -------------------------------------------------------------

export function legalActions(state, who) {
  const p = state.players[who];
  switch (state.phase) {
    case 'trainers':
      return p.pending ? [] : ['assignTrainers'];
    case 'initiative':
      return ['flipCoin'];
    case 'breakfast':
      return p.pending ? [] : ['mulligan'];
    default:
      return [];
  }
}

export function applyAction(prev, action) {
  const state = structuredClone(prev);
  const handler = HANDLERS[action.type];
  if (!handler) throw new Error(`Unknown action: ${action.type}`);
  if (action.who && !legalActions(state, action.who).includes(action.type)) {
    throw new Error(`${action.who} cannot ${action.type} during ${state.phase}`);
  }
  handler(state, action);
  return state;
}

const HANDLERS = {
  // order: the uids of this player's 3 Trainers, for zones 1, 2 and 3.
  assignTrainers(state, { who, order }) {
    const p = state.players[who];
    const owned = p.trainers.map((t) => t.uid);
    if (order.length !== ZONES || new Set(order).size !== ZONES || !order.every((u) => owned.includes(u))) {
      throw new Error('Each zone needs a different one of your Trainers');
    }
    p.pending = order;
    if (PLAYERS.every((w) => state.players[w].pending)) revealTrainers(state);
  },

  flipCoin(state) {
    const result = nextRandom(state) < 0.5 ? 'player' : 'ai';
    state.initiative = result;
    log(state, `Coin flip: ${state.players[result].name} ${result === 'player' ? 'win' : 'wins'} initiative for Round 1.`);
    startRound(state, 1);
  },

  // cardUids: cards to put in the Discard Pile and replace. Empty = keep hand.
  mulligan(state, { who, cardUids }) {
    const p = state.players[who];
    if (state.round !== 1 && cardUids.length > 0) throw new Error('Mulligans are only allowed in Round 1');
    if (!cardUids.every((u) => p.hand.some((c) => c.uid === u))) throw new Error('Can only mulligan cards in your hand');
    p.pending = [...new Set(cardUids)];
    if (PLAYERS.every((w) => state.players[w].pending)) resolveMulligans(state);
  },
};

function revealTrainers(state) {
  for (const who of PLAYERS) {
    const p = state.players[who];
    p.pending.forEach((uid, zone) => {
      p.zones[zone].trainer = p.trainers.find((t) => t.uid === uid);
    });
    p.pending = null;
    const names = p.zones.map((z, i) => `Zone ${i + 1}: ${z.trainer.name}`).join(', ');
    log(state, `${p.name} revealed Trainers. ${names}.`);
  }
  state.phase = 'initiative';
  log(state, 'Flip a coin to decide initiative for Round 1.');
}

function startRound(state, round) {
  state.round = round;
  if (round > 1) state.initiative = opponentOf(state.initiative);
  log(state, `— Round ${round} — ${state.players[state.initiative].name} ${state.initiative === 'player' ? 'have' : 'has'} initiative.`);
  startBreakfast(state);
}

function startBreakfast(state) {
  state.phase = 'breakfast';
  log(state, 'Breakfast Phase.');
  for (const who of PLAYERS) {
    const n = draw(state, who, HAND_SIZE);
    log(state, `${state.players[who].name} drew ${n} cards.`);
  }
  if (state.round === 1) log(state, 'Mulligan: choose any cards to discard and redraw, or keep your hand.');
}

function resolveMulligans(state) {
  for (const who of PLAYERS) {
    const p = state.players[who];
    const chosen = p.pending;
    p.pending = null;
    p.discard.push(...p.hand.filter((c) => chosen.includes(c.uid)));
    p.hand = p.hand.filter((c) => !chosen.includes(c.uid));
    draw(state, who, chosen.length);
    log(state, chosen.length
      ? `${p.name} mulliganed ${chosen.length} card${chosen.length === 1 ? '' : 's'}.`
      : `${p.name} kept ${who === 'player' ? 'your' : 'their'} hand.`);
  }
  startBattle(state);
}

function startBattle(state) {
  state.phase = 'battle';
  log(state, `Battle Phase. ${state.players[state.initiative].name} ${state.initiative === 'player' ? 'act' : 'acts'} first.`);
}
