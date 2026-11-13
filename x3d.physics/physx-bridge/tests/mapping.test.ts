// Every field of every X3D 4.0 RigidBodyPhysics node (official X3DUOM) has exactly one row in the mapping table, and no row names a field that does not exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAPPING } from '../src/bridge/mapping.ts';
const UOM = JSON.parse(readFileSync(new URL('../src/bridge/uom-rigidbody-4.0.json', import.meta.url), 'utf8')) as Record<string, Record<string, unknown>>;

test('the mapping covers all 14 nodes and every field of each', () => {
  assert.deepEqual(Object.keys(MAPPING).sort(), Object.keys(UOM).sort());
  for (const [node, fields] of Object.entries(UOM)) {
    const missing = Object.keys(fields).filter((f) => !MAPPING[node][f]);
    const extra = Object.keys(MAPPING[node]).filter((f) => !(f in fields));
    assert.deepEqual(missing, [], `${node}: unmapped ${missing}`);
    assert.deepEqual(extra, [], `${node}: rows for fields that do not exist ${extra}`);
  }
});
