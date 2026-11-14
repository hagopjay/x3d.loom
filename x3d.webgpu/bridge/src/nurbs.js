/* NURBS math for the bridge (component NURBS, X3D 4.0 19775-1 chapter 27): knot vectors, rational B-spline curves and tensor-product surfaces with first derivatives, the tessellation rules of the
   spec, the closed (periodic) curve and surface layout, and the extrusion that turns two curves into a swung surface. Concatenated after kit.js and before src/nodes/*.js; node files call BR.nurbs.*.

   Written from the standard formulas (Piegl and Tiller, The NURBS Book, A2.1 span search, A2.3 basis function derivatives, eq. 4.8 / 4.20 for the rational derivative), NOT copied from X_ITE.
   Rules that are X_ITE 16.6.0's and that this file follows on purpose, because they decide which curve a scene means (each is measured against X_ITE in the fixtures):
     - tessellation t: t > 0 is the number of segments, t < 0 is -t per control point, 0 is 2 per control point; the picture has one more point than segments;
     - a knot vector that is not dimension + order long, decreases, or repeats a knot more than `order` times is replaced by the uniform one (pinned for an open curve, periodic for a closed one), scaled to 0..1;
     - closed = TRUE only takes effect when the first and last control point are the same and, with weights, the first and last weight are the same; the curve is then periodic over the other points;
     - a weight list only counts when it has one weight per control point.
   Where X_ITE 16.6.0 is wrong against the standard (rational curves drawn with the weights not applied the way a rational B-spline needs, interpolators that ignore weights) this file does the standard
   thing and the fixtures say so in xiteDisagrees; see knowledge/NURBS-FINDINGS.md. Control points are flat number lists (Coordinate.point) or lists of pairs (MFVec2d). */
