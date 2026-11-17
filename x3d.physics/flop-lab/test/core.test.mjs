import './mk.mjs';
const M = await import('../dist/core.mjs?'+Date.now());
const { World, newLevel, addPart, defaultLevel, buildWorld, Sim, runTrial, NOINPUT, compileKernel, KERNEL_SOURCE } = M;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (W, s) => { for (let i = 0; i < s * 60; i++) W.step(1 / 60); };

// 1 free fall against the scheme's own discrete solution
{ const W = new World({ damp: 0 }); const b = W.add({ id: 'b', shape: 'ball', r: .2, mass: 1, y: 100 }); run(W, 1);
  const n = 60 * 8, h = 1 / 480, exact = 100 - 30 * h * h * n * (n + 1) / 2; ok(Math.abs(b.y - exact) < 1e-9, `free fall vs discrete solution: err ${Math.abs(b.y - exact).toExponential(2)} m`); }
// 2 box rests on ground, stack of 6 stays up
{ const L = newLevel(); addPart(L, 'platform', { x: 0, y: 0, w: 20, h: 1 }); addPart(L, 'crates', { x: 0, y: 0, cols: 1, rows: 6, size: 1 }, 'st');
  const W = buildWorld(L); run(W, 6); const top = W.bodies.filter(b => b.part === 'st').sort((a, b) => b.y - a.y)[0];
  ok(Math.abs(top.y - 5.5) < 0.06 && Math.abs(top.x) < 0.05 && Math.abs(top.a) < 0.02, `6-crate stack after 6 s: top y ${top.y.toFixed(3)} (5.5), x ${top.x.toFixed(4)}, a ${top.a.toFixed(4)}`);
  const sp = Math.max(...W.bodies.map(b => Math.hypot(b.vx, b.vy))); ok(sp < 0.05, `stack at rest: max speed ${sp.toFixed(4)} m/s`); }
// 3 box on incline: slides iff tan(theta) > mu
{ for (const [ang, mu, slides] of [[20, .6, false], [40, .6, true]]) { const L = newLevel(); addPart(L, 'platform', { x: 0, y: 0, w: 40, h: 1, angle: -ang }, 'r');
    L.bodies[0].fric = mu; const a = -ang * Math.PI / 180; L.bodies.push({ id: 'c', part: 'c', shape: 'box', w: 1, h: 1, mass: 1, fric: mu, x: Math.sin(-a) * .5 * 1 , y: Math.cos(a) * .5 + 0.0, a });
    const W = buildWorld(L); const c = W.byId.get('c'); const x0 = c.x; run(W, 2); const moved = Math.hypot(c.x - x0, 0);
    ok((moved > 1) === slides, `incline ${ang} deg, mu ${mu}: moved ${moved.toFixed(3)} m, expected ${slides ? 'slide' : 'stick'}`);
    if (slides) { const acc = 30 * (Math.sin(ang * Math.PI / 180) - mu * Math.cos(ang * Math.PI / 180)); const s = Math.hypot(c.vx, c.vy); ok(Math.abs(s - acc * 2) / (acc * 2) < 0.05, `  sliding speed ${s.toFixed(2)} vs Coulomb ${(acc * 2).toFixed(2)} m/s`); } } }
// 4 pendulum period
{ const W = new World({ damp: 0 }); const b = W.add({ id: 'p', shape: 'ball', r: .1, mass: 1, x: Math.sin(.1) * 3, y: -Math.cos(.1) * 3 }); W.link({ type: 'hinge', a: b, ax: 0, ay: 0, bx: 0, by: 0 });
  // hinge with anchor at pivot: local anchor on body is offset; fine
  let cross = [], prev = b.x; for (let i = 0; i < 60 * 12; i++) { W.step(1 / 60); if (prev < 0 && b.x >= 0) cross.push(W.time); prev = b.x; }
  const T = (cross[cross.length - 1] - cross[0]) / (cross.length - 1), Tx = 2 * Math.PI * Math.sqrt((3 * 3 + .5 * .01) / (30 * 3)); ok(Math.abs(T - Tx) / Tx < 0.01, `pendulum period ${T.toFixed(4)} s vs ${Tx.toFixed(4)} s`); }
// 5 restitution
{ const W = new World({ damp: 0 }); W.add({ id: 'g', w: 10, h: 1, y: -.5 }); const b = W.add({ id: 'b', shape: 'ball', r: .3, mass: 1, y: 3.3, rest: .5 }); let peak = 0, hit = false;
  for (let i = 0; i < 180; i++) { W.step(1 / 60); if (b.vy > 0) hit = true; if (hit) peak = Math.max(peak, b.y - .3); } ok(Math.abs(peak - 0.75) < 0.08, `bounce e=0.5 from 3 m: peak ${peak.toFixed(3)} m (0.75)`); }
