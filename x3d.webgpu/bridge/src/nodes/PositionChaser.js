/* PositionChaser (Followers level 1): PositionChaser generates a series of position values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PositionChaser', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['SFVec3f', INIT, [0, 0, 0]],
    initialValue: ['SFVec3f', INIT, [0, 0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['SFVec3f', IN, [0, 0, 0]],
    set_value: ['SFVec3f', IN, [0, 0, 0]],
    value_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  ...BR.chaserSpec(BR.TN),     // Followers: as ScalarChaser, over SFVec3f
});
