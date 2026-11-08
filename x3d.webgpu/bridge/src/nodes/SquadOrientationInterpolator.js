/* SquadOrientationInterpolator (Interpolation level 5): SquadOrientationInterpolator performs non-linear interpolation among paired lists of rotation values to produce an SFRotation value_changed output event.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SquadOrientationInterpolator', {
  component: 'Interpolation', level: 5,
  container: 'children',
  defs: {
    key: ['MFFloat', IO, []],
    keyValue: ['MFRotation', IO, []],
    metadata: ['SFNode', IO, null],
    normalizeVelocity: ['SFBool', IO, false],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
  },
  // Interpolation component: SQUAD (spherical cubic) interpolation of rotations; the control quaternions are built from the neighbours and cached until keyValue changes.
  // The 4.0 field table has no `closed` (an open path); normalizeVelocity is read and has no effect on a rotation spline (X_ITE also marks it unsupported)
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const key = n.f.key; if (!key.length || !n.f.keyValue.length) return true;
    if (!n._sq || n._sqKv !== n.f.keyValue || n._sqKey !== key) {
      const q = Array.from(n.f.keyValue, BR.q.fromRot); while (q.length < key.length) q.push(q[q.length - 1].slice());
      n._sq = BR.squadGen(!!n.f.closed, key, q); n._sqQ = q; n._sqKv = n.f.keyValue; n._sqKey = key;
    }
    const ks = BR.keySearch(key, v); if (!ks) return true;
    const o = BR.q.toRot(BR.squadAt(n._sq, ks[0], ks[1], ks[2], n._sqQ));
    n.f.value_changed = o; events.emit(n, 'value_changed', o);
    return true;
  },
});
