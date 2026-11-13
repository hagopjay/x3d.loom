/* TexCoordDamper2D (Followers level 1): TexCoordDamper2D generates a series of 2D floating-point arrays that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TexCoordDamper2D', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['MFVec2f', INIT, []],
    initialValue: ['MFVec2f', INIT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['MFVec2f', IN, []],
    set_value: ['MFVec2f', IN, []],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['MFVec2f', OUT, []],
  },
  ...BR.damperSpec(BR.TL(2)),  // Followers: as ScalarDamper, over a list of SFVec2f
});
