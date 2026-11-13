/* WGSL ports of the Manifold of Emotion shaders. Source of truth stays the GLSL inside scenes/manifold.x3d (x3d.STEM studies/manifold, shaders/*.glsl).
   Each port is chosen by the FNV-1a hash of the whitespace-collapsed GLSL (wgsl.js), so edited GLSL falls back and says so on screen (law 40).
   Babylon WGSL ShaderMaterial conventions are those of brain/wgsl.js: `attribute`, `uniform name: type;`, `varying`, VertexInputs / FragmentInputs, vertexOutputs.position.
   Term-for-term translation: same constants, same order of operations. Differences, all forced by WGSL:
     uniform vec4 u[N]    -> N separate vec4f uniforms (u0..uN-1) copied into a var<private> array at the top of each entry point (loadArrays)
     pow(x, y)            -> x guarded with max(x, 0.0) where rounding can push it just below zero (GLSL leaves that undefined, WGSL gives NaN)
     gl_FrontFacing       -> fragmentInputs.frontFacing
     gl_PointSize         -> the point is a 4-vertex quad (attribute `corner` = -1/1); the vertex shader moves each corner by size/2 pixels
     fwidth               -> fwidth (same in WGSL)
   The scene's shaders output display-referred colour (ACES of 1.32 x radiance, then gamma 2.2): Babylon must not tone map or gamma-convert on top. */

const MF_UNIFORMS = `
const PI: f32 = 3.141592653589793;
uniform uTime: f32; uniform uEnergy: f32; uniform uBreath: f32; uniform uFold: f32; uniform uGlow: f32; uniform uMetal: f32;
uniform uContours: f32; uniform uMicro: f32; uniform uCurrents: f32;
uniform uSources0: vec4f; uniform uSources1: vec4f; uniform uSources2: vec4f; uniform uSources3: vec4f; uniform uSources4: vec4f; uniform uSources5: vec4f; uniform uSources6: vec4f;
uniform uShape0: vec4f; uniform uShape1: vec4f; uniform uShape2: vec4f; uniform uShape3: vec4f; uniform uShape4: vec4f; uniform uShape5: vec4f; uniform uShape6: vec4f;
uniform uPulse0: vec4f; uniform uPulse1: vec4f; uniform uPulse2: vec4f; uniform uPulse3: vec4f; uniform uPulse4: vec4f; uniform uPulse5: vec4f; uniform uPulse6: vec4f; uniform uPulse7: vec4f;
uniform uA: vec3f; uniform uB: vec3f; uniform uC: vec3f;
`;

