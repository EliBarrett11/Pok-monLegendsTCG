// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.
//
// Every change goes through applyAction(state, action), which returns a new
// state and never edits the old one.

import { shuffle, nextRandom } from './random.js';
import { buildDeck, buildTrainers, buildMartStock } from './cards.js';
import { POKEMON_CARDS } from './cardData.js';
import { newEnergy, refreshEnergy, canPay, payCost, splitCost, availableExert } from './energy.js';
import {
  PLAYERS, opponentOf, log, whose, draw, arenaPokemon, cardAt, emptySpaces, summonSpaces, isFallen,
  attackOf, damage, describeRef, sameRef, dropXp, weatherCounts, speedOf, release as releaseCards, earnDollars, toMart, emit, info,
  maxStrengthOf, hasRetain, RULE_FLAGS, newStats, nameOf, verbFor, yourOf, youOf, secretOf, newUids,
} from './board.js';
import { hasKeyword, keywordAmount } from './keywords.js';
import { resolveSupperStatuses, clearStatus } from './status.js';
import {
  summon, candidates, canResolve, targetedEffect, queueEffects, queueStep, run, refreshAuras, settle, fireTriggers,
  matchesCard, questEvent, queueWeather, weatherState, burnCard, resolveLeechSeeds, gainGrowth, isEvolution, evolvePokemon,
} from './effects.js';

export { PLAYERS, opponentOf, emptySpaces, summonSpaces, isFallen, attackOf, weatherCounts, weatherState, isEvolution };
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
// target, a free summon). While it is set, that player's only Action is
// resolveChoice. state.stack holds what is still to resolve (see effects.js).

function newPlayer(name, owner, state, deck) {
  const p = {
    name,
    deck,                // the deck id: 'fire' | 'water'
    drawPile: [],        // filled below: shuffled, then numbered (newUids)
    uids: 0,             // card uids handed out so far
    hand: [],
    discard: [],
    released: [],        // defeated Pokémon and Released cards; never shuffled back
    supporterRound: null, // the Round this player last played a Supporter (1 per Round)
    xp: 0,               // stored indefinitely; spent at Breakfast on Pokémon in hand
    xpChoice: null,      // the XP step: this player's locked-in spending, revealed together
    dollars: 0,          // PokéDollars: earned for defeating Pokémon, spent on Items; kept between Rounds
    growth: 0,           // Growth: gained by card effects (and Sun 4), spent on Evolve costs; kept between Rounds
    bag: [],             // up to BAG_SIZE Items; { ...item, inDelivery } until the next Breakfast
    trainers: buildTrainers(owner, deck),
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
  p.drawPile = newUids(p, owner, shuffle(state, buildDeck(owner, deck)));
  return p;
}

// decks: which deck each side plays (the player chooses; the AI plays the other).
// names: what each seat is called (the reader is always "You"; see localize in board.js).
export const AI_NAMES = { player: 'You', ai: 'AI Opponent' };
export function createGame(seed = Date.now(), { decks = { player: 'fire', ai: 'water' }, names = AI_NAMES } = {}) {
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
    names: { ...names },
    log: [],         // the log as the 'player' seat reads it (logSource: seat-neutral, for viewFor)
    logSource: [],
    events: [],          // what the last action did, as structured events (see emit in board.js)
    stats: newStats(),   // for the end screen (board.js tally)
  };
  state.players = {
    player: newPlayer(nameOf('player'), 'player', state, decks.player),
    ai: newPlayer(nameOf('ai'), 'ai', state, decks.ai),
  };
  // One PokéMart shared by both players: a deck and 3 Items on sale.
  state.mart = { deck: shuffle(state, buildMartStock()), onSale: [null, null, null] };
  log(state, 'The Battle Arena is laid out: 3 zones per side, each with a Trainer Space and 3 Pokémon Spaces.');
  log(state, 'Both players choose which Trainer takes each zone.');
  return state;
}

// A game saved as JSON (to resume a match after a refresh): JSON can't keep one
// object in two places, so each zone's Trainer is joined back to the same card
// in that player's Trainers (damage to one must be damage to the other).
export function restoreState(saved) {
  const state = structuredClone(saved);
  for (const who of PLAYERS) {
    const p = state.players[who];
    for (const z of p.zones) {
      if (z.trainer) z.trainer = p.trainers.find((t) => t.uid === z.trainer.uid) ?? z.trainer;
    }
  }
  return state;
}

// A player wins immediately when all 3 enemy Trainers are at 0 Strength.
// If both players' last Trainers reach 0 at the same moment (Burn at
// Supper), nobody wins: see bothBeaten.
export function winner(state) {
  if (bothBeaten(state)) return null;
  return PLAYERS.find((who) =>
    state.players[opponentOf(who)].trainers.every((t) => t.strength <= 0)) ?? null;
}

