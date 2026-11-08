/* CollisionSensor (RigidBodyPhysics level 1): CollisionSensor generates collision-detection events.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CollisionSensor', {
  component: 'RigidBodyPhysics', level: 1,
  container: 'children',
  defs: {
    collider: ['SFNode', IO, null],
    contacts: ['MFNode', OUT, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    intersections: ['MFNode', OUT, []],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