/* shaders/common.glsl, term for term */
const MF_COMMON = `
var<private> gSrc: array<vec4f, 7>;
var<private> gShp: array<vec4f, 7>;
var<private> gPul: array<vec4f, 8>;
fn loadArrays() {
  gSrc = array<vec4f, 7>(uniforms.uSources0, uniforms.uSources1, uniforms.uSources2, uniforms.uSources3, uniforms.uSources4, uniforms.uSources5, uniforms.uSources6);
  gShp = array<vec4f, 7>(uniforms.uShape0, uniforms.uShape1, uniforms.uShape2, uniforms.uShape3, uniforms.uShape4, uniforms.uShape5, uniforms.uShape6);
  gPul = array<vec4f, 8>(uniforms.uPulse0, uniforms.uPulse1, uniforms.uPulse2, uniforms.uPulse3, uniforms.uPulse4, uniforms.uPulse5, uniforms.uPulse6, uniforms.uPulse7);
}
// (lambda, d lambda/dx, d lambda/dz, Laplacian of lambda), lambda = 1 + seven anisotropic Gaussians
fn metric(p: vec2f) -> vec4f {
  var r = vec4f(1.0, 0.0, 0.0, 0.0);
  for (var i = 0; i < 7; i++) {
    let S = gSrc[i]; let H = gShp[i];
    let d = p - S.xy;
    let q = vec2f(H.x * d.x + H.y * d.y, -H.y * d.x + H.x * d.y);
    let a = 1.0 / (S.w * S.w * vec2f(1.0, H.z * H.z));
    let v = S.z * exp(-0.5 * dot(q * q, a));
    let l = -q * a;
    let grad = vec2f(H.x * l.x - H.y * l.y, H.y * l.x + H.x * l.y);
    r += vec4f(v, v * grad, v * (dot(l, l) - a.x - a.y));
  }
  return r;
}
// a rotating R4 coordinate, projected into the display height only (it does not enter the metric)
fn foldSurface(p: vec2f) -> vec3f {
  let a = uniforms.uTime * 0.12; let c = cos(a); let s = sin(a); let c2 = cos(a * 0.73); let s2 = sin(a * 0.73);
  let ax = p.x * 0.19 + uniforms.uTime * 0.13; let bz = p.y * 0.21 - uniforms.uTime * 0.11;
  let q = vec4f(p * 0.25, sin(ax), cos(bz));
  let Q = vec4f(c * q.x - s * q.w, c2 * q.y - s2 * q.z, s2 * q.y + c2 * q.z, s * q.x + c * q.w);
  let dx = vec4f(c * 0.25, -s2 * 0.19 * cos(ax), c2 * 0.19 * cos(ax), s * 0.25);
  let dz = vec4f(s * 0.21 * sin(bz), c2 * 0.25, s2 * 0.25, -c * 0.21 * sin(bz));
  let d = 1.8 - 0.23 * Q.w; let v = Q.xyz / d;
  let vx = (dx.xyz * d + 0.23 * Q.xyz * dx.w) / (d * d);
  let vz = (dz.xyz * d + 0.23 * Q.xyz * dz.w) / (d * d);
  let A = v.x * 2.6 + v.z; let B = v.y * 2.2; let C = v.z * 3.7 + v.y;
  let gradient = vec3f(0.65 * cos(A) * cos(B) * 2.6, -0.65 * sin(A) * sin(B) * 2.2 + 0.24 * cos(C), 0.65 * cos(A) * cos(B) + 0.24 * cos(C) * 3.7);
  return uniforms.uFold * vec3f(0.65 * sin(A) * cos(B) + 0.24 * sin(C), dot(gradient, vx), dot(gradient, vz));
}
// height and its gradient: -1.72 ln(lambda) + fold + ripples
fn surfaceAt(p: vec2f, m: vec4f) -> vec3f {
  var h = -1.72 * log(m.x);
  var g = -1.72 * m.yz / m.x;
  let folded = foldSurface(p);
  h += folded.x; g += folded.yz;
  for (var i = 0; i < 8; i++) {
    let P = gPul[i];
    if (P.w < 0.001) { continue; }
    let age = uniforms.uTime - P.z;
    if (age > 18.0 || age < 0.0) { continue; }
    let len = length(p - P.xy);
    let r = len - age * 2.15;
    let envelope = exp(-r * r * 0.75 - age * 0.53) * P.w * step(0.0, age);
    let wave = sin(r * 4.2) * envelope;
    h += wave;
    let slope = (4.2 * cos(r * 4.2) - 1.5 * r * sin(r * 4.2)) * envelope;
    g += slope * (p - P.xy) / max(0.01, len);
  }
  return vec3f(h, g);
}
fn heightAt(p: vec2f) -> f32 { return surfaceAt(p, metric(p)).x; }
fn hash21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123); }
// the original's display transform, applied per fragment: ACES (Narkowicz) of 1.32 x radiance, then gamma 2.2
fn display(c0: vec3f) -> vec3f {
  var c = max(c0 * 1.32, vec3f(0.0));
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
  return pow(c, vec3f(1.0 / 2.2));
}
fn overlay(F0: vec3f) -> vec3f {
  let F = max(F0, vec3f(0.0));
  return clamp(6.1615 * F / pow(vec3f(1.0) + 4.9597 * F, vec3f(1.0704)), vec3f(0.0), vec3f(1.0));
}
// light layers as RGBA for standard alpha blending: (g / max g, max g), pulled toward white by 0.3
fn lightOut(F: vec3f) -> vec4f {
  let g = overlay(F);
  let a = max(max(g.r, g.g), g.b);
  if (a > 1e-5) { return vec4f(mix(g / a, vec3f(1.0), 0.3), a); }
  return vec4f(0.0);
}
`;
const MF_PRELUDE = MF_UNIFORMS + MF_COMMON;

/* ----------------------------------------------------------------------------------------------- sky (shaders/background.glsl) */
const MF_SKY_VS = `
attribute position: vec3f;
varying vUV: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vUV = vertexInputs.position.xy * 0.5 + 0.5;
  vertexOutputs.position = vec4f(vertexInputs.position.xy, 0.999999, 1.0);
}`;
const MF_SKY_FS = `
uniform uResolution: vec2f;
varying vUV: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  loadArrays();
  let vUV = fragmentInputs.vUV;
  var p = vUV - 0.5; p.x *= uniforms.uResolution.x / uniforms.uResolution.y;
  let t = uniforms.uTime;
  let haze = exp(-dot(p * vec2f(0.9, 1.5), p * vec2f(0.9, 1.5)) * 2.8);
  var color = vec3f(0.008, 0.013, 0.025) + mix(uniforms.uA, uniforms.uB, vUV.x) * haze * 0.028;
  let cloud = sin(p.x * 2.0 + p.y * 4.0 + t * 0.018) * sin(p.x * 3.0 - p.y * 2.1);
  let cy = p.y + 0.1 + cloud * 0.04;
  color += uniforms.uB * exp(-cy * cy * 45.0) * 0.014;
  let curtain = sin(p.x * 4.1 + t * 0.025) + 0.3 * sin(p.x * 10.7 - t * 0.02);
  let ay = p.y - 0.11 - curtain * 0.045;
  let aurora = exp(-ay * ay * 95.0) * exp(-p.x * p.x * 0.6);
  color += mix(uniforms.uA, uniforms.uB, 0.5 + 0.5 * sin(p.x * 2.0 + t * 0.04)) * aurora * 0.023;
  let gp = (p - vec2f(-0.18, 0.08)) * vec2f(1.0, 2.0);
  color += uniforms.uA * exp(-dot(gp, gp) * 7.0) * 0.012;
  let grid = floor(vUV * uniforms.uResolution / 4.0);
  let star = step(0.99965, hash21(grid));
  color += vec3f(0.2, 0.3, 0.4) * star * pow(hash21(grid + 1.0), 3.0) * 0.25;
  fragmentOutputs.color = vec4f(display(color), 1.0);
}`;

