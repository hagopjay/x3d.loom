/* Gobbler demiurge on Babylon WebGPU: the four GLSL programs the Demiurge scene adds to Gobbler 3 Deep (the other six, sky, eye, facet, line, point and hide, are the ones in
   src/gobbler/ and hash-match). Term for term from the GLSL in data/bird/gobbler4-bird.x3d: Sun (granulated Sun in the chest), Glow (billboard halo), Air (single-scattering
   atmosphere shell) and Weave (the Armenian knot's thread, drawn by a vertex shader from a strip of x = 0..600).
   Differences from the GLSL, all logged in the demiurge run folder GAPS.md:
     - the normal matrix is the upper 3x3 of the model-view matrix (exact for the uniform scales the scene uses)
     - Weave's face normal comes from cross(dpdy, dpdx): WebGPU's window y runs down where GL's runs up, so the GL order cross(dFdx, dFdy) turns into this
     - Weave's pixel dither uses the fragment position (WebGPU origin top-left), the pattern is mirrored, its density is the same
     - Air writes ordinary depth: X_ITE's logarithmic depth output has no counterpart here (the page asks for it with a browser option; Babylon uses a reversed float depth buffer instead)
     - Weave's MFFloat uniforms X[32] and H[32] arrive as eight vec4f each (X0..X7, H0..H7), because uniform arrays are not part of the port format
   Concatenated after gobbler/wgsl-core.js in the bundle scope. */

gobRegister('sun', {
  key: '333ca04b-c4a4d041', kind: 'mesh', attrs: ['position', 'normal'], uniforms: { time: 'f32' },
  notes: 'normal matrix taken from the model-view matrix',
  vs: `
attribute position: vec3f;
attribute normal: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vN: vec3f;
varying vP: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let nm = mat3x3f(uniforms.worldView[0].xyz, uniforms.worldView[1].xyz, uniforms.worldView[2].xyz);
  vertexOutputs.vN = normalize(nm * vertexInputs.normal);
  vertexOutputs.vP = vertexInputs.position;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
}`,
  fs: `
uniform time: f32;
varying vN: vec3f;
varying vP: vec3f;
fn h1(p0: vec3f) -> f32 { var p = fract(p0 * 0.3183099 + 0.1); p = p * 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3f(1, 0, 0)), f.x), mix(h1(i + vec3f(0, 1, 0)), h1(i + vec3f(1, 1, 0)), f.x), f.y),
             mix(mix(h1(i + vec3f(0, 0, 1)), h1(i + vec3f(1, 0, 1)), f.x), mix(h1(i + vec3f(0, 1, 1)), h1(i + vec3f(1, 1, 1)), f.x), f.y), f.z);
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let mu = clamp(normalize(fragmentInputs.vN).z, 0.0, 1.0);
  let g = vnoise(fragmentInputs.vP * 26.0 + vec3f(0.0, uniforms.time * 0.10, 0.0)) * 0.6 + vnoise(fragmentInputs.vP * 64.0 - vec3f(uniforms.time * 0.17, 0.0, 0.0)) * 0.4;
  var c = mix(vec3f(1.0, 0.55, 0.12), vec3f(1.0, 0.97, 0.82), pow(mu, 0.5)) * (0.8 + 0.5 * g);
  c = c + vec3f(1.0, 0.45, 0.08) * pow(1.0 - mu, 3.0) * 0.6;
  fragmentOutputs.color = vec4f(c, 1.0);
}`,
});

gobRegister('glow', {
  key: '5752e7b2-febb26b2', kind: 'mesh', attrs: ['position', 'color'], uniforms: {},
  notes: 'none: the halo is a pure function of the quad coordinate',
  vs: `
attribute position: vec3f;
attribute color: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vUV: vec2f;
varying vCol: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vUV = vertexInputs.position.xy;
  vertexOutputs.vCol = vertexInputs.color.rgb;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
}`,
  fs: `
varying vUV: vec2f;
varying vCol: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let r = length(fragmentInputs.vUV);
  if (r >= 1.0) { discard; }
  let a = pow(1.0 - r, 2.6) * 0.85 + exp(-r * r * 22.0) * 0.5;
  fragmentOutputs.color = vec4f(fragmentInputs.vCol * (0.9 + 0.8 * exp(-r * r * 14.0)), clamp(a, 0.0, 1.0));
}`,
});

