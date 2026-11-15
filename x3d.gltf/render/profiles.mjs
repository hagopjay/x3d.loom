#!/usr/bin/env node
// The render oracle applied to the lane's own profiles (matrix.mjs uses plain glTF-Transform variants; this one uses `x3dgltf optimize`).
// For every showpiece x profile x engine: optimise, render in that engine from the ORIGINAL file's camera, and compare with the same engine's picture of the original.
// The two trap profiles are in on purpose: their pictures should look the same as the original while the identity gate says the X3D identity is gone.
//
//   node render/profiles.mjs [--size 256] [--files stilllife,prismatica,asterion,lumen] [--profiles lossless,web,...] [--engines three,babylon,xite]
//                            [--json receipts/render-profiles.json] [--md receipts/render-profiles.md]
//
// Needs headless Chromium (Playwright). Babylon.js loads its KTX2 transcoders from its CDN at run time and the oracle is offline, so KTX2 profiles are not run in Babylon
// (recorded as `not run`, not as a pass). Nothing here is timed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { renderGlb, ENGINES } from './render.mjs';
import { launchChromium } from './browser.mjs';
import { boundsOfGlb, frameCamera } from './frame.mjs';
import { compareImages } from './imgstats.mjs';
import { optimize } from '../src/optimize.mjs';
import { verify } from '../src/verify.mjs';

const BLENDER_IO = process.env.X3D_BLENDER_IO || fileURLToPath(new URL('../../../x3d-blender-io/', import.meta.url));
const SHOW = (rel) => path.join(BLENDER_IO, 'docs/brag/showpieces', rel);
export const FILES = {
  stilllife: SHOW('stilllife/stilllife-addon.glb'),
  prismatica: SHOW('prismatica/prismatica-aurora-cathedral.glb'),
  asterion: SHOW('asterion/asterion.glb'),
  lumen: SHOW('lumen/lumen.glb'),
};
export const PROFILE_SET = ['lossless', 'meshopt-lossless', 'quantized', 'web', 'web-filter', 'draco', 'instanced', 'web-ktx2', 'web-ktx2-etc1s', 'stock-instance', 'static-joined'];
const NEEDS_KTX2_IN_ENGINE = new Set(['web-ktx2', 'web-ktx2-etc1s']);

export async function runProfiles({ size = 256, timeoutMs = 25000, files = Object.keys(FILES), profiles = PROFILE_SET, engines = Object.keys(ENGINES), outDir, log = () => {} } = {}) {
  const browser = await launchChromium();
  const rows = [];
  try {
    for (const id of files) {
      const orig = FILES[id]; if (!fs.existsSync(orig)) { log(`skip ${id}: ${orig} not found (set X3D_BLENDER_IO)`); continue; }
      const origBytes = fs.readFileSync(orig), camera = frameCamera(await boundsOfGlb(orig));
      const base = {};
      for (const engine of engines) {
        const png = path.join(outDir, `${id}-original-${engine}.png`);
        const res = await renderGlb({ engine, glb: orig, out: png, size, camera, browser, timeoutMs });
        base[engine] = res.receipt.loaded ? png : null;
        log(`${id}/original/${engine}: ${res.receipt.loaded ? 'loaded' : 'FAILED'}`);
      }
      for (const profile of profiles) {
        const hasTex = id === 'stilllife'; if (NEEDS_KTX2_IN_ENGINE.has(profile) && !hasTex) continue;   // no texture, nothing for KTX2 to do
        const o = await optimize(origBytes, profile, { silent: true });
        const rep = await verify(origBytes, o.bytes, profile);
        const glb = path.join(outDir, `${id}-${profile}.glb`); fs.writeFileSync(glb, o.bytes);
        for (const engine of engines) {
          const row = { file: id, profile, engine, bytes: o.bytes.length, gates: rep.ok, identityLost: rep.identity.lost, identityTokens: rep.identity.sourceTokens, drawCalls: [rep.inventory.source.drawCalls, rep.inventory.output.drawCalls], loaded: null, triangles: null, vsOriginal: null, note: null };
          if (engine === 'babylon' && NEEDS_KTX2_IN_ENGINE.has(profile)) { row.note = 'not run: Babylon.js fetches its KTX2 transcoders from its CDN at run time and the oracle is offline'; rows.push(row); log(`${id}/${profile}/${engine}: not run (KTX2 transcoders are CDN-only)`); continue; }
          const png = path.join(outDir, `${id}-${profile}-${engine}.png`);
          const res = await renderGlb({ engine, glb, out: png, size, camera, browser, timeoutMs });
          const r = res.receipt; row.loaded = r.loaded; row.triangles = r.stats?.triangles ?? null; row.error = r.error ?? null; row.consoleErrors = r.console.errors.length;
          if (r.loaded && base[engine]) row.vsOriginal = await compareImages(base[engine], png);
          rows.push(row);
          log(`${id}/${profile}/${engine}: ${r.loaded ? 'loaded' : 'FAILED'} tris=${row.triangles} gates=${rep.ok ? 'pass' : 'FAIL'} lost=${rep.identity.lost}${row.vsOriginal ? ` meanDelta=${row.vsOriginal.meanAbsDelta?.toFixed?.(3) ?? JSON.stringify(row.vsOriginal).slice(0, 60)}` : ''}`);
        }
      }
    }
  } finally { await browser.close(); }
  return rows;
}

