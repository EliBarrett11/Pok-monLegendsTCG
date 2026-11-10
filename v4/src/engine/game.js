// The v4 engine (F1 of 5: the core). docs/v4-foundation-spec.md is the spec (section 16 first).
// Pure: no DOM. applyAction(state, action) returns a new state, with `events` saying what happened.
//
// The battlefield: 9 lanes; each lane has one space per player, facing each other. Lanes not
// covered by a placed Location are the Default Location. F2: Location Cards are placed (no Energy)
// over 2–4 adjacent free lanes on both sides for a set number of Rounds; each has a passive on the
// Pokémon in it and Weather counters of one type; Weather counts combine across placed Locations
// into brackets for both players; at Supper the player with more total Strength in a Location
// dominates it and earns Recognition.
// F3: Command Cards (Adapt now; React in response to an opponent's attack, Adapt or resolving Strat,
// before it resolves; Strat after the opponent's next turn) and Supporters (Release cards from hand
// permanently; an optional Favour). G1: attacks and Adapts are committed first, and a Strat opens a
// window as it resolves: if the opponent has an affordable React, a React window opens
// (s.reactWindow) and the action resolves after it (it may fizzle). Summons resolve at once. Pending
// Strats are in s.strats.
// F4: PokéDollars ($1 each Breakfast; G1: $1 for each enemy Pokémon defeated), Items (bought from
// hand or the PokéMart's one Item with its Stock, then used at once or stored in the Bag; Held or Consumed),
// and Trainers. UX1 (Elliott's rule): each Trainer card in a deck has an Objective tracker in its
// player's Trainer area from match setup (active from Round 1, free, progress 0). A drawn Trainer is
// played only as its Trainer Command and keeps cycling; when its Objective completes, the card is
// taken from wherever it is and leaves the deck for good, and its Partner arrives.
// F5: the Pokémon League Tournament (s.tournament): from a Breakfast (Round 10, or once either
// player has 70+ Recognition), it replaces every placed Location and covers all 9 lanes: no
// Location passives or Weather, no new Locations; all Recognition earned is increased by half
// (rounded up); at each Supper the player with more total Strength on the battlefield dominates it.
// The Player Character sits outside the battlefield: no Health, no space; damage to it gives the
// attacker's player Recognition. 100 Recognition wins.
//
// A Round: Breakfast (Exhaust recovers, Base Energy = the Round (max 10), Exert maximum grows,
// Spent Pokémon become Active, cards off the battlefield follow the Round's Level, draw 7 less one
// per Retained card; Round 1: draw 7 then a mulligan, as in v1), Battle (alternating turns, one
// action each: Summon, Attack, Retain, Pass; two Passes in a row end it), Supper (the hand is
// discarded except Retained cards). Initiative switches each Round.
import { RULES, SPEEDS, levelFor } from '../rules.js?v=202611101304';
import { nextRandom, shuffle } from './random.js?v=202611101304';
import { newEnergy, refreshEnergy, canPay, payCost, availableExert } from './energy.js?v=202611101304';
import { DEMO_DECK, cardAtRound, pokemonAt, pathDef, locationDef, WEATHER_BRACKETS, FAVOURS, MODE_NAMES, ITEMS, BAG_SIZE, TRIGGER_NAMES, opText, CHOSEN } from './cards.js?v=202611101304';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'The Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');
const POSS = { player: 'Your', ai: 'The Opponent\'s' };

// --- Setup ---------------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: DEMO_DECK, ai: DEMO_DECK } } = {}) {
  const s = {
    seed, rng: seed >>> 0, round: 1, phase: 'mulligan', turn: null, initiative: null, passesInARow: 0,
    players: {}, locations: [], strats: [], reactWindow: null, choice: null, mart: { pool: [], onSale: [null], stock: 0, soldOut: null }, tournament: null, winner: null, result: null, log: [], events: [],
  };
  for (const who of PLAYERS) {
    s.players[who] = {
      drawPile: shuffle(s, decks[who].map((id, i) => ({ ...cardAtRound(id, 1), uid: `${who}-${i}` }))),
      hand: [], discard: [], released: [], row: Array(RULES.lanes).fill(null),
      ...newEnergy(), recognition: 0, retainedNext: 0, mulliganed: false,
      dollars: 0, bag: [], trainers: [], waiting: [],
    };
    // UX1: one Objective tracker per Trainer card in the deck, active from Round 1, linked to its uid.
    for (const c of s.players[who].drawPile.filter((x) => x.cardType === 'Trainer')) {
      s.players[who].trainers.push({ uid: `trainer-${c.uid}`, cardUid: c.uid, card: structuredClone(c), name: c.name, objective: c.objective, progress: 0, complete: false, startedRound: 1 });
    }
  }
  // The PokéMart (F4): one shared pool with one copy of each Item.
  s.mart.pool = ITEMS.map((c) => ({ ...structuredClone(c), uid: `mart-${c.id}` }));
  s.initiative = nextRandom(s) < 0.5 ? 'player' : 'ai';
  for (const who of PLAYERS) {
    refreshEnergy(s.players[who], 1);
    s.players[who].dollars += RULES.dollarsPerRound;
    draw(s, who, RULES.handDraw);
  }
  stockMart(s, 'start');
  log(s, `Round 1 · Breakfast. Each player draws ${RULES.handDraw}; ${NAMES[s.initiative]} ${s.initiative === 'player' ? 'have' : 'has'} initiative. Mulligan: put any cards back and draw as many.`);
  return s;
}

// --- Reading the state -------------------------------------------------------------------------------

// The Location of a lane: a placed Location, or the Default Location (one Location, F1).
export const locationOf = (s, lane) => (s.tournament ? 'tournament' : null) ?? s.locations.find((l) => lane >= l.start && lane < l.start + l.width)?.uid ?? 'default';
export const locationAt = (s, lane) => s.locations.find((l) => lane >= l.start && lane < l.start + l.width) ?? null;
export const lanesOf = (l) => Array.from({ length: l.width }, (_, i) => l.start + i);
// The lanes a Location of this width could start at: every lane it covers is free (adapted from
// v2's locationStarts).
export function locationStarts(s, card) {
  const out = [];
  if (s.tournament) return out;   // F5: no Locations during the Tournament
  for (let start = 0; start + card.width <= RULES.lanes; start++) {
    if (lanesOf({ start, width: card.width }).every((lane) => !locationAt(s, lane))) out.push(start);
  }
  return out;
}
export const placeable = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Location' && locationStarts(s, c).length);
// Weather: the combined counts per type, and the brackets reached.
export function weatherTotals(s) {
  const t = { Rain: 0, Sun: 0 };
  for (const l of s.locations) t[l.weather.type] += l.weather.count;
  return t;
}
export const activeBrackets = (s) => { const t = weatherTotals(s); return WEATHER_BRACKETS.filter((b) => t[b.type] >= b.at); };
// Dominance: the player with the greater total current Strength in a Location (null on a tie).
export function strengthIn(s, l, who) { return lanesOf(l).reduce((n, i) => n + (s.players[who].row[i]?.currentStrength ?? 0), 0); }
// F5: the Tournament's dominance: total current Strength across the whole battlefield (null on a tie).
export function tournamentStrength(s, who) { return pokemonOf(s, who).reduce((n, { card }) => n + card.currentStrength, 0); }
export function tournamentDominant(s) {
  const a = tournamentStrength(s, 'player');
  const b = tournamentStrength(s, 'ai');
  return a > b ? 'player' : b > a ? 'ai' : null;
}
// F5: Recognition during the Tournament is increased by half, rounded up (3 → 5).
export const boosted = (s, amount) => (s.tournament ? amount + Math.ceil(amount / 2) : amount);
export function dominantOf(s, l) {
  const a = strengthIn(s, l, 'player');
  const b = strengthIn(s, l, 'ai');
  return a > b ? 'player' : b > a ? 'ai' : null;
}
// The cost to summon a card into a space (Route 119's discount).
export function summonCost(s, card, space) {
  const l = space === undefined ? null : locationAt(s, space);
  return Math.max(0, card.cost - (l?.passive.kind === 'discount' ? l.passive.amount : 0));
}
const cheapest = (s, who, card) => Math.min(...emptySpaces(s, who).map((i) => summonCost(s, card, i)));

export const pokemonOf = (s, who) => s.players[who].row.map((card, space) => (card ? { card, space } : null)).filter(Boolean);
const allPokemon = (s) => PLAYERS.flatMap((who) => pokemonOf(s, who).map((p) => ({ ...p, who })));
const speedRank = (card) => SPEEDS.indexOf(card.speed);

// Ready (as in v3): Active, and of the highest Speed among all Active Pokémon on both sides.
export const topSpeed = (s) => Math.max(-1, ...allPokemon(s).filter(({ card }) => !card.spent).map(({ card }) => speedRank(card)));
export const isReady = (s, card) => !!card && !card.spent && speedRank(card) === topSpeed(s);
export const readySpaces = (s, who) => pokemonOf(s, who).filter(({ card }) => isReady(s, card)).map(({ space }) => space);

