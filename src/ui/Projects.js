// GitHub projects: fetch, cache in sessionStorage, render with reserved
// skeleton height so there's zero layout shift on hydration.

const USERNAME = 'nixocode';
const CACHE_KEY = 'nixocode-repos-v3';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ASSET = (p) => `${import.meta.env.BASE_URL}${p}`;

// Map of repo-name → local screenshot. Used for both knownProjects and
// fetched extras (looked up by name). Keep lowercased to match lookups.
const PROJECT_IMAGES = {
  'tailor':                   ASSET('projects/tailor.jpg'),
  'la-zona-segura':           ASSET('projects/la-zona-segura.jpg'),
  'global-strike-game':       ASSET('projects/global-strike-game.jpg'),
  're-ground':                ASSET('projects/re-ground.jpg'),
  'class_project_sales_plan': ASSET('projects/sales-plan.jpg'),
  'law-civil-law':            ASSET('projects/law-civil-law.jpg'),
  'pool-guide':               ASSET('projects/pool-guide.jpg'),
  'fresc':                    ASSET('projects/fresc.jpg'),
};
const imageFor = (name) => PROJECT_IMAGES[String(name || '').toLowerCase()] || null;

export const knownProjects = [
  { name: 'Tailor', title: 'Tailor', categoryBadge: 'Enterprise & Product Design', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A modern web design agency combining AI efficiency with human craftsmanship for premium custom websites.', live_url: 'https://nixocode.github.io/Tailor/', image: imageFor('tailor') },
  { name: 'la-zona-segura', title: 'La Zona Segura', techStack: ['Jekyll', 'HTML', 'CSS'], description: 'A professional industrial safety blog and incident management platform dedicated to risk mitigation in construction.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/', image: imageFor('la-zona-segura') },
  { name: 'global-strike-game', title: 'Global Strike — Nuclear Strategy', categoryBadge: 'Interactive Simulations', techStack: ['Three.js', 'HTML', 'CSS'], description: 'A visually immersive browser-based nuclear strategy game simulating DEFCON protocols and global conflict scenarios.', live_url: 'https://nixocode.github.io/global-strike-game/', image: imageFor('global-strike-game') },
  { name: 'global-conflict-tracker', title: 'Global Conflict Tracker', techStack: ['D3.js', 'JavaScript', 'CSS'], description: 'An interactive, real-time 3D globe visualizing active geopolitical conflicts and regional tensions — work in progress.' },
  { name: 'RE-GROUND', title: 'RE:Ground', categoryBadge: 'Brand & Sustainability', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A circular beauty brand concept that upcycles coffee waste from partner cafés into premium, sustainable skincare products.', live_url: 'https://nixocode.github.io/RE-GROUND/', image: imageFor('re-ground') },
  { name: 'Class_Project_Sales_Plan', title: 'Sales Plan Playground', categoryBadge: 'Business & Strategy', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'An interactive educational framework teaching a systematic 5-step approach to sales planning — from constraint analysis through market penetration strategy.', live_url: 'https://nixocode.github.io/Class_Project_Sales_Plan/', image: imageFor('class_project_sales_plan') },
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
        !r.name.toLowerCase().includes('portfolio') &&
        !knownProjects.some(kp => kp.name === r.name)
      )
      .map(r => {
        // Build a richer tech stack: language + inferred tags from topics.
        const topics = Array.isArray(r.topics) ? r.topics : [];
        const stack = [];
        if (r.language) stack.push(r.language);
        topics.slice(0, 3).forEach(t => {
          const label = t
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          if (!stack.some(s => s.toLowerCase() === label.toLowerCase())) {
            stack.push(label);
          }
        });
        if (stack.length === 0) stack.push('Web', 'Open Source');

        const title = r.name
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        const description = r.description
          ? r.description
          : `An experimental build exploring ${title.toLowerCase()} — part of an ongoing open source portfolio.`;

        return {
          name: r.name,
          title,
          categoryBadge: 'Applied Studies & Open Source',
          techStack: stack,
          description,
          live_url: r.homepage || (r.has_pages ? `https://${USERNAME}.github.io/${r.name}/` : null),
          html_url: r.html_url,
          image: imageFor(r.name),
        };
      });

    const wipCards = [
      { name: 'wip-1', title: 'Work in Progress', wip: true, categoryBadge: 'Coming Soon', techStack: [], description: '' },
      { name: 'wip-2', title: 'Work in Progress', wip: true, categoryBadge: 'Coming Soon', techStack: [], description: '' },
    ];
    const merged = [...knownProjects, ...extras.slice(0, 4), ...wipCards];
    writeCache(merged);
    return merged;
  } catch {
    return [...knownProjects,
      { name: 'wip-1', title: 'Work in Progress', wip: true, categoryBadge: 'Coming Soon', techStack: [], description: '' },
      { name: 'wip-2', title: 'Work in Progress', wip: true, categoryBadge: 'Coming Soon', techStack: [], description: '' },
    ];
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
  const total = projects.length;
  const width = Math.max(2, String(total).length);
  const pad = (n) => String(n).padStart(width, '0');

  projects.forEach((repo, i) => {
    const section = document.createElement('section');
    const isRight = i % 2 === 0;
    section.className = `section project-section ${isRight ? 'project-right' : 'project-left'}`;
    section.dataset.index = i;
    if (repo.wip) {
      section.innerHTML = `
        <div class="project-details project-wip" id="project-${i}">
          <div class="project-index">${pad(i + 1)} / ${pad(total)}</div>
          <div class="category-badge">Coming Soon</div>
          <h2 class="project-title split-target">Work in Progress</h2>
          <p class="project-description" style="opacity:0.5;font-style:italic">New project coming soon.</p>
        </div>
      `;
    } else {
      const hasImage = !!repo.image;
      section.innerHTML = `
        <div class="project-details${hasImage ? ' has-image' : ''}" id="project-${i}">
          ${hasImage ? `<div class="project-bg" style="background-image:url('${encodeURI(repo.image)}')"></div>` : ''}
          <div class="project-index">${pad(i + 1)} / ${pad(total)}</div>
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
    }
    container.appendChild(section);
  });
}
