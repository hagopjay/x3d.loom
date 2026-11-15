// Writes the plain X3D 4.0 fixtures (no script; the same text loads in X_ITE 16.6.0 and in the bridge reader) and the expected metrics per engine from results/fidelity-node.json.
//   node tools/emit-fixtures.js
const fs = require('fs'), path = require('path'), { scenes } = require('../lib/scenes'), { avalanche, cradle, gate, sceneXml } = require('../lib/demo-scenes');
const dir = path.join(__dirname, '..', 'fixtures'); fs.mkdirSync(dir, { recursive: true });
const fid = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'results', 'fidelity-node.json'), 'utf8')), idx = {};
for (const s of scenes) { fs.writeFileSync(path.join(dir, s.id + '.x3d'), s.xml); idx[s.id] = { file: s.id + '.x3d', T: s.T, probes: s.probes, expected: Object.fromEntries(Object.entries(fid[s.id]).map(([e, v]) => [e, v.metrics])) }; }
for (const mk of [avalanche, cradle, gate]) { const s = mk(); fs.writeFileSync(path.join(dir, 'demo-' + s.id + '.x3d'), sceneXml(s, 'live')); idx['demo-' + s.id] = { file: 'demo-' + s.id + '.x3d', T: s.T, note: s.note, rapierOpts: s.rapierOpts }; }
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx, null, 1)); console.log(Object.keys(idx).length + ' fixtures in ' + dir);
