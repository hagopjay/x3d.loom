/* DoubleAxisHingeJoint (RigidBodyPhysics level 2): DoubleAxisHingeJoint has two independent axes located around a common anchor point.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('DoubleAxisHingeJoint', {
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
    desiredAngularVelocity1: ['SFFloat', IO, 0],
    desiredAngularVelocity2: ['SFFloat', IO, 0],
    forceOutput: ['MFString', IO, ["NONE"]],
    hinge1Angle: ['SFFloat', OUT, 0],
    hinge1AngleRate: ['SFFloat', OUT, 0],
    hinge2Angle: ['SFFloat', OUT, 0],
    hinge2AngleRate: ['SFFloat', OUT, 0],
    maxAngle1: ['SFFloat', IO, 3.141592653],
    maxTorque1: ['SFFloat', IO, 0],
    maxTorque2: ['SFFloat', IO, 0],
    metadata: ['SFNode', IO, null],
    minAngle1: ['SFFloat', IO, -3.141592653],
    stop1Bounce: ['SFFloat', IO, 0],
    stop1ConstantForceMix: ['SFFloat', IO, 0.001],
    stop1ErrorCorrection: ['SFFloat', IO, 0.8],
    suspensionErrorCorrection: ['SFFloat', IO, 0.8],
    suspensionForce: ['SFFloat', IO, 0],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
