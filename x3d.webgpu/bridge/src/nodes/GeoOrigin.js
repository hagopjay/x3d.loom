/* GeoOrigin (Geospatial level 1): GeoOrigin is deprecated and discouraged (but nevertheless allowed) in X3D version 3.3. GeoOrigin is restored in X3D version 4.0 for special use on devices with
   limited precision.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoOrigin', {
  component: 'Geospatial', level: 1,
  container: 'geoOrigin',
  defs: {
    geoCoords: ['SFVec3d', IO, [0, 0, 0]],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    metadata: ['SFNode', IO, null],
    rotateYUp: ['SFBool', INIT, false],
  },
  /* A data holder: it draws nothing and emits nothing but geoCoords_changed. The nodes that name it as geoOrigin (GeoCoordinate, GeoLocation, GeoTransform, GeoViewpoint, GeoElevationGrid) read
     it at use (BR.geo.ctx), and a run time change of geoCoords makes each of them redo its part in the same timestamp: the geometry data is dropped, a placement matrix is rebuilt, the camera is
     placed again. X_ITE does the same (the dependent node is dirtied after the origin matrix is rebuilt, so it never sees a stale origin). */
  changed(body, n, field) {
    if (field !== 'geoCoords' && field !== 'geoSystem' && field !== 'rotateYUp') return;
    for (const u of BR.geo.users(body.world, n)) {
      u._geoCtx = null; u.version = (u.version || 0) + 1;
      if (u.type === 'GeoCoordinate') body.geometryChanged(u);
      else if (u.type === 'GeoElevationGrid') body.regeo(u);
      else if (u.type === 'GeoLocation' || u.type === 'GeoTransform') BR.geo.place(body, u);
      else if (u.type === 'GeoViewpoint') body.viewpointChanged(u, 'position');
    }
  },
});
