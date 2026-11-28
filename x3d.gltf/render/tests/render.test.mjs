// node --test render/tests/render.test.mjs
//
// Needs headless Chromium (Playwright) with WebGL2 via SwiftShader. Every test is skipped (not failed) only when
// Chromium cannot be launched. Temp files live in one mkdtemp dir that is removed in after().

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { renderGlb, ENGINES } from '../render.mjs';
import { launchChromium, probeChromium } from '../browser.mjs';
import { frameCamera, boundsOfGlb, frameFromGlb } from '../frame.mjs';
import { compareImages, backgroundStats, BG_RGB } from '../imgstats.mjs';
import { buildVariant, expectedGeometry } from '../variants.mjs';
import { glbInfo } from '../glbinfo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDER_CLI = path.join(HERE, '..', 'render.mjs');
const COMPARE_CLI = path.join(HERE, '..', 'compare.mjs');
const BLENDER_IO = process.env.X3D_BLENDER_IO || path.join(HERE, '..', '..', '..', '..', 'x3d-blender-io');   // a checkout of x3d-blender-io, a sibling of x3d.loom by default
const STILL = path.join(BLENDER_IO, 'docs/brag/showpieces/stilllife/stilllife-addon.glb');
const PRISM = path.join(BLENDER_IO, 'docs/brag/showpieces/prismatica/prismatica-aurora-cathedral.glb');
const ENGINE_IDS = Object.keys(ENGINES); // three, babylon, xite, playcanvas

const probe = await probeChromium();
const skip = probe.ok ? false : `Chromium cannot launch: ${probe.error}`;

let tmp;
let browser;
const png = (name) => path.join(tmp, name);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x3dgltf-render-test-'));
  if (probe.ok) browser = await launchChromium();
});
after(async () => {
  await browser?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the showpiece inputs exist', () => {
  assert.ok(fs.existsSync(STILL), STILL);
  assert.ok(fs.existsSync(PRISM), PRISM);
});

describe('pure functions (no browser)', () => {
  test('frameCamera: all 8 bounds corners are inside the frustum with the margin, direction and fov are as documented', () => {
    const b = { min: [-1, -2, -3], max: [4, 1, 2] };
    const c = frameCamera(b);
    assert.equal(c.fov, 0.7854);
    assert.deepEqual(c.up, [0, 1, 0]);
    const d = [0.55, 0.35, 1];
    const dl = Math.hypot(...d);
    const toCam = c.position.map((p, i) => p - c.target[i]);
    const dist = Math.hypot(...toCam);
    d.forEach((v, i) => assert.ok(Math.abs(toCam[i] / dist - v / dl) < 1e-5, 'direction'));
    assert.deepEqual(c.target, [1.5, -0.5, -0.5]);
    // project the corners
    const f = toCam.map((v) => -v / dist);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (v) => v.map((x) => x / Math.hypot(...v));
    const r = nrm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    let worst = 0;
    for (let i = 0; i < 8; i++) {
      const p = [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]].map((v, k) => v - c.position[k]);
      const depth = p[0] * f[0] + p[1] * f[1] + p[2] * f[2];
      const x = (p[0] * r[0] + p[1] * r[1] + p[2] * r[2]) / depth;
      const y = (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) / depth;
      worst = Math.max(worst, Math.abs(x), Math.abs(y));
      assert.ok(depth > c.near && depth < c.far);
    }
    const t = Math.tan(c.fov / 2);
    assert.ok(worst <= t + 1e-6, `corner outside frustum: ${worst} > ${t}`);
    assert.ok(worst > t / 1.1 - 1e-3, 'the tightest corner touches the 1.1 margin line');
  });

  test('boundsOfGlb reads original, meshopt and Draco files (decoders registered) and they agree', async () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'bounds-'));
    const o = await boundsOfGlb(STILL);
    assert.ok(Math.abs(o.min[1] - -2.68) < 1e-3 && Math.abs(o.max[1] - 1.18854) < 1e-3, JSON.stringify(o));
    for (const v of ['meshopt', 'draco']) {
      const { path: p } = await buildVariant(STILL, v, path.join(dir, `${v}.glb`));
      const b = await boundsOfGlb(p);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(b.min[i] - o.min[i]) < 5e-3 && Math.abs(b.max[i] - o.max[i]) < 5e-3, `${v}: ${JSON.stringify(b)} vs ${JSON.stringify(o)}`);
      }
    }
  });

  test('compare: identical = 0 / inf, known offsets give the exact numbers', async () => {
    const mk = (r, g, b, file) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r, g, b } } }).png().toFile(file);
    await mk(100, 100, 100, png('a.png'));
    await mk(100, 100, 100, png('a2.png'));
    await mk(110, 110, 110, png('b10.png'));
    await mk(120, 100, 100, png('b20.png'));
    const same = await compareImages(png('a.png'), png('a2.png'));
    assert.equal(same.meanAbsDelta, 0);
    assert.equal(same.psnrDb, Infinity);
    assert.equal(same.fractionOverThreshold, 0);
    const d10 = await compareImages(png('a.png'), png('b10.png'));
    assert.equal(d10.meanAbsDelta, 10);
    assert.ok(Math.abs(d10.psnrDb - 20 * Math.log10(255 / 10)) < 1e-9);
    assert.equal(d10.fractionOverThreshold, 0); // 10 <= 16
    const d20 = await compareImages(png('a.png'), png('b20.png'));
    assert.ok(Math.abs(d20.meanAbsDelta - 20 / 3) < 1e-12);
    assert.equal(d20.fractionOverThreshold, 1); // max channel 20 > 16
    const cli = spawnSync(process.execPath, [COMPARE_CLI, png('a.png'), png('b20.png'), '--json'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const j = JSON.parse(cli.stdout);
    assert.ok(Math.abs(j.meanAbsDelta - 20 / 3) < 1e-9 && j.fractionOverThreshold === 1);
    assert.equal(spawnSync(process.execPath, [COMPARE_CLI, png('a.png')]).status, 1);
  });
});

