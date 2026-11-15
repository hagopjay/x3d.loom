// Minimal GLB JSON-chunk reader (no gltf-transform needed, no decoding).
// Used by the CLI to fill the receipt (extensionsUsed, light count) and to pick the X_ITE headlight.

import fs from 'node:fs';

export function readGlbJson(path) {
  const b = fs.readFileSync(path);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB (bad magic)`);
  const jsonLen = b.readUInt32LE(12);
  if (b.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${path}: first chunk is not JSON`);
  return { json: JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8')), bytes: b.length };
}

export function glbInfo(path) {
  const { json, bytes } = readGlbJson(path);
  const used = json.extensionsUsed ?? [];
  const lights = json.extensions?.KHR_lights_punctual?.lights ?? [];
  const meshes = json.meshes ?? [];
  const prims = meshes.flatMap((m) => m.primitives ?? []);
  const nodeExt = new Set();
  for (const n of json.nodes ?? []) for (const k of Object.keys(n.extensions ?? {})) nodeExt.add(k);
  const gpuInstances = (json.nodes ?? []).reduce((a, n) => {
    const at = n.extensions?.EXT_mesh_gpu_instancing?.attributes;
    if (!at) return a;
    const acc = json.accessors?.[Object.values(at)[0]];
    return a + (acc?.count ?? 0);
  }, 0);
  return {
    bytes,
    extensionsUsed: used,
    extensionsRequired: json.extensionsRequired ?? [],
    declaredLights: lights.length,
    declaredMeshes: meshes.length,
    declaredPrimitives: prims.length,
    declaredNodes: (json.nodes ?? []).length,
    declaredImages: (json.images ?? []).map((i) => i.mimeType ?? (i.uri ? 'uri' : '?')),
    declaredAnimations: (json.animations ?? []).length,
    gpuInstances,
    usesDraco: used.includes('KHR_draco_mesh_compression'),
    usesMeshopt: used.includes('EXT_meshopt_compression'),
    usesQuantization: used.includes('KHR_mesh_quantization'),
    usesKtx2: used.includes('KHR_texture_basisu'),
    usesGpuInstancing: used.includes('EXT_mesh_gpu_instancing'),
  };
}
