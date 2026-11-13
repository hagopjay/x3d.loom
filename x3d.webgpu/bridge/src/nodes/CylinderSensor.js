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
  // PointingDeviceSensor, the geometry of X_ITE 16.6.0 (trackPoint_changed compared numerically): the axis is the Y axis turned by axisRotation, the radius is the press point's distance from
  // it. Seen along the axis (the view direction within diskAngle of it) the point is the pointer ray's hit on the plane through the press point; otherwise the pointer ray goes through the
  // screen-aligned plane at the press point and the point is put on the cylinder with Inventor's billboarded section rule (asin across the cylinder, linear beyond it), which stays
  // continuous when the ray leaves the cylinder. The angle is the signed turn of that point about the axis since the press, a press on the far half turns the other way. Unlike X_ITE,
  // which returns a rotation of at most half a turn, the angle is accumulated from the wrapped step between samples, so it runs past a half turn; minAngle <= maxAngle clamps it;
  // the press raises trackPoint_changed and rotation_changed (= offset); autoOffset keeps the result as the next offset.
  dragStart(n, c) {
    const G = BR.geo, q = BR.q.fromRot(n.f.axisRotation), y = R.quat.rotate(q, [0, 1, 0]), back = c.cam.back, hp = c.hit.slice();
    const perp = (p) => G.sub(p, G.scale(y, G.dot(p, y))), r = G.len(perp(hp)) || 1;
    const sx = G.norm(G.cross(y, c.cam.pos)), sz = G.norm(G.cross(sx, y));
    // behind: the press point lies nearer the exit of the ray through the cylinder than the entry
    let behind = false; { const o = c.o, d = G.norm(c.d), po = perp(o), pd = perp(d), a = G.dot(pd, pd), b = 2 * G.dot(po, pd), cc = G.dot(po, po) - r * r, disc = b * b - 4 * a * cc;
      if (a > 1e-12 && disc >= 0) { const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a), e1 = G.at(o, d, Math.min(t1, t2)), e2 = G.at(o, d, Math.max(t1, t2)); behind = G.len(G.sub(hp, e1)) > G.len(G.sub(hp, e2)); } }
    const d = (n._d = { q, y, back, eye: c.cam.pos, r, sx, sz, hp, behind, disk: Math.abs(G.dot(back, y)) > Math.cos(n.f.diskAngle), perp, off: n.f.offset, acc: 0, total: n.f.offset, prev: 0 });
    const tp = BR.cylTrack(d, c), from = d.perp(tp); d.from = from; d.tp = tp;
    BR.fire(n, 'isActive', true); BR.fire(n, 'trackPoint_changed', tp); BR.fire(n, 'rotation_changed', [y[0], y[1], y[2], n.f.offset]);
  },
  dragMove(n, c) {
    const d = n._d, G = BR.geo, tp = BR.cylTrack(d, c); if (!tp) return;
    const a = d.perp(tp), f = d.from, th0 = Math.atan2(G.dot(d.y, G.cross(f, a)), G.dot(f, a));
    let th = th0; if (d.behind && !d.disk) th = -th;
    if (d.disk && G.dot(G.sub(tp, d.eye), d.back) > 0) th += Math.PI;
    let inc = th - d.prev; while (inc > Math.PI) inc -= 2 * Math.PI; while (inc < -Math.PI) inc += 2 * Math.PI;
    d.prev = th; d.acc += inc; d.tp = tp; let t = d.off + d.acc;
    if (n.f.minAngle <= n.f.maxAngle) t = clamp(t, n.f.minAngle, n.f.maxAngle);
    d.total = t;
    BR.fire(n, 'trackPoint_changed', tp); BR.fire(n, 'rotation_changed', [d.y[0], d.y[1], d.y[2], t]);
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset) { n.f.offset = d.total; events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
