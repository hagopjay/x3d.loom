/* BoundaryEnhancementVolumeStyle (VolumeRendering level 2): BoundaryEnhancementVolumeStyle provides boundary enhancement for the volume rendering style.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BoundaryEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    boundaryOpacity: ['SFFloat', IO, 0.9],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    opacityFactor: ['SFFloat', IO, 2],
    retainedOpacity: ['SFFloat', IO, 0.2],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
