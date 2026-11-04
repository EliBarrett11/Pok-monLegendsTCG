// The v2 engine (V1 core + V2 Locations): the board, the match flow, Energy with
// storing, summoning, attacks with the guard rules, Recognition, Locations with
// their objectives, the Championship and the end of the match. No DOM code.
//
// applyAction(state, action) never changes `state`: it returns a new state,
// with `events` saying what just happened (for the screen and the AI).
//
// The board (docs/v2-design.md 1.1): each player has one row of 9 spaces; the
// two rows face each other, so space i on both sides makes lane i. A lane is
// Home until a Location covers it (see the Locations section below).
//
// The match flow, as in v1: a coin flip for Round 1's initiative, then each Round
//   Breakfast  Spent Pokémon become Active; draw 7 (on top of any kept Retain
//              cards: Elliott's ruling, as in v1); Energy = the Round
//              number (up to 10) + any stored Energy
//   Battle     alternating Actions, the player with initiative first: summon a
//              Pokémon, attack with an Alert one, or Pass
//   Supper     the hand is discarded except Retain cards; up to 1 unspent Energy
//              is stored for the next Round
// and initiative switches each Round.
//
// The player character (1.3): each player is a target with no health. Damage
// to the enemy player character gains the attacker's player that much
// Recognition. Reaching 60 Recognition wins at once, at any time.
//
// The end of the match (7a): 12 Rounds. The Championship arrives at the start of
// Round 10 (a Location over all 9 lanes; every other Location ends, milestones
// already earned are kept). After Round 12's Supper the highest Recognition wins;
// a tie goes to the most Championship progress, then one sudden-death Round
// (Round 13); a tie after that is a draw (Claude's placeholder, open question).

import { nextRandom, shuffle } from '../../../src/engine/random.js';
import {
  LANES, RECOGNITION_TARGET, HAND_SIZE, STORE_LIMIT, PASS_ENERGY, ROUND_LIMIT, CHAMPIONSHIP_ROUND, MAX_LEVEL, baseEnergyFor, levelFor,
} from './rules.js';
import { TEST_DECK, cardAt, SPEEDS } from './cards.js';
import { pokemonAt } from './series.js';
import { ITEMS, BAG_SIZE, FAVOURS } from './cardtypes.js';
import { OBJECTIVES, CHAMPIONSHIP, rewardText } from './locations.js';

export const PLAYERS = ['player', 'ai'];
// The Recognition target and the Championship's Round (a variant may change them).
// SL experiment flag (V7d): Sleep Powder costs 3.
const variantCard = (variant, c) => (variant?.sleepLimit && c.id === 'g-sleep-powder'
  ? { ...c, breakpoints: c.breakpoints.map((b) => ({ ...b, cost: Math.max(3, b.cost) })) } : c);
export const targetOf = (s) => s.variant?.target ?? RECOGNITION_TARGET;
export const champRoundOf = (s) => s.variant?.champRound ?? CHAMPIONSHIP_ROUND;
export const NAMES = { player: 'You', ai: 'Opponent' };
// The log is seat-neutral (V9): each seat-dependent word is a token ⟨seat|for that seat|for the
// other⟩, rendered for the seat reading it (localize, and view.js viewFor). Against the AI the
// screen reads the 'player' seat's view, so it reads exactly as before.
export const nm = (w) => `⟨${w}|You|Opponent⟩`;
export const poss = (w) => `⟨${w}|Your|The Opponent's⟩`;
export const vb = (w, mine, theirs) => `⟨${w}|${mine}|${theirs}⟩`;
export const localize = (line, seat) => String(line).replace(/⟨(player|ai)\|([^|⟩]*)\|([^⟩]*)⟩/g, (m, w, a, b) => (w === seat ? a : b));
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');

// --- Setup ---------------------------------------------------------------------------------

// variant (V7a, for the balance experiment; off by default): { target (Recognition to
// win), locMult (Location Recognition rewards ×, rounded up), champRound (when the
// Championship arrives), waterStrength (+N Strength for Water Pokémon), waterLocations
// (Water's Locations last 1 Round longer, and each milestone gives +1 Recognition) }.
export function createGame(seed = Date.now(), { decks = { player: TEST_DECK, ai: TEST_DECK }, itemPool = ITEMS, plans = {}, variant = null } = {}) {
  const state = {
    seed, rng: seed >>> 0, round: 0, phase: 'initiative', turn: null, initiative: null, passesInARow: 0,
    winner: null, result: null, suddenDeath: false, locations: [], nextLocation: 0, players: {}, log: [], events: [],
    itemPool: [], nextItem: 0, assign: null, choices: [], variant,
  };
  for (const who of PLAYERS) {
    state.players[who] = {
      name: nm(who),
      // Opaque uids (V9): numbered by place after the shuffle, so a uid never says which card it is.
      drawPile: shuffle(state, buildDeck(who, decks[who]).map((c) => variantCard(variant, c))).map((c, i) => ({ ...c, uid: `${who}-${i}` })),
      hand: [], discard: [], released: [],
      row: Array(LANES).fill(null),
      energy: 0, roundEnergy: 0, stored: 0, bonusNext: 0, bonus: 0, recognition: 0,
      bag: [], burn: 0,
      trainers: [], trainerPoints: 0, movedTrainer: false, waiting: [],
      growth: 0, plan: plans[who] ?? null, wallaceRound: 0,
    };
  }
  // The shared Item pool (V4): one copy of each Item, shuffled (V6: the real pool of 12).
  state.itemPool = shuffle(state, itemPool.map((c) => ({ ...c }))).map((c) => ({ ...c, uid: `pool-${state.nextItem++}` }));
  log(state, 'Flip a coin to decide who has initiative in Round 1.');
  return state;
}

// A deck (a list of { series, cap } and { location } cards) as cards, each with its own uid.
export function buildDeck(who, list) {
  return list.map((entry, n) => ({ ...cardAt(entry, 1), uid: `${who}-${n}` }));
}

// --- Training (V3) ------------------------------------------------------------------------------
//
// A Pokémon card's Level is the Round number, up to its cap, wherever it is
// (hand, draw pile, discard). Once played it stays at that Level (frozen), unless an
// effect trains it.

// The card at a Level of its series, keeping who it is (uid, cap).
const atLevel = (card, level) => ({ ...pokemonAt(card.series, level), cap: card.cap, uid: card.uid });

// Breakfast: every Pokémon card off the board follows the Round. A card in hand that
// reaches a new stage says so (a 'levelUp' event, for the flourish).
function followRound(s, who) {
  const p = s.players[who];
  for (const pile of ['hand', 'drawPile', 'discard']) {
    p[pile] = p[pile].map((card) => {
      if (card.cardType !== 'Pokémon' || card.legendary) return card;   // a Legendary has no Levels
      const level = levelFor(s.round, card.cap);
      if (level === card.level) return card;
      const next = atLevel(card, level);
      if (pile === 'hand' && next.stage !== card.stage) emit(s, 'levelUp', { who, uid: card.uid, from: card.name, to: next.name, level });
      return next;
    });
  }
}

// The highest Level training can reach: the cap (a Legendary is a single card: never).
export const trainTop = (card) => Math.min(card.cap ?? MAX_LEVEL, MAX_LEVEL);

// Train a played Pokémon by n Levels, up to its cap: the new Level's stats, name and
// ability. Damage carries over and never defeats it (at least 1 Strength is left), as
// with Evolution in the current game. An Empowered bonus stays.
export function train(s, who, space, n) {
  const card = s.players[who].row[space];
  if (!card) return false;
  const to = Math.min(card.level + n, trainTop(card));
  if (to <= card.level) return false;
  const damage = card.strength - card.currentStrength;
  const next = {
    ...atLevel(card, to), spent: card.spent, arrivedRound: card.arrivedRound, empowered: card.empowered,
    burn: card.burn, asleep: card.asleep, seededBy: card.seededBy, shellRound: card.shellRound, partner: card.partner,
    nurturedRound: card.nurturedRound, firedRound: card.firedRound, held: card.held, grown: card.grown, buffs: [],
  };
  if (card.empowered) applyEmpower(next);
  next.strength += waterBonus(s, next);
  next.attack += waterAttack(s, next);
  fireGuard(s, next);
  if (card.held) applyHeld(next, card.held);
  // Permanent gains (Rally, Rage, On Heal) and "this Round" / "until Breakfast" buffs stay.
  if (card.grown) { next.attack += card.grown.attack ?? 0; next.strength += card.grown.strength ?? 0; }
  for (const b of card.buffs ?? []) applyBuff(next, b);
  next.currentStrength = Math.max(1, next.strength - damage);
  // Evolving (a new stage) cures Sleep and Leech Seed, as in the current game.
  if (next.stage !== card.stage) { next.asleep = false; next.seededBy = null; }
  s.players[who].row[space] = next;
  emit(s, 'trained', { who, space, from: card.level, to, fromName: card.name, name: next.name, evolved: next.stage !== card.stage, cause: CAUSE });
  log(s, `${poss(who)} ${card.name} trained to Level ${to}${next.name !== card.name ? `: it evolved into ${next.name}` : ''}.`);
  // On Evolve (V6): training into a new stage fires the new stage's On Evolve.
  if (next.stage !== card.stage) fireTrigger(s, who, space, 'onEvolve');
  return true;
}

// Experiment flags (off by default; the V7 balance itself is in the card data):
// W1: Water Pokémon +N Strength at every Level.
// FG experiment flag (V7c): the Growlithe → Arcanine line has the Defence Strength-Type.
const fireGuard = (s, card) => { if (s.variant?.fireGuards && card.series === 'f-growlithe') card.strengthType = 'Defence'; };
const waterBonus = (s, card) => (s.variant?.waterStrength && card.type === 'Water' ? s.variant.waterStrength : 0)
  // F½ experiment flag (V7e): Fire Pokémon +1 Strength at Levels 3–6 only.
  + (s.variant?.fireHalf && card.type === 'Fire' && card.level >= 3 ? 1 : 0);
// WA½ (V7f): Water Pokémon +1 Attack at Levels 3–6 only.
const waterAttack = (s, card) => (card.type === 'Water' && s.variant?.waterAttackHalf && card.level >= 3 ? 1 : 0);

// The Empowered summon's bonus, on the card.
function applyEmpower(card) {
  const e = card.empower;
  card.attack += e.attack ?? 0;
  card.strength += e.strength ?? 0;
  card.keywords = [...card.keywords, ...(e.keywords ?? [])];
}


// What a summon costs: the card's cost, plus the Empowered extra if chosen, less
// Wallace's Passive (the first Pokémon you summon into his lane each Round costs 1 less).
export function summonCost(card, empowered, state, who, space) {
  const extra = empowered && card.empower ? card.empower.cost : 0;
  const less = state && who && space !== undefined && wallaceDiscount(state, who, space) ? 1 : 0;
  // C1 experiment flag (V7d): no Pokémon costs less than 1.
  return Math.max(state?.variant?.minCost ?? 0, card.cost - less) + extra;
}
const wallaceDiscount = (state, who, space) => state.players[who].wallaceRound !== state.round && passiveSum(state, who, 'laneDiscount', space) > 0;

// --- Reading the state ---------------------------------------------------------------------------

// Speed: its tier, one higher per Quick Claw (never above Swift).
const speedOf = (card) => Math.min(SPEEDS.length - 1, SPEEDS.indexOf(card.speed) + (card.speedUp ?? 0));
const hasKeyword = (card, key) => (card.keywords ?? []).includes(key);
// A numbered keyword's total (Scorch 1 + Scorch 1 = Scorch 2; V6).
export const kwSum = (card, name) => (card?.keywords ?? []).reduce((n, k) => n + (Number(new RegExp(`^${name} (\\d+)$`).exec(k)?.[1]) || 0), 0);
// Whether a Pokémon has a keyword, from the card or a Trainer's lane Passive (Flannery).
function hasKw(s, who, space, name) {
  const card = s.players[who].row[space];
  if (!card) return false;
  return hasKeyword(card, name) || s.players[who].trainers.some((t) => tiersUnlocked(t) >= 1 && t.space === space
    && t.tiers[0].passive.kind === 'laneKeyword' && t.tiers[0].passive.keyword === name && (!t.tiers[0].passive.type || t.tiers[0].passive.type === card.type));
}
export const pokemonOf = (state, who) => state.players[who].row.map((card, space) => (card ? { space, card } : null)).filter(Boolean);
const allPokemon = (state) => PLAYERS.flatMap((who) => pokemonOf(state, who).map((p) => ({ ...p, who })));

