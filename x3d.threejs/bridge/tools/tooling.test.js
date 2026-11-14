// Local checks that need no browser: node --test tools/
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const bundle = require('./bundle.js');
test('both bundles parse', () => { for (const k of ['reader', 'body']) assert.doesNotThrow(() => new Function(bundle(k)), k); });
test('the body bundle carries the shared geometryData and the three.js body, the reader bundle neither', () => {
  const b = bundle('body'), r = bundle('reader');
  assert.match(b, /const Geo = \{\s*geometryData\(g\)/); assert.match(b, /class Body/); assert.doesNotMatch(r, /THREE\./);
});
test('the reader half names no engine', () => { assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'x3d.webgpu', 'demo', 'src', 'brain', 'reader.js'), 'utf8'), /BABYLON/); });
test('every scene fixture has a spec that names a compare bound for each shot', () => {
  const dir = path.join(__dirname, '..', 'fixtures');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.json'))) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); assert.ok(fs.existsSync(path.join(dir, f.replace('.test.json', '.x3d'))), f);
    for (const st of s.steps) if (typeof st.shot === 'string') assert.ok(s.compare && s.compare[st.shot], f + ' shot ' + st.shot + ' has no compare bound');
  }
});
