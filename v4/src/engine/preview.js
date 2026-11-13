// Result previews (UX3): what an attack or an effect would do, before it's committed. Pure: no DOM.
// Each preview runs the engine's own functions (applyAction for an attack, applyCommand, applyItem and
// runOps for effects) on a copy of the state and reads the difference, so a preview can never disagree
// with the result. The attack's number is also split into its parts (base Attack, Location, Held Item,
// Intimidate, "until Supper"), which always add up to the engine's damageOf.
import { RULES } from '../rules.js?v=202611131336';
import {
  applyAction, applyCommand, applyItem, runOps, syncBonuses, damageOf, canHitBack, locationAt, passiveOps, heldOps, opponentOf, pokemonOf,
} from './game.js?v=202611131336';

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
  const locAtk = passiveOps(l).filter((o) => o.op === 'attack').reduce((n, o) => n + o.amount, 0);
  const heldAtk = heldOps(card).filter((o) => o.op === 'attack').reduce((n, o) => n + o.amount, 0);
  // B3-1: Intimidate (enemy Pokémon in its Location): whatever syncBonuses took off beyond the Location and Held Item.
  const bonus = card.bonusAttack ?? 0;
  const intim = bonus - locAtk - heldAtk;
  const temp = card.tempAttack ?? 0;
  const base = card.attack - bonus - temp;
  parts.push({ label: 'Attack', n: base });
  if (locAtk) parts.push({ label: l.name, n: locAtk });
  if (heldAtk) parts.push({ label: card.held.name, n: heldAtk });
  if (intim) parts.push({ label: 'Intimidate', n: intim });
  if (temp) parts.push({ label: 'until Supper', n: temp });
  // An Attack below 0 deals 0.
  if (card.attack < 0) parts.push({ label: 'minimum 0', n: -card.attack });
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
  // (A React's effect resolves with the window open, as in the engine: "your Pokémon being attacked", "the attacker".)
  if (mode !== 'react') sim.reactWindow = null;
  const foe = opponentOf(who);
  const notes = [];
  if (card.cardType === 'Command') {
    const t = { ...target, uid: target.space === null || target.lane ? undefined : s.players[target.who].row[target.space]?.uid };
    applyCommand(sim, who, card, mode, t);
    notes.push(...opNotes(card.modes[mode].ops, mode));
  } else if (card.cardType === 'Item') {
    applyItem(sim, who, card, { who, space: card.noTarget ? null : target.space });
    if (card.itemType === 'Held') notes.push(`Held: ${card.text.replace(/^Held: /, '')} while it holds it`);
    else notes.push(...opNotes(card.ops, 'use'));
  } else if (card.cardType === 'Trainer') {
    runOps(sim, who, card.command.ops, card.name, target && target.space !== null && target.space !== undefined ? target : null);
    notes.push(...opNotes(card.command.ops, 'command'));
  } else throw new Error(`No preview for ${card.cardType}`);
  // An effect waiting on a second choice (Leech Seed's heal, say): the preview shows what's known so far.
  sim.choice = null;
  sim.reactWindow = null;
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

// B3-1: the sentence-only parts of an effect (the numbers show as before → after).
function opNotes(ops, mode) {
  const out = [];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  for (const o of ops) {
    const n = o.amount ?? 0;
    switch (o.op) {
      case 'tempAttack': if (n > 0) out.push(`+${n} Attack until Supper`); else out.push(`${n} Attack until Supper`); break;
      case 'tempStrength': out.push(`+${n} Strength until Supper`); break;
      case 'attack': if (o.to) out.push(`+${n} Attack, kept`); break;
      case 'strength': if (o.to) out.push(`+${n} Strength, kept`); break;
      case 'shellTemp': out.push(`Shell ${n} until Supper`); break;
      case 'tempKeyword': out.push(`${o.keyword === 'overrun' ? 'Overrun' : o.keyword} until Supper`); break;
      case 'speed': if (o.to) out.push('Speed one step higher'); break;
      case 'reduce': out.push(`The attack deals ${n} less damage`); break;
      case 'noDamage': out.push('The attack deals no damage'); break;
      case 'returnHand': out.push(mode === 'react' ? 'Back to your hand' : 'Back to its owner\'s hand'); break;
      case 'attackFizzles': out.push('the attack fizzles'); break;
      case 'spend': out.push('Becomes Spent'); break;
      case 'activate': out.push('Becomes Active'); break;
      case 'draw': out.push(`Draw ${plural(n, 'card')}`); break;
      case 'energy': out.push(`+${n} Energy`); break;
      case 'search': out.push(`Search for ${n === 1 ? 'a Pokémon card' : plural(n, 'Pokémon card')}`); break;
      case 'handLevels': out.push(`+${plural(n, 'Level')} in hand`); break;
      default: break;
    }
  }
  return out;
}

// G2: what a chosen-target On Summon would do with this target: the engine's own choose action on a copy.
export function choicePreview(s, target) {
  const who = s.choice.who;
  const sim = applyAction(s, { type: 'choose', who, target });
  return { name: s.choice.name, text: s.choice.text, changes: changes(s, sim), rewards: gain(s, sim, who), foeRewards: gain(s, sim, opponentOf(who)), tournament: !!s.tournament };
}

export const RECOGNITION_PER_DEFEAT = RULES.perDefeat;

