// Pointer interaction on top of the click handlers in render.js:
//   - the hand fan: a hovered card lifts and its neighbours spread apart
//   - drag to play: a card follows the cursor; valid destinations glow;
//     releasing over one clicks it (so every confirmation still appears),
//     anywhere else snaps the card back
//   - targeting: a curved brass arrow from the attacker (or a Power's
//     Trainer, or a targeted card) to the cursor, with a preview of the
//     result over a legal target; right-click or Escape cancels
//   - inspect: right-click any visible card for a large view with every
//     keyword and buff explained
// render.js supplies what each drag does (ctx.dragPlan) and everything that
// needs the game state, so nothing here knows the rules.

import { arcLayout, cardElements, STAGE } from './render.js';

const DRAG_START = 8;   // stage px of movement before a press becomes a drag

let ctx = null;         // the latest render's context
let press = null;       // a pointer press that may become a drag
let drag = null;        // the drag in progress
let aim = null;         // the targeting arrow: { source, hover, preview }
let pointer = null;     // last pointer position, in stage px
let suppressClicksUntil = 0;
let installed = false;

const stage = () => document.getElementById('stage');
const layer = () => document.getElementById('drag');

function toStage(clientX, clientY) {
  const r = stage().getBoundingClientRect();
  const scale = r.width / STAGE.width;
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

function rectOf(el) {
  const s = stage().getBoundingClientRect();
  const scale = s.width / STAGE.width;
  const b = el.getBoundingClientRect();
  return { x: (b.left - s.left) / scale, y: (b.top - s.top) / scale, w: b.width / scale, h: b.height / scale };
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const locked = () => stage().classList.contains('locked');

// --- Wiring (after every render) ----------------------------------------------------

export function wireInteractions(root, context) {
  ctx = { ...context, root };
  install();
  for (const fan of root.querySelectorAll('.hand, .tray')) {
    const cards = [...fan.querySelectorAll(':scope > .card')];
    cards.forEach((el, i) => { el.onmouseenter = () => { if (!drag) layoutFan(fan, i); }; });
    fan.onmouseleave = () => { if (!drag) layoutFan(fan, -1); };
  }
  const draggable = '.hand > .card, .tray > .card, .player .bag-slot.usable .card, .mart-item.buyable .card, '
    + '.player .pokemon-space .card.selectable, .player .trainer-space .card.selectable';
  for (const el of root.querySelectorAll(draggable)) el.onpointerdown = (e) => onPress(e, el);
  refreshAim();
}

// Lays the hand out on its arc again, lifting card `hover` (or none).
function layoutFan(fan, hover) {
  const cards = [...fan.querySelectorAll(':scope > .card')];
  const spots = arcLayout(cards.length, hover);
  cards.forEach((el, i) => {
    const s = spots[i];
    el.style.left = `${s.left}px`;
    el.style.top = `${s.top}px`;
    el.style.setProperty('--rot', `${s.rot}deg`);
    el.style.zIndex = s.lifted ? 90 : i + 1;
    el.classList.toggle('lifted', Boolean(s.lifted));
  });
}

function install() {
  if (installed) return;
  installed = true;
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onRelease);
  addEventListener('pointercancel', () => abort());
  // The click that follows a drop must not also land on what's under the cursor.
  addEventListener('click', (e) => {
    if (e.isTrusted && performance.now() < suppressClicksUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  // An action under way (the stage locks): the arrow's job is done.
  addEventListener('click', () => { if (locked() && !drag) clearAim(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeInspect()) return;
    cancelAll();
  });
  stage().addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (closeInspect()) return;
    if (drag || aim || ctx?.selecting()) {
      cancelAll();
      return;
    }
    const card = e.target.closest('.card[data-pv]');
    if (card && !card.closest('#fx, #drag') && !locked()) openInspect(ctx.inspect(card));
  });
}

// --- Drag to play -------------------------------------------------------------------

function onPress(e, el) {
  if (e.button !== 0 || locked() || drag) return;
  const plan = ctx.dragPlan(el);
  if (!plan) return;
  press = { el, plan, uid: el.dataset.uid, start: toStage(e.clientX, e.clientY) };
}

function onMove(e) {
  pointer = toStage(e.clientX, e.clientY);
  if (press && !drag) {
    const d = Math.hypot(pointer.x - press.start.x, pointer.y - press.start.y);
    if (d > DRAG_START) begin();
  }
  if (drag) follow(e);
  else if (aim) updateAim(e);
}

function begin() {
  const { plan, uid } = press;
  press = null;
  plan.prepare?.();   // the same choice a click makes; redraws, so destinations glow
  const el = cardElements().get(uid);
  if (!el?.isConnected) return;
  if (plan.kind === 'arrow') {
    drag = { plan, uid };
    aim = { source: plan.source?.() ?? el, hover: null };
    stage().classList.add('aiming');
    drawArrow();
  } else {
    const r = rectOf(el);
    const c = centre(r);
    layer().append(el);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.classList.remove('lifted');
    el.classList.add('dragging');
    el.style.cssText = `position:absolute;left:${c.x - w / 2}px;top:${c.y - h / 2}px;margin:0;`;
    drag = { plan, uid, el, offset: { x: pointer.x - (c.x - w / 2), y: pointer.y - (c.y - h / 2) }, lastX: pointer.x, tilt: 0 };
    if (plan.arena) ctx.root.querySelector('.arena')?.classList.add('drop-arena');
    if (plan.bag) ctx.root.querySelector('[data-pile="player-bag"]')?.classList.add('drop-ok');
  }
  stage().classList.add('dragging-now');
}

function follow(e) {
  if (drag.el) {
    const { el, offset } = drag;
    el.style.left = `${pointer.x - offset.x}px`;
    el.style.top = `${pointer.y - offset.y}px`;
    // Tilt with the direction of movement, settling back when still.
    drag.tilt = Math.max(-14, Math.min(14, drag.tilt * 0.6 + (pointer.x - drag.lastX) * 0.9));
    drag.lastX = pointer.x;
    el.style.rotate = `${drag.tilt.toFixed(1)}deg`;
    hoverDestination(destinationAt(e.clientX, e.clientY, drag.plan));
  } else {
    updateAim(e);
  }
}

// The destination under the cursor for this plan, if any.
function destinationAt(x, y, plan) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest('#drag, #fx')) continue;
    const target = el.closest('.attack-target, .power-target, .player .pokemon-space.target, .player .location-space.target, '
      + '.player .trainer-space.target, .zone.zone-target, .hand > .card.selectable.selected');
    if (target && target.dataset.uid !== drag?.uid) return { el: target, type: 'click' };
    const bag = plan?.bag && el.closest('[data-pile="player-bag"]');
    if (bag) return { el: bag, type: 'bag' };
    const arena = plan?.arena && el.closest('.arena');
    if (arena) return { el: arena, type: 'arena' };
    if (el.closest('.hand-area, .side-panel, .res, .piles, .res-row')) return null;
  }
  return null;
}

