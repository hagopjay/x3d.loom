/* NurbsPatchSurface (NURBS level 1): NurbsPatchSurface defines a contiguous 3D Non-Uniform Rational B-Spline (NURBS) surface.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
/* the surface of a NurbsPatchSurface (and, later, the base of a trimmed one): null when the data cannot make a surface */
BR.nurbsPatchOf = (g) => {
  const f = g.f, N = BR.nurbs;
  return N.surface({ pts: N.points(f.controlPoint && f.controlPoint.f.point, 3), uDim: f.uDimension, vDim: f.vDimension, uOrder: f.uOrder, vOrder: f.vOrder, uKnot: f.uKnot, vKnot: f.vKnot, weight: f.weight, uClosed: f.uClosed, vClosed: f.vClosed });
};
/* the segments over the surface: the tessellation field (BR.nurbs.tessellation) times the tessellationScale of the NurbsSet that holds it, rounded down, at least 1 */
BR.nurbsGrid = (g, s) => {
  const f = g.f, k = g._tessScale === undefined ? 1 : g._tessScale;
  return [Math.max(1, Math.floor(BR.nurbs.tessellation(f.uTessellation, f.uDimension) * k)), Math.max(1, Math.floor(BR.nurbs.tessellation(f.vTessellation, f.vDimension) * k))];
};
BR.node('NurbsPatchSurface', {
  component: 'NURBS', level: 1,
  container: 'geometry',
  defs: {
    controlPoint: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
    uClosed: ['SFBool', INIT, false],
    uDimension: ['SFInt32', INIT, 0],
    uKnot: ['MFDouble', INIT, []],
    uOrder: ['SFInt32', INIT, 3],
    uTessellation: ['SFInt32', IO, 0],
    vClosed: ['SFBool', INIT, false],
    vDimension: ['SFInt32', INIT, 0],
    vKnot: ['MFDouble', INIT, []],
    vOrder: ['SFInt32', INIT, 3],
    vTessellation: ['SFInt32', IO, 0],
    weight: ['MFDouble', IO, []],
  },
  // A geometry node drawn through the triangle path: a (nu + 1) x (nv + 1) grid of the rational surface, two triangles a cell, counter-clockwise round the normal dS/du x dS/dv; the normals are the
  // analytic ones (smooth, not the face normals X_ITE averages); texture coordinates run 0..1 over the grid, or come from a TextureCoordinate node with one coordinate per control point (it is
  // evaluated over the same knots, the way the standard says). NurbsTextureCoordinate is a later batch. The grid is drawn again when a tessellation, the weights, the control points or the
  // texture coordinates change, and when a NurbsSet changes its tessellationScale.
  refs: ['controlPoint'],
  geometry(g) {
    const s = BR.nurbsPatchOf(g), N = BR.nurbs;
    if (!s) return { pos: new Float32Array(0), nrm: new Float32Array(0), uv: null, idx: new Uint32Array(0), col: null };
    const [nu, nv] = BR.nurbsGrid(g), t = g.f.texCoord, tp = t && ['TextureCoordinate', 'TextureCoordinate3D', 'TextureCoordinate4D'].includes(t.type) ? t.f.point : null;
    const w = t && t.type === 'TextureCoordinate4D' ? 4 : t && t.type === 'TextureCoordinate3D' ? 3 : 2, tpts = tp ? N.points(tp, w).map((p) => p.slice(0, 2)) : [];
    return N.mesh(s, nu, nv, tpts.length >= s.uDim * s.vDim ? s.sibling(tpts) : null);
  },
  changed(body, n, field) { if (field === 'uTessellation' || field === 'vTessellation' || field === 'weight' || field === 'controlPoint' || field === 'texCoord') body.regeo(n); },
});
