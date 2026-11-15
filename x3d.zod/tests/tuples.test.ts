import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { defs } from '../src/generated/x3d.zod.ts';
import { loadFixedSchema } from '../tools/gen.mjs';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020');
const { schema } = loadFixedSchema();
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema(schema);

// Every property whose schema (directly, or through $ref/oneOf of arrays) uses prefixItems: 88 tuple shapes.
type Hit = { def: string; prop: string; pool: string[] };
const hits: Hit[] = [];
const collect = (n: any, acc: string[]) => {
  if (Array.isArray(n)) n.forEach((x) => collect(x, acc));
  else if (n && typeof n === 'object') { if (n.enum) acc.push(...n.enum); Object.values(n).forEach((x) => collect(x, acc)); }
};
const hasPrefix = (n: any): boolean => n && typeof n === 'object' && (Array.isArray(n) ? n.some(hasPrefix) : 'prefixItems' in n || Object.values(n).some(hasPrefix));
for (const [def, d] of Object.entries<any>(schema.$defs)) {
  if (def.startsWith('@') || def.startsWith('-')) continue;
  for (const v of d.oneOf ?? [d]) for (const [prop, ps] of Object.entries<any>(v.properties ?? {})) {
    if (prop.startsWith('@') && hasPrefix(ps) && !ps.$ref) { const pool: string[] = []; collect(ps, pool); hits.push({ def, prop, pool }); }
  }
}

let s = 12345;
const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };

test('zod-009 tuple semantics match JSON Schema: random arrays against every inline prefixItems property', () => {
  assert.ok(hits.length === 79, `found ${hits.length} tuple properties`);
  let n = 0, valid = 0;
  for (const h of hits) {
    const av = ajv.getSchema(`${schema.$id}#/$defs/${h.def}`)!;
    const zd = (defs as any)[h.def];
    for (let i = 0; i < 400; i++) {
      const len = Math.floor(rnd() * 8);
      const arr = Array.from({ length: len }, () => {
        const r = rnd();
        return r < 0.8 && h.pool.length ? h.pool[Math.floor(rnd() * h.pool.length)] : r < 0.9 ? 1.5 : 'zzz';
      });
      const doc = { [h.prop]: arr };
      const a = av(doc), z = zd.safeParse(doc).success;
      n++; if (a) valid++;
      assert.equal(z, a, `${h.def}.${h.prop} ${JSON.stringify(arr)}: zod=${z} ajv=${a}`);
    }
  }
  assert.ok(valid > 200, `only ${valid}/${n} valid draws; the test would not reach the accepting side`);
});
