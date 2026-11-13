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
     its picture is squeezed into the rectangle and drawn only there. As a grouping node of the world it builds its children as a Group does; its clip is NOT applied there (gap: Babylon has
     one viewport per camera, and the world's camera is shared with everything outside the Viewport). */
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { return body.buildGroup(n, parent, chain); },
  changed(body, n, field) {
    if (field === 'clipBoundary') { BR.layers.refresh(body); return; }
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
});
