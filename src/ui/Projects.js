// GitHub projects: fetch, cache in sessionStorage, render with reserved
// skeleton height so there's zero layout shift on hydration.

const USERNAME = 'nixocode';
const CACHE_KEY = 'nixocode-repos-v5';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ASSET = (p) => `${import.meta.env.BASE_URL}${p}`;

// Map of repo-name → local screenshot. Used for both knownProjects and
// fetched extras (looked up by name). Keep lowercased to match lookups.
const PROJECT_IMAGES = {
  'content-marketing':        ASSET('projects/content-marketing.jpg'),
  'tailor':                   ASSET('projects/tailor.jpg'),
  'la-zona-segura':           ASSET('projects/la-zona-segura.jpg'),
  'global-strike-game':       ASSET('projects/global-strike-2.jpg'),
  'vietnam-65':               ASSET('projects/vietnam-65.jpg'),
  're-ground':                ASSET('projects/re-ground.jpg'),
  'class_project_sales_plan': ASSET('projects/sales-plan.jpg'),
  'law-civil-law':            ASSET('projects/law-civil-law.jpg'),
  'pool-guide':               ASSET('projects/pool-guide.jpg'),
  'fresc':                    ASSET('projects/fresc.jpg'),
  'ai2b':                     ASSET('projects/ai2b.jpg'),
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
  { id: 'class',     label: 'Learning', accent: '#c89aff', density: 'sparse' },
];

