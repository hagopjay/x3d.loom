/* GeoLOD (Geospatial level 1): Note that MFNode rootNode field can contain multiple nodes and has accessType inputOutput. Meanwhile MFNode children field is outputOnly, unlike other X3DGroupi
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoLOD', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    center: ['SFVec3d', INIT, [0, 0, 0]],
    child1Url: ['MFString', INIT, []],
    child2Url: ['MFString', INIT, []],
    child3Url: ['MFString', INIT, []],
    child4Url: ['MFString', INIT, []],
    children: ['MFNode', OUT, []],
    geoOrigin: ['SFNode', INIT, null],
    geoSystem: ['MFString', INIT, ['GD', 'WE']],
    level_changed: ['SFInt32', OUT, -1],
    metadata: ['SFNode', IO, null],
    range: ['SFFloat', INIT, 10],
    rootNode: ['MFNode', INIT, []],
    rootUrl: ['MFString', INIT, []],
    visible: ['SFBool', IO, true],
  },
  /* Two levels (X_ITE 16.6.0 GeospatialComponent): level 0 draws the root (rootNode, or the scene of rootUrl), level 1 draws the four child scenes together (child1Url .. child4Url, in that order, in the
     GeoLOD's own frame, not placed by position). The level is decided on every frame as `distance < range ? 1 : 0` (strict), the distance being the length of `center` (through the node's geoSystem and
     GeoOrigin, like a GeoLocation) in EYE space, so a parent scale counts; range 0 or below is always level 0; range and center are read on every frame, so they follow a change at run time.
     level_changed starts at -1 and is announced before anything else changes (level_changed, then children). rootNode wins over rootUrl, but rootUrl is fetched anyway. The children are fetched when
     level 1 is first reached (nothing before) and never unloaded or fetched twice. Level 1 is announced at once but the picture keeps the root until all four are finished (loaded, failed or an empty
     url, the latter two count as finished and contribute nothing); `children` then carries the child roots in order. A failed child or an empty list leaves the level 1 picture without it (no urls at all:
     an empty picture). Going back to level 0 sends level_changed 0 and `children` with the root's nodes again. A data:model/x3d+xml url works (fetch). */
  build(body, n, parent, chain) {
    const B = BABYLON, tn = new B.TransformNode(n.def || 'GeoLOD', body.scene); tn.parent = parent;
    const r = { node: n, tn, kids: [], chain: [n, ...chain], lv: -1, rootTN: new B.TransformNode('root', body.scene), kidTN: [], root: { st: 'idle', nodes: [] }, kid: [0, 1, 2, 3].map(() => ({ st: 'idle', nodes: [] })), kidsDone: false };
    r.rootTN.parent = tn;
    for (let i = 0; i < 4; i++) { const t = new B.TransformNode('child' + (i + 1), body.scene); t.parent = tn; t.setEnabled(false); r.kidTN.push(t); }
    body.rec.set(n.id, r); n._r = r; n._ok = null;
    for (const c of n.f.rootNode) r.kids.push(body.build(c, r.rootTN, r.chain));
    if (n.f.visible === false) tn.setEnabled(false);
    R.bridge.live('geolod').add(n);
    if (n.f.rootUrl.length) { r.root.st = 'loading'; BR.loadWorld(n, n.f.rootUrl[0]).then((w) => { if (tn.isDisposed()) return; r.root.st = 'complete'; r.root.nodes = w.children.slice(); if (!n.f.rootNode.length) for (const c of r.root.nodes) r.kids.push(body.build(c, r.rootTN, r.chain)); if (r.lv === 0) BR.geoLodChildren(n); }).catch(() => { r.root.st = 'failed'; }); }
    else r.root.st = 'complete';
    return r;
  },
  changed(body, n, field) { const r = n._r; if (r && !r.tn.isDisposed() && field === 'visible') r.tn.setEnabled(n.f.visible !== false); },
  tick(n, now) {
    const body = R.bridge.body, r = n._r; if (!body || !r || r.tn.isDisposed() || !body.scene.activeCamera) return;
    const V = BABYLON.Vector3, f = n.f, l = BR.geo.local(n, f.center), p = V.TransformCoordinates(new V(l[0], l[1], l[2]), r.tn.computeWorldMatrix(true));
    const lv = V.Distance(p, body.scene.activeCamera.globalPosition) < Math.fround(f.range) ? 1 : 0;
    if (lv === r.lv) return;
    r.lv = lv; BR.fire(n, 'level_changed', lv);
    if (lv === 0) { r.kidsDone = false; BR.geoLodShow(r); BR.geoLodChildren(n); return; }
    for (let i = 0; i < 4; i++) {
      const k = r.kid[i], u = f['child' + (i + 1) + 'Url'];
      if (k.st !== 'idle') continue;
      if (!u.length) { k.st = 'complete'; continue; }
      k.st = 'loading';
      BR.loadWorld(n, u[0]).then((w) => { if (r.tn.isDisposed()) return; k.nodes = w.children.slice(); for (const c of k.nodes) r.kids.push(body.build(c, r.kidTN[i], r.chain)); k.st = 'complete'; BR.geoLodKids(n); }).catch(() => { k.st = 'failed'; BR.geoLodKids(n); });
    }
    BR.geoLodKids(n);
  },
});
BR.geoLodShow = (r) => { const on = r.lv === 1 && r.kidsDone; r.rootTN.setEnabled(!on); r.kidTN.forEach((t) => t.setEnabled(on)); };
BR.geoLodChildren = (n) => { const r = n._r; if (r.lv !== 0) return; const rn = n.f.rootNode; if (rn.length) BR.fire(n, 'children', rn.slice()); else if (r.root.st === 'complete') BR.fire(n, 'children', r.root.nodes.slice()); };
BR.geoLodKids = (n) => {             // level 1: once all four are finished the children replace the root
  const r = n._r; if (r.lv !== 1 || r.kid.some((k) => k.st === 'idle' || k.st === 'loading')) return;
  r.kidsDone = true; BR.geoLodShow(r); BR.fire(n, 'children', r.kid.flatMap((k) => k.nodes));
};
