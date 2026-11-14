/* LayerSet (Layering level 1): LayerSet defines a list of layers and a rendering order.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LayerSet', {
  component: 'Layering', level: 1,
  container: 'children',
  defs: {
    activeLayer: ['SFInt32', IO, 0],
    layers: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    order: ['MFInt32', IO, [0]],
  },
  /* Layers are drawn one over the other. Layer 0 is the world itself (everything outside the LayerSet); layers 1, 2, ... are the nodes of `layers`. `order` lists which of them are drawn and in
     what order (default: just the world); the depth buffer is cleared between two layers, so a later layer is always in front of an earlier one. In Babylon each layer is a Babylon camera
     with its own layer mask: the meshes of a layer carry that layer's bit, and the scene renders its cameras in order (scene.activeCameras), which clears depth between them. activeLayer (which
     layer the user navigates) is held. */
  build(body, n, parent, chain) { return BR.layers.make(body, n, parent, chain); },
  changed(body, n, field) { if (field === 'layers') BR.layers.remake(body); else if (field === 'order') BR.layers.refresh(body); },
});

/* A Viewport node in the world (Viewport.js): X_ITE 16.6.0 keeps the projection of the whole canvas and only narrows the rectangle, so the picture is squeezed into it. (The viewport of a Layer is
   different: the layer's projection is made for the rectangle's own aspect, which is what Babylon does by itself.) A perspective camera gets the canvas aspect as a frozen projection; an orthographic one is left to Babylon. */
BR.squeeze = (body, cam) => {
  const v = cam.viewport, full = Math.abs(v.width - 1) < 1e-6 && Math.abs(v.height - 1) < 1e-6 && Math.abs(v.x) < 1e-6 && Math.abs(v.y) < 1e-6;
  if (cam._squeezed) { cam.unfreezeProjectionMatrix(); cam._squeezed = false; }
  if (full || cam.mode !== BABYLON.Camera.PERSPECTIVE_CAMERA) return;
  const asp = (body.canvas.clientWidth || 1) / (body.canvas.clientHeight || 1);
  const mk = body.scene.useRightHandedSystem ? BABYLON.Matrix.PerspectiveFovRH : BABYLON.Matrix.PerspectiveFovLH;
  cam.freezeProjectionMatrix(mk(cam.fov, asp, cam.minZ, cam.maxZ, body.engine.isNDCHalfZRange)); cam._squeezed = true;
};
BR.layers = {
  make(body, set, parent, chain) {
    BR.layers.drop(body);
    const sc = body.scene, tn = new BABYLON.TransformNode(set.def || 'LayerSet', sc); tn.parent = parent;
    const st = body._layers = { set, parent, chain, tn, items: [] };
    (set.f.layers || []).forEach((layer, i) => {
      if (!layer || (layer.type !== 'Layer' && layer.type !== 'LayoutLayer')) { st.items.push(null); return; }
      const bit = 1 << (i + 1), lt = new BABYLON.TransformNode(layer.def || 'Layer' + (i + 1), sc); lt.parent = tn; lt.metadata = { layerBit: bit, layer };
      const saved = body.viewpoints; body.viewpoints = [];                                  // a Viewpoint of the layer belongs to the layer, not to the world
      const isLay = layer.type === 'LayoutLayer', host = isLay ? new BABYLON.TransformNode((layer.def || 'LayoutLayer' + (i + 1)) + '-layout', sc) : lt;     // a LayoutLayer lays its children out with its Layout (LayoutGroup.js)
      if (isLay) host.parent = lt;
      const ch2 = [layer, ...chain], kids = (layer.f.children || []).map((c) => body.build(c, host, ch2));
      if (isLay) BR.layout.add(body, { n: layer, tn: host, chain: ch2 });
      const vps = body.viewpoints; body.viewpoints = saved;
      const cam = new BABYLON.FreeCamera('layer-cam-' + (i + 1), new BABYLON.Vector3(0, 0, 10), sc); cam.layerMask = bit;
      st.items.push({ layer, lt, cam, vps, kids, bit, isLay });
    });
    body.cam.layerMask = 1;
    if (!body._layerHook) { body._layerHook = true; sc.onBeforeRenderObservable.add(() => BR.layers.frame(body)); }
    BR.layers.refresh(body);
    const r = { node: set, tn, kids: [], chain: [set, ...chain] }; body.rec.set(set.id, r); return r;
  },
  drop(body) {                                    // cameras and nodes of the previous LayerSet
    const st = body._layers; if (!st) return;
    for (const it of st.items) if (it) it.cam.dispose();
    if (!st.tn.isDisposed()) st.tn.dispose(false, false);
    body.scene.activeCameras = []; body._layers = null;
  },
  remake(body) { const st = body._layers; if (st) BR.layers.make(body, st.set, st.parent, st.chain); },
  pose(body, it) {                                // the layer's camera: its first Viewpoint, else the default one
    const vp = it.vps[0], p = vp ? body.vpPose(vp) : it.isLay ? { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: 0.7854, ortho: { f: [-1, -1, 1, 1], near: 0.1, far: 1e4, scale: 1 } }   // a LayoutLayer looks through an OrthoViewpoint of its own
      : { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: Math.PI / 4 };
    const vpn = it.layer.f.viewport, cb = vpn && vpn.type === 'Viewport' ? vpn.f.clipBoundary || [] : [], cl = (v, d) => Math.min(1, Math.max(0, v ?? d));
    const l = cl(cb[0], 0), r = cl(cb[1], 1), b = cl(cb[2], 0), t = cl(cb[3], 1);                     // the layer's Viewport: a clip rectangle, in fractions of the canvas
    if (it.cam.viewport.x !== l || it.cam.viewport.y !== b || it.cam.viewport.width !== Math.max(r - l, 1e-6) || it.cam.viewport.height !== Math.max(t - b, 1e-6)) it.cam.viewport = new BABYLON.Viewport(l, b, Math.max(r - l, 1e-6), Math.max(t - b, 1e-6));
    const cam = body.cam, pose = body.pose; body.cam = it.cam; body.pose = p;
    try { body.applyCamera(); } finally { body.cam = cam; body.pose = pose; }
  },
  refresh(body) {                                 // the drawing order: the cameras of the layers in `order` that are visible
    const st = body._layers; if (!st) return;
    const cams = [];
    for (const idx of st.set.f.order || [0]) {
      if (idx === 0) cams.push(body.cam, ...BR.wvp.cams(body));
      else { const it = st.items[idx - 1]; if (it && it.layer.f.visible !== false) cams.push(it.cam); }
    }
    body.scene.activeCameras = cams.length ? cams : [];
    for (const it of st.items) if (it) BR.layers.pose(body, it);
  },
  layerChanged(body, n, field) {
    const st = body._layers; if (!st || !st.items.some((it) => it && it.layer === n)) return;
    if (field === 'visible') BR.layers.refresh(body); else if (field === 'children' || field === 'layout') BR.layers.remake(body); else if (field === 'viewport') BR.layers.refresh(body);
  },
  frame(body) {                                   // every mesh carries the bit of the layer it sits under; the world's own meshes carry bit 0
    const st = body._layers; if (!st) return;
    for (const m of body.scene.meshes) {
      let bit = 1;
      if (!(m.metadata && m.metadata.background)) for (let p = m.parent; p; p = p.parent) if (p.metadata && p.metadata.layerBit) { bit = p.metadata.layerBit; break; }
      if (m.layerMask !== bit) m.layerMask = bit;
    }
    for (const it of st.items) if (it) BR.layers.pose(body, it);
    BR.layout.frame(body);
  },
};