/* ----------------------------------------------------------------------------------------------- surface (shaders/surface.glsl) */
const MF_SURFACE_VS = `
attribute position: vec3f;
uniform worldView: mat4x4f; uniform projection: mat4x4f;
uniform uAOStrength: f32;
varying vPos: vec3f; varying vNormal: vec3f; varying vXZ: vec2f; varying vLambda: f32; varying vK: f32; varying vFold: f32; varying vAO: f32;
// ambient occlusion from the true height function: horizon slopes in eight directions at three radii, per vertex
fn occlusion(p: vec2f, h0: f32) -> f32 {
  var occ = 0.0;
  for (var k = 0; k < 8; k++) {
    let a = f32(k) * 0.785398 + 0.3927;
    let d = vec2f(cos(a), sin(a));
    var best = 0.0;
    for (var j = 0; j < 3; j++) {
      let r = 0.45 * pow(2.1, f32(j));
      let dh = heightAt(p + d * r) - h0;
      best = max(best, dh / sqrt(r * r + dh * dh) * (1.0 - 0.18 * f32(j)));
    }
    occ += max(0.0, best - 0.06);
  }
  return 1.0 - clamp(occ / 8.0 * uniforms.uAOStrength, 0.0, 0.42);
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  loadArrays();
  let aXZ = vertexInputs.position.xz - 11.2;
  let m = metric(aXZ);
  let s = surfaceAt(aXZ, m);
  vertexOutputs.vPos = vec3f(aXZ.x, s.x, aXZ.y);
  vertexOutputs.vNormal = normalize(vec3f(-s.y, 1.0, -s.z));
  vertexOutputs.vXZ = aXZ;
  vertexOutputs.vLambda = m.x;
  vertexOutputs.vFold = s.x + 1.72 * log(m.x);
  vertexOutputs.vK = -(m.w / m.x - dot(m.yz, m.yz) / (m.x * m.x)) / (m.x * m.x);
  var ao = 1.0;
  if (uniforms.uAOStrength > 0.0) { ao = occlusion(aXZ, s.x); }
  vertexOutputs.vAO = ao;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position.x, s.x, vertexInputs.position.z, 1.0);
}`;
const MF_SURFACE_FS = `
uniform uEye: vec3f; uniform uLineScale: f32;
varying vPos: vec3f; varying vNormal: vec3f; varying vXZ: vec2f; varying vLambda: f32; varying vK: f32; varying vFold: f32; varying vAO: f32;
// line widths are in device pixels (fwidth); uLineScale = supersampling factor keeps them the original's width on screen
fn line(f: f32, w0: f32) -> f32 {
  let w = w0 * uniforms.uLineScale;
  let a = max(fwidth(f), 1e-5);
  return 1.0 - smoothstep(a * w, a * (w + 1.0), abs(fract(f - 0.5) - 0.5));
}
fn ggx(n: vec3f, v: vec3f, l: vec3f, rough: f32) -> f32 {
  let h = normalize(l + v);
  let nh = max(dot(n, h), 0.0); let nv = max(dot(n, v), 0.01); let nl = max(dot(n, l), 0.01);
  let a = rough * rough; let a2 = a * a;
  let dd = nh * nh * (a2 - 1.0) + 1.0;
  let d = a2 / (PI * dd * dd);
  let k = (rough + 1.0) * (rough + 1.0) / 8.0;
  let g = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  return d * g / (4.0 * nv * nl + 0.0001);
}
fn environment(r: vec3f) -> vec3f {
  let c = mix(vec3f(0.025, 0.034, 0.065), vec3f(0.085, 0.13, 0.20), smoothstep(-0.2, 0.9, r.y));
  let strip = pow(max(0.0, dot(r, normalize(vec3f(-0.5, 0.85, -0.4)))), 60.0);
  let strip2 = pow(max(0.0, dot(r, normalize(vec3f(0.7, 0.4, 0.2)))), 22.0);
  let strip3 = pow(max(0.0, dot(r, normalize(vec3f(-0.2, 0.3, 1.0)))), 36.0);
  let softbox = pow(max(0.0, dot(r, normalize(vec3f(0.1, 0.9, -0.3)))), 16.0);
  let blade = pow(max(0.0, dot(r, normalize(vec3f(-0.8, 0.25, 0.1)))), 110.0);
  return c + vec3f(1.5, 1.7, 1.9) * strip + uniforms.uC * strip2 * 1.25 + uniforms.uA * strip3 * 1.1 + mix(uniforms.uA, uniforms.uB, 0.4) * softbox * 0.45 + uniforms.uC * blade * 0.9;
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  loadArrays();
  let vPos = fragmentInputs.vPos; let vXZ = fragmentInputs.vXZ; let vLambda = fragmentInputs.vLambda; let vK = fragmentInputs.vK; let vFold = fragmentInputs.vFold;
  let uA = uniforms.uA; let uB = uniforms.uB; let uC = uniforms.uC; let t = uniforms.uTime; let uMetal = uniforms.uMetal; let uMicro = uniforms.uMicro; let uGlow = uniforms.uGlow;
  let edge = max(abs(vXZ.x), abs(vXZ.y));
  let fade = 1.0 - smoothstep(9.7, 11.2, edge);
  if (fade < 0.015) { discard; }
  var n = normalize(fragmentInputs.vNormal);
  if (!fragmentInputs.frontFacing) { n = -n; }
  let micro = vec2f(cos(vXZ.x * 19.0 + vXZ.y * 11.0 + t * 0.18), sin(vXZ.y * 23.0 - vXZ.x * 9.0 - t * 0.14));
  n = normalize(n + vec3f(micro.x, 0.0, micro.y) * 0.006 * uMicro * (0.3 + uMetal));
  let v = normalize(uniforms.uEye - vPos);
  let nv = max(dot(n, v), 0.001);
  let K = tanh(vK * 11.0);
  let ll = log(vLambda);
  let swirl = 0.5 + 0.5 * sin(ll * 2.9 + vXZ.x * 0.17 - vXZ.y * 0.11 + t * 0.085);
  var base = mix(uB, uA, smoothstep(-0.5, 0.7, K * 0.7 + swirl * 0.5));
  let heart = smoothstep(0.3, 0.95, K);
  base = mix(base, uC, heart * 0.7);
  base *= 0.16 + 0.12 * swirl;
  let f0 = mix(vec3f(0.055), base, 0.55 * uMetal);
  let fres = f0 + (vec3f(1.0) - f0) * pow(max(1.0 - nv, 0.0), 5.0);
  let r = reflect(-v, n);
  let rough = mix(0.36, 0.20, uMetal);
  var light = vec3f(0.020, 0.032, 0.05) * base;
  let l1 = normalize(vec3f(-0.45, 0.84, 0.35)); let l2 = normalize(vec3f(0.7, 0.32, -0.6));
  let nl = max(dot(n, l1), 0.0);
  light += base * (0.18 + nl * 0.55);
  light += ggx(n, v, l1, rough) * nl * vec3f(3.0, 3.1, 3.4) * fres;
  light += ggx(n, v, l2, rough + 0.1) * max(dot(n, l2), 0.0) * uC * 2.0 * fres;
  light += environment(r) * fres * (0.65 + uMetal * 0.8);
  let film = 0.5 + 0.5 * cos(vec3f(0.0, 2.1, 4.2) + (1.0 - nv) * 6.5 + ll * 1.4);
  let spectral = 0.5 + 0.5 * cos(vec3f(5.2, 3.1, 1.0) + (1.0 - nv) * 10.0 + ll * 2.8 + vFold * 0.18);
  let rim2 = pow(max(1.0 - nv, 0.0), 2.0);
  light += mix(uA, uB, film.r) * rim2 * 0.22;
  light += spectral * environment(r) * (0.025 + 0.12 * rim2) * uMicro;
  var tangent = vec3f(n.z, 0.0, -n.x) + vec3f(0.0001, 0.0, 0.0001);
  tangent = normalize(tangent - n * dot(tangent, n));
  let bitangent = cross(n, tangent);
  let halfway = normalize(v + l1);
  let ax = 0.38; let ay = 0.11;
  let ht = dot(halfway, tangent); let hb = dot(halfway, bitangent); let hn = max(0.001, dot(halfway, n));
  let den = ht * ht / (ax * ax) + hb * hb / (ay * ay) + hn * hn;
  let aniso = 1.0 / (PI * ax * ay * den * den);
  light += mix(vec3f(0.85, 0.94, 1.0), uC, 0.3) * min(aniso * nl * 0.018, 0.48) * fres * (0.25 + uMetal);
  let coat = ggx(n, v, l1, 0.13) * nl * 0.025;
  light += vec3f(0.9, 1.0, 1.08) * min(coat, 1.3) * (0.25 + uMetal * 0.75);
  let contour = line(ll * 4.2 + vFold * 0.22, 0.5);
  let secondary = line(ll * 15.0, 0.20) * 0.15;
  let grid = max(line(vXZ.x * 1.1, 0.3), line(vXZ.y * 1.1, 0.3));
  let pulse = 0.65 + 0.35 * sin(ll * 9.0 - t * 0.8);
  let lineColor = mix(uA, uC, smoothstep(-0.04, 0.07, vK));
  let frontWave = pow(0.5 + 0.5 * sin(ll * 11.0 - t * 0.9 + vXZ.x * 0.07), 18.0);
  light += (contour * (0.26 + frontWave * 0.38) + secondary) * lineColor * (0.4 + uGlow * 1.7) * uniforms.uContours;
  let interference = pow(0.5 + 0.5 * cos(ll * 33.0 + vFold * 0.8 - t * 0.11), 28.0);
  light += mix(uA, uC, swirl) * interference * 0.026 * uMicro * (0.25 + heart);
  let water = vXZ * 0.76 + vec2f(sin(ll * 1.3 + t * 0.07), cos(ll * 1.1 - t * 0.06)) * 0.45;
  let network = sin(water.x * 2.6 + sin(water.y * 1.3) + t * 0.16) + cos(water.y * 3.2 - sin(water.x * 1.6) - t * 0.12);
  let caustic = 1.0 - smoothstep(0.025, max(0.075, fwidth(network) * 1.6), abs(network));
  let beneath = smoothstep(1.15, 3.0, vLambda);
  light += mix(uA, uC, 0.55) * caustic * beneath * (0.045 + uGlow * 0.085) * uniforms.uCurrents;
  light += grid * mix(uA, vec3f(0.4, 0.55, 0.8), 0.4) * 0.038 * uniforms.uContours;
  light += base * pow(max(1.0 - nv, 0.0), 3.0) * 0.5;
  light += lineColor * pow(heart, 3.0) * 0.12 * pulse * uGlow;
  let cavity = clamp(0.7 + vPos.y * 0.035, 0.45, 1.0);
  light *= cavity;
  let fog = vec3f(0.008, 0.015, 0.028);
  let dist = length(uniforms.uEye - vPos);
  light = mix(light, fog, 1.0 - exp(-dist * 0.006));
  light = mix(fog, light, fade);
  fragmentOutputs.color = vec4f(display(light * fragmentInputs.vAO), 1.0);
}`;

