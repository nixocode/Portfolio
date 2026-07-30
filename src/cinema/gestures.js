// gestures.js — cross-device horizontal "swipe" to move across categories.
//
// Physical model is consistent everywhere: move LEFT → next category, move
// RIGHT → previous. Vertical scrolling (which drives the cinema zoom) is never
// hijacked — only clearly-horizontal gestures switch lanes.
//
//   • Touch (phones/tablets): a horizontal flick.
//   • Trackpad (Mac / precision touchpads): a two-finger horizontal swipe,
//     read via wheel deltaX. We also preventDefault it so it doesn't trigger
//     the browser's back/forward navigation.
//   • Mouse / pen: a horizontal drag across the graph background.

export function initGestures({ onNext, onPrev, blocked }) {
  const COOLDOWN = 500;
  let last = 0;
  const fire = (dir) => {
    const now = performance.now();
    if (now - last < COOLDOWN) return;
    if (blocked && blocked()) return;
    last = now;
    dir > 0 ? onNext() : onPrev();
  };

  // ---- Touch ----
  let tx = 0, ty = 0, tt = 0, touching = false;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touching = false; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    tt = performance.now(); touching = true;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!touching) return; touching = false;
    const t = e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - tx, dy = t.clientY - ty;
    if (performance.now() - tt > 900) return;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.15) return; // let vertical scroll pass
    fire(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ---- Trackpad (wheel deltaX) ----
  let accX = 0, armed = true;
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) { accX = 0; return; } // vertical — ignore
    e.preventDefault(); // stop macOS back/forward swipe
    if (Math.abs(e.deltaX) < 2.5) { armed = true; accX = 0; return; } // gesture/momentum ended → re-arm
    if (!armed) return; // ignore the momentum tail after a switch
    accX += e.deltaX;
    if (Math.abs(accX) > 46) { fire(accX > 0 ? 1 : -1); accX = 0; armed = false; }
  }, { passive: false });

  // ---- Mouse / pen drag ----
  let px = 0, py = 0, dragging = false;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { dragging = false; return; } // touch handled above
    if (e.target?.closest?.('.node, button, a, input, textarea, .panel, .top-nav, .hero')) { dragging = false; return; }
    px = e.clientX; py = e.clientY; dragging = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return; dragging = false;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    fire(dx < 0 ? 1 : -1);
  });
}
