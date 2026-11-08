/* EyeShader: the iris, rings and the star the eye becomes while the head is apart. Term-for-term from the GLSL in gobbler3.x3d. */
gobRegister('eye', {
  key: '50c500f7-7a46fca5', kind: 'mesh', attrs: ['position'], uniforms: { time: 'f32', phase: 'f32' },
  notes: 'clip z bias: GLSL z -= 0.004 w on a [-1,1] depth range is 0.002 w on WebGPU [0,1]',
  vs: `
attribute position: vec3f;
uniform worldView: mat4x4f;
uniform projection: mat4x4f;
varying vP: vec2f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vP = vertexInputs.position.xy;
  var gp = uniforms.projection * uniforms.worldView * vec4f(vertexInputs.position, 1.0);
  gp.z = gp.z - 0.002 * gp.w;
  vertexOutputs.position = gp;
}`,
  fs: `
uniform time: f32;
uniform phase: f32;
varying vP: vec2f;
fn ring(r: f32, R: f32, w: f32, aa: f32) -> f32 { return 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, abs(r - R)); }
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let vP = fragmentInputs.vP;
  let r = length(vP);
  let aa = (abs(dpdx(r)) + abs(dpdy(r))) * 1.2 + 1e-4;
  let ang = atan2(vP.y, vP.x);
  let iris = 1.0 - smoothstep(0.2 - aa, 0.2 + aa, r);
  let fib = 0.5 + 0.5 * sin(ang * 27.0 + sin(ang * 5.0) * 2.5);
  var ic = mix(vec3f(1.0, 0.6, 0.14), vec3f(0.6, 0.24, 0.04), smoothstep(0.1, 0.2, r)) * (0.7 + 0.3 * fib);
  ic = mix(ic, vec3f(0.16, 0.05, 0.015), smoothstep(0.165, 0.2, r));
  ic = mix(ic, vec3f(0.018, 0.011, 0.008), 1.0 - smoothstep(0.105 - aa, 0.105 + aa, r));
  let c1 = vP - vec2f(-0.055, 0.065);
  let c2 = vP - vec2f(0.06, -0.045);
  ic = ic + vec3f(1.0, 0.97, 0.9) * (exp(-dot(c1, c1) * 1100.0) + 0.45 * exp(-dot(c2, c2) * 3000.0));
  let rg = ring(r, 0.26, 0.012, aa) + 0.8 * ring(length(vP * vec2f(1.0, 1.111)), 0.36, 0.01, aa)
         + 0.6 * ring(length(vP * vec2f(1.0, 1.25)), 0.46, 0.008, aa);
  let gw = exp(-pow((r - 0.2) * 14.0, 2.0)) * 0.4 * (1.0 - iris);
  var em = ic * iris + vec3f(0.95, 0.85, 0.6) * rg * (1.0 - iris) + vec3f(1.0, 0.58, 0.18) * gw;
  var a = clamp(iris + rg + gw, 0.0, 1.0);
  let st = smoothstep(0.17, 0.24, uniforms.phase) * (1.0 - smoothstep(0.84, 0.93, uniforms.phase));
  let tw = 0.8 + 0.2 * sin(uniforms.time * 2.3);
  let core = exp(-r * r * 260.0);
  let spk = (exp(-abs(vP.y) * 90.0) * exp(-abs(vP.x) * 6.0) + exp(-abs(vP.x) * 90.0) * exp(-abs(vP.y) * 6.0)) * 1.1;
  let star = clamp((core * 1.2 + spk + exp(-r * r * 28.0) * 0.35) * tw, 0.0, 1.0);
  let sc = mix(vec3f(1.0, 0.62, 0.22), vec3f(1.0, 0.95, 0.82), clamp(core * 1.5 + spk * 0.6, 0.0, 1.0));
  em = mix(em, sc * star, st);
  a = mix(a, star, st);
  if (a < 0.004) { discard; }
  fragmentOutputs.color = vec4f(min(em / max(a, 1e-3), vec3f(1.0)), a);
}`,
});
