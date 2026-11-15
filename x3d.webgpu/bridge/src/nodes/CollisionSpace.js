/* CollisionSpace (RigidBodyPhysics level 1): CollisionSpace holds collection of objects considered together for resolution of inter-object collisions.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CollisionSpace', {
  component: 'RigidBodyPhysics', level: 1,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    collidables: ['MFNode', IO, []],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    useGeometry: ['SFBool', IO, false],
    visible: ['SFBool', IO, true],
  },
  // Only a list: a CollisionSensor flattens `collidables` through nested spaces (BR.phys.flatten, RigidBodyCollection.js) on every frame. X_ITE 16.6.0 never reads `enabled` or `useGeometry`, and the physics world
  // ignores a space in its own collider; the bridge copies that. No build.
});
