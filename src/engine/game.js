// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.
//
// Every change goes through applyAction(state, action), which returns a new
// state and never edits the old one.

import { shuffle, nextRandom } from './random.js';
import { placeholderDeck, placeholderTrainers } from './cards.js';
import { newEnergy, refreshEnergy } from './energy.js';

export const PLAYERS = ['player', 'ai'];
export const ZONES = 3;
export const SPACES_PER_ZONE = 3;
export const HAND_SIZE = 7;

// Phases, in match order.
//   trainers   - before Round 1: secretly place Trainers, then reveal together
//   initiative - before Round 1: coin flip for who has initiative
//   breakfast  - simultaneous: Energy, draw 7, and in Round 1 a mulligan
//   battle     - alternating turns of 1 Action each, until both pass in a row
//   supper     - simultaneous: discard hands, then the next Round begins
//   gameOver   - a player has won

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
    ...newEnergy(),
  };
}

export function createGame(seed = Date.now()) {
  const state = {
    seed,
    rng: seed >>> 0,
    round: 0,
    phase: 'trainers',
    initiative: null,
    turn: null,          // whose Battle turn it is
    passesInARow: 0,     // Battle ends at 2
    winner: null,
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

// Draws one card at a time. An empty Draw Pile is replaced by the shuffled
// Discard Pile; if both are empty, drawing stops.
function draw(state, who, count) {
  const p = state.players[who];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) break;
      p.drawPile = shuffle(state, p.discard);
      p.discard = [];
      log(state, `${p.name} shuffled ${who === 'player' ? 'your' : 'their'} Discard Pile to form a new Draw Pile.`);
    }
    p.hand.push(p.drawPile.shift());
    drawn++;
  }
  return drawn;
}

// A player wins immediately when all 3 enemy Trainers are at 0 Strength.
export function winner(state) {
  return PLAYERS.find((who) =>
    state.players[opponentOf(who)].trainers.every((t) => t.strength <= 0)) ?? null;
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
      return state.round === 1 && !p.pending ? ['mulligan'] : [];
    case 'battle':
      return state.turn === who ? ['pass'] : [];
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
  const won = state.phase !== 'gameOver' && winner(state);
  if (won) {
    state.phase = 'gameOver';
    state.winner = won;
    log(state, `${state.players[won].name} ${won === 'player' ? 'win' : 'wins'}! All 3 enemy Trainers are at 0 Strength.`);
  }
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

  // A Battle turn's Action. The Phase ends when both players pass in a row;
  // any other Action would reset the count.
  pass(state, { who }) {
    log(state, `${state.players[who].name} passed.`);
    state.passesInARow += 1;
    if (state.passesInARow >= 2) {
      log(state, 'Both players passed in a row. Battle Phase ends.');
      startSupper(state);
    } else {
      state.turn = opponentOf(who);
    }
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
    const p = state.players[who];
    const recovered = refreshEnergy(p, state.round);
    if (recovered.length) {
      log(state, `${p.name} recovered ${recovered.length} Exhaust point${recovered.length === 1 ? '' : 's'} into Exert.`);
    }
    log(state, `${p.name}: ${p.baseEnergy} Base Energy, Exert ${p.exertMax - p.exhaust.length}/${p.exertMax}.`);
    const n = draw(state, who, HAND_SIZE);
    log(state, `${p.name} drew ${n} card${n === 1 ? '' : 's'}.`);
  }
  if (state.round === 1) {
    log(state, 'Mulligan: choose any cards to discard and redraw, or keep your hand.');
  } else {
    endBreakfast(state);
  }
}

function endBreakfast(state) {
  log(state, 'Breakfast Phase ends.');
  startBattle(state);
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
  endBreakfast(state);
}

function startBattle(state) {
  state.phase = 'battle';
  state.turn = state.initiative;
  state.passesInARow = 0;
  log(state, `Battle Phase. ${state.players[state.initiative].name} ${state.initiative === 'player' ? 'act' : 'acts'} first.`);
}

function startSupper(state) {
  state.phase = 'supper';
  state.turn = null;
  log(state, 'Supper Phase.');
  for (const who of PLAYERS) {
    const p = state.players[who];
    const n = p.hand.length;
    p.discard.push(...p.hand);
    p.hand = [];
    log(state, `${p.name} discarded ${n} card${n === 1 ? '' : 's'} from ${who === 'player' ? 'your' : 'their'} hand.`);
  }
  log(state, 'Supper Phase ends.');
  startRound(state, state.round + 1);
}
