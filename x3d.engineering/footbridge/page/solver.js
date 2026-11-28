// Footbridge statics for the teaching page: joint equilibrium as one matrix, influence lines, patterned crowd areas,
// the factored envelope and member strengths. Plain JavaScript, no dependency. page_solver_check.js holds this file
// against results/bank.json, which the numpy code wrote; the page carries this file unchanged.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Footbridge = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function solve(A, b) {                               // Gaussian elimination with partial pivoting; A and b are copied
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) throw new Error('mechanism');
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }
  // geom: { joints: {name: [x, y]}, members: [{id, a, b, group}], supports: [[joint, axis]], deck: [names] }
  function build(geom) {
    const names = Object.keys(geom.joints), at = {}; names.forEach((n, i) => { at[n] = i; });
    const fixed = new Set(geom.supports.map(([j, a]) => 2 * at[j] + a));
    const free = []; for (let d = 0; d < 2 * names.length; d++) if (!fixed.has(d)) free.push(d);
    const members = geom.members.map((m) => {
      const pa = geom.joints[m.a], pb = geom.joints[m.b], L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      return { id: m.id, a: m.a, b: m.b, group: m.group, L, c: (pb[0] - pa[0]) / L, s: (pb[1] - pa[1]) / L };
    });
    const row = {}; free.forEach((d, i) => { row[d] = i; });
    const A = free.map(() => new Array(members.length).fill(0));
    members.forEach((m, k) => {                        // a member in tension pulls joint a toward b
      const ia = at[m.a], ib = at[m.b];
      [[2 * ia, -m.c], [2 * ia + 1, -m.s], [2 * ib, m.c], [2 * ib + 1, m.s]].forEach(([d, v]) => { if (d in row) A[row[d]][k] = v; });
    });
    if (A.length !== members.length) throw new Error('mechanism');
    return { names, at, free, members, A, deck: geom.deck, xs: geom.deck.map((j) => geom.joints[j][0]), joints: geom.joints, supports: geom.supports };
  }
  function forces(mdl, down) {                         // down: {joint: downward N}
    const F = mdl.free.map((d) => { const j = mdl.names[d >> 1]; return (d & 1) && down[j] ? -down[j] : 0; });
    return solve(mdl.A, F);
  }
  function influence(mdl) {                            // eta[k][i]: force in member k, unit load at deck joint i
    const eta = mdl.members.map(() => new Array(mdl.deck.length).fill(0));
    mdl.deck.forEach((j, i) => {
      if (mdl.supports.some(([sj, a]) => sj === j && a === 1)) return;
      const N = forces(mdl, { [j]: 1 }); N.forEach((v, k) => { eta[k][i] = v; });
    });
    return eta;
  }
  function areaBetween(xs, row, x0, x1) {              // integral of a piecewise-linear line from x0 to x1
    let t = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      const a = Math.max(x0, xs[i]), b = Math.min(x1, xs[i + 1]); if (b <= a) continue;
      const y = (x) => row[i] + (row[i + 1] - row[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
      t += 0.5 * (y(a) + y(b)) * (b - a);
    }
    return t;
  }
  function signedAreas(xs, row, wholePanels) {         // areas and loaded lengths of the positive and negative parts
    let plus = 0, minus = 0; const sp = [], sm = [], eps = 1e-12;
    const push = (list, a, b) => { if (list.length && Math.abs(list[list.length - 1][1] - a) < 1e-9) list[list.length - 1][1] = b; else list.push([a, b]); };
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], y0 = row[i], y1 = row[i + 1], full = 0.5 * (y0 + y1) * (x1 - x0);
      if (wholePanels) { if (Math.max(y0, y1) > eps) { plus += full; push(sp, x0, x1); } if (Math.min(y0, y1) < -eps) { minus += full; push(sm, x0, x1); } continue; }
      if (y0 >= -eps && y1 >= -eps) { if (Math.max(y0, y1) > eps) { plus += full; push(sp, x0, x1); } }
      else if (y0 <= eps && y1 <= eps) { minus += full; push(sm, x0, x1); }
      else {
        const xz = x0 + (x1 - x0) * y0 / (y0 - y1), a0 = 0.5 * y0 * (xz - x0), a1 = 0.5 * y1 * (x1 - xz);
        if (y0 > 0) { plus += a0; minus += a1; push(sp, x0, xz); push(sm, xz, x1); } else { minus += a0; plus += a1; push(sm, x0, xz); push(sp, xz, x1); }
      }
    }
    return { plus, minus, forTension: sp, forCompression: sm };
  }
  function fcr(Fy, E, sl) { const Fe = Math.PI * Math.PI * E / (sl * sl); return sl <= 4.71 * Math.sqrt(E / Fy) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe; }
  function strengths(sec, L, P) { const sl = L / sec.r; return { tension: P.phi_t * P.Fy * sec.A, compression: P.phi_c * fcr(P.Fy, P.E, sl) * sec.A, slenderness: sl }; }
  function deadLoads(mdl, sections, P, floorLine) {    // panel-point loads from the floor, and half of each member's weight at each end
    const n = mdl.deck.length - 1, a = mdl.xs[1] - mdl.xs[0], down = {};
    mdl.deck.forEach((j, i) => { down[j] = floorLine * a * (i === 0 || i === n ? 0.5 : 1); });
    mdl.members.forEach((m) => { const w = P.density * sections[m.group].A * m.L * P.connection_allowance * P.g; down[m.a] = (down[m.a] || 0) + w / 2; down[m.b] = (down[m.b] || 0) + w / 2; });
    return down;
  }
  // opts: { patterned (default true), wholePanels, crowdFactor }
  function envelope(mdl, sections, P, lines, opts) {
    opts = opts || {}; const w = lines.crowd * (opts.crowdFactor || 1);
    const Ndc = forces(mdl, deadLoads(mdl, sections, P, lines.floor)), eta = influence(mdl), rows = {};
    mdl.members.forEach((m, k) => {
      const s = signedAreas(mdl.xs, eta[k], opts.wholePanels); let ap = s.plus, am = s.minus; const full = ap + am;
      if (opts.patterned === false) { ap = Math.max(full, 0); am = Math.min(full, 0); }
      const nd = Ndc[k], cap = strengths(sections[m.group], m.L, P);
      const nmax = (nd > 0 ? P.gamma_dc_max : P.gamma_dc_min) * nd + P.gamma_pl * w * ap;
      const nmin = (nd < 0 ? P.gamma_dc_max : P.gamma_dc_min) * nd + P.gamma_pl * w * am;
      const ut = Math.max(nmax, 0) / cap.tension, uc = Math.max(-nmin, 0) / cap.compression;
      rows[m.id] = { k, N_dc: nd, area_plus: ap, area_minus: am, area_full: full, N_max: nmax, N_min: nmin, cap_t: cap.tension, cap_c: cap.compression,
        slenderness: cap.slenderness, utilisation: Math.max(ut, uc), governs: uc > ut ? 'compression' : 'tension', forTension: s.forTension, forCompression: s.forCompression,
        reverses: nmax > 1e-6 && nmin < -1e-6, eta: eta[k] };
    });
    return rows;
  }
  function midspanInfluence(mdl, sections, P, eta) {   // deflection at midspan per unit load at each deck joint, by virtual work
    const mid = mdl.deck[(mdl.deck.length - 1) >> 1], n = forces(mdl, { [mid]: 1 });
    return mdl.deck.map((_, i) => mdl.members.reduce((t, m, k) => t + eta[k][i] * n[k] * m.L / (P.E * sections[m.group].A), 0));
  }
  return { solve, build, forces, influence, areaBetween, signedAreas, fcr, strengths, deadLoads, envelope, midspanInfluence };
});
