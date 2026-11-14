/* NurbsSet (NURBS level 2): NurbsSet collects a set of NurbsSurface nodes into a common group and treats NurbsSurface set as a unit during tessellation, thereby enforcing tessellation continuity along borders.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
/* the surfaces of a NurbsSet take its tessellationScale (negative counts as 0, the segments are floored and kept at 1 or more); a surface that leaves the set goes back to scale 1 */
BR.nurbsSetApply = (set, dropped) => {
  const body = R.bridge.body, scale = Math.max(0, +set.f.tessellationScale), isSurf = (g) => !!g && (g.type === 'NurbsPatchSurface' || g.type === 'NurbsTrimmedSurface');
  for (const g of dropped || []) if (isSurf(g) && g._tessScale !== undefined) { g._tessScale = undefined; if (body) body.regeo(g); }
  for (const g of set.f.geometry || []) if (isSurf(g) && g._tessScale !== scale) { g._tessScale = scale; if (body) body.regeo(g); }
};
BR.node('NurbsSet', {
  component: 'NURBS', level: 2,
  container: 'children',
  defs: {
    addGeometry: ['MFNode', IN, []],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    geometry: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    removeGeometry: ['MFNode', IN, []],
    tessellationScale: ['SFFloat', IO, 1.0],
    visible: ['SFBool', IO, true],
  },
  // The set draws nothing itself (the surfaces it lists sit in Shapes elsewhere, by DEF / USE, with their own Appearance, exactly as in X_ITE 16.6.0): it scales the tessellation of all of them
  // together so that neighbouring patches keep matching borders, and it is the one place to turn a whole model's detail up or down. geometry, addGeometry and removeGeometry change the list.
  init(n) { BR.nurbsSetApply(n); },
  receive(n, field, v) {
    if (field === 'tessellationScale') { n.f.tessellationScale = v; events.emit(n, 'tessellationScale', v); BR.nurbsSetApply(n); return true; }
    if (field === 'addGeometry' || field === 'removeGeometry' || field === 'geometry') {
      const cur = n.f.geometry || [], list = [...v];
      n.f.geometry = field === 'addGeometry' ? cur.concat(list.filter((x) => !cur.includes(x))) : field === 'removeGeometry' ? cur.filter((x) => !list.includes(x)) : list;
      events.emit(n, 'geometry', n.f.geometry); BR.nurbsSetApply(n, cur.filter((x) => !n.f.geometry.includes(x)));
      return true;
    }
    return false;
  },
});
