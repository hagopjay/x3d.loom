/* PrimitivePickSensor (Picking level 2): If a non-uniform scale is applied to the pick sensor, correct results may require level 3 support.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PrimitivePickSensor', {
  component: 'Picking', level: 2,
  container: 'children',
  defs: {
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    intersectionType: ['SFString', INIT, "BOUNDS"],
    isActive: ['SFBool', OUT, false],
    matchCriterion: ['SFString', IO, "MATCH_ANY"],
    metadata: ['SFNode', IO, null],
    objectType: ['MFString', IO, ['ALL']],
    pickedGeometry: ['MFNode', OUT, []],
    pickingGeometry: ['SFNode', IO, null],
    pickTarget: ['MFNode', IO, []],
    sortOrder: ['SFString', INIT, "CLOSEST"],
  },
  // X3DPickSensorNode: once per timestamp the sensor looks at the Shapes under its pickTarget that lie in a PickableGroup it may see (BR.pick, kit.js) and raises isActive and pickedGeometry
  // when the answer changes. The picking geometry is read in the frame of the sensor's parent. BOUNDS: oriented box against oriented box. GEOMETRY: the convex hulls of the Box, Cone, Cylinder or Sphere and of the target (GJK); a Sphere is a 162 point hull, so it is 0.4 percent smaller than the true sphere.
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n) { BR.pick.tick(n, 'primitive'); },
});
