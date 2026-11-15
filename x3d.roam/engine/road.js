// loom:sim
// KANSEI ROAM: what the road is made of, as a pure function of where you are. No state, no Math.random,
// no Math.sin: the same wheel at the same spot meets the same bump on every lap, in every replay, on every machine.
// Heights are in metres and are ADDED to the smooth surface the v1.1 engine already follows.
// Features (asphalt): fine texture, long undulation, expansion joints with a lip, transverse cracks,
// potholes, washboard zones. Curb: a rumble strip. Runoff: grass, sand or gravel, rougher by its rolling resistance.
import { ihash, dexp, dsin, smooth } from './fmath.js';
import { ROAM } from './roam.js';

const U = h => h / 2147483647.5 - 1;           // [-1, 1]
const U01 = h => h / 4294967295;               // [0, 1]
const fl = x => Math.floor(x);
function n1(x, seed) { const k = fl(x), f = x - k, t = f * f * (3 - 2 * f), a = U(ihash(k, seed)); return a + (U(ihash(k + 1, seed)) - a) * t; }
function n2(x, z, seed, lam) {
  x /= lam; z /= lam;
  const i = fl(x), j = fl(z), fx = x - i, fz = z - j, tx = fx * fx * (3 - 2 * fx), tz = fz * fz * (3 - 2 * fz);
  const h = (a, b) => U(ihash(ihash(a, seed), b));
  const p = h(i, j), q = h(i + 1, j), r = h(i, j + 1), s = h(i + 1, j + 1);
  return (p + (q - p) * tx) * (1 - tz) + (r + (s - r) * tx) * tz;
}
const g = (d, w) => dexp(-(d * d) / (w * w));

export const FEATURES = { joint: 24.7, crack: 7.3, pothole: 52, wash: 190 };

/** Height of the road surface (m) at arc length s, lateral offset lat, world (x, z); code 0 asphalt, 1 curb, 2 runoff. */
export function roadHeight(T, s, lat, x, z, code, hw) {
  const L = T.L; s -= L * fl(s / L);
  let h = 0;
  if (code === 2) {
    const k = 0.55 + 6 * T.runoffRoll;
    h = k * (0.035 * n2(x, z, 11, 3.2) + 0.022 * n2(x, z, 12, 1.1) + 0.012 * n2(x, z, 13, 0.4));
    if (T.runoffRoll > 0.1) h += 0.010 * n2(x, z, 14, 0.25);
    return h * ROAM.rough;
  }
  if (code === 1) return ROAM.rough * (0.014 * dsin(17.95 * s) + 0.004 * n2(x, z, 15, 0.6));
  h = 0.0025 * n2(x, z, 1, 0.45) + 0.008 * n1(s / 6.5 + lat * 0.08, 2) + 0.007 * n1(s / 23 + lat * 0.03, 3);
  // expansion joints: a lip (each joint has its own step height) and a narrow dip
  {
    const k = fl(s / FEATURES.joint), j0 = k * FEATURES.joint + 3.1, st = 0.005 * U(ihash(k, 4)), sp = 0.005 * U(ihash(k - 1, 4));
    h += sp + (st - sp) * smooth(j0 - 0.06, j0 + 0.06, s);
    const d = s - j0; h -= 0.006 * g(d - 0.07, 0.035);
  }
  // transverse cracks, one in about every other 7.3 m cell
  {
    const k = fl(s / FEATURES.crack);
    if (U01(ihash(k, 5)) < 0.55) { const c0 = k * FEATURES.crack + 0.5 + 6.3 * U01(ihash(k, 6)); h += (U(ihash(k, 7)) < 0 ? -1 : 1) * (0.004 + 0.007 * U01(ihash(k, 8))) * g(s - c0, 0.045); }
  }
  // potholes: 52 m cells, 38% hold one, 60% of them in the racing-line half of the road
  {
    const k = fl(s / FEATURES.pothole);
    if (U01(ihash(k, 9)) < 0.38) {
      const s0 = k * FEATURES.pothole + 6 + 40 * U01(ihash(k, 10)), u = U(ihash(k, 11));
      const l0 = (U01(ihash(k, 12)) < 0.6 ? 0.45 : 0.85) * hw * u;
      const rs = 0.28 + 0.14 * U01(ihash(k, 13)), rl = 0.34, dd = 0.03 + 0.045 * U01(ihash(k, 14));
      const a = (s - s0) / rs, b = (lat - l0) / rl, r2 = a * a + b * b;
      if (r2 < 1) h -= dd * (1 - r2) * (1 - r2);
    }
  }
  // washboard zones: 190 m cells, 22% hold a 36 m corrugated stretch
  {
    const k = fl(s / FEATURES.wash);
    if (U01(ihash(k, 15)) < 0.22) {
      const w0 = k * FEATURES.wash + 20 + 100 * U01(ihash(k, 16)), win = smooth(w0, w0 + 4, s) * (1 - smooth(w0 + 32, w0 + 36, s));
      h += win * 0.006 * dsin(7.853981633974483 * s);
    }
  }
  return h * ROAM.rough;
}

/** Tyre-footprint average: three samples 0.1 m apart along the road (a 0.30 m radius tyre does not feel a 5 cm crack at full depth). */
export function footHeight(T, s, lat, x, z, code, hw) {
  return 0.25 * roadHeight(T, s - 0.1, lat, x, z, code, hw) + 0.5 * roadHeight(T, s, lat, x, z, code, hw) + 0.25 * roadHeight(T, s + 0.1, lat, x, z, code, hw);
}
