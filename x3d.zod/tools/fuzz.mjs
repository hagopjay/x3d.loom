#!/usr/bin/env node
// Differential fuzz: mutate known-valid X3D JSON documents, ask Zod and ajv (the schema's own semantics) the same question.
//   node tools/fuzz.mjs <dir-of-json> [mutantsPerDoc=20] [seed=1]
// Any disagreement is a codegen bug (or a schema keyword the generator does not model). Writes receipts/fuzz.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { X3DJson } from '../src/generated/x3d.zod.ts';
import { loadFixedSchema } from './gen.mjs';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2]);
const per = Number(process.argv[3] ?? 20);
let seed = Number(process.argv[4] ?? 1);
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const { schema } = loadFixedSchema();
const av = new Ajv2020({ strict: false, validateFormats: false }).compile(schema);

function paths(o, p = [], out = []) {            // every node (object/array/leaf) with its path
  out.push(p);
  if (o && typeof o === 'object') for (const k of Object.keys(o)) paths(o[k], [...p, k], out);
  return out;
}
const get = (o, p) => p.reduce((a, k) => a[k], o);
function mutate(doc) {
  const d = structuredClone(doc);
  const ps = paths(d).filter((p) => p.length > 1);
  const p = pick(ps); const parent = get(d, p.slice(0, -1)); const k = p[p.length - 1]; const v = parent[k];
  const kind = pick(['delete', 'retype', 'rename', 'extend', 'truncate', 'enumswap', 'range', 'dup']);
  switch (kind) {
    case 'delete': Array.isArray(parent) ? parent.splice(k, 1) : delete parent[k]; break;
    case 'retype': parent[k] = typeof v === 'number' ? String(v) : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 'true' : Array.isArray(v) ? { a: 1 } : [v]; break;
    case 'rename': if (!Array.isArray(parent)) { parent[k + 'x'] = v; delete parent[k]; } break;
    case 'extend': if (Array.isArray(v)) v.push(typeof v[0] === 'number' ? 0.5 : v[0] ?? 1); break;
    case 'truncate': if (Array.isArray(v) && v.length) v.pop(); break;
    case 'enumswap': if (typeof v === 'string') parent[k] = pick(['', 'NONE', 'ALL', 'EXAMINE', 'WGS84', 'UTM', 'Z3', 'N']); break;
    case 'range': if (typeof v === 'number') parent[k] = pick([-1, 0, 1, 2, 1e9, -1e9, 0.5]); break;
    case 'dup': if (Array.isArray(parent)) parent.splice(Math.floor(rnd() * parent.length), 0, structuredClone(v)); break;
  }
  return { d, kind };
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const stats = { docs: 0, mutants: 0, zodValid: 0, ajvValid: 0, disagree: 0, byKind: {}, examples: [] };
for (const f of files) {
  let doc; try { doc = JSON.parse(readFileSync(resolve(dir, f), 'utf8')); } catch { continue; }
  let base; try { base = X3DJson.safeParse(doc).success && av(doc); } catch { continue; }
  if (!base) continue;                              // fuzz from documents both agree are valid
  stats.docs++;
  for (let i = 0; i < per; i++) {
    const { d, kind } = mutate(doc);
    let z; try { z = X3DJson.safeParse(d).success; } catch { continue; }
    const a = av(d);
    stats.mutants++; z && stats.zodValid++; a && stats.ajvValid++;
    const kk = (stats.byKind[kind] ??= { n: 0, disagree: 0 }); kk.n++;
    if (z !== a) { stats.disagree++; kk.disagree++; if (stats.examples.length < 8) stats.examples.push({ file: f, kind, zod: z, ajv: a, doc: JSON.stringify(d).slice(0, 400) }); }
  }
}
stats.seed = Number(process.argv[4] ?? 1);
writeFileSync(resolve(root, 'receipts/fuzz.json'), JSON.stringify(stats, null, 1) + '\n');
console.log(JSON.stringify({ ...stats, examples: stats.examples.length }));
