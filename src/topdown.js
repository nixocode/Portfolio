// Top Down View — the standalone "whole network at once" page.
//
// This is the rework's 3D node metaverse (src/three/NeuralScene.js), opened in
// its own tab from the main site. You land on an overview of every discipline
// lane, and scrolling flies the camera down through the network. Clicking a
// node opens that project's panel.

import './app.css';
import { knownProjects } from './ui/Projects.js';
import { createPanel, LANES } from './graph/Graph.js';
import { NeuralScene } from './three/NeuralScene.js';
import { initGestures } from './cinema/gestures.js';

function boot() {
  const $ = (id) => document.getElementById(id);

  const panel = createPanel();

  const scene = new NeuralScene(
    {
      cinema: $('cinema'),
      sticky: $('cine-sticky'),
      canvas: $('threads'),
      overlay: $('cine-overlay'),
    },
    knownProjects,
    {
      onNodeClick: (project, accent) => panel.open(project, accent),
      particles: false,   // minimal: threads + nodes only, no ambient dust
      scrollEase: 0.11,   // smooth but tighter — 0.16 felt laggy on input
    }
  );

  // ---- Lane chips ----
  const nav = $('nav-chips');
  LANES.forEach((lane, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'nav-chip';
    chip.style.setProperty('--accent', lane.accent);
    chip.dataset.lane = String(i);
    chip.innerHTML = `<span class="chip-dot"></span><span>${lane.label}</span>`;
    chip.addEventListener('click', () => { scene.setActive(i); reflectNav(i); });
    nav.appendChild(chip);
  });
  const reflectNav = (i) => nav.querySelectorAll('.nav-chip').forEach((c) =>
    c.setAttribute('aria-current', c.dataset.lane === String(i) ? 'true' : 'false'));
  reflectNav(scene.activeLane);

  // ---- Shared prev/next (keys, arrows, swipe) ----
  const panelOpen = () => !!document.querySelector('.panel-overlay.open');
  const goPrev = () => { const i = Math.max(0, scene.activeLane - 1); scene.setActive(i); reflectNav(i); };
  const goNext = () => { const i = Math.min(LANES.length - 1, scene.activeLane + 1); scene.setActive(i); reflectNav(i); };

  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea')) return;
    if (panelOpen()) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { e.preventDefault(); goPrev(); }
    else if (k === 'arrowright' || k === 'd') { e.preventDefault(); goNext(); }
  });

  initGestures({ onNext: goNext, onPrev: goPrev, blocked: panelOpen });

  $('arrow-prev').addEventListener('click', goPrev);
  $('arrow-next').addEventListener('click', goNext);

  // Source/sink dots pull the camera back out to the full overview.
  $('cine-source').addEventListener('click', () => scene.toOverview());
  $('cine-sink').addEventListener('click', () => scene.toOverview());

  // Fade the hint out once you start exploring.
  const hint = $('td-hint');
  const hide = () => { hint.classList.add('gone'); window.removeEventListener('scroll', hide); };
  window.addEventListener('scroll', hide, { passive: true, once: true });
  setTimeout(hide, 6000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
