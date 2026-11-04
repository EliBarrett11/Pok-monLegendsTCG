// v2's screens around a match (V9), in v2's look: choosing a deck in secret (hot-seat and
// online), "Pass to Player 2" (hot-seat), and the online lobby (hosting with a room code and
// invite link, joining, waiting, version mismatch, a full room, errors) with the connection
// indicator, banner and toasts over the board. The flows are the current game's
// (src/ui/lobby.js, src/ui/deckSelect.js, src/ui/passScreen.js); the markup is v2's own.
import { DECKS } from '../engine/cards.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const DECK_NOTES = {
  fire: 'Aggressive: Burn and fast pressure on the enemy player.',
  water: 'Board-based: sturdy Pokémon that heal and outlast.',
  grass: 'Growth: Nurture, evolve and Solar Beam.',
};
const frame = (inner, cls = '') => `<div class="v2-lobby ${cls}"><div class="v2-panel v2-lobby-box">${inner}</div></div>`;

// Choosing a deck in secret: Fire, Water, Grass or Random (resolved here, never sent as "random").
export function renderDeckPick(root, { title, kicker, note, back, choose, backLabel = 'Back' }) {
  const decks = Object.entries(DECKS).map(([id, d]) => `<button class="v2-deck-btn ${id}" data-deck="${id}"><b>${esc(d.name)}</b><span>${esc(DECK_NOTES[id] ?? '')}</span></button>`).join('');
  root.innerHTML = frame(`
    ${kicker ? `<p class="v2-kicker">${esc(kicker)}</p>` : ''}
    <h2>${esc(title)}</h2>
    ${note ? `<p class="v2-lobby-note">${note}</p>` : ''}
    <div class="v2-deck-row">${decks}<button class="v2-deck-btn random" data-deck="random"><b>Random</b><span>One of the three, picked for you.</span></button></div>
    ${back ? `<button class="v2-linkbtn" data-action="back">${esc(backLabel)}</button>` : ''}`);
  root.querySelectorAll('[data-deck]').forEach((b) => { b.onclick = () => {
    const ids = Object.keys(DECKS);
    choose(b.dataset.deck === 'random' ? ids[Math.floor(Math.random() * ids.length)] : b.dataset.deck);
  }; });
  root.querySelector('[data-action="back"]')?.addEventListener('click', back);
}

// Hot-seat: shown whenever control passes to the other player. Nothing of the board is drawn
// behind it, so nothing of the last player's hand stays on screen.
export function renderPassScreen(root, { name, from, what = 'take over', ready }) {
  root.innerHTML = frame(`
    <p class="v2-kicker">Two players, one screen</p>
    <h2>Pass to ${esc(name)}</h2>
    <p class="v2-lobby-note">${esc(from)}, look away now. ${esc(name)}, click when you're ready to ${esc(what)}.</p>
    <button class="v2-big-btn" data-action="ready">I'm ready</button>`, 'pass');
  root.querySelector('[data-action="ready"]').onclick = ready;
}

