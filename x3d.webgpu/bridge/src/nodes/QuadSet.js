/* QuadSet (CADGeometry level 1): QuadSet is a geometry node that defines quadrilaterals.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('QuadSet', {
  component: 'CADGeometry', level: 1,
  container: 'geometry',
  defs: {
    attrib: ['MFNode', IO, []],
    ccw: ['SFBool', INIT, true],
    color: ['SFNode', IO, null],
    colorPerVertex: ['SFBool', INIT, true],
    coord: ['SFNode', IO, null],
    fogCoord: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    normal: ['SFNode', IO, null],
    normalPerVertex: ['SFBool', INIT, true],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
  },
  // X3DComposedGeometryNode: every 4 coord vertices are a quad, drawn as two triangles (0,1,2) (0,2,3). Colour, normal, texCoord per vertex, or per quad.
  geometry(g) {
    const tri = [], faceOf = [], nq = Math.floor(((g.f.coord && g.f.coord.f.point.length) || 0) / 12);
    for (let q = 0; q < nq; q++) { const b = q * 4; tri.push(b, b + 1, b + 2, b, b + 2, b + 3); faceOf.push(q, q); }
    return BR.compose(g, tri, faceOf);
  },
  changed(body, n, field) { if (field === 'ccw' || field === 'colorPerVertex' || field === 'normalPerVertex') body.regeo(n); },
});
