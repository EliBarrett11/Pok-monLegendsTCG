// The deck selection screen, shown before each match: each deck as a fan of
// its showcase cards, with its name, archetype, specialization, plan and
// three Trainers. The player picks Fire, Water or Random; the AI plays the
// other deck. The last choice is remembered (in this browser only).
import { DECKS, DECK_IDS, TRAINER_CARDS } from '../engine/cardData.js';
import { cardDefinition } from '../engine/cards.js';
import { cardMarkup } from './render.js';

const LAST_DECK = 'plt-last-deck';

// The deck chosen last time, if any. Storage can be missing or blocked.
export function lastDeck() {
  try {
    const id = localStorage.getItem(LAST_DECK);
    return DECK_IDS.includes(id) ? id : null;
  } catch {
    return null;
  }
}

function remember(id) {
  try {
    localStorage.setItem(LAST_DECK, id);
  } catch {
    // Not remembered: the screen still works.
  }
}

export const otherDeck = (id) => DECK_IDS.find((d) => d !== id);
export const randomDeck = (random = Math.random) => DECK_IDS[Math.floor(random() * DECK_IDS.length)];

const TRAINERS = Object.fromEntries(TRAINER_CARDS.map((t) => [t.id, t]));

function deckPanel(deck, last) {
  const fan = deck.showcase.map((id) => cardMarkup({ ...cardDefinition(id), uid: `showcase-${id}` }, 'full')).join('');
  const trainers = deck.trainers.map((id) => {
    const t = TRAINERS[id];
    return `<li title="Power: ${t.power.text}\nPassive: ${t.passive.text}"><span class="trainer-name">${t.name}</span><span class="trainer-str">${t.strength}</span></li>`;
  }).join('');
  return `<section class="deck-option ${deck.id}${deck.id === last ? ' last' : ''}">
    <div class="deck-fan">${fan}</div>
    <h2>${deck.name}</h2>
    <p class="deck-kind">${deck.archetype} · ${deck.specialization}</p>
    <p class="deck-plan">${deck.plan}</p>
    <ul class="deck-trainers">${trainers}</ul>
    <button data-deck="${deck.id}">Play ${deck.name}${deck.id === last ? ' <span class="last-tag">last played</span>' : ''}</button>
  </section>`;
}

// Draws the screen into root; choose(deckId) is called with the player's deck.
export function renderDeckSelect(root, { build, choose }) {
  const last = lastDeck();
  root.innerHTML = `<div class="table deck-select">
    <header class="deck-head">
      <h1>Choose your deck</h1>
      <p class="hint">You play the deck you choose; the AI plays the other. <span class="build-tag">${build ?? ''}</span></p>
    </header>
    <div class="deck-options">${DECK_IDS.map((id) => deckPanel(DECKS[id], last)).join('')}</div>
    <button data-deck="random" class="secondary deck-random">Random</button>
  </div>`;
  for (const button of root.querySelectorAll('[data-deck]')) {
    button.onclick = () => {
      const pick = button.dataset.deck === 'random' ? randomDeck() : button.dataset.deck;
      remember(pick);
      choose(pick);
    };
  }
}
