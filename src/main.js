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
import { SmoothScroll } from './core/SmoothScroll.js';
import { Cursor } from './core/Cursor.js';
import { loadProjects, renderProjects } from './ui/Projects.js';
import { initHero, revealHero } from './ui/Hero.js';
import { revealProjects, currentProjectIndex } from './ui/ScrollReveal.js';
import { magnetizeAll } from './ui/MagneticButton.js';

gsap.registerPlugin(ScrollTrigger);

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
  renderProjects(projects, container);

  // --- Three.js scene, using the loader's manager for HDR tracking ---
  const scene = new Scene(canvas, loader.manager);
  const neural = new NeuralField(scene.scene, { count: scene.mobile ? 3500 : 6500 });
  const fibers = new FiberNetwork(scene.scene, {
    nodeCount: scene.mobile ? 90 : 150,
    maxConnections: 3,
    maxDist: 7,
  });
  const projectNodes = new ProjectNodes(
    scene.scene,
    scene.camera,
    projects,
    (project) => {
      // Click on a neural node → open its live URL.
      const url = project.live_url || project.html_url;
      if (url) window.open(url, '_blank', 'noopener');
    }
  );

  // --- Smooth scroll ---
  const smooth = new SmoothScroll();

  // --- Camera scroll scrub along the neural path ---
  // The last project node sits at z = -4 - (n-1)*6, so travel that far + some padding.
  const totalDepth = 4 + projects.length * 6 + 6;
  ScrollTrigger.create({
    trigger: '#app',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      // Camera descends forward; mouse parallax adds on top of this.
      scene.camera.position.z = 6 - self.progress * totalDepth;
      // Very gentle sway along the path so we're not on a rail.
      scene.camera.position.x += Math.sin(self.progress * Math.PI * 2) * 0.8;
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
    projectNodes.update(time, dt);

    // Highlight whichever project card is nearest the viewport center.
    const active = currentProjectIndex(projects.length);
    projectNodes.setActiveByIndex(active);
  };

  gsap.ticker.add(() => scene.tick(1 / 60));

  sceneReadyResolve();
}

document.addEventListener('DOMContentLoaded', bootstrap);
