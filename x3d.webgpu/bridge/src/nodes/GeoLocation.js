/* GeoLocation (Geospatial level 1): GeoLocation positions a regular X3D model onto the earth's surface.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoLocation', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    geoCoords: ['SFVec3d', IO, [0, 0, 0]],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
    visible: ['SFBool', IO, true],
  },
  /* A Transform whose matrix is the placement at geoCoords: local +Y is the ellipsoid normal (up), +X east, -Z north, whether or not the GeoOrigin has rotateYUp; the origin is subtracted from
     the translation (or, with rotateYUp, the whole frame is expressed in the origin's frame). Children are drawn in that frame. The matrix is computed in double precision (BR.geo.locationMatrix)
     and handed to a TransformNode. A change of geoCoords or of the GeoOrigin moves the children in the same timestamp. */
  build(body, n, parent, chain) { const r = body.buildGroup(n, parent, chain); BR.geo.place(body, n, r); return r; },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r || !r.tn) return;
    if (field === 'geoCoords') BR.geo.place(body, n, r); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
});
/* placement shared by GeoLocation and GeoTransform: compute the 4x4 in double precision, then give the TransformNode position, rotation and scale (decomposed here so the translation keeps its
   digits until Babylon builds its own 32-bit world matrix) */
{
  const G = BR.geo, mul = (a, b) => G.mul(a, b);
  const rotM = (a, ang) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1, x = a[0] / l, y = a[1] / l, z = a[2] / l, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [c + x * x * t, x * y * t + z * s, x * z * t - y * s, 0, x * y * t - z * s, c + y * y * t, y * z * t + x * s, 0, x * z * t + y * s, y * z * t - x * s, c + z * z * t, 0, 0, 0, 0, 1];
  };
  const scaleM = (s) => [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
  const transM = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
  G.transformMatrix = (T, R, S, SR) => [rotM(SR, -SR[3]), scaleM(S), rotM(SR, SR[3]), rotM(R, R[3]), transM(T)].reduce((a, b) => mul(a, b));
  G.matrixOf = (n) => {
    const f = n.f;
    if (n.type === 'GeoLocation') return G.locationMatrix(n, f.geoCoords);
    const L = G.locationMatrix(n, f.geoCenter);                         // GeoTransform: L^-1 * M * L
    return mul(mul(G.inv(L), G.transformMatrix(f.translation, f.rotation, f.scale, f.scaleOrientation)), L);
  };
  G.apply = (tn, m) => {                                                  // row-vector 4x4 (doubles) -> position, rotationQuaternion, scaling of a TransformNode
    const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]), fl = det < 0 ? -1 : 1;
    const R = BABYLON.Matrix.FromValues(m[0] / sx, m[1] / sx, m[2] / sx, 0, m[4] / sy, m[5] / sy, m[6] / sy, 0, m[8] / sz, m[9] / sz, m[10] / sz, 0, 0, 0, 0, 1);
    tn.position.set(m[12], m[13], m[14]); tn.scaling.set(sx, sy, sz * fl);
    if (fl < 0) { R.setRowFromFloats(2, -R.m[8], -R.m[9], -R.m[10], 0); }
    tn.rotationQuaternion = BABYLON.Quaternion.FromRotationMatrix(R);
  };
  G.place = (body, n, r) => {
    r ||= body.rec.get(n.id); if (!r || !r.tn) return;
    G.apply(r.tn, G.matrixOf(n));
  };
}
