// Shared building blocks for the rules: players, the log, drawing, finding
// cards in the arena, effective stats, damage, healing and defeat.
// No DOM access; game.js and effects.js both build on this.
//
// A reference to a card ("ref") is one of:
//   { kind: 'pokemon', owner, zone, space }   in the arena
//   { kind: 'trainer', owner, zone }
//   { kind: 'hand', owner, uid }               a Pokémon card in hand (Held Items)

import { shuffle } from './random.js';
import { SPEED_TIERS } from './cardData.js';
import { afterShell } from './keywords.js';

export const PLAYERS = ['player', 'ai'];

export function opponentOf(who) {
  return who === 'player' ? 'ai' : 'player';
}

export function log(state, message) {
  state.log.push(message);
}

// Alongside the text log, every action records what happened as structured
// events, in order (state.events, reset by each applyAction), so the UI can
// show it step by step. Each names the cards and places involved.
export function emit(state, type, data = {}) {
  (state.events ??= []).push({ type, ...data });
  tally(state, type, data);
}

// Match stats for the end screen, kept as the match goes (no rule reads them):
// damage each side dealt to enemy Trainers, Pokémon each side lost, cards each side played.
export const newStats = () => ({
  player: { trainerDamage: 0, pokemonLost: 0, cardsPlayed: 0 },
  ai: { trainerDamage: 0, pokemonLost: 0, cardsPlayed: 0 },
});
function tally(state, type, d) {
  const s = (state.stats ??= newStats());
  if (type === 'damage' && d.target?.kind === 'trainer') s[d.target.owner === 'player' ? 'ai' : 'player'].trainerDamage += d.amount;
  else if (type === 'defeated' && d.target?.owner) s[d.target.owner].pokemonLost += 1;
  else if (type === 'cardPlayed' && s[d.who]) s[d.who].cardsPlayed += 1;
}

// A card's place and identity for an event: { kind, owner, zone, space?, uid, name }.
export function info(state, ref) {
  if (!ref) return null;
  const card = cardAt(state, ref);
  return { ...ref, uid: card?.uid ?? ref.uid, name: card?.name ?? ref.name };
}

// "Your" / "AI Opponent's" (or lower-case "your" mid-sentence).
export function whose(state, who, capital = true) {
  if (who === 'player') return capital ? 'Your' : 'your';
  return `${state.players[who].name}'s`;
}

// Draws one card at a time. An empty Draw Pile is replaced by the shuffled
// Discard Pile; if both are empty, drawing stops. Returns the cards drawn.
export function draw(state, who, count) {
  const p = state.players[who];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (!p.drawPile.length) {
      if (!p.discard.length) break;
      p.drawPile = shuffle(state, p.discard);
      p.discard = [];
      emit(state, 'shuffled', { who });
      log(state, `${p.name} shuffled ${who === 'player' ? 'your' : 'their'} Discard Pile to form a new Draw Pile.`);
    }
    const card = p.drawPile.shift();
    p.hand.push(enterHand(card));
    drawn.push(card);
  }
  if (drawn.length) emit(state, 'cardsDrawn', { who, uids: drawn.map((c) => c.uid), count: drawn.length });
  return drawn;
}

// A card entering a hand starts fresh: what was granted to it "until it
// leaves your hand" (Retain, a cost reduction) belonged to its last visit.
export function enterHand(card) {
  delete card.retainGranted;
  delete card.costDown;
  return card;
}

// Retain: printed on the card, or granted while it is in your hand.
export function hasRetain(card) {
  return Boolean(card.retain || card.retainGranted);
}

export function canDraw(state, who) {
  const p = state.players[who];
  return p.drawPile.length + p.discard.length > 0;
}

// --- Finding cards --------------------------------------------------------------

// Every Pokémon in the arena, as { ref, card }.
export function arenaPokemon(state) {
  const all = [];
  for (const owner of PLAYERS) {
    state.players[owner].zones.forEach((z, zone) => z.pokemon.forEach((card, space) => {
      if (card) all.push({ ref: { kind: 'pokemon', owner, zone, space }, card });
    }));
  }
  return all;
}

