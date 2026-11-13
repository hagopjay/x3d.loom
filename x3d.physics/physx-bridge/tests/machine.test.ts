// The Marble Machine generator: sanitising keeps a layout as authored; the default machine delivers its marbles in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIR, sanitizeMachine, toX3D, machineFromX3D } from '../src/machine/index.ts';
import type { Machine } from '../src/machine/index.ts';
import { simulate } from '../tools/machine-sim.ts';

const raw = JSON.parse(readFileSync(new URL('../scenes/machines/grand-cascade.json', import.meta.url), 'utf8'));

test('sanitizeMachine keeps the default machine unchanged (it once snapped −8° ramps to −15°)', () => {
  const m = sanitizeMachine(raw) as Machine;
  assert.notEqual(typeof m, 'string');
  assert.deepEqual(m.pieces.map((p) => [p.type, p.gx, p.gy, p.rot]), raw.pieces.map((p: Machine['pieces'][0]) => [p.type, p.gx, p.gy, p.rot]));
});

test('sanitizeMachine rejects hostile input', () => {
  assert.equal(typeof sanitizeMachine({ format: 'x3d-physx-machine/1', pieces: [{ id: '1" onload="x', type: 'ramp', gx: 0, gy: 0, rot: 0 }] }), 'string');
  assert.equal(typeof sanitizeMachine({ format: 'x3d-physx-machine/1', pieces: [{ id: 1, type: '<script>', gx: 0, gy: 0, rot: 0 }] }), 'string');
  assert.equal(typeof sanitizeMachine({ format: 'other', pieces: [] }), 'string');
});

test('export embeds the machine description and import reads it back', () => {
  const m = sanitizeMachine(raw) as Machine;
  const xml = toX3D(buildIR(m, { marbleStart: 'hopper' }), { mode: 'run', machine: { ...m, name: `Quote "and" <tag> & 'apostrophe'` } });
  const back = sanitizeMachine(machineFromX3D(xml)) as Machine;
  assert.equal(back.name, `Quote "and" <tag> & 'apostrophe'`);
  assert.deepEqual(back.pieces, m.pieces);
});

test('the default machine delivers its marbles to the cup, dropped alternately into hoppers A and B (Node, the same PhysX world as the browser worker)', async () => {
  const m = sanitizeMachine(raw) as Machine;
  const r = await simulate(m, 22, 20, 0.35);
  assert.ok(r.inCup >= 18, `${r.inCup}/20`); // measured 20/20; path B alone 15/20
});
