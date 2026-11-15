/* GeoProximitySensor (Geospatial level 2): GeoProximitySensor generates events when the viewer enters, exits and moves within a region of space (defined by a box).
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoProximitySensor', {
  component: 'Geospatial', level: 2,
  container: 'children',
  defs: {
    center: ['SFVec3d', IO, [0, 0, 0]],
    centerOfRotation_changed: ['SFVec3f', OUT, [0, 0, 0]],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    enterTime: ['SFTime', OUT, 0],
    exitTime: ['SFTime', OUT, 0],
    geoCenter: ['SFVec3d', IO, [0, 0, 0]],
    geoCoord_changed: ['SFVec3d', OUT, [0, 0, 0]],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
    orientation_changed: ['SFRotation', OUT, [0, 0, 1, 0]],
    position_changed: ['SFVec3f', OUT, [0, 0, 0]],
    size: ['SFVec3f', IO, [0, 0, 0]],
  },
  /* A ProximitySensor that also reports the viewer's geographic position (X_ITE 16.6.0 wraps one). Active while the camera is inside the box `size` around `center`, in the frame of the sensor's parent;
     size 0 0 0 is never active, size -1 -1 -1 is always inside, the test is inclusive. `geoCenter` is copied raw to `center` when it is WRITTEN at run time (no conversion), the attribute in a file is
     ignored. Enter: isActive, enterTime, geoCoord_changed, position_changed, orientation_changed, centerOfRotation_changed (all sent). While inside each is sent only when it changes. Exit: the last
     position outside is announced first (geoCoord_changed, position_changed), then isActive false, exitTime. geoCoord_changed is the sensor-local position read through the geoSystem and GeoOrigin
     (BR.geo.geoOf), as X_ITE does. Checked every frame against the pose of the camera (the body has no frame of lag where X_ITE has one). Disabled while active: one isActive false and one exitTime
     (X_ITE sends both twice). */
  receive(n, field, v) { if (field === 'geoCenter') R.receive(n, 'center', v); return false; },
  build(body, n, parent) { n._tn = parent; return null; },
  tick(n, now) {
    const body = R.bridge.body, f = n.f; if (!body || !n._tn || !body.pose) return;
    const V = BABYLON.Vector3, P = body.pose, M = n._tn.computeWorldMatrix(true), inv = M.clone().invert();
    const loc = (a) => { const p = V.TransformCoordinates(new V(a[0], a[1], a[2]), inv); return [p.x, p.y, p.z]; };
    const sz = f.size, off = sz[0] === 0 && sz[1] === 0 && sz[2] === 0, always = sz[0] === -1 && sz[1] === -1 && sz[2] === -1;
    let inside = false, pos = null, ori = null, cor = null;
    if (f.enabled !== false && !off) {
      pos = loc(P.pos); cor = loc(P.center);
      const s = new V(), q = new BABYLON.Quaternion(), t = new V(); M.decompose(s, q, t);
      ori = BR.q.toRot(BR.q.mul(BR.q.inv([q.x, q.y, q.z, q.w]), P.q));
      const c = f.center, h = sz.map((x) => x / 2);
      inside = always || (pos[0] >= c[0] - h[0] && pos[0] <= c[0] + h[0] && pos[1] >= c[1] - h[1] && pos[1] <= c[1] + h[1] && pos[2] >= c[2] - h[2] && pos[2] <= c[2] + h[2]);
    }
    const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
    const out = (all) => {
      if (all || !same(n._pos, pos)) { BR.fire(n, 'geoCoord_changed', Array.from(BR.geo.geoOf(n, pos))); BR.fire(n, 'position_changed', pos); }
      if (all || !same(n._ori, ori)) BR.fire(n, 'orientation_changed', ori);
      if (all || !same(n._cor, cor)) BR.fire(n, 'centerOfRotation_changed', cor);
      n._pos = pos; n._ori = ori; n._cor = cor;
    };
    if (inside) {
      if (!f.isActive) { BR.fire(n, 'isActive', true); BR.fire(n, 'enterTime', now); out(true); } else out(false);
    } else if (f.isActive) {
      if (pos) out(false);                                  // the position outside is announced before the exit
      BR.fire(n, 'isActive', false); BR.fire(n, 'exitTime', now); n._pos = n._ori = n._cor = null;
    }
  },
});
