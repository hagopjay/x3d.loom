/* VisibilitySensor (EnvironmentalSensor level 2): VisibilitySensor detects when user can see a specific object or region as they navigate the world.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('VisibilitySensor', {
  component: 'EnvironmentalSensor', level: 2,
  container: 'children',
  defs: {
    center: ['SFVec3f', IO, [0, 0, 0]],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    enterTime: ['SFTime', OUT, 0],
    exitTime: ['SFTime', OUT, 0],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    size: ['SFVec3f', IO, [0, 0, 0]],
  },
  // EnvironmentalSensor: active while the box (center, size) is inside the view frustum of the active camera. size 0 0 0 never fires. Occlusion is not tested (gap).
  // Needs the Babylon body (the camera and the parent's world matrix); without one the sensor stays inactive.
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n, now) {
    const body = R.bridge.body, f = n.f; if (!body || !n._tn || !body.scene.activeCamera) return;
    const sz = f.size, on = f.enabled && (sz[0] > 0 || sz[1] > 0 || sz[2] > 0);
    let vis = false;
    if (on) {
      const V = BABYLON.Vector3, c = f.center, mn = new V(c[0] - sz[0] / 2, c[1] - sz[1] / 2, c[2] - sz[2] / 2), mx = new V(c[0] + sz[0] / 2, c[1] + sz[1] / 2, c[2] + sz[2] / 2);
      const bb = new BABYLON.BoundingBox(mn, mx, n._tn.computeWorldMatrix(true));
      vis = bb.isInFrustum(BABYLON.Frustum.GetPlanes(body.scene.getTransformMatrix()));
    }
    if (vis && !f.isActive) { f.isActive = true; events.emit(n, 'isActive', true); f.enterTime = now; events.emit(n, 'enterTime', now); }
    else if (!vis && f.isActive) { f.isActive = false; events.emit(n, 'isActive', false); f.exitTime = now; events.emit(n, 'exitTime', now); }
  },
});
