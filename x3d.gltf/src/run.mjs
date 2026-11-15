// One (glb, profile) case end to end: optimise, write, verify, summarise. The summary row is what the matrix tables are built from.
import fs from 'node:fs';
import path from 'node:path';
import { optimize } from './optimize.mjs';
import { verify } from './verify.mjs';
import { PROFILES } from './profiles.mjs';

const report_ktx = (rep) => rep.ktx2.map((k) => ({ ...k.info, ok: k.ok, problems: k.problems }));

export async function runCase(srcPath, profileId, { outDir = null, onStep = null, keepOutput = true } = {}) {
  const src = fs.readFileSync(srcPath);
  const t0 = performance.now();
  const opt = await optimize(src, profileId, { onStep });
  const optMs = Math.round(performance.now() - t0);
  const rep = await verify(src, opt.bytes, profileId);
  let outPath = null;
  if (outDir && keepOutput) { fs.mkdirSync(outDir, { recursive: true }); outPath = path.join(outDir, `${path.basename(srcPath, '.glb')}.${profileId}.glb`); fs.writeFileSync(outPath, opt.bytes); }
  const so = rep.bytes.source, oo = rep.bytes.output, inv = rep.inventory;
  const row = {
    file: path.basename(srcPath), profile: profileId, ok: rep.ok, failures: rep.failures, notes: rep.notes,
    bytes: { source: so.totalBytes, output: oo.totalBytes, ratio: oo.totalBytes / so.totalBytes },
    gzip: { source: so.transfer.gzip, output: oo.transfer.gzip }, brotli: { source: so.transfer.brotli, output: oo.transfer.brotli },
    drawCalls: [inv.source.drawCalls, inv.output.drawCalls], nodes: [inv.source.nodes, inv.output.nodes], triangles: [inv.source.triangles, inv.output.triangles],
    residentVertexBytes: [inv.source.residentVertexBytes, inv.output.residentVertexBytes], residentIndexBytes: [inv.source.residentIndexBytes, inv.output.residentIndexBytes],
    gpuTextureBytes: [inv.source.gpuTextureBytes, inv.output.gpuTextureBytes],
    identity: { preserved: rep.identity.preserved, lost: rep.identity.lost, added: rep.identity.added, taggedLost: rep.identity.taggedLost },
    geometry: { centroidMaxRel: rep.geometry.centroid?.maxRel ?? null, centroidP99Rel: rep.geometry.centroid?.p99Rel ?? null, areaRelDelta: rep.geometry.areaRelDelta, normalP99Deg: rep.geometry.normalDegrees?.p99 ?? null, normalMaxDeg: rep.geometry.normalDegrees?.max ?? null, uvMax: rep.geometry.uvDelta?.max ?? null },
    validator: { source: [rep.validator.source.errors, rep.validator.source.warnings], delivered: [rep.validator.delivered.errors, rep.validator.delivered.warnings, rep.validator.delivered.explainedWarnings], canonical: rep.validator.canonical ? [rep.validator.canonical.errors, rep.validator.canonical.warnings, rep.validator.canonical.explainedWarnings] : null, notValidated: rep.validator.delivered.extensionsNotValidated },
    extensions: rep.validator.delivered.extensionsUsed, optimiseMs: optMs, writeMs: opt.writeMs, steps: opt.steps.map((s) => ({ step: s.step, ms: s.ms, ...(s.notes ? { notes: s.notes } : {}) })), ktx2: report_ktx(rep),
    outputPath: outPath,
  };
  return { row, report: rep, output: opt.bytes };
}
