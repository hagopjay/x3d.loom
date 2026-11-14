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

// The geometry hooks of src/nodes/Geometry.js are plain data code: the body bundle loads in node with a stub window, so their normals, winding and counts can be checked without a browser.
const vm = require('vm');
function load() {
  const win = {}, ctx = vm.createContext({ window: win, console, performance, setTimeout, clearTimeout, requestAnimationFrame: () => 0, document: {}, navigator: {}, location: { href: '' }, URL, fetch: () => {}, TextDecoder, TextEncoder });
  vm.runInContext(bundle('body'), ctx); return win.__bridge;
}
const grid = (f) => ({ id: 1, type: 'ElevationGrid', f: Object.assign({ xDimension: 3, zDimension: 3, xSpacing: 1, zSpacing: 1, height: new Array(9).fill(0), creaseAngle: 0, ccw: true, color: null, normal: null, texCoord: null, colorPerVertex: true, normalPerVertex: true, solid: true }, f) });
const tri = (d, t) => { const a = d.idx[t * 3] * 3, b = d.idx[t * 3 + 1] * 3, c = d.idx[t * 3 + 2] * 3, u = [0, 1, 2].map((i) => d.pos[b + i] - d.pos[a + i]), w = [0, 1, 2].map((i) => d.pos[c + i] - d.pos[a + i]); return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; };
test('ElevationGrid: counter-clockwise from +Y, flat normals up, 2 x 2 squares make 24 corners', () => {
  const B = load(), d = B.specs.get('ElevationGrid').geometry(grid({}));
  assert.equal(d.pos.length / 3, 24); assert.ok(tri(d, 0)[1] > 0, 'front face is +Y'); assert.deepEqual(Array.from(d.nrm.slice(0, 3)), [0, 1, 0]);
});
test('ElevationGrid: creaseAngle smooths a ridge, 0 keeps the facets', () => {
  const B = load(), h = [0, 1, 0, 0, 1, 0, 0, 1, 0], find = (d) => { for (let i = 0; i < d.pos.length / 3; i++) if (d.pos[i * 3] === 1 && d.pos[i * 3 + 2] === 0) return Array.from(d.nrm.slice(i * 3, i * 3 + 3)); };
  const smooth = find(B.specs.get('ElevationGrid').geometry(grid({ height: h, creaseAngle: 3 }))), flat = find(B.specs.get('ElevationGrid').geometry(grid({ height: h })));
  assert.ok(smooth[1] > flat[1] + 0.05 && Math.abs(smooth[0]) < Math.SQRT1_2 - 0.05, 'the smoothed ridge vertex leans toward straight up (the unequal triangle counts of the two sides keep it off exactly 0 1 0)');
  assert.ok(Math.abs(Math.abs(flat[0]) - Math.SQRT1_2) < 1e-6, 'a flat facet keeps its slope normal');
});
test('TriangleSet: three coordinates make a triangle, extra ones are dropped', () => {
  const B = load(), c = (n) => ({ f: { point: new Float32Array(n * 3).map((_, i) => (i % 3 === 0 ? i / 3 : 0)) } });
  const g = (n) => ({ id: 2, type: 'TriangleSet', f: { coord: c(n), color: null, normal: null, texCoord: null, ccw: true, colorPerVertex: true, normalPerVertex: true, solid: true } });
  assert.equal(B.specs.get('TriangleSet').geometry(g(7)).idx.length, 6);
});
