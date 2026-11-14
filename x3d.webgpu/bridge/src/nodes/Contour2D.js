/* Contour2D (NURBS level 4): Contour2D groups a set of curve segments into a composite contour.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Contour2D', {
  component: 'NURBS', level: 4,
  container: 'trimmingContour',
  defs: {
    addChildren: ['MFNode', IN, []],
    children: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    removeChildren: ['MFNode', IN, []],
  },
  // A trimming contour (the hole or outer edge of a NurbsTrimmedSurface): the NurbsCurve2D and ContourPolyline2D children, in order, as one run of u-v points (BR.nurbs.contour; other
  // children stay in the list and are skipped). addChildren adds the nodes that are not in the list yet, removeChildren takes nodes out; the list is announced as children.
  // Nothing is drawn where it sits; the trimmed surface (a later batch) reads spec.contour(node).
  contour: (n) => BR.nurbs.contour(n),
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  changed(body, n) { BR.nurbs.redrawUsers(body, n); },
});
