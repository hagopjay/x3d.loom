const { openScene } = require('./harness');
// record a scene on one engine at 60 Hz; returns { probe: {t, p, q} } and the wall ms of the stepping alone
// tick length of frame i: regular, or jittery (odd frames from the third on are 1/40 s, the next 1/120 s, so the clock lands on i/60 again every second frame). Frame 1 is regular in both: the first tick only starts the world clock.
const jit = (pattern, i, dt) => (pattern === 'jitter' && i >= 3 && i % 2 === 1 ? 1 / 40 : pattern === 'jitter' && i >= 3 ? 1 / 30 - 1 / 40 : dt);
async function record(scene, engine, opts = {}) {
  const s = await openScene(scene.xml, engine, opts), tr = {}, dt = opts.dt || 1 / 60;
  const nodes = scene.probes.map((d) => [d, s.node(d)]); if (nodes.some(([, n]) => !n)) throw new Error('probe missing in ' + scene.id);
  for (const [d] of nodes) tr[d] = { t: [], p: [], q: [] };
  const snap = (t) => { for (const [d, n] of nodes) { tr[d].t.push(t); tr[d].p.push(n.f.position.slice()); tr[d].q.push(n.f.orientation.slice()); } };
  snap(0); const t0 = process.hrtime.bigint(); const N = Math.round(scene.T / dt);
  for (let i = 1; i <= N; i++) { s.advance(jit(opts.pattern, i, dt)); snap(i * dt); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { tr, ms, notes: s.BR.physEngines.notes.slice() };
}
module.exports = { record, jit };