export function bothBeaten(state) {
  return PLAYERS.every((who) => state.players[who].trainers.every((t) => t.strength <= 0));
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

// What summoning this Pokémon into this Zone costs: its printed Energy Cost,
// less any reduction on the card (while in hand) and from friendly Passives
// for that Zone (e.g. Wallace: the first Pokémon summoned into his Zone each
// Round costs 1 less). Never below 0. The printed Energy Cost itself never
// changes (PokéDollars, Gift Challenges and "costing 2 or less" use it).
export function summonCost(state, who, card, zone) {
  return Math.max(0, card.energyCost - (card.costDown ?? 0) - zoneReductions(state, who, zone).reduce((sum, r) => sum + r.amount, 0));
}

// The cost reductions a Zone gives a summon there right now: [{ amount, name }].
export function zoneReductions(state, who, zone) {
  const p = state.players[who];
  const trainer = p.zones[zone]?.trainer;
  const cut = trainer && trainer.strength > 0 ? trainer.passive?.cost : null;
  if (!cut) return [];
  if (cut.first && p.summonedInto?.[zone] === state.round) return [];
  return [{ amount: cut.amount, name: trainer.name }];
}

// Zones with an empty space this Pokémon could be summoned into now, with
// the cost there: [{ zone, cost }].
export function summonZones(state, who, card) {
  const zones = [...new Set(summonSpaces(state, who).map((s) => s.zone))];
  return zones.map((zone) => ({ zone, cost: summonCost(state, who, card, zone) }));
}

// The cheapest it could be summoned for now (its printed cost if there is no room).
export function cheapestCost(state, who, card) {
  const costs = summonZones(state, who, card).map((z) => z.cost);
  return costs.length ? Math.min(...costs) : card.energyCost;
}

// Pokémon in hand this player could play right now (affordable in a Zone with room).
export function playablePokemon(state, who) {
  const p = state.players[who];
  if (!summonSpaces(state, who).length) return [];
  return p.hand.filter((c) => c.cardType === 'Pokémon' && !isEvolution(c) && summonZones(state, who, c).some((z) => canPay(p, z.cost)));
}

// --- Evolve (docs/decks.md 2.8) ---------------------------------------------------

// The Basic a Stage 2 card's line starts from (Venusaur → Bulbasaur), by name.
const basicOf = (stage2) => POKEMON_CARDS.find((c) => c.stage === 'Stage 1' && c.name === stage2.evolvesFrom)?.evolvesFrom ?? null;

// Whether `who` has Celebi (or another "can Evolve the Round they're summoned" card) in the arena.
function evolvesSameRound(state, who) {
  return arenaPokemon(state).some(({ ref, card }) => ref.owner === who && card.evolveSameRound && card.currentStrength > 0);
}

// The Pokémon in `who`'s arena this evolution card can go onto now: the one
// it evolves from (by name), in the arena since before this Round began.
// Celebi lifts "summoned this Round" (not "evolved this Round"). Rare Candy
// lets a Stage 2 go straight onto its Basic this Round, even one summoned this Round.
export function evolveTargets(state, who, uid) {
  const card = state.players[who].hand.find((c) => c.uid === uid);
  if (!isEvolution(card)) return [];
  const celebi = evolvesSameRound(state, who);
  const candyBasic = card.stage === 'Stage 2' ? basicOf(card) : null;
  const out = [];
  state.players[who].zones.forEach((z, zone) => z.pokemon.forEach((c, space) => {
    if (!c) return;
    const settled = (c.arrivedRound ?? 0) < state.round || (celebi && c.evolvedRound !== state.round);
    const candy = candyBasic && c.candyRound === state.round && c.name === candyBasic;
    if ((c.name === card.evolvesFrom && settled) || candy) out.push({ zone, space });
  }));
  return out;
}

// What Evolving this card in `zone` costs: its Evolve cost, less Gardenia's
// Passive if she's in that Zone (minimum 0). Cost reductions for summons don't apply.
export function evolveCost(state, who, card, zone) {
  return Math.max(0, card.evolveCost - evolveReductions(state, who, zone).reduce((n, r) => n + r.amount, 0));
}

export function evolveReductions(state, who, zone) {
  const trainer = state.players[who].zones[zone]?.trainer;
  const cut = trainer && trainer.strength > 0 ? trainer.passive?.evolveCost : 0;
  return cut ? [{ amount: cut, name: trainer.name }] : [];
}

// How an Evolve cost can be paid: 1 Growth replaces 1 Energy, mixed as the
// player chooses. { minGrowth, maxGrowth } (Growth to use), or null if it can't be paid.
export function evolvePayment(p, cost) {
  const maxGrowth = Math.min(p.growth ?? 0, cost);
  const minGrowth = Math.max(0, cost - (p.baseEnergy + availableExert(p)));
  return minGrowth <= maxGrowth ? { minGrowth, maxGrowth } : null;
}

// Every Evolve `who` can make now: { uid, zone, space, cost, minGrowth, maxGrowth }.
export function evolveOptions(state, who) {
  if (state.phase !== 'battle') return [];
  const p = state.players[who];
  const out = [];
  for (const card of p.hand.filter(isEvolution)) {
    for (const t of evolveTargets(state, who, card.uid)) {
      const cost = evolveCost(state, who, card, t.zone);
      const pay = evolvePayment(p, cost);
      if (pay) out.push({ uid: card.uid, ...t, cost, ...pay });
    }
  }
  return out;
}

// The cheapest an evolution card in hand could Evolve for now (its printed cost if nowhere).
export function cheapestEvolveCost(state, who, card) {
  const costs = evolveTargets(state, who, card.uid).map((t) => evolveCost(state, who, card, t.zone));
  return costs.length ? Math.min(...costs) : card.evolveCost;
}

// How paying a cost would split: { fromBase, fromExert }. For a card in hand
// pass its uid (a Pokémon: the cost in `zone`, or its cheapest Zone); for a
// Trainer Power pass { power: zone }. For an evolution card, the Energy part
// of its Evolve cost after `growth` Growth (by default as much as it can use).
export function costPreview(state, who, what, zone, growth) {
  const p = state.players[who];
  let cost;
  if (typeof what === 'object') cost = p.zones[what.power].trainer.power.cost;
  else {
    const c = p.hand.find((h) => h.uid === what);
    if (isEvolution(c)) {
      const full = zone === undefined ? cheapestEvolveCost(state, who, c) : evolveCost(state, who, c, zone);
      cost = full - (growth ?? Math.min(p.growth ?? 0, full));
    }
    else cost = c.cardType !== 'Pokémon' ? c.energyCost : zone === undefined ? cheapestCost(state, who, c) : summonCost(state, who, c, zone);
  }
  return splitCost(p, cost);
}

// A played card is revealed: the event carries its face (for the screen; see view.js).
const face = (card) => structuredClone(card);

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
    .map(({ card }) => speedOf(card)));
}

// Alert: Active, and of the highest Speed-Tier among all Active Pokémon
// (a Held Item can raise it). Worked out fresh each time, so it is always
// current after every Action.
export function isAlert(state, card) {
  return !card.spent && speedOf(card) === alertTier(state);
}

