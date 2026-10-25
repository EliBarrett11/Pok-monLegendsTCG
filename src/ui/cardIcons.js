// The icons on card faces. Each one is a WebP in assets/ui/icons/ when there
// is one, drawn over its own outline: three copies of its halo mask
// (halo-<name>.webp, 125% of the icon box) — brass, a dark edge, then the
// card's frame wood — so the frame border follows the icon's shape. Without a
// file it falls back to the vector medallion (medallions.js), with no outline.
//
// Which files exist is found out once at startup (probeCardIcons), so a new
// file dropped into assets/ui/icons/ just works.

import {
  energyCrystal, typeMedallion, rarityGem, statBadge, speedIcon, coinMedallion, kindMedallion,
} from './medallions.js';
import { POKEMON_TYPES } from '../engine/cardData.js';

const DIR = 'assets/ui/icons/';
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

const NAMES = [
  'energy', 'coin',
  ...POKEMON_TYPES.map((t) => `type-${slug(t)}`),
  'rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary',
  'speed-slow', 'speed-steady', 'speed-swift',
  'attack-physical', 'attack-special',
  'strength-hitpoints', 'strength-defence', 'strength-special-defence',
  ...['strategy', 'item', 'location', 'supporter', 'trainer'].map((k) => `kind-${k}`),
];

const files = new Set();   // names with an icon file
const halos = new Set();   // names with a halo mask

function exists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

// Finds out which icon files exist (and loads them). Never rejects.
export function probeCardIcons() {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(NAMES.flatMap((name) => [
    exists(`${DIR}${name}.webp`).then((ok) => ok && files.add(name)),
    exists(`${DIR}halo-${name}.webp`).then((ok) => ok && halos.add(name)),
  ]));
}

// The vector fallback for an icon name.
function vector(name) {
  const [group, ...rest] = name.split('-');
  const value = rest.join('-');
  const title = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  switch (group) {
    case 'energy': return energyCrystal();
    case 'coin': return coinMedallion();
    case 'type': return typeMedallion(POKEMON_TYPES.find((t) => slug(t) === value) ?? 'Normal');
    case 'rarity': return rarityGem(title(value));
    case 'speed': return speedIcon(title(value));
    case 'attack': return statBadge(title(value));
    case 'strength': return statBadge(value === 'special-defence' ? 'SpecialDefence' : title(value));
    case 'kind': return kindMedallion(value);
    default: return '';
  }
}

// What hovering an icon says, e.g. "Special Attack", "Swift", "Rare".
export const ICON_TITLES = {
  energy: 'Energy Cost', coin: 'PokéDollar Cost',
  'attack-physical': 'Physical Attack', 'attack-special': 'Special Attack',
  'strength-hitpoints': 'Hitpoints', 'strength-defence': 'Defence', 'strength-special-defence': 'Special Defence',
};

// An icon on the card frame: cls places it ('cost', 'type', 'speed', 'rarity',
// 'atk', 'str'), inner goes on top (the number), title is its tooltip.
export function cardIcon(name, { cls = '', inner = '', title = '' } = {}) {
  const tip = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
  if (!files.has(name)) return `<div class="ico vec ${cls}"${tip}>${vector(name)}${inner}</div>`;
  const outline = halos.has(name)
    ? `<div class="h brass"></div><div class="h dark"></div><div class="h wood"></div>`
    : '';
  return `<div class="ico ${cls}"${tip} style="--m:url('${DIR}halo-${name}.webp')">${outline}<img src="${DIR}${name}.webp" alt="">${inner}</div>`;
}

export const iconName = {
  type: (t) => `type-${slug(t)}`,
  rarity: (r) => `rarity-${slug(r)}`,
  speed: (s) => `speed-${slug(s)}`,
  attack: (a) => `attack-${slug(a)}`,
  strength: (s) => `strength-${slug(s)}`,
};
