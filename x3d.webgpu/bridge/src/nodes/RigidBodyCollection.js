/* RigidBodyCollection (RigidBodyPhysics level 2): RigidBodyCollection represents a system of bodies that interact within a single physics model.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('RigidBodyCollection', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'children',
  defs: {
    autoDisable: ['SFBool', IO, false],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    bodies: ['MFNode', IO, []],
    collider: ['SFNode', INIT, null],
    constantForceMix: ['SFFloat', IO, 0.0001],
    contactSurfaceThickness: ['SFFloat', IO, 0],
    disableAngularSpeed: ['SFFloat', IO, 0],
    disableLinearSpeed: ['SFFloat', IO, 0],
    disableTime: ['SFTime', IO, 0],
    enabled: ['SFBool', IO, true],
    errorCorrection: ['SFFloat', IO, 0.8],
    gravity: ['SFVec3f', IO, [0, -9.8, 0]],
    iterations: ['SFInt32', IO, 10],
    joints: ['MFNode', IO, []],
    maxCorrectionSpeed: ['SFFloat', IO, -1],
    metadata: ['SFNode', IO, null],
    preferAccuracy: ['SFBool', IO, false],
    set_contacts: ['MFNode', IN, []],
    visible: ['SFBool', IO, true],
  },

  /* The world steps itself. Every timestamp (tick) the collection advances its bodies to the clock in fixed sub-steps (BR.phys, below): gravity and forces, contacts from the shapes of the bodies and the
     collider, a sequential-impulse solve with `iterations` passes, then the new position, orientation and both velocities are raised as events on each moving RigidBody. A ROUTE from RigidBody.position
     to a Transform then moves what you see, exactly as in X_ITE, whose own Bullet engine (Ammo) does the same job; the numbers differ a little (see the gaps). */
  init(n, w) { n._w = w; n._ph = null; },
  tick(n, now) { BR.phys.tick(n, now); },
});

/* ---- BR.phys: a small rigid body engine for RigidBodyCollection. Spheres and boxes (cylinders and cones stand in as their bounding sphere), one global friction and bounce from the CollisionCollection,
   no joints yet (their own batch). Everything is plain arrays: vec3 [x,y,z], quaternion [x,y,z,w], rotation matrix as 9 numbers in rows. ------------------------------------------------------------- */