// Guards (section 16): a Defence Pokémon protects the other Pokémon of its side in the same
// Location (the Default Location counts as one) from Physical attacks, wherever the attacker is:
// a Physical attack on a protected Pokémon must target the guard instead. Special Defence does the
// same against Special attacks. A guard also protects its Player Character from attacks (of the
// matching kind) by Pokémon in the guard's own Location.
const guardFor = (attackType) => (attackType === 'Physical' ? 'Defence' : 'Special Defence');
export function guardOf(s, foe, space, attackType) {
  const kind = guardFor(attackType);
  if (s.players[foe].row[space]?.strengthType === kind) return null;
  const loc = locationOf(s, space);
  const g = pokemonOf(s, foe).find(({ card, space: i }) => i !== space && card.strengthType === kind && locationOf(s, i) === loc);
  return g ?? null;
}
export function playerGuard(s, who, from, foe) {
  const a = s.players[who].row[from];
  const loc = locationOf(s, from);
  return pokemonOf(s, foe).find(({ card, space }) => card.strengthType === guardFor(a.attackType) && locationOf(s, space) === loc) ?? null;
}
export function legalTargets(s, who, from) {
  const a = s.players[who].row[from];
  if (!a) return [];
  const foe = opponentOf(who);
  // G2: Infiltrator: its attacks ignore guards (Pokémon and Player Character).
  const inf = hasKw(a, 'infiltrator');
  const out = pokemonOf(s, foe).filter(({ space }) => inf || !guardOf(s, foe, space, a.attackType)).map(({ space }) => ({ kind: 'pokemon', space }));
  if (inf || !playerGuard(s, who, from, foe)) out.push({ kind: 'player' });
  return out;
}
export const attackers = (s, who) => readySpaces(s, who).filter((sp) => legalTargets(s, who, sp).length);

export const emptySpaces = (s, who) => s.players[who].row.map((c, i) => (c ? null : i)).filter((i) => i !== null);
export const summonable = (s, who) => (emptySpaces(s, who).length ? s.players[who].hand.filter((c) => c.cardType === 'Pokémon' && canPay(s.players[who], cheapest(s, who, c))) : []);
export const retainable = (s, who) => (canPay(s.players[who], RULES.retainCost) ? s.players[who].hand.filter((c) => !c.retained) : []);
export const energyLeft = (p) => p.baseEnergy + availableExert(p);

// --- Command Cards and Supporters (F3) ---
// A Command's targets: { who, space } of a Pokémon (an enemy one or one of yours, per card).
export function commandTargets(s, who, card) {
  const side = card.target === 'enemy' ? opponentOf(who) : who;
  return pokemonOf(s, side).map(({ space }) => ({ who: side, space }));
}
export const canCommand = (s, who, card, mode) => card.cardType === 'Command' && canPay(s.players[who], card.modes[mode].cost) && commandTargets(s, who, card).length > 0;
export const playableCommands = (s, who, mode) => s.players[who].hand.filter((c) => canCommand(s, who, c, mode));
// React: only the other player, only during a React window opened by an eligible action.
export const reactOptions = (s, who) => playableCommands(s, who, 'react');
// Supporters: enough other cards in hand to Release (adapted from v2's supporterPlayable).
export const supporterPlayable = (s, who, card) => card.cardType === 'Supporter' && s.players[who].hand.length - 1 >= card.release;
export const playableSupporters = (s, who) => s.players[who].hand.filter((c) => supporterPlayable(s, who, c));
// The Favour: met if a Released card meets the Supporter's condition (copied from v2's favourMet).
export const favourMet = (card, released) => !!card.favour && released.some((c) => FAVOURS[card.favour.condition].test(c));

