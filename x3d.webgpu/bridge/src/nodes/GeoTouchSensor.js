/* GeoTouchSensor (Geospatial level 1): GeoTouchSensor returns geographic coordinates for the object being selected.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoTouchSensor', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, []],
    hitGeoCoord_changed: ['SFVec3d', OUT, [0, 0, 0]],
    hitNormal_changed: ['SFVec3f', OUT, [0, 0, 0]],
    hitPoint_changed: ['SFVec3f', OUT, [0, 0, 0]],
    hitTexCoord_changed: ['SFVec2f', OUT, [0, 0]],
    isActive: ['SFBool', OUT, false],
    isOver: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    touchTime: ['SFTime', OUT, 0],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
