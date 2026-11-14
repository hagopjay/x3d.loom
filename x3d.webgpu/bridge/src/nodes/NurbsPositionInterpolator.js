/* NurbsPositionInterpolator (NURBS level 1): NurbsPositionInterpolator describes a 3D NURBS curve and outputs interpolated position values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
/* the open curve of an interpolator node (no closed field): null when order and control points cannot make one */
BR.nurbsCurveOf = (n) => { const f = n.f, N = BR.nurbs; return N.curve({ pts: N.points(f.controlPoint && f.controlPoint.f.point, 3), order: f.order, knot: f.knot, weight: f.weight, closed: false }); };
BR.node('NurbsPositionInterpolator', {
  component: 'NURBS', level: 1,
  container: 'children',
  defs: {
    controlPoint: ['SFNode', IO, null],
    knot: ['MFDouble', IO, []],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', IO, 3],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFVec3f', OUT, [0, 0, 0]],
    weight: ['MFDouble', IO, []],
  },
  // set_fraction (clamped to 0..1) walks the whole parameter domain of the curve, knot[order - 1] to knot[last - order + 1]; value_changed is the point of the rational B-spline there. The curve is
  // read from the node's fields at every event, so a changed control point, weight, order or knot shows in the next value. No curve (order < 2, fewer points than the order): no event.
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    n.f.set_fraction = v; const c = BR.nurbsCurveOf(n);
    if (c) BR.emit(n, 'value_changed', c.at(c.param(Math.max(0, Math.min(1, v)))));
    return true;
  },
});
