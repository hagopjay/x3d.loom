// The same scenes in X_ITE 16.6.0: metrics next to the engines. Writes results/fidelity-xite.json
const fs = require('fs'), path = require('path'), { scenes } = require('../lib/scenes'), { withBrowser, recordXite } = require('../lib/xite');
(async () => {
  const out = {};
  await withBrowser(async (b, base) => {
    console.log('chromium', b.version());
    for (const sc of scenes) {
      const runs = [];
      for (let k = 0; k < 2; k++) { const r = await recordXite(sc, b, base); runs.push(r); }
      const m = runs.map((r) => sc.analyse(r.tr)); out[sc.id] = { metrics: m[0], repeat: m[1], fps: runs.map((r) => r.fps), version: runs[0].version, errs: runs[0].errs };
      console.log(sc.id.padEnd(18), JSON.stringify(m[0]), 'fps', runs.map((r) => r.fps).join('/'), '\n'.padEnd(20), 'repeat', JSON.stringify(m[1]), runs[0].errs.join(';'));
    }
  });
  fs.writeFileSync(path.join(__dirname, '..', 'results', 'fidelity-xite.json'), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
