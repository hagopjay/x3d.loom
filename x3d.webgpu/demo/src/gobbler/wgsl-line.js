/* LineShader: the network ribbons (and the flywheel loops) as IndexedFaceSet quads. Term-for-term from the GLSL in gobbler3.x3d.
   Each ribbon quad is two triangles with four vertices: x3d_Vertex is one endpoint 'a' of the edge, x3d_TexCoord0.xyz the other endpoint 'b',
   x3d_Normal.xy a corner code through atan (code = (round(atan2(n.y, n.x) / (pi/8)) + 16) % 16: bit 0 = side, bit 1 = end, bit 2 / 3 = a / b not scattered), x3d_Color RGBA. */
gobRegister('line', {
  key: '623a753e-ff5d9002', kind: 'mesh', attrs: ['position', 'normal', 'tc0', 'color'],
  uniforms: { phase: 'f32', time: 'f32', scan: 'f32', bloom: 'f32', glow: 'f32', light0: 'vec3f', light1: 'vec3f', light2: 'vec3f', light3: 'vec3f' },
  notes: 'clip z bias: GLSL z -= 0.002 w on a [-1,1] depth range is 0.001 w on WebGPU [0,1]. '
       + 'x3d_Viewport.zw / .w are viewport.zw / viewport.w (f32); atan -> atan2; the corner code is an i32 (the % 16 operand is always >= 8, never negative); '
       + 'pcg3 uses vec3u, shifts need a vec3u right-hand side. '
       + 'smoothstep(0.09, 0.02, e) has edge0 > edge1: smoothstepR is the same Hermite formula with the edges as arguments. '
       + 'pow(x, 2.0) with a negative x (vHot, vScan) is undefined in WGSL (exp2(log2(x) * y) is NaN on most backends): written as the square x * x, which is what the GLSL means. '
       + 'the cull position (2,2,2,1) is outside the WebGPU clip volume as well. ca.xy += ... is written per component.',
  vs: `
attribute position: vec3f;
attribute normal: vec3f;
attribute tc0: vec3f;
attribute color: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform viewport: vec4f;
uniform phase: f32;
uniform time: f32;
uniform scan: f32;
uniform bloom: f32;
uniform light0: vec3f;
uniform light1: vec3f;
uniform light2: vec3f;
uniform light3: vec3f;
varying vColor: vec4f;
varying vX: f32;
varying vS: f32;
varying vPulse: f32;
varying vSeed: f32;
varying vFade: f32;
varying vScan: f32;
varying vBloom: f32;
varying vHeat: f32;
varying vHot: f32;
varying vPool: vec3f;
varying vLoop: f32;
varying vPh: f32;
varying vDel: f32;
fn pcg3(v0: vec3u) -> vec3u {
  var v = v0 * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
fn rnd3i(q: vec3i) -> vec3f { return vec3f(pcg3(vec3u(q + vec3i(4096)))) * (1.0 / 4294967296.0); }
fn qpos(p: vec3f) -> vec3i { return vec3i(floor(p * 100.0 + 0.5)); }
fn smoothstepR(e0: f32, e1: f32, x: f32) -> f32 { let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn scatter(p: vec3f) -> vec4f {
  let q = qpos(p);
  let r = rnd3i(q);
  let g = (rnd3i(q + vec3i(37, 71, 13)) - 0.5) * 3.4;
  let u = clamp((p.x - (-2.75)) / (4.79 - (-2.75)), 0.0, 1.0);
  let jit = (r.x - 0.5) * 0.04;
  let l0 = 0.14 + 0.16 * (1.0 - u) + jit;
  let l1 = l0 + 0.2;
  let b0 = 0.6 + 0.12 * u + jit;
  let b1 = min(0.95, b0 + 0.2);
  if (uniforms.phase <= l0 || uniforms.phase >= b1) { return vec4f(p, 0.0); }
  var e: f32;
  var hold: f32;
  if (uniforms.phase < l1) { e = smoothstep(l0, l1, uniforms.phase); hold = 0.0; }
  else if (uniforms.phase <= b0) { e = 1.0; hold = (uniforms.phase - l1) / max(1e-4, b0 - l1); }
  else { e = 1.0 - smoothstep(b0, b1, uniforms.phase); hold = 1.0; }
  let s = select(0.0, sin(3.14159265 * e), e < 1.0);
  const c: f32 = 0.97030;
  const sn: f32 = -0.24188;
  let d = vec2f((p.x - 0.45) * 1.6, (p.y + 0.75) * 1.5);
  let tgt = vec3f(2.5 + d.x * c - d.y * sn + g.x * 0.36, -0.9 + d.x * sn + d.y * c + g.y * 0.36, 1.2 * p.z + g.z * 0.9);
  let curl = vec3f(0.0, 0.6 * sin(2.1 * p.x + 0.5), 0.6 * cos(1.7 * p.y));
  let drift = vec3f(0.3 + 0.1 * sin(3.0 * p.y), 0.12 * sin(2.0 * p.x), 0.15 * cos(2.0 * p.y));
  let live = 0.07 * e * vec3f(sin(uniforms.time * 0.9 + r.y * 6.283), cos(uniforms.time * 0.7 + r.z * 6.283), sin(uniforms.time * 0.5 + r.x * 6.283));
  return vec4f(p + (tgt - p) * e + curl * s + drift * hold * e + live, e);
}
fn h1(p0: vec3f) -> f32 { var p = fract(p0 * 0.3183099 + 0.1); p = p * 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3f(1, 0, 0)), f.x), mix(h1(i + vec3f(0, 1, 0)), h1(i + vec3f(1, 1, 0)), f.x), f.y),
             mix(mix(h1(i + vec3f(0, 0, 1)), h1(i + vec3f(1, 0, 1)), f.x), mix(h1(i + vec3f(0, 1, 1)), h1(i + vec3f(1, 1, 1)), f.x), f.y), f.z);
}
fn burnD() -> f32 { return select(1.0 - clamp((uniforms.phase - 0.77) / 0.2, 0.0, 1.0), clamp((uniforms.phase - 0.07) / 0.2, 0.0, 1.0), uniforms.phase < 0.6); }
fn burnEdge(p: vec3f, d: f32) -> f32 {
  let u = clamp((p.x - (-2.75)) / (4.79 - (-2.75)), 0.0, 1.0);
  let n = vnoise(p * 1.1 + 1.7) * 0.32 + vnoise(p * 3.0 + vec3f(3.1, 3.1 - uniforms.time * 0.6, 3.1)) * 0.1;
  return select(u, 1.0 - u, uniforms.phase < 0.6) * 0.75 + n - d * 1.55 + 0.1;
}
fn poolAt(p: vec3f) -> vec3f {
  let d0 = p - uniforms.light0;
  let d1 = p - uniforms.light1;
  let d2 = p - uniforms.light2;
  let d3 = p - uniforms.light3;
  return (vec3f(1.0, 0.8, 0.42) * exp(-dot(d0, d0) * 0.05) + vec3f(1.0, 0.36, 0.09) * exp(-dot(d1, d1) * 0.05) + vec3f(0.12, 0.78, 1.0) * exp(-dot(d2, d2) * 0.05) + vec3f(0.66, 0.28, 1.0) * exp(-dot(d3, d3) * 0.05)) * 0.9;
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let x3d_Normal = vertexInputs.normal;
  let x3d_Color = vertexInputs.color;
  let code = (i32(floor(atan2(x3d_Normal.y, x3d_Normal.x) / 0.39269908 + 0.5)) + 16) % 16;
  let side = select(-1.0, 1.0, (code & 1) == 1);
  let a = vertexInputs.position;
  let b = vertexInputs.tc0;
  let sa = select(scatter(a), vec4f(a, 0.0), (code & 4) != 0);
  let sb = select(scatter(b), vec4f(b, 0.0), (code & 8) != 0);
  let PM = uniforms.projection * uniforms.worldView;
  var ca = PM * vec4f(sa.xyz, 1.0);
  let cb = PM * vec4f(sb.xyz, 1.0);
  let vp = uniforms.viewport.zw;
  var dir = cb.xy / cb.w * vp - ca.xy / ca.w * vp;
  let len = length(dir);
  dir = select(vec2f(1.0, 0.0), dir / len, len > 1e-5);
  let bl = uniforms.bloom * select(0.45, 1.0, (code & 12) != 0);           // less bloom on the head's dense lattice
  // v3: a colour alpha of 0.7 or more marks a flywheel ribbon: alpha = 0.7 + 0.3 * (phase_q + 100 * span_q) / 400, where phase_q (0 to 99)
  // is where this edge starts round its loop (hundredths) and span_q (0 to 3) is how much of the loop it covers (0.06 + 0.04 * span_q).
  let cal = x3d_Color.a;
  let vLoop = step(0.699, cal);
  let idx = select(0.0, floor((cal - 0.7) / 0.3 * 400.0 + 0.5), vLoop > 0.5);
  let dq = floor(idx / 100.0);
  let vPh = (idx - 100.0 * dq) / 100.0;
  let vDel = 0.06 + 0.04 * dq;
  let aw = select(cal, 0.3, vLoop > 0.5);
  let w = (0.6 + 2.8 * aw) * (1.0 + 1.6 * bl) * vp.y / 640.0;   // half width in pixels, scaled with the canvas
  let off = vec2f(-dir.y, dir.x) * side * w * 2.0 / vp * ca.w;
  ca.x = ca.x + off.x;
  ca.y = ca.y + off.y;
  ca.z = ca.z - 0.001 * ca.w;                                   // sit just in front of the facets
  vertexOutputs.position = ca;
  vertexOutputs.vLoop = vLoop;
  vertexOutputs.vPh = vPh;
  vertexOutputs.vDel = vDel;
  vertexOutputs.vBloom = bl;
  vertexOutputs.vX = select(side, -side, (code & 2) != 0);       // across the ribbon, the same sign at both ends
  vertexOutputs.vColor = x3d_Color;
  vertexOutputs.vS = select(select(1.0, 0.0, a.x >= b.x), select(0.0, 1.0, (code & 2) != 0), vLoop > 0.5);   // pulses run from the far end toward the head; round a wheel, from edge start to end
  vertexOutputs.vPool = poolAt((a + b) * 0.5);
  vertexOutputs.vPulse = select(0.0, 1.0, (code & 12) != 0);
  let vSeed = rnd3i(qpos(a) + qpos(b)).x;
  vertexOutputs.vSeed = vSeed;
  var vFade = 1.0 - 0.55 * max(sa.w, sb.w);
  // The lattice burns on the facets' fire: an edge glows ember as the front crosses its middle, holds a moment
  // (its own random delay), then goes out. Only the head's points stay, a constellation. Network edges never burn.
  var vHeat = 0.0;
  var vHot = 0.0;
  let d = burnD();
  if (d > 0.0 && (code & 12) != 12) {
    let e = burnEdge((a + b) * 0.5, d);
    let delay = 0.03 + 0.2 * vSeed;
    vHeat = smoothstepR(0.09, 0.02, e) * smoothstep(-delay - 0.06, -delay * 0.4, e);
    let eh = e / 0.035;
    vHot = exp(-(eh * eh));                                      // white-hot as the cut crosses the edge
    vFade = vFade * smoothstep(-delay - 0.06, -delay, e);
  }
  vertexOutputs.vHeat = vHeat;
  vertexOutputs.vHot = vHot;
  vertexOutputs.vFade = vFade;
  if (vFade < 0.001) { vertexOutputs.position = vec4f(2.0, 2.0, 2.0, 1.0); }    // a burnt-out edge costs no fill
  let sc = ((a.x + b.x) * 0.425 + (a.y + b.y) * 0.15 - uniforms.scan) * 2.4;
  vertexOutputs.vScan = select(exp(-(sc * sc)), 0.0, (code & 12) != 0);
}`,
  fs: `
uniform time: f32;
uniform glow: f32;
varying vBloom: f32;
varying vColor: vec4f;
varying vX: f32;
varying vS: f32;
varying vPulse: f32;
varying vSeed: f32;
varying vFade: f32;
varying vScan: f32;
varying vHeat: f32;
varying vHot: f32;
varying vPool: vec3f;
varying vLoop: f32;
varying vPh: f32;
varying vDel: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vBloom = fragmentInputs.vBloom;
  let vColor = fragmentInputs.vColor;
  let vX = fragmentInputs.vX;
  let vS = fragmentInputs.vS;
  let vPulse = fragmentInputs.vPulse;
  let vSeed = fragmentInputs.vSeed;
  let vFade = fragmentInputs.vFade;
  let vScan = fragmentInputs.vScan;
  let vHeat = fragmentInputs.vHeat;
  let vHot = fragmentInputs.vHot;
  let vPool = fragmentInputs.vPool;
  let vLoop = fragmentInputs.vLoop;
  let vPh = fragmentInputs.vPh;
  let vDel = fragmentInputs.vDel;
  if (vFade < 0.003) { discard; }
  let b = 1.0 + 1.6 * vBloom;                                   // bloom widens the ribbon, the core keeps its width
  let core = exp(-vX * vX * 9.0 * b * b);
  let halo = (exp(-vX * vX * 2.2 * b) * (0.3 - 0.12 * vBloom) + exp(-vX * vX * 3.0) * 0.1 * vBloom) * 1.0;
  var pk = 0.0;
  if (vPulse > 0.5) {
    let t = fract(uniforms.time * (0.09 + 0.13 * vSeed) + vSeed * 17.0) * 1.8 - 0.4;
    let dd = vS - t;
    pk = exp(-dd * dd * 60.0) * uniforms.glow;
  }
  var lk = 0.0;
  if (vLoop > 0.5) {                                            // a wheel: two comets circle it, each trailing behind its head
    let u = fract(uniforms.time / 14.0);
    let pos = vPh + vS * vDel;
    let d1 = fract(u - pos);
    let d2 = fract(u + 0.5 - pos);
    lk = (exp(-d1 * 11.0) + exp(-d2 * 11.0)) * uniforms.glow;
    pk = max(pk * 0.2, (exp(-d1 * 70.0) + exp(-d2 * 70.0)) * uniforms.glow);
  }
  let hc = pow(vColor.rgb, vec3f(1.0 + 0.0 * vBloom)) * (1.0 + 0.6 * vBloom);   // bloom: a deeper gold halo round a pale core
  let pulseC = select(vec3f(1.0, 0.85, 0.55), mix(vColor.rgb, vec3f(1.0, 0.96, 0.86), 0.5), vLoop > 0.5);
  var em = vColor.rgb * core * 1.1 * (1.0 + 0.7 * vLoop + 1.6 * lk) + hc * halo * (1.0 + 1.2 * lk) + pulseC * pk * (core * 1.7 + halo * 2.2)
         + vec3f(1.0, 0.74, 0.38) * vScan * (core + halo) * 1.3 * uniforms.glow
         + vPool * (core * 0.9 + halo * 1.1) * 0.8;             // v3: the moving lights tint the ribbons they pass
  em = mix(em, vec3f(1.0, 0.45, 0.12) * (core * 1.6 + halo * 2.2) + vec3f(1.0, 0.9, 0.7) * core * 0.4, vHeat);
  em = em + vec3f(1.0, 0.9, 0.74) * core * vHot * 0.9;
  em = em * (vFade * select(1.0, 1.0, vPulse > 0.5));          // 1.0: the head's dense lattice, dimmer when additive
  let a = clamp(max(max(em.r, em.g), em.b), 0.0, 1.0);
  if (a < 0.004) { discard; }
  fragmentOutputs.color = vec4f(min(em / max(a, 1e-3), vec3f(1.0)), a);
}`,
});
