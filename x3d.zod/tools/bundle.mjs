#!/usr/bin/env node
// node tools/bundle.mjs <out.js> : one minified ES module (Zod 4 + the generated schemas) for a static page.
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? 'x3d-zod.bundle.js');
await build({ entryPoints: [resolve(root, 'src/browser.ts')], bundle: true, minify: true, format: 'esm', target: 'es2022', outfile: out, legalComments: 'none' });
console.log(out, statSync(out).size, 'bytes');
