// Innate Powers: keyword abilities on Pokémon that the rules check directly.
// The printed keywords are the card's `innatePower` text, e.g. "Overrun, Scorch 2";
// effects can grant more (card.granted: [{ key, amount?, thisRound? }]).
//
// Numbered keywords add up (Scorch 1 + Scorch 1 = Scorch 2). Keywords without
// a number don't stack: having one twice is the same as having it once.
//
//   Quick Attack   summoned Active instead of Spent
//   Agility        can't be chosen as a target by a Strategy Card (area effects still hit)
//   Scorch X       its attack's damage also applies Burn X to the target (if still in play)
//   Overrun        damage left over after its attack defeats a Pokémon hits the Trainer in that Zone
//   Regenerate X   heals X at Breakfast (with On Breakfast abilities)
//   Shell X        every instance of damage it takes is reduced by X, to a minimum of 1

export const NUMBERED = ['Scorch', 'Regenerate', 'Shell'];

// "Overrun, Scorch 2" → [{ key: 'Overrun' }, { key: 'Scorch', amount: 2 }]
export function parseKeywords(text) {
  if (!text) return [];
  return text.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^(.*?)\s+(\d+)$/);
    return m ? { key: m[1], amount: Number(m[2]) } : { key: part };
  });
}

// Every keyword the card has now: printed, plus granted.
export function keywordList(card) {
  return [...parseKeywords(card?.innatePower), ...(card?.granted ?? [])];
}

export function hasKeyword(card, key) {
  return keywordList(card).some((k) => k.key === key);
}

// The total of a numbered keyword (0 if it doesn't have it).
export function keywordAmount(card, key) {
  return keywordList(card).filter((k) => k.key === key).reduce((sum, k) => sum + (k.amount ?? 0), 0);
}

// The keywords as they read on the card now: numbered ones added up, the
// others once each, in the order they first appear.
export function keywordSummary(card) {
  const out = [];
  for (const k of keywordList(card)) {
    const had = out.find((o) => o.key === k.key);
    if (had) {
      if (NUMBERED.includes(k.key)) had.amount += k.amount ?? 0;
      continue;
    }
    out.push({ key: k.key, ...(NUMBERED.includes(k.key) ? { amount: k.amount ?? 0 } : {}) });
  }
  return out;
}

export function keywordLabel({ key, amount }) {
  return amount === undefined ? key : `${key} ${amount}`;
}

// What Shell does to one instance of damage: reduced by Shell X, to a minimum
// of 1 (no damage stays no damage).
export function afterShell(card, amount) {
  const shell = keywordAmount(card, 'Shell');
  if (amount <= 0 || !shell || card?.cardType === 'Trainer') return amount;
  return Math.max(1, amount - shell);
}
