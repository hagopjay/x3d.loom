// Determinism of the engines: (1) same run twice in one process, (2) pacing independence (60 Hz ticks vs alternating 40 ms / 8.3 ms ticks, same sim time), (3) Node 22 vs Chromium 153 (different V8, same bridge, same libs).
const fs = require('fs'), path = require('path'), { scenes } = require('../lib/scenes'), { record } = require('../lib/record'), hash = require('../lib/hash'), { withHost } = require('../lib/browser-host');
const ENG = ['builtin', 'rapier', 'cannon'];
(async () => {
  const out = {};
  for (const sc of scenes) for (const eng of ENG) {
    const a = await record(sc, eng), b = await record(sc, eng), j = await record(sc, eng, { pattern: 'jitter' });
    out[sc.id + '/' + eng] = { node_run1: hash(a.tr), node_run2: hash(b.tr), repeatable: hash(a.tr) === hash(b.tr), paced_final_equal: hash(a.tr, true) === hash(j.tr, true), node_final: hash(a.tr, true) };
  }
  await withHost(async (run, ver, errs) => {
    out._chromium = ver;
    for (const sc of scenes) for (const eng of ENG) {
      const r = await run(sc.xml, sc.probes, sc.T, eng); const k = sc.id + '/' + eng;
      out[k].chromium_trace = hash(r.tr); out[k].cross_host_equal = out[k].chromium_trace === out[k].node_run1; out[k].chromium_final_equal = hash(r.tr, true) === out[k].node_final;
      // largest position difference between the two hosts, to say how far apart a mismatch is
      const na = await record(sc, eng); let dmax = 0, qmax = 0; for (const d of sc.probes) for (let i = 0; i < na.tr[d].p.length; i++) { for (let c = 0; c < 3; c++) dmax = Math.max(dmax, Math.abs(na.tr[d].p[i][c] - r.tr[d].p[i][c])); for (let c = 0; c < 4; c++) qmax = Math.max(qmax, Math.abs(na.tr[d].q[i][c] - r.tr[d].q[i][c])); } out[k].max_pos_diff_m = dmax; out[k].max_orientation_diff = qmax;   // orientation = axis-angle from the host's acos/atan2: last-bit differences between two V8 builds
      console.log(k.padEnd(28), 'repeat', out[k].repeatable, ' pacing', out[k].paced_final_equal, ' node==chromium', out[k].cross_host_equal, ' maxdiff', dmax.toExponential(2), ' maxdq', qmax.toExponential(2));
    }
    if (errs.length) console.log('page errors', errs.slice(0, 3));
  });
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'determinism.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
