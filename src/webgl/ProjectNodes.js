// Project nodes: the clickable "neurons". Each represents one project.
// They're positioned along a winding forward path the camera will scroll
// through, with radial fibers linking each one to the background mesh.
//
// Warm amber core + cold cyan Fresnel rim = the human/tech bond.

import * as THREE from 'three';
import vertexShader from './shaders/node.vert?raw';
import fragmentShader from './shaders/node.frag?raw';
import { damp } from '../utils/math.js';

const WARM = new THREE.Color('#ffc88a');
const COLD = new THREE.Color('#5ce0ff');

export class ProjectNodes {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {Array} projects  — fetched project list
   * @param {Function} onSelect  — callback(project, index) when a node is clicked
   */
  constructor(scene, camera, projects, onSelect) {
    this.scene = scene;
    this.camera = camera;
    this.projects = projects;
    this.onSelect = onSelect;
    this.nodes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.hovered = null;

    // Shared geometry — high-poly icosahedron reads like a crystal neuron.
    const geo = new THREE.IcosahedronGeometry(0.55, 2);

    projects.forEach((project, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime:  { value: 0 },
          uPulse: { value: 0 },       // 0..1, LERP'd toward target
          uWarm:  { value: WARM.clone() },
          uCold:  { value: COLD.clone() },
        },
        transparent: false,
      });

      const mesh = new THREE.Mesh(geo, material);

      // Winding path: zig-zag left/right, descending on Z.
      // Slight vertical sway so the path feels organic, not a ladder.
      const t = i;
      const side = i % 2 === 0 ? 1 : -1;
      mesh.position.set(
        side * (1.6 + Math.sin(t * 0.7) * 0.6),
        Math.sin(t * 1.3) * 0.8,
        -4 - t * 6
      );
      mesh.userData = { project, index: i, pulseTarget: 0 };
      scene.add(mesh);

      // Radial halo fibers connecting this node to nearby space.
      // These are thin, short lines that make each project feel like a
      // hub of activity in the brain.
      const haloGeo = new THREE.BufferGeometry();
      const haloCount = 10;
      const pos = new Float32Array(haloCount * 6);
      for (let k = 0; k < haloCount; k++) {
        const theta = (k / haloCount) * Math.PI * 2;
        const len = 1.2 + Math.random() * 0.8;
        pos[k * 6]     = 0;
        pos[k * 6 + 1] = 0;
        pos[k * 6 + 2] = 0;
        pos[k * 6 + 3] = Math.cos(theta) * len;
        pos[k * 6 + 4] = Math.sin(theta) * len;
        pos[k * 6 + 5] = (Math.random() - 0.5) * 0.8;
      }
      haloGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const haloMat = new THREE.LineBasicMaterial({
        color: 0x5ce0ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.LineSegments(haloGeo, haloMat);
      halo.position.copy(mesh.position);
      scene.add(halo);

      this.nodes.push({ mesh, material, halo, haloMat });
    });

    this._bindEvents();
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

  _onClick() {
    if (this.hovered) {
      const { project, index } = this.hovered.mesh.userData;
      this.onSelect?.(project, index);
    }
  }

  update(time, dt) {
    // Raycast every frame (cheap — <10 objects).
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.nodes.map(n => n.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];

    const prevHovered = this.hovered;
    this.hovered = hit ? this.nodes.find(n => n.mesh === hit.object) : null;

    // Update cursor state via body class — Cursor.js listens for this.
    if (this.hovered && !prevHovered) {
      document.body.classList.add('cursor-node');
    } else if (!this.hovered && prevHovered) {
      document.body.classList.remove('cursor-node');
    }

    // Update each node's pulse.
    this.nodes.forEach(node => {
      const target = node === this.hovered ? 1 : node.mesh.userData.pulseTarget;
      node.material.uniforms.uTime.value = time;
      node.material.uniforms.uPulse.value = damp(
        node.material.uniforms.uPulse.value,
        target,
        0.1,
        dt
      );
      // Halo glow scales with pulse too.
      node.haloMat.opacity = 0.2 + node.material.uniforms.uPulse.value * 0.5;
    });
  }

  // Called by orchestrator when scroll proximity says a specific node is "the" current project.
  setActiveByIndex(index) {
    this.nodes.forEach((node, i) => {
      node.mesh.userData.pulseTarget = i === index ? 0.7 : 0;
    });
  }

  dispose() {
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('click', this._onClick);
    this.nodes.forEach(n => {
      n.mesh.geometry.dispose();
      n.material.dispose();
      n.halo.geometry.dispose();
      n.haloMat.dispose();
      this.scene.remove(n.mesh);
      this.scene.remove(n.halo);
    });
  }
}
