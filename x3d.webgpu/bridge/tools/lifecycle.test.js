// Core execution-context regressions. Uses the real bundled reader and a
// Python XML-backed test DOM; rendering and PROTO rewriting require a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadReader } = require('./test-dom');
const xml = (body) => `<X3D version="4.0" profile="Full"><Scene>${body}</Scene></X3D>`;
const open = (X3DSAI, body) => X3DSAI.B.createX3DFromString(xml(body), 'https://example.test/scene.x3d');

test('inherited JavaScript names are not recognized as X3D nodes or fields', async () => {
  const { R, X3DSAI } = loadReader();
  const scene = await open(X3DSAI, '<constructor/><toString/><Transform DEF="T" toString="bogus"/>');
  assert.equal(scene._world.nodes.length, 1);
  assert.equal(scene._world.nodes[0].type, 'Transform');
  assert.equal(Object.hasOwn(scene._world.nodes[0].f, 'toString'), false);
  assert.ok(scene._world.warnings.some((w) => w.includes('<constructor>') && w.includes('skipped')));
  assert.ok(scene._world.warnings.some((w) => w.includes('no field toString')));
  assert.throws(() => scene.createNode('constructor'), /Unknown node type/);
  assert.equal(R.DEFS.Transform.translation[0], 'SFVec3f');
});

test('separate scenes emit independently within one timestamp', async () => {
  const { R, X3DSAI } = loadReader();
  const body = '<ScalarInterpolator DEF="I" key="0 1" keyValue="0 10"/>';
  const a = await open(X3DSAI, body), b = await open(X3DSAI, body);
  const A = a.getNamedNode('I'), B = b.getNamedNode('I'), rawA = X3DSAI.unwrap(A), rawB = X3DSAI.unwrap(B);
  const gotA = [], gotB = [];
  A.addFieldCallback('test', 'value_changed', (v) => gotA.push(v));
  B.addFieldCallback('test', 'value_changed', (v) => gotB.push(v));
  R.events.begin(100);
  R.receive(rawA, 'set_fraction', 0.25);
  R.receive(rawB, 'set_fraction', 0.75);
  R.events.drain();
  assert.deepEqual(gotA, [2.5]);
  assert.deepEqual(gotB, [7.5]);
  const created = a.createNode('Transform');
  assert.equal(new Set([rawA.id, rawB.id, X3DSAI.unwrap(created).id]).size, 3);
});

