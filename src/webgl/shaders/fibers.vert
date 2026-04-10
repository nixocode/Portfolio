// Neural fibers (synaptic connections).
// Each line segment has a uv.x in [0,1] along its length so the fragment
// shader can draw a traveling pulse down the wire.

uniform float uTime;
uniform vec2  uMouse;

attribute float aLineIndex;   // per-line random offset (0-1)
attribute float aT;           // position along line (0 at start, 1 at end)

varying float vT;
varying float vLine;
varying float vDepth;

void main() {
  vec3 pos = position;

  // Very subtle sway so fibers feel alive, not rigid.
  pos.xy += uMouse * 0.1;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vT     = aT;
  vLine  = aLineIndex;
  vDepth = -mvPosition.z;
}
