// Interaction (UX3): the targeting arrow and preview panel, drag and drop (pointer events, no library),
// and the keyboard. It draws on its own layer (#v4-fx) inside the stage, above the board and below
// dialogs, so a redraw of the match never loses the arrow. Every choice goes through flows.js, the same
// path clicks take; nothing is committed until a legal drop, Enter, or the final click.
import { attackers, commandModesFor, commandTargets } from '../engine/game.js?v=202611101304';
import { hitsFor, evaluate, previewHTML, needsArrow, placementAt, commitHit, sameHit } from './flows.js?v=202611101304';
import { reactOpen } from './board.js?v=202611101304';

const W = 1920;
export function setupInteraction({ stage, ui, ctx, getState }) {
  const fx = document.createElement('div');
  fx.id = 'v4-fx';
  fx.innerHTML = `<svg class="v4-fxarrow" width="${W}" height="1080" viewBox="0 0 ${W} 1080" aria-hidden="true"><defs>
      <linearGradient id="v4-fxg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd56a"/><stop offset="1" stop-color="#ffb04a"/></linearGradient>
      <marker id="v4-fxm" markerUnits="userSpaceOnUse" markerWidth="30" markerHeight="30" refX="15" refY="15" orient="auto"><path d="M2,4 L28,15 L2,26 L9,15 z" fill="currentColor"/></marker>
      <filter id="v4-fxgl"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path class="v4-fxpath" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="2 16" filter="url(#v4-fxgl)" marker-end="url(#v4-fxm)"/></svg>
    <div class="v4-outline"></div><div class="v4-focusring"></div><div class="v4-preview"></div><div class="v4-ghost"></div>`;
  stage.appendChild(fx);
  const $ = (sel) => fx.querySelector(sel);
  const path = $('.v4-fxpath');
  const svg = $('.v4-fxarrow');

  // --- Coordinates (the stage is scaled to fit the window) ---
  const box = () => stage.getBoundingClientRect();
  const toStage = (cx, cy) => { const r = box(); const k = r.width / W; return { x: (cx - r.left) / k, y: (cy - r.top) / k }; };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); const o = box(); const k = o.width / W; return { x: (r.left - o.left) / k, y: (r.top - o.top) / k, w: r.width / k, h: r.height / k }; };
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const toClient = (p) => { const r = box(); const k = r.width / W; return { x: r.left + p.x * k, y: r.top + p.y * k }; };

  // --- What the pointer is over ---
  function hitAt(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    if (!el || el.closest('#v4-fx')) return null;
    const sp = el.closest('.v4-space');
    if (sp) return { kind: 'space', who: sp.dataset.who, space: Number(sp.dataset.space) };
    const pc = el.closest('.v4-ring');
    if (pc) return { kind: 'pc', who: pc.dataset.pc };
    if (el.closest('.v4-board')) return { kind: 'board' };
    return null;
  }
  function hitEl(hit) {
    if (!hit) return null;
    if (hit.kind === 'space') return document.querySelector(`.v4-row.${hit.who === 'ai' ? 'opponent' : 'player'} .v4-space[data-space="${hit.space}"]`);
    if (hit.kind === 'pc') return document.querySelector(`.v4-ring.${hit.who}`);
    return document.querySelector('.v4-board');
  }

  // --- State of a choice ---
  const dialogOpen = (s) => !!(ui.confirm || ui.keys || s.phase === 'gameOver' || (s.phase === 'mulligan' && !s.players.player.mulliganed)
    || ui.select?.kind === 'supporter' || (s.tournament && ui.seenTournament !== s.tournament.startedRound && s.phase === 'battle'));
  const myTurn = (s) => s.phase === 'battle' && s.turn === 'player' && !s.reactWindow && !ui.locked;
  const currentSel = (s) => {
    if (ui.drag) return ui.drag.sel;
    if (!ui.select || ui.select.kind === 'supporter' || ui.picker) return null;
    if (ui.select.kind === 'react') return reactOpen(s, ui) ? ui.select : null;
    return myTurn(s) ? ui.select : null;
  };
  const focusHits = (s, sel) => hitsFor(s, sel);
  const activeHit = (s, sel) => {
    if (ui.focus != null) { const hs = focusHits(s, sel); return hs[ui.focus % Math.max(1, hs.length)] ?? null; }
    return ui.hover;
  };

  // Preview HTML is cached per state, choice and place (it plays the action on a copy).
  let cacheState = null;
  const cache = new Map();
  function preview(s, sel, hit) {
    if (cacheState !== s) { cacheState = s; cache.clear(); }
    const key = JSON.stringify([sel, hit]);
    if (!cache.has(key)) cache.set(key, previewHTML(s, sel, hit));
    return cache.get(key);
  }

  // --- Drawing the layer ---
  function hideAll() {
    svg.style.display = 'none';
    for (const k of ['.v4-outline', '.v4-focusring', '.v4-preview']) $(k).style.display = 'none';
    if (!ghostGliding) $('.v4-ghost').style.display = 'none';
  }
  function sourcePoint(sel) {
    if (ui.drag?.origin) return center(ui.drag.origin);
    let el = null;
    if (sel.kind === 'attack') el = document.querySelector(`.v4-row.player .v4-space[data-space="${sel.from}"]`);
    else if (sel.kind === 'item' && sel.from === 'bag') el = document.querySelector(`[data-bag="${sel.uid}"]`);
    else if (sel.kind === 'item' && sel.from === 'mart') el = document.querySelector('.v4-martcard');
    else if (sel.kind === 'react') el = document.querySelector(`[data-react="${sel.uid}"]`)?.closest('.v4-ropt');
    else if (sel.kind === 'choice') el = document.querySelector(`.v4-row.player .v4-space[data-space="${sel.space}"]`);
    else el = document.querySelector(`.v4-hand [data-uid="${sel.uid}"]`);
    return el ? center(rectOf(el)) : null;
  }
  function refresh() {
    const s = getState();
    if (!s) return hideAll();
    // UX4 C: the AI's arrow, from its source to its target, for a moment before its beat.
    if (ui.aim) {
      hideAll();
      const { from, to } = ui.aim;
      const mx = (from.x + to.x) / 2 + 40;
      const my = Math.min(from.y, to.y) - 30 + Math.abs(from.y - to.y) * 0.25;
      path.setAttribute('d', `M${from.x.toFixed(0)},${from.y.toFixed(0)} Q${mx.toFixed(0)},${my.toFixed(0)} ${to.x.toFixed(0)},${to.y.toFixed(0)}`);
      svg.classList.add('snap');
      svg.style.display = '';
      return;
    }
    const sel = currentSel(s);
    if (!sel || dialogOpen(s)) return hideAll();
    const hit = activeHit(s, sel);
    const legal = hit ? evaluate(s, sel, hit) : null;
    const el = hitEl(hit);
    const er = el ? rectOf(el) : null;
    // The arrow: from the source to the pointer; red and snapped onto a legal target.
    const arrow = needsArrow(s, sel) || (ui.drag && sel.kind === 'attack');
    const from = arrow ? sourcePoint(sel) : null;
    const to = legal?.legal && er && hit.kind !== 'board' ? center(er) : ui.focus != null && er ? center(er) : ui.pointer;
    if (from && to) {
      const mx = (from.x + to.x) / 2 + 40;
      const my = Math.min(from.y, to.y) - 30 + Math.abs(from.y - to.y) * 0.25;
      path.setAttribute('d', `M${from.x.toFixed(0)},${from.y.toFixed(0)} Q${mx.toFixed(0)},${my.toFixed(0)} ${to.x.toFixed(0)},${to.y.toFixed(0)}`);
      svg.classList.toggle('snap', !!legal?.legal);
      svg.style.display = '';
    } else svg.style.display = 'none';
    // The focus ring (keyboard).
    const ring = $('.v4-focusring');
    if (ui.focus != null && er) Object.assign(ring.style, { display: '', left: `${er.x - 5}px`, top: `${er.y - 5}px`, width: `${er.w + 10}px`, height: `${er.h + 10}px` });
    else ring.style.display = 'none';
    // A Location's outline over the lanes it would cover.
    const out = $('.v4-outline');
    const place = placementAt(s, sel, hit);
    const a = place && document.querySelector(`.v4-row.opponent .v4-space[data-space="${place.start}"]`);
    const b = place && document.querySelector(`.v4-row.player .v4-space[data-space="${place.start + place.width - 1}"]`);
    if (a && b) {
      const ra = rectOf(a);
      const rb = rectOf(b);
      Object.assign(out.style, { display: '', left: `${ra.x - 8}px`, top: `${ra.y - 8}px`, width: `${rb.x + rb.w - ra.x + 16}px`, height: `${rb.y + rb.h - ra.y + 16}px` });
    } else out.style.display = 'none';
    // The preview panel (or the reason a place isn't legal), beside the target.
    const pv = $('.v4-preview');
    const html = legal?.legal ? preview(s, sel, hit) : legal?.reason ? `<div class="why">${legal.reason.replace(/</g, '&lt;')}</div>` : null;
    if (html && er) {
      pv.innerHTML = html;
      pv.className = `v4-preview${legal.legal ? '' : ' bad'}`;
      pv.style.display = '';
      const wPanel = pv.offsetWidth || 340;
      const hPanel = pv.offsetHeight || 120;
      const anchor = hit.kind === 'board' && ui.pointer ? { x: ui.pointer.x, y: ui.pointer.y, w: 0, h: 0 } : er;
      let x = anchor.x + anchor.w + 14;
      if (x + wPanel > W - 8) x = anchor.x - wPanel - 14;
      let y = anchor.y + Math.min(40, anchor.h / 4);
      y = Math.max(76, Math.min(1080 - hPanel - 8, y));
      Object.assign(pv.style, { left: `${Math.max(8, x)}px`, top: `${y}px` });
    } else pv.style.display = 'none';
    // The dragged card follows the pointer, slightly smaller.
    const g = $('.v4-ghost');
    if (ui.drag?.html && ui.pointer && !ghostGliding) {
      if (g.dataset.uid !== ui.drag.uid) { g.innerHTML = ui.drag.html; g.dataset.uid = ui.drag.uid; }
      Object.assign(g.style, { display: '', transition: 'none', opacity: '0.92', left: `${ui.pointer.x - 78}px`, top: `${ui.pointer.y - 108}px` });
    } else if (!ghostGliding) g.style.display = 'none';
  }

  // --- Drag and drop ---
  let pending = null;
  let suppressClick = false;
  let ghostGliding = false;
  function startDrag(c) {
    ui.drag = { sel: c.sel, origin: c.origin, html: c.html, uid: c.sel.uid ?? `atk-${c.sel.from}` };
    ui.select = c.sel;
    ui.picker = null;
    ui.focus = null;
    ctx.redraw();
  }
  function glideBack() {
    const g = $('.v4-ghost');
    const o = ui.drag?.origin;
    if (!o || g.style.display === 'none') return;
    ghostGliding = true;
    Object.assign(g.style, { transition: 'left 0.22s ease-out, top 0.22s ease-out, opacity 0.22s', left: `${o.x}px`, top: `${o.y}px`, opacity: '0.2' });
    setTimeout(() => { ghostGliding = false; g.style.display = 'none'; g.dataset.uid = ''; }, 240);
  }
  function cancel() {
    if (ui.drag) { glideBack(); ui.drag = null; ui.select = null; ui.focus = null; ctx.redraw(); return true; }
    if (ui.picker) { ui.picker = null; ui.select = null; ctx.redraw(); return true; }
    if (ui.select && ui.select.kind !== 'react') { ui.select = null; ui.focus = null; ctx.redraw(); return true; }
    if (ui.drawer) { ui.drawer = null; ctx.redraw(); return true; }
    return false;
  }
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const s = getState();
    if (!s || !myTurn(s) || dialogOpen(s) || ui.picker) return;
    const t = e.target;
    let c = null;
    const card = t.closest?.('.v4-hand .v4-card');
    const mon = t.closest?.('.v4-row.player .v4-mon.can-attack');
    const bag = t.closest?.('.v4-hud.you [data-bag].usable');
    if (card) c = { sel: { kind: 'hand', uid: card.dataset.uid }, el: card, ghost: true };
    else if (mon) c = { sel: { kind: 'attack', from: Number(mon.dataset.space) }, el: mon, ghost: false };
    else if (bag) c = { sel: { kind: 'item', from: 'bag', uid: bag.dataset.bag }, el: bag, ghost: true };
    if (!c) return;
    e.preventDefault();   // no text selection or native image drag; the click still happens
    c.start = toStage(e.clientX, e.clientY);
    c.origin = rectOf(c.el);
    c.html = c.ghost ? `<div class="v4-ghostcard">${(card ?? bag).outerHTML}</div>` : null;
    pending = c;
  });
  addEventListener('pointermove', (e) => {
    const s = getState();
    if (!s) return;
    ui.pointer = toStage(e.clientX, e.clientY);
    if (pending && !ui.drag && Math.hypot(ui.pointer.x - pending.start.x, ui.pointer.y - pending.start.y) > 6) { startDrag(pending); pending = null; }
    const hit = hitAt(e.clientX, e.clientY);
    if (!sameHit(hit, ui.hover)) { ui.hover = hit; if (ui.focus != null && !ui.drag) ui.focus = null; }
    if (ui.drag || currentSel(s)) refresh();
  });
  addEventListener('pointerup', (e) => {
    pending = null;
    if (!ui.drag) return;
    const s = getState();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const hit = hitAt(e.clientX, e.clientY);
    const sel = ui.drag.sel;
    if (hit && evaluate(s, sel, hit).legal) { const at = toStage(e.clientX, e.clientY); $('.v4-ghost').style.display = 'none'; commitHit(s, ui, ctx, sel, hit, at); }
    else cancel();
  });
  // A click straight after a drag isn't a click.
  addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
  // Right-click cancels a choice in progress.
  stage.addEventListener('contextmenu', (e) => { e.preventDefault(); const s = getState(); if (s && !reactOpen(s, ui)) cancel(); });

  // --- The keyboard ---
  addEventListener('keydown', (e) => {
    const s = getState();
    if (!s || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox')) return;
    const key = e.key;
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    // Dialogs with their own keys come first; other keys do nothing while they're open.
    if (ui.confirm) { if (key === 'Enter') { done(); ctx.confirmYes(); } else if (key === 'Escape') { done(); ctx.confirmNo(); } return; }
    if (ui.keys) { if (key === 'Escape' || key === '?') { done(); ui.keys = false; ctx.redraw(); } return; }
    if (reactOpen(s, ui)) {
      if (key === 'Escape') { done(); ctx.act({ type: 'decline', who: 'player' }); return; }
      if (key === ' ') {
        done();
        const opts = s.players.player.hand.filter((c) => commandModesFor(s, 'player', c.uid).length);
        if (opts.length !== 1) return;
        const targets = commandTargets(s, 'player', opts[0]);
        if (targets.length === 1) ctx.act({ type: 'react', who: 'player', uid: opts[0].uid, target: targets[0] });
      }
      return;
    }
    if (s.tournament && ui.seenTournament !== s.tournament.startedRound && s.phase === 'battle') { if (key === 'Enter') { done(); ui.seenTournament = s.tournament.startedRound; ctx.redraw(); } return; }
    if (s.phase === 'gameOver' || (s.phase === 'mulligan' && !s.players.player.mulliganed)) return;
    if (ui.select?.kind === 'supporter') { if (key === 'Escape') { done(); ui.select = null; ctx.redraw(); } return; }
    if (ui.picker) { if (key === 'Escape') { done(); cancel(); } return; }
    if (key === 'l' || key === 'L') { done(); ui.drawer = ui.drawer === 'log' ? null : 'log'; ctx.redraw(); return; }
    if (key === '?') { done(); ui.keys = true; ctx.redraw(); return; }
    if (key === 'Escape') { done(); cancel(); return; }
    if (!myTurn(s)) return;
    const me = s.players.player;
    if (key === ' ') { done(); ctx.endTurn(); return; }
    if (/^[1-9]$/.test(key)) {
      const c = me.hand[Number(key) - 1];
      if (c) { done(); ui.select = { kind: 'hand', uid: c.uid }; ui.focus = null; ui.drawer = null; ctx.redraw(); refresh(); }
      return;
    }
    if (key === 'a' || key === 'A') {
      const list = attackers(s, 'player');
      if (!list.length) return;
      done();
      const at = ui.select?.kind === 'attack' ? list.indexOf(ui.select.from) : -1;
      ui.select = { kind: 'attack', from: list[(at + 1) % list.length] };
      ui.focus = null;
      ctx.redraw();
      refresh();
      return;
    }
    if ((key === 'r' || key === 'R') && ui.select?.kind === 'hand') { done(); ctx.retain(ui.select.uid); return; }
    const sel = currentSel(s);
    if (key === 'Tab' && sel) {
      done();
      const hs = focusHits(s, sel);
      if (!hs.length) return;
      const n = hs.length;
      ui.focus = ui.focus == null ? (e.shiftKey ? n - 1 : 0) : (ui.focus + (e.shiftKey ? n - 1 : 1)) % n;
      ui.hover = null;
      refresh();
      return;
    }
    if (key === 'Enter' && sel) {
      const hs = focusHits(s, sel);
      const hit = ui.focus != null ? hs[ui.focus % hs.length] : hs.length === 1 && hs[0].kind === 'board' ? hs[0] : null;
      if (!hit) return;
      done();
      const er = hitEl(hit);
      const at = er ? center(rectOf(er)) : null;
      commitHit(s, ui, ctx, sel, hit, at);
    }
  });

  return { refresh, cancel, toClient, rectOf };
}