// G1 (gameplay update 2.1): Ready Pokémon with unmatched Speed: yours are the fastest Active Pokémon
// and the opponent has no Active Pokémon of the same Speed.
export const passEndsPhase = (s) => s.passesInARow >= 1;
export function unmatchedReady(s, who) {
  if (s.phase !== 'battle') return [];
  const top = topSpeed(s);
  if (top < 0) return [];
  const atTop = allPokemon(s).filter(({ card }) => !card.spent && speedRank(card) === top);
  if (atTop.some((p) => p.who !== who)) return [];
  return atTop.map(({ space }) => space);
}
// You can't Pass while an unmatched Ready Pokémon of yours has a legal target: attack with it (or take
// another action) first. If none of them has a target, you may Pass and they become Spent (as before).
// (targetsOf is the target check, replaceable only so tests can stage the no-target case: with today's
// guards a guard is itself always a legal target, so it can't arise in play.)
export const passBlockers = (s, who, targetsOf = legalTargets) => unmatchedReady(s, who).filter((sp) => targetsOf(s, who, sp).length);
export function passReason(s, who, targetsOf = legalTargets) {
  const b = passBlockers(s, who, targetsOf);
  if (!b.length) return null;
  const names = b.map((sp) => s.players[who].row[sp].name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? 'is' : 'are'} Ready and faster than anything ${who === 'player' ? 'the Opponent has' : 'you have'}: attack first`;
}
// Passing (when allowed) makes unmatched Ready Pokémon Spent; not the Pass that ends the Battle Phase.
export function passSpends(s, who) {
  if (s.phase !== 'battle' || passEndsPhase(s)) return [];
  return unmatchedReady(s, who);
}

// --- Items, the Bag and the PokéMart (F4) ---
// An Item's targets: your Pokémon in play (for a Held Item, one not already holding an Item).
export const itemTargets = (s, who, item) => pokemonOf(s, who).filter(({ card }) => item.itemType !== 'Held' || !card.held).map(({ space }) => ({ who, space }));
// Why an Item can't be bought now to use ('use') or store ('store'); with no `then`, either way.
export function buyReason(s, who, item, then) {
  const p = s.players[who];
  if (p.dollars < item.price) return `Costs $${item.price} · you have $${p.dollars}`;
  if (then === 'store') return p.bag.length >= BAG_SIZE ? `Your Bag is full (${BAG_SIZE})` : null;
  if (then === 'use') return itemTargets(s, who, item).length ? null : item.itemType === 'Held' ? 'No Pokémon of yours without a Held Item' : 'No Pokémon of yours to use it on';
  const use = buyReason(s, who, item, 'use');
  const store = buyReason(s, who, item, 'store');
  return use && store ? `${use}; ${store}` : null;
}
export const buyableFromHand = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Item' && !buyReason(s, who, c));
export const buyableFromMart = (s, who) => s.mart.onSale.map((c, slot) => (c && !buyReason(s, who, c) ? slot : null)).filter((x) => x !== null);
export const usableFromBag = (s, who) => s.players[who].bag.filter((c) => itemTargets(s, who, c).length);
// Trainers: why a Trainer in hand can't be played as its Trainer Command now (UX1: a Trainer card is
// only ever played as its Command; its Objective is tracked from match setup).
export function trainerReason(s, who, card) {
  const p = s.players[who];
  const cost = card.command.cost;
  if (!canPay(p, cost)) return `Trainer Command needs ${cost} Energy · you have ${energyLeft(p)}`;
  if (card.command.ops.some((o) => o.op === 'damageAll') && !pokemonOf(s, opponentOf(who)).length) return 'No enemy Pokémon';
  return null;
}
export const playableTrainers = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Trainer' && !trainerReason(s, who, c));

// UX1: the modes to show for a Command card in hand, by situation (for the hand, the click menu and
// the AI). On your own turn: Adapt (with its reason when it isn't playable), plus Strat only if you can
// afford it. In a React window where you're the reactor: React only, if affordable with a target.
// Otherwise none. Each: { mode, cost, reason }. The engine's legality checks don't depend on this.
export function commandModesFor(s, who, uid) {
  const card = s.players[who].hand.find((c) => c.uid === uid);
  if (!card || card.cardType !== 'Command' || s.phase !== 'battle') return [];
  const entry = (mode) => ({ mode, cost: card.modes[mode].cost, reason: whyNot(s, who, mode === 'react' ? 'react' : 'command', card, mode) });
  if (s.reactWindow) {
    if (s.reactWindow.reactor !== who) return [];
    const r = entry('react');
    return r.reason ? [] : [r];
  }
  if (s.turn !== who) return [];
  const out = [entry('adapt')];
  if (canPay(s.players[who], card.modes.strat.cost)) out.push(entry('strat'));
  return out;
}

// Why an action can't be taken now (null when it can). For the interface.
export function whyNot(s, who, action, card, mode) {
  const p = s.players[who];
  if (action === 'react') {
    if (!s.reactWindow || s.reactWindow.reactor !== who) return 'React only in response to an opponent\'s attack, Adapt or resolving Strat';
    mode = 'react';
    action = 'command';
  } else {
    if (s.reactWindow) return s.reactWindow.reactor === who ? 'React or let it happen first' : 'Waiting for the other player\'s React';
    if (s.phase !== 'battle' || s.turn !== who) return 'Not your turn';
  }
  switch (action) {
    case 'command': {
      if (mode === 'react' && !s.reactWindow) return 'React only in response to an opponent\'s attack, Adapt or resolving Strat';
      const cost = card.modes[mode].cost;
      if (!canPay(p, cost)) return `${MODE_NAMES[mode]} needs ${cost} Energy · you have ${energyLeft(p)}`;
      if (!commandTargets(s, who, card).length) return card.target === 'enemy' ? 'No target: no enemy Pokémon' : 'No target: none of your Pokémon';
      return null;
    }
    case 'buyItem': return buyReason(s, who, card, mode);
    case 'useItem': return itemTargets(s, who, card).length ? null : card.itemType === 'Held' ? 'No Pokémon of yours without a Held Item' : 'No Pokémon of yours to use it on';
    case 'trainerCommand': return trainerReason(s, who, card);
    case 'supporter':
      return supporterPlayable(s, who, card) ? null : `Needs ${card.release} other card${card.release === 1 ? '' : 's'} in hand to Release`;
    case 'summon':
      if (card.cardType === 'Location') return s.tournament ? 'No Locations during the Pokémon League Tournament' : locationStarts(s, card).length ? null : `No room: needs ${card.width} adjacent free lanes`;
      if (!emptySpaces(s, who).length) return 'No empty space on your side';
      return canPay(p, cheapest(s, who, card)) ? null : `Needs ${cheapest(s, who, card)} Energy · you have ${energyLeft(p)}`;
    case 'retain':
      if (card?.retained) return 'Already Retained';
      return canPay(p, RULES.retainCost) ? null : `Needs ${RULES.retainCost} Energy · you have 0`;
    case 'attack':
      if (!pokemonOf(s, who).length) return 'No Pokémon in play';
      if (!readySpaces(s, who).length) return 'None of your Pokémon is Ready (only the fastest Active Pokémon on the battlefield are)';
      return attackers(s, who).length ? null : 'No legal target';
    default: return null;
  }
}

// Can this hand card be played now in some way? null, or the reason (for the interface and AI).
export function playReason(s, who, card) {
  if (card.cardType === 'Command') {
    const adapt = whyNot(s, who, 'command', card, 'adapt');
    return adapt && whyNot(s, who, 'command', card, 'strat') ? adapt : null;
  }
  if (card.cardType === 'Item') return whyNot(s, who, 'buyItem', card);
  if (card.cardType === 'Trainer') return whyNot(s, who, 'trainerCommand', card);
  return whyNot(s, who, card.cardType === 'Supporter' ? 'supporter' : 'summon', card);
}

export function legalActions(s, who) {
  if (s.phase === 'gameOver') return [];
  if (s.phase === 'mulligan') return s.players[who].mulliganed ? [] : ['mulligan'];
  // G2: a chosen-target On Summon waits for its target (the summoner's choice; it can't be cancelled).
  if (s.choice) return s.choice.who === who ? ['choose'] : [];
  if (s.reactWindow) return s.reactWindow.reactor === who ? ['decline', ...(reactOptions(s, who).length ? ['react'] : [])] : [];
  if (s.phase !== 'battle' || s.turn !== who) return [];
  return [...(passReason(s, who) ? [] : ['pass']), ...(summonable(s, who).length ? ['summon'] : []), ...(placeable(s, who).length ? ['placeLocation'] : []),
    ...(playableCommands(s, who, 'adapt').length || playableCommands(s, who, 'strat').length ? ['command'] : []),
    ...(playableSupporters(s, who).length ? ['supporter'] : []),
    ...(buyableFromHand(s, who).length || buyableFromMart(s, who).length ? ['buyItem'] : []),
    ...(usableFromBag(s, who).length ? ['useItem'] : []),
    ...(playableTrainers(s, who).length ? ['trainerCommand'] : []), ...(attackers(s, who).length ? ['attack'] : []), ...(retainable(s, who).length ? ['retain'] : [])];
}
export function actor(s) {
  if (s.phase === 'mulligan') return PLAYERS.find((w) => !s.players[w].mulliganed) ?? null;
  if (s.choice) return s.choice.who;
  if (s.reactWindow) return s.reactWindow.reactor;
  return s.phase === 'battle' ? s.turn : null;
}

// --- Actions -----------------------------------------------------------------------------------------

export function applyAction(state, action) {
  const s = structuredClone(state);
  s.events = [];
  if (!legalActions(s, action.who).includes(action.type)) throw new Error(`${action.who} cannot ${action.type} now`);
  ACTIONS[action.type](s, action);
  partnersArrive(s);
  syncBonuses(s);
  return s;
}

const ACTIONS = {
  // Round 1 (v1): put any number of cards from your hand into your Discard Pile, then draw as many.
  mulligan(s, { who, cards = [] }) {
    const p = s.players[who];
    const back = p.hand.filter((c) => cards.includes(c.uid));
    p.hand = p.hand.filter((c) => !back.includes(c));
    p.discard.push(...back);
    draw(s, who, back.length);
    p.mulliganed = true;
    if (back.length) log(s, `${NAMES[who]} mulliganed ${back.length} card${back.length === 1 ? '' : 's'}.`);
    if (PLAYERS.every((w) => s.players[w].mulliganed)) beginBattle(s);
  },

  // Summon a Pokémon from hand into an empty space on your side, paying its cost at its Level now.
  // It's a snapshot: on the battlefield its Level, form and stats stay as they were. Arrives Spent.
  summon(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!(space >= 0 && space < RULES.lanes) || p.row[space]) throw new Error('Choose an empty space on your side');
    const cost = summonCost(s, card, space);
    if (!canPay(p, cost)) throw new Error(`${card.name} costs ${cost} Energy`);
    const paid = payCost(p, cost, s.round);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...snap } = card;
    log(s, `${NAMES[who]} summoned ${card.name} (Level ${card.level}) into lane ${space + 1} for ${cost} Energy${paid.fromExert ? ` (${paid.fromExert} Exert)` : ''}.`);
    commit(s, { type: 'summon', who, card: snap, space, cost, text: `${NAMES[who]} ${who === 'player' ? 'are' : 'is'} summoning ${card.name} (Level ${card.level}) into lane ${space + 1}` });
  },

  // Play a Command Card (F3): Adapt (committed now, so the opponent may React) or Strat (paid and
  // targeted now; it resolves after the opponent's next turn). React is its own action, below.
  command(s, { who, uid, mode, target }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Command') throw new Error('Choose a Command Card from your hand');
    if (!['adapt', 'strat'].includes(mode)) throw new Error(mode === 'react' ? 'React only in response to an opponent\'s action' : 'Choose Adapt or Strat');
    const why = whyNot(s, who, 'command', card, mode);
    if (why) throw new Error(`${card.name}: ${why}`);
    const t = checkTarget(s, who, card, target);
    const { cost } = card.modes[mode];
    payCost(p, cost, s.round);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...plain } = card;
    const on = s.players[t.who].row[t.space];
    if (mode === 'strat') {
      s.strats.push({ uid: `strat-${uid}`, owner: who, card: plain, target: t, targetName: on.name, playedRound: s.round });
      emit(s, 'strat', { who, id: card.id, name: card.name, uid: `strat-${uid}`, target: t });
      log(s, `${NAMES[who]} played ${card.name} as a Strat (${cost} Energy) on ${on.name}: it resolves after ${who === 'player' ? 'the Opponent\'s' : 'your'} next turn.`);
      return endTurn(s, who, false);
    }
    log(s, `${NAMES[who]} played ${card.name} (Adapt, ${cost} Energy) on ${on.name}.`);
    commit(s, { type: 'command', who, card: plain, target: t, text: `${NAMES[who]} ${who === 'player' ? 'are' : 'is'} playing ${card.name} (Adapt: ${cardModeText(card, 'adapt')}) on ${on.name}` });
  },

  // React (F3): during a React window, pay the React cost; its weaker effect resolves now, then the
  // committed action resolves. It doesn't use a turn, and it can't be reacted to (no stack).
  react(s, { who, uid, target }) {
    const w = s.reactWindow;
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Command') throw new Error('Choose a Command Card from your hand');
    const why = whyNot(s, who, 'react', card);
    if (why) throw new Error(`${card.name}: ${why}`);
    const t = checkTarget(s, who, card, target);
    const { cost } = card.modes.react;
    payCost(p, cost, s.round);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...plain } = card;
    emit(s, 'react', { who, id: card.id, name: card.name, uid: card.uid, target: t });
    log(s, `${NAMES[who]} Reacted with ${card.name} (${cost} Energy) on ${s.players[t.who].row[t.space].name}.`);
    applyCommand(s, who, plain, 'react', t);
    p.discard.push(plain);
    s.reactWindow = null;
    drainTriggers(s);
    resolvePending(s, w.pending);
  },

  // G2: the target of a chosen-target On Summon (an enemy Pokémon, or one of yours). The rest of the
  // trigger and any chained triggers resolve; then the turn ends (the summon was its action).
  choose(s, { who, target }) {
    const c = s.choice;
    if (!c.targets.some((t) => t.who === target?.who && t.space === target.space)) throw new Error('Choose one of the glowing targets');
    s.choice = null;
    const src = s.players[c.who].row[c.space];
    const ev = emit(s, 'trigger', { who: c.who, space: c.space, id: src?.id, name: c.name, on: 'summon', text: c.text, chosen: true, target });
    watch(s, ev, () => applyOp(s, { who: c.who, space: c.space, uid: c.uid, card: src, ctx: {} }, c.op, target));
    if (c.rest.length && src) runOps2(s, { who: c.who, space: c.space, uid: c.uid, card: src, ctx: {}, depth: c.depth }, c.rest);
    drainTriggers(s);
    if (s.choice) return;
    endTurn(s, c.who, false);
  },

  // Let it happen: no React; the committed action resolves.
  decline(s, { who }) {
    const w = s.reactWindow;
    s.reactWindow = null;
    emit(s, 'decline', { who });
    resolvePending(s, w.pending);
  },

  // Purchase Item (F4; adapted from v1's Open Bag "buyHand" and "buyMart"): buy an Item from your
  // hand or the PokéMart with PokéDollars, then use it at once ('use', with a target) or store it in
  // your Inventory Bag ('store').
  buyItem(s, { who, from, uid, slot, then, target }) {
    const p = s.players[who];
    const item = from === 'mart' ? s.mart.onSale[slot] : p.hand.find((c) => c.uid === uid && c.cardType === 'Item');
    if (!item) throw new Error(from === 'mart' ? 'Choose an Item for sale in the PokéMart' : 'Choose an Item Card from your hand');
    if (!['use', 'store'].includes(then)) throw new Error('Use the Item now or store it in your Bag');
    const why = buyReason(s, who, item, then);
    if (why) throw new Error(`${item.name}: ${why}`);
    const t = then === 'use' ? checkItemTarget(s, who, item, target) : null;
    p.dollars -= item.price;
    if (from === 'mart') { s.mart.onSale[slot] = null; s.mart.stock = 0; s.mart.soldOut = { by: who, armed: false }; }
    else p.hand = p.hand.filter((c) => c !== item);
    const { retained, ...plain } = item;
    emit(s, 'itemBought', { who, id: item.id, name: item.name, uid: item.uid, slot: from === 'mart' ? slot : null, from: from === 'mart' ? 'mart' : 'hand', then, price: item.price });
    log(s, `${NAMES[who]} bought ${item.name} from ${from === 'mart' ? 'the PokéMart' : `${who === 'player' ? 'your' : 'their'} hand`} for $${item.price} (now $${p.dollars}).`);
    if (then === 'store') {
      p.bag.push(plain);
      log(s, `${NAMES[who]} stored ${item.name} in the Inventory Bag.`);
    } else applyItem(s, who, plain, t);
    endTurn(s, who, false);
  },

  // Play Inventory Item (F4): use an Item from your Bag.
  useItem(s, { who, uid, target }) {
    const p = s.players[who];
    const item = p.bag.find((c) => c.uid === uid);
    if (!item) throw new Error('Choose an Item in your Bag');
    const t = checkItemTarget(s, who, item, target);
    p.bag = p.bag.filter((c) => c !== item);
    applyItem(s, who, item, t);
    endTurn(s, who, false);
  },

  // Trainer Command (F4): pay its Energy; its effect resolves at once; then it's discarded (and keeps
  // cycling through the deck). It doesn't affect the Trainer's Objective.
  trainerCommand(s, { who, uid }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid && c.cardType === 'Trainer');
    if (!card) throw new Error('Choose a Trainer Card from your hand');
    const why = trainerReason(s, who, card);
    if (why) throw new Error(`${card.name}: ${why}`);
    payCost(p, card.command.cost, s.round);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...plain } = card;
    const ev = emit(s, 'trainerCommand', { who, id: card.id, name: card.name });
    log(s, `${NAMES[who]} played ${card.name} as a Trainer Command (${card.command.cost} Energy): ${card.command.text}.`);
    watch(s, ev, () => runOps(s, who, card.command.ops));
    p.discard.push(plain);
    endTurn(s, who, false);
  },

  // Play a Supporter (F3; adapted from v2's playSupporter): no Energy. Release exactly its number
  // of other cards from hand (permanently: to the Released Pile, never reshuffled), then its effect
  // (enhanced if a Released card meets the Favour, which also earns Recognition), then the Supporter
  // itself is Released.
  supporter(s, { who, uid, release = [] }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Supporter') throw new Error('Choose a Supporter from your hand');
    if (release.length !== card.release || new Set(release).size !== release.length) throw new Error(`${card.name}: Release exactly ${card.release} other card${card.release === 1 ? '' : 's'}`);
    const paid = release.map((r) => p.hand.find((c) => c.uid === r && c !== card));
    if (paid.some((c) => !c)) throw new Error('Release cards from your hand (not the Supporter itself)');
    const favour = favourMet(card, paid);
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c));
    p.released.push(...paid.map(({ retained, ...c }) => c));
    const ev = emit(s, 'supporter', { who, id: card.id, name: card.name, uid: card.uid, released: paid.map((c) => c.name), releasedUids: paid.map((c) => c.uid), favour });
    log(s, `${NAMES[who]} played ${card.name}, Releasing ${paid.map((c) => c.name).join(' and ')}${favour ? ` (Favour: ${FAVOURS[card.favour.condition].text})` : ''}.`);
    watch(s, ev, () => runSupporter(s, who, favour ? card.favour : card.effect));
    const { retained, ...plain } = card;
    p.released.push(plain);
    if (favour) gainRecognition(s, who, RULES.perFavour, `${card.name}'s Favour`, { kind: 'card' });
    endTurn(s, who, false);
  },

  // Place Location (no Energy, as in v2): over 2–4 adjacent free lanes on both sides, from `start`
  // to the right. Pokémon already there are now in it.
  placeLocation(s, { who, uid, start }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Location') throw new Error('Choose a Location from your hand');
    if (!locationStarts(s, card).includes(start)) throw new Error(`${card.name} needs ${card.width} adjacent free lanes there`);
    p.hand = p.hand.filter((c) => c !== card);
    const { retained, ...plain } = card;
    s.locations.push({ uid: `loc-${uid}`, owner: who, card: plain, id: card.id, name: card.name, art: card.art, color: card.color, start, width: card.width,
      roundsLeft: card.rounds, weather: card.weather, passive: card.passive, placedRound: s.round });
    emit(s, 'locationPlaced', { who, id: card.id, uid: `loc-${uid}`, name: card.name, start, width: card.width });
    log(s, `${NAMES[who]} placed ${card.name} over lanes ${start + 1}–${start + card.width} (${card.rounds} Rounds; ${card.weather.count} ${card.weather.type}).`);
    endTurn(s, who, false);
  },

  // Attack ("Command a Pokémon"): a Ready Pokémon attacks an enemy Pokémon or the enemy Player
  // Character, subject to guards. A Ready target hits back (a trade); both become Spent.
  attack(s, { who, from, target }) {
    const p = s.players[who];
    const foe = opponentOf(who);
    const a = p.row[from];
    if (!a || !isReady(s, a)) throw new Error('Choose one of your Ready Pokémon');
    if (!legalTargets(s, who, from).some((t) => t.kind === target?.kind && t.space === target.space)) throw new Error('That target is guarded or not there');
    const d = target.kind === 'pokemon' ? s.players[foe].row[target.space] : null;
    log(s, `${POSS[who]} ${a.name} attacks ${d ? d.name : (who === 'player' ? 'the Opponent' : 'you')}.`);
    commit(s, { type: 'attack', who, from, target, attackerUid: a.uid, targetUid: d?.uid ?? null,
      text: `${POSS[who]} ${a.name} is attacking ${d ? `${who === 'player' ? 'the Opponent\'s' : 'your'} ${d.name}` : (who === 'player' ? 'the Opponent' : 'you')}` });
  },

  // Retain: pay 1 Energy to keep a card in hand through Supper; draw one fewer next Breakfast.
  retain(s, { who, uid }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.retained) throw new Error('Choose a card in your hand that isn\'t Retained yet');
    payCost(p, RULES.retainCost, s.round);
    card.retained = true;
    emit(s, 'retained', { who, uid });
    log(s, `${NAMES[who]} Retained a card (1 Energy): one fewer card next Breakfast.`);
    endTurn(s, who, false);
  },

  // Pass (v1): +1 Base Energy, unless it is the second of two Passes in a row (that ends the Battle
  // Phase). Passing with unmatched Speed makes your fastest Active Pokémon Spent (v3).
  pass(s, { who }) {
    const p = s.players[who];
    const ends = passEndsPhase(s);
    const spends = passSpends(s, who);
    if (!ends) {
      p.baseEnergy += RULES.passEnergy;
      for (const space of spends) p.row[space].spent = true;
    }
    emit(s, 'pass', { who, endsPhase: ends, spends });
    log(s, ends ? `${NAMES[who]} passed: the Battle Phase ends.` : `${NAMES[who]} passed: +${RULES.passEnergy} Base Energy${spends.length ? ` (${spends.length} became Spent: unmatched Speed)` : ''}.`);
    endTurn(s, who, true);
  },
};

