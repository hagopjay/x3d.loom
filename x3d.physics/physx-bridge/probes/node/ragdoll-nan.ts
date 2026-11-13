// First non-finite link and step for an upright drop, with link speeds just before.
import { physx } from '../../tests/physx-node.ts';
import { PhysXWorld } from '../../src/bridge/world.ts';
import { BODY_STRIDE } from '../../src/bridge/model.ts';
import { body, box, scene, surface } from '../../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid } from '../../src/ragdoll/humanoid.ts';
const variant = process.argv[2] ?? 'base';
const floor = body(box(20, 0.2, 20), { p: [0, -0.1, 0], fixed: true });
const sc = scene([floor], { preferAccuracy: variant !== 'pgs', surface: surface({ frictionCoefficients: [0.7, 0.7], bounce: 0.1, minBounceSpeed: 0.3 }) }, 1 / 240);
const built = buildHumanoid({ def: 'Dummy', character: 'dummy', pose: { p: [0, 0.3, 0], q: [0, 0, 0, 1] } });
if (variant === 'noshapes-feet') for (const L of built.model.links) if (/talus|phalanx/.test(L.segment)) L.shapes = [];
if (variant === 'rootmass') built.model.links[0].mass = 10;
sc.humanoids = [indexHumanoid(built, 1, 1)];
const h = sc.humanoids[0];
const w = new PhysXWorld(await physx(), sc, { contacts: (process.argv[3] ?? 'none') as 'none' | 'found', ccd: variant === 'noccd' ? false : undefined });
const st = new Float64Array(w.bodyCount * BODY_STRIDE);
let prev = '';
for (let k = 0; k < 720; k++) {
  w.step(1); w.readState(st);
  const bad = h.links.find((L) => !st.subarray(L.index * BODY_STRIDE, L.index * BODY_STRIDE + 13).every(Number.isFinite));
  if (bad) { console.log(variant, 'first NaN at step', k, 'link', bad.segment, '| before:', prev); process.exit(0); }
  prev = h.links.map((L) => `${L.segment}:${Math.hypot(st[L.index * BODY_STRIDE + 7], st[L.index * BODY_STRIDE + 8], st[L.index * BODY_STRIDE + 9]).toFixed(2)}`).filter((x) => +x.split(':')[1] > 1).join(' ');
}
console.log(variant, 'no NaN in 3 s; root y', st[h.links[0].index * BODY_STRIDE + 1].toFixed(3));
