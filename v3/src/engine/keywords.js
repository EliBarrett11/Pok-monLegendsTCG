// Keywords on Pokémon (V3-1, from v1 and v2): Quick Attack (arrives Active), Infiltrator (its
// attacks ignore guards and the portrait's protection), Overrun (damage left over after a defeat
// goes to the enemy player), Rage (+1 Attack each time it survives damage), Shell N (each instance
// of damage is N less, at least 1), Regenerate N (heals N at Breakfast). Numbers add up.
export const kwSum = (card, name) => (card?.keywords ?? []).reduce((n, k) => n + (Number(new RegExp(`^${name} (\\d+)$`).exec(k)?.[1]) || 0), 0);
export const hasKw = (card, name) => (card?.keywords ?? []).some((k) => k === name || k.startsWith(`${name} `));
