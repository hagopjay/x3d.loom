/* ShaderProgram (Shaders level 1): ShaderProgram defines a single vertex or fragment program of a ProgramShader.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ShaderProgram', {
  component: 'Shaders', level: 1,
  container: 'programs',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    description: ['SFString', IO, ""],
    field: ['MFNode', IO, []],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    type: ['SFString', INIT, "VERTEX"],
    url: ['MFString', IO, []],
  },
  /* "Not supported" in X_ITE 16.6.0 (it has no sourceCode field either: the 4.0 UOM lists one, the XSD does not accept it as an attribute). A holder here too: the program is kept and never run,
     the ProgramShader that holds it never becomes valid. */
  build() { return null; },
});
