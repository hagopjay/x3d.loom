/* PositionDamper2D (Followers level 1): PositionDamper2D generates a series of 2D floating-point values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PositionDamper2D', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['SFVec2f', INIT, [0, 0]],
    initialValue: ['SFVec2f', INIT, [0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['SFVec2f', IN, [0, 0]],
    set_value: ['SFVec2f', IN, [0, 0]],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['SFVec2f', OUT, [0, 0]],
  },
  ...BR.damperSpec(BR.TN),     // Followers: as ScalarDamper, over SFVec2f
});
