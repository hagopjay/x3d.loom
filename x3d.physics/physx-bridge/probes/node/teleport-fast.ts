// A ragdoll asleep on the ground, teleported (root pose + velocity) into the air at trebuchet speed: does it stay finite?
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { axisAngleToQuat } from '../../src/bridge/math.ts';
import { body, box, scene, surface } from '../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../src/ragdoll/humanoid.ts';
const ctx = await physx();
for (const [label, sleepFirst, speed, ccd] of [['asleep 30 m/s', 3, 30, true], ['awake 30 m/s', 0.2, 30, true], ['asleep 10 m/s', 3, 10, true], ['asleep 30 m/s no CCD', 3, 30, false]] as const) {
  const sc = scene([body(box(200, 1, 40), { p: [50, -0.5, 0], fixed: true })], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.7, 0.7] }) }, 1 / 240);
  sc.humanoids = [indexHumanoid(buildHumanoid({ def: 'T', character: 'toon', pose: { p: [-7, 0.25, 3], q: axisAngleToQuat(1, 0, 0, -Math.PI / 2) } }), 1, 1)];
  const w = new PhysXWorld(ctx, sc, { contacts: 'none', ccd });
  const st = new Float64Array(w.bodyCount * 13), root = sc.humanoids[0].links[0].index;
  for (let s = 0; s < sleepFirst * 240; s++) w.step(1);
  w.setBodyState(root, [0, 14, 0], [Math.SQRT1_2, 0, 0, Math.SQRT1_2], [speed * 0.77, speed * 0.64, 0], [0, 0, 2]);
  let bad = -1;
  for (let s = 0; s < 240 * 4; s++) { w.step(1); w.readState(st); if (!st.every(Number.isFinite)) { bad = s; break; } }
  console.log(label, bad < 0 ? 'finite' : `NaN after ${bad} steps`, 'root', [st[root * 13], st[root * 13 + 1]].map((x) => x.toFixed(1)).join(','));
  w.release();
}
