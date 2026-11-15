// KANSEI ROAM checks. Run from a staged tree (tools/stage.py), the same way as the game's own tests:
//   python3 -I tools/stage.py --game ../x3d.drift --out /tmp/roam-stage && cd /tmp/roam-stage && cp ../.../x3d.roam/tests/roam.test.mjs tests/ && node tests/roam.test.mjs
// Harness code (not // loom:sim): Math.* is fine here. The sim only ever sees packed inputs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROAM } from '../engine/roam.js';
import { parseTrack, createSim, step, packInput, hashSim } from '../engine/sim.js';
import { placeOnTrack } from '../engine/car.js';
import { pointAtS } from '../engine/track.js';
import { roadHeight, footHeight } from '../engine/road.js';
import { fadeOf } from '../engine/brakes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STRIP = parseTrack(readFileSync(ROOT + 'tests/fixtures/strip.x3d', 'utf8'));
const STRAIGHT_S = 1500 + Math.PI * 250 + 5;
let fails = 0; const out = {};
const ok = (name, cond, info) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info ? ' (' + info + ')' : '')); if (!cond) fails++; };

function start(id, tune = { traction: 1 }, s0 = STRAIGHT_S) {
  const sim = createSim({ track: STRIP, mode: 'free', entrants: [{ car: id, driver: 'player', tune }] });
  const car = sim.cars[0], P = {}; pointAtS(STRIP, s0, P); placeOnTrack(car, STRIP, P.x, P.z, Math.atan2(P.tx, P.tz), true);
  return { sim, car, head: Math.atan2(P.tx, P.tz), P };
}
/** hold the heading: a P controller on yaw error and yaw rate (+ steer = right = yaw falls: so the error enters with a plus sign) */
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const hold = (car, head) => Math.max(-127, Math.min(127, Math.round((80 * wrap(car.yaw - head) + 28 * car.yawRate) / (1 + car.speed / 12))));
function run(id, ticks, ctl, tune, s0) {
  const w = start(id, tune, s0); const rec = [];
  for (let i = 0; i < ticks; i++) { const inp = ctl(w.car, w.head, i, w.sim); step(w.sim, [inp]); rec.push(w.car); if (w.done) break; }
  return w;
}
function timeTo100(id, rough, on = true) {
  ROAM.on = on; ROAM.rough = rough;
  const w = start(id); let t = 0;
  for (let i = 0; i < 120 * 30; i++) { step(w.sim, [packInput({ throttle: 15, steer: hold(w.car, w.head) })]); if (w.car.speed * 3.6 >= 100) { t = (i + 1) / 120; break; } }
  return t;
}
function stop100(id, rough, on = true) {
  ROAM.on = on; ROAM.rough = rough;
  const w = start(id); let phase = 0, d0 = 0, d = 0;
  for (let i = 0; i < 120 * 60; i++) {
    const v = w.car.speed * 3.6, st = hold(w.car, w.head);
    if (phase === 0) { step(w.sim, [packInput({ throttle: 15, steer: st })]); if (v >= 110) { phase = 1; } }
    else { if (phase === 1 && v <= 100) { phase = 2; d0 = w.car.distance; } step(w.sim, [packInput({ brake: 15, steer: st })]); if (phase === 2 && v < 1) { d = w.car.distance - d0; break; } }
  }
  return d;
}

// ---- 1. ROAM off is KANSEI v1.1, bit for bit -------------------------------------------------------
{
  const trace = (on) => { ROAM.on = on; ROAM.rough = 1; const w = start('ronin', { traction: 1 }); const hs = [];
    for (let i = 0; i < 1500; i++) { step(w.sim, [packInput({ throttle: i < 900 ? 15 : 0, brake: i >= 900 ? 8 : 0, steer: hold(w.car, w.head) })]); if (i % 300 === 299) hs.push(hashSim(w.sim)); } return hs; };
  const a = trace(false), b = trace(false), c = trace(true), d = trace(true);
  const ref = process.env.V11_HASHES ? process.env.V11_HASHES.split(',') : null;
  ok('roam off: two runs hash identically', a.join() === b.join());
  ok('roam on: two runs hash identically', c.join() === d.join());
  ok('roam on differs from roam off (the layer does something)', a.join() !== c.join());
  if (ref) ok('roam off equals the unpatched v1.1 engine (hashes from x3d.drift)', a.join() === ref.join(), a.join());
  out.hashesOff = a;
}

