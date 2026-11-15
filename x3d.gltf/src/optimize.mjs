// Run a profile over a glb (or a .gltf with its resources) and return the bytes plus a per-step log.
import fs from 'node:fs';
import { Logger } from '@gltf-transform/core';
import { makeIO } from './io.mjs';
import { PROFILES } from './profiles.mjs';

const counts = (doc) => { const R = doc.getRoot(); return { nodes: R.listNodes().length, meshes: R.listMeshes().length, materials: R.listMaterials().length, accessors: R.listAccessors().length, textures: R.listTextures().length }; };

export async function optimize(input, profileId, { onStep = null, silent = true } = {}) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`unknown profile "${profileId}"; known: ${Object.keys(PROFILES).join(', ')}`);
  const io = await makeIO();
  io.setLogger(new Logger(silent ? Logger.Verbosity.SILENT : Logger.Verbosity.INFO));
  const doc = Buffer.isBuffer(input) || input instanceof Uint8Array ? await io.readBinary(new Uint8Array(input)) : await io.read(input);
  doc.setLogger(io.getLogger?.() ?? new Logger(Logger.Verbosity.SILENT));
  const steps = [];
  for (const [name, fn] of profile.steps()) {
    const before = counts(doc), t0 = performance.now();
    // the Basis encoder prints one line per mip slice on stdout; keep its mode line for the receipt and drop the rest
    const log = console.log, notes = [];
    if (name.startsWith('ktx2')) console.log = (...a) => { const l = a.join(' '); if (/^Mode:/.test(l)) notes.push(l); };
    try { await doc.transform(fn); } finally { console.log = log; }
    const rec = { step: name, ms: Math.round(performance.now() - t0), before, after: counts(doc), ...(notes.length ? { notes } : {}) };
    steps.push(rec); if (onStep) onStep(rec);
  }
  const t0 = performance.now();
  const bytes = Buffer.from(await io.writeBinary(doc));
  const writeMs = Math.round(performance.now() - t0);
  return { profile: profileId, bytes, steps, writeMs, doc };
}

export async function optimizeFile(inPath, outPath, profileId, opts) {
  const r = await optimize(fs.existsSync(inPath) && inPath.endsWith('.glb') ? fs.readFileSync(inPath) : inPath, profileId, opts);
  fs.writeFileSync(outPath, r.bytes);
  return r;
}
