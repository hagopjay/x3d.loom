// loom.render-receipt/1: canonical JSON (sorted keys), sha256 over everything but the sha256 field, never overwritten.
import fs from 'node:fs';
import crypto from 'node:crypto';

export const SCHEMA = 'loom.render-receipt/1';
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
export function seal(r) {
  const body = { ...r }; delete body.sha256;
  return { ...body, sha256: sha256(canonical(body)) };
}
export function verify(r) {
  const body = { ...r }; delete body.sha256;
  return r.schema === SCHEMA && sha256(canonical(body)) === r.sha256;
}
export function write(r, dest) {
  if (fs.existsSync(dest)) throw new Error(`RECEIPT_EXISTS ${dest}: write a new run folder (law 14: add layers, never replace)`);
  fs.writeFileSync(dest, JSON.stringify(r, null, 2) + '\n');
}
