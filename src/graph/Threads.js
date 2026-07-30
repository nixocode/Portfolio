// Threads.js — the living LLM background.
//
// One 2D canvas draws thin bezier "threads" that:
//   • emerge converged from a single SOURCE node (top merge),
//   • fan out through each lane's stacked project NODES,
//   • re-converge into a single SINK node (bottom merge).
// Threads merge at top & bottom; nodes stay distinct.
//
// Alignment is exact because every point is measured from the real DOM
// (getBoundingClientRect relative to the graph container). No magic numbers.
// Redraw happens only on resize/layout change + the rAF loop for motion,
// never on scroll (canvas is absolutely positioned inside the graph, so it
// travels with the nodes for free).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Cubic bezier point at t.
function bez(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export class Threads {
  // graphEl: the .graph container (also hosts the <canvas>).
  // source/sink: the anchor elements.
  // lanes: [{ id, accent, nodes: [el, ...] }]
  constructor(canvas, graphEl, { source, sink, lanes }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graphEl = graphEl;
    this.source = source;
    this.sink = sink;
    this.lanes = lanes;

    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.segments = [];   // computed connection segments
    this.mouse = { x: -9999, y: -9999, on: false };
    this.hoverLane = null;
    this.time = 0;
    this.raf = null;

    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._loop = this._loop.bind(this);

    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(graphEl);
    window.addEventListener('resize', () => this.measure());
    // Pointer tracked on the graph so threads react without stealing clicks.
    graphEl.addEventListener('pointermove', this._onMove);
    graphEl.addEventListener('pointerleave', this._onLeave);
  }

  setHoverLane(id) { this.hoverLane = id; }

  // Swap which lane(s) the spine threads through (used when the active lane
  // changes in XMB mode). Remeasures on the next frame so new node positions
  // are laid out first.
  setLanes(lanes) {
    this.lanes = lanes;
    requestAnimationFrame(() => this.measure());
  }

  // Center point of an element, in CSS px relative to the graph container.
  _pt(el, edge = 'center') {
    const g = this.graphEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - g.left;
    let y = r.top + r.height / 2 - g.top;
    if (edge === 'top') y = r.top - g.top;
    else if (edge === 'bottom') y = r.bottom - g.top;
    return { x, y };
  }

  measure() {
    const g = this.graphEl.getBoundingClientRect();
    const w = g.width, h = g.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    const src = this._pt(this.source, 'bottom');
    const snk = this._pt(this.sink, 'top');

    const segs = [];
    this.lanes.forEach((lane) => {
      const pts = lane.nodes.map((el) => ({
        top: this._pt(el, 'top'),
        bottom: this._pt(el, 'bottom'),
      }));
      if (!pts.length) return;
      // source -> first node
      segs.push({ a: src, b: pts[0].top, accent: lane.accent, lane: lane.id });
      // node -> node chain
      for (let i = 0; i < pts.length - 1; i++) {
        segs.push({ a: pts[i].bottom, b: pts[i + 1].top, accent: lane.accent, lane: lane.id });
      }
      // last node -> sink
      segs.push({ a: pts[pts.length - 1].bottom, b: snk, accent: lane.accent, lane: lane.id });
    });

    // Precompute control points (smooth vertical S-curve) + a stable pulse
    // phase per segment so motion looks organic rather than lock-stepped.
    segs.forEach((s, i) => {
      const dy = s.b.y - s.a.y;
      s.c1 = { x: s.a.x, y: s.a.y + dy * 0.5 };
      s.c2 = { x: s.b.x, y: s.b.y - dy * 0.5 };
      s.mid = bez(s.a, s.c1, s.c2, s.b, 0.5);
      s.phase = (i * 0.37) % 1;
      s.len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    });
    this.segments = segs;

    if (this.reduced) this._draw(); // one static frame
  }

  _onMove(e) {
    const g = this.graphEl.getBoundingClientRect();
    this.mouse.x = e.clientX - g.left;
    this.mouse.y = e.clientY - g.top;
    this.mouse.on = true;
  }
  _onLeave() { this.mouse.on = false; this.mouse.x = this.mouse.y = -9999; }

  _rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineCap = 'round';

    for (const s of this.segments) {
      // Base thread — faint; brighter when its lane is hovered or the cursor
      // is near the segment's midpoint.
      let glow = 0;
      if (this.mouse.on) {
        const d = Math.hypot(this.mouse.x - s.mid.x, this.mouse.y - s.mid.y);
        glow = clamp(1 - d / 240, 0, 1);
      }
      const laneHot = this.hoverLane === s.lane ? 1 : 0;
      const heat = Math.max(glow * 0.85, laneHot);

      const baseA = 0.16 + heat * 0.5;
      ctx.strokeStyle = this._rgba(s.accent, baseA);
      ctx.lineWidth = 1 + heat * 1.1;
      ctx.shadowColor = this._rgba(s.accent, 0.5 * heat);
      ctx.shadowBlur = 12 * heat;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.b.x, s.b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (this.reduced) continue;

      // Traveling pulse — a bright mote sliding down the thread (data flow).
      const speed = 0.13;
      const t = (this.time * speed + s.phase) % 1;
      const p = bez(s.a, s.c1, s.c2, s.b, t);
      const pa = 0.5 + heat * 0.5;
      const rad = 1.6 + heat * 1.4;
      ctx.fillStyle = this._rgba(s.accent, pa);
      ctx.shadowColor = this._rgba(s.accent, 0.9);
      ctx.shadowBlur = 8 + heat * 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _loop(now) {
    this.time = now / 1000;
    this._draw();
    this.raf = requestAnimationFrame(this._loop);
  }

  start() {
    this.measure();
    if (this.reduced) return; // static frame already drawn in measure()
    if (!this.raf) this.raf = requestAnimationFrame(this._loop);
  }

  stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }
}
