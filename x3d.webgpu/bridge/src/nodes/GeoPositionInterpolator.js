/* GeoPositionInterpolator (Geospatial level 1): GeoPositionInterpolator animates objects within a geographic coordinate system.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoPositionInterpolator', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    geovalue_changed: ['SFVec3d', OUT, [0, 0, 0]],
    key: ['MFFloat', IO, []],
    keyValue: ['MFVec3d', IO, []],
    metadata: ['SFNode', IO, null],
    set_fraction: ['SFFloat', IN, 0],
    value_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  /* X_ITE 16.6.0: the keys pick a segment like any interpolator (a fraction equal to an inner key takes the LATER segment at weight 0, so duplicate keys make a step; below the first key the first
     value, above the last the last), and the path inside it is a great circle about the earth's centre (about the GeoOrigin's point when there is one) with the radius changed linearly: the
     middle of latitude 0 to latitude 60 is latitude 30.083 and 2.66 km below the ellipsoid, not (30, 0, 0). value_changed is that point in local metres (BR.geo.local frame), geovalue_changed the
     same point in the node's geoSystem. Both are sent on every set_fraction, geovalue_changed first, also when the value did not change. Before any input both hold the first key value. */
  init(n) { BR.geo.interp(n, 0, false); },
  receive(n, field, v) {
    if (field !== 'set_fraction') return false;
    n.f.set_fraction = v; BR.geo.interp(n, v, true); return true;
  },
});
{
  const G = BR.geo;
  G.interp = (n, fr, emit) => {
    const key = n.f.key || [], len = key.length; if (!len) return;
    let kvs = n.f.keyValue || []; if (kvs.length && typeof kvs[0] === 'number') { const t = []; for (let i = 0; i + 2 < kvs.length; i += 3) t.push([kvs[i], kvs[i + 1], kvs[i + 2]]); kvs = t; }   // a list set through the SAI is flat
    const kv = (i) => { const e = kvs[Math.min(i, kvs.length - 1)]; return e ? Array.from(e) : [0, 0, 0]; };   // a short keyValue is padded with its last value
    const at = (i0, i1, t) => {
      const k0 = G.local(n, kv(i0)), k1 = G.local(n, kv(i1)), L0 = Math.hypot(...k0), L1 = Math.hypot(...k1);
      const u0 = L0 ? k0.map((x) => x / L0) : [0, 0, 0], u1 = L1 ? k1.map((x) => x / L1) : [0, 0, 0];
      const c = u0[0] * u1[0] + u0[1] * u1[1] + u0[2] * u1[2], om = Math.acos(Math.max(-1, Math.min(1, c)));
      let d; if (c >= 1) d = u0; else { const s = Math.sin(om), a = Math.sin((1 - t) * om) / s, b = Math.sin(t * om) / s; d = [a * u0[0] + b * u1[0], a * u0[1] + b * u1[1], a * u0[2] + b * u1[2]]; }
      const r = L0 + t * (L1 - L0), p = [d[0] * r, d[1] * r, d[2] * r];
      return [p, G.geoOf(n, p)];
    };
    let out;
    if (len === 1) out = at(0, 0, 0);
    else if (fr <= key[0]) out = at(0, 1, 0);
    else {
      let i1 = 0; while (i1 < len && !(key[i1] > fr)) i1++;
      if (i1 === len) out = at(len - 2, len - 1, 1);
      else { const i0 = i1 - 1, w = Math.max(0, Math.min(1, (fr - key[i0]) / (key[i1] - key[i0]))); out = at(i0, i1, w); }
    }
    n.f.geovalue_changed = out[1]; n.f.value_changed = out[0];
    if (emit) { BR.emit(n, 'geovalue_changed', out[1]); BR.emit(n, 'value_changed', out[0]); }
  };
}
