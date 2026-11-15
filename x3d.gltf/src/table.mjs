// Markdown tables for matrix results. Every table says which instrument made its numbers; the caller prepends the header block with versions.
const kb = (n) => (n / 1024).toFixed(1);
const pctOf = (r) => (100 * r).toFixed(1) + '%';

export function matrixMarkdown(rows) {
  const out = [];
  out.push('| glb | profile | KiB before | KiB after | % | gzip KiB | brotli KiB | draw calls | nodes | identity lost | centroid max (of diagonal) | normal p99 deg | gates |');
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) {
    if (r.error) { out.push(`| ${r.file} | ${r.profile} | | | | | | | | | | | ERROR ${r.error} |`); continue; }
    out.push(`| ${r.file} | ${r.profile} | ${kb(r.bytes.source)} | ${kb(r.bytes.output)} | ${pctOf(r.bytes.ratio)} | ${kb(r.gzip.output)} | ${kb(r.brotli.output)} | ${r.drawCalls[0]} -> ${r.drawCalls[1]} | ${r.nodes[0]} -> ${r.nodes[1]} | ${r.identity.lost} | ${r.geometry.centroidMaxRel == null ? '' : r.geometry.centroidMaxRel.toExponential(1)} | ${r.geometry.normalP99Deg == null ? '' : r.geometry.normalP99Deg.toFixed(2)} | ${r.ok ? 'PASS' : (r.expectedFail ? 'FAIL (expected): ' : 'FAIL: ') + r.failures.join('; ')} |`);
  }
  return out.join('\n') + '\n';
}

// One row per profile, summed over the files it ran on: the headline table.
export function profileTotals(rows) {
  const by = new Map();
  for (const r of rows.filter((x) => !x.error)) {
    const t = by.get(r.profile) || by.set(r.profile, { n: 0, ok: 0, src: 0, out: 0, gz: 0, br: 0, srcGz: 0, srcBr: 0, lost: 0 }).get(r.profile);
    t.n++; if (r.ok) t.ok++; t.src += r.bytes.source; t.out += r.bytes.output; t.gz += r.gzip.output; t.br += r.brotli.output; t.srcGz += r.gzip.source; t.srcBr += r.brotli.source; t.lost += r.identity.lost;
  }
  const out = ['| profile | files | gates pass | KiB before | KiB after | % of before | gzip % | brotli % | identity tokens lost |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [p, t] of by) out.push(`| ${p} | ${t.n} | ${t.ok}/${t.n} | ${kb(t.src)} | ${kb(t.out)} | ${pctOf(t.out / t.src)} | ${pctOf(t.gz / t.srcGz)} | ${pctOf(t.br / t.srcBr)} | ${t.lost} |`);
  return out.join('\n') + '\n';
}
