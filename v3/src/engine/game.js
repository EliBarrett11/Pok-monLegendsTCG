// The v3 engine (V3-0; docs/v3-foundations.md is the only spec). Pure: no DOM.
// applyAction(state, action) never changes `state`: it returns a new state, with `events`
// saying what just happened (for the screen, the AI and the tests).
//
// The board: 10 spaces per side, two facing rows (space i on both sides is lane i). Locations
// cover spaces; a space with no Location is closed (no summoning there). The game controls the
// Locations, a treadmill (V3-1): from Round 2, at the start of each Round every Location moves one
// space left, so the leftmost shrinks by a lane and is removed when none is left (its completion
// rewards are given then); then a new Location (1–3 lanes) arrives on the right if one fits the
// free spaces there, else it waits. Pokémon and portraits never move with them.
//
// The race: each player's portrait stands on space 1 + one per 10 Recognition, never past the
// furthest open space. 100 Recognition reaches the Trophy on space 10 and wins. If no one has,
// the Regional Championship arrives as the 10th Location, covers every space, and at its end the
// higher Recognition is crowned Champion.
//
// A Round: Breakfast (a new Location; Spent Pokémon become Active; cards off the board follow the
// Round's Level; draw 2; Energy = the Round number, cap 10, less any Overexert debt; +2
// Recognition), Battle (alternating turns: summon, attack, play a Move or a Supporter, or Pass for
// +1 Energy; Overexert is free, once per Round; two Passes in a row end it), Supper (Location
// effects and "at Supper" objectives; hands are kept). Round 1: draw 6, then a mulligan.
import { RULES, SPEEDS, levelFor, energyFor, portraitSpace } from '../rules.js';
import { nextRandom, shuffle } from './random.js';
import { TEST_DECK, cardAt, pokemonAt, seriesDef, FAVOURS, WILD } from './cards.js';
import { kwSum, hasKw } from './keywords.js';
import { PALLET_TOWN, LOCATIONS, CHAMPIONSHIP, locationDef, rewardText } from './locations.js';

export const PLAYERS = ['player', 'ai'];
export const NAMES = { player: 'You', ai: 'The Opponent' };
export const opponentOf = (who) => (who === 'player' ? 'ai' : 'player');
const POSS = { player: 'Your', ai: 'The Opponent\'s' };

// --- Setup ---------------------------------------------------------------------------------------

export function createGame(seed = Date.now(), { decks = { player: TEST_DECK, ai: TEST_DECK }, locations = null } = {}) {
  const s = {
    seed, rng: seed >>> 0, round: 1, phase: 'mulligan', turn: null, initiative: null, passesInARow: 0,
    players: {}, locations: [], locationCount: 0, nextLocation: 0, locationQueue: [], championship: null,
    winner: null, result: null, log: [], events: [],
  };
  // The Locations to come: the six test Locations, shuffled, and again when used up.
  s.locationQueue = locations ? [...locations] : [];
  for (const who of PLAYERS) {
    const pile = shuffle(s, decks[who].map((e) => ({ ...e })));
    s.players[who] = {
      drawPile: pile.map((e, i) => ({ ...cardAt(e, 1), entry: e, uid: `${who}-${i}` })),
      hand: [], row: Array(RULES.spaces).fill(null), discard: [], released: [],
      energy: 0, debt: 0, bonusNext: 0, overexertRound: 0, recognition: 0, deckOuts: 0, mulliganed: false, decided: false, defeats: 0,
    };
  }
  s.initiative = nextRandom(s) < 0.5 ? 'player' : 'ai';
  placeLocation(s, PALLET_TOWN);
  for (const who of PLAYERS) draw(s, who, RULES.openingHand);
  log(s, `Round 1: Pallet Town. Each player draws ${RULES.openingHand}; ${NAMES[s.initiative]} will go first.`);
  return s;
}

// --- Reading the board -----------------------------------------------------------------------------

export const locationAt = (s, space) => s.locations.find((l) => space >= l.start && space < l.start + l.width) ?? null;
export const isOpen = (s, space) => space >= 0 && space < RULES.spaces && locationAt(s, space) !== null;
export const furthestOpen = (s) => Math.max(-1, ...s.locations.map((l) => Math.min(RULES.spaces, l.start + l.width) - 1));
export const lanesOf = (l) => Array.from({ length: l.width }, (_, i) => l.start + i).filter((i) => i >= 0 && i < RULES.spaces);
// A portrait's space: one per 10 Recognition, never past the furthest open space.
export const portraitOf = (s, who) => Math.max(0, Math.min(portraitSpace(s.players[who].recognition), furthestOpen(s), RULES.spaces - 1));
export const pokemonOf = (s, who) => s.players[who].row.map((card, space) => (card ? { card, space } : null)).filter(Boolean);
const allPokemon = (s) => PLAYERS.flatMap((who) => pokemonOf(s, who).map((p) => ({ ...p, who })));
const speedRank = (card) => SPEEDS.indexOf(card.speed);

