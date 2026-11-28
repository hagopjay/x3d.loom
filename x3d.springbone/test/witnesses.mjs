// Witnesses for springbone-core.js: each one is a closed-form or brute-force answer the solver must meet, with a
// planted control that must miss it. `node test/witnesses.mjs` prints the table and writes results/witnesses.json;
// `node --test test/witnesses.test.mjs` runs the same checks as tests.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const S = require('../src/springbone-core.js');
const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------------------------- helpers
const I = [0, 0, 0, 1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
// a hanging chain of n joints spaced `seg` along -Y, as Transforms with translation offsets
function hanging(n, seg, extra = {}) {
  const joints = [], pose = [];
  for (let i = 0; i < n; i++) { joints.push({ name: 'j' + i, parent: i - 1 }); pose.push({ translation: i === 0 ? [0, 0, 0] : [0, -seg, 0], rotation: I }); }
  return { trees: [{ joints }], pose, ...extra };
}
function run(desc, params, frames, dtOf, parentOf, opts = {}) {
  const ch = new S.SpringChain(desc.trees, params);
  const rec = [];
  let t = 0;
  for (let f = 0; f < frames; f++) {
    const dt = f === 0 ? 0 : dtOf(f);
    t = f === 0 ? 0 : t + dt;
    const parentWorld = parentOf ? parentOf(t, f) : S.IDENTITY;
    const out = ch.frame({ dt, time: t, trees: [{ parentWorld, pose: desc.pose }], colliders: opts.colliders || [] });
    if (f === 0 && opts.kick) opts.kick(ch);
    rec.push({ t, f, out, steps: ch.steps });
  }
  return { ch, rec };
}
const translate = (v) => ({ L: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: v });
// closed form of y[n+1] = S y[n] - P y[n-1] with y[-1] = y[0] = y0 (complex roots)
function closedForm(Ssum, Pprod, y0, n) {
  const r = Math.sqrt(Pprod), th = Math.acos(Ssum / (2 * r));
  const C = y0, D = (C * Math.cos(th) - r * y0) / Math.sin(th);
  return Math.pow(r, n) * (C * Math.cos(n * th) + D * Math.sin(n * th));
}
// complete elliptic integral of the first kind by the arithmetic-geometric mean
function ellipK(k) { let a = 1, b = Math.sqrt(1 - k * k); for (let i = 0; i < 40; i++) { const an = (a + b) / 2; b = Math.sqrt(a * b); a = an; } return Math.PI / (2 * a); }
function crossings(series) {        // upward zero crossings of [t, x] by linear interpolation
  const out = [];
  for (let i = 1; i < series.length; i++) { const [t0, x0] = series[i - 1], [t1, x1] = series[i]; if (x0 < 0 && x1 >= 0) out.push(t0 + (t1 - t0) * (-x0) / (x1 - x0)); }
  return out;
}

// ---------------------------------------------------------------------------------------------- witnesses
const W = [];
function witness(id, claim, source, fn, control) { W.push({ id, claim, source, fn, control }); }

// W1: small motion of one particle equals the closed-form recurrence (both spring models), stretch 1 = linear
for (const model of ['POSITION', 'FORCE']) {
  witness(`W1-${model}`, `One stretchy particle, ${model} model, d=0.1 e=0.1: the solver's path equals the closed-form two-term recurrence for 600 steps`,
    'closed form y[n] = r^n (C cos n th + D sin n th) from SPEC.md section 4', (faults) => {
      const d = 0.1, e = 0.1, y0 = 0.1;
      const desc = hanging(2, 0.5);
      const P = { damping: d, elasticity: e, stiffness: 0, stretch: 1, springModel: model, faults };
      const { rec } = run(desc, P, 601, () => 1 / 60, null, { kick: (ch) => { const p = ch.trees[0].parts[1]; p.pos[0] += y0; p.prev[0] += y0; } });
      const Ssum = model === 'FORCE' ? 2 - d - e : (1 - e) * (2 - d), Pp = model === 'FORCE' ? 1 - d : (1 - e) * (1 - d);
      let err = 0;
      for (let n = 1; n <= 600; n++) err = Math.max(err, Math.abs(rec[n].out.trees[0].positions[1][0] - closedForm(Ssum, Pp, y0, n)));
      return { value: err, limit: 1e-12, pass: err <= 1e-12, unit: 'm, max |sim - closed form|' };
    }, { dampingSquared: true });
}

// W2: physical tuning: (frequency, damping ratio) -> (d, e) makes the samples equal the continuous oscillator
witness('W2', 'FORCE model tuned to 2 Hz, damping ratio 0.1 at 60 Hz: samples equal the continuous damped oscillator through the same two starting samples, 10 s',
  'x(t) = e^{-zeta w t}(C cos wd t + D sin wd t), wd = w sqrt(1-zeta^2)', (faults) => {
    const f = 2, z = 0.1, rate = 60, h = 1 / rate, y0 = 0.05;
    const tune = S.tuningFromPhysical(f, z, faults && faults.wrongRate ? 50 : rate, 'FORCE');
    const desc = hanging(2, 0.5);
    const P = { damping: tune.damping, elasticity: tune.elasticity, stiffness: 0, stretch: 1, springModel: 'FORCE', updateRate: rate };
    const { rec } = run(desc, P, 601, () => h, null, { kick: (ch) => { const p = ch.trees[0].parts[1]; p.pos[0] += y0; p.prev[0] += y0; } });
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z), sg = -z * w;
    const C = y0, D = (C * Math.cos(wd * h) - y0 * Math.exp(sg * h)) / Math.sin(wd * h);
    let err = 0; const series = [];
    for (let n = 1; n <= 600; n++) {
      const x = rec[n].out.trees[0].positions[1][0];
      err = Math.max(err, Math.abs(x - Math.exp(sg * n * h) * (C * Math.cos(wd * n * h) + D * Math.sin(wd * n * h))));
      series.push([n * h, x]);
    }
    const cr = crossings(series), period = (cr[cr.length - 1] - cr[0]) / (cr.length - 1), want = 1 / (f * Math.sqrt(1 - z * z));
    return { value: err, limit: 1e-12, pass: err <= 1e-12, unit: 'm, max |sim - oscillator|', extra: { measuredPeriod: period, analyticPeriod: want, periodRelErr: Math.abs(period - want) / want, damping: tune.damping, elasticity: tune.elasticity } };
  }, { wrongRate: true });

