// The V0 page: "Pokémon Legends v2 — in development", laid out like the approved
// board concept (docs/v2-design.md 7b): facing rows of 9 unlit Home spaces, each
// player's Recognition on the left, the side panel on the right, a fanned hand.
// The cards in the hand are previews of the full-art, minimal-stats look, drawn
// from v1's card data and art (shared, read-only). Nothing here is playable yet.
import { POKEMON_CARDS } from '../../../src/engine/cardData.js';
import { LANES, RECOGNITION_TARGET, ROUND_LIMIT, CHAMPIONSHIP_ROUND } from '../engine/rules.js';

// Paths from the page (v2/index.html) to the shared assets at the repository root.
const ASSETS = '../assets';
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
const PREVIEW = ['horsea', 'charmander', 'bulbasaur', 'growlithe', 'oddish', 'goldeen'];

function previewCard(card, i, n) {
  const angle = (i - (n - 1) / 2) * 4;
  const lift = Math.abs(i - (n - 1) / 2) * 5;
  return `
    <div class="v2-card" style="transform: translateY(${lift}px) rotate(${angle}deg)">
      <div class="v2-art" style="background-image: url('${ASSETS}/cards/${card.id}.jpg')"></div>
      <span class="v2-level">Lv 1</span>
      <img class="v2-type" src="${ASSETS}/ui/icons/type-${slug(card.pokemonType)}.webp" alt="${card.pokemonType}">
      <div class="v2-name">${card.name}</div>
      <div class="v2-stats"><span>⚔ ${card.attackValue}</span><span>♥ ${card.strengthValue}</span></div>
    </div>`;
}

function recognition(who, cls) {
  return `
    <section class="v2-panel v2-recognition ${cls}">
      <div class="v2-avatar"></div>
      <h3>${who}</h3>
      <div class="v2-label">Recognition</div>
      <b class="v2-score">0</b>
      <div class="v2-of">of ${RECOGNITION_TARGET} to win</div>
      <div class="v2-bar"><i style="width: 0%"></i></div>
    </section>`;
}

function row(side) {
  return `<div class="v2-row ${side}">${Array.from({ length: LANES }, () => '<div class="v2-space"><span>Home</span></div>').join('')}</div>`;
}

export function renderPlaceholder(root, { build }) {
  const cards = PREVIEW.map((id) => POKEMON_CARDS.find((c) => c.id === id)).filter(Boolean);
  root.innerHTML = `
    <div class="v2-table">
      <header class="v2-title">
        <h1>Pokémon Legends v2</h1>
        <p>In development · <a href="../">play the current game</a></p>
      </header>
      ${recognition('Opponent', 'top')}
      ${recognition('You', 'bottom')}
      <section class="v2-board">
        <div class="v2-mat"></div>
        ${row('opponent')}
        <div class="v2-banner">
          <h2>Pokémon Legends v2 — in development</h2>
          <p>A Trainer's career, from the first day to becoming a legend. Locations across shared lanes,
            Pokémon trained from Level 1 to 6, Trainers who grow with you, and Recognition to win.</p>
          <a class="v2-button" href="../">Play the current game</a>
        </div>
        ${row('player')}
      </section>
      <aside class="v2-side">
        <section class="v2-panel"><div class="v2-label">Round</div><b class="v2-big">— <small>of ${ROUND_LIMIT}</small></b></section>
        <section class="v2-panel v2-champ"><div class="v2-label">Championship</div><p>Arrives for both players in <b>Round ${CHAMPIONSHIP_ROUND}</b>: the final Location, across every lane.</p></section>
        <section class="v2-panel"><div class="v2-label">Energy</div><b class="v2-big">— <small>+ stored</small></b></section>
        <section class="v2-panel"><div class="v2-label">Trainer Points</div><b class="v2-big">★ —</b></section>
        <section class="v2-panel"><div class="v2-label">Bag</div><div class="v2-bag"><i></i><i></i><i></i></div><p class="v2-note">Items found at Locations</p></section>
        <section class="v2-panel"><div class="v2-label">Weather</div><p class="v2-note">Rain and Sun, from Locations</p></section>
        <div class="v2-build">${build}</div>
      </aside>
      <div class="v2-hand">${cards.map((c, i) => previewCard(c, i, cards.length)).join('')}</div>
    </div>`;
}
