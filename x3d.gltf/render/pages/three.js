// three.js r187 render page. Entry point: window.__render(params) -> engine-side receipt part.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BG = 0x20242c;
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---- decoder call counters (wrap, never replace behaviour) ---------------------------------------
const counts = { draco: 0, meshopt: 0, meshoptBytes: 0, ktx2: 0 };
const ktx2Textures = [];
{
  const dg = DRACOLoader.prototype.decodeGeometry;
  DRACOLoader.prototype.decodeGeometry = function (...a) { counts.draco++; return dg.apply(this, a); };
  const origAsync = MeshoptDecoder.decodeGltfBufferAsync;
  MeshoptDecoder.decodeGltfBufferAsync = function (count, size, ...rest) {
    counts.meshopt++; counts.meshoptBytes += count * size;
    return origAsync.call(this, count, size, ...rest);
  };
  const origSync = MeshoptDecoder.decodeGltfBuffer;
  MeshoptDecoder.decodeGltfBuffer = function (target, count, size, ...rest) {
    counts.meshopt++; counts.meshoptBytes += count * size;
    return origSync.call(this, target, count, size, ...rest);
  };
  const ct = KTX2Loader.prototype._createTexture;
  KTX2Loader.prototype._createTexture = function (...a) {
    counts.ktx2++;
    return ct.apply(this, a).then((t) => { ktx2Textures.push(t); return t; });
  };
}

const formatName = (f) => {
  for (const k of Object.keys(THREE)) if (/Format$/.test(k) && THREE[k] === f) return k;
  return String(f);
};

window.__render = async function (p) {
  const size = p.size;
  const notes = [];
  const out = { engine: 'three', version: THREE.REVISION, notes };

  // ---- renderer: no tone mapping, sRGB output, no pixel-ratio scaling, MSAA on -------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, true);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BG, 1);
  document.body.appendChild(renderer.domElement);
  out.colour = {
    toneMapping: 'NoToneMapping',
    outputColorSpace: renderer.outputColorSpace,
    colorManagement: THREE.ColorManagement.enabled,
    clear: '0x20242c via setClearColor (converted to output space by three)',
  };

  const scene = new THREE.Scene();
  const c = p.camera;
  const camera = new THREE.PerspectiveCamera((c.fov * 180) / Math.PI, 1, c.near, c.far);
  camera.position.set(...c.position);
  camera.up.set(...c.up);
  camera.lookAt(new THREE.Vector3(...c.target));
  camera.updateMatrixWorld(true);
  scene.add(camera);

  // ---- loader wiring ----------------------------------------------------------------------------
  const loaderErrors = [];
  const manager = new THREE.LoadingManager();
  manager.onError = (url) => loaderErrors.push(url);
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader(manager).setDecoderPath('/nm/three/examples/jsm/libs/draco/gltf/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('/nm/three/examples/jsm/libs/basis/').detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
  out.decoderConfig = {
    dracoDecoderPath: '/nm/three/examples/jsm/libs/draco/gltf/ (draco_wasm_wrapper.js, draco_decoder.wasm, draco_decoder.js)',
    meshopt: 'three/examples/jsm/libs/meshopt_decoder.module.js (wasm inlined as base64)',
    ktx2TranscoderPath: '/nm/three/examples/jsm/libs/basis/ (basis_transcoder.js, basis_transcoder.wasm)',
    ktx2WorkerConfig: ktx2.workerConfig,
  };

  const t0 = performance.now();
  const gltf = await loader.loadAsync(p.glbUrl);
  const loadMs = performance.now() - t0;
  const root = gltf.scene;
  scene.add(root);

  // ---- lighting: use the glb's own lights if it has any, else headlight + weak hemisphere -------
  let glbLights = 0;
  root.traverse((o) => { if (o.isLight) glbLights++; });
  if (glbLights === 0) {
    const head = new THREE.DirectionalLight(0xffffff, 2.2);
    head.position.set(0, 0, 0);
    head.target.position.set(0, 0, -1);
    camera.add(head, head.target); // headlight: travels with the (static) camera
    scene.add(new THREE.HemisphereLight(0xffffff, 0x808080, 1.0));
    out.lighting = { source: 'fallback', glbLights, headlight: 'DirectionalLight(white, 2.2) parented to camera', ambient: 'HemisphereLight(white/0x808080, 1.0)' };
  } else {
    out.lighting = { source: 'glb', glbLights, headlight: null, ambient: null };
  }

  // ---- engine-side statistics ---------------------------------------------------------------------
  let meshes = 0, triangles = 0, instancedMeshes = 0, instances = 0, points = 0, lines = 0, skinned = 0;
  const materials = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry;
      const tri = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
      const n = o.isInstancedMesh ? o.count : 1;
      meshes++;
      triangles += tri * n;
      if (o.isInstancedMesh) { instancedMeshes++; instances += n; }
      if (o.isSkinnedMesh) skinned++;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
    } else if (o.isPoints) points++;
    else if (o.isLine) lines++;
  });
  out.stats = { meshes, triangles, instancedMeshes, instances, skinnedMeshes: skinned, points, lineObjects: lines, materials: materials.size, glbNodesObjects: (() => { let n = 0; root.traverse(() => n++); return n; })() };

  // ---- KTX2 outcome ------------------------------------------------------------------------------
  out.ktx2 = {
    texturesCreated: ktx2Textures.length,
    formats: [...new Set(ktx2Textures.map((t) => formatName(t.format)))],
    compressedOnGpu: ktx2Textures.length ? ktx2Textures.every((t) => t.isCompressedTexture === true) : null,
  };
  if (ktx2Textures.length) notes.push(`KTX2 transcoded to ${out.ktx2.formats.join(',')} (${out.ktx2.compressedOnGpu ? 'GPU-compressed upload' : 'uncompressed RGBA fallback'})`);

  // ---- settle: 3 animation frames, explicit render each --------------------------------------------
  const t1 = performance.now();
  for (let i = 0; i < 3; i++) { await raf(); renderer.render(scene, camera); }
  await raf();
  out.settleMs = performance.now() - t1;
  out.loadMs = loadMs;
  out.decoders = {
    draco: { calls: counts.draco },
    meshopt: { calls: counts.meshopt, bytesDecoded: counts.meshoptBytes },
    ktx2: { calls: counts.ktx2 },
  };
  out.loaderErrors = loaderErrors;
  out.glInfo = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries };
  out.canvasSelector = 'canvas';
  return out;
};
window.__pageReady = true;
