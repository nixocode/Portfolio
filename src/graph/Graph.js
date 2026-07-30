// Graph.js — builds the 4-lane node DOM from project data and wires the
// clickable project panel. Pure DOM; the Threads canvas measures whatever
// this renders, so the two stay aligned by construction.

const BASE = import.meta.env.BASE_URL;

// Display order left → right, with each lane's accent.
export const LANES = [
  { id: 'marketing', label: 'Content & Marketing', accent: '#ff6a5e' },
  { id: 'webdesign', label: 'Web, Apps & AI',      accent: '#5fd896' },
  { id: 'games',     label: 'Game Design',         accent: '#5aa8ff' },
  { id: 'class',     label: 'Learning',            accent: '#c89aff' },
];

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

function safeURL(url) {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch { return null; }
}

// A single clickable project node. `meta:true` adds the category badge as a
// faint sub-line (used in the focused lane; bird's-eye stays as bare pills).
export function createNode(p, accent, onClick, { meta = false } = {}) {
  const btn = el('button', 'node');
  btn.type = 'button';
  btn.style.setProperty('--accent', accent);
  btn.setAttribute('aria-haspopup', 'dialog');
  const body = meta && p.categoryBadge
    ? `<span class="node-body"><span class="node-label"></span><span class="node-meta"></span></span>`
    : `<span class="node-label"></span>`;
  btn.innerHTML = `<span class="node-dot" aria-hidden="true"></span>${body}`;
  btn.querySelector('.node-label').textContent = p.title;
  if (meta && p.categoryBadge) btn.querySelector('.node-meta').textContent = p.categoryBadge;
  // Faint project screenshot behind the card that reveals on hover/focus.
  if (p.image) {
    const thumb = el('span', 'node-thumb');
    thumb.setAttribute('aria-hidden', 'true');
    thumb.style.backgroundImage = `url("${encodeURI(p.image)}")`;
    btn.prepend(thumb);
    btn.classList.add('has-thumb');
  }
  btn.addEventListener('click', () => onClick(p, accent));
  return btn;
}

// Build lanes + nodes inside `mount`. Returns { lanes } describing the
// accent + node elements per lane, for the Threads renderer.
export function buildGraph(mount, projects, onNodeClick) {
  mount.innerHTML = '';
  const lanesOut = [];

  LANES.forEach((lane) => {
    const items = projects.filter((p) => p.category === lane.id);
    const col = el('div', 'lane');
    col.style.setProperty('--accent', lane.accent);
    col.dataset.lane = lane.id;

    const head = el('div', 'lane-head',
      `<span class="dot"></span>${lane.label}`);
    col.appendChild(head);

    const nodesWrap = el('div', 'lane-nodes');
    const nodeEls = [];
    items.forEach((p) => {
      const btn = createNode(p, lane.accent, onNodeClick, { meta: true });
      nodesWrap.appendChild(btn);
      nodeEls.push(btn);
    });
    col.appendChild(nodesWrap);
    mount.appendChild(col);

    lanesOut.push({ id: lane.id, accent: lane.accent, nodes: nodeEls });
  });

  return { lanes: lanesOut };
}

// ---- Project panel (slide-in drawer) ------------------------------------

export function createPanel() {
  const overlay = el('div', 'panel-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="panel" tabindex="-1">
      <button type="button" class="panel-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="panel-thumb" data-thumb></div>
      <span class="panel-badge" data-badge></span>
      <h2 data-title></h2>
      <div class="panel-stack" data-stack></div>
      <p class="panel-desc" data-desc></p>
      <div class="panel-links" data-links></div>
    </div>`;
  document.body.appendChild(overlay);

  const panel = overlay.querySelector('.panel');
  const closeBtn = overlay.querySelector('.panel-close');
  let lastFocus = null;

  const api = {};
  const close = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
    api.onClose?.();
  };

  const open = (p, accent) => {
    lastFocus = document.activeElement;
    panel.style.setProperty('--panel-accent', accent);

    const thumb = panel.querySelector('[data-thumb]');
    if (p.image) { thumb.style.backgroundImage = `url('${p.image}')`; thumb.style.display = ''; }
    else thumb.style.display = 'none';

    const badge = panel.querySelector('[data-badge]');
    if (p.categoryBadge) { badge.textContent = p.categoryBadge; badge.style.display = ''; }
    else badge.style.display = 'none';

    panel.querySelector('[data-title]').textContent = p.title;
    panel.querySelector('[data-desc]').textContent = p.description || '';

    const stack = panel.querySelector('[data-stack]');
    stack.innerHTML = '';
    (p.techStack || []).forEach((t) => {
      const s = document.createElement('span');
      s.textContent = t;
      stack.appendChild(s);
    });

    const links = panel.querySelector('[data-links]');
    links.innerHTML = '';
    const live = safeURL(p.live_url);
    const src = safeURL(p.html_url);
    if (live) {
      const a = el('a', 'panel-link primary',
        `View live <span class="arrow">→</span>`);
      a.href = live; a.target = '_blank'; a.rel = 'noopener noreferrer';
      links.appendChild(a);
    }
    if (src) {
      const a = el('a', 'panel-link ghost',
        `Source <span class="arrow">→</span>`);
      a.href = src; a.target = '_blank'; a.rel = 'noopener noreferrer';
      links.appendChild(a);
    }
    if (!live && !src) {
      links.appendChild(el('span', 'mono', 'In progress'));
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.focus());
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  api.open = open;
  api.close = close;
  return api;
}
