import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const USERNAME = 'nixocode';
const knownProjects = [
  { name: 'Tailor', title: 'Tailor', categoryBadge: 'Enterprise & Product Design', description: 'A modern web design agency combining AI efficiency with human craftsmanship for premium custom websites.', live_url: 'https://nixocode.github.io/Tailor/' },
  { name: 'la-zona-segura', title: 'La Zona Segura', description: 'A professional industrial safety blog and incident management platform dedicated to risk mitigation in construction.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/' },
  { name: 'global-strike-game', title: 'Global Strike — Nuclear Strategy', categoryBadge: 'Interactive Simulations', description: 'A visually immersive browser-based nuclear strategy game simulating DEFCON protocols and global conflict scenarios.', live_url: 'https://nixocode.github.io/global-strike-game/' },
  { name: 'global-conflict-tracker', title: 'Global Conflict Tracker', description: 'An interactive, real-time 3D globe visualizing active geopolitical conflicts and regional tensions.', live_url: 'https://nixocode.github.io/global-conflict-tracker/' }
];

async function init() {
  let repos = knownProjects;
  try {
    const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=12`);
    if (res.ok) {
      const data = await res.json();
      
      const missingRepos = data
        .filter(r => !r.fork && r.name.toLowerCase() !== 'nicolaspertierraporfolio' && !knownProjects.some(kp => kp.name === r.name))
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
        
      if (missingRepos.length > 0) {
        missingRepos[0].categoryBadge = 'Applied Studies & Open Source';
      }
      repos = [...knownProjects, ...missingRepos.slice(0, 4)];
    }
  } catch (err) {
    console.warn("Could not fetch github repos, back to fallbacks.");
  }

  // Generate HTML
  const container = document.getElementById('projects-container');
  
  const themes = [
    { bg: 'rgba(15, 23, 42, 0.4)', border: 'rgba(56, 189, 248, 0.2)', hoverBorder: 'rgba(56, 189, 248, 0.5)' }, // Tailor (Blue)
    { bg: 'rgba(40, 15, 15, 0.4)', border: 'rgba(244, 63, 94, 0.2)', hoverBorder: 'rgba(244, 63, 94, 0.5)' },  // Strike (Rose)
    { bg: 'rgba(30, 25, 10, 0.4)', border: 'rgba(250, 204, 21, 0.2)', hoverBorder: 'rgba(250, 204, 21, 0.5)' },  // Safety (Yellow)
    { bg: 'rgba(15, 30, 20, 0.4)', border: 'rgba(16, 185, 129, 0.2)', hoverBorder: 'rgba(16, 185, 129, 0.5)' }   // Tracker (Green)
  ];

  repos.forEach((repo, i) => {
    const section = document.createElement('section');
    const isRight = i % 2 === 0;
    const theme = themes[i % themes.length];
    
    section.className = `section project-section ${isRight ? 'project-right' : 'project-left'}`;
    section.innerHTML = `
      <div class="project-details" id="project-${i}" style="--bg-color: ${theme.bg}; --border-color: ${theme.border}; --hover-border: ${theme.hoverBorder};">
        ${repo.categoryBadge ? `<div class="category-badge">${repo.categoryBadge}</div>` : ''}
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
  
  const pointLight2 = new THREE.PointLight(0x94a3b8, 2, 50);
  pointLight2.position.set(-5, -5, -5);
  scene.add(pointLight2);

  const meshes = [];
  const distance = 10; 

  // Create 3D Objects for Projects
  repos.forEach((repo, i) => {
    let mathGeo;
    if (repo.name.includes('global-strike') || repo.name.includes('conflict')) {
      mathGeo = new THREE.SphereGeometry(1.2, 32, 32); 
    } else if (repo.name.includes('zona-segura')) {
      mathGeo = new THREE.ConeGeometry(1, 2, 32);
    } else if (repo.name.includes('Tailor')) {
      mathGeo = new THREE.OctahedronGeometry(1.4, 0);
    } else {
      mathGeo = new THREE.IcosahedronGeometry(1.4, 0);
    }
    
    const material = new THREE.MeshPhysicalMaterial({
      color: i % 2 === 0 ? 0x38bdf8 : 0x94a3b8,
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
      camera.rotation.y = Math.sin(self.progress * Math.PI * 2) * 0.15;
      camera.position.x = Math.sin(self.progress * Math.PI * 2) * 0.6;
      camera.rotation.z = Math.cos(self.progress * Math.PI * 2) * 0.05;
      camera.fov = 75 + self.progress * 15;
      camera.updateProjectionMatrix();
    }
  });

  repos.forEach((_, i) => {
    gsap.fromTo(`#project-${i}`, 
      { y: 150, opacity: 0, scale: 0.8 },
      {
        scrollTrigger: {
          trigger: `#project-${i}`,
          start: 'top 85%',
          end: 'top 40%',
          scrub: 1,
        },
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: "power2.out"
      }
    );
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}

init();
