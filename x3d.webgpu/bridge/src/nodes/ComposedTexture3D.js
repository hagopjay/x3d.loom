/* ComposedTexture3D (Texturing3D level 1): ComposedTexture3D defines a 3D image-based texture map as a collection of 2D texture sources at various depths.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ComposedTexture3D', {
  component: 'Texturing3D', level: 1,
  container: 'texture',
  defs: {
    description: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    repeatR: ['SFBool', INIT, false],
    repeatS: ['SFBool', INIT, false],
    repeatT: ['SFBool', INIT, false],
    texture: ['MFNode', IO, []],
    textureProperties: ['SFNode', INIT, null],
  },
  /* The slices are the 2D textures of `texture`, in depth order. A Shape has 2D texture coordinates only, so the volume is sampled at r = 0 and the first slice is what is drawn (gap, as for
     PixelTexture3D). */
  build() { return null; },
});
