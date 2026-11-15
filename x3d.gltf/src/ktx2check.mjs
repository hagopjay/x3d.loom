// The Khronos validator (2.0.0-dev.3.10) does not know KHR_texture_basisu: it warns about every KTX2 image (VALUE_NOT_IN_LIST on mimeType,
// IMAGE_UNRECOGNIZED_FORMAT on the image) and checks nothing inside it. This module is the replacement check: parse the container with ktx-parse and
// test what KHR_texture_basisu actually requires of it (spec text read 2026-11-15: vkFormat UNDEFINED, Basis Universal supercompressed colour model,
// full mip chain recommended, power-of-two or multiple-of-four sizes recommended).
import { read } from 'ktx-parse';

const MODEL = { 163: 'ETC1S', 166: 'UASTC' };   // KHR_DF_MODEL_ETC1S, KHR_DF_MODEL_UASTC
const SUPER = { 0: 'none', 1: 'BasisLZ', 2: 'zstd', 3: 'zlib' };

export function checkKtx2(bytes) {
  const out = { ok: true, problems: [], info: {} };
  let c;
  try { c = read(new Uint8Array(bytes)); } catch (e) { return { ok: false, problems: ['not parseable as KTX2: ' + String(e.message).slice(0, 80)], info: {} }; }
  const model = c.dataFormatDescriptor?.[0]?.colorModel;
  out.info = { width: c.pixelWidth, height: c.pixelHeight, levels: c.levelCount, layers: c.layerCount, faces: c.faceCount, vkFormat: c.vkFormat, supercompression: SUPER[c.supercompressionScheme] ?? c.supercompressionScheme, colorModel: MODEL[model] ?? model, bytes: bytes.byteLength };
  const fail = (m) => { out.ok = false; out.problems.push(m); };
  if (c.vkFormat !== 0) fail(`vkFormat ${c.vkFormat} is not VK_FORMAT_UNDEFINED (0): a transcodable Basis file is required`);
  if (!MODEL[model]) fail(`colour model ${model} is neither ETC1S (163) nor UASTC (166)`);
  if (MODEL[model] === 'ETC1S' && c.supercompressionScheme !== 1) fail('ETC1S without BasisLZ supercompression');
  const full = Math.floor(Math.log2(Math.max(c.pixelWidth, c.pixelHeight))) + 1;
  if (c.levelCount < full) out.problems.push(`mip chain incomplete: ${c.levelCount} of ${full} levels (advisory)`);
  if (c.pixelWidth % 4 || c.pixelHeight % 4) out.problems.push(`${c.pixelWidth}x${c.pixelHeight} is not a multiple of 4 (advisory; GPU block formats pad it)`);
  return out;
}

export function ktx2Images(doc) {
  return doc.getRoot().listTextures().filter((t) => t.getMimeType() === 'image/ktx2').map((t) => ({ name: t.getName() || t.getURI() || '', ...checkKtx2(t.getImage()) }));
}