// The Pokémon a Pass by this player would make Spent: their Active Pokémon
// at the top Speed-Tier, when the opponent has no Active Pokémon at that
// tier ("unmatched speed"). None if the Pass would end the Battle Phase.
// As refs: { kind: 'pokemon', owner, zone, space, uid, name }.
export function passSpends(state, who) {
  if (state.phase !== 'battle' || passEndsPhase(state)) return [];
  const top = alertTier(state);
  if (top < 0) return [];
  const atTop = arenaPokemon(state).filter(({ card }) => !card.spent && speedOf(card) === top);
  if (atTop.some(({ ref }) => ref.owner !== who)) return [];
  return atTop.map(({ ref, card }) => ({ ...ref, uid: card.uid, name: card.name }));
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
// An Infiltrator attacker ignores both. Only Trainers above 0 Strength.
// Balance experiment (tools/balance.js), off unless switched on:
//   RULE_FLAGS.zoneGuards: a guard only restricts targets in its own Zone.
export function legalTargets(state, who, from, { ignoreInfiltrator = false } = {}) {
  const attacker = state.players[who].zones[from.zone]?.pokemon[from.space];
  if (!attacker) return [];
  const enemy = state.players[opponentOf(who)];
  const pokemon = [];
  enemy.zones.forEach((z, zone) => z.pokemon.forEach((card, space) => {
    if (card) pokemon.push({ kind: 'pokemon', zone, space, card });
  }));
  const trainers = enemy.zones.map((z, zone) => ({ kind: 'trainer', zone, card: z.trainer }))
    .filter((t) => t.card && t.card.strength > 0);
  const guard = { Physical: 'Defence', Special: 'Special Defence' }[attacker.attackType];
  const isGuard = (t) => t.kind === 'pokemon' && t.card.strengthType === guard;
  let targets;
  if (hasKeyword(attacker, 'Infiltrator') && !ignoreInfiltrator) targets = [...pokemon, ...trainers];
  else if (RULE_FLAGS.zoneGuards) {
    const all = [...pokemon, ...trainers];
    targets = all.filter((t) => isGuard(t) || !all.some((g) => isGuard(g) && g.zone === t.zone));
  } else {
    const guards = pokemon.filter(isGuard);
    targets = guards.length ? guards : [...pokemon, ...trainers];
  }
  return targets.map(({ kind, zone, space }) => (kind === 'pokemon' ? { kind, zone, space } : { kind, zone }));
}

// The enemy guards an Infiltrator attack goes over to reach this target: the
// Pokémon it would have had to attack first without Infiltrator (none if it
// could have reached the target anyway). For the animation; no rule here.
export function guardsBypassed(state, who, from, ref) {
  const attacker = state.players[who].zones[from.zone]?.pokemon[from.space];
  if (!attacker || !hasKeyword(attacker, 'Infiltrator')) return [];
  const plain = legalTargets(state, who, from, { ignoreInfiltrator: true });
  if (plain.some((t) => t.kind === ref.kind && t.zone === ref.zone && t.space === ref.space)) return [];
  const enemy = state.players[opponentOf(who)];
  return plain.filter((t) => t.kind === 'pokemon').map((t) => {
    const card = enemy.zones[t.zone].pokemon[t.space];
    return { kind: 'pokemon', owner: opponentOf(who), zone: t.zone, space: t.space, uid: card.uid, name: card.name };
  });
}

// Why an attack from `from` can't target this enemy Pokémon or Trainer: the
// Pokémon guarding it (with the Strength-Type that blocks this attacker), or
// that a Trainer is already out. Null when it can be targeted (or isn't there).
export function attackBlock(state, who, from, ref) {
  const attacker = state.players[who].zones[from.zone]?.pokemon[from.space];
  const enemy = state.players[opponentOf(who)];
  const card = ref.kind === 'trainer' ? enemy.zones[ref.zone]?.trainer : enemy.zones[ref.zone]?.pokemon[ref.space];
  if (!attacker || !card) return null;
  if (legalTargets(state, who, from).some((t) => t.kind === ref.kind && t.zone === ref.zone && t.space === ref.space)) return null;
  if (ref.kind === 'trainer' && card.strength <= 0) return { defeated: true, guards: [] };
  const guard = { Physical: 'Defence', Special: 'Special Defence' }[attacker.attackType];
  const guards = [];
  enemy.zones.forEach((z, zone) => z.pokemon.forEach((g) => {
    if (g && g.strengthType === guard && (!RULE_FLAGS.zoneGuards || zone === ref.zone)) guards.push(g.name);
  }));
  return { defeated: false, guards };
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
    source: { kind: 'strategy', owner: who, uid: card.uid, name: card.name, id: card.id },
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

// --- Items, the Bag and the PokéMart ---

export const BAG_SIZE = 6;

function itemCtx(state, who, item, target) {
  return {
    who,
    source: { kind: 'item', owner: who, uid: item.uid, name: item.name },
    label: `${whose(state, who)} ${item.name}`,
    target,
    item,
  };
}

// Whether this Item has a legal target (or needs none) right now.
export function canUseItem(state, who, item) {
  return canResolve(state, itemCtx(state, who, item), item.effects);
}

// Legal targets for an Item, as refs (Held Items can also go on a Pokémon in hand).
export function itemTargets(state, who, item) {
  const e = targetedEffect(item.effects);
  return e ? candidates(state, itemCtx(state, who, item), e.target, e) : [];
}

function checkItemTarget(state, who, item, target) {
  if (!canUseItem(state, who, item)) throw new Error(`${item.name} has no legal target`);
  const e = targetedEffect(item.effects);
  if (e && !itemTargets(state, who, item).some((r) => sameRef(r, target ?? {}))) throw new Error('That is not a legal target');
}

// Using an Item: its effects resolve; a Consumed Item then goes to the PokéMart.
function useItem(state, who, item, target) {
  const { inDelivery, ...plain } = item;
  log(state, `${state.players[who].name} used ${plain.name} (${plain.effectText})`);
  queueStep(state, 'endTurn', { who, passed: false });
  if (plain.itemType === 'Consumed') queueStep(state, 'toMart', { item: plain });
  queueEffects(state, itemCtx(state, who, plain, target), plain.effects);
}

// Every Open Bag move this player could make now, as partial actions
// ({ mode, uid | slot, then? }); targets are chosen separately.
export function openBagOptions(state, who) {
  const p = state.players[who];
  const room = p.bag.length < BAG_SIZE;
  const options = [];
  for (const item of p.hand) {
    if (item.cardType !== 'Item' || item.cost > p.dollars) continue;
    if (canUseItem(state, who, item)) options.push({ mode: 'buyHand', uid: item.uid, then: 'use' });
    if (room) options.push({ mode: 'buyHand', uid: item.uid, then: 'store' });
  }
  if (room) {
    state.mart.onSale.forEach((item, slot) => {
      if (item && item.cost <= p.dollars) options.push({ mode: 'buyMart', slot });
    });
  }
  for (const item of p.bag) {
    if (!item.inDelivery && canUseItem(state, who, item)) options.push({ mode: 'useBag', uid: item.uid });
  }
  return options;
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
        ...(evolveOptions(state, who).length ? ['evolve'] : []),
        ...(canCommand(state, who) ? ['command'] : []),
        ...(usablePowers(state, who).length ? ['usePower'] : []),
        ...(playableStrategies(state, who).length ? ['playStrategy'] : []),
        ...(playableSupporters(state, who).length ? ['playSupporter'] : []),
        ...(playableLocations(state, who).length ? ['playLocation'] : []),
        ...(openBagOptions(state, who).length ? ['openBag'] : []),
      ];
    default:
      return [];
  }
}

