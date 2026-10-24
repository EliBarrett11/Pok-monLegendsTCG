// Status Effects: numbered counters on a Pokémon or a Trainer (shown as a
// token on the card). Each status is data in STATUSES; the engine applies,
// clears and resolves them through the functions here, so a new status
// (Poison, Paralysis, Sleep…) is a new entry, not engine rework.
//
// A card carries card.status = { [id]: { count, by } }, where `by` is the
// player who last applied it (their quests count what it does).
//
// STATUS  { name, icon, stacks, supper? }
//   stacks  applying more adds to the counters
//   supper  what it does at Supper, all at once for every card that has it:
//           'burn': damage equal to the count, then lose 1

import { arenaPokemon, activeTrainers, cardAt, damage, describeRef, emit, info, log } from './board.js';

export const STATUSES = {
  burn: { name: 'Burn', icon: 'flame', stacks: true, supper: 'burn' },
};

export function statusCount(card, id) {
  return card?.status?.[id]?.count ?? 0;
}

// Every card that can carry a status now: Pokémon in the arena and Trainers in play.
function carriers(state) {
  return [...arenaPokemon(state), ...activeTrainers(state)];
}

// Adds `amount` counters (Burn X) to the card at ref, applied by player `by`.
export function applyStatus(state, ref, id, amount, by) {
  const card = cardAt(state, ref);
  if (!card || amount <= 0) return 0;
  const def = STATUSES[id];
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
  log(state, `${describeRef(state, ref)} loses ${STATUSES[id].name} ${was}${why ? ` (${why})` : ''}.`);
  return was;
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
  for (const h of hits) {
    const what = describeRef(state, h.ref);
    const [before, after] = damage(state, h.ref, h.count, { cause: 'burn', by: h.by });
    log(state, `Burn ${h.count}: ${before - Math.max(after, 0) || 0} damage to ${what}. Strength ${before} → ${Math.max(after, 0)}.`);
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
