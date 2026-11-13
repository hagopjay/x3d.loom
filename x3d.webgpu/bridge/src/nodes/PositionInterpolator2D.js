/* PositionInterpolator2D (Interpolation level 3): PositionInterpolator2D generates a series of SFVec2f values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PositionInterpolator2D', {
  component: 'Interpolation', level: 3,
  container: 'children',
  defs: {
    key: ['MFFloat', IO, []],
    keyValue: ['MFVec2f', IO, []],
    metadata: ['SFNode', IO, null],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFVec2f', OUT, [0, 0]],
  },
  // Interpolation component: linear interpolation of SFVec2f; outside the key range the end values hold (same rule as PositionInterpolator)
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const o = BR.lerpKeys(n.f.key, n.f.keyValue, v, (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
    if (o) { n.f.value_changed = o; events.emit(n, 'value_changed', o); }
    return true;
  },
});
