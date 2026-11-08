/* OrientationDamper (Followers level 1): OrientationDamper generates a series of 4-tuple axis-angle SFRotation values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OrientationDamper', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['SFRotation', INIT, [0, 1, 0, 0]],
    initialValue: ['SFRotation', INIT, [0, 1, 0, 0]],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['SFRotation', IN, [0, 0, 0, 0]],
    set_value: ['SFRotation', IN, [0, 0, 0, 0]],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
  },
  ...BR.damperSpec(BR.TR),     // Followers: as ScalarDamper, over rotations; `tolerance` is an angle in radians
});
