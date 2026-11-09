/* ScreenGroup (Layout level 2): ScreenGroup is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ScreenGroup', {
  component: 'Layout', level: 2,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
    visible: ['SFBool', IO, true],
  },
  /* The children are drawn in screen pixels: one unit of the group is one pixel of the canvas, at the place where the group's origin is. The group keeps the rotation of its place in the world (its
     axes are normalised, so a scale above it changes nothing) and the pixel size is set from the depth of its origin (BR.layout.placeScreen in LayoutGroup.js, the arithmetic of X_ITE's
     getScreenScaleMatrix without the snap to whole pixels, which X_ITE does not use for ScreenGroup either). A move of the group in depth never changes how large the children look. */
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { const r = body.buildGroup(n, parent, chain); BR.layout.add(body, { n, tn: r.tn, chain: r.chain, screen: true }); return r; },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
});