// --- Committing and resolving (F3) ----------------------------------------------------------------
// An action is committed: its cost is paid. G1 (gameplay update 2.2): only an attack by a Pokémon and
// a Command played as Adapt can be Reacted to (a resolving Strat too: resolveStrats); a summon resolves
// at once. If the other player has an affordable React with a target, a React window opens.
const REACTABLE = ['attack', 'command'];
function commit(s, pending) {
  const foe = opponentOf(pending.who);
  if (REACTABLE.includes(pending.type) && reactOptions(s, foe).length) {
    s.reactWindow = { reactor: foe, pending };
    emit(s, 'reactWindow', { reactor: foe, action: pending.type });   // (UX3: not "type", which named the event itself)
    return;
  }
  resolvePending(s, pending);
}

function resolvePending(s, pending) {
  if (s.phase === 'gameOver') return;
  // A resolving Strat isn't a turn: it resolves, then the rest of the due Strats, then whatever it
  // interrupted (the owner's turn goes on, or Supper continues to dominance).
  if (pending.type === 'strat') {
    resolveStratNow(s, pending.strat);
    drainTriggers(s);
    if (resolveStrats(s, pending.owner, pending.at) && pending.at === 'supper') supperRest(s);
    return;
  }
  RESOLVE[pending.type](s, pending);
  // G2: the action's triggers resolve (in order), then the turn ends. A chosen-target On Summon waits.
  drainTriggers(s);
  if (s.choice || s.phase === 'gameOver') return;
  endTurn(s, pending.who, false);
}

const fizzle = (s, who, what, why) => { emit(s, 'fizzled', { who, what }); log(s, `${what} fizzled: ${why}.`); };

