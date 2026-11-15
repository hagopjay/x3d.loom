// Inventory and byte accounting for a glb: what is in it, where its bytes go, what it costs to draw and to hold on the GPU.
// Every number here is computed from the file or from the glTF-Transform Document; nothing is estimated except `gpuTextureBytes`, which says so.
import { ImageUtils } from '@gltf-transform/core';

// ---------- the glb container ----------
export function splitGlb(bytes) {   // portable: Buffer, Uint8Array or ArrayBuffer view
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb (bad magic)');
  const total = dv.getUint32(8, true);
  let off = 12, json = null, binLength = 0, jsonLength = 0;
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) { json = JSON.parse(new TextDecoder().decode(buf.subarray(off + 8, off + 8 + len))); jsonLength = len; }
    else if (type === 0x004e4942) binLength = len;
    off += 8 + len;
  }
  if (!json) throw new Error('glb has no JSON chunk');
  return { json, jsonLength, binLength, total };
}

// Which category does each bufferView belong to? Draco and meshopt views count their COMPRESSED bytes, so the table is a real size table.
export function byteBreakdown(buf) {
  const { json, jsonLength, binLength, total } = splitGlb(buf);
  const views = json.bufferViews || [], cat = new Array(views.length).fill(null);
  const claim = (viewIdx, c) => { if (viewIdx != null && cat[viewIdx] == null) cat[viewIdx] = c; };
  const accCat = (name) => name === 'POSITION' ? 'position' : name === 'NORMAL' ? 'normal' : name === 'TANGENT' ? 'tangent'
    : /^TEXCOORD/.test(name) ? 'uv' : /^COLOR/.test(name) ? 'colour' : /^(JOINTS|WEIGHTS)/.test(name) ? 'skin' : 'attrOther';
  const acc = json.accessors || [];
  for (const m of json.meshes || []) for (const p of m.primitives || []) {
    for (const [k, a] of Object.entries(p.attributes || {})) claim(acc[a]?.bufferView, accCat(k));
    if (p.indices != null) claim(acc[p.indices]?.bufferView, 'indices');
    for (const t of p.targets || []) for (const [k, a] of Object.entries(t)) claim(acc[a]?.bufferView, 'morph');
    const d = p.extensions?.KHR_draco_mesh_compression; if (d) claim(d.bufferView, 'draco');
  }
  for (const an of json.animations || []) for (const s of an.samplers || []) { claim(acc[s.input]?.bufferView, 'animation'); claim(acc[s.output]?.bufferView, 'animation'); }
  for (const s of json.skins || []) claim(acc[s.inverseBindMatrices]?.bufferView, 'skin');
  for (const i of json.images || []) claim(i.bufferView, 'image');
  for (const a of acc) { if (a.sparse) { claim(a.sparse.indices?.bufferView, 'sparse'); claim(a.sparse.values?.bufferView, 'sparse'); } }
  for (const n of json.nodes || []) { const g = n.extensions?.EXT_mesh_gpu_instancing; if (g) for (const a of Object.values(g.attributes || {})) claim(acc[a]?.bufferView, 'instancing'); }
  const out = {};
  let counted = 0;
  views.forEach((v, i) => {
    const mo = v.extensions?.EXT_meshopt_compression;
    if (mo && mo.fallback && !mo.byteLength) return;
    const bytes = mo ? mo.byteLength : v.byteLength;
    // a meshopt view whose compressed bytes are shared is counted once per view: fine, views do not overlap in files this lane writes
    const c = cat[i] || 'unreferenced';
    out[c] = (out[c] || 0) + bytes; counted += bytes;
  });
  const header = 12 + 8 + 8;
  return { totalBytes: buf.length, jsonBytes: jsonLength, binBytes: binLength, header, byCategory: out, paddingAndOther: Math.max(0, binLength - counted) };
}

// ---------- the Document ----------
const TRI = 4, STRIP = 5, FAN = 6;
function primTriangles(p) {
  const mode = p.getMode(), idx = p.getIndices(), pos = p.getAttribute('POSITION');
  const n = idx ? idx.getCount() : pos ? pos.getCount() : 0;
  if (mode === TRI) return Math.floor(n / 3);
  if (mode === STRIP || mode === FAN) return Math.max(0, n - 2);
  return 0;
}

export function inventory(doc) {
  const R = doc.getRoot();
  const scene = R.getDefaultScene() || R.listScenes()[0];
  let drawCalls = 0, triangles = 0, instances = 0, points = 0, lineVerts = 0, instancedNodes = 0;
  const seenMeshForUpload = new Set(); let uploadVertices = 0, vertexBytes = 0, indexBytes = 0;
  if (scene) scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    const count = inst ? (inst.listAttributes()[0]?.getCount() ?? 1) : 1;
    if (inst) { instancedNodes++; instances += count; }
    for (const p of mesh.listPrimitives()) {
      drawCalls += 1;
      triangles += primTriangles(p) * count;
      const mode = p.getMode(); const pos = p.getAttribute('POSITION');
      if (mode === 0 && pos) points += pos.getCount() * count;
      if (mode >= 1 && mode <= 3 && pos) lineVerts += pos.getCount() * count;
    }
    if (!seenMeshForUpload.has(mesh)) {
      seenMeshForUpload.add(mesh);
      for (const p of mesh.listPrimitives()) {
        const pos = p.getAttribute('POSITION'); if (pos) uploadVertices += pos.getCount();
        for (const sem of p.listSemantics()) vertexBytes += p.getAttribute(sem).getArray().byteLength;
        for (const t of p.listTargets()) for (const sem of t.listSemantics()) vertexBytes += t.getAttribute(sem).getArray().byteLength;
        const i = p.getIndices(); if (i) indexBytes += i.getArray().byteLength;
      }
    }
  });
  const textures = R.listTextures().map((t) => {
    const img = t.getImage(), mime = t.getMimeType();
    let size = null, vram = null;
    try { size = ImageUtils.getSize(img, mime); vram = ImageUtils.getVRAMByteLength(img, mime); } catch { /* unknown container */ }
    return { name: t.getName(), mime, bytes: img ? img.byteLength : 0, size, gpuTextureBytes: vram };
  });
  const anims = R.listAnimations();
  return {
    scenes: R.listScenes().length, nodes: R.listNodes().length, meshes: R.listMeshes().length,
    primitives: R.listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0),
    materials: R.listMaterials().length, textures: textures.length, cameras: R.listCameras().length, lights: (R.listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length),
    animations: anims.length, channels: anims.reduce((a, an) => a + an.listChannels().length, 0), skins: R.listSkins().length,
    drawCalls, triangles, instancedNodes, instances, points, lineVertices: lineVerts,
    uploadVertices, residentVertexBytes: vertexBytes, residentIndexBytes: indexBytes,
    textureList: textures,
    textureBytes: textures.reduce((a, t) => a + t.bytes, 0),
    // VRAM of a PNG/JPEG is width*height*4*4/3 (mip chain) once decoded; a KTX2 reports its transcoded-format size. glTF-Transform's own formula, not a GPU measurement.
    gpuTextureBytes: textures.reduce((a, t) => a + (t.gpuTextureBytes || 0), 0),
    extensionsUsed: R.listExtensionsUsed().map((e) => e.extensionName).sort(),
    extensionsRequired: R.listExtensionsRequired().map((e) => e.extensionName).sort(),
  };
}
