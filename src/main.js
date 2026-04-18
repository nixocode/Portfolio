// Orchestrator. Keeps module wiring in one place, does no heavy lifting itself.
//
// Flow:
//   1. Start loader + begin fetching projects in parallel
//   2. Scene.js sets up Three.js (HDR etc) using the loader's LoadingManager
//   3. When all assets done → loader fades, hero reveals, Lenis starts,
//      project nodes + scroll reveals come online

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { Loader } from './core/Loader.js';
import { Scene } from './webgl/Scene.js';
import { NeuralField } from './webgl/NeuralField.js';
import { FiberNetwork } from './webgl/FiberNetwork.js';
import { ProjectNodes } from './webgl/ProjectNodes.js';
import { Biomes } from './webgl/Biomes.js';
import { SmoothScroll } from './core/SmoothScroll.js';
import { Cursor } from './core/Cursor.js';
import { loadProjects, renderProjects } from './ui/Projects.js';
import { initHero, revealHero } from './ui/Hero.js';
import { revealProjects, currentProjectIndex } from './ui/ScrollReveal.js';
import { magnetizeAll } from './ui/MagneticButton.js';
import { damp } from './utils/math.js';

gsap.registerPlugin(ScrollTrigger);

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

async function bootstrap() {
  const canvas = document.getElementById('webgl');
  new Cursor();

  // --- Loader kicked off first so HDR loads through its LoadingManager ---
  let sceneReadyResolve;
  const sceneReady = new Promise((r) => (sceneReadyResolve = r));

  const loader = new Loader(() => {
    // Loader has faded. Reveal hero and start scroll + reveals.
    revealHero();
    revealProjects();
    ScrollTrigger.refresh();
  });

  // --- Fetch projects in parallel with scene setup ---
  const [projects] = await Promise.all([
    loadProjects(),
    new Promise((r) => requestAnimationFrame(r)),
  ]);

  const container = document.getElementById('projects-container');
  // renderProjects groups by category and returns the ordered list — pass that
  // ordered list to ProjectNodes so DOM index == WebGL node index.
  const ordered = renderProjects(projects, container);

  // --- Three.js scene ---
  const scene = new Scene(canvas, loader.manager);
  // Global ambient field is lighter now — per-biome clusters supplement it.
  const neural = new NeuralField(scene.scene, { count: scene.mobile ? 1000 : 2000 });
  const fibers = new FiberNetwork(scene.scene, {
    nodeCount: scene.mobile ? 50 : 90,
    maxConnections: 3,
    maxDist: 7,
  });
  const projectNodes = new ProjectNodes(
    scene.scene,
    scene.camera,
    ordered,
    (project) => {
      const url = project.live_url || project.html_url;
      if (!url) return;
      // Allowlist protocols — defence-in-depth for anything that makes
      // it to the 3D-click path without passing through Projects.js.
      try {
        const u = new URL(url, window.location.origin);
        if (u.protocol === 'https:' || u.protocol === 'http:') {
          window.open(u.href, '_blank', 'noopener,noreferrer');
        }
      } catch { /* malformed URL — silently ignore */ }
    }
  );

  // Compute per-branch z-ranges from the actual trunk points so biome
  // clusters hug each branch's real extent.
  const zRanges = {};
  Object.entries(projectNodes.branchTrunks).forEach(([cat, pts]) => {
    if (!pts.length) { zRanges[cat] = { zStart: -6, zEnd: -30 }; return; }
    const zs = pts.map(p => p.z);
    zRanges[cat] = { zStart: Math.max(...zs) + 2, zEnd: Math.min(...zs) - 4 };
  });
  const biomes = new Biomes(scene.scene, { mobile: scene.mobile, zRanges });

  // --- Smooth scroll ---
  const smooth = new SmoothScroll();

  // --- Pointer-branching with continuous blending ---
  //   Left third = marketing, center = webdesign/AI, right = games.
  //   Each zone has a weight (0..1) driven by how close the pointer is
  //   to that third's centre. Weights smooth-step & normalize, then
  //   drive: (a) DOM track opacity/blur, (b) camera position as a
  //   weighted sample of each branch's CatmullRom curve. Riding the
  //   curve itself is what makes the neural paths feel distinct —
  //   marketing S-sweeps, webdesign spirals, games zig-zags.
  const ZONES = ['marketing', 'webdesign', 'games'];
  const ZONE_CENTERS = { marketing: 1 / 6, webdesign: 3 / 6, games: 5 / 6 };
  const FALLOFF = 0.30; // larger = more overlap/blend between zones
  // Must match BIOMES[*].x in ProjectNodes — wide spacing so tributaries never cross.
  const branchLanes = { marketing: -14, webdesign: 0, games: 14, others: 22 };
  const branchLengths = ['marketing', 'webdesign', 'games', 'others'].map(
    (id) => ordered.filter((p) => p.category === id).length
  );
  const maxBranch = Math.max(1, ...branchLengths);
  const totalDepth = 6 + (maxBranch - 1) * 5.2 + 10;

  const trackEls = {};
  document.querySelectorAll('.branch-track').forEach((el) => {
    trackEls[el.dataset.branch] = el;
    // Remove the CSS transition — JS now drives opacity per frame,
    // smoothing happens via damped weights so CSS transition would just
    // fight the per-frame update.
    el.style.transition = 'none';
  });

  // Raw pointer X (0..1 across viewport). Also settable by the hero
  // branch-picker (hover), by keyboard (← → / A D), and by clicking a
  // chip's down-arrow to dive into that tributary.
  let pointerFrac = 0.5;
  // When the user explicitly picked a branch (hover chip, key press),
  // we latch to that zone's centre and ignore mouse X until they move
  // the mouse again — otherwise hovering a chip in the centre would
  // snap straight back to "webdesign" the moment they leave.
  let latchedFrac = null;
  let lastMouseX = window.innerWidth / 2;
  const LATCH_RELEASE_PX = 40;

  const setFrac = (x) => { pointerFrac = Math.max(0, Math.min(1, x / window.innerWidth)); };
  window.addEventListener('mousemove', (e) => {
    // If a latch is active, release it only once the user has moved the
    // mouse a real distance — tiny jitter shouldn't unlatch.
    if (latchedFrac != null && Math.abs(e.clientX - lastMouseX) > LATCH_RELEASE_PX) {
      latchedFrac = null;
      document.querySelectorAll('.branch-chip[aria-current="true"]').forEach((c) =>
        c.setAttribute('aria-current', 'false')
      );
    }
    lastMouseX = e.clientX;
    if (latchedFrac == null) setFrac(e.clientX);
    else pointerFrac = latchedFrac;
  }, { passive: true });
  window.addEventListener('touchmove',  (e) => { const t = e.touches?.[0]; if (t) { latchedFrac = null; setFrac(t.clientX); } }, { passive: true });
  window.addEventListener('touchstart', (e) => { const t = e.touches?.[0]; if (t) { latchedFrac = null; setFrac(t.clientX); } }, { passive: true });

  const selectBranch = (zone) => {
    if (!ZONE_CENTERS[zone]) return;
    latchedFrac = ZONE_CENTERS[zone];
    pointerFrac = latchedFrac;
    // Reflect active state on chips for accessibility + styling.
    document.querySelectorAll('.branch-chip').forEach((c) => {
      c.setAttribute('aria-current', c.dataset.branch === zone ? 'true' : 'false');
    });
  };

  // Find the first DOM section for a branch and smooth-scroll to it.
  const descendInto = (zone) => {
    selectBranch(zone);
    const target = document.querySelector(
      `.branch-track[data-branch="${zone}"] .project-section`
    );
    if (target) {
      smooth.scrollTo
        ? smooth.scrollTo(target, { offset: -60, duration: 1.0 })
        : target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Wire each chip. Hover selects (latches), click dives in.
  document.querySelectorAll('.branch-chip').forEach((chip) => {
    const zone = chip.dataset.branch;
    chip.addEventListener('mouseenter', () => selectBranch(zone));
    chip.addEventListener('focus',      () => selectBranch(zone));
    chip.addEventListener('click',      () => descendInto(zone));
  });

  // Latch the tributary while the mouse is hovering a project card so
  // moving the cursor toward "View Live" on a left-aligned Marketing
  // card doesn't accidentally cross into the right-screen zone and fade
  // the card out from under the click.
  const attachCardLatch = () => {
    document.querySelectorAll('.branch-track .project-section').forEach((sec) => {
      const zone = sec.closest('.branch-track')?.dataset.branch;
      if (!zone) return;
      sec.addEventListener('mouseenter', () => {
        latchedFrac = ZONE_CENTERS[zone] ?? latchedFrac;
      });
      sec.addEventListener('mouseleave', () => {
        // Don't hard-release here — the free-mouse mousemove with >40px
        // travel is what naturally unlatches. Leaving the card while
        // still in the same zone should keep the track stable.
      });
    });
  };
  attachCardLatch();

  // --- Keyboard navigation ----------------------------------------------
  //   ← → / A D : cycle tributaries
  //   ↓  / S    : next project section (autorepeat → fast descent to end)
  //   ↑  / W    : previous section (autorepeat → fast ascent to hero)
  //   Space     : open the currently-active project's live URL
  //
  // Native browser arrow-scroll was fighting Lenis, so we override:
  // each keydown scrolls to the next/prev `.project-section`. Browser
  // autorepeat fires ~30Hz on hold — throttled to 120ms so it doesn't
  // overshoot, and Lenis re-targets smoothly each tick so holding the
  // key produces a fast continuous descent instead of a series of jolts.

  const getOrderedSections = () =>
    Array.from(document.querySelectorAll('.project-section'));

  // Index of the section whose top is closest to the viewport's upper
  // third — that's the "current" project the user is reading.
  const currentSectionIndex = (sections) => {
    const anchor = window.innerHeight * 0.35;
    let best = 0;
    let bestDist = Infinity;
    sections.forEach((el, i) => {
      const top = el.getBoundingClientRect().top;
      const d = Math.abs(top - anchor);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const jumpSection = (dir) => {
    const sections = getOrderedSections();
    if (!sections.length) return;
    const cur = currentSectionIndex(sections);
    const next = Math.max(0, Math.min(sections.length - 1, cur + dir));
    // If already at the end and user presses down again, scroll to footer.
    if (cur === next && dir > 0) {
      const footer = document.querySelector('footer, .site-footer');
      if (footer && smooth.scrollTo) {
        smooth.scrollTo(footer, { duration: 0.6 });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    // If already at the start and user presses up again, scroll to hero.
    if (cur === next && dir < 0) {
      const hero = document.getElementById('hero');
      if (hero && smooth.scrollTo) smooth.scrollTo(hero, { duration: 0.6 });
      return;
    }
    const target = sections[next];
    // Also pick up the active tributary from the target card's parent so
    // the WebGL camera follows along on keyboard nav.
    const trackZone = target.closest('.branch-track')?.dataset.branch;
    if (trackZone) selectBranch(trackZone);
    if (smooth.scrollTo) {
      smooth.scrollTo(target, { offset: -80, duration: 0.55 });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  let lastKeyNavAt = 0;
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const current = ZONES.reduce((best, z) =>
      weights[z] > (weights[best] ?? 0) ? z : best, 'webdesign');
    const idx = ZONES.indexOf(current);
    const k = e.key.toLowerCase();

    // Lateral tributary switching — only on fresh key, not autorepeat,
    // otherwise holding ← would rifle past marketing instantly.
    if (k === 'arrowleft' || k === 'a') {
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      selectBranch(ZONES[Math.max(0, idx - 1)]);
      return;
    }
    if (k === 'arrowright' || k === 'd') {
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      selectBranch(ZONES[Math.min(ZONES.length - 1, idx + 1)]);
      return;
    }

    // Vertical scroll — tap = one section, hold = rapid throttled descent.
    if (k === 'arrowdown' || k === 's') {
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastKeyNavAt < 120) return;
      lastKeyNavAt = now;
      jumpSection(+1);
      return;
    }
    if (k === 'arrowup' || k === 'w') {
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastKeyNavAt < 120) return;
      lastKeyNavAt = now;
      jumpSection(-1);
      return;
    }

    // Space = open the currently-active project's primary URL.
    // (Browser default would be page-down; we'd rather make Space useful.)
    // But if focus is on a real button/link we MUST let Space activate it
    // — hijacking native keyboard activation would break accessibility.
    if (k === ' ' || e.code === 'Space') {
      const t = e.target;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' ||
                t.getAttribute?.('role') === 'button')) {
        return;
      }
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      const sections = getOrderedSections();
      if (!sections.length) return;
      const cur = sections[currentSectionIndex(sections)];
      const link = cur?.querySelector('.project-links a[href]');
      if (link && link.href) {
        const u = link.href;
        try {
          const parsed = new URL(u);
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            window.open(parsed.href, '_blank', 'noopener,noreferrer');
          }
        } catch { /* ignore malformed */ }
      }
    }
  });

  // Smoothed weights per zone. Initialised to "webdesign dominant" so
  // there's a sensible default before the pointer moves.
  const weights = { marketing: 0, webdesign: 1, games: 0 };

  const computeRawWeights = (frac) => {
    const raw = {};
    let sum = 0;
    ZONES.forEach((z) => {
      const d = Math.abs(frac - ZONE_CENTERS[z]);
      const w = Math.max(0, 1 - d / FALLOFF);
      // Smoothstep for a softer falloff near the zone edge.
      raw[z] = w * w * (3 - 2 * w);
      sum += raw[z];
    });
    if (sum > 0) ZONES.forEach((z) => (raw[z] /= sum));
    else raw.webdesign = 1;
    return raw;
  };

  ScrollTrigger.create({
    trigger: '#app',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      scene.cameraZ = 6 - self.progress * totalDepth;
      scene.setScroll(self.progress);
    },
  });

  // --- Hero UI wiring ---
  initHero();
  // Magnetize project link arrows too.
  magnetizeAll('.project-links a', { strength: 0.25, max: 12 });

  // --- Per-frame tick ---
  let last = performance.now();
  scene.onTick = (time) => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    neural.update(time, smooth.progress, scene.mouse);
    fibers.update(time, smooth.progress, scene.mouse);
    biomes.update(time, smooth.progress, scene.mouse);
    projectNodes.update(time, dt);

    // Continuous weighted blend between the three zones. Damp the
    // smoothed `weights` toward the raw (normalised) zone weights so
    // transitions between panels feel fluid instead of snapping.
    const raw = computeRawWeights(pointerFrac);
    let dominant = 'webdesign';
    let maxW = 0;
    ZONES.forEach((z) => {
      weights[z] = damp(weights[z], raw[z], 0.10, dt);
      if (weights[z] > maxW) { maxW = weights[z]; dominant = z; }
    });

    // Per-frame DOM: opacity + blur + saturate driven by smoothed weight.
    // Gives cross-fade between the three overlapping branch tracks.
    ZONES.forEach((z) => {
      const el = trackEls[z];
      if (!el) return;
      const w = weights[z];
      el.style.opacity = (0.04 + w * 0.96).toFixed(3);
      el.style.filter = `blur(${((1 - w) * 12).toFixed(2)}px) saturate(${(0.35 + w * 0.65).toFixed(2)})`;
      el.style.pointerEvents = w > 0.5 ? 'auto' : 'none';
      el.dataset.active = (z === dominant) ? 'true' : 'false';
    });

    // Camera rides a weighted sample of each branch's CatmullRomCurve3.
    // This is what physically sends the camera down a different neural
    // path per zone — marketing S-sweeps, webdesign spirals up/down,
    // games zig-zags — rather than just sliding laterally.
    const curves = projectNodes.curves || {};
    const progress = Math.max(0, Math.min(0.98, scene.scroll ?? 0));
    let tx = 0, ty = 0, wSum = 0;
    ZONES.forEach((z) => {
      const c = curves[z];
      if (!c) return;
      const pt = c.getPoint(progress);
      tx += pt.x * weights[z];
      ty += pt.y * weights[z];
      wSum += weights[z];
    });
    if (wSum > 0) { tx /= wSum; ty /= wSum; }
    else { tx = branchLanes[dominant]; ty = 0; }

    scene.cameraLaneX = damp(scene.cameraLaneX, tx, 0.10, dt);
    scene.cameraLaneY = damp(scene.cameraLaneY, ty * 0.4, 0.10, dt);

    projectNodes.setActiveCategory(dominant);

    // Colour ramp — hero stays monochrome (progress 0), colour ramps in
    // as the camera descends. Starts engaging around 4% scroll, fully
    // saturated by ~35% so the paths read as red/green/blue well before
    // you reach the bottom of the page.
    const p = Math.max(0, Math.min(1, (scene.scroll - 0.04) / 0.31));
    const sat = p * p * (3 - 2 * p);
    projectNodes.setSaturation(sat);
    if (biomes.setSaturation) biomes.setSaturation(sat);

    // Highlight whichever project card is nearest the viewport center.
    const active = currentProjectIndex(ordered.length);
    projectNodes.setActiveByIndex(active);
  };

  // GSAP's ticker callback provides real elapsed time in seconds — use it
  // so we match the display's actual refresh rate (120Hz, 60Hz, 30Hz).
  // Clamp between 0 and 0.1s so a tab regaining focus can't produce a huge jump.
  gsap.ticker.lagSmoothing(1000, 16);
  gsap.ticker.add((_t, deltaMs) => {
    const dt = Math.min(0.1, Math.max(0, (deltaMs || 16) / 1000));
    scene.tick(dt);
  });

  sceneReadyResolve();
}

document.addEventListener('DOMContentLoaded', bootstrap);
