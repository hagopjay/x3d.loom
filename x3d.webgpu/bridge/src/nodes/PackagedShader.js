/* PackagedShader (Shaders level 1): PackagedShader can contain field declarations, but no CDATA section of plain-text source code.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PackagedShader', {
  component: 'Shaders', level: 1,
  container: 'shaders',
  defs: {
    activate: ['SFBool', IN, false],
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    description: ['SFString', IO, ""],
    field: ['MFNode', IO, []],
    IS: ['SFNode', IO, null],
    isSelected: ['SFBool', OUT, false],
    isValid: ['SFBool', OUT, false],
    language: ['SFString', INIT, ""],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    url: ['MFString', IO, []],
  },
  /* X_ITE 16.6.0 marks this node "not supported": it keeps its fields, never compiles anything, so isValid and isSelected stay FALSE and activate does nothing. The bridge does the same: a
     packaged shader needs a shader language the WebGPU body cannot run (it runs WGSL ports of the known GLSL parts). Author-defined fields (<field>) are not read for this node (the stock reader
     reads them for ComposedShader only) - gap. */
  build() { return null; },
});
