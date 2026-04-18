// GitHub projects: fetch, cache in sessionStorage, render with reserved
// skeleton height so there's zero layout shift on hydration.

const USERNAME = 'nixocode';
const CACHE_KEY = 'nixocode-repos-v3';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ASSET = (p) => `${import.meta.env.BASE_URL}${p}`;

// Map of repo-name → local screenshot. Used for both knownProjects and
// fetched extras (looked up by name). Keep lowercased to match lookups.
const PROJECT_IMAGES = {
  'content-marketing':        ASSET('projects/content-marketing.jpg'),
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

// Four neural branches — each carries its own biome tint + density.
// accent is used by the WebGL layer to colour that branch's nodes, trunk
// and particle cluster. Keep all in the monochrome/steel family so the
// site still reads sleek — biome variation is subtle, not rainbow.
// Grey-core accents with a whisper of biome hue — must match BIOMES in
// ProjectNodes.js so DOM and WebGL stay in sync.
export const CATEGORIES = [
  { id: 'marketing', label: 'Content & Marketing',  accent: '#ff6a5e', density: 'dense'  },
  { id: 'games',     label: 'Game Design',          accent: '#5aa8ff', density: 'sharp'  },
  { id: 'webdesign', label: 'Web, Apps & AI',       accent: '#5fd896', density: 'grid'   },
  { id: 'others',    label: 'Studies & Coursework', accent: '#8a93a2', density: 'sparse' },
];

export const knownProjects = [
  // --- Content & Marketing ---
  { name: 'Content-marketing', category: 'marketing', title: 'Content & Marketing', categoryBadge: 'Content Creation & Social Media', techStack: ['Instagram', 'Photography', 'Production'], description: 'End-to-end social content — planning, capture, production, analytics. 2× follower and engagement growth, measurable sales impact.', live_url: 'https://nixocode.github.io/Content-marketing/', image: imageFor('content-marketing') },

  // --- Game Design ---
  { name: 'global-strike-game', category: 'games', title: 'Global Strike — Nuclear Strategy', categoryBadge: 'Interactive Simulations', techStack: ['Three.js', 'HTML', 'CSS'], description: 'A visually immersive browser-based nuclear strategy game simulating DEFCON protocols and global conflict scenarios.', live_url: 'https://nixocode.github.io/global-strike-game/', image: imageFor('global-strike-game') },
  { name: 'global-conflict-tracker', category: 'games', title: 'Global Conflict Tracker', categoryBadge: 'Geopolitical Simulation', techStack: ['D3.js', 'JavaScript', 'CSS'], description: 'An interactive, real-time 3D globe visualizing active geopolitical conflicts and regional tensions — work in progress.' },

  // --- Web, Apps & AI (AI + safety platforms live here) ---
  { name: 'Tailor', category: 'webdesign', title: 'Tailor', categoryBadge: 'Enterprise & Product Design', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A modern web design agency combining AI efficiency with human craftsmanship for premium custom websites.', live_url: 'https://nixocode.github.io/Tailor/', image: imageFor('tailor') },
  { name: 'RE-GROUND', category: 'webdesign', title: 'RE:Ground', categoryBadge: 'Brand & Sustainability', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A circular beauty brand concept that upcycles coffee waste from partner cafés into premium, sustainable skincare products.', live_url: 'https://nixocode.github.io/RE-GROUND/', image: imageFor('re-ground') },
  { name: 'la-zona-segura', category: 'webdesign', title: 'La Zona Segura', categoryBadge: 'AI Safety Platform', techStack: ['Jekyll', 'HTML', 'CSS'], description: 'An industrial safety platform and incident management app — AI-assisted risk analysis for construction sites.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/', image: imageFor('la-zona-segura') },

  // --- Studies & Coursework ---
  { name: 'Class_Project_Sales_Plan', category: 'others', title: 'Sales Plan Playground', categoryBadge: 'Academic Study', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'An interactive educational framework teaching a systematic 5-step approach to sales planning — from constraint analysis through market penetration strategy.', live_url: 'https://nixocode.github.io/Class_Project_Sales_Plan/', image: imageFor('class_project_sales_plan') },
  { name: 'pool-guide', category: 'others', title: '42 Pool Prep Guide', categoryBadge: 'Technical Study', techStack: ['C', 'Systems', 'Algorithms'], description: 'Peer-tested C pool prep — algorithmic drills, Norme conformance and systems primitives built during on-site 42 training.', image: imageFor('pool-guide') },
  { name: 'fresc', category: 'others', title: 'Fresc', categoryBadge: 'Coursework', techStack: ['HTML', 'CSS', 'Type'], description: 'Coursework microsite exploring typographic restraint and editorial pacing — constraint-driven design study.', image: imageFor('fresc') },
  { name: 'law-civil-law', category: 'others', title: 'Civil Law Explainer', categoryBadge: 'Legal Study', techStack: ['HTML', 'CSS', 'Research'], description: 'Visual explainers compiled for a civil law course — dense statutory material distilled into scannable screens.', image: imageFor('law-civil-law') },
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

        // Fetched repos land in the "others" branch — the catch-all for
        // recent/applied/open-source explorations.
        return {
          name: r.name,
          category: 'others',
          title,
          categoryBadge: 'Applied Studies & Open Source',
          techStack: stack,
          description,
          live_url: r.homepage || (r.has_pages ? `https://${USERNAME}.github.io/${r.name}/` : null),
          html_url: r.html_url,
          image: imageFor(r.name),
        };
      });

    const merged = [...knownProjects, ...extras.slice(0, 4)];
    writeCache(merged);
    return merged;
  } catch {
    return [...knownProjects];
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

// Scheme-allowlisted URL sanitizer — protects the inline href interpolation
// against anything exotic coming back from the GitHub API (javascript:, data:,
// etc). Falls back to '#' so the anchor renders but can't navigate anywhere.
function safeURL(url) {
  if (!url) return '';
  try {
    const u = new URL(url, window.location.origin);
    return (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:')
      ? encodeURI(u.href)
      : '#';
  } catch {
    return '#';
  }
}

// Group-preserving sort: each known category in CATEGORIES order, unknowns last.
export function orderByCategory(projects) {
  const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return [...projects].sort((a, b) => {
    const ai = order.has(a.category) ? order.get(a.category) : 99;
    const bi = order.has(b.category) ? order.get(b.category) : 99;
    return ai - bi;
  });
}

// Pointer-branching render:
//   The 3 primary branches (marketing / games / webdesign) are stacked
//   on top of each other inside a CSS grid so they share vertical space.
//   Pointer X picks the active one — the other two fade out. Scrolling
//   therefore descends whichever neural path you're currently pointing
//   at. The "others" studies track trails after the stack, always visible.
export function renderProjects(projects, container) {
  container.innerHTML = '';
  const ordered = orderByCategory(projects);
  const total = ordered.length;
  const width = Math.max(2, String(total).length);
  const pad = (n) => String(n).padStart(width, '0');

  const buildHeader = (cat) => {
    const h = document.createElement('div');
    h.className = 'category-group';
    h.dataset.category = cat.id;
    h.innerHTML = `
      <span class="category-group-line"></span>
      <span class="category-group-inner">// ${escapeHTML(cat.label)}</span>
      <span class="category-group-line"></span>
    `;
    return h;
  };

  const buildSection = (repo, globalIdx, localIdx) => {
    const section = document.createElement('section');
    const isRight = localIdx % 2 === 0;
    section.className = `section project-section ${isRight ? 'project-right' : 'project-left'}`;
    section.dataset.index = globalIdx;
    if (repo.category) section.dataset.category = repo.category;
    const hasImage = !!repo.image;
    section.innerHTML = `
      <div class="project-details${hasImage ? ' has-image' : ''}" id="project-${globalIdx}">
        ${hasImage ? `<div class="project-bg" style="background-image:url('${encodeURI(repo.image)}')"></div>` : ''}
        <div class="project-index">${pad(globalIdx + 1)} / ${pad(total)}</div>
        ${repo.categoryBadge ? `<div class="category-badge">${escapeHTML(repo.categoryBadge)}</div>` : ''}
        <h2 class="project-title split-target">${escapeHTML(repo.title)}</h2>
        <div class="tech-stack-container">
          ${repo.techStack.map(t => `<span class="tech-badge">${escapeHTML(t)}</span>`).join('')}
        </div>
        <p class="project-description">${escapeHTML(repo.description)}</p>
        <div class="project-links interactive">
          ${repo.live_url ? `<a href="${safeURL(repo.live_url)}" target="_blank" rel="noopener noreferrer">View Live<span class="arrow">→</span></a>` : ''}
          ${!repo.live_url && repo.html_url ? `<a href="${safeURL(repo.html_url)}" target="_blank" rel="noopener noreferrer">View Source<span class="arrow">→</span></a>` : ''}
        </div>
      </div>
    `;
    return section;
  };

  // Group by category for easy track assembly.
  const groups = {};
  ordered.forEach(p => {
    const c = (p.category && CATEGORIES.some(cat => cat.id === p.category)) ? p.category : 'others';
    (groups[c] ||= []).push(p);
  });

  // --- Pointer-gated stack: 3 overlapping vertical tracks ---
  const stack = document.createElement('div');
  stack.className = 'branch-stack';
  ['marketing', 'games', 'webdesign'].forEach((catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    const list = groups[catId] || [];
    const track = document.createElement('div');
    track.className = 'branch-track';
    track.dataset.branch = catId;
    // Default active = middle (games) so the page has a visible state
    // before the pointer ever moves.
    track.dataset.active = catId === 'games' ? 'true' : 'false';
    track.appendChild(buildHeader(cat));
    list.forEach((repo, li) => {
      track.appendChild(buildSection(repo, ordered.indexOf(repo), li));
    });
    stack.appendChild(track);
  });
  container.appendChild(stack);

  // --- Trailing "Studies & Coursework" epilogue (always visible) ---
  const others = groups.others || [];
  if (others.length) {
    const wrap = document.createElement('div');
    wrap.className = 'branch-others';
    wrap.dataset.branch = 'others';
    const oCat = CATEGORIES.find(c => c.id === 'others');
    wrap.appendChild(buildHeader(oCat));
    others.forEach((repo, li) => {
      wrap.appendChild(buildSection(repo, ordered.indexOf(repo), li));
    });
    container.appendChild(wrap);
  }

  return ordered;
}
