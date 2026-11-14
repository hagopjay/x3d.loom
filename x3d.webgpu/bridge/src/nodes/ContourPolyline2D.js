/* ContourPolyline2D (NURBS level 3): ContourPolyline2D defines a linear curve segment as part of a trimming contour in the u-v domain of a NURBS surface.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ContourPolyline2D', {
  component: 'NURBS', level: 3,
  container: 'children',
  defs: {
    controlPoint: ['MFVec2d', IO, []],
    metadata: ['SFNode', IO, null],
  },
  // A data node like NurbsCurve2D: the segment is the polyline through its control points (type 0 [x, y, ...], 1 [x, 0, y, ...], 2 [x, y, 0, ...]); a swung surface or a Contour2D reads it.
  tessellate: (n, type) => BR.nurbs.control2D(n, type),
  changed(body, n) { BR.nurbs.redrawUsers(body, n); },
});
