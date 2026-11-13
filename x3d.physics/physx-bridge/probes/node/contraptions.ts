// Cannon and wrecking ball in Node: stable? where does the dummy end up? what does it score?
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { quatFromTo } from '../../src/bridge/math.ts';
import { CANNON, cannonDir, muzzle, stageModel } from '../../src/ragdoll/stage.ts';
import { OuchMeter } from '../../src/ragdoll/ouch.ts';
const ctx = await physx();
for (const c of ['cannon', 'wrecking'] as const) for (const level of [1, 2, 3]) for (const ch of ['dummy', 'cartoon'] as const) {
  const m = stageModel({ character: ch, contraption: c, stiff: true, level });
  const h = m.humanoids![0], root = h.links[0].index, w = new PhysXWorld(ctx, m, { contacts: 'found' });
  const st = new Float64Array(w.bodyCount * 13), ouch = new OuchMeter(h.links);
  const wrecker = m.collections[0].bodies.findIndex((b) => b.def === 'WreckerBody');
  if (c === 'cannon') { for (const L of h.links) if (L.parent >= 0) w.setLinkStiffness(L.index, [0, 0, 0]); const d = cannonDir(), mz = muzzle(), v = CANNON.speeds[level - 1]; w.setBodyState(root, [mz[0], mz[1] + d[1] * 0.6, mz[2] + d[2] * 0.6], quatFromTo([0, 1, 0], d), [0, d[1] * v, d[2] * v], [3, 0, 0]); }
  else w.removeJoint(m.collections[0].joints.findIndex((j) => j.def === 'Latch'));
  let nan = false, struck = false;
  for (let k = 0; k < 8 * 240; k++) {
    w.step(1); const { events } = w.takeContacts(); ouch.feed(events, k / 240);
    if (c === 'wrecking' && !struck) for (let o = 0; o < events.length; o += 13) if ((events[o] === wrecker && events[o + 1] >= h.links[0].index) || (events[o + 1] === wrecker && events[o] >= h.links[0].index)) { struck = true; for (const L of h.links) if (L.parent >= 0) w.setLinkStiffness(L.index, [0, 0, 0]); }
    if (k % 48 === 0) { w.readState(st); if (!st.every(Number.isFinite)) { nan = true; break; } }
  }
  w.readState(st);
  console.log(c, level, ch, nan ? 'NaN' : 'ok', 'end', [st[root * 13], st[root * 13 + 1], st[root * 13 + 2]].map((x) => x.toFixed(1)).join(','), 'ouch', ouch.total, c === 'wrecking' ? `struck ${struck}` : '');
  w.release();
}
