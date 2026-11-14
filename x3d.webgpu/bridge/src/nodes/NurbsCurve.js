/* NurbsCurve (NURBS level 1): NurbsCurve is a 3D curve analogous to NurbsPatchSurface.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('NurbsCurve', {
  component: 'NURBS', level: 1,
  container: 'geometry',
  defs: {
    closed: ['SFBool', INIT, false],
    controlPoint: ['SFNode', IO, null],
    knot: ['MFDouble', INIT, []],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    tessellation: ['SFInt32', IO, 0],
    weight: ['MFDouble', IO, []],
  },
  // The curve is a line geometry (the body's screen-width line path, the one IndexedLineSet uses): tessellation + 1 points of the rational B-spline over the control points of a Coordinate or
  // CoordinateDouble (BR.nurbs in src/nurbs.js). Fewer control points than the order, or an order below 2, draws nothing. A change of controlPoint's points redraws it (refs).
  refs: ['controlPoint'],
  lines(g) {
    const f = g.f, N = BR.nurbs, c = N.curve({ pts: N.points(f.controlPoint && f.controlPoint.f.point, 3), order: f.order, knot: f.knot, weight: f.weight, closed: f.closed });
    if (!c) return { coord: new Float32Array(0), coordIndex: new Int32Array(0) };
    const p = N.sample(c, f.tessellation), n = p.length / 3, ci = new Int32Array(n + 1); for (let i = 0; i < n; i++) ci[i] = i; ci[n] = -1;
    return { coord: p, coordIndex: ci };
  },
  changed(body, n, field) { if (field === 'tessellation' || field === 'weight' || field === 'controlPoint') body.regeo(n); },
});
