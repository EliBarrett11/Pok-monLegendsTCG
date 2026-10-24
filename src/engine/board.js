// Shared building blocks for the rules: players, the log, drawing, finding
// cards in the arena, effective stats, damage, healing and defeat.
// No DOM access; game.js and effects.js both build on this.
//
// A reference to a card in the arena ("ref") is one of:
//   { kind: 'pokemon', owner, zone, space }
//   { kind: 'trainer', owner, zone }

import { shuffle } from './random.js';

export const PLAYERS = ['player', 'ai'];

export function opponentOf(who) {
  return who === 'player' ? 'ai' : 'player';
}

export function log(state, message) {
  state.log.push(message);
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
      log(state, `${p.name} shuffled ${who === 'player' ? 'your' : 'their'} Discard Pile to form a new Draw Pile.`);
    }
    const card = p.drawPile.shift();
    p.hand.push(card);
    drawn.push(card);
  }
  return drawn;
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
  const zone = state.players[ref.owner]?.zones[ref.zone];
  if (!zone) return null;
  return ref.kind === 'trainer' ? zone.trainer : zone.pokemon[ref.space] ?? null;
}

export function sameRef(a, b) {
  return a.kind === b.kind && a.owner === b.owner && a.zone === b.zone && (a.kind === 'trainer' || a.space === b.space);
}

export function describeRef(state, ref) {
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
//   currentStrength

function auraTotal(c, stat) {
  return Object.values(c.aura ?? {}).reduce((sum, b) => sum + b[stat], 0);
}

export function attackOf(c) {
  return c.attackValue + (c.attackBonus ?? 0) + auraTotal(c, 'attack');
}

export function maxStrengthOf(c) {
  if (c.cardType === 'Trainer') return c.maxStrength;
  return c.strengthValue + (c.strengthBonus ?? 0) + auraTotal(c, 'strength');
}

export function strengthOf(c) {
  return c.cardType === 'Trainer' ? c.strength : c.currentStrength;
}

// A Pokémon card as it enters the arena.
export function inPlay(card, { spent }) {
  return { ...card, currentStrength: card.strengthValue, spent, attackBonus: 0, strengthBonus: 0, aura: {} };
}

// --- Damage, healing, defeat ------------------------------------------------------

// Trainer Strength stops at 0; a Trainer at 0 is removed. Pokémon at 0 or
// less are released by releaseDefeated(). Returns [before, after].
export function damage(state, ref, amount) {
  const card = cardAt(state, ref);
  if (ref.kind === 'trainer') {
    const before = card.strength;
    card.strength = Math.max(0, before - amount);
    if (before > 0 && card.strength === 0) {
      log(state, `${whose(state, ref.owner)} ${card.name} was removed. Zone ${ref.zone + 1} has fallen on ${ref.owner === 'player' ? 'your' : `${state.players[ref.owner].name}'s`} side.`);
    }
    return [before, card.strength];
  }
  const before = card.currentStrength;
  card.currentStrength -= amount;
  return [before, card.currentStrength];
}

// Healing never goes above maximum Strength (a Trainer's starting Strength).
export function heal(state, ref, amount) {
  const card = cardAt(state, ref);
  const key = ref.kind === 'trainer' ? 'strength' : 'currentStrength';
  const before = card[key];
  card[key] = Math.min(maxStrengthOf(card), before + amount);
  return [before, card[key]];
}

// Pokémon at 0 Strength or less go to their owner's Released Pile.
// Returns the defeated, as { ref, card }.
export function releaseDefeated(state) {
  const defeated = arenaPokemon(state).filter(({ card }) => card.currentStrength <= 0);
  for (const { ref, card } of defeated) {
    const p = state.players[ref.owner];
    p.zones[ref.zone].pokemon[ref.space] = null;
    p.released.push(card);
    log(state, `${whose(state, ref.owner)} ${card.name} was defeated and goes to the Released Pile.`);
  }
  return defeated;
}
