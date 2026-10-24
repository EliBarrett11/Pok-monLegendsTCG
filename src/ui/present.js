// Plays an action's events back on screen, one beat after another: cards
// revealed and moved, attacks, floating numbers, defeats and banners.
//
// The engine has already worked out the whole result (next state). This only
// decides how to show the change from the previous state to the next one,
// using the Web Animations API on the persistent card elements (see
// adoptCards in render.js), plus a separate effects layer (#fx) for
// reveals, arrows, numbers and cards on their way to a pile.

import { setCaption, cardElements, cardMarkup, STAGE } from './render.js';
import { speedFactor } from './settings.js';

// --- Timing and skipping -----------------------------------------------------------

let skipping = false;
const running = new Set();   // animations still playing
const waiters = new Set();   // pauses still waiting

// Skips to the end of the action being shown (its caption still updates).
export function skip() {
  skipping = true;
  for (const a of running) a.finish();
  for (const done of [...waiters]) done();
}

function wait(ms) {
  if (ms <= 0 || skipping) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(id); waiters.delete(done); resolve(); };
    const id = setTimeout(done, ms);
    waiters.add(done);
  });
}

async function animate(el, frames, ms, options = {}) {
  if (!el || ms <= 0 || skipping) return;
  const a = el.animate(frames, { duration: ms, easing: 'ease-in-out', ...options });
  running.add(a);
  try {
    await a.finished;
  } catch {
    // cancelled
  } finally {
    running.delete(a);
  }
}

// The opponent's pause before each visible action.
export async function think(stage) {
  stage.classList.add('ai-thinking');
  skipping = false;
  await wait(600 * speedFactor());
  stage.classList.remove('ai-thinking');
}

// --- Geometry (everything in stage pixels) -------------------------------------------

const stageEl = () => document.getElementById('stage');
const fxEl = () => document.getElementById('fx');

function rectOf(el) {
  const s = stageEl().getBoundingClientRect();
  const scale = s.width / STAGE.width;
  const b = el.getBoundingClientRect();
  return { x: (b.left - s.left) / scale, y: (b.top - s.top) / scale, w: b.width / scale, h: b.height / scale };
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// The card element for a uid, if it is on screen now.
function shown(uid) {
  const el = uid && cardElements().get(uid);
  return el?.isConnected ? el : null;
}

function pile(root, name) {
  return root.querySelector(`[data-pile="${name}"]`);
}

// Puts an element in the effects layer at a stage rectangle.
function placeInFx(el, r) {
  fxEl().append(el);
  const w = el.offsetWidth || r.w;
  const h = el.offsetHeight || r.h;
  el.style.cssText = `position:absolute;left:${r.x}px;top:${r.y}px;margin:0;transform-origin:0 0;transform:scale(${r.w / w},${r.h / h})`;
  return { sx: r.w / w, sy: r.h / h };
}

// Animates an element from rectangle `from` to where it is now (FLIP).
function flyFrom(el, from, ms, { fade = false, base = 'none' } = {}) {
  const to = rectOf(el);
  if (!to.w || !to.h) return Promise.resolve();
  if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1 && Math.abs(from.w - to.w) < 1) return Promise.resolve();
  const start = `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.w / to.w}, ${from.h / to.h}) ${base === 'none' ? '' : base}`;
  return animate(el, [
    { transformOrigin: '0 0', transform: start, opacity: fade ? 0 : 1 },
    { transformOrigin: '0 0', transform: base, opacity: 1 },
  ], ms);
}

// --- Effects ----------------------------------------------------------------------------

const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

function floatNumber(r, text, kind, ms) {
  if (ms <= 0 || skipping) return;
  const n = document.createElement('div');
  n.className = `fx-num ${kind}`;
  n.textContent = text;
  n.style.left = `${r.x + r.w / 2}px`;
  n.style.top = `${r.y + r.h * 0.3}px`;
  fxEl().append(n);
  const a = n.animate([
    { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
    { transform: 'translate(-50%, -12px) scale(1.15)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%, -24px) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%, -56px) scale(1)', opacity: 0 },
  ], { duration: ms, easing: 'ease-out' });
  a.onfinish = () => n.remove();
  a.oncancel = () => n.remove();
}

function numberFor(e) {
  if (e.type === 'damage') return [`−${e.amount}`, 'damage'];
  if (e.type === 'heal') return e.amount > 0 ? [`+${e.amount}`, 'heal'] : null;
  if (e.type === 'buff') {
    const parts = [e.attack && `${signed(e.attack)} ATK`, e.strength && `${signed(e.strength)} STR`].filter(Boolean);
    return parts.length ? [parts.join(' '), 'buff'] : null;
  }
  return null;
}

// Floating numbers for the events whose card is on screen now. Returns the events shown.
function showNumbers(events, done, t) {
  for (const e of events) {
    if (done.has(e)) continue;
    const num = numberFor(e);
    const el = num && shown(e.target?.uid);
    if (!el) continue;
    done.add(e);
    floatNumber(rectOf(el), num[0], num[1], t(1100));
  }
}

async function banner(text, ms, kind = '') {
  if (ms <= 0 || skipping) return;
  const b = document.createElement('div');
  b.className = `fx-banner ${kind}`;
  b.textContent = text;
  fxEl().append(b);
  await animate(b, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.85)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.2 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.05)' },
  ], ms);
  b.remove();
}

