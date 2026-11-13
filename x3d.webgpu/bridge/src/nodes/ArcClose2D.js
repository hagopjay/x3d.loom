/* ArcClose2D (Geometry2D level 2): ArcClose2D is a polygonal geometry node that defines a linear circular arc, closed by PIE or CHORD line segments, with center (0,0) in X-Y plane, with angles me
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ArcClose2D', {
  component: 'Geometry2D', level: 2,
  container: 'geometry',
  defs: {
    closureType: ['SFString', INIT, "PIE"],
    endAngle: ['SFFloat', INIT, 1.570796],
    metadata: ['SFNode', IO, null],
    radius: ['SFFloat', INIT, 1],
    solid: ['SFBool', INIT, false],
    startAngle: ['SFFloat', INIT, 0],
  },
  // X3DGeometryNode: the arc closed to a filled shape. PIE joins the ends to the centre (steps - 1 triangles), CHORD joins them with a straight line (steps - 2), steps = max(4,
  // floor(sweep * 40 / 2pi)) points. Normals +z, texture coordinates mapped over the circle's square.
  geometry(g) {
    const r = Math.abs(g.f.radius), sw = BR.sweep(g.f.startAngle, g.f.endAngle), steps = Math.max(4, Math.floor(sw * BR.DIM2D / BR.TAU)), P = BR.arc(r, g.f.startAngle, sw, steps), xy = [];
    const pt = (i) => [P[i * 2], P[i * 2 + 1]];
    if (g.f.closureType === 'CHORD') for (let i = 1; i < steps - 1; i++) xy.push(...pt(0), ...pt(i), ...pt(i + 1));
    else for (let i = 0; i < steps - 1; i++) xy.push(0, 0, ...pt(i), ...pt(i + 1));
    return BR.fill2D(xy, r > 0 ? (x, y) => [0.5 + x / (2 * r), 0.5 + y / (2 * r)] : null);
  },
  changed(body, n, field) { if (field === 'radius' || field === 'startAngle' || field === 'endAngle' || field === 'closureType') body.regeo(n); },
});
