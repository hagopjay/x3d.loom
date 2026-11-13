import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { stageModel } from '../../src/ragdoll/stage.ts';
const ctx = await physx();
for (const level of [1, 2]) {
  const m = stageModel({ character: 'dummy', contraption: 'wrecking', stiff: true, level });
  const wi = m.collections[0].bodies.findIndex((b) => b.def === 'WreckerBody'), w = new PhysXWorld(ctx, m, {});
  console.log('level', level, 'joints', m.collections[0].joints.map((j) => `${j.def}:${j.body1}-${j.body2}`).join(' '), 'notes', w.notes.filter((n) => /Joint|Wrecker/.test(n.node + n.def)).map((n) => n.how).slice(0, 3));
  w.removeJoint(m.collections[0].joints.findIndex((j) => j.def === 'Latch'));
  const st = new Float64Array(w.bodyCount * 13);
  const tr: string[] = [];
  for (let k = 0; k < 480; k++) { w.step(1); if (k % 60 === 0) { w.readState(st); tr.push([st[wi * 13 + 1], st[wi * 13 + 2]].map((x) => x.toFixed(2)).join(',')); } }
  console.log('  ball y,z:', tr.join(' | '));
}
