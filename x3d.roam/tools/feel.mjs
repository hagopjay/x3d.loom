// Feel report: what the road does to the car at 20, 30, 40 m/s on asphalt and on the runoff, from the sim's own ride state.
// Run inside a staged tree:  node tools/feel.mjs > feel.json   (harness code, Math.* is fine)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROAM } from '../engine/roam.js';
import { parseTrack, createSim, step, packInput } from '../engine/sim.js';
import { placeOnTrack } from '../engine/car.js';
import { pointAtS } from '../engine/track.js';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const T = parseTrack(readFileSync(ROOT + 'tests/fixtures/strip.x3d', 'utf8'));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const res = [];
for (const car0 of ['koi', 'ronin', 'tempest']) for (const v of [20, 30, 40]) for (const lane of ['asphalt', 'runoff']) {
  ROAM.on = true; ROAM.rough = 1;
  const sim = createSim({ track: T, mode: 'free', entrants: [{ car: car0, driver: 'player', tune: { traction: 1 } }] }), car = sim.cars[0], P = {};
  pointAtS(T, 1500 + Math.PI * 250 + 5, P); const head = Math.atan2(P.tx, P.tz);
  const off = lane === 'runoff' ? 12.5 : 0;     // 12.5 m from the centreline is runoff on the strip (half width 10)
  placeOnTrack(car, T, P.x - P.tz * off, P.z + P.tx * off, head, true);
  let n = 0, az2 = 0, dz2 = 0, dmean = 0, dmin = 1e9, hopMax = 0, vz2 = 0;
  const base = car.wheels.map(w => 0);
  for (let i = 0; i < 120 * 14; i++) {
    const st = Math.max(-127, Math.min(127, Math.round((80 * wrap(car.yaw - head) + 28 * car.yawRate) / (1 + car.speed / 12))));
    step(sim, [packInput({ throttle: car.speed < v ? 15 : 2, steer: st })]);
    if (i > 120 * 8 && Math.abs(car.speed - v) < 3 && car.ride) {
      const R = car.ride; n++; az2 += R.az * R.az; vz2 += R.vz * R.vz;
      for (let k = 0; k < 4; k++) { const d = car.wheels[k].load; dmean += d; dz2 += d * d; if (d < dmin) dmin = d; }
    }
  }
  if (n) { const m = dmean / (4 * n), sd = Math.sqrt(Math.max(0, dz2 / (4 * n) - m * m));
    res.push({ car: car0, speed_mps: v, lane, samples: n, bodyAccelRmsG: +(Math.sqrt(az2 / n) / 9.81).toFixed(3), heaveVelRmsMps: +Math.sqrt(vz2 / n).toFixed(3), wheelLoadCV: +(sd / m).toFixed(3), lightestWheelN: Math.round(dmin) }); }
}
console.log(JSON.stringify(res, null, 1));
