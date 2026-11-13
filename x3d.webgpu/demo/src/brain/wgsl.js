/* WGSL ports of the six distinct GLSL parts in the brain and torso scenes (4 ComposedShaders in the brain hero, 16 in the torso).
   A port is chosen by the FNV-1a hash of the whitespace-collapsed GLSL, as in the Collider page, so edited GLSL falls back to the plain material.
   Babylon's WGSL ShaderMaterial wants `attribute`, `uniform name: type;` and `varying` declarations and the VertexInputs / FragmentInputs entry points.
   Each port is a term-for-term translation of the GLSL (same constants, same order of operations); the GLSL itself stays in the X3D file. */

const VERT_BRAIN = `
attribute position: vec3f;
attribute normal: vec3f;
attribute color: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vN: vec3f;
varying vP: vec3f;
varying vAO: f32;
varying vRel: f32;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let p = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vP = p.xyz;
  vertexOutputs.vN = (uniforms.worldView * vec4f(vertexInputs.normal, 0.0)).xyz;
  vertexOutputs.vAO = clamp((vertexInputs.color.g - 0.17) / 0.83, 0.0, 1.0);
  vertexOutputs.vRel = p.z - (uniforms.worldView * vec4f(0.0, 0.0, 0.0, 1.0)).z;
  vertexOutputs.position = uniforms.projection * p;
}`;

const FRAG_CORTEX = `
uniform rimColor: vec3f; uniform rimColor2: vec3f; uniform bodyColor: vec3f;
uniform rimPower: f32; uniform baseAlpha: f32; uniform rimAlpha: f32; uniform aoGamma: f32; uniform specular: f32; uniform backDim: f32; uniform sulcAlpha: f32;
uniform sulcColor: vec3f; uniform sulcLo: f32; uniform sulcHi: f32;
uniform edgeColor: vec3f; uniform edgeAlpha: f32; uniform edgeLo: f32; uniform edgeW: f32; uniform farDim: f32; uniform farR: f32;
uniform passMode: f32;
varying vN: vec3f; varying vP: vec3f; varying vAO: f32; varying vRel: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let N = normalize(fragmentInputs.vN);
  let V = normalize(-fragmentInputs.vP);
  let d = dot(N, V);
  let fr = step(0.0, d);
  let ndv = abs(d);
  let Nf = select(N, -N, d < 0.0);
  let ao = pow(clamp(fragmentInputs.vAO, 0.0, 1.0), uniforms.aoGamma);
  let cr = smoothstep(uniforms.sulcLo, uniforms.sulcHi, ao);
  let f = pow(1.0 - ndv, uniforms.rimPower);
  let hue = smoothstep(-0.15, 0.95, N.x * 0.85 - N.y * 0.55 + 0.25 * sin(fragmentInputs.vP.y * 0.045 + fragmentInputs.vP.x * 0.03));
  var rimc = mix(uniforms.rimColor, uniforms.rimColor2, hue);
  let film = 0.5 + 0.5 * cos(6.2831853 * (ndv * 1.7 + 0.35 * ao));
  rimc = mix(rimc, rimc.zxy * vec3f(0.9, 1.0, 1.0) + vec3f(0.1), 0.28 * film * f);
  let L1 = normalize(vec3f(-0.5, 0.7, 0.55));
  let H1 = normalize(L1 + V);
  let L2 = normalize(vec3f(0.85, -0.15, 0.45));
  let H2 = normalize(L2 + V);
  let s1 = pow(max(dot(Nf, H1), 0.0), 90.0) * (0.2 + 0.8 * cr);
  let s2 = pow(max(dot(Nf, H2), 0.0), 30.0) * 0.30 * cr;
  let dif = 0.6 + 0.4 * dot(Nf, L1);
  let body = mix(uniforms.sulcColor, uniforms.bodyColor * dif, cr);
  let aBody = mix(uniforms.sulcAlpha, uniforms.baseAlpha, cr);
  let aRim = uniforms.rimAlpha * f * (0.35 + 0.65 * cr);
  let k = mix(uniforms.backDim, 1.0, fr);
  let spec = (vec3f(1.0, 0.97, 0.92) * s1 + vec3f(0.45, 0.75, 1.0) * s2) * uniforms.specular * fr;
  var aSp = clamp((s1 + s2) * uniforms.specular, 0.0, 1.0) * fr;
  var aTot = clamp((aBody + aRim) * k, 0.0, 1.0);
  var col = (body * aBody + rimc * aRim) / max(aBody + aRim, 0.001);
  let ridge = smoothstep(uniforms.edgeLo, uniforms.edgeLo + uniforms.edgeW, ao) * (1.0 - smoothstep(uniforms.edgeLo + uniforms.edgeW, uniforms.edgeLo + 2.2 * uniforms.edgeW, ao));
  let aEdge = clamp(uniforms.edgeAlpha * ridge * (0.5 + 0.5 * pow(max(dot(Nf, H1), 0.0), 2.0)), 0.0, 1.0) * mix(0.35, 1.0, fr);
  col = mix(col, uniforms.edgeColor, aEdge / max(aTot + aEdge, 0.001));
  aTot = aTot + aEdge * (1.0 - aTot);
  let depthK = mix(uniforms.farDim, 1.0, smoothstep(-uniforms.farR, 0.35 * uniforms.farR, fragmentInputs.vRel));
  aTot = aTot * depthK;
  aSp = aSp * depthK;
  let a = clamp(aTot + aSp * (1.0 - aTot), 0.0, 1.0);
  col = mix(col, spec / max(aSp, 0.001) + col * 0.0, clamp(aSp / max(a, 0.001), 0.0, 1.0));
  fragmentOutputs.color = vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), a);
}`;

