/* GeoTouchSensor (Geospatial level 1): GeoTouchSensor returns geographic coordinates for the object being selected.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoTouchSensor', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    hitGeoCoord_changed: ['SFVec3d', OUT, [0, 0, 0]],
    hitNormal_changed: ['SFVec3f', OUT, [0, 0, 0]],
    hitPoint_changed: ['SFVec3f', OUT, [0, 0, 0]],
    hitTexCoord_changed: ['SFVec2f', OUT, [0, 0]],
    isActive: ['SFBool', OUT, false],
    isOver: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    touchTime: ['SFTime', OUT, 0],
  },
  /* A TouchSensor that also reports where it was hit in geographic terms. The output is `hitGeoCoord_changed` (there is no geoCoords_changed). Hover order: isOver, hitTexCoord_changed,
     hitNormal_changed, hitPoint_changed, hitGeoCoord_changed. hitPoint and hitNormal are in the sensor's own (parent group) frame; hitGeoCoord is that LOCAL hitPoint read through the sensor's geoSystem
     and GeoOrigin (BR.geo.geoOf), which X_ITE 16.6.0 does and which is only the true position of the hit when no Transform or GeoLocation sits above the sensor: followed on purpose. The pointer handling is in
     body-br.js (sensorsFor, setOver, geoHit); a click is the press and release together (isActive true then false, touchTime) and the hit outputs follow it. */
});
