/* CartoonVolumeStyle (VolumeRendering level 3): CartoonVolumeStyle generates cartoon-style non-photorealistic rendering of associated volumetric data.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CartoonVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    colorSteps: ['SFInt32', IO, 4],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    orthogonalColor: ['SFColorRGBA', IO, [1, 1, 1, 1]],
    parallelColor: ['SFColorRGBA', IO, [0, 0, 0, 1]],
    surfaceNormals: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
