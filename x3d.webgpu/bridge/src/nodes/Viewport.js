/* Viewport (Layering level 1): Viewport is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Viewport', {
  component: 'Layering', level: 1,
  container: 'viewport',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    clipBoundary: ['MFFloat', IO, [0, 1, 0, 1]],               // left right bottom top, as fractions of the viewport; default as in X_ITE 16.6.0
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
    visible: ['SFBool', IO, true],
  },
  /* As the viewport field of a Layer or LayoutLayer, clipBoundary is the rectangle of the canvas that layer is drawn into: the layer's Babylon camera gets that viewport (LayerSet.js), so
     its picture is squeezed into the rectangle and drawn only there. As a grouping node of the world (X_ITE 16.6.0 draws it the same way) its children get a camera of their own, posed like the
     world's, with the rectangle as its viewport; they are drawn over the world there (X_ITE keeps one depth buffer, here the depth is cleared between the two), and a pointer outside the rectangle
     does not reach them. */
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) {
    const r = body.buildGroup(n, parent, chain);
    if (r && !chain.some((c) => c.type === 'Layer' || c.type === 'LayoutLayer')) BR.wvp.add(body, n, r.tn);
    return r;
  },
  changed(body, n, field) {
    if (field === 'clipBoundary') { BR.layers.refresh(body); BR.wvp.refresh(body); return; }
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') { r.tn.setEnabled(n.f.visible !== false); BR.wvp.refresh(body); }
  },
});
/* Viewports in the world (not the viewport of a layer): one camera each, over the world camera */
BR.wvp = {
  cams(body) { return body._wvp ? body._wvp.items.filter((it) => it.node.f.visible !== false).map((it) => it.cam) : []; },
  add(body, n, tn) {
    const sc = body.scene, st = (body._wvp ||= { items: [] }); if (st.items.some((it) => it.node === n)) { st.items = st.items.filter((it) => { if (it.node !== n) return true; it.cam.dispose(); return false; }); }
    const bit = 1 << (20 + st.items.length % 8), cam = new BABYLON.FreeCamera('viewport-cam-' + st.items.length, new BABYLON.Vector3(0, 0, 10), sc); cam.layerMask = bit;
    tn.metadata = Object.assign(tn.metadata || {}, { layerBit: bit }); st.items.push({ node: n, tn, cam, bit }); body.cam.layerMask = 1;
    if (!body._wvpHook) { body._wvpHook = true; sc.onBeforeRenderObservable.add(() => BR.wvp.frame(body)); }
    BR.wvp.refresh(body);
  },
  refresh(body) { const st = body._wvp; if (!st) return; if (!body._layers) body.scene.activeCameras = [body.cam, ...BR.wvp.cams(body)]; else BR.layers.refresh(body); for (const it of st.items) BR.wvp.pose(body, it); },
  pose(body, it) {
    const cb = it.node.f.clipBoundary || [], cl = (v, d) => Math.min(1, Math.max(0, v ?? d)), l = cl(cb[0], 0), r = cl(cb[1], 1), b = cl(cb[2], 0), t = cl(cb[3], 1), w = Math.max(r - l, 1e-6), h = Math.max(t - b, 1e-6);
    if (it.cam.viewport.x !== l || it.cam.viewport.y !== b || it.cam.viewport.width !== w || it.cam.viewport.height !== h) it.cam.viewport = new BABYLON.Viewport(l, b, w, h);
    if (!body.pose) return; const cam = body.cam; body.cam = it.cam; try { body.applyCamera(); BR.squeeze(body, it.cam); } finally { body.cam = cam; }
  },
  frame(body) {
    const st = body._wvp; if (!st) return;
    if (!body._layers) for (const m of body.scene.meshes) {              // with a LayerSet its own pass sets the bits
      let bit = 1; if (!(m.metadata && m.metadata.background)) for (let p = m.parent; p; p = p.parent) if (p.metadata && p.metadata.layerBit) { bit = p.metadata.layerBit; break; }
      if (m.layerMask !== bit) m.layerMask = bit;
    }
    for (const it of st.items) BR.wvp.pose(body, it);
  },
  drop(body) { const st = body._wvp; if (!st) return; for (const it of st.items) it.cam.dispose(); body._wvp = null; if (!body._layers) body.scene.activeCameras = []; },
};
