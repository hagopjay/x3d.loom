#!/usr/bin/env python3 -I
"""Stage KANSEI ROAM: copy the x3d.drift game, apply the roam patches (each an exact-once substitution: if x3d.drift changes under us the build stops), add the roam modules.

  python3 -I stage.py --game ../../x3d.drift --out STAGE_DIR

The patched engine keeps KANSEI v1.1 bit for bit when engine/roam.js has ROAM.on = false (tests/roam.test.mjs). Nothing in x3d.drift changes.
"""
import argparse, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def sub1(text, old, new, what):
    n = text.count(old)
    assert n == 1, ('patch "%s": expected exactly one match, found %d' % (what, n), old[:70])
    return text.replace(old, new)

def patch_car(t):
    t = sub1(t, "import { CARS, resolveTune } from './cars.js';\n",
             "import { CARS, resolveTune } from './cars.js';\nimport { ROAM } from './roam.js';\nimport { rideStep, rideState } from './susp.js';\nimport { brakeEnsure, brakeHeat, pressure } from './brakes.js';\n", 'imports')
    t = sub1(t, "car.boostPressure = 0; car.revTimer = 0; car.driveTorque = 0;\n",
             "car.boostPressure = 0; car.revTimer = 0; car.driveTorque = 0;\n  car.ride = null; car.pr = 0;      // roam: a placed car starts with a fresh ride model (brake temperatures stay)\n", 'placeOnTrack reset')
    t = sub1(t, "  car.y = 0.25 * (W[0].wy + W[1].wy + W[2].wy + W[3].wy);\n",
             "  car.y = 0.25 * (W[0].wy + W[1].wy + W[2].wy + W[3].wy);\n  if (ROAM.on && car.ride) car.y += car.ride.z;      // roam: the body heaves on its springs\n", 'finishPose heave')
    t = sub1(t, " Ld[3] = 0.5 * wr + 0.5 * dLong + dLatR;\n",
             " Ld[3] = 0.5 * wr + 0.5 * dLong + dLatR;\n  if (ROAM.on) { const R = rideStep(car, T, env, Ld, Gr); for (let i = 0; i < 4; i++) Ld[i] += R.dFz[i]; }   // roam: the road shakes the wheel loads\n", 'wheel loads')
    t = sub1(t, "  const bT = pedal * sp.brakeTorque, bias = tn.brakeBias;\n",
             "  const bT = (ROAM.on ? pressure(car, pedal, dt) : pedal) * sp.brakeTorque, bias = tn.brakeBias;\n", 'brake pressure')
    t = sub1(t, "    let t = bT * (W.front ? bias : 1 - bias) * 0.5;\n",
             "    let t = bT * (W.front ? bias : 1 - bias) * 0.5;\n    if (ROAM.on) { brakeEnsure(W); t *= W.fade; }      // roam: hot pads fade\n", 'brake fade')
    t = sub1(t, "    if (t > absCap && speed > 2) t = absCap;\n",
             "    W.abs = 0;\n    if (t > absCap && speed > 2) { t = absCap; W.abs = 1; }\n", 'abs flag')
    t = sub1(t, "    if (!W.front && hb) t += sp.handbrakeTorque;\n",
             "    W.tPad = t;\n    if (!W.front && hb) t += sp.handbrakeTorque;\n", 'pad torque')
    t = sub1(t, "    let fx = Ff - kd * u, fl2 = Fl - kd * wv;\n",
             "    let fx = Ff - kd * u + (ROAM.on && car.ride ? car.ride.fx : 0), fl2 = Fl - kd * wv;      // roam: climbing a bump slows the car\n", 'bump drag')
    t = sub1(t, "  car.bodyPitch = -sp.look.pitch * car.ax;\n",
             "  car.bodyPitch = -sp.look.pitch * car.ax;\n  if (ROAM.on && car.ride) { car.bodyRoll += car.ride.ph; car.bodyPitch -= car.ride.th; }      // roam: the ride adds its own pitch and roll\n", 'body pose')
    t = sub1(t, "    W.susp = clamp(sus, -0.09, 0.09);\n",
             "    W.susp = ROAM.on && car.ride ? car.ride.hub[i] : clamp(sus, -0.09, 0.09);\n    if (ROAM.on) brakeHeat(car, W, dt, car.speed);\n", 'wheel outputs')
    t = sub1(t, "  mix(car.cpCount); mix(car.finished ? 1 : 0); mix(car.finishTick);\n",
             "  mix(car.cpCount); mix(car.finished ? 1 : 0); mix(car.finishTick);\n  rideState(car, mix);\n", 'hash')
    return t

def patch_sim(t):
    t = sub1(t, "export const ENGINE_VERSION = 'kansei-engine/4';\n", "export const ENGINE_VERSION = ROAM.on ? 'kansei-roam/1' : 'kansei-engine/4';\n", 'engine version')
    t = sub1(t, "import { CAR_IDS, CARS, resolveTune, DRIFT_SETUPS } from './cars.js';\n", "import { CAR_IDS, CARS, resolveTune, DRIFT_SETUPS } from './cars.js';\nimport { ROAM } from './roam.js';\n", 'sim import')
    return t

