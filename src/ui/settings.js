// Player settings, remembered in this browser. Storage can be missing or
// blocked (private windows, previews), so every read and write is guarded and
// the game works the same without it.

// Animation speed: how long things take, as a multiple of Fast. The animation
// timings (docs/vfx.md, prototype/vfx-demo.html) were tuned at Fast.
export const SPEEDS = {
  slow: { label: 'Slow', factor: 2 },
  normal: { label: 'Normal', factor: 1.5 },
  fast: { label: 'Fast', factor: 1 },
  instant: { label: 'Instant', factor: 0 },
};
export const DEFAULT_SPEED = 'normal';

// Feedback batch 1 renamed the speeds (the old Normal is now Fast; the old
// Fast went), so they're saved under a new key. A choice saved under the old
// key carries over once: old 'normal' and old 'fast' → 'fast'.
const KEY = 'plt-speed-v2';
const OLD_KEY = 'plt-speed';
export function migrateSpeed(old) {
  return { normal: 'fast', fast: 'fast', instant: 'instant' }[old] ?? null;
}

let speed = DEFAULT_SPEED;
try {
  const saved = localStorage.getItem(KEY);
  if (SPEEDS[saved]) speed = saved;
  else {
    const carried = migrateSpeed(localStorage.getItem(OLD_KEY));
    if (carried) {
      speed = carried;
      localStorage.setItem(KEY, carried);
    }
  }
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

// How long animations take at this speed, as a multiple of Fast.
export function speedFactor() {
  return SPEEDS[speed].factor;
}

// Banners with words in them (phases, "You pass", a Trainer falling, abilities
// and Powers) stay up at least this long at Normal, so they can be read. It
// scales with the speed (shorter at Fast, longer at Slow, none at Instant).
export const MIN_TEXT_MS = 1200;
export function readableMs(ms, factor = speedFactor()) {
  if (factor <= 0) return 0;
  return Math.max(ms, MIN_TEXT_MS * (factor / SPEEDS.normal.factor));
}
