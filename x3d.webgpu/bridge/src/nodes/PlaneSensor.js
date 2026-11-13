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
  // PointingDeviceSensor, the arithmetic of X_ITE 16.6.0 (checked numerically against it, trackPoint_changed too). The sensor's frame is the parent's frame at the press; axisRotation turns
  // the plane (its normal is the turned +z through the hit point). Equal min and max on one axis turns the sensor into a line sensor along the other axis: the point is the one of the
  // line nearest the pointer on the screen, not the plane intersection, so a line that runs towards the viewer still works. translation = offset + drag, taken apart in the turned
  // frame, clamped per axis where min <= max, and reported in the sensor's frame (the frame a ROUTE into the sibling Transform needs). X_ITE 16.6.0 computes that last turn and drops the
  // result, so for axisRotation other than the identity its translation_changed is still in the turned frame: the two engines differ by exactly that rotation (the test relates them).
  // The press itself raises trackPoint_changed and translation_changed (= offset), as the standard asks and X_ITE does. autoOffset keeps the last translation as the next offset.
  dragStart(n, c) {
    const f = n.f, q = BR.q.fromRot(f.axisRotation), qi = BR.q.inv(q), mn = f.minPosition, mx = f.maxPosition, rot = (v) => R.quat.rotate(q, v);
    const d = (n._d = { q, qi, line: null, plane: null, tr: f.offset.slice(), start: null, off: f.offset.slice(), c0: c, hitPoint: c.hit.slice() });
    if (mn[0] === mx[0] || mn[1] === mx[1]) {
      const dir = mn[0] === mx[0] ? rot([0, Math.abs(mx[1] - mn[1]), 0]) : rot([Math.abs(mx[0] - mn[0]), 0, 0]);
      d.line = { p: c.hit.slice(), u: R.v3.len(dir) > 1e-12 ? R.v3.norm(dir) : R.v3.norm(rot(mn[0] === mx[0] ? [0, 1, 0] : [1, 0, 0])) };
    } else d.plane = { p: c.hit.slice(), n: rot([0, 0, 1]) };
    BR.fire(n, 'isActive', true);
    const first = d.line ? BR.lineTrack(c, d.line) : BR.geo.rayPlane(c.o, c.d, d.plane.p, d.plane.n);
    if (!first) return;
    d.start = first; d.trackPoint = d.line ? BR.lineTrack(c, { p: [0, 0, 0], u: d.line.u }) || first : first;
    BR.fire(n, 'trackPoint_changed', d.trackPoint); BR.fire(n, 'translation_changed', f.offset.slice()); d.out = f.offset.slice();
  },
  dragMove(n, c) {
    const d = n._d, f = n.f; if (!d.start) return;
    const end = d.line ? BR.lineTrack(c, d.line) : BR.geo.rayPlane(c.o, c.d, d.plane.p, d.plane.n); if (!end) return;
    const tp = d.line ? BR.lineTrack(c, { p: [0, 0, 0], u: d.line.u }) || end : end;
    const tr = R.quat.rotate(d.qi, R.v3.sub(R.v3.add(end, d.off), d.start)), mn = f.minPosition, mx = f.maxPosition;
    if (!(mn[0] > mx[0])) tr[0] = clamp(tr[0], mn[0], mx[0]);
    if (!(mn[1] > mx[1])) tr[1] = clamp(tr[1], mn[1], mx[1]);
    const out = R.quat.rotate(d.q, tr);
    if (!d.trackPoint || tp.some((x, i) => Math.abs(x - d.trackPoint[i]) > 1e-9)) { d.trackPoint = tp; BR.fire(n, 'trackPoint_changed', tp); }
    if (!d.out || out.some((x, i) => Math.abs(x - d.out[i]) > 1e-9)) { d.out = out; BR.fire(n, 'translation_changed', out); }
  },
  dragEnd(n) { const d = n._d; if (n.f.autoOffset && d.out) { n.f.offset = d.out.slice(); events.emit(n, 'offset', n.f.offset); } BR.fire(n, 'isActive', false); },
});
