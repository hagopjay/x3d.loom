/* Dynasty Loom (hypersphere view) on Babylon WebGPU: WGSL ports of the six GLSL programs of the family scenes, term for term from dynasty-loom/hyper/src and release/v5.
     SkyShader   the backdrop on an inverted proxy sphere        RingShader  the pewter armillary (the seed disc and the ring tubes)
     SeedCore    the founders' seed, a small sun                 SeedGlow / BeadGlow  the seed's and the bead's glow, an analytic ray through a proxy sphere
     FiberCore / FiberGlow  the life threads and marriage arcs, camera-facing ribbons (vertex shader), two passes
     ShellShader the glass hypersphere and the 50-year time shells, an analytic ray through a proxy sphere (with the hyperbolic lens)
   Ports are keyed by the ComposedShader's DEF, not by a hash of the source: the two looks (Museum Atlas, Documentary Night) differ only in a block of `const` look constants at the
   head of every fragment shader ("THEME ... the code below them is shared by every theme"), so one WGSL body serves both and the constants are read out of the scene's own GLSL
   when the material is made (dlThemeConsts). The uniforms are the ComposedShader's own fields; the uLine[32] array arrives as eight vec4f, uLine0..uLine7.
   Differences from the GLSL, all logged in the run folder GAPS.md:
     - gl_FragDepth is written as the plain projected depth (the logarithmic depth of X_ITE has no counterpart; Babylon runs a reversed float depth buffer instead)
     - WebGPU window y runs down: the pixel dither/grain patterns are mirrored, same density
     - smoothstep is written out (sstep): the GLSL calls it with edge0 > edge1 in many places, which WGSL leaves undefined
   Concatenated after gobbler/wgsl-core.js in the bundle scope. */

const DL_ATTRS = { sky: ['position'], ring: ['position', 'normal'], seedcore: ['position', 'normal'], seedglow: ['position'], shell: ['position'], fiber: ['position', 'color', 'aTan', 'aInfo', 'aAux'] };
const DL_BY_DEF = { SkyShader: 'sky', RingShader: 'ring', SeedCore: 'seedcore', SeedGlow: 'seedglow', BeadGlow: 'seedglow', FiberCore: 'fiber', FiberGlow: 'fiber', ShellShader: 'shell' };

