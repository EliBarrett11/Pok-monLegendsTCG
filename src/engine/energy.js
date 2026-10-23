// Base Energy, Exert and Exhaust. Pure functions on a player object.
//
// A player always has as many Exert points as their Exert maximum. Each one
// is either available or Exhausted, so available Exert = max − Exhaust points.

export const BASE_ENERGY_LIMIT = 10;
export const EXERT_LIMIT = 3;

// Recovery Positions 1, 2 and 3: how many Rounds after the Round it was
// spent an Exhaust point in that position recovers into Exert.
export const RECOVERY_DELAYS = [2, 3, 4];

export function baseEnergyFor(round) {
  return Math.min(round, BASE_ENERGY_LIMIT);
}

export function exertMaxFor(round) {
  return Math.min(round, EXERT_LIMIT);
}

export function newEnergy() {
  return { baseEnergy: 0, exertMax: 0, exhaust: [] };
}

export function availableExert(p) {
  return p.exertMax - p.exhaust.length;
}

export function canPay(p, cost) {
  return p.baseEnergy + availableExert(p) >= cost;
}

// Breakfast: Exhaust due this Round recovers first, then Base Energy resets
// and the Exert maximum grows. Returns the recovered points.
export function refreshEnergy(p, round) {
  const recovered = p.exhaust.filter((x) => x.recoversRound <= round);
  p.exhaust = p.exhaust.filter((x) => x.recoversRound > round);
  p.baseEnergy = baseEnergyFor(round);
  p.exertMax = exertMaxFor(round);
  return recovered;
}

// How a cost would be paid: Base Energy first, Exert only for the shortfall.
export function splitCost(p, cost) {
  const fromBase = Math.min(cost, p.baseEnergy);
  return { fromBase, fromExert: cost - fromBase };
}

// Pays the cost. Each Exert point spent becomes an Exhaust point in the
// fastest free Recovery Position.
export function payCost(p, cost, round) {
  if (!canPay(p, cost)) throw new Error(`Not enough Energy: cost ${cost}`);
  const { fromBase, fromExert } = splitCost(p, cost);
  p.baseEnergy -= fromBase;
  for (let i = 0; i < fromExert; i++) {
    const taken = p.exhaust.map((x) => x.position);
    const position = [1, 2, 3].find((n) => !taken.includes(n));
    p.exhaust.push({ position, spentRound: round, recoversRound: round + RECOVERY_DELAYS[position - 1] });
  }
  return { fromBase, fromExert };
}
