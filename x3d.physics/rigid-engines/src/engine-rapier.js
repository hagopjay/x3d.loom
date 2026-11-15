/* Rapier (WASM, @dimforge/rapier3d-compat) behind X3D RigidBodyPhysics. Registers 'rapier' with BR.physEngines (src/engines.js). `lib` is the initialised RAPIER module:
     window.__physLibs = { RAPIER }   or   BR.physEngines.attach('rapier', RAPIER)
   Body origin is the body's centre of mass (as in the built-in engine and X_ITE's Bullet): mass and the principal inertia come from the shapes (E.util.inertiaOf), set as additional mass properties with all
   collider densities 0, so Rapier's own COM and inertia derivation never overrides the X3D rule. */
(function () {
  'use strict';
  const BR = window.__bridge, E = BR.physEngines; if (!E) return;
  const U = E.util, V = (a) => ({ x: a[0], y: a[1], z: a[2] }), Q = (q) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });
  let RAPIER_PGS = 1;
  E.rapierPgs = (n) => { RAPIER_PGS = n; };            // numInternalPgsIterations: more passes per solver iteration, for stiff chains such as a cradle
  const factory = (R) => ({
    name: 'rapier', version: R.version ? R.version() : '?',
    create(ctx) {
      const g = ctx.gravity, world = new R.World(V(g)); world.timestep = ctx.h; world.numSolverIterations = Math.max(1, ctx.iterations); world.numInternalPgsIterations = RAPIER_PGS; const ro = E.rapierOpts || {}; if (ro.contactNaturalFrequency) world.integrationParameters.contact_natural_frequency = ro.contactNaturalFrequency; if (ro.pgs) world.numInternalPgsIterations = ro.pgs;
      const eb = new Map(), colMap = new Map();                 // builtin body -> { rb, cols }, collider handle -> { B, shape }
      const mass = (b) => b.fixed || !(b.mass > 0);
      for (const b of ctx.bodies) {
        const B = b.B, f = b.node.f, fixed = mass(b);
        let desc = fixed ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic();
        desc = desc.setTranslation(...B.x).setRotation(Q(B.q)).setCanSleep(false);
        if (!fixed) {
          const ev = U.eigen(b.inertia), fr = ev.q;
          desc = desc.setLinvel(...B.v).setAngvel(V(B.w)).setLinearDamping(-Math.log(1 - Math.min(0.999, f.linearDampingFactor)))
            .setAngularDamping(-Math.log(1 - Math.min(0.999, f.angularDampingFactor))).setGravityScale(f.useGlobalGravity === false ? 0 : 1)
            .setAdditionalMassProperties(b.mass, V([0, 0, 0]), V(ev.values.map((x) => Math.max(x, 1e-9))), Q(fr));
        }
        const rb = world.createRigidBody(desc), cols = [];
        for (const s of b.shapes) {
          let cd = s.kind === 'box' ? R.ColliderDesc.cuboid(s.half[0], s.half[1], s.half[2]) : s.kind === 'sphere' ? R.ColliderDesc.ball(s.r)
            : s.kind === 'cylinder' ? R.ColliderDesc.cylinder(s.height / 2, s.r) : R.ColliderDesc.cone(s.height / 2, s.r);
          cd = cd.setTranslation(...s.lp).setRotation(Q(s.lq)).setDensity(0).setFriction(ctx.mu).setRestitution(ctx.bounce)
            .setFrictionCombineRule(R.CoefficientCombineRule.Max).setRestitutionCombineRule(R.CoefficientCombineRule.Max);
          const c = world.createCollider(cd, rb); cols.push(c); colMap.set(c.handle, { B, shape: s });
        }
        eb.set(B, { rb, cols, b });
      }
      /* joints. Rapier's anchors and axes are in each body's frame: the loader's J.pa / J.pb / J.axA / J.axB are exactly that */
      const joints = [];
      for (const J of ctx.joints) {
        const t = J.node.type, f = J.node.f, A = eb.get(J.A), B = eb.get(J.B); if (!A || !B) continue;
        const rel = J.qrel0, offAxis = Math.abs(Math.abs(rel[3]) - 1) > 1e-6;
        if (offAxis && ['SingleAxisHingeJoint', 'SliderJoint', 'UniversalJoint', 'DoubleAxisHingeJoint'].includes(t)) ctx.notes.push(t + ' ' + (J.node.def || '') + ': the two bodies start rotated against each other; Rapier aligns the joint frames at load, so the first steps correct that offset');
        let jd = null, lim = null, kind = t;
        const pa = V(J.pa), pb = V(J.pb);
        if (t === 'BallJoint') jd = R.JointData.spherical(pa, pb);
        else if (t === 'SingleAxisHingeJoint') { jd = R.JointData.revoluteWithAxes(pa, pb, V(J.axA), V(J.axB)); lim = [f.minAngle, f.maxAngle]; }
        else if (t === 'SliderJoint') {                  // anchors: A's origin, and the same world point seen from B; Rapier measures the displacement from that rest pose, X3D the absolute separation of the origins
          const d = U.rotv(J.A.q, J.d0), s0 = U.dot(U.rotv(J.A.q, J.axA), d);
          jd = R.JointData.prismatic(V([0, 0, 0]), V(U.rotv(U.qconj(J.B.q), U.mul(d, -1))), V(J.axA)); lim = [f.minSeparation - s0, f.maxSeparation - s0];
        }
        else if (t === 'UniversalJoint' || t === 'DoubleAxisHingeJoint') {
          const c = [J.axA[1] * J.axB[2] - J.axA[2] * J.axB[1], J.axA[2] * J.axB[0] - J.axA[0] * J.axB[2], J.axA[0] * J.axB[1] - J.axA[1] * J.axB[0]], l = Math.hypot(...c) || 1;
          jd = R.JointData.generic(pa, pb, V([c[0] / l, c[1] / l, c[2] / l]), R.JointAxesMask.LinX | R.JointAxesMask.LinY | R.JointAxesMask.LinZ | R.JointAxesMask.AngX);
          ctx.notes.push(t + ': locked relative twist about axis1 x axis2 (generic joint, one shared local axis); angle limits and motors of the node are not mapped');
        } else if (t === 'MotorJoint') { kind = 'motor'; }
        else { ctx.notes.push(t + ': not mapped to Rapier, left out'); continue; }
        if (kind === 'motor') { joints.push({ J, kind, A, B }); continue; }
        const ij = world.createImpulseJoint(jd, A.rb, B.rb, true);
        if (lim && lim[1] > lim[0] && (t === 'SliderJoint' ? isFinite(lim[0]) && isFinite(lim[1]) : lim[1] - lim[0] < 2 * Math.PI - 1e-6)) ij.setLimits(lim[0], lim[1]);
        joints.push({ J, kind, ij, A, B });
      }
      const body = (B) => eb.get(B);
      const pull = () => { for (const [B, e] of eb) { if (e.b.fixed || !(e.b.mass > 0)) continue; const t = e.rb.translation(), r = e.rb.rotation(), v = e.rb.linvel(), w = e.rb.angvel(); B.x = [t.x, t.y, t.z]; B.q = [r.x, r.y, r.z, r.w]; B.v = [v.x, v.y, v.z]; B.w = [w.x, w.y, w.z]; } };
      return {
        step(h) {
          const sub = Math.max(1, (E.rapierOpts && E.rapierOpts.sub) | 0 || 1), hs = h / sub; if (hs !== world.timestep) world.timestep = hs;
          for (const [, e] of eb) { if (e.b.fixed || !(e.b.mass > 0)) continue; const f = e.b.node.f; e.rb.resetForces(true); e.rb.resetTorques(true);
            let F = [0, 0, 0], T = [0, 0, 0]; for (const k of f.forces || []) F = U.add(F, k); for (const k of f.torques || []) T = U.add(T, k); if (F[0] || F[1] || F[2]) e.rb.addForce(V(F), true); if (T[0] || T[1] || T[2]) e.rb.addTorque(V(T), true); }
          for (const j of joints) if (j.kind === 'motor') this._motor(j, h);
          for (let i = 0; i < sub; i++) world.step();
          pull();
          for (const j of joints) this.jointState(j.J);
        },
        _motor(j, h) { const f = j.J.node.f, n = Math.max(0, Math.min(3, f.enabledAxes | 0)), T = [f.axis1Torque, f.axis2Torque, f.axis3Torque], X = [f.motor1Axis, f.motor2Axis, f.motor3Axis];
          for (let i = 0; i < n; i++) { if (!T[i]) continue; const len = Math.hypot(...X[i]) || 1, a = U.rotv(j.J.A.q, U.mul(X[i], 1 / len)), t = U.mul(a, T[i]);
            j.B.rb.addTorque(V(t), true); j.A.rb.addTorque(V(U.mul(t, -1)), true); } },
        jointState(J) {
          const t = J.node.type;
          if (t === 'SingleAxisHingeJoint' || t === 'DoubleAxisHingeJoint') J.th = U.twist(J, U.rotv(J.A.q, J.axA));
          else if (t === 'SliderJoint') J.sep = U.dot(U.rotv(J.A.q, J.axA), [J.B.x[0] - J.A.x[0], J.B.x[1] - J.A.x[1], J.B.x[2] - J.A.x[2]]);
          else if (t === 'MotorJoint') { J.angles = J.angles || [0, 0, 0]; J.lastTh3 = J.lastTh3 || [undefined, undefined, undefined]; const X = [J.node.f.motor1Axis, J.node.f.motor2Axis, J.node.f.motor3Axis];
            for (let i = 0; i < 3; i++) { const len = Math.hypot(...X[i]) || 1; J.lastTh = J.lastTh3[i]; J.angles[i] = U.twist(J, U.rotv(J.A.q, U.mul(X[i], 1 / len))); J.lastTh3[i] = J.lastTh; } }
        },
        pushFrom(B) { const e = body(B); if (!e) return; e.rb.setTranslation(V(B.x), true); e.rb.setRotation(Q(B.q), true); e.rb.setLinvel(V(B.v), true); e.rb.setAngvel(V(B.w), true); },
        setGravity(gv) { world.gravity = V(gv); },
        contacts() {
          const out = [], seen = new Set();
          world.forEachCollider((c1) => {
            world.contactPairsWith(c1, (c2) => {
              const lo = Math.min(c1.handle, c2.handle), hi = Math.max(c1.handle, c2.handle), key = lo * 1048576 + hi; if (seen.has(key)) return; seen.add(key);
              const m1 = colMap.get(c1.handle), m2 = colMap.get(c2.handle); if (!m1 || !m2 || m1.B === m2.B) return;
              if (!m1.B.invMass && !m2.B.invMass) return;
              world.contactPair(c1, c2, (m, flipped) => {
                /* Rapier's contacts are speculative: a fast body is stopped at the surface by a contact that was still `dist` away at the start of the step, so some impact steps have dist > 0 (measured: +0.011 and +0.009 m in 2 of 4 drops; in the other 2 the ball already penetrated by 4 to 6 mm). A manifold counts when a point
                   is touching (dist <= 0) or the solver pushed on it in this step (contactImpulse > 0): "a contact the solver acted on". depth is the penetration, 0 when only speculative. A manifold also lingers for a few steps after the ball has left with its last distance, so a 'last' mode read can see a stale contact: the Rapier
                   'last' count in results/sensor-impact.json is not comparable with the others; 'frame' mode is not affected by this (it asks only whether a contact happened in the tick). */
                let active = false; for (let k = 0, nc = m.numContacts(); k < nc; k++) if (m.contactImpulse(k) > 0) active = true;
                const nS = m.numSolverContacts(), nrm = m.normal(), n = flipped ? [-nrm.x, -nrm.y, -nrm.z] : [nrm.x, nrm.y, nrm.z];      // from c1 to c2
                for (let i = 0; i < nS; i++) {
                  const d = m.solverContactDist(i); if (d > 0 && !active) continue; const p = m.solverContactPoint(i);
                  out.push({ a: m1.B, b: m2.B, n, p: [p.x, p.y, p.z], depth: Math.max(0, -d), ga: m1.shape.root, gb: m2.shape.root, ba: m1.B, bb: m2.B });
                }
              });
            });
          });
          return out;
        },
        dispose() { world.free(); },
        raw: world,
      };
    },
  });
  E.attach = (name, lib) => { if (name === 'rapier') E.register('rapier', factory(lib)); else if (name === 'cannon') E.attachCannon(lib); return E; };
  E.rapierFactory = factory;
  if (window.__physLibs && window.__physLibs.RAPIER) E.attach('rapier', window.__physLibs.RAPIER);
})();
