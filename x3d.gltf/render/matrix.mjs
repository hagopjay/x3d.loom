#!/usr/bin/env node
// Support matrix: builds optimised variants of the showpiece glbs, renders each in all three engines from the
// ORIGINAL file's camera and reports loaded / triangles-seen / delta-vs-original per engine x variant.
//
//   node render/matrix.mjs [--size 256] [--timeout-ms 20000] [--out DIR] [--json matrix.json] [--md matrix.md]
//                          [--engines three,babylon,xite] [--sources stilllife,prismatica] [--variants a,b,c]
//
// PNGs and variant glbs go to DIR (default: a temp dir that is removed at the end).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderGlb, ENGINES } from './render.mjs';
import { launchChromium } from './browser.mjs';
import { boundsOfGlb, frameCamera } from './frame.mjs';
import { buildVariant } from './variants.mjs';
import { compareImages } from './imgstats.mjs';

// The showpiece glbs are published in x3d-blender-io (docs/brag/showpieces). Point X3D_BLENDER_IO at a checkout, or keep it a sibling of x3d.loom.
const BLENDER_IO = process.env.X3D_BLENDER_IO || fileURLToPath(new URL('../../../x3d-blender-io/', import.meta.url));
export const SHOWPIECES = {
  stilllife: {
    glb: path.join(BLENDER_IO, 'docs/brag/showpieces/stilllife/stilllife-addon.glb'),
    variants: ['meshopt', 'meshoptMedium', 'draco', 'quantize', 'dracoCoarse', 'ktx2', 'ktx2Uastc', 'all', 'nolights'],
  },
  prismatica: {
    glb: path.join(BLENDER_IO, 'docs/brag/showpieces/prismatica/prismatica-aurora-cathedral.glb'),
    variants: ['meshopt', 'meshoptMedium', 'draco', 'quantize', 'dracoCoarse', 'instance', 'all', 'nolights'],
  },
};

export async function runMatrix({ size = 256, timeoutMs = 20000, outDir, engines = Object.keys(ENGINES), sources = Object.keys(SHOWPIECES), variants = null, log = () => {} } = {}) {
  const browser = await launchChromium();
  const rows = [];
  try {
    for (const src of sources) {
      const def = SHOWPIECES[src];
      const camera = frameCamera(await boundsOfGlb(def.glb));
      const names = variants ? def.variants.filter((v) => variants.includes(v)) : def.variants;
      const files = { original: { path: def.glb, bytes: fs.statSync(def.glb).size } };
      for (const v of names) {
        const info = await buildVariant(def.glb, v, path.join(outDir, `${src}-${v}.glb`));
        files[v] = info;
        log(`built ${src}/${v}: ${info.bytes} bytes [${info.extensionsUsed.join(', ')}]`);
      }
      for (const engine of engines) {
        let base = null;
        for (const v of ['original', ...names]) {
          const png = path.join(outDir, `${src}-${v}-${engine}.png`);
          const res = await renderGlb({ engine, glb: files[v].path, out: png, size, camera, browser, timeoutMs });
          const r = res.receipt;
          const row = {
            source: src,
            variant: v,
            engine,
            engineVersion: r.engine.version,
            bytes: files[v].bytes,
            extensionsUsed: r.glb.extensionsUsed,
            loaded: r.loaded,
            degraded: r.degraded,
            error: r.error,
            meshes: r.stats?.meshes ?? null,
            triangles: r.stats?.triangles ?? null,
            instances: r.stats?.instances ?? r.stats?.thinInstances ?? null,
            lights: r.lighting ? { source: r.lighting.source, glb: r.lighting.glbLights } : null,
            decoderCalls: r.decoders ? { draco: r.decoders.draco?.calls ?? null, meshopt: r.decoders.meshopt?.calls ?? null, ktx2: r.decoders.ktx2?.calls ?? null } : null,
            assetsFetched: r.decoders ? Object.fromEntries(Object.entries(r.decoders).map(([k, d]) => [k, d.assetsFetched ?? []])) : null,
            ktx2: r.ktx2 ?? null,
            babylonKtx2Failed: r.decoders?.ktx2?.failed ?? null,
            consoleErrors: r.console.errors,
            consoleWarnings: r.console.warnings.filter((w) => !/GPU stall due to ReadPixels/.test(w)),
            blocked: r.network.blocked,
            netFailed: r.network.failed,
            nonBackgroundFraction: r.image?.nonBackgroundFraction ?? null,
            loadMs: r.timing.loadMs,
            png: r.png,
            vsOriginal: null,
          };
          if (v === 'original') base = r.png;
          else if (r.png && base && v !== 'nolights') row.vsOriginal = await compareImages(base, r.png);
          rows.push(row);
          log(`${src}/${v}/${engine}: ${r.loaded ? 'loaded' : 'FAILED'} tris=${row.triangles} nonBg=${row.nonBackgroundFraction?.toFixed(3)} errs=${row.consoleErrors.length}${row.vsOriginal ? ` meanDelta=${row.vsOriginal.meanAbsDelta.toFixed(3)}` : ''}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  return rows;
}

export function matrixMarkdown(rows) {
  const lines = [];
  const bySrc = [...new Set(rows.map((r) => r.source))];
  for (const src of bySrc) {
    lines.push(`### ${src}`, '', '| variant | bytes | engine | loaded | meshes | triangles | non-bg px | mean delta vs original | px>16 | errors |', '|---|---:|---|---|---:|---:|---:|---:|---:|---|');
    for (const r of rows.filter((x) => x.source === src)) {
      lines.push(
        `| ${r.variant} | ${r.bytes} | ${r.engine} | ${r.loaded ? 'yes' : 'NO'} | ${r.meshes ?? '-'} | ${r.triangles ?? '-'} | ${r.nonBackgroundFraction == null ? '-' : (100 * r.nonBackgroundFraction).toFixed(1) + '%'} | ${r.vsOriginal ? r.vsOriginal.meanAbsDelta.toFixed(3) : '-'} | ${r.vsOriginal ? (100 * r.vsOriginal.fractionOverThreshold).toFixed(3) + '%' : '-'} | ${r.error ? r.error.slice(0, 80) : r.consoleErrors.length ? r.consoleErrors.length + ' err' : ''} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      size: { type: 'string', default: '256' },
      'timeout-ms': { type: 'string', default: '20000' },
      out: { type: 'string' },
      json: { type: 'string' },
      md: { type: 'string' },
      engines: { type: 'string' },
      sources: { type: 'string' },
      variants: { type: 'string' },
    },
  });
  const keep = !!values.out;
  const outDir = values.out ? path.resolve(values.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'x3dgltf-matrix-'));
  fs.mkdirSync(outDir, { recursive: true });
  try {
    const rows = await runMatrix({
      size: Number(values.size),
      timeoutMs: Number(values['timeout-ms']),
      outDir,
      engines: values.engines?.split(','),
      sources: values.sources?.split(','),
      variants: values.variants?.split(','),
      log: (m) => console.error(m),
    });
    if (values.json) fs.writeFileSync(values.json, JSON.stringify(rows, null, 2) + '\n');
    const md = matrixMarkdown(rows);
    if (values.md) fs.writeFileSync(values.md, md + '\n');
    console.log(md);
  } finally {
    if (!keep) fs.rmSync(outDir, { recursive: true, force: true });
  }
}

import { pathToFileURL, fileURLToPath } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(4);
  });
}