function arrow(from, to) {
  const a = centre(from);
  const b = centre(to);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'fx-arrow');
  svg.setAttribute('viewBox', `0 0 ${STAGE.width} ${STAGE.height}`);
  svg.innerHTML = `<defs><marker id="fx-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#e0574f"/></marker></defs>
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#e0574f" stroke-width="7" stroke-linecap="round" marker-end="url(#fx-head)"/>`;
  fxEl().append(svg);
  return svg;
}

function glow(el, cls) {
  el?.classList.add(cls);
}

// --- Before the new state is drawn: the action itself ------------------------------------

// Reveals sit over the acting player's half of the board, clear of the caption.
const REVEAL = { cx: 780, w: 272, cy: { ai: 268, player: 742 } };

// Shows a card face-up and large in the middle of the board.
async function reveal(root, prev, e, t) {
  let el = shown(e.uid);
  let from;
  if (el) {
    from = rectOf(el);
  } else {
    const card = prev.players[e.who].hand.find((c) => c.uid === e.uid)
      ?? prev.players[e.who].bag.find((c) => c.uid === e.uid);
    if (!card) return;
    const box = document.createElement('div');
    box.innerHTML = cardMarkup(card, 'hand');
    el = box.firstElementChild;
    el.style.left = '0';
    cardElements().set(e.uid, el);
    const hand = pile(root, `${e.who}-hand`) ?? pile(root, `${e.who}-draw`);
    from = hand ? rectOf(hand) : { x: REVEAL.cx, y: 0, w: 40, h: 56 };
    from = { x: from.x, y: from.y, w: 40, h: 56 };
  }
  el.classList.remove('selected', 'selectable', 'unavailable');
  fxEl().append(el);
  const ratio = el.offsetHeight / el.offsetWidth;
  const h = REVEAL.w * ratio;
  const r = { x: REVEAL.cx - REVEAL.w / 2, y: REVEAL.cy[e.who] - h / 2, w: REVEAL.w, h };
  const { sx } = placeInFx(el, r);
  el.classList.add('fx-revealed');
  const panel = revealPanel(e, r);
  await flyFrom(el, from, t(320), { fade: !shown(e.uid), base: `scale(${sx})` });
  const target = shown(e.target?.uid);
  glow(target, 'fx-target');
  await wait(t(950));
  panel?.remove();
}

// Under a revealed Supporter: the cards paid and whether the Gift was met.
function revealPanel(e, r) {
  if (e.cardType !== 'Supporter' && !(e.cardType === 'Item')) return null;
  const p = document.createElement('div');
  p.className = 'fx-panel';
  if (e.cardType === 'Supporter') {
    const paid = [e.paid.discard.length && `Discarded: ${e.paid.discard.join(', ')}`,
      e.paid.release.length && `Released: ${e.paid.release.join(', ')}`].filter(Boolean).join('<br>');
    p.innerHTML = `${paid}<div class="${e.gift.met ? 'met' : 'unmet'}">Gift ${e.gift.met ? `met ✓ ${e.gift.bonus}` : 'not met'}</div>`;
  } else {
    p.innerHTML = `Bought for $${e.cost}${e.to.kind === 'bag' ? ' · stored in the Bag' : ''}`;
  }
  // Beside the card, so it never covers the caption.
  p.style.left = `${r.x + r.w + 16}px`;
  p.style.top = `${r.y + r.h / 2}px`;
  fxEl().append(p);
  return p;
}