// Ready: Active, and of the highest Speed among all Active Pokémon on both sides.
export function topSpeed(s) {
  return Math.max(-1, ...allPokemon(s).filter(({ card }) => !card.spent).map(({ card }) => speedRank(card)));
}
export const isReady = (s, card) => !!card && !card.spent && speedRank(card) === topSpeed(s);
export const readySpaces = (s, who) => pokemonOf(s, who).filter(({ card }) => isReady(s, card)).map(({ space }) => space);

// Where the Pokémon on `from` may attack. Guards: a Defence Pokémon protects your *other*
// Pokémon in the same Location from Physical attackers (they must target a Defence guard
// there); Special Defence the same against Special attackers. The player character is protected
// only by a Pokémon on its own portrait's space, whatever its Strength-Type.
export function legalTargets(s, who, from) {
  const attacker = s.players[who].row[from];
  if (!attacker) return [];
  const foe = opponentOf(who);
  const guard = attacker.attackType === 'Physical' ? 'Defence' : 'Special Defence';
  // Infiltrator ignores guards and the portrait's protection.
  const infiltrator = hasKw(attacker, 'Infiltrator');
  const out = [];
  for (const { space } of pokemonOf(s, foe)) {
    if (!infiltrator && guardedBy(s, foe, space, guard)) continue;
    out.push({ kind: 'pokemon', space });
  }
  if (infiltrator || playerTargetable(s, foe)) out.push({ kind: 'player' });
  return out;
}
// The guard standing in front of the Pokémon on `space` (another Pokémon of `foe` in the same
// Location with the matching Strength-Type), or null.
export function guardedBy(s, foe, space, guard) {
  const l = locationAt(s, space);
  if (!l) return null;
  const card = s.players[foe].row[space];
  if (card?.strengthType === guard) return null;
  const g = lanesOf(l).find((i) => i !== space && s.players[foe].row[i]?.strengthType === guard);
  return g === undefined ? null : { space: g, card: s.players[foe].row[g] };
}
export const playerTargetable = (s, foe) => !s.players[foe].row[portraitOf(s, foe)];
export const protectorOf = (s, foe) => s.players[foe].row[portraitOf(s, foe)] ?? null;

// Effect targets (Moves, Supporters): any enemy Pokémon; the enemy player unless protected on
// its portrait's space; your own Pokémon (damaged ones, for heals).
export function effectTargets(s, who, spec) {
  if (!spec) return [];
  const side = spec.side === 'enemy' ? opponentOf(who) : who;
  const out = [];
  if (spec.kinds.includes('pokemon')) {
    for (const { card, space } of pokemonOf(s, side)) {
      if (spec.damaged && card.currentStrength >= card.strength) continue;
      out.push({ who: side, kind: 'pokemon', space });
    }
  }
  if (spec.kinds.includes('player') && (side === who || playerTargetable(s, side))) out.push({ who: side, kind: 'player' });
  // A chosen Location: one with at least one of that side's Pokémon in it.
  if (spec.kinds.includes('location')) {
    for (const l of s.locations) if (lanesOf(l).some((i) => s.players[side].row[i])) out.push({ who: side, kind: 'location', uid: l.uid });
  }
  return out;
}
const refKey = (t) => `${t?.who}:${t?.kind}:${t?.space ?? t?.uid ?? ''}`;

export const emptyOpenSpaces = (s, who) => Array.from({ length: RULES.spaces }, (_, i) => i).filter((i) => isOpen(s, i) && !s.players[who].row[i]);
export const summonable = (s, who) => (emptyOpenSpaces(s, who).length ? s.players[who].hand.filter((c) => c.cardType === 'Pokémon' && c.cost <= s.players[who].energy) : []);
export const affordableBreakpoints = (s, who, card) => (card.breakpoints ?? []).filter((b) => b.cost <= s.players[who].energy && (!b.target || effectTargets(s, who, b.target).length));
export const playableMoves = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Move' && affordableBreakpoints(s, who, c).length);
export const favourMet = (card, paid) => !!card.favour && paid.some((c) => FAVOURS[card.favour.condition].test(c));
export const supporterPlayable = (s, who, card) => s.players[who].hand.length - 1 >= card.release && (!card.target || effectTargets(s, who, card.target).length || card.favour?.untargeted);
export const playableSupporters = (s, who) => s.players[who].hand.filter((c) => c.cardType === 'Supporter' && supporterPlayable(s, who, c));
export const canOverexert = (s, who) => s.phase === 'battle' && s.turn === who && s.players[who].overexertRound !== s.round;
export const attackers = (s, who) => readySpaces(s, who).filter((sp) => legalTargets(s, who, sp).length);

// Passing while your fastest Active Pokémon are faster than all of the opponent's makes them Spent.
export const passEndsPhase = (s) => s.passesInARow >= 1;
export function passSpends(s, who) {
  if (s.phase !== 'battle' || passEndsPhase(s)) return [];
  const top = topSpeed(s);
  if (top < 0) return [];
  const atTop = allPokemon(s).filter(({ card }) => !card.spent && speedRank(card) === top);
  if (atTop.some((p) => p.who !== who)) return [];
  return atTop.map(({ space }) => space);
}

