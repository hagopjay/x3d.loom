/* WGSL ports of the Manifold of Emotion shaders (SCAFFOLD: untested, not yet wired into a build).
   Source of truth stays the GLSL inside scenes/manifold.x3d (x3d.STEM studies/manifold, shaders/*.glsl). Each port is chosen by the FNV-1a hash of the
   whitespace-collapsed GLSL (see wgsl.js), so edited GLSL falls back and says so on screen (law 40).
   Babylon WGSL ShaderMaterial conventions are those of brain/wgsl.js: `attribute`, `uniform name: type;`, `varying`, VertexInputs / FragmentInputs, vertexOutputs.position.
   GLSL -> WGSL traps to check on the first compile:
     fwidth(x)            -> abs(dpdx(x)) + abs(dpdy(x)); must run in uniform control flow, so compute it BEFORE any `discard` branch or use the no-discard form
     gl_FrontFacing       -> fragmentInputs.frontFacing (verify the name and the handedness in Babylon; right-handed scene flips winding)
     mod(x, y)            -> x - y * floor(x / y)   (WGSL % truncates)
     tanh, log, exp, pow  -> same names; pow(x, y) is undefined for x < 0, guard as the GLSL does
     uniform vec4 u[7]    -> try `uniform uSources: array<vec4f, 7>;` with setArray4; else seven vec4f uniforms copied into a var<private> array in main()
     gl_PointSize         -> not in WebGPU: see body-manifold.js (points become 4-vertex quads; `corner` attribute; size in pixels in the vertex shader)
     discard              -> discard;   (demote-to-helper semantics in current WGSL)
   The vertex shaders do the heavy math (metric + surface per vertex, ~25 evaluations with ambient occlusion over 513 x 513 vertices): keep loops as written. */

/* The shared `common` block, term for term from shaders/common.glsl. Prepended to every vertex and fragment port (the GLSL does the same). */
const MF_PRELUDE = `
const PI: f32 = 3.141592653589793;
uniform uTime: f32; uniform uEnergy: f32; uniform uBreath: f32; uniform uFold: f32; uniform uGlow: f32; uniform uMetal: f32;
uniform uContours: f32; uniform uMicro: f32; uniform uCurrents: f32;
uniform uSources0: vec4f; uniform uSources1: vec4f; uniform uSources2: vec4f; uniform uSources3: vec4f; uniform uSources4: vec4f; uniform uSources5: vec4f; uniform uSources6: vec4f;
uniform uShape0: vec4f; uniform uShape1: vec4f; uniform uShape2: vec4f; uniform uShape3: vec4f; uniform uShape4: vec4f; uniform uShape5: vec4f; uniform uShape6: vec4f;
uniform uPulse0: vec4f; uniform uPulse1: vec4f; uniform uPulse2: vec4f; uniform uPulse3: vec4f; uniform uPulse4: vec4f; uniform uPulse5: vec4f; uniform uPulse6: vec4f; uniform uPulse7: vec4f;
uniform uA: vec3f; uniform uB: vec3f; uniform uC: vec3f;

fn sourcesAt(i: i32) -> vec4f { switch (i) { case 0: { return uniforms.uSources0; } case 1: { return uniforms.uSources1; } case 2: { return uniforms.uSources2; } case 3: { return uniforms.uSources3; } case 4: { return uniforms.uSources4; } case 5: { return uniforms.uSources5; } default: { return uniforms.uSources6; } } }
fn shapeAt(i: i32) -> vec4f { switch (i) { case 0: { return uniforms.uShape0; } case 1: { return uniforms.uShape1; } case 2: { return uniforms.uShape2; } case 3: { return uniforms.uShape3; } case 4: { return uniforms.uShape4; } case 5: { return uniforms.uShape5; } default: { return uniforms.uShape6; } } }
fn pulseAt(i: i32) -> vec4f { switch (i) { case 0: { return uniforms.uPulse0; } case 1: { return uniforms.uPulse1; } case 2: { return uniforms.uPulse2; } case 3: { return uniforms.uPulse3; } case 4: { return uniforms.uPulse4; } case 5: { return uniforms.uPulse5; } case 6: { return uniforms.uPulse6; } default: { return uniforms.uPulse7; } } }

// (lambda, d lambda/dx, d lambda/dz, Laplacian of lambda), lambda = 1 + seven anisotropic Gaussians
fn metric(p: vec2f) -> vec4f {
  var r = vec4f(1.0, 0.0, 0.0, 0.0);
  for (var i = 0; i < 7; i++) {
    let S = sourcesAt(i); let H = shapeAt(i);
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
// TODO(port): foldSurface(p), surface(p, m), heightAt(p), hash(p), display(c), overlay(F), lightOut(F) -- copy shaders/common.glsl line for line.
`;

/* One entry per ComposedShader. vs/fs are the GLSL ports' WGSL; attrs are Babylon vertex attribute names; uniforms lists every `uniform` the port declares.
   Keys are from manifold/census.py (C, 7 Nov 2026). */
const MF_PORTS = {
  sky:     { vs: null, fs: null, attrs: ['position'], todo: 'shaders/background.glsl: full-screen triangle at z = .999999; hash() stars; uResolution' },
  surface: { vs: null, fs: null, attrs: ['position'], todo: 'shaders/surface.glsl: occlusion() 8 x 3 loop, ggx(), environment(), line() with fwidth; uAOStrength, uEye, uLineScale' },
  veil:    { vs: null, fs: null, attrs: ['position'], todo: 'shaders/veil.glsl: lift above the basins; discard on mask; lightOut()' },
  flow:    { vs: null, fs: null, attrs: ['position', 'aPath', 'aRibbon'], todo: 'shaders/flow.glsl: constant-pixel ribbons (uResolution, uPixelRatio, uRibbonWidth); fwidth(vSide)' },
  fiber:   { vs: null, fs: null, attrs: ['position', 'aFiber'], todo: 'shaders/fibers.glsl: curve() twice for the tangent; int(aFiber.x) anchors; uAnchors[7]' },
  node:    { vs: null, fs: null, attrs: ['position', 'corner'], todo: 'shaders/nodes.glsl: sprite quad, gl_PointSize = clamp(600 * ratio / max(5, w), 10, 50) * uSpriteScale pixels' },
  mote:    { vs: null, fs: null, attrs: ['position', 'color', 'corner'], todo: 'shaders/particles.glsl: seed = (x, z, y, color.r); sprite size clamp(.., 1, 9)' },
};
const MF_BY_HASH = {
  'fae893dd-6e5177d1': 'sky', '4ab8e2fd-7527f1ed': 'surface', '1aabd540-95625852': 'veil', '4e3e809c-b8a2a89f': 'flow',
  '208a5a28-9fef8453': 'fiber', 'aa40821b-2e6d7745': 'node', '3cb55e19-49662f42': 'mote',
};
