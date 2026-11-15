// Bundle web/forge.mjs for the browser: node tools/build-web.mjs [--out web/dist]
import { build } from 'esbuild';
import fs from 'node:fs';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : new URL('../web/dist/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const r = await build({ entryPoints: [new URL('../web/forge.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outfile: out + '/forge.bundle.js', metafile: true, legalComments: 'none', logLevel: 'info', external: ['node:fs', 'node:path'] });
const bytes = fs.statSync(out + '/forge.bundle.js').size;
console.log(`forge.bundle.js ${(bytes / 1024).toFixed(1)} KiB`);
fs.writeFileSync(out + '/forge.bundle.meta.json', JSON.stringify(Object.fromEntries(Object.entries(r.metafile.outputs).map(([k, v]) => [k, { bytes: v.bytes, inputs: Object.keys(v.inputs).length }])), null, 1));