// W2b: the POSITION model (the asset's) cannot reach low damping ratios: its floor at 2 Hz and 60 Hz
witness('W2b', 'POSITION model has a damping-ratio floor: 2 Hz at 60 Hz cannot go below the d=0 ratio; asking for 0.1 is reported infeasible',
  'S - P = 1 - e, 1 - d = P/(S - P) (SPEC.md section 4)', (faults) => {
    const ask = S.tuningFromPhysical(2, 0.1, 60, 'POSITION');
    // the floor: bisection on zeta for d = 0
    let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (S.tuningFromPhysical(2, m, 60, 'POSITION').damping < 0) lo = m; else hi = m; }
    const ok = ask.feasible === false;
    return { value: hi, limit: 0.1, pass: ok && hi > 0.1, unit: 'lowest reachable damping ratio at 2 Hz, 60 Hz', extra: { askedDamping: ask.damping, askedElasticity: ask.elasticity } };
  }, null);

// W3: rigid pendulum under gravity in m/s^2: the period converges to the exact large-amplitude period
function pendulumPeriod(rate, faults, seconds = 6) {
  const L = 0.5, g = 9.81, th0 = 30 * Math.PI / 180;
  const desc = hanging(2, L);
  const P = { damping: 0, elasticity: 0, stiffness: 0, gravity: [0, -g, 0], forceUnits: 'M_PER_S2', gravityRestCompensation: false, updateRate: rate, faults };
  const { rec } = run(desc, P, rate * seconds + 1, () => 1 / rate, null, { kick: (ch) => { const p = ch.trees[0].parts[1]; p.pos = [L * Math.sin(th0), -L * Math.cos(th0), 0]; p.prev = p.pos.slice(); } });
  const series = rec.slice(1).map((r) => [r.t, r.out.trees[0].positions[1][0]]);
  const cr = crossings(series);
  const amp = Math.max(...series.slice(-rate * 2).map((x) => Math.abs(x[1])));
  return { T: cr.length > 1 ? (cr[cr.length - 1] - cr[0]) / (cr.length - 1) : Infinity, ampEnd: amp, amp0: L * Math.sin(th0) };
}
witness('W3', 'Rigid 0.5 m pendulum, 30 deg, g = 9.81 m/s^2, no damping: period converges at first order to 4 sqrt(L/g) K(sin 15 deg); Richardson from 960 and 1920 Hz within 1e-4',
  'complete elliptic integral K by AGM', (faults) => {
    const want = 4 * Math.sqrt(0.5 / 9.81) * ellipK(Math.sin(15 * Math.PI / 180));
    const rates = [240, 480, 960, 1920], Ts = rates.map((r) => pendulumPeriod(r, faults).T);
    const errs = Ts.map((T) => Math.abs(T - want) / want);
    const order = Math.log2(errs[2] / errs[3]);
    const rich = 2 * Ts[3] - Ts[2], rel = Math.abs(rich - want) / want;
    return { value: rel, limit: 1e-4, pass: rel <= 1e-4 && order > 0.8 && order < 1.2, unit: 'relative error of the extrapolated period',
      extra: { exact: want, periods: Object.fromEntries(rates.map((r, i) => [r + ' Hz', Ts[i]])), relErrors: Object.fromEntries(rates.map((r, i) => [r + ' Hz', errs[i]])), observedOrder: order } };
  }, { gravityPerSecond: true });

