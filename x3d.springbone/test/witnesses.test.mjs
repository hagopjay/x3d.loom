import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAll } from './witnesses.mjs';
for (const r of runAll()) {
  test(`${r.id}: ${r.claim}`, () => {
    assert.ok(r.pass, `${r.id} value ${r.value} limit ${r.limit}`);
    if (r.control) assert.ok(r.control.failedAsItMust, `${r.id} control ${r.control.planted} did not fail`);
  });
}
