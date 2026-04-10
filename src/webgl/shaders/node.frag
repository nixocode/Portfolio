// Project node fragment: amber warm core + cold cyan Fresnel rim.
// The warm/cold duality is the whole concept — human thought inside a tech shell.

precision highp float;

uniform float uTime;
uniform float uPulse;
uniform vec3  uWarm;   // #ffc88a-ish (inner core)
uniform vec3  uCold;   // #5ce0ff-ish (outer rim)

varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vBreath;

void main() {
  // Fresnel: 0 at center, 1 at rim.
  float fres = 1.0 - max(dot(vNormalW, vViewDir), 0.0);
  fres = pow(fres, 2.2);

  // Warm core — visible where fresnel is weak (center).
  vec3 core = uWarm * (1.0 - fres) * (1.4 + uPulse * 0.8);

  // Cold rim — visible at edges.
  vec3 rim = uCold * fres * (1.6 + uPulse * 1.2);

  // Subtle synaptic flicker on the rim.
  float flicker = 0.9 + 0.1 * sin(uTime * 6.0 + vBreath * 20.0);

  vec3 col = core + rim * flicker;

  // Slight overall boost when node is activated.
  col *= 1.0 + uPulse * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
