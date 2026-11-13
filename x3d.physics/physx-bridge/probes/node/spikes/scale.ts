// Spike: how many H-Anim ragdolls (18-link articulations) PhysX WASM runs at once. N figures dropped in a pile, 4 s, ms per step.
import { physx } from '../../../tests/physx-node.ts';
import { PhysXWorld } from '../../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../../src/bridge/model.ts';
import { axisAngleToQuat } from '../../../src/bridge/math.ts';
import { body, box, scene, surface } from '../../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../../src/ragdoll/humanoid.ts';
const ctx = await physx();
const out: Record<string, unknown>[] = [];
for (const N of [1, 5, 10, 25, 50]) {
  const sc = scene([body(box(30, 0.2, 30), { p: [0, -0.1, 0], fixed: true })], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.7, 0.7], bounce: 0.1 }) }, 1 / 240);
  sc.humanoids = []; let b = 1, s = 1, seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let k = 0; k < N; k++) {
    // parked far apart, then dropped one by one onto the same spot (a real pile)
    const pose = { p: [(k % 10) * 3 - 13.5, 0.02, 20 + Math.floor(k / 10) * 3] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number] };
    const h = indexHumanoid(buildHumanoid({ def: `H${k}`, character: k % 2 ? 'cartoon' : 'dummy', pose, prefix: `h${k}_` }), b, s);
    b += h.links.length; s += h.links.reduce((n, l) => n + l.shapes.length, 0); sc.humanoids.push(h);
  }
  const w = new PhysXWorld(ctx, sc, { contacts: 'found' });
  const st = new Float64Array(w.bodyCount * BODY_STRIDE);
  let ms = 0, worst = 0, nan = false;
  const roots = sc.humanoids.map((h) => h.links[0]);
  const total = Math.max(4, N * 0.4 + 3) * 240;
  for (let k = 0; k < total; k++) {
    const drop = Math.floor(k / 96); // one figure every 0.4 s
    if (k % 96 === 0 && drop < N) { const L = roots[drop]; w.setBodyState(L.index, [rnd() * 0.3, 2.2, rnd() * 0.3], axisAngleToQuat(rnd(), 0.4, rnd(), 1.4 + rnd()), [0, -1, 0], [rnd() * 2, rnd() * 2, rnd() * 2]); }
    const t = performance.now(); w.step(1); const d = performance.now() - t; ms += d; worst = Math.max(worst, d); w.takeContacts();
  }
  const steps = total;
  w.readState(st); nan = !st.every(Number.isFinite);
  const r = { figures: N, links: N * 18, msPerStepMean: +(ms / steps).toFixed(2), worstStepMs: +worst.toFixed(1), realtimeBudgetUsed: `${((ms / steps) * 240 / 10).toFixed(0)} %`, nan };
  out.push(r); console.log(JSON.stringify(r)); w.release();
}