/* ----------------------------------------------------------------------------------------------- veil (shaders/veil.glsl) */
const MF_VEIL_VS = `
attribute position: vec3f;
uniform worldView: mat4x4f; uniform projection: mat4x4f;
varying vPos: vec3f; varying vNormal: vec3f; varying vXZ: vec2f; varying vLambda: f32;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  loadArrays();
  let aXZ = vertexInputs.position.xz - 11.2;
  let m = metric(aXZ);
  let s = surfaceAt(aXZ, m);
  let phase = log(m.x) * 0.7 - uniforms.uTime * 0.14;
  let lift = 0.36 + 0.19 * sin(phase);
  let slope = s.yz + 0.133 * cos(phase) * m.yz / m.x;
  let pos = vec3f(aXZ.x, s.x + lift, aXZ.y);
  vertexOutputs.vPos = pos;
  vertexOutputs.vNormal = normalize(vec3f(-slope.x, 1.0, -slope.y));
  vertexOutputs.vXZ = aXZ;
  vertexOutputs.vLambda = m.x;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position.x, pos.y, vertexInputs.position.z, 1.0);
}`;
const MF_VEIL_FS = `
uniform uEye: vec3f; uniform uVeil: f32;
varying vPos: vec3f; varying vNormal: vec3f; varying vXZ: vec2f; varying vLambda: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  loadArrays();
  let vPos = fragmentInputs.vPos; let vXZ = fragmentInputs.vXZ; let vLambda = fragmentInputs.vLambda; let t = uniforms.uTime;
  let mask = smoothstep(1.18, 2.6, vLambda) * (1.0 - smoothstep(9.0, 10.7, max(abs(vXZ.x), abs(vXZ.y)))) * uniforms.uVeil;
  if (mask < 0.002) { discard; }
  var n = normalize(fragmentInputs.vNormal);
  let v = normalize(uniforms.uEye - vPos);
  if (dot(n, v) < 0.0) { n = -n; }
  let ll = log(vLambda);
  let rim = pow(1.0 - max(0.0, dot(n, v)), 3.0);
  let spectrum = 0.5 + 0.5 * cos(vec3f(0.3, 2.4, 4.6) + rim * 7.0 + ll * 1.8 - t * 0.045);
  let crest = abs(fract(ll * 6.5 - t * 0.024) - 0.5);
  let fringe = 1.0 - smoothstep(0.012, 0.04, crest);
  let softbox = pow(max(0.0, dot(reflect(-v, n), normalize(vec3f(-0.4, 0.85, 0.3)))), 45.0);
  let tint = mix(uniforms.uA, uniforms.uB, 0.5 + 0.5 * sin(ll * 1.7));
  let extra = tint * rim * 0.16 + spectrum * rim * 0.06 + mix(uniforms.uC, vec3f(1.0), 0.6) * softbox * 0.24 + tint * fringe * 0.06;
  fragmentOutputs.color = lightOut(extra * mask * (0.22 + rim * 0.25));
}`;

