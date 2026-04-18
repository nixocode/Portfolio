// The background neural mesh: thousands of drifting particles rendered
// with a custom shader. These are the "neurons" in the volumetric brain.

import * as THREE from 'three';
import vertexShader from './shaders/particles.vert?raw';
import fragmentShader from './shaders/particles.frag?raw';

const COLD = new THREE.Color('#6e7480');

export class NeuralField {
  constructor(scene, { count = 6000, radius = 40 } = {}) {
    this.scene = scene;
    this.count = count;
    this.radius = radius;

    // Distribute particles in a roughly spherical volume with a
    // slight forward bias so the camera always has neurons ahead.
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Sample a point inside a sphere of radius R.
      let x, y, z, d;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        d = x * x + y * y + z * z;
      } while (d > 1);

      const r = radius * Math.cbrt(Math.random());
      positions[i * 3]     = x * r;
      positions[i * 3 + 1] = y * r * 0.6;          // flatter disc shape
      positions[i * 3 + 2] = z * r - radius * 0.5; // push forward of camera

      scales[i] = 0.6 + Math.random() * 1.8;
      seeds[i]  = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aScale',   new THREE.BufferAttribute(scales, 1));
    this.geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:       { value: 0 },
        uScroll:     { value: 0 },
        uMouse:      { value: new THREE.Vector2(0, 0) },
        uSize:       { value: 10 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColor:      { value: COLD },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time, scroll, mouse) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uScroll.value = scroll;
    this.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
  }
}