async function attack(e, t) {
  const from = shown(e.attacker.uid);
  const to = shown(e.target.uid);
  if (!from || !to) return;
  glow(from, 'fx-attacker');
  glow(to, 'fx-target');
  const a = rectOf(from);
  const b = rectOf(to);
  const line = arrow(a, b);
  await animate(line, [{ opacity: 0 }, { opacity: 1 }], t(220));
  const dx = (centre(b).x - centre(a).x) * 0.35;
  const dy = (centre(b).y - centre(a).y) * 0.35;
  await animate(from, [
    { transform: 'none' },
    { transform: `translate(${dx}px, ${dy}px) scale(1.06)`, offset: 0.45 },
    { transform: 'none' },
  ], t(300));
  line.remove();
}

async function power(e, t) {
  const trainer = shown(e.uid);
  glow(trainer, 'fx-power');
  await animate(trainer, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], t(450));
  glow(shown(e.target?.uid), 'fx-target');
  await wait(t(250));
}

async function before(root, prev, next, actor, t, numbersDone) {
  const ev = next.events;
  const main = ev.find((e) => ['cardPlayed', 'itemUsed', 'attack', 'powerUsed', 'pass', 'choiceMade', 'itemBought'].includes(e.type));
  if (main?.type === 'cardPlayed' || main?.type === 'itemUsed') await reveal(root, prev, { ...main, cardType: main.cardType ?? 'Item', to: main.to ?? { kind: 'use' } }, t);
  else if (main?.type === 'itemBought') {
    glow(shown(main.uid), 'fx-target');
    await wait(t(450));
  } else if (main?.type === 'attack') await attack(main, t);
  else if (main?.type === 'powerUsed') await power(main, t);
  else if (main?.type === 'choiceMade' && main.target) {
    glow(shown(main.target.uid), 'fx-target');
    await wait(t(400));
  } else if (main?.type === 'pass') {
    await banner(`${actor === 'player' ? 'You pass' : 'Opponent passes'}`, t(850), actor);
  }

  // Damage lands on the cards as they are now; defeated ones fade.
  showNumbers(ev.filter((e) => e.type === 'damage'), numbersDone, t);
  if (ev.some((e) => e.type === 'damage')) await wait(t(380));
  const defeated = ev.filter((e) => e.type === 'defeated').map((e) => shown(e.target.uid)).filter(Boolean);
  await Promise.all(defeated.map((el) => animate(el, [{ opacity: 1, filter: 'none' }, { opacity: 0.3, filter: 'grayscale(1)' }], t(380), { fill: 'forwards' })));
  for (const el of defeated) el.dataset.fading = '1';
}

// --- After the new state is drawn: cards move to their new places --------------------------

// Where every card on screen is, before the new state is drawn.
function snapshot() {
  const snap = new Map();
  for (const [uid, el] of cardElements()) {
    if (el.isConnected) snap.set(uid, { el, rect: rectOf(el) });
  }
  return snap;
}

function destination(root, uid, events) {
  const attached = events.find((e) => e.type === 'itemAttached' && e.item.uid === uid);
  if (attached) return shown(attached.target.uid) ?? root.querySelector(`.side.${attached.target.owner === 'ai' ? 'opponent' : 'player'}`);
  const moved = events.filter((e) => e.type === 'cardMoved' && e.uid === uid).at(-1);
  if (!moved) return null;
  if (moved.to === 'mart') return root.querySelector('.mart');
  return pile(root, `${moved.owner}-${moved.to}`);
}

