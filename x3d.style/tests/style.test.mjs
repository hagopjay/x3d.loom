// node --test tests/      (no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../src/color.mjs';
import { lint, transpose, invert, mixStyles, resolve, flatten, PARTS } from '../src/grammar.mjs';
import { repair } from '../src/repair.mjs';
import { compile } from '../src/compile.mjs';
import { tasks, metric, BASELINES } from '../src/evals.mjs';

const R = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const cat = R('../styles/catalogue.jsonld')['@graph'], authored = R('../styles/authored.jsonld')['@graph'], scene = R('../data/node-city.scene.json');
const by = id => cat.find(s => s['@id'] === 'xst:' + id);

test('colour: sRGB <-> OKLab round trip is exact to 8 bits', () => {
  for (const h of ['#000000', '#ffffff', '#ff3b30', '#5cf2a0', '#1f3f8f', '#808080']) assert.equal(C.oklabToHex(C.hexToOklab(h)), h);
  assert.ok(Math.abs(C.hexToOklab('#ffffff')[0] - 1) < 1e-6);
});
test('colour: WCAG contrast anchors', () => {
  assert.ok(Math.abs(C.contrast('#000000', '#ffffff') - 21) < 1e-9);
  assert.ok(Math.abs(C.contrast('#777777', '#ffffff') - 4.48) < 0.01);   // the well-known "just misses AA" grey
});
test('colour: every CVD matrix row sums to 1 (white stays white)', () => {
  for (const k of ['protan', 'deutan', 'tritan']) assert.equal(C.simulate('#ffffff', k), '#ffffff');
});
test('grammar: all 12 catalogue styles pass every applicable rule', () => {
  assert.equal(cat.length, 12);
  for (const s of cat) { const l = lint(s, scene); assert.ok(l.ok, `${s['@id']}: ${l.rules.filter(r => r.applies && !r.pass).map(r => r.id)}`); }
});
test('grammar: the authored Neon Noir fails G4 for colour-blind readers, and repair fixes it with a small move', () => {
  const a = authored.find(s => s['@id'] === 'xst:neon-noir');
  const l = lint(a, scene); assert.deepEqual(l.rules.filter(r => r.applies && !r.pass).map(r => r.id), ['G4']);
  const r = repair(a, scene); assert.ok(r.ok); assert.ok(r.maxDrift < 0.03);
});
test('grammar: the classic hypsometric ramp fails G5 (lightness reverses)', () => {
  const s = JSON.parse(JSON.stringify(by('atlas'))); s.palette.sequential = ['#2f7d54', '#8fba62', '#e8d98a', '#c48a50', '#7d5240'];
  const g5 = lint(s, scene).rules.find(r => r.id === 'G5'); assert.equal(g5.pass, false); assert.equal(g5.note, 'lightness reverses');
});
test('grammar: negative cases', () => {
  const bad = f => { const s = JSON.parse(JSON.stringify(by('maquette'))); f(s); return lint(s, scene).rules.filter(r => r.applies && !r.pass).map(r => r.id); };
  assert.deepEqual(bad(s => { delete s.palette.ink; }), ['G1']);
  assert.ok(bad(s => { s.palette.ink = '#d8d2c6'; }).includes('G2'));
  assert.ok(bad(s => { s.palette.alert = '#ffffff'; }).includes('G6'));
  assert.ok(bad(s => { s.encode = { hue: 'mono', alert: 'glow' }; }).includes('G8'));
  assert.ok(bad(s => { s.motion = { pulse: 0.2, flow: 0 }; }).includes('G11'));
  assert.ok(bad(s => { s.intent.key = 'low'; }).includes('G14'));
});
test('operators: transpose keeps structure, takes palette; invert is its own inverse on lightness', () => {
  const t = transpose(by('neon-noir'), by('manuscript'));
  assert.deepEqual(t.palette, by('manuscript').palette); assert.deepEqual(t.form, by('neon-noir').form); assert.equal(t.operator, 'transpose');
  const i = invert(invert(by('maquette')));
  assert.ok(C.deltaE(i.palette.ground, by('maquette').palette.ground) < 0.01);
  const m0 = mixStyles(by('terracotta'), by('brass'), 0), m1 = mixStyles(by('terracotta'), by('brass'), 1);
  assert.equal(m0.palette.ground, by('terracotta').palette.ground); assert.equal(m1.palette.ground, by('brass').palette.ground);
});
test('grammar: shading cannot separate a dark body from a dark plate (the black-frame case)', () => {
  const inv = invert(by('maquette'));
  assert.ok(lint(inv, scene).rules.find(r => r.id === 'G3').pass === false);
  assert.ok(lint(by('maquette'), scene).rules.find(r => r.id === 'G3').note === 'by shading');
});
test('compile: deterministic, carries all 48 tokens and the role tags', () => {
  const s = by('blueprint'), a = compile(scene, s), b = compile(scene, s);
  assert.equal(a, b);
  assert.equal(flatten(s).length, 48);
  for (const [k] of flatten(s)) assert.ok(a.includes(`name='xst:${k.replace('.', '_')}'`), k);
  for (const r of ['ground', 'plate', 'mass', 'alert', 'hero', 'link']) assert.ok(a.includes(`value='"${r}"'`), r);
  assert.ok(a.includes('<OrthoViewpoint'));
});
test('evals: the metric cannot be gamed by throwing the palette away', () => {
  const T = tasks(cat, scene).filter(t => t.family === 'repair'); assert.ok(T.length > 100);
  const t = T[0];
  assert.ok(metric(t, BASELINES.identity.run(t), scene).score < 0.5);
  assert.ok(metric(t, BASELINES['home-palette'].run(t, cat), scene).score <= 0.51);
  assert.equal(metric(t, { nonsense: true }, scene).score, 0);
});

// 25 Nov, A Landscape of Consciousness (LEARNINGS-landscape-of-consciousness.md): the first style borrowed from a source figure, kept apart from the
// 12-style catalogue because adding it would change the matrix and vocabulary counts that Demo 75 quotes. Its authored failure is the test.
test('kuhn-landscape: the authored palette fails G4 (borrowed figure colours: colour-blind min 0.027 against 0.04), the repaired one passes every applicable rule', () => {
  const k = R('../styles/kuhn-landscape.style.json');
  const a = lint(k.authored);
  assert.equal(a.ok, false);
  assert.deepEqual(a.rules.filter(r => r.applies && !r.pass).map(r => r.id), ['G4']);   // the learnings text says G4 and G6 and 10/12 to 12/12; re-linted here it is G4 only, 10/11 to 11/11 (G6 was met after the hand change to the silver)
  const f = lint(k.final); assert.ok(f.ok, f.rules.filter(r => r.applies && !r.pass).map(r => r.id).join());
  assert.equal(k.final.palette.categorical.length, 10);
  assert.notDeepEqual(k.final.palette.categorical, k.authored.palette.categorical);
});