// ---- 2. the road: deterministic, bounded, full of the promised features ------------------------------
{
  ROAM.on = true; ROAM.rough = 1;
  let mn = 9, mx = -9, s2 = 0, n = 0, steps = 0, big = 0;
  for (let s = 0; s < STRIP.L; s += 0.02) { const h = footHeight(STRIP, s, 0, s, 0, 0, 9); if (h < mn) mn = h; if (h > mx) mx = h; s2 += h * h; n++; if (h < -0.015) big++; }
  ok('road: same point, same height (pure function)', roadHeight(STRIP, 1234.5, 1.2, 10, 20, 0, 9) === roadHeight(STRIP, 1234.5, 1.2, 10, 20, 0, 9));
  ok('road: asphalt stays within +-8 cm and has real dips (potholes)', mn > -0.08 && mx < 0.03 && big > 0, `min ${(mn * 1000).toFixed(1)} mm, max ${(mx * 1000).toFixed(1)} mm, rms ${(Math.sqrt(s2 / n) * 1000).toFixed(1)} mm, samples below -15 mm: ${big}`);
  out.road = { minMm: +(mn * 1000).toFixed(1), maxMm: +(mx * 1000).toFixed(1), rmsMm: +(Math.sqrt(s2 / n) * 1000).toFixed(2) };
  ROAM.rough = 0; ok('road: ROAM.rough = 0 is glass', roadHeight(STRIP, 1234.5, 1.2, 10, 20, 0, 9) === 0); ROAM.rough = 1;
}

// ---- 3. the ride: natural frequencies and damping from a drop --------------------------------------------
{
  ROAM.on = true; ROAM.rough = 0;
  const w = start('ronin', { traction: 1 }); step(w.sim, [packInput({})]);
  const R = w.car.ride; R.z = 0.02;                  // lift the body 20 mm and let go
  const zs = []; for (let i = 0; i < 360; i++) { step(w.sim, [packInput({})]); zs.push(R.z); }
  const peaks = []; for (let i = 1; i < zs.length - 1; i++) if (zs[i] > zs[i - 1] && zs[i] >= zs[i + 1] && zs[i] > 1e-5) peaks.push(i);
  const T1 = peaks.length > 1 ? (peaks[1] - peaks[0]) / 120 : NaN, f = 1 / T1;
  const ratio = peaks.length > 1 ? zs[peaks[1]] / zs[peaks[0]] : NaN;
  ok('ride: heave natural frequency 1.4-2.2 Hz', f > 1.4 && f < 2.2, `${f.toFixed(2)} Hz`);
  ok('ride: heave is damped (peak ratio per cycle 0.01-0.4)', ratio > 0.01 && ratio < 0.4, `ratio ${ratio.toFixed(3)}`);
  ok('ride: body settles to within 0.2 mm in 3 s', Math.abs(zs[zs.length - 1]) < 2e-4, `${(zs[zs.length - 1] * 1000).toFixed(3)} mm`);
  out.ride = { heaveHz: +f.toFixed(2), peakRatio: +ratio.toFixed(3) };
}

// ---- 4. a 3 cm kerb-height step under both left wheels: the load spike and the body response ---------------
{
  ROAM.on = true; ROAM.rough = 0;
  const w = start('ronin', { traction: 1 }); const car = w.car;
  for (let i = 0; i < 60; i++) step(w.sim, [packInput({ throttle: 4, steer: hold(car, w.head) })]);
  const R = car.ride; R.zr[0] += 0.0; let maxd = 0, peakRoll = 0;
  // inject: raise the left wheels' road reference by 30 mm in one tick through the ride state (a step in the zu of the left side)
  R.zu[0] += 0.03; R.zu[2] += 0.03;
  for (let i = 0; i < 120; i++) { step(w.sim, [packInput({ throttle: 4, steer: hold(car, w.head) })]); for (let k = 0; k < 4; k++) maxd = Math.max(maxd, Math.abs(R.dFz[k])); peakRoll = Math.max(peakRoll, Math.abs(R.ph)); }
  ok('ride: a 30 mm hop of the left wheels makes a real load swing and rolls the body, then it dies away', maxd > 500 && peakRoll > 0.0005 && Math.abs(R.ph) < 5e-4, `max dFz ${maxd.toFixed(0)} N, peak roll ${(peakRoll * 57.3).toFixed(3)} deg, after 1 s ${(R.ph * 57.3).toFixed(4)} deg`);
}

