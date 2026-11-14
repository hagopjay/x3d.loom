/* LinePickSensor (Picking level 1): LinePickSensor uses one or more pickingGeometry line segments to compute intersections with pickTarget shapes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LinePickSensor', {
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
    pickedNormal: ['MFVec3f', OUT, []],
    pickedPoint: ['MFVec3f', OUT, []],
    pickedTextureCoordinate: ['MFVec3f', OUT, []],
    pickingGeometry: ['SFNode', IO, null],
    pickTarget: ['MFNode', IO, []],
    sortOrder: ['SFString', INIT, "CLOSEST"],
  },
  // X3DPickSensorNode: once per timestamp the sensor looks at the Shapes under its pickTarget that lie in a PickableGroup it may see (BR.pick, kit.js) and raises isActive and pickedGeometry
  // when the answer changes. The picking geometry is read in the frame of the sensor's parent. BOUNDS: the box of the line set against the box of the target. GEOMETRY: each line segment against each triangle of the target; pickedPoint, pickedNormal and pickedTextureCoordinate hold one entry per hit, in the target's own coordinates (as X_ITE 16.6.0).
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n) { BR.pick.tick(n, 'line'); },
});