let hovered = null;
function hoverDestination(dest) {
  const el = dest?.type === 'click' || dest?.type === 'bag' ? dest.el : null;
  if (el === hovered) return;
  hovered?.classList.remove('drop-hover');
  hovered = el;
  hovered?.classList.add('drop-hover');
}

function onRelease(e) {
  if (press && !drag) {
    press = null;   // a plain click: the click handlers take it
    return;
  }
  if (!drag) return;
  const dest = destinationAt(e.clientX, e.clientY, drag.plan);
  finish(dest);
}

function finish(dest) {
  const { plan, el } = drag;
  drag = null;
  hoverDestination(null);
  stage().classList.remove('dragging-now');
  ctx.root.querySelector('.arena')?.classList.remove('drop-arena');
  ctx.root.querySelector('[data-pile="player-bag"]')?.classList.remove('drop-ok');
  // Only the click that comes straight after this release (60ms is far quicker than a person clicks again).
  suppressClicksUntil = performance.now() + 60;

  if (dest) {
    if (dest.type === 'bag') plan.bag();
    else if (dest.type === 'arena') plan.arena();
    else dest.el.click();
  }
  if (!el) {
    // An arrow: released over nothing cancels the choice.
    clearAim();
    if (!dest) ctx.cancel();
    else refreshAim();
    return;
  }
  // A card: once an action is under way (the stage locks) the card stays where
  // it was dropped and the action's animations take it from there. If it was
  // dropped on nothing, or a confirmation was declined, it snaps back.
  if (locked() || el.closest('#app')) {
    el.classList.remove('dragging');
    return;
  }
  snapBack(el);
}

function snapBack(el) {
  const from = rectOf(el);
  el.classList.remove('dragging');
  ctx.cancel();   // redraws: the card goes back to its place
  const back = cardElements().get(el.dataset.uid);
  if (!back?.isConnected || back.closest('#drag')) {
    el.remove();
    return;
  }
  const to = rectOf(back);
  back.animate([
    { translate: `${from.x - to.x}px ${from.y - to.y}px` },
    { translate: '0 0' },
  ], { duration: 220, easing: 'ease-out' });
}

function abort() {
  press = null;
  if (!drag) return;
  if (drag.el) {
    const { el } = drag;
    drag = null;
    stage().classList.remove('dragging-now');
    hoverDestination(null);
    snapBack(el);
  } else {
    drag = null;
    stage().classList.remove('dragging-now');
    clearAim();
    ctx.cancel();
  }
}