// The online lobby, by screen kind.
export function renderFriend(root, screen, { back, join, retry, copy, chooseDeck }) {
  const leave = `<button class="v2-linkbtn" data-action="back">${screen.kind === 'decks' || screen.kind === 'waitingDeck' ? 'Leave' : 'Back'}</button>`;
  let inner = '';
  switch (screen.kind) {
    case 'hosting':
      inner = '<p class="v2-kicker">Play a friend online</p><h2>Opening a room…</h2><p class="v2-lobby-note">Getting a room code from the connection server.</p>';
      break;
    case 'waiting':
      inner = `<p class="v2-kicker">Play a friend online · you host</p>
        <h2>Room <span class="v2-code">${esc(screen.code)}</span></h2>
        <p class="v2-lobby-note">${screen.gone ? 'Your friend disconnected: waiting for them to come back with the same link…' : 'Send your friend this invite link (or the room code). The match starts once you have both chosen a deck.'}</p>
        <div class="v2-invite"><input class="invite-link" readonly value="${esc(screen.link)}"><button data-action="copy">${screen.copied ? 'Copied!' : 'Copy link'}</button></div>
        <p class="v2-lobby-note small">v2 rooms are separate from the current game's: this link opens v2.</p>`;
      break;
    case 'joining':
      inner = `<p class="v2-kicker">Play a friend online</p><h2>Joining room <span class="v2-code">${esc(screen.code)}</span>…</h2><p class="v2-lobby-note">Connecting to your friend.</p>`;
      break;
    case 'reconnecting':
      inner = '<p class="v2-kicker">Play a friend online</p><h2>Reconnecting…</h2><p class="v2-lobby-note">Your friend\'s connection dropped: trying again.</p>';
      break;
    case 'decks':
      renderDeckPick(root, {
        kicker: 'Play a friend online', title: 'Choose your deck',
        note: `In secret: your friend sees only that you've chosen. Mirrors are allowed. ${screen.friendLocked ? '<b class="v2-ok">Your friend has chosen.</b>' : 'Your friend is still choosing.'}`,
        choose: chooseDeck, back, backLabel: 'Leave',
      });
      return;
    case 'waitingDeck':
      inner = `<p class="v2-kicker">Play a friend online</p><h2>You chose ${esc(DECKS[screen.deck]?.name ?? screen.deck)}</h2><p class="v2-lobby-note">Waiting for your friend to choose theirs…</p>`;
      break;
    case 'reveal':
      inner = `<p class="v2-kicker">Play a friend online</p><h2>${esc(DECKS[screen.mine]?.name)} <small>vs</small> ${esc(DECKS[screen.theirs]?.name)}</h2><p class="v2-lobby-note">Both decks are in. The coin decides who has initiative…</p>`;
      break;
    case 'mismatch':
      inner = `<p class="v2-kicker">Play a friend online</p><h2>Different versions</h2>
        <p class="v2-lobby-note">You and your friend need the same version of the game. Yours: <b>${esc(screen.mine)}</b>. Theirs: <b>${esc(screen.theirs ?? 'unknown (another game, or an older one)')}</b>. Both reload the page, then try again.</p>`;
      break;
    case 'full':
      inner = '<p class="v2-kicker">Play a friend online</p><h2>That room is full</h2><p class="v2-lobby-note">It already has its two players.</p>';
      break;
    case 'error':
      inner = `<p class="v2-kicker">Play a friend online</p><h2>Couldn't connect</h2><p class="v2-lobby-note">${esc(screen.message)}</p>
        ${retry ? '<button class="v2-big-btn" data-action="retry">Try again</button>' : ''}`;
      break;
    default:
      inner = '<h2>…</h2>';
  }
  const canJoin = screen.canJoin || screen.kind === 'error';
  root.innerHTML = frame(`${inner}
    ${canJoin ? '<div class="v2-join"><input class="v2-join-code" maxlength="8" placeholder="Room code"><button data-action="join">Join</button></div>' : ''}
    ${leave}`);
  root.querySelector('[data-action="back"]').onclick = back;
  root.querySelector('[data-action="copy"]')?.addEventListener('click', copy);
  root.querySelector('[data-action="retry"]')?.addEventListener('click', retry);
  root.querySelector('[data-action="join"]')?.addEventListener('click', () => join(root.querySelector('.v2-join-code').value));
}

// Over the board: a connection dot (green / amber / red), a banner while the friend is away,
// and short toasts ("Your friend reconnected").
export function renderNetStatus(stage, status) {
  let el = stage.querySelector('.v2-net');
  if (!status) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'v2-net';
    stage.appendChild(el);
  }
  const label = { good: 'Connected', slow: 'Slow connection', lost: 'Disconnected', reconnecting: 'Reconnecting…' }[status.health] ?? status.health;
  el.innerHTML = `<span class="v2-net-dot ${esc(status.health)}" title="${esc(label)}"></span><span class="v2-net-label">${esc(label)}</span>
    ${status.banner ? `<div class="v2-net-banner">${esc(status.banner)}</div>` : ''}
    ${status.toast ? `<div class="v2-net-toast">${esc(status.toast)}</div>` : ''}`;
}
