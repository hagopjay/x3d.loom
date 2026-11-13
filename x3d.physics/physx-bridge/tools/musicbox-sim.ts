// Tune the music box in Node (the browser's PhysX world, the drum driven per step as the bridge does): every peg must give exactly
// one note on its own bar, on time. usage: node tools/musicbox-sim.ts [preset|all] [tempo] [revolutions]
import { writeFileSync } from 'node:fs';
import { physx } from '../tests/physx-node.ts';
import { PhysXWorld } from '../src/bridge/world.ts';
import { BODY_STRIDE, CONTACT_STRIDE } from '../src/bridge/model.ts';
import { axisAngleToQuat } from '../src/bridge/math.ts';
import { toModel } from '../src/machine/index.ts';
import { NOTES, PRESETS, STEPS, Y0, buildMusicBox, cycle, emptyBox } from '../src/demos/musicbox-scene.ts';

export async function simulateBox(which: string, tempo: number, revs: number, log = false) {
  const m = which === 'all' ? { ...emptyBox(), tempo, grid: NOTES.map((_, i) => Array.from({ length: STEPS }, (_, s) => (s % 4 === i % 4 ? 'x' : '.')).join('')) } : { ...PRESETS[which](), tempo };
  const { ir } = buildMusicBox(m);
  const model = toModel(ir, 'musicbox');
  const w = new PhysXWorld(await physx(), model, { contacts: 'found' });
  const h = model.fixedStep, T = cycle(m.tempo), drum = ir.bodies.findIndex((b) => b.def === 'Drum');
  const bar = new Map(ir.bodies.map((b, i) => [i, b.def.startsWith('Bar') ? +b.def.slice(3) : -1]));
  const hammer = new Map(ir.bodies.map((b, i) => [i, b.def.startsWith('Hammer') ? +b.def.slice(6) : -1]));
  const hits: { t: number; note: number; impulse: number; col: number }[] = [], other: string[] = [];
  const st = new Float64Array(ir.bodies.length * BODY_STRIDE);
  let maxLift = 0;
  const n = Math.round((revs * T) / h);
  for (let k = 1; k <= n; k++) {
    w.setKinematicTarget(drum, [0, Y0, 0], axisAngleToQuat(1, 0, 0, (-2 * Math.PI * k * h) / T));
    w.step(1);
    const { events } = w.takeContacts();
    for (let o = 0; o < events.length; o += CONTACT_STRIDE) {
      const a = events[o], b = events[o + 1], imp = events[o + 11];
      const nb = bar.get(a)! >= 0 ? bar.get(a)! : bar.get(b)!, hb = hammer.get(a)! >= 0 ? hammer.get(a)! : hammer.get(b)!;
      if (nb >= 0 && hb >= 0) {
        const t = k * h, col = ((t / T) * STEPS) % STEPS;
        hits.push({ t: +t.toFixed(4), note: nb, impulse: +imp.toExponential(2), col: +col.toFixed(2) });
        if (nb !== hb) other.push(`hammer ${hb} hit bar ${nb} at ${t.toFixed(3)}`);
      }
    }
    if (k % 8 === 0) { w.readState(st); for (const [i, v] of hammer) if (v >= 0) { const q = st.subarray(i * BODY_STRIDE + 3, i * BODY_STRIDE + 7); maxLift = Math.max(maxLift, 2 * Math.asin(Math.min(1, Math.abs(q[0])))); } }
  }
  // expected: every peg once per revolution
  const pegs: { note: number; s: number }[] = [];
  m.grid.forEach((r, i) => [...r].forEach((c, s) => { if (c === 'x') pegs.push({ note: i, s }); }));
  const firstRev = hits.filter((x) => x.t > 0.25 * T); // ignore the first quarter turn (hammers settling)
  const perPeg = pegs.map((p) => firstRev.filter((x) => x.note === p.note && Math.abs(((x.col - p.s - 0.0 + STEPS * 1.5) % STEPS) - STEPS / 2) > STEPS / 2 - 1.5));
  const offsets = firstRev.map((x) => { const cands = pegs.filter((p) => p.note === x.note).map((p) => ((x.col - p.s + STEPS * 1.5) % STEPS) - STEPS / 2); return cands.sort((a, b) => Math.abs(a) - Math.abs(b))[0]; }).filter((d) => d !== undefined);
  const res = { preset: which, tempo: m.tempo, cycleS: +T.toFixed(3), revolutions: revs, pegs: pegs.length, hits: hits.length, hitsAfterSettle: firstRev.length, expectedAfterSettle: Math.round(pegs.length * (revs - 0.25)),
    wrongBar: other.length, maxLiftRad: +maxLift.toFixed(3), offsetSteps: { min: +Math.min(...offsets).toFixed(2), max: +Math.max(...offsets).toFixed(2), mean: +(offsets.reduce((a, b) => a + b, 0) / offsets.length).toFixed(2) },
    impulse: { min: Math.min(...firstRev.map((x) => x.impulse)), max: Math.max(...firstRev.map((x) => x.impulse)) }, notesPerPegPerRev: +(firstRev.length / pegs.length / (revs - 0.25)).toFixed(2) };
  void perPeg;
  if (log) console.log(hits.slice(0, 40));
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [which = 'all', tempo = '120', revs = '3'] = process.argv.slice(2);
  const r = await simulateBox(which, +tempo, +revs, process.argv.includes('--log'));
  console.log(JSON.stringify(r));
  if (process.argv.includes('--save')) writeFileSync(`evidence/musicbox-sim-${which}-${tempo}.json`, JSON.stringify(r, null, 1));
}
