// Does a live gravity change reach a resting (sleeping) body? One sphere on a floor, gravity turned upward after it sleeps.
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { body, box, sphere, scene } from '../../tests/fixtures.ts';
const w = new PhysXWorld(await physx(), scene([body(box(1, 0.1, 1), { p: [0, -0.05, 0], fixed: true }), body(sphere(0.01), { p: [0, 0.0101, 0], mass: 0.01 })], { autoDisable: true, disableLinearSpeed: 0.01, disableAngularSpeed: 0.01, disableTime: 0.2 }, 1 / 240), {});
const st = new Float64Array(2 * BODY_STRIDE);
for (let k = 0; k < 480; k++) w.step(1);
w.setGravity(0, [0, 5, 0]);
for (let k = 0; k < 24; k++) w.step(1);
w.readState(st); console.log('y after 0.1 s of upward gravity', st[BODY_STRIDE + 1].toFixed(4), 'vy', st[BODY_STRIDE + 8].toFixed(3));
