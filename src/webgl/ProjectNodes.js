// Project nodes — the clickable "neurons". Each category is a full
// neural tendril: a CatmullRom-curved trunk that sweeps out from the
// hero hub, parallel filaments shimmering alongside, traveling pulse
// packets firing along the curve, and bezier-curved offshoots where
// each project hangs off the trunk like a dendrite.
//
// Four biomes — three primary routes (marketing, games, webdesign)
// that fan out from the hub, plus a quieter "others" tendril for
// academic / study work.

import * as THREE from 'three';
import vertexShader from './shaders/node.vert?raw';
import fragmentShader from './shaders/node.frag?raw';
import { damp } from '../utils/math.js';

// Per-branch character. Colors carry real hue now — still cohesive but
// each trunk reads as its own habitat. `lift` and `sway` shape the arc
// each tendril takes out of the hub.
// Accents — grey-core with a hint of hue per branch. Soft red for
// marketing, soft blue for games, soft green for web. Saturation kept
// low so the portfolio still reads sleek/monochrome, but enough tint
// that each route is unmistakably its own habitat.
//
// Each branch also has a distinct route profile — `route` names the
// curve silhouette the trunk takes, so scrolling each branch feels
// physically different, not just recolored:
//   marketing → wide S-sweep, organic dendrites
//   games     → angular zig-zag elbows
//   webdesign → helix / descending spiral
//   others    → gentle meander
// Lane assignment matches pointer zones on the page:
//   left third  → marketing (x negative)
//   center      → webdesign / AI (x ≈ 0)
//   right third → games (x positive)
// "others" sits further right as a trailing appendix.
// Lanes pushed wide (±14) so the three tributaries never cross. Every
// route's lateral amplitude stays well under half the lane spacing, so
// scrolling down one tributary never visually touches the next. Camera
// rides the active curve — distant tributaries fog out naturally.
// Accents are genuinely red / green / blue now — muted versions read as
// grey once additive blending + fog + bloom stack on top, so we push the
// raw hues harder than they look in the hex picker. At full saturation
// each tributary should clearly read as its colour.
export const BIOMES = {
  marketing: { x: -14, accent: '#ff6a5e', dense: true,  pattern: 'organic', route: 's-sweep', lift: 2.8, sway: 1.3 },
  webdesign: { x:   0, accent: '#5fd896', dense: false, pattern: 'grid',    route: 'helix',   lift: 2.0, sway: 0.5 },
  games:     { x:  14, accent: '#5aa8ff', dense: true,  pattern: 'sharp',   route: 'zigzag',  lift: 1.4, sway: 0.3 },
  others:    { x:  22, accent: '#8a93a2', dense: false, pattern: 'sparse',  route: 'meander', lift: 0.8, sway: 0.6 },
};
const BRANCHES = Object.keys(BIOMES);
const BRANCH_Z_STEP = 5.2;
const HUB = new THREE.Vector3(0, 0.3, -2.0);

// Core node shader base colors — each branch tints these toward its accent.
const WARM = new THREE.Color('#d8c9b8');
const COLD = new THREE.Color('#ffffff');

const PULSE_COUNT = 16;   // firing packets per branch
const PULSE_SPEED = 0.08; // fraction of curve traversed per second

