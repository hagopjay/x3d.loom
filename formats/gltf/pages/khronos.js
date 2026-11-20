// Reference page: Khronos glTF Sample Renderer (@khronosgroup/gltf-viewer), the renderer Khronos publishes for the glTF 2.0 BRDF.
// Entry: window.__render({size, cameraIndex}) -> receipt part. Lighting = only the glb's KHR_lights_punctual lights; no IBL, no
// generated key/fill lights, tone map NONE (linear, clamped at 1.0), exposure 1, clear colour #20242c.
import { GltfView, GltfState } from '/nm/@khronosgroup/gltf-viewer/dist/gltf-viewer.module.js';

const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

window.__render = async function (p) {
  const notes = [];
  const canvas = document.createElement('canvas');
  canvas.width = p.size; canvas.height = p.size;
  canvas.style.width = `${p.size}px`; canvas.style.height = `${p.size}px`;
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
  const view = new GltfView(gl);
  const state = view.createState();
  const loader = view.createResourceLoader(undefined, undefined, '/nm/@khronosgroup/gltf-viewer/dist/libs/');
  const t0 = performance.now();
  // The renderer binds an environment even with IBL off (u_EnvIntensity is then forced to 0.0): give it a black 16x8 panorama.
  state.environment = await loader.loadEnvironment('/pages/black-16x8.hdr', { lut_sheen_E_file: '/pages/stub-lut-sheen-E.png' });
  notes.push('environment = black 16x8 HDR with IBL off (intensity forced 0); sheen-E LUT is a 1x1 black stub, so KHR_materials_sheen is NOT reference-grade here');
  state.gltf = await loader.loadGltf('/model.glb');
  const loadMs = performance.now() - t0;
  state.sceneIndex = state.gltf.scene ?? 0;
  state.cameraIndex = p.cameraIndex;
  const rp = state.renderingParameters;
  rp.useIBL = false;
  rp.renderEnvironmentMap = false;
  rp.usePunctual = true;
  rp.useDirectionalLightsWithDisabledIBL = false;
  rp.toneMap = GltfState.ToneMaps.NONE;
  rp.exposure = 1.0;
  rp.clearColor = [32 / 255, 36 / 255, 44 / 255, 1]; // floats: gl.clearColor is called with these as-is (the default [58,64,74,255] clamps to white)
  state.animationIndices = [];
  const t1 = performance.now();
  for (let i = 0; i < 4; i++) { view.renderFrame(state, p.size, p.size); await raf(); }
  const settleMs = performance.now() - t1;
  return {
    engine: 'khronos-sample-renderer',
    lighting: { source: 'glb', ibl: false, generatedLights: false, lightsInGlb: (state.gltf.extensions?.KHR_lights_punctual?.lights ?? []).length },
    colour: { toneMap: rp.toneMap, exposure: rp.exposure, clearColor: rp.clearColor, note: 'sRGB encode in the renderer\'s final shader (linearTosRGB)' },
    camera: { cameraIndex: p.cameraIndex },
    loadMs, settleMs, notes,
  };
};
window.__pageReady = true;
