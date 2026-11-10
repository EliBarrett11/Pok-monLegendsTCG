// Sound hooks (UX4 E): every beat calls sfx(name, opts) at its moment. No sounds yet (a later stage
// adds them): this is a no-op, so the hooks are in place. Names (src/ui/vfx/library.js SFX):
// attack-<type>-<physical|special>, hit, defeat, heal, summon, partner, recognition, coins,
// command-adapt, command-strat, react, location-place, tournament, turn, victory.
export const played = [];   // the last few calls, for checks (?debug)
export function sfx(name, opts = {}) {
  played.push({ ...opts, name, at: typeof performance === 'undefined' ? 0 : Math.round(performance.now()) });
  if (played.length > 50) played.shift();
}
