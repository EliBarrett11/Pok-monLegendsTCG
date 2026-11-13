// v4's card renderer (C1, docs/v4-card-overhaul.md sections 2.1–2.2a; the approved mockup is
// docs/design/v4-cards-mockup.jpg, and the frame paths, sizes, colours, fonts, text zones, stat tabs,
// cost wells and type lines are copied from its source, docs/design/v4-cards-mockup.html).
//
// One renderer for every card. Every card is drawn at 340×476 and scaled:
//   full  340 wide · hover zoom, the React window, the mode picker, the Release choice, the pile viewers
//   mini  200 wide · the hand, the PokéMart card
//   token 164 wide · a Pokémon on the board (C1: 164, not 170: see FOUNDATION_ASSUMPTIONS "Card design")
//   chip  24–40 px · a round art crop (trackers, the Bag, the log)
// cardHTML(card, opts) returns the markup (the interface draws with strings); renderCard(card, opts)
// returns the element. Every piece of text sits in its frame's fixed zone (tests/cardtext.test.js).
// No engine state is read here: the caller passes what the card needs to show (its modes now, Stock,
// Objective progress) in opts.state.
import { RULES } from '../rules.js?v=202611131336';
import { PATHS, COMMANDS, SUPPORTERS, ITEMS, LOCATIONS, TRAINERS, FAVOURS, KEYWORD_NAMES, KEYWORD_ORDER, TRIGGER_NAMES, MODE_NAMES, MODES, effectText, modeTarget, shortModeTextOf } from '../engine/cards.js?v=202611131336';
import { effectiveSpeed } from '../engine/game.js?v=202611131336';

export const W = 340;
export const H = 476;
export const SIZES = { full: 340, mini: 200, token: 164 };
const ASSETS = '../assets';
const artUrl = (name) => `${ASSETS}/cards/${name}.jpg`;
// B3-1: a card whose art hasn't arrived ("hasArt": false in cards.json) shows the Art Pending panel instead: a soft
// radial glow in its Type's (or card kind's) colour, drawn in code. artBg(card) is the CSS background for any art spot.
export const pendingGlow = (acc) => `radial-gradient(ellipse at 50% 42%, ${acc}cc 0%, ${acc}55 32%, rgba(20,14,10,.92) 72%, #0b0806 100%)`;
// (Every art name the data marks pending, so a card object that lost its flag still shows the panel.)
const PENDING_ART = new Set([...PATHS.flatMap((p) => p.forms), ...COMMANDS, ...SUPPORTERS, ...ITEMS, ...LOCATIONS, ...TRAINERS, ...TRAINERS.map((x) => x.partner)].filter((x) => x.hasArt === false).map((x) => x.art));
const isPending = (c) => c?.hasArt === false || (c?.hasArt === undefined && PENDING_ART.has(c?.art));
export const artBg = (c) => (isPending(c) ? pendingGlow(accentOf(c)) : `url('${artUrl(c?.art)}')`);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const low = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const stop = (t) => (/[.!]$/.test(t) ? t : `${t}.`);