describe('(i) stilllife renders in all three engines at 256 px', { skip }, () => {
  for (const engine of ENGINE_IDS) {
    test(`${engine}: loaded, non-blank, geometry as in the file`, async (t) => {
      const exp = await expectedGeometry(STILL);
      const res = await renderGlb({ engine, glb: STILL, frameFrom: STILL, out: png(`still-${engine}.png`), size: 256, browser });
      const r = res.receipt;
      assert.equal(r.loaded, true, r.error);
      assert.equal(res.exitCode, 0);
      const st = await backgroundStats(png(`still-${engine}.png`));
      assert.ok(st.distinctColours > 3, `distinct colours ${st.distinctColours}`);
      assert.ok(st.meanDeltaFromBackground > 4, `mean delta from background ${st.meanDeltaFromBackground}`);
      assert.deepEqual(st.cornerPixel.map((c, i) => Math.abs(c - BG_RGB[i]) <= 1), [true, true, true], `clear colour is ${st.cornerPixel}, want ${BG_RGB}`);
      assert.equal(r.stats.triangles, exp.triangles, 'triangles the engine sees == triangles in the file');
      assert.equal(r.stats.meshes, exp.meshNodes);
      assert.equal(r.lighting.source, 'glb', 'stilllife declares KHR_lights_punctual lights');
      assert.ok(r.chromium && r.userAgent && /SwiftShader/i.test(r.webgl.renderer), JSON.stringify(r.webgl));
      t.diagnostic(`${engine} ${r.engine.version}: tris=${r.stats.triangles} meshes=${r.stats.meshes} meanDeltaFromBg=${f3(st.meanDeltaFromBackground)} nonBg=${(100 * st.nonBackgroundFraction).toFixed(1)}% load=${r.timing.loadMs}ms errors=${r.console.errors.length}`);
    });
  }

  test('handedness: no engine draws the stilllife mirrored (vase right, sphere left) relative to the others', async (t) => {
    // three is the reference. For each other engine the un-flipped picture must be far closer than its mirror image.
    const camera = await frameFromGlb(STILL);
    for (const engine of ENGINE_IDS) {
      const res = await renderGlb({ engine, glb: STILL, camera, out: png(`hand-${engine}.png`), size: 256, browser });
      assert.equal(res.receipt.loaded, true, res.receipt.error);
    }
    // The pedestal is almost mirror-symmetric, the objects on top are not (gold sphere left, marble cube middle, vase right):
    // compare only the band of rows that contains them (rows 20..100 of 256).
    const band = (file, flop) => {
      let s = sharp(file).extract({ left: 0, top: 20, width: 256, height: 80 });
      if (flop) s = s.flop();
      return s.png().toBuffer();
    };
    const ref = await band(png('hand-three.png'), false);
    const refMirrored = await band(png('hand-three.png'), true);
    for (const e of ['babylon', 'xite']) {
      const img = await band(png(`hand-${e}.png`), false);
      const a = await compareImages(ref, img);
      const b = await compareImages(refMirrored, img);
      t.diagnostic(`${e} vs three (object band): meanAbsDelta=${f3(a.meanAbsDelta)}; vs mirrored three: ${f3(b.meanAbsDelta)}; ratio ${(b.meanAbsDelta / a.meanAbsDelta).toFixed(1)}`);
      assert.ok(a.meanAbsDelta * 4 < b.meanAbsDelta, `${e} looks mirrored: ${a.meanAbsDelta} vs ${b.meanAbsDelta}`);
    }
  });

  test('a glb without lights gets the fallback headlight + ambient in every engine', async (t) => {
    const nl = (await buildVariant(STILL, 'nolights', png('still-nolights.glb'))).path;
    assert.equal(glbInfo(nl).declaredLights, 0);
    const camera = await frameFromGlb(STILL);
    for (const engine of ENGINE_IDS) {
      const res = await renderGlb({ engine, glb: nl, camera, out: png(`nl-${engine}.png`), size: 256, browser });
      assert.equal(res.receipt.loaded, true, res.receipt.error);
      assert.equal(res.receipt.lighting.source, 'fallback', engine);
      const st = await backgroundStats(png(`nl-${engine}.png`));
      assert.ok(st.meanDeltaFromBackground > 4 && st.distinctColours > 3, `${engine} blank? ${JSON.stringify(st)}`);
      t.diagnostic(`${engine}: fallback lighting, ${res.receipt.lighting.headlight}; meanDeltaFromBg=${f3(st.meanDeltaFromBackground)}`);
    }
  });
});

