/* SingleAxisHingeJoint (RigidBodyPhysics level 2): SingleAxisHingeJoint has single axis about which to rotate, similar to a traditional door hinge. Contains two RigidBody nodes (containerField values body1, body
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('SingleAxisHingeJoint', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'joints',
  defs: {
    anchorPoint: ['SFVec3f', IO, [0, 0, 0]],
    angle: ['SFFloat', OUT, 0],
    angleRate: ['SFFloat', OUT, 0],
    axis: ['SFVec3f', IO, [0, 1, 0]],
    body1: ['SFNode', IO, null],
    body1AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    body2: ['SFNode', IO, null],
    body2AnchorPoint: ['SFVec3f', OUT, [0, 0, 0]],
    forceOutput: ['MFString', IO, ["NONE"]],
    maxAngle: ['SFFloat', IO, 3.141592653],
    metadata: ['SFNode', IO, null],
    minAngle: ['SFFloat', IO, -3.141592653],
    stopBounce: ['SFFloat', IO, 0],
    stopErrorCorrection: ['SFFloat', IO, 0.8],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
