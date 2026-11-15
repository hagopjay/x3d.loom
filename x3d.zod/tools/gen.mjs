#!/usr/bin/env node
// zod-gen: X3D 4.0 JSON Schema (Web3D, Draft 2020-12) -> Zod 4 schemas + TS types.
//   node tools/gen.mjs [--comments]     writes src/generated/x3d.zod.ts and receipts/gen.json
// The upstream file stays byte-identical; the one known correction (NavigationInfo.@type is an
// MFString typed "string") is applied in memory, the same fix x3d_mcp applies (validate.py).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = resolve(root, 'schema/x3d-4.0-JSONSchema.json');
export const UPSTREAM_SHA1 = 'c6765a4cbc75fecf0cb843b7c828fda8a17a176b';
const withComments = process.argv.includes('--comments');

export function loadFixedSchema(path = SCHEMA) {
  const raw = readFileSync(path);
  const sha1 = createHash('sha1').update(raw).digest('hex');
  const schema = JSON.parse(raw.toString('utf8'));
  const node = schema.$defs?.NavigationInfo ?? {};
  let fixed = 0;
  for (const v of node.oneOf ?? [node]) {
    const p = v.properties?.['@type'];
    if (p && p.type === 'string' && (p.$comment ?? '').startsWith('MFString')) {
      p.type = 'array'; p.items = { type: 'string' }; fixed++;
    }
  }
  return { schema, sha1, fixed };
}

const ident = (name) => 'S_' + name.replace(/^-/, 'child_').replace(/^@/, 'at_').replace(/[^A-Za-z0-9_]/g, '_');
const q = JSON.stringify;
const hasRef = (n) => n !== null && typeof n === 'object' &&
  (typeof n.$ref === 'string' || Object.values(n).some(hasRef));

function refName(r) {
  const m = /^#\/\$defs\/(.+)$/.exec(r);
  if (!m) throw new Error('unsupported $ref ' + r);
  return m[1];
}

const stats = { unions: 0, tuples: 0, strictObjects: 0, refs: 0, enums: 0 };

function emit(n, ctx) {
  if (n.$ref) { stats.refs++; return ident(refName(n.$ref)); }
  let out;
  if (n.oneOf || n.anyOf) {
    const arms = (n.oneOf ?? n.anyOf).map((a) => emit(a, ctx));
    stats.unions++;
    out = arms.length === 1 ? arms[0] : `z.union([${arms.join(', ')}])`;
  } else if (n.enum && (!n.type || n.type === 'string')) {
    stats.enums++; out = `z.enum(${q(n.enum)})`;
  } else {
    switch (n.type) {
      case 'string': out = 'z.string()'; break;
      case 'boolean': out = 'z.boolean()'; break;
      case 'integer':
      case 'number': {
        out = n.type === 'integer' ? 'z.number().int()' : 'z.number()';
        if (n.minimum !== undefined) out += `.min(${n.minimum})`;
        if (n.maximum !== undefined) out += `.max(${n.maximum})`;
        if (n.exclusiveMinimum !== undefined) out += `.gt(${n.exclusiveMinimum})`;
        if (n.exclusiveMaximum !== undefined) out += `.lt(${n.exclusiveMaximum})`;
        break;
      }
      case 'array': {
        if (n.prefixItems) {
          stats.tuples++;
          // JSON Schema prefixItems constrains positions that exist; minItems says how many must. Zod tuples
          // require every position, so positions at or past minItems become optional, and maxItems/minItems
          // that the tuple shape cannot state become a length check.
          const min = n.minItems ?? 0;
          const items = n.prefixItems.map((a, i) => emit(a, ctx) + (i >= min ? '.optional()' : ''));
          const rest = n.items ? `, ${emit(n.items, ctx)}` : '';
          out = `z.tuple([${items.join(', ')}]${rest})`;
          const lim = [];
          if (n.maxItems !== undefined && (n.items || n.maxItems < n.prefixItems.length)) lim.push(`a.length <= ${n.maxItems}`);
          if (min > n.prefixItems.length) lim.push(`a.length >= ${min}`);
          if (lim.length) out += `.refine((a) => ${lim.join(' && ')}, { message: 'array length outside ${min}..${n.maxItems ?? 'any'}' })`;
        } else {
          out = `z.array(${n.items ? emit(n.items, ctx) : 'z.unknown()'})`;
          if (n.minItems !== undefined) out += `.min(${n.minItems})`;
          if (n.maxItems !== undefined) out += `.max(${n.maxItems})`;
        }
        break;
      }
      case 'object': {
        const props = n.properties ?? {};
        const req = new Set(n.required ?? []);
        const lines = Object.entries(props).map(([k, v]) => {
          let e = emit(v, ctx);
          if (!req.has(k)) e += '.optional()';
          if (withComments && v.$comment) e += `.describe(${q(v.$comment)})`;
          return hasRef(v) ? `get ${q(k)}() { return ${e}; }` : `${q(k)}: ${e}`;
        });
        stats.strictObjects++;
        const fn = n.additionalProperties === false ? 'strictObject' : 'looseObject';
        out = `z.${fn}({${lines.join(', ')}})`;
        break;
      }
      default: out = 'z.unknown()';
    }
  }
  return out;
}

