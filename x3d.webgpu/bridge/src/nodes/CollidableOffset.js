/* CollidableOffset (RigidBodyPhysics level 1): CollidableOffset repositions geometry relative to center of owning body.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('CollidableOffset', {
  component: 'RigidBodyPhysics', level: 1,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    collidable: ['SFNode', INIT, null],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    rotation: ['SFRotation', IO, [0, 0, 1, 0]],
    translation: ['SFVec3f', IO, [0, 0, 0]],
    visible: ['SFBool', IO, true],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