export const knownProjects = [
  // --- Content & Marketing ---
  { name: 'Content-marketing', category: 'marketing', title: 'Content & Marketing', categoryBadge: 'Content Creation & Social Media', techStack: ['Instagram', 'Photography', 'Production'], description: 'End-to-end social content — planning, capture, production, analytics. 2× follower and engagement growth, measurable sales impact.', live_url: 'https://nixocode.github.io/Content-marketing/', html_url: 'https://github.com/nixocode/Content-marketing', image: imageFor('content-marketing') },

  // --- Game Design ---
  { name: 'global-strike-game', category: 'games', title: 'Global Strike — Nuclear Strategy', categoryBadge: 'Real-Time Strategy Sim · In Development', techStack: ['Three.js', 'WebGL', 'JavaScript'], description: 'A real-time 3D-globe nuclear strategy sim — DEFCON escalation and a live intel feed, across four modes: Campaign, Realistic, Arcade and Sandbox.', live_url: 'https://global-strike-v0-1.vercel.app', links: [{ label: 'Web version', url: 'https://global-strike-v0-1.vercel.app' }, { label: 'Mobile version', url: 'https://global-strike-ios.vercel.app' }], html_url: 'https://github.com/nixocode/global-strike-game', image: imageFor('global-strike-game') },
  { name: 'vietnam-65', category: 'games', title: "Vietnam '65", categoryBadge: 'Lane-Tactics War Game · In Development', techStack: ['Canvas', 'JavaScript', 'Game Design'], description: "A lane-tactics war game in the tradition of Warfare 1944 — Campaign, Skirmish and Field Manual modes, depicting 1965–69 with documentary intent.", live_url: 'https://nixocode.github.io/vietnam-65-lanes-of-war/', links: [{ label: 'Web version', url: 'https://nixocode.github.io/vietnam-65-lanes-of-war/' }, { label: 'Mobile version', url: 'https://nixocode.github.io/vietnam-65-mobile-game/' }], image: imageFor('vietnam-65') },
  { name: 'global-conflict-tracker', category: 'games', title: 'Global Conflict Tracker', categoryBadge: 'Geopolitical Simulation', techStack: ['D3.js', 'JavaScript', 'CSS'], description: 'An interactive, real-time 3D globe visualizing active geopolitical conflicts and regional tensions — work in progress.' },

  // --- Web, Apps & AI (AI + safety platforms live here) ---
  { name: 'Ai2B', category: 'webdesign', title: 'Ai2B', categoryBadge: 'Custom AI Studio', techStack: ['Next.js', 'AI', 'Vercel'], description: 'Custom AI software for real businesses — bespoke agents and end-to-end systems forged to each company\'s stack, no templates, no fluff.', live_url: 'https://ai2-b.vercel.app', html_url: 'https://github.com/nixocode/Ai2B', image: imageFor('ai2b') },
  { name: 'Tailor', category: 'webdesign', title: 'Tailor', categoryBadge: 'Enterprise & Product Design', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A modern web design agency combining AI efficiency with human craftsmanship for premium custom websites.', live_url: 'https://nixocode.github.io/Tailor/', html_url: 'https://github.com/nixocode/Tailor', image: imageFor('tailor') },
  { name: 'RE-GROUND', category: 'webdesign', title: 'RE:Ground', categoryBadge: 'Brand & Sustainability', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'A circular beauty brand concept that upcycles coffee waste from partner cafés into premium, sustainable skincare products.', live_url: 'https://nixocode.github.io/RE-GROUND/', html_url: 'https://github.com/nixocode/RE-GROUND', image: imageFor('re-ground') },
  { name: 'la-zona-segura', category: 'webdesign', title: 'La Zona Segura', categoryBadge: 'AI Safety Platform', techStack: ['Jekyll', 'HTML', 'CSS'], description: 'An industrial safety platform and incident management app — AI-assisted risk analysis for construction sites.', live_url: 'https://lazonaseguralzs.github.io/lazonasegura/', html_url: 'https://github.com/nixocode/LZS', image: imageFor('la-zona-segura') },

  // --- Studies & Coursework ---
  { name: 'Class_Project_Sales_Plan', category: 'class', title: 'Sales Plan Playground', categoryBadge: 'Academic Study', techStack: ['HTML', 'CSS', 'JavaScript'], description: 'An interactive educational framework teaching a systematic 5-step approach to sales planning — from constraint analysis through market penetration strategy.', live_url: 'https://nixocode.github.io/Class_Project_Sales_Plan/', html_url: 'https://github.com/nixocode/Class_Project_Sales_Plan', image: imageFor('class_project_sales_plan') },
  { name: 'pool-guide', category: 'class', title: '42 Pool Prep Guide', categoryBadge: 'Technical Study', techStack: ['C', 'Systems', 'Algorithms'], description: 'Peer-tested C pool prep — algorithmic drills, Norme conformance and systems primitives built during on-site 42 training.', live_url: 'https://nixocode.github.io/C-pool-Prep/', html_url: 'https://github.com/nixocode/C-pool-Prep', image: imageFor('pool-guide') },
  { name: 'fresc', category: 'class', title: 'Fresc', categoryBadge: 'Coursework', techStack: ['HTML', 'CSS', 'Type'], description: 'Coursework microsite exploring typographic restraint and editorial pacing — constraint-driven design study.', live_url: 'https://nixocode.github.io/Fresc/', html_url: 'https://github.com/nixocode/Fresc', image: imageFor('fresc') },
  { name: 'law-civil-law', category: 'class', title: 'Civil Law Explainer', categoryBadge: 'Legal Study', techStack: ['HTML', 'CSS', 'Research'], description: 'Visual explainers compiled for a civil law course — dense statutory material distilled into scannable screens.', live_url: 'https://nixocode.github.io/Law-Civil-Web/', html_url: 'https://github.com/nixocode/Law-Civil-Web', image: imageFor('law-civil-law') },
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

    // Case-insensitive name match + html_url match keeps the curated
    // knownProjects from being duplicated as auto-fetched extras when the
    // hardcoded `name` differs in case from the actual GitHub repo
    // (pool-guide → C-pool-Prep, fresc → Fresc, la-zona-segura → LZS, etc).
    const knownNames = new Set(
      knownProjects.map(p => (p.name || '').toLowerCase())
    );
    const knownUrls = new Set(
      knownProjects.map(p => p.html_url).filter(Boolean)
    );
    const extras = data
      .filter(r =>
        !r.fork &&
        !r.name.toLowerCase().includes('portfolio') &&
        !knownNames.has(r.name.toLowerCase()) &&
        !knownUrls.has(r.html_url)
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
          category: 'class',
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
    // Lowercased name lets CSS target individual project cards if a
    // particular thumbnail needs custom positioning / overlay tuning.
    if (repo.name) section.dataset.projectName = String(repo.name).toLowerCase();
    const hasImage = !!repo.image;
    section.innerHTML = `
      <div class="project-details${hasImage ? ' has-image' : ''}" id="project-${globalIdx}">
        ${hasImage ? `<div class="project-bg" data-bg="${encodeURI(repo.image)}"></div>` : ''}
        <div class="project-index">${pad(globalIdx + 1)} / ${pad(total)}</div>
        ${repo.categoryBadge ? `<div class="category-badge">${escapeHTML(repo.categoryBadge)}</div>` : ''}
        <h2 class="project-title split-target">${escapeHTML(repo.title)}</h2>
        <div class="tech-stack-container">
          ${repo.techStack.map(t => `<span class="tech-badge">${escapeHTML(t)}</span>`).join('')}
        </div>
        <p class="project-description">${escapeHTML(repo.description)}</p>
        <div class="project-links interactive">
          ${Array.isArray(repo.links) && repo.links.length
            ? repo.links.map(l => `<a href="${safeURL(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}<span class="arrow">→</span></a>`).join('')
            : `${repo.live_url ? `<a href="${safeURL(repo.live_url)}" target="_blank" rel="noopener noreferrer">View Live<span class="arrow">→</span></a>` : ''}
               ${!repo.live_url && repo.html_url ? `<a href="${safeURL(repo.html_url)}" target="_blank" rel="noopener noreferrer">View Source<span class="arrow">→</span></a>` : ''}`}
        </div>
      </div>
    `;
    return section;
  };

  // Group by category for easy track assembly.
  const groups = {};
  ordered.forEach(p => {
    const c = (p.category && CATEGORIES.some(cat => cat.id === p.category)) ? p.category : 'class';
    (groups[c] ||= []).push(p);
  });

  // --- PSP / XMB tributary stack: 3 parallel rails ---
  // Render order is left → center → right so DOM matches visual order.
  // `data-side` is the resting position of inactive rails relative to
  // the currently-active one; JS recomputes it on every lane switch.
  const stack = document.createElement('div');
  stack.className = 'branch-stack';
  const RAILS = ['marketing', 'webdesign', 'games', 'class'];
  const DEFAULT_ACTIVE = 'webdesign';
  RAILS.forEach((catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    const list = groups[catId] || [];
    const track = document.createElement('div');
    track.className = 'branch-track';
    track.dataset.branch = catId;
    track.dataset.active = catId === DEFAULT_ACTIVE ? 'true' : 'false';
    if (catId !== DEFAULT_ACTIVE) {
      const idx = RAILS.indexOf(catId);
      const activeIdx = RAILS.indexOf(DEFAULT_ACTIVE);
      if (Math.abs(idx - activeIdx) === 1) {
        track.dataset.side = idx < activeIdx ? 'left' : 'right';
      } else {
        track.dataset.side = 'hidden';
      }
    }
    list.forEach((repo, li) => {
      track.appendChild(buildSection(repo, ordered.indexOf(repo), li));
    });
    stack.appendChild(track);
  });
  container.appendChild(stack);

  // Screenshots load only as their card approaches the viewport — with 14
  // cards across 4 lanes, eager-loading every background stalls first paint.
  const bgIO = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const src = el.dataset.bg;
      if (src) { el.style.backgroundImage = `url('${src}')`; delete el.dataset.bg; }
      obs.unobserve(el);
    });
  }, { rootMargin: '400px 0px' });
  container.querySelectorAll('.project-bg[data-bg]').forEach((el) => bgIO.observe(el));

  return ordered;
}
