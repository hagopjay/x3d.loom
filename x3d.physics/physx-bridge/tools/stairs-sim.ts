// Stairs of doom in Node: the stiff figure stands at the top, goes limp, is pushed, and tumbles; the Ouch-o-meter scores the fall.
// usage: node tools/stairs-sim.ts [push m/s] [character] [--save]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import type { Vec3 } from '../src/bridge/model.ts';
import { blast, stageModel, stairsTop } from '../src/ragdoll/stage.ts';
import type { Character } from '../src/ragdoll/humanoid.ts';
import { OuchMeter } from '../src/ragdoll/ouch.ts';

export async function stairs(push = 2.5, character: Character = 'dummy', spin = 0.8, standSeconds = 0, boom = true, wobble = 0) {
  const m = stageModel({ character, contraption: 'stairs', stiff: true });
  const h = m.humanoids![0];
  const w = new PhysXWorld(await physx(), m, { contacts: 'found' });
  const st = new Float64Array(w.bodyCount * BODY_STRIDE), root = h.links[0].index;
  const at = (i: number): Vec3 => [st[i * BODY_STRIDE], st[i * BODY_STRIDE + 1], st[i * BODY_STRIDE + 2]];
  const ouch = new OuchMeter(h.links);
  let standMin = Infinity, ms = 0, n = 0, nan = false;
  w.readState(st);
  for (let k = 0; k < standSeconds * 240; k++) { w.step(1); w.takeContacts(); w.readState(st); standMin = Math.min(standMin, at(root)[1]); }
  const standEnd = at(root)[1];
  // the page keeps physics paused until the push: limp, then the push (pelvis forward, a little spin)
  for (const L of h.links) if (L.parent >= 0) w.setLinkStiffness(L.index, [0, 0, 0]);
  // the page's push: forward velocity v, a little lift, a spin; `wobble` in [-0.3, 0.3] (random on the page)
  const v = push, wob = wobble;
  w.setBodyState(root, at(root), [st[root * BODY_STRIDE + 3], st[root * BODY_STRIDE + 4], st[root * BODY_STRIDE + 5], st[root * BODY_STRIDE + 6]], [wob * 0.4, 0.3 + v * 0.06, v], [v * 0.3, wob, 0.3 * wob]);
  void spin;
  let restAt = -1, boomAt = -1, maxV = 0;
  const tnt = m.collections[0].bodies.findIndex((b) => b.def === 'TNTBody'), tntShape = tnt >= 0 ? m.collections[0].bodies[tnt].shapes[0].index! : -1;
  const linkSet = new Set(h.links.map((L) => L.index));
  for (let k = 0; k < 10 * 240; k++) {
    const t0 = performance.now(); w.step(1); ms += performance.now() - t0; n++;
    const { events } = w.takeContacts();
    ouch.feed(events, k / 240);
    // the page's TNT: on the figure's touch, the crate leaves and every dynamic body within 3.5 m gets an outward impulse
    if (boom && boomAt < 0 && tnt >= 0) for (let o = 0; o < events.length; o += 13) if ((events[o] === tnt && linkSet.has(events[o + 1])) || (events[o + 1] === tnt && linkSet.has(events[o]))) {
      boomAt = k / 240; w.setShapeEnabled(tntShape, false); w.readState(st);
      const loose = m.collections[0].bodies.filter((b) => !b.fixed).map((b) => b.index);
      for (const [i, J] of blast(st, h.links, loose)) w.applyImpulse(i, J);
      break;
    }
    w.readState(st);
    if (!st.every(Number.isFinite)) { nan = true; break; }
    const v = Math.max(...h.links.map((L) => Math.hypot(st[L.index * BODY_STRIDE + 7], st[L.index * BODY_STRIDE + 8], st[L.index * BODY_STRIDE + 9])));
    maxV = Math.max(maxV, v);
    if (restAt < 0 && k > 240 && v < 0.05) restAt = k / 240;
  }
  const boxes = m.collections[0].bodies.filter((b) => b.def.startsWith('Box')).map((b) => b.index);
  const moved = boxes.filter((i) => Math.hypot(...at(i).map((x, c) => x - m.collections[0].bodies[i].pose.p[c])) > 0.2).length;
  w.release();
  const maxLinkSpeed = maxV;
  return { push, character, wobble, maxLinkSpeed, stairsTop: stairsTop(), standing: { rootStart: h.links[0].center[1] + stairsTop(), rootMin: +standMin.toFixed(3), rootAfter2s: +standEnd.toFixed(3) },
    nan, restAt, boomAt, end: at(root).map((x) => +x.toFixed(2)), msPerStep: +(ms / n).toFixed(3),
    ouch: { total: ouch.total, hits: ouch.hits, maxCombo: ouch.maxCombo, byPart: ouch.byPart }, boxesKnocked: `${moved}/${boxes.length}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [push = '2.5', character = 'dummy'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const r = await stairs(+push, character as Character);
  console.log(JSON.stringify(r));
  if (process.argv.includes('--save')) writeFileSync(`evidence/stairs-sim-${push}-${character}.json`, JSON.stringify(r, null, 1));
}
