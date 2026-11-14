/* EdgeEnhancementVolumeStyle (VolumeRendering level 2): EdgeEnhancementVolumeStyle specifies edge enhancement for the volume rendering style.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('EdgeEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    edgeColor: ['SFColorRGBA', IO, [0, 0, 0, 1]],
    enabled: ['SFBool', IO, true],
    gradientThreshold: ['SFFloat', IO, 0.4],
    metadata: ['SFNode', IO, null],
    surfaceNormals: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
