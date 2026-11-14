/* NurbsSurfaceInterpolator (NURBS level 1): NurbsSurfaceInterpolator describes a 3D NURBS curve and outputs interpolated position and normal values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.nurbsSurfaceOf = (n) => {
  const f = n.f, N = BR.nurbs;
  return N.surface({ pts: N.points(f.controlPoint && f.controlPoint.f.point, 3), uDim: f.uDimension, vDim: f.vDimension, uOrder: f.uOrder, vOrder: f.vOrder, uKnot: f.uKnot, vKnot: f.vKnot, weight: f.weight, uClosed: false, vClosed: false });
};
BR.node('NurbsSurfaceInterpolator', {
  component: 'NURBS', level: 1,
  container: 'children',
  defs: {
    controlPoint: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    normal_changed: ['SFVec3f', OUT, [0, 0, 0]],
    position_changed: ['SFVec3f', OUT, [0, 0, 0]],
    set_fraction: ['SFVec2f', IN, [0, 0]],
    uDimension: ['SFInt32', INIT, 0],
    uKnot: ['MFDouble', INIT, []],
    uOrder: ['SFInt32', INIT, 3],
    vDimension: ['SFInt32', INIT, 0],
    vKnot: ['MFDouble', INIT, []],
    vOrder: ['SFInt32', INIT, 3],
    weight: ['MFDouble', IO, []],
  },
  // set_fraction (x for u, y for v, each clamped to 0..1) walks the parameter domain of the surface; position_changed is the point of the rational surface there and normal_changed is the
  // UNIT normal dS/du x dS/dv (X_ITE 16.6.0 sends the same direction with the length of the cross product; zero where the surface is degenerate). The control points are read at every event.
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    n.f.set_fraction = v; const s = BR.nurbsSurfaceOf(n);
    if (!s) return true;
    const cl = (x) => Math.max(0, Math.min(1, x)), e = s.deriv(s.uParam(cl(v[0])), s.vParam(cl(v[1]))), a = e.du, b = e.dv;
    const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0], l = Math.hypot(x, y, z);
    BR.emit(n, 'normal_changed', l > 1e-12 ? [x / l, y / l, z / l] : [0, 0, 0]);
    BR.emit(n, 'position_changed', e.p);
    return true;
  },
});
