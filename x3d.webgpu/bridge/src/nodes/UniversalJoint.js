/* UniversalJoint (RigidBodyPhysics level 2): UniversalJoint is like a BallJoint that constrains an extra degree of rotational freedom.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('UniversalJoint', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'joints',
  defs: {
    anchorPoint: ['SFVec3f', IO, [0, 0, 0]],
    axis1: ['SFVec3f', IO, [1, 0, 0]],
    axis2: ['SFVec3f', IO, [0, 1, 0]],
    body1: ['SFNode', IO, null],
    body1AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    body1Axis: ['SFVec3f', OUT, [0, 0, 0]],
    body2: ['SFNode', IO, null],
    body2AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    body2Axis: ['SFVec3f', OUT, [0, 0, 0]],
    forceOutput: ['MFString', IO, ["NONE"]],
    metadata: ['SFNode', IO, null],
    stop1Bounce: ['SFFloat', IO, 0],
    stop1ErrorCorrection: ['SFFloat', IO, 0.8],
    stop2Bounce: ['SFFloat', IO, 0],
    stop2ErrorCorrection: ['SFFloat', IO, 0.8],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