export function applyAction(prev, action) {
  const state = structuredClone(prev);
  state.events = [];
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
  if (bothBeaten(state)) {
    endMatch(state, null);
    log(state, "Draw! Both players' last Trainers reached 0 at the same moment.");
    return true;
  }
  const won = winner(state);
  if (!won) return false;
  endMatch(state, won);
  log(state, `${state.players[won].name} ${verbFor(won, 'win', 'wins')}! All 3 enemy Trainers are at 0 Strength.`);
  return true;
}

function endMatch(state, won) {
  emit(state, 'matchOver', { winner: won });
  state.phase = 'gameOver';
  state.winner = won;
  state.turn = null;
  state.pending = null;
  // A card still resolving when the match ends finishes its move: a played
  // Strategy or Supporter to the Discard Pile, a used Consumed Item to the PokéMart.
  for (const job of state.stack ?? []) {
    if (job.kind === 'step' && job.step === 'discard') STEPS.discard(state, job);
    if (job.kind === 'step' && job.step === 'toMart') {
      const { inDelivery, ...plain } = job.item;
      state.mart.deck.push(plain);
    }
  }
  state.stack = [];
}

// The rest of an Action or Phase, queued under the effects it sets off so it
// happens once they have all resolved.
const STEPS = {
  endTurn(state, { who, passed }) {
    endTurn(state, who, passed);
  },

  // A used Consumed Item goes to the PokéMart once its effect is done.
  toMart(state, { item }) {
    toMart(state, item, 'was used up');
  },

  // A played Strategy Card reaches the Discard Pile once its effect is done.
  discard(state, { who, card }) {
    state.players[who].discard.push(card);
    emit(state, 'cardMoved', { uid: card.uid, name: card.name, owner: who, to: 'discard' });
  },

  // After an attack's damage and any defeats (and their On Defeated), in order:
  // Overrun's leftover damage to the Trainer, Scorch's Burn on the target if
  // it's still in play, then On Attack, On Defend, On Knockout and On Trainer
  // Strike for each Pokémon still in the arena (in the usual order).
  afterAttack(state, job) {
    const { attacker, target } = job;
    const still = (ref) => {
      const c = cardAt(state, ref);
      return c?.uid === ref.uid && (ref.kind === 'trainer' ? c.strength > 0 : c.currentStrength > 0);
    };
    const strikes = [...(job.strikes ?? [])];
    if (job.overrun) {
      const { amount, zone, owner } = job.overrun;
      const ref = { kind: 'trainer', owner, zone };
      const trainer = cardAt(state, ref);
      if (trainer && trainer.strength > 0) {
        const tref = { ...ref, uid: trainer.uid };
        emit(state, 'overrun', { who: attacker.owner, attacker: info(state, attacker), target: info(state, tref), amount });
        const [before, after] = damage(state, tref, amount, { by: attacker.owner, hitBy: { kind: 'pokemon', type: cardAt(state, attacker)?.pokemonType } });
        log(state, `Overrun: ${amount} leftover damage goes through to ${describeRef(state, tref)}. Strength ${before} → ${after}.`);
        strikes.push(tref);
        questEvent(state, attacker.owner, { type: 'trainerStrike', zone: attacker.zone });
        settle(state);   // a removed Trainer's Passive stops
      } else {
        log(state, `Overrun: the leftover ${amount} damage is lost (no Trainer in Zone ${zone + 1} on that side).`);
      }
    }
    if (job.scorch && still(job.scorch.target)) {
      emit(state, 'scorch', { who: attacker.owner, attacker: info(state, attacker), target: info(state, job.scorch.target), amount: job.scorch.amount });
      burnCard(state, job.scorch.target, job.scorch.amount, attacker.owner, attacker);
    }
    const events = [];
    if (still(attacker)) events.push({ type: 'attack', ref: attacker, card: cardAt(state, attacker), target });
    if (target.kind === 'pokemon' && still(target)) events.push({ type: 'defend', ref: target, card: cardAt(state, target), attacker });
    for (const k of job.knockouts ?? []) {
      if (still(k.ref)) events.push({ type: 'knockout', ref: k.ref, card: cardAt(state, k.ref), victim: k.victim });
    }
    if (still(attacker)) {
      for (const t of strikes) events.push({ type: 'trainerStrike', ref: attacker, card: cardAt(state, attacker), target: t });
    }
    fireTriggers(state, events);
  },

  // Supper, in order: Weather (queued on top) → Burn → On Supper → "this Round"
  // effects expire → hands are discarded. Each step works out who is in play
  // when it starts, so a Pokémon Burn just defeated doesn't fire On Supper.
  burn(state) {
    resolveSupperStatuses(state);
    settle(state);
  },

  // After Burn (and its defeats): every Leech Seed drains its Pokémon.
  leechSeed(state) {
    resolveLeechSeeds(state);
    settle(state);
  },

  supperAbilities(state) {
    fireTriggers(state, everyPokemon(state, 'supper'));
  },

  // "Have N friendly Pokémon in this Zone at Supper": checked after On Supper,
  // before "this Round" effects expire.
  supperQuests(state) {
    for (const who of PLAYERS) {
      state.players[who].zones.forEach((z, zone) => {
        if (z.location?.quest?.on === 'presence') questEvent(state, who, { type: 'presence', zone, value: z.pokemon.filter(Boolean).length });
      });
    }
  },

  breakfastAbilities(state) {
    fireTriggers(state, everyPokemon(state, 'breakfast'));
  },

  // "This Round" buffs and keywords end. Losing a Strength buff follows the
  // Passive rule: maximum drops, current only if above it; it never defeats.
  expireRound(state) {
    const ended = [];
    for (const { ref, card } of arenaPokemon(state)) {
      const buffs = card.roundBuffs ?? [];
      const grants = (card.granted ?? []).filter((k) => k.thisRound);
      if (!buffs.length && !grants.length) continue;
      delete card.roundBuffs;
      card.granted = (card.granted ?? []).filter((k) => !k.thisRound);
      card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
      emit(state, 'buffLost', { target: info(state, ref), source: 'this Round' });
      ended.push(card.name);
    }
    if (ended.length) log(state, `"This Round" effects end: ${ended.join(', ')}.`);
  },

  afterBreakfast(state) {
    if (state.round === 1) log(state, 'Mulligan: choose any cards to discard and redraw, or keep your hand.');
    else startXpStep(state);
  },

  // Hands are discarded, except cards with Retain (no hand size limit).
  supperDiscard(state) {
    for (const who of PLAYERS) {
      const p = state.players[who];
      const kept = p.hand.filter(hasRetain);
      const gone = p.hand.filter((c) => !hasRetain(c));
      for (const c of gone) emit(state, 'cardMoved', { uid: c.uid, name: c.name, owner: who, to: 'discard' });
      dropXp(gone);
      p.discard.push(...gone);
      p.hand = kept;
      if (kept.length) emit(state, 'retained', { who, uids: kept.map((c) => c.uid), count: kept.length });
      log(state, `${p.name} discarded ${gone.length} card${gone.length === 1 ? '' : 's'} from ${yourOf(who)} hand`
        + `${kept.length ? `, keeping ${secretOf(who, kept.map((c) => c.name).join(', '), `${kept.length} card${kept.length === 1 ? '' : 's'}`)} (Retain)` : ''}.`);
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
    emit(state, 'trainersLocked', { who });
    if (PLAYERS.every((w) => state.players[w].pending)) revealTrainers(state);
  },

  flipCoin(state) {
    const result = nextRandom(state) < 0.5 ? 'player' : 'ai';
    state.initiative = result;
    emit(state, 'coinFlip', { winner: result });
    log(state, `Coin flip: ${state.players[result].name} ${verbFor(result, 'win', 'wins')} initiative for Round 1.`);
    startRound(state, 1);
  },

  // cardUids: cards to put in the Discard Pile and replace. Empty = keep hand.
  mulligan(state, { who, cardUids }) {
    const p = state.players[who];
    if (state.round !== 1 && cardUids.length > 0) throw new Error('Mulligans are only allowed in Round 1');
    if (!cardUids.every((u) => p.hand.some((c) => c.uid === u))) throw new Error('Can only mulligan cards in your hand');
    p.pending = [...new Set(cardUids)];
    emit(state, 'mulliganLocked', { who });
    if (PLAYERS.every((w) => state.players[w].pending)) resolveMulligans(state);
  },

  // Battle Action: Evolve. Play an evolution card from hand onto the Pokémon it
  // evolves from, paying its Evolve cost with Energy (Base Energy, then Exert)
  // and/or Growth. growth: how much Growth to use (default: as much as it can).
  evolve(state, { who, uid, zone, space, growth }) {
    const p = state.players[who];
    const card = p.hand.find((h) => h.uid === uid);
    if (!isEvolution(card)) throw new Error('Choose an evolution card from your hand');
    const target = p.zones[zone]?.pokemon[space];
    if (!evolveTargets(state, who, uid).some((t) => t.zone === zone && t.space === space)) {
      if (!target || target.name !== card.evolvesFrom) throw new Error(`${card.name} evolves from ${card.evolvesFrom}: choose your ${card.evolvesFrom}`);
      throw new Error(`${target.name} arrived this Round: it can Evolve from next Round`);
    }
    const cost = evolveCost(state, who, card, zone);
    const cuts = evolveReductions(state, who, zone).map((r) => `−${r.amount} ${r.name}`);
    const pay = evolvePayment(p, cost);
    if (!pay) throw new Error(`Not enough Energy and Growth to Evolve (cost ${cost})`);
    const fromGrowth = growth ?? pay.maxGrowth;
    if (!Number.isInteger(fromGrowth) || fromGrowth < pay.minGrowth || fromGrowth > pay.maxGrowth) {
      throw new Error(`Use between ${pay.minGrowth} and ${pay.maxGrowth} Growth for this Evolve`);
    }
    p.growth -= fromGrowth;
    const paid = payCost(p, cost - fromGrowth, state.round);
    const payment = [paid.fromBase || paid.fromExert || !fromGrowth ? describePayment(paid) : '', fromGrowth ? `${fromGrowth} Growth` : ''].filter(Boolean).join(' + ');
    log(state, `${p.name} played ${card.name} onto ${target.name}, paying ${payment}${cost !== card.evolveCost ? ` (cost ${card.evolveCost} → ${cost}: ${cuts.join(', ')})` : ''}.`);
    emit(state, 'evolvePaid', { who, uid, cost, growth: fromGrowth, ...paid });
    queueStep(state, 'endTurn', { who, passed: false });
    evolvePokemon(state, who, card, { kind: 'pokemon', owner: who, zone, space });
  },

  // Battle Action: play a Pokémon from hand into an empty Pokémon Space on
  // your side (not in a fallen zone), paying its Energy Cost.
  playPokemon(state, { who, uid, zone, space }) {
    const p = state.players[who];
    const c = p.hand.find((h) => h.uid === uid);
    if (!c || c.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (isEvolution(c)) throw new Error(`${c.name} evolves from ${c.evolvesFrom}: it can't be summoned on its own`);
    if (p.zones[zone]?.pokemon[space] !== null) throw new Error('Choose an empty Pokémon Space');
    if (isFallen(state, who, zone)) throw new Error(`Zone ${zone + 1} has fallen on this side; no new Pokémon can go there`);
    const cost = summonCost(state, who, c, zone);
    if (!canPay(p, cost)) throw new Error(`Not enough Energy to play ${c.name}`);
    const cuts = [...(c.costDown ? [`−${c.costDown} on the card`] : []), ...zoneReductions(state, who, zone).map((r) => `−${r.amount} ${r.name}`)];
    const paid = payCost(p, cost, state.round);
    emit(state, 'cardPlayed', { who, card: face(c), uid: c.uid, name: c.name, cardType: c.cardType, cost, printedCost: c.energyCost, to: { kind: 'pokemon', owner: who, zone, space } });
    log(state, `${p.name} played ${c.name} into Zone ${zone + 1}, Space ${space + 1}, paying ${describePayment(paid)}${cost !== c.energyCost ? ` (cost ${c.energyCost} → ${cost}: ${cuts.join(', ')})` : ''}.`);
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
    const after = queueStep(state, 'afterAttack', { attacker: attackerRef, target: targetRef, knockouts: [], strikes: [] });
    questEvent(state, who, { type: 'attack', card: attacker, zone: from.zone });
    const scorch = keywordAmount(attacker, 'Scorch');
    const name = `${whose(state, who)} ${attacker.name}`;
    const power = attackOf(attacker);
    const hitsBack = target.kind === 'pokemon' && isAlert(state, cardAt(state, targetRef));
    const over = guardsBypassed(state, who, from, target);
    emit(state, 'attack', {
      who,
      attacker: { ...attackerRef, name: attacker.name },
      target: info(state, targetRef),
      amount: power,
      trades: hitsBack,
      back: hitsBack ? attackOf(cardAt(state, targetRef)) : 0,
      ...(over.length ? { infiltrated: over } : {}),
    });
    if (target.kind === 'trainer') {
      const before = cardAt(state, targetRef).strength;
      log(state, `${name} attacked ${describeRef(state, targetRef)} for ${power}. Strength ${before} → ${Math.max(0, before - power)}.`);
      damage(state, targetRef, power, { by: who, hitBy: { kind: 'pokemon', type: attacker.pokemonType } });
      attacker.spent = true;
      if (power > 0) {
        after.strikes.push(targetRef);
        questEvent(state, who, { type: 'trainerStrike', zone: from.zone });
        if (scorch) after.scorch = { amount: scorch, target: targetRef };
      }
    } else {
      const defender = cardAt(state, targetRef);
      const what = describeRef(state, targetRef);
      const trades = isAlert(state, defender);   // decided before anyone becomes Spent
      const back = attackOf(defender);
      const [hpBefore, hpAfter] = damage(state, targetRef, power, { by: who, hitBy: { kind: 'pokemon', type: attacker.pokemonType } });
      const [atkBefore, atkAfter] = trades ? damage(state, attackerRef, back, { by: foe, hitBy: { kind: 'pokemon', type: defender.pokemonType } }) : [0, 0];
      attacker.spent = true;
      if (trades) defender.spent = true;
      const dealt = hpBefore - hpAfter;
      log(state, `${name} attacked ${what} for ${dealt}${dealt !== power ? ` (Shell: ${power} → ${dealt})` : ''}`
        + (trades ? `; ${defender.name} was Alert and hit back for ${atkBefore - atkAfter}${atkBefore - atkAfter !== back ? ` (Shell: ${back} → ${atkBefore - atkAfter})` : ''}.` : '.'));
      if (dealt > 0 && scorch) after.scorch = { amount: scorch, target: targetRef };
      // Overrun: damage beyond the defender's remaining Strength goes on to its Trainer.
      if (hpAfter < 0 && hasKeyword(attacker, 'Overrun')) after.overrun = { amount: -hpAfter, zone: target.zone, owner: foe };
      // On Knockout: the attacker's hit, or the defender's hit back in a trade, defeated the other.
      if (hpAfter <= 0) after.knockouts.push({ ref: attackerRef, victim: info(state, targetRef) });
      if (trades && attacker.currentStrength <= 0) after.knockouts.push({ ref: { ...targetRef }, victim: info(state, attackerRef) });
      settle(state);   // defeats (and On Defeated) resolve before afterAttack
      return;
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
    emit(state, 'powerUsed', { who, zone, uid: trainer.uid, name: trainer.name, text: trainer.power.text, target: info(state, target) });
    log(state, `${ctx.label} (${trainer.power.text}) Paid ${describePayment(paid)}.`);
    queueStep(state, 'endTurn', { who, passed: false });
    questEvent(state, who, { type: 'power', zone });
    queueEffects(state, ctx, trainer.power.effects);
  },

  // Battle Action: play a Strategy Card from hand, paying its Energy Cost.
  // Its effect resolves, then it goes to the Discard Pile.
  // target: a ref from strategyTargets(), for a card that needs one.
  // growth: for a card that spends Growth (Solar Beam), how much (default: as much as it can).
  playStrategy(state, { who, uid, target, growth }) {
    const p = state.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Strategy') throw new Error('Choose a Strategy Card from your hand');
    if (!playableStrategies(state, who).includes(card)) throw new Error(`${card.name} cannot be played now`);
    const most = card.spendsGrowth ? Math.min(card.spendsGrowth, p.growth ?? 0) : 0;
    if (growth !== undefined && (!Number.isInteger(growth) || growth < 0 || growth > most)) {
      throw new Error(`Spend between 0 and ${most} Growth`);
    }
    const paid = payCost(p, card.energyCost, state.round);
    p.hand = p.hand.filter((c) => c !== card);   // out of hand while it resolves, so a draw can't draw it
    emit(state, 'cardPlayed', { who, card: face(card), uid: card.uid, name: card.name, cardType: card.cardType, to: { kind: 'discard' }, target: info(state, target) });
    log(state, `${p.name} played ${card.name} (${card.effectText}) Paid ${describePayment(paid)}.`);
    queueStep(state, 'endTurn', { who, passed: false });
    queueStep(state, 'discard', { who, card });
    queueEffects(state, { ...strategyCtx(state, who, card, target), ...(card.spendsGrowth ? { growth: growth ?? most } : {}) }, card.effects);
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
    // (A target left out is chosen as the effect resolves: a Gift Bonus's own target, Mallow's heal.)
    if (e && target !== undefined && !candidates(state, ctx, e.target, e).some((r) => sameRef(r, target))) throw new Error('That is not a legal target');

    // Pay: the Supporter leaves the hand while it resolves; cost cards go to their piles first.
    const take = (uids) => uids.map((u) => p.hand.find((c) => c.uid === u));
    const discarded = take(discard);
    const released = take(release);
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c.uid));
    dropXp([...discarded, ...released]);
    p.discard.push(...discarded);
    releaseCards(state, who, released);
    p.supporterRound = state.round;
    for (const c of discarded) emit(state, 'cardMoved', { uid: c.uid, name: c.name, owner: who, to: 'discard' });
    emit(state, 'cardPlayed', {
      who, card: face(card), uid: card.uid, name: card.name, cardType: card.cardType, to: { kind: 'discard' }, target: info(state, target),
      paid: { discard: discarded.map((c) => c.name), release: released.map((c) => c.name) },
      gift: { met, challenge: card.gift.challengeText, bonus: card.gift.bonusText },
    });
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
      emit(state, 'cardMoved', { uid: plain.uid, name: plain.name, owner: who, to: 'discard' });
      log(state, `${p.name} replaced ${old.name} in Zone ${zone + 1}; it goes to the Discard Pile and its quest progress (${progress}/${old.quest.count}) is lost.`);
    }
    p.zones[zone].location = { ...card, progress: 0 };
    emit(state, 'cardPlayed', { who, card: face(card), uid: card.uid, name: card.name, cardType: card.cardType, to: { kind: 'location', owner: who, zone }, replaced: old?.name ?? null });
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
    emit(state, 'xpLocked', { who });
    if (PLAYERS.every((w) => state.players[w].xpChoice)) resolveXp(state);
  },

  // Battle Action: Open Bag. Does exactly one of:
  //   { mode: 'buyHand', uid, then: 'use' | 'store', target? }  buy an Item from hand
  //   { mode: 'buyMart', slot }                                buy from the PokéMart (In Delivery)
  //   { mode: 'useBag', uid, target? }                         use an Item from the Bag
  openBag(state, { who, mode, uid, slot, then, target }) {
    const p = state.players[who];
    if (mode === 'buyMart') {
      const item = state.mart.onSale[slot];
      if (!item) throw new Error('Nothing on sale there');
      if (p.dollars < item.cost) throw new Error(`${item.name} costs ${item.cost} PokéDollars`);
      if (p.bag.length >= BAG_SIZE) throw new Error('Your Bag is full');
      p.dollars -= item.cost;
      state.mart.onSale[slot] = null;
      p.bag.push({ ...item, inDelivery: true });
      emit(state, 'itemBought', { who, uid: item.uid, name: item.name, cost: item.cost, from: 'mart', slot });
      log(state, `${p.name} bought ${item.name} from the PokéMart for ${item.cost} PokéDollars (now ${p.dollars}). It is In Delivery until the next Breakfast.`);
    } else if (mode === 'buyHand') {
      const item = p.hand.find((c) => c.uid === uid);
      if (!item || item.cardType !== 'Item') throw new Error('Choose an Item Card from your hand');
      if (p.dollars < item.cost) throw new Error(`${item.name} costs ${item.cost} PokéDollars`);
      if (then === 'store' && p.bag.length >= BAG_SIZE) throw new Error('Your Bag is full');
      if (then === 'use') checkItemTarget(state, who, item, target);
      else if (then !== 'store') throw new Error('Use the Item now or store it in your Bag');
      p.dollars -= item.cost;
      p.hand = p.hand.filter((c) => c !== item);
      emit(state, 'cardPlayed', { who, card: face(item), uid: item.uid, name: item.name, cardType: item.cardType, cost: item.cost, to: { kind: then === 'store' ? 'bag' : 'use' }, target: info(state, target) });
      log(state, `${p.name} bought ${item.name} from ${yourOf(who)} hand for ${item.cost} PokéDollars (now ${p.dollars}).`);
      if (then === 'store') {
        p.bag.push({ ...item, inDelivery: false });
        log(state, `${p.name} stored ${item.name} in ${yourOf(who)} Bag.`);
      } else {
        useItem(state, who, item, target);
        return;
      }
    } else if (mode === 'useBag') {
      const item = p.bag.find((i) => i.uid === uid);
      if (!item) throw new Error('Choose an Item in your Bag');
      if (item.inDelivery) throw new Error(`${item.name} is still In Delivery`);
      checkItemTarget(state, who, item, target);
      p.bag = p.bag.filter((i) => i !== item);
      emit(state, 'itemUsed', { who, uid: item.uid, name: item.name, from: 'bag', target: info(state, target) });
      useItem(state, who, item, target);
      return;
    } else {
      throw new Error('Open Bag: buy from hand, buy from the PokéMart, or use from the Bag');
    }
    queueStep(state, 'endTurn', { who, passed: false });
  },

  // Answers state.pending, then resolving carries on.
  //   freeSummon: { zone, space } to summon, or no zone to keep the card in hand
  //   target:     { target } — one of state.pending.options
  resolveChoice(state, { zone, space, target, uids }) {
    const pending = state.pending;
    const job = state.stack.at(-1);
    if (pending.kind === 'pick') {
      const chosen = [...new Set(uids ?? [])];
      if (chosen.some((u) => !pending.options.includes(u))) throw new Error('Choose from the matching cards');
      if (chosen.length < pending.min || chosen.length > pending.max) {
        throw new Error(pending.min === pending.max ? `Choose ${pending.max} card${pending.max === 1 ? '' : 's'}` : `Choose up to ${pending.max} card${pending.max === 1 ? '' : 's'}`);
      }
      job.choice = { uids: chosen };
      emit(state, 'choiceMade', { who: pending.who, kind: 'pick', from: pending.from, source: pending.label, count: chosen.length });
    } else if (pending.kind === 'freeSummon') {
      job.choice = { zone, space };
      const card = state.players[pending.who].hand.find((c) => c.uid === pending.uid);
      emit(state, 'choiceMade', { who: pending.who, kind: 'freeSummon', source: pending.label, uid: card.uid, name: card.name, summon: zone !== undefined && zone !== null, zone, space });
    } else if (pending.kind === 'target') {
      if (!target || !pending.options.some((r) => sameRef(r, target))) throw new Error('That is not a legal target');
      job.ctx.target = target;
      emit(state, 'choiceMade', { who: pending.who, kind: 'target', source: pending.label, target: info(state, target) });
    }
    state.pending = null;
  },

  // A Battle turn's Action. The Phase ends when both players pass in a row;
  // any other Pass gains +1 Base Energy for this Round (it can go above 10).
  pass(state, { who }) {
    const p = state.players[who];
    const ends = passEndsPhase(state);
    const spends = passSpends(state, who);
    emit(state, 'pass', { who, endsPhase: ends, gain: ends ? 0 : PASS_ENERGY, spends });
    if (ends) {
      log(state, `${p.name} ${verbFor(who, 'pass', 'passes')}: No Energy: ${youOf(opponentOf(who))} passed last.`);
    } else {
      p.baseEnergy += PASS_ENERGY;
      emit(state, 'energyGained', { who, amount: PASS_ENERGY, source: 'Pass' });
      log(state, `${p.name} ${verbFor(who, 'pass', 'passes')}: +${PASS_ENERGY} Base Energy (now ${p.baseEnergy}).`);
      // Unmatched speed: their Active Pokémon at the top Speed-Tier become Spent (Alert is worked out afresh).
      if (spends.length) {
        for (const ref of spends) cardAt(state, ref).spent = true;
        emit(state, 'spentByPass', { who, targets: spends });
        log(state, `Unmatched speed: ${spends.map((r) => describeRef(state, r)).join(', ')} ${spends.length === 1 ? 'becomes' : 'become'} Spent.`);
      }
    }
    endTurn(state, who, true);
  },
};