/* ----------------------------------------------------------------------------------------------- flow ribbons (shaders/flow.glsl) */
const MF_FLOW_VS = `
attribute position: vec3f;
attribute aPath: vec4f;    // x, z, cumulative planar arc length, trace id
attribute aRibbon: vec3f;  // planar tangent x/z, side (-1 or +1)
uniform worldView: mat4x4f; uniform projection: mat4x4f;
uniform uEye: vec3f; uniform uResolution: vec2f; uniform uPixelRatio: f32; uniform uRibbonWidth: f32;
varying vAlong: f32; varying vId: f32; varying vSide: f32; varying vFade: f32;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  loadArrays();
  let p = vertexInputs.aPath.xy;
  let m = metric(p);
  let s = surfaceAt(p, m);
  let pos = vec3f(p.x, s.x + 0.095, p.y);
  let flatTangent = normalize(vertexInputs.aRibbon.xy);
  let tangent = normalize(vec3f(flatTangent.x, dot(s.yz, flatTangent), flatTangent.y));
  let view = normalize(uniforms.uEye - pos);
  var side = cross(tangent, view);
  if (dot(side, side) < 1e-8) { side = vec3f(-flatTangent.y, 0.0, flatTangent.x); }
  side = normalize(side);
  let VP = uniforms.projection * uniforms.worldView;
  var clip = VP * vec4f(pos, 1.0);
  let projectedSide = VP * vec4f(side, 0.0);
  var screenSide = (projectedSide.xy * clip.w - clip.xy * projectedSide.w) * uniforms.uResolution;
  if (dot(screenSide, screenSide) < 1e-8) { screenSide = vec2f(1.0, 0.0); }
  screenSide = normalize(screenSide);
  let halfWidthCSS = uniforms.uRibbonWidth;
  let off = screenSide * vertexInputs.aRibbon.z * (2.0 * halfWidthCSS * uniforms.uPixelRatio / uniforms.uResolution) * clip.w;
  clip = vec4f(clip.xy + off, clip.zw);
  vertexOutputs.position = clip;
  vertexOutputs.vAlong = vertexInputs.aPath.z; vertexOutputs.vId = vertexInputs.aPath.w; vertexOutputs.vSide = vertexInputs.aRibbon.z;
  vertexOutputs.vFade = (1.0 - smoothstep(9.4, 10.9, max(abs(p.x), abs(p.y)))) * exp(-max(0.0, length(uniforms.uEye - pos) - 20.0) * 0.01);
}`;
const MF_FLOW_FS = `
uniform uRibbonGain: f32;
varying vAlong: f32; varying vId: f32; varying vSide: f32; varying vFade: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  loadArrays();
  let vSide = fragmentInputs.vSide; let vId = fragmentInputs.vId; let vAlong = fragmentInputs.vAlong;
  let r = abs(vSide);
  let aa = max(fwidth(vSide), 0.06);
  let edge = 1.0 - smoothstep(1.0 - aa * 0.5, 1.0 + aa * 0.5, r);
  let core = 1.0 - smoothstep(0.10, 0.43, r);
  let skirt = exp(-r * r * 2.2);
  let phase = fract(vAlong * 0.055 - uniforms.uTime * 0.10 - vId * 0.137);
  let packet = pow(max(0.0, 1.0 - abs(phase - 0.5) * 2.0), 18.0);
  let color = mix(uniforms.uA, uniforms.uC, 0.55 + 0.4 * sin(vId * 1.4));
  let alpha = edge * skirt * fragmentInputs.vFade * (0.16 + 0.28 * core + packet * 0.8) * (0.55 + uniforms.uGlow * 0.45);
  let radiance = color * (0.70 + 0.80 * core + packet * (1.8 + core * 2.5));
  fragmentOutputs.color = lightOut(radiance * alpha * uniforms.uRibbonGain);
}`;

