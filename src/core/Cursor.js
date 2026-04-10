// Custom cursor: a small dot + a larger ring that lags behind via LERP.
// State machine:
//   default         → small dot + normal ring
//   .cursor-hover   → ring grows, blend-mode difference
//   .cursor-node    → ring becomes warm amber (over WebGL project node)
//   .cursor-text    → ring shrinks, dot stays
//
// Automatically disabled on touch devices.

import { damp, isTouch } from '../utils/math.js';

export class Cursor {
  constructor() {
    if (isTouch()) return;

    this.dot = document.createElement('div');
    this.dot.className = 'cursor-dot';
    this.ring = document.createElement('div');
    this.ring.className = 'cursor-ring';
    document.body.appendChild(this.dot);
    document.body.appendChild(this.ring);

    this.target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.dotPos = { ...this.target };
    this.ringPos = { ...this.target };

    window.addEventListener('mousemove', (e) => {
      this.target.x = e.clientX;
      this.target.y = e.clientY;
    }, { passive: true });

    // Auto-apply hover state to anything .interactive.
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest?.('.interactive, a, button, .hero-btn, .project-links a')) {
        document.body.classList.add('cursor-hover');
      }
    }, { passive: true });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest?.('.interactive, a, button, .hero-btn, .project-links a')) {
        document.body.classList.remove('cursor-hover');
      }
    }, { passive: true });

    this._raf = this._raf.bind(this);
    this._last = performance.now();
    requestAnimationFrame(this._raf);
  }

  _raf(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (!this.dot) return;

    // Dot snaps fast; ring lags for weight.
    this.dotPos.x  = damp(this.dotPos.x,  this.target.x, 0.35, dt);
    this.dotPos.y  = damp(this.dotPos.y,  this.target.y, 0.35, dt);
    this.ringPos.x = damp(this.ringPos.x, this.target.x, 0.15, dt);
    this.ringPos.y = damp(this.ringPos.y, this.target.y, 0.15, dt);

    this.dot.style.transform  = `translate3d(${this.dotPos.x}px, ${this.dotPos.y}px, 0) translate(-50%, -50%)`;
    this.ring.style.transform = `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0) translate(-50%, -50%)`;

    requestAnimationFrame(this._raf);
  }
}
