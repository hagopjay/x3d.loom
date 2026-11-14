// The bundles the three.js tests run. "reader" = the Babylon bridge's reader + kit + nodes + SAI (no engine). "body" adds src/body-three.js.
// Nothing under x3d.webgpu/ is copied or edited: the files are read from there at bundle time, so a fix in the reader reaches both bridges.
const fs = require('fs'), path = require('path');
const HERE = path.resolve(__dirname, '..'), BAB = path.resolve(HERE, '..', '..', 'x3d.webgpu'), BR = path.join(BAB, 'bridge'), SRC = path.join(BAB, 'demo', 'src');
const READER = ['shared/adapter.js', 'brain/reader.js', 'gobbler/reader-ext.js', 'demiurge/reader-ext-dm.js', 'dynasty/reader-ext-dl.js', 'hall/reader-ext-hl.js'];
const rd = (p) => fs.readFileSync(path.join(SRC, p), 'utf8'), own = (p) => fs.readFileSync(path.join(BR, p), 'utf8');

// geometryData(g) from the Babylon Body, cut out of the class as a method of a plain object. The two markers are the method's first line and the comment that follows it.
function geometryData() {
  const s = rd('brain/body.js'), a = s.indexOf('  geometryData(g) {'), b = s.indexOf('  /* geometry nodes of the same raw node share', a);
  if (a < 0 || b < 0) throw new Error('bundle: geometryData markers not found in demo/src/brain/body.js; update tools/bundle.js');
  return 'const Geo = {\n' + s.slice(a, b).replace(/\n\s*$/, '') + '\n};';
}
// three.js-side node files of this tree (src/nodes/*.js), concatenated after the kit and before the body; they register into R.bridge.three (see the head of src/body-three.js)
const threeNodes = () => { const d = path.join(HERE, 'src', 'nodes'); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(path.join(d, f), 'utf8')) : []; };
module.exports = function bundle(kind) {
  if (!['reader', 'body'].includes(kind)) throw new Error('unknown bundle kind: ' + kind);
  const nodes = fs.readdirSync(path.join(BR, 'src', 'nodes')).filter((f) => f.endsWith('.js')).sort().map((f) => own('src/nodes/' + f));
  const reader = READER.filter((p) => fs.existsSync(path.join(SRC, p)) && (kind === 'body' || p !== 'shared/adapter.js')).map(rd);
  const catalog = Object.fromEntries(Object.entries(JSON.parse(own('NODES.json')).nodes).map(([name, n]) => [name, { status: n.status, note: n.note || '' }]));
  const parts = [...reader, own('src/kit.js'), own('src/nurbs.js'), ...nodes, own('src/fidelity.js'), 'R.bridge.fidelityCatalog = ' + JSON.stringify(catalog) + ';',
    ...(kind === 'body' ? [geometryData(), ...threeNodes(), fs.readFileSync(path.join(HERE, 'src', 'body-three.js'), 'utf8')] : []), rd('brain/sai.js'),
    'window.__R = R; window.__events = events; window.__bridge = R.bridge; window.__worlds = R.bridge.worlds;' + (kind === 'body' ? ' window.Body = Body;' : '')];
  return '(function () {\n"use strict";\n' + parts.join('\n') + '\n})();\n';
};
