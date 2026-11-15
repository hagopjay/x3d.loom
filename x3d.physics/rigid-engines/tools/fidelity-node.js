// Analytic fidelity of the three engines (Node, no browser): every scene, every engine, one table. Writes results/fidelity-node.json
const fs = require('fs'), path = require('path'), { scenes } = require('../lib/scenes'), { record } = require('../lib/record');
(async () => {
  const out = {};
  for (const sc of scenes) {
    out[sc.id] = {};
    for (const eng of ['builtin', 'rapier', 'cannon', 'cannon-raw']) {
      const r = await record(sc, eng); out[sc.id][eng] = { metrics: sc.analyse(r.tr), wall_ms: +r.ms.toFixed(1), notes: r.notes };
      console.log(sc.id.padEnd(18), eng.padEnd(8), JSON.stringify(out[sc.id][eng].metrics), r.notes.length ? ' NOTES ' + r.notes.join('; ') : '');
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'fidelity-node.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
