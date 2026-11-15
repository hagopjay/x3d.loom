// receipts/summary.md from the matrix rows: the tables the README and the docs chapter quote. Every number is read from matrix.json, nothing is typed.
//   node tools/summarize.mjs MATRIX.json [MORE.json ...] > SUMMARY.md
import fs from 'node:fs';
import { profileTotals } from '../src/table.mjs';
import { PROFILES } from '../src/profiles.mjs';

const rows = process.argv.slice(2).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).filter((r) => !r.error);
const kb = (n) => (n / 1024).toFixed(1), pct = (r) => (100 * r).toFixed(1) + '%';
const isTrap = (p) => p === 'static-joined' || PROFILES[p]?.trap;
const files = [...new Set(rows.map((r) => r.file))];
const out = [];
out.push('## Profile totals over the corpus (every file the profile ran on)\n');
out.push(profileTotals(rows));
out.push('## Per file: source, and the smallest profile that passed every gate\n');
out.push('| glb | KiB source | gzip KiB | brotli KiB | smallest passing (raw) | KiB | % | smallest passing (brotli) | brotli KiB | % | draw calls source -> instanced | identity tokens |');
out.push('|---|---:|---:|---:|---|---:|---:|---|---:|---:|---|---:|');
for (const f of files) {
  const rs = rows.filter((r) => r.file === f), src = rs[0], ok = rs.filter((r) => r.ok && !isTrap(r.profile));
  if (!ok.length) continue;
  const raw = ok.reduce((a, b) => (b.bytes.output < a.bytes.output ? b : a)), br = ok.reduce((a, b) => (b.brotli.output < a.brotli.output ? b : a));
  const inst = rs.find((r) => r.profile === 'instanced');
  out.push(`| ${f} | ${kb(src.bytes.source)} | ${kb(src.gzip.source)} | ${kb(src.brotli.source)} | ${raw.profile} | ${kb(raw.bytes.output)} | ${pct(raw.bytes.ratio)} | ${br.profile} | ${kb(br.brotli.output)} | ${pct(br.brotli.output / src.brotli.source)} | ${inst ? `${inst.drawCalls[0]} -> ${inst.drawCalls[1]}` : ''} | ${src.identity.preserved + src.identity.lost} |`);
}
out.push('\n## The traps: what the two identity-destroying profiles cost\n');
out.push('| glb | profile | draw calls | nodes | triangles (source -> out) | identity tokens lost of source | KiB source -> out | gates |');
out.push('|---|---|---|---|---|---:|---|---|');
for (const f of files) for (const p of ['stock-instance', 'static-joined']) {
  const r = rows.find((x) => x.file === f && x.profile === p); if (!r) continue;
  out.push(`| ${f} | ${p} | ${r.drawCalls[0]} -> ${r.drawCalls[1]} | ${r.nodes[0]} -> ${r.nodes[1]} | ${r.triangles[0]} -> ${r.triangles[1]} | ${r.identity.lost} of ${r.identity.preserved + r.identity.lost} | ${kb(r.bytes.source)} -> ${kb(r.bytes.output)} | ${r.ok ? 'pass (loss is allowed and counted)' : 'FAIL: ' + r.failures.map((x) => x.split(':')[1]?.trim().slice(0, 48) || x).join('; ')} |`);
}
const shipping = rows.filter((r) => !isTrap(r.profile));
out.push(`\n## Totals\n\n- cells: ${rows.length}; shipping-profile cells: ${shipping.length}, passing ${shipping.filter((r) => r.ok).length}; identity tokens lost by a shipping profile in the whole corpus: ${shipping.reduce((a, r) => a + r.identity.lost, 0)}`);
out.push(`- trap cells: ${rows.length - shipping.length}; identity tokens lost by the traps: ${rows.filter((r) => isTrap(r.profile)).reduce((a, r) => a + r.identity.lost, 0)}`);
console.log(out.join('\n'));
