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
//   gainEnergy   { amount }                        extra Base Energy this Round (may pass 10)
//   releaseLocation {}                             the source Location goes to the Released Pile
//   attachHeld   { target }                        attach the Item being used (ctx.item) as a
//                                                  Held Item; one per Pokémon, the old one goes to the PokéMart
//   ready        { target }                        a Spent Pokémon becomes Active
//   burn         { amount, target }                Burn X: adds X Burn counters (Pokémon or Trainer)
//   applyStatus  { status, amount, target }        the same for any status in STATUSES (status.js)
//   douse        { target }                        removes all Burn
//   cure         { target }                        removes every status (Burn, Sleep, Leech Seed)
//   gainGrowth   { amount, each? }                 gain Growth (each: true, both players; with a
//                                                  target, only if one is left: "If it's a Grass Pokémon")
//   spendGrowth  { max }                           spend up to `max` Growth, as many as the player chose
//                                                  (ctx.growth; all of it up to max by default)
//   damage with amountFrom: 'growthSpent'          as much damage as spendGrowth spent (Solar Beam)
//   rareCandy    { target }                        this Round, that Basic may Evolve straight into its Stage 2
//   search with evolvesFromArena: true             only Pokémon that evolve from one in your arena
//   applyStatus with status 'sleep' or 'leechSeed' (Pokémon only, no amount needed)
//   grant        { keyword, amount?, thisRound?, target }  the card gains an Innate keyword
//   gainDollars  { amount }                        gain PokéDollars
//   buff and grant with thisRound: true expire at Supper (after Burn and On Supper)
//   onlyIf       a card condition: the effect only applies to targets matching it
//                ("If it's a Fire Pokémon, it also gains Scorch 1")
//   amountIf     { weather, min, amount }: this amount instead while that Weather's
//                combined count is at least min ("or 3 if Rain is 2 or more")
//   retain       { target }                        a card in hand gains Retain (until it leaves your hand)
//   reduceCost   { amount, target }                a Pokémon in hand costs less (until it leaves your hand)
//   search       { filter, count?, retain? }        choose matching cards from your Draw Pile into
//                                                  your hand, then shuffle (none found: nothing happens)
//   return       { filter, count?, upTo?, retain? } choose matching cards from your Discard Pile
//                                                  into your hand (never the Released Pile)
//   freeSummon   { filter, active? }               you may summon a matching Pokémon from your hand
//                                                  without paying its cost (normal summon rules)
//
// SELECTOR     { mode, side, kinds, zone, filter }
//   mode    'targeted' (the player chooses one) | 'area' (all that match) |
//           'event' (a card from the triggering event; role: 'ref' (default) or 'attacker') |
//           'chosen' (the card an earlier effect of this card targeted, if still in play) |
//           'self' (the Pokémon whose ability this is, if still in the arena)
//   side    'friendly' | 'opponent' | 'any'       relative to whoever owns the effect
//   kinds   ['pokemon'] (default) | ['pokemon', 'trainer'] | ['trainer']
//           'hand': Pokémon cards in hand (refs { kind: 'hand', owner, uid })
//           'handCard': any card in hand (filter on any printed field)
//   zone    'source': only the source's Zone, both sides of the arena
//           'target': only the Zone of the target chosen for this card
//   pick    'zone' (with mode 'targeted'): the player chooses a Zone that has
//           a matching card; the effect applies to every matching card there
//   filter  a card condition (see matchesCard)     Pokémon only
//   damaged true: only cards below their maximum Strength
//   optional true (with mode 'targeted'): the card can be played with no legal target; that part does nothing
//
// PASSIVE      { aura?, triggers? }
//   aura      { attack, strength, target: selector } continuous stat bonus,
//             recalculated whenever the board changes
//   triggers  [{ on, match, effects }]
//             on: 'summon' | 'attack' | 'defend' | 'defeated' | 'breakfast' | 'supper' |
//                 'knockout' | 'trainerStrike' | 'heal' | 'evolve'
//             match: { side?, zone?: 'source', self?: true, notSelf?: true, kind?, targetKind? }
//             for the event's card (Rally: on 'summon', another friendly Pokémon in its Zone)
//
// POKÉMON ABILITY  card.ability = { on, match: { self: true, ... }, effects }, shown
//   as its Effect Trigger Word + Effect Text (On Summon → 'summon', and so on).
//   A card with several has a list, each with its own word and text (abilities() in cardData.js).
//
// RESOLVING goes through one stack in state.stack, worked by run():
//   { kind: 'effects', ctx, effects, i }   a source's effects, one at a time
//   { kind: 'step', step, ... }            the rest of an Action or Phase (game.js)
// New triggers go on top, so they resolve immediately. Triggers from the same
// moment resolve initiative player first, then zone 1 → 3, left to right
// (a Trainer after the Pokémon in its zone). A choice (a target, a free
// summon) pauses the stack in state.pending until resolveChoice.
//
// CONTEXT (ctx) for resolving: { who, source: { kind, owner, zone, space?, uid, name },
//   label, text?, target?, event?, drawn? }. All plain data, so it can be stored in
//   state while a choice is pending.
//
// INNATE POWERS are keywords the rules check directly (keywords.js).
// STATUS EFFECTS (Burn) are counters on cards (status.js).

import { WEATHER } from './cardData.js';
import {
  PLAYERS, opponentOf, log, whose, draw, canDraw, arenaPokemon, activeTrainers, cardAt, sameRef, weatherCounts, weatherTotal,
  describeRef, summonSpaces, damage, heal, releaseDefeated, maxStrengthOf, strengthOf, inPlay, heldBonus, toMart, emit, info,
  enterHand, earnDollars, secretOf, verbFor, yourOf, weatherRule, nameOf,
} from './board.js';
import { shuffle } from './random.js';
import { hasKeyword, keywordAmount, afterShell } from './keywords.js';
import { applyStatus, clearStatus, cureAll, STATUSES } from './status.js';

export { hasKeyword };

// --- Selectors -----------------------------------------------------------------

function sidesFor(ctx, side) {
  if (side === 'friendly') return [ctx.who];
  if (side === 'opponent') return [opponentOf(ctx.who)];
  return PLAYERS;
}

// A general card condition over any printed field, e.g.
//   { cardType: 'Pokémon', speedTier: 'Swift' }
//   { pokemonType: ['Water', 'Ice'] }          any of these
//   { energyCost: { min: 3 } }                  a range (min and/or max)
//   { pokemonType: { not: 'Fire' } }            anything but (a value or a list)
// Every field must match.
export function matchesCard(card, condition = {}) {
  return Object.entries(condition).every(([field, want]) => {
    const value = card[field];
    if (Array.isArray(want)) return want.includes(value);
    if (want && typeof want === 'object' && 'not' in want) {
      return Array.isArray(want.not) ? !want.not.includes(value) : value !== want.not;
    }
    if (want && typeof want === 'object') {
      return typeof value === 'number' && (want.min === undefined || value >= want.min) && (want.max === undefined || value <= want.max);
    }
    return value === want;
  });
}

