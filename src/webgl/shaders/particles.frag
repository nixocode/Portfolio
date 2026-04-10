// Soft-glow point sprite. No texture needed — procedural radial falloff.

precision highp float;

uniform vec3 uColor;
varying float vAlpha;
varying float vSeed;

void main() {
  // Distance from sprite center (gl_PointCoord is 0-1).
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  // Discard outside the sprite circle.
  if (d > 0.5) discard;

  // Soft inner core + slow falloff = neural glow.
  float core  = smoothstep(0.5, 0.0, d);
  float halo  = smoothstep(0.5, 0.15, d) * 0.6;
  float alpha = (core + halo) * vAlpha;

  // Slight hue shift per-particle so the field doesn't look uniform.
  vec3 col = uColor + vec3(0.05, 0.08, 0.12) * (vSeed - 0.5);

  gl_FragColor = vec4(col, alpha);
}
