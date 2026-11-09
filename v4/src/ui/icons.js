// v4's coded icons (inline SVG; no image files). Pure strings: no DOM use, so tests can import them.
// Adapted from v3/src/ui/icons.js. UX2: the five stat icons (paths copied from
// docs/design/v4-stat-icons.html), attackIcon / strengthIcon, type icons and the Speed chevrons from
// docs/design/v4-ux2-layout-mockup.html. The old Attack icon is retired.
const svg = (body, view = '0 0 24 24', style = '') => `<svg class="v4-ico" viewBox="${view}" aria-hidden="true"${style ? ` style="${style}"` : ''}>${body}</svg>`;

// --- The five stat icons -----------------------------------------------------------------------------
export const STAT_ICONS = {
  pa: svg('<path d="M4 15C6 10 9 6 15 3M8 19c2.5-5 6-9 12-12M12 22c2-4 5-7 9-9" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'),
  sa: svg('<path d="M12 1.5l2.4 8.1L22.5 12l-8.1 2.4L12 22.5l-2.4-8.1L1.5 12l8.1-2.4z" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/>'),
  hp: svg('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor"/>'),
  def: svg('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/><path d="M12 5v14" stroke="rgba(0,0,0,.45)" stroke-width="2"/>'),
  sdef: svg('<path d="M12 2l8.6 5v10L12 22l-8.6-5V7z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 7.5l1.4 3.1 3.1 1.4-3.1 1.4L12 16.5l-1.4-3.1L7.5 12l3.1-1.4z" fill="currentColor"/>'),
};
export const STAT_NAMES = { pa: 'Physical Attack', sa: 'Special Attack', hp: 'Hitpoints', def: 'Defence', sdef: 'Special Defence' };
// Which icon a Pokémon's Attack and Strength use.
export const attackKey = (card) => (card.attackType === 'Special' ? 'sa' : 'pa');
export const strengthKey = (card) => ({ Defence: 'def', 'Special Defence': 'sdef' }[card.strengthType] ?? 'hp');
const stat = (key) => `<span class="v4-stat c-${key}" title="${STAT_NAMES[key]}">${STAT_ICONS[key]}</span>`;
export const attackIcon = (card) => stat(attackKey(card));
export const strengthIcon = (card) => stat(strengthKey(card));

// --- Other icons -----------------------------------------------------------------------------------------
export const ICONS = {
  strength: STAT_ICONS.hp,
  energy: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="currentColor"/>'),
  trophy: svg('<path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H3c0 3 2 5 4 5M17 5h4c0 3-2 5-4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 12h2v4h3v3H8v-3h3z" fill="currentColor"/>'),
  medal: svg('<circle cx="12" cy="14" r="6" fill="currentColor"/><path d="M8 2l4 7 4-7" fill="none" stroke="currentColor" stroke-width="2"/>'),
  card: svg('<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>'),
};
export const icon = (name) => ICONS[name] ?? '';

// Pokémon types: a small coloured icon (from the mockup).
const TYPE_ICONS = {
  Fire: svg('<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 0-6 0-9z" fill="#fff"/>'),
  Water: svg('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" fill="#fff"/>'),
  Electric: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="#2a1a0c"/>'),
};
export const typeIcon = (type) => `<span class="v4-type t-${String(type).toLowerCase()}" title="${type}">${TYPE_ICONS[type] ?? ''}</span>`;

// Speed-Tiers: one, two or three chevrons (Slow, Steady, Swift).
const chevrons = (n) => svg(Array.from({ length: n }, (_, k) => `<path d="M${3 + k * 6} 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`).join(''), `0 0 ${6 + n * 6} 24`, `width: ${(6 + n * 6) / 24}em`);
export const SPEED_ICONS = { Slow: chevrons(1), Steady: chevrons(2), Swift: chevrons(3) };
export const speedIcon = (speed) => `<span class="v4-speed s-${speed.toLowerCase()}" title="${speed}">${SPEED_ICONS[speed]}</span>`;
