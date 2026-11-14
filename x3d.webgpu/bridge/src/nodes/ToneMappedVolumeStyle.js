/* ToneMappedVolumeStyle (VolumeRendering level 2): ToneMappedVolumeStyle specifies that volumetric data is rendered with Gooch shading model of two-toned warm/cool coloring.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ToneMappedVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    coolColor: ['SFColorRGBA', IO, [0, 0, 1, 0]],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    surfaceNormals: ['SFNode', IO, null],
    warmColor: ['SFColorRGBA', IO, [1, 1, 0, 0]],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
