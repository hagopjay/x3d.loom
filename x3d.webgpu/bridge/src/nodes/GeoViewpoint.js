/* GeoViewpoint (Geospatial level 1): GeoViewpoint specifies viewpoints using geographic coordinates.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoViewpoint', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    bindTime: ['SFTime', OUT, 0],
    centerOfRotation: ['SFVec3d', IO, [0, 0, 0]],
    description: ['SFString', IO, ""],
    farDistance: ['SFFloat', IO, -1],
    fieldOfView: ['SFFloat', IO, 0.785398],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    isBound: ['SFBool', OUT, false],
    jump: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    navigationInfo: ['SFNode', IO, null],
    nearDistance: ['SFFloat', IO, -1],
    orientation: ['SFRotation', IO, [0, 0, 1, 0]],
    position: ['SFVec3d', IO, [0, 0, 100000]],
    retainUserOffsets: ['SFBool', IO, false],
    set_bind: ['SFBool', IN, false],
    speedFactor: ['SFFloat', INIT, 1.0],
    viewAll: ['SFBool', IO, false],
  },
  /* A camera node bound like Viewpoint. X_ITE 16.6.0 (and the 4.0 XSD) has no set_position, set_orientation, position_changed, geoCoord, elevationScale or navType: this table has none either, and
     the camera never writes `position` (navigation keeps private offsets). The pose is computed in BR.geo (see body-br.js "GeoViewpoint"): position = the local metres of `position`, orientation =
     the frame at `position` (east, up, south: identity looks NORTH with up along the ellipsoid normal, right = east) composed with the field orientation applied inside that frame; centerOfRotation
     is a geographic point too. fieldOfView outside (0, pi) falls back to pi/4 as in X_ITE; near is nearDistance or 0.125, far farDistance or 1e9. The speed factor is (max(height, 0) + 10) / 10
     times speedFactor (X_ITE's own model; reported by BR.geo.speedOf). */
  receive(n, field, v) { if (field !== 'set_bind') return false; if (R.hooks && R.hooks.bind) R.hooks.bind(n, !!v); return true; },
  build(body, n, parent) {
    const r = { node: n, parent, tn: parent }; body.rec.set(n.id, r);
    (body.viewpoints ||= []).includes(n) || body.viewpoints.push(n); (body.vpParent ||= new Map()).set(n, parent);
    return r;
  },
  changed(body, n, field) {
    if (n !== body.bound || !['position', 'orientation', 'centerOfRotation', 'fieldOfView', 'nearDistance', 'farDistance'].includes(field)) return;
    body.pose = body.vpPose(n); body.tr = null; body.applyCamera();
  },
});
BR.geo.speedOf = (n) => {                                  // X_ITE's navigation speed: (height above the ellipsoid, at least 0, + 10) / 10 times speedFactor
  const C = BR.geo.ctx(n), g = BR.geo.toECEF(C.S, n.f.position), h = BR.geo.fromECEF(Object.assign({}, C.S, { sys: 'GD', lonFirst: false }), g)[2];
  return (Math.max(h, 0) + 10) / 10 * (n.f.speedFactor ?? 1);
};
