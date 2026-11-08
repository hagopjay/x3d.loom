/* Arc2D (Geometry2D level 2): Arc2D is a line-based geometry node that defines a linear circular arc with center (0,0) in X-Y plane, with angles measured starting at positive x-axis and swee
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Arc2D', {
  component: 'Geometry2D', level: 2,
  container: 'geometry',
  defs: {
    endAngle: ['SFFloat', INIT, 1.570796],
    metadata: ['SFNode', IO, null],
    radius: ['SFFloat', INIT, 1],
    startAngle: ['SFFloat', INIT, 0],
  },
  // X3DLineGeometryNode: the arc of radius `radius` from startAngle to endAngle, counter-clockwise (equal angles: a full turn), max(3, floor(sweep * 40 / 2pi)) segments.
  lines(g) {
    const r = Math.abs(g.f.radius), sw = BR.sweep(g.f.startAngle, g.f.endAngle), steps = Math.max(3, Math.floor(sw * BR.DIM2D / BR.TAU)), pt = BR.arc(r, g.f.startAngle, sw, steps + 1), ci = [];
    for (let i = 0; i <= steps; i++) ci.push(i); ci.push(-1);
    return { coord: BR.pt3(pt), coordIndex: Int32Array.from(ci) };
  },
  changed(body, n, field) { if (field === 'radius' || field === 'startAngle' || field === 'endAngle') body.regeo(n); },
});
