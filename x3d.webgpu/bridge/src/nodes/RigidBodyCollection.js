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
    for (const g of geo) shapesOf(g, [0, 0, 0], [0, 0, 0, 1], shapes);
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
          if (sa.kind === 'sphere' && sb.kind === 'sphere') sphereSphere(A, sa, B, sb, cs);
          else if (sa.kind === 'sphere') sphereBox(A, sa, B, sb, cs, false); else if (sb.kind === 'sphere') sphereBox(B, sb, A, sa, cs, true);
          else boxBox(A, sa, B, sb, cs);
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
    const its = Math.max(1, n.f.iterations | 0);
    for (let it = 0; it < its; it++) for (const c of cs) {
      let vr = sub(velAt(c.b, c.rb), velAt(c.a, c.ra)), vn = dot(vr, c.n);
      let dj = c.mn * (-(vn) + Math.max(c.bounceV, c.bias)), nj = Math.max(0, c.jn + dj); dj = nj - c.jn; c.jn = nj; const Jn = mul(c.n, dj); applyImpulse(c.a, mul(Jn, -1), c.ra); applyImpulse(c.b, Jn, c.rb);
      if (mu > 0) for (const [t, m, k] of [[c.t1, c.m1, 'j1'], [c.t2, c.m2, 'j2']]) {
        vr = sub(velAt(c.b, c.rb), velAt(c.a, c.ra)); const lim = mu * c.jn; let d = -m * dot(vr, t); const nv = Math.max(-lim, Math.min(lim, c[k] + d)); d = nv - c[k]; c[k] = nv; const J = mul(t, d); applyImpulse(c.a, mul(J, -1), c.ra); applyImpulse(c.b, J, c.rb);
      }
    }
    for (const B of st.bodies) if (B.invMass && B.node.f.enabled !== false) { B.x = add(B.x, mul(B.v, h)); const dq = qmul([B.w[0] * h * 0.5, B.w[1] * h * 0.5, B.w[2] * h * 0.5, 0], B.q); B.q = qnorm([B.q[0] + dq[0], B.q[1] + dq[1], B.q[2] + dq[2], B.q[3] + dq[3]]); }
    st.contacts = cs.length;
  };
  const build = (n) => {
    const st = { node: n, bodies: [], all: [], t: null, acc: 0, contacts: 0 };
    for (const rb of n.f.bodies || []) { if (!rb || rb.type !== 'RigidBody') continue; const B = buildBody(rb); st.bodies.push(B); st.all.push(B); }
    return st;
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
    let ran = false; while (st.acc >= H) { step(st, H); st.acc -= H; ran = true; }
    if (!ran) return;
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
  return { tick, build, step, toAA, fromAA };
})();
