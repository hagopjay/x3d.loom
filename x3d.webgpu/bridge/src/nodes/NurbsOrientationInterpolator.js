/* NurbsOrientationInterpolator (NURBS level 1): NurbsOrientationInterpolator describes a 3D NURBS curve and outputs interpolated orientation values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('NurbsOrientationInterpolator', {
  component: 'NURBS', level: 1,
  container: 'children',
  defs: {
    controlPoint: ['SFNode', IO, null],
    knot: ['MFDouble', IO, []],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', IO, 3],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
    weight: ['MFDouble', IO, []],
  },
  // value_changed turns the +Z axis onto the direction of the curve at set_fraction (the first derivative of the rational B-spline, so an object that points along +Z follows the curve): the
  // shortest turn, and for a curve that runs along -Z half a circle about +Y (the same choice as X_ITE 16.6.0). A stopped curve (zero derivative) raises no event.
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    n.f.set_fraction = v; const c = BR.nurbsCurveOf(n);
    if (c) { const d = c.deriv(c.param(Math.max(0, Math.min(1, v)))).d; if (Math.hypot(d[0], d[1], d[2]) > 1e-12) BR.emit(n, 'value_changed', BR.nurbs.rotateTo([0, 0, 1], d)); }
    return true;
  },
});
