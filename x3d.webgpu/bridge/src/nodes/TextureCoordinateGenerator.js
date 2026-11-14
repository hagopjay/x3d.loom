/* TextureCoordinateGenerator (Texturing level 2): TextureCoordinateGenerator computes 2D (s,t) texture-coordinate points, used by vertex-based geometry nodes (such as IndexedFaceSet or ElevationGrid) to map tex
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TextureCoordinateGenerator', {
  component: 'Texturing', level: 2,
  container: 'texCoord',
  defs: {
    mapping: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    mode: ['SFString', IO, "SPHERE"],
    parameter: ['MFFloat', IO, []],
  },
  // X3DTextureCoordinateNode: texture coordinates made from the geometry. Done per vertex when the geometry is built (see body-br genUV): SPHERE, SPHERE-LOCAL and CAMERASPACENORMAL
  // from the normal, COORD, COORD-EYE and CAMERASPACEPOSITION from the position. NOISE and NOISE-EYE use X_ITE's Perlin2 value noise (see body-br tcg.perlin); the reflection modes follow the camera.
  changed(body, n, field) { for (const x of body.world.nodes) if (x.f && x.f.texCoord === n) body.regeo(x); },
});
