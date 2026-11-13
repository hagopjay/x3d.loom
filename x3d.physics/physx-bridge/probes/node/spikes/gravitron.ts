// Spike: the Gravitron. A kinematic drum (36 wall panels, radius 3 m) spins up with a limp figure against the wall; the floor
// switches off (CollidableShape.enabled); the drum slows; when does the figure start sliding? Theory: friction holds while μω²r ≥ g.
import { physx } from '../../../tests/physx-node.ts';
import { PhysXWorld } from '../../../src/bridge/world.ts';
import { axisAngleToQuat } from '../../../src/bridge/math.ts';
import type { ShapeModel } from '../../../src/bridge/model.ts';
import { body, box, scene, surface } from '../../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../../src/ragdoll/humanoid.ts';
const ctx = await physx(), R = 3, MU = 0.7;
const panels: ShapeModel[] = Array.from({ length: 36 }, (_, k) => { const a = (2 * Math.PI * k) / 36; return { def: `P${k}`, local: { p: [(R + 0.1) * Math.sin(a), 1.25, (R + 0.1) * Math.cos(a)], q: axisAngleToQuat(0, 1, 0, a) }, geom: { kind: 'box', half: [0.28, 1.25, 0.1] }, enabled: true }; });
// the floor turns with the drum (as on the ride): it is the drum's last shape, switched off at 4 s
panels.push({ def: 'DrumFloor', local: { p: [0, -0.1, 0], q: [0, 0, 0, 1] }, geom: { kind: 'box', half: [3.05, 0.1, 3.05] }, enabled: true });
const drum = body(box(1, 1, 1), { p: [0, 0, 0], fixed: true, kinematic: true }); drum.shapes = panels;
const floor = body(box(8, 0.2, 8), { p: [0, -6, 0], fixed: true }); // a catch floor far below
const sc = scene([drum, floor], { preferAccuracy: true, surface: surface({ frictionCoefficients: [MU, MU], bounce: 0 }) }, 1 / 240);
// the figure: lying against the wall at +z, back to the wall, feet down
sc.humanoids = [indexHumanoid(buildHumanoid({ def: 'D', character: 'cartoon', pose: { p: [0, 0.02, R - 0.25], q: axisAngleToQuat(0, 1, 0, Math.PI) } }), 2, 39)];
const w = new PhysXWorld(ctx, sc, { contacts: 'none' });
const h = sc.humanoids[0], root = h.links[0].index, st = new Float64Array(w.bodyCount * 13);
let theta = 0, omega = 0, floorOff = false, slideAt: number | null = null, minY = 9; const trace: string[] = [];
const plan = (t: number) => (t < 3 ? (3.5 * t) / 3 : t < 6 ? 3.5 : Math.max(0, 3.5 - (3.5 * (t - 6)) / 8)); // up, hold (floor off at 4 s), down over 8 s
for (let k = 0; k < 15 * 240; k++) {
  const t = k / 240; omega = plan(t); theta += omega / 240;
  w.setKinematicTarget(0, [0, 0, 0], axisAngleToQuat(0, 1, 0, theta));
  if (!floorOff && t >= 4) { w.setShapeEnabled(panels.length - 1, false); floorOff = true; }
  w.step(1);
  if (k % 12 === 0) {
    w.readState(st);
    const y = st[root * 13 + 1], vy = st[root * 13 + 8], r = Math.hypot(st[root * 13], st[root * 13 + 2]);
    if (t > 4.5) minY = Math.min(minY, y);
    if (floorOff && slideAt === null && vy < -0.25 && y < 0) slideAt = omega;
    if (k % 240 === 0) trace.push(`t${t.toFixed(0)} ω${omega.toFixed(2)} y${y.toFixed(2)} r${r.toFixed(2)}`);
  }
}
const rCom = R - 0.15, predicted = Math.sqrt(9.81 / (MU * rCom));
console.log(JSON.stringify({ mu: MU, radiusToBody: rCom, predictedSlideOmega: +predicted.toFixed(2), measuredSlideOmega: slideAt === null ? null : +slideAt.toFixed(2), trace }));
