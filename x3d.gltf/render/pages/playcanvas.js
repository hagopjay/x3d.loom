// PlayCanvas engine 2.x render page (UMD build, global `pc`). Entry point: window.__render(params).
// Same contract as three.js / babylon.js: one glb, the shared camera, glb lights or the fallback headlight + ambient,
// tone mapping off, sRGB output, three settle frames, stats read back from the engine's own objects.
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---- decoder wiring: everything from node_modules via the local server ---------------------------
// Draco: the same Google glTF decoder build the three.js and Babylon pages use (draco_wasm_wrapper.js + .wasm).
const DRACO_DIR = '/nm/three/examples/jsm/libs/draco/gltf/';
pc.dracoInitialize({ jsUrl: location.origin + DRACO_DIR + 'draco_wasm_wrapper.js', wasmUrl: location.origin + DRACO_DIR + 'draco_decoder.wasm', lazyInit: true });
// meshopt: the meshoptimizer package's own decoder module object (classic script defining MeshoptDecoder)
const MESHOPT_URL = location.origin + '/nm/meshoptimizer/meshopt_decoder.cjs';
// KTX2 / Basis: PlayCanvas needs its own basis transcoder build (not in the playcanvas npm package). Left
// unconfigured on purpose so a KTX2 file fails observably instead of fetching from a CDN (the browser has no network).

window.__render = async function (p) {
  const size = p.size;
  const notes = [];
  const out = { engine: 'playcanvas', version: pc.version + ' (' + pc.revision + ')', notes };

  // meshopt decoder: load the classic script, then hand its global to PlayCanvas
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = MESHOPT_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const counts = { meshopt: 0, draco: 0 };
  if (window.MeshoptDecoder) {
    const M = window.MeshoptDecoder;
    const wrap = Object.create(M);
    wrap.decodeGltfBuffer = function (...a) { counts.meshopt++; return M.decodeGltfBuffer.apply(M, a); };
    wrap.decodeGltfBufferAsync = M.decodeGltfBufferAsync ? function (...a) { counts.meshopt++; return M.decodeGltfBufferAsync.apply(M, a); } : undefined;
    wrap.ready = M.ready;
    wrap.supported = M.supported;
    pc.meshoptInitialize({ decoder: wrap });
  } else notes.push('meshopt decoder script did not define MeshoptDecoder');

  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  document.body.appendChild(canvas);
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { preserveDrawingBuffer: true, antialias: true, alpha: false } });
  app.setCanvasFillMode(pc.FILLMODE_NONE, size, size);
  app.setCanvasResolution(pc.RESOLUTION_FIXED, size, size);
  app.autoRender = false;
  app.start();
  const dev = app.graphicsDevice;
  out.engineInfo = { deviceType: dev.deviceType, isWebGL2: dev.isWebGL2 ?? null, maxPixelRatio: dev.maxPixelRatio };

  const c = p.camera;
  const cam = new pc.Entity('shared');
  const BG = new pc.Color(0x20 / 255, 0x24 / 255, 0x2c / 255, 1);
  cam.addComponent('camera', {
    clearColor: BG,
    fov: (c.fov * 180) / Math.PI, // vertical (horizontalFov false)
    horizontalFov: false,
    nearClip: c.near,
    farClip: c.far,
    toneMapping: pc.TONEMAP_NONE,
    gammaCorrection: pc.GAMMA_SRGB,
  });
  cam.setPosition(...c.position);
  cam.lookAt(new pc.Vec3(...c.target), new pc.Vec3(...c.up));
  app.root.addChild(cam);
  out.colour = {
    toneMapping: 'TONEMAP_NONE',
    gammaCorrection: 'GAMMA_SRGB (output sRGB)',
    clear: 'camera clearColor = #20242c (PlayCanvas treats clearColor as sRGB under GAMMA_SRGB)',
  };

  const t0 = performance.now();
  const asset = await new Promise((resolve, reject) => {
    app.assets.loadFromUrlAndFilename(p.glbUrl, 'model.glb', 'container', (err, a) => (err ? reject(new Error('Failed to load the glb container (PlayCanvas says: ' + String(err) + ')')) : resolve(a)));
  });
  const loadMs = performance.now() - t0;
  const root = asset.resource.instantiateRenderEntity();
  app.root.addChild(root);

  // ---- lighting ------------------------------------------------------------------------------------
  let glbLights = 0;
  const walk = (e, fn) => { fn(e); for (const ch of e.children) walk(ch, fn); };
  walk(root, (e) => { if (e.light) glbLights++; });
  if (glbLights === 0) {
    const head = new pc.Entity('headlight');
    head.addComponent('light', { type: 'directional', color: new pc.Color(1, 1, 1), intensity: 2.2, castShadows: false });
    head.setLocalEulerAngles(90, 0, 0); // a PlayCanvas directional light shines along its entity's -Y; +90 deg about X turns that to -Z, the camera's view
    cam.addChild(head);
    app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);
    out.lighting = { source: 'fallback', glbLights, headlight: 'directional light (white, 2.2) parented to the camera, along the view', ambient: 'scene.ambientLight 0.5 grey (PlayCanvas has no hemisphere light)' };
  } else {
    // PlayCanvas 2.24 imports KHR_lights_punctual lights DISABLED (createLight in parsers/glb/extensions/
    // khr-lights-punctual.js sets enabled: false) and clamps their intensity to 0..2 (engine issue #3252). Left as
    // imported, every lit glb renders black. This page turns them on and says so; the intensity clamp is left as is.
    let disabled = 0;
    const clamped = [];
    walk(root, (e) => {
      if (!e.light) return;
      if (!e.light.enabled) { disabled++; e.light.enabled = true; }
      if (e.light.intensity >= 2) clamped.push(e.name);
    });
    app.scene.ambientLight = new pc.Color(0, 0, 0);
    out.lighting = { source: 'glb', glbLights, headlight: null, ambient: null, importedDisabled: disabled, enabledByPage: disabled, intensityAtClamp2: clamped };
    if (disabled) notes.push(`PlayCanvas imported ${disabled} of ${glbLights} glb lights disabled; the page enabled them`);
  }

  // ---- stats ---------------------------------------------------------------------------------------
  let meshes = 0, triangles = 0, instanced = 0, instances = 0, skinned = 0, nonIndexed = 0, entities = 0;
  const materials = new Set();
  walk(root, (e) => {
    entities++;
    if (!e.render) return;
    for (const mi of e.render.meshInstances) {
      const prim = mi.mesh.primitive[0];
      const tri = prim.count / 3;
      const n = mi.instancingCount > 0 ? mi.instancingCount : 1;
      meshes++;
      triangles += tri * n;
      if (!prim.indexed) nonIndexed++;
      if (mi.instancingCount > 0) { instanced++; instances += mi.instancingCount; }
      if (mi.skinInstance) skinned++;
      materials.add(mi.material);
    }
  });
  out.stats = { meshes, triangles, instancedMeshInstances: instanced, instances, skinnedMeshes: skinned, nonIndexedMeshes: nonIndexed, materials: materials.size, entities, textures: asset.resource.textures?.length ?? null };

  // ---- settle: 3 frames ------------------------------------------------------------------------------
  const t1 = performance.now();
  for (let i = 0; i < 4; i++) { app.render(); await raf(); }
  out.settleMs = performance.now() - t1;
  out.loadMs = loadMs;
  out.decoders = { draco: { calls: null }, meshopt: { calls: counts.meshopt }, ktx2: { calls: null } };
  return out;
};
window.__pageReady = true;
