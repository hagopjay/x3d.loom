/* Contact (RigidBodyPhysics level 2): Contact nodes are produced as output events when two collidable objects or spaces make contact.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Contact', {
  component: 'RigidBodyPhysics', level: 2,
  container: 'contacts',
  defs: {
    appliedParameters: ['MFString', IO, ["BOUNCE"]],
    body1: ['SFNode', IO, null],
    body2: ['SFNode', IO, null],
    bounce: ['SFFloat', IO, 0],
    contactNormal: ['SFVec3f', IO, [0, 1, 0]],
    depth: ['SFFloat', IO, 0],
    frictionCoefficients: ['SFVec2f', IO, [0, 0]],
    frictionDirection: ['SFVec3f', IO, [0, 1, 0]],
    geometry1: ['SFNode', IO, null],
    geometry2: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    minBounceSpeed: ['SFFloat', IO, 0],
    position: ['SFVec3f', IO, [0, 0, 0]],
    slipCoefficients: ['SFVec2f', IO, [0, 0]],
    softnessConstantForceMix: ['SFFloat', IO, 0.0001],
    softnessErrorCorrection: ['SFFloat', IO, 0.8],
    surfaceSpeed: ['SFVec2f', IO, [0, 0]],
  },
  // A data node. The CollisionSensor fills a pool of these with the contacts it sees (CollisionSensor.js); a Contact written in a scene, or routed to set_contacts of a RigidBodyCollection, is held and
  // does nothing (X_ITE 16.6.0: the set_contacts handler is empty). Defaults as in X_ITE: appliedParameters BOUNCE, minBounceSpeed 0 (the CollisionCollection's is 0.1).
});
