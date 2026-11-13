/* Polyline2D (Geometry2D level 1): Polyline2D is a geometry node that defines a connected set of vertices in a contiguous set of line segments in X-Y plane.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Polyline2D', {
  component: 'Geometry2D', level: 1,
  container: 'geometry',
  defs: {
    lineSegments: ['MFVec2f', INIT, []],
    metadata: ['SFNode', IO, null],
  },
  // X3DLineGeometryNode: lineSegments (x y pairs) joined in order into one open polyline in the z=0 plane. Despite the name, the points are consecutive, not segment pairs.
  lines(g) {
    const V = g.f.lineSegments || [], F = V.length && typeof V[0] === 'object' ? V.flat() : V;
    const n = F.length / 2, ci = []; for (let i = 0; i < n; i++) ci.push(i); ci.push(-1);
    return { coord: BR.pt3(Float32Array.from(F)), coordIndex: Int32Array.from(ci) };
  },
  changed(body, n, field) { if (field === 'lineSegments') body.regeo(n); },
});
