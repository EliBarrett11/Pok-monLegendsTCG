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
//   gainEnergy   { amount }                        extra Base Energy this Round (may pass 10)
//   releaseLocation {}                             the source Location goes to the Released Pile
//   attachHeld   { target }                        attach the Item being used (ctx.item) as a
//                                                  Held Item; one per Pokémon, the old one goes to the PokéMart
//   ready        { target }                        a Spent Pokémon becomes Active
//
// SELECTOR     { mode, side, kinds, zone, filter }
//   mode    'targeted' (the player chooses one) | 'area' (all that match) |
//           'event' (a card from the triggering event; role: 'ref' (default) or 'attacker')
//   side    'friendly' | 'opponent' | 'any'       relative to whoever owns the effect
//   kinds   ['pokemon'] (default) | ['pokemon', 'trainer'] | ['trainer']
//           'hand': Pokémon cards in hand (refs { kind: 'hand', owner, uid })
//   zone    'source': only the source's Zone, both sides of the arena
//           'target': only the Zone of the target chosen for this card
//   pick    'zone' (with mode 'targeted'): the player chooses a Zone that has
//           a matching card; the effect applies to every matching card there
//   filter  a card condition (see matchesCard)     Pokémon only
//   damaged true: only cards below their maximum Strength
//
// PASSIVE      { aura?, triggers? }
//   aura      { attack, strength, target: selector } continuous stat bonus,
//             recalculated whenever the board changes
//   triggers  [{ on, match, effects }]
//             on: 'summon' | 'attack' | 'defend' | 'defeated' | 'breakfast' | 'supper'
//             match: { side?, zone?: 'source', self?: true, targetKind? } for the event's card
//
// POKÉMON ABILITY  card.ability = { on, match: { self: true, ... }, effects }, shown
//   as its Effect Trigger Word + Effect Text (On Summon → 'summon', and so on).
//
// RESOLVING goes through one stack in state.stack, worked by run():
//   { kind: 'effects', ctx, effects, i }   a source's effects, one at a time
//   { kind: 'step', step, ... }            the rest of an Action or Phase (game.js)
// New triggers go on top, so they resolve immediately. Triggers from the same
// moment resolve initiative player first, then zone 1 → 3, left to right
// (a Trainer after the Pokémon in its zone). A choice (a target, Ash's free
// summon) pauses the stack in state.pending until resolveChoice.
//
// CONTEXT (ctx) for resolving: { who, source: { kind, owner, zone, space?, uid, name },
//   label, text?, target?, event?, drawn? }. All plain data, so it can be stored in
//   state while a choice is pending.
//
// INNATE POWERS are keywords the rules check directly:
//   'Quick Attack'  summoned Active instead of Spent
//   'Agility'       can't be chosen as a target by a Strategy Card (area effects still hit)

import { WEATHER } from './cardData.js';
import {
  PLAYERS, opponentOf, log, whose, draw, canDraw, arenaPokemon, activeTrainers, cardAt, sameRef, weatherCounts, weatherTotal,
  describeRef, summonSpaces, damage, heal, releaseDefeated, maxStrengthOf, strengthOf, inPlay, heldBonus, toMart, emit, info,
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
// card to draw, and a targeted or area effect needs something to affect.
// (Triggers don't ask; they just affect whatever is there.) ctx.willDiscard
// counts cards a cost puts in the Discard Pile first, which a draw can reshuffle.
export function canResolve(state, ctx, effects) {
  return effects.every((e) => {
    if (e.op === 'draw') return canDraw(state, ctx.who) || ctx.willDiscard > 0;
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
      emit(state, 'buff', { target: info(state, ref), attack, strength, source: ctx.label });
      const what = e.strengthType && !attack ? `${signed(strength)} ${e.strengthType}`
        : !strength ? `${signed(attack)} Attack` : `${signed(attack)}/${signed(strength)}`;
      log(state, `${ctx.label}: ${describeRef(state, ref)} gains ${what}.`);
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
      const delta = heldBonus(card, 'strength') - before;
      if (delta > 0) card.currentStrength += delta;
      else if (delta < 0) card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
    }
  },

  ready(state, ctx, e, refs) {
    for (const ref of refs) {
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
    log(state, `${ctx.label}: ${p.name} ${ctx.who === 'player' ? 'gain' : 'gains'} ${e.amount} extra Base Energy this Round (now ${p.baseEnergy}).`);
  },

  // The last card drawn may be summoned for free, if it fits the filter.
  // The player chooses (state.pending); job.choice holds the answer.
  mayPlayFree(state, ctx, e, refs, job) {
    const p = state.players[ctx.who];
    const card = p.hand.find((c) => c.uid === ctx.drawn?.at(-1));
    if (!card || !passesFilter(card, e.filter)) return null;
    if (!summonSpaces(state, ctx.who).length) {
      log(state, `${ctx.label}: ${card.name} could be summoned for free, but there is no empty space, so it stays in hand.`);
      return null;
    }
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
    summon(state, ctx.who, card, zone, space);
    return null;
  },
};

// --- The stack ------------------------------------------------------------------

export function queueEffects(state, ctx, effects) {
  (state.stack ??= []).push({ kind: 'effects', ctx, effects, i: 0 });
}

export function queueStep(state, step, data = {}) {
  (state.stack ??= []).push({ kind: 'step', step, ...data });
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
        state.pending = { who: ctx.who, kind: 'target', options: legal, label: ctx.label, text: ctx.text };
        return 'pause';
      }
      if (!legal.some((r) => sameRef(r, ctx.target))) throw new Error('That is not a legal target');
      refs = e.target.pick === 'zone'
        ? candidates(state, ctx, { ...e.target, pick: undefined, mode: 'area', zone: 'target' }, e)
        : [ctx.target];
    } else {
      refs = legal;
    }
  }
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
    if (applyEffect(state, job, job.effects[job.i]) === 'pause') return;
    job.i += 1;
    delete job.choice;
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
  p.hand = p.hand.filter((h) => h.uid !== card.uid);
  p.zones[zone].pokemon[space] = inPlay(card, { spent: !hasKeyword(card, 'Quick Attack') });
  const ref = { kind: 'pokemon', owner: who, zone, space, uid: card.uid };
  emit(state, 'summoned', { who, target: { ...ref, name: card.name } });
  refreshAuras(state);
  fireTriggers(state, [{ type: 'summon', ref, card }]);
  questEvent(state, who, { type: 'summon', card, zone });
  return ref;
}

