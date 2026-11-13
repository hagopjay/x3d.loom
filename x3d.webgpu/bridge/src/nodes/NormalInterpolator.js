/* NormalInterpolator (Interpolation level 2): NormalInterpolator generates a series of normal (perpendicular) 3-tuple SFVec3f values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('NormalInterpolator', {
  component: 'Interpolation', level: 2,
  container: 'children',
  defs: {
    key: ['MFFloat', IO, []],
    keyValue: ['MFVec3f', IO, []],
    metadata: ['SFNode', IO, null],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['MFVec3f', OUT, []],
  },
  // Interpolation component: keyValue holds (keyValue.length / key.length) unit normals per key; value_changed is that many normals, each slerped between the two keys
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    const key = n.f.key, kv = n.f.keyValue; if (!key.length) return true;
    const size = Math.floor(kv.length / key.length), ks = BR.keySearch(key, v); if (!size || !ks) return true;
    const out = [];
    for (let j = 0; j < size; j++) {
      const a = kv[ks[0] * size + j], b = kv[(key.length > 1 ? ks[1] : ks[0]) * size + j], t = ks[2];
      const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (c >= 1) { out.push(a.slice()); continue; }
      const w = Math.acos(Math.max(-1, c)), s = Math.sin(w);
      if (s < 1e-12) { out.push(a.map((x, i) => x + (b[i] - x) * t)); continue; }   // antiparallel normals: no unique arc, fall back to a plain lerp (gap G1)
      const s0 = Math.sin((1 - t) * w) / s, s1 = Math.sin(t * w) / s; out.push(a.map((x, i) => x * s0 + b[i] * s1));
    }
    n.f.value_changed = out; events.emit(n, 'value_changed', out);
    return true;
  },
});