BR.nurbs = (() => {
  const T = {};

  /* number of segments for tessellation field `t` over `dim` control points (19775-1 27.3.1) */
  T.tessellation = (t, dim) => (t > 0 ? t : t < 0 ? -t * dim : 2 * dim);

  /* the knot vector the curve really uses: the given one when it is a legal vector of length dim + order, else the uniform one; closed curves get the periodic extension (order - 2 more knots) */
  T.knots = (closed, order, dim, knot) => {
    const length = dim + order; let k = Array.from(knot || [], Number), generate = true;
    if (k.length === length) {
      generate = false; let same = 0;
      for (let i = 1; i < length; i++) { if (k[i] === k[i - 1]) same++; else same = 0; if (same > order - 1) generate = true; if (k[i - 1] > k[i]) generate = true; }
    }
    if (generate) {
      k = [];
      if (closed) for (let i = 0; i < length; i++) k[i] = i;                         // periodic uniform
      else { let i = 0, v = 1; for (; i < order; i++) k[i] = 0; for (const l = length - order; i < l; i++, v++) k[i] = v; for (; i < length; i++) k[i] = v; }    // pinned uniform
      const max = k[length - 1]; for (let i = 0; i < length; i++) k[i] /= max;
    }
    if (closed) for (let i = 1; i < order - 1; i++) k.push(k[k.length - 1] + (k[i] - k[i - 1]));
    return k;
  };

  /* A2.1: the knot span index s with U[s] <= u < U[s+1], u clamped into the domain [U[p], U[n]]; n = number of control points */
  const span = (n, p, u, U) => {
    if (u >= U[n]) { let s = n - 1; while (s > p && U[s] >= U[s + 1]) s--; return s; }
    if (u <= U[p]) return p;
    let lo = p, hi = n, mid = (lo + hi) >> 1;
    while (u < U[mid] || u >= U[mid + 1]) { if (u < U[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; }
    return mid;
  };

  /* A2.3: the p + 1 non-zero basis functions of span s and their derivatives up to order nd: ders[k][j]. 0 / 0 (two equal knots) counts as 0, as the book says. */
  const basisDers = (s, u, p, nd, U) => {
    const ndu = [], left = [], right = [], a = [new Array(p + 1).fill(0), new Array(p + 1).fill(0)], ders = [];
    for (let j = 0; j <= p; j++) ndu.push(new Array(p + 1).fill(0));
    ndu[0][0] = 1;
    for (let j = 1; j <= p; j++) {
      left[j] = u - U[s + 1 - j]; right[j] = U[s + j] - u; let saved = 0;
      for (let r = 0; r < j; r++) {
        ndu[j][r] = right[r + 1] + left[j - r];
        const t = ndu[j][r] === 0 ? 0 : ndu[r][j - 1] / ndu[j][r];
        ndu[r][j] = saved + right[r + 1] * t; saved = left[j - r] * t;
      }
      ndu[j][j] = saved;
    }
    for (let k = 0; k <= nd; k++) ders.push(new Array(p + 1).fill(0));
    for (let j = 0; j <= p; j++) ders[0][j] = ndu[j][p];
    for (let r = 0; r <= p; r++) {
      let s1 = 0, s2 = 1; a[0][0] = 1;
      for (let k = 1; k <= nd; k++) {
        let d = 0; const rk = r - k, pk = p - k;
        if (r >= k) { a[s2][0] = ndu[pk + 1][rk] === 0 ? 0 : a[s1][0] / ndu[pk + 1][rk]; d = a[s2][0] * ndu[rk][pk]; }
        const j1 = rk >= -1 ? 1 : -rk, j2 = r - 1 <= pk ? k - 1 : p - r;
        for (let j = j1; j <= j2; j++) { a[s2][j] = ndu[pk + 1][rk + j] === 0 ? 0 : (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j]; d += a[s2][j] * ndu[rk + j][pk]; }
        if (r <= pk) { a[s2][k] = ndu[pk + 1][r] === 0 ? 0 : -a[s1][k - 1] / ndu[pk + 1][r]; d += a[s2][k] * ndu[r][pk]; }
        ders[k][r] = d; const t = s1; s1 = s2; s2 = t;
      }
    }
    let f = p; for (let k = 1; k <= nd; k++) { for (let j = 0; j <= p; j++) ders[k][j] *= f; f *= p - k; }
    return ders;
  };

  /* ---- control point lists ------------------------------------------------------------------------------------------------------------------ */
  // a list of points as [[x,y,z], ...] from a flat list (any typed array) or a list of lists; D numbers each
  T.points = (v, D) => {
    if (!v || !v.length) return [];
    if (typeof v[0] === 'object' && v[0] !== null && v[0].length !== undefined) return Array.from(v, (p) => Array.from(p).slice(0, D));
    const out = []; for (let i = 0; i + D <= v.length; i += D) { const p = []; for (let c = 0; c < D; c++) p.push(+v[i + c]); out.push(p); } return out;
  };
  const same = (a, b) => a.every((x, i) => x === b[i]);

  /* a rational curve: {domain, at(u) -> [..D], deriv(u) -> {p, d}}. opts {pts: [[..]], order, knot, weight, closed} ; returns null when the data cannot make a curve (order < 2 or fewer points than the order) */
  T.curve = (o) => {
    const order = o.order | 0, dim = o.pts.length;
    if (order < 2 || dim < order) return null;
    const D = o.pts[0].length, weights = o.weight && o.weight.length === dim ? Array.from(o.weight, Number) : null;
    let closed = false;
    if (o.closed && same(o.pts[0], o.pts[dim - 1]) && (!weights || weights[0] === weights[dim - 1])) closed = true;
    const idx = Array.from({ length: dim }, (_, i) => i); if (closed) for (let i = 1; i < order - 1; i++) idx.push(i);
    const H = idx.map((i) => { const w = weights ? weights[i] : 1; return [...o.pts[i].map((x) => x * w), w]; });
    const U = T.knots(closed, order, dim, o.knot), p = order - 1, n = H.length, domain = [U[p], U[n]];
    const eval1 = (u, nd) => {
      const s = span(n, p, u, U), ders = basisDers(s, u, p, nd, U), A = [];
      for (let k = 0; k <= nd; k++) { const a = new Array(D + 1).fill(0); for (let j = 0; j <= p; j++) for (let c = 0; c <= D; c++) a[c] += ders[k][j] * H[s - p + j][c]; A.push(a); }
      const w = A[0][D], P = A[0].slice(0, D).map((x) => x / w);
      if (nd === 0) return { p: P };
      const wd = A[1][D]; return { p: P, d: P.map((c, i) => (A[1][i] - wd * c) / w) };
    };
    return { D, closed, order, domain, dim, rational: !!weights, at: (u) => eval1(u, 0).p, deriv: (u) => eval1(u, 1), param: (f) => domain[0] + (domain[1] - domain[0]) * f };
  };

  /* the points of a curve at tessellation t: segments + 1 points, flat; a closed curve ends on its first point */
  T.sample = (c, tess) => {
    const nu = T.tessellation(tess, c.dim), out = new Float32Array((nu + 1) * c.D), dist = c.domain[1] - c.domain[0];
    for (let i = 0; i <= nu; i++) { const u = c.domain[0] + dist * (c.closed ? i % nu : i) / nu, p = c.at(u); for (let k = 0; k < c.D; k++) out[i * c.D + k] = p[k]; }
    return out;
  };

  /* ---- surfaces ------------------------------------------------------------------------------------------------------------------------------ */
  /* o {pts: [[x,y,z]] (u fastest: index = v * uDim + u), uDim, vDim, uOrder, vOrder, uKnot, vKnot, weight, uClosed, vClosed}; null when the data cannot make a surface */
  T.surface = (o) => {
    const uO = o.uOrder | 0, vO = o.vOrder | 0, uD = o.uDim | 0, vD = o.vDim | 0;
    if (uO < 2 || vO < 2 || uD < uO || vD < vO || o.pts.length < uD * vD) return null;
    const D = o.pts[0].length, W = o.weight && o.weight.length === uD * vD ? o.weight : null, at = (u, v) => v * uD + u;
    // closed in u: the first and last point of every row (same v) agree, and so do their weights; closed in v: the same for every column
    const uClosed = !!o.uClosed && Array.from({ length: vD }, (_, v) => v).every((v) => same(o.pts[at(0, v)], o.pts[at(uD - 1, v)]) && (!W || W[at(0, v)] === W[at(uD - 1, v)]));
    const vClosed = !!o.vClosed && Array.from({ length: uD }, (_, u) => u).every((u) => same(o.pts[at(u, 0)], o.pts[at(u, vD - 1)]) && (!W || W[at(u, 0)] === W[at(u, vD - 1)]));
    const ext = (dim, order, closed) => { const l = Array.from({ length: dim }, (_, i) => i); if (closed) for (let i = 1; i < order - 1; i++) l.push(i); return l; };
    const ui = ext(uD, uO, uClosed), vi = ext(vD, vO, vClosed);
    const G = ui.map((u) => vi.map((v) => { const k = at(u, v), w = W ? W[k] : 1; return [...o.pts[k].map((x) => x * w), w]; }));
    const Uu = T.knots(uClosed, uO, uD, o.uKnot), Uv = T.knots(vClosed, vO, vD, o.vKnot), pu = uO - 1, pv = vO - 1, nU = G.length, nV = G[0].length;
    const uDomain = [Uu[pu], Uu[nU]], vDomain = [Uv[pv], Uv[nV]];
    const eval1 = (u, v, deriv) => {
      const su = span(nU, pu, u, Uu), sv = span(nV, pv, v, Uv), nd = deriv ? 1 : 0, bu = basisDers(su, u, pu, nd, Uu), bv = basisDers(sv, v, pv, nd, Uv);
      const comb = (ku, kv) => { const a = new Array(D + 1).fill(0); for (let i = 0; i <= pu; i++) for (let j = 0; j <= pv; j++) { const f = bu[ku][i] * bv[kv][j], h = G[su - pu + i][sv - pv + j]; for (let c = 0; c <= D; c++) a[c] += f * h[c]; } return a; };
      const A = comb(0, 0), w = A[D], S = A.slice(0, D).map((x) => x / w);
      if (!deriv) return { p: S };
      const Au = comb(1, 0), Av = comb(0, 1);
      return { p: S, du: S.map((s, i) => (Au[i] - Au[D] * s) / w), dv: S.map((s, i) => (Av[i] - Av[D] * s) / w) };
    };
    return { D, uClosed, vClosed, uDomain, vDomain, uDim: uD, vDim: vD, uOrder: uO, vOrder: vO, rational: !!W, at: (u, v) => eval1(u, v, false).p, deriv: (u, v) => eval1(u, v, true),
      uParam: (f) => uDomain[0] + (uDomain[1] - uDomain[0]) * f, vParam: (f) => vDomain[0] + (vDomain[1] - vDomain[0]) * f,
      // the same knots and closedness for a second set of values (texture coordinates): an unweighted surface over the control points `vals`
      sibling: (vals) => T.surface({ pts: vals, uDim: uD, vDim: vD, uOrder: uO, vOrder: vO, uKnot: o.uKnot, vKnot: o.vKnot, uClosed: o.uClosed, vClosed: o.vClosed }) };
  };

  /* a grid of nu x nv segments over the surface: positions, analytic normals (dS/du x dS/dv; a point where that vanishes takes the mean of the neighbouring faces), uv in the unit square or from
     `tc` (a surface over texture coordinate control points), two triangles per cell wound counter-clockwise round the normal */
  T.mesh = (s, nu, nv, tc) => {
    nu = Math.max(1, nu | 0); nv = Math.max(1, nv | 0);
    const W = nu + 1, n = W * (nv + 1), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(nu * nv * 6), bad = [];
    for (let iv = 0; iv <= nv; iv++) for (let iu = 0; iu <= nu; iu++) {
      const i = iv * W + iu, u = s.uParam(iu / nu), v = s.vParam(iv / nv), e = s.deriv(u, v), a = e.du, b = e.dv;
      pos[i * 3] = e.p[0]; pos[i * 3 + 1] = e.p[1]; pos[i * 3 + 2] = e.p[2];
      const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0], l = Math.hypot(x, y, z);
      if (l > 1e-12 * (1 + Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]))) { nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l; } else bad.push(i);
      if (tc) { const t = tc.at(u, v); uv[i * 2] = t[0]; uv[i * 2 + 1] = t[1]; } else { uv[i * 2] = iu / nu; uv[i * 2 + 1] = iv / nv; }
    }
    let k = 0;
    for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++) { const p0 = iv * W + iu, p1 = p0 + 1, p2 = p1 + W, p3 = p0 + W; idx[k++] = p0; idx[k++] = p1; idx[k++] = p2; idx[k++] = p0; idx[k++] = p2; idx[k++] = p3; }
    if (bad.length) fillNormals(pos, nrm, idx, bad);
    return { pos, nrm, uv, idx, col: null };
  };
  // normals for the vertices in `bad` (a pole, a collapsed edge): the sum of the unnormalised face normals of the triangles that use them
  const fillNormals = (pos, nrm, idx, bad) => {
    const set = new Set(bad), acc = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], w = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      for (const v of [idx[t], idx[t + 1], idx[t + 2]]) if (set.has(v)) { const s = acc.get(v) || [0, 0, 0]; s[0] += f[0]; s[1] += f[1]; s[2] += f[2]; acc.set(v, s); }
    }
    for (const [v, s] of acc) { const l = Math.hypot(s[0], s[1], s[2]) || 1; nrm[v * 3] = s[0] / l; nrm[v * 3 + 1] = s[1] / l; nrm[v * 3 + 2] = s[2] / l; }
  };

  /* ---- rotation of the Z axis onto a direction (NurbsOrientationInterpolator): the shortest turn, as an axis angle [x, y, z, angle]; opposite directions turn half a circle about the first axis that is not parallel */
  T.rotateTo = (from, to) => {
    const nl = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, a = nl(from), b = nl(to);
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], cl = Math.hypot(c[0], c[1], c[2]), dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    if (cl < 1e-12) {
      if (dot > 0) return [0, 0, 1, 0];
      let t = [a[1] * 0 - a[2] * 0, a[2] * 1 - a[0] * 0, a[0] * 0 - a[1] * 1];          // from x X_AXIS
      if (Math.hypot(t[0], t[1], t[2]) < 1e-12) t = [a[1] * 0 - a[2] * 1, a[2] * 0 - a[0] * 0, a[0] * 1 - a[1] * 0];   // else from x Y_AXIS
      const q = nl(t); return [q[0], q[1], q[2], Math.PI];
    }
    return [c[0] / cl, c[1] / cl, c[2] / cl, Math.atan2(cl, dot)];
  };

  /* ---- extrusion (19775-1 13.3.5 geometry that NurbsSwungSurface and NurbsSweptSurface are defined by) -------------------------------------------------
     spine [[x,y,z]], cross-section [[x,z]]: the spine-aligned frame (Y along the spine, Z the local binormal, X = Y x Z) at every spine point; closed spine / cross-section when the ends coincide.
     The same frame rules as the Library hall port of Extrusion (hall/reader-ext-hl.js); no scale, orientation or caps (the NURBS nodes use none). creaseAngle = pi: smooth everywhere. */
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  T.extrude = (sp, cs) => {
    const N = sp.length, M = cs.length;
    if (N < 2 || M < 2) return null;
    const eq = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6), closedSpine = N > 2 && eq(sp[0], sp[N - 1]), closedCS = M > 2 && eq(cs[0], cs[M - 1]);
    const Y = [], Z = [];
    for (let i = 0; i < N; i++) {
      let y;
      if (i === 0) y = closedSpine ? v3.sub(sp[1], sp[N - 2]) : v3.sub(sp[1], sp[0]);
      else if (i === N - 1) y = closedSpine ? v3.sub(sp[1], sp[N - 2]) : v3.sub(sp[N - 1], sp[N - 2]);
      else y = v3.sub(sp[i + 1], sp[i - 1]);
      Y.push(v3.norm(y));
      let z;
      if (i === 0 && closedSpine) z = v3.cross(v3.sub(sp[1], sp[0]), v3.sub(sp[N - 2], sp[0]));
      else if (i === N - 1 && closedSpine) z = Z[0] ? Z[0].slice() : null;
      else if (i > 0 && i < N - 1) z = v3.cross(v3.sub(sp[i + 1], sp[i]), v3.sub(sp[i - 1], sp[i]));
      else z = null;
      Z.push(z && v3.len(z) > 1e-9 ? v3.norm(z) : null);
    }
    if (!closedSpine) { const first = Z.find((z) => z); if (first) { if (!Z[0]) Z[0] = first.slice(); if (!Z[N - 1]) { for (let i = N - 2; i >= 0; i--) if (Z[i]) { Z[N - 1] = Z[i].slice(); break; } } } }
    if (!Z.some((z) => z)) {      // a straight spine: turn +Y onto the spine direction by the shortest rotation
      const t = Y[0], r = T.rotateTo([0, 1, 0], t), ax = r.slice(0, 3), c = Math.cos(r[3]), s = Math.sin(r[3]), z0 = [0, 0, 1], d = v3.dot(ax, z0), x = v3.cross(ax, z0);
      const z1 = z0.map((q, i) => q * c + x[i] * s + ax[i] * d * (1 - c)); for (let i = 0; i < N; i++) Z[i] = z1.slice();
    } else {
      let prev = null; for (let i = 0; i < N; i++) { if (!Z[i]) Z[i] = prev ? prev.slice() : Z.find((z) => z).slice(); prev = Z[i]; }
      for (let i = 1; i < N; i++) if (v3.dot(Z[i], Z[i - 1]) < 0) Z[i] = Z[i].map((x) => -x);
    }
    const pts = new Array(N);
    for (let i = 0; i < N; i++) {
      const X = v3.norm(v3.cross(Y[i], Z[i]));
      pts[i] = cs.map((c) => [sp[i][0] + X[0] * c[0] + Z[i][0] * c[1], sp[i][1] + X[1] * c[0] + Z[i][1] * c[1], sp[i][2] + X[2] * c[0] + Z[i][2] * c[1]]);
    }
    // one vertex per (spine, cross-section) pair; the closing duplicates are folded onto the first ones so the normals are smooth across the seam, the texture coordinates keep their own run 0..1
    const Nu = closedSpine ? N - 1 : N, Mu = closedCS ? M - 1 : M, P = new Float32Array(Nu * Mu * 3), at = (i, j) => (closedSpine ? i % (N - 1) : i) * Mu + (closedCS ? j % (M - 1) : j);
    for (let i = 0; i < Nu; i++) for (let j = 0; j < Mu; j++) P.set(pts[i][j], (i * Mu + j) * 3);
    // corners: every quad keeps its four corners separate so texture coordinates can differ across the seam; the position and the smoothed normal come from the shared vertex
    const quads = (N - 1) * (M - 1), cn = quads * 4, pos = new Float32Array(cn * 3), uv = new Float32Array(cn * 2), idx = new Uint32Array(quads * 6), vert = new Uint32Array(cn), acc = new Float32Array(Nu * Mu * 3);
    let q = 0;
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M - 1; j++, q++) {
      const ring = [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]];
      ring.forEach(([a, b], k) => { const v = at(a, b), c = q * 4 + k; vert[c] = v; pos[c * 3] = P[v * 3]; pos[c * 3 + 1] = P[v * 3 + 1]; pos[c * 3 + 2] = P[v * 3 + 2]; uv[c * 2] = b / (M - 1); uv[c * 2 + 1] = a / (N - 1); });
      const b0 = q * 4; idx.set([b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3], q * 6);
      // face normal of the quad (two triangles): area weighted onto its four shared vertices
      for (const [x, y, z] of [[b0, b0 + 1, b0 + 2], [b0, b0 + 2, b0 + 3]]) {
        const u = [pos[y * 3] - pos[x * 3], pos[y * 3 + 1] - pos[x * 3 + 1], pos[y * 3 + 2] - pos[x * 3 + 2]], w = [pos[z * 3] - pos[x * 3], pos[z * 3 + 1] - pos[x * 3 + 1], pos[z * 3 + 2] - pos[x * 3 + 2]], f = v3.cross(u, w);
        for (const c of [x, y, z]) { const v = vert[c]; acc[v * 3] += f[0]; acc[v * 3 + 1] += f[1]; acc[v * 3 + 2] += f[2]; }
      }
    }
    const nrm = new Float32Array(cn * 3);
    for (let c = 0; c < cn; c++) { const v = vert[c], l = Math.hypot(acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]) || 1; nrm[c * 3] = acc[v * 3] / l; nrm[c * 3 + 1] = acc[v * 3 + 1] / l; nrm[c * 3 + 2] = acc[v * 3 + 2] / l; }
    return { pos, nrm, uv, idx, col: null, closedSpine, closedCS, rows: N, cols: M };
  };

  /* reverse the winding and the normals of a mesh (ccw = FALSE: the vertices are listed clockwise seen from outside) */
  T.flip = (m) => { for (let t = 0; t < m.idx.length; t += 3) { const x = m.idx[t + 1]; m.idx[t + 1] = m.idx[t + 2]; m.idx[t + 2] = x; } for (let i = 0; i < m.nrm.length; i++) m.nrm[i] = -m.nrm[i]; return m; };

  /* ---- 2D control curves (X3DNurbsControlCurveNode: NurbsCurve2D, ContourPolyline2D) --------------------------------------------------------------
     the points of the curve as one flat list: type 0 [x, y, ...] (a cross-section), type 1 [x, 0, y, ...] (a spine in the XZ plane), type 2 [x, y, 0, ...] (a trimming contour in the u-v plane) */
  T.control2D = (n, type) => {
    let xy;
    if (n.type === 'NurbsCurve2D') {
      const c = T.curve({ pts: T.points(n.f.controlPoint, 2), order: n.f.order, knot: n.f.knot, weight: n.f.weight, closed: n.f.closed });
      xy = c ? Array.from(T.sample(c, n.f.tessellation)) : [];
    } else if (n.type === 'ContourPolyline2D') xy = T.points(n.f.controlPoint, 2).flat();
    else return null;
    if (type === 0) return xy;
    const out = []; for (let i = 0; i + 1 < xy.length; i += 2) { if (type === 1) out.push(xy[i], 0, xy[i + 1]); else out.push(xy[i], xy[i + 1], 0); }
    return out;
  };
  T.isControl2D = (n) => !!n && (n.type === 'NurbsCurve2D' || n.type === 'ContourPolyline2D');
  /* the trimming contour of a Contour2D: every child that is a NurbsCurve2D or ContourPolyline2D, tessellated in the u-v plane and joined into one run [x, y, 0, ...] */
  T.contour = (n) => { const out = []; for (const c of n.f.children || []) if (T.isControl2D(c)) out.push(...T.control2D(c, 2)); return out; };

  /* a swung surface that has `n` as its profile or trajectory draws again when `n` changes */
  T.redrawUsers = (body, n) => { if (body.world) for (const x of body.world.nodes) if (x.type === 'NurbsSwungSurface' && (x.f.profileCurve === n || x.f.trajectoryCurve === n)) body.regeo(x); };

  return T;
})();
