// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.
//
// Every change goes through applyAction(state, action), which returns a new
// state and never edits the old one.

import { shuffle, nextRandom } from './random.js';
import { buildDeck, buildTrainers } from './cards.js';
import { SPEED_TIERS } from './cardData.js';
import { newEnergy, refreshEnergy, canPay, payCost, splitCost } from './energy.js';
import {
  PLAYERS, opponentOf, log, whose, draw, arenaPokemon, cardAt, emptySpaces, summonSpaces, isFallen,
  attackOf, damage, describeRef, sameRef, dropXp, weatherCounts,
} from './board.js';
import {
  summon, candidates, canResolve, targetedEffect, queueEffects, queueStep, run, refreshAuras, settle, fireTriggers,
  matchesCard, questEvent, queueWeather, weatherState,
} from './effects.js';

export { PLAYERS, opponentOf, emptySpaces, summonSpaces, isFallen, attackOf, weatherCounts, weatherState };
export { weatherTotal } from './board.js';
export { maxStrengthOf } from './board.js';

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
//
// state.pending holds a choice a player must make mid-resolution (a trigger's
// target, Ash's free summon). While it is set, that player's only Action is
// resolveChoice. state.stack holds what is still to resolve (see effects.js).

function newPlayer(name, owner, state) {
  return {
    name,
    drawPile: shuffle(state, buildDeck(owner)),
    hand: [],
    discard: [],
    released: [],        // defeated Pokémon and Released cards; never shuffled back
    supporterRound: null, // the Round this player last played a Supporter (1 per Round)
    xp: 0,               // stored indefinitely; spent at Breakfast on Pokémon in hand
    xpChoice: null,      // the XP step: this player's locked-in spending, revealed together
    trainers: buildTrainers(owner),
    // The Battle Arena row: 3 zones, each with 1 Trainer Space and 3 Pokémon Spaces.
    // Each zone also has 1 Location space on each side.
    zones: Array.from({ length: ZONES }, () => ({
      trainer: null,
      location: null,
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
    pending: null,       // a mid-Action choice
    stack: [],           // effects and steps still to resolve
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

// Pokémon in hand this player could play right now (affordable, with room).
export function playablePokemon(state, who) {
  const p = state.players[who];
  if (!summonSpaces(state, who).length) return [];
  return p.hand.filter((c) => c.cardType === 'Pokémon' && canPay(p, c.energyCost));
}

// How paying a cost would split: { fromBase, fromExert }. For a card in hand
// pass its uid; for a Trainer Power pass { power: zone }.
export function costPreview(state, who, what) {
  const p = state.players[who];
  const cost = typeof what === 'object'
    ? p.zones[what.power].trainer.power.cost
    : p.hand.find((h) => h.uid === what).energyCost;
  return splitCost(p, cost);
}

function describePayment({ fromBase, fromExert }) {
  const parts = [];
  if (fromBase || !fromExert) parts.push(`${fromBase} Base Energy`);
  if (fromExert) parts.push(`${fromExert} Exert`);
  return parts.join(' + ');
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
    .filter(({ ref, card }) => ref.owner === who && isAlert(state, card))
    .map(({ ref, card }) => ({ zone: ref.zone, space: ref.space, card }));
}

// Legal attack targets for the Pokémon at `from` = { zone, space }, as
// { kind: 'pokemon', zone, space } or { kind: 'trainer', zone } on the enemy side.
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

// The context a Trainer's Power resolves in.
function powerCtx(state, who, zone, target) {
  const trainer = state.players[who].zones[zone].trainer;
  return {
    who,
    source: { kind: 'trainer', owner: who, zone, uid: trainer.uid, name: trainer.name },
    label: `${whose(state, who)} ${trainer.name}'s Power`,
    target,
  };
}

// Whether this player's Trainer in `zone` can use its Power now: still in
// play, not used this Round, affordable, and with a legal target.
export function canUsePower(state, who, zone) {
  const p = state.players[who];
  const trainer = p.zones[zone]?.trainer;
  if (!trainer?.power || trainer.strength <= 0) return false;
  if (trainer.powerUsedRound === state.round) return false;
  if (!canPay(p, trainer.power.cost)) return false;
  return canResolve(state, powerCtx(state, who, zone), trainer.power.effects);
}

// Legal targets for a Power, as refs ({ kind, owner, zone, space? }).
// Empty for a Power that needs no target.
export function powerTargets(state, who, zone) {
  const trainer = state.players[who].zones[zone].trainer;
  const e = targetedEffect(trainer.power.effects);
  return e ? candidates(state, powerCtx(state, who, zone), e.target, e) : [];
}

export function usablePowers(state, who) {
  return [0, 1, 2].filter((zone) => canUsePower(state, who, zone));
}

// The context a Strategy Card resolves in.
function strategyCtx(state, who, card, target) {
  return {
    who,
    source: { kind: 'strategy', owner: who, uid: card.uid, name: card.name },
    label: `${whose(state, who)} ${card.name}`,
    target,
  };
}

// Strategy Cards in hand this player could play now: affordable, and with
// something to affect (a legal target, a card to draw).
export function playableStrategies(state, who) {
  const p = state.players[who];
  return p.hand.filter((c) => c.cardType === 'Strategy' && canPay(p, c.energyCost)
    && canResolve(state, strategyCtx(state, who, c), c.effects));
}

// --- Location Cards ---

// The zones whose Location space this player may play into: not fallen.
export function locationSpaces(state, who) {
  return [0, 1, 2].filter((zone) => !isFallen(state, who, zone));
}

export function playableLocations(state, who) {
  if (!locationSpaces(state, who).length) return [];
  return state.players[who].hand.filter((c) => c.cardType === 'Location');
}

// --- Supporter Cards ---

// Whether the paid cards meet a Supporter's Gift Bonus Challenge: at least
// one of them (discarded or released) matches it.
export function giftMet(supporterCard, paidCards) {
  return Boolean(supporterCard.gift) && paidCards.some((c) => matchesCard(c, supporterCard.gift.challenge));
}

function supporterCtx(state, who, card, target, willDiscard = 0) {
  return {
    who,
    source: { kind: 'supporter', owner: who, uid: card.uid, name: card.name },
    label: `${whose(state, who)} ${card.name}`,
    target,
    willDiscard,
  };
}

// Supporters in hand this player could play now: none played yet this Round,
// enough other cards in hand to pay the Card-Cost exactly, and something for
// the effect to affect.
export function playableSupporters(state, who) {
  const p = state.players[who];
  if (p.supporterRound === state.round) return [];
  return p.hand.filter((c) => c.cardType === 'Supporter'
    && p.hand.length - 1 >= c.cardCost.discard + c.cardCost.release
    && canResolve(state, supporterCtx(state, who, c, undefined, c.cardCost.discard), c.effects));
}

// Legal targets for a Supporter in hand, as refs (a Zone pick gives
// { kind: 'zone', owner, zone }). Empty if it needs none.
export function supporterTargets(state, who, uid) {
  const card = state.players[who].hand.find((c) => c.uid === uid);
  const e = targetedEffect(card.effects);
  return e ? candidates(state, supporterCtx(state, who, card), e.target, e) : [];
}

// Legal targets for a Strategy Card in hand, as refs. Empty if it needs none.
export function strategyTargets(state, who, uid) {
  const card = state.players[who].hand.find((c) => c.uid === uid);
  const e = targetedEffect(card.effects);
  return e ? candidates(state, strategyCtx(state, who, card), e.target, e) : [];
}

// --- Actions -------------------------------------------------------------

export function legalActions(state, who) {
  const p = state.players[who];
  if (state.pending) return state.pending.who === who ? ['resolveChoice'] : [];
  switch (state.phase) {
    case 'trainers':
      return p.pending ? [] : ['assignTrainers'];
    case 'initiative':
      return ['flipCoin'];
    case 'breakfast':
      if (state.xpStep) return p.xpChoice ? [] : ['spendXp'];
      return state.round === 1 && !p.pending ? ['mulligan'] : [];
    case 'battle':
      if (state.turn !== who) return [];
      return [
        'pass',
        ...(playablePokemon(state, who).length ? ['playPokemon'] : []),
        ...(canCommand(state, who) ? ['command'] : []),
        ...(usablePowers(state, who).length ? ['usePower'] : []),
        ...(playableStrategies(state, who).length ? ['playStrategy'] : []),
        ...(playableSupporters(state, who).length ? ['playSupporter'] : []),
        ...(playableLocations(state, who).length ? ['playLocation'] : []),
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
  run(state, STEPS, matchOver);
  if (matchOver(state)) return state;
  refreshAuras(state);
  if (isStuck(state)) {
    endMatch(state, null);
    log(state, 'Draw! Neither player has a Pokémon left, so nobody can win.');
  }
  return state;
}

// Checked between every effect: a win ends the match immediately.
function matchOver(state) {
  if (state.phase === 'gameOver') return true;
  const won = winner(state);
  if (!won) return false;
  endMatch(state, won);
  log(state, `${state.players[won].name} ${won === 'player' ? 'win' : 'wins'}! All 3 enemy Trainers are at 0 Strength.`);
  return true;
}

function endMatch(state, won) {
  state.phase = 'gameOver';
  state.winner = won;
  state.turn = null;
  state.pending = null;
  state.stack = [];
}

// The rest of an Action or Phase, queued under the effects it sets off so it
// happens once they have all resolved.
const STEPS = {
  endTurn(state, { who, passed }) {
    endTurn(state, who, passed);
  },

  // A played Strategy Card reaches the Discard Pile once its effect is done.
  discard(state, { who, card }) {
    state.players[who].discard.push(card);
  },

  // After an attack's damage and any defeats: On Attack for the attacker and
  // On Defend for a Pokémon it hit, if each is still in the arena.
  afterAttack(state, { attacker, target }) {
    const still = (ref) => cardAt(state, ref)?.uid === ref.uid;
    const events = [];
    if (still(attacker)) events.push({ type: 'attack', ref: attacker, card: cardAt(state, attacker), target });
    if (target.kind === 'pokemon' && still(target)) events.push({ type: 'defend', ref: target, card: cardAt(state, target), attacker });
    fireTriggers(state, events);
  },

  afterBreakfast(state) {
    if (state.round === 1) log(state, 'Mulligan: choose any cards to discard and redraw, or keep your hand.');
    else startXpStep(state);
  },

  supperDiscard(state) {
    for (const who of PLAYERS) {
      const p = state.players[who];
      const n = p.hand.length;
      dropXp(p.hand);
      p.discard.push(...p.hand);
      p.hand = [];
      log(state, `${p.name} discarded ${n} card${n === 1 ? '' : 's'} from ${who === 'player' ? 'your' : 'their'} hand.`);
    }
    log(state, 'Supper Phase ends.');
    startRound(state, state.round + 1);
  },
};

// The same event for every Pokémon in the arena (On Breakfast, On Supper).
function everyPokemon(state, type) {
  return arenaPokemon(state).map(({ ref, card }) => ({ type, ref: { ...ref, uid: card.uid }, card }));
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
  // your side (not in a fallen zone), paying its Energy Cost.
  playPokemon(state, { who, uid, zone, space }) {
    const p = state.players[who];
    const c = p.hand.find((h) => h.uid === uid);
    if (!c || c.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (p.zones[zone]?.pokemon[space] !== null) throw new Error('Choose an empty Pokémon Space');
    if (isFallen(state, who, zone)) throw new Error(`Zone ${zone + 1} has fallen on this side; no new Pokémon can go there`);
    if (!canPay(p, c.energyCost)) throw new Error(`Not enough Energy to play ${c.name}`);
    const paid = payCost(p, c.energyCost, state.round);
    log(state, `${p.name} played ${c.name} into Zone ${zone + 1}, Space ${space + 1}, paying ${describePayment(paid)}.`);
    queueStep(state, 'endTurn', { who, passed: false });
    summon(state, who, c, zone, space);
  },

  // Battle Action: Command an Alert Pokémon to Attack. Costs no Energy.
  // from = { zone, space } on your side; target from legalTargets().
  command(state, { who, from, target }) {
    const p = state.players[who];
    const foe = opponentOf(who);
    const attacker = p.zones[from?.zone]?.pokemon[from?.space];
    if (!attacker || !isAlert(state, attacker)) throw new Error('Choose one of your Alert Pokémon');
    const legal = legalTargets(state, who, from).some((t) =>
      t.kind === target?.kind && t.zone === target.zone && (t.kind === 'trainer' || t.space === target.space));
    if (!legal) throw new Error('That is not a legal target');

    const attackerRef = { kind: 'pokemon', owner: who, zone: from.zone, space: from.space, uid: attacker.uid };
    const targetRef = { ...target, owner: foe, uid: cardAt(state, { ...target, owner: foe }).uid };
    queueStep(state, 'endTurn', { who, passed: false });
    queueStep(state, 'afterAttack', { attacker: attackerRef, target: targetRef });
    questEvent(state, who, { type: 'attack', card: attacker, zone: from.zone });
    const name = `${whose(state, who)} ${attacker.name}`;
    const power = attackOf(attacker);
    if (target.kind === 'trainer') {
      const before = cardAt(state, targetRef).strength;
      log(state, `${name} attacked ${describeRef(state, targetRef)} for ${power}. Strength ${before} → ${Math.max(0, before - power)}.`);
      damage(state, targetRef, power);
      attacker.spent = true;
    } else {
      const defender = cardAt(state, targetRef);
      const what = describeRef(state, targetRef);
      const trades = isAlert(state, defender);   // decided before anyone becomes Spent
      const back = attackOf(defender);
      damage(state, targetRef, power);
      if (trades) damage(state, attackerRef, back);
      attacker.spent = true;
      if (trades) defender.spent = true;
      log(state, `${name} attacked ${what} for ${power}`
        + (trades ? `; ${defender.name} was Alert and hit back for ${back}.` : '.'));
    }
    settle(state);   // defeats (and On Defeated) resolve before afterAttack
  },

  // Battle Action: use a Trainer's Power, once per Round, paying its cost.
  // target: a ref from powerTargets(), for a Power that needs one.
  usePower(state, { who, zone, target }) {
    if (!canUsePower(state, who, zone)) throw new Error('That Power cannot be used now');
    const p = state.players[who];
    const trainer = p.zones[zone].trainer;
    const ctx = powerCtx(state, who, zone, target);
    if (targetedEffect(trainer.power.effects) && !powerTargets(state, who, zone).some((r) =>
      r.kind === target?.kind && r.owner === target.owner && r.zone === target.zone && r.space === target.space)) {
      throw new Error('That is not a legal target');
    }
    const paid = payCost(p, trainer.power.cost, state.round);
    trainer.powerUsedRound = state.round;
    log(state, `${ctx.label} (${trainer.power.text}) Paid ${describePayment(paid)}.`);
    queueStep(state, 'endTurn', { who, passed: false });
    questEvent(state, who, { type: 'power', zone });
    queueEffects(state, ctx, trainer.power.effects);
  },

  // Battle Action: play a Strategy Card from hand, paying its Energy Cost.
  // Its effect resolves, then it goes to the Discard Pile.
  // target: a ref from strategyTargets(), for a card that needs one.
  playStrategy(state, { who, uid, target }) {
    const p = state.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Strategy') throw new Error('Choose a Strategy Card from your hand');
    if (!playableStrategies(state, who).includes(card)) throw new Error(`${card.name} cannot be played now`);
    const paid = payCost(p, card.energyCost, state.round);
    p.hand = p.hand.filter((c) => c !== card);   // out of hand while it resolves, so Quickdraw can't draw itself
    log(state, `${p.name} played ${card.name} (${card.effectText}) Paid ${describePayment(paid)}.`);
    queueStep(state, 'endTurn', { who, passed: false });
    queueStep(state, 'discard', { who, card });
    queueEffects(state, strategyCtx(state, who, card, target), card.effects);
  },

  // Battle Action: play a Supporter Card, paying its Card-Cost with other
  // cards from hand: `discard` and `release` are their uids, exactly as many
  // as the cost says. The cost is paid first; then the effect (with the Gift
  // Bonus if a paid card meets the Challenge) resolves, then the Supporter is
  // discarded. target: a ref from supporterTargets(), for one that needs it.
  playSupporter(state, { who, uid, discard = [], release = [], target }) {
    const p = state.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Supporter') throw new Error('Choose a Supporter Card from your hand');
    if (!playableSupporters(state, who).includes(card)) throw new Error(`${card.name} cannot be played now`);
    const paid = [...discard, ...release];
    if (discard.length !== card.cardCost.discard || release.length !== card.cardCost.release) {
      throw new Error(`${card.name} costs exactly Discard ${card.cardCost.discard}, Release ${card.cardCost.release}`);
    }
    if (new Set(paid).size !== paid.length || paid.includes(uid) || !paid.every((u) => p.hand.some((c) => c.uid === u))) {
      throw new Error('Pay with different cards from your hand, other than the Supporter itself');
    }
    const met = giftMet(card, p.hand.filter((c) => paid.includes(c.uid)));
    const effects = met ? card.gift.effects : card.effects;
    const e = targetedEffect(effects);
    const ctx = supporterCtx(state, who, card, target);
    if (e && !candidates(state, ctx, e.target, e).some((r) => sameRef(r, target ?? {}))) throw new Error('That is not a legal target');

    // Pay: the Supporter leaves the hand while it resolves; cost cards go to their piles first.
    const take = (uids) => uids.map((u) => p.hand.find((c) => c.uid === u));
    const discarded = take(discard);
    const released = take(release);
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c.uid));
    dropXp([...discarded, ...released]);
    p.discard.push(...discarded);
    p.released.push(...released);
    p.supporterRound = state.round;
    const names = (cards) => cards.map((c) => c.name).join(', ');
    const payment = [discarded.length && `discarding ${names(discarded)}`, released.length && `releasing ${names(released)}`]
      .filter(Boolean).join(' and ');
    log(state, `${p.name} played ${card.name} (${card.effectText}), ${payment}. Gift Challenge (${card.gift.challengeText}) `
      + (met ? `met: ${card.gift.bonusText}` : 'not met.'));
    queueStep(state, 'endTurn', { who, passed: false });
    queueStep(state, 'discard', { who, card });
    queueEffects(state, ctx, effects);
  },

  // Battle Action: play a Location Card into the Location space of one of
  // your zones (not a fallen zone). No Energy. A Location already there is
  // replaced: it goes to the Discard Pile and its quest progress is lost.
  playLocation(state, { who, uid, zone }) {
    const p = state.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Location') throw new Error('Choose a Location Card from your hand');
    if (!locationSpaces(state, who).includes(zone)) throw new Error(`Zone ${zone + 1} has fallen on this side; no Location can go there`);
    const old = p.zones[zone].location;
    p.hand = p.hand.filter((c) => c !== card);
    if (old) {
      const { progress, done, ...plain } = old;
      p.discard.push(plain);
      log(state, `${p.name} replaced ${old.name} in Zone ${zone + 1}; it goes to the Discard Pile and its quest progress (${progress}/${old.quest.count}) is lost.`);
    }
    p.zones[zone].location = { ...card, progress: 0 };
    log(state, `${p.name} played ${card.name} into Zone ${zone + 1}. Quest: ${card.quest.text} (Reward: ${card.xp} XP)`);
    queueStep(state, 'endTurn', { who, passed: false });
  },

  // Breakfast XP step: spend: [{ uid, stat: 'attack' | 'strength' }], one
  // entry per XP point, on Pokémon in hand. Locked in secret; both reveal together.
  spendXp(state, { who, spend = [] }) {
    const p = state.players[who];
    if (spend.length > p.xp) throw new Error(`Only ${p.xp} XP to spend`);
    for (const { uid, stat } of spend) {
      const c = p.hand.find((h) => h.uid === uid);
      if (!c || c.cardType !== 'Pokémon') throw new Error('XP can only go on Pokémon cards in your hand');
      if (stat !== 'attack' && stat !== 'strength') throw new Error('Each XP point gives +1 Attack or +1 Strength');
    }
    p.xpChoice = spend;
    if (PLAYERS.every((w) => state.players[w].xpChoice)) resolveXp(state);
  },

  // Answers state.pending, then resolving carries on.
  //   freeSummon: { zone, space } to summon, or no zone to keep the card in hand
  //   target:     { target } — one of state.pending.options
  resolveChoice(state, { zone, space, target }) {
    const pending = state.pending;
    const job = state.stack.at(-1);
    if (pending.kind === 'freeSummon') {
      job.choice = { zone, space };
    } else if (pending.kind === 'target') {
      if (!target || !pending.options.some((r) => sameRef(r, target))) throw new Error('That is not a legal target');
      job.ctx.target = target;
    }
    state.pending = null;
  },

  // A Battle turn's Action. The Phase ends when both players pass in a row.
  pass(state, { who }) {
    log(state, `${state.players[who].name} passed.`);
    endTurn(state, who, true);
  },
};

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
    const n = draw(state, who, HAND_SIZE).length;
    log(state, `${p.name} drew ${n} card${n === 1 ? '' : 's'}.`);
  }
  // On Breakfast: after cards are drawn and Energy is gained.
  queueStep(state, 'afterBreakfast');
  fireTriggers(state, everyPokemon(state, 'breakfast'));
  queueWeather(state, 'breakfast');   // on top: Weather first
}

function endBreakfast(state) {
  log(state, 'Breakfast Phase ends.');
  startBattle(state);
}

// --- The XP step (Breakfast, after drawing and any mulligan) ---

// A player with no XP or no Pokémon in hand has nothing to choose and skips it.
function startXpStep(state) {
  state.xpStep = true;
  for (const who of PLAYERS) {
    const p = state.players[who];
    p.xpChoice = p.xp > 0 && p.hand.some((c) => c.cardType === 'Pokémon') ? null : [];
  }
  if (PLAYERS.every((w) => state.players[w].xpChoice)) {
    resolveXp(state);
  } else {
    log(state, 'Spend XP: each point gives one Pokémon card in hand +1 Attack or +1 Strength.');
  }
}

function resolveXp(state) {
  for (const who of PLAYERS) {
    const p = state.players[who];
    const spend = p.xpChoice;
    p.xpChoice = null;
    if (!spend.length) continue;
    const per = {};
    for (const { uid, stat } of spend) {
      const c = p.hand.find((h) => h.uid === uid);
      c.xp ??= { attack: 0, strength: 0 };
      c.xp[stat] += 1;
      (per[c.name] ??= { attack: 0, strength: 0 })[stat] += 1;
    }
    p.xp -= spend.length;
    const parts = Object.entries(per).map(([name, b]) =>
      `${name} ${[b.attack && `+${b.attack} Attack`, b.strength && `+${b.strength} Strength`].filter(Boolean).join(', ')}`);
    log(state, `${p.name} spent ${spend.length} XP: ${parts.join('; ')} (${p.xp} XP left).`);
  }
  state.xpStep = false;
  endBreakfast(state);
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
  startXpStep(state);
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
  // On Supper: before hands are discarded.
  queueStep(state, 'supperDiscard');
  fireTriggers(state, everyPokemon(state, 'supper'));
  queueWeather(state, 'supper');      // on top: Weather first
}
