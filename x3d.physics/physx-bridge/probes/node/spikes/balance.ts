// Spike: a balance assist so a stiff figure can stand and wait (on a tower top) until something hits it. Every frame (4 steps) the
// root link gets an angular impulse towards upright: L = K (kp e - kd w), e = up x Y. Time standing (pelvis above 0.7 m) for 12 s.
import { physx } from '../../../tests/physx-node.ts';
import { PhysXWorld, setDriveGains } from '../../../src/bridge/world.ts';
import { quatRotate } from '../../../src/bridge/math.ts';
import { body, box, scene, surface } from '../../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../../src/ragdoll/humanoid.ts';
const ctx = await physx();
for (const [kp, K] of [[2000, 0], [4000, 0], [8000, 0], [4000, 30], [8000, 30]]) {
  setDriveGains(kp, kp / 25);
  const sc = scene([body(box(20, 0.2, 20), { p: [0, -0.1, 0], fixed: true })], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.8, 0.8] }) }, 1 / 240);
  sc.humanoids = [indexHumanoid(buildHumanoid({ def: 'D', character: 'dummy', pose: { p: [0, 0.002, 0], q: [0, 0, 0, 1] }, stiffness: 1 }), 1, 1)];
  const w = new PhysXWorld(ctx, sc, { contacts: 'none' });
  const st = new Float64Array(w.bodyCount * 13), root = sc.humanoids[0].links[0].index;
  let fellAt = -1, maxTilt = 0;
  for (let n = 0; n < 12 * 240; n++) {
    if (n % 4 === 0 && K) {
      w.readState(st);
      const q = [st[root * 13 + 3], st[root * 13 + 4], st[root * 13 + 5], st[root * 13 + 6]] as [number, number, number, number];
      const u = quatRotate(q, [0, 1, 0]), e = [u[1] * 0 - u[2] * 1, u[2] * 0 - u[0] * 0, u[0] * 1 - u[1] * 0]; // u × Y
      const wv = [st[root * 13 + 10], st[root * 13 + 11], st[root * 13 + 12]];
      w.applyAngularImpulse(root, [K * (8 * e[0] - 1.5 * wv[0]) / 60, 0, K * (8 * e[2] - 1.5 * wv[2]) / 60]);
    }
    w.step(1);
    if (n % 24 === 0) { w.readState(st); const tilt = Math.acos(Math.max(-1, Math.min(1, quatRotate([st[root * 13 + 3], st[root * 13 + 4], st[root * 13 + 5], st[root * 13 + 6]], [0, 1, 0])[1]))); maxTilt = Math.max(maxTilt, tilt); if (fellAt < 0 && st[root * 13 + 1] < 0.7) fellAt = n / 240; }
  }
  console.log(JSON.stringify({ driveNmPerRad: kp, assistGain: K, fellAtS: fellAt, maxTiltDeg: +(maxTilt * 57.3).toFixed(1) }));
  w.release();
}
