// NeuralScene.js — the merged site: the live page's 3D "node metaverse" +
// the revamp's minimalism.
//
// Real WebGL (three.js). A 3D network floats in space: one source above, four
// discipline lanes of project nodes descending in depth, one sink below —
// threads (glowing monochrome lines) connect them like an LLM's layers.
// Scrolling flies the camera DOWN THROUGH the network. Project cards stay DOM
// (pixel-crisp text, accessible, clickable) and are projected from their 3D
// anchors every frame — scale is clamped ≤1 so text is never upscaled/blurry.
//
// Kept from the revamp: monochrome structure (colour only on titles), jelly
// physics (springs + cursor repulsion), neural activations (hover fires a
// signal down the lane; idle "thinking"; swap cascades), mouse parallax,
// smoothed scroll, background-tab guards. No post-processing, no shadows.

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LANES, createNode } from '../graph/Graph.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// World layout
const SPACING = 4.3;        // vertical gap between node rows
const TOP_Y = 0;            // first node row
const SRC_MARGIN = 4.6;     // source above the first row
const SINK_MARGIN = 4.6;    // sink below the last row
const FOV = 50;
const HOLD = 0.12, ZOOM_END = 0.45; // scroll phases: hold → dive → descend
const SAMPLES_PER_SPAN = 8; // curve sampling density

export class NeuralScene {
  // opts.particles  — draw the ambient neural-field dust (off = minimal look)
  // opts.scrollEase — camera follow time constant in seconds (bigger = smoother)
  constructor(refs, projects, { onNodeClick, particles = true, scrollEase = 0.09 } = {}) {
    this.refs = refs; // { cinema, sticky, canvas, overlay }
    this.onNodeClick = onNodeClick;
    this.useParticles = particles;
    this.scrollEase = scrollEase;

    this.active = 1;
    this.activeF = 1;
    this.time = 0;
    this._lastNow = 0;
    this.smoothP = null;
    this.par = { x: 0, y: 0 };
    this.mouse = { x: -9999, y: -9999, on: false };
    this.pulses = [];
    this.hovered = null;
    this._lastFire = 0;
    this.running = false;
    this.ready = false;
    this._frameCount = 0;
    this.raf = null;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Adaptive quality (perf across devices) ----
    // Coarse pointers / small screens get a lower devicePixelRatio cap and a
    // sparser particle field; high-dpr screens skip MSAA (density already
    // antialiases, and skipping it is a big fill-rate win on retina).
    const rawDpr = window.devicePixelRatio || 1;
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
    this.dprCap = this.isMobile ? 1.5 : 2;
    const lowMem = (navigator.deviceMemory || 8) <= 4;
    this.particleCount = Math.round((this.isMobile ? 260 : 540) * (lowMem ? 0.6 : 1));

    // ---- three.js core ----
    this.renderer = new THREE.WebGLRenderer({
      canvas: refs.canvas, alpha: true, antialias: rawDpr < 1.5,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

    // ---- data → lanes ----
    this.laneData = LANES.map((lane) => ({
      ...lane,
      items: projects.filter((p) => p.category === lane.id),
    }));

    this._buildDOM();
    this._buildGL();

    // Hover a card → activation fires down its lane; pathway lights up.
    this.cards.forEach((c) => {
      c.node.addEventListener('pointerenter', () => {
        this.hovered = { li: c.li, idx: c.idx };
        this._fire(c.li, c.idx, 1);
      });
      c.node.addEventListener('pointerleave', () => {
        if (this.hovered && this.hovered.li === c.li && this.hovered.idx === c.idx) this.hovered = null;
      });
    });

    const onMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.on = true; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', () => { this.mouse.on = false; });

    this._frame = this._frame.bind(this);
    window.addEventListener('resize', () => this.measure());
    if (document.fonts?.ready) document.fonts.ready.then(() => this.measure());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.measure(); });

    new IntersectionObserver(([e]) => {
      this.running = e.isIntersecting;
      if (this.running) this._ensureRaf();
    }, { threshold: 0 }).observe(refs.cinema);

    this.measure();
    this._ensureRaf();
  }

  // ---------------- DOM overlay (crisp cards, labels, anchors) -------------