export function profilesMarkdown(rows) {
  const out = [];
  const num = (v, d = 3) => (v == null || Number.isNaN(v) ? '-' : v.toFixed(d));
  for (const id of [...new Set(rows.map((r) => r.file))]) {
    out.push(`### ${id}`, '', '| profile | KiB | gates | identity lost | draw calls | engine | loaded | triangles | mean abs delta (0-255) | px > 16 | PSNR dB | note |', '|---|---:|---|---:|---|---|---|---:|---:|---:|---:|---|');
    for (const r of rows.filter((x) => x.file === id)) {
      const v = r.vsOriginal;
      out.push(`| ${r.profile} | ${(r.bytes / 1024).toFixed(1)} | ${r.gates ? 'pass' : 'FAIL'} | ${r.identityLost} of ${r.identityTokens} | ${r.drawCalls[0]} -> ${r.drawCalls[1]} | ${r.engine} | ${r.loaded == null ? '-' : r.loaded ? 'yes' : 'NO'} | ${r.triangles ?? '-'} | ${num(v?.meanAbsDelta)} | ${v?.fractionOverThreshold == null ? '-' : (100 * v.fractionOverThreshold).toFixed(3) + '%'} | ${(v && v.psnrDb === Infinity ? "identical" : num(v?.psnrDb, 1))} | ${r.note || r.error || ''} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

async function main() {
  const { values } = parseArgs({ options: { size: { type: 'string', default: '256' }, files: { type: 'string' }, profiles: { type: 'string' }, engines: { type: 'string' }, json: { type: 'string' }, md: { type: 'string' }, out: { type: 'string' }, 'timeout-ms': { type: 'string', default: '25000' } } });
  const keep = !!values.out, outDir = values.out ? path.resolve(values.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'x3dgltf-profiles-'));
  fs.mkdirSync(outDir, { recursive: true });
  try {
    const rows = await runProfiles({ size: Number(values.size), timeoutMs: Number(values['timeout-ms']), files: values.files?.split(','), profiles: values.profiles?.split(','), engines: values.engines?.split(','), outDir, log: (m) => console.error(m) });
    if (values.json) fs.writeFileSync(values.json, JSON.stringify(rows, null, 1) + '\n');
    const md = profilesMarkdown(rows); if (values.md) fs.writeFileSync(values.md, md + '\n');
    console.log(md);
  } finally { if (!keep) fs.rmSync(outDir, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
