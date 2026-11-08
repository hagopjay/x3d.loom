/* Registry and material factory for the WGSL ports of the Gobbler 3 GLSL programs (x3d.webgpu/demo/src/gobbler/).
   Concatenated after brain/wgsl.js in one bundle scope; the per-shader files (wgsl-sky.js, wgsl-eye.js, ...) call gobRegister().
   One code path makes every material, for the page and for port-test.html, so what the test compiles is what the page runs.

   A port is { key, kind, attrs, uniforms, vs, fs, notes }.
     key       'VVVVVVVV-FFFFFFFF', the FNV-1a hashes of the whitespace-collapsed vertex and fragment GLSL (build-gobbler.py prints them).
     kind      'mesh' (triangles from IndexedFaceSet), 'points' (one quad per PointSet point, see below) or 'hidden' (draws nothing).
     attrs     Babylon vertex attribute names, position first: any of 'position' vec3f, 'normal' vec3f, 'color' vec4f, 'tc0' vec3f, 'corner' vec2f.
     uniforms  { name: 'f32' | 'vec3f' }: the ComposedShader fields the GLSL declares (phase, time, glow, bloom, scan, light0..light3).
     vs, fs    WGSL in Babylon's dialect (see brain/wgsl.js for the pattern: attribute/uniform/varying declarations, @vertex fn main(input: VertexInputs)).
   Uniforms the body always supplies, declare only the ones you use: worldView mat4x4f (model-view), projection mat4x4f, viewport vec4f (0, 0, width px, height px). */
const GOB_PORTS = {}, GOB_BY_HASH = {};
function gobRegister(name, port) { GOB_PORTS[name] = port; GOB_BY_HASH[port.key] = name; }

function gobMakeMaterial(scene, name, port, label) {
  const tag = 'gob-' + name;
  BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'VertexShader'] = port.vs;
  BABYLON.ShaderStore.ShadersStoreWGSL[tag + 'FragmentShader'] = port.fs;
  const m = new BABYLON.ShaderMaterial((label || tag), scene, { vertex: tag, fragment: tag },
    { attributes: port.attrs, uniforms: ['worldView', 'projection', 'viewport', ...Object.keys(port.uniforms || {})], shaderLanguage: BABYLON.ShaderLanguage.WGSL, needAlphaBlending: true });
  m.alphaMode = BABYLON.Engine.ALPHA_COMBINE;          // SRC_ALPHA, ONE_MINUS_SRC_ALPHA on colour: what X_ITE does for alphaMode BLEND
  m.backFaceCulling = false; m.disableDepthWrite = true;
  m.setVector4('viewport', new BABYLON.Vector4(0, 0, 640, 360));
  for (const [u, t] of Object.entries(port.uniforms || {})) gobSetUniform(m, u, t, t === 'f32' ? 0 : [0, 0, 0]);
  return m;
}
function gobSetUniform(m, name, type, v) {
  if (type === 'f32') m.setFloat(name, +v);
  else if (type === 'vec3f') m.setVector3(name, new BABYLON.Vector3(v[0], v[1], v[2]));
}
