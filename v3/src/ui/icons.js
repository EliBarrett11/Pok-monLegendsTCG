// v3's icons: all coded (inline SVG), none from image files.
const svg = (body, view = '0 0 24 24') => `<svg class="v3-ico" viewBox="${view}" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  attack: svg('<path d="M5 19L17 7M17 7l2-4-4 2zM4 16l4 4M6 14l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  strength: svg('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor"/>'),
  energy: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="currentColor"/>'),
  trophy: svg('<path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H3c0 3 2 5 4 5M17 5h4c0 3-2 5-4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 12h2v4h3v3H8v-3h3z" fill="currentColor"/>'),
  medal: svg('<circle cx="12" cy="14" r="6" fill="currentColor"/><path d="M8 2l4 7 4-7" fill="none" stroke="currentColor" stroke-width="2"/>'),
  guard: svg('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/>'),
  card: svg('<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>'),
};
// Speed-Tiers: one, two or three chevrons (Slow, Steady, Swift).
const chevrons = (n) => svg(Array.from({ length: n }, (_, i) => `<path d="M${3 + i * 6} 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`).join(''), '0 0 24 24');
export const SPEED_ICONS = { Slow: chevrons(1), Steady: chevrons(2), Swift: chevrons(3) };
export const icon = (name) => ICONS[name] ?? '';
export const speedIcon = (speed) => `<span class="v3-speed s-${speed.toLowerCase()}" title="${speed}">${SPEED_ICONS[speed]}</span>`;
