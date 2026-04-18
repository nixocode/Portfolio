// Project node fragment: amber warm core + cold cyan Fresnel rim.
// The warm/cold duality is the whole concept — human thought inside a tech shell.

precision highp float;

uniform float uTime;
uniform float uPulse;
uniform vec3  uWarm;   // inner core (biome-tinted)
uniform vec3  uCold;   // outer rim  (biome-tinted)
// 0 at hero (monochrome grey) → 1 deep descent (full biome colour).
uniform float uSaturation;

varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vBreath;

void main() {
  // Fresnel: 0 at center, 1 at rim.
  float fres = 1.0 - max(dot(vNormalW, vViewDir), 0.0);
  fres = pow(fres, 2.2);

  // Desaturate toward neutral grey at the top of the page so the hero
  // reads monochrome; colour only emerges as the camera descends.
  vec3 grey = vec3(0.55);
  vec3 warm = mix(grey, uWarm, uSaturation);
  vec3 cold = mix(grey, uCold, uSaturation);

  // Warm core — visible where fresnel is weak (center).
  vec3 core = warm * (1.0 - fres) * (1.4 + uPulse * 0.8);

  // Cold rim — visible at edges.
  vec3 rim = cold * fres * (1.6 + uPulse * 1.2);

  // Subtle synaptic flicker on the rim.
  float flicker = 0.9 + 0.1 * sin(uTime * 6.0 + vBreath * 20.0);

  vec3 col = core + rim * flicker;

  // Slight overall boost when node is activated.
  col *= 1.0 + uPulse * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
