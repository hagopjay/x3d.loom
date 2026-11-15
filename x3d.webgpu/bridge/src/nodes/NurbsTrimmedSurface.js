/* NurbsTrimmedSurface (NURBS level 4): a NurbsPatchSurface (the same fields and the same grid) cut by trimming contours (Contour2D: closed runs of u-v points in the surface's parametric domain).
   X_ITE 16.6.0: the unit square and every contour (scaled by the knot range) are cut with the ODD winding rule, so a point of the surface is kept when it lies inside an ODD number of contours
   (one contour keeps what is inside it; a contour inside another is a hole whichever way it runs), and the new corners take position, normal and texture coordinate from the grid triangle they
   fall in. No contour with points: the whole surface. The bridge does the same cut, exactly, per grid triangle (BR.nurbs.trim). addTrimmingContour adds the nodes that are not in the list yet,
   removeTrimmingContour takes nodes out; the list is announced as trimmingContour.
   Known difference: the trimming grid is the same as the patch's, so the cut edge of a contour is straight between grid corners only where the triangle edge is; the contour itself is the
   tessellation of its curves (BR.nurbs.control2D, the same rule as X_ITE). */
BR.node('NurbsTrimmedSurface', {
  component: 'NURBS', level: 4,
  container: 'geometry',
  defs: {
    addTrimmingContour: ['MFNode', IN, []],
    controlPoint: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    removeTrimmingContour: ['MFNode', IN, []],
    solid: ['SFBool', INIT, true],
    texCoord: ['SFNode', IO, null],
    trimmingContour: ['MFNode', IO, []],
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
  refs: ['controlPoint'],
  geometry(g) {
    const N = BR.nurbs, s = BR.nurbsPatchOf(g), none = { pos: new Float32Array(0), nrm: new Float32Array(0), uv: null, idx: new Uint32Array(0), col: null };
    if (!s) return none;
    const [nu, nv] = BR.nurbsGrid(g), t = g.f.texCoord, tp = t && ['TextureCoordinate', 'TextureCoordinate3D', 'TextureCoordinate4D'].includes(t.type) ? t.f.point : null;
    const w = t && t.type === 'TextureCoordinate4D' ? 4 : t && t.type === 'TextureCoordinate3D' ? 3 : 2, tpts = tp ? N.points(tp, w).map((p) => p.slice(0, 2)) : [];
    const m = N.mesh(s, nu, nv, tpts.length >= s.uDim * s.vDim ? s.sibling(tpts) : t && t.type === 'NurbsTextureCoordinate' ? BR.nurbsTexSurface(t) : null);
    const contours = (g.f.trimmingContour || []).filter((c) => c && c.type === 'Contour2D').map((c) => N.contour(c)).filter((c) => c.length);
    return contours.length ? N.trim(m, nu, nv, contours, s.uDomain, s.vDomain) : m;
  },
  receive(n, field, v) {
    if (field === 'addTrimmingContour' || field === 'removeTrimmingContour' || field === 'trimmingContour') {
      const cur = n.f.trimmingContour || [], list = [...v];
      n.f.trimmingContour = field === 'addTrimmingContour' ? cur.concat(list.filter((x) => !cur.includes(x))) : field === 'removeTrimmingContour' ? cur.filter((x) => !list.includes(x)) : list;
      n.version = (n.version || 0) + 1; events.emit(n, 'trimmingContour', n.f.trimmingContour); const b = R.bridge.body; if (b) b.regeo(n);
      return true;
    }
    return false;
  },
  changed(body, n, field) { if (field === 'uTessellation' || field === 'vTessellation' || field === 'weight' || field === 'controlPoint' || field === 'texCoord' || field === 'trimmingContour') body.regeo(n); },
});
