// loom:sim
// KANSEI ROAM: brakes with a memory. Per wheel a two-node rotor (a thin skin that takes the heat, a bulk that holds it),
// pad friction that fades when the skin is hot and is a little low when cold, hydraulic pressure that follows the pedal
// with a lag, ABS reported to the haptics. Numbers are game-tuned (a 150 to 60 km/h stop heats the front skin by about 150 K);
// the shape (fade after repeated hard stops, recovery on the straight) is the point.
import { smooth, dexp } from './fmath.js';

const T_AMB = 25;
const CS = 1100, CB_F = 5200, CB_R = 3600, KSB = 65;       // J/K skin, J/K bulk (front, rear), skin-bulk coupling W/K

export function brakeEnsure(W) { if (W.tS === undefined) { W.tS = 60; W.tB = 60; W.pr = 0; W.fade = 1; W.abs = 0; } }

/** Pad friction multiplier from the skin temperature (1 in the window, falling to 0.55 at 800 C, 0.88 when cold). */
export function fadeOf(Ts) { return (0.88 + 0.12 * smooth(20, 160, Ts)) * (1 - 0.45 * smooth(450, 800, Ts)); }

/** Pressure (0..1) following the pedal: faster apply than release. */
export function pressure(car, pedal, dt) {
  let p = car.pr === undefined ? 0 : car.pr;
  const k = pedal > p ? 1 - dexp(-dt / 0.045) : 1 - dexp(-dt / 0.07);
  p += (pedal - p) * k; car.pr = p; return p;
}

/** Heat the rotor with the pad power of this tick and cool it; W.tPad is the pad torque (N m) of the tick, w the wheel speed. */
export function brakeHeat(car, W, dt, speed) {
  brakeEnsure(W);
  const q = Math.abs(W.tPad || 0) * Math.abs(W.omega);
  const cb = W.front ? CB_F : CB_R;
  const flow = KSB * (W.tS - W.tB);
  W.tS += (q - flow) / CS * dt;
  const cool = (12 + 1.6 * speed) * (W.tB - T_AMB);
  W.tB += (flow - cool) / cb * dt;
  if (W.tS > 1100) W.tS = 1100;
  W.fade = fadeOf(W.tS);
}
