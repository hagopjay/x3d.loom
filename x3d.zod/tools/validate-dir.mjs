#!/usr/bin/env node
// node tools/validate-dir.mjs <dir-of-json> -> JSON on stdout {file: {zod, ajv, zodMs, ajvMs}}
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { X3DJson } from '../src/generated/x3d.zod.ts';
import { loadFixedSchema } from './gen.mjs';
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020');
const dir = resolve(process.argv[2]);
const { schema } = loadFixedSchema();
const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: false });
const av = ajv.compile(schema);
const out = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  let data;
  try { data = JSON.parse(readFileSync(resolve(dir, f), 'utf8')); }
  catch { out[f] = { parseError: true, zod: false, ajv: false }; continue; }
  let t = performance.now(); let z; let zodErr;
  try { z = X3DJson.safeParse(data).success; } catch (e) { z = false; zodErr = String(e.message).slice(0, 60); }
  const zodMs = performance.now() - t;
  t = performance.now(); let a; let ajvErr;
  try { a = av(data); } catch (e) { a = false; ajvErr = String(e.message).slice(0, 60); }
  const ajvMs = performance.now() - t;
  out[f] = { zod: z, ajv: a, zodMs: +zodMs.toFixed(3), ajvMs: +ajvMs.toFixed(3), ...(zodErr && { zodErr }), ...(ajvErr && { ajvErr }) };
}
process.stdout.write(JSON.stringify(out));
