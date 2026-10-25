// Vector medallions for card faces, from the card design mockup (docs/design/icons.js).
// They are the fallback for any icon without a WebP file in assets/ui/icons/.
// Every icon is an SVG string built from gradients and paths, in a 100x100 box.

let uid = 0;
const id = (p) => `${p}${++uid}`;

// ---- Energy crystal -------------------------------------------------------
export function energyCrystal() {
  const g1 = id('cg'), g2 = id('cg'), g3 = id('cg'), gl = id('glow');
  return `<svg viewBox="0 0 100 100">
  <defs>
    <radialGradient id="${gl}"><stop offset="0" stop-color="#7fd4ff" stop-opacity=".9"/><stop offset="1" stop-color="#1a6dff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${g1}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8fbff"/><stop offset=".45" stop-color="#5fc0ff"/><stop offset="1" stop-color="#0d3f9e"/></linearGradient>
    <linearGradient id="${g2}" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa4ff"/><stop offset="1" stop-color="#06204f"/></linearGradient>
    <linearGradient id="${g3}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8fd8ff"/></linearGradient>
  </defs>
  <circle cx="50" cy="52" r="48" fill="url(#${gl})"/>
  <g stroke="#0a2a66" stroke-width="1.2" stroke-linejoin="round">
    <polygon points="50,2 84,22 84,72 50,98 16,72 16,22" fill="url(#${g2})"/>
    <polygon points="50,2 16,22 16,72 50,98 50,40" fill="url(#${g1})"/>
    <polygon points="50,2 84,22 50,40" fill="url(#${g3})" opacity=".9"/>
    <polygon points="50,2 16,22 50,40" fill="#ffffff" opacity=".85"/>
    <polygon points="16,72 50,98 50,76" fill="#123f8f" opacity=".7"/>
    <polygon points="84,72 50,98 50,76" fill="#061a40" opacity=".8"/>
  </g>
  <path d="M26 28 L42 18 L32 46 Z" fill="#fff" opacity=".75"/>
  <circle cx="64" cy="30" r="2.2" fill="#fff"/><circle cx="30" cy="62" r="1.4" fill="#fff" opacity=".8"/>
  <polygon points="50,2 84,22 84,72 50,98 16,72 16,22" fill="none" stroke="#d6ad5c" stroke-width="3"/>
</svg>`;
}

// ---- Type medallions ------------------------------------------------------
export const TYPES = {
  Normal:   ['#d8d3c4', '#7d7766'], Fire: ['#ffb05a', '#c2340f'], Water: ['#7cc8ff', '#1554b8'],
  Grass:    ['#a6e07a', '#2f7d2a'], Electric: ['#ffe36a', '#c99000'], Ice: ['#c8f4ff', '#3aa3c9'],
  Fighting: ['#f0866a', '#8f2412'], Poison: ['#d590f0', '#6a2a8f'], Ground: ['#f0cf8a', '#8f6420'],
  Flying:   ['#c4d6ff', '#5a72c9'], Psychic: ['#ff9ac8', '#c2265f'], Bug: ['#cfe26a', '#6f8a14'],
  Rock:     ['#d9c48a', '#7a6428'], Ghost: ['#a99ae0', '#3e3488'], Dragon: ['#9c8cff', '#3a20b8'],
  Dark:     ['#9a8a80', '#2e2622'], Steel: ['#d6e0ea', '#5f7488'], Fairy: ['#ffc4e6', '#d4609c'],
};