describe('(ii) determinism: the same file rendered twice (second time in a fresh Chromium)', { skip }, () => {
  for (const engine of ENGINE_IDS) {
    test(`${engine}: mean delta < 0.5`, async (t) => {
      const camera = await frameFromGlb(STILL);
      const a = await renderGlb({ engine, glb: STILL, camera, out: png(`det-${engine}-a.png`), size: 256, browser });
      const b = await renderGlb({ engine, glb: STILL, camera, out: png(`det-${engine}-b.png`), size: 256 }); // own browser
      assert.equal(a.receipt.loaded && b.receipt.loaded, true, a.receipt.error ?? b.receipt.error);
      const d = await compareImages(png(`det-${engine}-a.png`), png(`det-${engine}-b.png`));
      t.diagnostic(`DETERMINISM ${engine} ${a.receipt.engine.version} @256px, Chromium ${a.receipt.chromium}, ${a.receipt.webgl.renderer}: meanAbsDelta=${f3(d.meanAbsDelta)} PSNR=${Number.isFinite(d.psnrDb) ? d.psnrDb.toFixed(2) : 'inf'} dB px>16=${(100 * d.fractionOverThreshold).toFixed(4)}% maxChannelDelta=${d.maxChannelDelta} identicalBytes=${a.receipt.image.sha256 === b.receipt.image.sha256}`);
      assert.ok(d.meanAbsDelta < 0.5, `mean delta ${d.meanAbsDelta}`);
    });
  }
});

