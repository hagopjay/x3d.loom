// The H-Anim dummy as a PhysX articulation in Node (the browser's world): drop it, push it, and check that it holds together, respects
// its joint limits, lands and settles. usage: node tools/ragdoll-sim.ts [height m] [push m/s] [--save]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import type { Quat, SceneModel, Vec3 } from '../src/bridge/model.ts';
import { quatConj, quatMul, quatRotate } from '../src/bridge/math.ts';
import { body, box, scene, surface } from '../tests/fixtures.ts';
import { buildHumanoid, indexHumanoid, rotY } from '../src/ragdoll/humanoid.ts';
import { axisKinds } from '../src/bridge/hanim.ts';

/** Rotation of q as XYZ angles (the H-Anim limit axes): q = Rx·Ry·Rz is not unique; this uses the intrinsic x-y-z decomposition. */
function eulerXYZ(q: Quat): Vec3 {
  const [x, y, z, w] = q;
  const sy = 2 * (w * y + x * z);
  return [Math.atan2(2 * (w * x - y * z), 1 - 2 * (x * x + y * y)), Math.asin(Math.max(-1, Math.min(1, sy))), Math.atan2(2 * (w * z - x * y), 1 - 2 * (y * y + z * z))];
}

export async function dropDummy(height = 1, push = 1.5, seconds = 5, tilt = 0.4) {
  const floor = body(box(20, 0.2, 20), { p: [0, -0.1, 0], fixed: true });
  const sc: SceneModel = scene([floor], { preferAccuracy: true, surface: surface({ frictionCoefficients: [0.7, 0.7], bounce: 0.1, minBounceSpeed: 0.3 }) }, 1 / 240);
  const built = buildHumanoid({ def: 'Dummy', character: 'dummy', pose: { p: [0, height, 0], q: quatMul(rotY(0), [Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)]) } });
  sc.humanoids = [indexHumanoid(built, 1, 1)];
  const h = sc.humanoids[0];
  const t0b = performance.now();
  const w = new PhysXWorld(await physx(), sc, { contacts: 'found' });
  const buildMs = performance.now() - t0b;
  const st = new Float64Array(w.bodyCount * BODY_STRIDE);
  // the push: the root link (the pelvis, at its joint centre in the humanoid frame) keeps its pose and gets a forward velocity
  const c = quatRotate(h.pose.q, h.links[0].center), rootP: Vec3 = [h.pose.p[0] + c[0], h.pose.p[1] + c[1], h.pose.p[2] + c[2]];
  w.setBodyState(h.links[0].index, rootP, h.pose.q, [0, 0, push], [0, 0, 0]);
  const pos = (i: number): Vec3 => [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2]];
  const rot = (i: number): Quat => [st[i * BODY_STRIDE + 3], st[i * BODY_STRIDE + 4], st[i * BODY_STRIDE + 5], st[i * BODY_STRIDE + 6]];
  let maxSep = 0, maxSpeed = 0, nan = false, impacts = 0, ms = 0, worst = 0, eulerGap = 0;
  const overLimit: Record<string, number> = {};
  const steps = Math.round(seconds * 240);
  for (let k = 0; k < steps; k++) {
    const t = performance.now(); w.step(1); const dt = performance.now() - t; ms += dt; worst = Math.max(worst, dt);
    impacts += w.takeContacts().events.length / 13;
    w.readState(st);
    for (const L of h.links) {
      const i = L.index;
      if (!st.subarray(i * BODY_STRIDE, i * BODY_STRIDE + 13).every(Number.isFinite)) nan = true;
      maxSpeed = Math.max(maxSpeed, Math.hypot(st[i * BODY_STRIDE + 7], st[i * BODY_STRIDE + 8], st[i * BODY_STRIDE + 9]));
      if (L.parent < 0) continue;
      const P = h.links[L.parent];
      // the joint: the child's origin should sit where the parent's frame puts the joint centre
      const want = quatRotate(rot(P.index), [L.center[0] - P.center[0], L.center[1] - P.center[1], L.center[2] - P.center[2]]).map((x, c) => x + pos(P.index)[c]);
      maxSep = Math.max(maxSep, Math.hypot(...pos(i).map((x, c) => x - want[c])));
      // PhysX's own joint coordinates against the limits it was given (tolerance 0.05 rad); for revolute joints only the twist moves
      const jp = w.linkJointPositions(i);
      if (jp && L.llimit.length) {
        const kinds = axisKinds(L.llimit, L.ulimit), moving = [0, 1, 2].filter((k) => kinds[k] !== 'locked');
        const pairs: [number, number][] = moving.length === 1 ? [[0, moving[0]]] : moving.map((k) => [k, k]);
        for (const [axis, hk] of pairs) { const over = kinds[hk] === 'limited' ? Math.max(0, L.llimit[hk] - jp[axis], jp[axis] - L.ulimit[hk]) : 0; if (over > 0.05) overLimit[`${L.joint}.${'xyz'[hk]}`] = Math.max(overLimit[`${L.joint}.${'xyz'[hk]}`] ?? 0, +over.toFixed(3)); }
        // the H-Anim reading (x-y-z angles of the child relative to the parent) can differ from PhysX's twist/swing coordinates: keep the largest gap
        const e = eulerXYZ(quatMul(quatConj(rot(P.index)), rot(i)));
        for (const k of moving) eulerGap = Math.max(eulerGap, Math.abs(e[k] - jp[moving.length === 1 ? 0 : k]));
      }
    }
  }
  const head = pos(h.links.find((L) => L.segment === 'skull')!.index), rootY = pos(h.links[0].index)[1];
  const endSpeed = Math.max(...h.links.map((L) => Math.hypot(st[L.index * BODY_STRIDE + 7], st[L.index * BODY_STRIDE + 8], st[L.index * BODY_STRIDE + 9])));
  w.release();
  return { height, push, seconds, links: h.links.length, buildMs: +buildMs.toFixed(1), msPerStep: +(ms / steps).toFixed(3), worstStepMs: +worst.toFixed(2), nan, maxJointSeparationM: +maxSep.toExponential(2), maxLinkSpeed: +maxSpeed.toFixed(2), endMaxLinkSpeed: +endSpeed.toFixed(3), rootHeightEnd: +rootY.toFixed(3), headEnd: head.map((x) => +x.toFixed(2)), impacts, overLimitBeyond5cRad: overLimit, maxGapHAnimEulerVsPhysXCoordsRad: +eulerGap.toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [height = '1', push = '1.5'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const r = await dropDummy(+height, +push);
  console.log(JSON.stringify(r, null, 1));
  if (process.argv.includes('--save')) writeFileSync(`evidence/ragdoll-drop-${height}-${push}.json`, JSON.stringify(r, null, 1));
}
