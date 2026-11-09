/* ProgramShader (Shaders level 1): ProgramShader contains no field declarations and no plain-text source code.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ProgramShader', {
  component: 'Shaders', level: 1,
  container: 'shaders',
  defs: {
    activate: ['SFBool', IN, false],
    isSelected: ['SFBool', OUT, false],
    isValid: ['SFBool', OUT, false],
    language: ['SFString', INIT, ""],
    metadata: ['SFNode', IO, null],
    programs: ['MFNode', IO, []],
  },
  /* "Not supported" in X_ITE 16.6.0 and here: the node holds its programs and never becomes valid or selected. */
  build() { return null; },
});
