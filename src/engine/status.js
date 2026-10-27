// Status Effects on a Pokémon or a Trainer, shown on the card by animation
// only (no icons). Each status is data in STATUSES; the engine applies,
// clears and resolves them through the functions here, so a new status
// (Poison, Paralysis, Sleep…) is a new entry, not engine rework.
//
// A card carries card.status = { [id]: { count, by } }, where `by` is the
// player who last applied it (their quests count what it does).
//
// STATUS  { name, icon, stacks, supper?, pokemonOnly?, flag? }
//   stacks       applying more adds to the counters (Burn X)
//   flag         on or off, no number: reapplying does nothing (Sleep, Leech Seed)
//   pokemonOnly  can't be put on a Trainer
//   supper  what it does at Supper, all at once for every card that has it:
//           'burn': damage equal to the count, then lose 1
//
// Sleep (docs/decks.md 2.9): the Pokémon is made Spent at once. At Breakfast it
// stays Spent, then wakes; any damage wakes it at once (board.js damage). Sun 6
// stops Sleep being applied. Leech Seed: at Supper, after Burn, it drains the
// Pokémon for whoever seeded it (effects.js resolveLeechSeeds).

import { arenaPokemon, activeTrainers, cardAt, damage, describeRef, emit, info, log, weatherRule } from './board.js';

export const STATUSES = {
  burn: { name: 'Burn', icon: 'flame', stacks: true, supper: 'burn' },
  sleep: { name: 'Sleep', flag: true, pokemonOnly: true },
  leechSeed: { name: 'Leech Seed', flag: true, pokemonOnly: true },
};

export function statusCount(card, id) {
  return card?.status?.[id]?.count ?? 0;
}

// Every card that can carry a status now: Pokémon in the arena and Trainers in play.
function carriers(state) {
  return [...arenaPokemon(state), ...activeTrainers(state)];
}

// Adds `amount` counters (Burn X) to the card at ref, applied by player `by`;
// for an on/off status (Sleep, Leech Seed), puts it on if it isn't already.
// Returns the new count (0 if nothing was applied).
export function applyStatus(state, ref, id, amount, by) {
  const card = cardAt(state, ref);
  if (!card || amount <= 0) return 0;
  const def = STATUSES[id];
  if (def.pokemonOnly && ref.kind !== 'pokemon') return 0;
  if (def.flag) {
    if (statusCount(card, id)) return 0;   // doesn't stack: reapplying does nothing
    if (id === 'sleep' && weatherRule(state, 'noSleep')) {
      log(state, `${describeRef(state, ref, true)} can't be put to Sleep (☀ Sun 6).`);
      return 0;
    }
    (card.status ??= {})[id] = { count: 1, by };
    if (id === 'sleep') card.spent = true;
    emit(state, 'statusApplied', { status: id, target: info(state, ref), amount: 1, before: 0, after: 1, by });
    log(state, id === 'sleep' ? `${describeRef(state, ref, true)} falls Asleep (and is Spent).` : `${describeRef(state, ref, true)} is seeded with Leech Seed.`);
    return 1;
  }
  card.status ??= {};
  const was = statusCount(card, id);
  const count = def.stacks ? was + amount : Math.max(was, amount);
  card.status[id] = { count, by };
  emit(state, 'statusApplied', { status: id, target: info(state, ref), amount, before: was, after: count, by });
  log(state, `${describeRef(state, ref)} gains ${def.name} ${amount}${was ? ` (now ${def.name} ${count})` : ''}.`);
  return count;
}

// Removes all of a status from the card at ref (Douse removes all Burn).
export function clearStatus(state, ref, id, why = '') {
  const card = cardAt(state, ref);
  const was = statusCount(card, id);
  if (!was) return 0;
  delete card.status[id];
  emit(state, 'statusCleared', { status: id, target: info(state, ref), before: was, why });
  log(state, `${describeRef(state, ref, true)} loses ${STATUSES[id].name}${STATUSES[id].flag ? '' : ` ${was}`}${why ? ` (${why})` : ''}.`);
  return was;
}

// Cures every status on the card (Full Heal, Evolving). Returns how many were removed.
export function cureAll(state, ref, why) {
  return Object.keys(STATUSES).filter((id) => clearStatus(state, ref, id, why)).length;
}

// Supper: every status with a Supper effect resolves for every card that has
// it, all at the same moment. Burn: each burned card takes damage equal to its
// Burn (effect damage, reduced by Shell), then loses 1 Burn. Defeats are left
// to the caller (settle), so they are all worked out together afterwards.
export function resolveSupperStatuses(state) {
  const hits = [];
  for (const { ref, card } of carriers(state)) {
    const count = statusCount(card, 'burn');
    if (count) hits.push({ ref: { ...ref, uid: card.uid }, card, count, by: card.status.burn.by });
  }
  if (!hits.length) return [];
  emit(state, 'burnPhase', { targets: hits.map((h) => ({ ...info(state, h.ref), count: h.count })) });
  // Rain 4: Burn deals 1 less damage (minimum 0); it still fades by 1.
  const less = weatherRule(state, 'burnMinus') ? 1 : 0;
  for (const h of hits) {
    const what = describeRef(state, h.ref);
    const amount = Math.max(0, h.count - less);
    if (!amount) {
      log(state, `Burn ${h.count}: no damage to ${what} (☔ Rain 4: 1 less).`);
      continue;
    }
    const [before, after] = damage(state, h.ref, amount, { cause: 'burn', by: h.by });
    log(state, `Burn ${h.count}${less ? ` (☔ Rain 4: ${amount})` : ''}: ${before - Math.max(after, 0) || 0} damage to ${what}. Strength ${before} → ${Math.max(after, 0)}.`);
  }
  // Burn fades by 1 on every card still in play (a removed Trainer's was cleared).
  for (const h of hits) {
    const card = cardAt(state, h.ref);
    if (card?.uid !== h.card.uid || !statusCount(card, 'burn')) continue;
    const left = card.status.burn.count - 1;
    if (left > 0) card.status.burn.count = left;
    else delete card.status.burn;
    emit(state, 'statusDecayed', { status: 'burn', target: info(state, h.ref), after: left });
  }
  return hits;
}

// A card leaving play keeps no statuses.
export function dropStatuses(card) {
  delete card.status;
}
