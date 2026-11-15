// loom:sim
// KANSEI ROAM: the ride. A seven-degree-of-freedom model under the v1.1 planar car: sprung body heave, pitch and roll,
// and four unsprung wheels on tyre springs, driven by the road of road.js. Fixed 1/480 s sub-steps (four per tick),
// semi-implicit Euler, no transcendental calls beyond fmath's own: deterministic like the rest of the sim.
//
// Coordinates are DEVIATIONS from static equilibrium (gravity is carried by the spring preload), heights in metres, up positive:
//   body corner i: zb = z + th * pz + ph * px      (th nose-up positive, ph left-up positive; pz forward, px left)
//   spring compression x = zu - zb                 (wheel up relative to body)
//   spring force F = ks x + bump stop + damper (bump c_b, rebound c_r)  -> up on the body, down on the wheel
//   tyre force dF = kt (zr - zu) + ct (zrd - vu), floored at "wheel fully unloaded"
// What the v1.1 sim sees back: dFz[i] (added to the wheel loads), x[i] (wheel travel for the visuals), z, th, ph (body pose),
// fx (longitudinal force from climbing bumps: the tyre normal tilts on a slope), and the haptic numbers.
import { clamp, dexp } from './fmath.js';
import { footHeight } from './road.js';
import { ROAM } from './roam.js';

const NSUB = 4;
const TWO_PI = 6.283185307179586;
const sq = Math.sqrt;      // IEEE square root is correctly rounded, so it is deterministic

export function rideCreate(car) {
  const P = car.P, sp = P.spec, m = P.m, mu = 0.032 * m, ms = m - 4 * mu;
  const kF = 1.65 * TWO_PI, kR = 1.90 * TWO_PI;                        // ride frequencies (rad/s), the rear a touch higher: a flat ride
  const mcF = ms * (P.b / P.L) / 2, mcR = ms * (P.a / P.L) / 2;       // sprung mass at each front / rear corner (weight fraction on the axle)
  const ksF = mcF * kF * kF, ksR = mcR * kR * kR;
  const ccF = 2 * sq(ksF * mcF), ccR = 2 * sq(ksR * mcR);
  return {
    mu, ms, kt: 210000 * sq(m / 1290), ct: 180,
    Iy: ms * P.a * P.b, Ix: ms * 0.58 * 0.58,
    ks: [ksF, ksF, ksR, ksR], cb: [0.26 * ccF, 0.26 * ccF, 0.26 * ccR, 0.26 * ccR], cr: [0.55 * ccF, 0.55 * ccF, 0.55 * ccR, 0.55 * ccR],
    xs: 0.085,                                                           // free travel before the bump stop or the droop strap
    z: 0, vz: 0, th: 0, wth: 0, ph: 0, wph: 0,
    zu: [0, 0, 0, 0], vu: [0, 0, 0, 0], zr: [0, 0, 0, 0], x: [0, 0, 0, 0], hub: [0, 0, 0, 0], dFz: [0, 0, 0, 0], init: false,
    fx: 0, az: 0, rumble: 0, jolt: 0, hit: 0, lift: 0, tw: 0, twLp: 0,
  };
}

