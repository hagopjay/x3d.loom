// Does the stiff figure stand? Root height over time on a floor (no stairs), for a range of drive settings; and limp without a push.
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { stageModel } from '../../src/ragdoll/stage.ts';
const contraption = (process.argv[2] ?? 'floor') as 'floor' | 'stairs';
const m = stageModel({ character: 'dummy', contraption, stiff: true });
const h = m.humanoids![0], root = h.links[0].index;
const w = new PhysXWorld(await physx(), m, { contacts: 'none' });
const st = new Float64Array(w.bodyCount * BODY_STRIDE);
const log: string[] = [];
for (let k = 1; k <= 3 * 240; k++) {
  w.step(1); w.readState(st);
  if (k % 60 === 0) {
    const sp = Math.max(...h.links.map((L) => Math.hypot(st[L.index * 13 + 7], st[L.index * 13 + 8], st[L.index * 13 + 9])));
    log.push(`t${(k / 240).toFixed(2)} y${st[root * 13 + 1].toFixed(3)} z${st[root * 13 + 2].toFixed(3)} v${sp.toFixed(2)}`);
  }
  if (k === 2 * 240) for (const L of h.links) if (L.parent >= 0) w.setLinkStiffness(L.index, [0, 0, 0]);
}
console.log(contraption, 'stiff 0-2 s, limp after:', log.join(' | '));