export class ProjectNodes {
  constructor(scene, camera, projects, onSelect) {
    this.scene = scene;
    this.camera = camera;
    this.projects = projects;
    this.onSelect = onSelect;
    this.nodes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.hovered = null;

    const geo = new THREE.IcosahedronGeometry(0.55, 2);
    this.geo = geo;

    const branchCounts = {};
    this.branchPositions = {};
    this.branchTrunks = {};
    BRANCHES.forEach(b => {
      this.branchPositions[b] = [];
      this.branchTrunks[b] = [];
    });

    projects.forEach((project, i) => {
      const cat = project.category && BIOMES[project.category]
        ? project.category
        : 'others';
      const biome = BIOMES[cat];
      const lane = biome.x;
      const local = branchCounts[cat] = (branchCounts[cat] || 0) + 1;
      const ti = local - 1;

      // Trunk anchor — point on the spine this project dendrite attaches to.
      const trunkY = 0.2 + Math.sin(ti * 0.45 + cat.length) * 0.5;
      const trunkZ = -7 - ti * BRANCH_Z_STEP;
      const trunkX = lane + Math.sin(ti * 0.6) * 0.4;
      const trunkPoint = new THREE.Vector3(trunkX, trunkY, trunkZ);
      this.branchTrunks[cat].push(trunkPoint.clone());

      // Per-biome offshoot character.
      //
      // IMPORTANT: each biome's nodes stay on its own side of the screen
      // — marketing nodes always reach further LEFT of the trunk, games
      // always RIGHT, webdesign (centre) stays symmetric. This keeps the
      // left/centre/right viewport zones clean and matches the picker:
      // click a left-screen node and you get a marketing project, not
      // a webdesign one bleeding over from an alternating layout.
      const sideSym = ti % 2 === 0 ? 1 : -1;            // symmetric (webdesign/others)
      const sideLeft  = -1;                             // marketing — always left
      const sideRight =  1;                             // games — always right
      let offX, offY, offZ;
      switch (biome.pattern) {
        case 'organic': {
          // Marketing — fan left from the trunk, organic Y/Z variation.
          const mag = 2.2 + Math.abs(Math.sin(ti * 0.9)) * 0.6;
          offX = sideLeft * mag;
          offY = Math.cos(ti * 1.1) * 1.0;
          offZ = Math.sin(ti * 0.7) * 1.2;
          break;
        }
        case 'sharp': {
          // Games — fan right from the trunk; Y-kick gives visual rhythm.
          offX = sideRight * (2.3 + (ti % 2) * 0.35);
          offY = (ti % 2 === 0 ? 1 : -1) * 1.0;
          offZ = 0;
          break;
        }
        case 'grid': {
          // Web / Apps / AI — centre lane; keep symmetric alternation.
          offX = sideSym * 2.1;
          offY = (ti % 3 - 1) * 1.0;
          offZ = 0;
          break;
        }
        case 'sparse':
        default: {
          offX = sideSym * (1.7 + (Math.random() - 0.5) * 0.6);
          offY = (Math.random() - 0.5) * 1.8;
          offZ = (Math.random() - 0.5) * 1.5;
          break;
        }
      }
      // Kept for bezier midpoint bias below — matches the chosen offshoot side.
      const side = Math.sign(offX) || 1;

      const nodePos = new THREE.Vector3(
        trunkPoint.x + offX,
        trunkPoint.y + offY,
        trunkPoint.z + offZ
      );

      const accent = new THREE.Color(biome.accent);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime:       { value: 0 },
          uPulse:      { value: 0 },
          uWarm:       { value: WARM.clone().lerp(accent, 0.85) },
          uCold:       { value: COLD.clone().lerp(accent, 0.55) },
          uSaturation: { value: 0 },
        },
        transparent: false,
      });

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(nodePos);
      mesh.userData = { project, index: i, category: cat, pulseTarget: 0 };
      scene.add(mesh);
      this.branchPositions[cat].push(nodePos.clone());

