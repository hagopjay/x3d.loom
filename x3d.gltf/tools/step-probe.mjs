// Which single glTF-Transform steps keep the X3D identity of a glb? Each step runs alone on a fresh read of each glb; the identity multiset is diffed.
//   node tools/step-probe.mjs OUT.json OUT.md  FILE.glb [FILE.glb ...]
import fs from 'node:fs';
import path from 'node:path';
import { dedup, prune, flatten, join, weld, quantize, reorder, instance, palette, meshopt, draco, simplify, resample, sparse } from '@gltf-transform/functions';
import { makeIO, MeshoptEncoder } from '../src/io.mjs';
import { snapshot, diffIdentity } from '../src/identity.mjs';
import { quantizeKeepingIdentity } from '../src/quantize-identity.mjs';
import { instanceWithIdentity } from '../src/instance-identity.mjs';
import { SAFE_DEDUP, SAFE_PRUNE } from '../src/profiles-core.mjs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { animationSummary, compareAnimation } from '../src/animation.mjs';

const [outJson, outMd, ...files] = process.argv.slice(2);
const io = await makeIO();
await MeshoptSimplifier.ready;
const STEPS = [
  ['dedup() stock', () => dedup()], ['dedup SAFE (accessor, texture)', SAFE_DEDUP],
  ['prune() stock', () => prune()], ['prune SAFE (keepLeaves, keepExtras, keepAttributes)', SAFE_PRUNE],
  ['weld()', () => weld()], ['reorder()', () => reorder({ encoder: MeshoptEncoder })],
  ['quantize() stock', () => quantize()], ['quantize wrapper (marks helper nodes)', () => quantizeKeepingIdentity()],
  ['meshopt() stock', () => meshopt({ encoder: MeshoptEncoder })], ['draco() stock', () => draco()],
  ['flatten()', () => flatten()], ['join()', () => join()], ['palette({min:5})', () => palette({ min: 5 })],
  ['instance({min:2}) stock', () => instance({ min: 2 })], ['instance wrapper (stamps x3d_instances)', () => instanceWithIdentity({ min: 2 })],
  ['simplify(0.5)', () => simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.01 })],
  ['resample()', () => resample()], ['sparse()', () => sparse()],
];
const rows = [];
for (const f of files) {
  const bytes = fs.readFileSync(f), baseDoc = await io.readBinary(new Uint8Array(bytes)), base = snapshot(baseDoc), baseAnim = animationSummary(baseDoc);
  for (const [name, mk] of STEPS) {
    const doc = await io.readBinary(new Uint8Array(bytes));
    const t0 = performance.now(); let err = null;
    try { await doc.transform(mk()); } catch (e) { err = String(e.message).slice(0, 80); }
    if (err) { rows.push({ file: path.basename(f), step: name, error: err }); continue; }
    // write and re-read so compression extensions are exercised the way a delivered file is
    const out = await io.writeBinary(doc), outDoc = await io.readBinary(out), d = diffIdentity(base, snapshot(outDoc)), an = compareAnimation(baseAnim, animationSummary(outDoc));
    rows.push({ file: path.basename(f), step: name, sourceTokens: d.sourceTokens, lost: d.lost.length, added: d.added.length, taggedLost: d.taggedLost, defPathHolds: d.defPath.outputHolds, defPathClaims: d.defPath.outputClaims, sourceDefPathHolds: d.defPath.sourceHolds, channels: an.channelsSource, channelsUnmatched: an.unmatched, bytes: [bytes.length, out.length], ms: Math.round(performance.now() - t0) });
  }
}
fs.writeFileSync(outJson, JSON.stringify(rows, null, 1) + '\n');
const md = ['| glb | step | tokens before | lost | added | x3d-tagged lost | def_path claims holding (before -> after) | animation channels unmatched | KiB before -> after |', '|---|---|---:|---:|---:|---:|---|---:|---|'];
for (const r of rows) md.push(r.error ? `| ${r.file} | ${r.step} | | ERROR ${r.error} | | | | | |` : `| ${r.file} | ${r.step} | ${r.sourceTokens} | ${r.lost} | ${r.added} | ${r.taggedLost} | ${r.sourceDefPathHolds}/${r.defPathClaims} -> ${r.defPathHolds}/${r.defPathClaims} | ${r.channelsUnmatched}/${r.channels} | ${(r.bytes[0] / 1024).toFixed(1)} -> ${(r.bytes[1] / 1024).toFixed(1)} |`);
fs.writeFileSync(outMd, md.join('\n') + '\n');
console.log(md.join('\n'));