// The highest Speed among all Active Pokémon on the board (both sides), or -1.
function alertTier(state) {
  return Math.max(-1, ...allPokemon(state).filter(({ card }) => !card.spent).map(({ card }) => speedOf(card)));
}
// Alert: Active, and of the highest Speed among all Active Pokémon. Only Alert Pokémon attack.
export const isAlert = (state, card) => !card.spent && speedOf(card) === alertTier(state);
export const alertSpaces = (state, who) => pokemonOf(state, who).filter(({ card }) => isAlert(state, card)).map(({ space }) => space);

// Where the Pokémon in `from` (a space in its own row) may attack: any enemy
// Pokémon or the enemy player character. Lane guards (V7, Elliott's design): a Defence
// Pokémon guards against Physical attackers and a Special Defence Pokémon against Special
// ones, but only in its own lane, so the enemy player can't be attacked by a Pokémon with
// a matching guard across from it. Every enemy Pokémon can always be attacked (one Pokémon
// per space). Infiltrator ignores guards. As { kind: 'pokemon', space } or { kind: 'player' }.
export function legalTargets(state, who, from) {
  const attacker = state.players[who].row[from];
  if (!attacker) return [];
  const enemy = pokemonOf(state, opponentOf(who));
  const all = [...enemy.map(({ space }) => ({ kind: 'pokemon', space })), { kind: 'player' }];
  if (hasKeyword(attacker, 'Infiltrator') || hasKw(state, who, from, 'Infiltrator')) return all;
  const guardType = { Physical: 'Defence', Special: 'Special Defence' }[attacker.attackType];
  const across = state.players[opponentOf(who)].row[from];
  return across?.strengthType === guardType ? all.filter((t) => t.kind !== 'player') : all;
}

// The Pokémon in hand this player can summon now: affordable, with an empty space.
export function playable(state, who) {
  const p = state.players[who];
  if (!p.row.includes(null)) return [];
  const discount = Array.from({ length: LANES }, (_, i) => i).some((i) => !p.row[i] && wallaceDiscount(state, who, i)) ? 1 : 0;
  return p.hand.filter((c) => c.cardType === 'Pokémon' && Math.max(state.variant?.minCost ?? 0, c.cost - discount) <= p.energy);
}

// Whether a Pass now ends the Battle Phase (the second Pass in a row): it gains nothing.
export const passEndsPhase = (state) => state.passesInARow >= 1;

// The Pokémon a Pass would make Spent: the passer's Active Pokémon at the top
// Speed when the opponent has none Active at that Speed (unmatched speed, as in v1).
export function passSpends(state, who) {
  if (state.phase !== 'battle' || passEndsPhase(state)) return [];
  const top = alertTier(state);
  if (top < 0) return [];
  const atTop = allPokemon(state).filter(({ card }) => !card.spent && speedOf(card) === top);
  if (atTop.some((p) => p.who !== who)) return [];
  return atTop.map(({ space }) => space);
}

// --- Locations (V2) -----------------------------------------------------------------------
//
// state.locations: [{ uid, id, name, owner, lanes: [lane indexes], roundsLeft, weather,
//   objective, milestones, completion, progress: { player, ai }, reached: { player: [at…],
//   ai: [at…] }, completed: { player, ai }, championship? }]
// A Location covers its lanes on both sides of the board. roundsLeft counts the
// current Round: it ticks down at Supper and the Location ends at 0.

export const locationAt = (state, lane) => state.locations.find((l) => l.lanes.includes(lane)) ?? null;
export const isHome = (state, lane) => !locationAt(state, lane);

// The lanes a Location of this width could start at: every lane it would cover is Home.
export function locationStarts(state, card) {
  const out = [];
  for (let start = 0; start + card.lanes <= LANES; start++) {
    if (Array.from({ length: card.lanes }, (_, i) => start + i).every((lane) => isHome(state, lane))) out.push(start);
  }
  return out;
}

// The Location cards in hand this player can play now (cost 0; they need free lanes).
export function placeable(state, who) {
  return state.players[who].hand.filter((c) => c.cardType === 'Location' && locationStarts(state, c).length);
}

// The Weather Tokens on the board: the sum over every Location in play.
export function weatherTotals(state) {
  const totals = { Rain: 0, Sun: 0 };
  for (const l of state.locations) for (const [kind, n] of Object.entries(l.weather ?? {})) totals[kind] = (totals[kind] ?? 0) + n;
  // Pokémon in play that carry Weather Tokens (V6: Wingull, Sunkern, Kyogre…).
  for (const who of PLAYERS) {
    for (const card of state.players[who].row) if (card?.weather) for (const [kind, n] of Object.entries(card.weather)) totals[kind] = (totals[kind] ?? 0) + n;
  }
  return totals;
}

// The Pokémon `who` has in a Location's lanes.
export const pokemonIn = (state, who, loc) => loc.lanes.filter((lane) => state.players[who].row[lane]).length;

export const championship = (state) => state.locations.find((l) => l.championship) ?? null;

// --- Effects, statuses and Weather (V4) ------------------------------------------------------------
//
// Target refs: { who, kind: 'pokemon', space } (a Pokémon in `who`'s row) or
// { who, kind: 'player' } (that player character). Specs and ops: cardtypes.js.

// Weather brackets (docs/decks.md 2.12, without Growth and Evolve until V6): a
// bracket is on while the combined count is at or above it.
export const bracket = (state, kind, n) => (weatherTotals(state)[kind] ?? 0) >= n;

// A Location's lanes, or (for Home) every lane no Location covers: Home is the
// starting location (1.1), so "its Location" for a Pokémon at Home is all of Home.
// Elliott's V6 rulings: at Home, "its Location" is only that Pokémon's own lane; "a
// chosen Location" is a real Location or a single Home lane (id 'home-<lane>').
export const homeLanes = (state) => Array.from({ length: LANES }, (_, i) => i).filter((i) => !locationAt(state, i));
export const lanesOf = (state, id) => (String(id).startsWith('home-') ? [Number(String(id).slice(5))] : state.locations.find((l) => l.uid === id)?.lanes ?? []);
export const locLanesAt = (state, lane) => (locationAt(state, lane)?.lanes ?? [lane]);

// The options for a target spec (cardtypes.js), for `who`. ctx: { space (the source's
// space), lane, attacker, target }. Scopes: 'location' (the source's Location), 'lane'.
export function targetOptions(state, who, spec, ctx = {}) {
  if (!spec) return [];
  if (spec.special === 'attacker') return ctx.attacker && state.players[ctx.attacker.who].row[ctx.attacker.space] ? [ctx.attacker] : [];
  if (spec.special === 'target') return ctx.target ? [ctx.target] : [];
  if (spec.special === 'self') return ctx.space !== undefined && state.players[who].row[ctx.space] ? [{ who, kind: 'pokemon', space: ctx.space }] : [];
  const side = spec.side === 'enemy' ? opponentOf(who) : who;
  const out = [];
  if (spec.kinds.includes('location')) {
    for (const l of state.locations) out.push({ who: side, kind: 'location', id: l.uid });
    for (const lane of homeLanes(state)) out.push({ who: side, kind: 'location', id: `home-${lane}` });
  }
  if (spec.kinds.includes('pokemon')) {
    const lanes = spec.scope === 'location' ? locLanesAt(state, ctx.space ?? 0) : spec.scope === 'lane' ? [ctx.lane ?? ctx.space] : null;
    for (const { space, card } of pokemonOf(state, side)) {
      if (lanes && !lanes.includes(space)) continue;
      if (spec.other && side === who && space === ctx.space) continue;
      if (spec.filter === 'canTrain' && card.level >= trainTop(card)) continue;
      if (spec.filter === 'canNurture' && (card.level >= trainTop(card) || card.nurturedRound === state.round)) continue;
      if (spec.filter === 'damaged' && card.currentStrength >= card.strength) continue;
      if (spec.filter === 'spent' && (!card.spent || card.asleep)) continue;
      if (spec.filter === 'unseeded' && card.seededBy) continue;
      if (spec.belowLevel !== undefined && card.level >= spec.belowLevel) continue;
      // Agility: never chosen as a target by a Strategy Card ("every" effects still reach it).
      if (spec.strategy && spec.count !== 'all' && hasKeyword(card, 'Agility')) continue;
      out.push({ who: side, kind: 'pokemon', space });
    }
  }
  if (spec.kinds.includes('player')) out.push({ who: side, kind: 'player' });
  return out;
}
const refKey = (t) => `${t.who}:${t.kind}:${t.space ?? t.id ?? ''}`;
// Whether a card with this target spec has something to work on.
export const canTarget = (state, who, spec, ctx) => !spec || targetOptions(state, who, spec, ctx).length > 0;

// The targets an effect works on: every option for 'all'; otherwise the chosen
// ones (1 up to the count, all different, all legal).
function chooseTargets(s, who, spec, targets, ctx) {
  if (!spec) return [];
  const options = targetOptions(s, who, spec, ctx);
  if (spec.count === 'all' || spec.special) return options;
  // An optional part ("also train 1 a friendly Pokémon") with nothing to work on is skipped.
  if (!options.length && spec.optional) return [];
  if (!options.length) throw new Error('There is no legal target');
  const list = targets ?? [];
  if (list.length < 1 || list.length > spec.count) throw new Error(spec.count === 1 ? 'Choose a target' : `Choose 1 to ${spec.count} targets`);
  if (new Set(list.map(refKey)).size !== list.length) throw new Error('Choose different targets');
  return list.map((t) => {
    const found = options.find((o) => refKey(o) === refKey(t));
    if (!found) throw new Error('That is not a legal target');
    return found;
  });
}

// For abilities that fire on their own (On Attack, On Evolve, On Breakfast…): the
// engine picks: an enemy Pokémon with the most Attack (not yet seeded, for Leech Seed),
// the most-damaged friendly Pokémon for healing, the lowest Level for training.
export function autoTargets(s, who, spec, ops = [], ctx = {}) {
  if (!spec || spec.count === 'all' || spec.special) return undefined;
  let options = targetOptions(s, who, spec, ctx);
  if (!options.length) return null;
  const card = (t) => (t.kind === 'pokemon' ? s.players[t.who].row[t.space] : null);
  const opNames = ops.map((o) => o.op);
  const score = (t) => {
    const c = card(t);
    if (t.kind === 'location') return lanesOf(s, t.id).filter((l) => s.players[t.who].row[l]).length;
    if (!c) return t.who === who ? -1 : 5;
    if (t.who !== who) return c.attack * 2 + c.currentStrength - (opNames.includes('leechSeed') && c.seededBy ? 50 : 0) - (opNames.includes('sleep') && c.asleep ? 50 : 0);
    if (opNames.includes('train')) return -c.level;
    return c.strength - c.currentStrength;
  };
  options = options.sort((a, b) => score(b) - score(a));
  return options.slice(0, spec.count);
}

// Strategy Cards: the breakpoints this player can pay now (affordable, with a target).
export const breakpointsFor = (state, who, card) => (card.breakpoints ?? [])
  .filter((b) => b.cost <= state.players[who].energy && canTarget(state, who, b.target) && !(b.needsGrowth && state.players[who].growth < 1)
    && opsPossible(state, who, b.ops));
// A card with nothing to pick can't be played (V6: Dive or Revive with no Pokémon in the
// Discard Pile, Burglar with an empty enemy Bag, Swimmer with nothing to free-summon,
// Escape Rope with no empty space). Search can always be played (the Draw Pile is hidden).
export function opsPossible(state, who, ops = []) {
  return ops.every((o) => {
    if (['returnFromDiscard', 'freeSummon'].includes(o.op)) return pickOptions(state, who, o).length > 0;
    if (o.op === 'stealItem') return pickOptions(state, who, o).length > 0 && state.players[who].bag.length < BAG_SIZE;
    if (o.op === 'moveTo') return state.players[who].row.includes(null);
    return true;
  });
}
export const playableStrategies = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Strategy' && breakpointsFor(state, who, c).length);
// Supporters: enough other cards in hand to Release, and a target.
export const supporterPlayable = (state, who, card) => state.players[who].hand.length - 1 >= card.release && (canTarget(state, who, card.target) || canTarget(state, who, card.favour?.target ?? card.target))
  && opsPossible(state, who, card.ops);
