/* IsoSurfaceVolumeData (VolumeRendering level 2): IsoSurfaceVolumeData displays one or more surfaces extracted from a voxel dataset.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('IsoSurfaceVolumeData', {
  component: 'VolumeRendering', level: 2,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    contourStepSize: ['SFFloat', IO, 0],
    dimensions: ['SFVec3f', IO, [1, 1, 1]],
    gradients: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    renderStyle: ['MFNode', IO, []],
    surfaceTolerance: ['SFFloat', IO, 0],
    surfaceValues: ['MFFloat', IO, []],
    visible: ['SFBool', IO, true],
    voxels: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