gobRegister('air', {
  key: '2cb8e4a1-598ae28b', kind: 'mesh', attrs: ['position'], uniforms: { sunDir: 'vec3f' },
  notes: 'ordinary depth in place of the logarithmic output; front-facing taken from the pipeline',
  vs: `
attribute position: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vP: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let p = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vP = p.xyz;
  vertexOutputs.position = uniforms.projection * p;
}`,
  fs: `
uniform worldView: mat4x4f;
uniform sunDir: vec3f;
varying vP: vec3f;
const TOP: f32 = 1.07;
const MARGIN: f32 = 1.02;
const K: f32 = 4.5;
const DECAY: f32 = 6.0;
const GAIN: f32 = 1.0;
const MIE: f32 = 0.05;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let d = normalize(fragmentInputs.vP);
  let rs = length(uniforms.worldView[0].xyz) / MARGIN;
  let rp = rs / TOP;
  let C = uniforms.worldView[3].xyz;
  let nm = mat3x3f(uniforms.worldView[0].xyz, uniforms.worldView[1].xyz, uniforms.worldView[2].xyz);
  let S = normalize(nm * uniforms.sunDir);
  let cc = dot(C, C);
  let b = dot(d, C);
  let inside = cc < rs * rs;
  if (fragmentInputs.frontFacing == inside) { discard; }
  let disc = b * b - (cc - rs * rs);
  if (disc <= 0.0) { discard; }
  let sq = sqrt(disc);
  let t0 = max(b - sq, 0.0);
  var t1 = b + sq;
  let dp = b * b - (cc - rp * rp);
  if (dp > 0.0) { let tp = b - sqrt(dp); if (tp > 0.0) { t1 = min(t1, tp); } }
  if (t1 <= t0) { discard; }
  let dt = (t1 - t0) / 10.0;
  let cs = dot(d, S);
  let phase = 0.45 * (1.0 + cs * cs) + MIE * 0.64 / pow(1.36 - 1.2 * cs, 1.5);
  var acc = vec3f(0.0);
  var od = 0.0;
  for (var i = 0; i < 10; i = i + 1) {
    let p = d * (t0 + (f32(i) + 0.5) * dt) - C;
    let r = length(p);
    let rho = exp(-DECAY * clamp((r - rp) / (rs - rp), 0.0, 1.0));
    let up = dot(p / r, S);
    let src = mix(vec3f(1.0, 0.40, 0.12), vec3f(0.40, 0.66, 1.0), smoothstep(-0.05, 0.55, up));
    let w = rho * dt / rp;
    acc = acc + src * (smoothstep(-0.18, 0.22, up) * w * phase);
    od = od + w;
  }
  let alpha = 1.0 - exp(-K * od);
  fragmentOutputs.color = vec4f(min(acc * (K * GAIN) / max(alpha, 0.02), vec3f(1.5)), alpha);
}`,
});