// Every Trainer still in play (above 0 Strength), as { ref, card }.
export function activeTrainers(state) {
  const all = [];
  for (const owner of PLAYERS) {
    state.players[owner].zones.forEach((z, zone) => {
      if (z.trainer && z.trainer.strength > 0) all.push({ ref: { kind: 'trainer', owner, zone }, card: z.trainer });
    });
  }
  return all;
}

export function cardAt(state, ref) {
  if (ref.kind === 'hand') return state.players[ref.owner]?.hand.find((c) => c.uid === ref.uid) ?? null;
  const zone = state.players[ref.owner]?.zones[ref.zone];
  if (!zone) return null;
  return ref.kind === 'trainer' ? zone.trainer : zone.pokemon[ref.space] ?? null;
}

export function sameRef(a, b) {
  if (a.kind === 'hand' || b.kind === 'hand') return a.kind === b.kind && a.owner === b.owner && a.uid === b.uid;
  return a.kind === b.kind && a.owner === b.owner && a.zone === b.zone && (a.kind === 'trainer' || a.space === b.space);
}

export function describeRef(state, ref) {
  if (ref.kind === 'hand') return `${whose(state, ref.owner, false)} ${cardAt(state, ref).name} (in hand)`;
  const where = ref.kind === 'trainer' ? `Zone ${ref.zone + 1}` : `Zone ${ref.zone + 1}, Space ${ref.space + 1}`;
  return `${whose(state, ref.owner, false)} ${cardAt(state, ref).name} (${where})`;
}

// --- Zones ----------------------------------------------------------------------

// A zone has fallen on this player's side once their Trainer there is removed.
export function isFallen(state, who, zone) {
  const trainer = state.players[who].zones[zone].trainer;
  return Boolean(trainer) && trainer.strength <= 0;
}

// Empty Pokémon Spaces on this player's side, as { zone, space }.
export function emptySpaces(state, who) {
  const spaces = [];
  state.players[who].zones.forEach((z, zone) => z.pokemon.forEach((c, space) => {
    if (!c) spaces.push({ zone, space });
  }));
  return spaces;
}

// Empty spaces a new Pokémon may be summoned into: not in a fallen zone.
export function summonSpaces(state, who) {
  return emptySpaces(state, who).filter(({ zone }) => !isFallen(state, who, zone));
}

// --- Stats ----------------------------------------------------------------------
//
// A Pokémon in play carries:
//   attackBonus, strengthBonus  permanent buffs
//   aura                        Passive bonuses by source uid: { [uid]: { attack, strength } }
//   weather                     Weather modifiers by bracket: { ['Rain 4']: { attack, strength } }
//   roundBuffs                  "this Round" buffs, expiring at Supper: [{ attack, strength, source }]
//   currentStrength

function auraTotal(c, stat) {
  return Object.values(c.aura ?? {}).reduce((sum, b) => sum + b[stat], 0);
}

// The part of a stat that comes from "this Round" buffs.
export function roundTotal(c, stat) {
  return (c.roundBuffs ?? []).reduce((sum, b) => sum + (b[stat] ?? 0), 0);
}

// The part of a stat that comes from Weather (shown separately on cards).
export function weatherTotal(c, stat) {
  return Object.values(c.weather ?? {}).reduce((sum, b) => sum + (b[stat] ?? 0), 0);
}

// What a Held Item gives its holder (counted while it is in the arena),
// including its extra for one Pokémon Type (held.also: "If it's a Fire Pokémon…").
export function heldBonus(c, stat) {
  const held = c.heldItem?.held;
  if (!held) return 0;
  const also = held.also && held.also.pokemonType === c.pokemonType ? held.also[stat] ?? 0 : 0;
  return (held[stat] ?? 0) + also;
}

