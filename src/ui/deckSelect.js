// The deck selection screen, shown before each match: each deck as a fan of
// its showcase cards, with its name, archetype, specialization, plan and
// three Trainers. The player picks Fire, Water, Grass or Random, and against
// the AI also the AI's deck (Random by default; mirrors allowed). The last
// choices are remembered (in this browser only).
// Hot-seat and online: each player picks in secret, any deck (mirrors allowed).
import { DECKS, DECK_IDS, TRAINER_CARDS } from '../engine/cardData.js';
import { cardDefinition } from '../engine/cards.js';
import { cardMarkup } from './render.js';

const LAST_DECK = 'plt-last-deck';
const LAST_OPPONENT = 'plt-last-opponent';

// The deck chosen last time, if any. Storage can be missing or blocked.
export function lastDeck() {
  try {
    const id = localStorage.getItem(LAST_DECK);
    return DECK_IDS.includes(id) ? id : null;
  } catch {
    return null;
  }
}

// The AI's deck chosen last time: a deck id or 'random' (the default).
export function lastOpponent() {
  try {
    const id = localStorage.getItem(LAST_OPPONENT);
    return DECK_IDS.includes(id) ? id : 'random';
  } catch {
    return 'random';
  }
}

function remember(key, id) {
  try {
    localStorage.setItem(key, id);
  } catch {
    // Not remembered: the screen still works.
  }
}

export const otherDeck = (id) => DECK_IDS.find((d) => d !== id);
export const randomDeck = (random = Math.random) => DECK_IDS[Math.floor(random() * DECK_IDS.length)];
// The AI's deck for a choice of 'random' or a deck id.
export const opponentDeck = (choice, random = Math.random) => (DECK_IDS.includes(choice) ? choice : randomDeck(random));

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

// Draws the screen into root; choose(deckId, opponent) is called with the
// player's deck (and, against the AI, the AI's: a deck id or 'random').
// back() returns to the start screen. Hot-seat: `who` is the name of the
// player choosing (nothing is remembered or marked, so the other player can't
// see the pick). Online: `online` is set, and friendLocked once the friend has
// chosen (not what).
export function renderDeckSelect(root, { build, choose, back, who, online, friendLocked }) {
  const last = who ? null : lastDeck();
  const hint = online
    ? `Connected to your friend. Choose in secret: both decks are revealed once you've both chosen. You may both pick the same deck.${friendLocked ? ' <b class="friend-chose">Your friend has chosen.</b>' : ''}`
    : who ? 'Choose in secret: the other player won\'t see it until the match starts. You may both pick the same deck.'
      : 'You play the deck you choose; pick the AI\'s deck below (Random by default; the same deck is allowed).';
  const vsAi = !who && !online;
  let opponent = vsAi ? lastOpponent() : null;
  const opponentRow = vsAi ? `<div class="deck-opponent" role="radiogroup" aria-label="The AI's deck"><span>AI plays:</span>
    ${['random', ...DECK_IDS].map((id) => `<button data-opponent="${id}" class="secondary${id === opponent ? ' chosen' : ''}" aria-pressed="${id === opponent}">${id === 'random' ? 'Random' : DECKS[id].name}</button>`).join('')}
  </div>` : '';
  root.innerHTML = `<div class="table deck-select${who ? ' hotseat' : ''}${online ? ' online' : ''}">
    <header class="deck-head">
      <h1>${who ? `${who}, choose your deck` : 'Choose your deck'}</h1>
      <p class="hint">${hint} <span class="build-tag">${build ?? ''}</span></p>
    </header>
    <div class="deck-options">${DECK_IDS.map((id) => deckPanel(DECKS[id], last)).join('')}</div>
    <div class="deck-foot">
      <button data-deck="random" class="secondary deck-random">Random</button>
      ${opponentRow}
      ${back ? `<button data-action="back" class="secondary deck-mode">${online ? 'Leave' : 'Back'}</button>` : ''}
    </div>
  </div>`;
  for (const button of root.querySelectorAll('[data-deck]')) {
    button.onclick = () => {
      const pick = button.dataset.deck === 'random' ? randomDeck() : button.dataset.deck;
      if (!who) remember(LAST_DECK, pick);
      if (vsAi) remember(LAST_OPPONENT, opponent);
      choose(pick, opponent ?? undefined);
    };
  }
  for (const button of root.querySelectorAll('[data-opponent]')) {
    button.onclick = () => {
      opponent = button.dataset.opponent;
      for (const b of root.querySelectorAll('[data-opponent]')) {
        b.classList.toggle('chosen', b === button);
        b.setAttribute('aria-pressed', String(b === button));
      }
    };
  }
  const leave = root.querySelector('[data-action="back"]');
  if (leave) leave.onclick = back;
}
