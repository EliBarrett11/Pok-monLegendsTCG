// The effect system. Every card effect in the game is data: a list of
// effects, each one operation plus who it applies to. Trainers use it now;
// Strategy Cards, Pokémon abilities and Innate Powers add data, not code.
//
// EFFECT       { op, ...op fields, target?: selector }
//   draw         { amount }                        draw cards
//   damage       { amount, target }                same defeat rules as combat
//   heal         { amount, target }                up to maximum Strength
//   buff         { attack, strength, strengthType?, target }
//                permanent; with strengthType only Pokémon of that
//                Strength-Type can be chosen, and area versions skip others
//   mayPlayFree  { filter }                        the card just drawn may be summoned for free
//
// SELECTOR     { mode, side, kinds, zone, filter }
//   mode    'targeted' (the player chooses one) | 'area' (all that match) |
//           'event' (the card that set off a trigger)
//   side    'friendly' | 'opponent' | 'any'       relative to whoever owns the effect
//   kinds   ['pokemon'] (default) | ['pokemon', 'trainer'] | ['trainer']
//   zone    'source': only the source's Zone, both sides of the arena
//   filter  { pokemonType?, strengthType? }        Pokémon only
//   damaged true: only cards below their maximum Strength
//
// PASSIVE      { aura?, triggers? }
//   aura      { attack, strength, target: selector } continuous stat bonus,
//             recalculated whenever the board changes
//   triggers  [{ on: 'summon' | 'defeated' | 'attack', match, effects }]
//             match: { side?, zone?: 'source', self?: true } for the event's card
//
// CONTEXT (ctx) for resolving: { who, source: { kind, owner, zone, uid, name },
//   label, target?, event?, drawn? }. All plain data, so it can be stored in
//   state while a choice is pending.
//
// INNATE POWERS are keywords the rules check directly:
//   'Quick Attack'  summoned Active instead of Spent
//   'Agility'       can't be chosen as a target by a Strategy Card (area effects still hit)

import {
  PLAYERS, opponentOf, log, whose, draw, canDraw, arenaPokemon, activeTrainers, cardAt, sameRef,
  describeRef, summonSpaces, damage, heal, releaseDefeated, maxStrengthOf, strengthOf, inPlay,
} from './board.js';

export function hasKeyword(card, keyword) {
  return card.innatePower === keyword;
}

// --- Selectors -----------------------------------------------------------------

function sidesFor(ctx, side) {
  if (side === 'friendly') return [ctx.who];
  if (side === 'opponent') return [opponentOf(ctx.who)];
  return PLAYERS;
}

function passesFilter(card, filter = {}) {
  return Object.entries(filter).every(([field, value]) => card[field] === value);
}

// Every card a selector could apply to, as refs. `op` adds the stat rule:
// a Strength-Type buff only fits Pokémon of that Strength-Type.
export function candidates(state, ctx, selector, op = {}) {
  if (selector.mode === 'event') return ctx.event && cardAt(state, ctx.event.ref) ? [ctx.event.ref] : [];
  const kinds = selector.kinds ?? ['pokemon'];
  const sides = sidesFor(ctx, selector.side ?? 'any');
  const inZone = (ref) => selector.zone !== 'source' || ref.zone === ctx.source.zone;
  const filter = { ...selector.filter, ...(op.strengthType ? { strengthType: op.strengthType } : {}) };
  const out = [];
  const hurt = (card) => !selector.damaged || strengthOf(card) < maxStrengthOf(card);
  if (kinds.includes('pokemon')) {
    for (const { ref, card } of arenaPokemon(state)) {
      if (!sides.includes(ref.owner) || !inZone(ref) || !passesFilter(card, filter) || !hurt(card)) continue;
      if (selector.mode === 'targeted' && ctx.source.kind === 'strategy' && hasKeyword(card, 'Agility')) continue;
      out.push(ref);
    }
  }
  if (kinds.includes('trainer') && !Object.keys(filter).length) {
    for (const { ref, card } of activeTrainers(state)) {
      if (sides.includes(ref.owner) && inZone(ref) && hurt(card)) out.push(ref);
    }
  }
  return out;
}

// The first effect that makes the player choose a target, if any.
export function targetedEffect(effects) {
  return effects.find((e) => e.target?.mode === 'targeted') ?? null;
}