const RESOLVE = {
  // The summoned Pokémon arrives (Spent), a snapshot at its Level; then its On Summon ability.
  summon(s, { who, card, space }) {
    const p = s.players[who];
    if (p.row[space]) { p.discard.push(card); return fizzle(s, who, `${POSS[who]} ${card.name}`, 'its space is taken'); }
    // G2: Quick Attack: it arrives Active instead of Spent.
    const quick = hasKw(card, 'quickAttack');
    p.row[space] = { ...card, currentStrength: card.strength, spent: !quick, summonedRound: s.round, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
    emit(s, 'summoned', { who, space, id: card.id, name: card.name, level: card.level, quick });
    if (quick) kwEvent(s, who, space, 'Quick Attack');
    syncBonuses(s);
    queueTrigger(s, who, space, p.row[space], 'summon', {}, 1);
  },

  // The attack: the attacker and target must still be there (and the target still legal). A Ready
  // target hits back (a trade); both become Spent. If it fizzles, the attacker is still Spent.
  attack(s, { who, from, target, attackerUid, targetUid }) {
    const foe = opponentOf(who);
    const a = s.players[who].row[from];
    if (!a || a.uid !== attackerUid) return fizzle(s, who, `${POSS[who]} attack`, 'the attacker is gone');
    const d = target.kind === 'pokemon' ? s.players[foe].row[target.space] : null;
    if (target.kind === 'pokemon' && (!d || d.uid !== targetUid)) { a.spent = true; return fizzle(s, who, `${POSS[who]} ${a.name}'s attack`, 'its target is gone'); }
    if (!legalTargets(s, who, from).some((t) => t.kind === target.kind && t.space === target.space)) { a.spent = true; return fizzle(s, who, `${POSS[who]} ${a.name}'s attack`, 'its target is guarded now'); }
    const raw = damageOf(s, a);
    if (target.kind === 'player') {
      a.spent = true;
      emit(s, 'attack', { who, from, target, amount: raw, name: a.name });
      log(s, `${POSS[who]} ${a.name} attacked ${who === 'player' ? 'the Opponent' : 'you'} for ${raw}.`);
      gainRecognition(s, who, raw * RULES.perDamageToPlayer, `${a.name}'s attack`, { kind: 'pc', who: foe });
      queueTrigger(s, who, from, a, 'attack', { target }, 1);
      return;
    }
    // G2 (4.1): Shell reduces each instance of damage (minimum 1); Retaliate: when the attack damages
    // the defender, the attacker takes X (its own Shell reduces that too); Overrun: the damage left over
    // after defeating the target goes to the enemy Player Character as Recognition; Rage: +1 Attack for
    // good to each survivor of damage. Then the triggers, in order (FOUNDATION_ASSUMPTIONS.md 5):
    // the attacker's On Attack and On Knockout, then the defender's On Defend (or On Knockout from its
    // hit-back), then On Defeated.
    const trades = isReady(s, d);
    const rawBack = trades ? damageOf(s, d) : 0;
    const left = d.currentStrength;
    const hit = damage(s, foe, target.space, raw);
    const back = trades ? damage(s, who, from, rawBack) : 0;
    const ret = hit > 0 ? kwNum(d, 'retaliate') : 0;
    const retaliated = ret ? damage(s, who, from, ret) : 0;
    if (retaliated) kwEvent(s, foe, target.space, 'Retaliate', retaliated);
    a.spent = true;
    if (trades) d.spent = true;
    emit(s, 'attack', { who, from, target, amount: hit, raw, back, retaliated, name: a.name, targetName: d.name });
    log(s, `${POSS[who]} ${a.name} attacked ${d.name} for ${hit}${trades ? `; ${d.name} was Ready and hit back for ${back}` : ''}${retaliated ? `; Retaliate: ${retaliated} back` : ''}.`);
    const dDown = d.currentStrength <= 0;
    const aDown = a.currentStrength <= 0;
    if (dDown && hasKw(a, 'overrun') && hit - left > 0) {
      const over = hit - left;
      kwEvent(s, who, from, 'Overrun', over);
      gainRecognition(s, who, over * RULES.perDamageToPlayer, `${a.name}'s Overrun`, { kind: 'pc', who: foe });
      if (s.phase === 'gameOver') return;
    }
    settle(s, foe, target.space, who, hit);
    settle(s, who, from, foe, back + retaliated);
    if (s.phase === 'gameOver') return;
    if (!aDown) queueTrigger(s, who, from, a, 'attack', { target }, 1);
    if (dDown && !aDown) queueTrigger(s, who, from, a, 'knockout', { target }, 1);
    if (!dDown && hit > 0) queueTrigger(s, foe, target.space, d, 'defend', { attacker: { who, space: from } }, 2);
    if (aDown && !dDown && back > 0 && a.currentStrength + retaliated <= 0) queueTrigger(s, foe, target.space, d, 'knockout', { target: { kind: 'pokemon', space: from } }, 2);
  },

  // A Command's Adapt: its effect (or it fizzles if the target is gone); the card is discarded.
  command(s, { who, card, target }) {
    applyCommand(s, who, card, 'adapt', target);
    s.players[who].discard.push(card);
  },
};

// A Command target: { who, space } of a Pokémon on the right side; remembers that Pokémon's uid so
// a later resolution can tell if it's gone.
function checkTarget(s, who, card, target) {
  if (!commandTargets(s, who, card).some((t) => t.who === target?.who && t.space === target.space)) {
    throw new Error(`${card.name}: choose ${card.target === 'enemy' ? 'an enemy Pokémon' : 'one of your Pokémon'}`);
  }
  return { who: target.who, space: target.space, uid: s.players[target.who].row[target.space].uid };
}
const cardModeText = (card, m) => {
  const { op, amount } = card.modes[m];
  return { damage: `${amount} damage`, heal: `heal ${amount}`, attackUp: `+${amount} Attack until Supper`, damageLocation: `${amount} damage to each enemy Pokémon in that Location` }[op];
};

// A Command's effect in a mode. Returns false if it fizzles (its target is gone).
export function applyCommand(s, who, card, mode, target) {
  const { op, amount } = card.modes[mode];
  const c = s.players[target.who].row[target.space];
  if (!c || (target.uid && c.uid !== target.uid)) { fizzle(s, who, `${POSS[who]} ${card.name}`, 'its target is gone'); return false; }
  const ev = emit(s, 'commandResolved', { who, id: card.id, name: card.name, mode, op, target });
  watch(s, ev, () => {
    if (op === 'damage') hurt(s, target.who, target.space, amount, who);
    else if (op === 'heal') heal(c, amount);
    else if (op === 'attackUp') { c.attack += amount; c.tempAttack = (c.tempAttack ?? 0) + amount; }
    else if (op === 'damageLocation') {
      const loc = locationOf(s, target.space);
      for (const { space } of pokemonOf(s, target.who).filter((x) => locationOf(s, x.space) === loc)) hurt(s, target.who, space, amount, who);
    } else throw new Error(`Unknown op ${op}`);
  });
  log(s, `${card.name} (${MODE_NAMES[mode]}): ${cardModeText(card, mode)} on ${c.name}.`);
  drainTriggers(s);
  return true;
}
// One instance of damage to a Pokémon (G2: Shell first, minimum 1), then defeat or Rage.
function hurt(s, side, space, n, by) {
  const dealt = damage(s, side, space, n);
  settle(s, side, space, by, dealt);
  return dealt;
}

// --- G2: keywords and triggers (docs/v4-gameplay-update.md 4.1; adapted from v2/src/engine/game.js) ---
// Keywords come from the card and from its Held Item: numbers add up.
export const hasKw = (card, k) => !!(card?.keywords?.[k] || card?.held?.keywords?.[k]);
export const kwNum = (card, k) => [card?.keywords?.[k], card?.held?.keywords?.[k]].reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
const kwEvent = (s, who, space, kw, amount = null) => emit(s, 'keyword', { who, space, kw, amount, name: s.players[who].row[space]?.name ?? null });
// Shell X: each instance of damage it takes is X less, minimum 1.
export const afterShell = (card, n) => { const sh = kwNum(card, 'shell'); return n > 0 && sh ? Math.max(1, n - sh) : n; };
function damage(s, side, space, n) {
  const c = s.players[side].row[space];
  if (!c || n <= 0) return 0;
  const dealt = afterShell(c, n);
  if (dealt < n) kwEvent(s, side, space, 'Shell', n - dealt);
  c.currentStrength -= dealt;
  return dealt;
}
// After damage: at 0 Strength or less it's defeated; a survivor with Rage gains +1 Attack for good.
function settle(s, side, space, by, dealt) {
  const c = s.players[side].row[space];
  if (!c || dealt <= 0) return;
  if (c.currentStrength <= 0) return defeat(s, side, space, by);
  if (hasKw(c, 'rage')) { c.attack += 1; kwEvent(s, side, space, 'Rage', 1); }
}
// "In its Location": a placed Location's lanes, every lane during the Tournament, or else just its lane.
export function lanesHere(s, lane) {
  if (s.tournament) return Array.from({ length: RULES.lanes }, (_, i) => i);
  const l = locationAt(s, lane);
  return l ? lanesOf(l) : [lane];
}
// Triggers wait in a queue and resolve after the action that caused them: by chain depth, then in a
// fixed order (1 the acting Pokémon's, 2 the other Pokémon's, 3 On Defeated), each in the order queued.
// A trigger's own effects can queue more (one level deeper); chains stop at MAX_CHAIN.
export const MAX_CHAIN = 4;
function queueTrigger(s, who, space, card, when, ctx = {}, order = 1) {
  if (!card?.trigger || card.trigger.on !== when) return;
  (s.triggers ??= []).push({ who, space, uid: card.uid, card: when === 'defeated' ? structuredClone(card) : null, when, ctx, order, depth: s.triggerDepth ?? 0 });
}
export function drainTriggers(s) {
  if (s.draining) return;
  s.draining = true;
  try {
    while (s.triggers?.length && s.phase !== 'gameOver' && !s.choice) {
      const depth = Math.min(...s.triggers.map((t) => t.depth));
      const t = s.triggers.filter((x) => x.depth === depth).sort((a, b) => a.order - b.order)[0];
      s.triggers = s.triggers.filter((x) => x !== t);
      if (t.depth >= MAX_CHAIN) { log(s, 'A chain of triggers stops here (too many in a row).'); emit(s, 'fizzled', { who: t.who, what: 'a trigger chain' }); continue; }
      s.triggerDepth = t.depth + 1;
      runTrigger(s, t);
      s.triggerDepth = 0;
    }
  } finally {
    s.draining = false;
    if (!s.triggers?.length) delete s.triggers;
    delete s.triggerDepth;
  }
}
// A trigger resolves: its Pokémon must still be in play (except On Defeated, which uses its card as it was).
function runTrigger(s, t) {
  const live = s.players[t.who].row[t.space];
  const card = t.when === 'defeated' ? t.card : live?.uid === t.uid ? live : null;
  if (!card) return;
  const src = { who: t.who, space: t.space, uid: t.uid, card, ctx: t.ctx, depth: t.depth };
  runOps2(s, src, card.trigger.ops);
}
// The ops of a trigger, in order. A chosen target pauses for the owner's choice (s.choice); with no
// legal choice that part fizzles.
function runOps2(s, src, ops) {
  const { who, space, card } = src;
  const text = `${TRIGGER_NAMES[card.trigger.on]}: ${card.trigger.ops.map(opText).join(', then ')}`;
  for (const [k, o] of ops.entries()) {
    if (s.phase === 'gameOver') return;
    if (CHOSEN.includes(o.to)) {
      const targets = choiceTargets(s, src, o);
      if (!targets.length) { fizzle(s, who, `${POSS[who]} ${card.name}'s ${TRIGGER_NAMES[card.trigger.on]}`, 'there is no target'); continue; }
      s.choice = { who, space, uid: src.uid, name: card.name, op: o, rest: ops.slice(k + 1), targets, text, depth: src.depth ?? 0 };
      emit(s, 'triggerChoice', { who, space, name: card.name, text, targets });
      log(s, `${POSS[who]} ${card.name}'s On Summon: ${who === 'player' ? 'choose' : 'the Opponent chooses'} a target.`);
      return;
    }
    const ev = emit(s, 'trigger', { who, space, id: card.id, name: card.name, on: card.trigger.on, text, op: o.op });
    log(s, `${POSS[who]} ${card.name}: ${text}.`);
    watch(s, ev, () => applyOp(s, src, o, null));
  }
}
// The targets a chosen op can pick.
export function choiceTargets(s, src, o) {
  const foe = opponentOf(src.who);
  if (o.to === 'chosenEnemy') return pokemonOf(s, foe).map(({ space }) => ({ who: foe, space }));
  if (o.to === 'chosenOwn') return pokemonOf(s, src.who).map(({ space }) => ({ who: src.who, space }));
  const here = lanesHere(s, src.space);
  return pokemonOf(s, src.who).filter(({ space }) => space !== src.space && here.includes(space)).map(({ space }) => ({ who: src.who, space }));
}
// One op of a trigger, on its targets (a chosen target, or the ones its wording names).
function applyOp(s, src, o, chosen) {
  const { who } = src;
  const foe = opponentOf(who);
  const p = s.players[who];
  const self = p.row[src.space]?.uid === src.uid ? p.row[src.space] : null;
  const here = lanesHere(s, src.space);
  const tgt = src.ctx?.target?.kind === 'pokemon' ? src.ctx.target.space : null;
  const foes = (f = () => true) => pokemonOf(s, foe).filter(({ space }) => f(space)).map(({ space }) => ({ who: foe, space }));
  const mine = (f = () => true) => pokemonOf(s, who).filter(({ space }) => f(space)).map(({ space }) => ({ who, space }));
  let targets;
  switch (o.to) {
    case 'chosenEnemy': case 'chosenOwn': case 'chosenOtherOwnHere': targets = chosen ? [chosen] : []; break;
    case 'eachEnemy': targets = foes(); break;
    case 'eachEnemyHere': targets = foes((sp) => here.includes(sp)); break;
    case 'eachEnemyTargetLoc': targets = tgt === null ? [] : foes((sp) => lanesHere(s, tgt).includes(sp)); break;
    case 'otherEnemiesTargetLoc': targets = tgt === null ? [] : foes((sp) => sp !== tgt && lanesHere(s, tgt).includes(sp)); break;
    case 'oneOtherEnemyTargetLoc': {
      // "Another enemy Pokémon in the target's Location": the weakest (lowest Strength, then lowest lane).
      const all = tgt === null ? [] : foes((sp) => sp !== tgt && lanesHere(s, tgt).includes(sp));
      all.sort((a, b) => s.players[foe].row[a.space].currentStrength - s.players[foe].row[b.space].currentStrength || a.space - b.space);
      targets = all.slice(0, 1);
      break;
    }
    case 'eachOwnHere': targets = mine((sp) => here.includes(sp)); break;
    case 'eachOtherOwnHere': targets = mine((sp) => sp !== src.space && here.includes(sp)); break;
    case 'self': targets = self ? [{ who, space: src.space }] : []; break;
    default: targets = [];
  }
  if (o.op === 'draw') return draw(s, who, o.amount);
  if (o.op === 'energy') { p.baseEnergy += o.amount; return; }
  if (o.op === 'damage') {
    const dealt = targets.map((t) => ({ ...t, n: damage(s, t.who, t.space, o.amount) }));
    for (const t of dealt) settle(s, t.who, t.space, who, t.n);
    return;
  }
  for (const t of targets) {
    const c = s.players[t.who].row[t.space];
    if (!c) continue;
    if (o.op === 'heal') heal(c, o.amount);
    else if (o.op === 'tempAttack') { c.attack += o.amount; c.tempAttack = (c.tempAttack ?? 0) + o.amount; }
    else if (o.op === 'attack') c.attack += o.amount;
    else if (o.op === 'strength') { c.strength += o.amount; c.currentStrength += o.amount; }
  }
}

// Pending Strats resolve (in the order played): the owner's at the start of their next turn, or
// everyone's at Supper if the Battle Phase ends first. A Strat whose target is gone fizzles.
// G1 (2.2): the other player may React to each one as it resolves: a React window opens and the rest
// wait (returns false); resolvePending carries on once it closes. True when all due Strats resolved.
export function resolveStrats(s, owner = null, at = owner ? 'turn' : 'supper') {
  for (;;) {
    if (s.phase === 'gameOver') return true;
    const x = s.strats.find((y) => !owner || y.owner === owner);
    if (!x) return true;
    s.strats = s.strats.filter((y) => y !== x);
    const foe = opponentOf(x.owner);
    if (reactOptions(s, foe).length) {
      const pending = { type: 'strat', who: x.owner, strat: x, owner, at, card: x.card, target: x.target,
        text: `${POSS[x.owner]} Strat ${x.card.name} (${cardModeText(x.card, 'strat')}) is resolving on ${x.targetName}${at === 'supper' ? ' at Supper' : ''}` };
      s.reactWindow = { reactor: foe, pending };
      emit(s, 'reactWindow', { reactor: foe, action: 'strat' });
      log(s, `${POSS[x.owner]} Strat ${x.card.name} is resolving: ${NAMES[foe]} may React.`);
      return false;
    }
    resolveStratNow(s, x);
  }
}
function resolveStratNow(s, x) {
  if (s.phase === 'gameOver') return;
  log(s, `${POSS[x.owner]} Strat resolves: ${x.card.name}.`);
  applyCommand(s, x.owner, x.card, 'strat', x.target);
  s.players[x.owner].discard.push(x.card);
}

// A Supporter's effect.
function runSupporter(s, who, { op, amount }) {
  const p = s.players[who];
  if (op === 'healAll') for (const { card } of pokemonOf(s, who)) heal(card, amount);
  else if (op === 'strengthAll') for (const { card } of pokemonOf(s, who)) { card.strength += amount; card.currentStrength += amount; }
  else if (op === 'search') {
    for (let i = 0; i < amount; i++) {
      const at = p.drawPile.findIndex((c) => c.cardType === 'Pokémon');
      if (at < 0) break;
      const [c] = p.drawPile.splice(at, 1);
      p.hand.push(c);
      log(s, `${NAMES[who]} searched for ${who === 'player' ? c.name : 'a Pokémon card'}.`);
    }
  } else throw new Error(`Unknown op ${op}`);
}

// --- Items (F4) ---
function checkItemTarget(s, who, item, target) {
  if (!itemTargets(s, who, item).some((t) => t.space === target?.space && (target.who ?? who) === who)) throw new Error(`${item.name}: choose one of your Pokémon${item.itemType === 'Held' ? ' without a Held Item' : ''}`);
  return { who, space: target.space };
}
// Using an Item: a Held Item attaches to the Pokémon; a Consumed Item resolves, then goes to the PokéMart.
export function applyItem(s, who, item, t) {
  const c = s.players[who].row[t.space];
  const ev = emit(s, 'itemUsed', { who, id: item.id, name: item.name, itemType: item.itemType, op: item.op, space: t.space });
  if (item.itemType === 'Held') {
    c.held = item;
    log(s, `${POSS[who]} ${c.name} now holds ${item.name} (${item.text}).`);
    return;
  }
  watch(s, ev, () => {
    if (item.op === 'heal') heal(c, item.amount);
    else if (item.op === 'attackUp') { c.attack += item.amount; c.tempAttack = (c.tempAttack ?? 0) + item.amount; }
    else throw new Error(`Unknown Item op ${item.op}`);
  });
  log(s, `${NAMES[who]} used ${item.name} on ${c.name} (${item.text}).`);
  s.mart.pool.push(item);
}
// G1 (gameplay update 2.6): the PokéMart has one slot. A random Item from the pool goes on sale with
// its full Stock. why: 'start' (match setup), 'stock' (the last one's Stock ran out), 'restock' (after
// Sold out). A different Item than the one just returned is chosen when the pool has one.
function stockMart(s, why, not = null) {
  const pool = s.mart.pool;
  const choices = pool.filter((c) => c.id !== not);
  const from = choices.length ? choices : pool;
  if (!from.length) { s.mart.onSale = [null]; s.mart.stock = 0; return; }
  const pick = from[Math.floor(nextRandom(s) * from.length)];
  s.mart.pool = pool.filter((c) => c !== pick);
  s.mart.onSale = [pick];
  s.mart.stock = pick.stock;
  s.mart.soldOut = null;
  emit(s, 'martRefreshed', { id: pick.id, name: pick.name, stock: pick.stock, why });
  if (why !== 'start') log(s, `The PokéMart now sells ${pick.name} ($${pick.price}) for ${pick.stock} turns.`);
}
// Each turn taken in the Battle Phase (React decisions aren't turns) uses 1 Stock. At 0 the Item goes
// back to the pool and another replaces it. While Sold out nothing counts down: the PokéMart restocks
// once the buyer has finished their next turn (the turn of the purchase itself doesn't count).
function martTurn(s, who) {
  const m = s.mart;
  if (m.soldOut) {
    if (m.soldOut.by !== who) return;
    if (!m.soldOut.armed) { m.soldOut.armed = true; return; }
    stockMart(s, 'restock');
    return;
  }
  const c = m.onSale[0];
  if (!c) return;
  m.stock -= 1;
  if (m.stock > 0) return;
  m.pool.push(c);
  m.onSale = [null];
  log(s, `${c.name} leaves the PokéMart (its Stock ran out).`);
  stockMart(s, 'stock', c.id);
}
function gainDollars(s, who, n, source, from = null) {
  s.players[who].dollars += n;
  emit(s, 'dollars', { who, amount: n, total: s.players[who].dollars, source, from });
  log(s, `${NAMES[who]}: +$${n} (${source}), now $${s.players[who].dollars}.`);
}

// --- Trainers and Partners (F4; adapted from v2's unlockTier / partnerInto and its waiting Partners) ---
function progressTrainers(s, who, kind) {
  for (const t of s.players[who].trainers) {
    if (t.complete || t.objective.kind !== kind || s.phase === 'gameOver') continue;
    t.progress += 1;
    emit(s, 'objectiveProgress', { who, uid: t.uid, progress: t.progress, need: t.objective.need });
    log(s, `${POSS[who]} ${t.name} Objective: ${Math.min(t.progress, t.objective.need)}/${t.objective.need} (${t.objective.text}).`);
    if (t.progress >= t.objective.need) completeTrainer(s, who, t);
  }
}
const PILE_NAMES = { drawPile: 'Draw Pile', hand: 'hand', discard: 'Discard Pile' };
// UX1: completed: the Trainer card is taken at once from wherever it is (Draw Pile, hand, Discard Pile)
// and leaves the deck for good (it stays only on the tracker); the Partner arrives (or waits for a
// free space); its On Summon resolves; +Recognition. The tracker stays, marked complete.
function completeTrainer(s, who, t) {
  const p = s.players[who];
  t.complete = true;
  t.completedRound = s.round;
  emit(s, 'objectiveComplete', { who, uid: t.uid, name: t.name });
  log(s, `${POSS[who]} ${t.name}: Objective complete (${t.objective.text})!`);
  const pile = Object.keys(PILE_NAMES).find((k) => p[k].some((c) => c.uid === t.cardUid));
  if (pile) {
    p[pile] = p[pile].filter((c) => c.uid !== t.cardUid);
    emit(s, 'trainerTaken', { who, uid: t.cardUid, from: pile });
    log(s, `${t.name} is taken from ${who === 'player' ? 'your' : 'the Opponent\'s'} ${PILE_NAMES[pile]} and leaves the deck for good.`);
  } else log(s, `${t.name}'s card had already left the deck (Released).`);
  const card = { ...structuredClone(t.card.partner), uid: `partner-${t.uid}`, trainer: t.name };
  const space = p.row.findIndex((c) => !c);
  if (space >= 0) partnerInto(s, who, card, space);
  else {
    p.waiting.push(card);
    emit(s, 'partnerWaiting', { who, name: card.name, trainer: t.name });
    log(s, `${card.name}, ${t.name}'s Partner, waits for a free space.`);
  }
  gainRecognition(s, who, RULES.perObjective, `${t.name}'s Objective`, { kind: 'tracker', who, uid: t.uid });
}
// A Partner Pokémon arrives like a summon (Spent; a snapshot), into the first empty space on your
// side; then its On Summon effect.
function partnerInto(s, who, card, space) {
  s.players[who].row[space] = { ...card, currentStrength: card.strength, spent: true, summonedRound: s.round, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
  emit(s, 'partnerArrived', { who, id: card.id, name: card.name, space, trainer: card.trainer });
  log(s, `${card.trainer}'s Partner ${card.name} arrives in lane ${space + 1}!`);
  syncBonuses(s);
  queueTrigger(s, who, space, s.players[who].row[space], 'summon', {}, 1);
  drainTriggers(s);
}
// Waiting Partners arrive as soon as a space is free (checked after every action and at Breakfast).
function partnersArrive(s) {
  for (const who of PLAYERS) {
    const p = s.players[who];
    while (p.waiting.length && s.phase !== 'gameOver') {
      const space = p.row.findIndex((c) => !c);
      if (space < 0) break;
      partnerInto(s, who, p.waiting.shift(), space);
    }
  }
}

// An attack's damage: its Attack, +1 for a Physical attack in Sun 2.
export const damageOf = (s, card) => card.attack + (card.attackType === 'Physical' ? activeBrackets(s).filter((b) => b.kind === 'physical').reduce((n, b) => n + b.amount, 0) : 0);

// Location passives and Weather brackets that change stats (+Attack, +Strength), kept in step with
// the board after every action (adapted from v2's syncPassives). Losing a Strength bonus never
// defeats a Pokémon (at least 1 Strength is left).
export function wantedBonus(s, space, card = null) {
  const l = locationAt(s, space);
  const br = activeBrackets(s);
  const sum = (kind) => (l?.passive.kind === kind ? l.passive.amount : 0) + br.filter((b) => b.kind === kind).reduce((n, b) => n + b.amount, 0)
    + (card?.held?.op === kind ? card.held.amount : 0);
  return { attack: sum('attack'), strength: sum('strength') };
}
export function syncBonuses(s) {
  for (const who of PLAYERS) {
    for (const { card, space } of pokemonOf(s, who)) {
      const want = wantedBonus(s, space, card);
      card.attack += want.attack - (card.bonusAttack ?? 0);
      card.bonusAttack = want.attack;
      const d = want.strength - (card.bonusStrength ?? 0);
      if (d) {
        card.strength += d;
        card.currentStrength = d > 0 ? card.currentStrength + d : Math.max(1, Math.min(card.currentStrength, card.strength));
        card.bonusStrength = want.strength;
      }
    }
  }
}

function heal(card, n) { card.currentStrength = Math.min(card.strength, card.currentStrength + n); }

export function runOps(s, who, ops) {
  const foe = opponentOf(who);
  for (const o of ops) {
    if (s.phase === 'gameOver') return;
    if (o.op === 'draw') draw(s, who, o.amount);
    else if (o.op === 'damageAll') {
      const dealt = pokemonOf(s, foe).map(({ space }) => ({ space, n: damage(s, foe, space, o.amount) }));
      for (const t of dealt) settle(s, foe, t.space, who, t.n);
    } else throw new Error(`Unknown op ${o.op}`);
  }
  drainTriggers(s);
}

// A Pokémon at 0 Strength or less is defeated: it goes to its owner's Released Pile.
function defeat(s, who, space, by) {
  const card = s.players[who].row[space];
  if (!card) return;
  s.players[who].row[space] = null;
  // F4: a Held Item is lost: it goes back to the PokéMart's pool.
  if (card.held) { s.mart.pool.push(card.held); log(s, `${card.held.name} goes back to the PokéMart.`); delete card.held; }
  s.players[who].released.push(card);
  emit(s, 'defeated', { who, space, name: card.name, by });
  // G2: On Defeated (it resolves after the action, with the card as it was, in its lane's Location).
  queueTrigger(s, who, space, card, 'defeated', {}, 3);
  log(s, `${POSS[who]} ${card.name} was defeated.`);
  // G1 (2.5): a flat $1 for each enemy Pokémon defeated (Partners included).
  gainDollars(s, by, RULES.dollarsPerDefeat, `defeating ${card.name}`, { kind: 'space', who, space });
  gainRecognition(s, by, RULES.perDefeat, `defeating ${card.name}`, { kind: 'space', who, space });
  progressTrainers(s, by, 'defeat');
}

function endTurn(s, who, passed) {
  if (s.phase === 'gameOver') return;
  drainTriggers(s);
  if (s.phase === 'gameOver' || s.choice) return;
  martTurn(s, who);
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
  // F3: the new player's pending Strats resolve now (after the opponent's turn).
  if (s.strats.some((x) => x.owner === s.turn)) resolveStrats(s, s.turn);
}

// --- Recognition and winning ------------------------------------------------------------------------

export function gainRecognition(s, who, base, source, from = null) {
  if (base <= 0 || s.phase === 'gameOver') return;
  const p = s.players[who];
  const amount = boosted(s, base);
  p.recognition += amount;
  emit(s, 'recognition', { who, amount, base, total: p.recognition, source, from });
  log(s, `${NAMES[who]}: +${amount} Recognition (${source}${amount !== base ? `; Tournament: ${base} +50%` : ''}), now ${p.recognition}.`);
  if (p.recognition >= RULES.win) {
    s.phase = 'gameOver';
    s.winner = who;
    s.turn = null;
    s.result = { winner: who, round: s.round };
    emit(s, 'gameOver', { winner: who });
    log(s, `${NAMES[who]} reached ${RULES.win} Recognition: Pokémon League Champion!`);
  }
}

// --- Phases -----------------------------------------------------------------------------------------

function beginBattle(s) {
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  emit(s, 'battle', { round: s.round });
}

// Draw n (v1): if the Draw Pile is empty, shuffle the Discard Pile into it; if both are empty, stop.
function draw(s, who, n) {
  const p = s.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) return;
      p.drawPile = shuffle(s, p.discard.map((c) => ({ ...cardAtRound(c.id, s.round), uid: c.uid })));
      p.discard = [];
      emit(s, 'reshuffled', { who });
      log(s, `${NAMES[who]} shuffled the Discard Pile into a new Draw Pile.`);
    }
    p.hand.push(p.drawPile.shift());
  }
}

