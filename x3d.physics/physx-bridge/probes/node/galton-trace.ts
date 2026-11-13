// Trace single beads (no others) from the neck through the pins: x at each row, final bin.
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { toModel } from '../../src/machine/index.ts';
import { buildGalton, defaultGalton, geometry, rowDy } from '../../src/demos/galton-scene.ts';
const g = { ...defaultGalton(), beads: 1 };
const { ir, beads } = buildGalton(g);
const G = geometry(g), ctx = await physx();
const finals: number[] = [];
for (let trial = 0; trial < 12; trial++) {
  const w = new PhysXWorld(ctx, toModel(ir, 'g'), { contacts: 'none' });
  w.removeJoint(ir.joints.findIndex((j) => j.def === 'Latch'));
  w.removeJoint(ir.joints.findIndex((j) => j.def === 'GateHinge'));
  const b = beads[0];
  w.setBodyState(b, [(trial - 5.5) * 0.0004, G.neckY - 0.01, 0], [0, 0, 0, 1], [0, 0, 0], [0, 0, 0]);
  const st = new Float64Array(ir.bodies.length * BODY_STRIDE); const xs: string[] = []; let nextRow = 0, vmax = 0;
  for (let k = 0; k < 240 * 3; k++) {
    w.step(1); w.readState(st);
    const x = st[b * BODY_STRIDE], y = st[b * BODY_STRIDE + 1], vx = st[b * BODY_STRIDE + 7], vy = st[b * BODY_STRIDE + 8];
    vmax = Math.max(vmax, Math.hypot(vx, vy));
    while (nextRow < g.rows && y < G.firstRow - nextRow * rowDy(g.pitch) - 0.006) { xs.push((x / g.pitch).toFixed(2)); nextRow++; }
  }
  w.readState(st);
  const fx = st[b * BODY_STRIDE], fy = st[b * BODY_STRIDE + 1], fz = st[b * BODY_STRIDE + 2];
  finals.push(Math.round(fx / g.pitch));
  console.log('trial', trial, 'x/pitch per row', xs.join(' '), '| final', (fx / g.pitch).toFixed(2), 'y', fy.toFixed(3), 'z', fz.toFixed(4), 'vmax', vmax.toFixed(2));
  w.release();
}