const W = 'fill="#fff"';
const GLYPH = {
  Normal: `<circle cx="50" cy="50" r="20" fill="none" stroke="#fff" stroke-width="7"/><circle cx="50" cy="50" r="6" ${W}/>`,
  Fire: `<path ${W} d="M50 14 C58 30 74 38 72 58 C71 74 61 84 50 84 C37 84 28 74 28 61 C28 50 34 43 40 36 C40 46 44 52 50 54 C46 42 44 28 50 14 Z"/>
         <path fill="#ffd27a" d="M50 46 C54 56 62 60 61 70 C60 77 55 81 50 81 C44 81 39 76 40 69 C41 62 46 58 50 46 Z"/>`,
  Water: `<path ${W} d="M50 13 C61 32 72 45 72 60 C72 73 62 84 50 84 C38 84 28 73 28 60 C28 45 39 32 50 13 Z"/>
          <path d="M38 62 C38 70 44 76 52 76" fill="none" stroke="#7cc8ff" stroke-width="4.5" stroke-linecap="round"/>`,
  Grass: `<path ${W} d="M24 76 C24 44 46 24 78 22 C78 54 60 76 26 78 Z"/><path d="M28 74 L68 32 M44 58 L44 46 M54 48 L58 40 M40 64 L30 62" stroke="#2f7d2a" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  Electric: `<path ${W} d="M58 12 L28 54 H47 L40 88 L72 42 H53 Z"/>`,
  Ice: `<g stroke="#fff" stroke-width="5.5" stroke-linecap="round" fill="none">
        <path d="M50 16 V84 M20.6 33 L79.4 67 M20.6 67 L79.4 33"/>
        <path d="M42 22 L50 30 L58 22 M42 78 L50 70 L58 78 M24 44 L34 41 L30 31 M76 56 L66 59 L70 69 M24 56 L34 59 L30 69 M76 44 L66 41 L70 31"/></g>`,
  Fighting: `<g ${W}><rect x="28" y="42" width="44" height="34" rx="9"/><circle cx="34" cy="40" r="7.5"/><circle cx="45" cy="36" r="8"/><circle cx="56" cy="36" r="8"/><circle cx="66" cy="40" r="7.5"/>
             <path d="M26 54 C18 54 18 68 28 68 L40 64 Z"/></g><path d="M40 44 V52 M51 42 V50 M61 44 V52" stroke="#8f2412" stroke-width="2.5" stroke-linecap="round"/>`,
  Poison: `<g ${W}><circle cx="46" cy="62" r="20"/><circle cx="66" cy="38" r="9"/><circle cx="42" cy="26" r="6"/><circle cx="60" cy="18" r="4"/></g>
           <circle cx="40" cy="56" r="5" fill="#d590f0"/><circle cx="54" cy="68" r="3.5" fill="#d590f0"/>`,
  Ground: `<path ${W} d="M14 76 L40 34 L52 52 L64 38 L86 76 Z"/><path d="M26 64 H74 M20 70 H80" stroke="#8f6420" stroke-width="3" stroke-linecap="round"/>`,
  Flying: `<path ${W} d="M18 66 C30 40 54 24 84 24 C78 32 70 36 62 38 C70 40 74 44 76 48 C66 48 58 50 52 54 C58 56 62 60 62 64 C48 64 34 66 18 66 Z"/>
           <path d="M26 62 C38 52 52 44 70 36" stroke="#5a72c9" stroke-width="2.5" fill="none"/>`,
  Psychic: `<path ${W} d="M12 50 C24 30 38 22 50 22 C62 22 76 30 88 50 C76 70 62 78 50 78 C38 78 24 70 12 50 Z"/>
            <circle cx="50" cy="50" r="15" fill="#c2265f"/><path d="M50 50 m0 -9 a9 9 0 1 1 -9 9 a6 6 0 1 1 6 6 a3 3 0 1 1 -3 -3" fill="none" stroke="#fff" stroke-width="2.5"/>`,
  Bug: `<g ${W}><ellipse cx="50" cy="56" rx="20" ry="26"/><circle cx="50" cy="28" r="9"/></g>
        <path d="M50 32 V82" stroke="#6f8a14" stroke-width="3"/><g stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none">
        <path d="M45 21 L36 10 M55 21 L64 10 M30 48 L18 42 M30 60 L16 62 M32 72 L20 80 M70 48 L82 42 M70 60 L84 62 M68 72 L80 80"/></g>`,
  Rock: `<path ${W} d="M20 64 L30 32 L54 18 L78 34 L84 60 L62 82 L34 80 Z"/><path d="M30 32 L46 46 L54 18 M46 46 L78 34 M46 46 L62 82 M46 46 L20 64" stroke="#7a6428" stroke-width="2.5" fill="none"/>`,
  Ghost: `<path ${W} d="M28 82 V48 C28 31 38 18 50 18 C62 18 72 31 72 48 V82 L64 74 L57 82 L50 74 L43 82 L36 74 Z"/>
          <ellipse cx="42" cy="46" rx="5" ry="7" fill="#3e3488"/><ellipse cx="58" cy="46" rx="5" ry="7" fill="#3e3488"/>`,
  Dragon: `<path ${W} d="M50 12 C60 26 74 32 86 30 C80 44 72 54 62 58 L70 86 L50 70 L30 86 L38 58 C28 54 20 44 14 30 C26 32 40 26 50 12 Z"/>
           <path d="M50 30 V62 M40 44 L50 52 L60 44" stroke="#3a20b8" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  Dark: `<path ${W} d="M60 14 A36 36 0 1 0 84 66 A28 28 0 1 1 60 14 Z"/><circle cx="72" cy="30" r="3" ${W}/><circle cx="80" cy="44" r="2" ${W}/>`,
  Steel: `<path ${W} d="M50 14 L81 32 V68 L50 86 L19 68 V32 Z"/><circle cx="50" cy="50" r="14" fill="#5f7488"/><circle cx="50" cy="50" r="8" fill="#d6e0ea"/>`,
  Fairy: `<path ${W} d="M50 12 C53 38 62 47 88 50 C62 53 53 62 50 88 C47 62 38 53 12 50 C38 47 47 38 50 12 Z"/>
          <path ${W} d="M76 18 C77 25 79 27 86 28 C79 29 77 31 76 38 C75 31 73 29 66 28 C73 27 75 25 76 18 Z"/>`,
};

