/* PositionDamper (Followers level 1): PositionDamper generates a series of position values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PositionDamper', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['SFVec3f', INIT, [0, 0, 0]],
    initialValue: ['SFVec3f', INIT, [0, 0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['SFVec3f', IN, [0, 0, 0]],
    set_value: ['SFVec3f', IN, [0, 0, 0]],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['SFVec3f', OUT, [0, 0, 0]],
  },
  ...BR.damperSpec(BR.TN),     // Followers: as ScalarDamper, over SFVec3f
});
