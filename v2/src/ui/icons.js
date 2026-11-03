// v2's icons (V7a, docs/v2-design.md 7c): coded SVG icons only, never the current game's
// icon images. Every Type has one (Ghost and Dragon included), plus Energy, Attack and
// Strength types, Speed, Rarity, Weather, statuses, Trainer Points, Growth, Recognition,
// the Round timer and the Legendary mark. They're drawn on a 24×24 grid and sized by CSS
// (.v2-ico, 1em by default), in the approved warm, brass-trimmed style.

const svg = (name, body, extra = '') => `<svg class="v2-ico v2-ico-${name}" viewBox="0 0 24 24" aria-hidden="true"${extra}>${body}</svg>`;

// The glyphs (white on a coloured disc for Types; their own colours elsewhere).
const GLYPHS = {
  fire: '<path d="M12 3c1 3.2 4.6 4.8 4.6 9.2A4.6 4.6 0 0 1 7.4 12.2c0-2 1-3.3 2-4.3-.1 1.8.7 3 1.8 3.4C11 8.8 11.2 5.6 12 3z"/>',
  water: '<path d="M12 3.2c2.8 4 5.2 6.8 5.2 10a5.2 5.2 0 0 1-10.4 0c0-3.2 2.4-6 5.2-10z"/>',
  grass: '<path d="M18.6 5.2C11 5 6.4 8.8 6.4 14.2c0 1.4.4 2.6 1 3.6l-1.6 2 1.2.9 1.6-1.9c1 .7 2.2 1 3.5 1 5 0 7.6-4.8 6.5-14.6zM9.4 16.6c1.6-3 3.7-5.2 6.4-6.8-2.2 2-3.9 4.3-5.2 7.2z"/>',
  electric: '<path d="M13.6 2.8 6.2 13.4h4.6L9.6 21.2l8.2-11.2h-4.9l.7-7.2z"/>',
  normal: '<circle cx="12" cy="12" r="5.6" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="12" cy="12" r="1.8"/>',
  fighting: '<path d="M8 9.2c0-1 .8-1.7 1.7-1.7h6.1c1.2 0 2.2 1 2.2 2.2v3.5c0 3-2.4 5.4-5.4 5.4H11c-1.7 0-3-1.3-3-3V9.2zM8.4 5.8h2.2v2.4H8.4zm3 0h2.2v2.4h-2.2zm3 0h2.2v2.4h-2.2z"/>',
  dark: '<path d="M15.4 4.2a7.8 7.8 0 1 0 4.4 12.6 6.4 6.4 0 0 1-4.4-12.6z"/>',
  rock: '<path d="M7.4 6.2h7.4l4 4.6-1.8 7H6.4L4.6 11.4z"/><path d="M7.4 6.2 10 11.4h4.8l4-.6M10 11.4l-3.6 6.4" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>',
  bug: '<ellipse cx="12" cy="13.6" rx="4.6" ry="5.6"/><path d="M12 8.2v11" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><path d="M9.6 8.6 7.2 5.2M14.4 8.6l2.4-3.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  ghost: '<path d="M12 3.6a6.2 6.2 0 0 0-6.2 6.2v9.6l2.1-1.6 2 1.6 2.1-1.6 2.1 1.6 2-1.6 2.1 1.6V9.8A6.2 6.2 0 0 0 12 3.6z"/><circle cx="9.8" cy="10.6" r="1.3" fill="#3a2a5a"/><circle cx="14.2" cy="10.6" r="1.3" fill="#3a2a5a"/>',
  dragon: '<path d="M5 18.8c1.8-6.4 5.8-11 12.6-13.8-1.6 2.2-2.4 4.2-2.4 6.2 1.4-.8 2.8-1.1 4.2-1-2.8 2-4.2 4.4-4.6 7.6-1.6-1.2-3.4-1.6-5.4-1.2-1.6.4-3 1.1-4.4 2.2z"/>',
};

export const TYPE_COLOURS = {
  Fire: '#e8622a', Water: '#2f86d8', Grass: '#4ca83a', Electric: '#e8b820', Normal: '#a0927a', Fighting: '#b8442e',
  Dark: '#4e3a48', Rock: '#9a8040', Bug: '#8ea42a', Ghost: '#6a52a6', Dragon: '#5a52c8',
};

