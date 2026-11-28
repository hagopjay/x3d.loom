// Step every scene in bank/cases.json on the three engines behind the x3d.loom bridge reader and record the poses.
// Uses x3d.physics/rigid-engines (npm install there first). Node only: no browser, no GPU.
//   node run_engines.js [--explore]      writes .work/trajectories.json (or .work/exploration-trajectories.json); .work is scratch, never shipped
const fs = require('node:fs'), path = require('node:path');
const RE = path.resolve(__dirname, '..', '..', 'x3d.physics', 'rigid-engines');
const { record } = require(path.join(RE, 'lib', 'record.js'));
const explore = process.argv.includes('--explore');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'bank', 'cases.json'), 'utf8'));
const ENGINES = ['builtin', 'rapier', 'cannon'];
const PROBES = ['Crank', 'Coupler', 'Rocker'];
(async () => {
  const out = { schema: 'loom.eng-traj/1', rig: { node: process.version, rapier: require(path.join(RE, 'node_modules', '@dimforge', 'rapier3d-compat', 'package.json')).version, cannon: require(path.join(RE, 'node_modules', 'cannon-es', 'package.json')).version, sample_hz: 60 }, runs: [] };
  for (const c of cases) {
    const xml = fs.readFileSync(path.join(__dirname, 'scenes', c.id + '.x3d'), 'utf8');
    const T = +(Math.max(2.5, 2.6 * 2 * Math.PI / c.omega2)).toFixed(3);      // about 2.6 nominal crank turns
    for (const eng of ENGINES) {
      const r = await record({ id: c.id, T, xml, probes: PROBES }, eng);
      out.runs.push({ case: c.id, engine: eng, T, notes: r.notes, wall_ms: +r.ms.toFixed(1), tr: r.tr });
      console.log(c.id.padEnd(26), eng.padEnd(8), 'T', T, 'samples', r.tr.Crank.t.length, r.notes.length ? 'NOTES ' + r.notes.join('; ') : '');
    }
  }
  // the four-hinge control again with the adapters asked for the X3D reading of the stop (added 28 Nov with the adapter option; kept apart so `runs` and its hash are unchanged)
  out.runs_x3d_stop = [];
  for (const c of cases.filter((c) => c.pins === 'hinge')) {
    const xml = fs.readFileSync(path.join(__dirname, 'scenes', c.id + '.x3d'), 'utf8'), T = +(Math.max(2.5, 2.6 * 2 * Math.PI / c.omega2)).toFixed(3);
    for (const eng of ENGINES) { const r = await record({ id: c.id, T, xml, probes: PROBES }, eng, { hingeStop: 'x3d' }); out.runs_x3d_stop.push({ case: c.id, engine: eng, T, notes: r.notes, tr: r.tr }); }
  }
  fs.mkdirSync(path.join(__dirname, '.work'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '.work', explore ? 'exploration-trajectories.json' : 'trajectories.json'), JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
