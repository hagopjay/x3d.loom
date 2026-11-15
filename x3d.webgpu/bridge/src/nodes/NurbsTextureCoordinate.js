/* NurbsTextureCoordinate (NURBS level 1): the texture coordinates of a NurbsPatchSurface or NurbsTrimmedSurface as a NURBS surface of their own (its own orders, knots and control points in the
   (s, t) plane), read over its own parametric domain on the same grid as the surface it is the texCoord of. X_ITE 16.6.0 builds the control points as (x, y, 0, w) but samples them with
   haveWeights false, so the weights never divide anything: the texture coordinates are the plain B-spline of the control points and the weight field has no effect. This does the same on
   purpose (a gap is logged: the standard calls the surface rational). An invalid one (order below 2, fewer control points than the dimension needs) is ignored and the surface gets its
   default 0..1 coordinates. */
BR.nurbsTexSurface = (t) => {
  const N = BR.nurbs, f = t.f, uD = f.uDimension | 0, vD = f.vDimension | 0, pts = N.points(f.controlPoint, 2);
  if ((f.uOrder | 0) < 2 || (f.vOrder | 0) < 2 || uD < (f.uOrder | 0) || vD < (f.vOrder | 0) || pts.length < uD * vD) return null;
  const s = N.surface({ pts: pts.slice(0, uD * vD).map((p) => [p[0], p[1], 1]), uDim: uD, vDim: vD, uOrder: f.uOrder, vOrder: f.vOrder, uKnot: f.uKnot, vKnot: f.vKnot });
  return s && { uParam: s.uParam, vParam: s.vParam, at: (u, v) => { const p = s.at(u, v); return [p[0] / p[2], p[1] / p[2]]; } };
};
BR.node('NurbsTextureCoordinate', {
  component: 'NURBS', level: 1,
  container: 'texCoord',
  defs: {
    controlPoint: ['MFVec2f', IO, []],
    metadata: ['SFNode', IO, null],
    uDimension: ['SFInt32', INIT, 0],
    uKnot: ['MFDouble', INIT, []],
    uOrder: ['SFInt32', INIT, 3],
    vDimension: ['SFInt32', INIT, 0],
    vKnot: ['MFDouble', INIT, []],
    vOrder: ['SFInt32', INIT, 3],
    weight: ['MFDouble', IO, []],
  },
  // a change of the control points or the weights draws the surfaces that use it again
  changed(body, n, field) { if (body.world && (field === 'controlPoint' || field === 'weight')) for (const x of body.world.nodes) if ((x.type === 'NurbsPatchSurface' || x.type === 'NurbsTrimmedSurface') && x.f.texCoord === n) body.regeo(x); },
});
