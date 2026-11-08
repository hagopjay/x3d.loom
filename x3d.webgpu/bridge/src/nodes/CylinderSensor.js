/* CylinderSensor (PointingDeviceSensor level 1): CylinderSensor converts pointer motion (for example, a mouse or wand) into rotation values using an invisible cylinder aligned with local Y-axis.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CylinderSensor', {
  component: 'PointingDeviceSensor', level: 1,
  container: 'children',
  defs: {
    autoOffset: ['SFBool', IO, true],
    axisRotation: ['SFRotation', IO, [0, 0, 1, 0]],
    description: ['SFString', IO, ""],
    diskAngle: ['SFFloat', IO, 0.26179167],
    enabled: ['SFBool', IO, true],
    isActive: ['SFBool', OUT, false],
    isOver: ['SFBool', OUT, false],
    maxAngle: ['SFFloat', IO, -1],
    metadata: ['SFNode', IO, null],
    minAngle: ['SFFloat', IO, 0],
    offset: ['SFFloat', IO, 0],
    rotation_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
    trackPoint_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  // PointingDeviceSensor: rotate about the sensor's Y axis. The radius is the hit point's distance from the axis. Seen along the axis (within diskAngle) the drag uses the plane
  // through the hit point, otherwise the cylinder. The angle is accumulated from the wrapped step between pointer samples, so it runs past a half turn without jumping;
  // minAngle <= maxAngle clamps it; autoOffset keeps the result as the next offset.
  dragStart(n, c) {
    const q = BR.q.fromRot(n.f.axisRotation), qi = BR.q.inv(q), p0 = R.quat.rotate(qi, c.hit), dir = R.v3.norm(R.quat.rotate(qi, c.d));
    const disk = Math.acos(clamp(Math.abs(dir[1]), 0, 1)) < n.f.diskAngle;
    n._d = { qi, q, p0, r: Math.hypot(p0[0], p0[2]) || 1, disk, prev: Math.atan2(p0[0], p0[2]), acc: 0, off: n.f.offset, total: n.f.offset };
    BR.fire(n, 'isActive', true);
  },
  dragMove(n, c) {
    const d = n._d, o = R.quat.rotate(d.qi, c.o), r = R.quat.rotate(d.qi, c.d); let P;
    if (d.disk) { if (Math.abs(r[1]) < 1e-9) return; P = BR.geo.at(o, r, (d.p0[1] - o[1]) / r[1]); } else { P = BR.geo.rayCylinder(o, r, d.r); if (!P) return; }
    const th = Math.atan2(P[0], P[2]); let inc = th - d.prev; while (inc > Math.PI) inc -= 2 * Math.PI; while (inc < -Math.PI) inc += 2 * Math.PI;
    d.prev = th; d.acc += inc; let t = d.off + d.acc;
    if (n.f.minAngle <= n.f.maxAngle) t = clamp(t, n.f.minAngle, n.f.maxAngle);
    d.total = t; const ax = R.quat.rotate(d.q, [0, 1, 0]);
    BR.fire(n, 'trackPoint_changed', R.quat.rotate(d.q, P)); BR.fire(n, 'rotation_changed', [ax[0], ax[1], ax[2], t]);
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset) { n.f.offset = d.total; events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
