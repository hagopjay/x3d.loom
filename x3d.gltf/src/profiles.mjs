// Node profile table: the portable profiles plus Draco and KTX2 (Basis Universal, WASM, via ktx2-encoder; images decoded with sharp).
// A profile is an ordered list of glTF-Transform steps plus a CONTRACT (profile-contract.mjs): what it promises to leave unchanged, which glTF
// extensions its output needs, and what a verifier must find. `verify.mjs` enforces the contract; a profile that breaks it fails, it does not warn.
import sharp from 'sharp';
import { draco, reorder } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptEncoder } from './io.mjs';
import { portableProfiles, BASE_STEPS, Q, enableMeshopt } from './profiles-core.mjs';
import { quantizeKeepingIdentity } from './quantize-identity.mjs';
export { boundsForGeometry } from './profile-contract.mjs';

const imageDecoder = async (buffer) => { const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const core = portableProfiles(MeshoptEncoder);
const M = EXTMeshoptCompression.EncoderMethod;
const webBase = () => [...BASE_STEPS(), ['reorder', reorder({ encoder: MeshoptEncoder })], ['quantize', quantizeKeepingIdentity({ ...Q })]];

export const PROFILES = {
  lossless: core.lossless, 'meshopt-lossless': core['meshopt-lossless'], quantized: core.quantized, web: core.web, 'web-filter': core['web-filter'],
  draco: {
    summary: 'lossless + KHR_draco_mesh_compression (edgebreaker, 14/10/12-bit)',
    identity: 'exact', geometry: 'bits:14', writes: ['KHR_draco_mesh_compression'],
    steps: () => [...BASE_STEPS(), ['draco', draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeGeneric: 12 })]],
  },
  'web-ktx2': {
    summary: 'web + KTX2 textures (UASTC, mips) via the Basis Universal encoder in WASM',
    identity: 'exact', geometry: 'bits:14', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression', 'KHR_texture_basisu'],
    steps: () => [...webBase(), ['ktx2-uastc', ktx2({ isUASTC: true, generateMipmap: true, imageDecoder })], ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
  },
  'web-ktx2-etc1s': {
    summary: 'web + KTX2 textures (ETC1S, mips): smallest textures, visible block artefacts on gradients',
    identity: 'exact', geometry: 'bits:14', writes: ['KHR_mesh_quantization', 'EXT_meshopt_compression', 'KHR_texture_basisu'],
    steps: () => [...webBase(), ['ktx2-etc1s', ktx2({ isUASTC: false, generateMipmap: true, imageDecoder })], ['meshopt-ext', enableMeshopt(M.QUANTIZE)]],
  },
  instanced: core.instanced, 'static-joined': core['static-joined'], 'stock-instance': core['stock-instance'],
};
export const PROFILE_IDS = Object.keys(PROFILES);
