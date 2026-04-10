// Fiber fragment: base glow + a pulse traveling from 0→1 along the line.

precision highp float;

uniform float uTime;
uniform vec3  uColor;
uniform float uActivity;   // 0..1, scroll-driven "brain activity"

varying float vT;
varying float vLine;
varying float vDepth;

void main() {
  // Base fiber brightness: dim baseline + pulse.
  float base = 0.08 + 0.07 * uActivity;

  // Traveling pulse: each line has its own phase so pulses don't sync.
  float speed = 0.4 + 0.3 * fract(vLine * 7.13);
  float phase = fract(uTime * speed + vLine);
  float pulse = smoothstep(0.08, 0.0, abs(vT - phase));

  // Secondary slower pulse going the other way for extra life.
  float phase2 = fract(-uTime * 0.25 + vLine * 1.7);
  float pulse2 = smoothstep(0.12, 0.0, abs(vT - phase2)) * 0.5;

  // Depth fade so far fibers don't clutter the frame.
  float depthFade = smoothstep(60.0, 4.0, vDepth);

  float intensity = (base + pulse + pulse2) * depthFade;
  gl_FragColor = vec4(uColor * intensity, intensity);
}
