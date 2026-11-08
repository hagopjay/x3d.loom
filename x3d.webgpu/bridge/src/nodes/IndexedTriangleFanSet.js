/* IndexedTriangleFanSet (Rendering level 3): IndexedTriangleFanSet is a geometry node containing a Coordinate|CoordinateDouble node, and can also contain Color|ColorRGBA, Normal and TextureCoordinate nodes
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('IndexedTriangleFanSet', {
  component: 'Rendering', level: 3,
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
  // X3DComposedGeometryNode: index lists fans separated by -1; fan [a b c d ..] is the triangles (a,b,c) (a,c,d) ... set_index replaces the list.
  geometry(g) {
    const tri = [], faceOf = [];
    BR.runs(g.f.index).forEach((r, i) => { for (let k = 1; k + 1 < r.length; k++) { tri.push(r[0], r[k], r[k + 1]); faceOf.push(i); } });
    return BR.compose(g, tri, faceOf);
  },
  receive(n, field, v) { if (field === 'set_index') { n.f.index = v.slice ? v.slice() : v; n.version = (n.version || 0) + 1; events.emit(n, 'index', n.f.index); if (R.bridge.body) R.bridge.body.regeo(n); return true; } },
  changed(body, n, field) { if (field === 'index' || field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
