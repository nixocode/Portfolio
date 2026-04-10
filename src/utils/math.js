// Math utilities shared across modules.
// Keep these pure & cheap — they run every frame.

export const lerp = (a, b, t) => a + (b - a) * t;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const map = (v, inMin, inMax, outMin, outMax) =>
  outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);

export const random = (min, max) => min + Math.random() * (max - min);

// Frame-rate-independent lerp. Use instead of raw lerp for
// time-based smoothing so feel is identical at 60/120/144hz.
export const damp = (current, target, smoothing, dt) =>
  lerp(current, target, 1 - Math.pow(smoothing, dt * 60));

// Detect touch / low-power devices so we can scale back effects.
export const isTouch = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(hover: none)').matches ||
    'ontouchstart' in window);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
