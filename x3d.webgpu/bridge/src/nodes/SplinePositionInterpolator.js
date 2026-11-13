/* SplinePositionInterpolator (Interpolation level 4): SplinePositionInterpolator performs non-linear interpolation among paired lists of 3-tuple values and velocities to produce an SFVec3f value_changed output even
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SplinePositionInterpolator', {
  component: 'Interpolation', level: 4,
  container: 'children',
  defs: {
    closed: ['SFBool', IO, false],
    key: ['MFFloat', IO, []],
    keyValue: ['MFVec3f', IO, []],
    keyVelocity: ['MFVec3f', IO, []],
    metadata: ['SFNode', IO, null],
    normalizeVelocity: ['SFBool', IO, false],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  // Interpolation component: cubic Hermite spline through keyValue with Catmull-Rom tangents (keyVelocity overrides them); closed joins the ends; the end values hold outside the keys
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const o = BR.splineNode(n, v, BR.wrapN, BR.unwrapN);
    if (o) { n.f.value_changed = o; events.emit(n, 'value_changed', o); }
    return true;
  },
});
