// What one seat may see (rules sections 9.1 and 10). Pure: no DOM.
//
// viewFor(state, seat) is the game as that seat sees it, and redactEvents
// does the same for what the last action did. The screen is only ever given
// these (against the AI too), never the full state, so the online version
// can send them over the wire as they are.
//
// Hidden from the seat:
//   - the opponent's hand: its size and uids stay, the cards don't
//   - both Draw Piles: how many cards, not which or in what order
//   - the PokéMart deck: how many Items, not which or in what order (the 3 on sale show)
//   - the random-number state and seed (they would predict every shuffle)
//   - the opponent's secret choices (Trainer placement, mulligan, XP) until both lock in
//   - anything in the log or events that would give these away
// Everything else is public: both arenas, the Discard and Released Piles,
// the Bags, PokéDollars, XP, Energy, the PokéMart's 3 Items on sale, revealed cards.

import { PLAYERS, opponentOf, localize } from './board.js';

export const HIDDEN = Object.freeze({ hidden: true });

export function viewFor(state, seat) {
  if (!PLAYERS.includes(seat)) throw new Error(`No such seat: ${seat}`);
  const foe = opponentOf(seat);
  const { seed, rng, log, logSource, events, ...rest } = state;
  const v = structuredClone(rest);
  v.viewer = seat;

  // Cards the seat may not see, by uid: anything that turns up elsewhere
  // (on the stack, say) with one of these uids is blanked too.
  const secret = new Set([
    ...state.players[foe].hand.map((c) => c.uid),
    ...PLAYERS.flatMap((w) => state.players[w].drawPile.map((c) => c.uid)),
    ...state.mart.deck.map((c) => c.uid),
  ]);

  for (const who of PLAYERS) {
    const p = v.players[who];
    p.drawPile = p.drawPile.map(() => ({ ...HIDDEN }));
    if (who !== foe) continue;
    p.hand = p.hand.map((c) => ({ uid: c.uid, hidden: true }));
    // Locked in, but what they chose stays secret until both have.
    if (p.pending) p.pending = { locked: true };
    if (p.xpChoice) p.xpChoice = [];
  }
  v.mart.deck = v.mart.deck.map(() => ({ ...HIDDEN }));

  // A choice in progress: the opponent's shows only that they are choosing.
  if (v.pending?.who === foe) {
    const { who, kind, from, op, label, min, max } = v.pending;
    // (Only the fields it has: a view must survive being sent as JSON unchanged.)
    v.pending = Object.fromEntries(Object.entries({ who, kind, from, op, label, min, max, secret: true }).filter(([, x]) => x !== undefined));
  }
  blank(v, secret);
  // The seat's own Search: the matching cards it may choose from its Draw Pile.
  if (v.pending?.who === seat && v.pending.kind === 'pick' && v.pending.from === 'draw') {
    const pile = state.players[seat].drawPile;
    v.pending.cards = structuredClone(v.pending.options.map((uid) => pile.find((c) => c.uid === uid)).filter(Boolean));
  }

  v.log = logSource ? logSource.map((line) => localize(line, seat, state.names)) : seat === 'player' ? [...log] : [];
  v.events = redactEvents(events, seat, state.names);
  // Plain JSON (no undefined fields): the same before and after being sent to a friend.
  return JSON.parse(JSON.stringify(localizeAll(v, seat, state.names)));
}

// What the last action did, as the seat may see it.
export function redactEvents(events = [], seat, names) {
  const foe = opponentOf(seat);
  return (events ?? []).map((event) => {
    const e = structuredClone(event);
    const theirs = (e.who ?? e.owner) === foe;
    switch (e.type) {
      // Something done to a card in the opponent's hand: not which card.
      case 'retainGranted':
      case 'costReduced':
        if (theirs) delete e.name;
        break;
      // Searched from the Draw Pile into the opponent's hand: how many, not which.
      case 'searched':
        if (theirs) e.cards = e.cards.map(({ uid }) => ({ uid }));
        break;
      // XP on the opponent's Pokémon in hand: how much of each, not on which.
      case 'xpSpent':
        if (theirs) {
          const sum = (k) => e.parts.reduce((n, part) => n + part[k], 0);
          e.parts = [{ attack: sum('attack'), strength: sum('strength') }];
        }
        break;
      // A free summon they chose not to make: the card stays in their hand.
      case 'choiceMade':
        if (theirs && e.kind === 'freeSummon' && !e.summon) delete e.name;
        break;
      default:
    }
    hideHandRefs(e, foe);
    return JSON.parse(JSON.stringify(localizeAll(e, seat, names)));   // plain JSON, like viewFor
  });
}

// A card in the opponent's hand named anywhere in an event ({ kind: 'hand', owner, uid, name }).
function hideHandRefs(node, foe) {
  if (!node || typeof node !== 'object') return;
  if (node.kind === 'hand' && node.owner === foe) delete node.name;
  for (const value of Object.values(node)) hideHandRefs(value, foe);
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

// The log's seat words ("You", "your", secrets) in every string, for this seat.
function localizeAll(node, seat, names) {
  if (typeof node === 'string') return localize(node, seat, names);
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = localizeAll(node[i], seat, names);
  } else {
    for (const key of Object.keys(node)) node[key] = localizeAll(node[key], seat, names);
  }
  return node;
}
