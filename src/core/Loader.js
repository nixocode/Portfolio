// Cinematic loader tied to THREE.LoadingManager + document.fonts.
// Progress bar fills as assets load; on complete, the loader splits
// horizontally and slides off while the hero reveal begins.

import * as THREE from 'three';
import gsap from 'gsap';

export class Loader {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.fontsDone = false;
    this.assetsDone = false;

    this.el = document.getElementById('loader');
    this.bar = this.el.querySelector('.loader-bar-fill');
    this.pctEl = this.el.querySelector('.loader-pct');

    // Three.js manager — Scene.js passes this to every loader.
    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (_url, loaded, total) => {
      const pct = total > 0 ? loaded / total : 1;
      this._setProgress(pct * 0.9); // reserve last 10% for fonts
    };
    this.manager.onLoad = () => {
      this.assetsDone = true;
      this._maybeFinish();
    };
    this.manager.onError = () => {
      // Don't block the page on a failed asset — just advance.
      this.assetsDone = true;
      this._maybeFinish();
    };

    // Fonts.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.fontsDone = true;
        this._maybeFinish();
      });
    } else {
      this.fontsDone = true;
    }

    // No heavy network assets anymore — mark ready next tick so fonts gate finish.
    requestAnimationFrame(() => {
      this.assetsDone = true;
      this._setProgress(0.9);
      this._maybeFinish();
    });

    // Safety net: if fonts never resolve, still finish.
    this.timeout = setTimeout(() => {
      this.assetsDone = true;
      this.fontsDone = true;
      this._maybeFinish();
    }, 3000);
  }

  _setProgress(p) {
    const pct = Math.round(Math.min(1, p) * 100);
    if (this.bar) gsap.to(this.bar, { scaleX: Math.min(1, p), duration: 0.5, ease: 'power2.out' });
    if (this.pctEl) this.pctEl.textContent = `${pct.toString().padStart(3, '0')}`;
  }

  _maybeFinish() {
    if (!this.assetsDone || !this.fontsDone || this._finished) return;
    this._finished = true;
    clearTimeout(this.timeout);
    this._setProgress(1);

    // Cinematic exit: bar fills, text fades, panels slide apart, reveal hero.
    const tl = gsap.timeline({
      onComplete: () => {
        this.el.style.display = 'none';
        if (this.onComplete) this.onComplete();
      },
    });
    tl.to('.loader-inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
      .to('.loader-panel-top', { yPercent: -100, duration: 1.0, ease: 'expo.inOut' }, '+=0.1')
      .to('.loader-panel-bottom', { yPercent: 100, duration: 1.0, ease: 'expo.inOut' }, '<');
  }
}