// W3b: report: the rigid-length projection is itself dissipative (amplitude kept after 6 s with damping 0)
witness('W3b', 'Numerical damping of rigid bones: share of a 30 deg swing left after 6 s with damping = 0, at 60 and 240 Hz',
  'same pendulum as W3; reported, not a pass mark', () => {
    const a = pendulumPeriod(60, null), b = pendulumPeriod(240, null);
    return { value: a.ampEnd / a.amp0, limit: null, pass: true, unit: 'amplitude ratio at 60 Hz (240 Hz in extra)', extra: { at240: b.ampEnd / b.amp0 } };
  }, null);

// W4: FIXED steps do not depend on the display rate (60/120/240 fps give the same state at the same instants)
function swayRun(mode, fps, seconds, faults) {
  const desc = hanging(5, 0.12);
  const P = { timeMode: mode, updateRate: 60, damping: 0.1, elasticity: 0.08, stiffness: 0.1, gravity: [0, -0.002, 0], faults };
  const frames = Math.round(fps * seconds) + 1;
  const out = [];
  const ch = new S.SpringChain(desc.trees, P);
  for (let f = 0; f < frames; f++) {
    const t = f / fps, dt = f === 0 ? 0 : 1 / fps;
    const o = ch.frame({ dt, time: t, trees: [{ parentWorld: translate([0.2 * Math.sin(2 * Math.PI * 0.7 * t), 0, 0]), pose: desc.pose }] });
    out.push({ t, tip: o.trees[0].positions[4] });
  }
  return out;
}
witness('W4', 'FIXED mode at updateRate 60: the tip at t = 1, 2, 3 s is identical whether the page draws at 60, 120 or 240 fps',
  'equality of the solver state at shared instants (bitwise)', (faults) => {
    const mode = faults && faults.variable ? 'VARIABLE' : 'FIXED';
    const a = swayRun(mode, 60, 3), b = swayRun(mode, 120, 3), c = swayRun(mode, 240, 3);
    let dmax = 0;
    for (const s of [1, 2, 3]) {
      const ta = a[s * 60].tip, tb = b[s * 120].tip, tc = c[s * 240].tip;
      dmax = Math.max(dmax, len(sub(ta, tb)), len(sub(ta, tc)));
    }
    return { value: dmax, limit: 0, pass: dmax === 0, unit: 'm, largest tip difference across display rates' };
  }, { variable: true });

// W4b: information: the asset's default (VARIABLE) mode, 30 vs 240 fps
witness('W4b', 'VARIABLE mode (the asset default, one step per frame scaled by dt): tip disagreement between 30 and 240 fps at t = 2 s',
  'same scene as W4; reported, not a pass mark', () => {
    const a = swayRun('VARIABLE', 30, 2), b = swayRun('VARIABLE', 240, 2);
    const d = len(sub(a[60].tip, b[480].tip));
    const fa = swayRun('FIXED', 30, 2), fb = swayRun('FIXED', 240, 2);
    const df = len(sub(fa[60].tip, fb[480].tip));
    return { value: d, limit: null, pass: d > 1e-3, unit: 'm (VARIABLE); FIXED for comparison in extra', extra: { fixedSameScene: df } };
  }, null);

