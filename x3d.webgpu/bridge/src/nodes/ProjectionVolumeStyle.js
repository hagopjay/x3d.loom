/* ProjectionVolumeStyle (VolumeRendering level 2): ProjectionVolumeStyle uses voxel data to directly generate output color.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ProjectionVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    intensityThreshold: ['SFFloat', IO, 0],
    metadata: ['SFNode', IO, null],
    type: ['SFString', IO, "MAX"],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