export function legalActions(s, who) {
  if (s.phase === 'gameOver') return [];
  if (s.phase === 'mulligan') return s.players[who].decided ? [] : ['mulligan'];
  if (s.phase !== 'battle' || s.turn !== who) return [];
  return [
    'pass',
    ...(summonable(s, who).length ? ['summon'] : []),
    ...(attackers(s, who).length ? ['attack'] : []),
    ...(playableMoves(s, who).length ? ['playMove'] : []),
    ...(playableSupporters(s, who).length ? ['playSupporter'] : []),
    ...(canOverexert(s, who) ? ['overexert'] : []),
  ];
}
// Who acts next.
export function actor(s) {
  if (s.phase === 'mulligan') return PLAYERS.find((w) => !s.players[w].decided) ?? null;
  if (s.phase === 'battle') return s.turn;
  return null;
}

// --- Actions -----------------------------------------------------------------------------------------

export function applyAction(state, action) {
  const s = structuredClone(state);
  s.events = [];
  const who = action.who;
  if (!legalActions(s, who).includes(action.type)) throw new Error(`${who} cannot ${action.type} now`);
  ACTIONS[action.type](s, action);
  return s;
}

const ACTIONS = {
  // Round 1: keep the 6, or shuffle them back and draw 6 again (once).
  mulligan(s, { who, redraw = false }) {
    const p = s.players[who];
    if (redraw && !p.mulliganed) {
      p.drawPile = shuffle(s, [...p.drawPile, ...p.hand]);
      p.hand = [];
      p.mulliganed = true;
      draw(s, who, RULES.openingHand);
      emit(s, 'mulligan', { who });
      log(s, `${NAMES[who]} took a mulligan.`);
    }
    p.decided = true;
    if (PLAYERS.every((w) => s.players[w].decided)) beginBattle(s);
  },

  summon(s, { who, uid, space }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Pokémon') throw new Error('Choose a Pokémon from your hand');
    if (!isOpen(s, space)) throw new Error('That space is closed: no Location covers it');
    if (p.row[space]) throw new Error('That space is taken');
    if (card.cost > p.energy) throw new Error(`${card.name} costs ${card.cost} Energy`);
    p.energy -= card.cost;
    p.hand = p.hand.filter((c) => c !== card);
    place(s, who, card, space, card.cost);
    endTurn(s, who, false);
  },

  attack(s, { who, from, target }) {
    const p = s.players[who];
    const foe = opponentOf(who);
    const a = p.row[from];
    if (!a || !isReady(s, a)) throw new Error('Choose one of your Ready Pokémon');
    if (!legalTargets(s, who, from).some((t) => t.kind === target?.kind && t.space === target.space)) throw new Error('That is not a legal target');
    const here = locationAt(s, from);
    if (target.kind === 'player') {
      a.spent = true;
      emit(s, 'attack', { who, from, target: { kind: 'player' }, amount: a.attack, attacker: a.name });
      log(s, `${POSS[who]} ${a.name} attacked ${who === 'player' ? 'the Opponent' : 'you'} directly for ${a.attack}.`);
      progress(s, who, here, 'attack', 1);
      progress(s, who, here, 'damagePlayer', a.attack);
      gainRecognition(s, who, a.attack * RULES.perDamageToPlayer, `${a.name}'s attack`);
      return endTurn(s, who, false);
    }
    const d = s.players[foe].row[target.space];
    const trades = isReady(s, d);
    const left = d.currentStrength;
    const hit = afterShell(a.attack, d);
    const back = trades ? afterShell(d.attack, a) : 0;
    d.currentStrength -= hit;
    if (trades) a.currentStrength -= back;
    a.spent = true;
    if (trades) d.spent = true;
    emit(s, 'attack', { who, from, target: { kind: 'pokemon', space: target.space }, amount: hit, back, attacker: a.name, defender: d.name });
    log(s, `${POSS[who]} ${a.name} attacked ${d.name} for ${hit}${trades ? `; ${d.name} was Ready and hit back for ${back}` : ''}.`);
    progress(s, who, here, 'attack', 1);
    const dDown = d.currentStrength <= 0;
    const aDown = a.currentStrength <= 0;
    // Overrun: when its attack defeats the target, the damage left over goes to the enemy player.
    if (dDown && hasKw(a, 'Overrun') && hit > left) {
      progress(s, who, here, 'damagePlayer', hit - left);
      gainRecognition(s, who, (hit - left) * RULES.perDamageToPlayer, `${a.name}'s Overrun`);
      if (s.phase === 'gameOver') return;
    }
    // Rage: +1 Attack each time it survives damage.
    if (!dDown && hit > 0) rage(d);
    if (!aDown && back > 0) rage(a);
    if (dDown) { defeat(s, foe, target.space, who); progress(s, who, here, 'defeat', 1); }
    if (aDown) { defeat(s, who, from, foe); progress(s, foe, locationAt(s, target.space), 'defeat', 1); }
    if (s.phase === 'gameOver') return;
    // On Attack (the attacker survived); On Defend (the defender survived damage).
    if (!aDown && a.onAttack) ability(s, who, from, a.onAttack, target.space);
    if (!dDown && hit > 0 && d.onDefend && s.players[who].row[from] === a) hurt(s, who, from, d.onDefend, foe);
    if (s.phase === 'gameOver') return;
    endTurn(s, who, false);
  },

  // A Move: pay one of its breakpoints; its effect on the chosen target. Then the Discard Pile.
  playMove(s, { who, uid, pay, target, targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Move') throw new Error('Choose a Move from your hand');
    const bp = card.breakpoints.find((b) => b.cost === pay);
    if (!bp) throw new Error(`${card.name} can be paid ${card.breakpoints.map((b) => b.cost).join(', ')}`);
    if (pay > p.energy) throw new Error(`Not enough Energy for ${card.name} at ${pay}`);
    const t = checkTargets(s, who, bp.target, targets ?? (target ? [target] : []));
    p.energy -= pay;
    p.hand = p.hand.filter((c) => c !== card);
    p.discard.push(card);
    emit(s, 'move', { who, uid, name: card.name, pay, text: bp.text });
    log(s, `${NAMES[who]} played ${card.name} for ${pay} Energy: ${bp.text}.`);
    runOps(s, who, bp.ops, t);
    // Viridian Forest: each Move you play summons a Wild Bug into an empty space there on your side.
    for (const l of s.locations.filter((x) => x.effect === 'wild')) {
      const space = lanesOf(l).find((i) => !p.row[i]);
      if (space === undefined || s.phase === 'gameOver') continue;
      place(s, who, { ...pokemonAt(WILD.id, 1, 1), uid: `wild-${s.round}-${who}-${space}`, wild: true }, space, 0);
      log(s, `A Wild Sewaddle joined ${NAMES[who] === 'You' ? 'you' : 'the Opponent'} in ${l.name}.`);
    }
    if (s.phase !== 'gameOver') endTurn(s, who, false);
  },

  // A Supporter: Release exactly its number of other cards from your hand; the Favour (a Released
  // card that meets it) improves it. The Supporter is Released too.
  playSupporter(s, { who, uid, release = [], target, targets }) {
    const p = s.players[who];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.cardType !== 'Supporter') throw new Error('Choose a Supporter from your hand');
    if (release.length !== card.release || new Set(release).size !== release.length) throw new Error(`Release exactly ${card.release} card${card.release === 1 ? '' : 's'}`);
    const paid = release.map((u) => p.hand.find((c) => c.uid === u && c !== card));
    if (paid.some((c) => !c)) throw new Error('Release cards from your hand');
    const met = favourMet(card, paid);
    const t = checkTargets(s, who, met && card.favour.untargeted ? null : card.target, targets ?? (target ? [target] : []));
    p.hand = p.hand.filter((c) => c !== card && !paid.includes(c));
    p.released.push(...paid, card);
    emit(s, 'supporter', { who, uid, name: card.name, released: paid.map((c) => c.name), favour: met });
    log(s, `${NAMES[who]} played ${card.name}, Releasing ${paid.map((c) => c.name).join(' and ')}${met ? ` (Favour: ${card.favour.text})` : ''}.`);
    runOps(s, who, met ? card.favour.ops : card.ops, t);
    if (s.phase !== 'gameOver') endTurn(s, who, false);
  },

  // Overexert (free, once per Round): spend up to 2 Energy you don't have; next Breakfast you get
  // that much less, plus 1.
  overexert(s, { who, amount }) {
    const p = s.players[who];
    if (!(amount >= 1 && amount <= RULES.overexertMax)) throw new Error(`Overexert 1 to ${RULES.overexertMax}`);
    p.energy += amount;
    p.debt = amount + RULES.overexertPenalty;
    p.overexertRound = s.round;
    emit(s, 'overexert', { who, amount, debt: p.debt });
    log(s, `${NAMES[who]} Overexerted: +${amount} Energy now, ${p.debt} less next Breakfast.`);
  },

  pass(s, { who }) {
    const p = s.players[who];
    const ends = passEndsPhase(s);
    const spends = passSpends(s, who);
    if (!ends) {
      p.energy += RULES.passEnergy;
      for (const space of spends) p.row[space].spent = true;
    }
    emit(s, 'pass', { who, endsPhase: ends, spends });
    log(s, ends ? `${NAMES[who]} passed: the Battle Phase ends.` : `${NAMES[who]} passed: +${RULES.passEnergy} Energy${spends.length ? ` (${spends.length} became Spent: unmatched Speed)` : ''}.`);
    endTurn(s, who, true);
  },
};