export function typeMedallion(type) {
  const [hi, lo] = TYPES[type], g = id('tg'), s = id('ts');
  return `<svg viewBox="0 0 100 100">
  <defs>
    <radialGradient id="${g}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
    <filter id="${s}"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <circle cx="50" cy="50" r="47" fill="#3a2608"/>
  <circle cx="50" cy="50" r="45" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
  <g transform="translate(50 50) scale(.72) translate(-50 -50)" filter="url(#${s})">${GLYPH[type]}</g>
  <ellipse cx="40" cy="24" rx="22" ry="9" fill="#fff" opacity=".28"/>
</svg>`;
}

// ---- Rarity gems (original, shape + colour per tier) ----------------------
export function rarityGem(tier) {
  const g = id('rg'), gl = id('rgl');
  const spec = {
    Common:    { c: ['#ffe2b8', '#c47a3a', '#5a2c0c'], shape: 'circle' },
    Rare:      { c: ['#d8ecff', '#2f7de0', '#0a2a66'], shape: 'diamond' },
    Epic:      { c: ['#f3d6ff', '#a24ae0', '#3a0e66'], shape: 'hex' },
    Legendary: { c: ['#fffbe0', '#ffb51a', '#a84a00'], shape: 'star' },
  }[tier];
  const [a, b, c] = spec.c;
  const body = {
    circle: `<circle cx="50" cy="50" r="30" fill="url(#${g})" stroke="#d6ad5c" stroke-width="5"/>
             <path d="M30 46 A22 22 0 0 1 58 24" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`,
    diamond: `<polygon points="50,12 86,50 50,88 14,50" fill="url(#${g})" stroke="#d6ad5c" stroke-width="5" stroke-linejoin="round"/>
              <polygon points="50,12 86,50 50,50" fill="#fff" opacity=".18"/><polygon points="50,12 14,50 50,50" fill="#fff" opacity=".45"/>
              <polygon points="14,50 50,88 50,50" fill="#000" opacity=".12"/>`,
    hex: `<polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="url(#${g})" stroke="#d6ad5c" stroke-width="5" stroke-linejoin="round"/>
          <polygon points="50,28 68,38 68,62 50,72 32,62 32,38" fill="#fff" opacity=".22"/>
          <polygon points="50,10 15,30 32,38 50,28" fill="#fff" opacity=".5"/>`,
    star: `<polygon points="50,4 60,36 94,36 66,56 77,90 50,70 23,90 34,56 6,36 40,36" fill="url(#${g})" stroke="#fff3c4" stroke-width="3.5" stroke-linejoin="round"/>
           <polygon points="50,4 60,36 50,50 40,36" fill="#fff" opacity=".55"/>
           <circle cx="50" cy="50" r="7" fill="#fff" opacity=".85"/>`,
  }[spec.shape];
  return `<svg viewBox="0 0 100 100" ${tier === 'Legendary' ? 'class="legend-glow"' : ''}>
  <defs>
    <radialGradient id="${g}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>
    <radialGradient id="${gl}"><stop offset="0" stop-color="${b}" stop-opacity=".7"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>
  </defs>
  ${tier === 'Legendary' ? `<circle cx="50" cy="50" r="50" fill="url(#${gl})"/>` : ''}
  ${body}
</svg>`;
}