describe('(iii) prismatica: original vs meshopt vs Draco, same engine, same camera', { skip }, () => {
  const built = {};
  before(async () => {
    for (const v of ['meshopt', 'draco']) built[v] = await buildVariant(PRISM, v, png(`prism-${v}.glb`));
  });

  test('the variants really carry the extensions', () => {
    assert.ok(glbInfo(built.meshopt.path).usesMeshopt && glbInfo(built.meshopt.path).usesQuantization, 'meshopt file');
    assert.ok(glbInfo(built.draco.path).usesDraco, 'draco file');
    assert.ok(built.meshopt.bytes < fs.statSync(PRISM).size && built.draco.bytes < fs.statSync(PRISM).size, 'compressed files are smaller');
  });

  for (const engine of ENGINE_IDS) {
    test(`${engine}: loads both, decoder invoked, geometry intact, picture barely moves`, async (t) => {
      const camera = await frameFromGlb(PRISM);
      const exp = await expectedGeometry(PRISM);
      const orig = await renderGlb({ engine, glb: PRISM, camera, out: png(`p-${engine}-orig.png`), size: 256, browser });
      assert.equal(orig.receipt.loaded, true, orig.receipt.error);
      assert.equal(orig.receipt.stats.triangles, exp.triangles);
      const rows = [];
      for (const v of ['meshopt', 'draco']) {
        const res = await renderGlb({ engine, glb: built[v].path, camera, out: png(`p-${engine}-${v}.png`), size: 256, browser });
        const r = res.receipt;
        const row = { engine, variant: v, loaded: r.loaded, why: r.error };
        rows.push(row);
        assert.equal(r.loaded, true, `${engine} failed to load the ${v} file: ${r.error}; console: ${r.console.errors.join(' | ')}`);
        assert.equal(r.stats.triangles, exp.triangles, `${engine}/${v}: triangles seen`);
        const dec = r.decoders[v];
        assert.ok(dec.declaredInGlb, 'file declares the extension');
        const invoked = dec.calls === null ? dec.assetsFetched.length > 0 : dec.calls > 0;
        assert.ok(invoked, `${engine}/${v}: decoder was not invoked (calls=${dec.calls}, assets=${dec.assetsFetched})`);
        assert.equal(r.console.errors.length, 0, r.console.errors.join(' | '));
        const d = await compareImages(png(`p-${engine}-orig.png`), png(`p-${engine}-${v}.png`));
        Object.assign(row, { meanAbsDelta: d.meanAbsDelta, psnrDb: d.psnrDb, over16: d.fractionOverThreshold, calls: dec.calls });
        assert.ok(d.meanAbsDelta < 1.0, `${engine}/${v}: mean delta ${d.meanAbsDelta}`);
        assert.ok(d.fractionOverThreshold < 0.01, `${engine}/${v}: ${100 * d.fractionOverThreshold}% of pixels moved by more than 16`);
      }
      for (const r of rows) t.diagnostic(`${engine} ${orig.receipt.engine.version} ${r.variant}: meanAbsDelta=${f3(r.meanAbsDelta)} PSNR=${r.psnrDb.toFixed(2)} dB px>16=${(100 * r.over16).toFixed(4)}% decoderCalls=${r.calls}`);
    });
  }
});

