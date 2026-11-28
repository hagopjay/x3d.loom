// node page_solver_check.js  ->  results/page-solver.json
// REF9: the page's JavaScript solver against the numpy bank, at the design prestress, for four load cases, plus the
// closed-form self-stress against the bank's null vector, plus the six-strut geometry.
const fs = require('fs'), path = require('path');
const T = require('./page/solver.js');
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', 'bank.json'), 'utf8'));
const card = JSON.parse(fs.readFileSync(path.join(__dirname, 'card.json'), 'utf8')), P = {};
for (const k in card.params) P[k] = card.params[k].value;
const sig = (x) => Number(x.toPrecision(3));
const { X, M } = T.prism(P.n, P.R, P.H);
const tu = T.prismUnitStress(P.n, X, M);
const EA = B.design.EA_N, t0 = B.design.prestress_N;
const L0 = T.restLengths(X, M, EA, tu.map((v) => v * t0));
const out = { schema: 'loom.eng-page-solver/1', node: process.version, tolerance_N: 1e-6, cases: {} };
out.joints_max_diff_m = sig(Math.max(...X.flatMap((p, i) => p.map((c, a) => Math.abs(c - B.prism.joints[i][a])))));
out.unit_stress_max_diff = sig(Math.max(...tu.map((v, k) => Math.abs(v - B.prism.unit_stress[k]))));
out.rest_length_max_diff_m = sig(Math.max(...L0.map((v, k) => Math.abs(v - B.design.rest_lengths_m[k]))));
for (const name of ['none', 'press', 'press-on-J3', 'push-out-J3', 'torque+']) {
  const c = B.design.cases[name], F = [];
  for (let i = 0; i < X.length; i++) F.push(c.load.slice(3 * i, 3 * i + 3));
  const r = T.relax(X, M, EA, L0, F, T.support321(X, 0, 1, 2), 1e-6);
  const dx = Math.max(...r.X.flatMap((p, i) => p.map((v, a) => Math.abs(v - c.joints[i][a]))));
  const dt = Math.max(...r.t.map((v, k) => Math.abs(v - c.forces_N[k])));
  out.cases[name] = { found: r.found, iterations: r.iterations, max_position_diff_m: sig(dx), max_force_diff_N: sig(dt) };
}
// Control: the same solve with the polygon cables given the side cables' force density (a wrong prestress). It must miss the bank.
{
  const l = T.lengths(X, M), bad = M.map((m, k) => (m.group === 'strut' ? -1 : 1) * l[k] / l[3 * P.n]);
  const L0b = T.restLengths(X, M, EA, bad.map((v) => v * t0)), c = B.design.cases.press, F = [];
  for (let i = 0; i < X.length; i++) F.push(c.load.slice(3 * i, 3 * i + 3));
  const r = T.relax(X, M, EA, L0b, F, T.support321(X, 0, 1, 2), 1e-6);
  out.control_wrong_density = { case: 'press', max_position_diff_m: sig(Math.max(...r.X.flatMap((p, i) => p.map((v, a) => Math.abs(v - c.joints[i][a]))))) };
}
const six = T.sixStrut(P.six_L);
out.six = { joints_max_diff_m: sig(Math.max(...six.X.flatMap((p, i) => p.map((c, a) => Math.abs(c - B.six.joints[i][a]))))),
  members: six.M.length, same_members: six.M.every((m, k) => m.i === B.six.members[k].i && m.j === B.six.members[k].j && m.kind === B.six.members[k].kind),
  unit_stress_max_diff: sig(Math.max(...T.sixUnitStress(six.M).map((v, k) => Math.abs(v - B.six.unit_stress[k])))) };
fs.writeFileSync(path.join(__dirname, 'results', 'page-solver.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