async function after(root, snap, next, actor, t, numbersDone) {
  const ev = next.events;
  const moves = [];
  // Cards still on screen glide to their new place; new ones arrive from a pile.
  for (const fresh of root.querySelectorAll('.card[data-uid]')) {
    const was = snap.get(fresh.dataset.uid);
    if (was?.el === fresh) {
      moves.push(flyFrom(fresh, was.rect, t(380)));
    } else if (!was) {
      const mine = fresh.closest('.hand');
      const theirs = fresh.closest('.side.opponent');
      const from = mine ? pile(root, 'player-draw') : theirs ? pile(root, 'ai-hand') : null;
      if (from) {
        const r = rectOf(from);
        moves.push(flyFrom(fresh, { x: r.x, y: r.y, w: fresh.offsetWidth * 0.3, h: fresh.offsetHeight * 0.3 }, t(380), { fade: true }));
      } else {
        moves.push(animate(fresh, [{ opacity: 0 }, { opacity: 1 }], t(300)));
      }
    }
  }
  // Cards that left the screen fly to their pile (or fade where they were).
  for (const [uid, { el, rect }] of snap) {
    if (el.isConnected && !el.closest('#fx')) continue;
    const fading = el.dataset.fading;
    placeInFx(el, rect);
    if (fading) el.style.filter = 'grayscale(1)';
    const dest = destination(root, uid, ev);
    const start = fading ? 0.3 : 1;
    if (dest) {
      const d = centre(rectOf(dest));
      const s = 0.25;
      moves.push(animate(el, [
        { transformOrigin: '0 0', transform: el.style.transform, opacity: start },
        { transformOrigin: '0 0', transform: `translate(${d.x - rect.x - (rect.w * s) / 2}px, ${d.y - rect.y - (rect.h * s) / 2}px) scale(${(rect.w / el.offsetWidth) * s})`, opacity: 0 },
      ], t(520), { fill: 'forwards' }));
    } else {
      moves.push(animate(el, [{ opacity: start }, { opacity: 0 }], t(400), { fill: 'forwards' }));
    }
  }
  await Promise.all(moves);

  // Trainers revealed together: they flip face-up.
  const revealed = ev.filter((e) => e.type === 'trainersRevealed').flatMap((e) => e.trainers.map((tr) => shown(tr.uid)));
  const flips = revealed.filter(Boolean).map((el) => animate(el, [
    { transform: 'perspective(600px) rotateY(90deg)' }, { transform: 'none' },
  ], t(520)));

  // Healing, buffs and anything not shown yet float on the cards as they are now.
  showNumbers(ev, numbersDone, t);
  for (const e of ev.filter((x) => x.type === 'questProgress')) {
    animate(shown(e.uid), [{ transform: 'none' }, { transform: 'scale(1.08)' }, { transform: 'none' }], t(450));
  }
  if (ev.some((e) => e.type === 'weatherChanged')) {
    animate(root.querySelector('.status .weather'), [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], t(700));
  }
  await Promise.all(flips);
  const round = ev.find((e) => e.type === 'roundStarted');
  if (round) await banner(`Round ${round.round}`, t(800), 'round');
}

// --- Captions -----------------------------------------------------------------------------

