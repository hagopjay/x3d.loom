/* X3D RigidBodyPhysics: pluggable engines (id prefix ENG).
   Loaded AFTER the bridge bundle's node files, as its own script (or appended inside the bundle IIFE). It touches nothing in x3d.webgpu/ or src/body-three.js: it reads the bridge through the
   window.__bridge / __events / __R exports every bundle ends with, and replaces ONE function, BR.phys.tick, with a version that runs the same loop but hands each fixed sub-step to an engine.

   What stays shared with the built-in engine (RigidBodyCollection.js): BR.phys.build(n) reads the scene (bodies, joints, the shapes' `root` collidable that CollisionSensor looks up), the tick
   accumulates the clock in H = 1/240 s sub-steps, the new position / orientation / velocities are raised as events on each moving RigidBody, joint outputs follow forceOutput, and a
   CollisionSensor reads `st.last` (contacts of the last sub-step) exactly as before. So a ROUTE from RigidBody.position to a Transform, and a CollisionSensor, work with any engine.

   Engine contract (BR.physEngines.register(name, engine)):
     engine.create(ctx)          ctx = { st, node, h, mu, bounce, minBounce, gravity, iterations, bodies: [{ B, node, fixed, mass, shapes:[{kind, half|r|height, lp, lq, root}], ... }], joints, notes }
                                 returns a handle { step(h), pullInto(B), pushFrom(B), contacts() , dispose() }; a joint or shape the engine cannot take is pushed to ctx.notes, never dropped silently
     handle.step(h)              advance the world by h; afterwards B.x / B.q / B.v / B.w hold the new state
     handle.contacts()           the contacts of that sub-step in the bridge format { a, b, n, p, depth, ga, gb, ba, bb } (n from a to b, depth >= 0 touching or penetrating)
   Selection: BR.physEngines.use('rapier') for every collection, or  n._engine = 'cannon'  on one RigidBodyCollection node. 'builtin' is the original solver and is the default. */
