/* ShadedVolumeStyle (VolumeRendering level 3): All fields fully supported except shadows supported with at least Phong shading at level 3. All fields fully supported with at least Phong shading and Henyey-Gr
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ShadedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    lighting: ['SFBool', IO, false],
    material: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    phaseFunction: ['SFString', INIT, "Henyey-Greenstein"],
    shadows: ['SFBool', IO, false],
    surfaceNormals: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