// Attack can't go below 0.
export function attackOf(c) {
  return Math.max(0, c.attackValue + (c.attackBonus ?? 0) + auraTotal(c, 'attack') + weatherTotal(c, 'attack') + heldBonus(c, 'attack') + roundTotal(c, 'attack'));
}

// Never below 1 (a Held Item's −Strength can't take it lower).
export function maxStrengthOf(c) {
  if (c.cardType === 'Trainer') return c.maxStrength;
  return Math.max(1, c.strengthValue + (c.strengthBonus ?? 0) + auraTotal(c, 'strength') + weatherTotal(c, 'strength') + heldBonus(c, 'strength') + roundTotal(c, 'strength'));
}

// Speed-Tier as an index into SPEED_TIERS, raised by a Held Item (never past Swift).
export function speedOf(c) {
  return Math.min(SPEED_TIERS.length - 1, SPEED_TIERS.indexOf(c.speedTier) + heldBonus(c, 'speedUp'));
}

export function strengthOf(c) {
  return c.cardType === 'Trainer' ? c.strength : c.currentStrength;
}

// A Pokémon card as it enters the arena. XP spent on it in hand
// ({ attack, strength }) becomes a permanent buff.
export function inPlay(card, { spent }) {
  const { xp = { attack: 0, strength: 0 }, retainGranted, costDown, ...rest } = card;
  return {
    ...rest,
    currentStrength: Math.max(1, card.strengthValue + xp.strength + heldBonus(card, 'strength')),
    spent,
    attackBonus: xp.attack,
    strengthBonus: xp.strength,
    aura: {},
    weather: {},
  };
}

// XP buffs only last while the card is in hand or once it's played: a card
// leaving the hand any other way loses them.
export function dropXp(cards) {
  for (const c of cards) delete c.xp;
}

// --- Weather --------------------------------------------------------------------

// Weather Tokens in play, per type: every Location on both sides plus every
// Pokémon in the arena that carries a token. Worked out fresh each time, so
// tokens stop counting the moment their card leaves play.
export function weatherCounts(state) {
  const counts = {};
  const add = (tokens) => Object.entries(tokens ?? {}).forEach(([type, n]) => { counts[type] = (counts[type] ?? 0) + n; });
  for (const who of PLAYERS) {
    for (const z of state.players[who].zones) add(z.location?.weatherTokens);
  }
  for (const { card } of arenaPokemon(state)) add(card.weatherTokens);
  return counts;
}

// --- Damage, healing, defeat ------------------------------------------------------