// --- Quests ---------------------------------------------------------------------

// One of `who`'s own actions: { type: 'summon' | 'attack' | 'power', card?, zone? }.
// Every one of their Locations whose quest it fits moves on by 1, each
// counting separately. A completed quest gives its XP, then its effect and
// the Location's release are queued to resolve next.
export function questEvent(state, who, event) {
  const p = state.players[who];
  p.zones.forEach((z, zone) => {
    const loc = z.location;
    const quest = loc?.quest;
    if (!quest || loc.done || quest.on !== event.type) return;
    if (quest.inZone && event.zone !== zone) return;
    if (quest.filter && !(event.card && matchesCard(event.card, quest.filter))) return;
    loc.progress += 1;
    emit(state, 'questProgress', { owner: who, zone, uid: loc.uid, name: loc.name, progress: loc.progress, count: quest.count });
    const label = `${whose(state, who)} ${loc.name}`;
    log(state, `${label} quest: ${quest.label} ${loc.progress}/${quest.count}.`);
    if (loc.progress < quest.count) return;
    loc.done = true;   // until its effect has resolved and it is released
    p.xp += loc.xp;
    emit(state, 'questComplete', { owner: who, zone, uid: loc.uid, name: loc.name, xp: loc.xp });
    log(state, `${label} quest complete! ${p.name} ${who === 'player' ? 'gain' : 'gains'} ${loc.xp} XP (now ${p.xp}).`);
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
    if (card.ability) list.push({ ref, card, triggers: [card.ability] });
  }
  return list;
}

function sourceCtx(state, ref, card) {
  const trainer = card.cardType === 'Trainer';
  return {
    who: ref.owner,
    source: { kind: trainer ? 'trainer' : 'pokemon', owner: ref.owner, zone: ref.zone, space: ref.space, uid: card.uid, name: card.name },
    label: `${whose(state, ref.owner)} ${card.name}'s ${trainer ? 'Passive' : card.effectTrigger ?? 'ability'}`,
    text: trainer ? card.passive?.text : card.effectText,
  };
}

function eventMatches(state, match = {}, ctx, event) {
  if (match.self && event.card.uid !== ctx.source.uid) return false;
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
    if (event.type === 'defeated' && event.card.ability) list.push({ ref: event.ref, card: event.card, triggers: [event.card.ability] });
  }
  const fired = [];
  for (const event of events) {
    for (const { ref, card, triggers } of list) {
      for (const trigger of triggers) {
        if (trigger.on !== event.type) continue;
        const ctx = { ...sourceCtx(state, ref, card), event };
        if (eventMatches(state, trigger.match, ctx, event)) fired.push({ ctx, effects: trigger.effects, key: orderKey(state, ref) });
      }
    }
  }
  fired.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  for (const { ctx, effects } of fired.reverse()) queueEffects(state, ctx, effects);
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
      emit(state, 'buff', { target: info(state, ref), attack: bonus.attack, strength: bonus.strength, source: `${bonus.name}'s Passive` });
      const what = bonus.attack ? `${signed(bonus.attack)}/${signed(bonus.strength)}` : `${signed(bonus.strength)} Strength`;
      log(state, `${whose(state, bonus.owner)} ${bonus.name}'s Passive: ${describeRef(state, ref)} gains ${what}.`);
    }
    for (const [uid, bonus] of Object.entries(card.aura)) {
      if (next[uid]) continue;
      delete card.aura[uid];
      emit(state, 'buffLost', { target: info(state, ref), source: `${bonus.name}'s Passive` });
      card.currentStrength = Math.min(card.currentStrength, maxStrengthOf(card));
      const what = describeRef(state, ref);
      log(state, `${what[0].toUpperCase()}${what.slice(1)} loses the bonus from ${bonus.name}'s Passive.`);
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
  if (defeated.length) fireTriggers(state, defeated.map(({ ref, card }) => ({ type: 'defeated', ref: { ...ref, uid: card.uid }, card })));
  refreshAuras(state);
}