/* ----------------------------------------------------------------------------------------------- filaments (shaders/fibers.glsl) */
const MF_FIBER_VS = `
attribute position: vec3f;
attribute aFiber: vec4f;
uniform worldView: mat4x4f; uniform projection: mat4x4f; uniform uEye: vec3f;
uniform uAnchors0: vec4f; uniform uAnchors1: vec4f; uniform uAnchors2: vec4f; uniform uAnchors3: vec4f; uniform uAnchors4: vec4f; uniform uAnchors5: vec4f; uniform uAnchors6: vec4f;
varying vSide: f32; varying vT: f32; varying vId: f32; varying vFade: f32;
fn curve(a: vec3f, b: vec3f, t: f32, id: f32) -> vec3f {
  var p = mix(a, b, t);
  let arch = sin(PI * t);
  p.y += arch * (5.8 + uniforms.uEnergy * 1.1 + 0.35 * sin(id * 1.7 + uniforms.uTime * 0.12));
  let side = normalize(vec3f(-(b.z - a.z), 0.0, b.x - a.x));
  p += side * sin(t * PI * 2.0 + id) * arch * 0.18;
  return p;
}
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let anchors = array<vec4f, 7>(uniforms.uAnchors0, uniforms.uAnchors1, uniforms.uAnchors2, uniforms.uAnchors3, uniforms.uAnchors4, uniforms.uAnchors5, uniforms.uAnchors6);
  let F = vertexInputs.aFiber;
  let ia = i32(F.x); let ib = i32(F.y); let t = F.z;
  let id = f32(ia) + f32(ib) * 0.37;
  let a = anchors[ia].xyz; let b = anchors[ib].xyz;
  var p = curve(a, b, t, id);
  let tangent = normalize(curve(a, b, min(0.9999, t + 0.004), id) - curve(a, b, max(0.0001, t - 0.004), id));
  var side = normalize(cross(tangent, normalize(uniforms.uEye - p)));
  let up = normalize(cross(tangent, side));
  let twist = t * 9.0 + uniforms.uTime * 0.22 + id * 0.8;
  side = side * cos(twist) + up * sin(twist);
  let width = 0.052 + 0.11 * pow(sin(PI * t), 2.0);
  p += side * F.w * width;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(p, 1.0);
  vertexOutputs.vSide = F.w; vertexOutputs.vT = t; vertexOutputs.vId = id;
  vertexOutputs.vFade = pow(max(0.0, sin(PI * t)), 0.35);
}`;
const MF_FIBER_FS = `
varying vSide: f32; varying vT: f32; varying vId: f32; varying vFade: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vSide = fragmentInputs.vSide; let vT = fragmentInputs.vT; let vId = fragmentInputs.vId; let t = uniforms.uTime;
  let edge = 1.0 - smoothstep(0.12, 1.0, abs(vSide));
  let packet = pow(max(0.0, 1.0 - abs(fract(vT - t * 0.095 + vId * 0.17) - 0.5) * 2.0), 26.0);
  var c = mix(uniforms.uA, uniforms.uC, 0.5 + 0.4 * sin(vId));
  let iridescence = 0.5 + 0.5 * cos(vec3f(0.0, 2.1, 4.2) + vT * 5.0 - t * 0.08 + vId);
  c = mix(c, iridescence, 0.12);
  let core = exp(-vSide * vSide * 90.0);
  let alpha = edge * fragmentInputs.vFade * (0.075 + core * 0.14 + packet * 0.5);
  fragmentOutputs.color = lightOut(c * (0.9 + packet * 3.5 + core * 0.25) * alpha * (0.6 + uniforms.uGlow * 0.4));
}`;