// ---- 5. the cost of a bumpy road: acceleration and braking against v1.1 ---------------------------------------
{
  const t0 = timeTo100('ronin', 0, false), t1 = timeTo100('ronin', 1, true), t0r = timeTo100('ronin', 0, true);
  ok('performance: RONIN 0-100 within 4% of v1.1 on glass with the ride model on', Math.abs(t0r - t0) / t0 < 0.04, `v1.1 ${t0.toFixed(2)} s, roam on glass ${t0r.toFixed(2)} s`);
  ok('performance: the shipped road costs RONIN at most 12% in the 0-100', t1 >= t0 * 0.99 && t1 < t0 * 1.12, `bumpy ${t1.toFixed(2)} s`);
  const b0 = stop100('ronin', 0, false), b1 = stop100('ronin', 1, true);
  ok('braking: RONIN 100-0 on the shipped road is 0-20% longer than v1.1 on glass', b1 > b0 * 0.99 && b1 < b0 * 1.20, `v1.1 ${b0.toFixed(1)} m, roam ${b1.toFixed(1)} m`);
  out.perf = { ronin0to100: { v11: +t0.toFixed(2), glass: +t0r.toFixed(2), bumpy: +t1.toFixed(2) }, ronin100to0m: { v11: +b0.toFixed(1), bumpy: +b1.toFixed(1) } };
}

// ---- 6. brakes remember: repeated hard stops fade, a lap of rest recovers ---------------------------------------
{
  ROAM.on = true; ROAM.rough = 0;
  ok('brakes: pad friction curve (cold 0.88, window 1, fade to 0.55 at 800 C)', Math.abs(fadeOf(20) - 0.88) < 1e-9 && fadeOf(300) === 1 && Math.abs(fadeOf(800) - 0.55) < 1e-9, [20, 300, 600, 800].map(t => fadeOf(t).toFixed(2)).join(' / '));
  const w = start('ronin', { traction: 1 }); const car = w.car; const dist = [], fadeAfter = [], skin = [];
  for (let n = 0; n < 10; n++) {
    placeOnTrack(car, STRIP, w.P.x, w.P.z, w.head, false);      // back to the line, brake temperatures stay
    let phase = 0, d0 = 0;
    for (let i = 0; i < 120 * 40; i++) {
      const v = car.speed * 3.6, st = hold(car, w.head);
      if (phase === 0) { step(w.sim, [packInput({ throttle: 15, steer: st })]); if (v >= 160) phase = 1; }
      else { if (phase === 1) { phase = 2; d0 = car.distance; } step(w.sim, [packInput({ brake: 15, steer: st })]); if (v < 40) { dist.push(car.distance - d0); break; } }
    }
    fadeAfter.push(car.wheels[0].fade); skin.push(car.wheels[0].tS);
  }
  const first = dist[0], last = dist[dist.length - 1];
  ok('brakes: ten 160-40 km/h stops in a row: the last is at least 6% longer than the first, front fade below 0.9', last > first * 1.06 && fadeAfter[9] < 0.9, `stop 1 ${first.toFixed(1)} m, stop 10 ${last.toFixed(1)} m, front fade ${fadeAfter[0].toFixed(2)} -> ${fadeAfter[9].toFixed(2)}, front skin ${skin[0].toFixed(0)} -> ${skin[9].toFixed(0)} C`);
  // cruise 40 s: the skin cools back
  for (let i = 0; i < 120 * 90; i++) step(w.sim, [packInput({ throttle: car.speed < 20 ? 6 : 0, steer: hold(car, w.head) })]);
  ok('brakes: after 90 s of rolling at 20 m/s the front skin has cooled below 300 C', car.wheels[0].tS < 300, `${car.wheels[0].tS.toFixed(0)} C, bulk ${car.wheels[0].tB.toFixed(0)} C`);
  out.fade = { stops: dist.map(x => +x.toFixed(1)), frontFade: fadeAfter.map(x => +x.toFixed(2)), frontSkinC: skin.map(x => Math.round(x)) };
}

// ---- 7. hands off, the road does not throw the car off a straight in a few seconds ----------------------------------------
{
  ROAM.on = true; ROAM.rough = 1;
  const w = start('ronin', { traction: 1 }); const car = w.car; let latMax = 0;
  for (let i = 0; i < 120 * 6; i++) { step(w.sim, [packInput({ throttle: car.speed < 27 ? 15 : 3 })]); latMax = Math.max(latMax, Math.abs(car.lat)); }
  ok('hands off: RONIN holds a straight for 6 s within 3 m of the line', latMax < 3, `max ${latMax.toFixed(2)} m`);
}

console.log(JSON.stringify({ roam: fails ? 'fail' : 'pass', failed: fails, ...out }));
process.exit(fails ? 1 : 0);
