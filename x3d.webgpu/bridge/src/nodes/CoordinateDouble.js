/* CoordinateDouble (Rendering level 1): CoordinateDouble builds geometry by defining a set of 3D coordinate (triplet) point values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CoordinateDouble', {
  component: 'Rendering', level: 1,
  container: 'coord',
  defs: {
    metadata: ['SFNode', IO, null],
    point: ['MFVec3d', IO, []],
  },
  // The same job as Coordinate with 64-bit values in the file. The geometry code reads coord.f.point as a flat list, so the point list is kept flat (32-bit in memory: positions are drawn
  // in 32-bit anyway; values beyond float range or finer than 7 digits are not kept, logged as a gap). A change redraws every geometry that holds the node.
  flat: { 'CoordinateDouble.point': Float32Array },
  changed(body, n) { body.geometryChanged(n); },
});
