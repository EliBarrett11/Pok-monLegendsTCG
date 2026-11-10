// Result previews (UX3): what an attack or an effect would do, before it's committed. Pure: no DOM.
// Each preview runs the engine's own functions (applyAction for an attack, applyCommand, applyItem and
// runOps for effects) on a copy of the state and reads the difference, so a preview can never disagree
// with the result. The attack's number is also split into its parts (base Attack, Location, Weather,
// Held Item, "until Supper"), which always add up to the engine's damageOf.
import { RULES } from '../rules.js?v=202611101410';
import {
  applyAction, applyCommand, applyItem, runOps, syncBonuses, damageOf, canHitBack, locationAt, activeBrackets, opponentOf, pokemonOf,
} from './game.js?v=202611101410';

const clone = (s) => structuredClone(s);
const gain = (before, after, who) => ({
  recognition: after.players[who].recognition - before.players[who].recognition,
  dollars: after.players[who].dollars - before.players[who].dollars,
});
// Did the Pokémon that was at { who, space } (by uid) leave the battlefield?
const gone = (after, who, space, uid) => after.players[who].row[space]?.uid !== uid;
const collectEvents = (states) => states.flatMap((x) => x.events ?? []);
// A Pokémon's Strength in a later state: on the battlefield, or on its card in the Released Pile.
const strengthAfter = (after, who, space, uid) => after.players[who].row[space]?.uid === uid ? after.players[who].row[space].currentStrength : after.players[who].released.find((c) => c.uid === uid)?.currentStrength ?? 0;

// Where an attack's number comes from: parts that add up to damageOf(s, card).
export function attackParts(s, who, space) {
  const card = s.players[who].row[space];
  const parts = [];
  const l = locationAt(s, space);
  const brackets = activeBrackets(s);
  const locAtk = l?.passive.kind === 'attack' ? l.passive.amount : 0;
  const wxAtk = brackets.filter((b) => b.kind === 'attack');
  const heldAtk = card.held?.op === 'attack' ? card.held.amount : 0;
  const temp = card.tempAttack ?? 0;
  const base = card.attack - locAtk - wxAtk.reduce((n, b) => n + b.amount, 0) - heldAtk - temp;
  parts.push({ label: 'Attack', n: base });
  if (locAtk) parts.push({ label: l.name, n: locAtk });
  for (const b of wxAtk) parts.push({ label: `${b.type} ${b.at}`, n: b.amount });
  if (heldAtk) parts.push({ label: card.held.name, n: heldAtk });
  if (temp) parts.push({ label: 'until Supper', n: temp });
  if (card.attackType === 'Physical') for (const b of brackets.filter((x) => x.kind === 'physical')) parts.push({ label: `${b.type} ${b.at} (Physical)`, n: b.amount });
  return parts;
}

// Play the attack on a copy: the committed attack resolves (any React window is let happen).
function playAttack(s, who, from, target) {
  let sim = clone(s);
  sim.reactWindow = null;
  sim.phase = 'battle';
  sim.turn = who;
  sim.passesInARow = 0;
  const steps = [];
  sim = applyAction(sim, { type: 'attack', who, from, target });
  steps.push(sim);
  if (sim.reactWindow) { sim = applyAction(sim, { type: 'decline', who: sim.reactWindow.reactor }); steps.push(sim); }
  return { sim, events: collectEvents(steps) };
}

// attackPreview: the damage; the target's Strength before and after; a defeat and its rewards
// (Recognition after the Tournament's ×1.5, and $); Recognition from damage to a Player Character;
// the hit-back from a Ready target (damage, the attacker's Strength after, a defeat and the opponent's
// rewards); and the parts of the attack number.
export function attackPreview(s, who, from, target) {
  const foe = opponentOf(who);
  const a = s.players[who].row[from];
  const d = target.kind === 'pokemon' ? s.players[foe].row[target.space] : null;
  const raw = damageOf(s, a);
  const { sim, events } = playAttack(s, who, from, target);
  // G2: the damage actually dealt (after Shell), and what the keywords and triggers did.
  const atk = events.find((e) => e.type === 'attack' && e.who === who && e.from === from);
  const damage = atk?.amount ?? raw;
  const out = {
    // The attacker afterwards (a hit-back, or anything the attack sets off, e.g. a Partner's On Summon).
    attacker: { name: a.name, space: from, before: a.currentStrength, after: strengthAfter(sim, who, from, a.uid), defeated: gone(sim, who, from, a.uid) },
    target: target.kind === 'player' ? { kind: 'player', who: foe } : { kind: 'pokemon', who: foe, space: target.space, name: d.name, before: d.currentStrength, after: strengthAfter(sim, foe, target.space, d.uid), defeated: gone(sim, foe, target.space, d.uid) },
    damage,
    raw,
    retaliated: atk?.retaliated ?? 0,
    keywords: events.filter((e) => e.type === 'keyword').map((e) => ({ who: e.who, space: e.space, kw: e.kw, amount: e.amount, name: e.name })),
    triggers: events.filter((e) => e.type === 'trigger' || e.type === 'triggerChoice').map((e) => ({ who: e.who, name: e.name, on: e.on, text: e.text })),
    parts: attackParts(s, who, from),
    rewards: gain(s, sim, who),
    tournament: !!s.tournament,
    hitBack: null,
    gameOver: sim.phase === 'gameOver' ? sim.winner : null,
    objectives: events.filter((e) => e.type === 'objectiveComplete').map((e) => ({ who: e.who, name: e.name })),
    foeRewards: gain(s, sim, foe),
    changes: [],
  };
  if (d && canHitBack(s, d)) {
    const back = atk?.back ?? damageOf(s, d);
    out.hitBack = { name: d.name, damage: back, attackerAfter: strengthAfter(sim, who, from, a.uid), defeated: gone(sim, who, from, a.uid), rewards: gain(s, sim, foe) };
  }
  out.changes = changes(s, sim);
  return out;
}