const subject = (w) => (w === 'player' ? 'You' : 'Opponent');
const verb = (w, base, third) => (w === 'player' ? base : third ?? `${base}s`);
const owned = (owner, capital = false) => (owner === 'player' ? (capital ? 'Your' : 'your') : "Opponent's");
const named = (t) => (t ? `${t.owner ? `${owned(t.owner)} ` : ''}${t.name}` : '');
const on = (t) => (t ? ` on ${named(t)}` : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// One line, in plain words, for what this action did.
export function captionFor(state, actor) {
  const ev = state.events ?? [];
  const find = (type) => ev.find((e) => e.type === type);
  const all = (type) => ev.filter((e) => e.type === type);
  const S = subject(actor);
  let text = '';

  const reveals = all('trainersRevealed');
  const mulls = all('mulligan');
  const xpLocks = all('xpLocked');
  const main = ev.find((e) => ['cardPlayed', 'itemBought', 'itemUsed', 'attack', 'powerUsed', 'pass', 'choiceMade'].includes(e.type));
  if (reveals.length) {
    const theirs = reveals.find((e) => e.who === 'ai');
    text = `Trainers revealed — Opponent: ${theirs.trainers.map((tr) => `${tr.name} (Zone ${tr.zone + 1})`).join(', ')}`;
  } else if (find('coinFlip')) {
    const w = find('coinFlip').winner;
    text = `Coin flip: ${subject(w)} ${verb(w, 'win')} initiative`;
  } else if (mulls.length) {
    text = ['ai', 'player'].map((w) => {
      const m = mulls.find((e) => e.who === w);
      return m.count ? `${subject(w)} mulliganed ${plural(m.count, 'card')}` : `${subject(w)} kept ${w === 'player' ? 'your' : 'their'} hand`;
    }).join(' · ');
  } else if (xpLocks.length && find('phaseChanged')) {
    text = ['ai', 'player'].map((w) => {
      const x = ev.find((e) => e.type === 'xpSpent' && e.who === w);
      if (!x) return `${subject(w)} spent no XP`;
      return `${subject(w)} spent ${x.total} XP (${x.parts.map((p) => `${p.name} ${[p.attack && `+${p.attack} Attack`, p.strength && `+${p.strength} Strength`].filter(Boolean).join(', ')}`).join('; ')})`;
    }).join(' · ');
  } else if (find('trainersLocked') || find('mulliganLocked') || xpLocks.length) {
    text = actor === 'player' ? 'You locked in — waiting for the opponent' : 'Opponent is ready — your move';
  } else if (main?.type === 'cardPlayed') {
    const where = main.to.kind === 'pokemon' || main.to.kind === 'location' ? ` ${main.to.kind === 'location' ? 'in' : 'into'} Zone ${main.to.zone + 1}` : '';
    if (main.cardType === 'Item') {
      text = main.to.kind === 'bag'
        ? `${S} ${verb(actor, 'buy')} ${main.name} and ${verb(actor, 'store')} it in the Bag`
        : `${S} ${verb(actor, 'buy')} and ${verb(actor, 'use')} ${main.name}${on(main.target)}`;
    } else if (main.cardType === 'Supporter') {
      const paid = [...main.paid.discard, ...main.paid.release];
      text = `${S} ${verb(actor, 'play')} ${main.name}${on(main.target)}${paid.length ? `, paying ${paid.join(', ')}` : ''} — Gift ${main.gift.met ? 'met' : 'not met'}`;
    } else {
      text = `${S} ${verb(actor, 'play')} ${main.name}${where}${on(main.target)}`;
    }
  } else if (main?.type === 'itemBought') {
    text = `${S} ${verb(actor, 'buy')} ${main.name} from the PokéMart ($${main.cost})`;
  } else if (main?.type === 'itemUsed') {
    text = `${S} ${verb(actor, 'use')} ${main.name} from the Bag${on(main.target)}`;
  } else if (main?.type === 'attack') {
    text = `${owned(actor, true)} ${main.attacker.name} attacks ${named(main.target)} — ${main.amount} damage`
      + (main.trades ? `; ${main.target.name} hits back for ${main.back}` : '');
  } else if (main?.type === 'powerUsed') {
    text = `${S} ${verb(actor, 'use')} ${main.name}'s Power${on(main.target)}`;
  } else if (main?.type === 'pass') {
    text = `${S} ${verb(actor, 'pass', 'passes')}`;
    if (ev.some((e) => e.type === 'phaseChanged' && e.phase === 'supper')) text += ' · Battle Phase ends';
  } else if (main?.type === 'choiceMade') {
    text = main.kind === 'target'
      ? `${S} ${verb(actor, 'choose')} ${named(main.target)} for ${main.source}`
      : main.summon ? `${S} ${verb(actor, 'summon')} ${main.name} for free into Zone ${main.zone + 1}`
        : `${S} ${verb(actor, 'keep')} ${main.name} in hand`;
  }
  const extra = [
    ...all('defeated').map((e) => `${named(e.target)} defeated`),
    ...all('trainerRemoved').map((e) => `${named(e.target)} removed`),
    ...all('questComplete').map((e) => `${owned(e.owner, true)} ${e.name} quest complete`),
  ];
  const over = find('matchOver');
  if (over) extra.push(over.winner ? `${subject(over.winner)} ${verb(over.winner, 'win')}!` : 'Match drawn');
  return [text, ...extra].filter(Boolean).join(' · ');
}

// --- The queue ---------------------------------------------------------------------------

// Shows one action, from prev to next (actor: who took it), then draws
// the next state. Own actions play faster. Never throws: a problem showing
// it still leaves the next state drawn.
export async function present(root, prev, next, actor, draw) {
  const k = speedFactor() * (actor === 'player' ? 0.45 : 1);
  const t = (ms) => ms * k;
  skipping = false;
  setCaption(captionFor(next, actor));
  const numbersDone = new Set();
  try {
    if (k > 0) await before(root, prev, next, actor, t, numbersDone);
    const snap = k > 0 ? snapshot() : new Map();
    draw();
    if (k > 0 && !skipping) await after(root, snap, next, actor, t, numbersDone);
  } catch (err) {
    console.error(err);
    draw();
  } finally {
    clearFx();
    skipping = false;
  }
}

// Removes everything but floating numbers still on their way up.
function clearFx() {
  const fx = fxEl();
  for (const el of [...fx.children]) {
    if (!el.classList.contains('fx-num')) el.remove();
  }
  for (const [uid, el] of cardElements()) if (!el.isConnected) cardElements().delete(uid);
  for (const el of document.querySelectorAll('.fx-target, .fx-attacker, .fx-power')) {
    el.classList.remove('fx-target', 'fx-attacker', 'fx-power');
  }
}

export function resetFx() {
  skip();
  clearFx();
}
