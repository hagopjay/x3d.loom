/* cannon-es (pure JS, float64) behind X3D RigidBodyPhysics. Registers 'cannon' with BR.physEngines (src/engines.js):  BR.physEngines.attach('cannon', CANNON)  or  window.__physLibs = { CANNON }.
   cannon-es has native BallJoint (PointToPointConstraint) and hinge (HingeConstraint, no limits) constraints and nothing else, so the missing X3D joint behaviour is added as custom Equation rows
   (Row below) with the same Jacobians the built-in engine uses: hinge angle limits, SliderJoint (two perpendicular rows, locked rotation, separation limits), UniversalJoint and DoubleAxisHingeJoint
   (anchors meet, axes stay at 90 degrees). Inertia: cannon derives it from the shape's bounding box, which is 66% too high for a sphere, so the principal values from E.util.inertiaOf are set instead
   (diagonal of the body-frame tensor; exact for centred shapes). */
(function () {
  'use strict';
  const BR = window.__bridge, E = BR.physEngines; if (!E) return;
  const U = E.util, JERP = 0.2;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const perp = (a) => { const t1 = norm(Math.abs(a[1]) < 0.9 ? cross(a, [0, 1, 0]) : cross(a, [1, 0, 0])); return [t1, cross(a, t1)]; };
  E.cannonFactory = (C, opt = {}) => {
    const perPair = opt.frictionPerPair !== false;           // see the FrictionEquation note in create()
    class Row extends C.Equation {                           // one scalar constraint row; the owner writes jacobians + err (the violation) before each step
      constructor(bi, bj, lo = -Infinity, hi = Infinity) { super(bi, bj, lo, hi); this.err = 0; }
      computeB(h) { return -this.err * this.a - this.computeGW() * this.b - this.computeGiMf() * h; }
    }
    const setRow = (r, jla, jaa, jlb, jab, err) => { r.jacobianElementA.spatial.set(...jla); r.jacobianElementA.rotational.set(...jaa); r.jacobianElementB.spatial.set(...jlb); r.jacobianElementB.rotational.set(...jab); r.err = err; };
    return {
      name: 'cannon', version: C.version || 'cannon-es',
      create(ctx) {
        const world = new C.World({ gravity: new C.Vec3(...ctx.gravity) });   // native gravity: cannon limits friction by |gravity| (FrictionEquation), so it must not be 0
        world.allowSleep = false; world.quatNormalizeFast = false; world.quatNormalizeSkip = 0;
        if (ctx.bodies.length > 24) world.broadphase = new C.SAPBroadphase(world);     // NaiveBroadphase is O(n^2) pairs; SAP is cannon's own answer for piles
        world.solver.iterations = Math.max(1, ctx.iterations); world.solver.tolerance = 1e-7;
        const mat = new C.Material('x3d'); world.defaultMaterial = mat; world.defaultContactMaterial = new C.ContactMaterial(mat, mat, { friction: ctx.mu, restitution: ctx.bounce });
        const gvec = ctx.gravity.slice(), eb = new Map(), shapeMap = new Map();
        for (const b of ctx.bodies) {
          const B = b.B, f = b.node.f, fixed = b.fixed || !(b.mass > 0);
          const body = new C.Body({ mass: fixed ? 0 : b.mass, type: fixed ? C.Body.STATIC : C.Body.DYNAMIC, material: mat, allowSleep: false,
            position: new C.Vec3(...B.x), quaternion: new C.Quaternion(...B.q), velocity: new C.Vec3(...B.v), angularVelocity: new C.Vec3(...B.w),
            linearDamping: Math.min(0.999, f.linearDampingFactor), angularDamping: Math.min(0.999, f.angularDampingFactor) });
          for (const s of b.shapes) {
            const sh = s.kind === 'box' ? new C.Box(new C.Vec3(...s.half)) : s.kind === 'sphere' ? new C.Sphere(s.r)
              : s.kind === 'cylinder' ? new C.Cylinder(s.r, s.r, s.height, 12) : new C.Cylinder(1e-3, s.r, s.height, 12);
            sh.material = mat; body.addShape(sh, new C.Vec3(...s.lp), new C.Quaternion(...s.lq)); shapeMap.set(sh, { B, shape: s });
          }
          if (!fixed) {
            body.updateMassProperties(); const I = b.inertia;      // the diagonal of the body-frame tensor
            body.inertia.set(I[0], I[4], I[8]); body.invInertia.set(1 / I[0], 1 / I[4], 1 / I[8]); body.updateInertiaWorld(true);
          }
          world.addBody(body); eb.set(B, { body, b, fixed });
        }
        if (perPair) {                                           /* cannon-es bounds a friction equation's multiplier lambda by mu * reducedMass * |g|, and the solver's lambda is an IMPULSE (it is added to the
                                                    velocity through the inverse mass with no dt): the cap is a force of mu m |g| / dt, 240x too large at 1/240 s (raw cannon-es: a unit cube on a slope is only moving
                                                    above 45 degrees (it topples) for mu 0.2 and for mu 0.5, N-ENG-5). Before each solve the bound is replaced by mu * m_red * |g . n| * dt / (points of the pair):
                                                    Coulomb with the load of a body resting on its partner (a stack's lower boxes are under-loaded in this model) */
          const solve = world.solver.solve.bind(world.solver);
          world.solver.solve = (dt, w) => {
            const pair = new Map(); for (const c of w.contacts) { const k = c.bi.id * 65536 + c.bj.id; const e = pair.get(k); if (e) e.n++; else pair.set(k, { n: 1, ni: c.ni }); }
            const gm = w.gravity.length();
            for (const fe of w.frictionEquations) {
              const e = pair.get(fe.bi.id * 65536 + fe.bj.id); if (!e) continue; const inv = fe.bi.invMass + fe.bj.invMass, red = inv > 0 ? 1 / inv : 0;
              const load = Math.abs(w.gravity.x * e.ni.x + w.gravity.y * e.ni.y + w.gravity.z * e.ni.z);
              const lim = ctx.mu * red * load * dt / e.n; fe.maxForce = lim; fe.minForce = -lim;
            }
            return solve(dt, w);
          };
        }
        const rows = [], notes = ctx.notes, joints = [];
        const addRow = (bi, bj, lo, hi) => { const r = new Row(bi, bj, lo, hi); r.setSpookParams(1e7, 4, ctx.h); world.solver.addEquation(r); rows.push(r); return r; };   // removed again each step: cannon rebuilds the equation list
        for (const J of ctx.joints) {
          const t = J.node.type, f = J.node.f, A = eb.get(J.A), B = eb.get(J.B); if (!A || !B) continue;
          if (t === 'BallJoint') { const c = new C.PointToPointConstraint(A.body, new C.Vec3(...J.pa), B.body, new C.Vec3(...J.pb)); world.addConstraint(c); joints.push({ J, t, c }); }
          else if (t === 'SingleAxisHingeJoint') {
            const c = new C.HingeConstraint(A.body, B.body, { pivotA: new C.Vec3(...J.pa), pivotB: new C.Vec3(...J.pb), axisA: new C.Vec3(...J.axA), axisB: new C.Vec3(...J.axB) }); world.addConstraint(c);
            const full = !(f.maxAngle - f.minAngle < 2 * Math.PI - 1e-6), stop = !full || E.hingeStop === 'x3d';      // a full-range hinge has a stop only when the X3D reading is asked for
            if (full && !stop) notes.push(E.hingeNote(J, 'cannon-es'));
            joints.push({ J, t, c, lim: stop ? [f.minAngle, f.maxAngle] : null });
          } else if (t === 'SliderJoint' || t === 'UniversalJoint' || t === 'DoubleAxisHingeJoint') joints.push({ J, t, A, B });
          else if (t === 'MotorJoint') joints.push({ J, t, A, B });
          else { notes.push(t + ': not mapped to cannon-es, left out'); }
          if (t === 'UniversalJoint') notes.push(t + ': mapped with anchors met and axes kept at 90 degrees; not exercised by the test suite');
          if (t === 'DoubleAxisHingeJoint') notes.push(t + ': mapped as a universal joint (anchors meet, axes at 90 degrees); angle limits and motors of the node are not mapped');
        }
        const fixedSolverRows = [];
        const jointRows = (h) => {
          for (const j of joints) {
            const J = j.J, t = j.t, f = J.node.f;
            if (t === 'BallJoint' || t === 'MotorJoint') continue;
            const A = J.A, B = J.B, eA = eb.get(A).body, eB = eb.get(B).body;
            const qA = [eA.quaternion.x, eA.quaternion.y, eA.quaternion.z, eA.quaternion.w], qB = [eB.quaternion.x, eB.quaternion.y, eB.quaternion.z, eB.quaternion.w];
            A.q = qA; B.q = qB; A.x = [eA.position.x, eA.position.y, eA.position.z]; B.x = [eB.position.x, eB.position.y, eB.position.z];
            if (t === 'SingleAxisHingeJoint') {
              if (!j.lim) continue; const a = U.rotv(qA, J.axA), th = U.twist(J, a); J.th = th;
              const add = (lo) => { const r = addRow(eA, eB, 0, Infinity); const s = lo ? 1 : -1; setRow(r, [0, 0, 0], a.map((x) => -s * x), [0, 0, 0], a.map((x) => s * x), lo ? (th - j.lim[0]) : (j.lim[1] - th)); };
              if (th < j.lim[0]) add(true); else if (th > j.lim[1]) add(false);
              continue;
            }
            const wa = U.add(A.x, U.rotv(qA, J.pa)), wb = U.add(B.x, U.rotv(qB, J.pb)), e = sub(wb, wa), ra = sub(wa, A.x), rb = sub(wb, B.x);
            if (t === 'SliderJoint') {
              const ax = U.rotv(qA, J.axA), d = sub(B.x, A.x), pl = U.rotv(qA, J.d0), [n1, n2] = perp(ax), dd = sub(d, pl);
              for (const n of [n1, n2]) setRow(addRow(eA, eB), n.map((x) => -x), [0, 0, 0], n, [0, 0, 0], U.dot(dd, n));
              const qt = U.qmul(qA, J.qrel0), qe = U.qmul(qB, U.qconj(qt)), w = qe[3] < 0 ? -1 : 1, th = [qe[0] * 2 * w, qe[1] * 2 * w, qe[2] * 2 * w];
              for (let i = 0; i < 3; i++) { const n = [0, 0, 0]; n[i] = 1; setRow(addRow(eA, eB), [0, 0, 0], n.map((x) => -x), [0, 0, 0], n, th[i]); }
              const s = U.dot(d, ax); J.sep = s;
              const lo = f.minSeparation, hi = f.maxSeparation;
              if (s < lo) setRow(addRow(eA, eB, 0, Infinity), ax.map((x) => -x), [0, 0, 0], ax, [0, 0, 0], s - lo); else if (s > hi) setRow(addRow(eA, eB, 0, Infinity), ax, [0, 0, 0], ax.map((x) => -x), [0, 0, 0], hi - s);
              continue;
            }
            // UniversalJoint, DoubleAxisHingeJoint: the anchors meet ...
            for (let i = 0; i < 3; i++) { const n = [0, 0, 0]; n[i] = 1; setRow(addRow(eA, eB), n.map((x) => -x), cross(ra, n).map((x) => -x), n, cross(rb, n), e[i]); }
            // ... and the axes stay at 90 degrees
            const a1 = U.rotv(qA, J.axA), a2 = U.rotv(qB, J.axB), c = cross(a1, a2); setRow(addRow(eA, eB), [0, 0, 0], c, [0, 0, 0], c.map((x) => -x), U.dot(a1, a2));
            J.th = U.twist(J, a1);
          }
        };
        const clearRows = () => { for (const r of rows) { const i = world.solver.equations.indexOf(r); if (i >= 0) world.solver.equations.splice(i, 1); } rows.length = 0; };
        const pull = () => { for (const [B, e] of eb) { if (e.fixed) continue; const b = e.body; B.x = [b.position.x, b.position.y, b.position.z]; B.q = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]; B.v = [b.velocity.x, b.velocity.y, b.velocity.z]; B.w = [b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z]; } };
        let gv = ctx.gravity.slice();
        return {
          step(h) {
            for (const [, e] of eb) { if (e.fixed) continue; const f = e.b.node.f, b = e.body; b.force.set(0, 0, 0); b.torque.set(0, 0, 0);
              if (f.useGlobalGravity === false) { b.force.x -= gv[0] * b.mass; b.force.y -= gv[1] * b.mass; b.force.z -= gv[2] * b.mass; }
              for (const k of f.forces || []) { b.force.x += k[0]; b.force.y += k[1]; b.force.z += k[2]; } for (const k of f.torques || []) { b.torque.x += k[0]; b.torque.y += k[1]; b.torque.z += k[2]; } }
            for (const j of joints) if (j.t === 'MotorJoint') { const f = j.J.node.f, n = Math.max(0, Math.min(3, f.enabledAxes | 0)), T = [f.axis1Torque, f.axis2Torque, f.axis3Torque], X = [f.motor1Axis, f.motor2Axis, f.motor3Axis];
              const eA = eb.get(j.J.A).body, eB = eb.get(j.J.B).body; for (let i = 0; i < n; i++) { if (!T[i]) continue; const a = U.rotv([eA.quaternion.x, eA.quaternion.y, eA.quaternion.z, eA.quaternion.w], norm(X[i])); eB.torque.x += a[0] * T[i]; eB.torque.y += a[1] * T[i]; eB.torque.z += a[2] * T[i]; eA.torque.x -= a[0] * T[i]; eA.torque.y -= a[1] * T[i]; eA.torque.z -= a[2] * T[i]; } }
            clearRows(); jointRows(h);
            world.step(h); pull();
          },
          jointState(J) {
            const t = J.node.type;
            if (t === 'SingleAxisHingeJoint' || t === 'DoubleAxisHingeJoint') { if (!J.th || t === 'SingleAxisHingeJoint') J.th = U.twist(J, U.rotv(J.A.q, J.axA)); }
            else if (t === 'SliderJoint') J.sep = U.dot(U.rotv(J.A.q, J.axA), sub(J.B.x, J.A.x));
            else if (t === 'MotorJoint') { J.angles = J.angles || [0, 0, 0]; J.lastTh3 = J.lastTh3 || [undefined, undefined, undefined]; const X = [J.node.f.motor1Axis, J.node.f.motor2Axis, J.node.f.motor3Axis];
              for (let i = 0; i < 3; i++) { J.lastTh = J.lastTh3[i]; J.angles[i] = U.twist(J, U.rotv(J.A.q, norm(X[i]))); J.lastTh3[i] = J.lastTh; } }
          },
          pushFrom(B) { const e = eb.get(B); if (!e) return; const b = e.body; b.position.set(...B.x); b.quaternion.set(...B.q); b.velocity.set(...B.v); b.angularVelocity.set(...B.w); },
          setGravity(v) { gv = v.slice(); world.gravity.set(...v); },
          contacts() {
            const out = [];
            for (const c of world.contacts) {
              const sa = shapeMap.get(c.si), sb = shapeMap.get(c.sj); if (!sa || !sb || sa.B === sb.B) continue;
              const pi = [c.bi.position.x + c.ri.x, c.bi.position.y + c.ri.y, c.bi.position.z + c.ri.z], pj = [c.bj.position.x + c.rj.x, c.bj.position.y + c.rj.y, c.bj.position.z + c.rj.z];
              const n = [c.ni.x, c.ni.y, c.ni.z], depth = -U.dot(sub(pj, pi), n);                  // ni points out of body i
              out.push({ a: sa.B, b: sb.B, n, p: pi, depth: Math.max(0, depth), ga: sa.shape.root, gb: sb.shape.root, ba: sa.B, bb: sb.B });
            }
            return out;
          },
          dispose() {}, raw: world,
        };
      },
    };
  };
  E.attachCannon = (C) => { E.register('cannon', E.cannonFactory(C)); E.register('cannon-raw', Object.assign(E.cannonFactory(C, { frictionPerPair: false }), { name: 'cannon-raw' })); return E; };
  if (window.__physLibs && window.__physLibs.CANNON) E.attachCannon(window.__physLibs.CANNON);
})();
