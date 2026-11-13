// Spike: a trampoline in standard X3D. X3D gives one bounce value per collection, so the bed is a platform on a SliderJoint whose
// sliderForce (a live X3D field) the page sets each frame as a spring: F = -k (y - y0) - c v. Updated every 4 physics steps (a frame)
// against every step, to see whether frame-rate updates are stable. The dummy (limp) is dropped from 3 m.
import { physx } from '../../../tests/physx-node.ts';
import { PhysXWorld } from '../../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../../src/bridge/model.ts';
import { body, box, joint, scene, surface } from '../../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../../src/ragdoll/humanoid.ts';
const ctx = await physx();
for (const every of [4]) for (const k of [6000, 10000]) {
  const trace: string[] = [];
  const floor = body(box(20, 0.2, 20), { p: [0, -0.1, 0], fixed: true });
  const bed = body(box(2.4, 0.3, 2.4), { p: [0, 1.0, 0], mass: 60 });
  const sc = scene([floor, bed], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.8, 0.8], bounce: 0.05 }) }, 1 / 240,
    [joint('SliderJoint', 1, 0, { axis: [0, 1, 0], minSeparation: -0.95, maxSeparation: 0.3, stopBounce: 0, stopErrorCorrection: 0.8 })]);
  sc.humanoids = [indexHumanoid(buildHumanoid({ def: 'D', character: 'dummy', pose: { p: [0, 3.5, 0], q: [0.38, 0, 0, 0.92] } }), 2, 2)];
  const w = new PhysXWorld(ctx, sc, { contacts: 'none' });
  const st = new Float64Array(w.bodyCount * BODY_STRIDE), root = sc.humanoids[0].links[0].index;
  const y0 = 1.0, c = 2 * Math.sqrt(k * 95) * 0.08; // light damping (8 % of critical for bed + figure)
  let apexAfterFirst = 0, minBed = 9, nan = false, bounced = false, prevVy = 0;
  for (let n = 0; n < 6 * 240; n++) {
    if (n % every === 0) { w.readState(st); const y = st[1 * 13 + 1], vy = st[1 * 13 + 8]; w.setJointField(0, 'sliderForce', -k * (y - y0) - c * vy + 60 * 9.81); }
    w.step(1); w.readState(st);
    if (!st.every(Number.isFinite)) { nan = true; break; }
    minBed = Math.min(minBed, st[1 * 13 + 1]);
    const vy = st[root * 13 + 8];
    if (prevVy < 0 && vy > 0.5) bounced = true;
    if (bounced) apexAfterFirst = Math.max(apexAfterFirst, st[root * 13 + 1]);
    prevVy = vy;
    if (n % 24 === 0) trace.push(`${(n / 240).toFixed(1)}:${st[root * 13 + 1].toFixed(2)}/${st[1 * 13 + 1].toFixed(2)}@x${st[root * 13].toFixed(1)}`);
  }
  console.log(JSON.stringify({ updateEverySteps: every, k, nan, bedLowest: +minBed.toFixed(2), pelvisApexAfterBounce: +apexAfterFirst.toFixed(2), droppedFromPelvis: 4.32, bedRest: 1.1 }));
  console.log('pelvis/bed@x over time:', trace.join(' '));
  w.release();
}