// W5: inert = 1 carries the chain rigidly with the reference
witness('W5', 'inert = 1, reference moving at 1 m/s: every particle keeps its rest offset from the root to 1e-12 m over 2 s',
  'rigid carry: x[n] - root[n] constant', (faults) => {
    const desc = hanging(4, 0.2);
    const P = { inert: faults ? 0 : 1, damping: 0.1, elasticity: 0.1, stiffness: 0.1 };
    const ch = new S.SpringChain(desc.trees, P);
    let worst = 0;
    for (let f = 0; f <= 120; f++) {
      const t = f / 60, pw = translate([t * 1.0, 0, 0]);
      const o = ch.frame({ dt: f ? 1 / 60 : 0, time: t, reference: pw, trees: [{ parentWorld: pw, pose: desc.pose }] });
      const ps = o.trees[0].positions;
      for (let i = 1; i < ps.length; i++) worst = Math.max(worst, len(sub(sub(ps[i], ps[0]), [0, -0.2 * i, 0])));
    }
    return { value: worst, limit: 1e-12, pass: worst <= 1e-12, unit: 'm, worst offset drift' };
  }, { inertZero: true });

// W6: colliders: projections land on the surface; the round cone is exact against brute force
witness('W6', 'Round-cone (tapered capsule) push-out: 2,000 random points end exactly on the surface, checked by brute force over 20,001 swept spheres',
  'distance to a round cone = min over t of |p - c(t)| - r(t), sampled', (faults) => {
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const c = S.prepareCollider({ shape: 'CAPSULE', center: [0, 0, 0], radius: 0.3, radius2: 0.08, height: 1.2, direction: 'Y' });
    const naive = (p) => { // the tempting shortcut: nearest axis point, radius interpolated there
      const ab = sub(c.b, c.a), L = len(ab), u = ab.map((x) => x / L); let t = (p[0] - c.a[0]) * u[0] + (p[1] - c.a[1]) * u[1] + (p[2] - c.a[2]) * u[2];
      t = Math.max(0, Math.min(L, t)); const q = [c.a[0] + u[0] * t, c.a[1] + u[1] * t, c.a[2] + u[2] * t], R = c.r0 + (c.r1 - c.r0) * t / L;
      const d = sub(p, q), l = len(d); return l < R ? [q[0] + d[0] / l * R, q[1] + d[1] / l * R, q[2] + d[2] / l * R] : p;
    };
    const dist = (p) => { let m = Infinity; const ab = sub(c.b, c.a); for (let i = 0; i <= 20000; i++) { const s = i / 20000, q = [c.a[0] + ab[0] * s, c.a[1] + ab[1] * s, c.a[2] + ab[2] * s], r = c.r0 + (c.r1 - c.r0) * s; m = Math.min(m, len(sub(p, q)) - r); } return m; };
    let worst = 0, n = 0;
    for (let k = 0; k < 2000; k++) {
      const p = [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.7];
      const out = faults ? naive(p) : S.collide(c, p, 0)[0];
      if (out === p) continue;
      n++; worst = Math.max(worst, Math.abs(dist(out)));
    }
    return { value: worst, limit: 1e-6, pass: worst <= 1e-6, unit: `m, worst |distance to surface| over ${n} pushed points (brute-force step 6e-5 m)` };
  }, { naiveCone: true });

// W7: stiffness = 1 pins the chain to its animated pose under gravity
witness('W7', 'stiffness = 1 under strong gravity: the tip never leaves its animated place (1e-12 m) over 2 s',
  'max-distance clamp with zero allowance', (faults) => {
    const desc = hanging(4, 0.2);
    desc.pose = desc.pose.map((p, i) => (i ? { translation: [0.2, 0, 0], rotation: I } : p));  // horizontal chain
    const P = { stiffness: faults ? 0.9 : 1, elasticity: 0, damping: 0.1, gravity: [0, -0.01, 0], gravityRestCompensation: false };
    const { rec } = run(desc, P, 121, () => 1 / 60, null);
    let worst = 0; rec.forEach((r) => { worst = Math.max(worst, len(sub(r.out.trees[0].positions[3], [0.6, 0, 0]))); });
    return { value: worst, limit: 1e-12, pass: worst <= 1e-12, unit: 'm' };
  }, { looser: true });

// W8: angle limit holds at every frame
witness('W8', 'angleLimit 20 deg under a strong side force: no bone swings more than 20 deg from its animated direction',
  'angle between rest and simulated bone directions', (faults) => {
    const desc = hanging(4, 0.2);
    const P = { angleLimit: faults ? 0 : 20, elasticity: 0.02, damping: 0.05, stiffness: 0, force: [0.01, 0, 0] };
    const { rec } = run(desc, P, 181, () => 1 / 60, null);
    let worst = 0;
    rec.forEach((r) => { const ps = r.out.trees[0].positions; for (let i = 1; i < ps.length; i++) { const v = sub(ps[i], ps[i - 1]); worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, -v[1] / len(v)))) * 180 / Math.PI); } });
    return { value: worst, limit: 20 + 1e-6, pass: worst <= 20 + 1e-6, unit: 'deg, worst swing (each joint vs animated -Y; parents here stay near -Y)' };
  }, { noLimit: true });

