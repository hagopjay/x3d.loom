/* ComposedVolumeStyle (VolumeRendering level 3): ComposedVolumeStyle allows compositing multiple rendering styles into single rendering pass.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ComposedVolumeStyle', {
  component: 'VolumeRendering', level: 3,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    renderStyle: ['MFNode', IO, []],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