// The chosen targets for a spec: 1 up to its count, all different, all legal.
function checkTargets(s, who, spec, targets) {
  if (!spec) return [];
  const options = effectTargets(s, who, spec);
  if (!options.length) throw new Error('There is no legal target');
  const list = targets.filter(Boolean);
  if (list.length < 1 || list.length > (spec.count ?? 1)) throw new Error((spec.count ?? 1) === 1 ? 'Choose a target' : `Choose 1 to ${spec.count} targets`);
  if (new Set(list.map(refKey)).size !== list.length) throw new Error('Choose different targets');
  return list.map((t) => {
    const found = options.find((o) => refKey(o) === refKey(t));
    if (!found) throw new Error('Choose a legal target');
    return found;
  });
}

// Shell N: each instance of damage this Pokémon takes is N less, but at least 1.
const afterShell = (amount, card) => (amount > 0 ? Math.max(1, amount - kwSum(card, 'Shell')) : 0);
const rage = (card) => { if (hasKw(card, 'Rage')) { card.attack += 1; card.grown = (card.grown ?? 0) + 1; } };
// The Pokémon a target reaches (a Pokémon, or every one of a side's in a chosen Location).
function pokemonFor(s, t) {
  if (t.kind === 'pokemon') return s.players[t.who].row[t.space] ? [{ who: t.who, space: t.space }] : [];
  if (t.kind === 'location') {
    const l = s.locations.find((x) => x.uid === t.uid);
    return l ? lanesOf(l).filter((i) => s.players[t.who].row[i]).map((space) => ({ who: t.who, space })) : [];
  }
  return [];
}
// Effect damage to a Pokémon (Shell applies); a defeat counts for `by`.
function hurt(s, who, space, amount, by) {
  const card = s.players[who].row[space];
  if (!card || amount <= 0 || s.phase === 'gameOver') return;
  const n = afterShell(amount, card);
  card.currentStrength -= n;
  emit(s, 'damaged', { who, space, amount: n });
  if (card.currentStrength <= 0) defeat(s, who, space, by);
  else rage(card);
}
function heal(s, who, space, amount) {
  const card = s.players[who].row[space];
  if (!card) return;
  card.currentStrength = Math.min(card.strength, card.currentStrength + amount);
  emit(s, 'healed', { who, space });
}
// A buff: +Attack / +Strength / keywords until Supper ("this Round") or the next Breakfast.
function buff(card, o) {
  const b = { attack: o.attack ?? 0, strength: o.strength ?? 0, keywords: o.keywords ?? [], until: o.until ?? 'supper' };
  card.attack += b.attack;
  card.strength += b.strength;
  card.currentStrength += b.strength;
  card.keywords = [...card.keywords, ...b.keywords];
  card.buffs = [...(card.buffs ?? []), b];
}
function expireBuffs(s, until) {
  for (const who of PLAYERS) {
    for (const { card } of pokemonOf(s, who)) {
      for (const b of (card.buffs ?? []).filter((x) => x.until === until)) {
        card.attack -= b.attack;
        card.strength -= b.strength;
        card.currentStrength = Math.max(1, Math.min(card.currentStrength, card.strength));
        for (const k of b.keywords) card.keywords.splice(card.keywords.indexOf(k), 1);
      }
      card.buffs = (card.buffs ?? []).filter((x) => x.until !== until);
    }
  }
}