/* ----------------------------------------------------------------------------------------------- source nodes (shaders/nodes.glsl), sprite quads */
const MF_NODE_VS = `
attribute position: vec3f;
attribute corner: vec2f;
uniform worldView: mat4x4f; uniform projection: mat4x4f; uniform uViewport: vec2f;
uniform uAnchors0: vec4f; uniform uAnchors1: vec4f; uniform uAnchors2: vec4f; uniform uAnchors3: vec4f; uniform uAnchors4: vec4f; uniform uAnchors5: vec4f; uniform uAnchors6: vec4f;
uniform uPixelRatio: f32; uniform uSpriteScale: f32;
varying vId: f32; varying vCorner: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let anchors = array<vec4f, 7>(uniforms.uAnchors0, uniforms.uAnchors1, uniforms.uAnchors2, uniforms.uAnchors3, uniforms.uAnchors4, uniforms.uAnchors5, uniforms.uAnchors6);
  let aId = vertexInputs.position.x;
  let pos = anchors[i32(aId + 0.5)].xyz;
  var clip = uniforms.projection * uniforms.worldView * vec4f(pos, 1.0);
  let size = clamp(600.0 * uniforms.uPixelRatio / max(5.0, clip.w), 10.0, 50.0) * uniforms.uSpriteScale;
  clip = vec4f(clip.xy + vertexInputs.corner * size / uniforms.uViewport * clip.w, clip.zw);
  vertexOutputs.position = clip;
  vertexOutputs.vId = aId; vertexOutputs.vCorner = vertexInputs.corner;
}`;
const MF_NODE_FS = `
varying vId: f32; varying vCorner: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let q = fragmentInputs.vCorner;
  let r = dot(q, q);
  let halo = exp(-r * 6.0); let core = exp(-r * 130.0);
  let star = exp(-abs(q.x) * 75.0 - abs(q.y) * 6.0) + exp(-abs(q.y) * 75.0 - abs(q.x) * 6.0);
  let c = mix(uniforms.uA, uniforms.uC, 0.5 + 0.35 * sin(fragmentInputs.vId * 1.7));
  fragmentOutputs.color = lightOut(c * (0.7 + core * 7.0) * (halo * 0.25 + core * 0.65 + star * 0.08));
}`;