// The Pokémon whose Strength or Attack changed between two states (defeats included).
function changes(before, after) {
  const out = [];
  for (const who of ['player', 'ai']) {
    for (const { card, space } of pokemonOf(before, who)) {
      const now = after.players[who].row[space];
      const defeated = now?.uid !== card.uid;
      // G3: Dive: back in its owner's hand, not defeated.
      if (defeated && after.players[who].hand.some((c) => c.uid === card.uid)) {
        out.push({ who, space, name: card.name, stat: 'returned', before: card.currentStrength, after: null, defeated: false, returned: true });
        continue;
      }
      if (defeated) {
        // A defeated Pokémon's card goes to the Released Pile with the Strength it fell to.
        const fell = after.players[who].released.find((c) => c.uid === card.uid);
        out.push({ who, space, name: card.name, stat: 'strength', before: card.currentStrength, after: fell?.currentStrength ?? 0, defeated: true });
        continue;
      }
      if (now.currentStrength !== card.currentStrength || now.strength !== card.strength) out.push({ who, space, name: card.name, stat: 'strength', before: card.currentStrength, after: now.currentStrength, max: now.strength, defeated: false });
      if (now.attack !== card.attack) out.push({ who, space, name: card.name, stat: 'attack', before: card.attack, after: now.attack, defeated: false });
      if (now.spent && !card.spent) out.push({ who, space, name: card.name, stat: 'spent', before: false, after: true, defeated: false });
    }
  }
  return out;
}

// effectPreview: what a Command (each mode), an Item or a Trainer Command would do, by running the
// engine's own effect function on a copy. mode: 'adapt' | 'react' | 'strat' (Commands), 'use' (Items),
// 'command' (Trainer Commands). Damage and heals give before → after (and defeats with rewards);
// effects with no number give a sentence.
export function effectPreview(s, who, card, mode, target) {
  const sim = clone(s);
  sim.reactWindow = null;
  const foe = opponentOf(who);
  const notes = [];
  if (card.cardType === 'Command') {
    const t = { ...target, uid: target.space === null || target.lane ? undefined : s.players[target.who].row[target.space]?.uid };
    applyCommand(sim, who, card, mode, t);
    const { op, amount } = card.modes[mode];
    if (op === 'attackUp') notes.push(`+${amount} Attack until Supper`);
    if (op === 'attackKept') notes.push(`+${amount} Attack, kept`);
    if (op === 'spend') notes.push('The attacker becomes Spent after its attack');
    if (op === 'dive') notes.push(mode === 'react' ? 'Back to your hand: the attack fizzles' : `Back to your hand${amount ? `; draw ${amount}` : ''}`);
  } else if (card.cardType === 'Item') {
    applyItem(sim, who, card, { who, space: card.noTarget ? null : target.space });
    if (card.itemType === 'Held') notes.push(`Held: ${card.text.replace(/^Held: /, '')} while it holds it`);
    if (card.op === 'attackUp') notes.push(`+${card.amount} Attack until Supper`);
  } else if (card.cardType === 'Trainer') {
    runOps(sim, who, card.command.ops);
    for (const o of card.command.ops) if (o.op === 'draw') notes.push(`Draw ${o.amount} card${o.amount === 1 ? '' : 's'}`);
  } else throw new Error(`No preview for ${card.cardType}`);
  syncBonuses(sim);
  return {
    card: card.name,
    mode,
    changes: changes(s, sim),
    rewards: gain(s, sim, who),
    foeRewards: gain(s, sim, foe),
    text: notes.join(' · '),
    tournament: !!s.tournament,
  };
}

// G2: what a chosen-target On Summon would do with this target: the engine's own choose action on a copy.
export function choicePreview(s, target) {
  const who = s.choice.who;
  const sim = applyAction(s, { type: 'choose', who, target });
  return { name: s.choice.name, text: s.choice.text, changes: changes(s, sim), rewards: gain(s, sim, who), foeRewards: gain(s, sim, opponentOf(who)), tournament: !!s.tournament };
}

export const RECOGNITION_PER_DEFEAT = RULES.perDefeat;
