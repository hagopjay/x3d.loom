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
  // PointingDeviceSensor: rotate on a sphere about the sensor's origin whose radius is the hit point's distance; the rotation carries the press point to the pointed point,
  // composed as offset * rotation (the order X_ITE 16.6.0 shows in the two-drag test); autoOffset keeps the result as the next offset.
  dragStart(n, c) { n._d = { p0: c.hit.slice(), r: BR.geo.len(c.hit) || 1, off: BR.q.fromRot(n.f.offset), rot: n.f.offset.slice() }; BR.fire(n, 'isActive', true); },
  dragMove(n, c) {
    const d = n._d, P = BR.geo.raySphere(c.o, c.d, d.r), a = R.v3.norm(d.p0), b = R.v3.norm(P), ang = Math.acos(clamp(BR.geo.dot(a, b), -1, 1));
    const ax = R.v3.cross(a, b), dq = BR.geo.len(ax) < 1e-9 ? [0, 0, 0, 1] : R.quat.fromAxisAngle(ax, ang);
    d.rot = BR.q.toRot(R.quat.norm(R.quat.mul(d.off, dq)));
    BR.fire(n, 'trackPoint_changed', P); BR.fire(n, 'rotation_changed', d.rot);
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset) { n.f.offset = d.rot.slice(); events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
