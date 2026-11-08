/* FogCoordinate (EnvironmentalEffects level 4): FogCoordinate defines a set of explicit fog depths on a per-vertex basis, overriding Fog visibilityRange.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('FogCoordinate', {
  component: 'EnvironmentalEffects', level: 4,
  container: 'fogCoord',
  defs: {
    depth: ['MFFloat', IO, []],
    metadata: ['SFNode', IO, null],
  },
  /* the geometry nodes the stock reader draws get the fogCoord field (the bridged geometry sets have it from X3DUOM already). Drawing is in LocalFog.js (BR.fog.coord): a vertex's fog amount is
     its depth (0 clear, 1 fully fogged) in place of the distance law, and only where a LocalFog or the Fog covers the shape. Vertices past the end of depth read as 0. */
  extend: { IndexedTriangleSet: { fogCoord: ['SFNode', IO, null] } },
  changed(body) { body._fcN = (body._fcN || 0) + 1; },
});
