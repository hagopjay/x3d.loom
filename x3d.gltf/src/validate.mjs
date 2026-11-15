// Khronos glTF-Validator, wrapped the way x3d-blender-io's tools/fidelity_rig/validate_glb.mjs reports it, plus the part that script cannot do:
// the validator does not know EXT_meshopt_compression, KHR_draco_mesh_compression, KHR_texture_basisu or EXT_mesh_gpu_instancing (it says so at INFO,
// UNSUPPORTED_EXTENSION), so a compressed glb "passes" without its geometry being checked. `validateDelivery` therefore validates two files:
//   the DELIVERED glb (container, JSON, extension list) and the CANONICAL glb (the same document decoded and written without the compression extensions),
// and reports both. Only the canonical result says anything about the vertices.
import crypto from 'node:crypto';
import validator from 'gltf-validator';
import { makeIO } from './io.mjs';

export const VALIDATOR_VERSION = validator.version();
const SEVERITY = ['ERROR', 'WARNING', 'INFO', 'HINT'];
const COMPRESSION = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);

export async function validateBytes(bytes, { uri = 'file.glb', maxWarnings = null, resources = null } = {}) {
  let report = null, exception = null;
  try { report = await validator.validateBytes(new Uint8Array(bytes), { uri, maxIssues: 0, ...(resources ? { externalResourceFunction: resources } : {}) }); } catch (e) { exception = String(e?.message || e); }
  const issues = report ? report.issues : { numErrors: 1, numWarnings: 0, numInfos: 0, numHints: 0, messages: [] };
  const info = report?.info || {};
  const supported = validator.supportedExtensions();
  const out = {
    schema: 'x3d.gltf.validation/v1', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    validator: 'gltf-validator', validatorVersion: report ? report.validatorVersion : VALIDATOR_VERSION,
    numErrors: issues.numErrors, numWarnings: issues.numWarnings, numInfos: issues.numInfos, numHints: issues.numHints,
    issues: report ? issues.messages.filter((m) => m.severity <= 1).map((m) => ({ code: m.code, severity: SEVERITY[m.severity], pointer: m.pointer ?? null, message: m.message }))
      : [{ code: 'VALIDATOR_EXCEPTION', severity: 'ERROR', pointer: null, message: exception }],
    totalTriangleCount: info.totalTriangleCount ?? null, totalVertexCount: info.totalVertexCount ?? null, drawCallCount: info.drawCallCount ?? null, materialCount: info.materialCount ?? null,
    extensionsUsed: info.extensionsUsed ?? [], extensionsRequired: info.extensionsRequired ?? [],
    extensionsNotValidated: (info.extensionsUsed ?? []).filter((e) => !supported.includes(e)),
    maxWarnings,
  };
  // Warnings that exist only because this validator version does not know an extension. They are counted, listed, and subtracted for the gate.
  const basisu = out.extensionsUsed.includes('KHR_texture_basisu');
  const ktx2Images = new Set();
  for (const m of out.issues) if (basisu && m.code === 'VALUE_NOT_IN_LIST' && /^\/images\/\d+\/mimeType$/.test(m.pointer || '') && /'image\/ktx2'/.test(m.message)) ktx2Images.add(m.pointer.split('/')[2]);
  out.explainedWarnings = out.issues.filter((m) => m.severity === 'WARNING' && ((m.code === 'VALUE_NOT_IN_LIST' && /^\/images\/\d+\/mimeType$/.test(m.pointer || '') && ktx2Images.has((m.pointer || '').split('/')[2])) || (m.code === 'IMAGE_UNRECOGNIZED_FORMAT' && ktx2Images.has((m.pointer || '').split('/')[2])))).length;
  out.unexplainedWarnings = out.numWarnings - out.explainedWarnings;
  out.ok = out.numErrors === 0 && (maxWarnings === null || out.unexplainedWarnings <= maxWarnings);
  return out;
}

// The canonical form of a delivered glb: decode the compression extensions and write the document back without them. Quantization (a plain
// accessor format) and instancing are kept; they are what the glb means, not how it is stored.
export async function canonicalBytes(bytes) {
  const io = await makeIO();
  const doc = await io.readBinary(new Uint8Array(bytes));
  const dropped = [];
  for (const e of doc.getRoot().listExtensionsUsed()) if (COMPRESSION.has(e.extensionName)) { dropped.push(e.extensionName); e.dispose(); }
  return { bytes: Buffer.from(await io.writeBinary(doc)), dropped };
}

export async function validateDelivery(bytes, opts = {}) {
  const delivered = await validateBytes(bytes, { ...opts, uri: 'delivered.glb' });
  const needsCanonical = delivered.extensionsUsed.some((e) => COMPRESSION.has(e));
  if (!needsCanonical) return { delivered, canonical: null, ok: delivered.ok, note: 'no compression extension: the delivered file is its own canonical form' };
  const c = await canonicalBytes(bytes);
  const canonical = await validateBytes(c.bytes, { ...opts, uri: 'canonical.glb' });
  return { delivered, canonical, droppedForCanonical: c.dropped, ok: delivered.numErrors === 0 && canonical.ok,
    note: 'compression extensions are not validated by this validator version; the canonical (decoded) file is what proves the geometry' };
}
