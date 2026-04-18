// Core Three.js scene: renderer, camera, HDR env, cinematic lighting,
// postprocessing bloom, mouse parallax, resize. Everything else plugs in here.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { damp, isTouch, prefersReducedMotion } from '../utils/math.js';

export class Scene {
  constructor(canvas, loadingManager) {
    this.canvas = canvas;
    this.loadingManager = loadingManager;

    // Track viewport & mouse with separate target/current for smoothing.
    this.size = { w: window.innerWidth, h: window.innerHeight };
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scroll = 0;
    // Lateral offset set by the scroll orchestrator (which neural branch we're on).
    this.cameraLaneX = 0;
    this.cameraLaneY = 0;
    this.cameraZ = 6;
    this.reducedMotion = prefersReducedMotion();
    this.mobile = isTouch() || this.size.w < 768;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initPost();
    this._bindEvents();

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5));
    this.renderer.setSize(this.size.w, this.size.h);
    this.renderer.setClearColor(0x07080a, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    // Volumetric fog gives the neural mesh depth & mystery.
    this.scene.fog = new THREE.FogExp2(0x07080a, 0.03);
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
    // Neutral monochrome lighting — one soft key + hemi, no spotlights.
    this.scene.add(new THREE.AmbientLight(0xbfc4cc, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(6, 8, 8);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0x2a2d32, 0x07080a, 0.35));
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5));
    this.composer.setSize(this.size.w, this.size.h);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom — subtle, monochrome.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.size.w, this.size.h),
      this.mobile ? 0.15 : 0.22, // strength
      0.75,                       // radius
      0.92                        // threshold
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.bloom = bloom;
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
    const pr = Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
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

    // Smooth mouse → parallax on camera (LERP'd breathing). Lane X is
    // set by the scroll orchestrator so the camera travels each branch.
    if (!this.reducedMotion) {
      this.mouse.x = damp(this.mouse.x, this.mouse.tx, 0.12, dt);
      this.mouse.y = damp(this.mouse.y, this.mouse.ty, 0.12, dt);
      this.camera.position.x = this.cameraLaneX + this.mouse.x * 0.6;
      this.camera.position.y = -0.4 + this.cameraLaneY + this.mouse.y * 0.4;
      this.camera.position.z = this.cameraZ;
      // Look slightly up & ahead so nodes stay framed above the camera.
      this.camera.lookAt(this.cameraLaneX, 0.8 + this.cameraLaneY, this.camera.position.z - 10);
    } else {
      this.camera.position.x = this.cameraLaneX;
      this.camera.position.y = this.cameraLaneY;
      this.camera.position.z = this.cameraZ;
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