// Passing gains this much Base Energy, unless it is the Pass that ends the phase.
export const PASS_ENERGY = 1;

// Whether a Pass now would be the second of two consecutive Passes (and so
// end the Battle Phase, gaining nothing).
export function passEndsPhase(state) {
  return state.passesInARow >= 1;
}

// Every Action type, for tests and tools.
export const ACTION_TYPES = Object.keys(HANDLERS);

function endTurn(state, who, passed) {
  state.passesInARow = passed ? state.passesInARow + 1 : 0;
  if (state.passesInARow >= 2) {
    log(state, 'Both players passed in a row. Battle Phase ends.');
    startSupper(state);
  } else {
    state.turn = opponentOf(who);
    emit(state, 'turnChanged', { who: state.turn });
  }
}

function revealTrainers(state) {
  for (const who of PLAYERS) {
    const p = state.players[who];
    p.pending.forEach((uid, zone) => {
      p.zones[zone].trainer = p.trainers.find((t) => t.uid === uid);
    });
    p.pending = null;
    emit(state, 'trainersRevealed', { who, trainers: p.zones.map((z, zone) => ({ zone, uid: z.trainer.uid, name: z.trainer.name })) });
    const names = p.zones.map((z, i) => `Zone ${i + 1}: ${z.trainer.name}`).join(', ');
    log(state, `${p.name} revealed Trainers. ${names}.`);
  }
  state.phase = 'initiative';
  emit(state, 'phaseChanged', { phase: 'initiative', round: 0 });
  log(state, 'Flip a coin to decide initiative for Round 1.');
}

