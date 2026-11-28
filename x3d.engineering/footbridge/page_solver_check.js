#!/usr/bin/env node
// Holds page/solver.js (the script the teaching page carries) against results/bank.json, which the numpy code wrote.
// Writes results/page-solver.json. Exit 0 only when every comparison is inside its tolerance and the control misses.
const fs = require('fs'), path = require('path');
const F = require('./page/solver.js');
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', 'bank.json'), 'utf8'));
const P = B.params, geom = { joints: B.geometry.joints, members: B.geometry.members, supports: [['B0', 0], ['B0', 1], ['B' + B.geometry.panels, 1]], deck: Object.keys(B.geometry.joints).filter((j) => j[0] === 'B') };
const mdl = F.build(geom), rows = F.envelope(mdl, B.sections, P, B.line_loads);
const worst = { N_dc: 0, area: 0, N_max: 0, N_min: 0, utilisation: 0, eta: 0, walk: 0, deflection: 0 };
for (const m of mdl.members) {
  const r = rows[m.id], b = B.members[m.id];
  worst.N_dc = Math.max(worst.N_dc, Math.abs(r.N_dc - b.N_dc)); worst.area = Math.max(worst.area, Math.abs(r.area_plus - b.area_plus), Math.abs(r.area_minus - b.area_minus));
  worst.N_max = Math.max(worst.N_max, Math.abs(r.N_max - b.N_max)); worst.N_min = Math.max(worst.N_min, Math.abs(r.N_min - b.N_min));
  worst.utilisation = Math.max(worst.utilisation, Math.abs(r.utilisation - b.utilisation));
  r.eta.forEach((v, i) => { worst.eta = Math.max(worst.eta, Math.abs(v - B.influence.eta[m.id][i])); });
  B.walk.fronts.forEach((f, q) => { worst.walk = Math.max(worst.walk, Math.abs(r.N_dc + B.line_loads.crowd * F.areaBetween(mdl.xs, r.eta, 0, f) - B.walk.force[m.id][q])); });
}
const etaAll = mdl.members.map((m) => rows[m.id].eta), ed = F.midspanInfluence(mdl, B.sections, P, etaAll);
B.walk.fronts.forEach((f, q) => { worst.deflection = Math.max(worst.deflection, Math.abs(B.line_loads.crowd * F.areaBetween(mdl.xs, ed, 0, f) - B.walk.midspan_deflection[q])); });
const tol = { N_dc: 1e-3, area: 1e-7, N_max: 1e-3, N_min: 1e-3, utilisation: 1e-8, eta: 1e-8, walk: 1e-3, deflection: 1e-9 };
const ok = Object.keys(tol).every((k) => worst[k] <= tol[k]);
// control: patterning by whole panels must miss the bank
const wrong = F.envelope(mdl, B.sections, P, B.line_loads, { wholePanels: true });
let miss = 0; for (const m of mdl.members) miss = Math.max(miss, Math.abs(wrong[m.id].N_max - B.members[m.id].N_max), Math.abs(wrong[m.id].N_min - B.members[m.id].N_min));
const out = { schema: 'loom.eng-page-solver/1', node: process.version, members: mdl.members.length, fronts: B.walk.fronts.length, largest_difference: worst, tolerance: tol, pass: ok,
  control_whole_panels_largest_miss_N: miss, control_caught: miss > 100 };
fs.writeFileSync(path.join(__dirname, 'results', 'page-solver.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
process.exit(ok && out.control_caught ? 0 : 1);
