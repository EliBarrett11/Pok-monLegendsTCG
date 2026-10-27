// The start screen (Play the AI, Play a friend, Two players, one screen) and
// the screens for playing a friend online before the match starts: hosting
// with a room code and invite link, joining, waiting for the friend's deck,
// the deck reveal, a different version, and a lost connection.

const DECK_NAMES = { fire: 'Fire', water: 'Water' };

export function renderStart(root, { build, playAi, playFriend, hotseat }) {
  root.innerHTML = `<div class="table lobby">
    <div class="lobby-box start">
      <h1>Pokémon Legends TCG</h1>
      <p class="lobby-hint">How do you want to play? <span class="build-tag">${build ?? ''}</span></p>
      <div class="start-options">
        <button data-start="ai"><b>Play the AI</b><span>You against the computer</span></button>
        <button data-start="friend"><b>Play a friend</b><span>Online: send them a link</span></button>
        <button data-start="hotseat" class="secondary"><b>Two players, one screen</b><span>Take turns at this computer</span></button>
      </div>
    </div>
  </div>`;
  const go = { ai: playAi, friend: playFriend, hotseat };
  for (const b of root.querySelectorAll('[data-start]')) b.onclick = () => go[b.dataset.start]();
}

// One message screen: a title, some words, optional extras and buttons.
function box(root, { kicker = 'Play a friend', title, text = '', extra = '', buttons = [] }) {
  root.innerHTML = `<div class="table lobby">
    <div class="lobby-box">
      <p class="pass-kicker">${kicker}</p>
      <h1>${title}</h1>
      ${text ? `<p class="lobby-hint">${text}</p>` : ''}
      ${extra}
      ${buttons.length ? `<div class="lobby-buttons">${buttons.map((b, i) => `<button data-b="${i}" class="${b.secondary ? 'secondary' : ''}">${b.label}</button>`).join('')}</div>` : ''}
    </div>
  </div>`;
  for (const el of root.querySelectorAll('[data-b]')) el.onclick = () => buttons[Number(el.dataset.b)].go();
}

// The join-by-code form, under the host's invite.
function joinForm() {
  return `<form class="join-form">
    <label>Got a code from a friend? <input name="code" maxlength="8" autocomplete="off" spellcheck="false" placeholder="HMQXT"></label>
    <button type="submit" class="secondary">Join</button>
  </form>`;
}
function wireJoin(root, join) {
  const form = root.querySelector('.join-form');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    join(form.code.value);
  };
}

// screen: { kind, ... } from main.js. on: back(), join(code), retry(), copy().
export function renderFriend(root, screen, on) {
  const back = { label: 'Back', secondary: true, go: on.back };
  switch (screen.kind) {
    case 'hosting':
      return box(root, { title: 'Setting up…', text: 'Making a room for your match.', buttons: [back] });
    case 'waiting':
      box(root, {
        title: 'Waiting for your friend to join…',
        text: 'Send your friend this link (or the code). The match starts when they open it.',
        extra: `<div class="room-code" aria-label="Room code">${screen.code}</div>
          <div class="invite"><input class="invite-link" readonly value="${screen.link}"><button data-action="copy">${screen.copied ? 'Copied!' : 'Copy'}</button></div>
          ${joinForm()}`,
        buttons: [back],
      });
      root.querySelector('[data-action="copy"]').onclick = on.copy;
      root.querySelector('.invite-link').onclick = (e) => e.target.select();
      wireJoin(root, on.join);
      return undefined;
    case 'joining':
      return box(root, { title: `Joining ${screen.code}…`, text: 'Connecting to your friend.', buttons: [back] });
    case 'error':
      box(root, {
        title: 'Couldn\'t connect',
        text: screen.message,
        extra: screen.canJoin ? joinForm() : '',
        buttons: [...(on.retry ? [{ label: 'Try again', go: on.retry }] : []), back],
      });
      wireJoin(root, on.join);
      return undefined;
    case 'waitingDeck':
      return box(root, {
        kicker: 'Connected',
        title: 'Waiting for your friend to choose…',
        text: `You chose ${DECK_NAMES[screen.deck] ?? screen.deck}. Both decks are revealed once you've both chosen.`,
        buttons: [{ label: 'Leave', secondary: true, go: on.back }],
      });
    case 'reveal':
      return box(root, {
        kicker: 'Connected',
        title: `${DECK_NAMES[screen.mine]} vs ${DECK_NAMES[screen.theirs]}`,
        text: `You play ${DECK_NAMES[screen.mine]}; your friend plays ${DECK_NAMES[screen.theirs]}.${screen.mine === screen.theirs ? ' A mirror match!' : ''} Next: place your Trainers, then the coin flip for initiative.`,
      });
    case 'mismatch':
      return box(root, {
        title: 'Your friend is on a different version',
        text: 'Both refresh the page, then try again.',
        extra: `<p class="lobby-small">You: ${screen.mine ?? '?'} · Your friend: ${screen.theirs ?? 'an older version'}</p>`,
        buttons: [{ label: 'Refresh', go: () => location.reload() }, back],
      });
    case 'closed':
      return box(root, { title: 'Your friend has left', text: 'The connection to your friend was lost.', buttons: [{ label: 'Back to the start', go: on.back }] });
    default:
      return undefined;
  }
}
