// Spike: do several ragdolls piling up stay finite? Figures stacked 1.2 m apart in the air (none starts inside another), falling
// together onto one spot; with the bridge's limits cap. NaN and cost for 2, 3, 5 and 8 figures; also with contact reports off.
import { physx } from '../../../tests/physx-node.ts';
import { PhysXWorld } from '../../../src/bridge/world.ts';
import { axisAngleToQuat } from '../../../src/bridge/math.ts';
import { body, box, scene, surface } from '../../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../../src/ragdoll/humanoid.ts';
const ctx = await physx();
for (const contacts of ['found', 'none'] as const) for (const N of [2, 3, 5, 8]) {
  const sc = scene([body(box(30, 0.2, 30), { p: [0, -0.1, 0], fixed: true })], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.7, 0.7], bounce: 0.1 }) }, 1 / 240);
  sc.humanoids = []; let b = 1, s = 1;
  for (let k = 0; k < N; k++) {
    // lying flat (rotated 90° about x), 1.2 m above the previous one, alternating head direction
    const q = axisAngleToQuat(1, 0, 0, k % 2 ? Math.PI / 2 : -Math.PI / 2);
    const h = indexHumanoid(buildHumanoid({ def: `H${k}`, character: 'dummy', pose: { p: [0.1 * (k % 3), 0.5 + 1.2 * k, k % 2 ? -0.9 : 0.9], q }, prefix: `h${k}_` }), b, s);
    b += h.links.length; s += h.links.reduce((n, l) => n + l.shapes.length, 0); sc.humanoids.push(h);
  }
  const w = new PhysXWorld(ctx, sc, { contacts });
  const st = new Float64Array(w.bodyCount * 13);
  let ms = 0, worst = 0, nanAt = -1; const steps = 5 * 240;
  for (let k = 0; k < steps; k++) {
    const t = performance.now(); w.step(1); const d = performance.now() - t; ms += d; worst = Math.max(worst, d); w.takeContacts();
    if (k % 24 === 0) { w.readState(st); if (nanAt < 0 && !st.every(Number.isFinite)) { nanAt = k / 240; break; } }
  }
  console.log(JSON.stringify({ contacts, figures: N, nanAtS: nanAt, msPerStepMean: +(ms / steps).toFixed(2), worstStepMs: +worst.toFixed(1) }));
  w.release();
}
