/* OrthoViewpoint (Navigation level 3): OrthoViewpoint provides an orthographic perspective-free view of a scene from a specific location and direction.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('OrthoViewpoint', {
  component: 'Navigation', level: 3,
  container: 'children',
  defs: {
    bindTime: ['SFTime', OUT, 0],
    centerOfRotation: ['SFVec3f', IO, [0, 0, 0]],
    description: ['SFString', IO, ""],
    farDistance: ['SFFloat', IO, -1],
    fieldOfView: ['MFFloat', IO, []],
    isBound: ['SFBool', OUT, false],
    jump: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    navigationInfo: ['SFNode', IO, null],
    nearDistance: ['SFFloat', IO, -1],
    orientation: ['SFRotation', IO, [0, 0, 1, 0]],
    position: ['SFVec3f', IO, [0, 0, 10]],
    retainUserOffsets: ['SFBool', IO, false],
    set_bind: ['SFBool', IN, false],
    viewAll: ['SFBool', IO, false],
  },
  /* A camera node, bound the same way as Viewpoint (set_bind goes to the body's bindViewpoint). The body side (body-br.js, "OrthoViewpoint") turns the Babylon camera orthographic:
     fieldOfView is [minX, minY, maxX, maxY], the view shows at least that area; when the window is wider than that area the height is kept and the width grows around the centre of
     [minX, maxX], otherwise the width is kept and the height grows around the centre of [minY, maxY] (X_ITE's rule). The first viewpoint of a world, when it is an OrthoViewpoint, is bound at load.
     A bind that involves an OrthoViewpoint is a cut (no fly-through between a perspective and an orthographic view). */
  receive(n, field, v) { if (field !== 'set_bind') return false; if (R.hooks && R.hooks.bind) R.hooks.bind(n, !!v); return true; },
  build(body, n, parent) {
    const r = { node: n, parent, tn: parent }; body.rec.set(n.id, r);
    (body.viewpoints ||= []).includes(n) || body.viewpoints.push(n); (body.vpParent ||= new Map()).set(n, parent);
    return r;
  },
  changed(body, n, field) {
    if (n !== body.bound || !['position', 'orientation', 'centerOfRotation', 'fieldOfView', 'nearDistance', 'farDistance'].includes(field)) return;
    body.pose = body.vpPose(n); body.tr = null; body.applyCamera();
  },
});
