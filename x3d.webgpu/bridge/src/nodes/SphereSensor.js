/* SphereSensor (PointingDeviceSensor level 1): SphereSensor converts pointing device motion into a spherical rotation about the origin of the local coordinate system.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SphereSensor', {
  component: 'PointingDeviceSensor', level: 1,
  container: 'children',
  defs: {
    autoOffset: ['SFBool', IO, true],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    isActive: ['SFBool', OUT, false],
    isOver: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    offset: ['SFRotation', IO, [0, 1, 0, 0]],
    rotation_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
    trackPoint_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  // PointingDeviceSensor, the arithmetic of X_ITE 16.6.0 (compared numerically, trackPoint_changed included). The sphere is about the sensor's origin through the press point; the point is
  // the near hit of the pointer ray (the far one when the press was on the far half). A ray that misses the sphere goes through the screen-aligned plane at the last point and is carried
  // back onto the sphere (a point on the silhouette, then one turned behind it), so the ball keeps turning past the rim. rotation = offset * (press point -> track point); the press
  // raises trackPoint_changed (the press point) and rotation_changed (= offset). autoOffset keeps the result as the next offset.
  dragStart(n, c) {
    const hp = c.hit.slice();
    n._d = { hp, r: BR.geo.len(hp) || 1, behind: BR.geo.dot(c.cam.back, hp) < 0, zp: [0, 0, 0], off: BR.q.fromRot(n.f.offset), rot: n.f.offset.slice() };
    BR.fire(n, 'isActive', true); BR.fire(n, 'trackPoint_changed', hp); BR.fire(n, 'rotation_changed', n.f.offset.slice());
  },
  dragMove(n, c) {
    const d = n._d, G = BR.geo, o = c.o, dir = G.norm(c.d), back = c.cam.back;
    const hits = (p, u) => { const b = 2 * G.dot(p, u), cc = G.dot(p, p) - d.r * d.r, core = b * b - 4 * cc; if (core < 0) return null; const sq = Math.sqrt(core), t1 = (-b - sq) / 2, t2 = (-b + sq) / 2; return [G.at(p, u, Math.min(t1, t2)), G.at(p, u, Math.max(t1, t2))]; };
    const h = hits(o, dir); let tp;
    if (h) { tp = d.behind ? h[1] : h[0]; d.zp = tp; }
    else {
      const tg = G.rayPlane(o, dir, d.zp, back); if (!tg) return;
      const near = (p) => hits(p, G.norm(G.scale(p, -1)));
      const a = near(tg); if (!a) return; tp = a[0];
      const tri = G.norm(G.cross(tp, d.hp)), nrm = G.norm(G.cross(tri, G.norm(tp))), p1 = G.sub(tp, G.scale(nrm, G.len(G.sub(tg, tp))));
      const b = near(p1); if (!b) return; tp = b[0];
    }
    const a = R.v3.norm(d.hp), b = R.v3.norm(tp), ang = Math.acos(clamp(G.dot(a, b), -1, 1)), ax = R.v3.cross(a, b);
    let dq = G.len(ax) < 1e-12 ? [0, 0, 0, 1] : R.quat.fromAxisAngle(ax, ang); if (d.behind) dq = BR.q.inv(dq);
    d.rot = BR.q.toRot(R.quat.norm(R.quat.mul(d.off, dq)));
    BR.fire(n, 'trackPoint_changed', tp); BR.fire(n, 'rotation_changed', d.rot);
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset) { n.f.offset = d.rot.slice(); events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