export const playableSupporters = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Supporter' && supporterPlayable(state, who, c));
// Items: usable now (a target), and from hand affordable (used now, or into the Bag if it has room).
export const itemUsable = (state, who, item) => canTarget(state, who, item.target) && opsPossible(state, who, item.ops);
export const bagFull = (state, who) => state.players[who].bag.length >= BAG_SIZE;
export const playableItems = (state, who) => state.players[who].hand.filter((c) => c.cardType === 'Item' && c.cost <= state.players[who].energy
  && (itemUsable(state, who, c) || !bagFull(state, who)));
export const usableBagItems = (state, who) => state.players[who].bag.filter((c) => itemUsable(state, who, c));
// --- Trainers (V5) -------------------------------------------------------------------------------
//
// p.trainers: [{ …card, uid, space, points, abilityRound }]. Tiers unlock at their
// costs (points assigned at the Breakfast assign step). One Trainer per space
// (Claude's placeholder); a Pokémon may stand in the same space.
export const tiersUnlocked = (t) => t.tiers.filter((tier) => t.points >= tier.cost).length;
export const trainerAt = (state, who, space) => state.players[who].trainers.find((t) => t.space === space) ?? null;
export const freeSpaces = (state, who) => state.players[who].row.map((c, i) => (c ? null : i)).filter((i) => i !== null);
export const trainerSpaces = (state, who) => Array.from({ length: LANES }, (_, i) => i).filter((i) => !trainerAt(state, who, i));
export const playableTrainers = (state, who) => (trainerSpaces(state, who).length
  ? state.players[who].hand.filter((c) => c.cardType === 'Trainer' && c.cost <= state.players[who].energy) : []);
export const canMoveTrainer = (state, who) => !state.players[who].movedTrainer && state.players[who].trainers.length > 0 && trainerSpaces(state, who).length > 0;
// Abilities usable now: unlocked, affordable, not yet used this Round, with a target.
export const usableAbilities = (state, who) => state.players[who].trainers.filter((t) => {
  const ab = t.tiers[1].ability;
  return tiersUnlocked(t) >= 2 && t.abilityRound !== state.round && ab.cost <= state.players[who].energy && canTarget(state, who, ab.target, { space: t.space, lane: t.space })
    && (!ab.ops.some((o) => o.op === 'returnFromDiscard') || pickOptions(state, who, ab.ops.find((o) => o.op === 'returnFromDiscard')).length > 0);
});
// Whether a player takes part in the assign step: Trainer Points, and a Trainer that can still use them.
export const needsAssign = (state, who) => {
  const p = state.players[who];
  return p.trainerPoints > 0 && p.trainers.some((t) => t.points < t.tiers[2].cost);
};
// The sum of a Passive kind over your Trainers (that have it unlocked), optionally at a space.
export function passiveSum(s, who, kind, space, filter = () => true) {
  return s.players[who].trainers.map((t) => ({ t, pv: passiveOf(s, t) })).filter(({ t, pv }) => tiersUnlocked(t) >= 1 && pv.kind === kind
    && (space === undefined || t.space === space) && filter(pv)).reduce((n, { pv }) => n + pv.amount, 0);
}
// A Trainer's Passive; the ER experiment flag (V7b) turns Erika's lane training into +1 Strength.
const passiveOf = (s, t) => (s.variant?.erikaStrength && t.tiers[0].passive.kind === 'laneTrain' ? { kind: 'laneStrength', amount: 1 } : t.tiers[0].passive);
// Shell N: each instance of damage this Pokémon takes is N less, minimum 1.
export function shellOf(s, who, space) {
  const card = s.players[who].row[space];
  if (!card) return 0;
  const printed = card.keywords.reduce((n, k) => n + (Number(/^Shell (\d+)$/.exec(k)?.[1]) || 0), 0);
  return printed + (card.shellRound ?? 0) + passiveSum(s, who, 'spaceShell', space);
}
const afterShell = (amount, shell) => (amount > 0 ? Math.max(1, amount - shell) : 0);

// Passives that change stats (Misty's lane Strength): kept in step with the board after
// every action. Losing the bonus never defeats a Pokémon (at least 1 Strength is left).
function syncPassives(s) {
  for (const who of PLAYERS) {
    for (const { space, card } of pokemonOf(s, who)) {
      const typed = (pv) => !pv.type || pv.type === card.type;
      // Misty (V6): her +1/+1 adds Attack as well as Strength.
      const wantA = passiveSum(s, who, 'laneAttack', space, typed) + passiveSum(s, who, 'laneStrength', space, (pv) => typed(pv) && pv.alsoAttack);
      card.attack += wantA - (card.passiveAttack ?? 0);
      card.passiveAttack = wantA;
      const want = passiveSum(s, who, 'laneStrength', space, typed);
      const have = card.passiveStrength ?? 0;
      if (want === have) continue;
      card.strength += want - have;
      card.currentStrength = want > have ? card.currentStrength + (want - have) : Math.max(1, Math.min(card.currentStrength, card.strength));
      card.passiveStrength = want;
    }
  }
}

// Nurture (V6, Grass): spend 2 Growth (Gardenia's lane: 1 less) to train 1 one of your
// Pokémon, once per Pokémon per Round. A Battle Action, 0 Energy.
// Experiment flags (V7b, off by default): N3 (cost 3), N1 (once per Round in total),
// NR (never above the Round number + 1).
export const nurtureCost = (state, who, space) => Math.max(0, (state.variant?.nurtureCost ?? 2) - passiveSum(state, who, 'nurtureDiscount', space));
export const nurtureSpaces = (state, who) => (state.variant?.nurtureOnce && state.players[who].nurturedRound === state.round ? []
  : pokemonOf(state, who).filter(({ space, card }) => card.level < trainTop(card)
    && card.nurturedRound !== state.round && !(state.variant?.nurtureRoundCap && card.level >= state.round + 1)
    && state.players[who].growth >= nurtureCost(state, who, space)).map(({ space }) => space));

// The Favour: met if a Released card meets the Supporter's condition.
export const favourMet = (card, released) => !!card.favour && released.some((c) => FAVOURS[card.favour.condition].test(c));

export function legalActions(state, who) {
  // A waiting choice (an On Evolve target) comes before anything else.
  if (state.choices?.length && state.phase !== 'gameOver') return state.choices[0].who === who ? ['chooseTarget'] : [];
  if (state.phase === 'initiative') return ['flipCoin'];
  if (state.phase === 'assign') return needsAssign(state, who) && !state.assign?.[who] ? ['assignPoints'] : [];
  if (state.phase !== 'battle' || state.turn !== who) return [];
  return [
    'pass',
    ...(playable(state, who).length ? ['summon'] : []),
    ...(placeable(state, who).length ? ['playLocation'] : []),
    ...(playableStrategies(state, who).length ? ['playStrategy'] : []),
    ...(playableSupporters(state, who).length ? ['playSupporter'] : []),
    ...(playableItems(state, who).length ? ['playItem'] : []),
    ...(usableBagItems(state, who).length ? ['useItem'] : []),
    ...(playableTrainers(state, who).length ? ['playTrainer'] : []),
    ...(canMoveTrainer(state, who) ? ['moveTrainer'] : []),
    ...(usableAbilities(state, who).length ? ['useAbility'] : []),
    ...(state.players[who].waiting.length && freeSpaces(state, who).length ? ['placePartner'] : []),
    ...(nurtureSpaces(state, who).length ? ['nurture'] : []),
    ...(alertSpaces(state, who).some((s) => legalTargets(state, who, s).length) ? ['attack'] : []),
  ];
}

// Who acts next: the coin flip (the player), the assign step (each player that still
// has to lock in), or the player whose turn it is.
export function actor(state) {
  if (state.choices?.length && state.phase !== 'gameOver') return state.choices[0].who;
  if (state.phase === 'initiative') return 'player';
  if (state.phase === 'assign') return PLAYERS.find((w) => legalActions(state, w).length) ?? null;
  return state.turn;
}

// --- Actions ---------------------------------------------------------------------------------------

export function applyAction(state, action) {
  const s = structuredClone(state);
  s.events = [];
  if (!legalActions(s, action.who ?? s.turn).includes(action.type) && action.type !== 'flipCoin') {
    throw new Error(`${action.who} cannot ${action.type} now`);
  }
  if (action.type === 'flipCoin' && s.phase !== 'initiative') throw new Error('The coin has been flipped');
  withCause(causeOf(s, action), () => ACTIONS[action.type](s, action));
  syncPassives(s);
  return s;
}

// What caused a Growth gain or a training (V7b, for the diagnostics only): set for the
// length of an action, a triggered ability or Erika's Breakfast training; carried on the
// 'growth' and 'trained' events. Never read by the rules.
let CAUSE = null;
function withCause(cause, fn) {
  const before = CAUSE;
  CAUSE = cause;
  try { return fn(); } finally { CAUSE = before; }
}
function causeOf(s, a) {
  const p = s.players[a.who];
  if (!p) return a.type;
  const name = (list) => list.find((c) => c.uid === a.uid)?.name;
  switch (a.type) {
    case 'playStrategy': return `strategy:${name(p.hand)}`;
    case 'playSupporter': return `supporter:${name(p.hand)}`;
    case 'playItem': return `item:${name(p.hand)}`;
    case 'useItem': return `item:${name(p.bag)}`;
    case 'useAbility': return `trainer:${name(p.trainers)}`;
    case 'summon': { const c = p.hand.find((x) => x.uid === a.uid); return `ability:${c?.series ?? c?.name}`; }
    default: return a.type;
  }
}

