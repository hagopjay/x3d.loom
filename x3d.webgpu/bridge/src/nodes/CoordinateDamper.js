/* CoordinateDamper (Followers level 1): CoordinateDamper generates a series of coordinate arrays that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CoordinateDamper', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['MFVec3f', INIT, []],
    initialValue: ['MFVec3f', INIT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['MFVec3f', IN, []],
    set_value: ['MFVec3f', IN, []],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['MFVec3f', OUT, []],
  },
  ...BR.damperSpec(BR.TL(3)),  // Followers: as ScalarDamper, over a list of SFVec3f
});
