// The presenter's plan (UX4 A), pure: no DOM, so it runs headless in tests. From an action's events
// it lists the beats in order, each with the board it needs and its length at Normal:
//   need  'old' (the board as it was: an attacker, a hand card, a plate about to go) · 'new' (an
//         arrival: a summoned Pokémon, a Partner, a placed Location, the Tournament, the new hand) ·
//         'any' (things on both boards: the rings, purses, trackers, banners)
// The presenter plays the 'old' and 'any' beats on the old board until the first 'new' beat, draws the
// new state there, then plays the rest. It never changes the state (it only reads prev and next).
import {
  EVENT_BEATS, MS, MOMENTS, attackDef, counterDef, commandMs, summonFor, defeatFor, timelineDuration, impactScale, defOf, V4_TIMELINES,
  SUPPORTER_ANIMS, ITEM_ANIMS, TRAINER_COMMAND_ANIMS,
} from './vfx/library.js?v=202611101109';

const NEED = {
  attack: 'old', command: 'old', react: 'old', seal: 'old', trainerCommand: 'old', supporter: 'old', itemBought: 'old', itemUsed: 'old',
  defeat: 'old', dominance: 'old', locationRemoved: 'old', retain: 'old', supperHand: 'old',
  summon: 'new', partner: 'new', locationPlaced: 'new', tournament: 'new', breakfast: 'new', mart: 'new', objective: 'any',
  recognition: 'any', coins: 'any', pip: 'any', trackerComplete: 'any', note: 'any', round: 'any', supper: 'any', champion: 'any', turn: 'any',
};
const foeOf = (who) => (who === 'player' ? 'ai' : 'player');

// The Pokémon card an event is about, on the board as it was (or as it is now, for arrivals).
const monAt = (s, who, space) => s?.players[who]?.row[space] ?? null;

// A beat's length at Normal (ms).
export function beatMs(step, prev, next) {
  const { beat, e } = step;
  switch (beat) {
    case 'attack': {
      const a = monAt(prev, e.who, e.from);
      const d = e.target.kind === 'pokemon' ? monAt(prev, foeOf(e.who), e.target.space) : null;
      const main = timelineDuration(attackDef(a, { trade: e.back > 0 }), impactScale(e.amount));
      return e.back > 0 && d ? Math.max(main, main * 0.55 + timelineDuration(counterDef(d), impactScale(e.back))) : main;
    }
    case 'command': return commandMs(e.id, e.mode);
    case 'react': return commandMs(e.id, 'react');
    case 'seal': return MOMENTS.seal.ms;
    case 'trainerCommand': return MS.rise + timelineDuration(defOf(TRAINER_COMMAND_ANIMS[e.hits?.length ? 'damageAll' : 'draw']), 1) + MS.commandOut;
    case 'supporter': return MS.rise + Math.max(MS.burn, timelineDuration(defOf('supporter-moment'), 1)) + MS.commandOut;
    case 'itemBought': return MOMENTS.item.ms;
    case 'itemUsed': return timelineDuration(defOf(ITEM_ANIMS[e.op] ?? 'v4-held'), 1);
    case 'defeat': return timelineDuration(defOf(defeatFor('Normal')), 1) + MS.defeat;
    case 'summon': return timelineDuration(defOf(summonFor(monAt(next, e.who, e.space) ?? { level: e.level })), 1);
    case 'partner': return MOMENTS.partner.ms;
    case 'locationPlaced': return MOMENTS.locationIn.ms;
    case 'locationRemoved': return MOMENTS.locationOut.ms;
    case 'tournament': return MOMENTS.tournament.ms;
    case 'breakfast': return MOMENTS.breakfast.ms;
    case 'supperHand': return MOMENTS.supperHand.ms;
    case 'dominance': return MOMENTS.dominance.ms;
    case 'recognition': return MOMENTS.recognition.ms;
    case 'coins': return MOMENTS.coins.ms;
    case 'pip': return MOMENTS.pip.ms;
    case 'trackerComplete': return MOMENTS.tracker.ms;
    case 'retain': return MS.lock;
    case 'round': case 'supper': case 'turn': return MOMENTS.banner.ms;
    case 'champion': return MOMENTS.champion.ms;
    case 'mart': return MOMENTS.mart.ms;
    case 'objective': return MOMENTS.objective.ms + MS.objStamp * ((step.points?.length ?? 1) - 1) + (step.final ? MS.objFinal : 0);
    case 'note': return MS.note;
    default: return 0;
  }
}

// The beats of one action, in order. factor: the speed (1 Normal, 1.5 Slow, 0.5 Fast, 0 Instant).
export function plan(prev, next, factor = 1) {
  const ev = next.events ?? [];
  const steps = [];
  const used = new Set();
  ev.forEach((e, i) => {
    if (used.has(i)) return;
    const entry = EVENT_BEATS[e.type];
    if (!entry) throw new Error(`No beat for the event ${e.type}`);
    if (entry.when === 'quiet') return;
    let beat = entry.beat;
    // A React shows its card and its effect together (the commandResolved that follows it).
    if (e.type === 'react') {
      const j = ev.findIndex((x, k) => k > i && x.type === 'commandResolved' && x.mode === 'react' && x.who === e.who);
      if (j >= 0) used.add(j);
    }
    if (e.type === 'commandResolved' && e.mode === 'react') beat = 'react';
    // G1 (2.7): an Objective's points in one action play as one moment (the count ticks for each); the
    // final point plays the longer version, which leads into the Partner's arrival.
    if (e.type === 'objectiveProgress') {
      const points = [e];
      let final = false;
      ev.forEach((x, k) => {
        if (k <= i || x.uid !== e.uid) return;
        if (x.type === 'objectiveProgress') { points.push(x); used.add(k); }
        if (x.type === 'objectiveComplete') { final = true; used.add(k); }
      });
      steps.push({ beat, e, i, need: NEED[beat], points, final });
      return;
    }
    // Supper: after its Strats, dominance and countdowns, the hand slides to the Discard Pile.
    if (e.type === 'breakfast' && ev.some((x) => x.type === 'supper')) steps.push({ beat: 'supperHand', e, i, need: NEED.supperHand });
    steps.push({ beat, e, i, need: NEED[beat] ?? 'any' });
  });
  // After the action: a banner when the turn passes to the other player (not after Breakfast's own).
  if (next.phase === 'battle' && prev.phase === 'battle' && next.turn !== prev.turn && !ev.some((x) => x.type === 'breakfast')) {
    steps.push({ beat: 'turn', e: { type: 'turn', who: next.turn }, i: ev.length, need: 'any' });
  }
  for (const st of steps) st.ms = factor > 0 ? beatMs(st, prev, next) * factor : 0;
  const switchAt = steps.findIndex((st) => st.need === 'new');
  return { steps, switchAt: switchAt < 0 ? steps.length : switchAt, total: steps.reduce((n, st) => n + st.ms, 0) };
}

export { V4_TIMELINES, SUPPORTER_ANIMS };