/** Advance the ride by one sim tick. Ld = the quasi-static wheel loads (N) of this tick; they set how far a tyre can unload. */
export function rideStep(car, T, env, Ld, Gr) {
  const R = car.ride || (car.ride = rideCreate(car)), P = car.P, W = car.wheels, dt = env.dt, h = dt / NSUB;
  const ct = T.tx[car.seg < 0 ? 0 : car.seg], st = T.tz[car.seg < 0 ? 0 : car.seg];
  const vx = car.vx, vz = car.vz, dsdt = vx * ct + vz * st, u = car.forwardSpeed;
  const hw = car.hw > 1 ? car.hw : 1;
  const roadAt = (i, tau) => {
    const w = W[i];
    return footHeight(T, w.s + dsdt * tau, w.lat, w.wx + vx * tau, w.wz + vz * tau, w.surf, hw);
  };
  if (!R.init) {
    let sum = 0;
    for (let i = 0; i < 4; i++) { R.zr[i] = roadAt(i, 0); sum += R.zr[i]; }
    const yf = 0.5 * (R.zr[0] + R.zr[1]), yr = 0.5 * (R.zr[2] + R.zr[3]), yl = 0.5 * (R.zr[0] + R.zr[2]), yrr = 0.5 * (R.zr[1] + R.zr[3]);
    R.z = sum / 4; R.th = (yf - yr) / P.L; R.ph = (yl - yrr) / (0.5 * ((W[0].px - W[1].px) + (W[2].px - W[3].px)));
    for (let i = 0; i < 4; i++) R.zu[i] = R.zr[i];
    R.init = true;
  }
  // torque reactions on the body: the crank torque rolls the body (net reaction about the long axis is the crank torque), and
  // the part of the wheel torque that changes faster than 4 Hz kicks the nose (a gear change, a clutch dump, a snap off the throttle)
  const tw = car.driveTorque, crank = Gr > 0 ? tw / Gr : 0;
  R.twLp += (tw - R.twLp) * (1 - dexp(-dt * 25));
  const kick = tw - R.twLp;
  const Mr = -crank * 0.35;                             // N m about the long axis (sign: a convention, crank turning clockwise seen from behind)
  const Mp = -kick * 0.10;                              // N m about the lateral axis (nose-up positive): a torque step kicks the body; the 0.10 is tuned by feel, not measured
  const wasLift = R.lift;
  let fxSum = 0, azSum = 0, jolt = 0; const dsum = R.dFz;
  dsum[0] = dsum[1] = dsum[2] = dsum[3] = 0;
  let lifted = 0;
  for (let k = 0; k < NSUB; k++) {
    const tau = (k + 1) * h;
    let F0 = 0, F1 = 0, F2 = 0, F3 = 0, Fz = 0, Mth = 0, Mph = 0;
    for (let i = 0; i < 4; i++) {
      const w = W[i];
      const zr = roadAt(i, tau), zrd = (zr - R.zr[i]) / h; R.zr[i] = zr;
      const zb = R.z + R.th * w.pz + R.ph * w.px, vb = R.vz + R.wth * w.pz + R.wph * w.px;
      const x = R.zu[i] - zb, xd = R.vu[i] - vb;
      // spring, bump stop beyond +-xs (6x stiffer, progressive), damper (stiffer on rebound)
      let F = R.ks[i] * x;
      if (x > R.xs) { const e = x - R.xs; F += 6 * R.ks[i] * e * (1 + 25 * e); }
      else if (x < -R.xs) { const e = -x - R.xs; F -= 6 * R.ks[i] * e * (1 + 25 * e); }
      F += (xd > 0 ? R.cb[i] : R.cr[i]) * xd;
      // tyre: spring + damper, floored where the wheel carries nothing
      let dF = R.kt * (zr - R.zu[i]) + R.ct * (zrd - R.vu[i]);
      const floor = -Ld[i];
      if (dF < floor) { dF = floor; lifted++; }
      R.vu[i] += (dF - F) / R.mu * h; R.zu[i] += R.vu[i] * h;
      R.x[i] = x;
      Fz += F; Mth += F * w.pz; Mph += F * w.px;
      dsum[i] += dF / NSUB;
      if (u > 1 || u < -1) { let sl = zrd / u; sl = sl > 0.6 ? 0.6 : sl < -0.6 ? -0.6 : sl; fxSum += -dF * sl / NSUB; }
      const aj = dF > 0 ? dF : -dF; if (aj > jolt) jolt = aj;
    }
    const az = Fz / R.ms; azSum += az;
    R.vz += az * h; R.z += R.vz * h;
    R.wth += (Mth + Mp) / R.Iy * h; R.th += R.wth * h;
    R.wph += (Mph + Mr) / R.Ix * h; R.ph += R.wph * h;
  }
  R.lift = lifted;
  R.fx = fxSum;
  R.az = azSum / NSUB;
  // haptics: the body's vertical shake (rms-ish, 80 ms) and the biggest tyre-force swing of the tick
  R.rumble += (clamp(Math.abs(R.az) / 4, 0, 1.5) - R.rumble) * (1 - dexp(-dt * 12));
  R.jolt = jolt / (P.Fz0 || 3000); if (R.jolt > 3) R.jolt = 3;
  for (let i = 0; i < 4; i++) R.hub[i] = clamp(R.zu[i] - R.z, -0.12, 0.12);   // where the wheel sits under the car's root node (the root carries the heave)
  return R;
}

/** Fold the ride into the hash (only when ROAM is on, so the v1.1 hashes are untouched with it off). */
export function rideState(car, mix) {
  if (!ROAM.on) return;
  const R = car.ride; if (!R) { mix(0); return; }
  mix(R.z); mix(R.vz); mix(R.th); mix(R.wth); mix(R.ph); mix(R.wph); mix(R.twLp);
  for (let i = 0; i < 4; i++) { mix(R.zu[i]); mix(R.vu[i]); mix(R.zr[i]); const w = car.wheels[i]; mix(w.tS || 0); mix(w.tB || 0); mix(w.pr || 0); }
}
