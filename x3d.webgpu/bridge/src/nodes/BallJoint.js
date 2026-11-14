/* BallJoint (RigidBodyPhysics level 2): BallJoint represents an unconstrained joint between two bodies that pivot about a common anchor point.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BallJoint', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'joints',
  defs: {
    anchorPoint: ['SFVec3f', IO, [0, 0, 0]],
    body1: ['SFNode', IO, null],
    body1AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    body2: ['SFNode', IO, null],
    body2AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    forceOutput: ['MFString', IO, ["NONE"]],
    metadata: ['SFNode', IO, null],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
