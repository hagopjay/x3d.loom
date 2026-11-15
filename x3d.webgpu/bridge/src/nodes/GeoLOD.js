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
    geoSystem: ['MFString', INIT, []],
    level_changed: ['SFInt32', OUT, 0],
    metadata: ['SFNode', IO, null],
    range: ['SFFloat', INIT, 10],
    rootNode: ['MFNode', INIT, []],
    rootUrl: ['MFString', INIT, []],
    visible: ['SFBool', IO, true],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
