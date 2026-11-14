/* NurbsCurve2D (NURBS level 3): NurbsCurve2D defines a trimming segment that is part of a trimming contour in the u-v domain of a surface.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('NurbsCurve2D', {
  component: 'NURBS', level: 3,
  container: 'children',
  defs: {
    closed: ['SFBool', INIT, false],
    controlPoint: ['MFVec2d', IO, []],
    knot: ['MFDouble', INIT, []],
    metadata: ['SFNode', IO, null],
    order: ['SFInt32', INIT, 3],
    tessellation: ['SFInt32', IO, 0],
    weight: ['MFDouble', IO, []],
  },
  // A data node: nothing is drawn where it sits (it is the profile or trajectory of a swung surface, or a piece of a Contour2D). spec.tessellate(node, type) is what those nodes read:
  // type 0 [x, y, ...], type 1 [x, 0, y, ...], type 2 [x, y, 0, ...] (BR.nurbs.control2D). A change redraws the swung surfaces that use it.
  tessellate: (n, type) => BR.nurbs.control2D(n, type),
  changed(body, n) { BR.nurbs.redrawUsers(body, n); },
});