// A Type: its glyph on a disc of its colour, with a brass rim.
export function typeIcon(type, cls = '') {
  const glyph = GLYPHS[String(type).toLowerCase()] ?? GLYPHS.normal;
  return `<span class="v2-typeicon ${cls}" title="${type}" style="--t: ${TYPE_COLOURS[type] ?? '#888'}">${svg(`type-${String(type).toLowerCase()}`, `<g fill="#fff">${glyph}</g>`)}</span>`;
}

const ICONS = {
  // Energy: a bolt in a blue gem.
  energy: '<path d="M12 2.6 20.4 7.4v9.2L12 21.4 3.6 16.6V7.4z" fill="#2a6fc0" stroke="#bfe4ff" stroke-width="1.2"/><path d="M13.2 5.6 8.4 13h3.2l-.8 5.4 5-7.6h-3.3z" fill="#fff"/>',
  // Attack: Physical a blade, Special a burst.
  physical: '<path d="M18.8 3.6 20.4 5.2 11 14.6l-1.6-1.6z" fill="#f0e6d0"/><path d="M8.2 12.2l3.6 3.6-1.4 1.4-1.1-1.1-3 3-1.4-1.4 3-3-1.1-1.1z" fill="#c99a48"/>',
  special: '<path d="M12 2.8l1.9 5.6 5.9.2-4.7 3.6 1.7 5.7L12 14.6l-4.8 3.3 1.7-5.7-4.7-3.6 5.9-.2z" fill="#f2d070"/><circle cx="12" cy="11.4" r="2.4" fill="#fff8d8"/>',
  // Strength: Hitpoints a heart, Defence a shield, Special Defence a shield with a star.
  hitpoints: '<path d="M12 20.2 4.6 12.8A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.4 5.8z" fill="#e85a5a"/>',
  defence: '<path d="M12 2.8 19.4 5.6v5.6c0 4.6-3.2 8.4-7.4 10-4.2-1.6-7.4-5.4-7.4-10V5.6z" fill="#5a86c8" stroke="#d8e8ff" stroke-width="1.1"/>',
  specialDefence: '<path d="M12 2.8 19.4 5.6v5.6c0 4.6-3.2 8.4-7.4 10-4.2-1.6-7.4-5.4-7.4-10V5.6z" fill="#8a5ac8" stroke="#ead8ff" stroke-width="1.1"/><path d="M12 7.4l1.2 2.7 2.9.3-2.2 1.9.7 2.9-2.6-1.6-2.6 1.6.7-2.9-2.2-1.9 2.9-.3z" fill="#fff"/>',
  // Speed: one, two or three chevrons.
  slow: '<path d="M9 6.4 14.6 12 9 17.6" fill="none" stroke="#f0e6d0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  steady: '<path d="M6 6.4 11.6 12 6 17.6M12 6.4l5.6 5.6-5.6 5.6" fill="none" stroke="#f0e6d0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  swift: '<path d="M3.2 6.6 8.6 12l-5.4 5.4M9.2 6.6l5.4 5.4-5.4 5.4M15.2 6.6l5.4 5.4-5.4 5.4" fill="none" stroke="#ffe08a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  // Rarity: a stone, a gem, a cut jewel, a crown.
  common: '<circle cx="12" cy="12" r="6" fill="#b8b0a0" stroke="#efe6d4" stroke-width="1.2"/>',
  rare: '<path d="M12 4.4 18.6 12 12 19.6 5.4 12z" fill="#4a9ae8" stroke="#d8ecff" stroke-width="1.2"/>',
  epic: '<path d="M7.4 5.2h9.2l3 4.2L12 19.6 4.4 9.4z" fill="#a35ae0" stroke="#efd8ff" stroke-width="1.1"/><path d="M4.4 9.4h15.2M12 19.6 9.6 9.4 12 5.2l2.4 4.2z" fill="none" stroke="#efd8ff" stroke-width=".9"/>',
  legendary: '<path d="M4 17.6 5.2 7.6l4.2 4L12 5.2l2.6 6.4 4.2-4L20 17.6z" fill="#f2c75a" stroke="#fff3c4" stroke-width="1.1"/><rect x="4" y="18" width="16" height="2.4" rx="1" fill="#c99a48"/>',
  // Weather.
  rain: '<path d="M7 14.2a4 4 0 0 1-.2-8A5.2 5.2 0 0 1 16.8 7a3.6 3.6 0 0 1 .6 7.2z" fill="#d8e6f4"/><path d="M8.4 16.4 7.4 19.4M12.2 16.4l-1 3M16 16.4l-1 3" stroke="#5aaee8" stroke-width="1.8" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="4.4" fill="#ffc83a"/><g stroke="#ffa82a" stroke-width="2" stroke-linecap="round"><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/></g>',
  // Statuses.
  burn: '<path d="M12 3c1 3.2 4.6 4.8 4.6 9.2A4.6 4.6 0 0 1 7.4 12.2c0-2 1-3.3 2-4.3-.1 1.8.7 3 1.8 3.4C11 8.8 11.2 5.6 12 3z" fill="#ff7a2a"/><path d="M12 11.4c.6 1.6 2.2 2.4 2.2 4.2a2.2 2.2 0 0 1-4.4 0c0-1 .6-1.6 1-2 0 .8.4 1.2.8 1.4.2-1.2.2-2.4.4-3.6z" fill="#ffe08a"/>',
  sleep: '<path d="M5 8.6h5.4L5 15.4h5.4M13.4 5h4.4l-4.4 5.6h4.4" fill="none" stroke="#c8d8ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  seed: '<path d="M12 20.6v-7.4" stroke="#8fe06a" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13.4c-4.6 0-6.4-2.6-6.4-6.4 4 0 6.4 1.8 6.4 6.4zM12 15.2c0-4 2-6 5.8-6 0 3.6-2 6-5.8 6z" fill="#6cc04a"/>',
  // Trainer Points, Growth, Recognition, the Round timer.
  star: '<path d="M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z" fill="#f2c75a" stroke="#fff3c4" stroke-width=".9"/>',
  growth: '<path d="M12 21v-9.4" stroke="#8fe06a" stroke-width="2" stroke-linecap="round"/><path d="M12 12c-5.4 0-7.6-3-7.6-7.6 4.8 0 7.6 2.2 7.6 7.6zM12 14c0-4.8 2.4-7.2 7-7.2 0 4.4-2.4 7.2-7 7.2z" fill="#6cc04a" stroke="#d8ffb8" stroke-width=".8"/>',
  recognition: '<path d="M7.6 4.4h8.8v3.4a4.4 4.4 0 0 1-8.8 0z" fill="#f2c75a"/><path d="M7.6 5.6H4.8c0 2.6 1.4 4.2 3.4 4.6M16.4 5.6h2.8c0 2.6-1.4 4.2-3.4 4.6" fill="none" stroke="#f2c75a" stroke-width="1.4"/><path d="M10.8 12.2h2.4v3.6h2.6v2.4H8.2v-2.4h2.6z" fill="#c99a48"/>',
  timer: '<path d="M6.8 3.6h10.4M6.8 20.4h10.4M7.8 3.6c0 4.2 4.2 5.6 4.2 8.4s-4.2 4.2-4.2 8.4M16.2 3.6c0 4.2-4.2 5.6-4.2 8.4s4.2 4.2 4.2 8.4" fill="none" stroke="#5a3a14" stroke-width="1.7" stroke-linecap="round"/><path d="M9.4 18.6c.8-1.6 1.8-2.2 2.6-2.4.8.2 1.8.8 2.6 2.4z" fill="#5a3a14"/>',
};

export function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) throw new Error(`No icon "${name}"`);
  return svg(name, body, cls ? ` data-cls="${cls}"` : '');
}

// By what a card says: its Attack type, Strength type, Speed, Rarity, Weather kind.
export const attackIcon = (t) => icon(t === 'Physical' ? 'physical' : 'special');
export const strengthIcon = (t) => icon(t === 'Defence' ? 'defence' : t === 'Special Defence' ? 'specialDefence' : 'hitpoints');
export const speedIcon = (t) => icon(String(t).toLowerCase());
export const rarityIcon = (r) => icon(String(r).toLowerCase());
export const weatherIcon = (w) => icon(String(w).toLowerCase());
export const ICON_NAMES = Object.keys(ICONS);
export const TYPE_GLYPHS = Object.keys(GLYPHS);
