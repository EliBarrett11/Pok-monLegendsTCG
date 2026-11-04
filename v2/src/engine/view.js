// What one seat may see (V9; docs/rules.md section 10, which v2 follows). Pure: no DOM.
//
// viewFor(state, seat) is the match as that seat sees it, and redactEvents does the same for
// what the last action did. The screen is only ever given these (against the AI too, in
// hot-seat, and online, where the guest is sent nothing else).
//
// Hidden from the seat:
//   - the opponent's hand: how many cards (and their opaque uids), not which;
//   - both Draw Piles: how many cards, not which or in what order (the seat's own Search
//     sees only the cards it could take: `searchable`);
//   - the shared Item pool: how many Items, not which or in what order;
//   - the random-number state and seed (they would predict every shuffle);
//   - the opponent's Trainer Point assignment until both have locked in (then it resolves);
//   - which cards an opponent's Search or Tracey took, or Tracey revealed (counts only), the card a Retain was
//     granted to, and a card in their hand levelling up;
//   - anything in the log or events that would give these away.
// Everything else is public: both rows, Locations, Trainers, the Discard and Released Piles,
// the Bags, Energy, Growth, Recognition, Trainer Points, played and revealed cards.
import { PLAYERS, opponentOf, localize, pickOptions, choiceCards } from './game.js';

export const HIDDEN = Object.freeze({ hidden: true });

export function viewFor(state, seat) {
  if (!PLAYERS.includes(seat)) throw new Error(`No such seat: ${seat}`);
  const foe = opponentOf(seat);
  const { seed, rng, log, events, ...rest } = state;
  const v = structuredClone(rest);
  v.viewer = seat;
  // Cards the seat may not see, by uid: anything elsewhere carrying one of these is blanked too.
  const secret = new Set([
    ...state.players[foe].hand.map((c) => c.uid),
    ...PLAYERS.flatMap((w) => state.players[w].drawPile.map((c) => c.uid)),
    ...state.itemPool.map((c) => c.uid),
  ]);
  for (const who of PLAYERS) {
    const p = v.players[who];
    p.drawPile = p.drawPile.map(() => ({ ...HIDDEN }));
    delete p.reshuffles;
    if (who === foe) p.hand = p.hand.map((c) => ({ uid: c.uid, hidden: true }));
  }
  v.itemPool = v.itemPool.map(() => ({ ...HIDDEN }));
  // The simultaneous Trainer Point step: only that the opponent has locked in.
  if (v.assign && v.assign[foe]) v.assign[foe] = { locked: true };
  blank(v, secret);
  // A waiting Tracey (Feedback B): the revealed cards, for their player only.
  for (const [i, c] of (state.choices ?? []).entries()) if (c.kind === 'pick' && c.who === seat) v.choices[i].cards = structuredClone(choiceCards(state, c));
  // The seat's own Search: the cards it could take from its Draw Pile (no order: by name).
  const searchable = searchMatches(state, seat);
  if (searchable.length) v.players[seat].searchable = searchable;
  v.log = log.map((line) => localize(line, seat));
  v.events = redactEvents(events, seat);
  // Plain JSON (no undefined fields): the same before and after being sent to a friend.
  return JSON.parse(JSON.stringify(localizeAll(v, seat)));
}

// What the last action did, as the seat may see it.
export function redactEvents(events = [], seat) {
  const foe = opponentOf(seat);
  // A card in the opponent's hand levelling up (at Breakfast): not shown at all (even its
  // Level would hint at which card it is).
  return (events ?? []).filter((e) => !(e.type === 'levelUp' && e.who === foe)).map((event) => {
    const e = structuredClone(event);
    const theirs = e.who === foe;
    switch (e.type) {
      // Searched from the Draw Pile into the opponent's hand: how many, not which.
      case 'searched':
      case 'picked':
        if (theirs) delete e.cards;
        break;
      default:
    }
    return JSON.parse(JSON.stringify(localizeAll(e, seat)));
  });
}

// The cards the seat's own Search could take: every card in its Draw Pile matching a Search
// on a card in its hand (Supporters, their Favours, Strategy breakpoints) or a Trainer's Ability.
function searchMatches(state, seat) {
  const p = state.players[seat];
  const ops = [];
  const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.op === 'search') ops.push(node);
    for (const value of Object.values(node)) collect(value);
  };
  for (const card of [...p.hand, ...p.trainers]) collect(card);
  const found = new Map();
  for (const op of ops) for (const c of pickOptions(state, seat, op)) found.set(c.uid, c);
  return structuredClone([...found.values()].sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id))));
}

// Any card object with a secret uid becomes { uid, hidden }.
function blank(node, secret) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && secret.has(value.uid) && value.name !== undefined) {
      node[key] = { uid: value.uid, hidden: true };
    } else blank(value, secret);
  }
}

// Seat tokens (⟨seat|mine|theirs⟩) in every string, for this seat.
function localizeAll(node, seat) {
  if (typeof node === 'string') return localize(node, seat);
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = localizeAll(node[i], seat);
  } else {
    for (const key of Object.keys(node)) node[key] = localizeAll(node[key], seat);
  }
  return node;
}
