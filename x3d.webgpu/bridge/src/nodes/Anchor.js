/* Anchor (Networking level 2): Anchor is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Anchor', {
  component: 'Networking', level: 2,
  container: 'children',
  defs: {
    addChildren: ['MFNode', IN, []],
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    parameter: ['MFString', IO, []],
    removeChildren: ['MFNode', IN, []],
    url: ['MFString', IO, []],
    visible: ['SFBool', IO, true],
  },
  // Grouping + UrlObject: a click (press and release on the same spot) on anything below it follows url. '#Name' binds the Viewpoint with that DEF; any other url goes to the host
  // (body.opts.onAnchor({ url, target, node })); a page with no handler gets a note and stays where it is. javascript: is never run. load=false switches it off. addChildren and
  // removeChildren change the children list (BR.addRemove); a child already in the list is not added twice.
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  build(body, n, parent, chain) { return body.buildGroup(n, parent, chain); },
  changed(body, n, field) {
    const r = body.rec.get(n.id); if (!r) return;
    if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false);
  },
  activate(body, n) {
    const target = ((n.f.parameter || []).map((p) => /^\s*target\s*=\s*(.*)$/i.exec(p)).find(Boolean) || [])[1];
    for (const u of n.f.url || []) {
      if (/^\s*javascript:/i.test(u)) { body.note('Anchor: javascript: url not run'); continue; }
      if (u[0] === '#') {
        const vp = body.world && body.world.nodes.find((x) => x.type === 'Viewpoint' && x.def === u.slice(1));
        if (vp) { R.hooks.bind(vp, true); return true; }
        continue;
      }
      if (body.opts.onAnchor) { body.opts.onAnchor({ url: u, target, node: n, description: n.f.description }); return true; }
      body.note('Anchor: no host handler for ' + u); return false;
    }
    return false;
  },
});