const ACTIONS = {
  flipCoin(s) {
    const winner = nextRandom(s) < 0.5 ? 'player' : 'ai';
    s.initiative = winner;
    emit(s, 'coinFlip', { winner });
    log(s, `Coin flip: ${nm(winner)} ${vb(winner, 'have', 'has')} initiative in Round 1.`);
    startRound(s, 1);
  },

  // Summon a Pokémon from hand into an empty space of your row, paying its cost.
  // It arrives Spent (Quick Attack: Active).
  // Empowered (only on Pokémon that have it): pay the extra Energy for its bonus.
  // It stays at the Level it is played at (frozen).
  summon(s, { who, uid, space, empowered = false, targets, picks }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!(space >= 0 && space < LANES) || p.row[space]) throw new Error('Choose an empty space in your row');
    if (empowered && !card.empower) throw new Error(`${card.name} has no Empowered summon`);
    const cost = summonCost(card, empowered, s, who, space);
    if (cost > p.energy) throw new Error(`Not enough Energy for ${card.name}${empowered ? ' (Empowered)' : ''}`);
    if (wallaceDiscount(s, who, space)) p.wallaceRound = s.round;
    p.energy -= cost;
    p.hand = p.hand.filter((c) => c !== card);
    placeSummoned(s, who, { ...card, empowered: !!empowered }, space, { targets, picks, cost, mustChoose: true });
    if (over(s)) return;
    endTurn(s, who, false);
  },

  // Play a Location (cost 0) over free Home lanes, from `start` to the right. It
  // covers those lanes on both sides; Pokémon already there are now in it.
  playLocation(s, { who, uid, start }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Location') throw new Error('Choose a Location from your hand');
    if (!locationStarts(s, card).includes(start)) throw new Error(`${card.name} needs ${card.lanes} free Home lane${card.lanes > 1 ? 's' : ''} there`);
    p.hand = p.hand.filter((c) => c !== card);
    const loc = enterLocation(s, card, who, Array.from({ length: card.lanes }, (_, i) => start + i));
    emit(s, 'locationPlaced', { who, uid: loc.uid, name: card.name, lanes: loc.lanes });
    log(s, `${p.name} placed ${card.name} over lane${loc.lanes.length > 1 ? 's' : ''} ${loc.lanes.map((l) => l + 1).join('–')} (${card.rounds} Rounds): ${card.objective.text}.`);
    endTurn(s, who, false);
  },

  // Play a Strategy Card, paying one of its breakpoint amounts (pay): that
  // breakpoint's effect, on the chosen targets. It goes to the discard pile.
  playStrategy(s, { who, uid, pay, targets, x, picks }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Strategy') throw new Error('Choose a Strategy Card from your hand');
    const bp = card.breakpoints.find((b) => b.cost === pay);
    if (!bp) throw new Error(`${card.name} can only be paid ${card.breakpoints.map((b) => b.cost).join(', ')}`);
    if (pay > p.energy) throw new Error(`Not enough Energy for ${card.name} at ${pay}`);
    chooseTargets(s, who, bp.target, targets);   // checked before paying
    const amount = growthAmount(s, who, bp, x);
    p.energy -= pay;
    p.hand = p.hand.filter((c) => c !== card);
    p.discard.push(card);
    emit(s, 'strategy', { who, uid, id: card.id, name: card.name, pay, level: card.breakpoints.indexOf(bp), levels: card.breakpoints.length, text: bp.text });
    log(s, `${p.name} played ${card.name} for ${pay} Energy: ${bp.text}.`);
    runEffect(s, who, bp.target, bp.ops, targets, { x: amount, picks });
    endTurn(s, who, false);
  },

  // Nurture (V6): spend Growth to train 1 one of your Pokémon (once per Pokémon per Round).
  nurture(s, { who, space }) {
    const p = s.players[who];
    if (!nurtureSpaces(s, who).includes(space)) throw new Error('Nurture one of your Pokémon that can still train (not yet Nurtured this Round), with enough Growth');
    const cost = nurtureCost(s, who, space);
    p.growth -= cost;
    p.row[space].nurturedRound = s.round;
    p.nurturedRound = s.round;
    emit(s, 'nurtured', { who, space, name: p.row[space].name, cost });
    log(s, `${p.name} Nurtured ${p.row[space].name} (${cost} Growth).`);
    withCause('nurture', () => train(s, who, space, 1));
    endTurn(s, who, false);
  },

  // Play a Supporter: Release the chosen cards from hand (exactly its Release cost),
  // then the effect (improved if a Released card meets the Favour), then the
  // Supporter itself is Released. No once-per-Round limit.
  playSupporter(s, { who, uid, release = [], targets, picks }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Supporter') throw new Error('Choose a Supporter from your hand');
    if (release.length !== card.release || new Set(release).size !== release.length) throw new Error(`${card.name}: Release exactly ${card.release} card${card.release === 1 ? '' : 's'}`);
    const paid = release.map((r) => p.hand.find((c) => c.uid === r && c !== card));
    if (paid.some((c) => !c)) throw new Error('Release cards from your hand (not the Supporter itself)');
    const favour = favourMet(card, paid);
    const ops = favour ? card.favour.ops : card.ops;
    const target = favour && 'target' in card.favour ? card.favour.target : card.target;
    chooseTargets(s, who, target, targets);
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c));
    p.released.push(...paid.map(plainCard));
    emit(s, 'supporter', { who, uid, id: card.id, name: card.name, released: paid.map((c) => c.name), favour });
    log(s, `${p.name} played ${card.name}, Releasing ${paid.map((c) => c.name).join(' and ')}${favour ? ` (Favour: ${FAVOURS[card.favour.condition].text}: ${card.favour.text})` : ''}.`);
    // Meeting the Favour with a Trainer in play earns a Trainer Point (V5).
    if (favour && p.trainers.length) gainTrainerPoints(s, who, 1, `${card.name}'s Favour`);
    runEffect(s, who, target, ops, targets, { picks });
    p.released.push(card);
    emit(s, 'released', { who, uid, name: card.name });
    endTurn(s, who, false);
  },

  // Play an Item from hand, paying its Energy cost: use it now (mode 'use') or put
  // it into the Bag (mode 'bag').
  playItem(s, { who, uid, mode = 'use', targets, picks }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Item') throw new Error('Choose an Item from your hand');
    if (card.cost > p.energy) throw new Error(`Not enough Energy for ${card.name}`);
    if (mode === 'bag' && bagFull(s, who)) throw new Error('Your Bag is full');
    if (mode === 'use') chooseTargets(s, who, card.target, targets);
    p.energy -= card.cost;
    p.hand = p.hand.filter((c) => c !== card);
    if (mode === 'bag') {
      p.bag.push(card);
      emit(s, 'bagged', { who, uid, name: card.name });
      log(s, `${p.name} put ${card.name} into the Bag (${card.cost} Energy).`);
    } else {
      log(s, `${p.name} played ${card.name} (${card.cost} Energy).`);
      useItemCard(s, who, card, targets, picks);
    }
    endTurn(s, who, false);
  },

  // Use an Item from the Bag (cost 0).
  useItem(s, { who, uid, targets, picks }) {
    const p = s.players[who];
    const card = p.bag.find((c) => c.uid === uid);
    if (!card) throw new Error('Choose an Item in your Bag');
    chooseTargets(s, who, card.target, targets);
    p.bag = p.bag.filter((c) => c !== card);
    useItemCard(s, who, card, targets, picks);
    endTurn(s, who, false);
  },

  // Play a Trainer (V5): pay its cost and attach it to one of your spaces (one
  // Trainer per space; a Pokémon may stand there too).
  playTrainer(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Trainer') throw new Error('Choose a Trainer from your hand');
    if (card.cost > p.energy) throw new Error(`Not enough Energy for ${card.name}`);
    if (!(space >= 0 && space < LANES) || trainerAt(s, who, space)) throw new Error('Choose one of your spaces without a Trainer');
    p.energy -= card.cost;
    p.hand = p.hand.filter((c) => c !== card);
    p.trainers.push({ ...card, space, points: 0, abilityRound: 0 });
    emit(s, 'trainerPlayed', { who, uid, name: card.name, space });
    log(s, `${p.name} played ${card.name} at space ${space + 1} (${card.cost} Energy).`);
    endTurn(s, who, false);
  },

  // Move one of your Trainers to another of your spaces: once per Round, a Battle Action.
  moveTrainer(s, { who, uid, space }) {
    const p = s.players[who];
    const t = p.trainers.find((x) => x.uid === uid);
    if (!t) throw new Error('Choose one of your Trainers');
    if (!(space >= 0 && space < LANES) || trainerAt(s, who, space)) throw new Error('Choose one of your spaces without a Trainer');
    const from = t.space;
    t.space = space;
    p.movedTrainer = true;
    emit(s, 'trainerMoved', { who, uid, name: t.name, from, to: space });
    log(s, `${p.name} moved ${t.name} from space ${from + 1} to space ${space + 1}.`);
    endTurn(s, who, false);
  },

  // A Trainer's Ability (its second tier): its Energy cost, once per Round per Trainer.
  useAbility(s, { who, uid, targets, picks }) {
    const p = s.players[who];
    const t = p.trainers.find((x) => x.uid === uid);
    if (!t || tiersUnlocked(t) < 2) throw new Error('That Trainer has no Ability unlocked');
    if (t.abilityRound === s.round) throw new Error(`${t.name}'s Ability was used this Round`);
    const ab = t.tiers[1].ability;
    if (ab.cost > p.energy) throw new Error(`Not enough Energy for ${t.name}'s Ability`);
    const tctx = { space: t.space, lane: t.space, picks };
    chooseTargets(s, who, ab.target, targets, tctx);
    p.energy -= ab.cost;
    t.abilityRound = s.round;
    emit(s, 'abilityUsed', { who, uid, name: t.name, text: t.tiers[1].text });
    log(s, `${p.name} used ${t.name}'s Ability: ${t.tiers[1].text}.`);
    runEffect(s, who, ab.target, ab.ops, targets, tctx);
    endTurn(s, who, false);
  },

  // A waiting Partner arrives in a free space you choose (not a Battle Action).
  placePartner(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.waiting.find((c) => c.uid === uid);
    if (!card) throw new Error('No such Partner is waiting');
    if (!(space >= 0 && space < LANES) || p.row[space]) throw new Error('Choose a free space of yours');
    p.waiting = p.waiting.filter((c) => c !== card);
    partnerInto(s, who, card, space);
  },

  // The Breakfast assign step: lock in how many Trainer Points each Trainer gets. Both
  // players choose at once; nothing is revealed or applied until both have locked in.
  assignPoints(s, { who, points = {} }) {
    const p = s.players[who];
    let total = 0;
    for (const [uid, n] of Object.entries(points)) {
      const t = p.trainers.find((x) => x.uid === uid);
      if (!t) throw new Error('Assign points to your Trainers in play');
      if (!Number.isInteger(n) || n < 0) throw new Error('Assign whole points');
      if (t.points + n > t.tiers[2].cost) throw new Error(`${t.name} needs only ${t.tiers[2].cost - t.points} more`);
      total += n;
    }
    if (total > p.trainerPoints) throw new Error(`You have ${p.trainerPoints} Trainer Points`);
    s.assign[who] = { ...points };
    emit(s, 'assignLocked', { who });
    if (PLAYERS.every((w) => s.assign[w] || !needsAssign(s, w))) resolveAssign(s);
  },

  // Choose the target for a waiting On Evolve (not a Battle Action: play goes on).
  chooseTarget(s, { who, targets }) {
    const c = s.choices[0];
    if (!c || c.who !== who) throw new Error('Nothing to choose');
    const options = targetOptions(s, who, c.spec, c.ctx);
    s.choices.shift();
    if (!options.length) return;   // nothing left to work on
    runEffect(s, who, c.spec, c.ops, targets, c.ctx);
  },

  // Attack with an Alert Pokémon (from: its space). A Pokémon target that is also
  // Alert hits back (a trade); both become Spent. Damage to the enemy player
  // character becomes the attacker's Recognition.
  attack(s, { who, from, target }) {
    const p = s.players[who];
    const foe = opponentOf(who);
    const attacker = p.row[from];
    if (!attacker || !isAlert(s, attacker)) throw new Error('Choose one of your Alert Pokémon');
    if (!legalTargets(s, who, from).some((t) => t.kind === target?.kind && t.space === target.space)) throw new Error('That is not a legal target');
    const ref = target.kind === 'player' ? { who: foe, kind: 'player' } : { who: foe, kind: 'pokemon', space: target.space };
    const scorch = kwSum(attacker, 'Scorch');
    if (target.kind === 'player') {
      const amount = attackDamage(s, attacker, s.players[foe]);
      attacker.spent = true;
      p.recognition += amount;
      emit(s, 'attack', { who, from, target: { kind: 'player', who: foe }, amount, attacker: attacker.name });
      emit(s, 'recognition', { who, amount, total: p.recognition, source: 'attack' });
      log(s, `${poss(who)} ${attacker.name} attacked ${vb(who, 'the Opponent', 'you')} directly for ${amount}: +${amount} Recognition (now ${p.recognition}).`);
      if (p.recognition >= targetOf(s)) return win(s, who);
      // Scorch also burns the enemy player character it hits (V6).
      if (scorch && amount > 0) applyBurn(s, ref, scorch, who, from);
      progressAt(s, who, 'attack', from);
      progressAt(s, who, 'damage', from, amount);
      fireTrigger(s, who, from, 'onAttack', { target: ref });
      if (over(s)) return;
      return endTurn(s, who, false);
    }
    const defender = s.players[foe].row[target.space];
    const trades = isAlert(s, defender);   // decided before anyone becomes Spent
    const left = defender.currentStrength;
    const hit = afterShell(attackDamage(s, attacker, defender), shellOf(s, foe, target.space));
    const back = trades ? afterShell(defender.attack, shellOf(s, who, from)) : 0;
    defender.currentStrength -= hit;
    defender.asleep = false;   // damage wakes a sleeping Pokémon (it stays Spent)
    if (trades) attacker.currentStrength -= back;
    // Retaliate X: the attacker takes X when it damages this Pokémon (Shell reduces it).
    const retaliate = hit > 0 ? kwSum(defender, 'Retaliate') : 0;
    const retaliated = retaliate ? afterShell(retaliate, shellOf(s, who, from)) : 0;
    attacker.currentStrength -= retaliated;
    attacker.spent = true;
    if (trades) defender.spent = true;
    emit(s, 'attack', { who, from, target: { kind: 'pokemon', who: foe, space: target.space }, amount: hit, attacker: attacker.name, defender: defender.name, trades, back, retaliated });
    log(s, `${poss(who)} ${attacker.name} attacked ${defender.name} for ${hit}${trades ? `; ${defender.name} was Alert and hit back for ${back}` : ''}${retaliated ? `; Retaliate: ${retaliated} back` : ''}.`);
    progressAt(s, who, 'attack', from);
    const defenderDown = defender.currentStrength <= 0;
    const attackerDown = attacker.currentStrength <= 0;
    // Overrun (V6): when its attack defeats the target, the damage left over goes to the
    // enemy player character (as Recognition), as v1's went to the Trainer behind.
    if (defenderDown && hasKw(s, who, from, 'Overrun') && hit - left > 0) {
      const over2 = hit - left;
      p.recognition += over2;
      emit(s, 'recognition', { who, amount: over2, total: p.recognition, overrun: true, source: 'overrun' });
      log(s, `Overrun: ${over2} more to ${vb(who, 'the Opponent', 'you')} (+${over2} Recognition).`);
      if (p.recognition >= targetOf(s)) return win(s, who);
    }
    // Scorch: its own attack burns the target, if it's still in play.
    if (scorch && hit > 0 && !defenderDown) applyBurn(s, ref, scorch, who, from);
    // Rage: +1 Attack each time it survives damage.
    if (!defenderDown && hit > 0) rage(s, foe, target.space);
    if (!attackerDown && back + retaliated > 0) rage(s, who, from);
    defeat(s, foe, target.space, who, from);
    defeat(s, who, from, foe, target.space);
    if (over(s)) return;
    // Survivors: On Attack, On Defend; then On Knockout (not for a Retaliate defeat).
    if (!attackerDown) fireTrigger(s, who, from, 'onAttack', { target: ref });
    if (!defenderDown && hit > 0) fireTrigger(s, foe, target.space, 'onDefend', { attacker: { who, kind: 'pokemon', space: from } });
    if (defenderDown && !attackerDown) fireTrigger(s, who, from, 'onKnockout');
    if (attackerDown && !defenderDown && back > 0 && attacker.currentStrength + retaliated <= 0) fireTrigger(s, foe, target.space, 'onKnockout');
    if (over(s)) return;
    endTurn(s, who, false);
  },

  // Pass: +1 Energy, unless it is the second Pass in a row (that ends the Battle
  // Phase). Unmatched speed: the passer's top-Speed Active Pokémon become Spent.
  pass(s, { who }) {
    const p = s.players[who];
    const ends = passEndsPhase(s);
    const spends = passSpends(s, who);
    if (!ends) {
      p.energy += PASS_ENERGY;
      for (const space of spends) p.row[space].spent = true;
    }
    emit(s, 'pass', { who, endsPhase: ends, gain: ends ? 0 : PASS_ENERGY, spends });
    log(s, ends ? `${p.name} passed: no Energy (the other player passed last). The Battle Phase ends.` : `${p.name} passed: +${PASS_ENERGY} Energy.`);
    endTurn(s, who, true);
  },
};

