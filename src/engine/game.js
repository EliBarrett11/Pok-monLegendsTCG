// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.
//
// Every change goes through applyAction(state, action), which returns a new
// state and never edits the old one.

import { shuffle, nextRandom } from './random.js';
import { buildDeck, placeholderTrainers } from './cards.js';
import { SPEED_TIERS } from './cardData.js';
import { newEnergy, refreshEnergy, canPay, payCost, splitCost } from './energy.js';

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
//   gameOver   - a player has won, or the match is a draw (winner stays null)

export function opponentOf(who) {
  return who === 'player' ? 'ai' : 'player';
}

function newPlayer(name, owner, state) {
  return {
    name,
    drawPile: shuffle(state, buildDeck(owner)),
    hand: [],
    discard: [],
    released: [],        // defeated Pokémon; never shuffled back
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

// "Your" / "AI Opponent's" (or lower-case "your" mid-sentence).
function whose(state, who, capital = true) {
  if (who === 'player') return capital ? 'Your' : 'your';
  return `${state.players[who].name}'s`;
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

// Draw: neither player has a Pokémon left in their arena, hand, Draw Pile or
// Discard Pile, so nothing can deal damage again.
export function isStuck(state) {
  return PLAYERS.every((who) => {
    const p = state.players[who];
    const cards = [...p.hand, ...p.drawPile, ...p.discard, ...p.zones.flatMap((z) => z.pokemon).filter(Boolean)];
    return !cards.some((c) => c.cardType === 'Pokémon');
  });
}

// --- Questions the UI and AI ask ------------------------------------------

// Every Pokémon in the arena, as { who, zone, space, card }.
function arenaPokemon(state) {
  const all = [];
  for (const who of PLAYERS) {
    state.players[who].zones.forEach((z, zone) => z.pokemon.forEach((card, space) => {
      if (card) all.push({ who, zone, space, card });
    }));
  }
  return all;
}

// The highest Speed-Tier among all Active Pokémon in the arena, both sides.
// Returns -1 when no Pokémon is Active.
function alertTier(state) {
  return Math.max(-1, ...arenaPokemon(state)
    .filter(({ card }) => !card.spent)
    .map(({ card }) => SPEED_TIERS.indexOf(card.speedTier)));
}

// Alert: Active, and of the highest Speed-Tier among all Active Pokémon.
// Worked out fresh each time, so it is always current after every Action.
export function isAlert(state, card) {
  return !card.spent && SPEED_TIERS.indexOf(card.speedTier) === alertTier(state);
}

// This player's Alert Pokémon, as { zone, space, card }.
export function alertPokemon(state, who) {
  return arenaPokemon(state)
    .filter((x) => x.who === who && isAlert(state, x.card))
    .map(({ zone, space, card }) => ({ zone, space, card }));
}

// Legal targets for the Pokémon at `from` = { zone, space }, as
// { kind: 'pokemon', zone, space } or { kind: 'trainer', zone }.
// Physical attackers must target a Defence Pokémon if the opponent has any;
// Special attackers must target a Special Defence Pokémon if there is any.
export function legalTargets(state, who, from) {
  const attacker = state.players[who].zones[from.zone]?.pokemon[from.space];
  if (!attacker) return [];
  const enemy = state.players[opponentOf(who)];
  const pokemon = [];
  enemy.zones.forEach((z, zone) => z.pokemon.forEach((card, space) => {
    if (card) pokemon.push({ kind: 'pokemon', zone, space, card });
  }));
  const guard = { Physical: 'Defence', Special: 'Special Defence' }[attacker.attackType];
  const guards = pokemon.filter((t) => t.card.strengthType === guard);
  const targets = guards.length ? guards : [
    ...pokemon,
    ...enemy.zones.map((z, zone) => ({ kind: 'trainer', zone, card: z.trainer }))
      .filter((t) => t.card && t.card.strength > 0),
  ];
  return targets.map(({ kind, zone, space }) => (kind === 'pokemon' ? { kind, zone, space } : { kind, zone }));
}

function canCommand(state, who) {
  return alertPokemon(state, who).some((a) => legalTargets(state, who, a).length);
}

// Empty Pokémon Spaces on this player's side, as { zone, space }.
export function emptySpaces(state, who) {
  const spaces = [];
  state.players[who].zones.forEach((z, zone) => z.pokemon.forEach((c, space) => {
    if (!c) spaces.push({ zone, space });
  }));
  return spaces;
}

// Pokémon in hand this player could play right now (affordable, with room).
export function playablePokemon(state, who) {
  const p = state.players[who];
  if (!emptySpaces(state, who).length) return [];
  return p.hand.filter((c) => c.cardType === 'Pokémon' && canPay(p, c.energyCost));
}

// How playing this card would be paid: { fromBase, fromExert }.
export function costPreview(state, who, uid) {
  const p = state.players[who];
  const c = p.hand.find((h) => h.uid === uid);
  return splitCost(p, c.energyCost);
}

function describePayment({ fromBase, fromExert }) {
  const parts = [];
  if (fromBase || !fromExert) parts.push(`${fromBase} Base Energy`);
  if (fromExert) parts.push(`${fromExert} Exert`);
  return parts.join(' + ');
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
      if (state.turn !== who) return [];
      return [
        'pass',
        ...(playablePokemon(state, who).length ? ['playPokemon'] : []),
        ...(canCommand(state, who) ? ['command'] : []),
      ];
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
  if (state.phase === 'gameOver') return state;
  const won = winner(state);
  if (won) {
    endMatch(state, won);
    log(state, `${state.players[won].name} ${won === 'player' ? 'win' : 'wins'}! All 3 enemy Trainers are at 0 Strength.`);
  } else if (isStuck(state)) {
    endMatch(state, null);
    log(state, 'Draw! Neither player has a Pokémon left, so nobody can win.');
  }
  return state;
}

function endMatch(state, won) {
  state.phase = 'gameOver';
  state.winner = won;
  state.turn = null;
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

  // Battle Action: play a Pokémon from hand into an empty Pokémon Space on
  // your side, paying its Energy Cost. It arrives Spent.
  playPokemon(state, { who, uid, zone, space }) {
    const p = state.players[who];
    const c = p.hand.find((h) => h.uid === uid);
    if (!c || c.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (p.zones[zone]?.pokemon[space] !== null) throw new Error('Choose an empty Pokémon Space');
    if (!canPay(p, c.energyCost)) throw new Error(`Not enough Energy to play ${c.name}`);
    const paid = payCost(p, c.energyCost, state.round);
    p.hand = p.hand.filter((h) => h !== c);
    p.zones[zone].pokemon[space] = { ...c, currentStrength: c.strengthValue, spent: true };
    log(state, `${p.name} played ${c.name} into Zone ${zone + 1}, Space ${space + 1}, paying ${describePayment(paid)}.`);
    endTurn(state, who, false);
  },

  // Battle Action: Command an Alert Pokémon to Attack. Costs no Energy.
  // from = { zone, space } on your side; target from legalTargets().
  command(state, { who, from, target }) {
    const p = state.players[who];
    const enemy = state.players[opponentOf(who)];
    const attacker = p.zones[from?.zone]?.pokemon[from?.space];
    if (!attacker || !isAlert(state, attacker)) throw new Error('Choose one of your Alert Pokémon');
    const legal = legalTargets(state, who, from).some((t) =>
      t.kind === target?.kind && t.zone === target.zone && (t.kind === 'trainer' || t.space === target.space));
    if (!legal) throw new Error('That is not a legal target');

    const where = (zone, space) => `Zone ${zone + 1}${space === undefined ? '' : `, Space ${space + 1}`}`;
    if (target.kind === 'trainer') {
      const trainer = enemy.zones[target.zone].trainer;
      const before = trainer.strength;
      trainer.strength = Math.max(0, before - attacker.attackValue);
      attacker.spent = true;
      log(state, `${whose(state, who)} ${attacker.name} attacked ${whose(state, opponentOf(who), false)} ${trainer.name} (${where(target.zone)}) for ${attacker.attackValue}. ${trainer.name}: ${before} → ${trainer.strength} Strength.`);
    } else {
      const defender = enemy.zones[target.zone].pokemon[target.space];
      const trades = isAlert(state, defender);   // decided before anyone becomes Spent
      defender.currentStrength -= attacker.attackValue;
      if (trades) attacker.currentStrength -= defender.attackValue;
      attacker.spent = true;
      if (trades) defender.spent = true;
      log(state, `${whose(state, who)} ${attacker.name} attacked ${whose(state, opponentOf(who), false)} ${defender.name} (${where(target.zone, target.space)}) for ${attacker.attackValue}`
        + (trades ? `; ${defender.name} was Alert and hit back for ${defender.attackValue}.` : '.'));
      releaseDefeated(state);
    }
    endTurn(state, who, false);
  },

  // A Battle turn's Action. The Phase ends when both players pass in a row.
  pass(state, { who }) {
    log(state, `${state.players[who].name} passed.`);
    endTurn(state, who, true);
  },
};

// Pokémon at 0 Strength or less go to their owner's Released Pile.
function releaseDefeated(state) {
  for (const { who, zone, space, card } of arenaPokemon(state)) {
    if (card.currentStrength > 0) continue;
    const p = state.players[who];
    p.zones[zone].pokemon[space] = null;
    p.released.push(card);
    log(state, `${whose(state, who)} ${card.name} was defeated and goes to the Released Pile.`);
  }
}

function endTurn(state, who, passed) {
  state.passesInARow = passed ? state.passesInARow + 1 : 0;
  if (state.passesInARow >= 2) {
    log(state, 'Both players passed in a row. Battle Phase ends.');
    startSupper(state);
  } else {
    state.turn = opponentOf(who);
  }
}

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
    const readied = p.zones.flatMap((z) => z.pokemon).filter((c) => c?.spent);
    readied.forEach((c) => { c.spent = false; });
    if (readied.length) log(state, `${whose(state, who)} Spent Pokémon became Active: ${readied.map((c) => c.name).join(', ')}.`);
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
