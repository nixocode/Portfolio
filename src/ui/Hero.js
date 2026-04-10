// Hero UI: panel toggles, CV download, magnetic buttons, entry reveal.
// Removes the inline onclick soup from index.html.

import gsap from 'gsap';
import { magnetizeAll } from './MagneticButton.js';
import { revealHeadline } from './Typography.js';

export function initHero() {
  // Toggle behavior for About / Skills panels.
  const panels = {
    about: document.getElementById('about-panel'),
    skills: document.getElementById('skills-panel'),
  };

  document.querySelectorAll('[data-panel]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = btn.dataset.panel;
      const target = panels[name];
      if (!target) return;

      const isActive = target.classList.contains('active');
      Object.values(panels).forEach((p) => p && p.classList.remove('active'));
      if (!isActive) target.classList.add('active');
    });
  });

  // Magnetic pull on interactive buttons.
  magnetizeAll('.hero-btn', { strength: 0.3, max: 18 });

  // Close panels on outside click.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hero-actions, .info-panel')) {
      Object.values(panels).forEach((p) => p && p.classList.remove('active'));
    }
  });
}

export function revealHero() {
  const h1 = document.querySelector('.hero h1');
  const sub = document.querySelector('.hero .hero-subtitle');
  const actions = document.querySelector('.hero-actions');
  const scrollCue = document.querySelector('.scroll-cue');

  const tl = gsap.timeline();
  if (h1) tl.add(revealHeadline(h1, { stagger: 0.03 }), 0);
  if (sub) {
    tl.fromTo(sub,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' },
      '-=0.6'
    );
  }
  if (actions) {
    tl.fromTo(actions,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' },
      '-=0.7'
    );
  }
  if (scrollCue) {
    tl.fromTo(scrollCue,
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: 'power2.out' },
      '-=0.3'
    );
  }
  return tl;
}
