/* CollisionSensor (RigidBodyPhysics level 1): CollisionSensor generates collision-detection events.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CollisionSensor', {
  component: 'RigidBodyPhysics', level: 1,
  container: 'children',
  defs: {
    collider: ['SFNode', IO, null],
    contacts: ['MFNode', OUT, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    intersections: ['MFNode', OUT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
  },
  /* Reads the contacts the physics world left after its last sub-step (BR.phys, RigidBodyCollection.js) once per timestamp. A contact counts when at least one of its two bodies owns a collidable that
     the sensor's OWN collider lists (CollisionSpaces flattened; the world's collider is another job). Only the top-level geometry of a body is a collidable here (list the CollidableOffset, not what it
     holds), and a body with several listed collidables is named by the last one. Touching or penetrating contacts only (the bridge world makes a contact from depth 0). Events, as in X_ITE 16.6.0:
     isActive when it changes; then `intersections` (the listed collidables that took part) and `contacts` (Contact nodes of a pool, the same objects overwritten every frame) on EVERY frame while a
     contact exists; neither is ever cleared, so after the touch ends they keep their last value. `enabled` is read only at load and when `collider` is written (a later change does nothing): X_ITE's
     quirk, copied. A Contact carries the sensor collider's material (appliedParameters, bounce, minBounceSpeed, frictionCoefficients, surfaceSpeed, softness*, slipFactors as slipCoefficients), the
     contact point, the unit normal (pointing from the second body to the first) and the depth; body1, body2, geometry1 and geometry2 are the pair (null in X_ITE, a typo there). */
  init(n, w) { n._w = w; n._pool = []; n._live = n.f.enabled !== false && !!n.f.collider; },
  receive(n, field, v) { if (field === 'collider') n._live = n.f.enabled !== false && !!v && v.type === 'CollisionCollection'; return false; },
  tick(n, now) {
    const col = n.f.collider, w = n._w; if (!n._live || !col || !w) return;
    const listed = BR.phys.flatten(col.f.collidables), sts = w.nodes.filter((x) => x.type === 'RigidBodyCollection' && x._ph).map((x) => x._ph);
    const idx = new Map();                                                    // body -> the last listed collidable it owns
    for (const c of listed) for (const st of sts) for (const B of st.all) if (B.shapes.some((s) => s.root === c)) idx.set(B, c);
    const hits = [], seen = new Set();
    for (const st of sts) for (const c of st.last || []) {
      if (!(c.depth >= 0) || !(idx.has(c.ba) || idx.has(c.bb))) continue;
      hits.push(c); for (const B of [c.ba, c.bb]) if (idx.has(B)) seen.add(idx.get(B));
    }
    const active = hits.length > 0;
    if (active !== !!n.f.isActive) BR.fire(n, 'isActive', active);
    if (!active) return;
    const f = col.f, pool = n._pool, out = [];
    hits.forEach((c, i) => {
      let k = pool[i];
      if (!k) {
        k = { type: 'Contact', def: null, f: {}, id: R.allocNodeId(), out: null };
        for (const [name, [, , d]] of Object.entries(R.DEFS.Contact)) k.f[name] = R.clone(d);
        w.nodes.push(k); pool[i] = k;
      }
      const sw = c.a !== c.ba;                                                // a, b follow the solver (a sphere-box pair may be swapped), ba, bb follow the pair of shapes
      const kf = k.f; kf.position = c.p.slice(); kf.contactNormal = [-c.n[0], -c.n[1], -c.n[2]]; kf.depth = c.depth;
      kf.appliedParameters = f.appliedParameters.slice(); kf.bounce = f.bounce; kf.minBounceSpeed = f.minBounceSpeed; kf.frictionCoefficients = f.frictionCoefficients.slice(); kf.surfaceSpeed = f.surfaceSpeed.slice();
      kf.slipCoefficients = f.slipFactors.slice(); kf.softnessConstantForceMix = f.softnessConstantForceMix; kf.softnessErrorCorrection = f.softnessErrorCorrection;
      kf.body1 = c.a.node; kf.body2 = c.b.node; kf.geometry1 = sw ? c.gb : c.ga; kf.geometry2 = sw ? c.ga : c.gb;
      out.push(k);
    });
    BR.fire(n, 'intersections', [...seen]); BR.fire(n, 'contacts', out);
  },
});
