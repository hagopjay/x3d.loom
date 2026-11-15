/* GeoProximitySensor (Geospatial level 2): GeoProximitySensor generates events when the viewer enters, exits and moves within a region of space (defined by a box).
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoProximitySensor', {
  component: 'Geospatial', level: 2,
  container: 'children',
  defs: {
    center: ['SFVec3d', IO, [0, 0, 0]],
    centerOfRotation_changed: ['SFVec3f', OUT, [0, 0, 0]],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    enterTime: ['SFTime', OUT, 0],
    exitTime: ['SFTime', OUT, 0],
    geoCenter: ['SFVec3d', IO, [0, 0, 0]],
    geoCoord_changed: ['SFVec3d', OUT, [0, 0, 0]],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    orientation_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
    position_changed: ['SFVec3f', OUT, [0, 0, 0]],
    size: ['SFVec3f', IO, [0, 0, 0]],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
