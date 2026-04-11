// Hero UI: panel toggles, CV download, magnetic buttons, entry reveal.
// Handles keyboard (Escape to close), aria state, contact action, and
// close-buttons inside each panel.

import gsap from 'gsap';
import { magnetizeAll } from './MagneticButton.js';
import { revealHeadline } from './Typography.js';

// Central contact action — one place to change if you ever swap email for a form.
const CONTACT_EMAIL = 'npertierra7@gmail.com';
const CONTACT_SUBJECT = 'Hello Nicolas — from your portfolio';
const CONTACT_BODY =
  "Hi Nicolas,\n\nI came across your portfolio and I'd love to talk about\n\n— \n";

function triggerContact() {
  const href =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(CONTACT_SUBJECT)}` +
    `&body=${encodeURIComponent(CONTACT_BODY)}`;
  window.location.href = href;
}

export function initHero() {
  const panelIds = ['about', 'skills', 'interests', 'courses'];
  const panels = {};
  panelIds.forEach((id) => {
    panels[id] = document.getElementById(`${id}-panel`);
  });

  const triggers = Array.from(document.querySelectorAll('[data-panel]'));

  function setPanel(name, force) {
    const target = panels[name];
    if (!target) return;
    const willOpen = force ?? !target.classList.contains('active');

    // Close all
    Object.values(panels).forEach((p) => p && p.classList.remove('active'));
    triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));

    if (willOpen) {
      target.classList.add('active');
      const trig = triggers.find((t) => t.dataset.panel === name);
      if (trig) trig.setAttribute('aria-expanded', 'true');
    }
  }

  function closeAll() {
    Object.values(panels).forEach((p) => p && p.classList.remove('active'));
    triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
  }

  triggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setPanel(btn.dataset.panel);
    });
  });

  // Close buttons inside panels
  document.querySelectorAll('.info-panel .panel-close').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAll();
    });
  });

  // Keyboard: Escape closes any open panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const anyOpen = Object.values(panels).some(
        (p) => p && p.classList.contains('active')
      );
      if (anyOpen) {
        e.preventDefault();
        closeAll();
        // Return focus to the first hero trigger so keyboard users don't get lost.
        const first = triggers[0];
        if (first) first.focus();
      }
    }
  });

  // Magnetic pull on interactive buttons (desktop only).
  magnetizeAll('.hero-btn', { strength: 0.3, max: 18 });

  // Contact action wiring — any element with [data-contact-action] or #contact-btn
  const contactNodes = document.querySelectorAll(
    '#contact-btn, [data-contact-action]'
  );
  contactNodes.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      triggerContact();
    });
  });

  // Close panels on outside click (but not on contact/footer controls).
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hero-actions, .info-panel')) {
      closeAll();
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
