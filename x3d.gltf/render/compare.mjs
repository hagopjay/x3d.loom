#!/usr/bin/env node
// node render/compare.mjs A.png B.png [--json] [--threshold 16]
//   mean absolute delta (0-255, mean over R,G,B of all pixels), PSNR (dB) and the fraction of pixels whose
//   max-channel delta exceeds the threshold (default 16). PNGs are decoded with sharp; alpha is ignored.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { compareImages } from './imgstats.mjs';

export { compareImages };

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: { json: { type: 'boolean', default: false }, threshold: { type: 'string', default: '16' } },
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const [a, b] = parsed.positionals;
  if (!a || !b || parsed.positionals.length !== 2) {
    console.error('usage: node render/compare.mjs A.png B.png [--json] [--threshold 16]');
    process.exit(1);
  }
  let r;
  try {
    r = await compareImages(a, b, { threshold: Number(parsed.values.threshold) });
  } catch (e) {
    console.error(`compare failed: ${e.message}`);
    process.exit(2);
  }
  const out = { a: path.resolve(a), b: path.resolve(b), ...r, psnrDb: Number.isFinite(r.psnrDb) ? r.psnrDb : null, identical: r.meanAbsDelta === 0 };
  if (parsed.values.json) {
    console.log(JSON.stringify(out));
  } else {
    console.log(`mean abs delta : ${r.meanAbsDelta.toFixed(4)} / 255`);
    console.log(`PSNR           : ${Number.isFinite(r.psnrDb) ? r.psnrDb.toFixed(2) + ' dB' : 'inf (identical)'}`);
    console.log(`pixels > ${r.threshold}    : ${(100 * r.fractionOverThreshold).toFixed(4)} % (max channel delta over ${r.threshold}; max seen ${r.maxChannelDelta})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(4); });
}
