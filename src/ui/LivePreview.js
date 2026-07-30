// LivePreview.js — hover a game card and the ACTUAL game boots inside it.
//
// Games only (they're the ones worth showing in motion, and both allow
// framing — no X-Frame-Options / frame-ancestors on either deployment).
// The screenshot stays underneath as the poster, so there's never a blank
// hole while the frame loads.
//
// Guardrails, because an embedded WebGL game is expensive:
//   • hover-intent delay — a passing cursor never triggers a load
//   • exactly ONE preview alive at a time, torn down on leave
//   • desktop pointers only; skipped on touch, reduced-motion and Save-Data
//   • pointer-events: none — it's a glimpse, not a trap. Click still opens
//     the real thing in a new tab via the card's own link.

const HOVER_INTENT = 420;   // ms before we commit to loading
const LINGER = 260;         // ms grace after leaving before teardown

export function initLivePreviews(root = document) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData;
  if (!fine || calm || saveData) return;

  let current = null;   // { host, frame, section }
  let armTimer = null;
  let dropTimer = null;

  const teardown = () => {
    if (!current) return;
    current.host.classList.remove('is-live');
    const { host } = current;
    current = null;
    // Let the fade finish before yanking the iframe (and its GPU context).
    setTimeout(() => { host.innerHTML = ''; }, 320);
  };

  const spawn = (section, url) => {
    teardown();
    const details = section.querySelector('.project-details');
    if (!details) return;

    let host = details.querySelector('.project-live');
    if (!host) {
      host = document.createElement('div');
      host.className = 'project-live';
      host.setAttribute('aria-hidden', 'true');
      // Sits directly above the screenshot, below the text.
      details.insertBefore(host, details.firstChild);
    }

    const frame = document.createElement('iframe');
    frame.src = url;
    frame.loading = 'lazy';
    frame.tabIndex = -1;
    frame.setAttribute('title', '');
    frame.setAttribute('aria-hidden', 'true');
    // No same-origin: the embed can render + run scripts but can't touch us.
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.addEventListener('load', () => {
      if (current && current.frame === frame) host.classList.add('is-live');
    }, { once: true });

    host.innerHTML = '';
    host.appendChild(frame);
    current = { host, frame, section };
  };

  root.querySelectorAll('.project-section[data-category="games"]').forEach((section) => {
    const link = section.querySelector('.project-links a[href^="http"]');
    if (!link) return;                    // no live build → nothing to show
    const url = link.href;
    section.dataset.hasLivePreview = 'true';

    section.addEventListener('pointerenter', () => {
      clearTimeout(dropTimer);
      clearTimeout(armTimer);
      armTimer = setTimeout(() => spawn(section, url), HOVER_INTENT);
    });

    section.addEventListener('pointerleave', () => {
      clearTimeout(armTimer);
      clearTimeout(dropTimer);
      dropTimer = setTimeout(teardown, LINGER);
    });
  });

  // Never leave a game running in the background.
  document.addEventListener('visibilitychange', () => { if (document.hidden) teardown(); });
}
