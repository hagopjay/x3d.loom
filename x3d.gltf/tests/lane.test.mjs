// The lane's own tests. They build their inputs (fixtures/build.mjs), so they need no Blender and no network.
// Negative controls matter as much as the passes: a gate that cannot fail proves nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dedup } from '@gltf-transform/functions';
import { buildFixtures } from '../fixtures/build.mjs';
import { runCase } from '../src/run.mjs';
import { optimize } from '../src/optimize.mjs';
import { verify, loadDoc } from '../src/verify.mjs';
import { makeIO } from '../src/io.mjs';
import { validateDelivery } from '../src/validate.mjs';
import { PROFILE_IDS, PROFILES } from '../src/profiles.mjs';
import { snapshot, diffIdentity } from '../src/identity.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x3dgltf-test-'));
const fx = await buildFixtures(path.join(tmp, 'fx'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const read = (n) => fs.readFileSync(fx[n]);
const BIN = new URL('../bin/x3dgltf.mjs', import.meta.url).pathname;

test('fixtures are valid glb and carry X3D identity', async () => {
  for (const n of Object.keys(fx)) { const r = await validateDelivery(read(n)); assert.equal(r.delivered.numErrors, 0, n); assert.equal(r.delivered.numWarnings, 0, n); }
  const s = snapshot(await loadDoc(read('identity-dup')));
  assert.ok(s.tokens.some((t) => t.startsWith('node|LeftBox|') && t.includes('"x3d_def":"LeftBox"')));
  assert.ok(s.tokens.some((t) => t.startsWith('scene|') && t.includes('x3d_head_meta')));
});

test('every identity-exact profile keeps every token, triangle, material and channel (all fixtures it applies to)', async () => {
  const geoOnly = PROFILE_IDS.filter((p) => PROFILES[p].identity === 'exact' && !p.includes('ktx2'));
  for (const f of ['identity-dup', 'repeated', 'animated', 'dense']) for (const p of geoOnly) {
    const { row } = await runCase(fx[f], p);
    assert.ok(row.ok, `${f} ${p}: ${row.failures.join('; ')}`);
    assert.equal(row.identity.lost, 0, `${f} ${p} lost`); assert.equal(row.identity.added, 0, `${f} ${p} added`);
  }
});

test('trap: stock dedup() keeps tagged duplicates (extras differ) but folds name-only duplicates; the lane\'s dedup keeps both', async () => {
  const io = await makeIO();
  const naive = await io.readBinary(new Uint8Array(read('identity-dup')));
  await naive.transform(dedup());
  const d = diffIdentity(snapshot(await loadDoc(read('identity-dup'))), snapshot(naive));
  assert.ok(d.lost.some((t) => t.startsWith('material|MD|')), 'MD folded into MC');
  assert.ok(d.lost.some((t) => t.startsWith('mesh|MeshD|')), 'MeshD folded into MeshC');
  assert.ok(!d.lost.some((t) => t.includes('MatB') || t.includes('ShapeB')), 'tagged duplicates survive stock dedup: extras take part in the comparison');
  const { row } = await runCase(fx['identity-dup'], 'lossless'); assert.equal(row.identity.lost, 0);
});

test('instancing keeps each instance\'s DEF; join does not (the cost of crunching draw calls)', async () => {
  const inst = await runCase(fx.repeated, 'instanced');
  assert.ok(inst.row.ok, inst.row.failures.join('; '));
  assert.equal(inst.row.identity.lost, 0); assert.equal(inst.row.identity.added, 0);
  assert.equal(inst.row.drawCalls[0], 40); assert.equal(inst.row.drawCalls[1], 1);
  assert.ok(inst.row.nodes[1] <= 4, `nodes ${inst.row.nodes}`);
  const doc = await loadDoc(inst.output);
  const batch = doc.getRoot().listNodes().find((n) => n.getExtension('EXT_mesh_gpu_instancing'));
  assert.equal(batch.getExtras().x3d_instances.length, 40); assert.equal(batch.getExtras().x3d_instances[7].e.x3d_def, 'Bolt_7');
  const joined = await runCase(fx.repeated, 'static-joined');
  assert.ok(joined.row.identity.lost >= 39, `join lost ${joined.row.identity.lost}`);   // every Bolt_i but the one whose name the merged node keeps
  assert.ok(joined.row.drawCalls[1] <= 1);
});

test('compression: meshopt and Draco cut a dense mesh below half, meshopt-lossless is bit exact, all validate decoded', async () => {
  const src = read('dense').length;
  for (const [p, max] of [['web', 0.5], ['draco', 0.5], ['quantized', 0.75]]) {
    const { row, report } = await runCase(fx.dense, p);
    assert.ok(row.ok, `${p}: ${row.failures.join('; ')}`); assert.ok(row.bytes.output / src < max, `${p} ratio ${row.bytes.ratio}`);
    if (p !== 'quantized') { assert.ok(report.validator.canonical, 'canonical validated'); assert.equal(report.validator.canonical.errors, 0); assert.ok(report.validator.delivered.extensionsNotValidated.length > 0, `${p}: validator should report an extension it does not know`); }
  }
  const ml = await runCase(fx.dense, 'meshopt-lossless'); assert.ok(ml.report.geometry.centroid.maxAbs < 1e-12, `${ml.report.geometry.centroid.maxAbs}`); assert.ok(ml.row.ok);
});

test('KTX2: ETC1S texture passes the container check, the validator warnings are explained, GPU memory falls', async () => {
  const { row, report } = await runCase(fx.textured, 'web-ktx2-etc1s');
  assert.ok(row.ok, row.failures.join('; '));
  assert.equal(report.ktx2.length, 1); assert.ok(report.ktx2[0].ok); assert.equal(report.ktx2[0].info.colorModel, 'ETC1S');
  assert.equal(report.validator.delivered.explainedWarnings, 2); assert.equal(report.validator.delivered.unexplainedWarnings, 0);
  assert.ok(report.inventory.output.textureList[0].mime === 'image/ktx2');
});

test('animation survives byte for byte under the web profile (no resample)', async () => {
  const { report } = await runCase(fx.animated, 'web');
  assert.equal(report.animation.channelsSource, 3); assert.equal(report.animation.matched, 3); assert.equal(report.animation.exactKeys, 3);
  assert.equal(report.animation.maxTimeDelta, 0); assert.ok(report.animation.maxValueDelta < 1e-9, `${report.animation.maxValueDelta}`);
});

// ---- negative controls: the gates must be able to fail ----
async function tamper(name, profile, fn) {
  const io = await makeIO(), src = read(name), out = await optimize(src, profile);
  const doc = await io.readBinary(new Uint8Array(out.bytes)); await fn(doc);
  return verify(src, Buffer.from(await io.writeBinary(doc)), profile);
}
test('negative control: moving geometry 2% fails the geometry gate', async () => {
  const rep = await tamper('dense', 'lossless', (d) => { for (const a of d.getRoot().listAccessors()) if (a.getType() === 'VEC3' && a.getName().endsWith('_pos')) { const arr = a.getArray(); for (let i = 0; i < arr.length; i++) arr[i] *= 1.02; a.setArray(arr); } });
  assert.equal(rep.ok, false); assert.ok(rep.failures.some((f) => f.startsWith('geometry')), rep.failures.join('; '));
});
test('negative control: stripping a DEF fails the identity gate', async () => {
  const rep = await tamper('identity-dup', 'lossless', (d) => { d.getRoot().listNodes().find((n) => n.getName() === 'LeftBox').setExtras({}); });
  assert.equal(rep.ok, false); assert.ok(rep.failures.some((f) => f.startsWith('identity')), rep.failures.join('; '));
});
test('negative control: changing a base colour fails the material gate', async () => {
  const rep = await tamper('identity-dup', 'lossless', (d) => { d.getRoot().listMaterials()[0].setBaseColorFactor([0, 0, 1, 1]); });
  assert.equal(rep.ok, false); assert.ok(rep.failures.some((f) => f.startsWith('materials')), rep.failures.join('; '));
});
test('negative control: shifting a keyframe fails the animation gate', async () => {
  const rep = await tamper('animated', 'lossless', (d) => { const s = d.getRoot().listAnimations()[0].listSamplers().find((x) => x.getOutput().getType() === 'VEC3'); const a = s.getOutput().getArray(); a[4] += 0.5; s.getOutput().setArray(a); });
  assert.equal(rep.ok, false); assert.ok(rep.failures.some((f) => f.startsWith('animation')), rep.failures.join('; '));
});

test('CLI: optimize passes, verify fails on a damaged file, exit codes follow', () => {
  const out = path.join(tmp, 'cli.glb');
  const a = spawnSync('node', [BIN, 'optimize', fx.dense, out, '--profile', 'web'], { encoding: 'utf8' });
  assert.equal(a.status, 0, a.stderr + a.stdout); assert.match(a.stdout, /PASS/);
  const bad = Buffer.from(fs.readFileSync(out)); bad.writeUInt32LE(0, 8);   // glb length field zeroed
  fs.writeFileSync(path.join(tmp, 'bad.glb'), bad);
  const b = spawnSync('node', [BIN, 'verify', fx.dense, path.join(tmp, 'bad.glb'), '--profile', 'web'], { encoding: 'utf8' });
  assert.notEqual(b.status, 0);
  const c = spawnSync('node', [BIN, 'inspect', fx.repeated], { encoding: 'utf8' }); assert.equal(c.status, 0); assert.match(c.stdout, /draw calls 40/);
});

// A node that stores a 4x4 `matrix` (the Castle exporter does) is decomposed by glTF-Transform on read, and its writer snaps a scale within float32 noise of 1.
// That is a real, bounded, measured deviation (2.19e-9 of the diagonal on the Castle annotation-standard glb); the exact bound is one float32 ULP, and a real move must still fail.
function repackGlb(bytes, edit) {
  const b = Buffer.from(bytes), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString());
  edit(json);
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const rest = b.subarray(20 + jl), total = 12 + 8 + js.length + rest.length;
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, js, rest]);
}
test('matrix nodes: float32 noise in a stored matrix passes an exact profile, a real 0.1% scale change still fails the gate', async () => {
  const src = repackGlb(read('repeated'), (j) => { for (const n of j.nodes) if (n.mesh != null) { const t = n.translation || [0, 0, 0]; n.matrix = [1.00000004, 0, 0, 0, 0, 1.00000004, 0, 0, 0, 0, 1.00000004, 0, t[0], t[1], t[2], 1]; delete n.translation; delete n.rotation; delete n.scale; } });
  assert.equal((await validateDelivery(src)).delivered.numErrors, 0);
  const out = (await optimize(src, 'lossless', { silent: true })).bytes;
  const ok = await verify(src, out, 'lossless'); assert.ok(ok.ok, ok.failures.join('; '));
  assert.ok(ok.geometry.centroid.maxRel < 1e-7, `${ok.geometry.centroid.maxRel}`);
  const moved = repackGlb(out, (j) => { for (const n of j.nodes) if (n.mesh != null) { n.scale = [1.001, 1.001, 1.001]; } });
  const bad = await verify(src, moved, 'lossless'); assert.ok(!bad.ok); assert.ok(bad.failures.some((f) => /geometry/.test(f)), bad.failures.join('; '));
});
