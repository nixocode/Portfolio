import gsap from 'gsap';
import { CATEGORIES } from './Projects.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 1920, H = 1080;
const INPUT_X = 260;
const HIDDEN_X1 = 680;
const HIDDEN_X2 = 1120;
const OUTPUT_X = 1660;
const PAD_TOP = 130;
const PAD_BOT = 80;

let overlay = null;
let svgEl = null;
let detailCard = null;
let onClose = null;
let isActive = false;
let entranceComplete = false;
let hovering = false;

let catNodeRefs = [];
let projNodeRefs = [];
let outputRef = null;
let pathRefs = [];
let entranceTL = null;
let hoverTL = null;
let projectsRef = [];
let reducedMotion = false;

function el(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  if (parent) parent.appendChild(node);
  return node;
}

function curvePath(ax, ay, bx, by) {
  const dx = bx - ax;
  const sag = Math.abs(by - ay) < 1 ? Math.abs(dx) * 0.04 : 0;
  return `M${ax},${ay} C${ax + dx * 0.42},${ay + sag} ${bx - dx * 0.42},${by + sag} ${bx},${by}`;
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function fireTrace(pathEl, color, dur = 0.6, reverse = false) {
  const len = pathEl.getTotalLength();
  const dash = len * 0.15;
  const trace = el('path', {
    d: pathEl.getAttribute('d'),
    fill: 'none',
    stroke: color,
    'stroke-width': '3',
    'stroke-linecap': 'round',
    'stroke-dasharray': `${dash} ${len - dash}`,
    'stroke-dashoffset': reverse ? -dash : len,
    opacity: '0.9',
    filter: 'url(#bePathGlow)',
    'pointer-events': 'none',
    class: 'be-signal-trace'
  }, pathEl.parentNode);

  gsap.to(trace, {
    attr: { 'stroke-dashoffset': reverse ? len : -dash },
    duration: dur,
    ease: 'none',
    onComplete: () => trace.remove()
  });
}

function resetNodeState() {
  projNodeRefs.forEach(pn => {
    const halo = pn.group.querySelector('.be-halo');
    if (halo) halo.setAttribute('opacity', '0');
    const circles = pn.group.querySelectorAll('circle');
    if (circles[1]) {
      circles[1].setAttribute('stroke', hexToRgba(pn.accent, 0.22));
      circles[1].setAttribute('stroke-width', '1.2');
    }
    if (circles[2]) circles[2].setAttribute('filter', 'url(#beNodeGlow)');
  });
  catNodeRefs.forEach(cn => {
    const ring = cn.group.querySelector('.be-ring-pulse');
    if (ring) ring.setAttribute('stroke-opacity', '0.25');
  });
}

function updateHover(id) {
  if (!entranceComplete) return;

  const wasHovering = hovering;
  hovering = id != null;

  if (hoverTL) { hoverTL.kill(); hoverTL = null; }
  hoverTL = gsap.timeline();

  pathRefs.forEach(pr => pr.el.removeAttribute('filter'));
  resetNodeState();

  const hoveredProj = projNodeRefs.find(p => p.name === id);
  const hoveredCat = catNodeRefs.find(c => c.id === id);
  const hoveredOutput = id === '__output__';
  const isIdle = !hoveredProj && !hoveredCat && !hoveredOutput;

  if (isIdle) {
    [...catNodeRefs, ...projNodeRefs].forEach(ref => {
      hoverTL.to(ref.group, {
        opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out',
        svgOrigin: `${ref.pos.x} ${ref.pos.y}`
      }, 0);
    });
    if (outputRef) {
      hoverTL.to(outputRef.group, {
        opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out',
        svgOrigin: `${outputRef.pos.x} ${outputRef.pos.y}`
      }, 0);
    }
    pathRefs.forEach(pr => {
      const cat = CATEGORIES.find(c => c.id === pr.cat);
      const isInput = pr.type === 'input';
      hoverTL.to(pr.el, {
        attr: {
          stroke: isInput ? (cat?.accent || '#e8eaed') : '#ff7a4d',
          'stroke-width': 1,
          'stroke-opacity': isInput ? 0.3 : 0.15
        },
        duration: 0.4
      }, 0);
    });
    detailCard.classList.remove('visible');

    return;
  }

  if (hoveredProj) {
    hoverTL.to(hoveredProj.group, {
      scale: 1.3, duration: 0.3, ease: 'back.out(2)',
      svgOrigin: `${hoveredProj.pos.x} ${hoveredProj.pos.y}`
    }, 0);

    const halo = hoveredProj.group.querySelector('.be-halo');
    if (halo) halo.setAttribute('opacity', '1');
    const core = hoveredProj.group.querySelectorAll('circle')[2];
    if (core) core.setAttribute('filter', 'url(#beNodeGlowHot)');

    const connectedCats = new Set();
    pathRefs.forEach(pr => {
      if (pr.project === hoveredProj.name) {
        connectedCats.add(pr.cat);
        const color = pr.type === 'input' ? hoveredProj.accent : '#ff7a4d';
        hoverTL.to(pr.el, {
          attr: { stroke: color, 'stroke-width': 2.5, 'stroke-opacity': 0.9 },
          duration: 0.3
        }, 0);
        pr.el.setAttribute('filter', 'url(#bePathGlow)');
        if (!reducedMotion) fireTrace(pr.el, color, 0.6);
      } else {
        hoverTL.to(pr.el, { attr: { 'stroke-opacity': 0.02 }, duration: 0.3 }, 0);
      }
    });

    catNodeRefs.forEach(cn => {
      hoverTL.to(cn.group, {
        opacity: connectedCats.has(cn.id) ? 1 : 0.25, duration: 0.3
      }, 0);
    });
    projNodeRefs.forEach(pn => {
      if (pn.name !== hoveredProj.name) {
        hoverTL.to(pn.group, { opacity: 0.25, duration: 0.3 }, 0);
      }
    });
    if (outputRef) {
      hoverTL.to(outputRef.group, { opacity: 0.5, duration: 0.3 }, 0);
    }

    const proj = projectsRef.find(p => p.name === hoveredProj.name);
    if (proj) {
      const cat = CATEGORIES.find(c => c.id === proj.category);
      detailCard.querySelector('.bd-cat').textContent = cat?.label || '';
      detailCard.querySelector('.bd-cat').style.color = cat?.accent || '';
      detailCard.querySelector('.bd-title').textContent = proj.title;
      detailCard.querySelector('.bd-desc').textContent = proj.description;
      detailCard.querySelector('.bd-stack').textContent = proj.techStack.join(' · ');
      detailCard.style.borderLeftColor = cat?.accent || '#5fd896';
      detailCard.classList.add('visible');
    }
  }

  if (hoveredCat) {
    hoverTL.to(hoveredCat.group, {
      scale: 1.15, duration: 0.3, ease: 'back.out(2)',
      svgOrigin: `${hoveredCat.pos.x} ${hoveredCat.pos.y}`
    }, 0);

    let traceIdx = 0;
    pathRefs.forEach(pr => {
      if (pr.cat === hoveredCat.id) {
        const color = pr.type === 'input' ? hoveredCat.accent : '#ff7a4d';
        hoverTL.to(pr.el, {
          attr: { stroke: color, 'stroke-width': 2.5, 'stroke-opacity': 0.9 },
          duration: 0.3
        }, 0);
        pr.el.setAttribute('filter', 'url(#bePathGlow)');
        if (!reducedMotion) {
          const delay = traceIdx * 50;
          setTimeout(() => { if (isActive) fireTrace(pr.el, color, 0.6); }, delay);
          traceIdx++;
        }
      } else {
        hoverTL.to(pr.el, { attr: { 'stroke-opacity': 0.02 }, duration: 0.3 }, 0);
      }
    });

    projNodeRefs.forEach((pn, i) => {
      if (pn.category === hoveredCat.id) {
        hoverTL.to(pn.group, {
          opacity: 1, scale: 1.1, duration: 0.3, ease: 'back.out(2)',
          svgOrigin: `${pn.pos.x} ${pn.pos.y}`
        }, i * 0.03);
      } else {
        hoverTL.to(pn.group, { opacity: 0.25, duration: 0.3 }, 0);
      }
    });

    catNodeRefs.forEach(cn => {
      if (cn.id !== hoveredCat.id) {
        hoverTL.to(cn.group, { opacity: 0.25, duration: 0.3 }, 0);
      }
    });
    if (outputRef) {
      hoverTL.to(outputRef.group, { opacity: 1, duration: 0.3 }, 0);
    }
    detailCard.classList.remove('visible');
  }

  if (hoveredOutput) {
    pathRefs.forEach(pr => {
      if (pr.type === 'output') {
        hoverTL.to(pr.el, {
          attr: { stroke: '#ff7a4d', 'stroke-width': 2.5, 'stroke-opacity': 0.9 },
          duration: 0.3
        }, 0);
        pr.el.setAttribute('filter', 'url(#bePathGlow)');
        if (!reducedMotion) fireTrace(pr.el, '#ff7a4d', 0.6, true);
      } else {
        hoverTL.to(pr.el, { attr: { 'stroke-opacity': 0.02 }, duration: 0.3 }, 0);
      }
    });
    projNodeRefs.forEach(pn => {
      hoverTL.to(pn.group, { opacity: 1, duration: 0.3 }, 0);
    });
    catNodeRefs.forEach(cn => {
      hoverTL.to(cn.group, { opacity: 0.5, duration: 0.3 }, 0);
    });
    const ring = outputRef?.group.querySelector('.be-ring-pulse');
    if (ring) {
      hoverTL.to(ring, {
        attr: { r: 50 }, duration: 0.15, yoyo: true, repeat: 5, ease: 'sine.inOut'
      }, 0);
    }
    detailCard.classList.remove('visible');
  }
}

// --- CREATE ---
export function createBirdsEyeView(projects, onPickProject, onCloseView) {
  onClose = onCloseView;
  projectsRef = projects;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cats = CATEGORIES;

  const catSpacing = (H - PAD_TOP - PAD_BOT) / cats.length;
  const catPos = {};
  cats.forEach((c, i) => {
    catPos[c.id] = { x: INPUT_X, y: PAD_TOP + catSpacing * (i + 0.5) };
  });

  const grouped = {};
  cats.forEach(c => { grouped[c.id] = []; });
  projects.forEach(p => {
    const cid = grouped[p.category] ? p.category : 'class';
    grouped[cid].push(p);
  });

  const projPos = {};
  cats.forEach(c => {
    const list = grouped[c.id];
    const centerY = catPos[c.id].y;
    const bandH = catSpacing * 0.85;
    list.forEach((p, i) => {
      const localY = list.length === 1
        ? centerY
        : centerY - bandH / 2 + (bandH / (list.length - 1)) * i;
      const col = i % 2 === 0 ? HIDDEN_X1 : HIDDEN_X2;
      projPos[p.name] = { x: col, y: localY };
    });
  });

  const outPos = { x: OUTPUT_X, y: H / 2 };

  overlay = document.createElement('div');
  overlay.className = 'birdseye';

  svgEl = el('svg', {
    class: 'birdseye-svg',
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMid meet'
  }, overlay);

  // --- Defs ---
  const defs = el('defs', null, svgEl);
  cats.forEach(c => {
    const grad = el('radialGradient', { id: `beGlow-${c.id}` }, defs);
    el('stop', { offset: '0%', 'stop-color': c.accent, 'stop-opacity': '.45' }, grad);
    el('stop', { offset: '100%', 'stop-color': c.accent, 'stop-opacity': '0' }, grad);
  });
  const outGrad = el('radialGradient', { id: 'beGlowOut' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ff7a4d', 'stop-opacity': '.45' }, outGrad);
  el('stop', { offset: '100%', 'stop-color': '#ff7a4d', 'stop-opacity': '0' }, outGrad);

  const glowF = el('filter', { id: 'beNodeGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '3', result: 'blur' }, glowF);
  const m1 = el('feMerge', null, glowF);
  el('feMergeNode', { in: 'blur' }, m1);
  el('feMergeNode', { in: 'SourceGraphic' }, m1);

  const pathGlowF = el('filter', { id: 'bePathGlow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2', result: 'blur' }, pathGlowF);
  const m2 = el('feMerge', null, pathGlowF);
  el('feMergeNode', { in: 'blur' }, m2);
  el('feMergeNode', { in: 'SourceGraphic' }, m2);

  const hotGlowF = el('filter', { id: 'beNodeGlowHot', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs);
  el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '6', result: 'blur' }, hotGlowF);
  const m3 = el('feMerge', null, hotGlowF);
  el('feMergeNode', { in: 'blur' }, m3);
  el('feMergeNode', { in: 'SourceGraphic' }, m3);

  // --- Background dot grid ---
  const gridG = el('g', { opacity: '0.05' }, svgEl);
  for (let gx = 40; gx < W; gx += 60) {
    for (let gy = PAD_TOP - 20; gy < H; gy += 60) {
      el('circle', { cx: gx, cy: gy, r: '0.6', fill: '#e8eaed' }, gridG);
    }
  }

  // --- Category zone bands ---
  cats.forEach(c => {
    const centerY = catPos[c.id].y;
    el('rect', {
      x: 0, y: centerY - catSpacing / 2, width: W, height: catSpacing,
      fill: hexToRgba(c.accent, 0.012), class: 'be-cat-zone'
    }, svgEl);
  });

  // --- Category (input) nodes ---
  catNodeRefs = [];
  cats.forEach((c, i) => {
    const pos = catPos[c.id];
    const g = el('g', { class: 'node-group node-input' }, svgEl);
    el('circle', { cx: pos.x, cy: pos.y, r: '48', fill: `url(#beGlow-${c.id})`, opacity: '.4' }, g);
    el('circle', {
      cx: pos.x, cy: pos.y, r: '28',
      fill: 'none', stroke: c.accent, 'stroke-width': '0.5', 'stroke-opacity': '0.25',
      class: 'be-ring-pulse', style: `animation-delay: ${i * -0.7}s`
    }, g);
    el('circle', {
      cx: pos.x, cy: pos.y, r: '22',
      fill: c.accent, stroke: 'rgba(255,255,255,0.2)', 'stroke-width': '1.5',
      filter: 'url(#beNodeGlow)'
    }, g);
    el('circle', { cx: pos.x, cy: pos.y, r: '3.5', fill: 'rgba(255,255,255,0.55)' }, g);
    el('text', {
      x: pos.x - 36, y: pos.y - 3, fill: '#f2f3f5',
      'font-family': 'ui-rounded,system-ui', 'font-size': '11.5', 'font-weight': '600',
      'text-anchor': 'end', textContent: c.label
    }, g);

    g.addEventListener('mouseenter', () => updateHover(c.id));
    g.addEventListener('mouseleave', () => updateHover(null));
    catNodeRefs.push({ id: c.id, group: g, pos, accent: c.accent });
  });

  // --- Project (hidden) nodes ---
  projNodeRefs = [];
  cats.forEach(c => {
    grouped[c.id].forEach(proj => {
      const pos = projPos[proj.name];
      if (!pos) return;
      const g = el('g', { class: 'node-group node-hidden' }, svgEl);
      el('circle', {
        cx: pos.x, cy: pos.y, r: '26',
        fill: hexToRgba(c.accent, 0.08), opacity: '0', class: 'be-halo'
      }, g);
      el('circle', {
        cx: pos.x, cy: pos.y, r: '14',
        fill: '#0c1018', stroke: hexToRgba(c.accent, 0.22), 'stroke-width': '1.2'
      }, g);
      el('circle', {
        cx: pos.x, cy: pos.y, r: '3.5',
        fill: c.accent, filter: 'url(#beNodeGlow)'
      }, g);
      el('text', {
        x: pos.x, y: pos.y + 26, fill: '#d4dbe5',
        'font-family': 'ui-rounded,system-ui', 'font-size': '9.5', 'font-weight': '500',
        'text-anchor': 'middle', textContent: proj.title
      }, g);

      g.addEventListener('mouseenter', () => updateHover(proj.name));
      g.addEventListener('mouseleave', () => updateHover(null));
      g.addEventListener('click', () => { if (onPickProject) onPickProject(proj); });
      projNodeRefs.push({ name: proj.name, category: proj.category, group: g, pos, accent: c.accent });
    });
  });

  // --- Output node ---
  const og = el('g', { class: 'node-group node-output', style: 'cursor:pointer' }, svgEl);
  el('circle', { cx: outPos.x, cy: outPos.y, r: '58', fill: 'url(#beGlowOut)', opacity: '.35' }, og);
  el('circle', {
    cx: outPos.x, cy: outPos.y, r: '34',
    fill: 'none', stroke: '#ff7a4d', 'stroke-width': '0.5', 'stroke-opacity': '0.25',
    class: 'be-ring-pulse'
  }, og);
  el('circle', {
    cx: outPos.x, cy: outPos.y, r: '26',
    fill: '#ff7a4d', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': '1.5',
    filter: 'url(#beNodeGlow)'
  }, og);
  el('circle', { cx: outPos.x, cy: outPos.y, r: '4.5', fill: 'rgba(255,255,255,0.45)' }, og);
  el('text', {
    x: outPos.x, y: outPos.y - 44, fill: '#f2f3f5',
    'font-family': 'ui-rounded,system-ui', 'font-size': '13', 'font-weight': '700',
    'text-anchor': 'middle', textContent: 'Contact'
  }, og);
  el('text', {
    x: outPos.x, y: outPos.y - 31, fill: '#ff7a4d',
    'font-family': 'ui-rounded,system-ui', 'font-size': '7.5',
    'text-anchor': 'middle', 'letter-spacing': '2', textContent: 'OUTPUT'
  }, og);
  og.addEventListener('mouseenter', () => updateHover('__output__'));
  og.addEventListener('mouseleave', () => updateHover(null));
  og.addEventListener('click', () => {
    if (onClose) onClose();
    const footer = document.getElementById('contact');
    if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  outputRef = { group: og, pos: outPos };

  // --- Connection paths (rendered after nodes so they appear on top) ---
  pathRefs = [];
  const pathG = el('g', { class: 'be-paths' }, svgEl);

  projects.forEach(proj => {
    const a = catPos[proj.category];
    const b = projPos[proj.name];
    if (!a || !b) return;
    const cat = cats.find(c => c.id === proj.category);
    const p = el('path', {
      d: curvePath(a.x, a.y, b.x, b.y),
      fill: 'none',
      stroke: cat?.accent || '#e8eaed',
      'stroke-opacity': '0.3',
      'stroke-width': '1',
      'pointer-events': 'none',
      'data-type': 'input',
      'data-project': proj.name,
      'data-cat': proj.category
    }, pathG);
    pathRefs.push({ el: p, type: 'input', project: proj.name, cat: proj.category, length: 0 });
  });

  projects.forEach(proj => {
    const b = projPos[proj.name];
    if (!b) return;
    const p = el('path', {
      d: curvePath(b.x, b.y, outPos.x, outPos.y),
      fill: 'none',
      stroke: '#ff7a4d',
      'stroke-opacity': '0.15',
      'stroke-width': '1',
      'pointer-events': 'none',
      'data-type': 'output',
      'data-project': proj.name,
      'data-cat': proj.category
    }, pathG);
    pathRefs.push({ el: p, type: 'output', project: proj.name, cat: proj.category, length: 0 });
  });

  // --- Detail card ---
  detailCard = document.createElement('div');
  detailCard.className = 'birdseye-detail';
  detailCard.innerHTML = `
    <div class="bd-cat"></div>
    <div class="bd-title"></div>
    <div class="bd-desc"></div>
    <div class="bd-stack"></div>
  `;
  overlay.appendChild(detailCard);

  // --- Back button ---
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'birdseye-back interactive';
  backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Back`;
  backBtn.addEventListener('click', () => { if (onClose) onClose(); });
  overlay.appendChild(backBtn);

  // --- Hint ---
  const hint = document.createElement('div');
  hint.className = 'birdseye-hint';
  hint.textContent = 'Click a node to navigate · ESC to close';
  overlay.appendChild(hint);

  return overlay;
}

// --- SHOW (entrance animation) ---
export function showBirdsEyeView() {
  if (!overlay) return;
  isActive = true;
  entranceComplete = false;
  hovering = false;
  overlay.classList.add('active');

  // Compute path lengths (paths are now in DOM)
  pathRefs.forEach(pr => { pr.length = pr.el.getTotalLength(); });

  if (reducedMotion) {
    entranceComplete = true;
    return;
  }

  if (entranceTL) entranceTL.kill();

  // Hide all nodes
  catNodeRefs.forEach(cn => gsap.set(cn.group, { opacity: 0, scale: 0, svgOrigin: `${cn.pos.x} ${cn.pos.y}` }));
  projNodeRefs.forEach(pn => gsap.set(pn.group, { opacity: 0, scale: 0, svgOrigin: `${pn.pos.x} ${pn.pos.y}` }));
  if (outputRef) gsap.set(outputRef.group, { opacity: 0, scale: 0, svgOrigin: `${outputRef.pos.x} ${outputRef.pos.y}` });

  // Hide paths via dashoffset, brighten for draw effect
  pathRefs.forEach(pr => {
    pr.el.setAttribute('stroke-dasharray', String(pr.length));
    pr.el.setAttribute('stroke-dashoffset', String(pr.length));
    if (pr.type === 'input') {
      const cat = CATEGORIES.find(c => c.id === pr.cat);
      pr.el.setAttribute('stroke', cat?.accent || '#e8eaed');
      pr.el.setAttribute('stroke-opacity', '0.5');
    } else {
      pr.el.setAttribute('stroke', '#ff7a4d');
      pr.el.setAttribute('stroke-opacity', '0.3');
    }
  });

  // Hide UI
  const backBtn = overlay.querySelector('.birdseye-back');
  const hint = overlay.querySelector('.birdseye-hint');
  if (backBtn) gsap.set(backBtn, { opacity: 0, y: -10 });
  if (hint) gsap.set(hint, { opacity: 0 });

  entranceTL = gsap.timeline();

  // T+0.2: Category nodes pop in
  catNodeRefs.forEach((cn, i) => {
    entranceTL.to(cn.group, {
      opacity: 1, scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.6)',
      svgOrigin: `${cn.pos.x} ${cn.pos.y}`
    }, 0.2 + i * 0.08);
  });

  // T+0.5: Input paths draw
  pathRefs.filter(pr => pr.type === 'input').forEach((pr, i) => {
    entranceTL.to(pr.el, {
      attr: { 'stroke-dashoffset': 0 },
      duration: 0.5, ease: 'power2.inOut'
    }, 0.5 + i * 0.03);
  });

  // T+0.8: Project nodes pop in
  projNodeRefs.forEach((pn, i) => {
    entranceTL.to(pn.group, {
      opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)',
      svgOrigin: `${pn.pos.x} ${pn.pos.y}`
    }, 0.8 + i * 0.04);
  });

  // T+1.4: Output paths draw
  pathRefs.filter(pr => pr.type === 'output').forEach((pr, i) => {
    entranceTL.to(pr.el, {
      attr: { 'stroke-dashoffset': 0 },
      duration: 0.5, ease: 'power2.inOut'
    }, 1.4 + i * 0.03);
  });

  // T+1.8: Output node
  if (outputRef) {
    entranceTL.to(outputRef.group, {
      opacity: 1, scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)',
      svgOrigin: `${outputRef.pos.x} ${outputRef.pos.y}`
    }, 1.8);
  }

  // T+2.2: UI
  if (backBtn) entranceTL.to(backBtn, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 2.2);
  if (hint) entranceTL.to(hint, { opacity: 0.5, duration: 0.4, ease: 'power2.out' }, 2.2);

  // T+2.4: Transition to idle state
  entranceTL.call(() => {
    pathRefs.forEach(pr => {
      pr.el.removeAttribute('stroke-dasharray');
      pr.el.removeAttribute('stroke-dashoffset');
      const base = pr.type === 'input' ? 0.3 : 0.15;
      gsap.to(pr.el, { attr: { 'stroke-opacity': base }, duration: 0.8 });
    });
    entranceComplete = true;
  }, null, 2.4);
}

// --- HIDE ---
export function hideBirdsEyeView() {
  if (!overlay) return;
  isActive = false;
  entranceComplete = false;
  hovering = false;

  if (entranceTL) { entranceTL.kill(); entranceTL = null; }
  if (hoverTL) { hoverTL.kill(); hoverTL = null; }
  if (svgEl) svgEl.querySelectorAll('.be-signal-trace').forEach(t => t.remove());

  catNodeRefs.forEach(cn => gsap.set(cn.group, { clearProps: 'all' }));
  projNodeRefs.forEach(pn => gsap.set(pn.group, { clearProps: 'all' }));
  if (outputRef) gsap.set(outputRef.group, { clearProps: 'all' });

  pathRefs.forEach(pr => {
    pr.el.removeAttribute('stroke-dasharray');
    pr.el.removeAttribute('stroke-dashoffset');
    pr.el.removeAttribute('filter');
    if (pr.type === 'input') {
      const cat = CATEGORIES.find(c => c.id === pr.cat);
      pr.el.setAttribute('stroke', cat?.accent || '#e8eaed');
      pr.el.setAttribute('stroke-opacity', '0.3');
    } else {
      pr.el.setAttribute('stroke', '#ff7a4d');
      pr.el.setAttribute('stroke-opacity', '0.15');
    }
    pr.el.setAttribute('stroke-width', '1');
  });

  resetNodeState();
  detailCard.classList.remove('visible');
  overlay.classList.remove('active');
}
