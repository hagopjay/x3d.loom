#!/usr/bin/env node
// For documents XSD accepts and the JSON Schema rejects: the first Zod issue of each (receipts/corpus.json + the JSON dir).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateX3DJson } from '../src/index.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2]);
const rows = JSON.parse(readFileSync(resolve(root, 'receipts/corpus.json'), 'utf8')).rows;
const out = {};
for (const [k, r] of Object.entries(rows)) {
  if (!(r.xsd && r.zod === false && !r.zodErr)) continue;
  const res = validateX3DJson(JSON.parse(readFileSync(resolve(dir, k), 'utf8')));
  out[k] = { src: r.src, issues: res.ok ? [] : res.issues.slice(0, 3) };
}
writeFileSync(resolve(root, 'receipts/why.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.keys(out).length);
