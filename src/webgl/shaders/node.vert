// Project node (neuron). Adds a gentle breathing scale + Fresnel-ready varyings.

uniform float uTime;
uniform float uPulse;   // 0..1 activation level (hover / scroll proximity)

varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vBreath;

void main() {
  // Subtle breathing: 2% base + up to 8% when activated.
  float breath = 1.0 + sin(uTime * 1.5) * 0.02 + uPulse * 0.08;
  vec3 pos = position * breath;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;

  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  vBreath  = breath;
}