// A Pokémon at 0 Strength or below is defeated: it goes to the Released Pile.
// The defeat counts for `by` (the attacker, or the Alert defender that hit back),
// in the Location over `byLane` (where that Pokémon stands).
function defeat(s, who, space, by, byLane) {
  const card = s.players[who].row[space];
  if (!card || card.currentStrength > 0) return;
  s.players[who].row[space] = null;
  if (card.held) returnToPool(s, card.held);
  if (!card.partner) s.players[who].released.push(plainCard(card));   // a Partner leaves the game
  emit(s, 'defeated', { who, space, name: card.name });
  log(s, `${poss(who)} ${card.name} was defeated.`);
  if (by) progressAt(s, by, 'defeat', byLane);
  // On Defeated (Sewaddle): it fires as it leaves play.
  const eff = card.ability?.onDefeated;
  if (eff && !over(s)) runEffect(s, who, eff.target, eff.ops, autoTargets(s, who, eff.target, eff.ops, { space }) ?? undefined, { space, source: card });
}

// Reaching 60 Recognition wins at once (the first to get there; later gains in the
// same action don't change it).
function win(s, who) {
  if (s.phase === 'gameOver') return;
  endMatch(s, who, 'target', `${nm(who)} reached ${targetOf(s)} Recognition and ${vb(who, 'win', 'wins')}!`);
}

// result.reason: 'target' (60 Recognition), 'recognition' (the most after Round 12),
// 'championship' (a tie broken by Championship progress), 'suddenDeath', 'draw'.
function endMatch(s, winner, reason, line) {
  s.phase = 'gameOver';
  s.winner = winner;
  s.turn = null;
  s.result = { winner, reason, round: s.round, recognition: { player: s.players.player.recognition, ai: s.players.ai.recognition } };
  emit(s, 'gameOver', { winner, reason, recognition: winner ? s.players[winner].recognition : null });
  log(s, line);
}

const over = (s) => s.phase === 'gameOver';

// --- Objectives ---------------------------------------------------------------------------------

function enterLocation(s, card, owner, lanes) {
  const loc = {
    uid: `loc-${s.nextLocation++}`, id: card.id, name: card.name, owner, card, lanes,
    roundsLeft: card.rounds, weather: { ...card.weather }, color: card.color, image: card.image ?? `assets/cards/${card.art ?? card.id}.jpg`,
    objective: card.objective, milestones: card.milestones, completion: card.completion,
    championship: !!card.championship, placedRound: s.round, deck: card.deck ?? null,
    progress: { player: 0, ai: 0 }, reached: { player: [], ai: [] }, completed: { player: false, ai: false },
  };
  // W2 (variant): Water's Locations last 1 Round longer, and each milestone gives +1 Recognition.
  if (s.variant?.waterLocations && card.deck === 'water') {
    loc.roundsLeft += 1;
    loc.milestones = loc.milestones.map((m) => ({ ...m, reward: { ...m.reward, recognition: (m.reward.recognition ?? 0) + 1 } }));
  }
  s.locations.push(loc);
  return loc;
}

// Progress on an objective in the Location over `lane` (where the Pokémon doing it stands).
function progressAt(s, who, kind, lane, amount = 1) {
  const loc = locationAt(s, lane);
  if (loc && loc.objective.kind === kind && !over(s)) advance(s, who, loc, loc.progress[who] + amount);
}

// Set a player's progress (capped at the objective's count) and pay any milestone
// or completion reached. Each is paid once per player.
function advance(s, who, loc, value) {
  if (over(s) || loc.completed[who]) return;
  const before = loc.progress[who];
  loc.progress[who] = Math.min(loc.objective.count, Math.max(before, value));
  if (loc.progress[who] === before) return;
  emit(s, 'progress', { who, location: loc.uid, name: loc.name, progress: loc.progress[who], count: loc.objective.count });
  for (const m of loc.milestones) {
    if (loc.progress[who] >= m.at && !loc.reached[who].includes(m.at) && !over(s)) {
      loc.reached[who].push(m.at);
      emit(s, 'milestone', { who, location: loc.uid, name: loc.name, at: m.at, count: loc.objective.count, reward: m.reward, championship: loc.championship });
      log(s, `${nm(who)} reached a milestone at ${loc.name} (${m.at}/${loc.objective.count}): ${rewardText(m.reward)}.`);
      reward(s, who, m.reward, loc);
    }
  }
  if (loc.progress[who] >= loc.objective.count && !over(s)) {
    loc.completed[who] = true;
    emit(s, 'completed', { who, location: loc.uid, name: loc.name, reward: loc.completion, championship: loc.championship });
    log(s, `${nm(who)} completed ${loc.name}: ${rewardText(loc.completion)}.`);
    reward(s, who, loc.completion, loc);
  }
}

// A reward: +Recognition now (60 still wins at once), +Energy at the next Breakfast,
// or cards drawn now.
function reward(s, who, r = {}, loc = null) {
  const p = s.players[who];
  // Floaroma Meadow: heal each of your Pokémon in this Location.
  if (r.healHere && loc) for (const lane of loc.lanes) if (p.row[lane]) healPokemon(s, who, lane, r.healHere);
  if (r.energy) p.bonusNext += r.energy;
  if (r.draw) draw(s, who, r.draw);
  for (let i = 0; i < (r.item ?? 0); i++) findItem(s, who);
  if (r.trainerPoints) gainTrainerPoints(s, who, r.trainerPoints, 'a Location');
  if (r.recognition) {
    // L+ (variant): Location Recognition rewards ×1.5, rounded up.
    const amount = s.variant?.locMult ? Math.ceil(r.recognition * s.variant.locMult) : r.recognition;
    p.recognition += amount;
    emit(s, 'recognition', { who, amount, total: p.recognition, reward: true, source: loc?.championship ? 'championship' : 'location' });
    if (p.recognition >= targetOf(s)) win(s, who);
  }
}

// A Location ends: removed from the board, its lanes become Home again, and its
// card goes to its owner's discard pile (the Championship belongs to no one).
function endLocation(s, loc, why) {
  s.locations = s.locations.filter((l) => l !== loc);
  if (loc.owner) s.players[loc.owner].discard.push(loc.card);
  emit(s, 'locationEnded', { uid: loc.uid, name: loc.name, lanes: loc.lanes, why });
  log(s, why === 'championship' ? `${loc.name} ends: the Championship has arrived.` : `${loc.name}'s time is up: its lanes are Home again.`);
}

// The Championship arrives (start of Round 10): every other Location ends
// (milestones already earned are kept), and it covers all 9 lanes.
function arriveChampionship(s) {
  for (const loc of [...s.locations]) endLocation(s, loc, 'championship');
  const loc = enterLocation(s, CHAMPIONSHIP, null, Array.from({ length: LANES }, (_, i) => i));
  loc.roundsLeft = ROUND_LIMIT - s.round + 1;
  emit(s, 'championship', { uid: loc.uid, round: s.round });
  log(s, `The Championship arrives! ${CHAMPIONSHIP.objective.text}. It runs to the end of Round ${ROUND_LIMIT}.`);
}

function endTurn(s, who, passed) {
  if (over(s)) return;
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
  emit(s, 'turnChanged', { who: s.turn });
}

// --- Phases --------------------------------------------------------------------------------------

// Breakfast: the Championship arrives in Round 10; Spent Pokémon become Active;
// each player draws 7 (on top of kept Retain cards); and Energy is the Round
// number (up to 10) plus what was stored plus any milestone Energy. Then the Battle Phase.
function startRound(s, round) {
  s.round = round;
  emit(s, 'phaseChanged', { phase: 'breakfast', round });
  log(s, `Round ${round}${s.suddenDeath ? ' (sudden death)' : ''} · Breakfast.`);
  if (round === champRoundOf(s) && !championship(s)) arriveChampionship(s);
  for (const who of PLAYERS) {
    const p = s.players[who];
    // "Until your next Breakfast" buffs end (Brock); an Asleep Pokémon stays Spent this Breakfast, then wakes.
    expireBuffs(s, who, 'breakfast');
    for (const card of p.row) if (card) { card.spent = !!card.asleep; card.asleep = false; }
    followRound(s, who);
    draw(s, who, HAND_SIZE);
    p.roundEnergy = baseEnergyFor(round);
    p.bonus = p.bonusNext;
    p.bonusNext = 0;
    p.energy = p.roundEnergy + p.stored + p.bonus;
    log(s, `${p.name}: ${p.roundEnergy} Energy${p.stored ? ` + ${p.stored} stored` : ''}${p.bonus ? ` + ${p.bonus} from milestones` : ''}.`);
    // Regenerate N (a Held Item's keyword): heals N at Breakfast.
    for (const { space, card } of pokemonOf(s, who)) {
      const n = regenerateOf(card);
      if (n) healPokemon(s, who, space, n);
    }
    // Sun 4: each player gains 1 Growth. Then On Breakfast abilities.
    if (bracket(s, 'Sun', 4)) gainGrowth(s, who, 1, 'Sun 4');
    for (const { space } of pokemonOf(s, who)) fireTrigger(s, who, space, 'onBreakfast');
    // Erika's Passive: your Pokémon in her lane train at Breakfast.
    for (const { space } of pokemonOf(s, who)) {
      const n = passiveSum(s, who, 'laneTrain', space);
      if (n) withCause('trainer:Erika', () => train(s, who, space, n));
    }
    p.movedTrainer = false;
  }
  // The assign step (after drawing): both players assign Trainer Points at once.
  if (PLAYERS.some((w) => needsAssign(s, w))) {
    s.phase = 'assign';
    s.turn = null;
    s.assign = { player: null, ai: null };
    emit(s, 'phaseChanged', { phase: 'assign', round });
    log(s, 'Breakfast: assign Trainer Points to your Trainers.');
    return;
  }
  beginBattle(s);
}

