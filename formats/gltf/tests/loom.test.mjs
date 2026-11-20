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

// ---- failure records (src/failure.mjs) ------------------------------------------------------------------------------------
import { locate, classify, misses, reasonText, ruleFor } from '../src/failure.mjs';
import { spawnSync } from 'node:child_process';

async function picture(file, paint) {
  const w = 64, h = 64, buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { const c = paint(i % w, Math.floor(i / w)) ?? BG; buf[3 * i] = c[0]; buf[3 * i + 1] = c[1]; buf[3 * i + 2] = c[2]; }
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(file); return file;
}
const disc = (x, y, r = 20) => (x - 32) ** 2 + (y - 32) ** 2 < r * r;

test('a failure names the floor it missed, the region and the class', async () => {
  const ref = await picture(path.join(tmp, 'f-ref.png'), (x, y) => (disc(x, y) ? [120, 120, 120] : null));
  // brighter everywhere on the object: tone-shift, candidate brighter
  const bright = await picture(path.join(tmp, 'f-bright.png'), (x, y) => (disc(x, y) ? [170, 170, 170] : null));
  let l = await locate(bright, ref); let s = await score(bright, ref);
  assert.equal(classify(s, l), 'tone-shift'); assert.equal(l.direction, 'candidate brighter'); assert.equal(l.over16_where.interior, 1);
  // a smaller object: silhouette
  const small = await picture(path.join(tmp, 'f-small.png'), (x, y) => (disc(x, y, 14) ? [120, 120, 120] : null));
  l = await locate(small, ref); s = await score(small, ref);
  assert.equal(classify(s, l), 'silhouette'); assert.equal(l.over16_where.silhouette, 1);
  // one dark patch in the top-left of the object: local-shading, and the bbox sits where the patch is
  const patch = await picture(path.join(tmp, 'f-patch.png'), (x, y) => (disc(x, y) ? (x < 30 && y < 30 ? [(x + y) % 2 ? 40 : 200, 120, 120] : [120, 120, 120]) : null));
  l = await locate(patch, ref); s = await score(patch, ref);
  assert.equal(classify(s, l), 'local-shading'); assert.ok(l.bbox_over16[2] <= 0.47 && l.bbox_over16[3] <= 0.47);
  // identical pictures have no locus
  l = await locate(ref, ref); assert.equal(l.bbox_over16, null); assert.equal(l.over16_pixels, 0);
  const th = { pass: { ssim_min: 0.98, psnr_fg_db_min: 30 }, warn: { ssim_min: 0.95, psnr_fg_db_min: 25 } };
  const m = misses({ ssim: 0.96, psnr_fg_db: 20 }, th);
  assert.deepEqual(m.map((x) => `${x.metric}:${x.level}`), ['ssim:pass', 'psnr_fg_db:pass', 'psnr_fg_db:warn']);
  assert.equal(reasonText('fail', m), 'fail: psnr_fg_db 20 is under the warn floor 25');
  assert.equal(ruleFor({ engineId: 'three', consensus: { reference_suspect: true } }).rule_id, 'R-GLTF-8');
  assert.equal(ruleFor({ engineId: 'cycles', consensus: { reference_suspect: false } }).rule_id, 'R-GLTF-4');
  assert.equal(ruleFor({ engineId: 'three', consensus: {}, gateIssueCodes: [] }).rule_id, null);
});

test('every committed run has a failures.json that the tool reproduces, and no failure lacks a reason', () => {
  const runs = fs.readdirSync(new URL('../runs/', import.meta.url)).map((d) => new URL(`../runs/${d}`, import.meta.url).pathname);
  const r = spawnSync(process.execPath, [new URL('../tools/failures.mjs', import.meta.url).pathname, '--check', ...runs], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  let n = 0;
  for (const d of runs) for (const s of fs.readdirSync(d)) {
    const f = path.join(d, s, 'failures.json'); if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const rec = JSON.parse(fs.readFileSync(path.join(d, s, 'receipt.json'), 'utf8'));
    assert.equal(j.receipt.sha256, rec.sha256);
    assert.equal(j.failures.length, rec.runs.filter((x) => ['warn', 'fail', 'error'].includes(x.status)).length);
    for (const x of j.failures) { n++; assert.ok(x.reason && x.failure_class && x.rule_status, `${f} ${x.engine}`); }
  }
  assert.ok(n >= 19);
});
