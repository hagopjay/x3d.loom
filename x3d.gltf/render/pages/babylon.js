// Babylon.js 9.x render page (UMD builds). Entry point: window.__render(params).
const B = window.BABYLON;
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---- decoder wiring: everything from node_modules via the local server ---------------------------
const DRACO_DIR = '/nm/three/examples/jsm/libs/draco/gltf/'; // same Google gltf decoder build Babylon names *_gltf.*
B.DracoCompression.Configuration.decoder = {
  wasmUrl: location.origin + DRACO_DIR + 'draco_wasm_wrapper.js',
  wasmBinaryUrl: location.origin + DRACO_DIR + 'draco_decoder.wasm',
  fallbackUrl: location.origin + DRACO_DIR + 'draco_decoder.js',
};
// Babylon expects a CLASSIC script that defines a global `MeshoptDecoder`. The meshoptimizer package's
// meshopt_decoder.cjs is exactly that (its CommonJS export is guarded by typeof module). x_ite's
// assets/lib/meshopt_decoder.js is NOT usable: it is a function body ending in a top-level return.
const MESHOPT_URL = location.origin + '/nm/meshoptimizer/meshopt_decoder.cjs';
B.MeshoptCompression.Configuration.decoder = { url: MESHOPT_URL };
// KTX2: babylon.ktx2Decoder.js + transcoder wasm are NOT in the babylonjs / babylonjs-loaders npm packages
// (they live in the separate @babylonjs/ktx2decoder package and on cdn.babylonjs.com). Left at its default
// (cdn.babylonjs.com) so the failure is observable; the browser has no network, the request is blocked.
const KTX2_DEFAULT = B.KhronosTextureContainer2.URLConfig.jsDecoderModule;

// ---- call counters ------------------------------------------------------------------------------
const counts = { draco: 0, meshopt: 0, ktx2: 0, ktx2Failed: 0 };
{
  // Babylon 9: the glTF loader calls DracoDecoder.Default._decodeMeshToGeometryForGltfAsync (DracoCompression is the older
  // name / subclass). Patch whichever class in the chain OWNS each method, once.
  const patched = new Set();
  for (const klass of [B.DracoDecoder, B.DracoCompression]) {
    for (const k of ['_decodeMeshToGeometryForGltfAsync']) { // the glTF loader's entry point: one call per Draco primitive
      let proto = klass?.prototype;
      while (proto && !Object.prototype.hasOwnProperty.call(proto, k)) proto = Object.getPrototypeOf(proto);
      if (!proto || patched.has(proto) && patched.has(proto[k])) continue;
      const o = proto[k];
      if (typeof o !== 'function' || patched.has(o)) continue;
      const w = function (...a) { counts.draco++; return o.apply(this, a); };
      patched.add(o); patched.add(w); patched.add(proto);
      proto[k] = w;
    }
  }
  const M = B.MeshoptCompression.prototype.decodeGltfBufferAsync;
  B.MeshoptCompression.prototype.decodeGltfBufferAsync = function (...a) { counts.meshopt++; return M.apply(this, a); };
  const K = B.KhronosTextureContainer2.prototype._uploadAsync;
  B.KhronosTextureContainer2.prototype._uploadAsync = function (...a) {
    counts.ktx2++;
    const p = K.apply(this, a);
    p.catch(() => counts.ktx2Failed++);
    return p;
  };
}

