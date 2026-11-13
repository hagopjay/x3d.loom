/* ScalarChaser (Followers level 1): ScalarChaser generates a series of single floating-point values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ScalarChaser', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['SFFloat', INIT, 0],
    initialValue: ['SFFloat', INIT, 0],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['SFFloat', IN, 0],
    set_value: ['SFFloat', IN, 0],
    value_changed: ['SFFloat', OUT, 0],
  },
  ...BR.chaserSpec(BR.T1),     // Followers: 60-stage chaser, cosine step response over `duration`
});