test('hall geometry nodes the bridge owns stay nodes, with unique ids per execution context', () => {
  const { R } = loadReader();
  const scene = xml('<Shape><Disk2D DEF="D" outerRadius="2"/></Shape><Shape><Rectangle2D DEF="R" size="3 1"/></Shape><Shape><Extrusion DEF="E" spine="0 0 0, 0 1 0"/></Shape>');
  const worlds = [R.parseX3D(scene), R.parseX3D(scene)];
  for (const w of worlds) {
    for (const t of ['Disk2D', 'Rectangle2D', 'Extrusion']) assert.equal(w.nodes.filter((n) => n.type === t).length, 1, t + ' is kept as written');
    assert.equal(w.nodes.find((n) => n.type === 'Disk2D').f.outerRadius, 2);
    assert.deepEqual(Array.from(w.nodes.find((n) => n.type === 'Rectangle2D').f.size), [3, 1]);
  }
  const ids = worlds.flatMap((w) => Array.from(w.nodes, (n) => n.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('generated hall geometry (no bridge kit) shares the execution-context node allocator', () => {
  const fs = require('node:fs'), path = require('node:path'), SRC = path.resolve(__dirname, '..', '..', 'demo', 'src');
  const code = '(function () {\n"use strict";\n' + ['brain/reader.js', 'gobbler/reader-ext.js', 'demiurge/reader-ext-dm.js', 'dynasty/reader-ext-dl.js', 'hall/reader-ext-hl.js', 'brain/sai.js'].map((p) => fs.readFileSync(path.join(SRC, p), 'utf8')).join('\n') + '\nwindow.__R = R;\n})();\n';
  const { R } = loadReader(code);
  const scene = xml('<Shape><Disk2D/></Shape><Shape><Rectangle2D/></Shape>');
  const worlds = [R.parseX3D(scene), R.parseX3D(scene)];
  const ids = worlds.flatMap((w) => Array.from(w.nodes, (n) => n.id));
  assert.ok(ids.length > 8, 'the geometry converter generated Coordinate and TextureCoordinate nodes');
  assert.equal(new Set(ids).size, ids.length);
});

test('explicit disposal stops old tickers and queued routes while retained scenes keep running', async () => {
  const { R, X3DSAI } = loadReader();
  const disposed = [];
  R.bridge.node('LifecycleProbe', {
    defs: { value: ['SFFloat', 'out', 0], input: ['SFFloat', 'in', 0] },
    tick(n) { R.bridge.emit(n, 'value', n.f.value + 1); },
    dispose(n) { disposed.push(n.id); },
  });
  const a = await open(X3DSAI, '<LifecycleProbe DEF="A"/>');
  const b = await open(X3DSAI, '<LifecycleProbe DEF="B"/>');
  const report = a.getFidelityReport();
  assert.equal(report, a._world.fidelity || null);
  const A = a.getNamedNode('A'), B = b.getNamedNode('B'), rawA = X3DSAI.unwrap(A), rawB = X3DSAI.unwrap(B);
  const gotA = [], gotB = [];
  A.addFieldCallback('test', 'value', (v) => gotA.push(v));
  B.addFieldCallback('test', 'value', (v) => gotB.push(v));
  a.addRoute(A, 'value', B, 'input');
  b.addRoute(B, 'value', A, 'input');
  R.events.begin(100); R.events.drain();
  assert.equal(gotA.length, 1);
  assert.equal(gotB.length > 0, true);
  R.events.begin(101); R.events.emit(rawA, 'value', 999);
  assert.equal(R.events.queue.length, 2, 'one pending route targets the retained scene');
  const before = rawB.f.value, callbacksBeforeDispose = gotA.length;
  assert.equal(a.dispose(), true);
  assert.equal(a.dispose(), false, 'disposal is idempotent');
  assert.equal(a.getFidelityReport(), report, 'import diagnostics remain available after disposal');
  assert.deepEqual(disposed, [rawA.id]);
  assert.equal(R.bridge.worlds.length, 1);
  assert.equal(R.bridge.tickers.size, 1);
  assert.equal(R.events.queue.length, 0);
  assert.equal(b._world.routes.length, 0, 'retained contexts release routes to disposed nodes');
  assert.equal(rawB.out.value, undefined, 'source outputs release incoming route references');
  R.events.begin(102); R.events.drain();
  assert.equal(rawB.f.value, before + 1);
  assert.equal(gotA.length, callbacksBeforeDispose, 'disposed callbacks no longer receive events');
  R.bridge.fire(rawA, 'value', 555); R.bridge.emit(rawA, 'value', 555);
  assert.notEqual(rawA.f.value, 555, 'late asynchronous emissions are ignored');
  assert.throws(() => a.createNode('Transform'), /disposed/);
  assert.throws(() => { A.value = 1; }, /disposed/);
  assert.throws(() => b.addRoute(B, 'value', A, 'input'), /disposed/);
});

test('current and adopted contexts are protected; released scenes cannot be reused', async () => {
  const { R, X3DSAI } = loadReader();
  const body = { canvas: {}, timeSensors: [], setWorld(world) { this.world = world; }, adopt() {} };
  X3DSAI.setBody(body); R.bridge.body = body;
  const main = await open(X3DSAI, '<Group DEF="Root"/>');
  await X3DSAI.B.replaceWorld(main);
  assert.throws(() => main.dispose(), /active scene/);
  assert.throws(() => R.bridge.disposeWorld(main._world), /active scene/);
  const imported = await open(X3DSAI, '<Transform DEF="Imported"/><TimeSensor DEF="Timer"/>');
  const roots = imported.rootNodes, importedNode = roots[0];
  main.addRootNode(importedNode);
  assert.throws(() => imported.dispose(), /active scene/, 'adopted roots still use their source context');
  const replacement = await open(X3DSAI, '<Group/>');
  await X3DSAI.B.replaceWorld(replacement);
  assert.equal(imported.dispose(), true);
  assert.equal(body.timeSensors.length, 0);
  await assert.rejects(X3DSAI.B.replaceWorld(imported), /disposed/);
  assert.throws(() => roots.push(main.getNamedNode('Root')), /disposed/);
  assert.throws(() => replacement.addRootNode(importedNode), /disposed/);
});

test('a failed cleanup hook does not retain other nodes or rerun cleanup', async () => {
  const { R, X3DSAI } = loadReader();
  let calls = 0;
  R.bridge.node('CleanupProbe', {
    defs: {}, tick() {},
    dispose() { calls++; throw new Error('cleanup probe'); },
  });
  const scene = await open(X3DSAI, '<CleanupProbe/><CleanupProbe/>');
  assert.throws(() => scene.dispose(), /Bridge world cleanup failed/);
  assert.equal(calls, 2);
  assert.equal(R.bridge.worlds.length, 0);
  assert.equal(R.bridge.tickers.size, 0);
  assert.equal(scene.dispose(), false);
  assert.equal(calls, 2);
});

test('the set_ inputs of an Extrusion take a route, and an interpolator output reads as an empty list before any event', async () => {
  const { X3DSAI } = loadReader();
  const scene = await open(X3DSAI, '<Shape><Extrusion DEF="E" crossSection="0 0, 1 0, 1 1, 0 0"/></Shape><CoordinateInterpolator DEF="C3" key="0 1" keyValue="0 0 0, 1 1 1"/><CoordinateInterpolator2D DEF="C2" key="0 1" keyValue="0 0, 1 1"/>'
    + '<ROUTE fromNode="C2" fromField="value_changed" toNode="E" toField="set_crossSection"/><ROUTE fromNode="C3" fromField="value_changed" toNode="E" toField="set_spine"/>');
  assert.equal(scene._world.warnings.filter((w) => /ROUTE/.test(w)).length, 0);
  assert.equal(scene.getNamedNode('C3').value_changed.length, 0);
  assert.equal(scene.getNamedNode('C2').value_changed.length, 0);
});

test('a typed array of numbers is a list of 2D vectors in both directions of the SAI', async () => {
  const { X3DSAI } = loadReader();
  const scene = await open(X3DSAI, '<Shape><IndexedFaceSet coordIndex="0 1 2"><Coordinate point="0 0 0, 1 0 0, 0 1 0"/><TextureCoordinate DEF="TC" point="0 0, 1 0, 0 1"/></IndexedFaceSet></Shape>');
  const tc = scene.getNamedNode('TC');
  tc.point = new Float32Array([0, 0, 2, 2]);
  const raw = X3DSAI.unwrap(tc);
  assert.equal(Array.from(raw.f.point).join(','), '0,0,2,2');
  assert.equal(tc.point.length, 2);
  assert.equal(tc.point[1].x + ',' + tc.point[1].y, '2,2');
});
