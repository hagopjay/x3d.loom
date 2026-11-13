// The Galton board in Node (the browser's PhysX world): settle, meter the beads into the chute at the page's rate (lowest bead in the
// hopper first, as the page does), and compare the bins with Binomial(n, 1/2). usage: node tools/galton-sim.ts [beads] [rows] [bounce] [tilt] [--save]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import { toModel } from '../src/machine/index.ts';
import { BIN_TOP, binomial, buildGalton, chiSquare, defaultGalton, geometry, shakeGravity } from '../src/demos/galton-scene.ts';
import type { Galton } from '../src/demos/galton-scene.ts';

export async function pour(g: Galton, seconds = 18, contacts: 'found' | 'none' | 'sensed' = 'sensed', rate = 20, shake = false) {
  const { ir, beads } = buildGalton(g);
  const model = toModel(ir, 'galton');
  const t0b = performance.now();
  // the browser fills reportShapes from the CollisionSensor; here from the IR's chimes (the same shapes, in model order)
  const shapeIdx = new Map(model.collections[0].bodies.flatMap((b) => b.shapes).map((sh) => [sh.def, sh.index ?? -1]));
  const w = new PhysXWorld(await physx(), model, { contacts, reportShapes: ir.chimes.map((d) => shapeIdx.get(d)!) });
  const buildMs = performance.now() - t0b;
  const G = geometry(g), h = model.fixedStep, st = new Float64Array(ir.bodies.length * BODY_STRIDE);
  let ms = 0, n = 0, worst = 0, done = -1;
  const stuck: number[][] = [];
  const count = () => {
    w.readState(st);
    stuck.length = 0;
    const bins = G.bins.map(() => 0); let inHopper = 0, lost = 0, inPins = 0, inChute = 0;
    for (const i of beads) {
      const x = st[i * BODY_STRIDE], y = st[i * BODY_STRIDE + 1];
      if (y > G.neckY - 0.004) inHopper++;
      else if (y > G.chuteBottom) inChute++;
      else if (y > G.lastRow - 0.01) { inPins++; stuck.push([+(x / g.pitch).toFixed(2), +((G.firstRow - y) / (g.pitch * 0.866)).toFixed(2)]); }
      else if (y < G.lastRow - 0.01 && y > -0.05) { const j = Math.round(x / g.pitch + g.rows / 2); if (j >= 0 && j < bins.length) bins[j]++; else lost++; }
      else if (y <= -0.05 || Math.abs(x) > G.halfW + 0.05) lost++;
    }
    return { bins, inHopper, lost, inPins, inChute, stuck: stuck.slice() };
  };
  for (let k = 0; k < seconds / h; k++) {
    if (k >= 0.5 / h && (k - Math.round(0.5 / h)) % Math.round(1 / rate / h) === 0) {
      w.readState(st);
      let best = -1, by = Infinity;
      for (const i of beads) { const y = st[i * BODY_STRIDE + 1]; if (y > G.neckY && y < by) { by = y; best = i; } }
      if (best >= 0) w.setBodyState(best, G.dropAt, [0, 0, 0, 1], [0, 0, 0], [0, 0, 0]);
    }
    // shake twice near the end (the page's Shake button): gravity rocks in the board's plane
    const ts = k * h - (seconds - 4);
    if (shake && ts >= 0 && ts < 2.5) w.setGravity(0, shakeGravity(g.tilt, ts % 1.5));
    const t = performance.now(); w.step(1); const dt = performance.now() - t; w.takeContacts();
    ms += dt; n++; worst = Math.max(worst, dt);
    if (k % 240 === 0 && k > 0.5 / h) { const c = count(); if (c.inHopper === 0 && c.bins.reduce((a, b) => a + b, 0) + c.lost >= beads.length && done < 0) done = k * h; }
  }
  const c = count(), N = c.bins.reduce((a, b) => a + b, 0), p = binomial(g.rows), exp = p.map((x) => x * N);
  const mean = c.bins.reduce((s, x, j) => s + x * (j - g.rows / 2), 0) / (N || 1), sd = Math.sqrt(c.bins.reduce((s, x, j) => s + x * (j - g.rows / 2 - mean) ** 2, 0) / (N || 1));
  w.release();
  return { setting: g, buildMs: +buildMs.toFixed(0), msPerStepMean: +(ms / n).toFixed(3), msPerStepWorst: +worst.toFixed(2), allInBinsAt: done, ...c, binned: N, expected: exp.map((x) => +x.toFixed(1)), meanBins: +mean.toFixed(3), sdBins: +sd.toFixed(3), binomialSd: +(Math.sqrt(g.rows) / 2).toFixed(3), ...chiSquare(c.bins, exp) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [beads = '240', rows = '12', bounce = '0.1', tilt = '0', pitch = '0.019'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const g = { ...defaultGalton(), beads: +beads, rows: +rows, bounce: +bounce, tilt: +tilt, pitch: +pitch };
  const r = await pour(g, 20, process.argv.includes('--none') ? 'none' : process.argv.includes('--found') ? 'found' : 'sensed', 20, process.argv.includes('--shake'));
  console.log(JSON.stringify(r));
  if (process.argv.includes('--save')) writeFileSync(`evidence/galton-sim-${beads}-${rows}-${bounce}-${tilt}-${pitch}.json`, JSON.stringify(r, null, 1));
}
