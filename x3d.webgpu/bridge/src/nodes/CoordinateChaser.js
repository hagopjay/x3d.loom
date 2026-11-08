/* CoordinateChaser (Followers level 1): CoordinateChaser generates a series of coordinate arrays that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CoordinateChaser', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['MFVec3f', INIT, []],
    initialValue: ['MFVec3f', INIT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['MFVec3f', IN, []],
    set_value: ['MFVec3f', IN, []],
    value_changed: ['MFVec3f', OUT, []],
  },
  ...BR.chaserSpec(BR.TL(3)),  // Followers: as ScalarChaser, over a list of SFVec3f (followed as one flat array)
});
