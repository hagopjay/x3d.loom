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

BR.layers = {
  make(body, set, parent, chain) {
    BR.layers.drop(body);
    const sc = body.scene, tn = new BABYLON.TransformNode(set.def || 'LayerSet', sc); tn.parent = parent;
    const st = body._layers = { set, parent, chain, tn, items: [] };
    (set.f.layers || []).forEach((layer, i) => {
      if (!layer || layer.type !== 'Layer') { st.items.push(null); return; }
      const bit = 1 << (i + 1), lt = new BABYLON.TransformNode(layer.def || 'Layer' + (i + 1), sc); lt.parent = tn; lt.metadata = { layerBit: bit };
      const saved = body.viewpoints; body.viewpoints = [];                                  // a Viewpoint of the layer belongs to the layer, not to the world
      const kids = (layer.f.children || []).map((c) => body.build(c, lt, [layer, ...chain]));
      const vps = body.viewpoints; body.viewpoints = saved;
      const cam = new BABYLON.FreeCamera('layer-cam-' + (i + 1), new BABYLON.Vector3(0, 0, 10), sc); cam.layerMask = bit;
      st.items.push({ layer, lt, cam, vps, kids, bit });
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
    const vp = it.vps[0], p = vp ? body.vpPose(vp) : { pos: [0, 0, 10], q: [0, 0, 0, 1], center: [0, 0, 0], fov: Math.PI / 4 };
    const cam = body.cam, pose = body.pose; body.cam = it.cam; body.pose = p;
    try { body.applyCamera(); } finally { body.cam = cam; body.pose = pose; }
  },
  refresh(body) {                                 // the drawing order: the cameras of the layers in `order` that are visible
    const st = body._layers; if (!st) return;
    const cams = [];
    for (const idx of st.set.f.order || [0]) {
      if (idx === 0) cams.push(body.cam);
      else { const it = st.items[idx - 1]; if (it && it.layer.f.visible !== false) cams.push(it.cam); }
    }
    body.scene.activeCameras = cams.length ? cams : [];
    for (const it of st.items) if (it) BR.layers.pose(body, it);
  },
  layerChanged(body, n, field) {
    const st = body._layers; if (!st || !st.items.some((it) => it && it.layer === n)) return;
    if (field === 'visible') BR.layers.refresh(body); else if (field === 'children') BR.layers.remake(body);
  },
  frame(body) {                                   // every mesh carries the bit of the layer it sits under; the world's own meshes carry bit 0
    const st = body._layers; if (!st) return;
    for (const m of body.scene.meshes) {
      let bit = 1;
      if (!(m.metadata && m.metadata.background)) for (let p = m.parent; p; p = p.parent) if (p.metadata && p.metadata.layerBit) { bit = p.metadata.layerBit; break; }
      if (m.layerMask !== bit) m.layerMask = bit;
    }
    for (const it of st.items) if (it) BR.layers.pose(body, it);
  },
};
