/* OpacityMapVolumeStyle (VolumeRendering level 1): OpacityMapVolumeStyle specifies that volumetric data is rendered using opacity mapped to a transfer function texture.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OpacityMapVolumeStyle', {
  component: 'VolumeRendering', level: 1,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    transferFunction: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
