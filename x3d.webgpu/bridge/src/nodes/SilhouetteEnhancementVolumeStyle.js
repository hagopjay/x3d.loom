/* SilhouetteEnhancementVolumeStyle (VolumeRendering level 2): SilhouetteEnhancementVolumeStyle specifies that volumetric data is rendered with silhouette enhancement.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SilhouetteEnhancementVolumeStyle', {
  component: 'VolumeRendering', level: 2,
  container: 'renderStyle',
  defs: {
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    silhouetteBoundaryOpacity: ['SFFloat', IO, 0],
    silhouetteRetainedOpacity: ['SFFloat', IO, 1],
    silhouetteSharpness: ['SFFloat', IO, 0.5],
    surfaceNormals: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
