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

  // --- PSP / XMB tributary lanes -----------------------------------------
  //
  // Three rails (marketing | webdesign | games) live at the same vertical
  // position. Only the ACTIVE rail is in document flow, so vertical scroll
  // only traverses the active lane's cards — you can't accidentally
  // "scroll past" Marketing into Webdesign. To switch lanes, the user
  // hits ← / →, A / D, or clicks a chip. The inactive rails are visible
  // off to the sides at depth (slid out, blurred, tilted) — XMB feel.
  //
  // ↑ / ↓  : traverse the active lane's project sections (stays on lane)
  // ← / →  : flip lanes with a horizontal slide animation
  // Space  : open the centered card's primary link
  //
  // Camera & WebGL nodes follow `activeZone` so the 3D scene's nodes are
  // strictly the ones for the selected lane.
  const ZONES = ['marketing', 'webdesign', 'games'];
  // Must match BIOMES[*].x in ProjectNodes — wide spacing so tributaries never cross.
  const branchLanes = { marketing: -14, webdesign: 0, games: 14, others: 22 };
  const branchLengths = ['marketing', 'webdesign', 'games', 'others'].map(
    (id) => ordered.filter((p) => p.category === id).length
  );
  const maxBranch = Math.max(1, ...branchLengths);
  const totalDepth = 6 + (maxBranch - 1) * 5.2 + 10;

  const trackEls = {};
  document.querySelectorAll('[data-branch]').forEach((el) => {
    trackEls[el.dataset.branch] = el;
  });

  // The active rail. CSS selector `[data-active="true"]` keeps it in flow;
  // siblings get `data-side="left|right|hidden"` based on their position
  // in the ZONES list relative to the active one.
  let activeZone = 'webdesign';

  const sideOf = (z, active) => {
    const i = ZONES.indexOf(z);
    const j = ZONES.indexOf(active);
    if (i === j) return null;
    if (Math.abs(i - j) === 1) return i < j ? 'left' : 'right';
    return 'hidden'; // 2 lanes away — fully removed (e.g. games when active=marketing)
  };

  const reflectChipState = (zone) => {
    document.querySelectorAll('.branch-chip').forEach((c) => {
      c.setAttribute('aria-current', c.dataset.branch === zone ? 'true' : 'false');
    });
  };

  // Apply data-active / data-side / data-enter so CSS animates the swap.
  const applyLaneState = (zone, enterFrom = null) => {
    ZONES.forEach((z) => {
      const el = trackEls[z];
      if (!el) return;
      const isActive = z === zone;
      el.dataset.active = isActive ? 'true' : 'false';
      if (isActive) {
        if (enterFrom) el.dataset.enter = enterFrom;
        else delete el.dataset.enter;
        delete el.dataset.side;
      } else {
        delete el.dataset.enter;
        el.dataset.side = sideOf(z, zone);
      }
    });
    // The "others" epilogue track is always visible and never moves —
    // it just shouldn't get side classes.
    if (trackEls.others) {
      trackEls.others.dataset.active = 'true';
      delete trackEls.others.dataset.side;
      delete trackEls.others.dataset.enter;
    }
  };

  // Smooth-scroll to the start of `zone`'s first card. Run inside rAF so
  // the just-applied data-active swap (which flips `position: absolute →
  // relative`) has a chance to flush layout before Lenis measures the
  // target's offsetTop — otherwise the scroll target is computed against
  // the previous layout and we land at the wrong Y.
  const scrollLaneToTop = (zone) => {
    requestAnimationFrame(() => {
      const first = trackEls[zone]?.querySelector('.project-section');
      if (first && smooth.scrollTo) {
        smooth.scrollTo(first, { offset: -80, duration: 0.55 });
      }
    });
  };

  const setActiveZone = (zone, { animateFrom = null, scrollToTop = false } = {}) => {
    if (!ZONES.includes(zone)) return;
    // Same-zone re-click = bring the user back to the top of that lane —
    // PSP-style menu re-entry. No animation required, just a scroll.
    if (zone === activeZone) {
      reflectChipState(zone);
      if (scrollToTop) scrollLaneToTop(zone);
      return;
    }
    const fromIdx = ZONES.indexOf(activeZone);
    const toIdx = ZONES.indexOf(zone);
    const enterFrom = animateFrom || (toIdx > fromIdx ? 'right' : 'left');
    activeZone = zone;
    applyLaneState(zone, enterFrom);
    reflectChipState(zone);
    if (scrollToTop) scrollLaneToTop(zone);
  };

  // Initial paint.
  applyLaneState(activeZone);
  reflectChipState(activeZone);

  // Strip `data-enter` once the slide animation finishes so the attribute
  // doesn't linger on the DOM as stale state.
  ZONES.forEach((z) => {
    const el = trackEls[z];
    if (!el) return;
    el.addEventListener('animationend', () => {
      if (el.dataset.active === 'true') delete el.dataset.enter;
    });
  });

  // Wire chips. Click = swap lane WITH scroll-to-first-card so it really
  // feels like "diving into" that tributary.
  document.querySelectorAll('.branch-chip').forEach((chip) => {
    const zone = chip.dataset.branch;
    chip.addEventListener('click', () => setActiveZone(zone, { scrollToTop: true }));
  });

  // --- Touch swipe lane switching (mobile) ----------------------------
  // Only fires on a clear horizontal flick: dx > 60px AND |dx| > 1.4×|dy|.
  // Vertical scrolls and tap-scrolls are ignored, so the page still
  // scrolls naturally with one finger. Single-finger only — pinches
  // and multi-touch gestures pass through.
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchTracking = false;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touchTracking = false; return; }
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = performance.now();
    touchTracking = true;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!touchTracking) return;
    touchTracking = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = performance.now() - touchStartTime;
    // Reject slow drags (probably text-select), tiny moves, or
    // mostly-vertical motion (page scroll).
    if (dt > 800) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const idx = ZONES.indexOf(activeZone);
    if (dx < 0 && idx < ZONES.length - 1) {
      setActiveZone(ZONES[idx + 1], { scrollToTop: true });
    } else if (dx > 0 && idx > 0) {
      setActiveZone(ZONES[idx - 1], { scrollToTop: true });
    }
  }, { passive: true });

  // --- Keyboard navigation ---
  //   ← / A : previous lane (animated)
  //   → / D : next lane (animated)
  //   ↑ / W : previous card in active lane (or hero if at top)
  //   ↓ / S : next card in active lane (or footer if at bottom)
  //   Space : open the centered card's primary link

  const getActiveLaneSections = () => {
    const el = trackEls[activeZone];
    if (!el) return [];
    return Array.from(el.querySelectorAll('.project-section'));
  };

  const currentLaneSectionIndex = (sections) => {
    const anchor = window.innerHeight * 0.4;
    let best = 0;
    let bestDist = Infinity;
    sections.forEach((sec, i) => {
      const r = sec.getBoundingClientRect();
      const cy = (r.top + r.bottom) * 0.5;
      const d = Math.abs(cy - anchor);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const jumpInLane = (dir) => {
    const sections = getActiveLaneSections();
    if (!sections.length) {
      // Empty lane — fall back to hero/footer based on direction.
      const t = dir < 0
        ? document.getElementById('hero')
        : document.querySelector('footer, .site-footer');
      if (t && smooth.scrollTo) smooth.scrollTo(t, { duration: 0.6 });
      return;
    }
    const cur = currentLaneSectionIndex(sections);
    const next = cur + dir;
    if (next < 0) {
      const hero = document.getElementById('hero');
      if (hero && smooth.scrollTo) smooth.scrollTo(hero, { duration: 0.6 });
      return;
    }
    if (next >= sections.length) {
      const footer = document.querySelector('footer, .site-footer');
      if (footer && smooth.scrollTo) smooth.scrollTo(footer, { duration: 0.6 });
      return;
    }
    const target = sections[next];
    if (smooth.scrollTo) smooth.scrollTo(target, { offset: -80, duration: 0.55 });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  let lastKeyNavAt = 0;
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();

    if (k === 'arrowleft' || k === 'a') {
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      const idx = ZONES.indexOf(activeZone);
      if (idx > 0) setActiveZone(ZONES[idx - 1], { scrollToTop: true });
      return;
    }
    if (k === 'arrowright' || k === 'd') {
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      const idx = ZONES.indexOf(activeZone);
      if (idx < ZONES.length - 1) setActiveZone(ZONES[idx + 1], { scrollToTop: true });
      return;
    }
    if (k === 'arrowdown' || k === 's') {
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastKeyNavAt < 120) return;
      lastKeyNavAt = now;
      jumpInLane(+1);
      return;
    }
    if (k === 'arrowup' || k === 'w') {
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastKeyNavAt < 120) return;
      lastKeyNavAt = now;
      jumpInLane(-1);
      return;
    }
    if (k === ' ' || e.code === 'Space') {
      const t = e.target;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' ||
                t.getAttribute?.('role') === 'button')) {
        return;
      }
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      const sections = getActiveLaneSections();
      if (!sections.length) return;
      const cur = sections[currentLaneSectionIndex(sections)];
      const link = cur?.querySelector('.project-links a[href]');
      if (link?.href) {
        try {
          const u = new URL(link.href);
          if (u.protocol === 'https:' || u.protocol === 'http:') {
            window.open(u.href, '_blank', 'noopener,noreferrer');
          }
        } catch { /* ignore malformed */ }
      }
    }
  });

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

    // Camera lane follows the active tributary's lane-X, damped so the
    // pan between Marketing (-14) → Webdesign (0) → Games (+14) reads as
    // a smooth slide rather than a cut.
    const laneXTarget = branchLanes[activeZone] ?? 0;
    scene.cameraLaneX = damp(scene.cameraLaneX, laneXTarget, 0.14, dt);
    scene.cameraLaneY = damp(scene.cameraLaneY, 0, 0.14, dt);

    projectNodes.setActiveCategory(activeZone);

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
