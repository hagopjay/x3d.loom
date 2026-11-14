/* RigidBody (RigidBodyPhysics level 2): RigidBody describes a collection of shapes with a mass distribution that is affected by the physics model.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('RigidBody', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'bodies',
  defs: {
    angularDampingFactor: ['SFFloat', IO, 0.001],
    angularVelocity: ['SFVec3f', IO, [0, 0, 0]],
    autoDamp: ['SFBool', IO, false],
    autoDisable: ['SFBool', IO, false],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    centerOfMass: ['SFVec3f', IO, [0, 0, 0]],
    disableAngularSpeed: ['SFFloat', IO, 0],
    disableLinearSpeed: ['SFFloat', IO, 0],
    disableTime: ['SFTime', IO, 0],
    enabled: ['SFBool', IO, true],
    finiteRotationAxis: ['SFVec3f', IO, [0, 1, 0]],
    fixed: ['SFBool', IO, false],
    forces: ['MFVec3f', IO, []],
    geometry: ['MFNode', IO, []],
    inertia: ['SFMatrix3f', IO, [1, 0, 0, 0, 1, 0, 0, 0, 1]],
    linearDampingFactor: ['SFFloat', IO, 0.001],
    linearVelocity: ['SFVec3f', IO, [0, 0, 0]],
    mass: ['SFFloat', IO, 1],
    massDensityModel: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    orientation: ['SFRotation', IO, [0, 0, 1, 0]],
    position: ['SFVec3f', IO, [0, 0, 0]],
    torques: ['MFVec3f', IO, []],
    useFiniteRotation: ['SFBool', IO, false],
    useGlobalGravity: ['SFBool', IO, true],
    visible: ['SFBool', IO, true],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
