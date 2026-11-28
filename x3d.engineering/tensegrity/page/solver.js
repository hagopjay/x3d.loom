// Tensegrity solver for the teaching page: geometry, closed-form prestress, and static equilibrium by dynamic
// relaxation with kinetic damping. Plain JavaScript, no dependencies; the same file runs in the page and in Node,
// where page_solver_check.js holds it against the numpy bank. Frame: X3D, y up. Units: m, N.
(function (root) {
  'use strict';
  const T = {};
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  T.prism = function (n, R, H, twist, Rt) {
    if (twist === undefined || twist === null) twist = Math.PI / 2 + Math.PI / n;
    if (Rt === undefined || Rt === null) Rt = R;
    const X = [], M = [];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; X.push([R * Math.cos(a), 0, -R * Math.sin(a)]); }
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n + twist; X.push([Rt * Math.cos(a), H, -Rt * Math.sin(a)]); }
    for (let i = 0; i < n; i++) M.push({ id: 'S' + i, kind: 'strut', group: 'strut', i: i, j: n + i });
    for (let i = 0; i < n; i++) M.push({ id: 'B' + i, kind: 'cable', group: 'bottom', i: i, j: (i + 1) % n });
    for (let i = 0; i < n; i++) M.push({ id: 'T' + i, kind: 'cable', group: 'top', i: n + i, j: n + (i + 1) % n });
    for (let i = 0; i < n; i++) M.push({ id: 'V' + i, kind: 'cable', group: 'side', i: i, j: n + (i - 1 + n) % n });
    return { X, M };
  };
  T.sixStrut = function (L, gap) {
    const d = (gap === undefined || gap === null) ? L / 2 : gap, X = [], M = [];
    for (const s of [1, -1]) { X.push([-L / 2, 0, s * d / 2]); X.push([L / 2, 0, s * d / 2]); }
    for (const s of [1, -1]) { X.push([s * d / 2, -L / 2, 0]); X.push([s * d / 2, L / 2, 0]); }
    for (const s of [1, -1]) { X.push([0, s * d / 2, -L / 2]); X.push([0, s * d / 2, L / 2]); }
    for (let k = 0; k < 6; k++) M.push({ id: 'S' + k, kind: 'strut', group: 'strut', i: 2 * k, j: 2 * k + 1 });
    const pairs = []; let dmin = Infinity;
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if ((i >> 2) !== (j >> 2)) { const q = len(sub(X[i], X[j])); pairs.push([i, j, q]); dmin = Math.min(dmin, q); }
    let c = 0;
    for (const [i, j, q] of pairs) if (q < dmin * (1 + 1e-9)) { M.push({ id: 'C' + String(c).padStart(2, '0'), kind: 'cable', group: 'cable', i: i, j: j }); c++; }
    return { X, M };
  };
  T.lengths = (X, M) => M.map((m) => len(sub(X[m.j], X[m.i])));
  // The one self-stress, from the closed-form force densities, scaled so a side cable (or any cable of the six-strut) is 1.
  T.prismUnitStress = function (n, X, M) {
    const l = T.lengths(X, M), q = { strut: -1, bottom: 1 / (2 * Math.sin(Math.PI / n)), top: 1 / (2 * Math.sin(Math.PI / n)), side: 1 };
    const ls = l[3 * n];
    return M.map((m, k) => q[m.group] * l[k] / ls);
  };
  T.sixUnitStress = (M) => M.map((m) => (m.kind === 'strut' ? -Math.sqrt(6) : 1));
  T.restLengths = (X, M, EA, t) => T.lengths(X, M).map((l, k) => l / (1 + t[k] / EA[k]));
  // 3-2-1 support: joint a held in x, y, z; joint b in y and across the line a-b; joint c in y.
  T.support321 = function (X, a, b, c) {
    const d = sub(X[b], X[a]); let p = [-d[2], 0, d[0]]; const pl = len(p); p = [p[0] / pl, 0, p[2] / pl];
    return function (V) {
      V[a][0] = V[a][1] = V[a][2] = 0;
      V[b][1] = 0; const s = V[b][0] * p[0] + V[b][2] * p[2]; V[b][0] -= s * p[0]; V[b][2] -= s * p[2];
      V[c][1] = 0;
    };
  };
  T.tensions = function (X, M, EA, L0) {
    return M.map((m, k) => { const l = len(sub(X[m.j], X[m.i])); const t = EA[k] * (l - L0[k]) / L0[k]; return (m.kind === 'cable' && t < 0) ? 0 : t; });
  };
  // Static equilibrium. F: per-joint load [x, y, z]. Returns { X, t, iterations, residual, found }.
  T.relax = function (X0, M, EA, L0, F, project, tol, maxIt) {
    tol = tol || 1e-6; maxIt = maxIt || 200000;
    const n = X0.length, X = X0.map((p) => p.slice()), mass = new Array(n).fill(0), V = X0.map(() => [0, 0, 0]);
    M.forEach((m, k) => { mass[m.i] += 2 * EA[k] / L0[k]; mass[m.j] += 2 * EA[k] / L0[k]; });
    let kePrev = 0, res = Infinity, it = 0, t = null;
    for (; it < maxIt; it++) {
      const R = F.map((f) => f.slice());
      t = new Array(M.length);
      for (let k = 0; k < M.length; k++) {
        const m = M[k], d = sub(X[m.j], X[m.i]), l = len(d);
        let tk = EA[k] * (l - L0[k]) / L0[k]; if (m.kind === 'cable' && tk < 0) tk = 0; t[k] = tk;
        const s = tk / l;
        R[m.i][0] += s * d[0]; R[m.i][1] += s * d[1]; R[m.i][2] += s * d[2];
        R[m.j][0] -= s * d[0]; R[m.j][1] -= s * d[1]; R[m.j][2] -= s * d[2];
      }
      project(R);
      res = 0; for (let i = 0; i < n; i++) res += R[i][0] * R[i][0] + R[i][1] * R[i][1] + R[i][2] * R[i][2];
      res = Math.sqrt(res);
      if (res < tol) return { X, t, iterations: it, residual: res, found: true };
      let ke = 0;
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { V[i][a] += R[i][a] / mass[i]; ke += mass[i] * V[i][a] * V[i][a]; }
      if (ke < kePrev) { for (let i = 0; i < n; i++) V[i][0] = V[i][1] = V[i][2] = 0; ke = 0; }
      else for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) X[i][a] += V[i][a];
      kePrev = ke;
    }
    return { X, t, iterations: it, residual: res, found: false };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T; else root.Tensegrity = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
