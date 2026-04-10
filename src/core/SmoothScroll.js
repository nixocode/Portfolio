// Lenis + GSAP ticker bridge. This is the single source of truth for
// scroll position; Scene and ScrollTrigger both read from here.

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../utils/math.js';

gsap.registerPlugin(ScrollTrigger);

export class SmoothScroll {
  constructor() {
    const reduce = prefersReducedMotion();

    this.lenis = new Lenis({
      // Lower = snappier, higher = buttery.
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !reduce,
      syncTouch: false,
      touchMultiplier: 1.5,
    });

    // Each Lenis scroll event becomes a ScrollTrigger update.
    this.lenis.on('scroll', ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker — one RAF loop to rule them all.
    gsap.ticker.add((time) => {
      this.lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    this.progress = 0;
    this.lenis.on('scroll', ({ scroll, limit }) => {
      this.progress = limit > 0 ? scroll / limit : 0;
    });
  }

  scrollTo(target, opts = {}) {
    this.lenis.scrollTo(target, { duration: 1.4, ...opts });
  }

  stop()  { this.lenis.stop();  }
  start() { this.lenis.start(); }
}