// --- C4: the React window's outcomes, on the board ---------------------------------------------------------
// reactOutcome(s, option): what the open React window resolves to if the reactor lets it happen (option null)
// or Reacts with { uid, target }: the engine's own react / decline action on a copy, read back as one badge per
// Pokémon it touches ("9 → Strength 7 → 0 · Defeated"), each side's rewards and a one-line summary for the tray.
// tests/c4.test.js plays every option for real and compares.
const WHO = { player: 'You', ai: 'Opponent' };
const rewardText = (who, g) => (g.recognition || g.dollars ? `${WHO[who]} ${[g.recognition ? `+${g.recognition} Recognition` : '', g.dollars ? `+$${g.dollars}` : ''].filter(Boolean).join(', ')}` : '');
export function reactOutcome(s, option = null) {
  const w = s.reactWindow;
  const reactor = w.reactor;
  const actor = w.pending.who;
  const action = option ? { type: 'react', who: reactor, uid: option.uid, target: option.target } : { type: 'decline', who: reactor };
  const sim = applyAction(s, action);
  const events = sim.events ?? [];
  const p = w.pending;
  const atk = p.type === 'attack' ? events.find((e) => e.type === 'attack' && e.who === actor && e.from === p.from) : null;
  const fizzled = events.some((e) => e.type === 'fizzled' && e.who === actor);
  const ch = changes(s, sim);
  const rev = option ? events.find((e) => e.type === 'commandResolved' && e.mode === 'react') : null;
  const rewards = { [actor]: gain(s, sim, actor), [reactor]: gain(s, sim, reactor) };
  const badges = [];
  const at = (who, space) => {
    let b = badges.find((x) => x.who === who && x.space === space);
    if (!b) { b = { who, space, name: s.players[who].row[space]?.name, lines: [], tone: 'neutral' }; badges.push(b); }
    return b;
  };
  for (const c of ch) {
    const b = at(c.who, c.space);
    if (c.returned) { b.lines.push(`${c.name} returns to ${c.who === 'player' ? 'your' : 'their'} hand`); b.tone = 'safe'; continue; }
    if (c.stat === 'strength') {
      const isTarget = p.type === 'attack' && atk && c.who !== actor && c.space === p.target.space;
      const isAttacker = p.type === 'attack' && atk && c.who === actor && c.space === p.from;
      const hit = isTarget ? atk.amount : isAttacker ? (atk.back ?? 0) + (atk.retaliated ?? 0) : null;
      // A React that changed this Pokémon first (Surf's heal, Ember's damage): that step, then the hit.
      const mid = rev?.hits?.find((h) => h.who === c.who && h.space === c.space);
      let from = c.before;
      if (mid && mid.after !== c.before && hit !== null) { b.lines.push(`${rev.name}: Strength ${c.before} → ${mid.after}`); from = mid.after; }
      b.lines.push(`${hit !== null ? `${hit} → ` : ''}Strength ${from} → ${Math.max(0, c.after)}${c.defeated ? ' · Defeated' : ''}`);
      b.tone = c.defeated ? 'bad' : c.after < c.before ? 'hurt' : 'good';
      if (c.defeated) { const by = c.who === 'player' ? 'ai' : 'player'; const r = rewardText(by, rewards[by]); if (r) b.lines.push(r); }
    } else if (c.stat === 'attack') b.lines.push(`Attack ${c.before} → ${c.after}`);
    // (An attacker always becomes Spent after attacking: only other Pokémon made Spent are worth a line.)
    else if (c.stat === 'spent' && !(p.type === 'attack' && c.who === actor && c.space === p.from)) b.lines.push('Becomes Spent');
  }
  // The attack's own target, when it fizzled or was left unharmed.
  if (p.type === 'attack' && p.target.kind === 'pokemon' && s.players[reactor].row[p.target.space]?.uid === p.targetUid) {
    const b = at(reactor, p.target.space);
    if (!b.lines.length) { b.lines.push(fizzled ? 'Safe · the attack fizzles' : atk ? `${atk.amount} damage` : 'Unharmed'); b.tone = 'safe'; }
    else if (fizzled && !b.lines.some((l) => /fizzles/.test(l))) b.lines.push('the attack fizzles');
  }
  const pc = p.type === 'attack' && p.target.kind === 'player' && atk ? `${atk.amount} damage to ${reactor === 'player' ? 'you' : 'the Opponent'}${rewardText(actor, rewards[actor]) ? ` · ${rewardText(actor, rewards[actor])}` : ''}` : '';
  return { option, badges: badges.filter((b) => b.lines.length), rewards, fizzled, pc, damage: atk?.amount ?? null, raw: atk?.raw ?? null, gameOver: sim.phase === 'gameOver' ? sim.winner : null, sim };
}
// The tray's one line for a React option: its effect, then what happens to the threatened Pokémon.
export function reactSummary(s, card, out) {
  const w = s.reactWindow;
  const p = w.pending;
  const { op, amount } = card.modes.react;
  const tgt = p.type === 'attack' && p.target.kind === 'pokemon' ? out.badges.find((b) => b.who === w.reactor && b.space === p.target.space) : null;
  const atkName = p.type === 'attack' ? s.players[p.who].row[p.from]?.name : null;
  const rest = tgt ? tgt.lines.join(' · ') : out.badges.map((b) => `${b.name}: ${b.lines.join(' · ')}`).join('; ') || out.pc;
  if (op === 'dive' && out.fizzled) return `${s.players[w.reactor].row[p.target.space]?.name} returns to your hand · the attack fizzles`;
  if (op === 'reduce' && atkName) { const d = damageOf(s, s.players[p.who].row[p.from]); return `${atkName}'s attack deals ${amount} less: ${d} → ${Math.max(0, d - amount)}${tgt ? ` · ${tgt.lines.join(' · ')}` : ''}`; }
  if (op === 'heal') return `${rest || `Heal ${amount}`}${/Defeated/.test(rest) ? ' (still defeated)' : ''}`;
  return rest || 'No change';
}
