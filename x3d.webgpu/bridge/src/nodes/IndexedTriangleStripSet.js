/* IndexedTriangleStripSet (Rendering level 3): IndexedTriangleStripSet is a geometry node containing a Coordinate|CoordinateDouble node, and can also contain Color|ColorRGBA, Normal and TextureCoordinate nod
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('IndexedTriangleStripSet', {
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
  // X3DComposedGeometryNode: index lists strips separated by -1; triangle i of a strip is (i, i+1, i+2), every odd one with its first two swapped so all keep the same winding.
  geometry(g) {
    const tri = [], faceOf = [];
    BR.runs(g.f.index).forEach((r, i) => { for (let k = 0; k + 2 < r.length; k++) { if (k % 2) tri.push(r[k + 1], r[k], r[k + 2]); else tri.push(r[k], r[k + 1], r[k + 2]); faceOf.push(i); } });
    return BR.compose(g, tri, faceOf);
  },
  receive(n, field, v) { if (field === 'set_index') { n.f.index = v.slice ? v.slice() : v; n.version = (n.version || 0) + 1; events.emit(n, 'index', n.f.index); if (R.bridge.body) R.bridge.body.regeo(n); return true; } },
  changed(body, n, field) { if (field === 'index' || field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
