// Cost and wave speed of the spiral for sleep settings and step sizes (Node, same PhysX world as the browser).
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { toModel } from '../../src/machine/index.ts';
import { FALLEN, H, PRESETS, T, buildDominoes, starts, tiltOf, tip, waveSpeed } from '../../src/demos/dominoes-scene.ts';
const ctx = await physx();
for (const [label, step, sleep] of [['1/240 current', 1 / 240, null], ['1/240 eager sleep', 1 / 240, { disableLinearSpeed: 0.03, disableAngularSpeed: 0.3, disableTime: 0.1 }], ['1/120 current', 1 / 120, null], ['1/120 eager sleep', 1 / 120, { disableLinearSpeed: 0.03, disableAngularSpeed: 0.3, disableTime: 0.1 }]] as const) {
  const run = PRESETS.spiral(0.45); run.friction = 0.2;
  const { ir, ds } = buildDominoes(run);
  if (sleep) ir.world = { ...ir.world, ...sleep };
  const w = new PhysXWorld(ctx, toModel(ir, 'd', step), { contacts: 'found' });
  for (let k = 0; k < Math.round(0.1 / step); k++) w.step(1);
  for (const i of starts(run, ds)) { const t = tip(ds[i]); w.setBodyState(i + 1, t.p, t.q, t.v, t.w); }
  const st = new Float64Array(ir.bodies.length * BODY_STRIDE), fall: (number | undefined)[] = ds.map(() => undefined);
  let worst = 0, total = 0, n = 0;
  for (let k = 0; k < 7 / step; k++) {
    const t0 = performance.now(); w.step(1); const dt = performance.now() - t0; w.takeContacts();
    worst = Math.max(worst, dt); total += dt; n++;
    w.readState(st);
    ds.forEach((_, i) => { const o = (i + 1) * BODY_STRIDE; if (fall[i] === undefined && tiltOf(st[o + 3], st[o + 5]) > FALLEN) fall[i] = k * step; });
  }
  const sp = waveSpeed(fall, 0.45 * H + T);
  console.log(label.padEnd(20), 'fallen', fall.filter((x) => x !== undefined).length, '/', ds.length, 'v', sp?.v.toFixed(3), 'ms/step mean', (total / n).toFixed(3), 'worst', worst.toFixed(2), 'ms per simulated s (mean)', ((total / n) / step).toFixed(0));
  w.release();
}