const passesFilter = matchesCard;

// Every card a selector could apply to, as refs. `op` adds the stat rule:
// a Strength-Type buff only fits Pokémon of that Strength-Type.
export function candidates(state, ctx, selector, op = {}) {
  if (selector.mode === 'chosen') {
    const ref = ctx.target;
    if (!ref || ref.kind === 'zone') return [];
    const card = cardAt(state, ref);
    const inPlay = card && card.uid === ctx.targetUid && (ref.kind !== 'trainer' || card.strength > 0) && (ref.kind !== 'pokemon' || card.currentStrength > 0);
    return inPlay ? [ref] : [];
  }
  if (selector.mode === 'self') {
    const { owner, zone, space, uid } = ctx.source;
    const ref = { kind: 'pokemon', owner, zone, space };
    const card = cardAt(state, ref);
    return card?.uid === uid && card.currentStrength > 0 ? [ref] : [];
  }
  if (selector.mode === 'event') {
    const ref = ctx.event?.[selector.role ?? 'ref'];
    return ref && cardAt(state, ref)?.uid === ref.uid ? [ref] : [];
  }
  if (selector.pick === 'zone') {
    // The Zones that have at least one card the effect would apply to.
    const cards = candidates(state, ctx, { ...selector, pick: undefined, mode: 'area' }, op);
    return [...new Set(cards.map((r) => r.zone))].sort().map((zone) => ({ kind: 'zone', owner: ctx.who, zone }));
  }
  const kinds = selector.kinds ?? ['pokemon'];
  const sides = sidesFor(ctx, selector.side ?? 'any');
  const inZone = (ref) => (selector.zone === 'source' ? ref.zone === ctx.source.zone
    : selector.zone === 'target' ? ref.zone === ctx.target?.zone : true);
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
  if (kinds.includes('handCard') && selector.zone === undefined) {
    for (const owner of sides) {
      for (const card of state.players[owner].hand) {
        if (passesFilter(card, selector.filter ?? {})) out.push({ kind: 'hand', owner, uid: card.uid });
      }
    }
  }
  if (kinds.includes('hand') && selector.zone === undefined) {
    for (const owner of sides) {
      for (const card of state.players[owner].hand) {
        if (card.cardType === 'Pokémon' && passesFilter(card, filter)) out.push({ kind: 'hand', owner, uid: card.uid });
      }
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
// card to draw, a targeted effect needs a legal target, and an area card needs
// something to affect: at least one of its area parts must (Surf with no enemy
// Pokémon still heals). Area parts tied to the chosen target (zone: 'target')
// follow whatever is chosen, so they aren't checked ahead. (Triggers don't
// ask; they just affect whatever is there.) ctx.willDiscard counts cards a
// cost puts in the Discard Pile first, which a draw can reshuffle.
export function canResolve(state, ctx, effects) {
  const areas = effects.filter((e) => e.target?.mode === 'area' && e.target.zone !== 'target');
  if (areas.length && !areas.some((e) => candidates(state, ctx, e.target, e).length > 0)) return false;
  return effects.every((e) => {
    if (e.op === 'draw') return canDraw(state, ctx.who) || ctx.willDiscard > 0;
    // Return needs something to return (the Discard Pile is public), unless it says "up to".
    // Search can always be played: the Draw Pile is hidden.
    if (e.op === 'return') return e.upTo || pileMatches(state.players[ctx.who].discard, e.filter).length > 0;
    if (e.target?.mode === 'targeted') return e.target.optional || candidates(state, ctx, e.target, e).length > 0;
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
    const shown = drawn.length ? secretOf(ctx.who, `: ${drawn.map((c) => c.name).join(', ')}`, '') : '';
    log(state, `${ctx.label}: ${state.players[ctx.who].name} drew ${drawn.length} card${drawn.length === 1 ? '' : 's'}${shown}.`);
  },

  damage(state, ctx, e, refs) {
    const amount = e.amountFrom === 'growthSpent' ? ctx.growthSpent ?? 0 : amountOf(state, e);
    if (amount <= 0) {
      log(state, `${ctx.label}: no damage.`);
      return;
    }
    for (const ref of refs) {
      const what = describeRef(state, ref);
      const dealt = afterShell(cardAt(state, ref), amount);
      const hitBy = { kind: ctx.source.kind, id: ctx.source.id, type: ctx.source.type };
      const [before, after] = damage(state, ref, amount, { by: ctx.source.kind === 'weather' ? null : ctx.who, hitBy });
      // A Pokémon's own ability damaging an enemy Trainer: a Trainer strike for its quests.
      if (ref.kind === 'trainer' && ref.owner !== ctx.who && ctx.source.kind === 'pokemon' && before > after) {
        questEvent(state, ctx.who, { type: 'trainerStrike', zone: ctx.source.zone });
      }
      log(state, `${ctx.label}: ${dealt} damage to ${what}${dealt !== amount ? ` (Shell: ${amount} → ${dealt})` : ''}. Strength ${before} → ${Math.max(after, 0)}.`);
    }
    // On Knockout: a Pokémon's own ability damage defeated enemy Pokémon. Queued
    // under the On Defeated triggers settle() adds, so those resolve first.
    knockouts(state, ctx, refs);
    settle(state);
  },

  // Healing: On Heal fires for each card actually healed by at least 1.
  heal(state, ctx, e, refs) {
    const healed = [];
    for (const ref of refs) {
      const what = describeRef(state, ref);
      const [before, after] = heal(state, ref, e.amount);
      log(state, `${ctx.label}: healed ${what}. Strength ${before} → ${after}.`);
      if (after > before) healed.push({ type: 'heal', ref: { ...ref, uid: cardAt(state, ref).uid }, card: cardAt(state, ref), amount: after - before });
    }
    // "Heal N Strength in total": what your own cards and effects actually heal on your cards (not Weather).
    const mine = healed.filter((h) => h.ref.owner === ctx.who).reduce((sum, h) => sum + h.amount, 0);
    if (mine && ctx.source.kind !== 'weather') questEvent(state, ctx.who, { type: 'heal', amount: mine });
    if (healed.length) fireTriggers(state, healed);
  },

  burn(state, ctx, e, refs) {
    for (const ref of refs) burnCard(state, ref, amountOf(state, e), ctx.who, ctx.source.kind === 'pokemon' ? ctx.source : null);
  },

  gainDollars(state, ctx, e) {
    earnDollars(state, ctx.who, amountOf(state, e), `from ${ctx.label}`);
  },

  applyStatus(state, ctx, e, refs) {
    if (!STATUSES[e.status]) throw new Error(`Unknown status: ${e.status}`);
    for (const ref of refs) {
      if (e.status === 'burn') burnCard(state, ref, e.amount, ctx.who, ctx.source.kind === 'pokemon' ? ctx.source : null);
      else if (applyStatus(state, ref, e.status, e.amount ?? 1, ctx.who) && ref.owner !== ctx.who
        && (e.status === 'sleep' || e.status === 'leechSeed')) {
        // "Put to Sleep or Leech Seed N times": each one applied to an enemy Pokémon.
        questEvent(state, ctx.who, { type: 'sleepSeed' });
      }
    }
  },

  // Cure all statuses (Full Heal).
  cure(state, ctx, e, refs) {
    for (const ref of refs) cureAll(state, ref, `${ctx.label}: cured`);
  },

  gainGrowth(state, ctx, e, refs) {
    if (e.target && !refs.length) return;   // "If it's a Grass Pokémon, also gain 1 Growth"
    for (const who of e.each ? PLAYERS : [ctx.who]) gainGrowth(state, who, amountOf(state, e), `from ${ctx.label}`);
  },

  // Solar Beam: spend up to `max` Growth (the player's choice, ctx.growth), remembered for the damage that follows.
  spendGrowth(state, ctx, e) {
    const p = state.players[ctx.who];
    const most = Math.min(e.max, p.growth ?? 0);
    const spent = Math.max(0, Math.min(most, ctx.growth ?? most));
    p.growth -= spent;
    ctx.growthSpent = spent;
    emit(state, 'growthSpent', { who: ctx.who, amount: spent, after: p.growth, source: ctx.label });
    log(state, `${ctx.label}: ${p.name} ${verbFor(ctx.who, 'spend', 'spends')} ${spent} Growth (now ${p.growth}).`);
  },

  // Rare Candy: this Round, the Basic may Evolve straight into its Stage 2, even if it was summoned this Round.
  rareCandy(state, ctx, e, refs) {
    for (const ref of refs) {
      cardAt(state, ref).candyRound = state.round;
      emit(state, 'rareCandy', { who: ctx.who, target: info(state, ref) });
      log(state, `${ctx.label}: this Round, ${describeRef(state, ref)} may Evolve straight into its Stage 2.`);
    }
  },

  // Retain until the card leaves your hand.
  retain(state, ctx, e, refs) {
    for (const ref of refs) {
      const card = cardAt(state, ref);
      if (!card || card.retain || card.retainGranted) continue;
      card.retainGranted = true;
      emit(state, 'retainGranted', { who: ref.owner, uid: card.uid, name: card.name, source: ctx.label });
      // The opponent's hand is hidden: its card stays unnamed.
      log(state, `${ctx.label}: ${secretOf(ref.owner, card.name, 'a card in hand')} gains Retain.`);
    }
  },

  // A Pokémon in hand costs less, until it leaves your hand (never below 0).
  reduceCost(state, ctx, e, refs) {
    for (const ref of refs) {
      const card = cardAt(state, ref);
      card.costDown = (card.costDown ?? 0) + e.amount;
      emit(state, 'costReduced', { who: ref.owner, uid: card.uid, name: card.name, amount: e.amount, source: ctx.label });
      log(state, `${ctx.label}: ${secretOf(ref.owner, card.name, 'a Pokémon in hand')} costs ${e.amount} less while it stays in hand.`);
    }
  },

  // Search the Draw Pile; Return from the Discard Pile. The player picks
  // (state.pending kind 'pick'); job.choice.uids holds the answer.
  search(state, ctx, e, refs, job) {
    return pickFromPile(state, ctx, e, job, 'drawPile');
  },

  return(state, ctx, e, refs, job) {
    return pickFromPile(state, ctx, e, job, 'discard');
  },

  // A free summon: pick a matching Pokémon from hand (or none), then where it
  // goes (or keep it). Costs nothing; otherwise a normal summon.
  freeSummon(state, ctx, e, refs, job) {
    const p = state.players[ctx.who];
    if (job.picked === undefined) {
      const options = p.hand.filter((c) => c.cardType === 'Pokémon' && !isEvolution(c) && passesFilter(c, e.filter ?? {})).map((c) => c.uid);
      if (!options.length || !summonSpaces(state, ctx.who).length) {
        emit(state, 'noTarget', { source: ctx.label });
        log(state, `${ctx.label}: ${!options.length ? 'no matching Pokémon in hand' : 'no empty Pokémon Space'}, so nothing happens.`);
        return null;
      }
      if (!job.choice) {
        state.pending = { who: ctx.who, kind: 'pick', from: 'hand', op: 'freeSummon', options, min: 0, max: 1, label: ctx.label, text: ctx.text };
        return 'pause';
      }
      job.picked = job.choice.uids?.[0] ?? null;
      delete job.choice;
      if (!job.picked) {
        log(state, `${ctx.label}: ${p.name} chose not to summon.`);
        return null;
      }
    }
    if (!job.picked) return null;
    const card = p.hand.find((c) => c.uid === job.picked);
    if (!job.choice) {
      state.pending = { who: ctx.who, kind: 'freeSummon', uid: card.uid, label: ctx.label };
      return 'pause';
    }
    if (job.choice.zone === undefined || job.choice.zone === null) {
      log(state, `${ctx.label}: ${p.name} kept ${card.name} in hand.`);
      return null;
    }
    const { zone, space } = job.choice;
    log(state, `${ctx.label}: ${card.name} was summoned for free into Zone ${zone + 1}, Space ${space + 1}.`);
    const ref = summon(state, ctx.who, card, zone, space);
    if (e.active) {
      cardAt(state, ref).spent = false;
      emit(state, 'ready', { target: info(state, ref) });
      log(state, `${ctx.label}: ${card.name} arrives Active.`);
    }
    return null;
  },

  douse(state, ctx, e, refs) {
    for (const ref of refs) clearStatus(state, ref, 'burn', `${ctx.label}: Douse`);
  },

  grant(state, ctx, e, refs) {
    for (const ref of refs) {
      const card = cardAt(state, ref);
      const entry = { key: e.keyword, ...(e.amount ? { amount: e.amount } : {}), ...(e.thisRound ? { thisRound: true } : {}) };
      (card.granted ??= []).push(entry);
      emit(state, 'keywordGranted', { target: info(state, ref), keyword: e.keyword, amount: e.amount, thisRound: Boolean(e.thisRound), source: ctx.label });
      log(state, `${ctx.label}: ${describeRef(state, ref)} gains ${e.keyword}${e.amount ? ` ${e.amount}` : ''}${e.thisRound ? ' this Round' : ''}.`);
    }
  },

  buff(state, ctx, e, refs) {
    for (const ref of refs) {
      const card = cardAt(state, ref);
      const attack = e.attack ?? 0;
      const strength = e.strength ?? 0;
      if (e.thisRound && ref.kind === 'pokemon') {
        (card.roundBuffs ??= []).push({ attack, strength, source: ctx.label });
      } else {
        card.attackBonus = (card.attackBonus ?? 0) + attack;
        card.strengthBonus = (card.strengthBonus ?? 0) + strength;
      }
      card.currentStrength += strength;
      emit(state, 'buff', { target: info(state, ref), attack, strength, source: ctx.label, thisRound: Boolean(e.thisRound) });
      const what = e.strengthType && !attack ? `${signed(strength)} ${e.strengthType}`
        : !strength ? `${signed(attack)} Attack` : `${signed(attack)}/${signed(strength)}`;
      log(state, `${ctx.label}: ${describeRef(state, ref)} gains ${what}${e.thisRound ? ' this Round' : ''}.`);
    }
  },

  // Attaches the Item being used as a Held Item. A Strength bonus raises current
  // Strength in the arena; replacing one that gave more follows the Passive-loss rule.
  attachHeld(state, ctx, e, refs) {
    const { inDelivery, ...item } = ctx.item;
    for (const ref of refs) {
      const card = cardAt(state, ref);
      const what = describeRef(state, ref);
      const old = card.heldItem;
      const before = heldBonus(card, 'strength');
      card.heldItem = item;
      emit(state, 'itemAttached', { who: ctx.who, item: { uid: item.uid, name: item.name }, target: info(state, ref) });
      if (old) toMart(state, old, `was replaced on ${what}`);
      log(state, `${ctx.label}: ${item.name} is now held by ${what}.`);
      if (ref.kind !== 'pokemon') continue;
      // A Strength bonus raises current Strength too; a −Strength (Choice Band)
      // lowers current and maximum alike, never below 1, so it never defeats.
      const delta = heldBonus(card, 'strength') - before;
      if (delta > 0) card.currentStrength += delta;
      else if (delta < 0) card.currentStrength = Math.max(1, Math.min(card.currentStrength + delta, maxStrengthOf(card)));
    }
  },

  ready(state, ctx, e, refs) {
    for (const ref of refs) {
      // An Asleep Pokémon stays Spent until it wakes at Breakfast.
      if (cardAt(state, ref).status?.sleep) {
        log(state, `${ctx.label}: ${describeRef(state, ref)} is Asleep and stays Spent.`);
        continue;
      }
      cardAt(state, ref).spent = false;
      emit(state, 'ready', { target: info(state, ref) });
      log(state, `${ctx.label}: ${describeRef(state, ref)} becomes Active.`);
    }
  },

  // A completed quest's Location leaves play once its effect is done.
  releaseLocation(state, ctx) {
    const p = state.players[ctx.who];
    const zone = p.zones[ctx.source.zone];
    if (zone.location?.uid !== ctx.source.uid) return;
    p.released.push(zone.location);
    emit(state, 'cardMoved', { uid: zone.location.uid, name: zone.location.name, owner: ctx.who, to: 'released' });
    log(state, `${ctx.label} goes to the Released Pile.`);
    zone.location = null;
    refreshAuras(state);   // its Weather Tokens stop counting
  },

  gainEnergy(state, ctx, e) {
    const p = state.players[ctx.who];
    p.baseEnergy += e.amount;
    emit(state, 'energyGained', { who: ctx.who, amount: e.amount, source: ctx.label });
    log(state, `${ctx.label}: ${p.name} ${verbFor(ctx.who, 'gain', 'gains')} ${e.amount} extra Base Energy this Round (now ${p.baseEnergy}).`);
  },

};

// Burn on a card, counted for the applier's "Apply Burn N times" quests (one
// per card). source: the Pokémon applying it (Scorch, its own ability), if
// any: a friendly Trainer's burnBonus in its Zone adds to it (Blaine).
export function burnCard(state, ref, amount, by, source = null) {
  if (!cardAt(state, ref) || amount <= 0) return;
  const trainer = source && state.players[source.owner].zones[source.zone]?.trainer;
  const bonus = trainer && trainer.strength > 0 ? trainer.passive?.burnBonus ?? 0 : 0;
  if (bonus) log(state, `${whose(state, source.owner)} ${trainer.name}'s Passive: Burn +${bonus}.`);
  // Sun 2: each Burn applied is increased by 1.
  const sun = weatherRule(state, 'burnPlus') ? 1 : 0;
  if (sun) log(state, 'Weather (☀ Sun 2): Burn +1.');
  applyStatus(state, ref, 'burn', amount + bonus + sun, by);
  if (by) questEvent(state, by, { type: 'burn' });
}

// Growth (docs/decks.md 2.7): a player's pool, kept between Rounds. Every gain
// counts for "Gain N Growth" quests.
export function gainGrowth(state, who, amount, why) {
  if (!amount) return;
  const p = state.players[who];
  p.growth = (p.growth ?? 0) + amount;
  emit(state, 'growthGained', { who, amount, after: p.growth });
  log(state, `${nameOf(who)} ${verbFor(who, 'gain', 'gains')} ${amount} Growth ${why} (now ${p.growth}).`);
  questEvent(state, who, { type: 'growth', amount });
}

// Leech Seed at Supper, after Burn (docs/decks.md 2.9). Each seed deals 1
// effect damage to its Pokémon (Shell applies, minimum 1), heals the seeder's
// most-damaged Pokémon by 1 and gives the seeder +1 Growth; with Rain 6 it
// drains 2 (2 damage, heals 2). A defeat counts as the seeder's.
export function resolveLeechSeeds(state) {
  const seeds = arenaPokemon(state).filter(({ card }) => card.status?.leechSeed)
    .map(({ ref, card }) => ({ ref: { ...ref, uid: card.uid }, card, by: card.status.leechSeed.by }));
  if (!seeds.length) return;
  const rain = weatherRule(state, 'leechTwo') ? 2 : 1;
  for (const s of seeds) {
    if (cardAt(state, s.ref)?.uid !== s.card.uid) continue;
    const what = describeRef(state, s.ref);
    // Ramos: Leech Seeds on enemy Pokémon in his Zone drain 1 more.
    const trainer = s.ref.owner !== s.by ? state.players[s.by].zones[s.ref.zone]?.trainer : null;
    const bonus = trainer && trainer.strength > 0 ? trainer.passive?.leechBonus ?? 0 : 0;
    const drain = rain + bonus;
    const why = [rain > 1 && '☔ Rain 6: drains 2', bonus && `${trainer.name}'s Passive: +${bonus}`].filter(Boolean).join('; ');
    const [before, after] = damage(state, s.ref, drain, { cause: 'leechSeed', by: s.by, hitBy: { kind: 'leechSeed' } });
    log(state, `Leech Seed${why ? ` (${why})` : ''}: ${before - Math.max(after, 0)} damage to ${what}. Strength ${before} → ${Math.max(after, 0)}.`);
    const target = bigRootHolder(state, s.by) ?? mostDamaged(state, s.by);
    const ctx = { who: s.by, source: { kind: 'status', name: 'Leech Seed', owner: s.by, uid: s.card.uid }, label: `${whose(state, s.by)} Leech Seed` };
    emit(state, 'leechDrain', { who: s.by, from: info(state, s.ref), to: target ? info(state, target) : null, amount: drain });
    if (target) OPS.heal(state, ctx, { amount: drain }, [target]);
    gainGrowth(state, s.by, 1, 'from Leech Seed');
  }
}

// Big Root: "Leech Seeds you apply heal the holder first": a damaged holder of the seeder's (the first, zone 1 → 3).
function bigRootHolder(state, who) {
  const found = arenaPokemon(state).find(({ ref, card }) => ref.owner === who && card.heldItem?.held?.leechFirst
    && card.currentStrength > 0 && card.currentStrength < maxStrengthOf(card));
  return found ? { ...found.ref, uid: found.card.uid } : null;
}

// The seeder's Pokémon that has taken the most damage (ties: the first, zone 1 → 3, left to right).
function mostDamaged(state, who) {
  let best = null;
  for (const { ref, card } of arenaPokemon(state)) {
    if (ref.owner !== who || card.currentStrength <= 0) continue;
    const hurt = maxStrengthOf(card) - card.currentStrength;
    if (hurt > 0 && (!best || hurt > best.hurt)) best = { ref: { ...ref, uid: card.uid }, hurt };
  }
  return best?.ref ?? null;
}

// An effect's amount: amountIf swaps in another while a Weather count is high enough.
function amountOf(state, e) {
  const cond = e.amountIf;
  if (cond && (weatherCounts(state)[cond.weather] ?? 0) >= cond.min) return cond.amount;
  return e.amount;
}

// Cards in a pile matching a filter (any printed field).
export function pileMatches(pile, filter = {}) {
  return pile.filter((c) => passesFilter(c, filter));
}

// Search (Draw Pile) or Return (Discard Pile): the player picks matching
// cards, they go into the hand (gaining Retain if the effect says so), and a
// searched Draw Pile is shuffled. Nothing matching: nothing happens (no shuffle).
function pickFromPile(state, ctx, e, job, pileKey) {
  const p = state.players[ctx.who];
  const searching = pileKey === 'drawPile';
  const verb = searching ? 'Search' : 'Return';
  const inArena = new Set(arenaPokemon(state).filter(({ ref }) => ref.owner === ctx.who).map(({ card }) => card.name));
  const matches = pileMatches(p[pileKey], e.filter).filter((c) => !e.evolvesFromArena || inArena.has(c.evolvesFrom));
  const count = Math.min(e.count ?? 1, matches.length);
  if (!matches.length) {
    emit(state, searching ? 'searchNone' : 'returnNone', { who: ctx.who, source: ctx.label });
    log(state, `${ctx.label}: ${verb} found no matching card${searching ? ' in the Draw Pile' : ' in the Discard Pile'}, so nothing happens.`);
    return null;
  }
  if (!job.choice) {
    state.pending = {
      who: ctx.who, kind: 'pick', from: searching ? 'draw' : 'discard', op: e.op, options: matches.map((c) => c.uid),
      min: e.upTo ? 0 : count, max: count, label: ctx.label, text: ctx.text, retain: Boolean(e.retain),
    };
    return 'pause';
  }
  const uids = job.choice.uids ?? [];
  const picked = uids.map((uid) => p[pileKey].find((c) => c.uid === uid));
  if (picked.some((c) => !c || !matches.includes(c))) throw new Error('Choose from the matching cards');
  p[pileKey] = p[pileKey].filter((c) => !uids.includes(c.uid));
  for (const c of picked) {
    p.hand.push(enterHand(c));
    if (e.retain) c.retainGranted = true;
  }
  emit(state, searching ? 'searched' : 'returned', { who: ctx.who, source: ctx.label, cards: picked.map((c) => ({ uid: c.uid, name: c.name })), retain: Boolean(e.retain) });
  const names = picked.map((c) => c.name).join(', ') || 'nothing';
  log(state, `${ctx.label}: ${p.name} ${searching ? 'searched the Draw Pile for' : 'returned'} ${searching ? secretOf(ctx.who, names, `${picked.length} card${picked.length === 1 ? '' : 's'}`) : names}${searching ? '' : ' from the Discard Pile'} to ${yourOf(ctx.who)} hand${e.retain && picked.length ? ' (with Retain)' : ''}.`);
  if (searching) {
    shuffle(state, p.drawPile);
    emit(state, 'shuffledDraw', { who: ctx.who });
    log(state, `${p.name} shuffled ${yourOf(ctx.who)} Draw Pile.`);
  }
  return null;
}

// --- The stack ------------------------------------------------------------------

// extra: { onlyIfHurt: true } skips the job (silently) if the event's card is
// at full Strength or gone by the time it would resolve (Regenerate).
export function queueEffects(state, ctx, effects, extra = {}) {
  (state.stack ??= []).push({ kind: 'effects', ctx, effects, i: 0, ...extra });
}

// Returns the queued step, so an Action can add what it learns later (afterAttack).
export function queueStep(state, step, data = {}) {
  const job = { kind: 'step', step, ...data };
  (state.stack ??= []).push(job);
  return job;
}

// One effect of a job. Returns 'pause' when a choice is needed.
function applyEffect(state, job, e) {
  const { ctx } = job;
  let refs = [];
  if (e.target) {
    const legal = candidates(state, ctx, e.target, e);
    if (e.target.mode === 'targeted') {
      if (!ctx.target) {
        // A trigger's target is chosen as it resolves; with none, nothing happens.
        if (!legal.length) {
          emit(state, 'noTarget', { source: ctx.label });
          log(state, `${ctx.label}: no legal target, so nothing happens.`);
          return null;
        }
        state.pending = { who: ctx.who, kind: 'target', op: e.op, options: legal, label: ctx.label, text: ctx.text };
        return 'pause';
      }
      if (!legal.some((r) => sameRef(r, ctx.target))) throw new Error('That is not a legal target');
      if (ctx.target.kind !== 'zone') ctx.targetUid ??= cardAt(state, ctx.target)?.uid;
      refs = e.target.pick === 'zone'
        ? candidates(state, ctx, { ...e.target, pick: undefined, mode: 'area', zone: 'target' }, e)
        : [ctx.target];
    } else {
      refs = legal;
    }
  }
  if (e.onlyIf) refs = refs.filter((r) => matchesCard(cardAt(state, r) ?? {}, e.onlyIf));
  return OPS[e.op](state, ctx, e, refs, job);
}

// Works through the stack until it is empty or a choice is pending.
// steps: handlers for step jobs (game.js). isOver(state): true once the match
// has ended, which stops everything at once.
export function run(state, steps = {}, isOver = () => false) {
  state.stack ??= [];
  while (state.stack.length && !state.pending) {
    if (isOver(state)) break;
    const job = state.stack.at(-1);
    if (job.kind === 'step') {
      state.stack.pop();
      steps[job.step](state, job);
      continue;
    }
    if (job.i >= job.effects.length) {
      state.stack.pop();
      continue;
    }
    if (job.onlyIfHurt && job.i === 0) {
      const ref = job.ctx.event.ref;
      const card = cardAt(state, ref);
      if (card?.uid !== ref.uid || card.currentStrength >= maxStrengthOf(card)) {
        state.stack.pop();
        continue;
      }
    }
    // A triggered ability or Passive says so once, as it starts to resolve.
    if (job.ctx.event && !job.announced) {
      job.announced = true;
      const { source } = job.ctx;
      emit(state, 'abilityTriggered', { who: job.ctx.who, source: { uid: source.uid, name: source.name, owner: source.owner, kind: source.kind }, word: job.ctx.word, label: job.ctx.label });
    }
    if (applyEffect(state, job, job.effects[job.i]) === 'pause') return;
    job.i += 1;
    delete job.choice;
    delete job.picked;
  }
  if (isOver(state)) state.stack = [];
}

// Resolves effects right away (no steps). For tests and simple callers.
export function resolveEffects(state, ctx, effects) {
  queueEffects(state, ctx, effects);
  run(state);
}

// --- Summoning ------------------------------------------------------------------

// Every summon goes through here: the Pokémon arrives (Spent, unless it has
// Quick Attack), Passive bonuses apply, then summon triggers are queued.
export function summon(state, who, card, zone, space) {
  const p = state.players[who];
  if (p.zones[zone]?.pokemon[space] !== null) throw new Error('Choose an empty Pokémon Space');
  if (!summonSpaces(state, who).some((s) => s.zone === zone && s.space === space)) {
    throw new Error(`Zone ${zone + 1} has fallen on this side; no new Pokémon can go there`);
  }
  if (isEvolution(card)) throw new Error(`${card.name} evolves from ${card.evolvesFrom}: it can't be summoned on its own`);
  p.hand = p.hand.filter((h) => h.uid !== card.uid);
  // arrivedRound: it can't Evolve until a later Round (docs/decks.md 2.8).
  p.zones[zone].pokemon[space] = { ...inPlay(card, { spent: !hasKeyword(card, 'Quick Attack') }), arrivedRound: state.round };
  (p.summonedInto ??= {})[zone] = state.round;   // the first summon into this Zone this Round is done
  const ref = { kind: 'pokemon', owner: who, zone, space, uid: card.uid };
  emit(state, 'summoned', { who, target: { ...ref, name: card.name } });
  refreshAuras(state);
  fireTriggers(state, [{ type: 'summon', ref, card }]);
  questEvent(state, who, { type: 'summon', card, zone });
  return ref;
}

// --- Evolution (docs/decks.md 2.8) ------------------------------------------------

export const isEvolution = (card) => card?.cardType === 'Pokémon' && (card.stage ?? 'Basic') !== 'Basic';

// The fields only a card in the arena has: what's left is the printed card.
const RUNTIME = ['currentStrength', 'spent', 'attackBonus', 'strengthBonus', 'aura', 'weather', 'status', 'roundBuffs',
  'granted', 'lastHit', 'heldItem', 'stack', 'arrivedRound', 'evolvedRound', 'candyRound', 'abilityRound', 'xp', 'retainGranted', 'costDown'];
export function printedCard(card) {
  const out = { ...card };
  for (const key of RUNTIME) delete out[key];
  return out;
}

// The evolution card `card` (from `who`'s hand, already paid for) goes onto
// the Pokémon at `ref`. It takes the new card's name, Type, Attack, Strength,
// Speed, Innate Powers, abilities and Weather Tokens; damage carries over
// (new current = new maximum − damage taken). It keeps its Held Item, XP and
// other permanent buffs, "this Round" effects, and Active or Spent. Every
// status is cured. The card underneath stays under it (the stack). Not a
// summon: On Summon, Rally, summon quests and summon Passives don't fire;
// On Evolve does. Returns the new ref.
export function evolvePokemon(state, who, card, ref) {
  const p = state.players[who];
  const target = cardAt(state, ref);
  const taken = maxStrengthOf(target) - target.currentStrength;
  cureAll(state, ref, 'Evolved');
  const { xp = { attack: 0, strength: 0 }, retainGranted, costDown, heldItem: ownItem, ...printed } = card;
  // A Held Item put on the evolution card in hand: kept if the Pokémon has none, else it goes to the PokéMart.
  if (ownItem && target.heldItem) toMart(state, ownItem, `was held by ${card.name}, but ${target.name} already holds ${target.heldItem.name}`);
  const evolved = {
    ...printed,
    spent: target.spent,
    attackBonus: (target.attackBonus ?? 0) + xp.attack,
    strengthBonus: (target.strengthBonus ?? 0) + xp.strength,
    aura: {},
    weather: {},
    ...(target.roundBuffs ? { roundBuffs: target.roundBuffs } : {}),
    ...(target.granted ? { granted: target.granted } : {}),
    ...(target.heldItem ?? ownItem ? { heldItem: target.heldItem ?? ownItem } : {}),
    ...(target.lastHit ? { lastHit: target.lastHit } : {}),
    arrivedRound: state.round,
    evolvedRound: state.round,
    stack: [...(target.stack ?? []), printedCard(target)],
  };
  // Passive bonuses are added back by refreshAuras (raising current with maximum).
  evolved.currentStrength = maxStrengthOf(evolved) - taken;
  p.hand = p.hand.filter((h) => h.uid !== card.uid);
  p.zones[ref.zone].pokemon[ref.space] = evolved;
  const at = { kind: 'pokemon', owner: who, zone: ref.zone, space: ref.space, uid: evolved.uid };
  emit(state, 'evolved', { who, card: printedCard(evolved), uid: evolved.uid, name: evolved.name, from: { uid: target.uid, name: target.name }, target: { ...at, name: evolved.name }, phase: state.phase });
  // Evolving never defeats: with no Strength left after its damage, it stays at 1 (rules 7.1).
  evolved.currentStrength = Math.max(1, evolved.currentStrength);
  log(state, `${whose(state, who)} ${target.name} evolved into ${evolved.name} (Zone ${ref.zone + 1}, Space ${ref.space + 1}).${taken ? ` It keeps ${taken} damage: Strength ${evolved.currentStrength}.` : ''}`);
  refreshAuras(state);
  fireTriggers(state, [{ type: 'evolve', ref: at, card: evolved, from: printedCard(target) }]);
  questEvent(state, who, { type: 'evolve', card: evolved, zone: ref.zone });
  settle(state);
  return at;
}

// --- Quests ---------------------------------------------------------------------

// Something `who` did that quests count:
//   { type: 'summon' | 'attack' | 'power' | 'burn' | 'trainerStrike' | 'defeat' | 'evolve' | 'sleepSeed', card?, zone? }  +1
//   { type: 'heal' | 'growth', amount }                                          +amount
//   { type: 'presence', zone, value }   (checked at Supper) progress becomes value
// Every one of their Locations whose quest it fits moves on, each counting
// separately. A completed quest gives its XP, then its effect and the
// Location's release are queued to resolve next.
export function questEvent(state, who, event) {
  const p = state.players[who];
  p.zones.forEach((z, zone) => {
    const loc = z.location;
    const quest = loc?.quest;
    if (!quest || loc.done || quest.on !== event.type) return;
    if (quest.inZone && event.zone !== zone) return;
    if (quest.filter && !(event.card && matchesCard(event.card, quest.filter))) return;
    if (event.value !== undefined) loc.progress = event.value;
    else loc.progress += event.amount ?? 1;
    emit(state, 'questProgress', { owner: who, zone, uid: loc.uid, name: loc.name, progress: loc.progress, count: quest.count });
    const label = `${whose(state, who)} ${loc.name}`;
    log(state, `${label} quest: ${quest.label} ${loc.progress}/${quest.count}.`);
    if (loc.progress < quest.count) return;
    loc.done = true;   // until its effect has resolved and it is released
    p.xp += loc.xp;
    emit(state, 'questComplete', { owner: who, zone, uid: loc.uid, name: loc.name, xp: loc.xp });
    log(state, `${label} quest complete! ${p.name} ${verbFor(who, 'gain', 'gains')} ${loc.xp} XP (now ${p.xp}).`);
    const ctx = {
      who,
      source: { kind: 'location', owner: who, zone, uid: loc.uid, name: loc.name },
      label,
      text: loc.effectText,
    };
    queueEffects(state, ctx, [...loc.effects, { op: 'releaseLocation' }]);
  });
}

// --- Passives -------------------------------------------------------------------

// Effect sources that can hold Passives or abilities: Trainers still in play,
// and Pokémon in the arena with an `ability`.
function sources(state) {
  const list = activeTrainers(state).map(({ ref, card }) => ({ ref, card, triggers: card.passive?.triggers ?? [] }));
  for (const { ref, card } of arenaPokemon(state)) {
    if (card.ability) list.push({ ref, card, triggers: [card.ability].flat() });
  }
  return list;
}

function sourceCtx(state, ref, card) {
  const trainer = card.cardType === 'Trainer';
  return {
    who: ref.owner,
    source: { kind: trainer ? 'trainer' : 'pokemon', owner: ref.owner, zone: ref.zone, space: ref.space, uid: card.uid, name: card.name, id: card.id, type: card.pokemonType },
    label: `${whose(state, ref.owner)} ${card.name}'s ${trainer ? 'Passive' : card.effectTrigger ?? 'ability'}`,
    word: trainer ? 'Passive' : card.effectTrigger ?? 'Ability',
    text: trainer ? card.passive?.text : card.effectText,
  };
}

function eventMatches(state, match = {}, ctx, event) {
  if (match.self && event.card.uid !== ctx.source.uid) return false;
  if (match.notSelf && event.card.uid === ctx.source.uid) return false;
  if (match.kind && event.ref.kind !== match.kind) return false;
  if (match.side && !sidesFor(ctx, match.side).includes(event.ref.owner)) return false;
  if (match.zone === 'source' && event.ref.zone !== ctx.source.zone) return false;
  if (match.targetKind && event.target?.kind !== match.targetKind) return false;
  return true;
}

// Resolution order for triggers from the same moment: the player with
// initiative first, then zone 1 → 3, then left to right (Trainer last).
function orderKey(state, { owner, zone, space }) {
  return [owner === state.initiative ? 0 : 1, zone, space ?? 3];
}

// Queues every trigger listening for these events (each { type, ref, card, ... }),
// sorted by the order rule, so they resolve next, before anything already waiting.
export function fireTriggers(state, events) {
  const list = sources(state);
  // A defeated Pokémon has left the arena but its own On Defeated still fires.
  for (const event of events) {
    if (event.type === 'defeated' && event.card.ability) list.push({ ref: event.ref, card: event.card, triggers: [event.card.ability].flat() });
  }
  const fired = [];
  for (const event of events) {
    // Regenerate X heals at Breakfast with the On Breakfast abilities, ahead of the Pokémon's own.
    const regen = event.type === 'breakfast' && event.ref.kind === 'pokemon' ? keywordAmount(event.card, 'Regenerate') : 0;
    if (regen) {
      const ctx = {
        ...sourceCtx(state, event.ref, event.card),
        event,
        label: `${whose(state, event.ref.owner)} ${event.card.name}'s Regenerate ${regen}`,
        word: `Regenerate ${regen}`,
        text: `Heals ${regen} at Breakfast.`,
      };
      fired.push({ ctx, effects: [{ op: 'heal', amount: regen, target: { mode: 'event' } }], key: orderKey(state, event.ref), extra: { onlyIfHurt: true } });
    }
    for (const { ref, card, triggers } of list) {
      for (const trigger of triggers) {
        if (trigger.on !== event.type) continue;
        const ctx = { ...sourceCtx(state, ref, card), event };
        // One of several abilities: its own word and text.
        if (trigger.word) Object.assign(ctx, { label: `${whose(state, ref.owner)} ${card.name}'s ${trigger.word}`, word: trigger.word, text: trigger.text });
        if (!eventMatches(state, trigger.match, ctx, event)) continue;
        // "Once per Round": a second time this Round, it doesn't fire.
        if (trigger.oncePerRound) {
          if (card.abilityRound === state.round) continue;
          card.abilityRound = state.round;
        }
        fired.push({ ctx, effects: trigger.effects, key: orderKey(state, ref) });
      }
    }
  }
  fired.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  for (const { ctx, effects, extra } of fired.reverse()) queueEffects(state, ctx, effects, extra);
}

// On Knockout for a Pokémon whose own ability's damage left enemy Pokémon at
// 0 or less (one trigger per Pokémon defeated), if it is still in the arena.
function knockouts(state, ctx, refs) {
  if (ctx.source.kind !== 'pokemon') return;
  const src = { kind: 'pokemon', owner: ctx.source.owner, zone: ctx.source.zone, space: ctx.source.space, uid: ctx.source.uid };
  const me = cardAt(state, src);
  if (me?.uid !== src.uid || me.currentStrength <= 0) return;
  const events = refs.filter((r) => r.kind === 'pokemon' && r.owner !== ctx.who && (cardAt(state, r)?.currentStrength ?? 1) <= 0)
    .map((r) => ({ type: 'knockout', ref: src, card: me, victim: info(state, r) }));
  if (events.length) fireTriggers(state, events);
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
      const { target, attack, strength, keywords } = t.card.passive.aura;
      if (candidates(state, ctx, { ...target, mode: 'area' }).some((r) => sameRef(r, ref))) {
        next[t.card.uid] = { attack, strength, ...(keywords ? { keywords } : {}), name: t.card.name, owner: t.ref.owner };
      }
    }
    for (const [uid, bonus] of Object.entries(next)) {
      if (card.aura[uid]) continue;
      card.aura[uid] = bonus;
      card.currentStrength += bonus.strength;
      emit(state, 'buff', { target: info(state, ref), attack: bonus.attack, strength: bonus.strength, source: `${bonus.name}'s Passive` });
      const what = [
        bonus.attack ? `${signed(bonus.attack)}/${signed(bonus.strength)}` : bonus.strength ? `${signed(bonus.strength)} Strength` : '',
        ...(bonus.keywords ?? []).map((k) => (k.amount ? `${k.key} ${k.amount}` : k.key)),
      ].filter(Boolean).join(' and ');
      log(state, `${whose(state, bonus.owner)} ${bonus.name}'s Passive: ${describeRef(state, ref)} gains ${what}.`);
    }
    for (const [uid, bonus] of Object.entries(card.aura)) {
      if (next[uid]) continue;
      delete card.aura[uid];
      emit(state, 'buffLost', { target: info(state, ref), source: `${bonus.name}'s Passive` });
      card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
      log(state, `${describeRef(state, ref, true)} loses the bonus from ${bonus.name}'s Passive.`);
    }
  }
  refreshWeather(state);
}

// --- Weather --------------------------------------------------------------------

// For each Weather type: its combined count, the brackets reached (active),
// and the ones whose effects apply ('instead' replacing the bracket before it).
export function weatherState(state) {
  const counts = weatherCounts(state);
  const out = {};
  for (const [type, def] of Object.entries(WEATHER)) {
    const count = counts[type] ?? 0;
    const active = def.brackets.filter((b) => count >= b.at);
    const effective = [];
    for (const b of active) {
      if (b.mode === 'instead') effective.pop();
      effective.push(b);
    }
    out[type] = { count, icon: def.icon, active, effective };
  }
  return out;
}

// Logs brackets switching on and off, and recalculates every Weather stat
// modifier, with the same rule as Passives: gaining Strength raises current
// and maximum; losing it lowers the maximum, and current Strength only if it
// is now above the maximum, so Weather changing never defeats a Pokémon.
function refreshWeather(state) {
  const weather = weatherState(state);
  const now = [];
  for (const [type, w] of Object.entries(weather)) {
    for (const b of w.active) now.push(`${type} ${b.at}`);
  }
  const before = state.weatherOn ?? [];
  for (const [type, w] of Object.entries(weather)) {
    for (const b of w.active) {
      if (!before.includes(`${type} ${b.at}`)) emit(state, 'weatherChanged', { weather: type, at: b.at, on: true, count: w.count });
      if (!before.includes(`${type} ${b.at}`)) log(state, `Weather: ${w.icon} ${type} ${b.at} is now active (${type} ${w.count}). ${b.text}`);
    }
  }
  for (const key of before) {
    if (!now.includes(key)) {
      const [type] = key.split(' ');
      emit(state, 'weatherChanged', { weather: type, at: Number(key.split(' ')[1]), on: false, count: weather[type].count });
      log(state, `Weather: ${WEATHER[type].icon} ${key} has ended (${type} ${weather[type].count}).`);
    }
  }
  state.weatherOn = now;

  for (const { card } of arenaPokemon(state)) {
    const next = {};
    for (const [type, w] of Object.entries(weather)) {
      for (const b of w.effective) {
        for (const st of b.stats ?? []) {
          if (!matchesCard(card, st.filter)) continue;
          const mod = (next[`${type} ${b.at}`] ??= { attack: 0, strength: 0, type });
          mod.attack += st.attack ?? 0;
          mod.strength += st.strength ?? 0;
        }
      }
      // A card's own Weather modifier (Sunflora: +2 Attack while Sun is 4 or more).
      for (const st of card.weatherStats ?? []) {
        if (st.weather !== type || w.count < st.min) continue;
        const mod = (next[`${card.name} (${type} ${st.min})`] ??= { attack: 0, strength: 0, type });
        mod.attack += st.attack ?? 0;
        mod.strength += st.strength ?? 0;
      }
    }
    const was = weatherTotal(card, 'strength');
    card.weather = next;
    const gained = weatherTotal(card, 'strength') - was;
    if (gained > 0) card.currentStrength += gained;
    else if (gained < 0) card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
  }
}

// Queues the timed Weather effects for this moment ('breakfast' | 'supper'),
// in Weather order, on top of the stack: they resolve before Pokémon
// abilities triggering at the same moment.
export function queueWeather(state, moment) {
  const jobs = [];
  for (const [type, w] of Object.entries(weatherState(state))) {
    for (const b of w.effective) {
      for (const t of b.timed ?? []) {
        if (t.at !== moment) continue;
        jobs.push({
          ctx: {
            who: state.initiative ?? 'player',
            source: { kind: 'weather', name: `${type} ${b.at}` },
            label: `Weather (${w.icon} ${type} ${b.at})`,
            text: b.text,
          },
          effects: t.effects,
        });
      }
    }
  }
  for (const { ctx, effects } of jobs.reverse()) queueEffects(state, ctx, effects);
}

// After damage: release defeated Pokémon, queue their On Defeated triggers,
// and recalculate Passives (a removed Trainer's bonuses stop).
export function settle(state) {
  const defeated = releaseDefeated(state);
  // "Defeat N enemy Pokémon": the player whose card or effect dealt the last hit (Burn: who applied it).
  for (const d of defeated) {
    if (d.by && d.by !== d.ref.owner) questEvent(state, d.by, { type: 'defeat', card: d.card });
  }
  if (defeated.length) fireTriggers(state, defeated.map(({ ref, card }) => ({ type: 'defeated', ref: { ...ref, uid: card.uid }, card })));
  refreshAuras(state);
}