window.__render = async function (p) {
  const size = p.size;
  const notes = [];
  const out = { engine: 'babylon', version: B.Engine.Version, notes };

  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  document.body.appendChild(canvas);
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, adaptToDeviceRatio: false }, false);
  engine.setHardwareScalingLevel(1);
  out.engineInfo = { webGLVersion: engine.webGLVersion, glRenderer: engine.getGlInfo().renderer, caps: { astc: !!engine.getCaps().astc, bptc: !!engine.getCaps().bptc, s3tc: !!engine.getCaps().s3tc, etc2: !!engine.getCaps().etc2 } };

  const scene = new B.Scene(engine);
  // glTF is right-handed. Telling Babylon the scene is right-handed BEFORE the load means the loader does
  // not insert its handedness-flip root node, the geometry is used as authored, and the camera below is
  // built with the same right-handed look-at as the other engines.
  scene.useRightHandedSystem = true;
  scene.clearColor = B.Color4.FromHexString('#20242cff');
  scene.autoClear = true;
  const ipc = scene.imageProcessingConfiguration;
  ipc.toneMappingEnabled = false;
  ipc.exposure = 1;
  ipc.contrast = 1;
  ipc.vignetteEnabled = false;
  out.colour = {
    toneMapping: 'disabled (imageProcessingConfiguration.toneMappingEnabled=false, exposure 1, contrast 1)',
    outputColorSpace: 'sRGB (Babylon PBR shader gamma-encodes output); clearColor written raw',
    clear: 'scene.clearColor = #20242c',
    useRightHandedSystem: true,
  };

  const c = p.camera;
  const cam = new B.FreeCamera('shared', new B.Vector3(...c.position), scene);
  cam.upVector = new B.Vector3(...c.up);
  cam.setTarget(new B.Vector3(...c.target));
  cam.fov = c.fov; // vertical (default fovMode FOVMODE_VERTICAL_FIXED)
  cam.fovMode = B.Camera.FOVMODE_VERTICAL_FIXED;
  cam.minZ = c.near; cam.maxZ = c.far;
  scene.activeCamera = cam;

  // glTF animations off, like the other engines (static pose)
  B.SceneLoader.OnPluginActivatedObservable.addOnce((plugin) => {
    if (plugin.name === 'gltf') {
      plugin.animationStartMode = B.GLTFLoaderAnimationStartMode.NONE;
    }
  });

  const t0 = performance.now();
  const result = await B.SceneLoader.ImportMeshAsync('', '/', 'model.glb', scene, null, '.glb');
  const loadMs = performance.now() - t0;
  await scene.whenReadyAsync();
  const readyMs = performance.now() - t0;

  // ---- lighting ------------------------------------------------------------------------------------
  const glbLights = scene.lights.length;
  if (glbLights === 0) {
    const dir = new B.Vector3(c.target[0] - c.position[0], c.target[1] - c.position[1], c.target[2] - c.position[2]).normalize();
    const head = new B.DirectionalLight('headlight', dir, scene);
    head.intensity = 3.0;
    const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0), scene);
    hemi.intensity = 1.0;
    hemi.groundColor = new B.Color3(0.5, 0.5, 0.5);
    out.lighting = { source: 'fallback', glbLights, headlight: 'DirectionalLight(white, 3.0) along camera view direction', ambient: 'HemisphericLight(up, white/grey 0.5, 1.0)' };
  } else {
    out.lighting = { source: 'glb', glbLights, headlight: null, ambient: null };
  }

  // ---- stats ---------------------------------------------------------------------------------------
  let meshes = 0, triangles = 0, thinInstances = 0, instanceObjects = 0, skinned = 0, noIndexMeshes = 0;
  const geomMeshes = [];
  for (const m of scene.meshes) {
    const src = m.sourceMesh ?? m; // InstancedMesh -> its source geometry
    const verts = src.getTotalVertices();
    if (verts === 0) continue; // transform-only nodes
    let idx = src.getTotalIndices();
    let tri;
    if (idx > 0) tri = idx / 3;
    else { tri = verts / 3; noIndexMeshes++; }
    const thin = m.thinInstanceCount || 0;
    const n = thin > 0 ? thin : 1;
    meshes++;
    triangles += tri * n;
    if (thin > 0) thinInstances += thin;
    if (m.sourceMesh) instanceObjects++;
    if (m.skeleton) skinned++;
    geomMeshes.push(m);
  }
  out.stats = { meshes, triangles, thinInstances, instanceObjects, skinnedMeshes: skinned, nonIndexedMeshes: noIndexMeshes, sceneMeshesTotal: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };

  // textures that failed / are not ready after load
  const badTex = scene.textures.filter((t) => typeof t.isReady === 'function' && !t.isReady()).map((t) => t.name || t.url || '?');
  const texInfo = scene.textures
    .filter((t) => t.url || t.name)
    .map((t) => ({ name: String(t.name || t.url).slice(0, 60), ready: t.isReady(), w: t.getSize?.().width, h: t.getSize?.().height }));
  out.babylon = { textureReport: texInfo, notReadyTextures: badTex, ktx2DecoderUrl: KTX2_DEFAULT, meshoptUrl: MESHOPT_URL, dracoConfig: B.DracoCompression.Configuration.decoder };
  if (badTex.length) notes.push(`textures not ready after load: ${badTex.join(', ')}`);

  // ---- settle: 3 frames ------------------------------------------------------------------------------
  const t1 = performance.now();
  let frames = 0;
  await new Promise((resolve) => {
    engine.runRenderLoop(() => {
      scene.render();
      if (++frames >= 3) resolve();
    });
  });
  engine.stopRenderLoop();
  await raf();
  scene.render(); // last frame stays in the (preserved) drawing buffer
  await raf();
  out.settleMs = performance.now() - t1;
  out.loadMs = loadMs;
  out.readyMs = readyMs;
  out.decoders = {
    draco: { calls: counts.draco },
    meshopt: { calls: counts.meshopt },
    ktx2: { calls: counts.ktx2, failed: counts.ktx2Failed },
  };
  return out;
};
window.__pageReady = true;
