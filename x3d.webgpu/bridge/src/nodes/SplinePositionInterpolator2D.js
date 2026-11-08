/* SplinePositionInterpolator2D (Interpolation level 4): SplinePositionInterpolator2D performs non-linear interpolation among paired lists of 2-tuple values and velocities to produce an SFVec2f value_changed output ev
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SplinePositionInterpolator2D', {
  component: 'Interpolation', level: 4,
  container: 'children',
  defs: {
    closed: ['SFBool', IO, false],
    key: ['MFFloat', IO, []],
    keyValue: ['MFVec2f', IO, []],
    keyVelocity: ['MFVec2f', IO, []],
    metadata: ['SFNode', IO, null],
    normalizeVelocity: ['SFBool', IO, false],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFVec2f', OUT, [0, 0]],
  },
  // as SplinePositionInterpolator, over SFVec2f
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const o = BR.splineNode(n, v, BR.wrapN, BR.unwrapN);
    if (o) { n.f.value_changed = o; events.emit(n, 'value_changed', o); }
    return true;
  },
});