const _wvU = {}; for (let i = 0; i < 8; i++) { _wvU['X' + i] = 'vec4f'; _wvU['H' + i] = 'vec4f'; }
gobRegister('weave', {
  key: '7420b4e5-0617b5ce', kind: 'mesh', attrs: ['position'], uniforms: { w: 'vec3f', P: 'vec4f', Q: 'vec4f', S: 'vec3f', col: 'vec3f', ..._wvU },
  notes: 'X[32] and H[32] as eight vec4f each; face normal from cross(dpdy, dpdx); dither pattern mirrored',
  vs: `
attribute position: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform w: vec3f;
uniform P: vec4f;
uniform Q: vec4f;
uniform S: vec3f;
${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `uniform X${i}: vec4f;\nuniform H${i}: vec4f;`).join('\n')}
varying vu: f32;
varying vs: f32;
varying vl: f32;
varying vP: vec3f;
fn Xs(j: i32) -> f32 { let k = j / 4; let c = j % 4; var v = vec4f(0.0);
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `if (k == ${i}) { v = uniforms.X${i}; }`).join(' ')}
  return v[c]; }
fn Hs(j: i32) -> f32 { let k = j / 4; let c = j % 4; var v = vec4f(0.0);
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `if (k == ${i}) { v = uniforms.H${i}; }`).join(' ')}
  return v[c]; }
fn crv(t: f32) -> vec2f {
  let th = 6.2831853 * t;
  let r = uniforms.P.x + uniforms.P.y * cos(uniforms.Q.x * th);
  let ph = th + uniforms.P.z * sin(uniforms.Q.x * th) + uniforms.P.w * (r - uniforms.P.x) / uniforms.P.y + uniforms.Q.y * 6.2831853 / (4.0 * uniforms.Q.x);
  return r * vec2f(cos(ph), sin(ph));
}
fn tp(u: f32) -> f32 { return u - uniforms.S.z * sin(6.2831853 * uniforms.Q.x * u) / (6.2831853 * uniforms.Q.x); }
fn lift(t: f32) -> f32 {
  let n = i32(uniforms.S.x);
  var t0 = Xs(n - 1) - 1.0;
  var h0 = Hs(n - 1);
  var t1 = Xs(0);
  var h1 = Hs(0);
  var s = uniforms.S.y * select(1.0, -1.0, n % 2 == 0);
  for (var j = 0; j < 32; j = j + 1) {
    if (j >= n || Xs(j) > t) { break; }
    t0 = Xs(j); h0 = Hs(j);
    t1 = select(Xs(0) + 1.0, Xs(j + 1), j + 1 < n);
    h1 = select(Hs(0), Hs(j + 1), j + 1 < n);
    s = uniforms.S.y * select(-1.0, 1.0, j % 2 == 0);
  }
  return s * (1.0 - 2.0 * smoothstep(t0 + h0, t1 - h1, t));
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let u = vertexInputs.position.x / 600.0;
  let t = tp(u);
  vertexOutputs.vu = u;
  vertexOutputs.vs = vertexInputs.position.y;
  let vl = lift(t) * uniforms.Q.z;
  vertexOutputs.vl = vl;
  let c = crv(t);
  let d = normalize(crv(t + 0.0004) - crv(t - 0.0004));
  var p = uniforms.worldView * vec4f(c + vec2f(-d.y, d.x) * 0.06 * vertexInputs.position.y, 0.0, 1.0);
  vertexOutputs.vP = p.xyz;
  p = vec4f(p.xyz + normalize(-p.xyz) * vl * 0.05, p.w);
  var clip = vec4f(2.0, 2.0, 2.0, 1.0);
  if (abs(uniforms.w.x - uniforms.Q.w) < 0.5) { clip = uniforms.projection * p; }
  vertexOutputs.position = clip;
}`,
  fs: `
uniform w: vec3f;
uniform col: vec3f;
varying vu: f32;
varying vs: f32;
varying vl: f32;
varying vP: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let n = normalize(cross(dpdy(fragmentInputs.vP), dpdx(fragmentInputs.vP)));   // derivatives first: they need uniform control flow
  if (fragmentInputs.vu > uniforms.w.y) { discard; }
  let fc = floor(fragmentInputs.position.xy);
  if (fract(sin(dot(fc, vec2f(12.9898, 78.233))) * 43758.5453) > uniforms.w.z) { discard; }
  var k = 0.62 + 0.5 * max(0.0, dot(n, normalize(vec3f(-0.4, 0.7, 0.6))));
  k = k * select(0.74, 1.08, fragmentInputs.vs < 0.0);
  k = k * (0.82 + 0.22 * fragmentInputs.vl);
  var c = mix(uniforms.col * k, vec3f(0.06, 0.03, 0.01), smoothstep(0.62, 0.92, abs(fragmentInputs.vs)));
  let hot = exp(-(uniforms.w.y - fragmentInputs.vu) * 55.0) * step(uniforms.w.y, 0.9999);
  c = mix(c, vec3f(1.0, 0.86, 0.62) * 1.25, 0.85 * hot);
  fragmentOutputs.color = vec4f(min(c, vec3f(1.0)), 1.0);
}`,
});
