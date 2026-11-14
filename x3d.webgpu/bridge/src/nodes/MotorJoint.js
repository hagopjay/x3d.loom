/* MotorJoint (RigidBodyPhysics level 2): MotorJoint drives relative angular velocities between body1 and body2 within a common reference frame.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('MotorJoint', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'joints',
  defs: {
    autoCalc: ['SFBool', INIT, false],
    axis1Angle: ['SFFloat', IO, 0],
    axis1Torque: ['SFFloat', IO, 0],
    axis2Angle: ['SFFloat', IO, 0],
    axis2Torque: ['SFFloat', IO, 0],
    axis3Angle: ['SFFloat', IO, 0],
    axis3Torque: ['SFFloat', IO, 0],
    body1: ['SFNode', IO, null],
    body2: ['SFNode', IO, null],
    enabledAxes: ['SFInt32', IO, 1],
    forceOutput: ['MFString', IO, ["NONE"]],
    metadata: ['SFNode', IO, null],
    motor1Angle: ['SFFloat', OUT, 0],
    motor1AngleRate: ['SFFloat', OUT, 0],
    motor1Axis: ['SFVec3f', IO, [1, 0, 0]],
    motor2Angle: ['SFFloat', OUT, 0],
    motor2AngleRate: ['SFFloat', OUT, 0],
    motor2Axis: ['SFVec3f', IO, [0, 1, 0]],
    motor3Angle: ['SFFloat', OUT, 0],
    motor3AngleRate: ['SFFloat', OUT, 0],
    motor3Axis: ['SFVec3f', IO, [0, 0, 1]],
    stop1Bounce: ['SFFloat', IO, 0],
    stop1ErrorCorrection: ['SFFloat', IO, 0.8],
    stop2Bounce: ['SFFloat', IO, 0],
    stop2ErrorCorrection: ['SFFloat', IO, 0.8],
    stop3Bounce: ['SFFloat', IO, 0],
    stop3ErrorCorrection: ['SFFloat', IO, 0.8],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
