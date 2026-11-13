// A bar on a SingleAxisHingeJoint falls under gravity onto its stop: is the limit the same with body2 = NULL (the world) and with
// body2 = a fixed body at the same place? (X3D/ODE: the angle is body1 relative to body2.)
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { JOINT_STRIDE } from '../../src/bridge/joints.ts';
import { body, box, joint, scene } from '../../tests/fixtures.ts';
const ctx = await physx();
for (const [label, fixedPose] of [['NULL (world)', null], ['fixed body at the pivot', [0, 1, 0]], ['fixed body elsewhere', [2, 0, 3]]] as const) {
  const bar = body(box(0.02, 0.02, 0.5), { p: [0, 1, 0.25], mass: 1 });
  const bodies = [bar, ...(fixedPose ? [body(box(0.1, 0.1, 0.1), { p: fixedPose as [number, number, number], fixed: true })] : [])];
  const j = joint('SingleAxisHingeJoint', 0, fixedPose ? 1 : -1, { anchorPoint: [0, 1, 0], axis: [1, 0, 0], minAngle: -0.3, maxAngle: 0.2, stopBounce: 0, stopErrorCorrection: 0.8 });
  const w = new PhysXWorld(ctx, scene(bodies, {}, 1 / 240, [j]), {});
  for (let k = 0; k < 480; k++) w.step(1);
  const st = new Float64Array(bodies.length * BODY_STRIDE); w.readState(st);
  const jo = w.readJoints();
  // the bar's tilt about x from its pose (positive = its far end went down)
  const qx = st[3], qw = st[6], ang = 2 * Math.atan2(qx, qw);
  console.log(label.padEnd(26), 'bar rotation about +x', ang.toFixed(3), 'rad; joint angle output', jo[0 * JOINT_STRIDE + 0].toFixed(3), jo[1]?.toFixed(3));
}