const FRAG_AURA = `
uniform auraColor: vec3f; uniform auraColor2: vec3f; uniform auraPower: f32; uniform auraAlpha: f32;
uniform passMode: f32;
varying vN: vec3f; varying vP: vec3f; varying vAO: f32; varying vRel: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let N = normalize(fragmentInputs.vN);
  let V = normalize(-fragmentInputs.vP);
  let d = dot(N, V);
  let f = pow(1.0 - clamp(d, 0.0, 1.0), uniforms.auraPower) * step(0.0, d);
  let hue = smoothstep(-0.55, 0.65, N.x * 0.85 - N.y * 0.55);
  fragmentOutputs.color = vec4f(mix(uniforms.auraColor, uniforms.auraColor2, hue),
    clamp(f * uniforms.auraAlpha * (0.4 + 0.6 * smoothstep(0.0, 0.8, fragmentInputs.vAO)) * mix(0.35, 1.0, smoothstep(-70.0, 25.0, fragmentInputs.vRel)), 0.0, 1.0));
}`;

const VERT_TORSO = `
attribute position: vec3f;
attribute normal: vec3f;
attribute color: vec4f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
uniform useColor: f32;
varying vN: vec3f;
varying vP: vec3f;
varying vO: vec3f;
varying vC: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let p = uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vP = p.xyz;
  vertexOutputs.vO = vertexInputs.position;
  vertexOutputs.vN = normalize((uniforms.worldView * vec4f(vertexInputs.normal, 0.0)).xyz);
  vertexOutputs.vC = select(vec2f(1.0), vertexInputs.color.rg, uniforms.useColor > 0.5);
  vertexOutputs.position = uniforms.projection * p;
}`;

const FRAG_TORSO_GLASS = `
uniform rimColor: vec3f; uniform bodyColor: vec3f; uniform rimPower: f32; uniform baseAlpha: f32; uniform rimAlpha: f32;
uniform smoke: f32; uniform time: f32;
varying vN: vec3f; varying vP: vec3f; varying vO: vec3f; varying vC: vec2f;
fn hash(p0: vec3f) -> f32 {
  var p = fract(p0 * 0.3183099 + vec3f(0.1));
  p = p * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3f(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 0.0)), hash(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3f(0.0, 0.0, 1.0)), hash(i + vec3f(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3f(0.0, 1.0, 1.0)), hash(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let N = normalize(fragmentInputs.vN);
  let V = normalize(-fragmentInputs.vP);
  let ndv = abs(dot(N, V));
  let f = pow(1.0 - ndv, uniforms.rimPower);
  let ao = fragmentInputs.vC.x;
  let fade = fragmentInputs.vC.y;
  var col = mix(uniforms.bodyColor * ao, uniforms.rimColor, f);
  var a = mix(uniforms.baseAlpha, uniforms.rimAlpha, f) * mix(1.4, 0.8, ao);
  if (uniforms.smoke > 0.0) {
    let q = fragmentInputs.vO * 0.016 + vec3f(0.0, uniforms.time * 0.035, uniforms.time * 0.02);
    let n = 0.55 * vnoise(q) + 0.30 * vnoise(q * 2.3 + vec3f(7.1)) + 0.15 * vnoise(q * 5.1 + vec3f(3.3));
    let s = smoothstep(0.30, 0.70, n);
    a = a * mix(1.0, 0.2 + 1.25 * s, uniforms.smoke);
    col = mix(col, col * (0.6 + 0.8 * s), uniforms.smoke);
  }
  fragmentOutputs.color = vec4f(col, clamp(a * fade, 0.0, 1.0));
}`;

const FRAG_TORSO_HALO = `
uniform rimColor: vec3f; uniform rimPower: f32; uniform intensity: f32;
varying vN: vec3f; varying vP: vec3f; varying vO: vec3f; varying vC: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let N = normalize(fragmentInputs.vN);
  let V = normalize(-fragmentInputs.vP);
  let f = pow(1.0 - abs(dot(N, V)), uniforms.rimPower);
  let a = clamp(f * uniforms.intensity * fragmentInputs.vC.y, 0.0, 1.0);
  fragmentOutputs.color = vec4f(uniforms.rimColor, a);
}`;

