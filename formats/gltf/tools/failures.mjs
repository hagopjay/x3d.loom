#!/usr/bin/env node
// Backfill: write failures.json (loom.failure/1) beside each receipt of a run, from the receipt and the pictures already on disk.
// A receipt is never rewritten (law 14); this is a new layer that names the receipt by its sha256 and is sealed the same way.
//   node tools/failures.mjs runs/<id> [...]     prints one line per failing run and a group-by table; exit 0
//   --check                                     recompute and compare with the files on disk; exit 1 on any difference
import fs from 'node:fs';
import path from 'node:path';
import { failureOf, FAILURE_SCHEMA } from '../src/failure.mjs';
import { ENCODE, reencodeTable } from '../src/encode.mjs';
import { canonical, sha256, verify } from '../src/receipt.mjs';

const args = process.argv.slice(2); const check = args.includes('--check'); const dirs = args.filter((a) => !a.startsWith('--'));
if (!dirs.length) { console.error('usage: node tools/failures.mjs [--check] runs/<id> [...]'); process.exit(2); }
const groups = new Map(); let n = 0, drift = 0;
for (const d of dirs) for (const sub of fs.readdirSync(d).sort()) {
  const rp = path.join(d, sub, 'receipt.json'); if (!fs.existsSync(rp)) continue;
  const receipt = JSON.parse(fs.readFileSync(rp, 'utf8'));
  if (!verify(receipt)) throw new Error(`RECEIPT_DRIFT ${rp}`);
  const failures = [];
  for (const row of receipt.runs) {
    if (row.status === 'error') { failures.push({ engine: row.engine.id, status: 'error', reason: row.reason ?? null, failure_class: 'engine-error', locus: null, rule_id: null, rule_status: 'unexplained' }); continue; }
    if (!['warn', 'fail'].includes(row.status) || !row.score) continue;
    const f = await failureOf({ row, candidatePng: path.join(d, sub, row.output.png), referencePng: path.join(d, sub, 'khronos.png'),
      table: reencodeTable(ENCODE[row.engine.id], ENCODE.khronos), thresholds: receipt.thresholds, consensus: receipt.consensus, gate: receipt.gate });
    failures.push({ engine: row.engine.id, status: row.status, ...f });
  }
  for (const f of failures) {
    n++; const k = `${f.engine} | ${f.failure_class} | ${f.rule_id ?? 'unexplained'}`; groups.set(k, [...(groups.get(k) ?? []), receipt.subject.id]);
    console.log(`${receipt.subject.id.padEnd(30)} ${f.engine.padEnd(8)} ${f.status.padEnd(5)} ${f.failure_class.padEnd(14)} ${(f.rule_id ?? '-').padEnd(9)} bbox ${JSON.stringify(f.locus?.bbox_over16)}  ${f.locus?.direction ?? ''}`);
  }
  const body = { schema: FAILURE_SCHEMA, receipt: { file: 'receipt.json', sha256: receipt.sha256 }, subject: { id: receipt.subject.id, sha256: receipt.subject.sha256 }, failures };
  const out = { ...body, sha256: sha256(canonical(body)) };
  const dest = path.join(d, sub, 'failures.json'); const text = JSON.stringify(out, null, 2) + '\n';
  if (check) { if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== text) { drift++; console.log(`DRIFT ${dest}`); } }
  else if (fs.existsSync(dest)) { if (fs.readFileSync(dest, 'utf8') !== text) throw new Error(`FAILURES_EXIST ${dest} differs: write a new run folder (law 14)`); }
  else fs.writeFileSync(dest, text);
}
console.log(`\n${n} failure records; groups (engine | class | rule): `);
for (const [k, v] of [...groups].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(2)}  ${k}   ${v.join(', ')}`);
process.exit(drift ? 1 : 0);