// Whether a card or Power with these effects can be used now: a draw needs a
// card to draw, and a targeted or area effect needs something to affect.
// (Triggers don't ask; they just affect whatever is there.)
export function canResolve(state, ctx, effects) {
  return effects.every((e) => {
    if (e.op === 'draw') return canDraw(state, ctx.who);
    if (e.target?.mode === 'targeted' || e.target?.mode === 'area') return candidates(state, ctx, e.target, e).length > 0;
    return true;
  });
}

// --- Resolving ------------------------------------------------------------------

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

const OPS = {
  draw(state, ctx, e) {
    const drawn = draw(state, ctx.who, e.amount);
    ctx.drawn = drawn.map((c) => c.uid);
    const shown = ctx.who === 'player' ? `: ${drawn.map((c) => c.name).join(', ')}` : '';
    log(state, `${ctx.label}: ${state.players[ctx.who].name} drew ${drawn.length} card${drawn.length === 1 ? '' : 's'}${shown}.`);
  },

  damage(state, ctx, e, refs) {
    for (const ref of refs) {
      const what = describeRef(state, ref);
      const [before, after] = damage(state, ref, e.amount);
      log(state, `${ctx.label}: ${e.amount} damage to ${what}. Strength ${before} → ${Math.max(after, 0)}.`);
    }
    settle(state);
  },

  heal(state, ctx, e, refs) {
    for (const ref of refs) {
      const what = describeRef(state, ref);
      const [before, after] = heal(state, ref, e.amount);
      log(state, `${ctx.label}: healed ${what}. Strength ${before} → ${after}.`);
    }
  },

  buff(state, ctx, e, refs) {
    for (const ref of refs) {
      const card = cardAt(state, ref);
      const attack = e.attack ?? 0;
      const strength = e.strength ?? 0;
      card.attackBonus = (card.attackBonus ?? 0) + attack;
      card.strengthBonus = (card.strengthBonus ?? 0) + strength;
      card.currentStrength += strength;
      const what = e.strengthType && !attack ? `${signed(strength)} ${e.strengthType}` : `${signed(attack)}/${signed(strength)}`;
      log(state, `${ctx.label}: ${describeRef(state, ref)} gains ${what}.`);
    }
  },

  // The last card drawn may be summoned for free, if it fits the filter.
  // Needs the player's choice, so resolving pauses here.
  mayPlayFree(state, ctx, e) {
    const p = state.players[ctx.who];
    const card = p.hand.find((c) => c.uid === ctx.drawn?.at(-1));
    if (!card || !passesFilter(card, e.filter)) return null;
    if (!summonSpaces(state, ctx.who).length) {
      log(state, `${ctx.label}: ${card.name} could be summoned for free, but there is no empty space, so it stays in hand.`);
      return null;
    }
    return { kind: 'freeSummon', uid: card.uid };
  },
};

// Resolves effects in order. Returns null when done, or stores a pending
// choice in state.pending and returns it (resume with resumeEffects()).
// `then` names what happens once everything has resolved (e.g. 'endTurn').
export function resolveEffects(state, ctx, effects, then = null) {
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    let refs = [];
    if (e.target) {
      const legal = candidates(state, ctx, e.target, e);
      if (e.target.mode === 'targeted') {
        if (!ctx.target || !legal.some((r) => sameRef(r, ctx.target))) throw new Error('That is not a legal target');
        refs = [ctx.target];
      } else {
        refs = legal;
      }
    }
    const choice = OPS[e.op](state, ctx, e, refs);
    if (choice) {
      state.pending = { who: ctx.who, ...choice, ctx, rest: effects.slice(i + 1), then };
      return state.pending;
    }
  }
  return null;
}

// --- Summoning ------------------------------------------------------------------

// Every summon goes through here: the Pokémon arrives (Spent, unless it has
// Quick Attack), Passive bonuses apply, then summon triggers fire.
export function summon(state, who, card, zone, space) {
  const p = state.players[who];
  if (p.zones[zone]?.pokemon[space] !== null) throw new Error('Choose an empty Pokémon Space');
  if (!summonSpaces(state, who).some((s) => s.zone === zone && s.space === space)) {
    throw new Error(`Zone ${zone + 1} has fallen on this side; no new Pokémon can go there`);
  }
  p.hand = p.hand.filter((h) => h.uid !== card.uid);
  p.zones[zone].pokemon[space] = inPlay(card, { spent: !hasKeyword(card, 'Quick Attack') });
  const ref = { kind: 'pokemon', owner: who, zone, space };
  refreshAuras(state);
  fireTriggers(state, { type: 'summon', ref, card });
  return ref;
}