function runOps(s, who, ops, targets) {
  const foe = opponentOf(who);
  for (const op of ops) {
    if (s.phase === 'gameOver') return;
    const reach = targets.flatMap((t) => pokemonFor(s, t));
    switch (op.op) {
      case 'damage':
        for (const t of targets) if (t.kind === 'player') gainRecognition(s, who, op.amount * RULES.perDamageToPlayer, 'damage to the enemy player');
        for (const r of reach) hurt(s, r.who, r.space, op.amount, who);
        break;
      case 'heal': for (const r of reach) heal(s, r.who, r.space, op.amount); break;
      case 'buff': for (const r of reach) buff(s.players[r.who].row[r.space], op); break;
      case 'ready': for (const r of reach) s.players[r.who].row[r.space].spent = false; break;
      case 'damageAll': for (const { space } of pokemonOf(s, foe)) hurt(s, foe, space, op.amount, who); break;
      case 'damageOthers': {
        const hit = new Set(targets.flatMap((t) => pokemonFor(s, t)).map((r) => r.space));
        for (const { space } of pokemonOf(s, foe)) if (!hit.has(space)) hurt(s, foe, space, op.amount, who);
        break;
      }
      case 'healAll': for (const { space } of pokemonOf(s, who)) heal(s, who, space, op.amount); break;
      case 'buffAll': for (const { card } of pokemonOf(s, who)) buff(card, op); break;
      case 'damagePlayer': if (playerTargetable(s, foe)) gainRecognition(s, who, op.amount * RULES.perDamageToPlayer, 'damage to the enemy player'); break;
      case 'draw': draw(s, who, op.amount); break;
      case 'recognition': gainRecognition(s, who, op.amount, 'an effect'); break;
      default: throw new Error(`Unknown op ${op.op}`);
    }
  }
}

