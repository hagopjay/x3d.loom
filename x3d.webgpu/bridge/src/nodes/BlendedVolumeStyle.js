/* BlendedVolumeStyle (VolumeRendering level 3): BlendedVolumeStyle combines rendering of two voxel data sets into one by blending voxel values.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BlendedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    renderStyle: ['SFNode', IO, null],
    voxels: ['SFNode', IO, null],
    weightConstant1: ['SFFloat', IO, 0.5],
    weightConstant2: ['SFFloat', IO, 0.5],
    weightFunction1: ['SFString', IO, "CONSTANT"],
    weightFunction2: ['SFString', IO, "CONSTANT"],
    weightTransferFunction1: ['SFNode', IO, null],
    weightTransferFunction2: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
