// Simulate a machine in Node (PhysX WASM, same world as the browser worker) and report, per marble, the pieces it touched and where it ended.
// usage: node tools/machine-sim.ts [layout.json] [seconds] [marbles]
import { readFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../src/bridge/model.ts';
import { buildIR, toModel, dropPoint, CUP, MARBLE_R } from '../src/machine/index.ts';
import type { Machine } from '../src/machine/index.ts';

export async function simulate(m: Machine, seconds: number, marbles: number, stagger = 0.4, log = false, at?: [number, number], onlyA = false, hopper = 0, jitter = 0) {
  const ir = buildIR(m);
  const model = toModel(ir);
  const ctx = await physx();
  const w = new PhysXWorld(ctx, model, { contacts: 'all' });
  const h = model.fixedStep, idx = new Map(ir.bodies.map((b, i) => [b.def, i]));
  const marbleIdx = ir.bodies.map((b, i) => (b.role === 'marble' ? i : -1)).filter((i) => i >= 0).slice(0, marbles);
  const label = (i: number) => (ir.bodies[i].piece >= 0 ? `${m.pieces.find((p) => p.id === ir.bodies[i].piece)!.type}#${ir.bodies[i].piece}` : ir.bodies[i].def.replace('Board', ''));
  const touched = marbleIdx.map(() => [] as string[]);
  const st = new Float64Array(ir.bodies.length * BODY_STRIDE);
  let dropped = 0, impacts = 0;
  const t0 = performance.now();
  for (let k = 0; k < seconds / h; k++) {
    const t = k * h;
    while (dropped < marbleIdx.length && t >= dropped * stagger) { w.setBodyState(marbleIdx[dropped], at ? [at[0] + ((dropped % 3) - 1) * 0.004, at[1], 0] : dropPoint(2 * dropped + 2 * jitter, onlyA ? 0 : hopper === 1 ? 1 : undefined), [0, 0, 0, 1]); dropped++; }
    w.step(1);
    const { events } = w.takeContacts();
    for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
      impacts++;
      for (const [a, b] of [[events[o], events[o + 1]], [events[o + 1], events[o]]]) {
        const mi = marbleIdx.indexOf(a);
        if (mi >= 0 && b >= 0) { const l = label(b); const tr = touched[mi]; if (tr[tr.length - 1] !== l) tr.push(l); }
      }
    }
  }
  const ms = performance.now() - t0;
  w.readState(st);
  const res = marbleIdx.map((i, k) => {
    const p = [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2]];
    const inCup = Math.abs(p[0] - CUP.x) < CUP.inner / 2 && p[1] < 0.1 && p[1] > 0;
    return { k, inCup, final: p.map((x) => +x.toFixed(3)), path: touched[k].join(' > ') };
  });
  const inCup = res.filter((r) => r.inCup).length;
  if (log) for (const r of res) console.log(`marble ${r.k}: ${r.inCup ? 'CUP ' : 'stuck'} at ${r.final} | ${r.path}`);
  w.release();
  void idx; void MARBLE_R;
  return { inCup, marbles: marbleIdx.length, seconds, impacts, msPerStep: ms / (seconds / h), results: res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? 'scenes/machines/grand-cascade.json';
  const m = JSON.parse(readFileSync(file, 'utf8')) as Machine;
  const at = process.argv[5] ? (process.argv[5].split(',').map(Number) as [number, number]) : undefined;
  const r = await simulate(m, Number(process.argv[3] ?? 20), Number(process.argv[4] ?? 5), 0.6, true, at);
  console.log(`${r.inCup}/${r.marbles} in the cup after ${r.seconds} s; ${r.impacts} impacts; ${(r.msPerStep * 1000).toFixed(0)} µs/step (Node)`);
}
