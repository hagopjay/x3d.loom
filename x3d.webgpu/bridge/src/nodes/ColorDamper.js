/* ColorDamper (Followers level 1): ColorDamper generates a series of RGB color values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ColorDamper', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['SFColor', INIT, [0.8, 0.8, 0.8]],
    initialValue: ['SFColor', INIT, [0.8, 0.8, 0.8]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['SFColor', IN, [0, 0, 0]],
    set_value: ['SFColor', IN, [0, 0, 0]],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['SFColor', OUT, [0, 0, 0]],
  },
  ...BR.damperSpec(BR.TC),     // Followers: as ScalarDamper, followed in HSV
});