// W9: determinism: the same dt sequence gives the same state hash; one changed dt changes it
witness('W9', 'Replay: 600 frames of jittered dt replayed give the same FNV state hash; the control changes one dt by 1 us',
  'FNV-1a over positions rounded to 1 nm', (faults) => {
    const make = (perturb) => {
      const desc = hanging(6, 0.1); let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const ch = new S.SpringChain(desc.trees, { timeMode: 'VARIABLE', gravity: [0, -0.003, 0], wind: [0.001, 0, 0], windTurbulence: 0.5 });
      let t = 0;
      for (let f = 0; f < 600; f++) { let dt = f ? (1 / 60) * (0.7 + 0.6 * rnd()) : 0; if (perturb && f === 300) dt += 1e-6; t += dt; ch.frame({ dt, time: t, trees: [{ parentWorld: translate([0.1 * Math.sin(t * 3), 0, 0]), pose: desc.pose }] }); }
      return ch.stateHash();
    };
    const a = make(false), b = make(!!faults);
    return { value: a === b ? 0 : 1, limit: 0, pass: a === b, unit: 'hash mismatches', extra: { hashA: a, hashB: b } };
  }, { perturb: true });

// W10: X3D Transform field rule (center, scaleOrientation) against the explicit matrix product
witness('W10', 'affineFromFields equals T(t) T(c) R SO S SO^-1 T(-c) built by 4x4 products, 500 random Transforms',
  'X3D 4.0 Part 1 clause 10.4.4 (Transform) matrix order', (faults) => {
    let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) - 0.5;
    const m4 = (L, t) => [L[0], L[1], L[2], t[0], L[3], L[4], L[5], t[1], L[6], L[7], L[8], t[2], 0, 0, 0, 1];
    const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[r * 4 + c] += A[r * 4 + k] * B[k * 4 + c]; return C; };
    const T = (v) => m4([1, 0, 0, 0, 1, 0, 0, 0, 1], v), Rq = (q) => m4(S.m3FromQuat(q), [0, 0, 0]);
    let worst = 0;
    for (let k = 0; k < 500; k++) {
      const f = { translation: [rnd(), rnd(), rnd()], center: [rnd(), rnd(), rnd()], rotation: S.qFromAxisAngle([rnd(), rnd(), rnd()], rnd() * 6), scale: [1 + rnd(), 1 + rnd(), 1 + rnd()], scaleOrientation: S.qFromAxisAngle([rnd(), rnd(), rnd()], rnd() * 6) };
      const so = f.scaleOrientation, soi = [-so[0], -so[1], -so[2], so[3]];
      const ref = [T(f.translation), T(f.center), Rq(f.rotation), Rq(so), m4([f.scale[0], 0, 0, 0, f.scale[1], 0, 0, 0, f.scale[2]], [0, 0, 0]), Rq(faults ? so : soi), T(f.center.map((x) => -x))].reduce(mm);
      const A = S.affineFromFields(f), got = m4(A.L, A.t);
      for (let i = 0; i < 12; i++) worst = Math.max(worst, Math.abs(got[i] - ref[i]));
    }
    return { value: worst, limit: 1e-12, pass: worst <= 1e-12, unit: 'max element difference' };
  }, { soNotInverted: true });

// ---------------------------------------------------------------------------------------------- run
export function runAll() {
  return W.map((w) => {
    const row = { id: w.id, claim: w.claim, source: w.source, ...w.fn(null) };
    if (w.control) { const c = w.fn(w.control); row.control = { planted: Object.keys(w.control).join(','), value: c.value, failedAsItMust: !c.pass }; }
    return row;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = runAll();
  for (const r of rows) {
    const c = r.control ? `control ${r.control.planted}: ${r.control.failedAsItMust ? 'FAILED as it must' : 'DID NOT FAIL'} (${Number(r.control.value).toExponential(2)})` : 'no control (report)';
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id.padEnd(11)} ${Number(r.value).toExponential(3).padStart(11)} ≤ ${r.limit === null ? '—' : r.limit}  ${c}`);
  }
  mkdirSync(join(HERE, '..', 'results'), { recursive: true });
  writeFileSync(join(HERE, '..', 'results', 'witnesses.json'), JSON.stringify({ schema: 'loom.springbone-witnesses/1', core: S.VERSION, node: process.version, platform: process.platform + '-' + process.arch, rows }, null, 1) + '\n');
}