(function () {
  'use strict';
  const BR = window.__bridge, events = window.__events, P = BR.phys;
  if (!P || BR.physEngines) return;
  const builtinTick = P.tick, H = 1 / 240;
  const E = BR.physEngines = { engines: {}, current: 'builtin', contactMode: 'last', notes: [], version: 'ENG-1' };
  E.register = (name, eng) => { E.engines[name] = eng; return E; };
  /* hingeStop: what a SingleAxisHingeJoint with the default range (minAngle -pi, maxAngle pi) does in Rapier and cannon-es.
     'engine' (default): no stop, the hinge turns freely, and the adapter says so in its notes. This is ODE's convention, the engine the component was modelled on: "For rotational joints, this stop must be
                         greater than -pi to be effective" (ODE user guide 7.5.1), so a stop at exactly +-pi is no stop.
     'x3d':              the stop is applied as X3D 4.0 clause 37.4.12 words it: "A hinge may not travel more than pi radians ... in either direction from its initial position". The built-in engine always does this. */
  E.hingeStop = 'engine';
  E.use = (name, opts) => { if (name !== 'builtin' && !E.engines[name]) throw new Error('physics engine not registered: ' + name); E.current = name; if (opts && opts.contactMode) E.contactMode = opts.contactMode;
    const hs = (opts && opts.hingeStop) || 'engine'; if (hs !== 'engine' && hs !== 'x3d') throw new Error("hingeStop must be 'engine' or 'x3d': " + hs); E.hingeStop = hs; return E; };
  E.hingeNote = (J, engine) => 'SingleAxisHingeJoint ' + (J.node.def || '') + ': default minAngle/maxAngle (-pi, pi) taken as no stop in ' + engine + ", so the hinge turns freely (ODE's convention). X3D 4.0 clause 37.4.12 stops a hinge pi from its initial position, and the built-in engine does; use({ hingeStop: 'x3d' }) to apply that stop here";
  E.list = () => ['builtin', ...Object.keys(E.engines)];

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
  const rotv = (q, v) => { const t = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [t[0], t[1], t[2]]; };
  const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-12);

  /* ---- shapes: the exact ones (the built-in engine turns Cylinder and Cone into bounding spheres) ----------------------------------------------------------------------------------------- */
  const shapesOf = (node, lp, lq, out) => {
    if (!node || node.f.enabled === false) return out;
    const p = add(lp, rotv(lq, node.f.translation || [0, 0, 0])), q = qmul(lq, P.fromAA(node.f.rotation || [0, 0, 1, 0]));
    if (node.type === 'CollidableOffset') return shapesOf(node.f.collidable, p, q, out);
    const sh = node.f.shape, g = sh && ([sh.f.geometry].concat(sh.f.children || []).find((k) => k && k.f && ('size' in k.f || 'radius' in k.f || 'bottomRadius' in k.f)));
    if (!g) return out;
    if (g.type === 'Box') out.push({ kind: 'box', half: mul(g.f.size, 0.5), lp: p, lq: q });
    else if (g.type === 'Sphere') out.push({ kind: 'sphere', r: g.f.radius, lp: p, lq: q });
    else if (g.type === 'Cylinder') out.push({ kind: 'cylinder', r: g.f.radius, height: g.f.height, lp: p, lq: q });
    else if (g.type === 'Cone') out.push({ kind: 'cone', r: g.f.bottomRadius, height: g.f.height, lp: p, lq: q });
    return out;
  };
  const volume = (s) => s.kind === 'box' ? 8 * s.half[0] * s.half[1] * s.half[2] : s.kind === 'sphere' ? (4 / 3) * Math.PI * s.r ** 3 : s.kind === 'cylinder' ? Math.PI * s.r * s.r * s.height : Math.PI * s.r * s.r * s.height / 3;
  /* principal moments about the shape's own centre (cone: about its bounding-box centre, not its centre of mass, which sits h/4 below: the inertia of a cone about its own COM is used and the
     offset enters through the parallel-axis term, see inertiaOf) */
  const selfInertia = (s, m) => s.kind === 'box' ? [m / 3 * (s.half[1] ** 2 + s.half[2] ** 2), m / 3 * (s.half[0] ** 2 + s.half[2] ** 2), m / 3 * (s.half[0] ** 2 + s.half[1] ** 2)]
    : s.kind === 'sphere' ? [0.4 * m * s.r ** 2, 0.4 * m * s.r ** 2, 0.4 * m * s.r ** 2]
    : s.kind === 'cylinder' ? [m * (3 * s.r ** 2 + s.height ** 2) / 12, m * s.r ** 2 / 2, m * (3 * s.r ** 2 + s.height ** 2) / 12]
    : [m * (3 / 20 * s.r ** 2 + 3 / 80 * s.height ** 2), m * 3 / 10 * s.r ** 2, m * (3 / 20 * s.r ** 2 + 3 / 80 * s.height ** 2)];
  const mm3 = (A, B) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return o; };
  const toM = (q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; };
  const mT = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  /* inertia tensor of the whole body about its ORIGIN (the body position), from its shapes, mass shared by volume: the same rule the built-in engine and X_ITE's Bullet use. Cone: its COM is h/4 below the box centre. */
  const inertiaOf = (shapes, mass) => {
    const tot = shapes.reduce((a, s) => a + volume(s), 0) || 1, I = new Array(9).fill(0);
    for (const s of shapes) {
      const mi = mass * volume(s) / tot, d = selfInertia(s, mi), R = toM(s.lq), Is = mm3(mm3(R, [d[0], 0, 0, 0, d[1], 0, 0, 0, d[2]]), mT(R));
      const off = s.kind === 'cone' ? [0, -s.height / 4, 0] : [0, 0, 0], p = add(s.lp, rotv(s.lq, off)), pp = dot(p, p);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i * 3 + j] += Is[i * 3 + j] + mi * ((i === j ? pp : 0) - p[i] * p[j]);
    }
    return I;
  };
  /* Jacobi eigen decomposition of a symmetric 3x3: principal moments and the rotation (quaternion) of the principal frame */
  const eigen = (A) => {
    const a = [A.slice(0, 3), A.slice(3, 6), A.slice(6, 9)], V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]); if (off < 1e-14) break;
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        if (Math.abs(a[p][q]) < 1e-18) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    // V columns are the eigenvectors; make it a proper rotation, then to a quaternion
    const det = V[0][0] * (V[1][1] * V[2][2] - V[1][2] * V[2][1]) - V[0][1] * (V[1][0] * V[2][2] - V[1][2] * V[2][0]) + V[0][2] * (V[1][0] * V[2][1] - V[1][1] * V[2][0]);
    if (det < 0) for (let k = 0; k < 3; k++) V[k][2] = -V[k][2];
    const m00 = V[0][0], m11 = V[1][1], m22 = V[2][2], tr = m00 + m11 + m22; let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(V[2][1] - V[1][2]) / s, (V[0][2] - V[2][0]) / s, (V[1][0] - V[0][1]) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (V[0][1] + V[1][0]) / s, (V[0][2] + V[2][0]) / s, (V[2][1] - V[1][2]) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(V[0][1] + V[1][0]) / s, s / 4, (V[1][2] + V[2][1]) / s, (V[0][2] - V[2][0]) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(V[0][2] + V[2][0]) / s, (V[1][2] + V[2][1]) / s, s / 4, (V[1][0] - V[0][1]) / s]; }
    return { values: [a[0][0], a[1][1], a[2][2]], q };
  };
  E.util = { shapesOf, volume, inertiaOf, eigen, rotv, qmul, qconj, add, mul, dot };

  /* ---- the per-world context an engine receives ---------------------------------------------------------------------------------------------------------------------------------------- */
  const context = (n, st) => {
    const col = n.f.collider && n.f.collider.f.enabled !== false ? n.f.collider : null, ap = col ? col.f.appliedParameters || [] : [];
    const mu = col && (ap.includes('FRICTION_COEFFICIENT-2') || ap.includes('FRICTION_COEFFICIENT_2')) ? col.f.frictionCoefficients[0] : 0.5;
    const bounce = col && ap.includes('BOUNCE') ? col.f.bounce : 0, minBounce = col ? col.f.minBounceSpeed : 0;
    const bodies = st.bodies.map((B) => {
      const shapes = []; for (const g of B.node.f.geometry || []) { const k0 = shapes.length; shapesOf(g, [0, 0, 0], [0, 0, 0, 1], shapes); for (let i = k0; i < shapes.length; i++) shapes[i].root = g; }
      B.shapes = shapes;                                     // the sensor finds a body by shapes[].root: same roots, now with the exact kinds
      const mass = B.node.f.mass;
      return { B, node: B.node, fixed: B.fixed, mass, shapes, inertia: B.fixed ? null : inertiaOf(shapes, mass) };
    });
    return { st, node: n, h: H, mu, bounce, minBounce, gravity: n.f.gravity.slice(), iterations: Math.max(1, n.f.iterations | 0), bodies, joints: st.joints, notes: [] };
  };

  /* ---- the tick: BR.phys.tick with the engine in place of the built-in step ----------------------------------------------------------------------------------------------------------- */
  const tick = (n, now) => {
    const name = n._engine || E.current;
    if (name === 'builtin') { if (n._ph && n._ph.engine) n._ph = null; return builtinTick(n, now); }
    const eng = E.engines[name]; if (!eng) return builtinTick(n, now);
    if (n.f.enabled === false) { if (n._ph) n._ph.t = null; return; }
    let st = n._ph;
    if (!st || st.engine !== name) {
      st = n._ph = P.build(n); st.engine = name; st.ctx = context(n, st); st.h = eng.create(st.ctx); st.notes = st.ctx.notes; st.gravity0 = st.ctx.gravity.slice();
      for (const m of st.notes) if (!E.notes.includes(m)) E.notes.push(m);
    }
    const hd = st.h, rid = (g) => (g ? (st.rootIds.get(g) ?? (st.rootIds.set(g, st.rootIds.size), st.rootIds.size - 1)) : -1);
    st.rootIds = st.rootIds || new Map();
    for (const B of st.bodies) {                             // a page that set position, orientation or a velocity gets its value taken up
      const f = B.node.f, o = B.out; if (!o) continue;
      let dirty = false;
      if (f.position !== o.position) { B.x = f.position.slice(); dirty = true; } if (f.orientation !== o.orientation) { B.q = P.fromAA(f.orientation); dirty = true; }
      if (f.linearVelocity !== o.linearVelocity) { B.v = f.linearVelocity.slice(); dirty = true; } if (f.angularVelocity !== o.angularVelocity) { B.w = f.angularVelocity.slice(); dirty = true; }
      if (dirty) hd.pushFrom(B);
    }
    if (!same(n.f.gravity, st.gravity0)) { st.gravity0 = n.f.gravity.slice(); st.ctx.gravity = n.f.gravity.slice(); if (hd.setGravity) hd.setGravity(st.ctx.gravity); }
    if (st.t === null || st.t === undefined) { st.t = now; return; }
    st.acc = (st.acc || 0) + Math.min(0.5, Math.max(0, now - st.t)); st.t = now;
    const dtT = now - (st.lastOut ?? now); let ran = false, frame = null; const frameMode = E.contactMode === 'frame';
    /* contacts cost a pass over every pair of the engine's world: they are collected only when a CollisionSensor exists (re-checked when the node count of the world changes) */
    const w = n._w; if (w && st.nNodes !== w.nodes.length) { st.nNodes = w.nodes.length; st.sensors = w.nodes.some((x) => x.type === 'CollisionSensor'); }
    const want = !!st.sensors;
    while (st.acc >= H) {
      hd.step(H); st.acc -= H; ran = true;
      if (want && frameMode) { const cs = hd.contacts(); frame = frame || new Map(); for (const c of cs) { const key = rid(c.ga) + ':' + rid(c.gb) + '|' + st.bodies.indexOf(c.ba) + '|' + st.bodies.indexOf(c.bb); const old = frame.get(key); if (!old || c.depth > old.depth) frame.set(key, c); } st.lastSub = cs; }
    }
    if (!ran) return;
    if (want) {
      const last = frameMode ? st.lastSub : hd.contacts();
      if (frameMode) { const keys = new Set(); for (const c of last) keys.add(rid(c.ga) + ':' + rid(c.gb) + '|' + st.bodies.indexOf(c.ba) + '|' + st.bodies.indexOf(c.bb)); st.last = last.concat([...frame].filter(([k]) => !keys.has(k)).map(([, c]) => c)); }
      else st.last = last;
      st.contacts = st.last.length;
    } else { st.last = []; st.contacts = 0; }
    st.lastOut = now; jointOutputs(st, dtT);
    for (const B of st.bodies) {
      if (!B.invMass) continue; const f = B.node.f, o = B.out || {}, pos = B.x.slice(), ori = P.toAA(B.q), lv = B.v.slice(), av = B.w.slice();
      if (!o.position || !same(o.position, pos)) { f.position = pos; events.emit(B.node, 'position', pos); }
      if (!o.orientation || !same(o.orientation, ori)) { f.orientation = ori; events.emit(B.node, 'orientation', ori); }
      if (!o.linearVelocity || !same(o.linearVelocity, lv)) { f.linearVelocity = lv; events.emit(B.node, 'linearVelocity', lv); }
      if (!o.angularVelocity || !same(o.angularVelocity, av)) { f.angularVelocity = av; events.emit(B.node, 'angularVelocity', av); }
      B.out = { position: f.position, orientation: f.orientation, linearVelocity: f.linearVelocity, angularVelocity: f.angularVelocity };
    }
  };
  const jointOutputs = (st, dt) => {
    for (const J of st.joints) {
      const fo = J.node.f.forceOutput || []; if (!fo.length || (fo.length === 1 && fo[0] === 'NONE')) continue;
      if (st.h.jointState) st.h.jointState(J);
      const o = J.kind.out(J, Math.max(dt, 1e-6)), names = fo.includes('ALL') ? Object.keys(o) : fo.filter((k) => k in o);
      for (const k of names) { const v = o[k], old = J.node.f[k]; const ch = Array.isArray(v) ? !(Array.isArray(old) && same(old, v)) : Math.abs((old || 0) - v) > 1e-9; if (ch) { J.node.f[k] = v; events.emit(J.node, k, v); } }
    }
  };
  P.tick = tick; P.builtinTick = builtinTick;
  /* signed angle of body B about world axis a relative to its start, continuous (the same maths as the built-in `twist`) */
  E.util.twist = (J, a) => {
    const qt = qmul(J.A.q, J.qrel0), qe = qmul(J.B.q, qconj(qt)), w = qe[3] < 0 ? -1 : 1, th = 2 * Math.atan2(w * dot([qe[0], qe[1], qe[2]], a), Math.abs(qe[3]));
    let t = th; if (J.lastTh !== undefined) { while (t - J.lastTh > Math.PI) t -= 2 * Math.PI; while (t - J.lastTh < -Math.PI) t += 2 * Math.PI; } J.lastTh = t; return t;
  };
  E.H = H;
})();
