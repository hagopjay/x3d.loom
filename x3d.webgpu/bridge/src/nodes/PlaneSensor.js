/* PlaneSensor (PointingDeviceSensor level 1): PlaneSensor converts pointing device motion into 2D translation parallel to the local Z=0 plane.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PlaneSensor', {
  component: 'PointingDeviceSensor', level: 1,
  container: 'children',
  defs: {
    autoOffset: ['SFBool', IO, true],
    axisRotation: ['SFRotation', IO, [0, 0, 1, 0]],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    isActive: ['SFBool', OUT, false],
    isOver: ['SFBool', OUT, false],
    maxPosition: ['SFVec2f', IO, [-1, -1]],
    metadata: ['SFNode', IO, null],
    minPosition: ['SFVec2f', IO, [0, 0]],
    offset: ['SFVec3f', IO, [0, 0, 0]],
    trackPoint_changed: ['SFVec3f', OUT, [0, 0, 0]],
    translation_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  // PointingDeviceSensor: drag in the XY plane of the sensor's frame (axisRotation turns that frame). The plane is z = the hit point's z at the press; translation = offset + drag,
  // clamped per axis where min <= max; autoOffset keeps the result as the next offset.
  dragStart(n, c) {
    const qi = BR.q.inv(BR.q.fromRot(n.f.axisRotation)), p0 = R.quat.rotate(qi, c.hit);
    n._d = { qi, p0, off: n.f.offset.slice(), tr: n.f.offset.slice() };
    BR.fire(n, 'isActive', true);
  },
  dragMove(n, c) {
    const d = n._d, o = R.quat.rotate(d.qi, c.o), r = R.quat.rotate(d.qi, c.d); if (Math.abs(r[2]) < 1e-9) return;
    const P = BR.geo.at(o, r, (d.p0[2] - o[2]) / r[2]), mn = n.f.minPosition, mx = n.f.maxPosition, q = BR.q.fromRot(n.f.axisRotation);
    const tr = [d.off[0] + P[0] - d.p0[0], d.off[1] + P[1] - d.p0[1], d.off[2]];
    if (mn[0] <= mx[0]) tr[0] = clamp(tr[0], mn[0], mx[0]);
    if (mn[1] <= mx[1]) tr[1] = clamp(tr[1], mn[1], mx[1]);
    d.tr = tr; BR.fire(n, 'trackPoint_changed', R.quat.rotate(q, P)); BR.fire(n, 'translation_changed', R.quat.rotate(q, tr));
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset) { n.f.offset = d.tr.slice(); events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
