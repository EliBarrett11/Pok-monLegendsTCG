// Short, readable moments for Location milestones, completions, the Championship's
// arrival, sudden death and Locations ending (V2; simple for now, full VFX in V8).
// They live outside the redrawn board, so a redraw doesn't cut them short.
import { NAMES } from '../engine/game.js';
import { rewardText } from '../engine/locations.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// The toasts a list of engine events calls for: [{ title, text, color, big }].
export function toastsFor(state, events) {
  const out = [];
  const color = (uid) => state.locations.find((l) => l.uid === uid)?.color;
  for (const e of events) {
    const who = NAMES[e.who];
    if (e.type === 'milestone') out.push({ title: `Milestone · ${e.name}`, text: `${who} reached ${e.at}/${e.count}: ${rewardText(e.reward)}`, color: color(e.location) });
    else if (e.type === 'completed') out.push({ title: `${e.name} complete!`, text: `${who}: ${rewardText(e.reward)}`, color: color(e.location), big: e.championship });
    else if (e.type === 'championship') out.push({ title: 'The Championship arrives!', text: 'Every other Location ends. It covers all 9 lanes until the end of Round 12.', color: '#f6d36a', big: true });
    else if (e.type === 'itemFound') out.push({ title: `${who === 'You' ? 'You found' : 'The Opponent found'} an Item`, text: `${e.name}, into the Bag`, color: '#8fd0ff' });
    else if (e.type === 'supporter' && e.favour) out.push({ title: `Favour · ${e.name}`, text: `${who === 'You' ? 'Your' : 'Their'} Release met the Favour: the effect improves`, color: '#c99aff' });
    else if (e.type === 'tierUnlocked') out.push({ title: `${e.name}: ${e.kind} unlocked`, text: `${who === 'You' ? 'Your' : "The Opponent's"} Trainer · ${e.text}`, color: '#f6d36a', big: e.kind === 'Partner' });
    else if (e.type === 'partnerArrived') out.push({ title: `${e.trainer}'s Partner arrives!`, text: `${e.name}, Level ${e.level}, for ${who === 'You' ? 'you' : 'the Opponent'}`, color: '#f6d36a', big: true });
    else if (e.type === 'partnerWaiting' && e.who === 'player') out.push({ title: `${e.name} is waiting`, text: `Its Trainer's space is taken: choose a free space on your turn`, color: '#f6d36a' });
    else if (e.type === 'trainerPoints' && e.who === 'player') out.push({ title: `+${e.amount} Trainer Point${e.amount === 1 ? '' : 's'}`, text: `From ${e.why}: assign at the next Breakfast`, color: '#f6d36a' });
    else if (e.type === 'suddenDeath') out.push({ title: 'Sudden death!', text: 'Tied on Recognition and Championship progress: one more Round.', color: '#f6d36a', big: true });
  }
  return out;
}

export function showToasts(container, toasts, { pace = 450 } = {}) {
  toasts.forEach((t, i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = `v2-toast${t.big ? ' big' : ''}`;
      if (t.color) el.style.setProperty('--loc', t.color);
      el.innerHTML = `<b>${esc(t.title)}</b><span>${esc(t.text)}</span>`;
      container.appendChild(el);
      // At most two at once, so they never bury the board.
      while (container.children.length > 2) container.firstElementChild.remove();
      el.addEventListener('animationend', () => el.remove());
    }, i * pace);
  });
}
