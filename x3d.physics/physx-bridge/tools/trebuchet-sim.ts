// The trebuchet in Node (the browser's PhysX world): settle, remove the latch, remove the sling at the release angle (checked every
// step, as the page does near release), follow the stone to the ground, count the castle blocks it moved.
// usage: node tools/trebuchet-sim.ts [counterweight] [stone] [sling] [release] [--save]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import { toModel } from '../src/machine/index.ts';
import { PIVOT, buildTrebuchet, defaultTrebuchet, flightAngle, shouldRelease, stoneRadius } from '../src/demos/trebuchet-scene.ts';
import type { Trebuchet } from '../src/demos/trebuchet-scene.ts';

export async function shoot(t: Trebuchet, seconds = 12) {
  const { ir, idx } = buildTrebuchet(t);
  const model = toModel(ir, 'trebuchet');
  const w = new PhysXWorld(await physx(), model, { contacts: 'none' });
  const h = model.fixedStep, st = new Float64Array(ir.bodies.length * BODY_STRIDE);
  const J = (d: string) => ir.joints.findIndex((j) => j.def === d);
  const at = (i: number) => [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2], st[i * BODY_STRIDE + 7], st[i * BODY_STRIDE + 8]];
  for (let k = 0; k < 0.4 / h; k++) w.step(1);
  w.readState(st);
  const blocks0 = idx.blocks.map((i) => at(i).slice(0, 3)), cw0 = at(idx.cw)[1];
  w.removeJoint(J('Latch'));
  let rel: null | Record<string, number> = null, apex = 0, land: null | Record<string, number> = null, ms = 0, n = 0, bad = false;
  const r = stoneRadius(t.stone);
  for (let k = 0; k < seconds / h; k++) {
    const t0 = performance.now(); w.step(1); ms += performance.now() - t0; n++;
    w.readState(st);
    const [x, y, , vx, vy] = at(idx.stone);
    if (!Number.isFinite(x)) { bad = true; break; }
    if (!rel && shouldRelease(vx, vy, t.release)) {
      w.removeJoint(J('Sling'));
      const v = Math.hypot(vx, vy), drop = cw0 - at(idx.cw)[1];
      rel = { t: +(k * h).toFixed(3), x: +x.toFixed(2), y: +y.toFixed(2), speed: +v.toFixed(2), angle: +flightAngle(vx, vy).toFixed(1), efficiency: +((0.5 * t.stone * v * v) / (t.counterweight * 9.81 * drop)).toFixed(3), cwDrop: +drop.toFixed(2) };
    }
    if (rel) apex = Math.max(apex, y);
    if (rel && !land && vy < 0 && (y < r + 0.05 || (x > t.distance - 1.5 && x < t.distance + 12 && Math.abs(vx) < 0.5 * Math.abs(rel.speed)))) land = { t: +(k * h - rel.t).toFixed(2), x: +x.toFixed(1), y: +y.toFixed(2) };
  }
  w.readState(st);
  const moved = idx.blocks.filter((i, k) => Math.hypot(...at(i).slice(0, 3).map((v, c) => v - blocks0[k][c])) > 0.3).length;
  w.release();
  return { setting: t, bad, release: rel, apex: +apex.toFixed(1), landing: land, rangeFromAxle: land ? +(land.x - PIVOT[0]).toFixed(1) : null, blocks: idx.blocks.length, blocksMoved: moved, msPerStep: +(ms / n).toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cw, stone, sling, release] = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
  const t = { ...defaultTrebuchet(), ...(cw ? { counterweight: cw } : {}), ...(stone ? { stone } : {}), ...(sling ? { sling } : {}), ...(release ? { release } : {}) };
  const r = await shoot(t);
  console.log(JSON.stringify(r));
  if (process.argv.includes('--save')) writeFileSync(`evidence/trebuchet-sim-${t.counterweight}-${t.stone}-${t.sling}-${t.release}.json`, JSON.stringify(r, null, 1));
}
