/* TransformSensor (EnvironmentalSensor level 3): TransformSensor generates output events when its targetObject enters, exits, and moves within a region in space (defined by a box).
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TransformSensor', {
  component: 'EnvironmentalSensor', level: 3,
  container: 'children',
  defs: {
    center: ['SFVec3f', IO, [0, 0, 0]],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    enterTime: ['SFTime', OUT, 0],
    exitTime: ['SFTime', OUT, 0],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    orientation_changed: ['SFRotation', OUT, [0, 0, 0, 0]],
    position_changed: ['SFVec3f', OUT, [0, 0, 0]],
    size: ['SFVec3f', IO, [0, 0, 0]],
    targetObject: ['SFNode', IO, null],
  },
  // EnvironmentalSensor: active while the origin of targetObject lies inside the box (center, size) of the sensor's frame (its parent's). Outputs where the target is and how it
  // is turned in that frame. size -1 -1 -1: always active; size 0 0 0: off. Same rules as X_ITE 16.6.0 (origin test, not a bounding box test). Runs once per timestamp, so a
  // moved target is seen one frame late in the body.
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n, now) {
    const body = R.bridge.body, f = n.f, t = f.targetObject; if (!body || !n._tn) return;
    const rec = t && body.rec.get(t.id), tn = rec && (rec.tn || (rec.meshes && rec.meshes[0] && rec.meshes[0].parent));
    const z = f.size[0] === 0 && f.size[1] === 0 && f.size[2] === 0, always = f.size[0] === -1 && f.size[1] === -1 && f.size[2] === -1;
    let inside = false, pos, rot;
    if (f.enabled && tn && !z) {
      const rel = tn.computeWorldMatrix(true).multiply(n._tn.computeWorldMatrix(true).clone().invert()), s = new BABYLON.Vector3(), q = new BABYLON.Quaternion(), p = new BABYLON.Vector3();
      rel.decompose(s, q, p); pos = [p.x, p.y, p.z]; rot = BR.q.toRot([q.x, q.y, q.z, q.w]);
      const c = f.center, h = f.size.map((x) => x / 2);
      inside = always || (pos[0] >= c[0] - h[0] && pos[0] <= c[0] + h[0] && pos[1] >= c[1] - h[1] && pos[1] <= c[1] + h[1] && pos[2] >= c[2] - h[2] && pos[2] <= c[2] + h[2]);
    }
    const near = (a, b) => a && b && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    if (inside) {
      if (!f.isActive) { BR.fire(n, 'isActive', true); BR.fire(n, 'enterTime', now); BR.fire(n, 'position_changed', pos); BR.fire(n, 'orientation_changed', rot); }
      else { if (!near(f.position_changed, pos)) BR.fire(n, 'position_changed', pos); if (!near(f.orientation_changed, rot)) BR.fire(n, 'orientation_changed', rot); }
    } else if (f.isActive) { BR.fire(n, 'isActive', false); BR.fire(n, 'exitTime', now); }
  },
});
