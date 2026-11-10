// C2: the collectable finish in motion (docs/v4-card-overhaul.md 2.3). One pointer listener for the page:
//   - the holo sheen of the card under the pointer follows it (--mx, --my: 0..1 across the card);
//   - a Full card under the pointer tilts gently in 3D (at most 6°), its sheen moving against the tilt;
//     the hover zoom's Full card follows the pointer over the card it shows (the zoom takes no pointer);
//   - Low motion (html.v4-low): no tilt and no moving sheen; the still sheen stays (CSS).
// Display only: nothing here reads or changes the game.
const MAX_TILT = 6;
export function initFinish(root = document) {
  let last = [];
  let frame = 0;
  let ev = null;
  const reset = () => { for (const el of last) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('cd-tilting'); } last = []; };
  const apply = () => {
    frame = 0;
    const e = ev;
    if (!e) return;
    if (document.documentElement.classList.contains('v4-low')) { reset(); return; }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const targets = [];
    const card = under?.closest?.('.cd');
    if (card) targets.push({ el: card, box: card });
    // The zoom's Full card follows the pointer over the element it shows.
    const src = under?.closest?.('[data-zoom]');
    const zoom = document.querySelector('.v4-zoom .cd-full');
    if (src && zoom && zoom.offsetParent) targets.push({ el: zoom, box: src });
    const next = [];
    for (const { el, box } of targets) {
      const r = box.getBoundingClientRect();
      if (!r.width) continue;
      const mx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const my = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      el.style.setProperty('--mx', mx.toFixed(3));
      el.style.setProperty('--my', my.toFixed(3));
      if (el.classList.contains('cd-full')) {
        el.style.setProperty('--ry', `${((mx - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - my) * 2 * MAX_TILT).toFixed(2)}deg`);
        el.classList.add('cd-tilting');
      }
      next.push(el);
    }
    for (const el of last) if (!next.includes(el)) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('cd-tilting'); }
    last = next;
  };
  root.addEventListener('pointermove', (e) => { ev = e; if (!frame) frame = requestAnimationFrame(apply); }, { passive: true });
  root.addEventListener('pointerleave', reset);
}
