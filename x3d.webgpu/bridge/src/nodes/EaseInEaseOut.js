/* EaseInEaseOut (Interpolation level 4): EaseInEaseOut enables gradual animation transitions by modifying TimeSensor fraction outputs.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('EaseInEaseOut', {
  component: 'Interpolation', level: 4,
  container: 'children',
  defs: {
    easeInEaseOut: ['MFVec2f', IO, []],
    key: ['MFFloat', IO, []],
    metadata: ['SFNode', IO, null],
    modifiedFraction_changed: ['SFFloat', OUT, 0],
    set_fraction: ['SFFloat', IN, 0],
  },
  // Reshapes a TimeSensor fraction. Per key i the pair is (easeIn, easeOut): the share of the interval that ends at key i is eased in, the share that starts at key i is eased out.
  // Inside one interval the weight w maps to a parabola in, a straight run, a parabola out (X3D 4.0 Interpolation 10.4.2); a pair summing above 1 is scaled down to 1; a negative sum means "no easing".
  // The list is padded to the key count with its last pair (zeros when empty), the same as X_ITE. No key: no output.
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const key = n.f.key, ks = BR.keySearch(key, v); if (!ks) return true;
    const ee = n.f.easeInEaseOut, at = (i) => ee[Math.min(i, ee.length - 1)] || [0, 0];
    let easeOut = at(ks[0])[1], easeIn = at(ks[1])[0], w = ks[2], o;
    const sum = easeOut + easeIn;
    if (sum < 0) o = w;
    else {
      if (sum > 1) { easeIn /= sum; easeOut /= sum; }
      const t = 1 / (2 - easeOut - easeIn);
      if (w < easeOut) o = (t / easeOut) * w * w;
      else if (w <= 1 - easeIn) o = t * (2 * w - easeOut);
      else { const u = 1 - w; o = 1 - (t * u * u) / easeIn; }
    }
    n.f.modifiedFraction_changed = o; events.emit(n, 'modifiedFraction_changed', o);
    return true;
  },
});