// --- Art framing ------------------------------------------------------------------------------------
// C2: a focal point per piece of art, from assets/cards/focus.json (loaded once by loadArtFocus; without
// it, 50% across and 35% down): { x, y } the subject's centre, face { x, y } a chip's centre, zoom a chip's
// zoom, tile { x, y } a Location's wide crop on the board, w and h the image's size. Everything reads it here.
let FOCUS = {};
export const setArtFocus = (map) => { FOCUS = map ?? {}; };
export async function loadArtFocus(url = `${ASSETS}/cards/focus.json`) {
  try { const r = await fetch(url); if (r.ok) setArtFocus(await r.json()); } catch { /* defaults */ }
  return FOCUS;
}
export const artFocus = (art) => ({ x: 50, y: 35, ...(FOCUS[art] ?? {}) });
// A round crop of S px centred on the face at its zoom (background-size and -position in px), always
// covering the circle: the face sits as close to the centre as the image allows.
export function chipCrop(art, S) {
  const f = artFocus(art);
  const face = f.face ?? { x: f.x, y: f.y };
  const ar = f.w && f.h ? f.h / f.w : 1.4;
  const z = Math.max(1, f.zoom ?? 1.6);
  const bw = z * S;
  const bh = bw * ar;
  const ox = Math.min(0, Math.max(S - bw, S / 2 - (face.x / 100) * bw));
  const oy = Math.min(0, Math.max(S - bh, S / 2 - (face.y / 100) * bh));
  return `background-size:${bw.toFixed(1)}px ${bh.toFixed(1)}px;background-position:${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
}

// --- Colours and glyphs (the mockup's) -------------------------------------------------------------------
const ACC = { Fire: '#d9773f', Water: '#5f9bd6', Electric: '#d7b440', Rock: '#b39a6c', Normal: '#b7ad9a', Grass: '#6fb04f',
  // B3-2: Batch 2's Types.
  Psychic: '#d0679a', Fighting: '#c8643c', Ghost: '#8b74cc', Dark: '#7d6a5c',
  Supporter: '#c46a6a', Item: '#5fb59a', Trainer: '#a786d6', Location: '#c2a36a' };
const G = {
  pa: '<path d="M5 16C7 11 10 7 15 4M9 19.5c2.5-5 5.5-8.5 11-11.5M13 22c2-3.5 4.5-6 8-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  sa: '<path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="currentColor"/>',
  hp: '<path d="M12 20.5s-7.5-4.8-7.5-10.2a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.4-7.5 10.2-7.5 10.2z" fill="currentColor"/>',
  def: '<path d="M12 2.5l7.5 2.8v5.8c0 4.8-3.3 8.4-7.5 10.4-4.2-2-7.5-5.6-7.5-10.4V5.3z" fill="currentColor"/>',
  sdef: '<path d="M12 2.5l8 4.6v9.8L12 21.5l-8-4.6V7.1z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  Fire: '<path d="M12 2.5c1 3.8 4.8 5.8 4.8 10.6a4.8 4.8 0 0 1-9.6 0c0-2.8 1.9-3.8 1.9-6.6 1.9 1 2.9 2.8 2.9 4.7 1-1.9 0-5.7 0-8.7z" fill="currentColor"/>',
  Water: '<path d="M12 3.5s5.6 6.6 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-3.8 5.6-10.4 5.6-10.4z" fill="currentColor"/>',
  Electric: '<path d="M13 2.5L5.5 13.5h5.6l-1 8 7.4-11h-5.6z" fill="currentColor"/>',
  Rock: '<path d="M4 18l4.5-9 4.5 3 3-6 4 12z" fill="currentColor"/>',
  Normal: '<circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  // B3-1: Grass, a leaf with its vein.
  Grass: '<path d="M19.5 4C11 4.5 5 9 5 15.5c0 1.6.4 3 1 4.2C8 13.5 12 10 16 8.5c-3.6 2.4-6.6 5.8-8.4 11 1.1.6 2.4.9 3.9.9C17 20.4 20.4 13 19.5 4z" fill="currentColor"/>',
  // B3-2: Psychic, an eye; Fighting, a fist; Ghost, a wisp with eyes; Dark, a crescent moon.
  Psychic: '<path d="M2.5 12C5 7.6 8.3 5.5 12 5.5s7 2.1 9.5 6.5c-2.5 4.4-5.8 6.5-9.5 6.5S5 16.4 2.5 12z" fill="currentColor"/><circle cx="12" cy="12" r="3.3" fill="#0b0705"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  Fighting: '<path d="M6 9.5a2 2 0 0 1 2-2h1V6a1.6 1.6 0 0 1 3.2 0v1.5h.6V6a1.6 1.6 0 0 1 3.2 0v1.5h.4a1.6 1.6 0 0 1 1.6 1.6v5.4c0 3.6-2.6 6-6 6h-1c-2.8 0-5-2.2-5-5z" fill="currentColor"/><path d="M8.5 12.5h5.5" stroke="#0b0705" stroke-width="1.4" stroke-linecap="round"/>',
  Ghost: '<path d="M12 2.8a7 7 0 0 1 7 7v11l-2.4-1.8-2.3 1.8-2.3-1.8-2.3 1.8-2.3-1.8L5 20.8v-11a7 7 0 0 1 7-7z" fill="currentColor"/><circle cx="9.4" cy="10.5" r="1.5" fill="#0b0705"/><circle cx="14.6" cy="10.5" r="1.5" fill="#0b0705"/>',
  Dark: '<path d="M15.5 3.2A8.8 8.8 0 1 0 20.8 16 7.2 7.2 0 0 1 15.5 3.2z" fill="currentColor"/>',
  Supporter: '<circle cx="12" cy="8" r="3.6" fill="currentColor"/><path d="M5 20c0-4.4 3.4-6.4 7-6.4s7 2 7 6.4z" fill="currentColor"/>',
  Item: '<path d="M9.5 3.5h5v2.8l2.8 3.6v8.6a1.8 1.8 0 0 1-1.8 1.8H8.5a1.8 1.8 0 0 1-1.8-1.8V9.9l2.8-3.6z" fill="currentColor"/>',
  Trainer: '<path d="M12 3l2.6 5.4 5.9.9-4.3 4.1 1 5.9L12 16.6l-5.2 2.7 1-5.9L3.5 9.3l5.9-.9z" fill="currentColor"/>',
  Location: '<path d="M12 2.5a6.5 6.5 0 0 1 6.5 6.5c0 4.8-6.5 12.5-6.5 12.5S5.5 13.8 5.5 9A6.5 6.5 0 0 1 12 2.5z" fill="currentColor"/><circle cx="12" cy="9" r="2.4" fill="#0b0705"/>',
  en: '<path d="M13 2.5L6 13h5l-1 8.5 7-10.5h-5z" fill="currentColor"/>',
};
const SC = { pa: '#d98a55', sa: '#a98ad8', hp: '#d9798a', def: '#b9c3cf', sdef: '#6fc2d6' };
const glyph = (k, x, y, s, col) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24" style="color:${col}">${G[k] ?? ''}</svg>`;
const statKeys = (c) => [c.attackType === 'Special' ? 'sa' : 'pa', { Defence: 'def', 'Special Defence': 'sdef' }[c.strengthType] ?? 'hp'];
// A Move's colour and crest: its Type, from the card data (B3-1; Normal Moves use Normal).
export const COMMAND_TYPE = Object.fromEntries(COMMANDS.map((c) => [c.id, c.type ?? 'Normal']));

// --- Silhouettes: near-rectangles with one trait each (the mockup's paths; i = inset) ---------------------------
const R = 10;
const SH = {
  pokemon: (i) => { const c = 16 - i * 0.4; return `M${i + c},${i} H${W - i - c} L${W - i},${i + c} V${H - i - R} Q${W - i},${H - i} ${W - i - R},${H - i} H${i + R} Q${i},${H - i} ${i},${H - i - R} V${i + c} Z`; },
  command: (i) => `M${i + R},${i} H${W / 2 - 30} C${W / 2 - 18},${i} ${W / 2 - 16},${i + 14} ${W / 2},${i + 14} C${W / 2 + 16},${i + 14} ${W / 2 + 18},${i} ${W / 2 + 30},${i} H${W - i - R} Q${W - i},${i} ${W - i},${i + R} V${H - i - R} Q${W - i},${H - i} ${W - i - R},${H - i} H${i + R} Q${i},${H - i} ${i},${H - i - R} V${i + R} Q${i},${i} ${i + R},${i} Z`,
  supporter: (i) => `M${i},${i + 22} Q${W / 2},${i - 12} ${W - i},${i + 22} V${H - i - R} Q${W - i},${H - i} ${W - i - R},${H - i} H${i + R} Q${i},${H - i} ${i},${H - i - R} Z`,
  item: (i) => `M${i + 16},${i} H${W / 2 - 16} A16,16 0 0 0 ${W / 2 + 16},${i} H${W - i - 16} Q${W - i},${i} ${W - i},${i + 16} V${H - i - 16} Q${W - i},${H - i} ${W - i - 16},${H - i} H${i + 16} Q${i},${H - i} ${i},${H - i - 16} V${i + 16} Q${i},${i} ${i + 16},${i} Z`,
  trainer: (i) => `M${i},${i + 18} L${W / 2 - 46},${i + 18} L${W / 2},${i - 4} L${W / 2 + 46},${i + 18} L${W - i},${i + 18} V${H - i - R} Q${W - i},${H - i} ${W - i - R},${H - i} H${i + R} Q${i},${H - i} ${i},${H - i - R} Z`,
  location: (i) => `M${i + 6},${i + 14} H${W - i - 6} V${H - i - 14} H${i + 6} Z`,
};
// The trainer peak and supporter arch rise above y 0: the art's clip uses the same path.
const KIND = { 'Pokémon': 'pokemon', Command: 'command', Supporter: 'supporter', Item: 'item', Trainer: 'trainer', Location: 'location' };
export const kindOf = (c) => KIND[c.cardType] ?? 'pokemon';

// The shared defs (brass gradient, scroll-roll gradient), once per document.
export const CARD_DEFS = `<svg id="cd-defs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>
  <linearGradient id="cd-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2c88f"/><stop offset=".4" stop-color="#8f7140"/><stop offset=".6" stop-color="#d4b67c"/><stop offset="1" stop-color="#6e5530"/></linearGradient>
  <linearGradient id="cd-roll" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c08c"/><stop offset=".5" stop-color="#7a6038"/><stop offset="1" stop-color="#2e2214"/></linearGradient>
</defs></svg>`;
const BR = 'url(#cd-brass)';

// --- Fixed text zones (in the 340×476 drawing) ------------------------------------------------------------------
// The panel rule's height for each kind and size; everything else is placed from it.
const PANEL = {
  full: { pokemon: 296, command: 262, supporter: 270, item: 296, trainer: 290, location: 300 },
  mini: { pokemon: 340, command: 326, supporter: 376, item: 376, trainer: 376, location: 376 },
  token: { pokemon: 330 },
};
const COST_AT = { pokemon: [32, 32], command: [W / 2, 22], supporter: [36, 50], item: [32, 32], trainer: [34, 52] };
const CREST_AT = { pokemon: [W - 32, 32], command: [W - 32, 30], supporter: [W - 36, 50], item: [W - 32, 32], trainer: [W - 34, 52], location: [W / 2, 44] };
const TAB = { w: 64, h: 46, y: H - 7 - 46 };

// --- On-card wording -------------------------------------------------------------------------------------------
// Each zone's text is written to fit (tests/cardtext.test.js). Where today's text doesn't fit, the card
// carries a shorter wording here; the full text stays in the data (cards.js) for the Codex.
// B3-1: none now: the wording is generated from the ops (src/engine/wording.js), word for word as in cards.json.
export const SHORTENED = {};
// A Pokémon's rules: its keywords (a small-caps line), then its trigger: the name in bold, then the effect.
// B3-1: Sturdy is shown until it's used.
const kwList = (c) => Object.keys(c.keywords ?? {}).filter((k) => c.keywords[k] && KEYWORD_NAMES[k] && !(k === 'sturdy' && c.sturdyUsed)).map((k) => `${KEYWORD_NAMES[k]}${c.keywords[k] === true ? '' : ` ${c.keywords[k]}`}`);
function triggerHTML(c) {
  if (!c.trigger) return '';
  const short = SHORTENED[c.name];
  if (short) { const [h, ...t] = short.split(' · '); return `<b>${esc(h)}</b> · ${esc(t.join(' · '))}`; }
  return `<b>${esc(TRIGGER_NAMES[c.trigger.on])}</b> · ${esc(c.trigger.effect ? stop(effectText(c.trigger.effect)) : '')}`;
}
// A Move mode in one short line for its row on a Full card (B3-1: the card's own line, from cards.json's cardText).
export const rowModeText = (card, m) => shortModeTextOf(card, m);
// The mode rows in the mockup's order: React (cheapest), Adapt, Strat (dearest); only the modes the Move has.
const ROW_ORDER = ['react', 'adapt', 'strat'];
const TARGET_LINE = { enemy: 'an enemy Pokémon', own: 'one of your Pokémon', location: 'a Location', ownLocation: 'your Pokémon in a Location', allEnemies: 'all enemies', allOwn: 'all of yours', attacker: 'the attacker', attacked: 'the attacked' };
// An Item's rules (B3-1: its wording from the ops; a Held Item's is what the holder has).
const itemRules = (c) => (c.itemType === 'Held' ? `<b>The holder:</b> ${esc(stop(c.text))}` : esc(stop(cap(c.text))));
const supRules = (c) => stop(cap(c.text));
const favourRules = (c) => `${esc(`Release ${FAVOURS[c.favour.condition].text}: ${c.favour.text}`)} <b>+${c.favour.recognition ?? RULES.perFavour} Recognition.</b>`;

// --- Pieces ---------------------------------------------------------------------------------------------------------
const zone = (cls, x, y, w, h, html, style = '') => `<div class="cd-t ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${style}">${html}</div>`;
function costWell(kind, n, money = false, ring = '#7fb2e6', fz = 23) {
  const [cx, cy] = COST_AT[kind];
  const text = String(n);
  return {
    svg: `<circle cx="${cx}" cy="${cy}" r="21" fill="#0b0806" stroke="${BR}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="${ring}" stroke-width="1" opacity=".75"/>`,
    html: zone('cd-num cd-cost', cx - 21, cy - 21, 42, 42, esc(text), `font-size:${text.length > 1 ? fz - 5 : fz}px;${money ? 'color:#f0d590' : ''}`),
  };
}
function crest(kind, key, acc) {
  const [cx, cy] = CREST_AT[kind];
  return `<g class="cd-crest"><circle cx="${cx}" cy="${cy}" r="13" fill="#0b0806" stroke="${BR}" stroke-width="1.2"/>${glyph(key, cx - 8, cy - 8, 16, acc)}</g>`;
}
// C4: a stat tab's number. With current stats (state.stats, from the engine's effectiveStats, board Pokémon only):
// raised above printed → green with a small ▲; lowered below printed, or damaged → red with a small ▼; unchanged
// → the normal colour. The ▲/▼ is a small drawn triangle above the number (not text, so it never crowds the
// digits). Strength below its maximum shows the maximum too: on the Full card as "/9" under the number; on a
// token (164 px, where "/12" would be too small to read) as a slim bar under it, filled to current / maximum.
// Hovering a raised or lowered number on a token shows its one-line sum (data-sum).
const TRI = { up: 'M5,1 L9.5,9 L0.5,9 Z', down: 'M0.5,1 L9.5,1 L5,9 Z' };
function tabNumber(cls, x, y, th, n, trend, max, sum, numPx, token) {
  // The number is the zone's own text (centred in the 46-unit tab, as on every card); the triangle sits above
  // it and the maximum (a bar on tokens, "/9" on the Full card) below it, both placed absolutely in the tab.
  const tri = trend ? `<svg class="cd-tri" width="${token ? 13 : 11}" height="${token ? 9 : 8}" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true"><path d="${TRI[trend]}"/></svg>` : '';
  const big = Math.round(numPx * (token ? 0.86 : 0.8));
  const under = max === null ? '' : token
    ? `<span class="cd-sbar" aria-label="of ${max}"><i style="width:${Math.max(4, Math.round((100 * Math.max(0, n)) / max))}%"></i></span>`
    : `<span class="cd-max" style="font-size:${Math.round(numPx * 0.46)}px">/${max}</span>`;
  const shift = trend || max !== null ? `font-size:${big}px;padding-top:${trend ? 6 : 0}px;padding-bottom:${max !== null ? (token ? 4 : 10) : 0}px;box-sizing:border-box` : `font-size:${Math.round(numPx * 0.9)}px`;
  return zone(`cd-num cd-tab cd-cur ${cls}${trend ? ` cd-${trend}` : ''}`, x, y, 42, th, `${n}${tri}${under}`, shift).replace('<div class="cd-t', `<div${sum && trend ? ` data-sum="${esc(sum)}"` : ''} class="cd-t`);
}
function statTabs(c, numPx = 25, stats = null) {
  const [ak, sk] = statKeys(c);
  const { w: tw, h: th, y } = TAB;
  const str = c.currentStrength ?? c.strength;
  if (stats) {
    const token = numPx >= 30;
    const atkTab = tabNumber('atk', 28, y, th, stats.attack, stats.attackTrend, null, stats.sumAttack, numPx, token);
    const strTab = tabNumber('str', W - 7 - tw + 22, y, th, stats.strength, stats.strengthTrend, stats.strength !== stats.strengthMax ? stats.strengthMax : null, stats.sumStrength, numPx, token);
    return { ...statTabs(c, numPx), html: atkTab + strTab };
  }
  const L = `M7,${y} H${7 + tw - 8} Q${7 + tw},${y} ${7 + tw},${y + 8} V${H - 7}`;
  const Rr = `M${W - 7},${y} H${W - 7 - tw + 8} Q${W - 7 - tw},${y} ${W - 7 - tw},${y + 8} V${H - 7}`;
  return {
    svg: `<path d="M7,${y} H${7 + tw - 8} Q${7 + tw},${y} ${7 + tw},${y + 8} V${H - 7} H${7 + R - 4} Q7,${H - 7} 7,${H - 7 - R + 4} Z" fill="rgba(10,7,5,.92)"/>
      <path d="M${W - 7},${y} H${W - 7 - tw + 8} Q${W - 7 - tw},${y} ${W - 7 - tw},${y + 8} V${H - 7} H${W - 7 - R + 4} Q${W - 7},${H - 7} ${W - 7},${H - 7 - R + 4} Z" fill="rgba(10,7,5,.92)"/>
      <path d="${L}" fill="none" stroke="${BR}" stroke-width="1.2"/><path d="${Rr}" fill="none" stroke="${BR}" stroke-width="1.2"/>
      ${glyph(ak, 12, y + 15, 15, SC[ak])}${glyph(sk, W - 7 - tw + 6, y + 15, 15, SC[sk])}`,
    html: zone('cd-num cd-tab atk', 28, y, 42, th, String(c.attack), `font-size:${numPx}px`)
      + zone(`cd-num cd-tab str${str < c.strength ? ' hurt' : ''}`, W - 7 - tw + 22, y, 42, th, String(str), `font-size:${numPx}px`),
  };
}
const SPEED_N = { Slow: 1, Steady: 2, Swift: 3 };
function levelSpeed(c, px) {
  // B3-1: a card in hand that gained Levels shows them (green, "+2").
  const lv = c.partner ? '★' : `LV ${c.level}${c.levelBonus ? `<span class="cd-lvup">▲${c.levelBonus}</span>` : ''}`;
  return zone('cd-lvs', 80, H - 50, W - 160, 40, `<span>${lv}</span><span class="cd-chev" style="font-size:${Math.round(px * 1.25)}px">${'›'.repeat(SPEED_N[effectiveSpeed(c)] ?? 1)}</span>`, `font-size:${px}px`);
}
function heldInset(c, cx, cy, r) {
  if (!c.held) return '';
  return `<span class="cd-held" style="left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;background-image:${artBg(c.held)};${c.held.hasArt === false ? 'background-size:cover' : chipCrop(c.held.art, 2 * r)}"></span>`;
}

// --- The frame: art (clipped to the silhouette, framed by its focal point), the panel's shade, the lines --------------
// C2 (docs/v4-card-overhaul.md 2.3): the collectable finish. A soft holo sheen on the Full and Mini sizes of
// each line's final form; a richer animated holo on Partners and Trainers at every size. A fine diagonal
// band that follows the pointer (src/ui/finish.js sets --mx and --my), clipped to the frame and faded
// out above the text panel, so it never touches the text.
const FINAL_FORMS = new Set(PATHS.map((p) => p.forms.at(-1).name));
export function holoKind(c, size) {
  if (size === 'chip') return null;
  if (c.partner || c.cardType === 'Trainer') return 'rich';
  if (c.cardType === 'Pokémon' && FINAL_FORMS.has(c.name) && (size === 'full' || size === 'mini')) return 'final';
  return null;
}
function holoDiv(kind, o, panel, holo) {
  if (!holo) return '';
  const p = (y) => ((100 * y) / H).toFixed(1);
  const mask = `linear-gradient(180deg, #000 0%, #000 ${p(panel - 110)}%, transparent ${p(panel - 30)}%)`;
  return `<div class="cd-holo ${holo}" style="clip-path:path('${o}');-webkit-mask-image:${mask};mask-image:${mask}"></div>`;
}
function frame(kind, art, acc, panel, size, holo = null, pending = false) {
  const o = SH[kind](0);
  const f = artFocus(art);
  const p = (y) => ((100 * y) / H).toFixed(1);
  // The lower part darkens smoothly under the art, from just above the panel rule.
  const shade = `linear-gradient(180deg, rgba(10,7,5,0) ${p(panel - 90)}%, rgba(10,7,5,.78) ${p(panel - 10)}%, rgba(10,7,5,.92) ${p(panel + 20)}%, rgba(7,5,4,.97) 100%)`;
  // B3-1: Art Pending: the glow, with "ART PENDING" in small spaced capitals in the middle of the art area.
  // B3-2 (Elliott, 13 Nov 2026): where only part of the art shows (a strip of a fanned hand: pending === 'glow'), the
  // glow alone, never cut words; full, hovered and Codex cards keep the words.
  const words = pending === 'glow' ? '' : `<span class="cd-pendt" style="top:${Math.round(panel * 0.42)}px">Art Pending</span>`;
  const artDiv = pending
    ? `<div class="cd-art cd-pending" style="clip-path:path('${o}');background-image:${shade},${pendingGlow(acc)}">${words}</div>`
    : `<div class="cd-art" style="clip-path:path('${o}');background-image:${shade},url('${artUrl(art)}');background-position:0 0,${f.x}% ${f.y}%"></div>`;
  const inner = SH[kind](7);
  const lines = `<path d="${o}" fill="none" stroke="#050302" stroke-width="3"/><path d="${o}" fill="none" stroke="${BR}" stroke-width="1.6"/><path d="${inner}" fill="none" stroke="rgba(194,163,106,.55)" stroke-width="1"/>`;
  const rule = size === 'chip' ? '' : `<path d="M24,${panel} H${W / 2 - 12} M${W / 2 + 12},${panel} H${W - 24}" stroke="${BR}" stroke-width="1"/><path d="M${W / 2},${panel - 5} L${W / 2 + 5},${panel} L${W / 2},${panel + 5} L${W / 2 - 5},${panel}Z" fill="${acc}" stroke="#e2c88f" stroke-width=".8"/>`;
  const rolls = kind === 'location' ? `<rect x="2" y="6" width="${W - 4}" height="16" rx="8" fill="url(#cd-roll)" stroke="#050302" stroke-width="1.5"/><rect x="2" y="${H - 22}" width="${W - 4}" height="16" rx="8" fill="url(#cd-roll)" stroke="#050302" stroke-width="1.5"/>` : '';
  return { artDiv: artDiv + holoDiv(kind, o, panel, holo), svg: lines + rule + rolls };
}

// --- Per kind: what each size shows ----------------------------------------------------------------------------------
function accentOf(c) {
  if (c.cardType === 'Pokémon') return ACC[c.type] ?? ACC.Normal;
  if (c.cardType === 'Command') return ACC[c.type ?? COMMAND_TYPE[c.id]] ?? ACC.Normal;
  return ACC[c.cardType] ?? ACC.Location;
}
function crestKey(c) {
  if (c.cardType === 'Pokémon') return c.type;
  if (c.cardType === 'Command') return c.type ?? COMMAND_TYPE[c.id] ?? 'Normal';
  return c.cardType;
}
const nameZone = (c, y, px) => {
  const tight = c.name.length > (px > 22 ? 11 : 14);
  return zone(`cd-name${tight ? ' tight' : ''}`, 18, y, W - 36, Math.round(px * 1.35), esc(c.name), `font-size:${px}px`);
};
const typeZone = (text, y, acc) => zone('cd-type', 18, y, W - 36, 16, esc(text), `color:${acc}`);
const chipsZone = (chips, y, h, px) => zone('cd-chips', 16, y, W - 32, h, chips.map((t) => `<span class="cd-chip" style="font-size:${px}px">${esc(t)}</span>`).join(''));
function typeLine(c) {
  if (c.cardType === 'Pokémon') return `${c.type} · ${c.attackType}${c.partner ? ' · Partner' : ''}`;
  if (c.cardType === 'Command') return `Command · ${c.type ?? COMMAND_TYPE[c.id] ?? 'Normal'}`;
  if (c.cardType === 'Supporter') return `Supporter · Release ${c.release}`;
  if (c.cardType === 'Item') return `Item · ${c.itemType}`;
  if (c.cardType === 'Trainer') return 'Trainer';
  if (c.cardType === 'Location') return `Location · ${c.width} lanes · ${c.rounds} Rounds`;
  return c.cardType;
}
// The cost: Energy (Pokémon, Command: the first mode allowed now, or Adapt; Trainer: its Command),
// the Release count (Supporter, a red ring), $ (Item, a gold ring). Partners and Locations have none.
function cost(c, kind, state) {
  if (c.cardType === 'Pokémon') return c.partner ? null : costWell(kind, c.cost, false, '#7fb2e6');
  if (c.cardType === 'Command') { const m = state.modes?.find((x) => !x.reason) ?? state.modes?.[0]; return costWell(kind, m?.cost ?? (c.modes.adapt ?? c.modes.strat ?? c.modes.react).cost); }
  if (c.cardType === 'Supporter') return costWell(kind, c.release, false, '#d07070');
  if (c.cardType === 'Item') return costWell(kind, `$${c.price}`, true, '#e2c070', 23);
  if (c.cardType === 'Trainer') return costWell(kind, c.command.cost);
  return null;
}
// The Command's mode chips on Mini cards: the modes allowed now (React in a React window), else Adapt and Strat.
function modeChips(c, state) {
  const ms = state.modes ? state.modes.filter((m) => !m.reason) : [];
  const list = ms.length ? ms : (state.modes ?? []).length ? state.modes : ['adapt', 'strat'].filter((m) => c.modes[m]).map((m) => ({ mode: m, cost: c.modes[m].cost }));
  return list.map((m) => `${MODE_NAMES[m.mode]} ${m.cost}`);
}
// One tag for a Mini card: the first trigger, the Command's modes, or (not in the mockup) the kind.
function miniTag(c, state) {
  if (c.cardType === 'Pokémon') return c.trigger ? [TRIGGER_NAMES[c.trigger.on]] : kwList(c).slice(0, 1);
  if (c.cardType === 'Command') return modeChips(c, state);
  if (c.cardType === 'Supporter') return [`Release ${c.release}`];
  if (c.cardType === 'Item') return [c.itemType];
  if (c.cardType === 'Trainer') return ['Trainer'];
  if (c.cardType === 'Location') return [`${c.width} lanes · ${c.rounds} Rounds`];
  return [];
}

function fullBody(c, kind, acc, panel, state) {
  let svg = '';
  let html = nameZone(c, panel + 8, 21) + typeZone(typeLine(c), panel + 38, acc);
  const top = panel + 58;
  if (c.cardType === 'Pokémon') {
    const kws = kwList(c);
    // B3-1: a long trigger (Eevee's, Sunflora's) with keywords sets a little tighter, so it still fits its zone.
    const len = (c.trigger?.effect ? effectText(c.trigger.effect).length : 0) + (kws.length ? 40 : 0);
    html += zone(`cd-rules${len > 100 ? ' dense' : ''}`, 30, top, W - 60, TAB.y - 4 - top, `${kws.length ? `<div class="cd-kw${kws.join(' · ').length > 28 ? ' tight' : ''}" style="color:${acc}">${esc(kws.join(' · '))}</div>` : ''}<div>${triggerHTML(c) || '&nbsp;'}</div>`);
  } else if (c.cardType === 'Command') {
    ROW_ORDER.filter((m) => c.modes[m]).forEach((m, k) => {
      const st = state.modes?.find((x) => x.mode === m);
      const off = state.modes ? !st || !!st.reason : false;
      const y = top + 2 + k * 30;
      html += zone(`cd-mrow${off ? ' off' : ''}`, 30, y, W - 60, 26, `<b>${MODE_NAMES[m]}</b><span class="tx">${esc(rowModeText(c, m))}</span><span class="c"><svg width="12" height="12" viewBox="0 0 24 24" style="color:#7fb2e6">${G.en}</svg>${c.modes[m].cost}</span>`);
      svg += `<path d="M30,${y + 26.5} H${W - 30}" stroke="rgba(194,163,106,.18)" stroke-width="1"/>`;
    });
    if (TARGET_LINE[c.target]) html += zone('cd-type cd-target', 18, top + 98, W - 36, 16, `Target · ${esc(TARGET_LINE[c.target])}`, 'color:#b8a57e');
  } else if (c.cardType === 'Supporter') {
    html += zone('cd-rules', 30, top, W - 60, 40, `<div>${esc(supRules(c))}</div>`);
    const by = top + 46;
    svg += `<rect x="26" y="${by}" width="${W - 52}" height="${H - 14 - by}" rx="3" fill="rgba(194,163,106,.08)" stroke="rgba(194,163,106,.45)" stroke-width="1"/>`;
    html += zone('cd-favl', 36, by + 5, W - 72, 16, 'Favour') + zone('cd-rules cd-fav', 36, by + 23, W - 72, H - 14 - by - 28, `<div>${favourRules(c)}</div>`);
  } else if (c.cardType === 'Item') {
    html += zone('cd-rules', 30, top, W - 60, 58, `<div>${itemRules(c)}</div>`);
    const n = c.stock;
    const left = state.stock ?? n;
    for (let k = 0; k < n; k++) {
      const x = W / 2 - n * 9 + k * 18 + 4;
      svg += `<rect x="${x}" y="${H - 52}" width="10" height="10" transform="rotate(45 ${x + 5} ${H - 47})" fill="${k < left ? acc : 'none'}" stroke="${acc}" stroke-width="1"/>`;
    }
    html += zone('cd-type cd-stock', 18, H - 34, W - 36, 14, state.stock !== undefined ? `Stock · ${left} of ${n} turns` : `Stock · ${n} turns`, 'color:#9cc9b6');
  } else if (c.cardType === 'Trainer') {
    const dense = c.command.text.length + c.objective.text.length > 50;   // (B3-1: Erika's and Lt. Surge's longer lines)
    html += zone(`cd-rules${dense ? ' dense tr' : ''}`, 30, top, W - 60, dense ? 64 : 60, `<div><b>Command</b> · ${esc(stop(low(c.command.text)))}</div><div><b>Objective</b> · ${esc(stop(low(c.objective.text)))}</div>`);
    const need = c.objective.need;
    const prog = Math.min(state.progress ?? 0, need);
    const cy = H - 44;
    for (let k = 0; k < need; k++) svg += `<circle cx="${40 + k * 21}" cy="${cy}" r="5.5" fill="${k < prog ? '#e6cf9a' : 'none'}" stroke="#c2a36a" stroke-width="1.2"/>`;
    svg += `<path d="M${40 + (need - 1) * 21 + 10},${cy} H${W - 74}" stroke="rgba(194,163,106,.45)" stroke-width="1" stroke-dasharray="2 4"/><circle cx="${W - 50}" cy="${cy}" r="19.5" fill="none" stroke="${BR}" stroke-width="1.4"/>`;
    html += `<span class="cd-portrait" style="left:${W - 69}px;top:${cy - 19}px;background-image:${artBg(c.partner)};${c.partner.hasArt === false ? 'background-size:cover' : chipCrop(c.partner.art, 38)}"></span>`;
    html += zone('cd-type cd-obj', 30, H - 30, 190, 14, `${prog} of ${need} · Partner`, 'color:#a991cf;justify-content:flex-start');
  } else if (c.cardType === 'Location') {
    html += zone('cd-rules', 30, top, W - 60, 40, `<div>${esc(stop(c.passive.text))}</div>`);
    html += chipsZone([`${c.rounds} Rounds`, `Dominate · +${RULES.perDominance} Recognition`], top + 52, 26, 10.5);
  }
  return { svg, html };
}

// --- The renderer ------------------------------------------------------------------------------------------------------
// opts: { size: 'full' | 'mini' | 'token' | 'chip', px (chip diameter), state, cls, attrs }
// state: { playable, reason, ready, spent, selected, target, illegal, illegalReason, retained, soldOut,
//          modes (commandModesFor), stock (turns left), progress (an Objective's), badges (HTML) }
export function cardHTML(c, opts = {}) {
  const size = opts.size ?? 'full';
  const state = opts.state ?? {};
  const kind = kindOf(c);
  if (size === 'chip') {
    const px = opts.px ?? 32;
    return `<span class="cd-chipart ${opts.cls ?? ''}" ${opts.attrs ?? ''} style="width:${px}px;height:${px}px;background-image:${artBg(c)};${isPending(c) ? 'background-size:cover' : chipCrop(c.art, px)}" aria-label="${esc(c.name)}"></span>`;
  }
  const w = SIZES[size];
  const k = w / W;
  const acc = accentOf(c);
  const fk = size === 'token' ? 'pokemon' : kind;
  const panel = PANEL[size]?.[fk] ?? PANEL.full[fk];
  const holo = holoKind(c, size);
  // (B3-2: a fanned hand's strip shows only part of the art.)
  const partial = size === 'mini' && opts.strip && opts.strip < w;
  const fr = frame(fk, c.art, acc, panel, size, holo, isPending(c) && (partial ? 'glow' : true));
  let svg = fr.svg;
  let html = '';
  // Cost well and crest (tokens show neither: the board needs the art).
  if (size !== 'token') {
    const cw = cost(c, kind, state);
    if (cw) { svg += cw.svg; html += cw.html; }
    svg += crest(kind, crestKey(c), acc);
  }
  if (size === 'full') {
    const b = fullBody(c, kind, acc, panel, state);
    svg += b.svg;
    html += b.html;
    if (c.cardType === 'Pokémon') { const st = statTabs(c, 25, state.stats); svg += st.svg; html += st.html + levelSpeed(c, 12) + heldInset(c, W - 32, 82, 20); }
  } else if (size === 'mini') {
    // C2: in a fanned hand only a strip at the left shows (opts.strip, in screen px): the name and the
    // tag sit left-aligned inside it (the cost well above them). Whatever still doesn't fit completely is
    // hidden by the hand's layout after drawing (board.js fitHandStrips), never cut.
    const strip = opts.strip && opts.strip < w ? Math.max(40, opts.strip / k) : null;
    const nz = strip ? zone('cd-name strip', 14, panel + 8, strip - 16, 35, esc(c.name), 'font-size:26px') : nameZone(c, panel + 8, 26);
    html += nz;
    const tag = miniTag(c, state);
    const tz = (y) => (strip ? zone('cd-chips left strip', 14, y, strip - 16, 36, tag.map((t) => `<span class="cd-chip" style="font-size:18px">${esc(t)}</span>`).join('')) : chipsZone(tag, y, 36, 18));
    if (c.cardType === 'Pokémon') {
      const st = statTabs(c, 27);
      svg += st.svg;
      html += st.html + levelSpeed(c, 18);
      if (tag.length) html += tz(panel - 46);
    } else if (tag.length) html += tz(panel + 50);
  } else if (size === 'token') {
    const st = statTabs(c, 30, state.stats);
    svg += st.svg;
    html += st.html + nameZone(c, panel + 8, 27) + levelSpeed(c, 22);
    const kws = kwList(c);
    if (kws.length) html += zone('cd-chips left', 18, 22, W - 110, 40, `<span class="cd-chip" style="font-size:21px">${esc(kws[0])}</span>`);
    html += heldInset(c, W - 46, 46, 28);
    if (state.badges) html += zone('cd-chips left cd-badges', 18, 70, W - 36, 40, state.badges);
  }
  if (state.retained) html += zone('cd-chips cd-ret', 16, kind === 'pokemon' ? 70 : 72, W - 32, 40, '<span class="cd-chip ret" style="font-size:20px">Retained</span>');
  if (state.soldOut) html += zone('cd-stamp', 20, 160, W - 40, 80, 'Sold out');
  const cls = ['cd', `cd-${size}`, `k-${kind}`,
    state.playable ? 'cd-ok' : '', state.playable === false ? 'cd-no' : '', state.ready ? 'cd-ready' : '', state.spent ? 'cd-spent' : '',
    c.currentStrength !== undefined && c.currentStrength < c.strength ? 'cd-damaged' : '', holo ? `cd-holo-${holo}` : '', state.selected ? 'cd-sel' : '', state.target ? 'cd-target' : '',
    state.illegal ? 'cd-illegal' : '', state.retained ? 'cd-retained' : '', state.soldOut ? 'cd-soldout' : '', c.hasArt === false ? 'cd-artpending' : '', opts.cls ?? ''].filter(Boolean).join(' ');
  const why = state.playable === false && state.reason ? state.reason : state.illegal ? state.illegalReason : '';
  return `<div class="${cls}" ${opts.attrs ?? ''} style="width:${w}px;height:${Math.round(H * k)}px"${why ? ` data-why="${esc(why)}"` : ''}><div class="cd-in" style="transform:scale(${k.toFixed(4)})">${fr.artDiv}<svg class="cd-fr" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>${html}</div></div>`;
}

// The element (for code that wants a node); the shared defs are added to the document once.
export function renderCard(c, opts = {}) {
  if (typeof document !== 'undefined' && !document.getElementById('cd-defs')) document.body.insertAdjacentHTML('afterbegin', CARD_DEFS);
  const t = document.createElement('template');
  t.innerHTML = cardHTML(c, opts).trim();
  return t.content.firstElementChild;
}