function beginBattle(s) {
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  emit(s, 'phaseChanged', { phase: 'battle', round: s.round, turn: s.turn });
}

// --- Trainer Points and tiers (V5) ---------------------------------------------------------------

function gainTrainerPoints(s, who, n, why) {
  s.players[who].trainerPoints += n;
  emit(s, 'trainerPoints', { who, amount: n, total: s.players[who].trainerPoints, why });
  log(s, `${nm(who)}: +${n} Trainer Point${n === 1 ? '' : 's'} (${why}).`);
}

// Both have locked in: the points go onto the Trainers, tiers unlock, Partners arrive.
function resolveAssign(s) {
  for (const who of PLAYERS) {
    const p = s.players[who];
    for (const [uid, n] of Object.entries(s.assign[who] ?? {})) {
      if (!n) continue;
      const t = p.trainers.find((x) => x.uid === uid);
      const before = tiersUnlocked(t);
      t.points += n;
      p.trainerPoints -= n;
      emit(s, 'pointsAssigned', { who, uid, name: t.name, amount: n, points: t.points });
      log(s, `${nm(who)} assigned ${n} Trainer Point${n === 1 ? '' : 's'} to ${t.name} (${t.points}).`);
      for (let tier = before; tier < tiersUnlocked(t); tier++) unlockTier(s, who, t, tier);
    }
  }
  s.assign = null;
  syncPassives(s);
  beginBattle(s);
}

function unlockTier(s, who, t, tier) {
  const info = t.tiers[tier];
  emit(s, 'tierUnlocked', { who, uid: t.uid, name: t.name, tier: tier + 1, kind: info.kind, text: info.text });
  log(s, `${t.name}'s ${info.kind} is unlocked: ${info.text}.`);
  if (info.partner) {
    const card = { ...partnerCard(info.partner), uid: `partner-${t.uid}`, partner: true, trainer: t.name };
    if (!s.players[who].row[t.space]) partnerInto(s, who, card, t.space);
    else {
      s.players[who].waiting.push(card);
      emit(s, 'partnerWaiting', { who, uid: card.uid, name: card.name, trainer: t.name });
      log(s, `${card.name}, ${t.name}'s Partner, waits for a free space.`);
    }
  }
}

// A Partner Pokémon arrives: like a summon (arrives Spent unless Quick Attack; counts for
// summon objectives), from outside the deck.
function partnerInto(s, who, card, space) {
  emit(s, 'partnerArrived', { who, uid: card.uid, name: card.name, space, trainer: card.trainer, level: card.level });
  log(s, `${card.trainer}'s Partner ${card.name} (Level ${card.level}) arrives in space ${space + 1}!`);
  placeSummoned(s, who, { ...card, empowered: false }, space, {});
}

// A Partner as a card: a series at a Level (V5 test Partners), or printed stats (V6).
function partnerCard(spec) {
  if (spec.series) return { ...pokemonAt(spec.series, spec.level), cap: spec.level };
  return {
    id: spec.art, name: spec.name, cardType: 'Pokémon', series: null, level: spec.level, cap: spec.level, stage: 0, art: spec.art,
    cost: 0, type: spec.type, attack: spec.attack, attackType: spec.attackType, strength: spec.strength, strengthType: spec.strengthType ?? 'Hitpoints',
    speed: spec.speed, keywords: [...(spec.keywords ?? [])], ability: spec.ability ?? null, empower: null, weather: null, retain: false, legendary: false,
  };
}

function draw(s, who, n) {
  const p = s.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) break;
      // The Discard Pile (public) becomes the new Draw Pile: renumbered (V9), so a card
      // seen in the Discard Pile can't be followed into a hidden hand.
      p.reshuffles = (p.reshuffles ?? 0) + 1;
      p.drawPile = shuffle(s, p.discard).map((c, i) => ({ ...c, uid: `${who}-${p.reshuffles}.${i}` }));
      p.discard = [];
      emit(s, 'shuffled', { who });
    }
    p.hand.push(p.drawPile.shift());
  }
}

