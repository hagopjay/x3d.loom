/* TriangleFanSet (Rendering level 3): TriangleFanSet is a geometry node containing a Coordinate|CoordinateDouble node, and can also contain Color|ColorRGBA, Normal and TextureCoordinate nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TriangleFanSet', {
  component: 'Rendering', level: 3,
  container: 'geometry',
  defs: {
    attrib: ['MFNode', IO, []],
    ccw: ['SFBool', INIT, true],
    color: ['SFNode', IO, null],
    colorPerVertex: ['SFBool', INIT, true],
    coord: ['SFNode', IO, null],
    fanCount: ['MFInt32', IO, []],
    fogCoord: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    normal: ['SFNode', IO, null],
    normalPerVertex: ['SFBool', INIT, true],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
  },
  // X3DComposedGeometryNode: coord vertices in order, fanCount[i] of them make fan i: triangles (first, k, k+1). Colour, normal, texCoord per vertex, or per fan.
  geometry(g) {
    const tri = [], faceOf = []; let s = 0;
    (g.f.fanCount || []).forEach((n, i) => { for (let k = 1; k + 1 < n; k++) { tri.push(s, s + k, s + k + 1); faceOf.push(i); } s += n; });
    return BR.compose(g, tri, faceOf);
  },
  changed(body, n, field) { if (field === 'fanCount' || field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
