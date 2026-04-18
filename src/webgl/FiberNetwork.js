// Synaptic fibers: line segments connecting nearby "neuron" positions.
// A traveling pulse runs down each fiber to sell the brain-activity look.

import * as THREE from 'three';
import vertexShader from './shaders/fibers.vert?raw';
import fragmentShader from './shaders/fibers.frag?raw';

const COLD = new THREE.Color('#8a9099');

export class FiberNetwork {
  constructor(scene, { nodeCount = 140, radius = 22, maxConnections = 3, maxDist = 7 } = {}) {
    this.scene = scene;

    // Step 1: generate anchor nodes (fewer than the background field).
    // These aren't drawn — they're just positions to connect.
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      // Gaussian-ish distribution to cluster toward the center.
      const r = radius * Math.pow(Math.random(), 0.7);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      nodes.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi) - radius * 0.3
      ));
    }

    // Step 2: build edges — each node connects to its nearest N neighbors
    // within maxDist. Skip duplicates with a set of sorted pair keys.
    const edgeSet = new Set();
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const distances = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = nodes[i].distanceTo(nodes[j]);
        if (d < maxDist) distances.push({ j, d });
      }
      distances.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(maxConnections, distances.length); k++) {
        const a = i, b = distances[k].j;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([a, b]);
        }
      }
    }

    // Step 3: pack into buffer geometry. Two vertices per edge.
    const positions = new Float32Array(edges.length * 6);
    const lineIdx = new Float32Array(edges.length * 2);
    const tVals   = new Float32Array(edges.length * 2);

    edges.forEach(([a, b], i) => {
      const na = nodes[a];
      const nb = nodes[b];
      positions[i * 6]     = na.x;
      positions[i * 6 + 1] = na.y;
      positions[i * 6 + 2] = na.z;
      positions[i * 6 + 3] = nb.x;
      positions[i * 6 + 4] = nb.y;
      positions[i * 6 + 5] = nb.z;

      const rnd = Math.random();
      lineIdx[i * 2]     = rnd;
      lineIdx[i * 2 + 1] = rnd;
      tVals[i * 2]     = 0;
      tVals[i * 2 + 1] = 1;
    });

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aLineIndex', new THREE.BufferAttribute(lineIdx, 1));
    this.geometry.setAttribute('aT',         new THREE.BufferAttribute(tVals, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:     { value: 0 },
        uMouse:    { value: new THREE.Vector2(0, 0) },
        uColor:    { value: COLD },
        uActivity: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  update(time, scroll, mouse) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    // Activity ramps up slightly as user scrolls deeper into the brain.
    this.material.uniforms.uActivity.value = 0.4 + Math.min(scroll, 1) * 0.6;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.lines);
  }
}