// ---- Stat badges: the badge's shape says the stat type ------------------
export function statBadge(kind) {
  const g = id('sg'), m = id('sm');
  const metal = `<linearGradient id="${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#b9c2cc"/><stop offset="1" stop-color="#5d6773"/></linearGradient>`;
  switch (kind) {
    case 'Physical': // crossed swords over an ember disc
      return `<svg viewBox="0 0 100 100"><defs>${metal}
        <radialGradient id="${g}" cx=".4" cy=".35"><stop offset="0" stop-color="#ffb070"/><stop offset=".6" stop-color="#d0461c"/><stop offset="1" stop-color="#6a1606"/></radialGradient></defs>
        <g stroke="#2b1708" stroke-width="1.5" stroke-linejoin="round">
          <g transform="rotate(45 50 50)"><path d="M43 -6 L50 -14 L57 -6 L57 66 L43 66 Z" fill="url(#${m})"/><path d="M50 -10 V64" stroke="#5d6773" stroke-width="1.5"/><rect x="32" y="64" width="36" height="9" rx="3" fill="#d6ad5c"/><rect x="45" y="73" width="10" height="20" rx="2" fill="#6a3c14"/><circle cx="50" cy="97" r="6" fill="#d6ad5c"/></g>
          <g transform="rotate(-45 50 50)"><path d="M43 -6 L50 -14 L57 -6 L57 66 L43 66 Z" fill="url(#${m})"/><path d="M50 -10 V64" stroke="#5d6773" stroke-width="1.5"/><rect x="32" y="64" width="36" height="9" rx="3" fill="#d6ad5c"/><rect x="45" y="73" width="10" height="20" rx="2" fill="#6a3c14"/><circle cx="50" cy="97" r="6" fill="#d6ad5c"/></g>
        </g>
        <circle cx="50" cy="50" r="27" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4"/>
        <ellipse cx="44" cy="36" rx="16" ry="6" fill="#fff" opacity=".25"/></svg>`;
    case 'Special': // radiant energy orb with 8-point burst
      return `<svg viewBox="0 0 100 100"><defs>
        <radialGradient id="${g}" cx=".4" cy=".35"><stop offset="0" stop-color="#f4e6ff"/><stop offset=".45" stop-color="#9a5cff"/><stop offset="1" stop-color="#2a0f7a"/></radialGradient>
        <radialGradient id="${m}"><stop offset="0" stop-color="#d6b8ff" stop-opacity=".9"/><stop offset="1" stop-color="#7a3cff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="50" cy="50" r="50" fill="url(#${m})"/>
        <polygon points="50,0 57,38 92,22 64,48 100,58 61,62 70,98 50,68 30,98 39,62 0,58 36,48 8,22 43,38" fill="#e6d2ff" stroke="#7a3cff" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="50" cy="52" r="30" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4"/>
        <ellipse cx="44" cy="38" rx="16" ry="6" fill="#fff" opacity=".3"/></svg>`;
    case 'Hitpoints': // crimson heart
      return `<svg viewBox="0 0 100 100"><defs>
        <radialGradient id="${g}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ff9a9a"/><stop offset=".55" stop-color="#d0202c"/><stop offset="1" stop-color="#5a0610"/></radialGradient></defs>
        <path d="M50 94 C18 72 2 54 2 32 C2 15 15 4 30 4 C40 4 46 10 50 18 C54 10 60 4 70 4 C85 4 98 15 98 32 C98 54 82 72 50 94 Z" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M18 26 C20 16 30 12 38 16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/></svg>`;
    case 'Defence': // steel heater shield with rivets and boss
      return `<svg viewBox="0 0 100 100"><defs>
        <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8eef5"/><stop offset=".5" stop-color="#8296ad"/><stop offset="1" stop-color="#2c3a4c"/></linearGradient></defs>
        <path d="M50 3 L92 14 V44 C92 70 74 88 50 98 C26 88 8 70 8 44 V14 Z" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M50 11 L84 20 V44 C84 66 70 81 50 90 C30 81 16 66 16 44 V20 Z" fill="none" stroke="#2c3a4c" stroke-width="2" opacity=".6"/>
        <g fill="#d6ad5c" stroke="#5a3c10" stroke-width="1"><circle cx="20" cy="22" r="3"/><circle cx="80" cy="22" r="3"/><circle cx="22" cy="60" r="3"/><circle cx="78" cy="60" r="3"/><circle cx="50" cy="88" r="3"/></g>
        <path d="M14 18 L50 8 L50 30" fill="#fff" opacity=".25"/></svg>`;
    case 'SpecialDefence': // arcane ward: glowing shield bubble with rune ring
      return `<svg viewBox="0 0 100 100"><defs>
        <radialGradient id="${g}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e2fff8"/><stop offset=".5" stop-color="#2fc6b0"/><stop offset="1" stop-color="#0a4a52"/></radialGradient>
        <radialGradient id="${m}"><stop offset=".6" stop-color="#5fffe0" stop-opacity=".0"/><stop offset=".85" stop-color="#5fffe0" stop-opacity=".55"/><stop offset="1" stop-color="#5fffe0" stop-opacity="0"/></radialGradient></defs>
        <circle cx="50" cy="50" r="50" fill="url(#${m})"/>
        <path d="M50 8 L84 18 V44 C84 66 70 82 50 92 C30 82 16 66 16 44 V18 Z" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4.5" stroke-linejoin="round"/>
        <circle cx="50" cy="48" r="27" fill="none" stroke="#e2fff8" stroke-width="1.6" stroke-dasharray="3 3.2" opacity=".9"/>
        <g stroke="#e2fff8" stroke-width="2" opacity=".85" fill="none"><path d="M50 18 V24 M50 72 V78 M20 48 H26 M74 48 H80"/></g>
        <path d="M20 20 L50 12 L50 32" fill="#fff" opacity=".25"/></svg>`;
  }
}

