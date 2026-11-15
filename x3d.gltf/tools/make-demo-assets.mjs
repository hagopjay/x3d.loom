// Assets for the glb Forge demo (x3d.demo docs/demos/glb-forge/v1): the original glbs, the variants a browser cannot make (Draco, KTX2), and a receipt
// with the sha256 of every portable profile's output, so the page can prove that what it forges live is byte-identical to what this CLI made.
//   node tools/make-demo-assets.mjs OUT_DIR PATH_TO_X3D_BLENDER_IO_CHECKOUT   (the four showpieces are read from its docs/brag/showpieces)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { optimize } from '../src/optimize.mjs';
import { verify } from '../src/verify.mjs';
import { transferSizes } from '../src/transfer.mjs';
import { PROFILE_IDS } from '../src/profiles.mjs';

const out = process.argv[2] || 'out-demo', root = process.argv[3] || '../../x3d-blender-io'; fs.mkdirSync(out, { recursive: true });
const at = (rel) => path.join(root, 'docs/brag/showpieces', rel);
const SCENES = [
  { id: 'cathedral', title: 'PRISMATICA Aurora Cathedral', file: at('prismatica/prismatica-aurora-cathedral.glb'), precomputed: ['draco'] },
  { id: 'asterion', title: 'Asterion (BRDF specimens)', file: at('asterion/asterion.glb'), precomputed: ['draco'] },
  { id: 'lumen', title: 'LUMEN Interference Atelier', file: at('lumen/lumen.glb'), precomputed: ['draco'] },
  { id: 'stilllife', title: 'Still life (textured)', file: at('stilllife/stilllife-addon.glb'), precomputed: ['draco', 'web-ktx2-etc1s'] },
];
const PORTABLE = ['lossless', 'meshopt-lossless', 'quantized', 'web', 'web-filter', 'instanced', 'static-joined', 'stock-instance'];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const receipt = { schema: 'x3d.gltf.demo-receipt/v1', tools: { ...pkg.dependencies, node: process.version, note: 'sizes and sha256 are computed here, by the Node CLI path; the page recomputes the portable profiles in the visitor browser and compares' }, scenes: {} };
for (const s of SCENES) {
  const src = fs.readFileSync(s.file); fs.copyFileSync(s.file, path.join(out, `${s.id}.glb`));
  const rec = { title: s.title, file: `${s.id}.glb`, bytes: src.length, sha256: sha(src), transfer: transferSizes(src), profiles: {} };
  for (const p of [...PORTABLE, ...s.precomputed]) {
    const t0 = performance.now(), o = await optimize(src, p), ms = Math.round(performance.now() - t0);
    const rep = await verify(src, o.bytes, p);
    const portable = PORTABLE.includes(p);
    if (!portable) fs.writeFileSync(path.join(out, `${s.id}.${p}.glb`), o.bytes);
    rec.profiles[p] = { portable, file: portable ? null : `${s.id}.${p}.glb`, bytes: o.bytes.length, sha256: sha(o.bytes), transfer: transferSizes(o.bytes), ok: rep.ok, failures: rep.failures, notes: rep.notes, nodeMs: ms,
      drawCalls: [rep.inventory.source.drawCalls, rep.inventory.output.drawCalls], nodes: [rep.inventory.source.nodes, rep.inventory.output.nodes], triangles: [rep.inventory.source.triangles, rep.inventory.output.triangles],
      residentVertexBytes: [rep.inventory.source.residentVertexBytes, rep.inventory.output.residentVertexBytes], gpuTextureBytes: [rep.inventory.source.gpuTextureBytes, rep.inventory.output.gpuTextureBytes],
      identity: { sourceTokens: rep.identity.sourceTokens, preserved: rep.identity.preserved, lost: rep.identity.lost, added: rep.identity.added, lostByKind: rep.identity.lostByKind },
      geometry: { centroidMaxRel: rep.geometry.centroid?.maxRel ?? null, centroidP99Rel: rep.geometry.centroid?.p99Rel ?? null, normalP99Deg: rep.geometry.normalDegrees?.p99 ?? null, areaRelDelta: rep.geometry.areaRelDelta },
      validator: { delivered: [rep.validator.delivered.errors, rep.validator.delivered.warnings], canonical: rep.validator.canonical ? [rep.validator.canonical.errors, rep.validator.canonical.warnings] : null, notValidated: rep.validator.delivered.extensionsNotValidated },
      extensions: rep.validator.delivered.extensionsUsed, steps: o.steps.map((x) => ({ step: x.step, ms: x.ms })) };
    console.error(`${s.id.padEnd(10)} ${p.padEnd(16)} ${(src.length / 1024).toFixed(0)} -> ${(o.bytes.length / 1024).toFixed(0)} KiB  ${rep.ok ? 'ok' : 'FAIL ' + rep.failures[0]}  ${ms} ms`);
  }
  receipt.scenes[s.id] = rec;
}
fs.writeFileSync(path.join(out, 'forge-receipts.json'), JSON.stringify(receipt, null, 1) + '\n');
