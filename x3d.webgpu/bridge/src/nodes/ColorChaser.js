/* ColorChaser (Followers level 1): ColorChaser generates a series of SFColor values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ColorChaser', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    duration: ['SFTime', INIT, 1],
    initialDestination: ['SFColor', INIT, [0.8, 0.8, 0.8]],
    initialValue: ['SFColor', INIT, [0.8, 0.8, 0.8]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    set_destination: ['SFColor', IN, [0, 0, 0]],
    set_value: ['SFColor', IN, [0, 0, 0]],
    value_changed: ['SFColor', OUT, [0, 0, 0]],
  },
  ...BR.chaserSpec(BR.TC),     // Followers: as ScalarChaser, followed in HSV
});
