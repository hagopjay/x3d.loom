/* TexCoordChaser2D (Followers level 1): TexCoordChaser2D generates a series of single floating-point values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TexCoordChaser2D', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['MFVec2f', INIT, []],
    initialValue: ['MFVec2f', INIT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['MFVec2f', IN, []],
    set_value: ['MFVec2f', IN, []],
    value_changed: ['MFVec2f', OUT, []],
  },
  ...BR.chaserSpec(BR.TL(2)),  // Followers: as ScalarChaser, over a list of SFVec2f
});