// A Pokémon's own ability (On Summon, On Attack): its targets are chosen by the engine.
//   enemyHere: every enemy Pokémon in its Location · enemyHereOthers: the same, but not `except`
//   friendHereOtherDamaged: its most-damaged other friendly Pokémon in its Location
function ability(s, who, space, eff, except) {
  if (!eff || s.phase === 'gameOver') return;
  const foe = opponentOf(who);
  const l = locationAt(s, space);
  const lanes = l ? lanesOf(l) : [space];
  let targets = [];
  if (eff.to === 'enemyHere' || eff.to === 'enemyHereOthers') {
    targets = lanes.filter((i) => s.players[foe].row[i] && !(eff.to === 'enemyHereOthers' && i === except)).map((i) => ({ who: foe, kind: 'pokemon', space: i }));
    if (!targets.length) return;
  } else if (eff.to === 'friendHereOtherDamaged') {
    const hurtOnes = lanes.filter((i) => i !== space && s.players[who].row[i] && s.players[who].row[i].currentStrength < s.players[who].row[i].strength);
    if (!hurtOnes.length) return;
    const worst = hurtOnes.sort((x, y) => (s.players[who].row[y].strength - s.players[who].row[y].currentStrength) - (s.players[who].row[x].strength - s.players[who].row[x].currentStrength))[0];
    targets = [{ who, kind: 'pokemon', space: worst }];
  }
  emit(s, 'ability', { who, space, name: s.players[who].row[space]?.name });
  runOps(s, who, eff.ops, targets);
}

// A Pokémon arrives (Spent), frozen at its Level.
function place(s, who, card, space, cost) {
  const { entry, ...plain } = card;
  // It arrives Spent (Quick Attack: Active).
  s.players[who].row[space] = { ...plain, currentStrength: card.strength, spent: !hasKw(card, 'Quick Attack'), arrivedRound: s.round, buffs: [] };
  emit(s, 'summoned', { who, space, name: card.name, level: card.level, cost, wild: !!card.wild });
  if (!card.wild) log(s, `${NAMES[who]} summoned ${card.name} (Level ${card.level}) into space ${space + 1} (${cost} Energy).`);
  progress(s, who, locationAt(s, space), 'summon', 1);
  if (card.onSummon) ability(s, who, space, card.onSummon);
  // Rally: the others already in its Location grow.
  const l = locationAt(s, space);
  for (const i of l ? lanesOf(l) : []) {
    const other = s.players[who].row[i];
    if (i === space || !other?.rally || s.phase === 'gameOver') continue;
    other.attack += other.rally.attack;
    other.strength += other.rally.strength;
    other.currentStrength += other.rally.strength;
    emit(s, 'rally', { who, space: i, name: other.name });
  }
}

function defeat(s, who, space, by) {
  const card = s.players[who].row[space];
  s.players[who].row[space] = null;
  if (!card.wild) s.players[who].released.push(card);
  emit(s, 'defeated', { who, space, name: card.name, by });
  log(s, `${POSS[who]} ${card.name} was defeated.`);
  s.players[by].defeats += 1;
  gainRecognition(s, by, RULES.perDefeat, `defeating ${card.name}`);
}

function endTurn(s, who, passed) {
  if (s.phase === 'gameOver') return;
  s.passesInARow = passed ? s.passesInARow + 1 : 0;
  if (s.passesInARow >= 2) return supper(s);
  s.turn = opponentOf(who);
}

// --- Recognition and the Trophy ---------------------------------------------------------------------

export function gainRecognition(s, who, amount, source) {
  if (amount <= 0 || s.phase === 'gameOver') return;
  const p = s.players[who];
  const before = portraitOf(s, who);
  p.recognition += amount;
  emit(s, 'recognition', { who, amount, total: p.recognition, source });
  log(s, `${NAMES[who]}: +${amount} Recognition (${source}), now ${p.recognition}.`);
  if (portraitOf(s, who) !== before) emit(s, 'portrait', { who, from: before, to: portraitOf(s, who) });
  checkTrophy(s);
}
// 100 Recognition reaches the Trophy on space 10, once space 10 is open.
function checkTrophy(s) {
  if (s.phase === 'gameOver' || !isOpen(s, RULES.spaces - 1)) return;
  const at = PLAYERS.filter((w) => s.players[w].recognition >= RULES.win);
  if (!at.length) return;
  const w = at.length === 1 ? at[0] : s.players.player.recognition === s.players.ai.recognition ? null : (s.players.player.recognition > s.players.ai.recognition ? 'player' : 'ai');
  endMatch(s, w, 'trophy', w ? `${NAMES[w]} reached the Trophy with ${s.players[w].recognition} Recognition: Regional Champion!` : 'Both reached the Trophy at once: a draw.');
}

function endMatch(s, winner, reason, line) {
  s.phase = 'gameOver';
  s.winner = winner;
  s.turn = null;
  s.result = { winner, reason, round: s.round, recognition: { player: s.players.player.recognition, ai: s.players.ai.recognition } };
  emit(s, 'gameOver', { winner, reason });
  log(s, line);
}

// --- Locations: the treadmill ---------------------------------------------------------------------