def patch_render(t):
    t = sub1(t, "        const h = Math.max(-0.03, Math.min(0.03, (s - w.bump) * 0.9));\n",
             "        const h = car.ride ? Math.max(-0.12, Math.min(0.12, s)) : Math.max(-0.03, Math.min(0.03, (s - w.bump) * 0.9));   // roam: the sim's own wheel travel\n", 'hub travel')
    return t

def patch_camera(t):
    return t


ROAM_JS = r"""
// ---- roam: the ride on the telemetry panel and in the controller ------------------------------
function roamRows(car) {
  const R = car.ride; if (!R) return '';
  return `<table style="margin-top:6px"><tr><td class="k">ride</td><td>heave ${(R.z * 1000).toFixed(0)} mm</td><td>pitch ${(R.th * 57.3).toFixed(2)}°</td><td>roll ${(R.ph * 57.3).toFixed(2)}°</td><td>shake ${R.rumble.toFixed(2)}</td><td>jolt ${R.jolt.toFixed(2)}</td></tr>
    <tr><td class="k">rotor</td>${car.wheels.map(w => `<td>${Math.round(w.tS || 0)}° ×${(w.fade || 1).toFixed(2)}${w.abs ? ' ABS' : ''}</td>`).join('')}</tr></table>`;
}
let roamHapT = 0;
function roamHaptics(car, dtWall) {
  const R = car.ride; if (!R) return;
  roamHapT += dtWall; if (roamHapT < 0.06) return; roamHapT = 0;
  const kerb = car.wheels.some(w => w.surf === 1), abs = car.wheels.some(w => w.abs);
  const strong = clamp(R.jolt * 0.25 + (abs ? 0.35 : 0), 0, 1), weak = clamp(R.rumble * 0.9 + (kerb ? 0.3 : 0), 0, 1);
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.vibrationActuator && p.vibrationActuator.playEffect) {
    try { p.vibrationActuator.playEffect('dual-rumble', { duration: 80, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak }); } catch { /* optional */ }
  }
}
"""

def patch_main(t):
    t = sub1(t, "localStorage.getItem('kansei.v1.' + k)", "localStorage.getItem('kansei.roam1.' + k)", 'storage get')
    t = sub1(t, "localStorage.setItem('kansei.v1.' + k, JSON.stringify(v))", "localStorage.setItem('kansei.roam1.' + k, JSON.stringify(v))", 'storage set')
    t = sub1(t, "function telemetryFrame(sess, ms) {\n", ROAM_JS + "function telemetryFrame(sess, ms) {\n", 'roam helpers')
    t = sub1(t, "    <div style=\"display:flex;gap:12px;align-items:center\"><div class=\"g\">", "    ${roamRows(car)}\n    <div style=\"display:flex;gap:12px;align-items:center\"><div class=\"g\">", 'telemetry rows')
    t = sub1(t, "{ rumble: car.wheels.some(w => w.surf === 1) ? clamp(car.speed / 30, 0, 1) : 0 });\n    sess.world.camera(view);\n",
             "{ rumble: Math.max(car.wheels.some(w => w.surf === 1) ? clamp(car.speed / 30, 0, 1) : 0, car.ride ? clamp(car.ride.rumble * 4, 0, 4) : 0) });\n    sess.world.camera(view);\n    if (!sess.paused && !sess.photo && S.screen === 'play') roamHaptics(car, dtWall);\n", 'camera rumble and haptics')
    t = sub1(t, "const TIPS = [\n", "const TIPS = [\n  'ROAM: the road is real. Joints, cracks, potholes and washboard unload a wheel for a moment: brake before the bump, not on it.',\n  'ROAM: brakes remember. Five hard stops in a row and the pads fade; F2 shows each rotor and its grip.',\n", 'tips')
    return t

PATCHES = {'main.js': patch_main, 'engine/car.js': patch_car, 'engine/sim.js': patch_sim, 'engine/render.js': patch_render}
NEW = ['roam.js', 'road.js', 'susp.js', 'brakes.js']

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--game', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    game, out = os.path.abspath(a.game), os.path.abspath(a.out)
    if os.path.exists(out): shutil.rmtree(out)
    shutil.copytree(game, out, symlinks=True, ignore=shutil.ignore_patterns('node_modules', '.git'))
    for rel, fn in PATCHES.items():
        p = os.path.join(out, rel)
        t = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8').write(fn(t))
    for n in NEW: shutil.copy(os.path.join(ROOT, 'engine', n), os.path.join(out, 'engine', n))
    for rel in ('tests/roam.test.mjs', 'tools/feel.mjs'):
        os.makedirs(os.path.dirname(os.path.join(out, rel)), exist_ok=True); shutil.copy(os.path.join(ROOT, rel), os.path.join(out, rel))
    shutil.rmtree(os.path.join(out, 'tapes')); os.makedirs(os.path.join(out, 'tapes'))      # v1.1 tapes carry engine kansei-engine/4: they would not replay here
    print('staged', out)

main()
