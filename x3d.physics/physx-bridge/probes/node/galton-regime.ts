// Single beads (no crowding) through the pins: spread of final bins against the binomial's, for surface friction, bead drag, bounce.
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { toModel } from '../../src/machine/index.ts';
import { buildGalton, defaultGalton, geometry } from '../../src/demos/galton-scene.ts';
const ctx = await physx();
const combos = process.argv.slice(2).length ? [process.argv.slice(2).join(' ').split(' ').map(Number)] : [[0.15, 6, 0.1], [0.5, 6, 0.1], [0.5, 20, 0.1], [0.5, 40, 0], [0.8, 20, 0], [0.3, 30, 0.2]];
for (const [mu, c, bounce, jit = 0, pitch = 0.02] of combos) {
  const g = { ...defaultGalton(), beads: 1, bounce, drag: 1 - Math.exp(-c), pitch };
  const { ir, beads } = buildGalton(g); ir.surface.friction = mu;
  let js = 99; const jr = () => ((js = (js * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (const b of ir.bodies) if (b.def === 'Pins') for (const sh of b.shapes) { sh.local = { ...sh.local, p: [sh.local.p[0] + jr() * jit, sh.local.p[1] + jr() * jit, 0] }; }
  const G = geometry(g), finals: number[] = [];
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let trial = 0; trial < 40; trial++) {
    const w = new PhysXWorld(ctx, toModel(ir, 'g'), { contacts: 'none' });
    w.removeJoint(ir.joints.findIndex((j) => j.def === 'Latch')); w.removeJoint(ir.joints.findIndex((j) => j.def === 'GateHinge'));
    const b = beads[0];
    w.setBodyState(b, [rnd() * 0.006, G.neckY - 0.01, 0], [0, 0, 0, 1], [rnd() * 0.05, 0, 0], [0, 0, 0]);
    const st = new Float64Array(ir.bodies.length * BODY_STRIDE);
    for (let k = 0; k < 240 * 4; k++) w.step(1);
    w.readState(st); finals.push(Math.round(st[b * BODY_STRIDE] / g.pitch)); w.release();
  }
  const m = finals.reduce((a, b) => a + b, 0) / finals.length, sd = Math.sqrt(finals.reduce((a, b) => a + (b - m) ** 2, 0) / finals.length);
  const hist: Record<number, number> = {}; for (const f of finals) hist[f] = (hist[f] ?? 0) + 1;
  console.log(`friction ${mu} drag ${c}/s bounce ${bounce} jitter ${jit * 1000} mm pitch ${pitch * 1000} mm: sd ${sd.toFixed(2)} (binomial 1.73) mean ${m.toFixed(2)} hist ${JSON.stringify(hist)}`);
}
