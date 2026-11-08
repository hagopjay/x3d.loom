/* PointShader: the stars, hubs, motes and the scatter that gathers the cloud into the eye. Term-for-term from the GLSL in gobbler3.x3d.
   Points are drawn as one quad per point (WebGPU has no point sprites): 'corner' in {(-1,-1),(1,-1),(1,1),(-1,1)} expands the clip position by the
   GLSL gl_PointSize s, and the fragment shader rebuilds gl_PointCoord from the corner. */
gobRegister('point', {
  key: '8da5fec9-17c8a8f8', kind: 'points', attrs: ['position', 'color', 'corner'],
  uniforms: { phase: 'f32', time: 'f32', glow: 'f32', bloom: 'f32', light0: 'vec3f', light1: 'vec3f', light2: 'vec3f', light3: 'vec3f' },
  notes: 'clip z bias: GLSL z -= 0.003 w on a [-1,1] depth range is 0.0015 w on WebGPU [0,1]. '
       + 'gl_PointSize s (px, full sprite width): cp.xy += corner * (s / viewport.zw) * cp.w. A hidden point (size <= 0.01, clip (2,2,2,1)) keeps all four corners outside the clip volume (z > w). '
       + 'gl_PointCoord = vec2(corner.x, -corner.y) * 0.5 + 0.5 (y down), from the vCorner varying. '
       + 'x3d_Viewport.w is viewport.w (f32); pcg3 uses vec3u, shifts need a vec3u right-hand side',
  vs: `
attribute position: vec3f;
attribute color: vec4f;
attribute corner: vec2f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform viewport: vec4f;
uniform phase: f32;
uniform time: f32;
uniform glow: f32;
uniform bloom: f32;
uniform light0: vec3f;
uniform light1: vec3f;
uniform light2: vec3f;
uniform light3: vec3f;
varying vColor: vec4f;
varying vB: f32;
varying vBloom: f32;
varying vSpike: f32;
varying vCorner: vec2f;
fn pcg3(v0: vec3u) -> vec3u {
  var v = v0 * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
fn rnd3i(q: vec3i) -> vec3f { return vec3f(pcg3(vec3u(q + vec3i(4096)))) * (1.0 / 4294967296.0); }
fn qpos(p: vec3f) -> vec3i { return vec3i(floor(p * 100.0 + 0.5)); }
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
fn poolAt(p: vec3f) -> vec3f {
  let d0 = p - uniforms.light0;
  let d1 = p - uniforms.light1;
  let d2 = p - uniforms.light2;
  let d3 = p - uniforms.light3;
  return (vec3f(1.0, 0.8, 0.42) * exp(-dot(d0, d0) * 0.05) + vec3f(1.0, 0.36, 0.09) * exp(-dot(d1, d1) * 0.05) + vec3f(0.12, 0.78, 1.0) * exp(-dot(d2, d2) * 0.05) + vec3f(0.66, 0.28, 1.0) * exp(-dot(d3, d3) * 0.05)) * 0.9;
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  var p = vertexInputs.position;
  let x3d_Color = vertexInputs.color;
  let r = rnd3i(qpos(p) + vec3i(11, 5, 3));
  let kind = floor(x3d_Color.a * 4.0 + 0.001);
  var size = (x3d_Color.a - kind * 0.25) * 16.0;
  var e = 0.0;
  if (kind < 0.5) { let sc = scatter(p); p = sc.xyz; e = sc.w; }
  else if (kind < 2.5 && kind > 1.5) {
    p += vec3f(sin(uniforms.time * (0.05 + 0.06 * r.x) + r.y * 6.283) * 0.7, sin(uniforms.time * (0.04 + 0.05 * r.y) + r.z * 6.283) * 0.5,
               sin(uniforms.time * (0.03 + 0.04 * r.z) + r.x * 6.283) * 0.6);
  }
  let mv = uniforms.worldView * vec4f(p, 1.0);
  let k = uniforms.viewport.w / 640.0;
  let dist = max(0.2, -mv.z);
  if (kind > 2.5) { size *= 1.0 - 0.45 * uniforms.bloom; }                  // motes: bloom draws them wider, so it draws them smaller
  let px = size * length(uniforms.worldView[0].xyz) * 0.16 * uniforms.projection[1][1] * uniforms.viewport.w * 0.5 / dist;
  var tw = 0.62 + 0.38 * sin(uniforms.time * (0.7 + 1.9 * r.y) + r.x * 6.283);
  if (kind < 0.5) { tw = 0.88 + 0.12 * tw; }
  let coc = abs(dist - 14.0) * select(0.25, 0.9, kind > 0.5) * k;
  let s = clamp(px * (0.85 + 0.3 * tw) * (1.0 + 0.9 * uniforms.bloom) + coc, 1.0, 110.0 * k);
  // gl_PointSize = s: applied to the clip position below
  var vB = tw * (1.0 + 0.9 * e) * clamp(px * (1.0 + 0.9 * uniforms.bloom) / s, 0.2, 1.0) * mix(1.0, uniforms.glow, 0.5);
  vertexOutputs.vBloom = uniforms.bloom;
  vertexOutputs.vSpike = select(0.0, 1.0, size > 2.75 && kind > 0.5 && kind < 1.5);   // only the few brightest hubs
  let pool = select(vec3f(0.0), poolAt(p), kind > 0.5 && kind < 2.5);
  vertexOutputs.vColor = vec4f(clamp(x3d_Color.rgb + pool * 0.8, vec3f(0.0), vec3f(1.0)), 1.0);
  vB *= 1.0 + 0.9 * min(1.0, length(pool));
  vertexOutputs.vB = vB;
  var cp = select(uniforms.projection * mv, vec4f(2.0, 2.0, 2.0, 1.0), size <= 0.01);
  cp.z = cp.z - 0.0015 * cp.w;
  cp.x = cp.x + vertexInputs.corner.x * (s / uniforms.viewport.z) * cp.w;
  cp.y = cp.y + vertexInputs.corner.y * (s / uniforms.viewport.w) * cp.w;
  vertexOutputs.vCorner = vertexInputs.corner;
  vertexOutputs.position = cp;
}`,
  fs: `
varying vColor: vec4f;
varying vB: f32;
varying vBloom: f32;
varying vSpike: f32;
varying vCorner: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vColor = fragmentInputs.vColor;
  let vB = fragmentInputs.vB;
  let vBloom = fragmentInputs.vBloom;
  let vSpike = fragmentInputs.vSpike;
  let gl_PointCoord = vec2f(fragmentInputs.vCorner.x, -fragmentInputs.vCorner.y) * 0.5 + 0.5;
  let d = gl_PointCoord * 2.0 - 1.0;
  let r2 = dot(d, d);
  if (r2 > 1.0) { discard; }
  let bb = 1.0 + 0.9 * vBloom;
  let core = exp(-r2 * 16.0 * bb * bb);
  let halo = (exp(-r2 * 3.5 * bb) * (0.62 - 0.2 * vBloom) * (1.0 - r2) + exp(-r2 * 2.5) * 0.16 * vBloom * (1.0 - r2)) * 1.0;
  let sp = vSpike * (exp(-abs(d.x) * 28.0) + exp(-abs(d.y) * 28.0)) * max(0.0, 1.0 - sqrt(r2) / 0.7) * 0.7;
  let hc = pow(vColor.rgb, vec3f(1.0 + 0.0 * vBloom)) * (1.0 + 0.6 * vBloom);   // bloom: a deeper halo round a pale core
  let em = (hc * (halo + sp) + mix(vColor.rgb, vec3f(1.0), 0.6) * core * 1.3) * vB;
  let a = clamp(max(max(em.r, em.g), em.b), 0.0, 1.0);
  if (a < 0.004) { discard; }
  fragmentOutputs.color = vec4f(min(em / max(a, 1e-3), vec3f(1.0)), a);
}`,
});