/* wide lines (LineProperties.linewidthScaleFactor): one quad per segment, expanded in the vertex shader to a pixel width.
   Attributes per corner: position (this end), other (the far end), side (-1 or +1, and 0 / 1 for which end in uv.x). */
const VERT_RIBBON = `
attribute position: vec3f;
attribute other: vec3f;
attribute color: vec4f;
attribute uv: vec2f;
uniform worldViewProjection: mat4x4f;
uniform viewport: vec2f;
uniform widthPx: f32;
uniform tint: vec3f;
varying vC: vec4f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let a = uniforms.worldViewProjection * vec4f(vertexInputs.position, 1.0);
  let b = uniforms.worldViewProjection * vec4f(vertexInputs.other, 1.0);
  let sa = a.xy / a.w * uniforms.viewport * 0.5;
  let sb = b.xy / max(b.w, 1e-5) * uniforms.viewport * 0.5;
  var dir = sb - sa;
  let l = length(dir);
  dir = select(vec2f(1.0, 0.0), dir / l, l > 1e-6);
  let nrm = vec2f(-dir.y, dir.x);
  let off = nrm * vertexInputs.uv.y * uniforms.widthPx * 0.5 * 2.0 / uniforms.viewport;
  vertexOutputs.position = vec4f(a.xy + off * a.w, a.z, a.w);
  vertexOutputs.vC = vec4f(vertexInputs.color.rgb * uniforms.tint, vertexInputs.color.a);
}`;
const FRAG_RIBBON = `
uniform alpha: f32;
varying vC: vec4f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  fragmentOutputs.color = vec4f(fragmentInputs.vC.rgb, uniforms.alpha);
}`;

/* textured Shapes with no Material are unlit in X3D: colour = texel, alpha = texel alpha (straight, source-over). Texel values are written as stored, as X_ITE does. */
const VERT_UNLIT = `
attribute position: vec3f;
attribute uv: vec2f;
uniform worldViewProjection: mat4x4f;
varying vUV: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.worldViewProjection * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vUV = vertexInputs.uv;
}`;
const FRAG_UNLIT = `
var tex0Sampler: sampler;
var tex0: texture_2d<f32>;
uniform opacity: f32;
varying vUV: vec2f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let c = textureSample(tex0, tex0Sampler, fragmentInputs.vUV);
  fragmentOutputs.color = vec4f(c.rgb, c.a * uniforms.opacity);
}`;

const normSrc = (s) => s.replace(/\s+/g, ' ').trim();
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

/* key = fnv1a(vertex) + '-' + fnv1a(fragment) over the GLSL as the scene carries it; filled in by tools (build-brain.py prints and checks them) */
const WGSL_PORTS = {
  cortex: { vs: VERT_BRAIN, fs: FRAG_CORTEX, attrs: ['position', 'normal', 'color'], uniforms: ['rimColor', 'rimColor2', 'bodyColor', 'rimPower', 'baseAlpha', 'rimAlpha', 'aoGamma', 'specular', 'backDim', 'sulcAlpha', 'sulcColor', 'sulcLo', 'sulcHi', 'edgeColor', 'edgeAlpha', 'edgeLo', 'edgeW', 'farDim', 'farR', 'passMode'] },
  aura: { vs: VERT_BRAIN, fs: FRAG_AURA, attrs: ['position', 'normal', 'color'], uniforms: ['auraColor', 'auraColor2', 'auraPower', 'auraAlpha', 'passMode'] },
  torsoGlass: { vs: VERT_TORSO, fs: FRAG_TORSO_GLASS, attrs: ['position', 'normal', 'color'], uniforms: ['useColor', 'rimColor', 'bodyColor', 'rimPower', 'baseAlpha', 'rimAlpha', 'smoke', 'time'] },
  torsoHalo: { vs: VERT_TORSO, fs: FRAG_TORSO_HALO, attrs: ['position', 'normal', 'color'], uniforms: ['useColor', 'rimColor', 'rimPower', 'intensity'] },
};
/* vertex-hash + '-' + fragment-hash of the whitespace-collapsed GLSL (computed from the lite scenes; build-brain.py re-checks them against the page's own scene files) */
const WGSL_BY_HASH = {
  'c89ae27e-c9456c60': 'cortex', 'c89ae27e-0afe3b95': 'aura',
  '4e142744-2250c51b': 'torsoGlass', '4e142744-f37b0ce5': 'torsoHalo',
};

function shaderSource(part) {
  for (const u of part.f.url) {
    if (/^\s*data:/i.test(u)) {
      const c = u.indexOf(','), head = u.slice(0, c);
      let body = u.slice(c + 1);
      if (/;base64/i.test(head)) { try { body = atob(body); } catch { body = ''; } }
      else if (/%[0-9a-f]{2}/i.test(body)) { try { body = decodeURIComponent(body); } catch { /* keep the raw text */ } }
      return body;
    }
    if (/void\s+main/.test(u)) return u;
  }
  return '';
}
