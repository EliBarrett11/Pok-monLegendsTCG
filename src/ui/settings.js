// Player settings, remembered in this browser. Storage can be missing or
// blocked (private windows, previews), so every read and write is guarded and
// the game works the same without it.

export const SPEEDS = {
  normal: { label: 'Normal', factor: 1 },
  fast: { label: 'Fast', factor: 0.5 },
  instant: { label: 'Instant', factor: 0 },
};

const KEY = 'plt-speed';
let speed = 'normal';
try {
  const saved = localStorage.getItem(KEY);
  if (SPEEDS[saved]) speed = saved;
} catch {
  // no storage: keep the default
}

export function getSpeed() {
  return speed;
}

export function setSpeed(value) {
  if (!SPEEDS[value]) return;
  speed = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // no storage: the choice lasts until the page closes
  }
}

// How long animations take at this speed, as a multiple of Normal.
export function speedFactor() {
  return SPEEDS[speed].factor;
}
