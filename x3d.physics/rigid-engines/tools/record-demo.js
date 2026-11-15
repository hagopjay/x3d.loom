// Records the demo scenes on each engine (Node, Rapier 0.21.0 WASM, cannon-es 0.20.0, the bridge's own) and writes script-free X3D replays plus stats.
//   node tools/record-demo.js OUT_DIR       (OUT_DIR = x3d.demo/docs/demos/rigid-engines/v1/data)
const fs = require('fs'), path = require('path'), hash = require('../lib/hash'), { avalanche, cradle, gate, sceneXml } = require('../lib/demo-scenes'), { openScene } = require('../lib/harness');
const out = process.argv[2] || path.join(__dirname, '..', 'results', 'demo'); fs.mkdirSync(out, { recursive: true });
const HZ = 30;                                              // keyframe rate of the replays (the engines ran at 240 Hz inside, ticked at 60 Hz here)
(async () => {
  const stats = {};
  for (const mk of [avalanche, cradle, gate]) {
    const sc = mk(), dir = path.join(out, sc.id); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'live.x3d'), sceneXml(sc, 'live'));
    stats[sc.id] = { title: sc.title, note: sc.note, T: sc.T, engines: {} };
    for (const eng of ['builtin', 'rapier', 'cannon']) {
      const runOnce = async (rapierOpts) => {
      const s = await openScene(sceneXml(sc, 'live'), eng); s.BR.physEngines.rapierOpts = eng === 'rapier' ? rapierOpts : undefined; const N = Math.round(sc.T * 60), nodes = sc.bodies.filter((b) => !b.fixed).map((b) => [b.id, s.node('B_' + b.id)]);
      const tr = {}; for (const [id] of nodes) tr['B_' + id] = { p: [], q: [] }; const log = { ke: [], vmax: [] };
      const snap = (i) => { if (i % (60 / HZ) === 0) for (const [id, n] of nodes) { tr['B_' + id].p.push(n.f.position.slice()); tr['B_' + id].q.push(n.f.orientation.slice()); } };
      snap(0); const t0 = process.hrtime.bigint();
      for (let i = 1; i <= N; i++) { s.advance(1 / 60); snap(i); let ke = 0, vm = 0; for (const [, n] of nodes) { const v = n.f.linearVelocity, sp = Math.hypot(...v); ke += 0.5 * sp * sp; vm = Math.max(vm, sp); } log.ke.push(+ke.toFixed(3)); log.vmax.push(+vm.toFixed(3)); }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6; return { s, N, nodes, tr, log, ms };
      };
      const r1 = await runOnce(sc.rapierOpts), r2 = await runOnce(sc.rapierOpts), { s, N, nodes, tr, log } = r1, ms = Math.min(r1.ms, r2.ms), repeat_identical = hash(r1.tr) === hash(r2.tr);
      const keys = tr[Object.keys(tr)[0]].p.map((_, i, a) => +(i / (a.length - 1)).toFixed(5)).join(' ');
      fs.writeFileSync(path.join(dir, eng + '.x3d'), sceneXml(sc, 'replay', { T: sc.T, keys, tr }));
      const e = { rapier_sub_steps: eng === 'rapier' && sc.rapierOpts ? sc.rapierOpts.sub : undefined, wall_ms_per_step: +(ms / (N * 4)).toFixed(2), repeat_identical, wall_note: 'best of 2 recorder passes, includes per-tick KE and snapshot logging', ke: log.ke.filter((_, i) => i % 6 === 0), notes: s.BR.physEngines.notes.slice() };
      const q = (id) => nodes.find(([i]) => i === id)[1];
      if (sc.id === 'avalanche') { const ys = nodes.map(([, n]) => n.f.position[1]), xs = nodes.map(([, n]) => n.f.position[0]); e.final_top_y = +Math.max(...ys).toFixed(2); e.escaped = nodes.filter(([, n]) => Math.abs(n.f.position[0]) > 4 || Math.abs(n.f.position[2]) > 4 || n.f.position[1] < -0.3).length; e.final_ke = log.ke[log.ke.length - 1]; e.mean_height = +(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(2); }
      const P = (id) => tr['B_' + id].p;
      if (sc.id === 'cradle') { const y4 = P('ball4').map((p) => p[1]), y0 = P('ball0').map((p) => p[1]); e.last_ball_peak_rise_m = +(Math.max(...y4) - Math.min(...y4)).toFixed(2); e.first_ball_start_rise_m = +(Math.max(...y0) - Math.min(...y0)).toFixed(2);
        if (eng === 'rapier') { const r = await runOnce({ sub: 1 }), q4 = r.tr.B_ball4.p.map((p) => p[1]); e.last_ball_peak_rise_m_1_sub_step = +(Math.max(...q4) - Math.min(...q4)).toFixed(2); } }
      if (sc.id === 'gate') { const ang = P('door').map((p) => Math.atan2(-p[2], p[0] + 3.35)), sep = P('cart').map((p) => p[0] - 0.5), yb = P('ball').map((p) => p[1]); e.door_max_angle_rad = +Math.max(...ang.map(Math.abs)).toFixed(2); e.cart_max_separation_m = +Math.max(...sep).toFixed(2); e.cart_min_separation_m = +Math.min(...sep).toFixed(2); e.cart_sag_m = +(0.9 - Math.min(...P('cart').map((p) => p[1]))).toFixed(3); e.ball_last_peak_m = +Math.max(...yb.slice(Math.floor(yb.length * 0.6))).toFixed(2); }
      stats[sc.id].engines[eng] = e; console.log(sc.id, eng, JSON.stringify({ ms: e.wall_ms_per_step, top: e.final_top_y, esc: e.escaped }), (fs.statSync(path.join(dir, eng + '.x3d')).size / 1024).toFixed(0) + ' KB');
    }
  }
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
