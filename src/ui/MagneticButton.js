// Magnetic button: on mouseenter, track cursor and translate the element
// toward it with LERP. On leave, spring back to origin. Disabled on touch.

import gsap from 'gsap';
import { isTouch } from '../utils/math.js';

export function magnetize(el, { strength = 0.35, max = 30 } = {}) {
  if (isTouch() || !el) return;

  const onMove = (e) => {
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    const x = Math.max(-max, Math.min(max, relX * strength));
    const y = Math.max(-max, Math.min(max, relY * strength));
    gsap.to(el, { x, y, duration: 0.4, ease: 'power3.out' });
  };
  const onLeave = () => {
    gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  };

  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
}

export function magnetizeAll(selector, opts) {
  document.querySelectorAll(selector).forEach((el) => magnetize(el, opts));
}