// ---- Speed-Tier dial: 1 / 2 / 3 chevrons, bronze / silver / gold ----------
export function speedIcon(tier) {
  const n = { Slow: 1, Steady: 2, Swift: 3 }[tier];
  const col = { Slow: ['#f0c79a', '#8a5a2a'], Steady: ['#ffffff', '#8a98a8'], Swift: ['#fff6c4', '#e0a11a'] }[tier];
  const g = id('spg');
  const chevrons = Array.from({ length: n }, (_, i) => {
    const x = 50 - (n - 1) * 9 + i * 18;
    return `<path d="M${x - 9} 32 L${x + 5} 50 L${x - 9} 68" fill="none" stroke="#fff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const wind = tier === 'Swift' ? `<g stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"><path d="M6 40 H20 M4 50 H18 M6 60 H20"/></g>` : '';
  return `<svg viewBox="0 0 100 100"><defs>
    <radialGradient id="${g}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="46" fill="#3a2608"/>
    <circle cx="50" cy="50" r="44" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4"/>
    <circle cx="50" cy="50" r="36" fill="#2b1708" opacity=".55"/>
    ${wind}
    <g filter="drop-shadow(0 2px 1.5px rgba(0,0,0,.6))">${chevrons}</g>
  </svg>`;
}

// ---- PokéDollar coin (Item cost) -------------------------------------------
export function coinMedallion() {
  const g = id('cn');
  return `<svg viewBox="0 0 100 100"><defs>
    <radialGradient id="${g}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#e6b03e"/><stop offset="1" stop-color="#7a4e10"/></radialGradient></defs>
    <circle cx="50" cy="52" r="44" fill="#4a2c08"/>
    <circle cx="50" cy="50" r="44" fill="url(#${g})" stroke="#6b4a1c" stroke-width="3"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="#fff3c4" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 3"/>
    <ellipse cx="38" cy="28" rx="18" ry="7" fill="#fff" opacity=".35"/>
  </svg>`;
}

// ---- Card-Type medallions (placeholder art for cards without an image) ----
const KIND_GLYPH = {
  strategy: '<path fill="#fff" d="M56 10 L26 56 H46 L40 90 L74 40 H54 Z"/>',
  item: '<path fill="#fff" d="M30 38 H70 L66 84 H34 Z"/><path d="M38 38 C38 24 62 24 62 38" fill="none" stroke="#fff" stroke-width="7"/>',
  location: '<path fill="#fff" d="M14 80 L40 34 L54 56 L64 42 L86 80 Z"/><circle cx="70" cy="26" r="8" fill="#fff"/>',
  supporter: '<circle cx="50" cy="34" r="15" fill="#fff"/><path fill="#fff" d="M22 86 C22 62 34 54 50 54 C66 54 78 62 78 86 Z"/>',
  trainer: '<path fill="#fff" d="M50 10 L86 24 V50 C86 70 70 84 50 92 C30 84 14 70 14 50 V24 Z"/><circle cx="50" cy="46" r="12" fill="#2b1708" opacity=".55"/>',
};
const KIND_COLOURS = {
  strategy: ['#9cc2ff', '#21468a'], item: ['#ffd89a', '#8a5a1c'], location: ['#d8e8a0', '#5a6e22'],
  supporter: ['#ffb0a0', '#8a2a1c'], trainer: ['#f6dd9a', '#6b4a1c'],
};
export function kindMedallion(kind) {
  const [hi, lo] = KIND_COLOURS[kind] ?? KIND_COLOURS.trainer;
  const g = id('kg');
  return `<svg viewBox="0 0 100 100"><defs>
    <radialGradient id="${g}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="#3a2608"/>
    <circle cx="50" cy="50" r="45" fill="url(#${g})" stroke="#d6ad5c" stroke-width="4"/>
    <g transform="translate(50 50) scale(.62) translate(-50 -50)" opacity=".95">${KIND_GLYPH[kind] ?? KIND_GLYPH.trainer}</g>
    <ellipse cx="40" cy="24" rx="22" ry="9" fill="#fff" opacity=".25"/>
  </svg>`;
}
