/* NurbsSwungSurface (NURBS level 3): NurbsSwungSurface contains a profileCurve and a trajectoryCurve [X3DNurbsControlCurveNode].
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('NurbsSwungSurface', {
  component: 'NURBS', level: 3,
  container: 'geometry',
  defs: {
    ccw: ['SFBool', INIT, true],
    metadata: ['SFNode', IO, null],
    profileCurve: ['SFNode', IO, null],
    solid: ['SFBool', INIT, true],
    trajectoryCurve: ['SFNode', IO, null],
  },
  // The profile curve (a NurbsCurve2D or ContourPolyline2D, tessellated to points in x, y) is the cross-section and the trajectory curve (the same kinds, points in x, z of the XZ plane) is the spine
  // of an extrusion with smooth shading and no caps, which is the swung surface: the profile's x runs along the spine's local X axis, its y along the local Z axis (BR.nurbs.extrude). Both curves are
  // tessellated by their own tessellation fields. ccw FALSE reverses the faces and the normals. A missing curve, or one with fewer than two points, draws nothing.
  geometry(g) {
    const N = BR.nurbs, p = g.f.profileCurve, t = g.f.trajectoryCurve, none = { pos: new Float32Array(0), nrm: new Float32Array(0), uv: null, idx: new Uint32Array(0), col: null };
    if (!N.isControl2D(p) || !N.isControl2D(t)) return none;
    const pair = (a, k) => { const o = []; for (let i = 0; i + k <= a.length; i += k) o.push(a.slice(i, i + k)); return o; };
    const m = N.extrude(pair(N.control2D(t, 1), 3), pair(N.control2D(p, 0), 2));
    if (!m) return none;
    return g.f.ccw === false ? N.flip(m) : m;
  },
  changed(body, n, field) { if (field === 'profileCurve' || field === 'trajectoryCurve') body.regeo(n); },
});
