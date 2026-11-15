// Browser entry: the same optimiser and the same gates the Node CLI runs, bundled for the glb Forge demo (tools/build-web.mjs -> web/dist/forge.bundle.js).
// forge(bytes, profileId) -> { bytes, report }. report mirrors the CLI's gates (identity, geometry, materials, animation); the Khronos validator, Draco and KTX2
// are Node-only and are not claimed here.
import { Logger } from '@gltf-transform/core';
import { makeWebIO, MeshoptEncoder } from '../src/io-web.mjs';
import { portableProfiles } from '../src/profiles-core.mjs';
import { compareDocs } from '../src/gates.mjs';
import { inventory, byteBreakdown } from '../src/measure.mjs';

export const PROFILES = portableProfiles(MeshoptEncoder);
export const PROFILE_IDS = Object.keys(PROFILES);
const counts = (doc) => { const R = doc.getRoot(); return { nodes: R.listNodes().length, meshes: R.listMeshes().length, materials: R.listMaterials().length, accessors: R.listAccessors().length }; };

export async function gzipSize(bytes) {
  const cs = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
  return (await cs.arrayBuffer()).byteLength;
}

export async function inspectBytes(bytes) {
  const io = await makeWebIO(), doc = await io.readBinary(new Uint8Array(bytes));
  const inv = inventory(doc); delete inv.textureList;
  return { inventory: inv, bytes: byteBreakdown(new Uint8Array(bytes)), gzip: await gzipSize(bytes) };
}

export async function forge(sourceBytes, profileId, { onStep = null } = {}) {
  const profile = PROFILES[profileId]; if (!profile) throw new Error('unknown profile ' + profileId);
  const io = await makeWebIO(); io.setLogger(new Logger(Logger.Verbosity.SILENT));
  const src = new Uint8Array(sourceBytes);
  const doc = await io.readBinary(src), srcDoc = await io.readBinary(src);
  const steps = [];
  for (const [name, fn] of profile.steps()) {
    const before = counts(doc), t0 = performance.now();
    await doc.transform(fn);
    const rec = { step: name, ms: Math.round(performance.now() - t0), before, after: counts(doc) }; steps.push(rec);
    if (onStep) onStep(rec);
    await new Promise((r) => setTimeout(r, 0));   // let the page paint between steps
  }
  const out = await io.writeBinary(doc);
  const outDoc = await io.readBinary(out);
  const g = await compareDocs({ srcDoc, outDoc, srcBytes: src, outBytes: out, io, contract: profile });
  const inv = { source: inventory(srcDoc), output: inventory(outDoc) }; delete inv.source.textureList; delete inv.output.textureList;
  return { bytes: out, report: { profile: profileId, contract: { identity: profile.identity, geometry: profile.geometry, writes: profile.writes, summary: profile.summary }, ok: g.failures.length === 0, failures: g.failures, notes: g.notes,
    identity: { sourceTokens: g.id.sourceTokens, outputTokens: g.id.outputTokens, preserved: g.id.preserved, lost: g.id.lost.length, added: g.id.added.length, lostByKind: g.lostByKind, lostSample: g.id.lost.slice(0, 8), defPath: g.id.defPath },
    geometry: g.geo, materials: g.mat, animation: g.anim, inventory: inv, steps, bytes: { source: src.byteLength, output: out.byteLength } } };
}
