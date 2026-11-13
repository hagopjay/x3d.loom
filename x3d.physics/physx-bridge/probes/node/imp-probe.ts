import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { body, box, sphere, scene, surface } from '../../tests/fixtures.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
const ctx = await physx(); const h = 1 / 240;
for (const tgs of [false, true]) {
  const e = 0.3, m = 0.005, h0 = 0.2, r = 0.008;
  const w = new PhysXWorld(ctx, scene([body(box(1, 0.1, 1), { p: [0, -0.05, 0], fixed: true }), body(sphere(r), { p: [0, h0 + r, 0], mass: m })], { preferAccuracy: tgs, surface: surface({ bounce: e, minBounceSpeed: 0.05 }) }, h), { contacts: 'all' });
  const st = new Float64Array(2 * BODY_STRIDE);
  for (let k = 0; k < 140; k++) {
    w.step(1); const { current } = w.takeContacts(); w.readState(st);
    let imp = 0; for (let o = 0; o < current.length; o += 13) imp += current[o + 11];
    if (current.length) console.log(tgs ? 'TGS' : 'PGS', k, 'y', st[BODY_STRIDE + 1].toFixed(4), 'vy', st[BODY_STRIDE + 8].toFixed(3), 'contacts', current.length / 13, 'impulse', imp.toExponential(3));
  }
}