function placeLocation(s, def) {
  s.locationCount += 1;
  // The Regional Championship covers every space: every other Location leaves (V3-1: it arrives
  // over the whole board when it's due, since the treadmill never empties the board).
  if (def.width >= RULES.spaces) {
    for (const l of [...s.locations]) expire(s, l, 'championship');
    s.locations.push(newLoc(s, def, 0));
    s.championship = { roundsLeft: RULES.championshipRounds, tieRounds: 0 };
    emit(s, 'locationArrived', { id: def.id, name: def.name, start: 0, width: def.width, championship: true });
    log(s, `The Regional Championship arrives over every space! It lasts ${RULES.championshipRounds} Rounds; then the higher Recognition is crowned Champion.`);
    return;
  }
  const start = furthestOpen(s) + 1;
  const l = newLoc(s, def, start);
  s.locations.push(l);
  emit(s, 'locationArrived', { id: def.id, name: def.name, start, width: def.width });
  if (s.locationCount > 1) log(s, `${def.name} arrives on ${def.width === 1 ? `space ${start + 1}` : `spaces ${start + 1}–${start + def.width}`}. ${def.objective.text}.`);
  checkTrophy(s);
}

// The treadmill (V3-1): every Location moves one space left; the leftmost shrinks, and is removed
// when no lanes are left (its completion rewards are given then).
function moveLocations(s) {
  if (s.championship) return;
  for (const l of s.locations) l.start -= RULES.treadmillShift;
  emit(s, 'treadmill', {});
  for (const l of s.locations.filter((x) => x.start + x.width <= 0)) expire(s, l, 'off');
}
// The free spaces at the right edge of the board.
export const freeAtRight = (s) => RULES.spaces - (furthestOpen(s) + 1);

const newLoc = (s, def, start) => ({
  uid: `loc-${s.nextLocation++}`, id: def.id, name: def.name, art: def.art, width: def.width, color: def.color, tagline: def.tagline,
  objective: def.objective, milestones: def.milestones, completion: def.completion, effect: def.effect, start, arrivedRound: s.round,
  championship: def.width >= RULES.spaces, progress: { player: 0, ai: 0 }, reached: { player: [], ai: [] }, completed: { player: false, ai: false },
});

// A Location leaves the board: completion rewards to each player who completed it.
function expire(s, l, why) {
  s.locations = s.locations.filter((x) => x !== l);
  emit(s, 'locationRemoved', { uid: l.uid, id: l.id, name: l.name, why });
  log(s, `${l.name} leaves the board.`);
  for (const who of PLAYERS) {
    if (l.completed[who] && s.phase !== 'gameOver') {
      log(s, `${NAMES[who]} completed ${l.name}: ${rewardText(l.completion)}.`);
      reward(s, who, l.completion, `${l.name} completed`);
    }
  }
}

// Progress on the objective of the Location `l` (where the acting Pokémon stands).
function progress(s, who, l, kind, amount) {
  if (!l || l.objective.kind !== kind || l.completed[who] || s.phase === 'gameOver') return;
  l.progress[who] = Math.min(l.objective.count, l.progress[who] + amount);
  emit(s, 'progress', { who, uid: l.uid, progress: l.progress[who] });
  for (const m of l.milestones) {
    if (l.progress[who] >= m.at && !l.reached[who].includes(m.at)) {
      l.reached[who].push(m.at);
      emit(s, 'milestone', { who, uid: l.uid, at: m.at });
      log(s, `${NAMES[who]} reached a milestone at ${l.name}: ${rewardText(m.reward)}.`);
      reward(s, who, m.reward, `${l.name} milestone`);
    }
  }
  if (l.progress[who] >= l.objective.count) {
    l.completed[who] = true;
    emit(s, 'completed', { who, uid: l.uid });
    log(s, `${NAMES[who]} completed ${l.name}'s objective (the reward comes when it leaves).`);
  }
}

function reward(s, who, r, source) {
  if (r.energyNext) s.players[who].bonusNext += r.energyNext;
  if (r.draw) draw(s, who, r.draw);
  if (r.recognition) gainRecognition(s, who, r.recognition, source);
}

// --- Phases -------------------------------------------------------------------------------------------

function beginBattle(s) {
  for (const who of PLAYERS) s.players[who].energy = energyFor(s.round);
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
  emit(s, 'battle', { round: s.round });
}

function draw(s, who, n) {
  const p = s.players[who];
  for (let i = 0; i < n; i++) {
    if (!p.drawPile.length) {
      // Running out of cards: each draw you can't make gives the opponent 3, 6, 9…
      p.deckOuts += 1;
      const amount = RULES.deckOut * p.deckOuts;
      emit(s, 'deckOut', { who, amount });
      log(s, `${NAMES[who]} cannot draw: the deck is empty.`);
      gainRecognition(s, opponentOf(who), amount, `${who === 'player' ? 'your' : 'the Opponent\'s'} empty deck`);
      if (s.phase === 'gameOver') return;
      continue;
    }
    const card = p.drawPile.shift();
    if (p.hand.length >= RULES.handLimit) {
      p.released.push(card);
      emit(s, 'cardLost', { who, name: who === 'player' ? card.name : null });
      log(s, `${NAMES[who]} drew a card beyond the hand limit of ${RULES.handLimit}: it is lost.`);
    } else p.hand.push(card);
  }
}

