// Replay a run recorded in a browser (RunLog JSON) in Node's PhysX WASM and compare every step's state hash.
// usage: node tools/replay-node.ts run.json
import { readFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import type { RunLog } from '../src/bridge/bridge.ts';

export async function replayInNode(log: RunLog) {
  const ctx = await physx();
  const w = new PhysXWorld(ctx, log.model, log.world);
  let k = 0, mismatches = 0, firstMismatch = -1;
  const t0 = performance.now();
  for (const m of log.messages) {
    for (const tp of m.teleports) w.setBodyState(tp.index, tp.p, tp.q, tp.v, tp.w);
    for (const t of m.targets) w.setKinematicTarget(t.index, t.p, t.q);
    for (const p of m.paths) w.setKinematicPath(p.index, p.p, p.q);
    for (const c of m.sets) { if (c.kind === 'joint') w.setJointField(c.index, c.field, c.value as number); else w.setBodyLoad(c.index, c.field === 'forces' ? 'force' : 'torque', c.value as [number, number, number]); }
    const hs: number[] = [];
    w.step(m.n, hs);
    w.takeContacts();
    for (const h of hs) { if (h !== log.hashes[k]) { mismatches++; if (firstMismatch < 0) firstMismatch = k; } k++; }
  }
  w.release();
  return { steps: k, mismatches, firstMismatch, ms: performance.now() - t0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const log = JSON.parse(readFileSync(process.argv[2], 'utf8')) as RunLog;
  console.log(JSON.stringify({ recordedIn: log.recordedIn.match(/(Chrome|Firefox|Version)\/[\d.]+/)?.[0], ...(await replayInNode(log)) }));
}