/* the look constants of one fragment shader: `const float S_X = 1.0;` and `const vec3 S_X = vec3(...)` lines, as WGSL consts */
function dlThemeConsts(glsl) {
  const out = [];
  for (const m of glsl.matchAll(/^const (float|vec3)\s+(S_[A-Z0-9_]+)\s*=\s*(.+?);/gm)) {
    const ty = m[1] === 'float' ? 'f32' : 'vec3f';
    const val = m[3].replace(/\bvec3\(/g, 'vec3f(');
    out.push(`const ${m[2]}: ${ty} = ${val};`);
  }
  return out.join('\n');
}

/* shared functions: common.glsl, over(), grainAt() and the hyperbolic lens, ported once */
const DL_COMMON = `
fn sqr(x: f32) -> f32 { return x * x; }
fn sstep(e0: f32, e1: f32, x: f32) -> f32 { let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn over(acc: ptr<function, vec4f>, c: vec3f, a0: f32) { let a = clamp(a0, 0.0, 1.0); (*acc) = vec4f(c * a + (*acc).rgb * (1.0 - a), a + (*acc).a * (1.0 - a)); }
fn grainAt(fc: vec2f, t: f32) -> f32 { return (fract(sin(dot(fc + floor(t * 24.0) * 7.31, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5) * 2.0 * S_GRAIN; }
fn h13(p0: vec3f) -> f32 { var p = fract(p0 * 0.1031); p = p + dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(h13(i + vec3f(0.0, 1.0, 0.0)), h13(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h13(i + vec3f(0.0, 0.0, 1.0)), h13(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(h13(i + vec3f(0.0, 1.0, 1.0)), h13(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
fn fbm(p0: vec3f, oct: i32) -> f32 {
  var a = 0.5; var s = 0.0; var n = 0.0; var p = p0;
  for (var i = 0; i < 7; i = i + 1) { if (i >= oct) { break; } s = s + a * vnoise(p); n = n + a; p = p * 2.03 + vec3f(1.7, 9.2, 3.1); a = a * 0.5; }
  return s / max(n, 1e-4);
}
fn aces1(x: f32) -> f32 { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
fn aces(c: vec3f) -> vec3f { return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
fn encode(lin: vec3f, exposure: f32) -> vec3f { return pow(aces(lin * exposure), vec3f(0.4545)); }
fn knee(E: vec3f, k: f32) -> vec3f { return E * E / (E + vec3f(k + 1e-9)); }
fn dither(fc: vec2f, t: f32) -> f32 { return (h13(vec3f(fc, floor(t * 60.0))) - 0.5) / 255.0; }
fn glowOut(e: vec3f, blend: f32) -> vec4f {
  let a = max(max(e.r, e.g), e.b);
  if (a < 0.002) { discard; }
  if (S_INK > 0.5) { return vec4f(mix(S_ENGRAVE, e / a * S_INK_VALUE, S_INK_HUE), clamp(a * S_INK_DENSITY, 0.0, 1.0)); }
  if (blend > 0.5) { return vec4f(e, 1.0); }
  return vec4f(e / a, a);
}
fn depthOf(p: vec3f) -> f32 { let c = uniforms.projection * (uniforms.worldView * vec4f(p, 1.0)); return c.z / c.w; }
fn inv3(m: mat3x3f) -> mat3x3f {
  let r0 = cross(m[1], m[2]); let r1 = cross(m[2], m[0]); let r2 = cross(m[0], m[1]);
  return transpose(mat3x3f(r0, r1, r2)) * (1.0 / dot(m[0], r0));
}`;

/* the lens, shared by the fibre vertex shader and the shell and ring fragment shaders (the uniforms lensA, lensHorizon, lensMix, lensC, lensK are declared by the caller) */
const DL_LENS = `
const LENS_R: f32 = 1.1;
fn lensRad(s: f32) -> f32 { return select(s, tanh(uniforms.lensK * s) / tanh(uniforms.lensK), uniforms.lensK > 1e-4); }
fn lensRatio(p: vec3f) -> f32 {
  let s = length(p) / LENS_R;
  if (uniforms.lensK > 1e-4) { return select(uniforms.lensK / tanh(uniforms.lensK), lensRad(s) / s, s > 1e-6); }
  return 1.0;
}
fn lensBall(p: vec3f) -> vec3f { return p * (uniforms.lensC * lensRatio(p) / LENS_R); }
fn lensMob(u: vec3f, v: vec3f) -> vec3f {
  let uv = dot(u, v); let uu = dot(u, u); let vv = dot(v, v);
  return ((1.0 + 2.0 * uv + vv) * u + (1.0 - uu) * v) / (1.0 + 2.0 * uv + uu * vv);
}
fn lensWarp(p: vec3f) -> vec3f { return mix(p, lensMob(-uniforms.lensA, lensBall(p)) * LENS_R, uniforms.lensMix); }
fn lensScale(p: vec3f) -> f32 {
  let x = lensBall(p); let aa = dot(uniforms.lensA, uniforms.lensA);
  return mix(1.0, uniforms.lensC * lensRatio(p) * (1.0 - aa) / max(1.0 - 2.0 * dot(uniforms.lensA, x) + aa * dot(x, x), 1e-6), uniforms.lensMix);
}
fn lensFade(p: vec3f) -> f32 {
  let r = min(length(lensMob(-uniforms.lensA, lensBall(p))), 0.999999); let d = 2.0 * atanh(r);
  let f = mix(1.0, uniforms.lensHorizon.z, sstep(uniforms.lensHorizon.x, uniforms.lensHorizon.y, d)) * (1.0 - sstep(0.975, 0.997, r));
  return mix(1.0, f, uniforms.lensMix);
}
fn lensSphere(rk: f32) -> vec4f {
  let s = uniforms.lensC * lensRad(rk / LENS_R); let al = length(uniforms.lensA);
  let ah = select(vec3f(0.0, 0.0, 1.0), uniforms.lensA / al, al > 1e-6);
  let e1 = (s - al) / (1.0 - al * s); let e2 = (-s - al) / (1.0 + al * s);
  return vec4f(ah * (0.5 * (e1 + e2) * LENS_R * uniforms.lensMix), mix(rk, 0.5 * (e1 - e2) * LENS_R, uniforms.lensMix));
}`;

const DL_RAY_VS = `
attribute position: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vRo: vec3f;
varying vRd: vec3f;
${DL_COMMON.match(/fn inv3[\s\S]*$/)[0]}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let vp = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  let Ai = inv3(mat3x3f(uniforms.worldView[0].xyz, uniforms.worldView[1].xyz, uniforms.worldView[2].xyz));
  vertexOutputs.vRo = Ai * (-uniforms.worldView[3].xyz);
  vertexOutputs.vRd = Ai * vp.xyz;
  vertexOutputs.position = uniforms.projection * vp;
}`;
const DL_RING_VS = `
attribute position: vec3f;
attribute normal: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vN: vec3f;
varying vP: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let pe = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vP = pe.xyz;
  vertexOutputs.vN = mat3x3f(uniforms.worldView[0].xyz, uniforms.worldView[1].xyz, uniforms.worldView[2].xyz) * vertexInputs.normal;
  vertexOutputs.position = uniforms.projection * pe;
}`;

const DL_FIBER_VS = `
attribute position: vec3f;
attribute color: vec4f;
attribute aTan: vec3f;
attribute aInfo: vec4f;
attribute aAux: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform viewport: vec4f;
varying vDye: vec3f;
varying vS: f32;
varying vYear: f32;
varying vSeed: f32;
varying vKind: f32;
varying vEst: f32;
varying vFade: f32;
varying vPa: f32;
varying vPb: f32;
varying vSel: f32;
varying vAlong: f32;
varying vSheen: f32;
varying vLens: f32;
%UNIFORMS%
${DL_LENS}
${DL_COMMON.match(/fn sstep[^\n]*/)[0]}
fn uLineAt(i: i32) -> f32 {
  var a = array<vec4f, 8>(uniforms.uLine0, uniforms.uLine1, uniforms.uLine2, uniforms.uLine3, uniforms.uLine4, uniforms.uLine5, uniforms.uLine6, uniforms.uLine7);
  return a[i / 4][i % 4];
}
fn inLine(x: f32) -> f32 {
  for (var i = 0; i < 32; i = i + 1) { let v = uLineAt(i); if (v < -0.5) { break; } if (abs(v - x) < 0.5) { return 1.0; } }
  return 0.0;
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  var lp = vertexInputs.position; var lt = vertexInputs.aTan; var lk = 1.0; var vLens = 1.0;
  if (uniforms.lensMix > 0.0) {
    lp = lensWarp(vertexInputs.position);
    lt = lensWarp(vertexInputs.position + vertexInputs.aTan * 1e-3) - lp;
    lt = select(vertexInputs.aTan, normalize(lt), length(lt) > 1e-9);
    lk = lensScale(vertexInputs.position); vLens = lensFade(vertexInputs.position);
  }
  var pe = uniforms.worldView * vec4f(lp, 1.0);
  let nm = mat3x3f(uniforms.worldView[0].xyz, uniforms.worldView[1].xyz, uniforms.worldView[2].xyz);
  let te = nm * lt;
  var sd = cross(te, normalize(-pe.xyz));
  let sl = length(sd);
  sd = select(vec3f(1.0, 0.0, 0.0), sd / max(sl, 1e-12), sl > 1e-6);
  let sc = length(uniforms.worldView[0].xyz);
  let kind = vertexInputs.aInfo.w;
  let wk = select(select(select(1.0, 0.7, kind > 0.5), 0.75, kind > 1.5), 0.9, kind > 2.5);
  let taper = select(1.0, mix(0.3, 1.0, sstep(0.0, 0.08, vertexInputs.aAux.x)), kind < 0.5);
  let wEye = uniforms.uWidth * wk * taper * sc * lk;
  let px = 2.0 * max(-pe.z, 1e-4) / (abs(uniforms.projection[1][1]) * uniforms.viewport.w);
  let w = clamp(wEye, uniforms.uMinPx * px, uniforms.uMaxPx * px);
  let fade = min(wEye / w, 1.0) * sstep(0.015, 0.06, -pe.z / sc) * vLens;
  var pe3 = pe.xyz + sd * vertexInputs.aInfo.x * w;
  if (uniforms.uPass > 0.5) { pe3 = pe3 * 1.002; }
  vertexOutputs.position = uniforms.projection * vec4f(pe3, 1.0);
  let pa = vertexInputs.aAux.z; let pb = vertexInputs.aAux.w; var sel = -1.0;
  if (uniforms.uPick > -0.5) {
    let own = abs(pa - uniforms.uPick) < 0.5 || abs(pb - uniforms.uPick) < 0.5;
    sel = select(select(inLine(pa), inLine(pa) * inLine(pb), kind > 1.5), 2.0, own);
  }
  {
    let tn = normalize(te + vec3f(1e-6));
    let hv = normalize(normalize(vec3f(0.45, 0.62, 0.64)) + normalize(-pe3));
    let th = dot(tn, hv);
    vertexOutputs.vSheen = sqrt(max(1.0 - th * th, 0.0));
  }
  vertexOutputs.vLens = vLens; vertexOutputs.vFade = fade;
  vertexOutputs.vDye = vertexInputs.color.rgb; vertexOutputs.vS = vertexInputs.aInfo.x; vertexOutputs.vYear = vertexInputs.aInfo.y; vertexOutputs.vSeed = vertexInputs.aInfo.z;
  vertexOutputs.vKind = kind; vertexOutputs.vEst = vertexInputs.aAux.y; vertexOutputs.vPa = pa; vertexOutputs.vPb = pb; vertexOutputs.vSel = sel; vertexOutputs.vAlong = vertexInputs.aAux.x;
}`;

const DL_FS = {
  sky: `
varying vRo: vec3f;
varying vRd: vec3f;
fn skyCol(d: vec3f, q: i32, T: f32, pxa: f32, seed: f32) -> vec3f {
  let sd = vec3f(seed * 17.31, seed * 5.77, seed * 11.13);
  var col = mix(S_GROUND_BOT, S_GROUND_TOP, sstep(-0.75, 0.35, d.y));
  let ang = acos(clamp(dot(d, S_POOL_DIR), -1.0, 1.0));
  col = mix(col, S_POOL, S_POOL_K * exp(-ang * ang / (S_POOL_W * S_POOL_W)));
  if (S_MOTTLE > 0.0) { col = col * (1.0 + S_MOTTLE * (fbm(d * 2.4 + sd, 2 + q) - 0.5) * 2.0); }
  if (S_STARS > 0.0) {
    for (var L = 0; L < 2; L = L + 1) {
      if (L > q) { break; }
      let sc = select(150.0, 60.0, L == 0);
      if (pxa * sc > 0.5) { break; }
      let g = d * sc + sd * f32(L + 1); let id = floor(g); let f = fract(g) - 0.5;
      if (h13(id) < 0.975) { continue; }
      let jit = (vec3f(h13(id + 7.0), h13(id + 11.0), h13(id + 13.0)) - 0.5) * 0.5;
      let r = length(f - jit); let rad = max(0.06, 1.2 * pxa * sc); let e = (0.06 / rad) * (0.06 / rad);
      col = col + vec3f(0.95, 0.9, 0.82) * sstep(rad, 0.0, r) * e * S_STARS * (0.5 + 2.0 * pow(h13(id + 3.0), 4.0));
    }
  }
  return col;
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let d = normalize(fragmentInputs.vRd);
  let T = uniforms.uCycle * 600.0;
  let pxa = length(fwidth(d));
  let c = skyCol(d, i32(uniforms.uQ), T, pxa, uniforms.uSeed);
  fragmentOutputs.color = vec4f(c + grainAt(fragmentInputs.position.xy, T) + dither(fragmentInputs.position.xy, T), 1.0);
}`,

  ring: `
varying vN: vec3f;
varying vP: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  var N = normalize(fragmentInputs.vN); let V = normalize(-fragmentInputs.vP);
  if (dot(N, V) < 0.0) { N = -N; }
  let c = clamp(dot(N, V), 0.0, 1.0);
  let L = normalize(vec3f(0.45, 0.62, 0.64)); let H = normalize(L + V);
  let metal = uniforms.uTint;
  let diff = clamp(dot(N, L), 0.0, 1.0); let spec = pow(clamp(dot(N, H), 0.0, 1.0), 48.0); let rim = pow(1.0 - c, 3.0);
  var col = metal * (S_RING_AMB + S_RING_DIFF * diff) + vec3f(0.92, 0.95, 1.0) * spec * S_RING_SPEC + metal * rim * 0.45;
  col = select(col * (1.0 - 0.62 * uniforms.lensMix), mix(col, S_GROUND_TOP, 0.62 * uniforms.lensMix), S_INK > 0.5);
  let o = select(encode(col, uniforms.uExposure), clamp(col, vec3f(0.0), vec3f(1.0)), S_INK > 0.5);
  fragmentOutputs.color = vec4f(o + dither(fragmentInputs.position.xy, uniforms.uCycle * 600.0), 1.0);
}`,

  seedcore: `
varying vN: vec3f;
varying vP: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let T = uniforms.uCycle * 600.0;
  let mu = clamp(abs(dot(normalize(fragmentInputs.vN), normalize(-fragmentInputs.vP))), 0.0, 1.0);
  let br = 0.8 + 0.2 * sin(T * 1.5707963);
  let centre = S_SEED_CENTRE * 3.0; let limb = S_SEED_LIMB * 0.6;
  let col = mix(limb, centre, pow(mu, 0.7)) * (0.85 + 0.15 * br);
  let o = select(encode(col, uniforms.uExposure) + dither(fragmentInputs.position.xy, T), S_SEED_INK, S_INK > 0.5);
  fragmentOutputs.color = vec4f(o, 1.0);
}`,

  seedglow: `
varying vRo: vec3f;
varying vRd: vec3f;
fn erf1(x: f32) -> f32 { let a = abs(x); let t = 1.0 / (1.0 + 0.47047 * a); return sign(x) * (1.0 - t * (0.3480242 + t * (-0.0958798 + t * 0.7478556)) * exp(-a * a)); }
fn gaussInt(d2: f32, s2: f32, ta: f32, tb: f32) -> f32 { let s = sqrt(s2); return 0.8862269 * s * exp(-d2 / s2) * (erf1(tb / s) - erf1(ta / s)); }
fn invSq(t: f32, k2: f32) -> f32 { let k = sqrt(k2); return t / (2.0 * k2 * (t * t + k2)) + atan(t / k) / (2.0 * k2 * k); }
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let ro = fragmentInputs.vRo / uniforms.uRg; let rd = normalize(fragmentInputs.vRd);
  let T = uniforms.uCycle * 600.0;
  let b = dot(ro, rd); let rr = dot(ro, ro); let d2 = max(rr - b * b, 0.0); let tc = -b;
  let camIn = rr < 1.0;
  if (!fragmentInputs.frontFacing && !camIn) { discard; }
  let h = 1.0 - d2;
  if (h <= 0.0) { discard; }
  let sq = sqrt(h); let t0 = max(tc - sq, 0.0); let t1 = tc + sq;
  if (t1 <= 0.0) { discard; }
  let ta = t0 - tc; let tb = t1 - tc;
  let br = 0.8 + 0.2 * sin(T * 6.2831853 / uniforms.uPeriod);
  let e2 = uniforms.uE2 * br; let k2 = d2 + e2; let w = 1.0 / ((1.0 + e2) * (1.0 + e2));
  let halo = max(invSq(tb, k2) - invSq(ta, k2) - (tb - ta) * w, 0.0) * h * h * h;
  var E = uniforms.uHaloTint * halo * uniforms.uHalo * br + uniforms.uCoreTint * gaussInt(d2, uniforms.uS2 * br, ta, tb) * uniforms.uCore * br;
  if (uniforms.uRing > 0.0 && tc > 0.0) { let dr = (sqrt(d2) - uniforms.uRing) / 0.016; E = E + uniforms.uCoreTint * 0.75 * exp(-dr * dr) * (0.85 + 0.15 * br); }
  fragmentOutputs.fragDepth = depthOf((ro + rd * max(tc + uniforms.uZ, t0 + 1e-3)) * uniforms.uRg);
  fragmentOutputs.color = glowOut(encode(knee(E, uniforms.uKnee) * uniforms.uGain, uniforms.uExposure) + dither(fragmentInputs.position.xy, T), uniforms.uBlend);
}`,

  fiber: `
varying vDye: vec3f;
varying vS: f32;
varying vYear: f32;
varying vSeed: f32;
varying vKind: f32;
varying vEst: f32;
varying vFade: f32;
varying vPa: f32;
varying vPb: f32;
varying vSel: f32;
varying vAlong: f32;
varying vSheen: f32;
varying vLens: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vDye = fragmentInputs.vDye; let vS = fragmentInputs.vS; let vYear = fragmentInputs.vYear; let vSeed = fragmentInputs.vSeed; let vKind = fragmentInputs.vKind; let vEst = fragmentInputs.vEst;
  let vFade = fragmentInputs.vFade; let vSel = fragmentInputs.vSel; let vAlong = fragmentInputs.vAlong; let vSheen = fragmentInputs.vSheen; let vLens = fragmentInputs.vLens;
  let uQ = i32(uniforms.uQ); let uPass = i32(uniforms.uPass);
  let T = uniforms.uCycle * 600.0;
  var neon = clamp(mix(vec3f(dot(vDye, vec3f(0.2126, 0.7152, 0.0722))), vDye, S_CHROMA), vec3f(0.0), vec3f(1.0));
  neon = neon / mix(1.0, max(max(neon.r, neon.g), max(neon.b, 1e-3)), S_VALUE_NORM);
  let mx = max(max(vDye.r, vDye.g), vDye.b); let dyed = step(0.3, (mx - min(min(vDye.r, vDye.g), vDye.b)) / max(mx, 1e-3));
  let woven = sstep(uniforms.uFell + 1.5, uniforms.uFell - 1.5, vYear);
  let tip = select(0.0, exp(-max(uniforms.uFell - vYear, 0.0) / 2.5) * woven, vKind < 0.5);
  let dash = select(1.0, step(fract(select(vAlong / 0.028, vYear / 7.0, vKind < 0.5)), 0.57), vEst > 0.5);
  let ph = vYear / 75.0 - T / 3.0 + select(0.0, vSeed * 0.35, uQ > 1);
  let pulse = pow(0.5 + 0.5 * cos(6.2831853 * ph), 24.0);
  let rWave = fract(T / 12.0) * 1.25 - 0.1;
  let yWave = uniforms.uY0 + (rWave - uniforms.uR0) / uniforms.uK;
  let front = exp(-sqr((vYear - yWave) * uniforms.uK / 0.03));
  let kg = select(select(select(1.0, 0.75, vKind > 0.5), 1.2, vKind > 1.5), 1.55, vKind > 2.5);
  let I = (1.0 + S_PULSE * pulse + S_FRONT * front + S_TIP * tip) * kg * uniforms.uGain;
  let lum = pow(aces1(I * uniforms.uExposure * 0.9), 0.4545);
  let est = select(1.0, 0.55, vEst > 0.5);
  let rest = vSel > -0.5 && vSel < 0.5;
  var kc = select(1.0, 0.8, vSel > 0.5 && vSel < 1.5);
  var kgl = select(select(select(S_REST_GLOW, 0.7, vSel > 0.5), 1.15, vSel > 1.5), 1.0, vSel < -0.5);
  var hot = select(0.0, 0.12, vSel > 1.5);
  kc = mix(1.0, kc, uniforms.uFocus); kgl = mix(1.0, kgl, uniforms.uFocus); hot = hot * uniforms.uFocus;
  let white = clamp(mix(S_WHITE_ECRU, S_WHITE, dyed) + 0.2 * S_TIP * tip + 0.19 * S_PULSE * pulse + hot, 0.0, 1.0);
  let c = 1.0 - vS * vS;
  let core = mix(neon, vec3f(1.0), white * c) * lum * mix(1.0, est, 0.5);
  if (rest) { neon = mix(neon, S_REST_L, 0.7 * uniforms.uFocus); }
  if (S_INK > 0.5) {
    let q2 = vS * vS; let l0 = dot(vDye, vec3f(0.2126, 0.7152, 0.0722));
    let ink = clamp(mix(vec3f(l0), vDye, S_CHROMA), vec3f(0.0), vec3f(1.0)) * S_INK_VALUE;
    let silk = ink * (1.0 - S_ROUND * q2) + S_SHEEN * pow(vSheen, 24.0) * (1.0 - q2);
    if (uPass == 0) {
      if (woven < 0.5 || dash < 0.5) { discard; }
      if (rest && uniforms.uFocus > 0.01) { discard; }
      let cc = select(silk, mix(silk, S_GROUND_TOP, 0.22 * uniforms.uFocus), vSel > 0.5 && vSel < 1.5);
      if (vLens < 0.03) { discard; }
      fragmentOutputs.color = vec4f(mix(mix(cc, S_GROUND_TOP, (1.0 - est) * 0.55), S_GROUND_TOP, 1.0 - vLens), 1.0);
    } else {
      let vis = mix(uniforms.uGhost, 1.0, woven) * mix(0.45, 1.0, dash) * est;
      var a = S_BLEED_A * exp(-q2 * S_BLEED_K) * vis * vFade;
      var cc = ink;
      if (rest && uniforms.uFocus > 0.01) {
        cc = mix(ink, S_REST, uniforms.uFocus);
        a = mix(a, S_REST_A * exp(-q2 * 3.0) * vis * vFade, uniforms.uFocus);
        if (woven > 0.5 && dash > 0.5) { a = max(a, exp(-q2 * 60.0) * (1.0 - uniforms.uFocus) * vLens); }
      }
      if (a < 0.004) { discard; }
      fragmentOutputs.color = vec4f(cc, a);
    }
    return fragmentOutputs;
  }
  if (uPass == 0) {
    if (woven < 0.5 || dash < 0.5) { discard; }
    if (rest && uniforms.uFocus > 0.01) { discard; }
    if (vLens < 0.03) { discard; }
    fragmentOutputs.color = vec4f(core * (0.7 + 0.3 * vFade) * kc * vLens, 1.0);
  } else {
    let s2 = vS * vS;
    let g = 0.7 * exp(-s2 * 3.2) + 0.3 * exp(-s2 * 14.0);
    let vis = mix(uniforms.uGhost, 1.0, woven) * mix(0.45, 1.0, dash) * est;
    var e = neon * g * lum * vis * vFade * S_GLOW * kgl;
    if (rest && uniforms.uFocus > 0.01 && woven > 0.5 && dash > 0.5) { e = e + core * (0.7 + 0.3 * vFade) * exp(-s2 * 60.0) * (1.0 - uniforms.uFocus) * vLens; }
    fragmentOutputs.color = glowOut(e + dither(fragmentInputs.position.xy, T), uniforms.uBlend);
  }
}`,

  shell: `
varying vRo: vec3f;
varying vRd: vec3f;
${DL_LENS}
fn skyCol(d: vec3f, q: i32, T: f32, pxa: f32, seed: f32) -> vec3f {
  let sd = vec3f(seed * 17.31, seed * 5.77, seed * 11.13);
  var col = mix(S_GROUND_BOT, S_GROUND_TOP, sstep(-0.75, 0.35, d.y));
  let ang = acos(clamp(dot(d, S_POOL_DIR), -1.0, 1.0));
  col = mix(col, S_POOL, S_POOL_K * exp(-ang * ang / (S_POOL_W * S_POOL_W)));
  if (S_MOTTLE > 0.0) { col = col * (1.0 + S_MOTTLE * (fbm(d * 2.4 + sd, 2 + q) - 0.5) * 2.0); }
  return col;
}
fn erf1(x: f32) -> f32 { let a = abs(x); let t = 1.0 / (1.0 + 0.47047 * a); return sign(x) * (1.0 - t * (0.3480242 + t * (-0.0958798 + t * 0.7478556)) * exp(-a * a)); }
fn gaussInt(d2: f32, s2: f32, ta: f32, tb: f32) -> f32 { let s = sqrt(s2); return 0.8862269 * s * exp(-d2 / s2) * (erf1(tb / s) - erf1(ta / s)); }
fn timeTint(r: f32) -> vec3f { return mix(S_PAST_L, S_PRESENT_L, sstep(0.05, 1.05, r)); }
fn grat(n: vec3f, px: f32) -> f32 {
  let lat = asin(clamp(n.y, -1.0, 1.0)); let cl = cos(lat);
  let lon = atan2(n.x, n.z) * 1.9098593; let la = lat * 1.9098593;
  let dLon = abs(fract(lon + 0.5) - 0.5) * 0.5235988 * cl; let dLat = abs(fract(la + 0.5) - 0.5) * 0.5235988;
  return max((1.0 - sstep(0.25, 0.9, dLon / px)) * sstep(0.12, 0.3, cl), 1.0 - sstep(0.25, 0.9, dLat / px));
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let ro = fragmentInputs.vRo; let rd = normalize(fragmentInputs.vRd);
  let pxr = max(length(fwidth(rd)), 1e-6);
  let uR = uniforms.uR; let uRp = uniforms.uRp; let uQ = i32(uniforms.uQ);
  let T = uniforms.uCycle * 600.0;
  let b = dot(ro, rd); let rr = dot(ro, ro);
  let d2 = max(rr - b * b, 0.0); let d = sqrt(d2); let tc = -b;
  let camInProxy = rr < uRp * uRp;
  if (!fragmentInputs.frontFacing && !camInProxy) { discard; }
  var E = vec3f(0.0);
  var depth = fragmentInputs.position.z;
  let rFell = uniforms.uR0 + (uniforms.uFell - uniforms.uY0) * uniforms.uK;
  let rWave = fract(T / 12.0) * 1.25 - 0.1;
  let h = uR * uR - d2;
  let in01 = 1.0 - sstep(uR * 0.9, uR, sqrt(rr));
  let face = mix(1.0, 0.15, in01);
  if (S_INK > 0.5) {
    var acc = vec4f(0.0);
    var dep = fragmentInputs.position.z;
    let cr = sqrt(rr); let beta = acos(clamp(dot(rd, -ro / max(cr, 1e-5)), -1.0, 1.0));
    if (h <= 0.0) {
      if (tc <= 0.0) { discard; }
      let x = clamp((d - uR) / (uRp - uR), 0.0, 1.0);
      over(&acc, S_FROST, S_HALO_A * exp(-x * 14.0) * (1.0 - x));
      dep = depthOf(ro + rd * tc);
    } else {
      let sq = sqrt(h); let t0 = max(tc - sq, 0.0); let t1 = tc + sq;
      if (t1 <= 0.0) { discard; }
      let pf = (ro + rd * t1) / uR;
      if (S_GRAT_BACK > 0.0) { over(&acc, S_ENGRAVE, S_GRAT_BACK * grat(pf, pxr * t1 / uR / max(abs(dot(pf, rd)), 0.2))); }
      over(&acc, S_FROST, S_BODY_A * clamp((t1 - t0) / (2.0 * uR), 0.0, 1.0));
      for (var k = 0; k < 16; k = k + 1) {
        let yk = uniforms.uShell0 + 50.0 * f32(k);
        if (yk > uniforms.uTop + 0.5) { break; }
        let rk0 = uniforms.uR0 + (yk - uniforms.uY0) * uniforms.uK;
        let ls = lensSphere(rk0); let lc = ls.xyz; let rk = ls.w;
        let lo = ro - lc; let lo2 = dot(lo, lo);
        if (lo2 <= rk * rk) { continue; }
        let lr = sqrt(lo2); let lbeta = acos(clamp(dot(rd, -lo / max(lr, 1e-5)), -1.0, 1.0));
        let woven = sstep(uniforms.uFell + 3.0, uniforms.uFell - 3.0, yk); let ak = asin(clamp(rk / lr, 0.0, 1.0));
        over(&acc, mix(S_PAST, S_PRESENT, sstep(0.05, 1.05, rk0)), S_SHELL_A * exp(-sqr((ak - lbeta) / pxr / 0.8)) * mix(0.35, 1.0, woven));
      }
      if (rr > uR * uR) {
        let p0 = ro + rd * t0; let n = p0 / uR;
        let ci = clamp(-dot(n, rd), 0.0, 1.0); let F = 0.04 + 0.96 * pow(1.0 - ci, 5.0);
        over(&acc, S_FROST, S_FROST_A * pow(1.0 - ci, 2.2));
        over(&acc, S_RIMDARK, S_RIMDARK_A * exp(-sqr((ci - 0.16) / 0.07)));
        let rf = reflect(rd, n);
        over(&acc, skyCol(rf, 0, T, 0.0, uniforms.uSeed), S_REFL * F);
        let kl = max(dot(rf, normalize(vec3f(0.45, 0.62, 0.64))), 0.0);
        over(&acc, vec3f(1.0), S_GLINT * (sstep(0.975, 0.992, kl) * 0.9 + 0.3 * pow(kl, 30.0)));
        let limbPx = (asin(clamp(uR / cr, 0.0, 1.0)) - beta) / pxr;
        over(&acc, S_ENGRAVE, S_OUTLINE_A * (1.0 - sstep(0.2, 1.6, limbPx)));
        if (S_GRATICULE > 0.0) { over(&acc, S_ENGRAVE, S_GRATICULE * grat(n, pxr * t0 / uR / max(ci, 0.2))); }
        dep = depthOf(p0);
      }
    }
    fragmentOutputs.fragDepth = dep;
    if (acc.a < 0.003) { discard; }
    fragmentOutputs.color = vec4f(acc.rgb / acc.a + dither(fragmentInputs.position.xy, T), acc.a);
    return fragmentOutputs;
  }
  if (h <= 0.0) {
    if (tc <= 0.0) { discard; }
    let x = clamp((d - uR) / (uRp - uR), 0.0, 1.0);
    E = S_RIM * S_RIM_GAIN * 0.22 * exp(-x * 9.0) * (1.0 - x);
    depth = depthOf(ro + rd * tc);
  } else {
    let sq = sqrt(h); let t0 = max(tc - sq, 0.0); let t1 = tc + sq;
    if (t1 <= 0.0) { discard; }
    if (rr > uR * uR) {
      let p0 = ro + rd * t0; let n = p0 / uR;
      let ci = clamp(-dot(n, rd), 0.0, 1.0);
      let F = 0.04 + 0.96 * pow(1.0 - ci, 5.0);
      E = E + S_RIM * S_RIM_GAIN * (pow(1.0 - ci, 6.0) * 1.1 + pow(1.0 - ci, 2.0) * 0.05);
      let rf = reflect(rd, n);
      if (uQ > 0) { E = E + pow(skyCol(rf, 0, T, 0.0, uniforms.uSeed), vec3f(2.2)) * F * 2.5 * S_REFL; }
      let kl = max(dot(rf, normalize(vec3f(0.45, 0.62, 0.64))), 0.0);
      E = E + vec3f(1.0, 0.95, 0.9) * (pow(kl, 600.0) * 14.0 + pow(kl, 24.0) * 0.35) * F * S_GLINT;
      depth = depthOf(p0);
    }
    for (var k = 0; k < 16; k = k + 1) {
      let yk = uniforms.uShell0 + 50.0 * f32(k);
      if (yk > uniforms.uTop + 0.5) { break; }
      let rk0 = uniforms.uR0 + (yk - uniforms.uY0) * uniforms.uK;
      let ls = lensSphere(rk0); let lc = ls.xyz; let rk = ls.w;
      let lo = ro - lc; let lb = dot(lo, rd); let ltc = -lb; let hk = rk * rk - max(dot(lo, lo) - lb * lb, 0.0);
      if (hk <= 0.0) { continue; }
      let sk = sqrt(hk); let ck = sk / rk;
      let woven = sstep(uniforms.uFell + 3.0, uniforms.uFell - 3.0, yk);
      let pulse = 1.0 + S_SHELL_FRONT * exp(-sqr((rk0 - rWave) / 0.045));
      let line = 0.0012 * face / max(ck, 0.05) + 0.045 * exp(-ck * ck / 0.012);
      let c = timeTint(rk0) * line * pulse * mix(0.12, 1.0, woven);
      if (ltc - sk > t0) { E = E + c; }
      if (ltc + sk > t0) { E = E + c * 0.5; }
    }
    let fs = lensSphere(rFell); let fc = fs.xyz; let fr = fs.w;
    let fo = ro - fc; let fb = dot(fo, rd); let ftc = -fb; let hf = fr * fr - max(dot(fo, fo) - fb * fb, 0.0);
    if (hf > 0.0 && rFell < uR) {
      let sf = sqrt(hf); let cf = sf / fr;
      let c = vec3f(1.0, 0.80, 0.52) * (0.002 * face / max(cf, 0.05) + 0.08 * exp(-cf * cf / 0.012));
      if (ftc - sf > t0) { E = E + c; }
      if (ftc + sf > t0) { E = E + c * 0.45; }
    }
    let ta = t0 - tc; let tb = t1 - tc;
    let kin = mix(uniforms.uInside, 1.0, sstep(uR * 0.9, uR, sqrt(rr)));
    E = E + S_HAZE * gaussInt(d2, 0.36, ta, tb) * 0.02 * uniforms.uHaze * kin * S_HAZE_GAIN;
    if (uQ > 0) {
      let N = select(28, 12, uQ == 1);
      let dt = (t1 - t0) / f32(N); let j = h13(vec3f(fragmentInputs.position.xy, floor(T * 30.0)));
      var acc = vec3f(0.0);
      for (var i = 0; i < 28; i = i + 1) {
        if (i >= N) { break; }
        let t = t0 + (f32(i) + j) * dt;
        let p = ro + rd * t; let r = length(p);
        let st = fbm(p / max(r, 1e-4) * 3.3 + uniforms.uSeed * 3.1, select(5, 3, uQ == 1));
        let rip = 0.6 + 0.4 * sin(6.2831853 * (r / 0.15 - T / 4.0));
        let frw = exp(-sqr((r - rWave) / 0.06));
        let woven = sstep(rFell + 0.04, rFell - 0.04, r);
        let dens = exp(-r * r / 0.5) * sstep(0.5, 0.9, st) * rip * (0.25 + 0.75 * woven) + frw * 0.5 * sstep(0.55, 0.9, st);
        acc = acc + dens * mix(S_HAZE * 1.25, timeTint(r), 0.55);
      }
      E = E + acc * dt * 0.08 * uniforms.uHaze * kin * S_FLOW;
    }
  }
  fragmentOutputs.fragDepth = depth;
  fragmentOutputs.color = glowOut(encode(knee(E, 0.005 * in01) * uniforms.uGain, uniforms.uExposure) + dither(fragmentInputs.position.xy, T), uniforms.uBlend);
}`,
};

/* the WGSL declarations of a ComposedShader's own fields: floats and ints as f32, vec3 as vec3f, the MFFloat array as eight vec4f chunks */
function dlUniformDecls(cs) {
  const names = {}, lines = [];
  for (const [name, def] of Object.entries(cs.fdefs)) {
    if (['language', 'parts', 'activate', 'isSelected', 'isValid'].includes(name) || def[1] === undefined) continue;
    const t = def[0];
    if (t === 'SFFloat' || t === 'SFInt32' || t === 'SFBool' || t === 'SFTime' || t === 'SFDouble') { names[name] = 'f32'; lines.push(`uniform ${name}: f32;`); }
    else if (t === 'SFVec3f' || t === 'SFColor') { names[name] = 'vec3f'; lines.push(`uniform ${name}: vec3f;`); }
    else if (t === 'MFFloat') { for (let k = 0; k < 8; k++) { names[name + k] = 'vec4f'; lines.push(`uniform ${name}${k}: vec4f;`); } }
  }
  return { names, text: lines.join('\n') };
}

/* a port for this ComposedShader: the program's WGSL with this scene's look constants and this shader's own uniforms; cached per (program, look) */
const DL_PORTS = new Map();
function dlPortFor(cs, glslFragment) {
  const prog = DL_BY_DEF[cs.def]; if (!prog) return null;
  const consts = dlThemeConsts(glslFragment || ''), key = prog + ':' + fnv32(consts + JSON.stringify(Object.keys(cs.fdefs)));
  if (DL_PORTS.has(key)) return DL_PORTS.get(key);
  const U = dlUniformDecls(cs), needsLens = prog === 'fiber' || prog === 'shell' || prog === 'ring';
  const fsHead = `uniform worldView: mat4x4f;\nuniform projection: mat4x4f;\nuniform viewport: vec4f;\n${U.text}\n${consts}\n${DL_COMMON}\n`;
  const vs = prog === 'fiber' ? DL_FIBER_VS.replace('%UNIFORMS%', U.text)
    : (prog === 'ring' || prog === 'seedcore') ? DL_RING_VS : DL_RAY_VS;
  const port = { key, kind: 'mesh', attrs: DL_ATTRS[prog], uniforms: U.names, notes: 'DEF ' + cs.def, vs, fs: fsHead + DL_FS[prog], prog, needsLens };
  // the ring shader's fragment uses lensMix only; the lens functions are for the fibre vertex stage and the shell
  DL_PORTS.set(key, port);
  return port;
}
function fnv32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
