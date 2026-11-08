/* ScalarDamper (Followers level 1): ScalarDamper generates a series of floating-point values that progressively change from initial value to destination value.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ScalarDamper', {
  component: 'Followers', level: 1,
  container: 'children',
  defs: {
    initialDestination: ['SFFloat', INIT, 0],
    initialValue: ['SFFloat', INIT, 0],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    set_destination: ['SFFloat', IN, 0],
    set_value: ['SFFloat', IN, 0],
    tau: ['SFTime', IO, 0.3],
    tolerance: ['SFFloat', IO, -1],
    value_changed: ['SFFloat', OUT, 0],
  },
  ...BR.damperSpec(BR.T1),     // Followers: `order` cascaded exponential filters, time constant `tau`, stops within `tolerance` (default 1e-4)
});