  _buildDOM() {
    const ov = this.refs.overlay;
    this.cards = [];
    this.labels = [];

    this.laneData.forEach((lane, li) => {
      const label = document.createElement('div');
      label.className = 'ov-lane-label';
      label.style.setProperty('--accent', lane.accent);
      label.innerHTML = `<span class="dot"></span>${lane.label}`;
      ov.appendChild(label);
      this.labels.push({ el: label, li });

      lane.items.forEach((p, idx) => {
        const holder = document.createElement('div');
        holder.className = 'cine-holder';
        const node = createNode(p, lane.accent, this.onNodeClick, { meta: true });
        holder.appendChild(node);
        ov.appendChild(holder);
        this.cards.push({ holder, node, li, idx, inert: false });
      });
    });

    this.srcEl = document.getElementById('cine-source');
    this.snkEl = document.getElementById('cine-sink');
  }

  // ---------------- WebGL: threads, glows, pulses, particles ---------------

  _glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(230,238,252,0.55)');
    grad.addColorStop(1, 'rgba(220,230,248,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildGL() {
    this.tex = this._glowTexture();

    // Threads: per lane, ONE LineGeometry shared by three Line2 passes
    // (halo / body / core) — monochrome phosphor glow, zero shadowBlur.
    this.threads = this.laneData.map(() => {
      const geo = new LineGeometry();
      geo.setPositions([0, 0, 0, 0, -1, 0]); // placeholder until measure()
      const mk = (colorHex, width, opacity) => {
        const m = new LineMaterial({
          color: colorHex, linewidth: width, transparent: true, opacity,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        return { m, base: opacity };
      };
      const passes = [
        mk(0xaab8d0, 9, 0.06),
        mk(0xccd8ee, 4, 0.15),
        mk(0xf7faff, 1.8, 0.55),
      ];
      const lines = passes.map((p) => { const l = new Line2(geo, p.m); l.frustumCulled = false; this.scene.add(l); return l; });
      return { geo, passes, lines, pts: null, cum: null, nodeFracs: [], ctrls: [], anchors: [] };
    });

    // Node glow sprites (one faint white orb where each thread meets a card).
    this.nodeGlows = [];
    this.laneGlowMats = this.laneData.map(() => {
      const m = new THREE.SpriteMaterial({ map: this.tex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
      return m;
    });
    this.laneData.forEach((lane, li) => {
      lane.items.forEach(() => {
        const s = new THREE.Sprite(this.laneGlowMats[li]);
        s.scale.setScalar(0.55);
        this.scene.add(s);
        this.nodeGlows.push({ sprite: s, li });
      });
    });

    // Source / sink glows.
    this.srcSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.srcSprite.scale.setScalar(2.4);
    this.snkSprite = this.srcSprite.clone();
    this.snkSprite.material = this.srcSprite.material.clone();
    this.snkSprite.material.opacity = 0.6;
    this.snkSprite.scale.setScalar(1.7);
    this.scene.add(this.srcSprite, this.snkSprite);

    // Activation pulse pool.
    this.pulsePool = Array.from({ length: 24 }, () => {
      const m = new THREE.SpriteMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m);
      s.visible = false;
      this.scene.add(s);
      return s;
    });

    if (!this.useParticles) return; // minimal mode (Top Down View)

    // Neural-field particles — ported from the original live site's shaders
    // (src/webgl/shaders/particles.*): curl-noise drift + seeded flicker
    // ("neural firing") + procedural radial glow. Monochrome dust, no texture.
    const N = this.particleCount;
    const pos = new Float32Array(N * 3);
    const aScale = new Float32Array(N);
    const aSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = 12 - Math.random() * 44;
      pos[i * 3 + 2] = -16 + Math.random() * 24;
      aScale[i] = 0.5 + Math.random() * 0.9;
      aSeed[i] = Math.random();
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pgeo.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));
    pgeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    this.particleUniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uSize: { value: 30 },
      uPixelRatio: { value: 1 },
    };
    this.particles = new THREE.Points(pgeo, new THREE.ShaderMaterial({
      uniforms: this.particleUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uTime; uniform vec2 uMouse; uniform float uSize; uniform float uPixelRatio;
        attribute float aScale; attribute float aSeed;
        varying float vAlpha;
        // cheap layered trig "curl" — visually close to the original's simplex
        // drift at a fraction of the ALU cost (perf on weak GPUs).
        vec3 drift(vec3 p, float t) {
          return vec3(
            sin(p.y * 0.35 + t) + 0.5 * sin(p.z * 0.5 - t * 1.3),
            cos(p.x * 0.3 - t * 0.8) + 0.5 * sin(p.z * 0.4 + t),
            sin(p.x * 0.25 + t * 0.6) * 0.6
          );
        }
        void main() {
          float t = uTime * 0.15 + aSeed * 6.28;
          vec3 pos = position + drift(position, t) * 0.7;
          pos.xy += uMouse * 0.35 * (0.5 + aSeed);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          gl_PointSize = min(uSize * aScale * uPixelRatio * (20.0 / max(dist, 1.0)), 30.0);
          // seeded flicker = the "neural firing" of the original field
          float flicker = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 20.0);
          vAlpha = flicker * smoothstep(52.0, 5.0, dist);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          float halo = smoothstep(0.5, 0.15, d) * 0.4;
          gl_FragColor = vec4(vec3(0.62, 0.66, 0.74), (core + halo) * vAlpha * 0.55);
        }`,
    }));
    this.scene.add(this.particles);
  }

  // ---------------- Layout / measure ----------------

  measure() {
    const r = this.refs.sticky.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { // hidden/background tab — retry later
      clearTimeout(this._remeasure);
      this._remeasure = setTimeout(() => this.measure(), 250);
      return;
    }
    this.vw = r.width; this.vh = r.height;
    const dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    if (this.useParticles && this.particleUniforms) this.particleUniforms.uPixelRatio.value = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.vw, this.vh, false);
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
    this.threads.forEach((t) => t.passes.forEach((p) => p.m.resolution.set(this.vw, this.vh)));

    // Lane spread scales down on narrow screens.
    this.S = 6 * clamp(this.vw / 1200, 0.5, 1);

    this._buildWorld();
    this.ready = true;
    this._drawOnce();
  }

  _laneX(f) {
    // lane index (float) → world x; lanes at [-1.5, -0.5, 0.5, 1.5] * S
    return (f - 1.5) * this.S;
  }

  _buildWorld() {
    const maxRows = Math.max(...this.laneData.map((l) => l.items.length));
    this.botY = TOP_Y - (maxRows - 1) * SPACING;
    this.srcY = TOP_Y + SRC_MARGIN;
    this.sinkY = this.botY - SINK_MARGIN;
    this.Yc = (this.srcY + this.sinkY) / 2;
    this.src = new THREE.Vector3(0, this.srcY, 0);
    this.sink = new THREE.Vector3(0, this.sinkY, 0);
    this.srcSprite.position.copy(this.src);
    this.snkSprite.position.copy(this.sink);

    // Fit the whole network at overview distance.
    const halfH = (this.srcY - this.sinkY) / 2 + 2.2;
    const halfW = 1.5 * this.S + 2.6;
    const vt = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const ht = vt * this.camera.aspect;
    this.zOver = Math.max(halfH / vt, halfW / ht) + 2.5;

    // Lane-label world positions depend on this.S, so drop the cache whenever
    // the world is rebuilt (resize / font load / visibility).
    if (this.labels) this.labels.forEach((l) => { l.world = null; });

    // Anchors per lane (+ per-node depth variation for real 3D parallax).
    let glowIdx = 0;
    this.threads.forEach((th, li) => {
      const lane = this.laneData[li];
      const x = this._laneX(li);
      th.anchors = [this.src.clone()];
      lane.items.forEach((_, i) => {
        const z = -1.6 * (0.5 + 0.5 * Math.sin(i * 2.1 + li * 1.7));
        const v = new THREE.Vector3(x, TOP_Y - i * SPACING, z);
        th.anchors.push(v);
        this.nodeGlows[glowIdx].sprite.position.copy(v);
        glowIdx++;
      });
      th.anchors.push(this.sink.clone());

      // Sway controls midway between consecutive anchors (physics lives here).
      th.ctrls = [];
      const full = [];
      for (let i = 0; i < th.anchors.length; i++) {
        full.push(th.anchors[i]);
        if (i < th.anchors.length - 1) {
          const mid = th.anchors[i].clone().lerp(th.anchors[i + 1], 0.5);
          const c = { base: mid, v: new THREE.Vector3(), d: new THREE.Vector3(), vec: mid.clone() };
          th.ctrls.push(c);
          full.push(c.vec);
        }
      }
      th.curve = new THREE.CatmullRomCurve3(full, false, 'catmullrom', 0.5);
      const spans = full.length - 1;
      th.sampleCount = spans * SAMPLES_PER_SPAN + 1;
      th.pts = new Float32Array(th.sampleCount * 3);
      th.cum = new Float32Array(th.sampleCount);
      // node j sits at curve control index 2j → sample index 2j*SAMPLES_PER_SPAN
      th.nodeSample = lane.items.map((_, j) => (2 * (j + 1)) * SAMPLES_PER_SPAN);
      this._sampleThread(th, true);
    });
  }

  // Sample a lane's curve into its buffers; refresh GPU line + arc-lengths.
  _sampleThread(th, force = false) {
    const tmp = new THREE.Vector3();
    const n = th.sampleCount;
    let cum = 0, px = 0, py = 0, pz = 0;
    for (let i = 0; i < n; i++) {
      th.curve.getPoint(i / (n - 1), tmp);
      th.pts[i * 3] = tmp.x; th.pts[i * 3 + 1] = tmp.y; th.pts[i * 3 + 2] = tmp.z;
      if (i > 0) cum += Math.hypot(tmp.x - px, tmp.y - py, tmp.z - pz);
      th.cum[i] = cum;
      px = tmp.x; py = tmp.y; pz = tmp.z;
    }
    th.total = cum || 1;
    th.nodeFracs = th.nodeSample.map((si) => th.cum[Math.min(si, n - 1)] / th.total);
    th.geo.setPositions(th.pts);
  }

  // World position at fraction `f` (arc-length) along lane li's thread.
  _fracPos(li, f, out) {
    const th = this.threads[li];
    const target = clamp(f, 0, 1) * th.total;
    let lo = 0, hi = th.sampleCount - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; th.cum[mid] < target ? lo = mid : hi = mid; }
    const span = th.cum[hi] - th.cum[lo] || 1;
    const t = (target - th.cum[lo]) / span;
    out.set(
      lerp(th.pts[lo * 3], th.pts[hi * 3], t),
      lerp(th.pts[lo * 3 + 1], th.pts[hi * 3 + 1], t),
      lerp(th.pts[lo * 3 + 2], th.pts[hi * 3 + 2], t),
    );
    return out;
  }

  // ---------------- Neural activations ----------------

  _fire(li, idx, strength = 1) {
    const th = this.threads[li];
    if (!th || !th.nodeFracs.length) return;
    const target = th.nodeFracs[Math.min(idx, th.nodeFracs.length - 1)];
    this.pulses.push({ li, target, t: 0, dur: 0.5 + target * 0.7, strength });
    if (this.pulses.length > 20) this.pulses.shift();
    this._lastFire = this.time;
  }

  // ---------------- Physics (jelly weave) ----------------

  _physics(dt) {
    const K = 60, D = 9, MAXD = 1.5, MAXV = 26, R = 3.2, PUSH = 2.0;
    const t = this.time;
    let cursor = null;
    if (this.mouse.on && this.vw) {
      // Unproject the pointer onto the z=0 plane of the network.
      const ndc = new THREE.Vector3((this.mouse.x / this.vw) * 2 - 1, -(this.mouse.y / this.vh) * 2 + 1, 0.5);
      ndc.unproject(this.camera);
      const dir = ndc.sub(this.camera.position).normalize();
      if (Math.abs(dir.z) > 1e-4) {
        const k = -this.camera.position.z / dir.z;
        if (k > 0) cursor = new THREE.Vector3().copy(this.camera.position).addScaledVector(dir, k);
      }
    }
    for (const th of this.threads) {
      for (let ci = 0; ci < th.ctrls.length; ci++) {
        const c = th.ctrls[ci];
        // ambient sea drift
        let tx = Math.sin(c.base.y * 0.8 + t * 0.8 + ci) * 0.34 + Math.cos(c.base.x * 0.6 - t * 0.5) * 0.2;
        let tz = Math.cos(c.base.y * 0.7 + t * 0.6 + ci * 1.3) * 0.28;
        // cursor repulsion
        if (cursor) {
          const dx = c.base.x + c.d.x - cursor.x, dy = c.base.y - cursor.y;
          const dist = Math.hypot(dx, dy);
          if (dist < R) { const f = (1 - dist / R) * PUSH; tx += (dx / (dist || 1)) * f; }
        }
        c.v.x += (-K * (c.d.x - tx) - D * c.v.x) * dt;
        c.v.z += (-K * (c.d.z - tz) - D * c.v.z) * dt;
        const vm = Math.hypot(c.v.x, c.v.z);
        if (vm > MAXV) { c.v.x *= MAXV / vm; c.v.z *= MAXV / vm; }
        c.d.x += c.v.x * dt; c.d.z += c.v.z * dt;
        const dm = Math.hypot(c.d.x, c.d.z);
        if (dm > MAXD) { c.d.x *= MAXD / dm; c.d.z *= MAXD / dm; }
        c.vec.set(c.base.x + c.d.x, c.base.y, c.base.z + c.d.z);
      }
    }
  }

  _impulse(dir = 0) {
    for (const th of this.threads) {
      for (const c of th.ctrls) {
        c.v.x += dir * 7 + (Math.random() - 0.5) * 6;
        c.v.z += (Math.random() - 0.5) * 5;
      }
    }
  }

  // ---------------- Frame ----------------

  progress() {
    const top = this.refs.cinema.offsetTop;
    const range = this.refs.cinema.offsetHeight - window.innerHeight;
    return clamp((window.scrollY - top) / Math.max(1, range), 0, 1);
  }

  _laneOpacity(li, zoomP) {
    const near = clamp(1 - Math.abs(li - this.activeF), 0, 1);
    return 1 - zoomP * (1 - near) * 0.78;
  }

  _updateCamera(p) {
    const zoomP = smooth(clamp((p - HOLD) / (ZOOM_END - HOLD), 0, 1));
    const descP = smooth(clamp((p - ZOOM_END) / (1 - ZOOM_END), 0, 1));
    const laneX = this._laneX(this.activeF);
    const yTarget = lerp(TOP_Y + 1.7, this.sinkY + 2.4, descP);
    const cx = lerp(0, laneX * 0.72, zoomP) + this.par.x;
    const cy = lerp(this.Yc, yTarget, zoomP) + this.par.y * 0.7;
    const cz = lerp(this.zOver, 11.5, zoomP);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(cx * 0.88 + this.par.x * 0.4, cy - 1.35, 0);
    return zoomP;
  }

  _projectDOM(zoomP) {
    // One reused scratch vector (this ran every frame and allocated a new
    // Vector3 per call). Style writes are diffed against the last value —
    // re-assigning an identical transform/opacity/zIndex still costs style
    // recalc work, and zIndex churn invalidates stacking every frame.
    const v = this._scratch || (this._scratch = new THREE.Vector3());
    const camPos = this.camera.position;
    const place = (el, world, extraScale = 1, fade = 1) => {
      const last = el._lastPaint || (el._lastPaint = {});
      const behind0 = fade <= 0.002;
      if (behind0 && last.o === 0) return 0;   // already hidden — skip entirely
      v.copy(world).project(this.camera);
      const behind = v.z > 1;
      const o = behind ? 0 : fade;
      const os = o.toFixed(3);
      if (last.o !== os) { el.style.opacity = os; last.o = os; }
      if (o === 0) return 0;                   // invisible: no transform needed
      const x = (v.x + 1) / 2 * this.vw;
      const y = (1 - v.y) / 2 * this.vh;
      const dist = camPos.distanceTo(world);
      const s = clamp((11.5 / dist) * extraScale, 0.26, 1);
      const t = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      if (last.t !== t) { el.style.transform = t; last.t = t; }
      const z = clamp(Math.round(1000 - dist * 8), 1, 1000);
      if (last.z !== z) { el.style.zIndex = String(z); last.z = z; }
      return o;
    };

    for (const c of this.cards) {
      const th = this.threads[c.li];
      const world = th.anchors[c.idx + 1];
      const laneOp = this._laneOpacity(c.li, zoomP);
      const o = place(c.holder, world, 1, laneOp);
      const off = o < 0.5;
      if (c.inert !== off) {
        c.holder.style.pointerEvents = off ? 'none' : '';
        c.node.inert = off;
        c.inert = off;
      }
    }
    this.labels.forEach((l) => {
      const world = l.world || (l.world = new THREE.Vector3(this._laneX(l.li), TOP_Y + 2.5, 0));
      place(l.el, world, 1, this._laneOpacity(l.li, zoomP));
    });
    place(this.srcEl, this.src, 1, 1);
    place(this.snkEl, this.sink, 1, 1);
  }

  _updatePulses(dt, zoomP) {
    for (const p of this.pulses) p.t += dt / p.dur;
    this.pulses = this.pulses.filter((p) => p.t < 1.7);
    const v = new THREE.Vector3();
    this.pulsePool.forEach((spr, i) => {
      const p = this.pulses[i];
      if (!p) { spr.visible = false; return; }
      const laneOp = this._laneOpacity(p.li, zoomP);
      const head = Math.min(p.t, 1) * p.target;
      const arrive = clamp((p.t - 0.92) / 0.7, 0, 1);
      this._fracPos(p.li, arrive > 0 ? p.target : head, v);
      spr.position.copy(v);
      const scale = arrive > 0 ? 0.6 + arrive * 2.6 : 0.55;
      spr.scale.setScalar(scale);
      spr.material.opacity = laneOp * p.strength * (arrive > 0 ? (1 - arrive) * 0.85 : 0.9);
      spr.visible = spr.material.opacity > 0.02;
    });
  }

  _drawOnce() { if (this.ready) this._tick(0.016, true); }

  _tick(dt, force = false) {
    // eased lane focus
    if (this.activeF !== this.active) {
      this.activeF += (this.active - this.activeF) * (1 - Math.pow(0.0026, dt));
      if (Math.abs(this.active - this.activeF) < 0.0015) this.activeF = this.active;
    }
    // eased scroll
    const rawP = this.progress();
    if (this.smoothP == null || force) this.smoothP = rawP;
    else this.smoothP += (rawP - this.smoothP) * (1 - Math.exp(-dt / this.scrollEase));
    // eased parallax
    if (this.vw && !this.reduced) {
      const px = this.mouse.on ? (this.mouse.x / this.vw - 0.5) : 0;
      const py = this.mouse.on ? (this.mouse.y / this.vh - 0.5) : 0;
      const f = 1 - Math.exp(-dt / 0.16);
      this.par.x += (px * 1.7 - this.par.x) * f;
      this.par.y += (-py * 1.1 - this.par.y) * f;
    }

    if (!this.reduced) {
      this._physics(dt);
      if (this._frameCount % 2 === 0 || force) {
        for (const th of this.threads) this._sampleThread(th);
      }
      // idle "thinking"
      if (!this.hovered && this.time - this._lastFire > 1.6 && Math.random() < dt * 0.7) {
        const li = this.smoothP > 0.3 ? this.active : Math.floor(Math.random() * this.laneData.length);
        const n = this.laneData[li].items.length;
        if (n) this._fire(li, Math.floor(Math.random() * n), 0.6);
      }
    }

    const zoomP = this._updateCamera(this.smoothP);

    // lane fade → thread materials + node glows (monochrome; hover lane burns brighter)
    this.threads.forEach((th, li) => {
      const op = this._laneOpacity(li, zoomP);
      const hot = this.hovered && this.hovered.li === li ? 1.7 : 1;
      th.passes.forEach((p) => { p.m.opacity = clamp(p.base * op * hot, 0, 0.95); });
      this.laneGlowMats[li].opacity = 0.4 * op;
    });

    if (!this.reduced) this._updatePulses(dt, zoomP);
    this._projectDOM(zoomP);

    if (this.particles) {
      this.particles.rotation.y = this.time * 0.008;
      this.particleUniforms.uTime.value = this.time;
      this.particleUniforms.uMouse.value.set(this.par.x, this.par.y);
    }
    this.renderer.render(this.scene, this.camera);
    this._frameCount++;
  }

  _frame(now) {
    this.time = now / 1000;
    const dt = this._lastNow ? Math.min(0.05, (now - this._lastNow) / 1000) : 0.016;
    this._lastNow = now;
    if (this.running && this.ready && !document.hidden) this._tick(dt);
    this.raf = requestAnimationFrame(this._frame);
  }
  _ensureRaf() { if (!this.raf) this.raf = requestAnimationFrame(this._frame); }

  // ---------------- Public API (same shape the old Cinema exposed) ---------

  get activeLane() { return this.active; }

  setActive(i, { focus = true } = {}) {
    if (i < 0 || i >= this.laneData.length || i === this.active) {
      if (focus) this.focus(i);
      return;
    }
    const dir = Math.sign(i - this.active);
    this.active = i;
    this._impulse(dir);
    const n = this.laneData[i].items.length;
    if (n) this._fire(i, n - 1, 1); // cascade down the new lane
    if (focus) this.focus(i);
  }

  focus(i) {
    if (i < 0 || i >= this.laneData.length) return;
    this.active = i;
    if (this.reduced) return;
    const top = this.refs.cinema.offsetTop;
    const range = this.refs.cinema.offsetHeight - window.innerHeight;
    const cur = this.progress();
    const targetP = cur < 0.44 ? 0.52 : Math.min(cur, 0.86);
    window.scrollTo({ top: top + targetP * range, behavior: 'smooth' });
  }

  toOverview() {
    window.scrollTo({ top: this.refs.cinema.offsetTop, behavior: 'smooth' });
  }
}
