// The new-game setup screen (v2 Feedback A): its own full-stage screen, shown before every
// match against the AI and after New match, in the approved look. Three large mode choices
// (Play the AI · Two players, one screen · Play a friend online); against the AI, the deck
// choice as big deck cards (Fire, Water, Grass, Random, and Your deck when one is built) with
// each deck's art, name and one-line plan, for You and for the AI; a clear Start button (the
// coin flip follows); and a link to the Deck builder. Hot-seat and online keep their own
// lobby and secret-pick steps (lobby.js), in the same style.
import { DECKS } from '../engine/cards.js';

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const DECK_LOOK = {
  fire: { art: 'entei', plan: 'Aggressive: Burn and fast pressure on the enemy player.' },
  water: { art: 'kyogre', plan: 'Board-based: sturdy Pokémon that heal and outlast.' },
  grass: { art: 'celebi', plan: 'Growth: Nurture, evolve, and a big Solar Beam.' },
  random: { art: null, plan: 'One of the three, picked for you at the start.' },
  custom: { art: null, plan: 'The deck you built in the Deck builder.' },
};
const deckArt = (id) => (DECK_LOOK[id]?.art ? `${ASSETS}/cards/${DECK_LOOK[id].art}.jpg` : `${ASSETS}/ui/card-back.jpg`);

function deckCard(who, id, name, chosen) {
  return `<button class="v2-setup-deck ${id}${chosen ? ' chosen' : ''}" data-setup-deck="${who}" data-value="${id}" aria-pressed="${chosen}">
    <span class="v2-setup-art" style="background-image: url('${deckArt(id)}')"></span>
    <b>${esc(name)}</b><span class="v2-setup-plan">${esc(DECK_LOOK[id]?.plan ?? '')}</span>
  </button>`;
}

function deckRow(who, label, choice, custom) {
  const ids = [...Object.keys(DECKS), 'random', ...(custom ? ['custom'] : [])];
  const names = { random: 'Random', custom: 'Your deck' };
  return `<section class="v2-setup-row"><h3>${esc(label)}</h3>
    <div class="v2-setup-decks n${ids.length}">${ids.map((id) => deckCard(who, id, DECKS[id]?.name ?? names[id], choice === id)).join('')}</div></section>`;
}

// handlers: { ai(), hotseat(), online(), setDeck(who, id), start(), deck(), resume? }
export function renderSetup(root, { deckChoice, customDeck, build, resume, handlers }) {
  const mode = (id, title, sub, on) => `<button class="v2-setup-mode${on ? ' on' : ''}" data-setup-mode="${id}"><b>${title}</b><span>${sub}</span></button>`;
  root.innerHTML = `<div class="v2-setup">
    <header class="v2-setup-head"><h1>Pokémon Legends v2</h1><p>${esc(build)} · <a href="../">the current game</a></p></header>
    <div class="v2-setup-modes">
      ${mode('ai', 'Play the AI', 'Choose both decks and play the computer.', true)}
      ${mode('hotseat', 'Two players, one screen', 'Each picks a deck in secret; pass the screen between turns.', false)}
      ${mode('online', 'Play a friend online', 'Host a room and send your friend the invite link.', false)}
    </div>
    ${deckRow('player', 'Your deck', deckChoice.player, customDeck)}
    ${deckRow('ai', "The AI's deck", deckChoice.ai, false)}
    <footer class="v2-setup-foot">
      <button class="v2-linkbtn" data-setup="deck">${customDeck ? 'Edit your deck (Deck builder)' : 'Deck builder'}</button>
      ${resume ? `<button class="v2-linkbtn" data-setup="resume">Resume your online match (room ${esc(resume.code)}, Round ${resume.round})</button>` : ''}
      <button class="v2-setup-start" data-setup="start">Start<small>then the coin flip</small></button>
    </footer>
  </div>`;
  root.querySelectorAll('[data-setup-mode]').forEach((b) => { b.onclick = () => handlers[b.dataset.setupMode]?.(); });
  root.querySelectorAll('[data-setup-deck]').forEach((b) => { b.onclick = () => handlers.setDeck(b.dataset.setupDeck, b.dataset.value); });
  root.querySelector('[data-setup="start"]').onclick = handlers.start;
  root.querySelector('[data-setup="deck"]').onclick = handlers.deck;
  root.querySelector('[data-setup="resume"]')?.addEventListener('click', handlers.resume);
}
