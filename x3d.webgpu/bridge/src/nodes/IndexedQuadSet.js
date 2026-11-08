/* IndexedQuadSet (CADGeometry level 1): IndexedQuadSet is a geometry node that defines quadrilaterals.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('IndexedQuadSet', {
  component: 'CADGeometry', level: 1,
  container: 'geometry',
  defs: {
    attrib: ['MFNode', IO, []],
    ccw: ['SFBool', INIT, true],
    color: ['SFNode', IO, null],
    colorPerVertex: ['SFBool', INIT, true],
    coord: ['SFNode', IO, null],
    fogCoord: ['SFNode', IO, null],
    index: ['MFInt32', INIT, []],
    metadata: ['SFNode', IO, null],
    normal: ['SFNode', IO, null],
    normalPerVertex: ['SFBool', INIT, true],
    set_index: ['MFInt32', IN, []],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
  },
  // X3DComposedGeometryNode: index lists 4 coord numbers per quad (no -1 separators), each quad drawn as two triangles. set_index replaces the list.
  geometry(g) {
    const ix = g.f.index || [], tri = [], faceOf = [];
    for (let q = 0; q + 3 < ix.length; q += 4) { tri.push(ix[q], ix[q + 1], ix[q + 2], ix[q], ix[q + 2], ix[q + 3]); faceOf.push(q / 4, q / 4); }
    return BR.compose(g, tri, faceOf);
  },
  receive(n, field, v) { if (field === 'set_index') { n.f.index = v.slice ? v.slice() : v; n.version = (n.version || 0) + 1; events.emit(n, 'index', n.f.index); if (R.bridge.body) R.bridge.body.regeo(n); return true; } },
  changed(body, n, field) { if (field === 'index' || field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