/* ----------------------------------------------------------------------------------------------- motes (shaders/particles.glsl), sprite quads */
const MF_MOTE_VS = `
attribute position: vec3f;
attribute color: vec4f;
attribute corner: vec2f;
uniform worldView: mat4x4f; uniform projection: mat4x4f; uniform uViewport: vec2f;
uniform uPixelRatio: f32; uniform uSpriteScale: f32;
varying vAlpha: f32; varying vCol: vec3f; varying vCorner: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  loadArrays();
  let aSeed = vec4f(vertexInputs.position.x, vertexInputs.position.z, vertexInputs.position.y, vertexInputs.color.r);
  let t = uniforms.uTime;
  let p = aSeed.xy + vec2f(sin(t * 0.035 + aSeed.z * 4.0), cos(t * 0.04 + aSeed.z * 3.0)) * 0.45;
  let m = metric(p);
  let s = surfaceAt(p, m);
  let lift = 0.18 + pow(aSeed.z, 3.0) * 3.8;
  let pos = vec3f(p.x, s.x + lift + 0.15 * sin(t * 0.4 + aSeed.w * 10.0), p.y);
  var clip = uniforms.projection * uniforms.worldView * vec4f(pos, 1.0);
  let size = clamp((1.0 + pow(aSeed.w, 8.0) * 3.0) * uniforms.uPixelRatio * 22.0 / max(4.0, clip.w), 1.0, 9.0) * uniforms.uSpriteScale;
  clip = vec4f(clip.xy + vertexInputs.corner * size / uniforms.uViewport * clip.w, clip.zw);
  vertexOutputs.position = clip;
  var alpha = (0.1 + 0.7 * pow(aSeed.w, 5.0)) * (0.65 + 0.35 * sin(t * 0.7 + aSeed.z * 23.0));
  alpha *= 1.0 - smoothstep(9.0, 11.0, max(abs(p.x), abs(p.y)));
  vertexOutputs.vAlpha = alpha;
  vertexOutputs.vCol = mix(uniforms.uA, uniforms.uC, aSeed.w);
  vertexOutputs.vCorner = vertexInputs.corner;
}`;
const MF_MOTE_FS = `
varying vAlpha: f32; varying vCol: vec3f; varying vCorner: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let r = length(fragmentInputs.vCorner);
  let a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.65, 1.0, r));
  fragmentOutputs.color = lightOut(fragmentInputs.vCol * 1.7 * a * fragmentInputs.vAlpha);
}`;

/* One entry per ComposedShader. Both stages carry the shared uniform declarations and common functions. `order` is the draw order (alphaIndex). */
const MF_PORTS = {
  sky:     { vs: MF_SKY_VS,     fs: MF_SKY_FS,     attrs: ['position'],                     order: 0, blend: false, usesArrays: true },
  surface: { vs: MF_SURFACE_VS, fs: MF_SURFACE_FS, attrs: ['position'],                     order: 1, blend: false },
  veil:    { vs: MF_VEIL_VS,    fs: MF_VEIL_FS,    attrs: ['position'],                     order: 2, blend: true },
  flow:    { vs: MF_FLOW_VS,    fs: MF_FLOW_FS,    attrs: ['position', 'aPath', 'aRibbon'],  order: 3, blend: true },
  fiber:   { vs: MF_FIBER_VS,   fs: MF_FIBER_FS,   attrs: ['position', 'aFiber'],            order: 4, blend: true },
  node:    { vs: MF_NODE_VS,    fs: MF_NODE_FS,    attrs: ['position', 'corner'],            order: 5, blend: true, sprite: true },
  mote:    { vs: MF_MOTE_VS,    fs: MF_MOTE_FS,    attrs: ['position', 'color', 'corner'],   order: 6, blend: true, sprite: true },
};
/* vertex-hash + '-' + fragment-hash of the whitespace-collapsed GLSL in scenes/manifold.x3d (manifold/census.py prints them; build-manifold.py re-checks) */
const MF_BY_HASH = {
  'fae893dd-6e5177d1': 'sky', '4ab8e2fd-7527f1ed': 'surface', '1aabd540-95625852': 'veil', '4e3e809c-b8a2a89f': 'flow',
  '208a5a28-9fef8453': 'fiber', 'aa40821b-2e6d7745': 'node', '3cb55e19-49662f42': 'mote',
};
