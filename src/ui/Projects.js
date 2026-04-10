// GitHub projects: fetch, cache in sessionStorage, render with reserved
// skeleton height so there's zero layout shift on hydration.

const USERNAME = 'nixocode';
const CACHE_KEY = 'nixocode-repos-v2';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const knownProjects = [
  { name: 'Tailor', title: 'Tailor', categoryBadge: 'Enterprise & Product Design', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A modern web design agency combining AI efficiency with human craftsmanship for premium custom websites.', live_url: 'https://nixocode.github.io/Tailor/' },
  { name: 'la-zona-segura', title: 'La Zona Segura', techStack: ['Jekyll', 'HTML', 'CSS'], description: 'A professional industrial safety blog and incident management platform dedicated to risk mitigation in construction.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/' },
  { name: 'global-strike-game', title: 'Global Strike — Nuclear Strategy', categoryBadge: 'Interactive Simulations', techStack: ['Three.js', 'HTML', 'CSS'], description: 'A visually immersive browser-based nuclear strategy game simulating DEFCON protocols and global conflict scenarios.', live_url: 'https://nixocode.github.io/global-strike-game/' },
  { name: 'global-conflict-tracker', title: 'Global Conflict Tracker', techStack: ['D3.js', 'JavaScript', 'CSS'], description: 'An interactive, real-time 3D globe visualizing active geopolitical conflicts and regional tensions.', live_url: 'https://nixocode.github.io/global-conflict-tracker/' },
];

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — fine */ }
}

export async function loadProjects() {
  const cached = readCache();
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=12`
    );
    if (!res.ok) throw new Error('GitHub API failed');
    const data = await res.json();

    const extras = data
      .filter(r =>
        !r.fork &&
        r.name.toLowerCase() !== 'nicolaspertierraportfolio' &&
        !knownProjects.some(kp => kp.name === r.name)
      )
      .map(r => ({
        name: r.name,
        title: r.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        techStack: r.language ? [r.language] : ['Code'],
        description: r.description || 'Open source project by nixocode.',
        live_url: r.homepage || (r.has_pages ? `https://${USERNAME}.github.io/${r.name}/` : null),
        html_url: r.html_url,
      }));

    if (extras.length > 0) extras[0].categoryBadge = 'Applied Studies & Open Source';
    const merged = [...knownProjects, ...extras.slice(0, 4)];
    writeCache(merged);
    return merged;
  } catch {
    return knownProjects;
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderProjects(projects, container) {
  container.innerHTML = '';
  projects.forEach((repo, i) => {
    const section = document.createElement('section');
    const isRight = i % 2 === 0;
    section.className = `section project-section ${isRight ? 'project-right' : 'project-left'}`;
    section.dataset.index = i;
    section.innerHTML = `
      <div class="project-details" id="project-${i}">
        <div class="project-index">0${i + 1} / 0${projects.length}</div>
        ${repo.categoryBadge ? `<div class="category-badge">${escapeHTML(repo.categoryBadge)}</div>` : ''}
        <h2 class="project-title split-target">${escapeHTML(repo.title)}</h2>
        <div class="tech-stack-container">
          ${repo.techStack.map(t => `<span class="tech-badge">${escapeHTML(t)}</span>`).join('')}
        </div>
        <p class="project-description">${escapeHTML(repo.description)}</p>
        <div class="project-links interactive">
          ${repo.live_url ? `<a href="${encodeURI(repo.live_url)}" target="_blank" rel="noopener">View Live<span class="arrow">→</span></a>` : ''}
          ${!repo.live_url && repo.html_url ? `<a href="${encodeURI(repo.html_url)}" target="_blank" rel="noopener">View Source<span class="arrow">→</span></a>` : ''}
        </div>
      </div>
    `;
    container.appendChild(section);
  });
}