// One instance of damage. A Pokémon's Shell reduces it (to a minimum of 1).
// Trainer Strength stops at 0; a Trainer at 0 is removed and keeps no
// statuses. Pokémon at 0 or less are released by releaseDefeated().
// opts: { cause: 'burn' | …, by: the player whose card or effect dealt it }.
// Returns [before, after].
export function damage(state, ref, amount, opts = {}) {
  const card = cardAt(state, ref);
  const dealt = afterShell(card, amount);
  const extra = { ...(dealt !== amount ? { raw: amount, shell: amount - dealt } : {}), ...(opts.cause ? { cause: opts.cause } : {}) };
  if (ref.kind === 'trainer') {
    const before = card.strength;
    card.strength = Math.max(0, before - dealt);
    emit(state, 'damage', { target: info(state, ref), amount: dealt, before, after: card.strength, ...extra });
    if (before > 0 && card.strength === 0) {
      delete card.status;
      emit(state, 'trainerRemoved', { target: info(state, ref) });
      log(state, `${whose(state, ref.owner)} ${card.name} was removed. Zone ${ref.zone + 1} has fallen on ${ref.owner === 'player' ? 'your' : `${state.players[ref.owner].name}'s`} side.`);
    }
    return [before, card.strength];
  }
  const before = card.currentStrength;
  card.currentStrength -= dealt;
  // What last hit it, so a defeat can say what caused it.
  // (hitBy: the kind, Type or card id of what dealt it, so the defeat can be shown to match.)
  card.lastHit = { cause: opts.cause ?? 'damage', by: opts.by ?? null, hitBy: opts.hitBy ?? null };
  emit(state, 'damage', { target: info(state, ref), amount: dealt, before, after: card.currentStrength, ...extra });
  return [before, card.currentStrength];
}

// Rule switches for balance experiments (tools/balance.js). All off: the
// rules as written.
//   burnBlocksHealing: a card with any Burn on it can't be healed.
//   zoneGuards: a Defence / Special Defence Pokémon only guards its own Zone.
export const RULE_FLAGS = { burnBlocksHealing: false, zoneGuards: false };

// Healing never goes above maximum Strength (a Trainer's starting Strength).
export function heal(state, ref, amount) {
  const card = cardAt(state, ref);
  const key = ref.kind === 'trainer' ? 'strength' : 'currentStrength';
  const before = card[key];
  const blocked = RULE_FLAGS.burnBlocksHealing && (card.status?.burn?.count ?? 0) > 0;
  card[key] = blocked ? before : Math.min(maxStrengthOf(card), before + amount);
  emit(state, 'heal', { target: info(state, ref), amount: card[key] - before, before, after: card[key] });
  return [before, card[key]];
}

// Pokémon at 0 Strength or less go to their owner's Released Pile.
// Returns the defeated, as { ref, card, cause, by } (by: the player whose
// card or effect dealt the last hit, or null).
// The opponent earns PokéDollars equal to its printed Energy Cost, and a
// Held Item on it is lost to the PokéMart.
export function releaseDefeated(state) {
  const defeated = arenaPokemon(state).filter(({ card }) => card.currentStrength <= 0);
  for (const d of defeated) {
    const { ref, card } = d;
    const p = state.players[ref.owner];
    d.cause = card.lastHit?.cause ?? 'damage';
    d.by = card.lastHit?.by ?? null;
    emit(state, 'defeated', { target: info(state, ref), cause: d.cause, by: d.by, hitBy: card.lastHit?.hitBy ?? null });
    leaveArena(card);
    p.zones[ref.zone].pokemon[ref.space] = null;
    log(state, `${whose(state, ref.owner)} ${card.name} was defeated and goes to the Released Pile.`);
    earnDollars(state, opponentOf(ref.owner), card.energyCost, `for defeating ${card.name}`);
    release(state, ref.owner, [card]);
  }
  return defeated;
}

// A card leaving the arena keeps nothing that only lasts while it is in play:
// statuses, "this Round" buffs and keywords, what last hit it.
export function leaveArena(card) {
  delete card.status;
  delete card.roundBuffs;
  delete card.lastHit;
  if (card.granted) card.granted = card.granted.filter((k) => !k.thisRound);
}

// --- PokéDollars, Held Items and the PokéMart ----------------------------------

export function earnDollars(state, who, amount, why) {
  if (!amount) return;
  const p = state.players[who];
  p.dollars = (p.dollars ?? 0) + amount;
  emit(state, 'dollarsEarned', { who, amount });
  log(state, `${p.name} ${who === 'player' ? 'earn' : 'earns'} ${amount} PokéDollars ${why} (now ${p.dollars}).`);
}

// An Item goes into the PokéMart deck, which is shuffled. It never returns
// to a player's deck.
export function toMart(state, item, why) {
  const { inDelivery, ...plain } = item;
  state.mart.deck.push(plain);
  emit(state, 'cardMoved', { uid: plain.uid, name: plain.name, to: 'mart' });
  shuffle(state, state.mart.deck);
  log(state, `${plain.name} ${why}, and goes to the PokéMart.`);
}

// Cards going to their owner's Released Pile: a Held Item on one is lost.
export function release(state, who, cards) {
  const p = state.players[who];
  for (const card of cards) {
    if (card.heldItem) {
      const lost = card.heldItem;
      delete card.heldItem;
      toMart(state, lost, `was held by ${whose(state, who, false)} ${card.name}, which was Released: it is lost`);
    }
    p.released.push(card);
    emit(state, 'cardMoved', { uid: card.uid, name: card.name, owner: who, to: 'released' });
  }
}
