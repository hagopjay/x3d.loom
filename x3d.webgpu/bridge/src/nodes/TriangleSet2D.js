/* TriangleSet2D (Geometry2D level 1): TriangleSet2D is a geometry node that defines a set of filled 2D triangles in X-Y plane.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TriangleSet2D', {
  component: 'Geometry2D', level: 1,
  container: 'geometry',
  defs: {
    metadata: ['SFNode', IO, null],
    solid: ['SFBool', INIT, false],
    vertices: ['MFVec2f', IO, []],
  },
  // X3DGeometryNode: every 3 vertices (x y) are a triangle in the z=0 plane, normal +z whichever way it is wound (the triangle is turned to face +z).
  geometry(g) {
    const V = g.f.vertices || [], F = V.length && typeof V[0] === 'object' ? V.flat() : V, xy = [];
    for (let t = 0; t + 5 < F.length; t += 6) {
      const area = (F[t + 2] - F[t]) * (F[t + 5] - F[t + 1]) - (F[t + 3] - F[t + 1]) * (F[t + 4] - F[t]);
      if (area >= 0) xy.push(F[t], F[t + 1], F[t + 2], F[t + 3], F[t + 4], F[t + 5]); else xy.push(F[t], F[t + 1], F[t + 4], F[t + 5], F[t + 2], F[t + 3]);
    }
    return BR.fill2D(xy, (x, y) => [x, y]);
  },
  changed(body, n, field) { if (field === 'vertices') body.regeo(n); },
});
