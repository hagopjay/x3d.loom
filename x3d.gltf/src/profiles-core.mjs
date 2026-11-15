// The profiles that need no native code beyond the meshopt encoder: they run in Node and in the browser bundle.
// profiles.mjs (Node) adds Draco and KTX2 on top. See profile-contract.mjs for what identity / geometry mean.
import { PropertyType } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, reorder, join, flatten, instance } from '@gltf-transform/functions';
import { instanceWithIdentity } from './instance-identity.mjs';
import { quantizeKeepingIdentity } from './quantize-identity.mjs';

const T = PropertyType;
// Share bytes, never objects: stock dedup() compares extras, so tagged duplicates survive, but it folds duplicates that differ only by NAME
// (identity-dup fixture: MD into MC, MeshD into MeshC), and a name is an identity.
export const SAFE_DEDUP = () => dedup({ propertyTypes: [T.ACCESSOR, T.TEXTURE], keepUniqueNames: true });
export const SAFE_PRUNE = () => prune({ keepLeaves: true, keepExtras: true, keepAttributes: true });
export const enableMeshopt = (method) => (doc) => { doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method }); };
export const Q = { quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 };
export const BASE_STEPS = () => [['dedup', SAFE_DEDUP()], ['prune', SAFE_PRUNE()], ['weld', weld()]];

export function portableProfiles(encoder) {
  const M = EXTMeshoptCompression.EncoderMethod;
  const reorderStep = () => ['reorder', reorder({ encoder })], quant = () => ['quantize', quantizeKeepingIdentity({ ...Q })];
  return {
    lossless: {
      summary: 'dedup accessors and textures, prune, weld; plain glTF, no new extension',
      identity: 'exact', geometry: 'exact', writes: [], steps: () => [...BASE_STEPS()],
    },
    'meshopt-lossless': {
      summary: 'lossless + vertex reorder + EXT_meshopt_compression on unquantized data (bit-exact decode)',
      identity: 'exact', geometry: 'exact', writes: ['EXT_meshopt_compression'], steps: () => [...BASE_STEPS(), reorderStep(), ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
    },
    quantized: {
      summary: 'lossless + KHR_mesh_quantization (14-bit position, 10-bit normal, 12-bit uv); no compression extension',
      identity: 'exact', geometry: 'bits:14', writes: ['KHR_mesh_quantization'], steps: () => [...BASE_STEPS(), quant()],
    },
    web: {
      summary: 'quantized + reorder + EXT_meshopt_compression (gltfpack -c equivalent)',
      identity: 'exact', geometry: 'bits:14', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression'], steps: () => [...BASE_STEPS(), reorderStep(), quant(), ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
    },
    'web-filter': {
      summary: 'web with meshopt vertex filters (gltfpack -cc equivalent): smaller after brotli, larger before',
      identity: 'exact', geometry: 'bits:14', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression'], steps: () => [...BASE_STEPS(), reorderStep(), quant(), ['meshopt-ext', enableMeshopt(M.FILTER)]],
    },
    instanced: {
      summary: 'web + EXT_mesh_gpu_instancing for repeated meshes, with each instance\'s X3D identity kept in the batch node extras',
      identity: 'mapped', geometry: 'bits:14', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression', 'EXT_mesh_gpu_instancing'],
      steps: () => [...BASE_STEPS(), ['instance', instanceWithIdentity({ min: 2 })], reorderStep(), quant(), ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
    },
    'static-joined': {
      summary: 'draw-call crunch: dedup meshes and materials, flatten, join. DESTROYS node, mesh and material identity; kept only to measure the cost',
      // quantization is per mesh: after join one mesh spans the whole scene, so 14 bits cover the diagonal 4x more coarsely than in the other profiles
      identity: 'lossy', geometry: 'bits:12', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression'],
      steps: () => [['dedup', dedup()], ['prune', prune()], ['flatten', flatten()], ['join', join()], ['weld', weld()], reorderStep(), quant(), ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
    },
    // The other trap. glTF-Transform's own instance(): same draw-call win as `instanced`, and the DEF name of every instance is gone (measured: 1,216 of 1,251 tokens on the PRISMATICA cathedral).
    'stock-instance': {
      summary: 'TRAP: dedup, prune, weld, then glTF-Transform\'s own instance(); repeated meshes become one batch and the DEF name of every instance is erased',
      identity: 'lossy', geometry: 'exact', trap: true, writes: ['EXT_mesh_gpu_instancing'], steps: () => [...BASE_STEPS(), ['instance', instance({ min: 2 })]],
    },
  };
}
