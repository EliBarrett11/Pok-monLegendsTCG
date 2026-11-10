// Speed and motion settings (UX4 D). Slow, Normal, Fast and Instant (×1.5, ×1, ×0.5, none): every
// presenter time is multiplied by the factor; Instant draws each new state at once. Low motion (on by
// default under the OS's reduced-motion setting) means fewer particles, no shake, no distortion and no
// ambient Weather. Both are kept in localStorage, inside try/catch (the page works without it).
// ?autoplay uses Fast; ?speed=<name> forces a speed for checks (the layout tool and tests use Instant).
import { SPEEDS } from './vfx/library.js?v=202611101109';
import { setLowMotion, osReducedMotion } from './vfx/engine.js?v=202611101109';

export const SPEED_NAMES = Object.keys(SPEEDS);
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: keep it for this page */ } };

const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const forced = SPEED_NAMES.includes(params.get('speed')) ? params.get('speed') : params.has('autoplay') ? 'fast' : null;
let speed = forced ?? (SPEED_NAMES.includes(read('v4.speed')) ? read('v4.speed') : 'normal');
const storedLow = read('v4.lowMotion');
let low = params.has('lowmotion') ? true : storedLow === null ? osReducedMotion() : storedLow === '1';
setLowMotion(() => low);

export const speedName = () => speed;
// ?timescale=N (checks only) stretches every beat N times, so a slow renderer can be screenshotted mid-beat.
const timescale = Math.max(1, Number(params.get('timescale')) || 1);
export const speedFactor = () => SPEEDS[speed] * timescale;
export const lowMotion = () => low;
export function setSpeed(name) {
  if (!SPEED_NAMES.includes(name)) return;
  speed = name;
  if (!forced) write('v4.speed', name);
}
export function setLowMotionSetting(on) {
  low = !!on;
  write('v4.lowMotion', low ? '1' : '0');
  document.documentElement.classList.toggle('v4-low', low);
}
if (typeof document !== 'undefined') document.documentElement.classList.toggle('v4-low', low);
