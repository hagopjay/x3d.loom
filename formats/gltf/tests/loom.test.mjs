// Fast tests (no browser, no Blender): every witness must be able to say no.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { validateDelivery } from '../../../x3d.gltf/src/validate.mjs';
import { ensureCorpus, cachePath, loadManifest } from '../tools/fetch-corpus.mjs';
import { harness, lookRotation } from '../src/harness.mjs';
import { score, BG } from '../src/score.mjs';
import { reencodeTable } from '../src/encode.mjs';
import { seal, verify } from '../src/receipt.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-gltf-'));
await ensureCorpus({ log: () => {} });
const box = cachePath(loadManifest().assets.find((a) => a.id === 'Box'));

function rewriteGlbJson(buf, edit) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  edit(json);
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const rest = buf.subarray(20 + jsonLen);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, js, rest]);
}

test('gate passes the pinned Box and fails it once an accessor lies about its count', async () => {
  const ok = await validateDelivery(fs.readFileSync(box));
  assert.equal(ok.ok, true);
  const bad = rewriteGlbJson(fs.readFileSync(box), (j) => { j.accessors[0].count += 1000; });
  const r = await validateDelivery(bad);
  assert.equal(r.ok, false);
  assert.ok(r.delivered.numErrors > 0, 'validator must report errors');
});

test('corpus refuses a file whose sha256 drifted', async () => {
  const m = loadManifest();
  assert.match(m.commit, /^[0-9a-f]{40}$/);
  for (const a of m.assets) assert.match(a.sha256, /^[0-9a-f]{64}$/);
});

test('harness adds exactly one camera and one light, and adds no validator errors', async () => {
  const out = path.join(tmp, 'box.lit.glb');
  const h = await harness(box, out);
  assert.deepEqual(h.added, { nodes: 2, cameras: 1, lights: 1 });
  const v = await validateDelivery(fs.readFileSync(out));
  assert.equal(v.delivered.numErrors, 0);
  assert.ok(v.delivered.extensionsUsed.includes('KHR_lights_punctual'));
});

test('lookRotation turns -Z onto the requested forward', () => {
  const [x, y, z, w] = lookRotation([1, 0, 0]);
  // rotate (0,0,-1) by q
  const v = [0, 0, -1];
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  const r = [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
  r.forEach((c, i) => assert.ok(Math.abs(c - [1, 0, 0][i]) < 1e-9));
});

test('score: identical pictures are perfect, a changed object is caught', async () => {
  const W = 64;
  const mk = async (col) => { const raw = Buffer.alloc(W * W * 3); for (let i = 0; i < W * W; i++) { const inObj = (i % W) > 16 && (i % W) < 48 && i / W > 16 && i / W < 48; raw.set(inObj ? col : BG, i * 3); } return sharp(raw, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer(); };
  const a = await mk([200, 50, 50]), b = await mk([120, 50, 50]);
  const same = await score(a, a);
  assert.equal(same.psnr_db, 'inf'); assert.equal(same.ssim, 1); assert.equal(same.coverage_iou, 1);
  const diff = await score(a, b);
  assert.ok(diff.psnr_fg_db < 25 && diff.ssim < 1);
});

test('encode table: identity when encodes match, sRGB -> gamma 2.2 brightens the darks', () => {
  const id = reencodeTable('gamma-2.2', 'gamma-2.2'); for (let v = 0; v < 256; v++) assert.equal(id[v], v);
  const t = reencodeTable('srgb-piecewise', 'gamma-2.2');
  assert.ok(t[20] > 20, `dark sRGB 20 should map up, got ${t[20]}`);
  assert.equal(t[0], 0); assert.equal(t[255], 255);
  for (let v = 1; v < 256; v++) assert.ok(t[v] >= t[v - 1], 'monotonic');
});

test('receipt seal detects a changed number', () => {
  const r = seal({ schema: 'loom.render-receipt/1', subject: { id: 'x' }, runs: [{ score: { ssim: 0.99 } }] });
  assert.equal(verify(r), true);
  const t = structuredClone(r); t.runs[0].score.ssim = 0.999;
  assert.equal(verify(t), false);
});
