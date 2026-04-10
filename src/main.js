import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const USERNAME = 'nixocode';
const knownProjects = [
  { name: 'global-strike-game', title: 'Global Strike — Nuclear Strategy', description: 'A realistic browser-based nuclear strategy game simulating global conflict and DEFCON protocols.', live_url: 'https://nixocode.github.io/global-strike-game/' },
  { name: 'la-zona-segura', title: 'La Zona Segura', description: 'Professional industrial safety blog and incident management platform for risk mitigation.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/' },
  { name: 'global-conflict-tracker', title: 'Global Conflict Tracker', description: 'A 3D interactive globe tracking active geopolitical conflicts in real-time.', live_url: 'https://nixocode.github.io/global-conflict-tracker/' }
];

async function init() {
  let repos = knownProjects;
  try {
    const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=6`);
    if (res.ok) {
      const data = await res.json();
      
      const missingRepos = data
        .filter(r => !r.fork && !knownProjects.some(kp => kp.name === r.name))
        .map(r => {
          let live = r.homepage;
          if (!live && r.has_pages) {
            live = `https://${USERNAME}.github.io/${r.name}/`;
          }
          return {
            name: r.name,
            title: r.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: r.description || 'Open source project by nixocode.',
            live_url: live,
            html_url: r.html_url
          };
        });
        
      repos = [...knownProjects, ...missingRepos].slice(0, 6);
    }
  } catch (err) {
    console.warn("Could not fetch github repos, back to fallbacks.");
  }

  // Generate HTML
  const container = document.getElementById('projects-container');
  repos.forEach((repo, i) => {
    const section = document.createElement('section');
    const isRight = i % 2 === 0;
    section.className = `section project-section ${isRight ? 'project-right' : 'project-left'}`;
    section.innerHTML = `
      <div class="project-details" id="project-${i}">
        <h2 class="project-title">${repo.title}</h2>
        <p class="project-description">${repo.description}</p>
        <div class="project-links interactive">
          ${repo.live_url ? `<a href="${repo.live_url}" target="_blank">View Live Project</a>` : ''}
          ${!repo.live_url && repo.html_url ? `<a href="${repo.html_url}" target="_blank">View Source Code</a>` : ''}
        </div>
      </div>
    `;
    container.appendChild(section);
  });

  // Hide loader
  document.getElementById('loader').classList.add('hidden');

  // Must wait a tick for DOM to register before creating ScrollTriggers
  setTimeout(() => {
    setupThreeBase(repos);
  }, 100);
}

function setupThreeBase(repos) {
  const canvas = document.querySelector('#webgl');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030712, 0.05);
  
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Particles Background
  const particlesCount = 3000;
  const positions = new Float32Array(particlesCount * 3);
  for(let i = 0; i < particlesCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 60;
  }
  
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    color: '#0ea5e9',
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  
  const pointLight1 = new THREE.PointLight(0x38bdf8, 2, 50);
  pointLight1.position.set(5, 5, 5);
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0xc084fc, 2, 50);
  pointLight2.position.set(-5, -5, -5);
  scene.add(pointLight2);

  const meshes = [];
  const distance = 10; 

  // Create 3D Objects for Projects
  repos.forEach((repo, i) => {
    const geometries = [
      new THREE.IcosahedronGeometry(1.4, 0),
      new THREE.TorusKnotGeometry(0.9, 0.3, 128, 32),
      new THREE.OctahedronGeometry(1.4, 0),
      new THREE.TorusGeometry(1.2, 0.4, 32, 64)
    ];
    
    const mathGeo = geometries[i % geometries.length];
    
    const material = new THREE.MeshPhysicalMaterial({
      color: i % 2 === 0 ? 0x38bdf8 : 0xc084fc,
      metalness: 0.2,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      transmission: 0.9,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    const mesh = new THREE.Mesh(mathGeo, material);
    
    const isRight = i % 2 === 0;
    mesh.position.set(isRight ? -3 : 3, 0, - (i + 1) * distance);
    
    scene.add(mesh);
    meshes.push(mesh);
  });

  camera.position.z = 2; 

  const clock = new THREE.Clock();
  
  function animate() {
    const time = clock.getElapsedTime();
    requestAnimationFrame(animate);

    meshes.forEach((mesh, index) => {
      mesh.rotation.y += 0.005;
      mesh.rotation.x += 0.005;
      mesh.position.y = Math.sin(time + index) * 0.3;
    });

    particles.rotation.y = time * 0.02;

    renderer.render(scene, camera);
  }

  animate();

  const maxScroll = (repos.length + 0.5) * distance;

  ScrollTrigger.create({
    trigger: '#app',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: (self) => {
      camera.position.z = 2 - self.progress * maxScroll;
      camera.rotation.y = Math.sin(self.progress * Math.PI * 2) * 0.1;
      camera.position.x = Math.sin(self.progress * Math.PI * 2) * 0.5;
    }
  });

  repos.forEach((_, i) => {
    gsap.to(`#project-${i}`, {
      scrollTrigger: {
        trigger: `#project-${i}`,
        start: 'top 85%',
        end: 'top 40%',
        scrub: 1,
      },
      y: 0,
      opacity: 1,
      duration: 1
    });
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}

init();