// Supper: the hand is discarded except Retain cards, and up to 1 unspent Energy
// is stored. Then "at Supper" objectives count (cards a reward draws now are kept
// into the next Round), Location timers tick down, and after Round 12 the match
// ends. Otherwise initiative switches, and the next Round begins.
function supper(s) {
  emit(s, 'phaseChanged', { phase: 'supper', round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  statusesAtSupper(s);
  // "This Round" effects expire (after Burn).
  for (const who of PLAYERS) {
    for (const { card } of pokemonOf(s, who)) card.shellRound = 0;
    expireBuffs(s, who, 'supper');
  }
  for (const who of PLAYERS) {
    const p = s.players[who];
    p.discard.push(...p.hand.filter((c) => !c.retain));
    p.hand = p.hand.filter((c) => c.retain);
    p.stored = Math.min(STORE_LIMIT, p.energy);
    if (p.stored) log(s, `${p.name} stored ${p.stored} Energy for the next Round.`);
  }
  for (const loc of [...s.locations]) {
    if (!OBJECTIVES[loc.objective.kind].atSupper) continue;
    for (const who of PLAYERS) advance(s, who, loc, pokemonIn(s, who, loc));
  }
  if (over(s)) return;
  for (const loc of [...s.locations]) {
    loc.roundsLeft -= 1;
    // The Championship stays on the board for the final score (and sudden death).
    if (loc.roundsLeft <= 0 && !(loc.championship && s.round >= ROUND_LIMIT)) endLocation(s, loc, 'timer');
  }
  if (s.round >= ROUND_LIMIT && finalScore(s)) return;
  s.initiative = opponentOf(s.initiative);
  startRound(s, s.round + 1);
}

// After Round 12's Supper: the highest Recognition wins; a tie goes to the most
// Championship progress; then one sudden-death Round (the Championship stays for
// it); still tied after that, a draw. Returns whether the match ended.
function finalScore(s) {
  const r = { player: s.players.player.recognition, ai: s.players.ai.recognition };
  const champ = championship(s)?.progress ?? { player: 0, ai: 0 };
  const name = (w) => `${nm(w)} ${vb(w, 'win', 'wins')}`;
  if (r.player !== r.ai) {
    const w = r.player > r.ai ? 'player' : 'ai';
    endMatch(s, w, s.suddenDeath ? 'suddenDeath' : 'recognition', `${s.suddenDeath ? 'Sudden death is over' : `Round ${ROUND_LIMIT} is over`}: ${name(w)} with ${r[w]} Recognition to ${r[opponentOf(w)]}.`);
    return true;
  }
  if (!s.suddenDeath && champ.player !== champ.ai) {
    const w = champ.player > champ.ai ? 'player' : 'ai';
    endMatch(s, w, 'championship', `Round ${ROUND_LIMIT} is over, tied on ${r.player} Recognition: ${name(w)} on Championship progress (${champ[w]} to ${champ[opponentOf(w)]}).`);
    return true;
  }
  if (s.suddenDeath) {
    endMatch(s, null, 'draw', `Sudden death is over, still tied on ${r.player} Recognition: the match is a draw.`);
    return true;
  }
  s.suddenDeath = true;
  if (championship(s)) championship(s).roundsLeft = 1;
  emit(s, 'suddenDeath', {});
  log(s, `Round ${ROUND_LIMIT} is over, tied on Recognition and Championship progress: one sudden-death Round!`);
  return false;
}

// --- Effects at work (V4) ------------------------------------------------------------------------

const NO_TARGET = new Set(['draw', 'energy', 'energyNext', 'recognition', 'findItem', 'enemyLosesRecognition', 'growth', 'trainerPoint',
  'search', 'returnFromDiscard', 'lookTop', 'stealItem', 'freeSummon', 'grantRetain', 'enemyBurn']);
const owner = (who) => poss(who);

// Run an effect: each op on each target (or on its player when it has none). ctx:
// { space (the source), lane, attacker, target, x (Solar Beam's Growth), picks }.
// An op may name its own targets with `to` (always every one; `others` leaves out the
// chosen ones). A chosen Location means the spec's side's Pokémon in it.
function runEffect(s, who, spec, ops = [], targets, ctx = {}) {
  const chosen = expand(s, spec, chooseTargets(s, who, spec, targets, ctx));
  for (const op of ops) {
    if (over(s)) return;
    if (NO_TARGET.has(op.op)) { selfOp(s, who, op, ctx); continue; }
    let list = chosen;
    if (op.to) {
      list = expand(s, op.to, targetOptions(s, who, op.to, ctx));
      if (op.to.others) list = list.filter((t) => !chosen.some((c) => refKey(c) === refKey(t)));
      if (op.to.notTarget && ctx.target) list = list.filter((t) => refKey(t) !== refKey(ctx.target));
    }
    for (const t of list) targetOp(s, who, op, t, ctx);
  }
}
const expand = (s, spec, refs) => refs.flatMap((t) => (t.kind === 'location'
  ? lanesOf(s, t.id).filter((lane) => s.players[t.who].row[lane]).map((space) => ({ who: t.who, kind: 'pokemon', space }))
  : [t]));

// Solar Beam (V6): the Growth to spend, from 1 up to the breakpoint's most (or all you have).
function growthAmount(s, who, bp, x) {
  const spend = bp.ops.find((o) => o.op === 'solarBeam');
  if (!spend) return undefined;
  const most = Math.min(spend.max, s.players[who].growth);
  if (most < 1) throw new Error('Solar Beam needs at least 1 Growth');
  const n = x ?? most;
  if (!(Number.isInteger(n) && n >= 1 && n <= most)) throw new Error(`Spend 1 to ${most} Growth`);
  return n;
}

function gainGrowth(s, who, n, why) {
  if (!n) return;
  s.players[who].growth += n;
  emit(s, 'growth', { who, amount: n, total: s.players[who].growth, why, cause: why ? 'Sun 4' : CAUSE });
  log(s, `${nm(who)}: +${n} Growth${why ? ` (${why})` : ''} (now ${s.players[who].growth}).`);
}

// The cards an op lets you pick from (Search, Return, look at the top, Burglar,
// free summon, Retain), and the default pick when none is given (the AI's, and
// abilities that fire on their own).
const MATCH = {
  pokemon: (c) => c.cardType === 'Pokémon',
  waterPokemon: (c) => c.cardType === 'Pokémon' && c.type === 'Water',
  any: () => true,
};
export function pickOptions(state, who, op) {
  const p = state.players[who];
  switch (op.op) {
    // (A seat's view hides its Draw Pile but lists what its Search could take: searchable, V9.)
    case 'search': return (p.searchable ?? p.drawPile).filter((c) => !c.hidden && MATCH[op.filter ?? 'any'](c));
    case 'returnFromDiscard': return p.discard.filter(MATCH[op.filter ?? 'pokemon']);
    // (In a view the top cards are hidden: no options there, and the engine takes the best.)
    case 'lookTop': return p.drawPile.slice(0, op.n).filter((c) => !c.hidden);
    case 'stealItem': return state.players[opponentOf(who)].bag;
    case 'freeSummon': return p.row.includes(null) ? p.hand.filter((c) => c.cardType === 'Pokémon' && c.level <= op.maxLevel) : [];
    case 'grantRetain': return p.hand.filter((c) => !c.retain);
    default: return [];
  }
}
const pickValue = (c) => (c.cardType === 'Pokémon' ? c.attack + c.strength + (c.cap ?? 0) : c.cardType === 'Item' ? 5 : 4);
function picked(s, who, op, picks, n) {
  const options = pickOptions(s, who, op);
  if (picks?.length) {
    const list = picks.map((u) => options.find((c) => c.uid === u));
    if (list.some((c) => !c) || new Set(picks).size !== picks.length) throw new Error('Pick from the cards offered');
    if (list.length > n) throw new Error(`Pick up to ${n}`);
    return list;
  }
  return [...options].sort((a, b) => pickValue(b) - pickValue(a)).slice(0, n);
}

function selfOp(s, who, op, ctx = {}) {
  const p = s.players[who];
  const foe = opponentOf(who);
  switch (op.op) {
    case 'draw': draw(s, who, op.amount); log(s, `${p.name} drew ${op.amount}.`); break;
    case 'energy': p.energy += op.amount; log(s, `${p.name}: +${op.amount} Energy.`); break;
    case 'energyNext': p.bonusNext += op.amount; break;
    case 'growth': gainGrowth(s, who, op.amount); break;
    case 'trainerPoint': gainTrainerPoints(s, who, op.amount, 'an Item'); break;
    case 'enemyBurn': applyBurn(s, { who: foe, kind: 'player' }, op.amount, who, ctx.space); break;
    case 'recognition':
      p.recognition += op.amount;
      emit(s, 'recognition', { who, amount: op.amount, total: p.recognition, effect: true, source: 'other' });
      log(s, `${p.name}: +${op.amount} Recognition (now ${p.recognition}).`);
      if (p.recognition >= targetOf(s)) win(s, who);
      break;
    case 'enemyLosesRecognition': {
      const f = s.players[foe];
      const loss = Math.min(f.recognition, op.amount);
      f.recognition -= loss;
      emit(s, 'recognitionLost', { who: foe, amount: loss, total: f.recognition });
      log(s, `${f.name} ${vb(foe, 'lose', 'loses')} ${loss} Recognition (now ${f.recognition}).`);
      break;
    }
    case 'findItem': findItem(s, who); break;
    // Search: matching cards from your Draw Pile into your hand (then shuffle it).
    case 'search': {
      const found = picked(s, who, op, ctx.picks, op.count ?? 1);
      if (!found.length) { log(s, `${p.name} searched and found nothing.`); break; }
      p.drawPile = shuffle(s, p.drawPile.filter((c) => !found.includes(c)));
      for (const c of found) p.hand.push(op.retain ? { ...c, retain: true } : c);
      emit(s, 'searched', { who, count: found.length });
      log(s, `${p.name} searched the Draw Pile for ${found.length} card${found.length === 1 ? '' : 's'}.`);
      break;
    }
    // Return: a matching card from your Discard Pile to your hand.
    case 'returnFromDiscard': {
      const found = picked(s, who, op, ctx.picks, op.count ?? 1);
      p.discard = p.discard.filter((c) => !found.includes(c));
      for (const c of found) p.hand.push(op.retain ? { ...c, retain: true } : c);
      if (found.length) log(s, `${p.name} returned ${found.map((c) => c.name).join(', ')} from the Discard Pile.`);
      break;
    }
    // Tracey: look at the top N; take some into your hand, the rest go to the bottom.
    case 'lookTop': {
      const top = p.drawPile.slice(0, op.n);
      const take = picked(s, who, op, ctx.picks, op.take);
      p.drawPile = [...p.drawPile.slice(op.n), ...top.filter((c) => !take.includes(c))];
      p.hand.push(...take);
      log(s, `${p.name} looked at the top ${top.length} cards and took ${take.length}.`);
      break;
    }
    // Burglar: an Item from the opponent's Bag into yours.
    case 'stealItem': {
      const [item] = picked(s, who, op, ctx.picks, 1);
      if (!item || p.bag.length >= BAG_SIZE) break;
      s.players[foe].bag = s.players[foe].bag.filter((c) => c !== item);
      p.bag.push(item);
      emit(s, 'itemStolen', { who, name: item.name });
      log(s, `${p.name} took ${item.name} from the opponent's Bag.`);
      break;
    }
    // Free summon (Swimmer): a Pokémon of Level N or lower from your hand, without
    // paying (into ctx.space, or the leftmost free space).
    case 'freeSummon': {
      const [card] = picked(s, who, op, ctx.picks, 1);
      if (!card) break;
      const space = ctx.summonSpace ?? p.row.indexOf(null);
      if (space < 0 || p.row[space]) throw new Error('Choose a free space for it');
      p.hand = p.hand.filter((c) => c !== card);
      placeSummoned(s, who, { ...card, empowered: false }, space, { active: op.active, cost: 0 });
      break;
    }
    case 'grantRetain': {
      const [card] = picked(s, who, op, ctx.picks, 1);
      // (A card in hand: the other seat reads only that one of their cards gained Retain.)
      if (card) { card.retain = true; log(s, vb(who, `${card.name} gains Retain.`, 'A card in the Opponent\'s hand gains Retain.')); }
      break;
    }
    default: throw new Error(`Unknown effect op: ${op.op}`);
  }
}

function targetOp(s, who, op, t, ctx = {}) {
  const p = s.players[t.who];
  const card = t.kind === 'pokemon' ? p.row[t.space] : null;
  if (t.kind === 'pokemon' && !card) return;   // gone (defeated by an earlier op)
  switch (op.op) {
    case 'damage':
      if (card) effectDamage(s, t.who, t.space, op.amount + (op.rainBonus && bracket(s, 'Rain', 2) ? op.rainBonus : 0));
      else effectDamagePlayer(s, who, t.who, op.amount);
      break;
    case 'solarBeam':
      if (card) effectDamage(s, t.who, t.space, ctx.x);
      else effectDamagePlayer(s, who, t.who, ctx.x);
      s.players[who].growth -= ctx.x;
      emit(s, 'growthSpent', { who, amount: ctx.x, total: s.players[who].growth });
      break;
    case 'burn': applyBurn(s, t, op.amount, who, ctx.space); break;
    case 'heal': if (card) healPokemon(s, t.who, t.space, op.amount); break;
    case 'douse': (card ?? p).burn = 0; break;
    case 'cure':
      (card ?? p).burn = 0;
      if (card) { card.asleep = false; card.seededBy = null; }
      emit(s, 'cured', { who: t.who, kind: t.kind, space: t.space });
      break;
    case 'sleep':
      if (card && !card.asleep) {
        card.spent = true;
        card.asleep = true;
        emit(s, 'asleep', { who: t.who, space: t.space, name: card.name });
        log(s, `${owner(t.who)} ${card.name} fell Asleep.`);
      }
      break;
    case 'leechSeed':
      if (card && !card.seededBy) {
        card.seededBy = who;
        emit(s, 'seeded', { who: t.who, space: t.space, by: who, name: card.name });
        log(s, `${owner(t.who)} ${card.name} was Leech Seeded.`);
      }
      break;
    case 'train': if (card) train(s, t.who, t.space, op.amount); break;
    case 'shellRound': if (card) addBuff(card, { keywords: [`Shell ${op.amount}`], until: 'supper' }); break;
    // "This Round" and "until your next Breakfast" buffs; permanent gains.
    case 'buff': if (card) addBuff(card, { attack: op.attack, strength: op.strength, keywords: op.keywords, until: op.until ?? 'supper' }); break;
    case 'grow':
      if (card) {
        card.attack += op.attack ?? 0;
        card.strength += op.strength ?? 0;
        card.currentStrength += op.strength ?? 0;
        card.grown = { attack: (card.grown?.attack ?? 0) + (op.attack ?? 0), strength: (card.grown?.strength ?? 0) + (op.strength ?? 0) };
        emit(s, 'grew', { who: t.who, space: t.space, attack: op.attack ?? 0, strength: op.strength ?? 0 });
      }
      break;
    case 'gainKeyword': if (card) { card.keywords.push(op.keyword); card.gained = [...(card.gained ?? []), op.keyword]; } break;
    case 'ready': if (card && card.spent && !card.asleep) { card.spent = false; emit(s, 'readied', { who: t.who, space: t.space }); } break;
    // Escape Rope: move a friendly Pokémon to an empty space of yours (ctx.moveTo).
    case 'moveTo': {
      const to = ctx.moveTo ?? p.row.indexOf(null);
      if (card && to >= 0 && to < LANES && !p.row[to]) {
        p.row[to] = card;
        p.row[t.space] = null;
        emit(s, 'moved', { who: t.who, from: t.space, to, name: card.name });
        log(s, `${owner(t.who)} ${card.name} moved to space ${to + 1}.`);
      }
      break;
    }
    case 'growthIfType': if (card && card.type === op.type) gainGrowth(s, who, op.amount, card.name); break;
    default: throw new Error(`Unknown effect op: ${op.op}`);
  }
}

// Damage to a player character from an effect (V6: Fire Blast, Hydro Pump, Solar
// Beam…): like an attack's, it gains the dealer that much Recognition.
function effectDamagePlayer(s, by, target, amount) {
  if (amount <= 0 || by === target) return;
  const p = s.players[by];
  p.recognition += amount;
  emit(s, 'recognition', { who: by, amount, total: p.recognition, effect: true, source: 'effect' });
  log(s, `${vb(by, 'You deal', 'The Opponent deals')} ${amount} to ${vb(by, 'the Opponent', 'you')}: +${amount} Recognition (now ${p.recognition}).`);
  if (p.recognition >= targetOf(s)) win(s, by);
}

// Burn X adds X Burn counters (Sun 2: +1 each time Burn is applied; Blaine's
// Passives). On a player character it removes Recognition at Supper (V4).
function applyBurn(s, t, amount, by, sourceSpace) {
  const lanePlus = by && sourceSpace !== undefined ? passiveSum(s, by, 'burnPlusLane', sourceSpace) : 0;
  const n = amount + (bracket(s, 'Sun', 2) ? 1 : 0) + (by ? passiveSum(s, by, 'burnPlus') : 0) + lanePlus;
  const target = t.kind === 'pokemon' ? s.players[t.who].row[t.space] : s.players[t.who];
  if (!target) return;
  target.burn = (target.burn ?? 0) + n;
  emit(s, 'burned', { who: t.who, kind: t.kind, space: t.space, amount: n, total: target.burn, by });
  log(s, `${t.kind === 'player' ? `${vb(t.who, 'You are', 'The Opponent is')}` : `${owner(t.who)} ${target.name} is`} Burned ${n} (Burn ${target.burn}).`);
}

// Effect damage (Strategy Cards, Burn, Leech Seed, abilities): it wakes a sleeping
// Pokémon and can defeat it. It has no attacking Pokémon, so it counts for no
// Location objective. Rage: a survivor gains +1 Attack.
function effectDamage(s, who, space, raw) {
  const card = s.players[who].row[space];
  if (!card || raw <= 0) return;
  const amount = afterShell(raw, shellOf(s, who, space));
  card.currentStrength -= amount;
  card.asleep = false;
  emit(s, 'effectDamage', { who, space, amount, name: card.name });
  log(s, `${owner(who)} ${card.name} took ${amount} damage.`);
  if (card.currentStrength > 0) rage(s, who, space);
  defeat(s, who, space);
}

// Rage (V6): +1 Attack (permanent) each time it survives damage.
function rage(s, who, space) {
  const card = s.players[who].row[space];
  if (!card || card.currentStrength <= 0 || !hasKeyword(card, 'Rage')) return;
  card.attack += 1;
  card.grown = { attack: (card.grown?.attack ?? 0) + 1, strength: card.grown?.strength ?? 0 };
  emit(s, 'rage', { who, space, attack: card.attack });
}

// What an attack deals before Shell: its Attack, +N against a burned target (Absol),
// +N while Sun is high enough (Sunflora).
function attackDamage(s, attacker, target) {
  let n = attacker.attack;
  const ab = attacker.ability;
  if (ab?.vsBurned && target?.burn) n += ab.vsBurned;
  if (ab?.sunBonus && bracket(s, 'Sun', ab.sunBonus.at)) n += ab.sunBonus.amount;
  return n;
}

// Heal: Rain 2 heals 1 more; Big Root +1 to its holder; Drought (Sun 8) stops all
// healing. Never above its Strength. A Pokémon healed at least 1 fires On Heal.
function healPokemon(s, who, space, amount) {
  const card = s.players[who].row[space];
  if (!card || bracket(s, 'Sun', 8)) return 0;
  const bonus = (bracket(s, 'Rain', 2) ? 1 : 0) + (hasKeyword(card, 'Big Root') ? 1 : 0);
  const n = Math.min(card.strength - card.currentStrength, amount + bonus);
  if (n <= 0) return 0;
  card.currentStrength += n;
  emit(s, 'healed', { who, space, amount: n, name: card.name });
  fireTrigger(s, who, space, 'onHeal');
  return n;
}

// --- Abilities that fire on their own (V6) ---------------------------------------------------------

// Fire a Pokémon's trigger (onSummon, onEvolve, onAttack, onDefend, onKnockout,
// onBreakfast, onHeal, rally): its effect with targets the engine picks (or `targets`).
function fireTrigger(s, who, space, name, ctx = {}, targets) {
  const card = s.players[who].row[space];
  const eff = card?.ability?.[name];
  if (!eff || over(s)) return;
  // GX experiment flag (V7b): only the Bulbasaur line makes Growth at Breakfast.
  if (s.variant?.growthBulbasaurOnly && name === 'onBreakfast' && ['g-oddish', 'g-sunkern'].includes(card.series)) return;
  // SL experiment flag (V7d): Gloom, Bellossom and Butterfree's On Evolve Sleep only
  // reaches a Pokémon of a lower Level than themselves.
  const sl = s.variant?.sleepLimit && name === 'onEvolve' && ['g-oddish', 'g-caterpie'].includes(card.series) && eff.ops.some((o) => o.op === 'sleep');
  const used = sl ? { ...eff, target: { ...eff.target, belowLevel: card.level } } : eff;
  withCause(`ability:${card.series ?? card.name}`, () => fireTriggerNow(s, who, space, name, ctx, targets, card, used));
}
function fireTriggerNow(s, who, space, name, ctx, targets, card, eff) {
  if (eff.oncePerRound) {
    if (card.firedRound?.[name] === s.round) return;
    card.firedRound = { ...(card.firedRound ?? {}), [name]: s.round };
  }
  const full = { ...ctx, space };
  // On Evolve (Elliott's V6 ruling): its player chooses the target, as for On Summon.
  // With more than one option the effect waits in s.choices for a chooseTarget action.
  if (name === 'onEvolve' && !targets && eff.target && eff.target.count !== 'all' && !eff.target.special) {
    const options = targetOptions(s, who, eff.target, full);
    if (!options.length) return;
    if (options.length > 1) {
      s.choices.push({ who, space, name: card.name, trigger: name, spec: eff.target, ops: eff.ops, ctx: full, text: card.ability.text });
      emit(s, 'choiceWaiting', { who, name: card.name, trigger: name });
      return;
    }
    targets = options;
  }
  const chosen = targets ?? autoTargets(s, who, eff.target, eff.ops, full);
  if (chosen === null) return;   // nothing to work on
  emit(s, 'ability', { who, space, name: card.name, trigger: name });
  runEffect(s, who, eff.target, eff.ops, chosen ?? undefined, full);
}

// A Pokémon arrives (a summon, a free summon, a Partner): Spent unless Quick Attack
// (or "arrives Active"); the Empowered bonus; On Summon (its player picks a single
// target, else the engine); Rally for the others in its Location; summon objectives.
function placeSummoned(s, who, card, space, { targets, picks, active = false, cost = 0, mustChoose = false } = {}) {
  const p = s.players[who];
  const played = { ...card, arrivedRound: s.round, buffs: [] };
  if (played.empowered) applyEmpower(played);
  played.strength += waterBonus(s, played);
  played.attack += waterAttack(s, played);
  fireGuard(s, played);
  played.currentStrength = played.strength;
  played.spent = !(active || hasKeyword(played, 'Quick Attack'));
  p.row[space] = played;
  emit(s, 'summoned', { who, uid: card.uid, name: card.name, space, cost, level: card.level, stage: card.stage, series: card.series, empowered: !!card.empowered, partner: !!card.partner });
  if (!card.partner) log(s, `${p.name} summoned ${card.name} (Level ${card.level}) into space ${space + 1} (${cost} Energy${card.empowered ? `, Empowered: ${card.empower.text}` : ''}).`);
  const ctx = { space, picks };
  if (card.empowered && card.empower.ops) {
    runEffect(s, who, card.empower.target, card.empower.ops, autoTargets(s, who, card.empower.target, card.empower.ops, ctx) ?? undefined, ctx);
  }
  if (over(s)) return;
  const onSummon = card.ability?.onSummon;
  if (onSummon && canTarget(s, who, onSummon.target, ctx)) {
    // A summon from hand: its player chooses a single target (Elliott's V3 ruling).
    const choosable = onSummon.target && onSummon.target.count !== 'all' && !onSummon.target.special;
    if (choosable && mustChoose) chooseTargets(s, who, onSummon.target, targets, ctx);
    fireTrigger(s, who, space, 'onSummon', ctx, choosable && targets ? targets : undefined);
  }
  if (over(s)) return;
  for (const lane of locLanesAt(s, space)) if (lane !== space && p.row[lane]) fireTrigger(s, who, lane, 'rally', { summoned: space });
  if (over(s)) return;
  progressAt(s, who, 'summon', space);
}

// Buffs: "this Round" ones end at Supper, "until your next Breakfast" ones then.
function applyBuff(card, b) {
  card.attack += b.attack ?? 0;
  card.strength += b.strength ?? 0;
  card.keywords = [...card.keywords, ...(b.keywords ?? [])];
  card.buffs = [...(card.buffs ?? []), b];
}
function addBuff(card, b) {
  applyBuff(card, b);
  card.currentStrength += b.strength ?? 0;
}
function expireBuffs(s, who, until) {
  for (const { card } of pokemonOf(s, who)) {
    const ending = (card.buffs ?? []).filter((b) => b.until === until);
    if (!ending.length) continue;
    for (const b of ending) {
      card.attack -= b.attack ?? 0;
      card.strength -= b.strength ?? 0;
      for (const k of b.keywords ?? []) card.keywords.splice(card.keywords.indexOf(k), 1);
    }
    card.currentStrength = Math.max(1, Math.min(card.currentStrength, card.strength));
    card.buffs = card.buffs.filter((b) => b.until !== until);
  }
}

const regenerateOf = (card) => card.keywords.reduce((n, k) => n + (Number(/^Regenerate (\d+)$/.exec(k)?.[1]) || 0), 0);

// At Supper, before hands are discarded: Downpour (Rain 8) removes all Burn; then
// Burn (Pokémon take damage; a player character loses that much Recognition, never
// below 0; Rain 4: 1 less), each Burn then losing 1; then Leech Seed (1 damage, or 2
// at Rain 6, healing the seeder's most-damaged Pokémon as much).
function statusesAtSupper(s) {
  const burnable = PLAYERS.flatMap((who) => [s.players[who], ...pokemonOf(s, who).map(({ card }) => card)]);
  if (bracket(s, 'Rain', 8) && burnable.some((c) => c.burn)) {
    for (const c of burnable) c.burn = 0;
    log(s, 'Downpour: all Burn is washed away.');
  }
  const less = bracket(s, 'Rain', 4) ? 1 : 0;
  for (const who of PLAYERS) {
    const p = s.players[who];
    if (p.burn) {
      const loss = Math.min(p.recognition, Math.max(0, p.burn - less));
      p.recognition -= loss;
      p.burn -= 1;
      emit(s, 'burnRecognition', { who, amount: loss, total: p.recognition, burn: p.burn });
      log(s, `Burn: ${vb(who, 'you lose', 'the Opponent loses')} ${loss} Recognition (now ${p.recognition}).`);
    }
    for (const { space, card } of pokemonOf(s, who)) {
      if (!card.burn) continue;
      const dmg = Math.max(0, card.burn - less);
      card.burn -= 1;
      effectDamage(s, who, space, dmg);
    }
  }
  const drain = bracket(s, 'Rain', 6) ? 2 : 1;
  for (const who of PLAYERS) {
    for (const { space, card } of pokemonOf(s, who)) {
      if (!card.seededBy) continue;
      const seeder = card.seededBy;
      // Ramos: Leech Seeds on enemy Pokémon in his lane drain 1 more.
      const n = drain + passiveSum(s, seeder, 'seedPlus', space);
      effectDamage(s, who, space, n);
      // Big Root: your Leech Seeds heal its holder first (if hurt); else your most-damaged Pokémon.
      const hurtOnes = pokemonOf(s, seeder).filter(({ card: c }) => c.currentStrength < c.strength);
      const hurt = hurtOnes.find(({ card: c }) => hasKeyword(c, 'Big Root'))
        ?? hurtOnes.sort((a, b) => (b.card.strength - b.card.currentStrength) - (a.card.strength - a.card.currentStrength) || a.space - b.space)[0];
      if (hurt) healPokemon(s, seeder, hurt.space, n);
    }
  }
}

// --- Items (V4) ---------------------------------------------------------------------------------

// Find an Item: the next one from the shared pool into your Bag (if it has room).
function findItem(s, who) {
  const p = s.players[who];
  if (!s.itemPool.length) { log(s, 'The Item pool is empty: nothing found.'); return; }
  if (p.bag.length >= BAG_SIZE) { log(s, `${p.name}: the Bag is full, so the Item stays where it is.`); return; }
  const card = s.itemPool.shift();
  p.bag.push(card);
  emit(s, 'itemFound', { who, uid: card.uid, name: card.name });
  log(s, `${p.name} found ${card.name} (into the Bag).`);
}

// A used or lost Item goes back into the shared pool (shuffled in).
function returnToPool(s, card) {
  // (A new uid in the pool (V9): a card seen played can't be followed through the pool.)
  s.itemPool.push({ ...card, uid: `pool-${s.nextItem++}` });
  s.itemPool = shuffle(s, s.itemPool);
}

// Use an Item: a Held Item attaches to the chosen friendly Pokémon (one each; an
// old one goes to the pool); a Consumed Item resolves, then goes to the pool.
function useItemCard(s, who, card, targets, picks) {
  emit(s, 'itemUsed', { who, uid: card.uid, name: card.name, kind: card.kind });
  if (card.kind === 'Held') {
    const [t] = chooseTargets(s, who, card.target, targets);
    const holder = s.players[t.who].row[t.space];
    if (!holder) return;
    if (holder.held) { removeHeld(holder); returnToPool(s, holder.held); }
    holder.held = { ...card };
    applyHeld(holder, card, true);
    log(s, `${owner(t.who)} ${holder.name} now holds ${card.name} (${card.text.replace(/^Held: /, '')}).`);
    return;
  }
  log(s, `${nm(who)} used ${card.name}: ${card.text}`);
  runEffect(s, who, card.target, card.ops, targets, { picks, moveTo: picks?.space });
  returnToPool(s, card);
}

// A Held Item's bonus (V6: a typed extra, e.g. Charcoal's Scorch 1 on a Fire Pokémon;
// Quick Claw's Speed; a Strength loss never takes it below 1).
// Quick Claw on a Swift holder gives Quick Attack instead (Elliott's V6 ruling).
const heldParts = (card, item) => {
  const h = item.held ?? {};
  const typed = h.typed && h.typed.type === card.type ? h.typed : {};
  const swift = h.speedUp && SPEEDS.indexOf(card.speed) >= SPEEDS.length - 1;
  return { attack: (h.attack ?? 0) + (typed.attack ?? 0), strength: (h.strength ?? 0) + (typed.strength ?? 0),
    keywords: [...(h.keywords ?? []), ...(typed.keywords ?? []), ...(swift ? ['Quick Attack'] : [])], speedUp: swift ? 0 : h.speedUp ?? 0 };
};
function applyHeld(card, item, fresh = false) {
  const h = heldParts(card, item);
  card.heldParts = h;
  const before = card.strength;
  card.attack += h.attack;
  card.strength = Math.max(1, card.strength + h.strength);
  card.heldStrength = card.strength - before;
  if (fresh) card.currentStrength = Math.max(1, card.currentStrength + card.heldStrength);
  card.keywords = [...card.keywords, ...h.keywords];
  card.speedUp = (card.speedUp ?? 0) + h.speedUp;
}
function removeHeld(card) {
  const h = card.heldParts ?? heldParts(card, card.held);
  card.attack -= h.attack;
  card.strength -= card.heldStrength ?? h.strength;
  card.currentStrength = Math.max(1, Math.min(card.currentStrength, card.strength));
  for (const k of h.keywords) card.keywords.splice(card.keywords.indexOf(k), 1);
  card.speedUp = (card.speedUp ?? 0) - h.speedUp;
}

// A card leaving play keeps none of its play-only state.
function plainCard(card) {
  const { currentStrength, spent, arrivedRound, burn, asleep, seededBy, held, shellRound, passiveStrength, passiveAttack, buffs, grown, gained,
    nurturedRound, firedRound, heldStrength, speedUp, heldParts: hp, ...plain } = card;
  return plain;
}

function emit(s, type, data = {}) {
  s.events.push({ type, ...data });
}
function log(s, line) {
  s.log.push(line);
}