// Off the board, a Pokémon card's Level is the Round number, up to its cap.
function followRound(s, who) {
  const p = s.players[who];
  for (const pile of ['hand', 'drawPile']) {
    p[pile] = p[pile].map((c) => (c.cardType === 'Pokémon' ? { ...pokemonAt(c.series, levelFor(s.round, c.cap), c.cap), entry: c.entry, uid: c.uid } : c));
  }
}

function supper(s) {
  emit(s, 'supper', { round: s.round });
  log(s, `Round ${s.round} · Supper.`);
  for (const l of [...s.locations]) {
    for (const who of PLAYERS) {
      const mine = lanesOf(l).filter((i) => s.players[who].row[i]);
      if (l.effect === 'heal') for (const i of mine) s.players[who].row[i].currentStrength = s.players[who].row[i].strength;
      if (mine.length) progress(s, who, l, 'presence', 1);
    }
  }
  if (s.phase === 'gameOver') return;
  expireBuffs(s, 'supper');
  // The Regional Championship: at its end, the higher Recognition is crowned Champion.
  if (s.championship) {
    s.championship.roundsLeft -= 1;
    if (s.championship.roundsLeft <= 0) {
      const champ = s.locations.find((l) => l.championship);
      if (champ) for (const who of PLAYERS) if (champ.completed[who]) reward(s, who, champ.completion, 'the Championship completed');
      if (s.phase === 'gameOver') return;
      const r = { player: s.players.player.recognition, ai: s.players.ai.recognition };
      if (r.player !== r.ai) {
        const w = r.player > r.ai ? 'player' : 'ai';
        return endMatch(s, w, 'champion', `The Regional Championship is over: ${NAMES[w]} ${w === 'player' ? 'are' : 'is'} crowned Champion with ${r[w]} Recognition to ${r[opponentOf(w)]}!`);
      }
      if (s.championship.tieRounds >= RULES.championshipTieRounds) return endMatch(s, null, 'draw', `Still tied on ${r.player} Recognition after the Championship: a draw.`);
      s.championship.tieRounds += 1;
      s.championship.roundsLeft = 1;
      log(s, `Tied on ${r.player} Recognition: the Championship goes on for another Round.`);
    }
  }
  startRound(s, s.round + 1);
}

function startRound(s, round) {
  s.round = round;
  s.initiative = opponentOf(s.initiative);
  emit(s, 'breakfast', { round });
  log(s, `Round ${round} · Breakfast.`);
  if (round >= RULES.newLocationFrom && !s.championship) {
    moveLocations(s);
    if (s.phase === 'gameOver') return;
    if (s.locationCount + 1 >= RULES.championshipAs) placeLocation(s, CHAMPIONSHIP);
    else {
      const def = nextLocationDef(s);
      if (def) placeLocation(s, def);
      else { emit(s, 'locationWaits', { free: freeAtRight(s) }); log(s, 'No new Location fits the free spaces: it waits.'); }
    }
  }
  if (s.phase === 'gameOver') return;
  expireBuffs(s, 'breakfast');
  for (const who of PLAYERS) {
    const p = s.players[who];
    for (const { card } of pokemonOf(s, who)) card.spent = false;
    // Regenerate N: heals N at Breakfast.
    for (const { card, space } of pokemonOf(s, who)) if (kwSum(card, 'Regenerate')) heal(s, who, space, kwSum(card, 'Regenerate'));
    followRound(s, who);
    draw(s, who, RULES.drawPerRound);
    if (s.phase === 'gameOver') return;
    p.energy = Math.max(0, energyFor(round) - p.debt + p.bonusNext);
    if (p.debt) log(s, `${NAMES[who]}: ${p.debt} less Energy (Overexert).`);
    p.debt = 0;
    p.bonusNext = 0;
  }
  for (const who of PLAYERS) gainRecognition(s, who, RULES.passivePerRound, 'a new Round');
  if (s.phase === 'gameOver') return;
  s.phase = 'battle';
  s.turn = s.initiative;
  s.passesInARow = 0;
}

// The next Location: one whose width fits the free spaces at the right edge (none: it waits).
// From a test queue if one is set (the first that fits); else the widest that fits, at random
// among those, preferring ones not already on the board.
function nextLocationDef(s) {
  const free = freeAtRight(s);
  if (free <= 0) return null;
  if (s.locationQueue.length) {
    const i = s.locationQueue.findIndex((id) => locationDef(id).width <= free);
    return i < 0 ? null : locationDef(s.locationQueue.splice(i, 1)[0]);
  }
  // The widest that fits (so the board fills its 10 spaces and stays full), at random among them.
  const fits = LOCATIONS.filter((l) => l.width <= free);
  if (!fits.length) return null;
  const widest = Math.max(...fits.map((l) => l.width));
  const best = fits.filter((l) => l.width === widest);
  const fresh = best.filter((l) => !s.locations.some((x) => x.id === l.id));
  const pool = fresh.length ? fresh : best;
  return pool[Math.floor(nextRandom(s) * pool.length)];
}

// --- Events and the log -------------------------------------------------------------------------------
function emit(s, type, data = {}) { s.events.push({ type, ...data }); }
function log(s, line) { s.log.push(line); }

export { seriesDef, rewardText };
