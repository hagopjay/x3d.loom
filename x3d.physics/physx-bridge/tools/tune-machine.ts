// Search piece placements that put the most marbles in the cup (random sampling, then hill-climbing on the grid).
// usage: node tools/tune-machine.ts base.json spec.json out.json [samples] [hopper A|B|AB]
// spec: [{ "id": 4, "gx": [6, 8], "gy": [7, 9], "rot": [-15, 0, 15] }, ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { simulate } from './machine-sim.ts';
import type { Machine } from '../src/machine/index.ts';

const [, , baseFile, specFile, outFile, samplesArg = '40', which = 'A'] = process.argv;
const base = JSON.parse(readFileSync(baseFile, 'utf8')) as Machine;
const spec = JSON.parse(readFileSync(specFile, 'utf8')) as { id: number; gx: [number, number]; gy: [number, number]; rot?: number[] }[];
const N = 8, T = 14;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (r: [number, number]) => r[0] + Math.floor(rnd() * (r[1] - r[0] + 1));

async function score(m: Machine) {
  // two trials with different drop jitter; hopper A, B or both (alternating)
  let s = 0;
  for (const jitter of [0, 1]) {
    const r = await simulate(m, T, N, 0.7 + 0.13 * jitter, false, undefined, which === 'A' ? true : false, which === 'B' ? 1 : 0, jitter);
    s += r.inCup;
  }
  return s;
}
const apply = (m: Machine, v: { id: number; gx: number; gy: number; rot: number }[]) => { const c = structuredClone(m); for (const x of v) Object.assign(c.pieces.find((p) => p.id === x.id)!, { gx: x.gx, gy: x.gy, rot: x.rot }); return c; };
const cur = () => spec.map((s) => { const p = base.pieces.find((q) => q.id === s.id)!; return { id: s.id, gx: p.gx, gy: p.gy, rot: p.rot }; });

let best = cur(), bestScore = await score(apply(base, best));
console.log('start', bestScore, '/', 2 * N);
for (let k = 0; k < Number(samplesArg); k++) {
  const v = spec.map((s) => ({ id: s.id, gx: pick(s.gx), gy: pick(s.gy), rot: s.rot ? s.rot[Math.floor(rnd() * s.rot.length)] : base.pieces.find((p) => p.id === s.id)!.rot }));
  const sc = await score(apply(base, v));
  if (sc > bestScore) { best = v; bestScore = sc; console.log('sample', k, sc, JSON.stringify(v)); }
  if (bestScore === 2 * N) break;
}
// hill-climb: move one piece by one hole
let improved = true;
while (improved && bestScore < 2 * N) {
  improved = false;
  for (let i = 0; i < best.length && !improved; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const v = structuredClone(best); v[i].gx += dx; v[i].gy += dy;
    const sc = await score(apply(base, v));
    if (sc > bestScore) { best = v; bestScore = sc; improved = true; console.log('climb', sc, JSON.stringify(v)); break; }
  }
}
writeFileSync(outFile, JSON.stringify(apply(base, best), null, 1));
console.log('best', bestScore, '/', 2 * N, JSON.stringify(best));