function startRound(state, round) {
  state.round = round;
  if (round > 1) state.initiative = opponentOf(state.initiative);
  emit(state, 'roundStarted', { round, initiative: state.initiative });
  log(state, `— Round ${round} — ${state.players[state.initiative].name} ${verbFor(state.initiative, 'have', 'has')} initiative.`);
  startBreakfast(state);
}

// Each Breakfast: unsold stock goes back into the PokéMart deck, which is
// shuffled, and up to 3 new Items go on sale.
function restockMart(state) {
  const mart = state.mart;
  mart.deck.push(...mart.onSale.filter(Boolean));
  shuffle(state, mart.deck);
  mart.onSale = [0, 1, 2].map(() => mart.deck.shift() ?? null);
  emit(state, 'martRestocked', { onSale: mart.onSale.map((i) => i?.uid ?? null) });
  const shown = mart.onSale.filter(Boolean).map((i) => `${i.name} ($${i.cost})`);
  log(state, `PokéMart restocked: ${shown.length ? shown.join(', ') : 'nothing left to sell'}.`);
}

export const BREAKFAST_DOLLARS = 1;

function startBreakfast(state) {
  state.phase = 'breakfast';
  emit(state, 'phaseChanged', { phase: 'breakfast', round: state.round });
  log(state, 'Breakfast Phase.');
  // +1 PokéDollar for each player, every Breakfast (Round 1 included).
  for (const who of PLAYERS) earnDollars(state, who, BREAKFAST_DOLLARS, 'at Breakfast');
  restockMart(state);
  for (const who of PLAYERS) {
    const arrived = state.players[who].bag.filter((i) => i.inDelivery);
    arrived.forEach((i) => { i.inDelivery = false; });
    if (arrived.length) log(state, `${state.players[who].name}: ${arrived.map((i) => i.name).join(', ')} arrived in the Bag.`);
  }
  for (const who of PLAYERS) {
    const p = state.players[who];
    const recovered = refreshEnergy(p, state.round);
    if (recovered.length) {
      log(state, `${p.name} recovered ${recovered.length} Exhaust point${recovered.length === 1 ? '' : 's'} into Exert.`);
    }
    log(state, `${p.name}: ${p.baseEnergy} Base Energy, Exert ${p.exertMax - p.exhaust.length}/${p.exertMax}.`);
    // An Asleep Pokémon stays Spent this Breakfast, then wakes (it missed one Round).
    const sleepers = [];
    p.zones.forEach((z, zone) => z.pokemon.forEach((c, space) => { if (c?.status?.sleep) sleepers.push({ kind: 'pokemon', owner: who, zone, space, uid: c.uid }); }));
    const readied = p.zones.flatMap((z) => z.pokemon).filter((c) => c?.spent && !c.status?.sleep);
    readied.forEach((c) => { c.spent = false; });
    for (const ref of sleepers) clearStatus(state, ref, 'sleep', 'wakes up at Breakfast, still Spent this Round');
    for (const c of readied) emit(state, 'ready', { target: { owner: who, uid: c.uid, name: c.name } });
    if (readied.length) log(state, `${whose(state, who)} Spent Pokémon became Active: ${readied.map((c) => c.name).join(', ')}.`);
    const n = draw(state, who, HAND_SIZE).length;
    log(state, `${p.name} drew ${n} card${n === 1 ? '' : 's'}.`);
  }
  // On Breakfast (and Regenerate): after cards are drawn and Energy is gained.
  queueStep(state, 'afterBreakfast');
  queueStep(state, 'breakfastAbilities');
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
    emit(state, 'xpSpent', { who, total: spend.length, parts: Object.entries(per).map(([name, b]) => ({ name, ...b })) });
    const parts = Object.entries(per).map(([name, b]) =>
      `${name} ${[b.attack && `+${b.attack} Attack`, b.strength && `+${b.strength} Strength`].filter(Boolean).join(', ')}`);
    const totals = ['attack', 'strength'].map((k) => [k, spend.filter((x) => x.stat === k).length]).filter(([, n]) => n)
      .map(([k, n]) => `+${n} ${k === 'attack' ? 'Attack' : 'Strength'}`).join(', ');
    log(state, `${p.name} spent ${spend.length} XP${secretOf(who, `: ${parts.join('; ')}`, ` on Pokémon in hand (${totals})`)} (${p.xp} XP left).`);
  }
  state.xpStep = false;
  endBreakfast(state);
}