BR.phys = (() => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  const fromAA = (r) => { const l = Math.hypot(r[0], r[1], r[2]); if (l < 1e-12) return [0, 0, 0, 1]; const s = Math.sin(r[3] / 2) / l; return [r[0] * s, r[1] * s, r[2] * s, Math.cos(r[3] / 2)]; };
  const toAA = (q) => { q = qnorm(q); if (q[3] < 0) q = [-q[0], -q[1], -q[2], -q[3]]; const s = Math.hypot(q[0], q[1], q[2]); if (s < 1e-9) return [0, 0, 1, 0]; return [q[0] / s, q[1] / s, q[2] / s, 2 * Math.atan2(s, q[3])]; };
  const toM = (q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; };
  const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
  const mtv = (M, v) => [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]];
  const mm = (A, B) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return o; };
  const mT = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  const inv3 = (A) => { const [a, b, c, d, e, f, g, h, i] = A, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g); if (Math.abs(det) < 1e-20) return [0, 0, 0, 0, 0, 0, 0, 0, 0]; const k = 1 / det;
    return [(e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k, (f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k, (d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k]; };
  const col = (R, j) => [R[j], R[3 + j], R[6 + j]];

  /* ---- reading the scene: a body's shapes, flattened to {kind, half | r, lp, lq} in the body frame ------------------------------------------------------------------------------------------------------ */
  const shapesOf = (node, lp, lq, out) => {
    if (!node || node.f.enabled === false) return out;
    const p = add(lp, mv(toM(lq), node.f.translation || [0, 0, 0])), q = qmul(lq, fromAA(node.f.rotation || [0, 0, 1, 0]));
    if (node.type === 'CollidableOffset') return shapesOf(node.f.collidable, p, q, out);
    const sh = node.f.shape, g = sh && ([sh.f.geometry].concat(sh.f.children || []).find((k) => k && k.f && ('size' in k.f || 'radius' in k.f)));
    if (!g) return out;
    if (g.type === 'Box') out.push({ kind: 'box', half: mul(g.f.size, 0.5), lp: p, lq: q });
    else if (g.type === 'Sphere') out.push({ kind: 'sphere', r: g.f.radius, lp: p, lq: q });
    else if (g.type === 'Cylinder') out.push({ kind: 'sphere', r: Math.hypot(g.f.radius, g.f.height / 2), lp: p, lq: q, approx: 'Cylinder' });
    else if (g.type === 'Cone') out.push({ kind: 'sphere', r: Math.hypot(g.f.bottomRadius, g.f.height / 2), lp: p, lq: q, approx: 'Cone' });
    return out;
  };
  const volume = (s) => (s.kind === 'box' ? 8 * s.half[0] * s.half[1] * s.half[2] : (4 / 3) * Math.PI * s.r ** 3);
  const buildBody = (rb) => {
    const f = rb.f, shapes = [], geo = f.geometry || [];
    for (const g of geo) { const k0 = shapes.length; shapesOf(g, [0, 0, 0], [0, 0, 0, 1], shapes); for (let i = k0; i < shapes.length; i++) shapes[i].root = g; }     // root: the top-level collidable of the body (a CollisionSensor names those)
    return makeBody(rb, shapes, !!f.fixed || !(f.mass > 0));
  };
  const makeBody = (rb, shapes, fixed) => {
    const f = rb ? rb.f : {}, m = rb ? f.mass : 0, tot = shapes.reduce((a, s) => a + volume(s), 0) || 1;
    const I = [0, 0, 0, 0, 0, 0, 0, 0, 0];            // inertia about the body origin from the shapes (X_ITE's Bullet also derives it from the shapes and ignores the inertia field)
    for (const s of shapes) {
      const mi = (m || 0) * volume(s) / tot, d = s.kind === 'box' ? [mi / 3 * (s.half[1] ** 2 + s.half[2] ** 2), mi / 3 * (s.half[0] ** 2 + s.half[2] ** 2), mi / 3 * (s.half[0] ** 2 + s.half[1] ** 2)] : [0.4 * mi * s.r ** 2, 0.4 * mi * s.r ** 2, 0.4 * mi * s.r ** 2];
      const R = toM(s.lq), D = [d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]], Is = mm(mm(R, D), mT(R)), p = s.lp, pp = dot(p, p);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i * 3 + j] += Is[i * 3 + j] + mi * ((i === j ? pp : 0) - p[i] * p[j]);
    }
    return { node: rb || null, fixed, invMass: fixed ? 0 : 1 / m, invIb: fixed ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : inv3(I), shapes,
      x: rb ? f.position.slice() : [0, 0, 0], q: rb ? fromAA(f.orientation) : [0, 0, 0, 1], v: rb ? f.linearVelocity.slice() : [0, 0, 0], w: rb ? f.angularVelocity.slice() : [0, 0, 0], out: null };
  };

  /* ---- contacts: each has a (body A), b (body B), n pointing from A to B, a point, a depth ------------------------------------------------------------------------------------------------------------- */
  const sphereSphere = (A, sa, B, sb, out) => { const d = sub(sb.wp, sa.wp), l = len(d), dep = sa.r + sb.r - l; if (dep < 0) return; const n = l > 1e-12 ? mul(d, 1 / l) : [0, 1, 0]; out.push({ a: A, b: B, n, p: add(sa.wp, mul(n, sa.r - dep / 2)), depth: dep }); };
  const sphereBox = (A, sph, B, bx, out, flip) => {     // contact normal first computed from the box to the sphere
    const c = mtv(bx.wR, sub(sph.wp, bx.wp)), h = bx.half, q = [Math.max(-h[0], Math.min(h[0], c[0])), Math.max(-h[1], Math.min(h[1], c[1])), Math.max(-h[2], Math.min(h[2], c[2]))];
    let nl, dep, pl;
    if (q[0] === c[0] && q[1] === c[1] && q[2] === c[2]) {   // the centre is inside: leave through the nearest face
      let k = 0, best = Infinity; for (let i = 0; i < 3; i++) { const e = h[i] - Math.abs(c[i]); if (e < best) { best = e; k = i; } }
      nl = [0, 0, 0]; nl[k] = c[k] >= 0 ? 1 : -1; dep = best + sph.r; pl = c.slice(); pl[k] = nl[k] * h[k];
    } else { const d = sub(c, q), l = len(d); if (l > sph.r) return; nl = mul(d, 1 / l); dep = sph.r - l; pl = q; }
    const nBS = mv(bx.wR, nl), p = add(bx.wp, mv(bx.wR, pl));      // from the box to the sphere
    if (flip) out.push({ a: B, b: A, n: nBS, p, depth: dep }); else out.push({ a: A, b: B, n: mul(nBS, -1), p, depth: dep });
  };
  const boxBox = (A, ba, B, bb, out) => {
    const Aa = [col(ba.wR, 0), col(ba.wR, 1), col(ba.wR, 2)], Bb = [col(bb.wR, 0), col(bb.wR, 1), col(bb.wR, 2)], d = sub(bb.wp, ba.wp), ha = ba.half, hb = bb.half;
    let best = Infinity, ax = null, kind = '', ia = 0, ib = 0;
    const test = (L, k, i, j, bias) => { const l = len(L); if (l < 1e-9) return true; L = mul(L, 1 / l); const ra = ha[0] * Math.abs(dot(Aa[0], L)) + ha[1] * Math.abs(dot(Aa[1], L)) + ha[2] * Math.abs(dot(Aa[2], L)), rb = hb[0] * Math.abs(dot(Bb[0], L)) + hb[1] * Math.abs(dot(Bb[1], L)) + hb[2] * Math.abs(dot(Bb[2], L));
      const o = ra + rb - Math.abs(dot(d, L)); if (o < 0) return false; if (o * bias < best) { best = o * bias; ax = dot(d, L) >= 0 ? L : mul(L, -1); kind = k; ia = i; ib = j; } return true; };
    for (let i = 0; i < 3; i++) if (!test(Aa[i], 'A', i, 0, 1)) return;
    for (let i = 0; i < 3; i++) if (!test(Bb[i], 'B', 0, i, 1)) return;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!test(cross(Aa[i], Bb[j]), 'E', i, j, 1 / 0.95)) return;
    const n = ax, depth = best * (kind === 'E' ? 0.95 : 1), pts = [];
    if (kind === 'A' || kind === 'B') {
      const ref = kind === 'A' ? ba : bb, inc = kind === 'A' ? bb : ba, refAx = kind === 'A' ? Aa : Bb, ri = kind === 'A' ? ia : ib, nr = kind === 'A' ? n : mul(n, -1);   // nr = outward normal of the reference face
      const vs = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) vs.push(add(inc.wp, add(add(mul(col(inc.wR, 0), sx * inc.half[0]), mul(col(inc.wR, 1), sy * inc.half[1])), mul(col(inc.wR, 2), sz * inc.half[2]))));
      for (const v of vs) { const r = sub(v, ref.wp), s = dot(r, nr) - ref.half[ri]; if (s > 0.002) continue; let inside = true; for (let k = 0; k < 3; k++) if (k !== ri && Math.abs(dot(r, refAx[k])) > ref.half[k] + 0.002) inside = false; if (inside) pts.push({ p: v, depth: Math.max(0, -s) }); }
    } else {
      const sa = [0, 0, 0], sb = [0, 0, 0]; for (let k = 0; k < 3; k++) { if (k !== ia) sa[k] = Math.sign(dot(Aa[k], n)) * ha[k]; if (k !== ib) sb[k] = -Math.sign(dot(Bb[k], n)) * hb[k]; }
      const pa = add(ba.wp, add(add(mul(Aa[0], sa[0]), mul(Aa[1], sa[1])), mul(Aa[2], sa[2]))), pb = add(bb.wp, add(add(mul(Bb[0], sb[0]), mul(Bb[1], sb[1])), mul(Bb[2], sb[2])));
      const u = Aa[ia], v = Bb[ib], w0 = sub(pa, pb), a = 1, b = dot(u, v), c = 1, dd = dot(u, w0), e = dot(v, w0), den = a * c - b * b || 1e-9, s = (b * e - c * dd) / den, t = (a * e - b * dd) / den;
      pts.push({ p: mul(add(add(pa, mul(u, s)), add(pb, mul(v, t))), 0.5), depth });
    }
    if (!pts.length) pts.push({ p: mul(add(ba.wp, bb.wp), 0.5), depth });
    for (const c of pts) out.push({ a: A, b: B, n, p: c.p, depth: c.depth });
  };

  /* ---- the world ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
  const H = 1 / 240;
  const prepare = (B) => { B.R = toM(B.q); B.iw = B.invMass ? mm(mm(B.R, B.invIb), mT(B.R)) : B.invIb; for (const s of B.shapes) { s.wp = add(B.x, mv(B.R, s.lp)); s.wR = mm(B.R, toM(s.lq)); s.rad = s.kind === 'box' ? len(s.half) : s.r; } };
  const velAt = (B, r) => add(B.v, cross(B.w, r));
  const applyImpulse = (B, J, r) => { if (!B.invMass) return; B.v = add(B.v, mul(J, B.invMass)); B.w = add(B.w, mv(B.iw, cross(r, J))); };

  /* ---- joints: scalar constraint rows (Jacobian rows on the two bodies) solved with the contacts. A row says  jla.vA + jaa.wA + jlb.vB + jab.wB = rhs  within [lo, hi] (impulse, accumulated). Anchors and axes are given in
     world coordinates at load and are stored in each body's frame, so they follow the bodies. Joint error is eased out at rate JERP per step (Baumgarte). ---------------------------------------------------- */
  const JERP = 0.2, TWO_PI = Math.PI * 2, Z3 = [0, 0, 0];
  const unitAxes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const perp = (a) => { const t1 = norm(Math.abs(a[1]) < 0.9 ? cross(a, [0, 1, 0]) : cross(a, [1, 0, 0])); return [t1, cross(a, t1)]; };
  const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
  const row = (A, B, jla, jaa, jlb, jab, rhs, lo = -Infinity, hi = Infinity) => ({ A, B, jla, jaa, jlb, jab, rhs, lo, hi, acc: 0 });
  const prepRow = (r) => { const A = r.A, B = r.B, ia = mv(A.iw, r.jaa), ib = mv(B.iw, r.jab); r.ia = ia; r.ib = ib; const k = A.invMass * dot(r.jla, r.jla) + dot(r.jaa, ia) + B.invMass * dot(r.jlb, r.jlb) + dot(r.jab, ib); r.m = k > 0 ? 1 / k : 0; };
  const solveRow = (r) => {
    const A = r.A, B = r.B; if (!r.m) return;
    const vel = dot(r.jla, A.v) + dot(r.jaa, A.w) + dot(r.jlb, B.v) + dot(r.jab, B.w);
    let l = r.m * (r.rhs - vel); const n = Math.max(r.lo, Math.min(r.hi, r.acc + l)); l = n - r.acc; r.acc = n;
    if (A.invMass) { A.v = add(A.v, mul(r.jla, A.invMass * l)); A.w = add(A.w, mul(r.ia, l)); }
    if (B.invMass) { B.v = add(B.v, mul(r.jlb, B.invMass * l)); B.w = add(B.w, mul(r.ib, l)); }
  };
  const worldAnchor = (B, loc) => add(B.x, mv(B.R, loc));
  const pointRows = (J, h, rows) => {                     // the two anchor points stay together
    const A = J.A, B = J.B, wa = worldAnchor(A, J.pa), wb = worldAnchor(B, J.pb), e = sub(wb, wa), ra = sub(wa, A.x), rb = sub(wb, B.x);
    for (let i = 0; i < 3; i++) { const n = unitAxes[i]; rows.push(row(A, B, mul(n, -1), mul(cross(ra, n), -1), n, cross(rb, n), -JERP * e[i] / h)); }
  };
  const alignRows = (J, a1, a2, h, rows) => {            // axis a1 (world, from body A) and axis a2 (from body B) stay parallel
    const e = cross(a1, a2), [t1, t2] = perp(a1);
    for (const t of [t1, t2]) rows.push(row(J.A, J.B, Z3, mul(t, -1), Z3, t, -JERP * dot(e, t) / h));
  };
  const perpRow = (J, a1, a2, h, rows) => { const c = cross(a1, a2); rows.push(row(J.A, J.B, Z3, c, Z3, mul(c, -1), -JERP * dot(a1, a2) / h)); };   // axis a1 and axis a2 stay at 90 degrees
  const twist = (J, a) => {                                // signed angle of body B relative to body A about the world axis a, continuous
    const qt = qmul(J.A.q, J.qrel0), qe = qmul(J.B.q, qconj(qt)), w = qe[3] < 0 ? -1 : 1, th = 2 * Math.atan2(w * dot([qe[0], qe[1], qe[2]], a), Math.abs(qe[3]));
    let t = th; if (J.lastTh !== undefined) { while (t - J.lastTh > Math.PI) t -= TWO_PI; while (t - J.lastTh < -Math.PI) t += TWO_PI; } J.lastTh = t; return t;
  };
  const lockRotation = (J, h, rows) => {                   // the whole relative rotation is locked
    const qt = qmul(J.A.q, J.qrel0), qe = qmul(J.B.q, qconj(qt)), w = qe[3] < 0 ? -1 : 1, th = mul([qe[0], qe[1], qe[2]], 2 * w);
    for (let i = 0; i < 3; i++) { const n = unitAxes[i]; rows.push(row(J.A, J.B, Z3, mul(n, -1), Z3, n, -JERP * th[i] / h)); }
  };
  const limitRows = (J, a, th, lo, hi, bounce, erp, rows, h) => {
    const rel = dot(sub(J.B.w, J.A.w), a);
    if (th < lo) rows.push(row(J.A, J.B, Z3, mul(a, -1), Z3, a, erp * (lo - th) / h + (rel < -0.5 ? -bounce * rel : 0), 0, Infinity));
    else if (th > hi) rows.push(row(J.A, J.B, Z3, a, Z3, mul(a, -1), erp * (th - hi) / h + (rel > 0.5 ? bounce * rel : 0), 0, Infinity));
  };
  const motorRow = (J, a, speed, maxT, h, rows) => { if (maxT > 0) rows.push(row(J.A, J.B, Z3, mul(a, -1), Z3, a, speed, -maxT * h, maxT * h)); };
  const JOINT_KINDS = {
    BallJoint: {
      rows(J, h, rows) { pointRows(J, h, rows); },
      out(J) { return { body1AnchorPoint: J.pa, body2AnchorPoint: J.pb }; },
    },
    SingleAxisHingeJoint: {
      rows(J, h, rows) {
        const f = J.node.f, a1 = mv(J.A.R, J.axA), a2 = mv(J.B.R, J.axB);
        pointRows(J, h, rows); alignRows(J, a1, a2, h, rows);
        J.th = twist(J, a1); limitRows(J, a1, J.th, f.minAngle, f.maxAngle, f.stopBounce, Math.min(1, f.stopErrorCorrection), rows, h);
      },
      out(J, h) { const th = J.th || 0, rate = J.prevTh === undefined ? 0 : (th - J.prevTh) / h; J.prevTh = th; return { body1AnchorPoint: J.pa, body2AnchorPoint: J.pb, angle: th, angleRate: rate }; },
    },
    DoubleAxisHingeJoint: {            // hinge-2: the anchors meet, axis 1 sits on body 1, axis 2 on body 2, and the two axes stay at 90 degrees; motors turn each
      rows(J, h, rows) {
        const f = J.node.f, a1 = mv(J.A.R, J.axA), a2 = mv(J.B.R, J.axB);
        pointRows(J, h, rows); perpRow(J, a1, a2, h, rows);
        J.th = twist(J, a1); limitRows(J, a1, J.th, f.minAngle1, f.maxAngle1, f.stop1Bounce, Math.min(1, f.stop1ErrorCorrection), rows, h);
        motorRow(J, a1, f.desiredAngularVelocity1, f.maxTorque1, h, rows); motorRow(J, a2, f.desiredAngularVelocity2, f.maxTorque2, h, rows);
      },
      out(J, h) { const th = J.th || 0, rate = J.prevTh === undefined ? 0 : (th - J.prevTh) / h; J.prevTh = th; return { body1AnchorPoint: J.pa, body2AnchorPoint: J.pb, body1Axis: mv(J.A.R, J.axA), body2Axis: mv(J.B.R, J.axB), hinge1Angle: th, hinge1AngleRate: rate, hinge2Angle: 0, hinge2AngleRate: dot(sub(J.B.w, J.A.w), mv(J.B.R, J.axB)) }; },
    },
    UniversalJoint: {                  // the anchors meet and the two axes stay at 90 degrees: a cardan joint
      rows(J, h, rows) { pointRows(J, h, rows); perpRow(J, mv(J.A.R, J.axA), mv(J.B.R, J.axB), h, rows); },
      out(J) { return { body1AnchorPoint: J.pa, body2AnchorPoint: J.pb, body1Axis: mv(J.A.R, J.axA), body2Axis: mv(J.B.R, J.axB) }; },
    },
    SliderJoint: {                     // body B slides along an axis fixed in body A; rotation is locked; separation is measured along the axis between the two body origins, as X_ITE's Bullet slider does
      rows(J, h, rows) {
        const f = J.node.f, A = J.A, B = J.B, ax = mv(A.R, J.axA), d = sub(B.x, A.x), pl = mv(A.R, J.d0), [n1, n2] = perp(ax);
        for (const n of [n1, n2]) { const e = dot(sub(d, pl), n) - dot(mul(ax, dot(sub(d, pl), ax)), n); rows.push(row(A, B, mul(n, -1), Z3, n, Z3, -JERP * dot(sub(d, pl), n) / h)); }
        lockRotation(J, h, rows);
        const s = dot(d, ax); J.sep = s;
        if (s < f.minSeparation) rows.push(row(A, B, mul(ax, -1), Z3, ax, Z3, Math.min(1, f.stopErrorCorrection) * (f.minSeparation - s) / h, 0, Infinity));
        else if (s > f.maxSeparation) rows.push(row(A, B, ax, Z3, mul(ax, -1), Z3, Math.min(1, f.stopErrorCorrection) * (s - f.maxSeparation) / h, 0, Infinity));
        if (f.sliderForce) { const F = mul(ax, f.sliderForce * h); if (B.invMass) B.v = add(B.v, mul(F, B.invMass)); if (A.invMass) A.v = sub(A.v, mul(F, A.invMass)); }
      },
      out(J, h) { const s = J.sep || 0, rate = J.prevSep === undefined ? 0 : (s - J.prevSep) / h; J.prevSep = s; return { separation: s, separationRate: rate }; },
    },
    MotorJoint: {                      // user torques: axisNTorque about motorNAxis (fixed in body 1) on body 2, the opposite on body 1; the angles are the twist of body 2 about each axis
      rows(J, h, rows) {
        const f = J.node.f, n = Math.max(0, Math.min(3, f.enabledAxes | 0)), T = [f.axis1Torque, f.axis2Torque, f.axis3Torque], X = [f.motor1Axis, f.motor2Axis, f.motor3Axis];
        for (let i = 0; i < 3; i++) {
          const a = norm(mv(J.A.R, norm(X[i]))); J.angles ||= [0, 0, 0]; J.lastTh3 ||= [undefined, undefined, undefined];
          J.lastTh = J.lastTh3[i]; J.angles[i] = twist(J, a); J.lastTh3[i] = J.lastTh;
          if (i < n && T[i]) { const t = mul(a, T[i] * h); if (J.B.invMass) J.B.w = add(J.B.w, mv(J.B.iw, t)); if (J.A.invMass) J.A.w = sub(J.A.w, mv(J.A.iw, t)); }
        }
      },
      out(J, h) { const a = J.angles || [0, 0, 0], p = J.prevAng || a, r = a.map((x, i) => (x - p[i]) / h); J.prevAng = a.slice(); return { motor1Angle: a[0], motor2Angle: a[1], motor3Angle: a[2], motor1AngleRate: r[0], motor2AngleRate: r[1], motor3AngleRate: r[2] }; },
    },
  };
  const makeJoint = (st, node) => {
    const kind = JOINT_KINDS[node.type]; if (!kind) return null;
    const A = st.bodies.find((b) => b.node === node.f.body1), B = st.bodies.find((b) => b.node === node.f.body2); if (!A || !B) return null;
    prepare(A); prepare(B);
    const f = node.f, anchor = f.anchorPoint || [0, 0, 0], ax1 = f.axis || f.axis1 || [1, 0, 0], ax2 = f.axis || f.axis2 || [1, 0, 0];
    const J = { node, kind, A, B, pa: mtv(A.R, sub(anchor, A.x)), pb: mtv(B.R, sub(anchor, B.x)), axA: mtv(A.R, norm(ax1)), axB: mtv(B.R, norm(node.type === 'DoubleAxisHingeJoint' || node.type === 'UniversalJoint' ? ax2 : ax1)),
      qrel0: qmul(qconj(A.q), B.q), d0: mtv(A.R, sub(B.x, A.x)), last: null };
    if (node.type === 'SliderJoint') { J.axA = mtv(A.R, norm(f.axis)); J.axB = mtv(B.R, norm(f.axis)); }
    if (node.type === 'MotorJoint') { J.pa = Z3; J.pb = Z3; }
    return J;
  };
  const step = (st, h) => {
    const n = st.node, g = n.f.gravity, cn = n.f.collider, col = cn && cn.f.enabled !== false ? cn : null, ap = col ? col.f.appliedParameters || [] : [];
    // as in X3D 4.0 and X_ITE: the CollisionCollection only supplies what appliedParameters names (BOUNCE by default, friction only with FRICTION_COEFFICIENT-2); without it bodies still collide, with the engine's own friction 0.5 and no bounce
    const mu = col && (ap.includes('FRICTION_COEFFICIENT-2') || ap.includes('FRICTION_COEFFICIENT_2')) ? col.f.frictionCoefficients[0] : 0.5, bounce = col && ap.includes('BOUNCE') ? col.f.bounce : 0, minB = col ? col.f.minBounceSpeed : 0;
    const cap = n.f.maxCorrectionSpeed, erp = Math.min(1, Math.max(0, n.f.errorCorrection));
    for (const B of st.bodies) {
      if (B.invMass && B.node.f.enabled !== false) {
        const f = B.node.f; let F = [0, 0, 0], T = [0, 0, 0]; for (const k of f.forces || []) F = add(F, k); for (const k of f.torques || []) T = add(T, k);
        B.v = add(B.v, add(f.useGlobalGravity === false ? [0, 0, 0] : mul(g, h), mul(F, h * B.invMass))); B.w = add(B.w, mv(B.iw || B.invIb, mul(T, h)));
        const dl = Math.pow(1 - Math.min(0.999, f.linearDampingFactor), h), da = Math.pow(1 - Math.min(0.999, f.angularDampingFactor), h); B.v = mul(B.v, dl); B.w = mul(B.w, da);
      }
    }
    for (const B of st.all) prepare(B);
    const cs = [];
    {
      const L = st.all;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const A = L[i], B = L[j]; if (!A.invMass && !B.invMass) continue; if (A.node && A.node.f.enabled === false && B.node && B.node.f.enabled === false) continue;
        for (const sa of A.shapes) for (const sb of B.shapes) {
          if (len(sub(sa.wp, sb.wp)) > sa.rad + sb.rad) continue;
          const k0 = cs.length;
          if (sa.kind === 'sphere' && sb.kind === 'sphere') sphereSphere(A, sa, B, sb, cs);
          else if (sa.kind === 'sphere') sphereBox(A, sa, B, sb, cs, false); else if (sb.kind === 'sphere') sphereBox(B, sb, A, sa, cs, true);
          else boxBox(A, sa, B, sb, cs);
          for (let k = k0; k < cs.length; k++) { cs[k].ga = sa.root; cs[k].gb = sb.root; cs[k].ba = A; cs[k].bb = B; }     // the pair of top-level collidables and bodies of this contact (a, b may be swapped, these follow sa, sb)
        }
      }
    }
    for (const c of cs) {                                 // set up each contact
      c.ra = sub(c.p, c.a.x); c.rb = sub(c.p, c.b.x);
      const t1 = Math.abs(c.n[1]) < 0.9 ? norm(cross(c.n, [0, 1, 0])) : norm(cross(c.n, [1, 0, 0])); c.t1 = t1; c.t2 = cross(c.n, t1);
      const em = (d) => { const ra = cross(c.ra, d), rb = cross(c.rb, d); const k = c.a.invMass + c.b.invMass + dot(ra, mv(c.a.iw, ra)) + dot(rb, mv(c.b.iw, rb)); return k > 0 ? 1 / k : 0; };
      c.mn = em(c.n); c.m1 = em(t1); c.m2 = em(c.t2); c.jn = 0; c.j1 = 0; c.j2 = 0;
      const vn = dot(sub(velAt(c.b, c.rb), velAt(c.a, c.ra)), c.n);
      c.bounceV = vn < -Math.max(minB, 1e-9) && bounce > 0 ? -bounce * vn : 0;
      let bias = erp * Math.max(0, c.depth - 0.005) / h; if (cap >= 0) bias = Math.min(bias, cap); c.bias = bias;
    }
    const jrows = []; for (const J of st.joints) J.kind.rows(J, h, jrows); for (const r of jrows) prepRow(r);
    const its = Math.max(1, n.f.iterations | 0);
    for (let it = 0; it < its; it++) { for (const r of jrows) solveRow(r); for (const c of cs) {
      let vr = sub(velAt(c.b, c.rb), velAt(c.a, c.ra)), vn = dot(vr, c.n);
      let dj = c.mn * (-(vn) + Math.max(c.bounceV, c.bias)), nj = Math.max(0, c.jn + dj); dj = nj - c.jn; c.jn = nj; const Jn = mul(c.n, dj); applyImpulse(c.a, mul(Jn, -1), c.ra); applyImpulse(c.b, Jn, c.rb);
      if (mu > 0) for (const [t, m, k] of [[c.t1, c.m1, 'j1'], [c.t2, c.m2, 'j2']]) {
        vr = sub(velAt(c.b, c.rb), velAt(c.a, c.ra)); const lim = mu * c.jn; let d = -m * dot(vr, t); const nv = Math.max(-lim, Math.min(lim, c[k] + d)); d = nv - c[k]; c[k] = nv; const J = mul(t, d); applyImpulse(c.a, mul(J, -1), c.ra); applyImpulse(c.b, J, c.rb);
      }
    } }
    for (const B of st.bodies) if (B.invMass && B.node.f.enabled !== false) { B.x = add(B.x, mul(B.v, h)); const dq = qmul([B.w[0] * h * 0.5, B.w[1] * h * 0.5, B.w[2] * h * 0.5, 0], B.q); B.q = qnorm([B.q[0] + dq[0], B.q[1] + dq[1], B.q[2] + dq[2], B.q[3] + dq[3]]); }
    st.contacts = cs.length; st.last = cs;      // the contacts of the last sub-step: what a CollisionSensor reads
  };
  const build = (n) => {
    const st = { node: n, bodies: [], all: [], t: null, acc: 0, contacts: 0 };
    for (const rb of n.f.bodies || []) { if (!rb || rb.type !== 'RigidBody') continue; const B = buildBody(rb); st.bodies.push(B); st.all.push(B); }
    st.joints = []; for (const j of n.f.joints || []) { const J = j && makeJoint(st, j); if (J) st.joints.push(J); }
    return st;
  };
  /* a joint raises the outputs named in forceOutput (ALL for every one; the default NONE raises none) when they change */
  const jointOutputs = (st, dt) => {
    for (const J of st.joints) {
      const fo = J.node.f.forceOutput || []; if (!fo.length || (fo.length === 1 && fo[0] === 'NONE')) continue;
      const o = J.kind.out(J, Math.max(dt, 1e-6)), names = fo.includes('ALL') ? Object.keys(o) : fo.filter((k) => k in o);
      for (const k of names) { const v = o[k], old = J.node.f[k]; const ch = Array.isArray(v) ? !(Array.isArray(old) && same(old, v)) : Math.abs((old || 0) - v) > 1e-9; if (ch) { J.node.f[k] = v; events.emit(J.node, k, v); } }
    }
  };
  const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-12);
  const tick = (n, now) => {
    if (n.f.enabled === false) { if (n._ph) n._ph.t = null; return; }
    const st = (n._ph ||= build(n));
    for (const B of st.bodies) {                           // a page that set position, orientation or a velocity gets its value taken up
      const f = B.node.f, o = B.out; if (!o) continue;
      if (f.position !== o.position) B.x = f.position.slice(); if (f.orientation !== o.orientation) B.q = fromAA(f.orientation); if (f.linearVelocity !== o.linearVelocity) B.v = f.linearVelocity.slice(); if (f.angularVelocity !== o.angularVelocity) B.w = f.angularVelocity.slice();
    }
    if (st.t === null) { st.t = now; return; }
    st.acc += Math.min(0.5, Math.max(0, now - st.t)); st.t = now;
    const dtT = now - (st.lastOut ?? now); let ran = false; while (st.acc >= H) { step(st, H); st.acc -= H; ran = true; }
    if (!ran) return;
    st.lastOut = now; jointOutputs(st, dtT);
    for (const B of st.bodies) {
      if (!B.invMass) continue; const f = B.node.f, o = B.out || {}, pos = B.x.slice(), ori = toAA(B.q), lv = B.v.slice(), av = B.w.slice();
      B.out = { position: pos, orientation: ori, linearVelocity: lv, angularVelocity: av };
      if (!o.position || !same(o.position, pos)) { f.position = pos; events.emit(B.node, 'position', pos); }
      if (!o.orientation || !same(o.orientation, ori)) { f.orientation = ori; events.emit(B.node, 'orientation', ori); }
      if (!o.linearVelocity || !same(o.linearVelocity, lv)) { f.linearVelocity = lv; events.emit(B.node, 'linearVelocity', lv); }
      if (!o.angularVelocity || !same(o.angularVelocity, av)) { f.angularVelocity = av; events.emit(B.node, 'angularVelocity', av); }
      B.out = { position: f.position, orientation: f.orientation, linearVelocity: f.linearVelocity, angularVelocity: f.angularVelocity };
    }
  };
  /* the collidables a collider lists, nested CollisionSpaces flattened (anything else is skipped, a space met twice is walked once) */
  const flatten = (list, out = [], seen = new Set()) => {
    for (const c of list || []) {
      if (!c || seen.has(c)) continue; seen.add(c);
      if (c.type === 'CollisionSpace') flatten(c.f.collidables, out, seen); else if (c.type === 'CollidableShape' || c.type === 'CollidableOffset') out.push(c);
    }
    return out;
  };
  return { tick, build, step, toAA, fromAA, flatten };
})();
