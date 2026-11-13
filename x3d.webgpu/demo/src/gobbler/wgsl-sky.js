/* Sky and Hide: the backdrop dome and the "draw nothing" program. Term-for-term from the GLSL in gobbler3.x3d (SkyShader, Hide). */
gobRegister('sky', {
  key: '57378568-b3067a52', kind: 'mesh', attrs: ['position'], uniforms: {},
  notes: 'fragment dither uses the fragment position (WebGPU origin is top-left, GL bottom-left): the noise pattern is mirrored, its amplitude is the same',
  vs: `
attribute position: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vDir: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vDir = vertexInputs.position;
  vertexOutputs.position = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
}`,
  fs: `
varying vDir: vec3f;
fn h1(p0: vec3f) -> f32 { var p = fract(p0 * 0.3183099 + 0.1); p = p * 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  var f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3f(1, 0, 0)), f.x), mix(h1(i + vec3f(0, 1, 0)), h1(i + vec3f(1, 1, 0)), f.x), f.y),
             mix(mix(h1(i + vec3f(0, 0, 1)), h1(i + vec3f(1, 0, 1)), f.x), mix(h1(i + vec3f(0, 1, 1)), h1(i + vec3f(1, 1, 1)), f.x), f.y), f.z);
}
fn h2(p: vec2f) -> f32 { var p3 = fract(vec3f(p.xyx) * 0.1031); p3 = p3 + dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let d = normalize(fragmentInputs.vDir);
  let f = smoothstep(0.0, 0.4, -d.z);
  let q = d.xy / max(-d.z, 0.1);
  let a = (q - vec2f(-0.075, 0.03)) * vec2f(1.0, 1.3);
  let b = q - vec2f(0.2, -0.05);
  let n = vnoise(d * 9.0) * 0.6 + vnoise(d * 21.0) * 0.4;
  var col = vec3f(0.057, 0.050, 0.047)
          + f * vec3f(0.15, 0.095, 0.045) * exp(-dot(a, a) / 0.03) * (0.8 + 0.4 * n)
          + f * vec3f(0.085, 0.022, 0.032) * exp(-dot(b, b) / 0.05) * (0.7 + 0.6 * n)
          + f * vec3f(0.03, 0.02, 0.012) * smoothstep(0.55, 0.9, n) * exp(-dot(q, q) / 0.12);
  let fc = fragmentInputs.position.xy;
  col = col + (h2(fc) + h2(fc.yx + 17.0) - 1.0) / 255.0;
  fragmentOutputs.color = vec4f(col, 1.0);
}`,
});
// Hide has no pixels: every vertex is moved outside the clip volume and the fragment shader only discards.
gobRegister('hide', { key: '1a42dc70-060b0505', kind: 'hidden', attrs: ['position'], uniforms: {}, notes: 'the body builds no mesh for it', vs: '', fs: '' });
