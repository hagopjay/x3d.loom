/* PositionChaser2D (Followers level 1): PositionChaser2D generates a series of 2D position values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PositionChaser2D', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['SFVec2f', INIT, [0, 0]],
    initialValue: ['SFVec2f', INIT, [0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['SFVec2f', IN, [0, 0]],
    set_value: ['SFVec2f', IN, [0, 0]],
    value_changed: ['SFVec2f', OUT, [0, 0]],
  },
  ...BR.chaserSpec(BR.TN),     // Followers: as ScalarChaser, over SFVec2f
});
