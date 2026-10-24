// Small inline SVG icons in the brass-and-ink style. Original shapes only
// (no icon fonts, no copied Pokémon type symbols). Each takes the text colour
// (currentColor), so CSS decides brass, ink or cream.

const svg = (body, view = '0 0 24 24') => `<svg class="icon" viewBox="${view}" aria-hidden="true">${body}</svg>`;

const ICONS = {
  // Attack types
  physical: svg('<path d="M14.5 3l6.5 0 0 6.5-9 9-2.5-2.5 1.5-1.5-3-3-1.5 1.5L4 10.5z" fill="currentColor"/><path d="M5 15l4 4-2 2-4-4z" fill="currentColor"/>'),
  special: svg('<path d="M12 2l2.3 6.2L21 9l-5.2 4.1L17.5 20 12 16.4 6.5 20l1.7-6.9L3 9l6.7-.8z" fill="currentColor"/>'),
  // Strength types
  hitpoints: svg('<path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" fill="currentColor"/>'),
  defence: svg('<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="currentColor"/>'),
  specialDefence: svg('<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="currentColor"/><path d="M12 7l1.3 3.2 3.4.3-2.6 2.2.8 3.3L12 14.2 9.1 16l.8-3.3-2.6-2.2 3.4-.3z" fill="var(--icon-cut, #2a1a0c)"/>'),
  // Speed-Tiers: one, two or three chevrons
  slow: svg('<path d="M6 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  steady: svg('<path d="M4 6l6 6-6 6M11 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  swift: svg('<path d="M2 6l5 6-5 6M9 6l5 6-5 6M16 6l5 6-5 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  // Weather
  rain: svg('<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" fill="currentColor"/>'),
  sun: svg('<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5M4.6 4.6l2.5 2.5M16.9 16.9l2.5 2.5M4.6 19.4l2.5-2.5M16.9 7.1l2.5-2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  // Held Item: a satchel
  held: svg('<path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3.5" y="7" width="17" height="13" rx="2.5" fill="currentColor"/><rect x="10" y="10.5" width="4" height="3" rx="1" fill="var(--icon-cut, #2a1a0c)"/>'),
  // Costs and rewards
  energy: svg('<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z" fill="currentColor"/>'),
  dollar: svg('<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M15 8.5c-.6-1-1.7-1.5-3-1.5-1.8 0-3 .9-3 2.3 0 3.2 6 1.8 6 4.9 0 1.4-1.3 2.4-3.1 2.4-1.4 0-2.5-.6-3.1-1.6M12 5.5v13" fill="none" stroke="var(--icon-cut, #2a1a0c)" stroke-width="1.8" stroke-linecap="round"/>'),
  xp: svg('<path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.9 6.1 20l1.2-6.5L2.5 8.9 9.1 8z" fill="currentColor"/>'),
  discard: svg('<rect x="5" y="2.5" width="11" height="15" rx="1.8" fill="currentColor"/><path d="M18 12v8m-3-3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  release: svg('<rect x="5" y="2.5" width="11" height="15" rx="1.8" fill="currentColor"/><path d="M16 15l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  quest: svg('<path d="M6 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 4h11l-2.5 4L18 12H7z" fill="currentColor"/>'),
  power: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5v7l4 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  delivery: svg('<path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" fill="currentColor"/><circle cx="6" cy="17.5" r="2" fill="currentColor"/><circle cx="16.5" cy="17.5" r="2" fill="currentColor"/>'),
};

export function icon(name) {
  return ICONS[name] ?? '';
}

// The icon for a printed stat type.
export function statIcon(type) {
  return icon({
    Physical: 'physical', Special: 'special', Hitpoints: 'hitpoints', Defence: 'defence', 'Special Defence': 'specialDefence',
  }[type]);
}

export function speedIcon(tier) {
  return icon(tier.toLowerCase());
}

export function weatherIcon(type) {
  return icon(type === 'Sun' ? 'sun' : 'rain');
}

// Phase banners: Breakfast (sunrise), Battle (crossed swords), Supper (moon).
const PHASE_ICONS = {
  sunrise: svg('<path d="M3 17h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.5 17a5.5 5.5 0 0 1 11 0z" fill="currentColor"/><path d="M12 5v3M5.2 8.2l2 2M18.8 8.2l-2 2M2.5 13h2.5M19 13h2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 20.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>'),
  swords: svg('<path d="M4 3l9 9-2 2-9-9V3zM20 3h-2l-9 9 2 2 9-9z" fill="currentColor"/><path d="M6 16l2 2-3 3-2-2zM18 16l-2 2 3 3 2-2z" fill="currentColor"/><path d="M8.5 13.5l2 2M15.5 13.5l-2 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  moon: svg('<path d="M15.5 3a8.5 8.5 0 1 0 5.5 14.9A7 7 0 0 1 15.5 3z" fill="currentColor"/><circle cx="19" cy="6" r="1" fill="currentColor"/><circle cx="21" cy="10.5" r="0.7" fill="currentColor"/>'),
};

export function phaseIcon(name) {
  return PHASE_ICONS[name] ?? '';
}
