// C4: a Pokémon's real, current stats (Elliott: "the player has to add up additional points from other sources
// to work out how much they will damage"). Pure: no DOM.
//
// effectiveStats(s, who, space) returns the Attack its attack deals now (before the target's Shell) and its
// current and maximum Strength, with every source applied, and their parts (which always add up):
//   - Location passives, Held Items and Intimidate: the engine keeps these in step on the card (syncBonuses) and
//     attackParts / damageOf read them the way combat does;
//   - "until Supper" effects (tempAttack) and "kept" gains (Rage, Flame Charge, Brock, Charmander's On Attack):
//     the difference between the card's own numbers and its printed ones;
//   - damage taken.
// The Attack shown is damageOf, the number RESOLVE.attack deals; the Strength shown is currentStrength, the
// Strength damage is taken from and dominance counts. tests/c4.test.js checks both against combat.
import { TRAINERS, pokemonAt, pathDef } from './cards.js?v=202611131336';
import { applyAction, damageOf, locationAt, passiveOps, heldOps, syncBonuses, auraOf } from './game.js?v=202611131336';
import { attackParts } from './preview.js?v=202611131336';

// A Pokémon's printed stats (its Level's, or a Partner's own).
export function printedOf(card) {
  if (card.partner || card.series === 'Partner') {
    const t = TRAINERS.find((x) => x.partner.id === card.id);
    return t ? { attack: t.partner.attack, strength: t.partner.strength, speed: t.partner.speed } : { attack: card.attack, strength: card.strength, speed: card.speed };
  }
  // A card that isn't one of the 10 lines (a staged or unknown card): its own numbers are its printed ones.
  if (!pathDef(card.id)) return { attack: card.attack, strength: card.strength, speed: card.speed };
  const p = pokemonAt(card.id, card.level);
  return { attack: p.attack, strength: p.strength, speed: p.speed };
}

// 'up' (raised above printed), 'down' (lowered below printed, or damaged), or '' (unchanged).
const trend = (shown, printed) => (shown > printed ? 'up' : shown < printed ? 'down' : '');

export function effectiveStats(s, who, space) {
  const card = s.players[who].row[space];
  if (!card) return null;
  const printed = printedOf(card);
  // Attack: attackParts (UX3) splits damageOf into the card's own Attack and each bonus; its first part is the
  // card's Attack without the Location, Held, Intimidate and until-Supper changes: printed + kept.
  const ap = attackParts(s, who, space);
  const own = ap[0].n;
  const attackPartsOut = [{ label: 'printed', n: printed.attack }];
  if (own !== printed.attack) attackPartsOut.push({ label: 'kept', n: own - printed.attack });
  for (const p of ap.slice(1)) attackPartsOut.push({ label: p.label.replace(' (Physical)', ', Physical'), n: p.n });
  const attack = damageOf(s, card);
  // Strength: printed + kept + Location + Held + until Supper, then damage taken.
  const l = locationAt(s, space);
  const locSt = passiveOps(l).filter((o) => o.op === 'strength' && (!o.maxLevel || card.level <= o.maxLevel)).reduce((n, o) => n + o.amount, 0);
  const heldSt = heldOps(card).filter((o) => o.op === 'strength').reduce((n, o) => n + o.amount, 0);
  const temp = card.tempStrength ?? 0;
  const bonus = card.bonusStrength ?? 0;
  const strengthParts = [{ label: 'printed', n: printed.strength }];
  const kept = card.strength - printed.strength - bonus - temp;
  if (kept) strengthParts.push({ label: 'kept', n: kept });
  if (locSt) strengthParts.push({ label: l.name, n: locSt });
  if (heldSt) strengthParts.push({ label: card.held.name, n: heldSt });
  const aura = auraOf(s, who, space);
  if (aura.strength) strengthParts.push({ label: `Aura (${aura.names.join(', ')})`, n: aura.strength });
  if (temp) strengthParts.push({ label: 'until Supper', n: temp });
  const rest = bonus - locSt - heldSt - aura.strength;
  if (rest) strengthParts.push({ label: 'other bonuses', n: rest });
  const lost = card.strength - card.currentStrength;
  if (lost) strengthParts.push({ label: 'damage', n: -lost });
  return {
    attack, strength: card.currentStrength, strengthMax: card.strength,
    printed,
    attackTrend: trend(attack, printed.attack),
    // Damaged counts as lowered even when bonuses raise the maximum; otherwise compare with printed.
    strengthTrend: card.currentStrength < card.strength ? 'down' : trend(card.currentStrength, printed.strength),
    attackParts: attackPartsOut, strengthParts,
  };
}

// The one-line sum shown when hovering a raised or lowered stat: "Attack 9 = 8 + 1 Mt. Ember".
const signed = (n) => (n < 0 ? `− ${-n}` : `+ ${n}`);
export function oneLine(stat, total, parts) {
  const [first, ...rest] = parts;
  return `${stat} ${total} = ${first.n}${rest.map((p) => ` ${signed(p.n)} ${p.label}`).join('')}`;
}
export const statSumLines = (st) => ({ attack: oneLine('Attack', st.attack, st.attackParts), strength: oneLine('Strength', st.strength, st.strengthParts) });

// What a card in hand would show once summoned into a space: the engine's own summon on a copy (so Location,
// passives and anything else the summon brings apply exactly), or, when that summon isn't legal now, the card
// placed and its bonuses synced. null if the space is taken.
export function statsIfPlaced(s, who, card, space) {
  if (s.players[who].row[space]) return null;
  let sim = null;
  try {
    const x = structuredClone(s);
    x.reactWindow = null;
    x.choice = null;
    x.turn = who;
    x.phase = 'battle';
    if (!x.players[who].hand.some((c) => c.uid === card.uid)) x.players[who].hand.push(structuredClone(card));
    x.players[who].baseEnergy = Math.max(x.players[who].baseEnergy, 20);
    sim = applyAction(x, { type: 'summon', who, uid: card.uid, space });
    if (sim.reactWindow) sim = applyAction(sim, { type: 'decline', who: sim.reactWindow.reactor });
    if (sim.players[who].row[space]?.uid !== card.uid) sim = null;
  } catch { sim = null; }
  if (!sim) {
    sim = structuredClone(s);
    sim.players[who].row[space] = { ...structuredClone(card), currentStrength: card.strength, spent: true, bonusAttack: 0, bonusStrength: 0, tempAttack: 0 };
    syncBonuses(sim);
  }
  return effectiveStats(sim, who, space);
}
