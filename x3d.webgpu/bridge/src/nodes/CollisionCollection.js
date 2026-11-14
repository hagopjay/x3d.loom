/* CollisionCollection (RigidBodyPhysics level 1): CollisionCollection holds a collection of objects that can be managed as a single entity for resolution of inter-object collisions.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CollisionCollection', {
  component: 'RigidBodyPhysics', level: 1,
  container: 'collider',
  defs: {
    appliedParameters: ['MFString', IO, ["BOUNCE"]],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    bounce: ['SFFloat', IO, 0],
    collidables: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    frictionCoefficients: ['SFVec2f', IO, [0, 0]],
    metadata: ['SFNode', IO, null],
    minBounceSpeed: ['SFFloat', IO, 0.1],
    slipFactors: ['SFVec2f', IO, [0, 0]],
    softnessConstantForceMix: ['SFFloat', IO, 0.0001],
    softnessErrorCorrection: ['SFFloat', IO, 0.8],
    surfaceSpeed: ['SFVec2f', IO, [0, 0]],
    visible: ['SFBool', IO, true],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
