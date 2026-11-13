// The barrage in Node: fire the three trebuchets in turn; at each release the ball leaves the simulation and a parked toon dummy
// takes its place with its pose and velocity (as the page does); measure release speed, landing, stones moved, roofs toppled, cost.
// usage: node tools/barrage-sim.ts [counterweight] [ball] [distance]
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import type { Vec3 } from '../src/bridge/model.ts';
import { barrageModel, defaultBarrage } from '../src/ragdoll/barrage-scene.ts';
import { shouldRelease } from '../src/demos/trebuchet-scene.ts';
import { OuchMeter } from '../src/ragdoll/ouch.ts';

const [cw, ball, dist] = process.argv.slice(2).map(Number);
const b = { ...defaultBarrage(), ...(cw ? { counterweight: cw } : {}), ...(ball ? { ball } : {}), ...(dist ? { distance: dist } : {}) };
const { model, idx } = barrageModel(b);
const w = new PhysXWorld(await physx(), model, { contacts: 'found' });
const st = new Float64Array(w.bodyCount * 13);
const at = (i: number): Vec3 => [st[i * 13], st[i * 13 + 1], st[i * 13 + 2]];
const J = (d: string) => model.collections[0].joints.findIndex((j) => j.def === d);
const shapeOf = (bi: number) => model.collections[0].bodies[bi].shapes[0].index!;
w.readState(st);
const blocks0 = idx.blocks.map(at), roofs0 = idx.roofs.map(at);
const ouch = model.humanoids!.map((h) => new OuchMeter(h.links));
const shots: Record<string, unknown>[] = [];
let ms = 0, n = 0, nan = false;
for (let k = 0; k < 3; k++) {
  const tr = idx.tre[k], h = model.humanoids![k];
  w.removeJoint(J(`T${k}Latch`));
  let released = false, rel: Record<string, number> = {}, maxX = 0;
  for (let s = 0; s < 9 * 240; s++) {
    const t0 = performance.now(); w.step(1); ms += performance.now() - t0; n++;
    const { events } = w.takeContacts(); ouch.forEach((o) => o.feed(events, s / 240));
    w.readState(st);
    if (process.env.DEBUG && !st.every(Number.isFinite)) {
      const names = [...model.collections[0].bodies.map((x) => x.def), ...model.humanoids!.flatMap((hh) => hh.links.map((l) => `${hh.def}.${l.segment}`))];
      const bad = names.filter((_, i) => !Number.isFinite(st[i * 13]) || !Number.isFinite(st[i * 13 + 7]));
      console.log('first non-finite at shot', k, 'step', s, released ? 'after release' : 'before release', bad.slice(0, 6)); process.exit(0);
    }
    if (!released) {
      const vx = st[tr.stone * 13 + 7], vy = st[tr.stone * 13 + 8];
      if (shouldRelease(vx, vy, 40)) {
        released = true; w.removeJoint(J(`T${k}Sling`));
        const p = at(tr.stone), v: Vec3 = [vx, vy, st[tr.stone * 13 + 9]];
        // the swap: the ball leaves; the dummy's pelvis takes its place (lying back, as if curled in the pouch), with its velocity
        w.setShapeEnabled(shapeOf(tr.stone), false); w.setBodyState(tr.stone, [p[0], -50, p[2]], [0, 0, 0, 1]);
        const sp = Math.hypot(...v), ahead: Vec3 = [p[0] + (v[0] / sp) * 1.5, p[1] + (v[1] / sp) * 1.5, p[2]];
        w.setBodyState(h.links[0].index, ahead, [Math.SQRT1_2, 0, 0, Math.SQRT1_2], v, [0, 0, 2]);
        rel = { speed: +Math.hypot(vx, vy).toFixed(1), x: +p[0].toFixed(1), y: +p[1].toFixed(1) };
      }
    } else maxX = Math.max(maxX, st[h.links[0].index * 13]);
  }
  if (!st.every(Number.isFinite)) { nan = true; break; }
  const moved = idx.blocks.filter((i, j) => Math.hypot(...at(i).map((x, c) => x - blocks0[j][c])) > 0.3).length;
  shots.push({ lane: k, release: rel, furthestX: +maxX.toFixed(1), dummyEnd: at(h.links[0].index).map((x) => +x.toFixed(1)), ouch: ouch[k].total, stonesMovedSoFar: moved });
}
const roofsDown = idx.roofs.filter((i, j) => at(i)[1] < roofs0[j][1] - 1).length;
console.log(JSON.stringify({ setting: b, nan, msPerStep: +(ms / n).toFixed(2), stones: idx.blocks.length, roofsDown: `${roofsDown}/${idx.roofs.length}`, shots }, null, 1));