function cancelAll() {
  if (drag) {
    abort();
    return;
  }
  clearAim();
  if (ctx?.selecting()) ctx.cancel();
}

// --- The targeting arrow ---------------------------------------------------------------

// After a render: a target being chosen by click keeps an arrow following the cursor.
function refreshAim() {
  if (drag && !drag.el) {
    // a drag-arrow survives the redraw its own prepare() caused
    aim = { source: drag.plan.source?.() ?? aim?.source, hover: null };
    drawArrow();
    return;
  }
  const source = ctx.arrowSource();
  if (!source) {
    clearAim();
    return;
  }
  aim = { source, hover: null };
  stage().classList.add('aiming');
  drawArrow();
}

function clearAim() {
  aim = null;
  stage().classList.remove('aiming');
  layer()?.querySelectorAll('.aim-arrow, .aim-label').forEach((n) => n.remove());
}

function updateAim(e) {
  if (!aim) return;
  const dest = destinationAt(e.clientX, e.clientY, drag?.plan);
  const target = dest?.type === 'click' ? dest.el : null;
  if (target !== aim.hover) {
    aim.hover = target;
    aim.preview = target ? ctx.outcome(target) : null;
  }
  drawArrow();
}

function drawArrow() {
  if (!aim?.source?.isConnected || !pointer) {
    layer()?.querySelectorAll('.aim-arrow, .aim-label').forEach((n) => n.remove());
    return;
  }
  const s = centre(rectOf(aim.source));
  const t = aim.hover ? centre(rectOf(aim.hover)) : pointer;
  const dist = Math.hypot(t.x - s.x, t.y - s.y);
  const c = { x: (s.x + t.x) / 2, y: Math.min(s.y, t.y) - Math.min(160, dist * 0.35) };
  const d = `M${s.x},${s.y} Q${c.x},${c.y} ${t.x},${t.y}`;
  let svg = layer().querySelector('.aim-arrow');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'aim-arrow');
    svg.setAttribute('viewBox', `0 0 ${STAGE.width} ${STAGE.height}`);
    svg.innerHTML = `<defs>
        <linearGradient id="aim-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff0b8"/><stop offset="0.45" stop-color="#d9ad58"/><stop offset="1" stop-color="#8a6326"/>
        </linearGradient>
        <marker id="aim-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto">
          <path d="M0,0 L10,5 L0,10 L2.5,5 z" fill="url(#aim-brass)" stroke="#4a3010" stroke-width="0.8"/>
        </marker></defs>
      <path class="aim-shadow" fill="none" stroke="rgba(20,8,0,0.55)" stroke-width="14" stroke-linecap="round"/>
      <path class="aim-line" fill="none" stroke="url(#aim-brass)" stroke-width="8" stroke-linecap="round" stroke-dasharray="18 7" marker-end="url(#aim-head)"/>
      <circle class="aim-ring" r="16" fill="none" stroke="#f6dd9a" stroke-width="3"/>`;
    layer().append(svg);
  }
  svg.querySelector('.aim-shadow').setAttribute('d', `M${s.x + 3},${s.y + 5} Q${c.x + 3},${c.y + 5} ${t.x + 3},${t.y + 5}`);
  svg.querySelector('.aim-line').setAttribute('d', d);
  const ring = svg.querySelector('.aim-ring');
  ring.setAttribute('cx', t.x);
  ring.setAttribute('cy', t.y);
  ring.style.display = aim.hover ? '' : 'none';
  drawLabels();
}

// "Misty −5 · Removed" over the target, and what the attacker takes back over it.
function drawLabels() {
  layer().querySelectorAll('.aim-label').forEach((n) => n.remove());
  const p = aim?.preview;
  if (!p) return;
  const put = (el, change) => {
    if (!el || !change) return;
    const r = rectOf(el);
    const label = document.createElement('div');
    label.className = `aim-label${change.bad ? ' bad' : ' good'}`;
    label.textContent = change.text;
    label.style.left = `${r.x + r.w / 2}px`;
    label.style.top = `${r.y - 6}px`;
    layer().append(label);
  };
  put(aim.hover, p.target);
  put(aim.source, p.source);
}

// --- Inspect ------------------------------------------------------------------------------

function openInspect(html) {
  const box = document.getElementById('inspect');
  if (!box || !html) return;
  box.innerHTML = `<div class="inspect-box">${html}</div>`;
  box.hidden = false;
  box.onclick = () => closeInspect();
}

function closeInspect() {
  const box = document.getElementById('inspect');
  if (!box || box.hidden) return false;
  box.hidden = true;
  box.innerHTML = '';
  return true;
}