// 6 determinism + default level sanity
{ const L = defaultLevel(); const a = new Sim(L, { headless: true }), b = new Sim(L, { headless: true }); let same = true;
  const t0 = performance.now(); for (let i = 0; i < 300; i++) { a.step(NOINPUT, 1 / 60); b.step(NOINPUT, 1 / 60); if (a.W.hash() !== b.W.hash()) same = false; } const ms = (performance.now() - t0) / 600;
  ok(same, `two runs of the default level agree on all 300 step hashes (${a.W.hash()})`);
  console.log(`  default level: ${a.W.bodies.length} bodies, ${a.W.joints.length} joints, ${a.W.zones.length} zones, ${ms.toFixed(2)} ms/step, pairs ${a.W.stats.pairs} of ${a.W.stats.brute} brute, contacts ${a.W.stats.contacts}`);
  const bad = a.W.bodies.filter(q => !isFinite(q.x + q.y + q.a)); ok(bad.length === 0, 'no NaN after 5 s');
  const low = a.W.bodies.filter(q => !q.off && q.im > 0 && q.y < -9); ok(low.length === 0, `nothing fell out of the world (${low.map(q => q.id).slice(0, 5)})`);
  const dom = a.W.bodies.filter(q => q.part === 'dominoes_1'); ok(dom.every(q => Math.abs(q.a) < 0.05), 'dominoes still standing untouched after 5 s');
  const tw = a.W.bodies.filter(q => q.part === 'tower_1'); ok(tw.every(q => Math.abs(q.a) < 0.05 && Math.abs(q.x - q.spec.x) < 0.05), 'crate tower still standing after 5 s'); }
// 7 dominoes fall when poked
{ const r = runTrial(defaultLevel(), { scenario: 'observe', watch: 'dominoes_1', poke: { part: 'dominoes_1', spin: -6 }, seconds: 6 }); ok(r.fallen >= r.of - 1, `poked dominoes: ${r.fallen} of ${r.of} fell`); console.log('  ', JSON.stringify(r)); }
// 8 cannon sweep
{ const L = defaultLevel(); for (const v of [25, 35, 45, 55, 65]) { const r = runTrial(L, { scenario: 'cannon', vary: 'cannon.angle', value: v, seconds: 6, clock: () => performance.now() }); console.log(`  cannon ${v} deg: dist ${r.distance_m} air ${r.airtime_s} peak ${r.peak_height_m} miss ${r.goal_miss_m} goal ${r.hit_goal} bonks ${r.bonks} score ${r.score} ${r.ms_per_step} ms/step bodies ${r.bodies}`); } ok(true, 'cannon sweep ran'); }
// 9 hero: runs right, jumps, measured apex
{ const sim = new Sim(defaultLevel()); const h = sim.hero; for (let i = 0; i < 30; i++) sim.step(NOINPUT, 1 / 60); ok(!!sim.ground && Math.abs(h.y - 0.70) < 0.03, `hero stands on the floor: y ${h.y.toFixed(3)}`);
  const y0 = h.y; let apex = 0; sim.step({ ...NOINPUT, jump: true, jumpP: true }, 1 / 60); for (let i = 0; i < 60; i++) { sim.step({ ...NOINPUT, jump: true }, 1 / 60); apex = Math.max(apex, h.y - y0); } ok(apex > 2.8 && apex < 3.5, `full jump apex ${apex.toFixed(2)} m (3.12 ideal)`);
  const x0 = h.x; for (let i = 0; i < 30; i++) sim.step({ ...NOINPUT, x: 1 }, 1 / 60); ok(Math.abs(h.vx - 8.6) < 0.2, `run speed ${h.vx.toFixed(2)} m/s (8.6), went ${(h.x - x0).toFixed(2)} m`);
  sim.step({ ...NOINPUT, flopP: true }, 1 / 60); ok(sim.mode === 'limp', 'F goes limp'); for (let i = 0; i < 240 && sim.mode === 'limp'; i++) sim.step(NOINPUT, 1 / 60); ok(sim.mode === 'hero' && sim.lastStunt, `stood up again; stunt ${JSON.stringify(sim.lastStunt)}`);
  const jl = sim.W.joints.filter(j => j.a.role === 'rag'); ok(jl.length === 10, 'ragdoll has 10 hinges'); }
// 10 edited kernel compiles and runs the same
{ const k = compileKernel(KERNEL_SOURCE); const L = defaultLevel(); const a = new Sim(L, { headless: true }), b = new Sim(L, { headless: true }); b.W.kernel = k; for (let i = 0; i < 120; i++) { a.step(NOINPUT, 1 / 60); b.step(NOINPUT, 1 / 60); } ok(a.W.hash() === b.W.hash(), 'kernel recompiled from its own source gives the same hash after 120 steps'); }
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
