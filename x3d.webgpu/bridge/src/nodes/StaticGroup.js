/* StaticGroup (Grouping level 3): StaticGroup is similar to Group node but does not allow access to children after creation time.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('StaticGroup', {
  component: 'Grouping', level: 3,
  container: 'children',
  defs: {
    bboxCenter: ['SFVec3f', INIT, [0, 0, 0]],
    bboxDisplay: ['SFBool', IO, false],
    bboxSize: ['SFVec3f', INIT, [-1, -1, -1]],
    children: ['MFNode', INIT, []],
    metadata: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
  },
  // X3DChildNode grouping: a Group whose children the browser may merge and not touch again (no sensors inside). Drawn as a Group; `visible` is read at build.
  build(body, n, parent, chain) { return body.buildGroup(n, parent, chain); },
  changed(body, n, field) { const r = body.rec.get(n.id); if (r && field === 'visible') r.tn.setEnabled(n.f.visible !== false); },
});