// --- Passives -------------------------------------------------------------------

// Effect sources that can hold Passives or abilities: Trainers still in play,
// plus (later) Pokémon in the arena with an `ability`.
function sources(state) {
  const list = activeTrainers(state).map(({ ref, card }) => ({ ref, card, passive: card.passive }));
  for (const { ref, card } of arenaPokemon(state)) {
    if (card.ability) list.push({ ref, card, passive: { triggers: [card.ability] } });
  }
  return list;
}

function sourceCtx(state, ref, card) {
  return {
    who: ref.owner,
    source: { kind: card.cardType === 'Trainer' ? 'trainer' : 'pokemon', owner: ref.owner, zone: ref.zone, uid: card.uid, name: card.name },
    label: `${whose(state, ref.owner)} ${card.name}'s ${card.cardType === 'Trainer' ? 'Passive' : 'ability'}`,
  };
}

function eventMatches(state, match = {}, ctx, event) {
  if (match.self && event.card.uid !== ctx.source.uid) return false;
  if (match.side && !sidesFor(ctx, match.side).includes(event.ref.owner)) return false;
  if (match.zone === 'source' && event.ref.zone !== ctx.source.zone) return false;
  return true;
}

// Fires every trigger listening for this event: { type, ref, card }.
export function fireTriggers(state, event) {
  const list = sources(state);
  // A defeated Pokémon has left the arena but its own "On Defeated" still fires.
  if (event.type === 'defeated' && event.card.ability) {
    list.push({ ref: event.ref, card: event.card, passive: { triggers: [event.card.ability] } });
  }
  for (const { ref, card, passive } of list) {
    for (const trigger of passive?.triggers ?? []) {
      if (trigger.on !== event.type) continue;
      const ctx = { ...sourceCtx(state, ref, card), event };
      if (eventMatches(state, trigger.match, ctx, event)) resolveEffects(state, ctx, trigger.effects);
    }
  }
}

// Recalculates every Passive stat bonus. Gaining a Strength bonus raises
// current and maximum Strength; losing one lowers the maximum, and current
// Strength only if it is now above the maximum, so it never defeats a Pokémon.
export function refreshAuras(state) {
  const auras = activeTrainers(state).filter(({ card }) => card.passive?.aura);
  for (const { ref, card } of arenaPokemon(state)) {
    card.aura ??= {};
    const next = {};
    for (const t of auras) {
      const ctx = sourceCtx(state, t.ref, t.card);
      const { target, attack, strength } = t.card.passive.aura;
      if (candidates(state, ctx, { ...target, mode: 'area' }).some((r) => sameRef(r, ref))) {
        next[t.card.uid] = { attack, strength, name: t.card.name, owner: t.ref.owner };
      }
    }
    for (const [uid, bonus] of Object.entries(next)) {
      if (card.aura[uid]) continue;
      card.aura[uid] = bonus;
      card.currentStrength += bonus.strength;
      const what = bonus.attack ? `${signed(bonus.attack)}/${signed(bonus.strength)}` : `${signed(bonus.strength)} Strength`;
      log(state, `${whose(state, bonus.owner)} ${bonus.name}'s Passive: ${describeRef(state, ref)} gains ${what}.`);
    }
    for (const [uid, bonus] of Object.entries(card.aura)) {
      if (next[uid]) continue;
      delete card.aura[uid];
      card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
      const what = describeRef(state, ref);
      log(state, `${what[0].toUpperCase()}${what.slice(1)} loses the bonus from ${bonus.name}'s Passive.`);
    }
  }
}

// After damage: release defeated Pokémon, fire their triggers, and
// recalculate Passives (a removed Trainer's bonuses stop).
export function settle(state) {
  for (const { ref, card } of releaseDefeated(state)) fireTriggers(state, { type: 'defeated', ref, card });
  refreshAuras(state);
}
