/* OrientationChaser (Followers level 1): OrientationChaser generates a series of 4-tuple axis-angle SFRotation values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OrientationChaser', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['SFRotation', INIT, [0, 1, 0, 0]],
    initialValue: ['SFRotation', INIT, [0, 1, 0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['SFRotation', IN, [0, 0, 0, 0]],
    set_value: ['SFRotation', IN, [0, 0, 0, 0]],
    value_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
  },
  ...BR.chaserSpec(BR.TR),     // Followers: as ScalarChaser, over rotations (quaternion slerp)
});
