/* SplineScalarInterpolator (Interpolation level 4): SplineScalarInterpolator performs non-linear interpolation among paired lists of float values and velocities to produce an SFFloat value_changed output event.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SplineScalarInterpolator', {
  component: 'Interpolation', level: 4,
  container: 'children',
  defs: {
    closed: ['SFBool', IO, false],
    key: ['MFFloat', IO, []],
    keyValue: ['MFFloat', IO, []],
    keyVelocity: ['MFFloat', IO, []],
    metadata: ['SFNode', IO, null],
    normalizeVelocity: ['SFBool', IO, false],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFFloat', OUT, 0],
  },
  // as SplinePositionInterpolator, over SFFloat (a one-component spline)
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const o = BR.splineNode(n, v, BR.wrap1, BR.unwrap1);
    if (o !== null) { n.f.value_changed = o; events.emit(n, 'value_changed', o); }
    return true;
  },
});