function emitType(n) {
  if (n.$ref) return 'T_' + ident(refName(n.$ref)).slice(2);
  if (n.oneOf || n.anyOf) {
    const arms = (n.oneOf ?? n.anyOf).map(emitType);
    return arms.length === 1 ? arms[0] : '(' + arms.join(' | ') + ')';
  }
  if (n.enum && (!n.type || n.type === 'string')) return '(' + n.enum.map((v) => q(v)).join(' | ') + ')';
  switch (n.type) {
    case 'string': return 'string';
    case 'boolean': return 'boolean';
    case 'integer': case 'number': return 'number';
    case 'array':
      if (n.prefixItems) {
        const min = n.minItems ?? 0;
        const items = n.prefixItems.map((a, i) => emitType(a) + (i >= min ? '?' : ''));   // positions at or past minItems may be absent
        return `[${items.join(', ')}${n.items ? `, ...${emitType(n.items)}[]` : ''}]`;
      }
      return `${n.items ? emitType(n.items) : 'unknown'}[]`;
    case 'object': {
      const req = new Set(n.required ?? []);
      const fields = Object.entries(n.properties ?? {}).map(([k, v]) => `${q(k)}${req.has(k) ? '' : '?'}: ${emitType(v)}`);
      const base = `{ ${fields.join('; ')} }`;
      return n.additionalProperties === false ? base : `(${base} & Record<string, unknown>)`;
    }
    default: return 'unknown';
  }
}

export function generate(schema) {
  const defs = schema.$defs;
  const names = Object.keys(defs);
  const parts = [
    '// GENERATED by tools/gen.mjs from schema/x3d-4.0-JSONSchema.json. Do not edit.',
    "import { z } from 'zod';", '',
  ];
  for (const name of names) parts.push(`export type T_${ident(name).slice(2)} = ${emitType(defs[name])};`);
  parts.push('');
  for (const name of names) {
    const body = emit(defs[name], {});
    // a def that is itself a bare union/ref of later defs needs lazy; object props already use getters
    parts.push(`export const ${ident(name)}: z.ZodType<T_${ident(name).slice(2)}> = ${hasTopRef(defs[name]) ? `z.lazy(() => ${body})` : body};`);
  }
  const rootBody = emit(schema, {});
  parts.push('', `export type X3DJsonDocument = ${emitType(schema)};`);
  parts.push(`export const X3DJson: z.ZodType<X3DJsonDocument> = ${rootBody};`);
  parts.push('', `export const NODE_NAMES = ${q(names)} as const;`);
  parts.push('export const defs = {', ...names.map((n) => `  ${q(n)}: ${ident(n)},`), '} as const;');
  parts.push('');
  return parts.join('\n');
}
// a def whose own body is a direct $ref/oneOf of refs (no object wrapper to hold getters)
function hasTopRef(d) { return typeof d.$ref === 'string' || (d.type !== 'object' && hasRef(d) && !d.properties); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const { schema, sha1, fixed } = loadFixedSchema();
  const src = generate(schema);
  mkdirSync(resolve(root, 'src/generated'), { recursive: true });
  mkdirSync(resolve(root, 'receipts'), { recursive: true });
  writeFileSync(resolve(root, 'src/generated/x3d.zod.ts'), src);
  const rec = {
    schemaSha1: sha1, upstreamSha1Expected: UPSTREAM_SHA1, upstreamMatches: sha1 === UPSTREAM_SHA1,
    fixesApplied: { 'NavigationInfo.@type': fixed }, defs: Object.keys(schema.$defs).length,
    emitted: stats, bytes: Buffer.byteLength(src), comments: withComments,
  };
  writeFileSync(resolve(root, 'receipts/gen.json'), JSON.stringify(rec, null, 2) + '\n');
  console.log(JSON.stringify(rec));
}
