/* LineSet (Rendering level 1): LineSet is a geometry node that can contain a Coordinate|CoordinateDouble node and optionally a Color|ColorRGBA node.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LineSet', {
  component: 'Rendering', level: 1,
  container: 'geometry',
  defs: {
    attrib: ['MFNode', IO, []],
    color: ['SFNode', IO, null],
    coord: ['SFNode', IO, null],
    fogCoord: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    normal: ['SFNode', IO, null],
    vertexCount: ['MFInt32', IO, []],
  },
  // X3DLineGeometryNode: vertexCount[i] coord vertices in a row are polyline i (drawn through the body's screen-width line path, as IndexedLineSet is). Colour is per vertex.
  lines(g) {
    const ci = []; let s = 0;
    for (const n of g.f.vertexCount || []) { for (let k = 0; k < n; k++) ci.push(s + k); ci.push(-1); s += n; }
    return { coord: null, coordIndex: Int32Array.from(ci) };
  },
  changed(body, n, field) { if (field === 'vertexCount') body.regeo(n); },
});
