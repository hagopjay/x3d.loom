import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { barrageModel, defaultBarrage } from '../../src/ragdoll/barrage-scene.ts';
const { model, idx } = barrageModel(defaultBarrage());
const w = new PhysXWorld(await physx(), model, { contacts: 'found' });
const st = new Float64Array(w.bodyCount * 13), names = [...model.collections[0].bodies.map((b) => b.def), ...model.humanoids!.flatMap((h) => h.links.map((l) => `${h.def}.${l.segment}`))];
let maxV = 0, who = '';
for (let s = 0; s < 480; s++) {
  w.step(1); w.readState(st);
  for (let i = 0; i < w.bodyCount; i++) { const v = Math.hypot(st[i * 13 + 7], st[i * 13 + 8], st[i * 13 + 9]); if (!(v < 1e9)) { console.log('non-finite at step', s, names[i]); process.exit(0); } if (v > maxV) { maxV = v; who = names[i]; } }
  if (s % 60 === 0) console.log('t', (s / 240).toFixed(2), 'fastest', who, maxV.toFixed(2)), (maxV = 0);
}
console.log('no NaN in 2 s without firing', idx.blocks.length);
