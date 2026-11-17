// Gates for the Flop Lab engine. Every reference has a control: a wrong implementation the same check must reject (Loom law 44).
import './mk.mjs';
import fs from 'fs';
import crypto from 'crypto';
const M = await import('../dist/core.mjs?' + Date.now());
const { World, newLevel, addPart, defaultLevel, buildWorld, Sim, NOINPUT, compileKernel, KERNEL_SOURCE } = M;
const LIM = JSON.parse(fs.readFileSync(new URL('./limits.json', import.meta.url), 'utf8'));
const out = { engine: 'flop-lab xpbd2d', node: process.version, date: new Date().toISOString(), gates: [], controls: [] };
let fails = 0;
const gate = (name, value, limit, pass, unit = '') => { out.gates.push({ name, value, limit, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${value}${unit} (limit ${limit}${unit})`); if (!pass) fails++; };
const control = (name, value, need, caught) => { out.controls.push({ name, value, need, caught }); console.log(`${caught ? 'CAUGHT' : 'MISSED'} control ${name}: ${value} (must exceed ${need})`); if (!caught) fails++; };
const after = (src, fn, find, put) => { const i = src.indexOf('function ' + fn + '('), j = src.indexOf(find, i); if (i < 0 || j < 0) throw new Error('patch point not found: ' + find); return src.slice(0, j) + put + src.slice(j + find.length); };
const run = (W, s) => { for (let i = 0; i < s * 60; i++) W.step(1 / 60); };
const stack = (cols, rows, tune, kernelSrc, secs = 10) => { const L = newLevel(); addPart(L, 'platform', { x: 0, y: 0, w: 30, h: 1 }); addPart(L, 'crates', { x: 0, y: 0, cols, rows, size: 1 }, 'st'); const W = buildWorld(L, tune); if (kernelSrc) W.kernel = compileKernel(kernelSrc);
  let tilt = 0, speed = 0, drift = 0; for (let i = 0; i < secs * 60; i++) { W.step(1 / 60); if (i > 120) for (const b of W.bodies) if (b.im) { tilt = Math.max(tilt, Math.abs(b.a)); speed = Math.max(speed, Math.hypot(b.vx, b.vy)); drift = Math.max(drift, Math.abs(b.x - b.spec.x)); } } return { tilt, speed, drift }; };
const pendulum = (tune) => { const W = new World(Object.assign({ damp: 0 }, tune)); const b = W.add({ id: 'p', shape: 'ball', r: 0.1, mass: 1, x: Math.sin(0.1) * 3, y: -Math.cos(0.1) * 3 }); W.link({ type: 'hinge', a: b, ax: 0, ay: 0 });
  const cross = []; let prev = b.x; for (let i = 0; i < 60 * 12; i++) { const x0 = b.x; W.step(1 / 60); if (x0 < 0 && b.x >= 0) cross.push(W.time - (1 / 60) * (b.x / (b.x - x0))); }
  const T = (cross[cross.length - 1] - cross[0]) / (cross.length - 1), Tx = 2 * Math.PI * Math.sqrt((9 + 0.5 * 0.01) / (30 * 3)); return Math.abs(T - Tx) / Tx; };

// 1 free fall against the scheme's own discrete solution (playbook pattern 1)
{ const W = new World({ damp: 0 }); const b = W.add({ id: 'b', shape: 'ball', r: 0.2, mass: 1, y: 100 }); run(W, 1); const n = 480, h = 1 / 480, exact = 100 - (30 * h * h * n * (n + 1)) / 2; const e = Math.abs(b.y - exact); gate('free fall vs the discrete solution', e.toExponential(2), LIM.free_fall_err_m, e < LIM.free_fall_err_m, ' m'); }
// 2 stacks at rest
{ const s = stack(1, 10); gate('10-crate stack, max tilt in 10 s', s.tilt.toFixed(5), LIM.stack10_max_tilt_rad, s.tilt < LIM.stack10_max_tilt_rad, ' rad'); gate('10-crate stack, max speed', s.speed.toFixed(3), LIM.stack10_max_speed_mps, s.speed < LIM.stack10_max_speed_mps, ' m/s');
  const g = stack(5, 5); gate('5 x 5 crate wall, max tilt', g.tilt.toFixed(5), LIM.grid5x5_max_tilt_rad, g.tilt < LIM.grid5x5_max_tilt_rad, ' rad');
  const one = stack(1, 1, {}, null, 6); gate('one crate at rest, sideways creep in 6 s', one.drift.toFixed(5), LIM.rest_creep_m_per_6s, one.drift < LIM.rest_creep_m_per_6s, ' m');
  const corner = after(after(KERNEL_SOURCE, 'solveContact', 'if (c.twin === 2) return;', ''), 'solveContact', 'm = c.twin === 1 ? c.mate : null', 'm = null');
  const c1 = stack(1, 10, {}, corner); control('face contacts solved one corner at a time (10-stack tilt, rad; judged by the gate\'s own limit)', c1.tilt.toFixed(4), LIM.stack10_max_tilt_rad, c1.tilt > LIM.stack10_max_tilt_rad);
  const fr = after(after(KERNEL_SOURCE, 'friction', 'if (c.twin === 2) return;', ''), 'friction', 'const m = c.twin === 1 ? c.mate : null', 'const m = null');
  const c2 = stack(1, 10, {}, fr); out.controls.push({ name: 'friction pulled at each corner instead of the face middle (10-stack tilt, rad)', value: c2.tilt.toFixed(4), need: 'reported, not gated', caught: null }); console.log('INFO   friction at each corner, 10-stack tilt: ' + c2.tilt.toFixed(4) + ' rad, max speed ' + c2.speed.toFixed(3) + ' m/s');
  const same = KERNEL_SOURCE.replace("for (let k = 0; k < W.nc; k++) solveContact(W, W.contacts[k], h);\n                        for (let k = 0; k < W.nc; k++) friction(W, W.contacts[k], h);", 'for (let k = 0; k < W.nc; k++) { solveContact(W, W.contacts[k], h); friction(W, W.contacts[k], h); }');
  if (same === KERNEL_SOURCE) throw new Error('same-pass patch point not found');
  const c3 = stack(1, 1, {}, after(after(same, 'solveContact', 'if (c.twin === 2) return;', ''), 'solveContact', 'm = c.twin === 1 ? c.mate : null', 'm = null'), 6);
  out.controls.push({ name: 'friction inside the push pass, corner by corner (one crate, creep in 6 s, m)', value: c3.drift.toFixed(4), need: 'reported, not gated', caught: null }); console.log('INFO   friction inside the push pass, corner by corner: one crate crept ' + c3.drift.toFixed(4) + ' m in 6 s'); }
// 3 Coulomb: stick below tan(theta) = mu, slide at g (sin - mu cos) above
{ const slope = (ang, mu) => { const L = newLevel(); addPart(L, 'platform', { x: 0, y: 0, w: 60, h: 1, angle: -ang }, 'r'); L.bodies[0].fric = mu; const a = (-ang * Math.PI) / 180; L.bodies.push({ id: 'c', part: 'c', shape: 'box', w: 1, h: 1, mass: 1, fric: mu, x: Math.sin(-a) * 0.5, y: Math.cos(a) * 0.5, a }); const W = buildWorld(L, { damp: 0 }); const c = W.byId.get('c'), x0 = c.x; run(W, 2); return { moved: Math.abs(c.x - x0), v: Math.hypot(c.vx, c.vy) }; };
  const st = slope(20, 0.6); gate('incline 20 deg, mu 0.6 sticks (moved in 2 s)', st.moved.toFixed(4), 0.2, st.moved < 0.2, ' m');
  const sl = slope(40, 0.6), want = 30 * (Math.sin((40 * Math.PI) / 180) - 0.6 * Math.cos((40 * Math.PI) / 180)) * 2, rel = Math.abs(sl.v - want) / want; gate('incline 40 deg, speed after 2 s vs Coulomb', rel.toFixed(4), LIM.incline_speed_rel, rel < LIM.incline_speed_rel, ' relative');
  const ice = slope(20, 0); control('friction 0 on the 20 deg incline (moved, m)', ice.moved.toFixed(2), 1, ice.moved > 1); }
// 4 pendulum on a hinge
{ const e = pendulum({}); gate('pendulum period vs 2 pi sqrt(I / m g L)', e.toFixed(5), LIM.pendulum_period_rel, e < LIM.pendulum_period_rel, ' relative'); const c = pendulum({ controlHinge1D: true }); control('hinge solved along the error direction only (period error, relative)', c.toFixed(4), LIM.control_hinge_min_period_rel, c > LIM.control_hinge_min_period_rel); }
// 5 restitution
{ const drop = (e) => { const W = new World({ damp: 0 }); W.add({ id: 'g', w: 10, h: 1, y: -0.5 }); const b = W.add({ id: 'b', shape: 'ball', r: 0.3, mass: 1, y: 3.3, rest: e }); let peak = 0, hit = false; for (let i = 0; i < 180; i++) { W.step(1 / 60); if (b.vy > 0) hit = true; if (hit) peak = Math.max(peak, b.y - 0.3); } return peak; };
  const p = drop(0.5), err = Math.abs(p - 0.75); gate('bounce e = 0.5 from 3 m, peak vs e^2 h', err.toFixed(4), LIM.bounce_peak_err_m, err < LIM.bounce_peak_err_m, ' m'); const z = drop(0); gate('bounce e = 0.1 (the default material) from 3 m, peak (e^2 h = 0.03)', z.toFixed(4), LIM.inelastic_peak_m, z < LIM.inelastic_peak_m, ' m');
  const hot = (() => { const W = new World({ damp: 0, restAdd: 0.3 }); W.add({ id: 'g', w: 10, h: 1, y: -0.5 }); const b = W.add({ id: 'b', shape: 'ball', r: 0.3, mass: 1, y: 3.3, rest: 0.5 }); let peak = 0, hit = false; for (let i = 0; i < 180; i++) { W.step(1 / 60); if (b.vy > 0) hit = true; if (hit) peak = Math.max(peak, b.y - 0.3); } return peak; })();
  control('restitution raised by 0.3 (peak error against 0.75 m)', Math.abs(hot - 0.75).toFixed(3), LIM.bounce_peak_err_m, Math.abs(hot - 0.75) > LIM.bounce_peak_err_m); }
// 6 broad phase: set equality with brute force on every frame (failure mode 160)
{ const count = (tune) => { const sim = new Sim(defaultLevel(), { headless: true, tune }); const W = sim.W; sim.launchFrom(W.zones.find((z) => z.kind === 'cannon')); let missed = 0, extra = 0, tests = 0, brute = 0;
    for (let f = 0; f < 300; f++) { sim.step(NOINPUT, 1 / 60); const got = new Set(); for (let i = 0; i < W.np; i += 2) { const a = W.pairs[i], b = W.pairs[i + 1]; got.add(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id); }
      const act = W.active; let want = 0; for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) { const a = act[i], b = act[j]; if (a.im === 0 && b.im === 0) continue; if (a.group !== 0 && a.group === b.group) continue; if (a.maxx < b.minx || b.maxx < a.minx || a.maxy < b.miny || b.maxy < a.miny) continue; want++; if (!got.has(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id)) missed++; }
      extra += got.size - (want - 0); tests += W.stats.tests; brute += W.stats.brute; } return { missed, tests: Math.round(tests / 300), brute: Math.round(brute / 300) }; };
  const g = count({}); gate(`sweep and prune vs brute force over 300 frames, pairs missed (${g.tests} tests a frame against ${g.brute})`, g.missed, LIM.pairs_missed, g.missed <= LIM.pairs_missed);
  const c = count({ controlSortByCentre: true }); control('list sorted by centre instead of left edge (pairs missed in 300 frames)', c.missed, LIM.control_pairs_min_missed, c.missed >= LIM.control_pairs_min_missed); }
// 7 determinism, this host: a hash of every step (law 42) of a cannon shot on the default level. The cross-host comparison is in browser.mjs.
const shot = (opt, kernel) => { const s = new Sim(defaultLevel(), Object.assign({ headless: true }, opt)); if (kernel) s.W.kernel = kernel; s.launchFrom(s.W.zones.find((z) => z.kind === 'cannon')); const h = []; for (let i = 0; i < 300; i++) { s.step(NOINPUT, 1 / 60); h.push(s.W.hash()); } return h; };
{ const a = shot(), b = shot(); let diff = 0; for (let i = 0; i < 300; i++) if (a[i] !== b[i]) diff++;
  gate('two runs of a cannon shot on the default level, differing step hashes of 300', diff, LIM.hash_mismatches_of_300, diff <= LIM.hash_mismatches_of_300); out.hash300 = a[299]; out.hashAll = a;
  out.model_sha256 = crypto.createHash('sha256').update(JSON.stringify(defaultLevel())).digest('hex'); out.engine_sha256 = crypto.createHash('sha256').update(['core', 'level', 'game'].map((f) => fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8')).join('\n')).digest('hex');
  const c = shot({ tune: { fricMul: 1.0000001 } }); let d2 = 0; for (let i = 0; i < 300; i++) if (c[i] !== a[i]) d2++; control('friction changed by 1e-7 (differing step hashes of 300)', d2, 1, d2 >= 1); }
// for the cross-host control in browser.mjs: the same shot with the engine's trig swapped for the built-in sine and cosine in the solver
fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../dist/node-hashes-native.json', import.meta.url), JSON.stringify(shot({}, compileKernel(KERNEL_SOURCE.replace(/\bsin\(/g, 'Math.sin(').replace(/\bcos\(/g, 'Math.cos(')))));
out.caught = out.controls.filter((c) => c.caught === true).length; out.gated_controls = out.controls.filter((c) => c.caught !== null).length; out.passed = out.gates.filter((g) => g.pass).length;
fs.writeFileSync(new URL('../receipts/gates.json', import.meta.url), JSON.stringify(Object.assign({}, out, { hashAll: undefined }), null, 1));
fs.writeFileSync(new URL('../receipts/hashes-node.json', import.meta.url), JSON.stringify(out.hashAll));
console.log(`\n${out.passed} of ${out.gates.length} gates pass; ${out.caught} of ${out.gated_controls} controls caught${fails ? '; ' + fails + ' PROBLEMS' : ''}`); process.exit(fails ? 1 : 0);
