/* SliderJoint (RigidBodyPhysics level 2): SliderJoint constrains all movement between body1 and body2 along a single axis. Contains two RigidBody nodes (containerField values body1, body2).
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SliderJoint', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'joints',
  defs: {
    axis: ['SFVec3f', IO, [0, 1, 0]],
    body1: ['SFNode', IO, null],
    body2: ['SFNode', IO, null],
    forceOutput: ['MFString', IO, ["NONE"]],
    maxSeparation: ['SFFloat', IO, 1],
    metadata: ['SFNode', IO, null],
    minSeparation: ['SFFloat', IO, 0],
    separation: ['SFFloat', OUT, 0],
    separationRate: ['SFFloat', OUT, 0],
    sliderForce: ['SFFloat', IO, 0],
    stopBounce: ['SFFloat', IO, 0],
    stopErrorCorrection: ['SFFloat', IO, 1],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