function resolveMulligans(state) {
  for (const who of PLAYERS) {
    const p = state.players[who];
    const chosen = p.pending;
    p.pending = null;
    const out = p.hand.filter((c) => chosen.includes(c.uid));
    for (const c of out) emit(state, 'cardMoved', { uid: c.uid, name: c.name, owner: who, to: 'discard' });
    emit(state, 'mulligan', { who, count: chosen.length });
    p.discard.push(...out);
    p.hand = p.hand.filter((c) => !chosen.includes(c.uid));
    draw(state, who, chosen.length);
    log(state, chosen.length
      ? `${p.name} mulliganed ${chosen.length} card${chosen.length === 1 ? '' : 's'}.`
      : `${p.name} kept ${yourOf(who)} hand.`);
  }
  startXpStep(state);
}

function startBattle(state) {
  state.phase = 'battle';
  state.turn = state.initiative;
  emit(state, 'phaseChanged', { phase: 'battle', round: state.round, turn: state.turn });
  state.passesInARow = 0;
  log(state, `Battle Phase. ${state.players[state.initiative].name} ${verbFor(state.initiative, 'act', 'acts')} first.`);
}

function startSupper(state) {
  state.phase = 'supper';
  state.turn = null;
  emit(state, 'phaseChanged', { phase: 'supper', round: state.round });
  log(state, 'Supper Phase.');
  // Weather → Burn → Leech Seed → On Supper → "this Round" effects expire → hands discarded.
  queueStep(state, 'supperDiscard');
  queueStep(state, 'expireRound');
  queueStep(state, 'supperQuests');
  queueStep(state, 'supperAbilities');
  queueStep(state, 'leechSeed');
  queueStep(state, 'burn');
  queueWeather(state, 'supper');      // on top: Weather first
}
