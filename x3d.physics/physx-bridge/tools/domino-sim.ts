// Domino runs in Node (the browser's PhysX world): push the first domino of a straight row and measure the toppling wave's speed
// for a sweep of gaps; the result is the PhysX curve the page plots next to Larham's measured dominoes.
// usage: node tools/domino-sim.ts [n=40] [--save]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE } from '../src/bridge/model.ts';
import { toModel } from '../src/machine/index.ts';
import { FALLEN, GAP, H, LARHAM, PRESETS, T, buildDominoes, starts, tiltOf, tip, waveSpeed } from '../src/demos/dominoes-scene.ts';
import type { DominoRun } from '../src/demos/dominoes-scene.ts';

export async function runDominoes(run: DominoRun, seconds = 8) {
  const { ir, ds } = buildDominoes(run);
  const model = toModel(ir, 'dominoes');
  const w = new PhysXWorld(await physx(), model, { contacts: 'found' });
  const st = new Float64Array(ir.bodies.length * BODY_STRIDE), fall: (number | undefined)[] = ds.map(() => undefined);
  for (let k = 0; k < 24; k++) w.step(1); // settle
  for (const i of starts(run, ds)) { const t = tip(ds[i]); w.setBodyState(i + 1, t.p, t.q, t.v, t.w); }
  const h = model.fixedStep, t0 = performance.now();
  let steps = 0;
  for (let k = 0; k < seconds / h; k++) {
    w.step(1); steps++; w.takeContacts();
    if (k % 2) continue;
    w.readState(st);
    ds.forEach((_, i) => { if (fall[i] === undefined) { const o = (i + 1) * BODY_STRIDE; if (tiltOf(st[o + 3], st[o + 5]) > FALLEN) fall[i] = k * h; } });
    if (fall.every((x) => x !== undefined)) break;
  }
  const ms = performance.now() - t0;
  w.release();
  return { ds, fall, msPerStep: ms / steps, fallen: fall.filter((x) => x !== undefined).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] ?? 40);
  const mus = (process.argv.find((a) => a.startsWith('--mu='))?.slice(5) ?? '0.1,0.2,0.3').split(',').map(Number);
  const sweeps: Record<string, Record<string, number | null>[]> = {};
  for (const mu of mus) {
    const rows: Record<string, number | null>[] = (sweeps[`friction ${mu}`] = []);
    for (let g = GAP.min; g <= GAP.max + 1e-9; g += GAP.step) {
      const gap = +g.toFixed(2), run = PRESETS.line(gap);
      run.strokes[0].path = [[0, -0.6], [0, -0.6 + n * (gap * H + T)]];
      run.friction = mu;
      const r = await runDominoes(run);
      const sp = waveSpeed(r.fall, gap * H + T);
      rows.push({ gapOverH: gap, dominoes: r.ds.length, fallen: r.fallen, v: sp ? +sp.v.toFixed(4) : null, vOverSqrtGH: sp ? +(sp.v / Math.sqrt(9.81 * H)).toFixed(3) : null, msPerStep: +r.msPerStep.toFixed(3) });
    }
    console.log(`friction ${mu}:`, rows.map((r) => `${r.gapOverH}:${r.vOverSqrtGH ?? `stopped(${r.fallen}/${r.dominoes})`}`).join(' '));
  }
  if (process.argv.includes('--save')) writeFileSync('evidence/dominoes-sweep.json', JSON.stringify({ measured: 'PhysX 5 (physx-js-webidl WASM) in Node, straight rows, first domino pushed (0.05 rad tilt, 6 rad/s); speed fitted after the first five dominoes; 1/240 s, TGS', domino: { H, T, W: 0.0255, mass: 0.008 }, sweeps, larham2013_read_not_measured: { source: 'Larham, arXiv:1302.3311, table 1 (vertical dominoes 51.6 x 25.5 x 7.9 mm)', gapOverH_vOverSqrtGH: LARHAM } }, null, 1));
}
