/* PickableGroup (Picking level 1): PickableGroup is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('PickableGroup', {
  component: 'Picking', level: 1,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    objectType: ['MFString', IO, ['ALL']],
    pickable: ['SFBool', IO, true],
    removeChildren: ['MFNode', IN, []],
    visible: ['SFBool', IO, true],
  },
  // X3DGroupingNode that marks what pick sensors may see: pickable false hides the subtree from them, objectType (default ALL, NONE hides) filters by the sensor's objectType and matchCriterion
  // (BR.pick, kit.js). Drawn as a Group; `visible` hides the subtree from drawing and from picking. addChildren / removeChildren as on Group.
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { return body.buildGroup(n, parent, chain); },
  changed(body, n, field) { const r = body.rec.get(n.id); if (!r) return; if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false); },
});