      // Radiating halo fibers around each node.
      const haloCount = biome.dense ? 14 : 8;
      const haloGeo = new THREE.BufferGeometry();
      const hpos = new Float32Array(haloCount * 6);
      for (let k = 0; k < haloCount; k++) {
        const theta = (k / haloCount) * Math.PI * 2;
        const len = (biome.pattern === 'sharp' ? 1.7 : 1.3) + Math.random() * 0.7;
        hpos[k * 6]     = 0;
        hpos[k * 6 + 1] = 0;
        hpos[k * 6 + 2] = 0;
        hpos[k * 6 + 3] = Math.cos(theta) * len;
        hpos[k * 6 + 4] = Math.sin(theta) * len;
        hpos[k * 6 + 5] = (Math.random() - 0.5) * 0.8;
      }
      haloGeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3));
      const haloMat = new THREE.LineBasicMaterial({
        color: accent.clone(),
        transparent: true,
        opacity: biome.dense ? 0.32 : 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      haloMat.userData.accent = accent.clone();
      const halo = new THREE.LineSegments(haloGeo, haloMat);
      halo.position.copy(nodePos);
      scene.add(halo);

      // Curved dendrite — quadratic bezier from trunk anchor to node.
      const mid = new THREE.Vector3(
        (trunkPoint.x + nodePos.x) * 0.5 + side * 0.35,
        (trunkPoint.y + nodePos.y) * 0.5 + 0.2,
        (trunkPoint.z + nodePos.z) * 0.5 + (biome.pattern === 'organic' ? 0.4 : 0),
      );
      const bezier = new THREE.QuadraticBezierCurve3(trunkPoint, mid, nodePos);
      const bezierPts = bezier.getPoints(18);
      const connArr = new Float32Array(bezierPts.length * 3);
      bezierPts.forEach((p, idx) => {
        connArr[idx * 3]     = p.x;
        connArr[idx * 3 + 1] = p.y;
        connArr[idx * 3 + 2] = p.z;
      });
      const connGeo = new THREE.BufferGeometry();
      connGeo.setAttribute('position', new THREE.BufferAttribute(connArr, 3));
      const connMat = new THREE.LineBasicMaterial({
        color: accent.clone(),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      connMat.userData.accent = accent.clone();
      const conn = new THREE.Line(connGeo, connMat);
      scene.add(conn);

      this.nodes.push({ mesh, material, halo, haloMat, conn, connMat, connGeo, category: cat });
    });

    this._buildTrunks(scene);
    this._buildPulses(scene);
    this._bindEvents();
  }

  // Each branch is a CatmullRom curve HUB → arc-out → trunk anchors →
  // tail. Rendered as one bright main strand plus two dimmer filaments
  // offset laterally so the trunk feels like a bundle of nerve fibers.
  _buildTrunks(scene) {
    this.trunks = [];
    this.curves = {};

    BRANCHES.forEach(cat => {
      const pts = this.branchTrunks[cat];
      if (!pts.length) return;
      const biome = BIOMES[cat];
      const lane = biome.x;

      // Each route carves a physically different path out of the hub so
      // scrolling down one branch feels nothing like scrolling down the
      // next. Control points differ; the trunk-anchor pass also differs.
      const ctrl = [HUB.clone()];
      const last = pts[pts.length - 1];

      // Route silhouettes. Trunk anchors (pts) stay on the lane so that
      // project nodes/connectors align; the route's personality comes
      // from control points inserted BETWEEN anchors. The camera rides
      // this exact curve during active descent (see main.js), so each
      // branch feels physically distinct, not just recolored.
      const entry = [];
      const inserts = (i, p, next) => []; // default: no intermediates
      let routeInserts = inserts;

      switch (biome.route) {
        case 's-sweep': {
          // Marketing — wide organic S.
          entry.push(
            new THREE.Vector3(lane - 3.5, biome.lift * 1.1, -3.0),
            new THREE.Vector3(lane + 2.8, biome.lift * 0.6, -4.6),
            new THREE.Vector3(lane - 2.2, biome.lift * 0.1, -6.2),
          );
          routeInserts = (i, p, next) => {
            const mx = (p.x + next.x) * 0.5;
            const mz = (p.z + next.z) * 0.5;
            const amp = (i % 2 === 0 ? 1 : -1) * 3.2;
            return [new THREE.Vector3(mx + amp, p.y + Math.cos(i * 0.7) * 0.6, mz)];
          };
          break;
        }
        case 'zigzag': {
          // Games — sharp circuit elbows. Hard alternating kicks between anchors.
          entry.push(
            new THREE.Vector3(lane - 2.2, biome.lift + 0.8, -3.0),
            new THREE.Vector3(lane + 2.6, biome.lift * 0.3, -4.2),
            new THREE.Vector3(lane - 1.8, biome.lift * 0.1, -5.4),
          );
          routeInserts = (i, p, next) => {
            const mx = (p.x + next.x) * 0.5;
            const mz = (p.z + next.z) * 0.5;
            const kick = (i % 2 === 0 ? 1 : -1) * 2.6;
            return [new THREE.Vector3(mx + kick, p.y + (i % 2 === 0 ? 0.5 : -0.5), mz)];
          };
          break;
        }
        case 'helix': {
          // Web/Apps/AI — descending spiral. Two intermediate points
          // per segment, 90° and 180° apart, produce a true helix.
          const HELIX_R = 2.6;
          entry.push(
            new THREE.Vector3(lane + HELIX_R,       biome.lift,       -3.0),
            new THREE.Vector3(lane,                 biome.lift + 0.9, -4.0),
            new THREE.Vector3(lane - HELIX_R,       biome.lift * 0.2, -5.0),
            new THREE.Vector3(lane,                 biome.lift - 0.3, -6.0),
          );
          routeInserts = (i, p, next) => {
            const r = HELIX_R * Math.max(0.5, 1 - i * 0.04);
            const t1 = i * 1.8;
            const t2 = i * 1.8 + Math.PI;
            const mz1 = p.z - (next.z === p.z ? 1.3 : (p.z - next.z) * 0.33);
            const mz2 = p.z - (next.z === p.z ? 2.6 : (p.z - next.z) * 0.66);
            return [
              new THREE.Vector3(lane + Math.cos(t1) * r, p.y + Math.sin(t1) * r * 0.55, mz1),
              new THREE.Vector3(lane + Math.cos(t2) * r, p.y + Math.sin(t2) * r * 0.55, mz2),
            ];
          };
          break;
        }
        case 'meander':
        default: {
          entry.push(
            new THREE.Vector3(lane * 0.3,  biome.lift,       -3.8),
            new THREE.Vector3(lane * 0.75, biome.lift * 0.5, -5.6),
          );
          routeInserts = (i, p, next) => {
            const mx = (p.x + next.x) * 0.5;
            const mz = (p.z + next.z) * 0.5;
            return [new THREE.Vector3(mx + Math.sin(i * 1.3) * 0.9, p.y, mz)];
          };
          break;
        }
      }

      entry.forEach(v => ctrl.push(v));
      pts.forEach((p, i) => {
        ctrl.push(p.clone());
        if (i < pts.length - 1) {
          routeInserts(i, p, pts[i + 1]).forEach(v => ctrl.push(v));
        }
      });
      ctrl.push(new THREE.Vector3(last.x, last.y - 0.4, last.z - 5));

      const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
      this.curves[cat] = curve;

      const samples = curve.getPoints(240);

      const strands = [
        { lateral:  0.00, vertical:  0.00, opacity: biome.dense ? 0.85 : 0.65, jitter: 0    },
        { lateral:  0.14, vertical:  0.06, opacity: 0.30,                       jitter: 0.05 },
        { lateral: -0.12, vertical: -0.05, opacity: 0.26,                       jitter: 0.04 },
      ];

      const groupLines = [];
      strands.forEach((s, sidx) => {
        const arr = new Float32Array(samples.length * 3);
        samples.forEach((p, i) => {
          const wobble = Math.sin(i * 0.18 + sidx * 1.3) * s.jitter;
          arr[i * 3]     = p.x + s.lateral + wobble;
          arr[i * 3 + 1] = p.y + s.vertical + wobble * 0.5;
          arr[i * 3 + 2] = p.z;
        });
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const accentCol = new THREE.Color(biome.accent);
        const mat = new THREE.LineBasicMaterial({
          color: accentCol.clone(),
          transparent: true,
          opacity: s.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        mat.userData.accent = accentCol.clone();
        const line = new THREE.Line(geom, mat);
        line.frustumCulled = false;
        scene.add(line);
        groupLines.push({ geom, mat, line, baseOpacity: s.opacity });
      });

      this.trunks.push({ category: cat, lines: groupLines });
    });
  }

  // Firing pulse packets — small glowing sprites traveling each curve.
  // CPU position update per frame; cheap at ~16 per branch and it's
  // what makes the whole network feel alive.
  _buildPulses(scene) {
    this.pulses = [];
    BRANCHES.forEach(cat => {
      const curve = this.curves[cat];
      if (!curve) return;
      const biome = BIOMES[cat];
      const count = biome.dense ? PULSE_COUNT : Math.floor(PULSE_COUNT * 0.6);
      const positions = new Float32Array(count * 3);
      const sizes     = new Float32Array(count);
      const offsets   = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        offsets[i] = Math.random();
        sizes[i]   = 12 + Math.random() * 18;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor:      { value: new THREE.Color(biome.accent) },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uTime:       { value: 0 },
          // Alpha multiplier — active vs inactive tributary fade.
          uAlpha:      { value: 1 },
          // 0 = hero (monochrome), 1 = deep descent (full accent).
          uSaturation: { value: 0 },
        },
        vertexShader: /* glsl */`
          attribute float aSize;
          uniform float uPixelRatio;
          uniform float uTime;
          varying float vFlicker;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vFlicker = 0.7 + 0.3 * sin(uTime * 6.0 + position.z * 0.8);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPixelRatio * (1.0 / max(-mv.z, 0.5));
          }
        `,
        fragmentShader: /* glsl */`
          uniform vec3 uColor;
          uniform float uAlpha;
          uniform float uSaturation;
          varying float vFlicker;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float core = smoothstep(0.5, 0.0, d);
            float halo = smoothstep(0.5, 0.2, d) * 0.6;
            float a = (core * core + halo * 0.4) * uAlpha;
            // Mix from neutral grey (hero / top) to full accent (deep descent).
            vec3 grey = vec3(0.78);
            vec3 tint = mix(grey, uColor, uSaturation);
            gl_FragColor = vec4(tint * (1.5 + core * 1.8) * vFlicker, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geom, mat);
      points.frustumCulled = false;
      scene.add(points);

      this.pulses.push({ category: cat, curve, geom, mat, points, offsets, positions, count });
    });
  }

  _bindEvents() {
    this._onMove = this._onMove.bind(this);
    this._onClick = this._onClick.bind(this);
    window.addEventListener('mousemove', this._onMove, { passive: true });
    window.addEventListener('click', this._onClick);
  }

  _onMove(e) {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  _onClick(e) {
    // Only count clicks that actually landed on the WebGL canvas — otherwise
    // clicking a hero button (e.g. "Courses") while a node happened to be
    // under the last-known pointer would open that node (bug: Courses button
    // was opening the Global Conflict Tracker).
    if (e && e.target && e.target.id !== 'webgl') return;
    if (this.hovered) {
      const { project, index } = this.hovered.mesh.userData;
      this.onSelect?.(project, index);
    }
  }

  update(time, dt) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Only raycast against nodes on the currently-active tributary (plus
    // the always-visible "others" epilogue). Inactive tributaries are
    // still in the scene but faded; they must not intercept hovers or
    // clicks — that's the "click marketing, get Tailor" bug.
    const active = this._activeCat;
    const meshes = this.nodes
      .filter(n => !active || n.category === active || n.category === 'others')
      .map(n => n.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];

    const prevHovered = this.hovered;
    this.hovered = hit ? this.nodes.find(n => n.mesh === hit.object) : null;

    if (this.hovered && !prevHovered) document.body.classList.add('cursor-node');
    else if (!this.hovered && prevHovered) document.body.classList.remove('cursor-node');

    this.nodes.forEach(node => {
      const target = node === this.hovered ? 1 : node.mesh.userData.pulseTarget;
      node.material.uniforms.uTime.value = time;
      node.material.uniforms.uPulse.value = damp(
        node.material.uniforms.uPulse.value, target, 0.1, dt
      );
      node.haloMat.opacity = 0.22 + node.material.uniforms.uPulse.value * 0.5;
    });

    // Advance pulse packets along each curve.
    if (this.pulses) {
      this.pulses.forEach(pg => {
        const { curve, offsets, positions, geom, count, mat } = pg;
        mat.uniforms.uTime.value = time;
        for (let i = 0; i < count; i++) {
          const t = (offsets[i] + time * PULSE_SPEED) % 1;
          const p = curve.getPointAt(t);
          positions[i * 3]     = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }
        geom.attributes.position.needsUpdate = true;
      });
    }
  }

  // Active branch gets brighter strands, others fade hard so the three
  // tributaries read as physically separate neural networks — not a
  // single forest. Inactive pulses also dim.
  setActiveCategory(cat) {
    this._activeCat = cat;
    if (!this.trunks) return;
    this.trunks.forEach(t => {
      const active = t.category === cat;
      t.lines.forEach((l) => {
        const target = active ? l.baseOpacity * 1.35 : l.baseOpacity * 0.18;
        l.mat.opacity = damp(l.mat.opacity, target, 0.18, 0.016);
      });
    });
    if (this.pulses) {
      this.pulses.forEach(pg => {
        const active = pg.category === cat;
        pg._opacityMul = damp(pg._opacityMul ?? 1, active ? 1.2 : 0.2, 0.18, 0.016);
      });
    }
  }

  // Called per-frame with 0..1 scroll progress. Hero (progress≈0) is
  // fully monochrome; deep descent (progress≈1) hits full biome colour.
  // Also updates pulse alpha from the active-category fade.
  setSaturation(sat) {
    const s = Math.max(0, Math.min(1, sat));
    const grey = new THREE.Color(0.55, 0.55, 0.55);
    // Node materials
    this.nodes.forEach(n => {
      if (n.material.uniforms.uSaturation) n.material.uniforms.uSaturation.value = s;
      // Halo + connector lerp from grey toward their stored accent.
      if (n.haloMat.userData.accent) n.haloMat.color.copy(grey).lerp(n.haloMat.userData.accent, s);
      if (n.connMat.userData.accent) n.connMat.color.copy(grey).lerp(n.connMat.userData.accent, s);
    });
    // Trunk strand materials
    if (this.trunks) {
      this.trunks.forEach(t => t.lines.forEach(l => {
        if (l.mat.userData.accent) l.mat.color.copy(grey).lerp(l.mat.userData.accent, s);
      }));
    }
    // Pulse packets — uSaturation handles colour; uAlpha handles active fade.
    if (this.pulses) {
      this.pulses.forEach(pg => {
        if (pg.mat.uniforms.uSaturation) pg.mat.uniforms.uSaturation.value = s;
        if (pg.mat.uniforms.uAlpha) pg.mat.uniforms.uAlpha.value = pg._opacityMul ?? 1;
      });
    }
  }

  setActiveByIndex(index) {
    this.nodes.forEach((node, i) => {
      node.mesh.userData.pulseTarget = i === index ? 0.9 : 0;
    });
  }

  dispose() {
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('click', this._onClick);
    this.nodes.forEach(n => {
      n.material.dispose();
      n.halo.geometry.dispose();
      n.haloMat.dispose();
      n.connGeo.dispose();
      n.connMat.dispose();
      this.scene.remove(n.mesh);
      this.scene.remove(n.halo);
      this.scene.remove(n.conn);
    });
    this.geo.dispose();
    (this.trunks || []).forEach(t => t.lines.forEach(l => {
      l.geom.dispose(); l.mat.dispose(); this.scene.remove(l.line);
    }));
    (this.pulses || []).forEach(p => {
      p.geom.dispose(); p.mat.dispose(); this.scene.remove(p.points);
    });
  }
}
