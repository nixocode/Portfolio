// Per-branch biome particle clusters. Each biome is a localized cloud
// of the same neural-field shader, tinted + densified per branch so
// each trunk reads as its own distinct neural habitat.
//
// marketing  → dense warm paper-grey cluster
// games      → sharper cool-steel cluster
// webdesign  → crisp white cluster
// others     → sparse muted cluster
//
// Clusters are positioned around each branch's lane (X) and span the
// z-range the projects in that branch occupy.

import * as THREE from 'three';
import vertexShader from './shaders/particles.vert?raw';
import fragmentShader from './shaders/particles.frag?raw';
import { BIOMES } from './ProjectNodes.js';

export class Biomes {
  /**
   * @param {THREE.Scene} scene
   * @param {object}      opts
   * @param {number}      opts.mobile  — scale particle counts down
   * @param {object}      opts.zRanges — { [cat]: { zStart, zEnd } }  fitted to actual branch extents
   */
  constructor(scene, { mobile = false, zRanges = {} } = {}) {
    this.scene = scene;
    this.clusters = [];

    Object.entries(BIOMES).forEach(([cat, biome]) => {
      const range = zRanges[cat] || { zStart: -6, zEnd: -30 };
      const baseCount = biome.dense ? 550 : 280;
      const count = Math.floor(baseCount * (mobile ? 0.55 : 1));

      const positions = new Float32Array(count * 3);
      const scales    = new Float32Array(count);
      const seeds     = new Float32Array(count);

      const spreadX = 3.6;
      const spreadY = 3.0;
      const zSpan   = range.zStart - range.zEnd; // positive

      for (let i = 0; i < count; i++) {
        // Gaussian-ish around lane center
        const rx = (Math.random() + Math.random() + Math.random() - 1.5) * spreadX;
        const ry = (Math.random() + Math.random() + Math.random() - 1.5) * spreadY;
        positions[i * 3]     = biome.x + rx;
        positions[i * 3 + 1] = ry;
        positions[i * 3 + 2] = range.zStart - Math.random() * zSpan;

        scales[i] = 0.5 + Math.random() * (biome.dense ? 1.6 : 1.1);
        seeds[i]  = Math.random();
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aScale',   new THREE.BufferAttribute(scales, 1));
      geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime:       { value: 0 },
          uScroll:     { value: 0 },
          uMouse:      { value: new THREE.Vector2(0, 0) },
          uSize:       { value: biome.pattern === 'sharp' ? 9 : 11 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uColor:      { value: new THREE.Color(biome.accent) },
          uSaturation: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);

      this.clusters.push({ category: cat, geometry, material, points });
    });
  }

  update(time, scroll, mouse) {
    this.clusters.forEach(c => {
      c.material.uniforms.uTime.value = time;
      c.material.uniforms.uScroll.value = scroll;
      c.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    });
  }

  // Called from main.js with 0..1 — grey at the top of the page, full colour at the bottom.
  setSaturation(s) {
    const v = Math.max(0, Math.min(1, s));
    this.clusters.forEach(c => {
      if (c.material.uniforms.uSaturation) c.material.uniforms.uSaturation.value = v;
    });
  }

  dispose() {
    this.clusters.forEach(c => {
      c.geometry.dispose();
      c.material.dispose();
      this.scene.remove(c.points);
    });
  }
}
