/* Matrix4VertexAttribute (Shaders level 1): Matrix4VertexAttribute defines a set of per-vertex 4x4 matrix attributes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Matrix4VertexAttribute', {
  component: 'Shaders', level: 1,
  container: 'attrib',
  defs: {
    metadata: ['SFNode', IO, null],
    name: ['xs:NMTOKEN', INIT, ""],
    value: ['MFMatrix4f', IO, []],
  },
  /* As Matrix3VertexAttribute: held for a shader program that the bridge does not run (gap). */
  build() { return null; },
});
