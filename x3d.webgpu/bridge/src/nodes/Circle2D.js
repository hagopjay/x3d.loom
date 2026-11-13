/* Circle2D (Geometry2D level 2): Circle2D is a geometry node that defines a linear X-Y circle with center (0,0) in X-Y plane.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Circle2D', {
  component: 'Geometry2D', level: 2,
  container: 'geometry',
  defs: {
    metadata: ['SFNode', IO, null],
    radius: ['SFFloat', INIT, 1],
  },
  // X3DLineGeometryNode: an outline of radius `radius`, 40 segments, in the z=0 plane.
  lines(g) {
    const N = BR.DIM2D, r = Math.abs(g.f.radius), pt = BR.arc(r, 0, BR.TAU * (N - 1) / N, N), ci = [];
    for (let i = 0; i <= N; i++) ci.push(i % N); ci.push(-1);
    return { coord: BR.pt3(pt), coordIndex: Int32Array.from(ci) };
  },
  changed(body, n, field) { if (field === 'radius') body.regeo(n); },
});
