/* PointPickSensor (Picking level 1): PointPickSensor tests one or more pickingGeometry points in space as lying inside the provided pickTarget geometry.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PointPickSensor', {
  component: 'Picking', level: 1,
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
    pickedPoint: ['MFVec3f', OUT, []],
    pickingGeometry: ['SFNode', IO, null],
    pickTarget: ['MFNode', IO, []],
    sortOrder: ['SFString', INIT, "CLOSEST"],
  },
  // X3DPickSensorNode: once per timestamp the sensor looks at the Shapes under its pickTarget that lie in a PickableGroup it may see (BR.pick, kit.js) and raises isActive and pickedGeometry
  // when the answer changes. The picking geometry is read in the frame of the sensor's parent. BOUNDS: the box of the PointSet against the box of the target. GEOMETRY: each point of the PointSet that lies in the convex hull of the target goes to pickedPoint (in the sensor's frame, as X_ITE).
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n) { BR.pick.tick(n, 'point'); },
});