describe('(iv) CLI contract', { skip }, () => {
  const camera = JSON.stringify({ position: [3, 2, 4], target: [0, 0, 0], up: [0, 1, 0], fov: 0.7854 });

  test('success: exit 0, PNG + receipt written, receipt has the required fields', () => {
    const r = spawnSync(process.execPath, [RENDER_CLI, '--engine', 'three', '--glb', STILL, '--frame-from', STILL, '--out', png('cli.png'), '--json', png('cli.json'), '--size', '128'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.statSync(png('cli.png')).size > 100);
    const rec = JSON.parse(fs.readFileSync(png('cli.json'), 'utf8'));
    assert.equal(rec.loaded, true);
    assert.equal(rec.engine.version, '0.187.0');
    for (const k of ['chromium', 'userAgent', 'webgl', 'size', 'camera', 'decoders', 'stats', 'timing', 'console', 'lighting', 'colour']) assert.ok(rec[k] != null, `receipt.${k}`);
    assert.ok(rec.stats.triangles > 0 && rec.stats.meshes > 0 && rec.timing.loadMs > 0);
    assert.ok(Array.isArray(rec.console.errors) && Array.isArray(rec.console.warnings));
    const a = fs.readFileSync(png('cli.png'));
    assert.equal(a.subarray(1, 4).toString(), 'PNG');
  });

  test('failure: a glb whose buffer is missing exits 2, still writes the receipt, writes no PNG (also removes a stale PNG)', () => {
    const bad = png('bad.glb');
    const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ uri: 'missing.bin', byteLength: 36 }] };
    let j = Buffer.from(JSON.stringify(json));
    while (j.length % 4) j = Buffer.concat([j, Buffer.from(' ')]);
    const head = Buffer.alloc(12);
    head.writeUInt32LE(0x46546c67, 0);
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(20 + j.length, 8);
    const ch = Buffer.alloc(8);
    ch.writeUInt32LE(j.length, 0);
    ch.writeUInt32LE(0x4e4f534a, 4);
    fs.writeFileSync(bad, Buffer.concat([head, ch, j]));
    for (const engine of ENGINE_IDS) {
      fs.writeFileSync(png(`bad-${engine}.png`), 'stale');
      const r = spawnSync(process.execPath, [RENDER_CLI, '--engine', engine, '--glb', bad, '--camera', camera, '--out', png(`bad-${engine}.png`), '--json', png(`bad-${engine}.json`), '--size', '64', '--timeout-ms', '20000'], { encoding: 'utf8' });
      assert.equal(r.status, 2, `${engine}: exit ${r.status}; ${r.stderr}`);
      assert.equal(fs.existsSync(png(`bad-${engine}.png`)), false, `${engine}: PNG must not exist after a failed load`);
      const rec = JSON.parse(fs.readFileSync(png(`bad-${engine}.json`), 'utf8'));
      assert.equal(rec.loaded, false);
      assert.match(rec.error, /missing\.bin|Couldn't load|Failed to load/i, `${engine}: ${rec.error}`);
      assert.ok(rec.console.errors.length + rec.network.httpErrors.length > 0, 'the failure shows up in the captured console / network log');
    }
  });

  test('failure before the browser starts (the file is not a GLB, no camera given): exit 2, receipt, no PNG', () => {
    fs.writeFileSync(png('garbage.glb'), 'this is not a glb');
    fs.writeFileSync(png('garbage.png'), 'stale');
    const r = spawnSync(process.execPath, [RENDER_CLI, '--engine', 'three', '--glb', png('garbage.glb'), '--out', png('garbage.png'), '--json', png('garbage.json')], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stderr);
    assert.equal(fs.existsSync(png('garbage.png')), false);
    const rec = JSON.parse(fs.readFileSync(png('garbage.json'), 'utf8'));
    assert.equal(rec.loaded, false);
    assert.match(rec.error, /framing failed|not a readable GLB/);
    // with an explicit camera the failure comes from the engine instead, and is still reported
    const r2 = spawnSync(process.execPath, [RENDER_CLI, '--engine', 'three', '--glb', png('garbage.glb'), '--camera', camera, '--out', png('garbage.png'), '--json', png('garbage2.json')], { encoding: 'utf8' });
    assert.equal(r2.status, 2, r2.stderr);
    assert.equal(JSON.parse(fs.readFileSync(png('garbage2.json'), 'utf8')).loaded, false);
  });

  test('usage errors exit 1', () => {
    assert.equal(spawnSync(process.execPath, [RENDER_CLI, '--engine', 'nope', '--glb', STILL, '--out', png('x.png')]).status, 1);
    assert.equal(spawnSync(process.execPath, [RENDER_CLI, '--engine', 'three']).status, 1);
    assert.equal(spawnSync(process.execPath, [RENDER_CLI, '--engine', 'three', '--glb', STILL, '--out', png('x.png'), '--camera', '{"position":[0,0,0]}']).status, 1);
  });
});

