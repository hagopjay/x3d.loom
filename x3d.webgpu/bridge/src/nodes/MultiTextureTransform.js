/* MultiTextureTransform (Texturing level 2): MultiTextureTransform contains multiple TextureTransform nodes, each provided for use by corresponding ImageTexture MovieTexture or PixelTexture nodes within a 
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
// TextureTransform lives in the Kansei extension (drift-ext.js) in the older readers; the same table is declared here when no extension has, so this node's children parse anywhere
if (!DEFS.TextureTransform) { DEFS.TextureTransform = { translation: ['SFVec2f', IO, [0, 0]], rotation: ['SFFloat', IO, 0], scale: ['SFVec2f', IO, [1, 1]], center: ['SFVec2f', IO, [0, 0]], metadata: ['SFNode', IO, null] }; CONTAINER.TextureTransform = 'textureTransform'; }
BR.node('MultiTextureTransform', {
  component: 'Texturing', level: 2,
  container: 'textureTransform',
  defs: {
    metadata: ['SFNode', IO, null],
    textureTransform: ['MFNode', IO, []],
  },
  // X3DTextureTransformNode: one TextureTransform per stage of a MultiTexture; a single TextureTransform in the Appearance applies to every stage. The body (body-br) moves each stage's
  // image on the combining canvas by the inverse of the texture-coordinate transform (tc' = T + C + R S (tc - C)). Read when the MultiTexture is built; later edits are not followed (gap).
});
