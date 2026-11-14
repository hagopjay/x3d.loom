/* SegmentedVolumeData (VolumeRendering level 2): SegmentedVolumeData displays a segmented voxel dataset with different RenderStyle nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SegmentedVolumeData', {
  component: 'VolumeRendering', level: 2,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    dimensions: ['SFVec3f', IO, [1, 1, 1]],
    metadata: ['SFNode', IO, null],
    renderStyle: ['MFNode', IO, []],
    segmentEnabled: ['MFBool', IO, []],
    segmentIdentifiers: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
    voxels: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