describe('(v) KTX2 texture on the stilllife glb (recorded per engine, not hidden)', { skip }, () => {
  test('three and X_ITE decode it; Babylon without its CDN decoder must show the failure in the receipt', async (t) => {
    const ktx = await buildVariant(STILL, 'ktx2', png('still-ktx2.glb'));
    assert.ok(glbInfo(ktx.path).usesKtx2);
    const camera = await frameFromGlb(STILL);
    const out = {};
    for (const engine of ENGINE_IDS) {
      const orig = await renderGlb({ engine, glb: STILL, camera, out: png(`k-${engine}-o.png`), size: 256, browser });
      const res = await renderGlb({ engine, glb: ktx.path, camera, out: png(`k-${engine}-k.png`), size: 256, browser, timeoutMs: 15000 });
      const r = res.receipt;
      out[engine] = r;
      if (r.loaded) {
        const d = await compareImages(png(`k-${engine}-o.png`), png(`k-${engine}-k.png`));
        t.diagnostic(`${engine} ${r.engine.version} KTX2: loaded, meanAbsDelta=${f3(d.meanAbsDelta)} px>16=${(100 * d.fractionOverThreshold).toFixed(4)}% ktx2=${JSON.stringify(r.ktx2 ?? r.decoders.ktx2.assetsFetched)} errors=${r.console.errors.length} blocked=${r.network.blocked.length}`);
      } else {
        t.diagnostic(`${engine} ${r.engine.version} KTX2: NOT LOADED: ${String(r.error).slice(0, 120)} | console: ${r.console.errors.join(' | ').slice(0, 300)} | blocked: ${r.network.blocked.join(', ')}`);
      }
    }
    assert.equal(out.three.loaded, true, out.three.error);
    assert.equal(out.xite.loaded, true, out.xite.error);
    assert.equal(out.three.ktx2.texturesCreated, 1);
    assert.ok(out.xite.decoders.ktx2.assetsFetched.some((p) => /libktx/.test(p)), 'X_ITE fetched libktx');
    // Babylon: either it loads with a decoder it found locally, or the failure is visible. It must never be a silent success.
    const b = out.babylon;
    if (b.loaded) {
      assert.equal(b.network.blocked.length, 0, 'Babylon loaded KTX2 while requesting external URLs that the oracle had to block');
    } else {
      assert.ok(b.console.errors.length > 0 || b.network.blocked.length > 0, 'a failed KTX2 load must leave evidence in the receipt');
    }
  });
});

describe('(vi) sensitivity: the oracle can see damage, not only agree with itself', { skip }, () => {
  test('5-bit Draco positions move the picture >20x more than ordinary Draco, in every engine', async (t) => {
    const camera = await frameFromGlb(STILL);
    const good = await buildVariant(STILL, 'draco', png('s-draco.glb'));
    const bad = await buildVariant(STILL, 'dracoCoarse', png('s-dracoCoarse.glb'));
    for (const engine of ENGINE_IDS) {
      const o = await renderGlb({ engine, glb: STILL, camera, out: png(`s-${engine}-o.png`), size: 256, browser });
      const g = await renderGlb({ engine, glb: good.path, camera, out: png(`s-${engine}-g.png`), size: 256, browser });
      const b = await renderGlb({ engine, glb: bad.path, camera, out: png(`s-${engine}-b.png`), size: 256, browser });
      for (const r of [o, g, b]) assert.equal(r.receipt.loaded, true, r.receipt.error);
      const dg = await compareImages(png(`s-${engine}-o.png`), png(`s-${engine}-g.png`));
      const db = await compareImages(png(`s-${engine}-o.png`), png(`s-${engine}-b.png`));
      t.diagnostic(`${engine} ${o.receipt.engine.version}: draco(14-bit) meanAbsDelta=${f3(dg.meanAbsDelta)} px>16=${(100 * dg.fractionOverThreshold).toFixed(4)}%; dracoCoarse(5-bit) meanAbsDelta=${f3(db.meanAbsDelta)} px>16=${(100 * db.fractionOverThreshold).toFixed(4)}%`);
      assert.ok(db.meanAbsDelta > 20 * dg.meanAbsDelta, `${engine}: coarse ${db.meanAbsDelta} vs ordinary ${dg.meanAbsDelta}`);
      assert.ok(db.fractionOverThreshold > 0.005, `${engine}: only ${100 * db.fractionOverThreshold}% of pixels moved by more than 16`);
    }
  });
});