// Supper: the hand goes to the Discard Pile, except Retained cards.
function supper(s) {
  emit(s, 'supper', { round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  // F3: Strats still pending resolve first (the Battle Phase ended before their owner's next turn).
  // G1: each may open a React window; Supper goes on when the last one has resolved.
  if (!resolveStrats(s, null, 'supper')) return;
  supperRest(s);
}
function supperRest(s) {
  if (s.phase === 'gameOver') return;
  // Dominance: for each placed Location, the player with more total Strength there earns Recognition.
  for (const l of [...s.locations]) {
    const d = dominantOf(s, l);
    if (d) {
      emit(s, 'dominance', { who: d, uid: l.uid });
      gainRecognition(s, d, RULES.perDominance, `dominating ${l.name}`, { kind: 'location', uid: l.uid });
      if (s.phase === 'gameOver') return;
      progressTrainers(s, d, 'dominate');
      if (s.phase === 'gameOver') return;
    }
  }
  // F5: the Tournament's dominance (it has no duration).
  if (s.tournament) {
    const d = tournamentDominant(s);
    emit(s, 'tournamentDominance', { who: d, player: tournamentStrength(s, 'player'), ai: tournamentStrength(s, 'ai') });
    if (d) {
      gainRecognition(s, d, RULES.perTournamentDominance, 'dominating the Pokémon League Tournament', { kind: 'tournament' });
      if (s.phase === 'gameOver') return;
      progressTrainers(s, d, 'dominate');
      if (s.phase === 'gameOver') return;
    } else log(s, 'The Pokémon League Tournament is tied: nobody dominates it.');
  }
  // Durations: each placed Location counts down; at 0 it's removed (its lanes are Default again,
  // its card goes to its owner's Discard Pile; Pokémon there stay where they are).
  for (const l of [...s.locations]) {
    l.roundsLeft -= 1;
    if (l.roundsLeft > 0) continue;
    s.locations = s.locations.filter((x) => x !== l);
    s.players[l.owner].discard.push(l.card);
    emit(s, 'locationRemoved', { uid: l.uid, id: l.id, name: l.name, owner: l.owner, start: l.start, width: l.width });
    log(s, `${l.name} leaves: its lanes are the Default Location again.`);
  }
  syncBonuses(s);
  // F3: "+Attack until Supper" ends.
  for (const who of PLAYERS) for (const { card } of pokemonOf(s, who)) { card.attack -= card.tempAttack ?? 0; card.tempAttack = 0; }
  for (const who of PLAYERS) {
    const p = s.players[who];
    const kept = p.hand.filter((c) => c.retained);
    p.discard.push(...p.hand.filter((c) => !c.retained));
    p.hand = kept;
    p.retainedNext = kept.length;
  }
  startRound(s, s.round + 1);
}

// Breakfast: Exhaust recovers, Base Energy and the Exert maximum are set (v1); Spent Pokémon become
// Active; Pokémon cards off the battlefield (hand, Draw and Discard Piles) gain their Level for this
// Round; each player draws 7, less one per card Retained.
function startRound(s, round) {
  s.round = round;
  s.initiative = opponentOf(s.initiative);
  const ev = emit(s, 'breakfast', { round });
  const hand0 = Object.fromEntries(PLAYERS.map((w) => [w, s.players[w].hand.length]));
  log(s, `Round ${round} · Breakfast.`);
  // F5: first, the Pokémon League Tournament may begin.
  if (!s.tournament && (round >= RULES.tournamentRound || PLAYERS.some((w) => s.players[w].recognition >= RULES.tournamentRecognition))) beginTournament(s, round);
  watch(s, ev, () => {
    for (const who of PLAYERS) {
      const p = s.players[who];
      const recovered = refreshEnergy(p, round);
      if (recovered.length) log(s, `${NAMES[who]}: ${recovered.length} Exhaust recovered into Exert.`);
      for (const { card } of pokemonOf(s, who)) card.spent = false;
      p.dollars += RULES.dollarsPerRound;
      // Breakfast heals: Lake of Rage's passive, Rain 2.
      const rain = activeBrackets(s).filter((b) => b.kind === 'healAll').reduce((n, b) => n + b.amount, 0);
      for (const { card, space } of pokemonOf(s, who)) {
        const l = locationAt(s, space);
        // G2: Regenerate X heals X at Breakfast too.
        const n = rain + (l?.passive.kind === 'heal' ? l.passive.amount : 0) + (card.held?.op === 'healBreakfast' ? card.held.amount : 0) + kwNum(card, 'regenerate');
        if (n) heal(card, n);
      }
      for (const pile of ['hand', 'drawPile', 'discard']) p[pile] = p[pile].map((c) => (c.cardType === 'Pokémon' ? { ...cardAtRound(c.id, round), uid: c.uid, ...(c.retained ? { retained: false } : {}) } : c));
      for (const c of p.hand) c.retained = false;
      draw(s, who, Math.max(0, RULES.handDraw - p.retainedNext));
      p.retainedNext = 0;
    }
  });
  // UX4: what Breakfast gave each player, for the summary strip (data only).
  ev.summary = Object.fromEntries(PLAYERS.map((w) => [w, { drew: s.players[w].hand.length - hand0[w], dollars: RULES.dollarsPerRound, energy: s.players[w].baseEnergy }]));
  // G1: no PokéMart refresh at Breakfast any more (its Stock carries over between Rounds).
  partnersArrive(s);
  syncBonuses(s);
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  // G2: On Breakfast triggers, for every Pokémon in play (the initiative player's first).
  for (const who of [s.initiative, opponentOf(s.initiative)]) for (const { card, space } of pokemonOf(s, who)) queueTrigger(s, who, space, card, 'breakfast', {}, 1);
  drainTriggers(s);
}

// F5: the Pokémon League Tournament begins: every placed Location is removed (its card to its owner's
// Discard Pile); the Tournament covers all 9 lanes; Pokémon stay where they are.
function beginTournament(s, round) {
  const reason = round >= RULES.tournamentRound ? `Round ${RULES.tournamentRound}` : `${RULES.tournamentRecognition}+ Recognition`;
  for (const l of s.locations) s.players[l.owner].discard.push(l.card);
  const removed = s.locations.map((l) => l.name);
  s.locations = [];
  s.tournament = { startedRound: round, reason };
  emit(s, 'tournament', { round, reason, removed });
  log(s, `The Pokémon League Tournament begins (${reason})!${removed.length ? ` ${removed.join(', ')} ${removed.length === 1 ? 'is' : 'are'} removed.` : ''} It covers the whole battlefield: Recognition +50%, and its dominance gives +${RULES.perTournamentDominance} at Supper.`);
}

function emit(s, type, data = {}) { const e = { type, ...data }; s.events.push(e); return e; }

// UX4 (data only, for the presenter): runs fn and records on the event every Pokémon whose
// Strength or Attack it changed: { who, space, name, before, after, max, attackBefore, attackAfter,
// defeated }. It only watches; the rules are untouched.
function watch(s, ev, fn) {
  const before = PLAYERS.flatMap((who) => pokemonOf(s, who).map(({ card, space }) => ({ who, space, uid: card.uid, name: card.name, cs: card.currentStrength, atk: card.attack })));
  fn();
  const hits = [];
  for (const b of before) {
    const now = s.players[b.who].row[b.space];
    const here = now?.uid === b.uid ? now : null;
    const gone = here ? null : s.players[b.who].released.find((c) => c.uid === b.uid);
    const cs = here ? here.currentStrength : Math.max(0, gone?.currentStrength ?? 0);
    const atk = here ? here.attack : b.atk;
    if (cs !== b.cs || atk !== b.atk || !here) hits.push({ who: b.who, space: b.space, name: b.name, before: b.cs, after: Math.max(0, cs), max: here?.strength ?? null, attackBefore: b.atk, attackAfter: atk, defeated: !here });
  }
  ev.hits = [...(ev.hits ?? []), ...hits];
}
function log(s, line) { s.log.push(line); }

export { levelFor, pokemonAt, pathDef, availableExert };
