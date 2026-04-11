// Core Three.js scene: renderer, camera, HDR env, cinematic lighting,
// postprocessing bloom, mouse parallax, resize. Everything else plugs in here.

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { damp, isTouch, prefersReducedMotion } from '../utils/math.js';

// Poly Haven studio HDR — small, CC0, clean neutral studio lighting.
const HDR_URL =
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr';

export class Scene {
  constructor(canvas, loadingManager) {
    this.canvas = canvas;
    this.loadingManager = loadingManager;

    // Track viewport & mouse with separate target/current for smoothing.
    this.size = { w: window.innerWidth, h: window.innerHeight };
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scroll = 0;
    this.reducedMotion = prefersReducedMotion();
    this.mobile = isTouch() || this.size.w < 768;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initPost();
    this._bindEvents();
    this._loadEnvironment();

    this.clock = new THREE.Clock();
    this.onTick = null; // set by orchestrator
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.mobile,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.size.w, this.size.h);
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    // Volumetric fog gives the neural mesh depth & mystery.
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.028);
  }

  _initCamera() {
    // FOV widens on portrait so the scene doesn't crop on phones.
    const aspect = this.size.w / this.size.h;
    const fov = aspect < 1 ? 85 : 70;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
    this.camera.position.set(0, 0, 6);
    this.baseFov = fov;
  }

  _initLights() {
    // Ambient fill — just enough so shadowed sides aren't pitch black.
    this.scene.add(new THREE.AmbientLight(0x3a4a60, 0.4));

    // Cool key light (tech).
    const key = new THREE.SpotLight(0x5ce0ff, 2.2, 60, Math.PI / 5, 0.5, 1.5);
    key.position.set(8, 10, 10);
    this.scene.add(key);

    // Warm rim light (human).
    const rim = new THREE.SpotLight(0xffc88a, 1.0, 50, Math.PI / 4, 0.6, 1.5);
    rim.position.set(-10, -6, -8);
    this.scene.add(rim);

    // Soft hemisphere adds ground/sky bounce.
    this.scene.add(new THREE.HemisphereLight(0x1a2540, 0x05070d, 0.3));
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(this.size.w, this.size.h);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom is the whole look — tuned low so it doesn't bleed over text.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.size.w, this.size.h),
      this.mobile ? 0.45 : 0.7, // strength
      0.85,                      // radius
      0.82                       // threshold
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.bloom = bloom;
  }

  _loadEnvironment() {
    new RGBELoader(this.loadingManager).load(
      HDR_URL,
      (hdr) => {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        const env = pmrem.fromEquirectangular(hdr).texture;
        this.scene.environment = env;
        this.envMap = env;
        hdr.dispose();
        pmrem.dispose();
      },
      undefined,
      () => {
        // If HDR fails (CORS, offline) the scene still looks fine.
        console.warn('HDR environment failed to load; continuing without.');
      }
    );
  }

  _bindEvents() {
    this._onResize = this._onResize.bind(this);
    this._onMouse = this._onMouse.bind(this);
    this._onTouch = this._onTouch.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('mousemove', this._onMouse, { passive: true });
    // Mobile: gentle parallax from touch drag so the hero doesn't feel flat.
    window.addEventListener('touchmove', this._onTouch, { passive: true });
  }

  _onResize() {
    this.size.w = window.innerWidth;
    this.size.h = window.innerHeight;
    const aspect = this.size.w / this.size.h;

    this.mobile = isTouch() || this.size.w < 768;
    this.baseFov = aspect < 1 ? 85 : 70;
    this.camera.fov = this.baseFov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.size.w, this.size.h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(this.size.w, this.size.h);
  }

  _onMouse(e) {
    // Normalized -1..1
    this.mouse.tx = (e.clientX / this.size.w) * 2 - 1;
    this.mouse.ty = -((e.clientY / this.size.h) * 2 - 1);
  }

  _onTouch(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    // Gentler parallax range on touch so the scene breathes without feeling jittery.
    this.mouse.tx = ((t.clientX / this.size.w) * 2 - 1) * 0.6;
    this.mouse.ty = -((t.clientY / this.size.h) * 2 - 1) * 0.6;
  }

  setScroll(v) {
    this.scroll = v;
  }

  tick(dt) {
    const time = this.clock.getElapsedTime();

    // Smooth mouse → parallax on camera (LERP'd breathing).
    if (!this.reducedMotion) {
      this.mouse.x = damp(this.mouse.x, this.mouse.tx, 0.12, dt);
      this.mouse.y = damp(this.mouse.y, this.mouse.ty, 0.12, dt);
      this.camera.position.x = this.mouse.x * 0.6;
      this.camera.position.y = this.mouse.y * 0.4;
      this.camera.lookAt(0, 0, this.camera.position.z - 10);
    }

    if (this.onTick) this.onTick(time, dt);
    this.composer.render();
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMouse);
    this.renderer.dispose();
  }
}
