/* NurbsSweptSurface (NURBS level 3): a crossSectionCurve (a NurbsCurve2D or ContourPolyline2D, the points in x, y of the cross-section plane) swept along a trajectoryCurve (a NurbsCurve in 3D, the spine).
   X_ITE 16.6.0 builds it as an Extrusion: crossSection = the tessellated cross-section, spine = the tessellated trajectory, no caps, creaseAngle pi (smooth shading), solid and ccw as given; the
   bridge does the same through BR.nurbs.extrude (the swung surface's extrusion). A trajectory that is not a NurbsCurve, or either curve missing or with fewer than two points, draws nothing.
   ccw FALSE reverses the faces and the normals. */
BR.node('NurbsSweptSurface', {
  component: 'NURBS', level: 3,
  container: 'geometry',
  defs: {
    ccw: ['SFBool', INIT, true],
    crossSectionCurve: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    solid: ['SFBool', INIT, true],
    trajectoryCurve: ['SFNode', IO, null],
  },
  geometry(g) {
    const N = BR.nurbs, cs = g.f.crossSectionCurve, tr = g.f.trajectoryCurve, none = { pos: new Float32Array(0), nrm: new Float32Array(0), uv: null, idx: new Uint32Array(0), col: null };
    if (!N.isControl2D(cs) || !tr || tr.type !== 'NurbsCurve') return none;
    const c = N.curve({ pts: N.points(tr.f.controlPoint && BR.geo.coordOf(tr.f.controlPoint).f.point, 3), order: tr.f.order, knot: tr.f.knot, weight: tr.f.weight, closed: tr.f.closed });
    if (!c) return none;
    const pair = (a, k) => { const o = []; for (let i = 0; i + k <= a.length; i += k) o.push(Array.from(a.slice(i, i + k))); return o; };
    const m = N.extrude(pair(N.sample(c, tr.f.tessellation), 3), pair(N.control2D(cs, 0), 2));
    if (!m) return none;
    return g.f.ccw === false ? N.flip(m) : m;
  },
  changed(body, n, field) { if (field === 'crossSectionCurve' || field === 'trajectoryCurve') body.regeo(n); },
});
