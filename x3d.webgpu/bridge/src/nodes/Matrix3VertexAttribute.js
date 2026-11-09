/* Matrix3VertexAttribute (Shaders level 1): Matrix3VertexAttribute defines a set of per-vertex 3x3 matrix attributes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Matrix3VertexAttribute', {
  component: 'Shaders', level: 1,
  container: 'attrib',
  defs: {
    metadata: ['SFNode', IO, null],
    name: ['xs:NMTOKEN', INIT, ""],
    value: ['MFMatrix3f', IO, []],
  },
  /* Per-vertex matrix attributes are read by a shader program, and the bridge has none (the body runs WGSL ports of known shaders, not GLSL source): the node keeps its name and its values and
     draws nothing (gap). */
  build() { return null; },
});
